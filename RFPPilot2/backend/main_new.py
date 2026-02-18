from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import threading
import uuid
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor
import re
import hashlib
from datetime import datetime
import base64
import os
from dotenv import load_dotenv
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
import mimetypes
from pymongo import MongoClient
from io import BytesIO
from pathlib import Path

from pydantic import BaseModel

# PowerPoint generation imports
try:
    from pptx import Presentation
    from pptx.util import Pt, Inches
    from pptx.dml.color import RGBColor
    from pptx.enum.text import PP_ALIGN
    from pptx.chart.data import CategoryChartData
    from pptx.enum.chart import XL_CHART_TYPE
    from pptx.enum.shapes import MSO_SHAPE_TYPE, MSO_AUTO_SHAPE_TYPE
    PPT_AVAILABLE = True
except ImportError:
    PPT_AVAILABLE = False
    print("⚠️ python-pptx not installed. PPT export will not be available.")

# Load environment variables
load_dotenv()

from store_new import (
    save_sales_output,
    get_sales_output,
    save_pdf_paths,
    get_pdf_paths,
    save_pdf_text_cache,
    get_pdf_text_cache,
    save_master_output,
    get_master_output,
    save_technical_output,
    get_technical_output,
    save_pricing_output,
    get_pricing_output,
    save_compliance_output,
    get_compliance_output,
    save_proposal_output,
    get_proposal_output,
    clear_all,
    add_gmail_email,
    list_gmail_emails,
    add_notification,
    list_notifications,
    get_unprocessed_gmail_emails,
    mark_gmail_email_processed,
    clear_notifications,
    clear_gmail_data,
    add_skipped_rfp_id,
    clear_skipped_rfp_ids
)

# Pydantic models for request bodies
class ProposalEditRequest(BaseModel):
    updated_bid: str

class CoverLetterRequest(BaseModel):
    buyer: str
    rfp_title: str
    rfp_id: str = ""

# ============================================================================
# PowerPoint Template & Export Helper Functions
# ============================================================================

def ensure_ppt_template() -> Path:
    """
    Ensure that rfp_master_template.pptx exists in the backend folder.
    Raises an error if the professional template is not found.
    
    Returns the path to the template file.
    """
    template_path = Path(__file__).resolve().parent / "rfp_master_template.pptx"
    
    if template_path.exists():
        print(f"✅ PPT master template found at {template_path}")
        return template_path
    
    # Raise error if professional template is missing - do not auto-create
    error_msg = f"❌ Professional template 'rfp_master_template.pptx' not found at {template_path}. Please ensure the template file exists in the backend folder."
    print(error_msg)
    raise FileNotFoundError(error_msg)

def _safe_number(value: Any, default: float = 0.0) -> float:
    """Safely convert a value to float."""
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default

def _format_inr(value: Any) -> str:
    """Format a number as INR currency."""
    n = _safe_number(value, 0.0)
    if n.is_integer():
        return f"₹{int(n):,}"
    return f"₹{n:,.2f}"

def _format_inr_from_any(value: Any) -> str:
    """Format a number-ish value as INR with comma separation."""
    if value is None:
        return _format_inr(0)
    if isinstance(value, (int, float)):
        return _format_inr(value)
    s = str(value).strip()
    if not s:
        return _format_inr(0)
    
    # Strip currency symbols/words and keep digits/decimal
    cleaned = re.sub(r"[^0-9.\-]", "", s)
    try:
        return _format_inr(float(cleaned))
    except Exception:
        return s if s.startswith("₹") else f"₹{s}"

def _iter_slide_shapes(slide):
    """Recursively iterate through all shapes in a slide, including grouped shapes."""
    def _walk(shape_container):
        for shp in shape_container:
            yield shp
            try:
                if getattr(shp, "shape_type", None) == MSO_SHAPE_TYPE.GROUP:
                    for inner in _walk(shp.shapes):
                        yield inner
            except Exception:
                continue
    
    if PPT_AVAILABLE:
        yield from _walk(slide.shapes)

def _replace_placeholders_in_text_frame(text_frame, replacements: Dict[str, str]) -> None:
    """Replace placeholders inside a text frame while preserving formatting."""
    if not PPT_AVAILABLE:
        return
        
    for paragraph in text_frame.paragraphs:
        full_text = paragraph.text or ""
        if not full_text:
            continue
        
        replaced = full_text
        for key, value in replacements.items():
            replaced = replaced.replace(key, str(value))
        
        if replaced == full_text:
            continue
        
        # Write replaced text to first run, clear others
        if not paragraph.runs:
            run = paragraph.add_run()
            run.text = replaced
            continue
        
        paragraph.runs[0].text = replaced
        for run in paragraph.runs[1:]:
            run.text = ""

def _replace_placeholders_in_table_cells(shape, replacements: Dict[str, Any]) -> None:
    """Replace placeholders in table cells."""
    if not PPT_AVAILABLE:
        return
        
    if not getattr(shape, "has_table", False):
        return
    
    table = shape.table
    for r in range(len(table.rows)):
        for c in range(len(table.columns)):
            tf = table.cell(r, c).text_frame
            _replace_placeholders_in_text_frame(tf, {k: str(v) for k, v in replacements.items()})

app = FastAPI(title="Agentic RFP Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Task status store
task_status: Dict[str, str] = {}

# MongoDB connection for analytics
try:
    MONGO_URI = os.getenv("MONGO_URI2")
    if not MONGO_URI:
        raise ValueError("MONGO_URI2 not found in environment variables")
    mongo_client = MongoClient(MONGO_URI)
    mongo_db = mongo_client["agentic_rfp"]
    past_bids_collection = mongo_db["dummybid"]
    # Test connection
    past_bids_count = past_bids_collection.count_documents({})
    print(f"✅ MongoDB connected for analytics - {past_bids_count} bids in dummybid collection")
except Exception as e:
    print(f"⚠️ MongoDB connection failed: {e}")
    mongo_db = None
    past_bids_collection = None

# Dedicated single-thread executor for pipeline (avoids Playwright greenlet conflicts)
# All pipeline operations run in the same thread where Playwright browser is initialized
_pipeline_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="pipeline")
_rfp_module = None

def load_rfp_module():
    """Load RFP module in pipeline thread (called once at startup)"""
    global _rfp_module
    if _rfp_module is None:
        import wonky_SBERT_copilot as rfp_module
        _rfp_module = rfp_module
        print("[Pipeline Thread] ✅ RFP module loaded")
    return _rfp_module

def warmup_pipeline():
    """Warm up browser, embeddings, and MongoDB to eliminate first-request latency"""
    rfp_module = load_rfp_module()
    
    print("[Warmup] Starting browser warmup (persistent page init)...")
    try:
        # Initialize persistent page in THIS thread (worker thread) where it will be used
        # This avoids greenlet thread conflicts and warms up the browser
        page = rfp_module._init_browser()  # Returns persistent page
        page.goto("about:blank")
        print("[Warmup] ✅ Persistent browser page initialized and ready")
    except Exception as e:
        print(f"[Warmup] ⚠️ Browser warmup failed: {e}")
    
    print("[Warmup] Starting embedding model warmup...")
    try:
        # Warm up embedding model with test inference
        test_text = "Test warmup query for embedding model initialization"
        _ = rfp_module.embed_text(test_text)
        print("[Warmup] ✅ Embedding model warmed up")
    except Exception as e:
        print(f"[Warmup] ⚠️ Embedding warmup failed: {e}")
    
    print("[Warmup] Starting MongoDB warmup...")
    try:
        # Warm up MongoDB connection
        _ = list(rfp_module.sku_collection.find().limit(1))
        print("[Warmup] ✅ MongoDB connection warmed up")
    except Exception as e:
        print(f"[Warmup] ⚠️ MongoDB warmup failed: {e}")

@app.on_event("startup")
async def startup_event():
    # 🚀 EAGER MODULE LOAD: Ensure embeddings loaded before declaring startup complete
    print("[Startup] 🚀 Loading RFP module with global initializations...")
    
    # Load module synchronously to ensure embeddings initialization complete
    # Browser page will lazy-load on first use in worker thread (persistent page pattern)
    rfp_module = load_rfp_module()
    
    # Verify critical components are ready
    if rfp_module.SKU_EMBEDDINGS is not None:
        print(f"[Startup] ✅ SKU embeddings ready ({len(rfp_module.SKU_EMBEDDINGS)} embeddings)")
    else:
        print("[Startup] ⚠️ SKU embeddings not loaded")
    
    print("[Startup] ✅ Persistent browser page will initialize on first request (lazy-load)")
    print("[Startup] 🚀 Application startup complete - embeddings pre-loaded, persistent page pattern enabled")
    
    # Ensure PowerPoint template exists
    if PPT_AVAILABLE:
        try:
            ensure_ppt_template()
        except FileNotFoundError as e:
            print(f"[Startup] ⚠️ {e}")
            print("[Startup] ℹ️ PPT export will be unavailable until rfp_master_template.pptx is added to the backend folder")
        except Exception as e:
            print(f"[Startup] ⚠️ PPT template validation failed: {e}")
    else:
        print("[Startup] ⚠️ PPT export not available (python-pptx not installed)")
    
    # Schedule warmup after event loop is fully initialized (prevents asyncio.CancelledError)
    import asyncio
    async def delayed_warmup():
        await asyncio.sleep(0.5)  # Small delay to let event loop stabilize
        _pipeline_executor.submit(warmup_pipeline)
    
    asyncio.create_task(delayed_warmup())


# Background runner
def run_pipeline_bg(task_id: str, skip_mode: bool = False):
    """
    Run the RFP pipeline.
    
    Args:
        task_id: Unique task identifier
        skip_mode: If True, reuse existing sales_output and skip Sales Agent re-run
    """
    try:
        task_status[task_id] = "running"
        
        # Use pre-loaded module (already initialized)
        rfp_module = load_rfp_module()
        
        state = {}
        
        if skip_mode:
            # Skip mode: Reuse existing sales data, don't re-download PDFs
            print("[Pipeline Skip Mode] Reusing existing sales data, skipping Sales Agent...")
            sales_data = get_sales_output()
            if not sales_data:
                print("[Pipeline Skip Mode] ⚠️ No existing sales data found")
                task_status[task_id] = "failed"
                return
            state["sales_output"] = sales_data
            
            # Restore PDF paths and text cache
            pdf_paths = get_pdf_paths()
            pdf_text_cache = get_pdf_text_cache()
            state["pdf_paths"] = pdf_paths
            state["pdf_text_cache"] = pdf_text_cache
            
            print(f"[Pipeline Skip Mode] ✅ Loaded {len(sales_data)} existing RFP(s)")
            print(f"[Pipeline Skip Mode] ✅ Restored {len(pdf_paths)} PDF path(s) and {len(pdf_text_cache)} cached text(s)")
        else:
            # Normal mode: Clear all and run Sales Agent
            clear_all()
            
            # Clear skipped RFP IDs when starting fresh (allows re-evaluation of all RFPs)
            clear_skipped_rfp_ids()
            print("[Pipeline] ✅ Cleared skipped RFP IDs - starting fresh discovery")
            
            # Sales Agent (process website PDFs first)
            state = rfp_module.sales_agent_node(state)
            sales_data = state.get("sales_output", [])

        # ------------------------------------------------------------------
        # Gmail Integration: Process Gmail emails (only in normal mode, not skip mode)
        # - Removes manual regex extraction
        # - Uses LLM-based extraction with Ground Truth validation
        # - Ensures domain-intelligent matching for MEDC power cables
        # ------------------------------------------------------------------
        if not skip_mode:
            gmail_emails = get_unprocessed_gmail_emails()
        else:
            gmail_emails = []
        gmail_sales_data = []
        gmail_extracted_items_map = {}  # Map rfp_id -> {extracted_item_list, extracted_item_list_structured}
        gmail_text_cache = {}  # Map rfp_id -> full text for Technical Agent

        if gmail_emails:
            print(f"[Gmail Integration] Processing {len(gmail_emails)} Gmail emails through AI module")
            for email_obj in gmail_emails:
                message_id = str(email_obj.get("message_id") or "").strip()
                subject = str(email_obj.get("subject") or "").strip()
                body_text = str(email_obj.get("body_text") or "").strip()
                
                if not subject and not body_text:
                    continue
                
                # Combine email content for AI processing
                combined_text = f"Subject: {subject}\n\n{body_text}"
                
                # Create state for this Gmail RFP (AI module handles extraction, matching, domain detection)
                gmail_state = {
                    "gmail_rfp_text": combined_text,
                    "gmail_message_id": message_id
                }
                
                # Process through AI module (uses LLM + Ground Truth logic)
                try:
                    gmail_state = rfp_module.sales_agent_node(gmail_state)
                    gmail_rfps = gmail_state.get("sales_output", [])
                    
                    # Debug: Check what we got
                    print(f"[Gmail Integration] 🔍 Debug: gmail_rfps count={len(gmail_rfps)}")
                    
                    # Add Gmail-specific metadata
                    for rfp in gmail_rfps:
                        rfp["source"] = "gmail"
                        rfp["gmail_message_id"] = message_id
                        rfp["gmail_received_timestamp"] = email_obj.get("received_timestamp", "")
                        
                        # Extract items from the RFP object (not from state root)
                        rfp_id = rfp.get("rfp_id")
                        extracted_items = rfp.get("extracted_item_list", [])
                        extracted_items_structured = rfp.get("extracted_item_list_structured", [])
                        
                        print(f"[Gmail Integration] 🔍 Debug: RFP ID={rfp_id}, extracted_items count={len(extracted_items)}, structured count={len(extracted_items_structured)}")
                        
                        # Store extracted items (both plain and structured) and text cache for this RFP
                        if rfp_id:
                            if extracted_items:
                                gmail_extracted_items_map[rfp_id] = {
                                    "extracted_item_list": extracted_items,
                                    "extracted_item_list_structured": extracted_items_structured
                                }
                                gmail_text_cache[rfp_id] = combined_text
                                print(f"[Gmail Integration] 📦 Stored {len(extracted_items)} items ({len(extracted_items_structured)} structured) for {rfp_id}")
                            else:
                                print(f"[Gmail Integration] ⚠️ No extracted_items for {rfp_id} (empty list)")
                        else:
                            print(f"[Gmail Integration] ⚠️ RFP has no rfp_id!")
                    
                    gmail_sales_data.extend(gmail_rfps)
                    print(f"[Gmail Integration] ✅ Processed: {subject[:60]}")
                    
                except Exception as e:
                    print(f"[Gmail Integration] ⚠️ Error processing {message_id}: {e}")
                    import traceback
                    traceback.print_exc()
                    continue

        # Merge Gmail and website RFPs
        if gmail_sales_data:
            print(f"[Gmail Integration] Merged {len(gmail_sales_data)} Gmail RFPs with {len(sales_data)} website RFPs")
            sales_data = list(sales_data) + gmail_sales_data
            state["sales_output"] = sales_data
            
            # Store Gmail-specific data in state for later retrieval
            state["gmail_extracted_items_map"] = gmail_extracted_items_map
            state["gmail_text_cache"] = gmail_text_cache

        # Save sales output and PDF data (for skip mode reuse)
        save_sales_output(sales_data)
        if not skip_mode:
            # Only save PDF paths and cache in normal mode (skip mode already restored them)
            pdf_paths = state.get("pdf_paths", [])
            pdf_text_cache = state.get("pdf_text_cache", {})
            save_pdf_paths(pdf_paths)
            save_pdf_text_cache(pdf_text_cache)
            print(f"[Pipeline] ✅ Saved {len(pdf_paths)} PDF path(s) and {len(pdf_text_cache)} cached text(s) for skip mode reuse")
        
        # Priority Selector (internal - doesn't affect saved sales output)
        state = rfp_module.select_highest_priority_rfp(state)
        
        # Check if any RFPs remain after filtering skipped items
        selected_rfps = state.get("sales_output", [])
        if not selected_rfps or len(selected_rfps) == 0:
            print("[Pipeline] ❌ No RFPs available after filtering skipped items")
            task_status[task_id] = "failed"
            # Save empty outputs to indicate no data
            save_master_output({"error": "No RFPs available - all have been skipped"})
            save_technical_output({"error": "No RFPs available"})
            save_pricing_output({"error": "No RFPs available"})
            return
        
        # Restore Gmail-specific data for the selected RFP
        # After select_highest_priority_rfp, state["sales_output"] contains only the selected RFP
        selected_rfps = state.get("sales_output", [])
        selected_rfp_id = selected_rfps[0].get("rfp_id") if selected_rfps else None
        selected_rfp_source = selected_rfps[0].get("source", "") if selected_rfps else ""
        
        print(f"[Gmail Integration] 🔍 Debug: Selected RFP ID={selected_rfp_id}, source={selected_rfp_source}")
        print(f"[Gmail Integration] 🔍 Debug: gmail_extracted_items_map keys={list(state.get('gmail_extracted_items_map', {}).keys())}")
        
        if selected_rfp_id:
            gmail_extracted_items_map = state.get("gmail_extracted_items_map", {})
            gmail_text_cache = state.get("gmail_text_cache", {})
            
            # If selected RFP is a Gmail RFP, restore its extracted items (plain and structured)
            if selected_rfp_id in gmail_extracted_items_map:
                item_data = gmail_extracted_items_map[selected_rfp_id]
                state["extracted_item_list"] = item_data.get("extracted_item_list", [])
                state["extracted_item_list_structured"] = item_data.get("extracted_item_list_structured", [])
                state["gmail_rfp_text"] = gmail_text_cache.get(selected_rfp_id, "")
                print(f"[Gmail Integration] 🔄 Restored {len(state['extracted_item_list'])} items ({len(state['extracted_item_list_structured'])} structured) for selected RFP {selected_rfp_id}")
            elif selected_rfp_source == "gmail":
                # Fallback: If source is gmail but not in map, try to get from RFP data itself
                print(f"[Gmail Integration] ⚠️ Selected RFP {selected_rfp_id} not in gmail_extracted_items_map, but source=gmail")
                print(f"[Gmail Integration] 🔧 Attempting to use gmail_rfp_text from RFP data...")
                
                _rfp_data = selected_rfps[0]
                
                # Try to get gmail_rfp_text directly from the RFP object (stored by sales_agent_node)
                _gmail_text = _rfp_data.get("gmail_rfp_text")
                if _gmail_text:
                    state["gmail_rfp_text"] = _gmail_text
                    print(f"[Gmail Integration] ✅ Retrieved gmail_rfp_text from RFP data ({len(_gmail_text)} chars)")
                else:
                    # Last resort: reconstruct from title/body fields
                    _subject = _rfp_data.get("rfp_title") or _rfp_data.get("title") or ""
                    _body = _rfp_data.get("body_text") or _rfp_data.get("description") or ""
                    
                    if _subject or _body:
                        reconstructed_text = f"Subject: {_subject}\n\n{_body}"
                        state["gmail_rfp_text"] = reconstructed_text
                        print(f"[Gmail Integration] ✅ Reconstructed gmail_rfp_text from title/body ({len(reconstructed_text)} chars)")
                    else:
                        print(f"[Gmail Integration] ❌ Cannot reconstruct gmail_rfp_text - no data available")
                        print(f"[Gmail Integration] ⚠️ Pipeline will fail at Technical Agent (no PDF, no gmail_rfp_text)")
            else:
                print(f"[Gmail Integration] ⚠️ Selected RFP {selected_rfp_id} not found in gmail_extracted_items_map and source is not gmail")
        
        # Master Agent
        state = rfp_module.master_agent_node(state)
        save_master_output(state.get("master_output", {}))
        
        # ── Pre-Technical Agent Bridge ────────────────────────────────────────────
        # Push extracted_item_list and pdf_path from the selected sales_output entry
        # into the state root so Technical Agent can find them.
        # This runs for BOTH PDF and Gmail RFPs as a safety net.
        _selected = (state.get("sales_output") or [{}])[0]
        _selected_source = _selected.get("source", "unknown")
        
        print(f"[Pre-Technical] 📋 RFP Source: {_selected_source}")
        
        # For Gmail RFPs: Ensure gmail_rfp_text is in state (handles skip_mode restoration)
        if _selected_source == "gmail" and not state.get("gmail_rfp_text"):
            _gmail_text_from_selected = _selected.get("gmail_rfp_text")
            if _gmail_text_from_selected:
                state["gmail_rfp_text"] = _gmail_text_from_selected
                print(f"[Pre-Technical] 🔄 Restored gmail_rfp_text from sales_output ({len(_gmail_text_from_selected)} chars)")
            else:
                print(f"[Pre-Technical] ⚠️ Gmail RFP but gmail_rfp_text not found in sales_output!")
        
        # Push extracted item list if not already in state
        if not state.get("extracted_item_list"):
            _items = _selected.get("extracted_item_list", [])
            if _items:
                state["extracted_item_list"] = _items
                print(f"[Pre-Technical] 🔄 Pushed {len(_items)} items from sales_output[0] into state")
        
        # Push structured items (with quantities) - CRITICAL for Pricing Agent
        if not state.get("extracted_item_list_structured"):
            _structured = _selected.get("extracted_item_list_structured", [])
            if _structured:
                state["extracted_item_list_structured"] = _structured
                print(f"[Pre-Technical] 🔄 Pushed structured items ({len(_structured)}) into state")
            else:
                # Fallback: If no structured items but plain items exist, create default structured items
                _plain_items = state.get("extracted_item_list", [])
                if _plain_items:
                    state["extracted_item_list_structured"] = [
                        {"item_name": item, "quantity": "1", "unit": "Nos", "specs": ""}
                        for item in _plain_items
                    ]
                    print(f"[Pre-Technical] 🔧 Created {len(_plain_items)} default structured items from plain list")
        
        # For PDF RFPs: Push pdf_path into state root AND into master_output.technical_summary
        if not state.get("gmail_rfp_text"):  # only for PDF RFPs
            _pdf = (state.get("pdf_paths") or [None])[0] or _selected.get("pdf_path")
            
            # Debug: Check where pdf_path should come from
            if not _pdf:
                print(f"[Pre-Technical] ⚠️ Warning: PDF path not found for non-Gmail RFP!")
                print(f"[Pre-Technical] 🔍 state.pdf_paths={state.get('pdf_paths')}")
                print(f"[Pre-Technical] 🔍 _selected.pdf_path={_selected.get('pdf_path')}")
                print(f"[Pre-Technical] 🔍 _selected.source={_selected.get('source')}")
                print(f"[Pre-Technical] 🔍 _selected.gmail_rfp_text exists={bool(_selected.get('gmail_rfp_text'))}")
                print(f"[Pre-Technical] 🔍 This may cause Technical Agent to fail unless it's actually a Gmail RFP")
            
            if _pdf:
                # Update state root
                if not state.get("pdf_path"):
                    state["pdf_path"] = _pdf
                    print(f"[Pre-Technical] 🔄 Pushed pdf_path={_pdf} into state root")
                # Patch master_output.technical_summary.pdf_path if missing
                _master = state.get("master_output") or {}
                _tech_summary = _master.get("technical_summary") or {}
                if not _tech_summary.get("pdf_path"):
                    _tech_summary["pdf_path"] = _pdf
                    _master["technical_summary"] = _tech_summary
                    state["master_output"] = _master
                    print(f"[Pre-Technical] 🔄 Patched master_output.technical_summary.pdf_path={_pdf}")
            else:
                # PDF-based RFP but no PDF path available - set empty technical_output to prevent downstream errors
                print(f"[Pre-Technical] ⚠️ PDF RFP detected but pdf_path is None - pipeline will skip technical matching")
        # ─────────────────────────────────────────────────────────────────────────
        
        # Debug: Check state before Technical Agent
        print(f"[Pre-Technical] 🔍 Debug: extracted_item_list count={len(state.get('extracted_item_list', []))}")
        print(f"[Pre-Technical] 🔍 Debug: extracted_item_list_structured count={len(state.get('extracted_item_list_structured', []))}")
        print(f"[Pre-Technical] 🔍 Debug: gmail_rfp_text present={bool(state.get('gmail_rfp_text'))}")
        print(f"[Pre-Technical] 🔍 Debug: pdf_path={state.get('pdf_path')}")
        
        # Technical Agent
        state = rfp_module.technical_agent_node(state)
        # Get both formatted and raw outputs
        tech_formatted = state.get("technical_output", {})
        tech_raw = state.get("technical_output_raw", {})
        
        # Ensure technical_output_raw exists in state (required by proposal_builder)
        if not tech_raw and tech_formatted:
            # Fallback: use formatted as raw if raw doesn't exist
            state["technical_output_raw"] = tech_formatted
            tech_raw = tech_formatted
            print("[Technical Agent] ⚠️ Using formatted output as fallback for raw output")
        
        # Build comparison matrices for each item
        if tech_raw.get("items") and tech_formatted.get("items"):
            for idx, formatted_item in enumerate(tech_formatted["items"]):
                if idx < len(tech_raw["items"]):
                    try:
                        comparison_matrix = rfp_module.build_comparison_matrix(
                            tech_raw["items"][idx],
                            domain=tech_raw.get("domain")
                        )
                        formatted_item["comparison_matrix"] = comparison_matrix
                    except Exception as e:
                        print(f"[Error building comparison matrix for item {idx}]: {e}")
        
        save_technical_output(tech_formatted)
        
        # Pricing Agent
        state = rfp_module.pricing_agent_node(state)
        save_pricing_output(state.get("pricing_output", {}))
        save_compliance_output(state.get("product_compliance_table", []))
        
        # Proposal Builder
        state = rfp_module.proposal_builder_node(state)
        save_proposal_output(state.get("final_bid_prose", ""))
        
        task_status[task_id] = "completed"
        
    except Exception as e:
        task_status[task_id] = "failed"
        print(f"[Pipeline Error] {e}")
        import traceback
        traceback.print_exc()

# POST /run
@app.post("/run")
def run_pipeline():
    task_id = str(uuid.uuid4())
    task_status[task_id] = "queued"
    
    # Submit to dedicated pipeline executor (same thread as Playwright initialization)
    _pipeline_executor.submit(run_pipeline_bg, task_id)
    
    return {"task_id": task_id, "status": "started"}


@app.post("/pipeline/skip")
def skip_current_rfp():
    """
    Skip the current RFP and re-run the pipeline with the next best RFP.
    
    Loop Infrastructure:
    1. Get current RFP ID from master output
    2. Add it to skipped_rfp_ids list
    3. Clear current agent outputs (master, technical, pricing, compliance, proposal)
    4. Re-invoke pipeline to process next best RFP
    """
    try:
        # Get current RFP ID from master output
        master_output = get_master_output()
        current_rfp_id = None
        
        if master_output and "technical_summary" in master_output:
            rfp_context = master_output.get("technical_summary", {}).get("rfp_context", {})
            current_rfp_id = rfp_context.get("rfp_id")
        
        if not current_rfp_id:
            # Fallback: try to get from sales output
            sales_output = get_sales_output()
            if sales_output and len(sales_output) > 0:
                # If we have multiple RFPs, we need to find which one was selected
                # For now, just skip the first one if master_output doesn't exist yet
                current_rfp_id = sales_output[0].get("rfp_id")
        
        if not current_rfp_id:
            return {
                "status": "error",
                "message": "No current RFP found to skip. Please run the pipeline first."
            }
        
        print(f"[Pipeline Skip] Skipping RFP: {current_rfp_id}")
        
        # Add to skipped list
        add_skipped_rfp_id(current_rfp_id)
        
        # Clear current agent outputs (but keep sales_output and skipped_rfp_ids)
        save_master_output({})
        save_technical_output({})
        save_pricing_output({})
        save_compliance_output([])
        save_proposal_output("")
        
        print(f"[Pipeline Skip] Cleared agent outputs, re-running pipeline...")
        
        # Create a new task and re-run the pipeline in skip mode
        task_id = str(uuid.uuid4())
        task_status[task_id] = "queued"
        
        # Submit to pipeline executor to pick next best RFP (skip_mode=True to reuse sales data)
        _pipeline_executor.submit(run_pipeline_bg, task_id, skip_mode=True)
        
        return {
            "status": "success",
            "message": f"RFP {current_rfp_id} skipped. Processing next best RFP...",
            "skipped_rfp_id": current_rfp_id,
            "task_id": task_id
        }
        
    except Exception as e:
        print(f"[Pipeline Skip Error] {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "message": f"Failed to skip RFP: {str(e)}"
        }


class GmailRfpEvent(BaseModel):
    # New schema (preferred)
    message_id: Optional[str] = None
    sender: str
    subject: str
    body_text: Optional[str] = ""
    snippet: Optional[str] = ""
    received_timestamp: Optional[str] = None

    # Backward-compatible fields from older listener payloads
    timestamp: Optional[str] = None


@app.post("/integrations/gmail/rfp-event")
def ingest_gmail_rfp_event(event: GmailRfpEvent):
    from datetime import datetime, timezone
    # Store raw email (deduped) + create a notification. Do NOT trigger agents.
    if not event.received_timestamp and not event.timestamp:
        # If no timestamp provided, use current UTC time
        received_ts = datetime.now(timezone.utc).isoformat()
    else:
        received_ts = event.received_timestamp or event.timestamp
    
    body_text = event.body_text or ""
    snippet = event.snippet or ""
    
    print(f"[Gmail Ingest] Received email: '{event.subject}' from {event.sender}")
    print(f"[Gmail Ingest] Timestamp: {received_ts}")

    message_id = (event.message_id or "").strip()
    if not message_id:
        basis = f"{event.sender}|{event.subject}|{received_ts}|{body_text}"
        message_id = "legacy-" + hashlib.md5(basis.encode("utf-8", errors="ignore")).hexdigest()[:16]

    raw_email = {
        "message_id": message_id,
        "sender": event.sender,
        "subject": event.subject,
        "body_text": body_text,
        "snippet": snippet,
        "received_timestamp": received_ts,
    }

    inserted = add_gmail_email(raw_email)
    print(f"[Gmail Ingest] Stored in backend: {inserted} (False if duplicate)")
    if inserted:
        # Minimal notification schema for UI - store full body for View More
        notif = {
            "id": str(uuid.uuid4()),
            "type": "discovery",
            "title": event.subject if event.subject else "No Subject",
            "description": f"From: {event.sender}",
            "body": body_text,
            "snippet": snippet,
            "received_timestamp": received_ts,
            "read": False,
            "source": "gmail",
            "message_id": message_id,
        }
        add_notification(notif)
    return {"status": "ok", "inserted": inserted}


@app.get("/notifications")
def get_notifications():
    # Return newest first
    notifs = list_notifications()
    def _ts(n: Dict[str, Any]):
        return str(n.get("received_timestamp") or "")
    notifs.sort(key=_ts, reverse=True)
    return notifs

@app.delete("/notifications")
def clear_all_notifications():
    """Clear all notifications"""
    clear_notifications()
    return {"status": "cleared"}

@app.delete("/gmail-data")
def reset_gmail_data():
    """Clear all Gmail emails, processed IDs, and notifications (useful for testing)"""
    clear_gmail_data()
    return {"status": "cleared", "message": "All Gmail data and notifications cleared"}

# GET /run/status/{task_id}
@app.get("/run/status/{task_id}")
def get_run_status(task_id: str):
    return {"task_id": task_id, "status": task_status.get(task_id, "unknown")}

# DELETE /rfps
@app.delete("/rfps")
def clear_rfps():
    clear_all()
    return {"status": "cleared"}

# SALES
@app.get("/rfps")
def list_rfps():
    return get_sales_output()

@app.get("/rfps/{rfp_id:path}")
def get_rfp_details(rfp_id: str):
    sales = get_sales_output()
    for rfp in sales:
        if str(rfp.get("rfp_id")) == rfp_id:
            return rfp
    return {"error": f"RFP {rfp_id} not found"}

# MASTER
@app.get("/master/output")
def get_master():
    return get_master_output()

# TECHNICAL
@app.get("/technical/output")
def get_technical():
    return get_technical_output()

@app.get("/technical/debug")
def debug_technical():
    """Debug endpoint to see raw technical output structure"""
    technical = get_technical_output()
    
    if not technical:
        return {"error": "No technical data available"}
    
    # Return structure info
    result = {
        "has_data": bool(technical),
        "keys": list(technical.keys()) if isinstance(technical, dict) else [],
        "items_count": len(technical.get("items", [])) if isinstance(technical, dict) else 0,
    }
    
    # Show first item structure
    if isinstance(technical, dict) and technical.get("items"):
        items = technical["items"]
        if len(items) > 0:
            first_item = items[0]
            result["first_item_keys"] = list(first_item.keys()) if isinstance(first_item, dict) else []
            result["first_item_sample"] = first_item
            
            # Check for best_match structure
            if "best_match" in first_item:
                best_match = first_item["best_match"]
                result["best_match_keys"] = list(best_match.keys()) if isinstance(best_match, dict) else type(best_match).__name__
                result["best_match_sample"] = best_match
    
    return result

@app.get("/api/proposal/debug-ppt-placeholders")
def debug_ppt_placeholders():
    """Debug endpoint to extract ALL text and placeholders from the PPT template"""
    if not PPT_AVAILABLE:
        return {"error": "python-pptx not available"}
    
    try:
        template_path = ensure_ppt_template()
        prs = Presentation(str(template_path))
        
        slides_info = []
        all_placeholders_found = set()
        
        for slide_idx, slide in enumerate(prs.slides, 1):
            slide_info = {
                "slide_number": slide_idx,
                "shapes": [],
                "all_text": []
            }
            
            for shape in _iter_slide_shapes(slide):
                if getattr(shape, "has_text_frame", False):
                    text = shape.text_frame.text
                    if text and len(text.strip()) > 0:
                        slide_info["all_text"].append(text)
                        
                        # Find all {{...}} patterns
                        import re
                        placeholders = re.findall(r'\{\{[A-Z_]+\}\}', text)
                        if placeholders:
                            slide_info["shapes"].append({
                                "text": text[:200],  # First 200 chars
                                "placeholders": placeholders
                            })
                            all_placeholders_found.update(placeholders)
            
            slides_info.append(slide_info)
        
        return {
            "total_slides": len(prs.slides),
            "all_placeholders_found": sorted(list(all_placeholders_found)),
            "slides": slides_info
        }
    except Exception as e:
        return {"error": str(e)}

# PRICING
@app.get("/pricing/output")
def get_pricing():
    return get_pricing_output()

@app.get("/pricing/totals")
def get_pricing_totals():
    pricing = get_pricing_output()
    return {
        "material_total": pricing.get("material_total", 0),
        "testing_total": pricing.get("testing_total", 0),
        "grand_total": pricing.get("grand_total", 0)
    }

# COMPLIANCE
@app.get("/compliance")
def get_compliance():
    return get_compliance_output()

# PROPOSAL
@app.get("/proposal")
def get_proposal():
    return {"proposal": get_proposal_output()}

@app.get("/api/proposal/export-ppt/{rfp_id:path}")
def export_proposal_ppt(rfp_id: str):
    """
    Export RFP proposal as PowerPoint presentation using professional rfp_master_template.pptx
    with advanced placeholder mapping from master_output, pricing_output, technical_output, and proposal_output.
    """
    if not PPT_AVAILABLE:
        return {
            "status": "error",
            "message": "PowerPoint export not available. Install python-pptx."
        }
    
    try:
        # Fetch data from existing getters
        master = get_master_output() or {}
        pricing = get_pricing_output() or {}
        technical = get_technical_output() or {}
        proposal_text = get_proposal_output() or ""
        
        print(f"\n[PPT Export] Starting export for RFP: {rfp_id}")
        print(f"[PPT Export] Data available - Master: {bool(master)}, Pricing: {bool(pricing)}, Technical: {bool(technical)}, Proposal: {bool(proposal_text)}")
        
        # Extract nested structures safely
        selected = master.get("selected_rfp", {}) or {}
        summaries_tech = (master.get("summaries", {}) or {}).get("technical", {}) or {}
        
        # ============================================================================
        # CLIENT INFORMATION - Extract buyer and RFP ID
        # ============================================================================
        buyer_name = str(selected.get("buyer") or summaries_tech.get("buyer") or "").strip() or "the Client"
        bid_id = str(selected.get("rfp_id") or summaries_tech.get("rfp_id") or rfp_id or "").strip()
        
        print(f"[PPT Export] Client: {buyer_name}, Bid ID: {bid_id}")
        
        # ============================================================================
        # DOMAIN - Extract from technical output or selected RFP
        # ============================================================================
        domain = str(technical.get("domain") if isinstance(technical, dict) else "").strip()
        if not domain:
            domain = str(selected.get("domain") or selected.get("category") or "Project").strip()
        
        print(f"[PPT Export] Domain: {domain}")
        
        # ============================================================================
        # PRICING - Extract and format with INR currency
        # ============================================================================
        grand_total = pricing.get("grand_total", 0)
        material_total = pricing.get("material_total", 0)
        testing_total = pricing.get("testing_total", 0)
        
        # Fallback: calculate grand total if not provided
        if _safe_number(grand_total, 0.0) <= 0:
            grand_total = material_total + testing_total
        
        grand_total_text = _format_inr(grand_total)
        material_cost_text = _format_inr(material_total)
        testing_cost_text = _format_inr(testing_total)
        
        print(f"[PPT Export] Pricing - Material: {material_cost_text}, Testing: {testing_cost_text}, Total: {grand_total_text}")
        
        # ============================================================================
        # EXECUTIVE SUMMARY - Extract first substantial paragraph from proposal
        # ============================================================================
        executive_summary = ""
        if proposal_text:
            paragraphs = [p.strip() for p in proposal_text.split('\n\n') if p.strip()]
            if paragraphs:
                # Find first paragraph with substantial content (>50 chars)
                for para in paragraphs[:5]:
                    if len(para) > 50 and not para.startswith('#'):
                        executive_summary = para
                        break
                if not executive_summary and paragraphs:
                    executive_summary = paragraphs[0]
        
        if not executive_summary:
            executive_summary = f"This proposal addresses the {domain} requirements for {buyer_name} under {bid_id}. Our technical evaluation demonstrates comprehensive compliance with all specified requirements."
        
        # Limit executive summary to reasonable length for slide
        if len(executive_summary) > 500:
            executive_summary = executive_summary[:497] + "..."
        
        print(f"[PPT Export] Executive Summary: {executive_summary[:80]}...")
        
        # ============================================================================
        # TECHNICAL METRICS - Extract from technical output
        # ============================================================================
        tech_items = (technical.get("items") or []) if isinstance(technical, dict) else []
        total_items = len(tech_items)
        
        print(f"[PPT Export] Technical items count: {total_items}")
        
        # Debug: Show structure of first item to understand data format
        if tech_items and len(tech_items) > 0:
            print(f"[PPT Export Debug] First item structure: {list(tech_items[0].keys())}")
            if "best_match" in tech_items[0]:
                print(f"[PPT Export Debug] best_match keys: {list(tech_items[0]['best_match'].keys()) if isinstance(tech_items[0]['best_match'], dict) else type(tech_items[0]['best_match'])}")
        
        # Calculate average spec match percentage across all items
        # Try multiple extraction paths for robustness
        average_spec_match = 0.0
        if tech_items:
            match_percentages = []
            for idx, item in enumerate(tech_items):
                if isinstance(item, dict):
                    match_pct = None
                    
                    # Path 1: Direct item.spec_match_percent (PRIORITY - as seen in debug)
                    match_pct = item.get("spec_match_percent")
                    
                    # Path 2: item.match_percentage
                    if match_pct is None:
                        match_pct = item.get("match_percentage")
                    
                    # Path 3: item.match_score (might be 0-1 scale)
                    if match_pct is None:
                        match_score = item.get("match_score")
                        if match_score is not None:
                            match_pct = _safe_number(match_score, 0.0) * 100  # Convert to percentage
                    
                    # Path 4: best_match.spec_match_percent (nested - fallback only)
                    if match_pct is None:
                        best_match = item.get("best_match", {})
                        if isinstance(best_match, dict):
                            match_pct = best_match.get("spec_match_percent")
                            if match_pct is None:
                                match_pct = best_match.get("match_percentage")  # Alternative field name
                            
                            # Path 5: best_match.score (might be 0-1 scale)
                            if match_pct is None:
                                match_score = best_match.get("score")
                                if match_score is not None:
                                    match_pct = _safe_number(match_score, 0.0) * 100
                    
                    if match_pct is not None:
                        pct_value = _safe_number(match_pct, 0.0)
                        match_percentages.append(pct_value)
                        if idx == 0:  # Debug first item
                            print(f"[PPT Export Debug] First item match: {pct_value}%")
                    else:
                        print(f"[PPT Export Debug] Item {idx} has no match percentage data")
            
            if match_percentages:
                average_spec_match = sum(match_percentages) / len(match_percentages)
                print(f"[PPT Export Debug] Calculated from {len(match_percentages)} items with data")
            else:
                # Fallback: Use technical summary if available
                tech_summary = technical.get("summary", {})
                if tech_summary:
                    average_spec_match = _safe_number(tech_summary.get("average_match_percent") or tech_summary.get("success_rate"), 0.0)
                    print(f"[PPT Export Debug] Using summary fallback: {average_spec_match}%")
        
        average_spec_match_text = f"{average_spec_match:.1f}%"
        
        print(f"[PPT Export] Average Spec Match: {average_spec_match_text}")
        
        # ============================================================================
        # SPEC MATRIX - Build detailed SKU matching summary as multi-line string
        # ============================================================================
        spec_matrix_summary = ""
        if tech_items:
            spec_matrix_lines = []
            for idx, item in enumerate(tech_items[:15], 1):  # Top 15 items for detail
                if isinstance(item, dict):
                    # Extract item name - try multiple fields
                    item_name = (item.get("item_name") or 
                               item.get("parameter") or 
                               item.get("description") or 
                               item.get("name") or 
                               f"Item {idx}")
                    
                    # Extract SKU - try direct field first (based on debug: 'best_match_sku')
                    sku = (item.get("best_match_sku") or  # Direct field (as seen in debug)
                          item.get("sku_code") or 
                          item.get("sku") or 
                          item.get("product_code"))
                    
                    # If not found, try nested best_match object
                    if not sku:
                        best_match = item.get("best_match", {})
                        if isinstance(best_match, dict):
                            sku = (best_match.get("sku_code") or 
                                  best_match.get("sku") or 
                                  best_match.get("product_code"))
                    
                    sku = sku or "N/A"
                    
                    # Extract match percentage - direct field first (as seen in debug: 'spec_match_percent')
                    match_pct = item.get("spec_match_percent")
                    
                    # Try other direct fields
                    if match_pct is None:
                        match_pct = (item.get("match_percentage") or
                                   (item.get("match_score", 0) * 100 if item.get("match_score") else None))
                    
                    # Try nested best_match if still not found
                    if match_pct is None:
                        best_match = item.get("best_match", {})
                        if isinstance(best_match, dict):
                            match_pct = (best_match.get("spec_match_percent") or 
                                       best_match.get("match_percentage") or 
                                       (best_match.get("score", 0) * 100 if best_match.get("score") else None))
                    
                    match_pct = _safe_number(match_pct, 0)
                    
                    # Format: "1. Cable 1.5mm² → SKU_ABC123 (92% Match)"
                    spec_matrix_lines.append(f"{idx}. {item_name[:40]} → {sku} ({match_pct:.0f}% Match)")
                    
                    if idx == 1:  # Debug first item
                        print(f"[PPT Export Debug] First SPEC_MATRIX line: {item_name[:40]} → {sku} ({match_pct:.0f}%)")
            
            spec_matrix_summary = "\n".join(spec_matrix_lines)
            print(f"[PPT Export] SPEC_MATRIX built with {len(spec_matrix_lines)} items")
        
        if not spec_matrix_summary:
            spec_matrix_summary = f"Technical evaluation complete for {total_items} line items.\nComprehensive SKU matching analysis performed."
        
        # ============================================================================
        # SUBMISSION DATE - Extract deadline from selected RFP
        # ============================================================================
        submission_date_raw = (selected.get("submission_deadline") or summaries_tech.get("deadline") or "")
        submission_date = str(submission_date_raw).strip() if submission_date_raw else "To be confirmed"
        
        print(f"[PPT Export] Submission Date: {submission_date}")
        
        # ============================================================================
        # ESTIMATED VALUE - Format project value with INR currency
        # ============================================================================
        est_value_raw = selected.get("estimated_project_value") or ""
        est_value = _format_inr_from_any(est_value_raw) if est_value_raw else "To be confirmed"
        
        print(f"[PPT Export] Estimated Value: {est_value}")
        
        # ============================================================================
        # CONFIDENCE & RISK ANALYSIS - Calculate based on spec match percentages
        # ============================================================================
        tech_summary = technical.get("summary") if isinstance(technical, dict) else {}
        success_rate = _safe_number((tech_summary or {}).get("success_rate"), average_spec_match)
        overall_match_percent = f"{success_rate:.1f}%"
        
        # Confidence level based on average match
        if average_spec_match >= 90.0:
            confidence_level = "High"
        elif average_spec_match >= 75.0:
            confidence_level = "Strong"
        elif average_spec_match >= 60.0:
            confidence_level = "Moderate"
        else:
            confidence_level = "Needs Review"
        
        # Overall risk rating based on success rate
        if success_rate >= 85.0:
            overall_risk_rating = "Low"
        elif success_rate >= 70.0:
            overall_risk_rating = "Moderate"
        else:
            overall_risk_rating = "High"
        
        print(f"[PPT Export] Confidence: {confidence_level}, Risk: {overall_risk_rating}")
        
        # ============================================================================
        # TECHNICAL COMPLIANCE METRICS - Calculate compliance percentages
        # ============================================================================
        compliant_items = 0
        partial_compliant_items = 0
        non_compliant_items = 0
        
        for item in tech_items:
            if isinstance(item, dict):
                # Use direct field first (as seen in debug: 'spec_match_percent')
                match_pct = item.get("spec_match_percent")
                
                # Try other fields if not found
                if match_pct is None:
                    match_pct = (item.get("match_percentage") or
                               (item.get("match_score", 0) * 100 if item.get("match_score") else None))
                
                # Try nested best_match if still not found
                if match_pct is None:
                    best_match = item.get("best_match", {})
                    if isinstance(best_match, dict):
                        match_pct = (best_match.get("spec_match_percent") or 
                                   best_match.get("match_percentage") or 
                                   (best_match.get("score", 0) * 100 if best_match.get("score") else None))
                
                match_pct = _safe_number(match_pct, 0)
                
                if match_pct >= 90.0:
                    compliant_items += 1
                elif match_pct >= 70.0:
                    partial_compliant_items += 1
                else:
                    non_compliant_items += 1
        
        # Calculate compliance percentages
        compliance_rate = (compliant_items / total_items * 100) if total_items > 0 else 0
        partial_compliance_rate = (partial_compliant_items / total_items * 100) if total_items > 0 else 0
        non_compliance_rate = (non_compliant_items / total_items * 100) if total_items > 0 else 0
        
        compliance_rate_text = f"{compliance_rate:.1f}%"
        partial_compliance_rate_text = f"{partial_compliance_rate:.1f}%"
        technical_compliance_score = f"{compliance_rate:.1f}%"
        
        print(f"[PPT Export] Compliance: {compliance_rate_text} Full ({compliant_items} items), {partial_compliance_rate_text} Partial ({partial_compliant_items} items)")
        
        # ============================================================================
        # SPECIFICATION COVERAGE - Calculate coverage metrics
        # ============================================================================
        # Specification coverage is the percentage of RFP requirements we can fulfill
        spec_coverage_percent = average_spec_match  # Use average spec match as coverage
        spec_coverage_text = f"{spec_coverage_percent:.1f}%"
        
        # Items meeting specs (>= 80% match)
        items_meeting_specs = 0
        for item in tech_items:
            if isinstance(item, dict):
                # Use direct field first
                match_pct = item.get("spec_match_percent")
                
                if match_pct is None:
                    match_pct = (item.get("match_percentage") or
                               (item.get("match_score", 0) * 100 if item.get("match_score") else None))
                
                if match_pct is None:
                    best_match = item.get("best_match", {})
                    if isinstance(best_match, dict):
                        match_pct = (best_match.get("spec_match_percent") or 
                                   best_match.get("match_percentage") or 
                                   (best_match.get("score", 0) * 100 if best_match.get("score") else None))
                
                if _safe_number(match_pct, 0) >= 80.0:
                    items_meeting_specs += 1
        
        items_meeting_specs_text = f"{items_meeting_specs}/{total_items}"
        
        print(f"[PPT Export] Spec Coverage: {spec_coverage_text}, Items Meeting Specs: {items_meeting_specs_text}")
        
        # ============================================================================
        # DELIVERY TIMELINE - Extract from master output
        # ============================================================================
        delivery_timeline = master.get("delivery_timeline", "Standard delivery: 6-8 weeks")
        if isinstance(delivery_timeline, dict):
            delivery_timeline = delivery_timeline.get("description", "Standard delivery: 6-8 weeks")
        delivery_timeline = str(delivery_timeline)
        
        print(f"[PPT Export] Delivery Timeline: {delivery_timeline}")
        
        # Priority level
        priority_level = str(selected.get("priority") or "").strip() or "Medium"
        
        # ============================================================================
        # ENHANCED PRICING WITH MARGINS & DISCOUNTS - Get complete breakdown
        # ============================================================================
        # Extract additional pricing components (margins, discounts, etc.)
        margin_percent = pricing.get("margin_percent", 15)  # Default 15%
        discount_percent = pricing.get("discount_percent", 0)  # Default 0%
        
        # Calculate base pricing
        base_subtotal = material_total + testing_total
        
        # Apply margin
        margin_amount = base_subtotal * (margin_percent / 100)
        subtotal_with_margin = base_subtotal + margin_amount
        
        # Apply discount
        discount_amount = subtotal_with_margin * (discount_percent / 100)
        final_total = subtotal_with_margin - discount_amount
        
        # Use the grand_total from pricing if it exists, otherwise use calculated
        if grand_total > 0:
            final_total = grand_total
        
        # Format all pricing components
        base_subtotal_text = _format_inr(base_subtotal)
        margin_text = f"{margin_percent}% (₹{_format_inr(margin_amount)[1:]})"  # Remove ₹ prefix
        discount_text = f"{discount_percent}% (₹{_format_inr(discount_amount)[1:]})" if discount_percent > 0 else "0%"
        final_total_text = _format_inr(final_total)
        
        print(f"[PPT Export] Enhanced Pricing - Base: {base_subtotal_text}, Margin: {margin_text}, Discount: {discount_text}, Final: {final_total_text}")
        
        # ============================================================================
        # COST BREAKDOWN FOR VISUAL BAR CHART - Prepare data for charts
        # ============================================================================
        # Calculate percentage breakdown for visual representation
        total_for_percentage = base_subtotal if base_subtotal > 0 else 1
        material_percentage = (material_total / total_for_percentage * 100) if total_for_percentage > 0 else 50
        testing_percentage = (testing_total / total_for_percentage * 100) if total_for_percentage > 0 else 50
        
        # Build cost breakdown text for {{COST_BREAKDOWN}}
        cost_breakdown_text = f"Materials: {material_percentage:.1f}% ({material_cost_text})\nTesting: {testing_percentage:.1f}% ({testing_cost_text})"
        
        # Build ULTRA COMPACT cost bar visual for {{COST_BAR_VISUAL}} - must fit in slide
        # Simplified version with only essential info
        cost_bar_visual = f"""Materials: {material_cost_text} ({material_percentage:.0f}%)
Testing: {testing_cost_text} ({testing_percentage:.0f}%)
―――――――――――――――
Subtotal: {base_subtotal_text}
TOTAL: {final_total_text}"""
        
        print(f"[PPT Export] Cost bar visual prepared (ultra-compact, {len(cost_bar_visual)} chars)")
        
        # ============================================================================
        # RISKS AND ASSUMPTIONS - Generate from master output and technical data
        # ============================================================================
        risks_list = []
        assumptions_list = []
        
        # Extract risks from master output if available
        master_risks = master.get("risks", [])
        if isinstance(master_risks, list) and master_risks:
            risks_list.extend(master_risks[:5])  # Max 5 risks
        
        # Generate default risks based on data
        if not risks_list:
            if average_spec_match < 80:
                risks_list.append(f"• Technical specifications match at {average_spec_match:.1f}% - may require product modifications")
            
            if delivery_timeline and "week" in delivery_timeline.lower():
                risks_list.append(f"• Delivery timeline of {delivery_timeline} may be impacted by supply chain factors")
            
            if total_items > 50:
                risks_list.append(f"• Large order size ({total_items} items) requires careful inventory management")
            
            risks_list.append("• Regulatory compliance requirements may change during project execution")
            risks_list.append("• Raw material price fluctuations may impact final costs")
        
        # Ensure all risk items start with bullet point
        risks_list = [risk if risk.startswith("•") else f"• {risk}" for risk in risks_list]
        
        # Extract assumptions from master output if available
        master_assumptions = master.get("assumptions", [])
        if isinstance(master_assumptions, list) and master_assumptions:
            assumptions_list.extend(master_assumptions[:5])
        
        # Generate default assumptions based on data
        if not assumptions_list:
            assumptions_list.append(f"• All {total_items} line items are in stock or can be manufactured within timeline")
            assumptions_list.append("• Technical specifications provided in RFP are final and complete")
            assumptions_list.append("• Payment terms as per standard 30-60-90 day NET payment schedule")
            assumptions_list.append("• Buyer will provide timely approvals and site access for delivery")
            assumptions_list.append("• Testing will be conducted at our facility unless otherwise specified")
        
        # Ensure all assumption items start with bullet point
        assumptions_list = [asmp if asmp.startswith("•") else f"• {asmp}" for asmp in assumptions_list]
        
        # Format as text blocks - single-column versions for fallback placeholders
        risks_text = "\n".join(risks_list[:5]) if risks_list else "• Standard commercial risks apply\n• Mitigation strategies in place"
        assumptions_text = "\n".join(assumptions_list[:5]) if assumptions_list else "• Standard terms and conditions apply"
        
        # Combined version (used only for fallback placeholders; {{RISK_LIST}} is handled via two-column post-processing)
        combined_risk_assumptions = f"""RISKS:\n{risks_text}\n\nASSUMPTIONS:\n{assumptions_text}"""
        
        print(f"[PPT Export] Risks: {len(risks_list)} items, Assumptions: {len(assumptions_list)} items")
        print(f"[PPT Export Debug] First risk: {risks_list[0][:60] if risks_list else 'None'}...")
        print(f"[PPT Export Debug] Two-column layout will be applied via post-processing")


        
        # ============================================================================
        # BUILD REPLACEMENTS DICTIONARY - Map all placeholders to live data
        # ============================================================================
        replacements = {
            # Client Information
            "{{CLIENT_NAME}}": buyer_name,
            "{{BUYER_NAME}}": buyer_name,
            "{{BID_ID}}": bid_id,
            "{{RFP_ID}}": bid_id,
            
            # Executive Summary
            "{{EXECUTIVE_SUMMARY}}": executive_summary,
            
            # Domain and Technical Details
            "{{DOMAIN}}": domain,
            "{{TOTAL_ITEMS}}": str(total_items),
            "{{AVERAGE_SPEC_MATCH}}": average_spec_match_text,
            "{{OVERALL_MATCH_PERCENT}}": overall_match_percent,
            "{{CONFIDENCE_LEVEL}}": confidence_level,
            "{{OVERALL_RISK_RATING}}": overall_risk_rating,
            
            # Technical Compliance Metrics (NEW)
            "{{TECHNICAL_COMPLIANCE_SCORE}}": technical_compliance_score,
            "{{TECHNICAL_COMPLIANCE}}": technical_compliance_score,  # Alternative
            "{{COMPLIANCE_RATE}}": compliance_rate_text,
            "{{COMPLIANCE_SCORE}}": compliance_rate_text,  # Alternative
            "{{COMPLIANT_ITEMS}}": str(compliant_items),
            "{{PARTIAL_COMPLIANT_ITEMS}}": str(partial_compliant_items),
            "{{NON_COMPLIANT_ITEMS}}": str(non_compliant_items),
            "{{FULLY_COMPLIANT}}": str(compliant_items),  # Alternative
            "{{PARTIALLY_COMPLIANT}}": str(partial_compliant_items),  # Alternative
            
            # Specification Coverage Metrics (NEW)
            "{{SPEC_COVERAGE}}": spec_coverage_text,
            "{{SPECIFICATION_COVERAGE}}": spec_coverage_text,
            "{{COVERAGE_PERCENT}}": spec_coverage_text,  # Alternative
            "{{ITEMS_MEETING_SPECS}}": items_meeting_specs_text,
            "{{SPEC_MATCH_RATE}}": average_spec_match_text,  # Alternative placeholder
            "{{MATCHING_ITEMS}}": items_meeting_specs_text,  # Alternative
            
            # Basic Pricing
            "{{MATERIAL_COST}}": material_cost_text,
            "{{MATERIALS_COST}}": material_cost_text,  # Alternative
            "{{TESTING_COST}}": testing_cost_text,
            "{{TESTS_COST}}": testing_cost_text,  # Alternative
            "{{GRAND_TOTAL}}": final_total_text,  # Updated to use final_total with margins/discounts
            "{{TOTAL_COST}}": final_total_text,  # Alternative
            "{{EST_VALUE}}": est_value,
            "{{ESTIMATED_VALUE}}": est_value,  # Alternative
            
            # Enhanced Pricing with Margins & Discounts (NEW)
            "{{BASE_SUBTOTAL}}": base_subtotal_text,
            "{{SUBTOTAL}}": base_subtotal_text,  # Alternative placeholder
            "{{BASE_COST}}": base_subtotal_text,  # Alternative
            "{{MARGIN}}": margin_text,
            "{{MARGIN_PERCENT}}": f"{margin_percent}%",
            "{{DISCOUNT}}": discount_text,
            "{{DISCOUNT_PERCENT}}": f"{discount_percent}%",
            "{{FINAL_TOTAL}}": final_total_text,
            "{{TOTAL_PRICE}}": final_total_text,  # Alternative
            
            # Cost Breakdown for Visuals (NEW)
            "{{COST_BREAKDOWN}}": cost_breakdown_text,
            "{{MATERIAL_PERCENTAGE}}": f"{material_percentage:.1f}%",
            "{{TESTING_PERCENTAGE}}": f"{testing_percentage:.1f}%",
            "{{MATERIALS_PERCENT}}": f"{material_percentage:.1f}%",  # Alternative
            "{{TESTS_PERCENT}}": f"{testing_percentage:.1f}%",  # Alternative
            
            # Compliance Matrix (multi-line string with SKU matches)
            "{{SPEC_MATRIX}}": spec_matrix_summary,
            "{{SKU_MATRIX}}": spec_matrix_summary,  # Alternative
            "{{TECHNICAL_MATRIX}}": spec_matrix_summary,  # Alternative
            "{{MATCHING_DETAILS}}": spec_matrix_summary,  # Alternative
            
            # Timeline & Dates
            "{{SUBMISSION_DATE}}": submission_date,
            "{{DEADLINE}}": submission_date,  # Alternative
            "{{DELIVERY_TIMELINE}}": delivery_timeline,
            "{{DELIVERY_SCHEDULE}}": delivery_timeline,  # Alternative
            "{{TIMELINE}}": delivery_timeline,  # Alternative
            
            # Risks and Assumptions - Multiple alternatives for template flexibility
            "{{RISKS}}": risks_text,
            "{{RISK_FACTORS}}": risks_text,
            "{{KEY_RISKS}}": risks_text,
            "{{PROJECT_RISKS}}": risks_text,
            "{{RISK_ANALYSIS}}": risks_text,
            "{{RISK_ASSESSMENT}}": risks_text,
            
            "{{ASSUMPTIONS}}": assumptions_text,
            "{{KEY_ASSUMPTIONS}}": assumptions_text,
            "{{PROJECT_ASSUMPTIONS}}": assumptions_text,
            "{{ASSUMPTION_LIST}}": assumptions_text,
            "{{ASSUMPTIONS_LIST}}": assumptions_text,
            
            # Additional Metadata
            "{{PRIORITY_LEVEL}}": priority_level,
            "{{PRIORITY}}": priority_level,  # Alternative
            
            # Phase delivery (common in templates)
            "{{PHASE_1}}": "Phase 1 – Engineering & Planning (2 Weeks)",
            "{{PHASE_2}}": "Phase 2 – Manufacturing (4–6 Weeks)",
            "{{PHASE_3}}": "Phase 3 – Testing & QA (1 Week)",
            "{{PHASE_4}}": "Phase 4 – Dispatch & Delivery (1–2 Weeks)",
            
            # Additional technical metrics for various slide formats
            "{{SUCCESS_RATE}}": f"{success_rate:.1f}%",
            "{{ITEMS_COUNT}}": str(total_items),
            "{{MATCHED_ITEMS}}": str(items_meeting_specs),
            "{{ITEM_COUNT}}": str(total_items),  # Alternative
        }
        
        print(f"[PPT Export] Built replacements dictionary with {len(replacements)} placeholders:")
        for key, value in list(replacements.items())[:8]:
            value_preview = str(value)[:50] + "..." if len(str(value)) > 50 else str(value)
            print(f"  {key} = {value_preview}")
        
        # Add common chart/visual data placeholders that might be separate
        # Some templates use these for embedding chart data
        visual_data_placeholders = {
            # **CRITICAL**: {{COST_BAR_VISUAL}} found in template Slide 5
            "{{COST_BAR_VISUAL}}": cost_bar_visual,
            
            # **CRITICAL**: {{OVERALL_RISK_BADGE}} found in template Slide 6
            "{{OVERALL_RISK_BADGE}}": overall_risk_rating,
            
            # NOTE: {{RISK_LIST}} is handled separately below with two-column layout
            # "{{RISK_LIST}}": combined_risk_assumptions,  # DO NOT include here
            
            # Cost breakdown as separate values
            "{{MATERIALS_VALUE}}": material_cost_text,
            "{{TESTING_VALUE}}": testing_cost_text,
            "{{MATERIALS_PCT}}": f"{material_percentage:.1f}",  # Without % symbol
            "{{TESTING_PCT}}": f"{testing_percentage:.1f}",  # Without % symbol
            
            # Risk items as separate lines (some templates split them)
            "{{RISK_1}}": risks_list[0] if len(risks_list) > 0 else "Standard commercial risks",
            "{{RISK_2}}": risks_list[1] if len(risks_list) > 1 else "",
            "{{RISK_3}}": risks_list[2] if len(risks_list) > 2 else "",
            "{{RISK_4}}": risks_list[3] if len(risks_list) > 3 else "",
            "{{RISK_5}}": risks_list[4] if len(risks_list) > 4 else "",
            
            # Assumption items as separate lines
            "{{ASSUMPTION_1}}": assumptions_list[0] if len(assumptions_list) > 0 else "Standard terms apply",
            "{{ASSUMPTION_2}}": assumptions_list[1] if len(assumptions_list) > 1 else "",
            "{{ASSUMPTION_3}}": assumptions_list[2] if len(assumptions_list) > 2 else "",
            "{{ASSUMPTION_4}}": assumptions_list[3] if len(assumptions_list) > 3 else "",
            "{{ASSUMPTION_5}}": assumptions_list[4] if len(assumptions_list) > 4 else "",
            
            # Common alternative naming patterns
            "{{ASSUMPTION_TEXT}}": assumptions_text,
            "{{RISKS_TEXT}}": risks_text,
            "{{RISK_ITEMS}}": risks_text,
            "{{ASSUMPTION_ITEMS}}": assumptions_text,
        }
        
        # Merge visual data placeholders
        replacements.update(visual_data_placeholders)
        
        print(f"[PPT Export] Added {len(visual_data_placeholders)} additional visual/data placeholders (including COST_BAR_VISUAL and OVERALL_RISK_BADGE)")
        
        # ============================================================================
        # LOAD TEMPLATE AND REPLACE PLACEHOLDERS
        # ============================================================================
        template_path = ensure_ppt_template()
        print(f"[PPT Export] Loading template from: {template_path}")
        
        prs = Presentation(str(template_path))
        print(f"[PPT Export] Template loaded - {len(prs.slides)} slides found")
        
        # Replace placeholders in ALL shapes across ALL slides
        replacements_made = 0
        slides_processed = 0
        placeholder_matches = {}  # Track which placeholders were found
        slides_with_no_replacements = []  # Track empty slides
        
        for slide_idx, slide in enumerate(prs.slides, 1):
            slide_replacements = 0
            slide_text_samples = []  # Collect text from this slide for debugging
            
            for shape in _iter_slide_shapes(slide):
                # Replace in text frames
                if getattr(shape, "has_text_frame", False):
                    text_before = shape.text_frame.text
                    
                    # Collect sample text for debugging (first 100 chars)
                    if text_before and len(text_before.strip()) > 0:
                        slide_text_samples.append(text_before[:100])
                    
                    # Track which placeholders are present before replacement
                    for key in replacements.keys():
                        if key in text_before:
                            if key not in placeholder_matches:
                                placeholder_matches[key] = []
                            placeholder_matches[key].append(f"Slide {slide_idx}")
                    
                    _replace_placeholders_in_text_frame(
                        shape.text_frame, 
                        {k: str(v) for k, v in replacements.items()}
                    )
                    
                    if text_before != shape.text_frame.text:
                        replacements_made += 1
                        slide_replacements += 1
                
                # Replace in table cells
                if getattr(shape, "has_table", False):
                    _replace_placeholders_in_table_cells(shape, replacements)
                    slide_replacements += 1
            
            if slide_replacements > 0:
                slides_processed += 1
                print(f"[PPT Export] Slide {slide_idx}: {slide_replacements} replacements")
            else:
                # Slide with no replacements - show sample text
                slides_with_no_replacements.append(slide_idx)
                if slide_text_samples:
                    print(f"[PPT Export] Slide {slide_idx}: NO replacements. Sample text: {slide_text_samples[0][:60]}...")
                else:
                    print(f"[PPT Export] Slide {slide_idx}: NO replacements. (Empty slide or no text)")
        
        print(f"[PPT Export] Processed {len(prs.slides)} slides, made {replacements_made} replacements across {slides_processed} slides")
        
        # Show which placeholders were actually found in the template
        if placeholder_matches:
            print(f"[PPT Export] Placeholders found in template:")
            for key, locations in list(placeholder_matches.items())[:20]:  # Show first 20
                print(f"  {key}: {', '.join(locations)}")
            
            # Highlight critical placeholders
            critical_found = []
            critical_missing = []
            critical_placeholders = ["{{COST_BAR_VISUAL}}", "{{OVERALL_RISK_BADGE}}", "{{RISK_LIST}}"]
            
            for cp in critical_placeholders:
                if cp in placeholder_matches:
                    critical_found.append(cp)
                else:
                    critical_missing.append(cp)
            
            if critical_found:
                print(f"[PPT Export] ✅ Critical placeholders found: {', '.join(critical_found)}")
            if critical_missing:
                print(f"[PPT Export] ⚠️ Critical placeholders NOT found in template: {', '.join(critical_missing)}")
        else:
            print(f"[PPT Export] ⚠️ WARNING: No placeholders found in template! Check placeholder format.")
        
        # Alert about slides with no replacements
        if slides_with_no_replacements:
            print(f"[PPT Export] ⚠️ Slides with no placeholders: {', '.join(map(str, slides_with_no_replacements))}")
        
        # ============================================================================
        # POST-PROCESS: Split {{RISK_LIST}} into two real columns on Slide 6
        # ============================================================================
        if PPT_AVAILABLE:
            from pptx.util import Inches, Pt, Emu
            from pptx.dml.color import RGBColor
            import copy, lxml.etree as etree
            
            # Slide index 5 = Slide 6 (0-based)
            risk_slide_idx = None
            risk_shape = None
            
            # Scan all slides to find the one with {{RISK_LIST}}
            for si, sl in enumerate(prs.slides):
                for sh in _iter_slide_shapes(sl):
                    if getattr(sh, "has_text_frame", False) and "{{RISK_LIST}}" in (sh.text_frame.text or ""):
                        risk_slide_idx = si
                        risk_shape = sh
                        break
                if risk_shape:
                    break
            
            if risk_shape and risk_slide_idx is not None:
                risk_slide = prs.slides[risk_slide_idx]
                slide_width = prs.slide_width   # e.g. 9144000 EMU for widescreen
                slide_height = prs.slide_height
                
                # Get original shape bounds
                orig_left = risk_shape.left
                orig_top = risk_shape.top
                orig_height = risk_shape.height
                
                # Each column takes ~half the slide width with a small gap
                col_margin = int(slide_width * 0.03)   # 3% gap between columns
                left_start = orig_left
                col_width = (slide_width - left_start - col_margin) // 2
                
                # ---- LEFT COLUMN: RISKS ----
                # Reuse the existing shape for risks
                risk_shape.width = col_width
                risk_shape.left = left_start
                # Clear and write only risks
                tf_risks = risk_shape.text_frame
                tf_risks.word_wrap = True
                # Build paragraph list: header + items
                risks_lines = ["RISKS:"] + risks_list[:5]
                from pptx.util import Pt
                for pi, para in enumerate(tf_risks.paragraphs):
                    if pi < len(risks_lines):
                        if para.runs:
                            para.runs[0].text = risks_lines[pi]
                            for r in para.runs[1:]:
                                r.text = ""
                        else:
                            run = para.add_run()
                            run.text = risks_lines[pi]
                    else:
                        if para.runs:
                            para.runs[0].text = ""
                            for r in para.runs[1:]:
                                r.text = ""
                # If template has fewer paragraphs than content, append new ones
                existing_para_count = len(tf_risks.paragraphs)
                for extra_idx in range(existing_para_count, len(risks_lines)):
                    p = tf_risks.add_paragraph()
                    p.text = risks_lines[extra_idx]
                
                # ---- RIGHT COLUMN: ASSUMPTIONS ----
                # Deep-copy the shape XML to create a duplicate for assumptions
                sp_xml = risk_shape._element
                new_sp = copy.deepcopy(sp_xml)
                risk_slide.shapes._spTree.append(new_sp)
                
                # Get reference to newly added shape (last shape)
                from pptx.shapes.base import BaseShape
                new_shape_elem = risk_slide.shapes._spTree[-1]
                # Wrap with pptx shape object
                from pptx.shapes.shapetree import SlideShapes
                # Access via slide shapes list (newly added is last)
                new_shape = risk_slide.shapes[-1]
                
                # Position right column
                new_shape.left = left_start + col_width + col_margin
                new_shape.top = orig_top
                new_shape.width = col_width
                new_shape.height = orig_height
                
                # Write assumptions into the new shape
                tf_assumptions = new_shape.text_frame
                tf_assumptions.word_wrap = True
                assumptions_lines = ["ASSUMPTIONS:"] + assumptions_list[:5]
                for pi, para in enumerate(tf_assumptions.paragraphs):
                    if pi < len(assumptions_lines):
                        if para.runs:
                            para.runs[0].text = assumptions_lines[pi]
                            for r in para.runs[1:]:
                                r.text = ""
                        else:
                            run = para.add_run()
                            run.text = assumptions_lines[pi]
                    else:
                        if para.runs:
                            para.runs[0].text = ""
                            for r in para.runs[1:]:
                                r.text = ""
                existing_para_count_a = len(tf_assumptions.paragraphs)
                for extra_idx in range(existing_para_count_a, len(assumptions_lines)):
                    p = tf_assumptions.add_paragraph()
                    p.text = assumptions_lines[extra_idx]
                
                print(f"[PPT Export] ✅ Two-column layout applied on Slide {risk_slide_idx+1}: Risks (left) | Assumptions (right)")
            else:
                print(f"[PPT Export] ⚠️ {{RISK_LIST}} placeholder not found in any slide for two-column layout")
        
        # ============================================================================
        # SAVE AND RETURN
        # ============================================================================
        out = BytesIO()
        prs.save(out)
        out.seek(0)
        
        print(f"\n✅ [PPT Export] Successfully generated presentation for RFP {rfp_id}")
        print(f"   📊 Summary:")
        print(f"      - Buyer: {buyer_name}")
        print(f"      - Domain: {domain}")
        print(f"      - Total: {final_total_text} (Base: {base_subtotal_text}, Margin: {margin_percent}%, Discount: {discount_percent}%)")
        print(f"      - Items: {total_items} | Spec Match: {average_spec_match_text} | Compliance: {compliance_rate_text}")
        print(f"      - Risks: {len(risks_list)} | Assumptions: {len(assumptions_list)}")
        print(f"      - Replacements: {replacements_made} placeholders updated\n")
        
        headers = {
            "Content-Disposition": f'attachment; filename="Bid_Presentation_{rfp_id}.pptx"'
        }
        
        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers=headers,
        )
        
    except FileNotFoundError as e:
        print(f"❌ PPT Template not found: {e}")
        return {
            "status": "error",
            "message": str(e)
        }
    except Exception as e:
        print(f"❌ PPT Export failed: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "message": f"Failed to export PPT: {str(e)}"
        }

@app.post("/proposal/edit")
def edit_proposal(request: ProposalEditRequest):
    """Update the proposal with edited content"""
    try:
        save_proposal_output(request.updated_bid)
        return {
            "status": "success",
            "message": "Proposal updated successfully",
            "updated_content": request.updated_bid
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to update proposal: {str(e)}"
        }

@app.post("/proposal/generate-cover-letter")
def generate_cover_letter(request: CoverLetterRequest):
    """Generate AI-powered cover letter using Groq API"""
    try:
        import requests
        
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")
        GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
        
        if not GROQ_API_KEY:
            return {
                "status": "error",
                "message": "GROQ_API_KEY not configured in .env file"
            }
        
        # Get the actual generated bid proposal text
        bid_proposal = get_proposal_output()
        
        if not bid_proposal or len(bid_proposal.strip()) < 50:
            return {
                "status": "error",
                "message": "No proposal found. Please generate the proposal first by running the Technical and Pricing agents."
            }
        
        # Construct a professional prompt using the actual proposal content
        prompt = f"""You are a professional bid writer. Below is a complete tender proposal that has been generated for a client.

PROPOSAL CONTENT:
{bid_proposal}

Based ONLY on the above proposal content, create a professional 3-paragraph cover letter that:
1. First paragraph: Express gratitude for the opportunity and reference the specific RFP title and buyer mentioned in the proposal
2. Second paragraph: Highlight expertise in the specific domain/materials mentioned in the proposal (e.g., if proposal is about paints, mention painting expertise; if about cables, mention cable expertise), emphasizing technical capability and compliance
3. Third paragraph: Convey confidence in meeting requirements, timeline commitment, and eagerness for partnership

IMPORTANT: Extract the buyer name, RFP title, and domain/materials from the proposal above. Use those exact details in the cover letter.

Tone: Professional, confident, client-focused
Length: 150-200 words total
Format: Plain text, no special formatting or markdown
Do NOT use placeholder company names - write as "We" or "Our organization"."""
        
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a professional bid writer with expertise in government and enterprise tender responses. Always read the proposal carefully and create a cover letter that matches its content."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 500
        }
        
        response = requests.post(GROQ_API_URL, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            cover_letter = result["choices"][0]["message"]["content"].strip()
            
            # Try to extract buyer and title from proposal for response
            buyer = "Valued Client"
            rfp_title = "the tender"
            try:
                lines = bid_proposal.split('\n')
                for line in lines[:10]:  # Check first 10 lines
                    if "We thank" in line and "for inviting bids" in line:
                        parts = line.split("We thank ")[1].split(" for inviting")
                        buyer = parts[0].strip()
                    if "Subject:" in line or "Proposal for" in line:
                        if "RFP" in line:
                            title_part = line.split("Proposal for ")[1].split(" (RFP")[0] if "Proposal for" in line else ""
                            if title_part:
                                rfp_title = title_part.strip()
            except:
                pass
            
            return {
                "status": "success",
                "cover_letter": cover_letter,
                "buyer": buyer,
                "rfp_title": rfp_title
            }
        else:
            error_msg = response.text
            print(f"[Groq API Error] Status {response.status_code}: {error_msg}")
            return {
                "status": "error",
                "message": f"Groq API error: {error_msg}"
            }
            
    except Exception as e:
        print(f"[Cover Letter Generation Error] {str(e)}")
        return {
            "status": "error",
            "message": f"Failed to generate cover letter: {str(e)}"
        }

@app.post("/proposal/send-email")
async def send_email(
    to_email: str = Form(...),
    subject: str = Form(...),
    html_content: str = Form(...),
    attachments: List[UploadFile] = File(default=[])
):
    """Send proposal email via Gmail SMTP with attachments"""
    try:
        # Gmail SMTP Configuration
        SENDER_EMAIL = os.getenv("GMAIL_SENDER_EMAIL", "sohamghorpade912@gmail.com")
        SENDER_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")  # Gmail App Password
        SMTP_HOST = "smtp.gmail.com"
        SMTP_PORT = 587
        
        if not SENDER_PASSWORD:
            return {
                "status": "error",
                "message": "GMAIL_APP_PASSWORD not configured in .env file"
            }
        
        print(f"[Gmail SMTP] Sender: {SENDER_EMAIL}")
        print(f"[Gmail SMTP] Recipient: {to_email}")
        print(f"[Gmail SMTP] Subject: {subject}")
        
        # Create email message
        msg = EmailMessage()
        msg['From'] = formataddr(("RFP Bidding System", SENDER_EMAIL))
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Set HTML content
        msg.set_content(html_content, subtype='html')
        
        # Process attachments
        for file in attachments:
            if file.filename:
                # Read file content
                file_content = await file.read()
                
                # Guess the MIME type
                mime_type, _ = mimetypes.guess_type(file.filename)
                if mime_type is None:
                    mime_type = 'application/octet-stream'
                
                # Split MIME type into maintype and subtype
                maintype, subtype = mime_type.split('/', 1)
                
                # Add attachment
                msg.add_attachment(
                    file_content,
                    maintype=maintype,
                    subtype=subtype,
                    filename=file.filename
                )
                print(f"[Gmail SMTP] Attached: {file.filename} ({mime_type})")
        
        # Connect to Gmail SMTP server and send
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()  # Secure the connection
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        
        print(f"[Gmail SMTP] ✅ Email sent successfully to {to_email}")
        
        return {
            "status": "success",
            "message": f"Email successfully sent via Gmail SMTP to {to_email}"
        }
        
    except smtplib.SMTPAuthenticationError as e:
        error_msg = str(e)
        print(f"[Gmail SMTP Error] Authentication failed: {error_msg}")
        return {
            "status": "error",
            "message": "Gmail authentication failed. Please verify the sender email and app password are correct."
        }
    except smtplib.SMTPException as e:
        error_msg = str(e)
        print(f"[Gmail SMTP Error] SMTP error: {error_msg}")
        return {
            "status": "error",
            "message": f"SMTP error: {error_msg}"
        }
    except Exception as e:
        error_msg = str(e)
        print(f"[Email Send Error] {error_msg}")
        return {
            "status": "error",
            "message": f"Failed to send email: {error_msg}"
        }


# ============================
# STRATEGIC BID INTELLIGENCE - WIN PROBABILITY ANALYTICS
# ============================

@app.get("/analytics/debug/past-bids")
async def debug_past_bids():
    """Debug endpoint to check MongoDB connection and data"""
    try:
        if past_bids_collection is None:
            return {
                "success": False,
                "message": "MongoDB connection not available",
                "mongo_uri_set": bool(os.getenv("MONGO_URI2"))
            }
        
        # Count documents
        count = past_bids_collection.count_documents({})
        
        # Get sample documents
        sample_bids = list(past_bids_collection.find({}).limit(3))
        
        # Convert ObjectId to string for JSON serialization
        for bid in sample_bids:
            if '_id' in bid:
                bid['_id'] = str(bid['_id'])
        
        return {
            "success": True,
            "connection": "Connected",
            "collection": "dummybid",
            "count": count,
            "sample_data": sample_bids
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "mongo_uri_set": bool(os.getenv("MONGO_URI2"))
        }

@app.get("/analytics/win-probability")
async def get_win_probability():
    """
    Calculate win probability score based on current RFP and historical bid data.
    
    Logic:
    - Buyer Match (+40%): Boost if buyer_type matches successful past bids
    - Domain Expertise (+30%): Boost if domain has high 'Won' count
    - Value Alignment (+20%): Boost if estimated_value within 20% of successful bids
    - Risk Penalty (-20%): Penalize if delivery timeline is longer than successful average
    
    Returns:
        - win_score: 0-100% probability
        - strategy_recommendation: Personalized recommendation based on analysis
        - breakdown: Detailed scoring breakdown
    """
    try:
        # Check if MongoDB is available
        if past_bids_collection is None:
            return {
                "success": False,
                "message": "MongoDB connection not available",
                "win_score": 0,
                "strategy_recommendation": "Unable to calculate - database not connected"
            }
        
        # Get current RFP details from master output
        master_output = get_master_output()
        
        # Fetch historical bid data first
        past_bids = list(past_bids_collection.find({}, {
            "_id": 0,
            "buyer": 1,
            "buyer_type": 1,
            "domain": 1,
            "bid_value_cr": 1,
            "status": 1,
            "delivery_duration_days": 1
        }))
        
        if not past_bids:
            return {
                "success": True,
                "win_score": 50,
                "strategy_recommendation": "No historical data available. Build your track record by capturing won bids using the form below.",
                "breakdown": {
                    "buyer_match": 0,
                    "domain_expertise": 0,
                    "value_alignment": 0,
                    "risk_penalty": 0
                },
                "historical_context": {
                    "total_bids": 0,
                    "won_bids": 0,
                    "lost_bids": 0,
                    "overall_win_rate": 0
                }
            }
        
        # Calculate overall historical win rate for baseline
        won_bids = [b for b in past_bids if str(b.get("status", "")).lower() == "won"]
        lost_bids = [b for b in past_bids if str(b.get("status", "")).lower() == "lost"]
        overall_win_rate = (len(won_bids) / len(past_bids) * 100) if past_bids else 50
        
        # Check if we have a valid RFP to analyze
        if not master_output:
            return {
                "success": True,
                "win_score": round(overall_win_rate, 1),
                "strategy_recommendation": f"No active RFP to analyze. Your historical win rate is {overall_win_rate:.1f}%. Process an RFP through the Master Agent for detailed probability analysis.",
                "breakdown": {
                    "buyer_match": 0,
                    "domain_expertise": 0,
                    "value_alignment": 0,
                    "risk_penalty": 0
                },
                "historical_context": {
                    "total_bids": len(past_bids),
                    "won_bids": len(won_bids),
                    "lost_bids": len(lost_bids),
                    "overall_win_rate": round(overall_win_rate, 1)
                }
            }
        
        # Extract current RFP information from the actual structure
        selected_rfp = master_output.get("selected_rfp", {})
        technical_summary = master_output.get("technical_summary", {})
        rfp_context = technical_summary.get("rfp_context", {})
        scope_context = technical_summary.get("scope_context", {})
        
        # Extract buyer
        current_buyer = selected_rfp.get("buyer") or rfp_context.get("buyer") or "Unknown"
        
        # Infer buyer_type from buyer name (simple heuristic)
        current_buyer_type = "Unknown"
        if current_buyer != "Unknown":
            buyer_lower = current_buyer.lower()
            # PSU/Government indicators
            psu_keywords = ['bank', 'board', 'corporation', 'limited', 'authority', 'company', 
                           'railways', 'power', 'electricity', 'bhel', 'ntpc', 'ongc', 'sail',
                           'gail', 'iocl', 'bpcl', 'hpcl', 'coal india', 'housing', 'state']
            
            if any(keyword in buyer_lower for keyword in psu_keywords):
                current_buyer_type = "PSU"
            else:
                # Check if it has private company indicators
                private_keywords = ['pvt', 'private', 'technologies', 'solutions', 'services']
                if any(keyword in buyer_lower for keyword in private_keywords):
                    current_buyer_type = "Private"
                else:
                    # Default to PSU for Indian government entities
                    current_buyer_type = "PSU"
        
        # Extract domain
        current_domain = (
            selected_rfp.get("domain") or 
            rfp_context.get("domain") or 
            scope_context.get("material_type") or 
            "Unknown"
        )
        
        # Extract estimated value and parse it
        estimated_value_str = (
            selected_rfp.get("estimated_project_value") or 
            rfp_context.get("estimated_value") or 
            "0"
        )
        
        # Parse estimated value (handle ranges like "₹15,00,000 - ₹22,00,000")
        estimated_value = 0
        if isinstance(estimated_value_str, str):
            # Extract all numbers and take the average of range or single number
            numbers = re.findall(r'[\d,]+', estimated_value_str.replace(',', ''))
            if numbers:
                # Convert to float and handle lakhs/crores
                parsed_numbers = []
                for num_str in numbers:
                    try:
                        num = float(num_str)
                        # If less than 1000, assume it's already in Crores
                        # If more than 10000, convert from Rupees to Crores
                        if num > 10000:
                            num = num / 10000000  # Convert to Crores
                        parsed_numbers.append(num)
                    except:
                        pass
                
                if parsed_numbers:
                    estimated_value = sum(parsed_numbers) / len(parsed_numbers)
        elif isinstance(estimated_value_str, (int, float)):
            estimated_value = float(estimated_value_str)
        
        # Extract delivery timeline
        current_delivery = 0
        # Check scope_context or selected_rfp for timeline
        timeline_sources = [
            scope_context.get("timeline", ""),
            scope_context.get("delivery_schedule", ""),
            selected_rfp.get("timeline", "")
        ]
        
        for timeline_text in timeline_sources:
            if timeline_text:
                timeline_lower = str(timeline_text).lower()
                delivery_match = re.search(r'(\d+)\s*days?', timeline_lower)
                if delivery_match:
                    current_delivery = int(delivery_match.group(1))
                    break
        
        # Debug logging
        print(f"\n[Win Probability Debug]")
        print(f"  Buyer: {current_buyer}")
        print(f"  Buyer Type: {current_buyer_type} (inferred)")
        print(f"  Domain: {current_domain}")
        print(f"  Estimated Value: ₹{estimated_value:.2f} Cr")
        print(f"  Delivery Days: {current_delivery}")
        
        # Check if RFP data is meaningful (not all unknown/empty)
        has_meaningful_data = (
            current_buyer_type != "Unknown" or 
            current_domain != "Unknown" or 
            estimated_value > 0
        )
        
        if not has_meaningful_data:
            return {
                "success": True,
                "win_score": round(overall_win_rate, 1),
                "strategy_recommendation": f"⚠️ RFP data incomplete. Your baseline win rate is {overall_win_rate:.1f}% based on {len(won_bids)} wins out of {len(past_bids)} bids. Process a complete RFP for accurate probability analysis.",
                "breakdown": {
                    "buyer_match": 0,
                    "domain_expertise": 0,
                    "value_alignment": 0,
                    "risk_penalty": 0
                },
                "current_rfp": {
                    "buyer": current_buyer,
                    "buyer_type": current_buyer_type,
                    "domain": current_domain,
                    "estimated_value": estimated_value,
                    "delivery_days": current_delivery
                },
                "historical_context": {
                    "total_bids": len(past_bids),
                    "won_bids": len(won_bids),
                    "lost_bids": len(lost_bids),
                    "overall_win_rate": round(overall_win_rate, 1)
                }
            }
        
        # Initialize score components
        buyer_match_score = 0
        domain_expertise_score = 0
        value_alignment_score = 0
        risk_penalty = 0
        
        # 1. BUYER MATCH (+40%)
        if current_buyer_type != "Unknown":
            matching_buyer_type_wins = [b for b in won_bids if b.get("buyer_type", "").lower() == current_buyer_type.lower()]
            total_buyer_type_bids = [b for b in past_bids if b.get("buyer_type", "").lower() == current_buyer_type.lower()]
            
            if total_buyer_type_bids:
                buyer_win_rate = len(matching_buyer_type_wins) / len(total_buyer_type_bids)
                buyer_match_score = buyer_win_rate * 40
        
        # 2. DOMAIN EXPERTISE (+30%)
        if current_domain != "Unknown":
            domain_won_count = len([b for b in won_bids if current_domain.lower() in str(b.get("domain", "")).lower()])
            domain_total_count = len([b for b in past_bids if current_domain.lower() in str(b.get("domain", "")).lower()])
            
            if domain_total_count > 0:
                domain_win_rate = domain_won_count / domain_total_count
                domain_expertise_score = domain_win_rate * 30
        
        # 3. VALUE ALIGNMENT (+20%)
        if estimated_value > 0:
            won_values = [b.get("bid_value_cr", 0) for b in won_bids if b.get("bid_value_cr")]
            if won_values:
                avg_won_value = sum(won_values) / len(won_values)
                # Check if within 20% range
                lower_bound = avg_won_value * 0.8
                upper_bound = avg_won_value * 1.2
                
                if lower_bound <= estimated_value <= upper_bound:
                    value_alignment_score = 20
                elif estimated_value < lower_bound:
                    # Smaller value = moderate boost
                    value_alignment_score = 15
                else:
                    # Larger value = slight penalty
                    value_alignment_score = 10
        
        # 4. RISK PENALTY (-20%)
        if current_delivery > 0:
            won_deliveries = [b.get("delivery_duration_days", 0) for b in won_bids if b.get("delivery_duration_days")]
            if won_deliveries:
                avg_won_delivery = sum(won_deliveries) / len(won_deliveries)
                
                if current_delivery > avg_won_delivery * 1.1:  # More than 10% longer
                    risk_penalty = 20
        
        # Calculate final score
        win_score = max(0, min(100, buyer_match_score + domain_expertise_score + value_alignment_score - risk_penalty))
        
        # Generate strategy recommendation
        recommendations = []
        
        if buyer_match_score > 30:
            recommendations.append(f"Strong track record with {current_buyer_type} buyers")
        elif buyer_match_score < 15:
            recommendations.append(f"Limited experience with {current_buyer_type} buyers - emphasize unique value proposition")
        
        if domain_expertise_score > 20:
            recommendations.append(f"Proven expertise in {current_domain} domain - leverage past successes")
        elif domain_expertise_score < 10:
            recommendations.append(f"New domain ({current_domain}) - consider strategic partnerships")
        
        if value_alignment_score >= 20:
            recommendations.append("Bid value aligns with historical success range")
        elif value_alignment_score < 15:
            recommendations.append("Bid value outside typical range - justify pricing carefully")
        
        if risk_penalty > 0:
            recommendations.append("⚠️ Extended delivery timeline detected - streamline schedule or explain complexity")
        
        strategy_recommendation = " | ".join(recommendations) if recommendations else "Proceed with standard approach"
        
        # Find top successful buyer for reference
        won_buyer_examples = [b.get("buyer", "") for b in won_bids[:3]]
        if won_buyer_examples:
            strategy_recommendation += f" | Reference past wins: {', '.join(filter(None, won_buyer_examples))}"
        
        return {
            "success": True,
            "win_score": round(win_score, 1),
            "strategy_recommendation": strategy_recommendation,
            "breakdown": {
                "buyer_match": round(buyer_match_score, 1),
                "domain_expertise": round(domain_expertise_score, 1),
                "value_alignment": round(value_alignment_score, 1),
                "risk_penalty": round(risk_penalty, 1)
            },
            "current_rfp": {
                "buyer": current_buyer,
                "buyer_type": current_buyer_type,
                "domain": current_domain,
                "estimated_value": estimated_value,
                "delivery_days": current_delivery
            },
            "historical_context": {
                "total_bids": len(past_bids),
                "won_bids": len(won_bids),
                "lost_bids": len(lost_bids),
                "overall_win_rate": round((len(won_bids) / len(past_bids) * 100), 1) if past_bids else 0
            }
        }
        
    except Exception as e:
        error_msg = str(e)
        print(f"[Win Probability Error] {error_msg}")
        return {
            "success": False,
            "message": f"Failed to calculate win probability: {error_msg}",
            "win_score": 0,
            "strategy_recommendation": "Error occurred during analysis"
        }


# Run the server with uvicorn when executed directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
