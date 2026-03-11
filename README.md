# RFPilot

An end-to-end agentic AI system that discovers RFPs, prioritizes them, extracts technical requirements, semantically matches them to OEM product SKUs, estimates pricing/testing costs, and prepares structured outputs for proposal teams.

This repo represents a winning prototype built for EY Techathon 6.0.

At a high level, the system is composed of:

- A React (Vite) web UI
- A Node/Express API for RBAC, products/SKUs, SKU Gap Intelligence, and historical bids
- A Python/FastAPI backend for the agentic pipeline, RAG chatbot, translation, notifications, PPT export, and Gmail ingest
- A Gmail listener that ingests recent tender/RFP emails into the FastAPI backend

Built for enterprise procurement, PSU tenders, and large-scale technical bidding workflows.

## Problem statement

Responding to RFPs is often:

- Manual and time-consuming
- Highly dependent on scarce technical experts
- Error-prone due to inconsistent RFP formats
- Slow to identify right-to-win tenders

This project aims to continuously discover RFPs, prioritize by urgency/value, match technical specs to OEM SKUs with explainability, and generate auditable outputs that proposal teams can iterate on.

## Key capabilities

- Automated RFP discovery and prioritization (agent pipeline)
- Technical requirement extraction from PDFs (including scanned PDF fallback via OCR)
- Semantic SKU matching with spec-match scoring and top alternatives
- Pricing and testing/service cost estimation
- SKU Gap Intelligence analytics and AI insights
- Strategic insights (win-probability-style analysis using current + historical context)
- Gmail-based RFP alerts (push/near-real-time ingestion into the system)
- RAG chatbot that answers questions using the product catalog + pipeline state
- Human-in-the-loop controls (approve/skip/override at key pipeline stages)
- Secure collaboration hub: an internal coordination space to track who is working on what and the current status, with confidential discussions kept off insecure channels (no WhatsApp/email threads for sensitive bid data). The goal is secure, auditable collaboration with transparency across teams.

## Repository layout

- [RFPilot/](RFPilot/) — React + Vite frontend (shadcn/ui)
- [backend/](backend/) — Node/Express backend (auth/RBAC, SKU gap, products, RFPs)
- [RFPPilot2/backend/](RFPPilot2/backend/) — Python/FastAPI backend (agent pipeline, RAG, notifications, integrations)
- [gmail-rfp-alert/](gmail-rfp-alert/) — Gmail API + Pub/Sub listener that POSTs events to FastAPI
- [ENV_SETUP.md](ENV_SETUP.md) — Environment variables reference (create `.env` files from this)
- [AUTH_SETUP_INSTRUCTIONS.md](AUTH_SETUP_INSTRUCTIONS.md) — Auth/RBAC setup notes (Node backend)

## Agent architecture (pipeline)

The agentic pipeline is organized into roles; each stage produces structured outputs that feed downstream stages.

### Sales agent

Responsibilities:

- Discovers candidate RFPs (scrape/dummy sources) and extracts metadata

Typical outputs:

- RFP id, title, buyer, deadline, estimated value, priority

### Master agent (orchestrator)

Responsibilities:

- Selects the highest-priority RFP
- Supports human override (skip to next priority)
- Produces a compact, structured summary for downstream agents and UI

### Technical agent

Responsibilities:

- Extracts line items and requirements from RFP PDFs
- Matches requirements to OEM SKUs and computes a spec-match score

How it works (as implemented in this repo):

- Sentence-Transformers embeddings (default `BAAI/bge-large-en`, with fallback `all-MiniLM-L6-v2`)
- Cosine similarity-based ranking, returning best match + top alternatives
- Domain-aware scoring modes are supported in the matching logic

### Pricing agent

Responsibilities:

- Assigns prices from the product catalog
- Adds testing/acceptance costs from a testing matrix
- Produces consolidated line-item and totals outputs

### Additional modules

- SKU Gap Intelligence: analytics endpoints under `/api/sku-gap/*` on the Node backend, plus AI summaries under `/api/sku-gap/insights`
- Strategic Insights: UI page that surfaces historical performance exploration and strategy guidance (data pulled from the Node backend)
- Gmail RFP alerts: listener ingests and stores email metadata and creates notifications without auto-triggering agents
- RAG chatbot: FastAPI endpoint `/rag/chat` with a ChromaDB vector store + Groq-backed responses

## Quick start (local)

### Prerequisites

- Node.js (recommended: 18+)
- Python (recommended: 3.10+)
- MongoDB (Atlas or local)

Optional / feature-dependent:

- Playwright browsers (used by the Python pipeline)
- Tesseract OCR + Poppler (used by PDF OCR flows)
- AWS credentials (if using S3 PDF storage)
- Google Cloud + Gmail API credentials (if running the Gmail listener)

### 1) Configure environment variables

There are no committed `.env.example` templates in this repo. Create the following `.env` files using the variables documented in [ENV_SETUP.md](ENV_SETUP.md):

- [backend/](backend/) — `.env` for the Node API
- [RFPilot/](RFPilot/) — `.env` for the frontend
- [RFPPilot2/backend/](RFPPilot2/backend/) — `.env` for the FastAPI backend
- [gmail-rfp-alert/](gmail-rfp-alert/) — `.env` for the Gmail listener

Security note: `.env` files are ignored by git via [.gitignore](.gitignore).

### 2) Install dependencies

Node backend:

- `cd backend`
- `npm install`

Frontend:

- `cd RFPilot`
- `npm install`

Gmail listener:

- `cd gmail-rfp-alert`
- `npm install`

Python backend:

- `cd RFPPilot2/backend`
- `python -m venv venv`
- `venv\Scripts\activate` (Windows)
- `pip install -r requirements.txt`

If you use Playwright features:

- `python -m playwright install`

### 3) Run services

Recommended order (separate terminals):

1) Python/FastAPI backend:

- `cd RFPPilot2/backend`
- `venv\Scripts\activate`
- `python main_new.py`

By default, this starts on `http://127.0.0.1:8001` (see the `uvicorn.run(...)` in the file).

2) Node/Express backend:

- `cd backend`
- `npm start`

Note: there is no explicit `start` script in [backend/package.json](backend/package.json). `npm start` will fall back to `node server.js`.

3) Frontend (Vite dev server):

- `cd RFPilot`
- `npm run dev`

4) Gmail listener (optional):

- `cd gmail-rfp-alert`
- `npm start`

## Default ports and URLs

- Frontend (Vite): `http://localhost:5173`
- Node backend (Express): `http://localhost:5000` (or `PORT` in [backend/](backend/))
- Python backend (FastAPI): `http://127.0.0.1:8001` (when run via `python main_new.py`)

## Frontend environment variables (important)

The frontend currently uses a mix of environment variables for different API calls:

- Many Node-backed API calls use `VITE_API_URL` (fallback: `http://localhost:5000`).
- The chatbot prefers `VITE_RAG_API_URL` / `VITE_PY_API_URL` / `VITE_FASTAPI_URL`, and otherwise falls back to `VITE_API_URL`, then `http://127.0.0.1:8000`.

Practical setup that usually works:

- Set `VITE_API_URL=http://localhost:5000` for the Node backend.
- Set `VITE_FASTAPI_URL=http://127.0.0.1:8001` for FastAPI-backed features like `/rag/chat`.

If a page appears to call the “wrong” backend, search for the env key usage in [RFPilot/src/](RFPilot/src/) and align the variable(s).

## Authentication / RBAC (Node backend)

The Node backend seeds a default `super_admin` on startup (see [AUTH_SETUP_INSTRUCTIONS.md](AUTH_SETUP_INSTRUCTIONS.md)).

- Start the Node backend (`npm start` in [backend/](backend/))
- Use the printed default admin credentials to log in via the frontend

## Gmail listener 

The Gmail listener watches Inbox activity (Gmail API + Pub/Sub) and POSTs RFP-like email metadata to the FastAPI backend endpoint:

- `POST /integrations/gmail/rfp-event` (implemented in [RFPPilot2/backend/main_new.py](RFPPilot2/backend/main_new.py))

Key files:

- [gmail-rfp-alert/listener.js](gmail-rfp-alert/listener.js) — main listener
- [gmail-rfp-alert/credentials.json](gmail-rfp-alert/credentials.json) — OAuth client (do not commit)

Important:

- Set `BACKEND_URL` in the Gmail listener env to your FastAPI base (for example `http://127.0.0.1:8001`).
- First run may require an interactive OAuth consent flow to create `token.json`.

## Security and confidentiality

This project is designed for sensitive bid/procurement workflows.

- Keep secrets out of git: `.env`, Gmail credentials/tokens, and local caches are git-ignored (see [.gitignore](.gitignore)).
- Node backend includes JWT auth and role-based access control (see [AUTH_SETUP_INSTRUCTIONS.md](AUTH_SETUP_INSTRUCTIONS.md)).
- Collaboration hub (planned): provide a secure place for status updates and discussions so confidential RFP/bid coordination stays off insecure channels.

## Troubleshooting

- Mongo connection errors: verify `MONGO_URI` / `MONGO_URI2` values and Atlas IP allowlist (see [ENV_SETUP.md](ENV_SETUP.md)).
- Port conflicts: change ports via environment variables or by running `uvicorn main_new:app --reload --port <port>`.
- OCR/PDF issues: ensure Tesseract + Poppler are installed and available on PATH if those features are used.

## Notes
- Winning prototype at EY Techathon 6.0 🏆 
- Avoid committing secrets: `.env`, Gmail `credentials.json`/`token.json`, and local caches are git-ignored (see [.gitignore](.gitignore)).
