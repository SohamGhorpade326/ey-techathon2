# Sales Agent — Dummy Website RFP Scanning (Code-Faithful)

This document describes only the **Sales Agent** logic that scans the **dummy RFP website**, downloads PDFs, and extracts initial structured metadata + BOQ items.

Source of truth: [RFPPilot2/backend/wonky_SBERT_copilot.py](RFPPilot2/backend/wonky_SBERT_copilot.py)

---

## 1) What “scanning RFPs” means in this repo

In this codebase, “scanning RFPs” is implemented as:

1. **Open the dummy discovery site** in a headless Playwright Chromium browser.
2. **Find every `Download` link** on the page.
3. **Sequentially download** each linked PDF to local files (`rfp_1.pdf`, `rfp_2.pdf`, …).
4. **Process the PDFs in parallel**:
   - extract text (native first, OCR only if needed),
   - run one LLM call to extract high-level RFP fields,
   - detect domain (Civil vs Electrical vs General),
   - locate BOQ/Price Bid pages and extract **item list + quantity** (LLM-based, with OCR fallback for those pages),
   - enforce “ground truth” items for known demo RFP IDs,
   - compute a rough project value heuristic,
   - return and persist the structured Sales output.

The Sales Agent entrypoint is `sales_agent_node(state)`.

---

## 2) Browser + website scan (Playwright)

### 2.1 Persistent browser model

The Sales Agent uses a **persistent, module-level Playwright browser + page** to avoid cold start overhead and to reuse the same browser context across pipeline runs:

- Implementation: `_init_browser()`
- Library: `playwright.sync_api` (sync Playwright)
- Mode: `chromium.launch(headless=True)`
- Downloads enabled: `new_context(accept_downloads=True)`
- Returned object: a single `_persistent_page` reused for future runs

There is also a workaround for the common error “Playwright Sync API inside asyncio loop”: `_init_browser()` temporarily patches `asyncio.get_event_loop` to return `None` while starting Playwright.

### 2.2 Target website

- `SITE_URL = "https://eytechathon.lovable.app"`

### 2.3 Page navigation & readiness

Inside the “Main Scraping Loop” (the dummy site flow):

1. `page.goto(SITE_URL, timeout=60000, wait_until="networkidle")`
2. Wait for download links:
   - tries: `page.wait_for_selector("a:has-text('Download')", timeout=15000)`
   - if not found, does a `page.reload(wait_until="networkidle")` and waits again (10 seconds)

This makes the scan sensitive to:
- how the site loads network resources (because it waits for `networkidle`), and
- the exact visible link text “Download”.

### 2.4 “Discovery” = finding PDFs

The code identifies PDFs by selecting:

- `buttons = page.locator("a:has-text('Download')")`
- `count = buttons.count()`

It assumes:
- each such link triggers a file download, and
- all relevant RFPs are present on this single loaded page.

### 2.5 Download sequence (sequential + Playwright-managed)

Downloads are done sequentially (important: not parallel) using Playwright’s download handler:

- For each index `i` in `[0..count-1]`:
  - set `file_path = f"rfp_{i + 1}.pdf"`
  - wrap click in `with page.expect_download(timeout=30000) as download_info: buttons.nth(i).click()`
  - `download = download_info.value`
  - `download.save_as(file_path)`
  - append to `pdf_paths`

Why it’s sequential:
- the code uses one page and expects one download at a time,
- this reduces race conditions in Playwright’s download plumbing.

### 2.6 Cleanup behavior

The browser is not closed after scanning. In the `finally` block, the code does:

- `page.goto('about:blank')`

This clears page state/memory but keeps the persistent browser/page ready for the next run.

---

## 3) Per-PDF extraction flow (what happens after download)

After all PDFs are downloaded, the Sales Agent runs `process_single_pdf(file_path, pdf_index)` for each PDF in a thread pool.

Parallelization:
- `ThreadPoolExecutor(max_workers=OCR_MAX_WORKERS)` where `OCR_MAX_WORKERS` is hard-set to `4`.

The per-PDF flow is:

### 3.1 Native text extraction (first 10 pages)

- Library: `pdfplumber`
- Behavior: open PDF and concatenate extracted text from the first 10 pages:
  - `combined_text = "\n".join([p.extract_text() or "" for p in pdf.pages[:10]])`

### 3.2 OCR fallback (only if native text is “too small”)

If `len(combined_text.strip()) < 50`, it runs OCR.

OCR stack:
- `pdf2image.convert_from_path()` converts selected pages to images
- `pytesseract.image_to_string()` performs OCR
- Poppler path is required for `pdf2image` on Windows (`POPPLER_PATH`)
- Tesseract path is hard-set at import time:
  - `pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'`

OCR page selection modes:
- `OCR_MODE = "smart"` (default) or `"all"`
- Smart mode OCRs:
  - first `OCR_FIRST_PAGES` pages,
  - last `OCR_LAST_PAGES` pages,
  - and up to `OCR_KEYWORD_PAGES_MAX` pages where native text includes keywords like `tender`, `bid`, `rfp`, `deadline`, `boq`.

The OCR implementation is memory-aware:
- it converts pages in batches (`OCR_BATCH_SIZE`),
- runs OCR workers in a thread pool (bounded by `OCR_MAX_WORKERS`).

### 3.3 Text cache for downstream agents

Sales Agent stores the final `combined_text` into a cache:

- `pdf_text_cache[file_path] = combined_text`

This is returned in `state["pdf_text_cache"]` to avoid re-opening PDFs in later agents.

### 3.4 One LLM call to extract RFP fields

The Sales Agent uses a **single-call** extraction function:

- `fields = extract_fields_single_call(combined_text)`

The local LLM call path is via Ollama HTTP:

- `requests.post(f"{OLLAMA_BASE_URL}/api/generate", ...)`
- deterministic settings: `temperature=0`
- timeout: `OLLAMA_TIMEOUT = 120`
- model: `OLLAMA_MODEL = "mistral:7b-instruct"`
- in-memory response cache keyed by `md5(prompt)` (`_llm_cache`)

Important: this is not Groq; it’s local Ollama.

### 3.5 Domain detection (simple keyword heuristic)

After text extraction, it assigns `fields["domain"]` based on keyword presence:

- Strong electrical wins if any of: `xlpe`, `kv cable`, `ht cable`, `power cable`, `cable assembly`
- Else civil material wins if any of: `painting`, `plaster`, `mortar`, `waterproof`, `rcc`, …
- Else weak electrical if any of: `wiring`, `mcb`, `switchboard`, …
- Else default `General`

### 3.6 BOQ/Price Bid “trigger page” search

The Sales Agent tries to extract items only from the BOQ/Price Bid section.

Trigger keywords include (partial list):
- `price bid`, `schedule of items`, `boq`, `bill of quantities`, `schedule of quantities`, `annexure vii`, `form 17`, etc.

Search strategy:
- If the PDF has more than 50 pages, it scans the **last 15 pages first**, then the rest.
- Once it finds the first trigger page, it also includes the next 2 pages as context.
- It stops after the first match (`break`).

### 3.7 Item extraction prompt (LLM-driven)

From the trigger text, it runs a simplified prompt designed for local Mistral:

- Output required: JSON list of strings like `"Item Name | Quantity"`
- Explicit instruction: quantity must come from the `Quantity/Qty` column (avoid S.No, Rate, Amount)
- Input is truncated to `text_input[:3000]`

Then it parses the list and constructs:
- `extracted_item_list`: list of item names
- `extracted_item_list_structured`: list of `{ item_name, quantity, unit, specs }`
  - unit is set to `"Nos"`

### 3.8 OCR fallback for BOQ pages (targeted)

If the native-text trigger-page extraction produces an empty list, it tries OCR on (at least) the first trigger page:


### 3.9 Filtering + demo ground-truth enforcement

There is “relaxed validation” filtering that drops:
- exact matches of administrative words (e.g., `bid`, `tender`, `annexure`),
- garbage values (`unknown`, `n/a`),
while keeping remaining items.

Then, **demo safety** logic can override extraction:
- `ground_truth = get_ground_truth_items(rfp_id_normalized)`
- if ground truth exists for that RFP ID, it *always* replaces extracted items.

### 3.10 Estimated project value heuristic

It also tries to guess a project value by scanning `combined_text` for large INR-looking amounts:

- regex finds comma-formatted numbers
- keeps values `> 100000`
- uses the max as `fields["estimated_project_value"] = "Approx. ₹{max:,}"`

### 3.11 Save + output

Per PDF, the agent returns a formatted object created by `format_sales_for_frontend(fields, pdf_index)` and then persists it via `save_rfp(formatted)`.

At the end, it sets:
- `state["sales_output"] = results`
- `state["pdf_paths"] = pdf_paths`
- `state["pdf_text_cache"] = pdf_text_cache`

---

## 4) Libraries used (Sales Agent scanning path)

- Playwright (sync): browser automation + robust download capture
  - `sync_playwright`, `chromium.launch`, `page.goto`, `locator`, `expect_download`
- pdfplumber: lightweight native PDF text extraction
- pdf2image + Poppler: rasterize PDF pages for OCR on Windows
- pytesseract + Tesseract OCR: OCR fallback when native text fails
- requests: local Ollama HTTP calls
- concurrent.futures: parallel per-PDF processing and OCR parallelism
- dotenv: loads `.env` configuration (though key scraping constants like `SITE_URL` are in code)

---

## 5) Current limitations (as implemented)

### 5.1 Dummy-website scan limitations

- Hard-coded selector: only finds links matching `a:has-text('Download')`.
  - Any UI text change (“Download PDF”, icon-only button, etc.) breaks discovery.
- Assumes all RFPs are on one page.
  - No logic for pagination, infinite scroll, or detail pages.
- Uses `wait_until="networkidle"`.
  - SPAs or long-polling sites may never reach “idle” reliably.
- File naming overwrites.
  - Downloads always save as `rfp_1.pdf`, `rfp_2.pdf`, … in the working directory; repeated runs can overwrite prior downloads.
- No dedupe.
  - If the site lists the same RFP twice, both are downloaded.

### 5.2 PDF + extraction limitations

- Native text reads only first 10 pages.
  - If key metadata appears later, it won’t be seen unless OCR kicks in.
- OCR trigger is very low-level (`< 50 chars`).
  - PDFs with partial native text but missing tables may skip OCR even when OCR would help.
- BOQ search stops at the first trigger page.
  - PDFs with multiple BOQ sections or scattered schedules may be partially captured.
- BOQ extraction depends on LLM + truncated input (`[:3000]`).
  - Wide tables, multi-page BOQs, or long item descriptions can be cut off.
- Quantity extraction remains probabilistic.
  - Even with prompt constraints, LLM can still confuse columns on messy text.

### 5.3 Environment / deployment limitations

- Windows-specific hard-coded paths:
  - Tesseract path is hard-coded.
  - Poppler default path assumes a specific install location.
- Headless Chromium may behave differently than headed mode for some websites.
- The workaround that patches `asyncio.get_event_loop` is fragile.
  - It’s a pragmatic hack; future Playwright/asyncio changes could break it.

---

## 6) Improvements (future roadmap ideas)

These improvements are scoped to the Sales Agent scanning + extraction stage.

### 6.1 Make website scanning more robust

- Use stronger locators:
  - Prefer attribute-based selectors (e.g., `a[href$='.pdf']`) or `data-testid` if you control the dummy site.
- Add pagination/infinite scroll handling:
  - detect “Load more” and loop until exhausted;
  - or crawl detail pages and collect all download URLs.
- Add download dedupe + stable storage:
  - hash file bytes and store under `downloads/<hash>.pdf`;
  - keep a manifest keyed by RFP ID / URL.
- Improve waiting strategy:
  - replace `networkidle` with a deterministic UI readiness check (specific container rendered, count stabilized).

### 6.2 Improve PDF/BOQ extraction determinism

- Use layout-aware table tools before LLM:
  - e.g., `camelot`, `tabula`, or `pymupdf` table heuristics for PDFs with embedded text.
- Multi-page BOQ support:
  - once a trigger page is found, continue scanning forward until table ends (rather than fixed “+2 pages”).
- Smarter OCR decision:
  - run a quick “table detect” on trigger pages;
  - OCR only those pages where table parsing fails.
- Normalize units + quantities:
  - parse quantities as numeric where possible;
  - allow units extraction (Nos/Mtr/Kg/etc.) instead of hardcoding `Nos`.

### 6.3 Make it production-friendly

- Move hard-coded paths to environment variables:
  - Tesseract path and Poppler path should be configured via env and validated at startup.
- Add structured logging + metrics:
  - track: download count, OCR pages, LLM latency, extraction success rates.
- Add retry/backoff:
  - for navigation, downloads, and Ollama calls.
- Consider Playwright async API + a single-threaded runner:
  - right now it’s sync Playwright with thread pool parallelism around PDF work; a cleaner orchestration model reduces edge-case failures.

---

## 7) Quick “exact flow” summary

- Open headless Chromium (persistent page/context) → go to `SITE_URL` → wait for `Download` links → click each link under `expect_download()` → save as `rfp_i.pdf`.
- For each PDF: native text (first 10 pages) → OCR only if very little text → 1 LLM call for fields → keyword domain → find BOQ trigger pages (last 15 pages first if big PDF) → LLM extracts `Item | Qty` (OCR fallback on trigger page) → filter junk → override with ground truth for known demos → save.
