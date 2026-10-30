"""Embed NULL RAG documents with Ollama or an OpenAI-compatible API.

Run from the repository root: python infra/scripts/embed_rag.py [--force]
--force re-embeds every document; keep the query and document models identical.
"""
import argparse
import os

import httpx
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("services/api-fastapi/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
EMBED_PROVIDER = os.getenv("EMBED_PROVIDER", "ollama")
EMBED_API_BASE_URL = (
    os.getenv("EMBED_API_BASE_URL", "").strip() or os.getenv("CHAT_API_BASE_URL", "").strip()
).rstrip("/")
EMBED_API_KEY = os.getenv("EMBED_API_KEY", "").strip() or os.getenv("CHAT_API_KEY", "").strip()
EMBED_API_MODEL = os.getenv("EMBED_API_MODEL", "").strip()
EMBED_DIMENSIONS = int(os.getenv("EMBED_DIMENSIONS", "768"))

def get_embedding(text: str) -> list[float]:
    """Generate a vector matching rag_documents.embedding's 768 dimensions."""
    if EMBED_DIMENSIONS != 768:
        raise ValueError("EMBED_DIMENSIONS must be 768 for rag_documents")
    if EMBED_PROVIDER == "openai_compatible":
        if not (EMBED_API_BASE_URL and EMBED_API_KEY and EMBED_API_MODEL):
            raise ValueError("Embedding API configuration is incomplete")
        response = httpx.post(
            f"{EMBED_API_BASE_URL}/embeddings",
            headers={"Authorization": f"Bearer {EMBED_API_KEY}"},
            json={"model": EMBED_API_MODEL, "input": text, "dimensions": EMBED_DIMENSIONS},
            timeout=30,
        )
    elif EMBED_PROVIDER == "ollama":
        response = httpx.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": EMBED_MODEL, "prompt": text},
            timeout=60,
        )
    else:
        raise ValueError("Unsupported EMBED_PROVIDER")
    response.raise_for_status()
    embedding = (
        response.json()["data"][0]["embedding"]
        if EMBED_PROVIDER == "openai_compatible" else response.json()["embedding"]
    )
    if not isinstance(embedding, list) or len(embedding) != EMBED_DIMENSIONS:
        raise ValueError("Embedding API returned an unexpected vector dimension")
    return embedding

def embed_documents(force: bool = False) -> None:
    """Use the server service-role client; report successes and failures separately."""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    docs = []
    # Collect before updating, so NULL-filtered pages cannot shift during writes.
    while True:
        query = supabase.table("rag_documents").select("id, content, title")
        if not force:
            query = query.is_("embedding", "null")
        page = query.order("id").range(len(docs), len(docs) + 999).execute().data or []
        docs.extend(page)
        if len(page) < 1000:
            break

    print(f"Documents to embed: {len(docs)}")
    if not docs:
        print("All documents already have embeddings.")
        return

    completed = 0
    for i, doc in enumerate(docs, 1):
        print(f"  [{i}/{len(docs)}]")
        try:
            embedding = get_embedding(doc['content'])
            supabase.table('rag_documents').update({
                'embedding': embedding
            }).eq('id', doc['id']).execute()
            completed += 1
        except Exception as e:
            print(f"  Failed: {type(e).__name__}")

    print(f"\nCompleted: {completed}; failed: {len(docs) - completed}; dimensions: 768")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Re-embed all documents")
    embed_documents(force=parser.parse_args().force)
