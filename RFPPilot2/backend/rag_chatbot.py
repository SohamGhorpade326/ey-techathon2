"""RAG Chatbot using ChromaDB + Groq.

- Indexes product catalog, RFP data, technical and pricing outputs into ChromaDB
- Retrieves relevant chunks for each query
- Injects dynamic pipeline state as additional context
- Uses Groq LLM (llama-3.3-70b-versatile) for responses

Note: This module intentionally avoids LangChain to reduce dependency conflicts.
"""

import os
import json
import hashlib
import logging
from typing import List, Dict, Any, Optional

from dotenv import load_dotenv
load_dotenv()

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

try:
    from groq import Groq
except Exception:
    Groq = None

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCT_CATALOG_PATH = os.path.join(BASE_DIR, "data", "product_catalog.json")
CHROMA_PERSIST_DIR = os.path.join(BASE_DIR, "chroma_db")

# ─────────────────────────────────────────────
# CHROMADB SETUP  (persistent local vector store)
# ─────────────────────────────────────────────
_embedding_fn = SentenceTransformerEmbeddingFunction(
    model_name="BAAI/bge-large-en",
    device="cpu"
)

_chroma_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

_collection = _chroma_client.get_or_create_collection(
    name="rfpilot_knowledge",
    embedding_function=_embedding_fn,
    metadata={"hnsw:space": "cosine"}
)


def _doc_id(source: str, chunk_idx: int) -> str:
    raw = f"{source}::{chunk_idx}"
    return hashlib.md5(raw.encode()).hexdigest()


def _chunk_text(text: str, chunk_size: int = 400, overlap: int = 80) -> List[str]:
    """Simple sliding-window chunker."""
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i: i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
        i += chunk_size - overlap
    return chunks


# ─────────────────────────────────────────────
# INDEX HELPERS
# ─────────────────────────────────────────────
def _already_indexed(source_key: str) -> bool:
    results = _collection.get(where={"source": source_key}, limit=1)
    return len(results["ids"]) > 0


def index_product_catalog():
    """Index the product catalog JSON into ChromaDB (runs once on startup)."""
    if _already_indexed("product_catalog"):
        logger.info("[RAG] Product catalog already indexed")
        return

    if not os.path.exists(PRODUCT_CATALOG_PATH):
        logger.warning("[RAG] Product catalog not found at %s", PRODUCT_CATALOG_PATH)
        return

    with open(PRODUCT_CATALOG_PATH, "r") as f:
        catalog = json.load(f)

    docs, ids, metas = [], [], []
    for sku in catalog:
        text = (
            f"SKU: {sku.get('sku_id', '')} | "
            f"Name: {sku.get('name', '')} | "
            f"Category: {sku.get('category', '')} | "
            f"Specs: {json.dumps(sku.get('specs', {}))} | "
            f"Price: {sku.get('price_inr', '')} INR | "
            f"Description: {sku.get('description', '')}"
        )
        for i, chunk in enumerate(_chunk_text(text)):
            uid = _doc_id(f"catalog::{sku.get('sku_id','')}", i)
            docs.append(chunk)
            ids.append(uid)
            metas.append({"source": "product_catalog", "sku_id": str(sku.get("sku_id", ""))})

    if docs:
        _collection.add(documents=docs, ids=ids, metadatas=metas)
        logger.info("[RAG] Indexed %d product catalog chunks", len(docs))


def index_rfp_data(rfp_list: List[Dict]):
    """Dynamically index RFP metadata from the pipeline store."""
    for rfp in rfp_list:
        rfp_id = str(rfp.get("rfp_id", "unknown"))
        source_key = f"rfp::{rfp_id}"
        if _already_indexed(source_key):
            continue

        text = (
            f"RFP ID: {rfp_id} | "
            f"Title: {rfp.get('rfp_title', '')} | "
            f"Buyer: {rfp.get('buyer', '')} | "
            f"Domain: {rfp.get('domain', '')} | "
            f"Deadline: {rfp.get('submission_deadline', '')} | "
            f"Value: {rfp.get('estimated_project_value', '')} | "
            f"Priority: {rfp.get('priority', '')} | "
            f"Scope: {rfp.get('scope_items', '')}"
        )
        for i, chunk in enumerate(_chunk_text(text)):
            uid = _doc_id(source_key, i)
            _collection.add(
                documents=[chunk],
                ids=[uid],
                metadatas=[{"source": source_key, "rfp_id": rfp_id}]
            )
        logger.info("[RAG] Indexed RFP: %s", rfp_id)


def index_technical_output(technical: Dict):
    """Index technical agent output (SKU matches, specs)."""
    rfp_id = str(technical.get("rfp_id", "current"))
    source_key = f"technical::{rfp_id}"
    if _already_indexed(source_key):
        return

    items = technical.get("items", [])
    for item in items:
        text = (
            f"Item: {item.get('item_name', '')} | "
            f"Best Match SKU: {item.get('best_match_sku', '')} | "
            f"Spec Match: {item.get('spec_match_percent', 0)}% | "
            f"Status: {item.get('status', '')} | "
            f"Justification: {item.get('match_justification', '')} | "
            f"Alternatives: {json.dumps(item.get('top_3_alternatives', []))}"
        )
        for i, chunk in enumerate(_chunk_text(text)):
            uid = _doc_id(f"{source_key}::{item.get('item_name', i)}", i)
            _collection.add(
                documents=[chunk],
                ids=[uid],
                metadatas=[{"source": source_key, "rfp_id": rfp_id, "type": "technical"}]
            )
    logger.info("[RAG] Indexed technical output for RFP: %s", rfp_id)


def index_pricing_output(pricing: Dict):
    """Index pricing agent output."""
    rfp_id = str(pricing.get("rfp_id", "current"))
    source_key = f"pricing::{rfp_id}"
    if _already_indexed(source_key):
        return

    text = json.dumps(pricing, indent=2)
    for i, chunk in enumerate(_chunk_text(text)):
        uid = _doc_id(source_key, i)
        _collection.add(
            documents=[chunk],
            ids=[uid],
            metadatas=[{"source": source_key, "rfp_id": rfp_id, "type": "pricing"}]
        )
    logger.info("[RAG] Indexed pricing output for RFP: %s", rfp_id)


# ─────────────────────────────────────────────
# RETRIEVAL
# ─────────────────────────────────────────────
def retrieve(query: str, top_k: int = 6) -> List[str]:
    """Retrieve top_k relevant chunks from ChromaDB."""
    try:
        results = _collection.query(
            query_texts=[query],
            n_results=min(top_k, _collection.count() or 1)
        )
        return results["documents"][0] if results["documents"] else []
    except Exception as e:
        logger.error("[RAG] Retrieval error: %s", e)
        return []


# ─────────────────────────────────────────────
# LLM
# ─────────────────────────────────────────────
def _get_client() -> Optional["Groq"]:
    if not GROQ_API_KEY or Groq is None:
        return None
    return Groq(api_key=GROQ_API_KEY)


# ─────────────────────────────────────────────
# MAIN CHAT FUNCTION
# ─────────────────────────────────────────────
def chat(
    message: str,
    history: List[Dict[str, str]] = None,
    dynamic_context: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Main RAG chat function.

    Args:
        message: User's question
        history: List of {role, content} previous messages
        dynamic_context: Current pipeline state dict with keys:
            selected_rfp, technical_output, pricing_output, proposal

    Returns:
        {response, sources_used, error}
    """
    history = history or []
    dynamic_context = dynamic_context or {}

    # 1. Retrieve relevant chunks from vector DB
    retrieved_chunks = retrieve(message, top_k=6)
    rag_context = "\n\n".join(
        f"[Retrieved {i+1}]: {chunk}" for i, chunk in enumerate(retrieved_chunks)
    )

    # 2. Build dynamic state summary
    state_parts = []
    if dynamic_context.get("client_route"):
        state_parts.append(f"Current Page: {dynamic_context['client_route']}")
    if dynamic_context.get("selected_rfp"):
        rfp = dynamic_context["selected_rfp"]
        state_parts.append(
            f"Current RFP: {rfp.get('rfp_title', 'N/A')} | "
            f"Buyer: {rfp.get('buyer', 'N/A')} | "
            f"Domain: {rfp.get('domain', 'N/A')} | "
            f"Value: {rfp.get('estimated_project_value', 'N/A')}"
        )
    if dynamic_context.get("technical_summary"):
        state_parts.append(f"Technical Summary: {dynamic_context['technical_summary']}")
    if dynamic_context.get("pricing_summary"):
        state_parts.append(f"Pricing Summary: {dynamic_context['pricing_summary']}")

    state_context = "\n".join(state_parts) if state_parts else "No active pipeline state."

    # 3. Build system prompt
    system_prompt = f"""You are RFPilot AI Assistant — an intelligent procurement expert embedded in the RFPilot agentic platform.

You help users understand RFP analysis results, SKU matches, pricing breakdowns, and bid strategies.

CURRENT PIPELINE STATE:
{state_context}

RETRIEVED KNOWLEDGE (from vector database):
{rag_context if rag_context else "No relevant documents retrieved."}

GUIDELINES:
- Answer based on the retrieved knowledge and pipeline state above
- Be concise, specific, and professional
- If asked about SKU matches or pricing, reference the actual data above
- If information is not available, say so clearly
- Format numbers and specs clearly (e.g. ₹7,47,510, 85% match)
- Keep responses under 250 words unless a detailed breakdown is requested
"""

    # 4. Build message list for LLM
    client = _get_client()
    if not client:
        return {
            "response": "❌ Groq client not available. Ensure GROQ_API_KEY is set and the 'groq' package is installed.",
            "sources_used": 0,
            "error": "no_groq_client"
        }

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

    # Add chat history (last 6 turns to keep context window manageable)
    for turn in history[-6:]:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if role == "assistant":
            messages.append({"role": "assistant", "content": content})
        else:
            messages.append({"role": "user", "content": content})

    messages.append({"role": "user", "content": message})

    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.3,
            max_tokens=800,
        )

        content = ""
        try:
            content = (resp.choices[0].message.content or "").strip()
        except Exception:
            content = ""
        return {
            "response": content,
            "sources_used": len(retrieved_chunks),
            "error": None
        }
    except Exception as e:
        logger.error("[RAG] LLM error: %s", e)
        return {
            "response": f"Sorry, I encountered an error: {str(e)}",
            "sources_used": 0,
            "error": str(e)
        }


# ─────────────────────────────────────────────
# STARTUP INDEXING
# ─────────────────────────────────────────────
def startup_index():
    """Call this at app startup to index static data."""
    try:
        index_product_catalog()
        logger.info("[RAG] ✅ RAG chatbot ready")
    except Exception as e:
        logger.error("[RAG] Startup indexing error: %s", e)
