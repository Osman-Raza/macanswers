"""
scripts/verify_embeddings.py

Run this once after deploying the fixes to confirm:
  1. embed() returns 768 dims
  2. the vector is normalized (||v|| ≈ 1)
  3. inserts into Supabase succeed
  4. match_chunks RPC returns sensible similarity scores

Usage:
  cd scraper
  python -m scripts.verify_embeddings

You only need this once. Delete the script after launch if you want.
"""
import math
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Allow running from anywhere
sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(Path(__file__).parent.parent / ".env")

from scrapers.base import embed_texts, get_supabase  # noqa: E402


def magnitude(v):
    return math.sqrt(sum(x * x for x in v))


def main():
    print("1. Testing embed dimensions and normalization...")
    samples = [
        "When is the last day to drop a course at McMaster?",
        "How do I apply for OSAP financial aid?",
    ]
    vecs = embed_texts(samples)

    for i, v in enumerate(vecs):
        assert len(v) == 768, f"Expected 768 dims, got {len(v)}"
        m = magnitude(v)
        assert abs(m - 1.0) < 1e-4, f"Expected unit norm, got {m}"
        print(f"   ✓ Sample {i + 1}: 768 dims, ||v|| = {m:.6f}")

    print("\n2. Round-trip test: insert + match_chunks...")
    sb = get_supabase()

    # Use a sentinel source_url so we don't pollute real data
    sentinel_url = "https://_test_/verify_embeddings"
    sb.table("knowledge_chunks").delete().eq("source_url", sentinel_url).execute()
    sb.table("knowledge_chunks").insert([
        {
            "source_url": sentinel_url,
            "source_name": "Test",
            "content": samples[0],
            "embedding": vecs[0],
        }
    ]).execute()
    print("   ✓ Inserted test chunk")

    # Query with the second sample — should still match the first decently
    result = sb.rpc("match_chunks", {
        "query_embedding": vecs[1],
        "match_count": 3,
        "match_threshold": 0.1,
    }).execute()

    matches = result.data or []
    test_match = next((m for m in matches if m["source_url"] == sentinel_url), None)
    assert test_match is not None, "Test chunk not returned by match_chunks"
    sim = test_match["similarity"]
    print(f"   ✓ match_chunks returned similarity = {sim:.4f}")
    assert 0.0 < sim < 1.0, f"Similarity should be in (0,1), got {sim}"

    # Clean up
    sb.table("knowledge_chunks").delete().eq("source_url", sentinel_url).execute()
    print("   ✓ Cleaned up test row")

    print("\n✅ All checks passed. Embeddings + RPC are working correctly.")


if __name__ == "__main__":
    main()
