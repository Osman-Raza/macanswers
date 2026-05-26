"""
Base scraper class. Each McMaster source extends this.
"""
from __future__ import annotations
import math
import os
import re
import time
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import google.generativeai as genai  # type: ignore
from supabase import create_client, Client  # type: ignore

load_dotenv(Path(__file__).parent.parent / ".env")

# ── Clients ───────────────────────────────────────────────────────────────────
def get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


# ── Embedding config ──────────────────────────────────────────────────────────
# gemini-embedding-001 defaults to 3072 dims, but our DB column is vector(768).
# We MUST pass output_dimensionality=768 AND normalize manually (Gemini only
# auto-normalizes 3072-dim vectors).
EMBED_MODEL = "models/gemini-embedding-001"
EMBED_DIM = 768

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
SLEEP_BETWEEN_EMBEDS = 2.0   # seconds; free-tier RPM cushion


def clean_html(html: str) -> str:
    """Strip tags and collapse whitespace."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["nav", "footer", "script", "style", "header"]):
        tag.decompose()
    text = soup.get_text(separator=" ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks (by word count)."""
    words = text.split()
    chunks: list[str] = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + size])
        if chunk:
            chunks.append(chunk)
        i += size - overlap
    return chunks


def _normalize(vec: list[float]) -> list[float]:
    n = math.sqrt(sum(v * v for v in vec))
    if n == 0:
        return vec
    return [v / n for v in vec]


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed via Gemini. Returns list of normalized 768-dim vectors."""
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    embeddings: list[list[float]] = []
    for text in texts:
        # Truncate to stay under the 2048-token model limit (rough char cap)
        safe = text[:8000]
        result = genai.embed_content(
            model=EMBED_MODEL,
            content=safe,
            output_dimensionality=EMBED_DIM,
        )
        vec = result["embedding"]
        if len(vec) != EMBED_DIM:
            raise RuntimeError(
                f"Embedding dim mismatch: got {len(vec)}, expected {EMBED_DIM}"
            )
        embeddings.append(_normalize(vec))
        time.sleep(SLEEP_BETWEEN_EMBEDS)
    return embeddings


# ── Base Scraper ──────────────────────────────────────────────────────────────
class BaseScraper(ABC):
    source_name: str
    source_url: str

    def run(self):
        print(f"[{self.source_name}] Fetching {self.source_url} ...")
        html = self._fetch(self.source_url)
        text = self.parse(html)

        if not text or len(text.strip()) < 50:
            raise RuntimeError(
                f"[{self.source_name}] parsed text too short ({len(text or '')} chars) — "
                f"aborting to avoid wiping existing chunks."
            )

        chunks = chunk_text(text)
        print(f"[{self.source_name}] {len(chunks)} chunks — embedding ...")
        embeddings = embed_texts(chunks)

        # Tag this scrape run so we can safely insert-then-delete.
        # If embedding or insert fails above, the old rows stay intact.
        run_id = str(uuid.uuid4())
        rows = [
            {
                "source_url": self.source_url,
                "source_name": self.source_name,
                "content": chunk,
                "embedding": emb,
                "scrape_run_id": run_id,
            }
            for chunk, emb in zip(chunks, embeddings)
        ]

        sb = get_supabase()
        sb.table("knowledge_chunks").insert(rows).execute()

        # Now that new rows are committed, remove old rows for this source.
        sb.table("knowledge_chunks") \
            .delete() \
            .eq("source_url", self.source_url) \
            .neq("scrape_run_id", run_id) \
            .execute()

        print(f"[{self.source_name}] ✓ {len(rows)} chunks saved (run {run_id[:8]}).")

    @abstractmethod
    def parse(self, html: str) -> str: ...

    @staticmethod
    def _fetch(url: str, timeout: int = 15) -> str:
        headers = {"User-Agent": "MacAnswers-Bot/1.0 (+https://macanswers.ca)"}
        # One retry with backoff for transient failures
        last_err = None
        for attempt in range(2):
            try:
                resp = requests.get(url, headers=headers, timeout=timeout, verify=True)
                resp.raise_for_status()
                return resp.text
            except Exception as e:
                last_err = e
                if attempt == 0:
                    time.sleep(3)
        raise last_err  # type: ignore[misc]
