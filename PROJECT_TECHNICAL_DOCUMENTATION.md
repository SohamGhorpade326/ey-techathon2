# Project Technical Documentation (Agentic RFP Pipeline)

Audience: internal engineering team

This document explains the **agent pipeline and core AI logic** implemented in this repository, with primary references to the Python backend in:
- `RFPPilot2/backend/wonky_SBERT_copilot.py` (agents, LangGraph state machine, SBERT matching, pricing logic)
- `RFPPilot2/backend/main_new.py` (runtime orchestrator, background execution, skip loop, Gmail ingestion bridge)
- `RFPPilot2/backend/tech_formatters.py` (frontend-ready formatting + comparison matrix builder)
- `RFPPilot2/backend/store_new.py` (in-memory state persistence + skip list)

> Scope note: This intentionally does **not** focus on frontend UI, route wiring, or React components. It focuses on the multi-agent architecture and the AI pipeline.

---

## 1. Project Overview

### High-level goal of the system
The system automates the **end-to-end interpretation and response preparation** for incoming RFP/tender documents by:
1. Discovering RFP PDFs (web) and/or receiving RFP-like text (Gmail ingestion)
2. Extracting structured metadata and line items
3. Selecting the most urgent/high-priority RFP
4. Mapping RFP line items to internal SKU catalog entries using **semantic matching**
5. Computing pricing by combining **catalog material prices** + **mandatory testing/certification costs**
6. Producing a consolidated proposal narrative + structured outputs for downstream UI/export

### What problem it solves in RFP automation
RFPs are high-variance documents:
- Multi-format PDFs (native text vs scanned)
- Different tender templates and language
- BOQ tables in inconsistent locations (often at the end)
- Implicit technical requirements (not consistent key/value structures)

This project targets the bottleneck where teams traditionally:
- Manually read PDFs
- Copy/paste BOQ items
- Search internal catalogs
- Estimate compliance and testing requirements
- Assemble a draft response

### Why traditional regex/manual systems fail
Regex/manual rules fail because:
- **Layout variance**: tables and headers differ wildly across issuers
- **Terminology drift**: “11kV copper armoured cable” vs “Cu conductor HT cable”
- **Scanned PDFs**: no selectable text; requires OCR
- **Spec expression diversity**: units, abbreviations, synonyms, and missing fields

A pure rule system becomes brittle and expensive to maintain, and it doesn’t generalize across new tender templates.

### Why an Agentic AI architecture is used
This repository implements a **multi-agent pipeline** because the overall task decomposes naturally into specialized stages:
- **Sales Agent**: acquisition + robust extraction (web/Gmail + PDF/OCR + metadata + initial item list)
- **Master Agent**: orchestration + domain routing + instruction synthesis
- **Technical Agent**: semantic SKU matching + explainability + gap intelligence
- **Pricing Agent**: compute commercial offer with traceability to DB sources
- **Proposal Builder**: final narrative assembly and packaging

This separation yields:
- Clear interfaces (each agent consumes/produces structured state)
- Easier debugging (agent outputs are persisted independently)
- Swappable components (e.g., change embedding model or scoring without rewriting ingestion)

---

## 2. System Architecture (Detailed)

### Core pipeline flow
Logical flow:

Sales Agent → Priority Selector → Master Agent → Technical Agent → Pricing Agent → Proposal Builder (Final Output)

In code, the canonical LangGraph build is defined in `wonky_SBERT_copilot.py`:
- Nodes: `sales_agent_node`, `select_highest_priority_rfp`, `master_agent_node`, `technical_agent_node`, `pricing_agent_node`, `proposal_builder_node`
- Edges are purely sequential

> Runtime note: `main_new.py` often runs the same nodes **sequentially by direct function calls** rather than invoking the compiled LangGraph graph. This is primarily to control threading (Playwright + greenlet constraints) and enable background execution.

### State object flow (LangGraph-style propagation)
The pipeline uses a dictionary-like state object throughout. In `wonky_SBERT_copilot.py`, the typed surface is:

```python
class RFPState(TypedDict, total=False):
    sales_output: List[Dict[str, Any]]
    pdf_paths: List[str]
    pdf_text_cache: Dict[str, str]
    master_output: Dict[str, Any]
    technical_output_raw: Dict[str, Any]
    technical_output: Dict[str, Any]
    pricing_output: Dict[str, Any]
    final_bid_prose: str
    product_compliance_table: List[Dict[str, Any]]
```

In practice, additional keys are also used (Python allows it), especially for Gmail integration and orchestration bridges:
- `gmail_rfp_text`, `gmail_message_id`
- `extracted_item_list`, `extracted_item_list_structured`
- `gmail_extracted_items_map`, `gmail_text_cache`
- `human_override` (optional human-in-the-loop selection)

**Important design principle:** every agent returns the same state object, enriched with new fields. This is the backbone of the modular multi-agent architecture.

### How agents pass structured outputs
Each agent writes a well-defined output payload into the state:
- Sales Agent writes `state["sales_output"]` (list of extracted RFP summaries) and `state["pdf_text_cache"]`
- Priority Selector rewrites `sales_output` and `pdf_paths` to a single selected RFP
- Master Agent writes `state["master_output"]` containing:
  - `selected_rfp` (raw selected RFP)
  - `technical_summary` (instructions + context used downstream)
  - `pricing_summary` (pricing rules + testing requirements)
- Technical Agent writes both:
  - `technical_output_raw` (agent-native structure used by Pricing + Proposal)
  - `technical_output` (frontend-oriented formatted version via `format_technical_for_frontend`)
- Pricing Agent writes `pricing_output` and a `product_compliance_table`
- Proposal Builder writes `final_bid_prose`

### Human override implementation
There are two “human control” mechanisms implemented:

1) **Human-in-the-loop selection (Master Agent override)**
- `master_agent_node` checks `state.get("human_override")`
- If `human_override = {"selected_rfp_index": <int>}`, it selects that RFP from a ranked list.

Important nuance: in the default end-to-end flow, the **Priority Selector already reduces** `sales_output` to a single RFP. In that mode, Master Agent’s override is effectively a no-op (there is only one candidate). The override becomes meaningful if you run Master Agent on an unfiltered list (e.g., during experimentation or alternate orchestration paths).

2) **Operational skip loop (runtime orchestration)**
- The FastAPI endpoint `POST /pipeline/skip` in `main_new.py`:
  - Reads the current selected RFP ID from stored master output
  - Adds it to a persisted skipped list via `store_new.py`
  - Clears downstream outputs
  - Re-runs the pipeline in `skip_mode=True`
- The Priority Selector (`select_highest_priority_rfp`) filters out skipped RFP IDs using `get_skipped_rfp_ids()`.

These controls allow the team to steer the pipeline without changing extraction logic.

### How priority selection works
Priority is computed during Sales formatting (`format_sales_for_frontend`) using deadline parsing:
- `days_remaining <= 10` → `Critical`
- `days_remaining <= 21` → `High`
- else `Medium`
- negative → `Expired`

Then, `select_highest_priority_rfp` ranks RFPs by:
1. priority rank (Critical > High > Medium)
2. days remaining (computed/normalized)
3. parsed deadline datetime
4. stable tie-break by original index

Skipped RFP IDs are filtered before ranking.

### Text-based architecture diagram

```
                        +-------------------+
                        |  store_new.py     |
                        |  (in-memory)      |
                        |  outputs + skip   |
                        +---------+---------+
                                  |
                                  v
+------------------+     +------------------+     +------------------+
|  Sales Agent     | --> | Priority Selector| --> |   Master Agent   |
|  (web/Gmail)     |     |  (rank + skip)   |     | (domain + plan)  |
|  Playwright      |     +------------------+     +------------------+
|  pdfplumber/OCR  |                                   |
|  LLM extraction  |                                   v
+------------------+                           +------------------+
                                               | Technical Agent  |
                                               | (SBERT + rules)  |
                                               | Mongo catalog    |
                                               | gap intelligence |
                                               +------------------+
                                                       |
                                                       v
                                               +------------------+
                                               |  Pricing Agent   |
                                               | catalog + tests  |
                                               | margin + XAI     |
                                               +------------------+
                                                       |
                                                       v
                                               +------------------+
                                               | Proposal Builder |
                                               | narrative output |
                                               +------------------+
```

---

## 3. Sales Agent (Technical Deep Dive)

Primary implementation: `sales_agent_node` in `wonky_SBERT_copilot.py`.

### PDF scraping logic
The Sales Agent uses Playwright (sync API) to discover and download PDFs:
- `SITE_URL = "https://eytechathon.lovable.app"`
- Locates links matching `a:has-text('Download')`
- Downloads each PDF sequentially using Playwright’s `expect_download()` for reliable handling

A notable optimization is the **persistent browser/page pattern**:
- Browser/context/page are created once (lazy-init via `_init_browser()`)
- The page is reused across runs to avoid heavy cold start costs

### pdfplumber usage (native text extraction)
For each downloaded PDF, Sales Agent:
- Opens PDF with `pdfplumber.open(file_path)`
- Extracts text from the first ~10 pages
- Uses this as “native text” input to downstream extraction

This is the fastest path and preserves structure better than OCR when the PDF contains embedded text.

### OCR fallback with Tesseract
OCR is used only when native text is insufficient.

Two OCR strategies exist:

1) **Document-level OCR selection**
- If the extracted native text is very short (`len(text.strip()) < 50`), the agent runs OCR on a selected page set.
- OCR page selection can be configured via env vars:
  - `OCR_MODE` (default `smart`), `OCR_FIRST_PAGES`, `OCR_LAST_PAGES`, `OCR_KEYWORD_PAGES_MAX`
- Conversion uses `pdf2image.convert_from_path()` (Poppler required)
- OCR uses `pytesseract.image_to_string()`

2) **Trigger-page OCR for BOQ extraction**
- The agent scans pages for BOQ/Price-Bid triggers.
- If the LLM extraction returns empty results from native text, it OCRs the trigger page and retries extraction.

### LLM-based metadata extraction
Sales Agent makes a single “all fields” LLM call via `extract_fields_single_call()`:
- Extracts `rfp_id`, `rfp_title`, `buyer`, `submission_deadline`, `estimated_project_value`, `scope_items`
- Uses `local_llm_call()` which calls **Ollama** over HTTP (`http://localhost:11434`) with deterministic settings.

The helper `safe_json_load()` cleans common LLM JSON artifacts.

### Item extraction (BOQ-focused)
The Sales Agent attempts to extract items from the BOQ/Price Bid section:
- Scans pages for trigger keywords such as `boq`, `bill of quantities`, `schedule of items`, `price bid`, etc.
- For large documents (`>50 pages`), scans the last 15 pages first (BOQ is often at the end)
- Once a trigger is found, it includes the trigger page plus the next 1–2 pages

Then it uses a simplified extraction prompt optimized for local Mistral:
- Returns a JSON list of strings formatted as: `"Item Name | Quantity"`
- Explicitly instructs the model to ignore serial number columns and use only the Quantity/QTY column

The extracted strings are normalized into:
- `extracted_item_list` (names)
- `extracted_item_list_structured` (name + quantity + unit)

### Ground truth enforcement (demo safety)
For known demo RFP IDs, Sales Agent enforces a ground-truth item list via `get_ground_truth_items()`.
This is intentionally conservative: it ensures demos don’t break due to extraction variance.

### Priority calculation
Priority is derived from parsed deadline:
- `_parse_deadline()` parses multiple date formats
- `_compute_days_remaining()` computes days left
- `format_sales_for_frontend()` maps days remaining to priority bands

### Why this approach is robust across formats
- Native extraction first (fast + accurate for digital PDFs)
- OCR fallback only when needed (supports scanned PDFs)
- BOQ-targeted scanning avoids prompting the LLM with the entire document
- Output is normalized into structured state, enabling deterministic downstream processing

### Performance considerations
- **Why pdfplumber first:** cheap, preserves text structure, minimal CPU
- **Why OCR as fallback:** OCR is CPU-heavy and slower; it should run only when native text is absent or specifically needed for BOQ pages
- Parallel PDF processing: PDFs are processed concurrently (thread pool) after sequential download
- Persistent browser reuse avoids repeated 15–20s cold-start overhead

---

## 4. Master Agent (Orchestrator Logic)

Primary implementation: `master_agent_node` in `wonky_SBERT_copilot.py`.

### Responsibilities
Master Agent turns extracted Sales output into a **structured plan** for downstream agents:
- Selects the RFP to analyze (with optional human override)
- Performs domain detection and category routing
- Constructs `technical_summary` and `pricing_summary`

### Highest-priority RFP selection
In the canonical LangGraph flow, selection happens in `select_highest_priority_rfp` before Master Agent.
Master Agent also contains selection logic with human override, designed for cases where multiple RFPs are provided.

### Human override logic
If the state contains:

```python
state["human_override"] = {"selected_rfp_index": 1}
```

Master Agent selects that ranked index instead of the default.

### Domain detection and routing
Master Agent determines the analysis domain using:
- Explicit routing rules for known patterns (e.g., SAC/high power cable assembly → RF Cable Assembly)
- Sales Agent’s domain if present
- Otherwise, `detect_domain()` on title + initial text

Domains drive:
- Material type label
- Expected SKU categories
- Spec priority templates (`get_domain_spec_priority()`)
- Standards context (used in pricing/testing requirements)

A final title-based civil override acts as a safety guardrail for “Painting/Repair” tenders.

### Structured summary format passed downstream
Master Agent writes:
- `master_output.selected_rfp`
- `master_output.technical_summary`
- `master_output.pricing_summary`

The `technical_summary` includes:
- `rfp_context` (id, title, buyer, deadline, domain)
- `scope_context` (material_type, expected categories)
- `technical_instructions` (whether to extract items/specs)
- `sku_matching_rules` (thresholds and top-n)
- `pdf_path`

This summary is the contract the Technical Agent relies on.

### Explainability alignment
Although Master Agent itself doesn’t compute technical matches, it produces a **highly structured, explainable JSON plan** (`technical_summary` + `pricing_summary`) so that downstream XAI text can cite:
- the domain
- expected categories
- standards and testing requirements

Downstream explainability is produced primarily by:
- Technical Agent: per-item `match_justification`, `delta_explanation`, and MongoDB `sku_gap_intelligence` writes
- Pricing Agent: per-item `pricing_rationale` and overall `totals_rationale`

### Why this separation improves modularity
- Keeps domain routing and “what should we do?” separate from “how do we match SKUs?”
- Allows Technical Agent to specialize in matching logic without re-implementing selection/routing
- Pricing Agent can read pricing rules without needing any PDF parsing context

---

## 5. Technical Agent (Core Novelty — Very Detailed)

Primary implementation: `technical_agent_node` in `wonky_SBERT_copilot.py`.

This is the core novelty of the system: it converts ambiguous RFP item text into **SKU-level matches** with:
- semantic embeddings (SentenceTransformers)
- domain-aware scoring rules
- hard spec guardrails (especially for Gmail RFPs)
- explainability (per-item match justification)
- gap intelligence (persisted mismatches to MongoDB)

### 5A) Item extraction and normalization
Technical Agent is in **MASTER-DRIVEN ITEM MODE**:

1) Preferred input: Sales Agent structured items
- Reads `extracted_item_list_structured` (quantity + unit)
- Falls back to Sales output’s `extracted_item_list_structured`

2) Fallback input: plain names
- Reads `extracted_item_list` (names only)

3) Last resort: LLM-based extraction
- `extract_items_llm(full_text, material_type, categories)`
- Cached in `_ITEM_CACHE` keyed by a hash of document snippet + material type

If all extraction fails, it falls back to Master Agent categories as pseudo-items.

### 5B) Spec extraction (LLM + regex hybrid)
For each item, the agent extracts structured specs using `extract_structured_specs()`:
- Uses an LLM prompt to obtain a JSON dict (category, voltage, conductor material, insulation, standards, etc.)
- Applies regex fallback for critical electrical fields (voltage patterns, size sqmm patterns, standards parsing)
- Cached with both `@lru_cache` and an internal `_SPEC_CACHE` keyed by MD5

This hybrid approach preserves robustness:
- LLM handles unstructured phrasing
- Regex ensures critical numeric/spec parameters are captured reliably

### 5C) SBERT-based semantic matching

#### Why SBERT-style embeddings are used
The matching problem is fundamentally semantic:
- input strings are messy and context-dependent
- catalog entries contain product names + category + specs
- exact keyword overlap is often insufficient

Embeddings allow the agent to match:
- synonyms (“armoured” vs “SWA”)
- reordered phrases
- missing punctuation/formatting

#### Model choice in this repository (actual behavior)
At module import time, the code attempts to load a higher-quality embedding model first:
- Primary: `BAAI/bge-large-en`
- Fallback: `all-MiniLM-L6-v2`

So, MiniLM is not the only model used; it is the **compatibility fallback** when the larger model can’t be loaded.

#### How SKU embeddings are generated and cached
At startup (module import time), the Technical Agent preloads:
1. SKU catalog documents from MongoDB `product_catalog`
2. A text representation per SKU:
   - `"product_name + category + specs_text"`
3. Embeddings for all SKUs:
   - `SKU_EMBEDDINGS = MODEL.encode(SKU_DOCS, convert_to_tensor=True)`

This is done once via `initialize_sku_embeddings()`, and the embeddings are reused for every request.

Where embedding computation occurs (actual behavior):
- **SKU embeddings**: computed once at import/startup and stored in global variables (`CATALOG`, `SKU_DOCS`, `SKU_EMBEDDINGS`)
- **Item embeddings**: computed per-RFP (batched across items) inside `technical_agent_node`
- **Candidate embeddings**: reused when global embeddings can be indexed; otherwise cached per candidate-set (`CANDIDATE_EMBED_CACHE`)

#### Candidate-level vector ranking
For each item, the agent:
1. Builds a candidate pool (category-based and/or domain fallback)
2. Optionally applies pre-filters for hard specs (see below)
3. Computes an item embedding (batched for all items in the RFP)
4. Ranks candidates using `vector_rank_candidates()`:
   - Reuses global embeddings when possible
   - Uses FAISS HNSW indexes for ANN retrieval (performance)
   - Re-ranks the shortlist using exact cosine similarity via `util.cos_sim`

#### Cosine similarity
The semantic component is ultimately cosine similarity between vectors.
The pipeline uses cosine similarity as the “semantic relevance” score, but it does not blindly accept the top cosine match—rule scoring is applied next.

### 5D) SKU ranking logic (top 3 + thresholds)

#### Two-stage scoring: semantic → rules
- Stage 1: vector ranking produces a shortlist (top ~10)
- Stage 2: `calculate_spec_score()` produces a final score in 0–100 with domain-specific behavior

#### Domain-aware scoring (actual behavior)
`calculate_spec_score()` changes scoring strategy by domain:

1) **Civil domain: strict keyword integrity**
- Base score = 70% SBERT + 30% keyword overlap
- Applies penalties when there is zero keyword overlap
- Adds a guardrail for unrelated trades (e.g., excavation vs paint mismatches)

2) **RF Cable Assembly: pure SBERT**
- Score = SBERT cosine similarity × 100

3) **Electrical/general: weighted components**
- Category match (strict equality) contributes weight
- Vector similarity contributes weight
- Spec overlap contributes weight (disabled for Gmail)

Weights differ for Gmail vs PDF:
- Gmail: category 30%, vector 70%, spec overlap 0%
- PDF: category 40%, vector 40%, spec overlap 20%

#### Hard-spec filtering (precision guardrail)
For Gmail and certain fallback conditions, the agent enforces hard spec constraints before ranking:
- Extracts voltage number and conductor material
- Filters out candidates whose text/specs don’t contain those constraints

This prevents high cosine similarity from producing an incorrect HT/LT or Cu/Al mismatch.

#### Hard-spec boost
If Gmail hard filtering was applied and rule score is already high, the score may be boosted (capped) to reflect increased confidence.

#### Top 3 selection
After scoring, candidates are sorted by `spec_match_percent` and the top 3 are kept.
Each alternative receives a `delta_explanation` describing why it ranked below the primary choice.

#### Status thresholds
For the chosen best match:
- `>= 90` → `Matched`
- `>= 75` → `Warning`
- else → `Review`

If no valid candidates exist:
- best match = `NO_MATCH`
- status = `No Match`

### 5E) Comparison table generation
There are two different “comparison” concepts in the codebase:

1) **Engineering truth: spec-vs-SKU comparison** (core matching)
- Inside Technical Agent, the structured RFP spec dict (`structured_specs`) is compared against the selected SKU’s MongoDB spec dict (`sku_doc["specifications"]`).
- This produces:
  - `matched_attrs` used in `match_justification`
  - `missing_specs` and `critical_mismatches` persisted to `sku_gap_intelligence`

2) **UI-oriented comparison matrix** (presentation helper)
- Built via `build_comparison_matrix()` in `tech_formatters.py`.
- It creates domain-aware rows and associates them with the top 3 SKU codes. Note that its “RFP requirement” values are currently **template-like placeholders** (e.g., `Refer RFP` or typical values) rather than a strict extraction of every RFP numeric requirement.
- The runtime orchestrator (`main_new.py`) attaches these matrices to formatted items for display.

### 5F) Why semantic matching is superior to regex here
This repository’s matching pipeline benefits from semantic embeddings because:
- **Format independence**: works across “BOQ tables”, prose descriptions, and email text
- **Synonym tolerance**: SBERT-style embeddings capture meaning beyond exact strings
- **Robustness**: can recover from missing keys or reordered specs

Regex is still used, but only for **hard constraints** where numeric integrity matters (kV, sqmm, conductor).

### 5G) Explainability and “gap intelligence” (novel operational feature)
For each chosen best match, the agent generates a detailed `match_justification` that explains:
- the filtering stages (catalog size → category filter → hard spec filter → vector rank → rule score)
- which attributes matched
- the semantic validation score

It also computes **missing specs / mismatches** and stores them to MongoDB collection `sku_gap_intelligence`:
- `missing_specs`: key/value mismatches
- `critical_mismatches`: voltage/conductor mismatches
- `has_critical_gap`
- `occurrences`, `last_seen`, `created_at`

This turns matching errors into actionable catalog improvement data.

### 5H) Performance and latency
Key optimizations implemented:
- **Global embedding preload** at module import time (removes large cold start)
- **Batch encoding** of item embeddings per RFP (`MODEL.encode(list_of_item_texts)`)
- **FAISS HNSW** indexes for ANN shortlist retrieval
- **Candidate embedding caches** to avoid recomputing encodings for repeated candidate sets
- **Zero IO PDF reuse**: Technical Agent requires Sales Agent to populate `pdf_text_cache` and reads text from state rather than re-opening the PDF

Typical bottlenecks:
- LLM calls for spec extraction (if cache misses)
- OCR (if triggered)
- Mongo reads (catalog/test fetches) if not warmed

---

## 6. Pricing Agent (Detailed)

Primary implementation: `pricing_agent_node` in `wonky_SBERT_copilot.py`.

### Pricing repositories (MongoDB)
Pricing Agent relies on two MongoDB collections:
- `product_catalog`: unit prices per SKU (field used: `unit_price_inr`)
- `test_data`: mandatory tests with costs (field used: `price_inr`) and applicability rules

### Test matrix repository
The test matrix is loaded as:
- `all_tests = list(test_data.find({}))`

Then per line item:
- the agent finds the SKU category (prefers reading the SKU doc from `product_catalog`)
- it matches tests where `applicable_product_types` overlaps with the SKU category

This is an intentional correctness fix in the implementation: test applicability is determined from the **SKU’s authoritative category** (MongoDB) rather than the free-form RFP item name.

### Material + service cost calculation
Per item:
1) **Unit price** comes from the Technical Agent’s top match structure (`top_3_skus[0].price_per_unit`).
2) **Quantity** is parsed using a robust heuristic that avoids confusing serial numbers (e.g., `Item 1.0`) with real quantities.
3) Material cost = `unit_price × quantity`
4) Testing cost = sum of matched test `price_inr`

### Consolidation logic and risk flags
- Items with `NO_MATCH` or out-of-domain are skipped
- Risk is derived from technical score:
  - `>= 90` Low, `>= 75` Medium, else High

### Margin and selling price
A default margin is applied:
- `margin_percent = 10`
- `selling_price = base_cost / (1 - margin_percent/100)`

Outputs include both the computed selling price and the gross margin, enabling internal review.

### Final pricing table structure
`pricing_output` includes:
- `currency`
- `items[]` (per-SKU pricing details + `pricing_rationale`)
- `material_total`, `testing_total`, `grand_total`
- `totals_rationale` explaining aggregation and traceability

It also produces a `product_compliance_table` combining unit price and spec match percent into a simplified compliance grade.

---

## 7. Database Design

This system uses MongoDB as the source of truth for catalogs and analytics. Key collections used by the pipeline:

### `product_catalog`
Used by Technical Agent and Pricing Agent.
Fields referenced in code:
- `sku_code` (primary lookup)
- `product_name`
- `category`
- `specifications` (object/dict)
- `unit_price_inr`
- `standards` (list)
- `manufacturer` (optional; used for pricing rationale if present)

### `test_data`
Used by Pricing Agent.
Fields referenced in code:
- `test_name`
- `price_inr`
- `standard`
- `applicable_product_types` (list of strings)

### `dummybid`
Used by Proposal Builder (“Why us” section) and analytics.
Fields referenced in code:
- `buyer`
- `domain`
- `status`

A seed script exists: `seed_dummy_bids.py`.

### `sku_gap_intelligence`
Written by Technical Agent.
Fields written include:
- `rfp_id`, `item_name`, `best_match_sku`
- `missing_specs[]`, `critical_mismatches[]`, `has_critical_gap`
- `occurrences`, `last_seen`, `created_at`

### Why MongoDB was chosen
MongoDB fits this problem because:
- Catalog specs are semi-structured and vary across domains
- New spec keys can appear without schema migrations
- Flexible documents support multiple RFP types (civil, electrical, RF)

---

## 8. Technologies Used

### Python
Primary language for the AI pipeline, chosen for:
- NLP ecosystem maturity
- PDF/OCR libraries
- rapid iteration on ML + data handling

### LangGraph
Used to define the conceptual state machine and agent node graph.
Even when runtime orchestration calls nodes directly, LangGraph provides a clean mental model for state propagation and modular agents.

### MongoDB Atlas / MongoDB
Used for:
- product catalog source-of-truth (`product_catalog`)
- testing cost repository (`test_data`)
- persistence of gap intelligence (`sku_gap_intelligence`)
- historical bid analytics (`dummybid`)

### SentenceTransformers (SBERT-style embeddings)
Used for semantic matching.
Actual model behavior:
- prefers `BAAI/bge-large-en`
- falls back to `all-MiniLM-L6-v2`

### pdfplumber
Fast, reliable extraction of native PDF text.

### Tesseract OCR (`pytesseract`) + `pdf2image` (Poppler)
Used only when native text extraction is insufficient or when trigger-page OCR is needed.

### Ollama (local LLM)
Primary LLM inference used by the pipeline.
Used for:
- metadata extraction
- item extraction (email or BOQ pages)
- spec extraction

The local LLM integration implements caching:
- `@lru_cache` for repeated prompts
- optional disk persistence via `llm_cache.json`

### Cosine similarity
Semantic match uses cosine similarity between embedding vectors.

### FAISS
Used for ANN retrieval (HNSW indexes) to speed up candidate ranking on large catalogs.

### Playwright
Used for RFP discovery and PDF downloads with a persistent browser instance.

### FastAPI (brief)
Hosts the pipeline and provides endpoints to:
- run in background
- skip RFPs
- ingest Gmail events

---

## 9. Performance Analysis

### Latency sources
1) Web discovery + PDF download (Playwright)
2) PDF parsing (pdfplumber)
3) OCR (only when triggered; CPU-heavy)
4) LLM inference (Ollama) for metadata/spec extraction
5) Embedding computation for item texts
6) MongoDB reads (catalog preload, SKU lookups, test matrix)

### LLM cost considerations
Core pipeline uses local inference (Ollama), so “cost” is compute time, not API fees.
However, the repo also contains Groq API usage for cover-letter generation (separate from core matching pipeline).

### Embedding cost
Embeddings are expensive if recomputed frequently. The system mitigates this by:
- computing SKU embeddings once at startup
- batching item embeddings per RFP
- caching candidate embeddings and FAISS indexes

### Scaling considerations
- Playwright sync browser suggests careful threading; the current design uses a single-thread pipeline executor to avoid greenlet conflicts.
- Embedding + scoring can be parallelized, but the code currently favors determinism and controlled concurrency.

### How to optimize further (within current architecture)
- Persist SKU embeddings and FAISS indexes to disk to reduce startup time
- Add a cache layer for spec extraction across runs (currently partially cached)
- Reduce Mongo round trips (e.g., bulk fetch SKU docs needed for pricing)
- Add per-domain candidate pre-indexes or stricter hard filters before embeddings

---

## 10. Accuracy & Limitations

### Where semantic matching works well
- Messy naming variants and synonyms
- Unstructured email text for standard product families
- Partial specs combined with strong category/domain cues

### Where it may fail
- RFPs where the BOQ is image-only and OCR quality is poor
- Highly ambiguous item names with no distinguishing specs
- Catalog gaps: when product catalog lacks the required spec fields or contains inconsistent spec encoding

### Edge cases
- Scanned PDFs: OCR may be required; quality depends on scan DPI and noise
- “Civil vs Electrical” confusion: guardrails exist (domain detection and civil strict scoring) but ambiguous tenders can still challenge routing
- Quantity extraction: heuristics exist to avoid serial numbers, but unusual BOQ formatting can still mislead

---

## 11. Security & Data Handling

### MongoDB security
- MongoDB connection strings are read from environment variables (e.g., `MONGO_URI2`).
- Production deployments should restrict access with IP allowlists, least-privilege users, and TLS.

### API key handling
- External keys (e.g., `GROQ_API_KEY`) are retrieved from environment variables.
- The pipeline should never log secrets; only metadata and counts should be logged.

### Hardcoded paths (current technical debt)
The code currently contains Windows-default paths for:
- Tesseract executable (`pytesseract.pytesseract.tesseract_cmd`)
- Poppler path default (`POPPLER_PATH`)

These are not secrets, but they are environment-specific. For team-wide deployment, these should be configured via env vars or startup checks.

### Future improvements
- Ensure `.env` files and credentials are not committed and are excluded via `.gitignore`
- Add structured logging with redaction
- Add audit trails for RFP processing and data retention policies

---

## Appendix: Where to read the core logic

- Agent nodes and the matching pipeline: `RFPPilot2/backend/wonky_SBERT_copilot.py`
- Runtime orchestration, background execution, and skip loop: `RFPPilot2/backend/main_new.py`
- Output formatting and comparison matrix helper: `RFPPilot2/backend/tech_formatters.py`
- In-memory persistence and skipped RFP list: `RFPPilot2/backend/store_new.py`
