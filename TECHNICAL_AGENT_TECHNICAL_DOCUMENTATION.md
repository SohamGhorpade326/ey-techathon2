# Technical Agent — Matching Engine & Architecture (Code-Faithful)

This document covers only the **Technical Agent** implementation: how it turns Sales/Master outputs into **SKU recommendations** with **explainability** and **gap intelligence**.

Source of truth:
- Core implementation: [RFPPilot2/backend/wonky_SBERT_copilot.py](RFPPilot2/backend/wonky_SBERT_copilot.py)
- UI formatting helpers: [RFPPilot2/backend/tech_formatters.py](RFPPilot2/backend/tech_formatters.py)

---

## 0) What the Technical Agent does (in one sentence)

Given a selected RFP + extracted item list, it matches each item to the **best 3 SKUs** from MongoDB `product_catalog` using a hybrid of:

- LLM+regex **structured spec extraction**,
- domain/category **candidate filtering**,
- **SBERT embeddings** + FAISS HNSW approximate nearest neighbor shortlisting,
- a domain-aware **rule scoring** function that outputs a final match score (0–100),
- XAI text generation and **gap intelligence** persistence.

---

## 1) Inputs, outputs, and state contract

### 1.1 Inputs pulled from the pipeline state

The node entrypoint is `technical_agent_node(state)`.

It expects (at minimum):

- `state["master_output"]["technical_summary"]` containing:
  - `rfp_context` (includes `rfp_id`, `domain`, etc.)
  - `scope_context` (material type + expected categories)
  - `pdf_path` (for PDF-based RFPs)

It also consumes (preferentially) items created by Sales Agent:

- `state["extracted_item_list_structured"]` OR
- `state["sales_output"][0]["extracted_item_list_structured"]`

Fallbacks:

- `state["extracted_item_list"]` or `state["sales_output"][0]["extracted_item_list"]`
- If no item list exists at all, it can call `extract_items_llm(full_text, material_type, categories)` to extract items from text.

### 1.2 PDF text is expected to be cached by Sales Agent

For standard (non-Gmail) RFPs, Technical Agent does **zero PDF IO**. It requires:

- `state["pdf_text_cache"][pdf_path]` to exist

If the cached text is missing, it throws a runtime error stating that Sales Agent must cache all PDFs.

### 1.3 Gmail mode (text-only)

If `state["gmail_rfp_text"]` exists, Technical Agent runs in Gmail mode:

- skips PDF existence checks
- uses higher vector-weight scoring
- enables extra normalization + hard spec filtering for better precision

### 1.4 Outputs

Technical Agent produces two outputs:

- Raw internal output:
  - `state["technical_output_raw"] = {"rfp_id", "domain", "items": [...]}`
- Frontend-shaped output:
  - `state["technical_output"] = format_technical_for_frontend(raw_output)`

Each raw `items[]` entry includes:

- `item_name`, `required_technical_specs`, `quantity`, `unit`
- `best_match_sku` (or `NO_MATCH`)
- `spec_match_percent` (0–100)
- `status` (`Matched`, `Warning`, `Review`, `No Match`)
- `top_3_skus` (each includes a `delta_explanation` string)
- `match_justification` (long-form XAI text)

---

## 2) Data sources & persistence

### 2.1 MongoDB collections used by Technical Agent

Mongo connection is created in [RFPPilot2/backend/wonky_SBERT_copilot.py](RFPPilot2/backend/wonky_SBERT_copilot.py) and used directly:

- Reads SKU catalog from `db["product_catalog"]`
- Writes gap intelligence to `db["sku_gap_intelligence"]`

Important implementation detail:

- The Mongo URI is taken from `MONGO_URI2` (env var).
- The database name is **hard-coded** as `db = client["agentic_rfp"]` (it does not consult `MONGO_DB_NAME`).

### 2.2 `product_catalog` schema fields used

The preload query pulls (projection):

- `sku_code`
- `product_name`
- `category`
- `specifications` (dict)
- `unit_price_inr`
- `standards` (list)

Downstream logic relies heavily on:

- `category` for candidate pools
- `specifications.voltage`, `specifications.conductor_material`, `specifications.insulation_type`, etc.

### 2.3 Gap intelligence schema written

For each (rfp_id, item_name), it upserts:

- `best_match_sku`
- `spec_match_percent`
- `missing_specs`: list of `{spec_name, rfp_value, sku_value}` mismatches
- `critical_mismatches`: subset for `voltage` and `conductor_material`
- `has_critical_gap`: boolean
- `domain`, `category`
- `occurrences` counter
- timestamps (`created_at`, `last_seen`)

---

## 3) Libraries used (and what for)

### 3.1 Embeddings and vector similarity

- `sentence_transformers.SentenceTransformer`
  - Loads either `BAAI/bge-large-en` (primary) or `all-MiniLM-L6-v2` (fallback)
  - Encodes SKU documents and item texts
- `sentence_transformers.util.cos_sim`
  - Cosine similarity scoring (used for re-ranking and sometimes direct ranking)

### 3.2 Approximate nearest neighbor search

- `faiss.IndexHNSWFlat`
  - HNSW ANN index used to shortlist candidates
  - Parameters:
    - M = 32
    - `efConstruction = 40`
    - `efSearch = 256`

FAISS is explicitly treated as performance-only; final ordering still uses cosine similarity on the shortlist.

### 3.3 LLM calls

- Uses the same local Ollama path as the rest of the pipeline (`local_llm_call` → HTTP to Ollama)
- Used by:
  - `extract_structured_specs()` (spec extraction)
  - `extract_items_llm()` (only as a fallback if Sales didn’t provide items)

### 3.4 PDF/text handling

Technical Agent does not parse PDFs itself in normal mode.

- PDF text is consumed from `state["pdf_text_cache"]` populated by Sales Agent.

### 3.5 Performance & concurrency

- `torch`:
  - chooses `cuda` if available
  - `torch.set_grad_enabled(False)` and `with torch.no_grad()` for inference speed
- `functools.lru_cache`:
  - memoizes spec extraction and category normalization helpers
- `concurrent.futures`:
  - not used for per-item matching; the Technical Agent processes items sequentially

---

## 4) Architecture overview (pipeline stages)

For each RFP item, the Technical Agent runs the following stages.

### Stage A — Ensure embeddings and FAISS are ready (startup architecture)

At module import time:

1. It loads the embedding model (GPU if available).
2. It preloads the entire SKU catalog from MongoDB.
3. It encodes each SKU into an embedding (`SKU_EMBEDDINGS`).
4. It builds:
   - a global FAISS HNSW index over all SKU embeddings
   - per-category FAISS HNSW indices where category is the SKU `category` field

This makes steady-state runs faster (the cost is paid once per process).

### Stage B — RFP text source

- PDF RFP: pulls cached text from `state["pdf_text_cache"][pdf_path]`
- Gmail RFP: uses `state["gmail_rfp_text"]`

### Stage C — Item list acquisition (“zero-indirection matching”)

Priority order:

1. Structured items (with quantity/unit) from Sales output
2. Plain item names from Sales output
3. LLM item extraction from RFP text (fallback)
4. Master expected categories as a last resort

Item embeddings are then computed in a single batch:

- `MODEL.encode(item_texts, convert_to_tensor=True)`

### Stage D — Structured spec extraction (LLM + regex hybrid)

Function: `extract_structured_specs(text, item_name="")`

- Uses an LLM prompt to produce JSON with fields like:
  - `category`, `material_type`, `voltage`, `conductor_material`, `size_sqmm`, `insulation_type`, `standards`, etc.
- Then adds regex fallbacks for “critical electrical fields”:
  - voltage patterns
  - sqmm size patterns
  - conductor material keywords
  - insulation keywords
  - standards patterns (`IS`, `IEC`, etc.), including slash splitting

Caching:

- Decorated with `@lru_cache(maxsize=256)`
- Also uses an internal `_SPEC_CACHE` keyed by md5(text)

Result: a structured dict used for filtering and scoring.

### Stage E — Category assignment and normalization

- Gmail mode: `normalize_category(item_name, item_text, domain)` maps descriptive text to catalog-aligned categories (e.g., `HT Cables`, `Control Cables`, `RF Cable Assembly`).
- PDF mode: category is initially taken as the `item_name` (this assumes the Sales Agent extracted standardized category-like item strings).

There is also a special PDF-only mapper:

- If item name contains `CABLE ASSEMBLY`, it decides between `RF Cable Assembly` vs `Power Cables` based on RF indicators.

### Stage F — Candidate pool creation

The catalog is pre-grouped as `sku_by_category[category] -> list[SKU]`.

Candidate selection uses multiple guardrails:

1. Category pool: start with `sku_by_category.get(category, [])`.
2. Domain guardrails:
   - Civil domain overrides non-civil categories to a Civil-only pool (`Interior Painting`, `Structure Repair`, `Waterproofing`).
   - Electrical domain strips civil-only categories from candidates.
3. Domain fallback when category has 0 SKUs:
   - keyword scan over full catalog to find domain-related SKUs.
4. For large pools (`> 500`), it applies a spec-based filter on voltage/material/insulation/size.
5. Gmail mode (or category missing): applies `apply_hard_spec_filter()` enforcing voltage + conductor constraints (if present).

### Stage G — Vector ranking (FAISS shortlist + cosine rerank)

Function: `vector_rank_candidates(item_text, final_candidates, top_k=10, item_embedding=...)`

Core behavior:

- Uses the precomputed **batch item embedding** where possible.
- Tries to reuse global precomputed SKU embeddings by mapping each candidate `sku_code` back to the global catalog index (`CATALOG_INDEX_MAP`).
- Otherwise builds/caches candidate embeddings (`CANDIDATE_EMBED_CACHE`).

ANN shortlisting:

- Retrieves up to top-20 (`_ann_k = min(20, len(candidate_skus))`) via FAISS HNSW.
- Prefers using a prebuilt per-category FAISS index when the candidate set matches the full category pool.
- Otherwise builds/reuses a candidate-set FAISS index from `CANDIDATE_FAISS_INDEX_CACHE` (soft-capped at 64).

Final ranking:

- Computes cosine similarity on the shortlist only and returns top-`top_k` ranked candidates, each annotated with `vector_similarity`.

### Stage H — Rule scoring (domain-aware) and final selection

Function: `calculate_spec_score(rfp_specs, sku_data, vector_sim, domain, is_gmail_rfp, item_name)`

Domain-specific behavior:

- Civil:
  - strict “keyword integrity” with noun overlap between item words and SKU name
  - formula is: 70% SBERT + 30% overlap, then penalties for zero overlap and incompatible trade pairs
- RF Cable Assembly:
  - pure SBERT: `vector_sim * 100`
- Electrical / default:
  - weighted combination of:
    - category exact match (0% or 100%)
    - vector similarity (0–1)
    - spec overlap (string overlap between rfp_specs values and sku_specs values)
  - Gmail mode increases weight on vector similarity and disables spec overlap

After scoring:

- Sort by `spec_match_percent` and keep top 3.
- Assign status:
  - `Matched` if score ≥ 90
  - `Warning` if score ≥ 75
  - `Review` otherwise

Low-confidence recovery path:

- If best score < 45 and current domain is not civil, it attempts a Civil fallback re-scan against civil categories and replaces top 3 if it improves the best score.

### Stage I — Explainability (XAI)

For the top-3 results:

- Adds `delta_explanation` to each alternative (why it’s #2/#3 vs #1, with spec mismatch examples).

For the winner:

- Builds a long-form `match_justification` string explaining:
  - filter stages and candidate counts
  - spec matches and semantic similarity
  - standards compliance
  - catalog rank position

### Stage J — Gap intelligence persistence

If the winner’s SKU has values for spec fields that differ from the RFP’s extracted structured specs, it records gaps to `sku_gap_intelligence`.

It also flags critical gaps if mismatches are in `voltage` or `conductor_material`.

---

## 5) The math (as used)

### 5.1 Cosine similarity

Vector similarity is computed via SentenceTransformers utilities; conceptually the cosine similarity is:

$$
\cos(\theta) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|\,\|\mathbf{v}\|}
$$

The code uses `util.cos_sim(item_embedding, candidate_embeddings)`.

### 5.2 Electrical/default weighted score

When not in Civil or RF domains, the final score is a weighted sum.

Let:

- $C \in \{0, 1\}$ indicate exact category match
- $V \in [0, 1]$ be vector similarity
- $S \in [0, 1]$ be spec overlap fraction

Then the score is:

$$
\text{score} = w_c \cdot C + w_v \cdot V + w_s \cdot S
$$

Where weights depend on mode:

- Standard PDF RFP: $w_c=40,\ w_v=40,\ w_s=20$
- Gmail RFP: $w_c=30,\ w_v=70,\ w_s=0$

The function implementing this is `calculate_spec_score()`.

### 5.3 Civil strict scoring

Civil uses a hybrid score:

- overlap score based on how many “core” words from item name appear in SKU name
- penalty if overlap is zero
- special-case penalties for incompatible trade combinations

---

## 6) Performance, latency, and where time goes

### 6.1 One-time startup costs

These happen when the Python process imports the module:

- Embedding model load (`SentenceTransformer(...)`) — can be heavy (especially `bge-large-en`).
- Mongo catalog load into `CATALOG`.
- Encoding all SKUs into `SKU_EMBEDDINGS`.
- FAISS index build (global + per-category HNSW indexes).

This is explicitly done to avoid repeated “30–60s BertModel loading delay” per run.

### 6.2 Per-run costs (steady state)

For each RFP run:

- Batch encode item texts: one `MODEL.encode()` call for N items.
- For each item:
  - `extract_structured_specs()` may call the LLM (unless cached)
  - candidate filtering (Python string logic)
  - FAISS ANN search (fast)
  - cosine similarity re-rank on shortlist (fast)
  - rule scoring (fast)
  - XAI string building (moderate)
  - optional Mongo upsert to gap intelligence (network latency dependent)

### 6.3 Main latency drivers

In practice, the slowest parts are typically:

- LLM calls in `extract_structured_specs()` (Ollama request time)
- MongoDB network calls (catalog load at startup; gap upserts per mismatching item)

Vector search is optimized to be low-latency via:

- precomputed embeddings
- ANN shortlist (top-20)
- cosine re-rank only on shortlist

### 6.4 Why matching is sequential per item

Even though embeddings are batched, the item loop is sequential. That simplifies:

- deterministic logs
- per-item Mongo writes
- conditional fallback logic

But it also means throughput is bounded by per-item LLM + scoring, not by CPU parallelism.

---

## 7) Behavioral edge cases & failure modes

- Category mismatch in PDF mode:
  - PDF mode uses `item_name` as category unless it’s “CABLE ASSEMBLY” mapped.
  - If Sales Agent extracted non-catalog category strings, the category pool will be empty and it falls back to domain keyword filtering.

- Cache dependencies:
  - For PDFs, Technical Agent assumes Sales Agent cached `pdf_path` text. If the cache is missing, the node errors.

- Hard-coded domain allowlist:
  - If `domain` is not in the supported list, the node marks the output as “Skipped - Out of Domain”.

- Windows/production dependencies are not handled here:
  - Unlike Sales Agent, Technical Agent doesn’t depend on Poppler/Tesseract, but it depends on a reachable MongoDB and a warmed embedding model.

---

## 8) Suggested future improvements (technical-agent scoped)

These are improvements you can implement later; this document does not change code.

### 8.1 Make category handling more reliable

- Store catalog category explicitly in Sales output, not derived from `item_name`.
- Maintain a controlled category taxonomy and map extracted item strings into it consistently.

### 8.2 Reduce LLM dependence for spec extraction

- Replace the LLM spec parser with deterministic regex + table extraction for electrical items where fields are standard.
- Or run LLM once per RFP section (BOQ/spec section) rather than per item.

### 8.3 Improve scoring correctness and calibration

- Add unit tests for `calculate_spec_score()` across domains.
- Calibrate thresholds (90/75) with empirical data from real tenders.
- Make spec overlap more structured (key-by-key) rather than substring matching across all values.

### 8.4 Improve ANN/index lifecycle

- Persist FAISS indices to disk to avoid rebuild on every process start.
- Separate indices by domain and enforce consistent category naming.

### 8.5 Observability

- Add per-stage timing (spec extraction ms, ANN ms, scoring ms, Mongo ms).
- Log cache hit rates (`_SPEC_CACHE`, `CANDIDATE_EMBED_CACHE`, `CANDIDATE_FAISS_INDEX_CACHE`).

---

## 9) How the frontend formatting works (post-agent)

The Technical Agent raw output is converted to a UI format by:

- `format_technical_for_frontend(raw_output)` in [RFPPilot2/backend/tech_formatters.py](RFPPilot2/backend/tech_formatters.py)

That function:

- keeps the `items` list but renames some keys (`required_specs_text`, `top_3_alternatives`)
- computes a summary with `success_rate`
- counts `Warning` as “matched” for dashboard success rate

There is also a `build_comparison_matrix(item, domain)` helper that builds a domain-themed comparison table; it is UI-oriented and does not reflect the actual spec-by-spec mismatch detection used for gap intelligence.
