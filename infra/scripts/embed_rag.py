"""
RAG 문서에 Ollama nomic-embed-text 임베딩을 추가하는 초기화 스크립트

사전 조건:
  1. Ollama가 실행 중이어야 함 (docker-compose up ollama 또는 로컬 ollama serve)
  2. nomic-embed-text 모델이 풀되어 있어야 함:
       ollama pull nomic-embed-text

실행:
  python infra/scripts/embed_rag.py
"""
import os
import requests
from supabase import create_client
from dotenv import load_dotenv

load_dotenv("services/api-fastapi/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_embedding(text: str) -> list[float]:
    """Ollama nomic-embed-text로 768차원 임베딩 생성"""
    response = requests.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={"model": EMBED_MODEL, "prompt": text},
        timeout=60
    )
    response.raise_for_status()
    return response.json()["embedding"]

def embed_documents():
    print(f"Connecting to Ollama: {OLLAMA_URL}")
    print(f"Embedding model: {EMBED_MODEL}")

    try:
        requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        print("Ollama connection confirmed")
    except Exception:
        print("Cannot connect to Ollama. Make sure 'ollama serve' is running.")
        return

    docs = supabase.table('rag_documents').select('id, content, title').is_('embedding', 'null').execute()

    if not docs.data:
        print("All documents already have embeddings.")
        return

    print(f"Documents to embed: {len(docs.data)}")

    for i, doc in enumerate(docs.data, 1):
        print(f"  [{i}/{len(docs.data)}] {doc['title'][:30]}...")
        try:
            embedding = get_embedding(doc['content'])
            supabase.table('rag_documents').update({
                'embedding': embedding
            }).eq('id', doc['id']).execute()
        except Exception as e:
            print(f"  Failed: {e}")

    print(f"\nCompleted embedding {len(docs.data)} documents (768d / nomic-embed-text)")

if __name__ == "__main__":
    embed_documents()