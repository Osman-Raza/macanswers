"""
Base scraper class. Each McMaster source extends this.

This version uses the smart HTML parser (html_parser.parse_html) which
emits semantically meaningful chunks (table rows as prose, FAQ pairs,
headings with their content) instead of flattening to text and chopping
by word count.

KEY DETAIL: chunks are embedded with the source_name prepended to the text.
This boosts the embedding's topic signal so queries like "computer science
tuition" match Tuition & Fees chunks even when the on-page heading is
just "Engineering Computer Science" without the word "tuition."
The DISPLAYED content stays as the original chunk; only the embedding input
is augmented.
"""
from __future__ import annotations
import math
import os
import time
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

import requests
from dotenv import load_dotenv
import google.generativeai as genai  # type: ignore
from supabase import create_client, Client  # type: ignore

from .html_parser import parse_html

load_dotenv(Path(__file__).parent.parent / ".env")


# ── Clients ───────────────────────────────────────────────────────────────────
def get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


# ── Embedding config ──────────────────────────────────────────────────────────
EMBED_MODEL = "models/gemini-embedding-001"
EMBED_DIM = 768
SLEEP_BETWEEN_EMBEDS = 2.0   # free-tier RPM cushion


def _normalize(vec: list[float]) -> list[float]:
    n = math.sqrt(sum(v * v for v in vec))
    if n == 0:
        return vec
    return [v / n for v in vec]


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Batch embed via Gemini. Returns list of normalized 768-dim vectors.

    Uses task_type="retrieval_document" — this tells Gemini to optimize the
    embedding for being SEARCHED AGAINST (i.e., as the document side of
    query-document matching). The backend should use "retrieval_query" for
    user queries. This asymmetric typing is the documented best practice
    for RAG and noticeably improves match quality vs. untyped embeddings.
    """
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    embeddings: list[list[float]] = []
    for text in texts:
        safe = text[:8000]   # rough cap to stay under model token limit
        result = genai.embed_content(
            model=EMBED_MODEL,
            content=safe,
            task_type="retrieval_document",
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


# ── Backwards compat helper ───────────────────────────────────────────────────
def clean_html(html: str) -> str:
    """Deprecated: returns html unchanged. The base scraper now does smart parsing."""
    return html


# ── Base Scraper ──────────────────────────────────────────────────────────────
class BaseScraper(ABC):
    source_name: str
    source_url: str

    # If True, subclass.parse() returns raw HTML and we parse it smartly.
    # If False (legacy), subclass.parse() returns already-cleaned text and we
    # just word-chunk it for backwards compat. Default: True for new behavior.
    smart_parse: bool = True

    def run(self):
        print(f"[{self.source_name}] Fetching {self.source_url} ...")
        html = self._fetch(self.source_url)

        # Let subclass do any source-specific pre-processing
        prepared = self.parse(html)

        if self.smart_parse:
            chunks = parse_html(prepared)
        else:
            # Legacy: subclass returned cleaned text, just word-chunk it
            chunks = _word_chunks(prepared, size=200, overlap=30)

        if not chunks:
            raise RuntimeError(
                f"[{self.source_name}] parser produced 0 chunks — "
                f"aborting to avoid wiping existing data."
            )

        total_chars = sum(len(c) for c in chunks)
        if total_chars < 200:
            raise RuntimeError(
                f"[{self.source_name}] parsed text too short ({total_chars} chars) — "
                f"aborting to avoid wiping existing chunks."
            )

        print(f"[{self.source_name}] {len(chunks)} chunks — embedding ...")

        # KEY FIX: prepend source_name to the text we embed (NOT to the stored
        # content). This gives every chunk a strong topical signal — "Tuition & Fees"
        # will appear at the start of every tuition chunk's embedding, so queries
        # mentioning "tuition" match all tuition chunks even when the on-page heading
        # is just "Engineering Computer Science" without the word "tuition."
        embed_inputs = [f"{self.source_name} | {c}" for c in chunks]
        embeddings = embed_texts(embed_inputs)

        run_id = str(uuid.uuid4())
        rows = [
            {
                "source_url": self.source_url,
                "source_name": self.source_name,
                "content": chunk,                # original, for display
                "embedding": emb,                # source-augmented, for retrieval
                "scrape_run_id": run_id,
            }
            for chunk, emb in zip(chunks, embeddings)
        ]

        sb = get_supabase()
        sb.table("knowledge_chunks").insert(rows).execute()
        sb.table("knowledge_chunks") \
            .delete() \
            .eq("source_url", self.source_url) \
            .neq("scrape_run_id", run_id) \
            .execute()

        print(f"[{self.source_name}] ✓ {len(rows)} chunks saved (run {run_id[:8]}).")

    @abstractmethod
    def parse(self, html: str) -> str:
        """
        Default behavior: return the raw HTML so the base class smart-parses it.
        Override only if you need to transform the page before parsing
        (e.g. inject extra text, slice out a sub-section).
        """
        ...

    @staticmethod
    def _fetch(url: str, timeout: int = 15) -> str:
        headers = {"User-Agent": "MacAnswers-Bot/1.0 (+https://macanswers.ca)"}
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


# ── Legacy word-chunker (kept for back-compat) ─────────────────────────────────
def _word_chunks(text: str, size: int = 200, overlap: int = 30) -> list[str]:
    words = text.split()
    out: list[str] = []
    i = 0
    while i < len(words):
        c = " ".join(words[i : i + size])
        if c:
            out.append(c)
        i += size - overlap
    return out