from fastapi.responses import StreamingResponse
from io import BytesIO
from pathlib import Path
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor
import re
from datetime import datetime

from pptx import Presentation
from pptx.util import Pt, Inches
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.enum.shapes import MSO_SHAPE_TYPE, MSO_AUTO_SHAPE_TYPE


def _safe_number(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def _format_inr(value: Any) -> str:
    n = _safe_number(value, 0.0)
    if n.is_integer():
        return f"₹{int(n):,}"
    return f"₹{n:,.2f}"


def _format_inr_from_any(value: Any) -> str:
    """Format a number-ish value as INR with comma separation.

    If parsing fails, returns a best-effort string with a leading ₹.
    """
    if value is None:
        return _format_inr(0)
    if isinstance(value, (int, float)):
        return _format_inr(value)
    s = str(value).strip()
    if not s:
        return _format_inr(0)

    # Strip currency symbols/words and keep digits/decimal.
    cleaned = re.sub(r"[^0-9.\-]", "", s)
    try:
        return _format_inr(float(cleaned))
    except Exception:
        # Fall back: ensure rupee prefix and return original text.
        return s if s.startswith("₹") else f"₹{s}"


def _format_date_display(value: Any) -> str:
    """Format dates as: 05 March 2026 (government-style).

    Accepts common inputs (ISO, dd/mm/yyyy, dd-mm-yyyy, etc.).
    If parsing fails, returns the original string.
    """
    if value is None:
        return ""
    s = str(value).strip()
    if not s:
        return ""

    # Remove time zone markers/extra text when possible.
    s_norm = re.sub(r"\s+", " ", s.replace("T", " ")).strip()

    candidates = [
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d.%m.%Y",
        "%d %b %Y",
        "%d %B %Y",
        "%d %b %Y %H:%M",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y %H:%M %p",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
    ]

    dt = None
    for fmt in candidates:
        try:
            dt = datetime.strptime(s_norm, fmt)
            break
        except Exception:
            continue

    if dt is None:
        # Heuristic: try extracting a dd/mm/yyyy substring.
        m = re.search(r"\b(\d{1,2})[\-/\.](\d{1,2})[\-/\.](\d{2,4})\b", s_norm)
        if m:
            try:
                d = int(m.group(1))
                mth = int(m.group(2))
                y = int(m.group(3))
                if y < 100:
                    y = 2000 + y
                dt = datetime(y, mth, d)
            except Exception:
                dt = None

    return dt.strftime("%d %B %Y") if dt else s


def _strip_template_braces(text: str) -> str:
    if not text:
        return ""
    # Remove any leftover template tokens like {{...}}.
    return text.replace("{{", "").replace("}}", "")


def _shorten_executive_summary(text: str, *, max_sentences: int = 4, max_chars: int = 600) -> str:
    """Create a concise executive summary from existing prose.

    - Max N sentences OR max_chars (whichever is tighter)
    - Collapses excessive whitespace/line breaks
    - Returns newline-separated sentences for clean 3–4 lines
    """
    if not text:
        return ""

    s = str(text)
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r"[ \t]+", " ", s)
    s = s.strip()

    if not s:
        return ""

    # Sentence split (simple, deterministic)
    parts = re.split(r"(?<=[\.\!\?])\s+", s)
    parts = [p.strip() for p in parts if p and p.strip()]
    if not parts:
        parts = [s]

    chosen: List[str] = []
    for p in parts:
        if len(chosen) >= max_sentences:
            break
        chosen.append(p)

    out = "\n".join(chosen)
    out = re.sub(r"\n{3,}", "\n\n", out).strip()

    if len(out) > max_chars:
        out = out[:max_chars]
        # Don't cut mid-word if possible
        cut = out.rfind(" ")
        if cut > 200:
            out = out[:cut]
        out = out.rstrip(" .\n") + "."

    # Ensure we don't leak template braces
    out = _strip_template_braces(out)
    return out


def _replace_placeholders_in_text_frame(text_frame, replacements: Dict[str, str]) -> None:
    """Replace placeholders inside a text frame.

    PowerPoint templates often split placeholder text across multiple runs.
    To ensure replacements are applied reliably, we do a paragraph-level
    replacement using the paragraph's full text, then write the result back
    into the first run (clearing the rest). This keeps the template's
    paragraph formatting/theme while avoiding missed replacements.
    """
    for paragraph in text_frame.paragraphs:
        full_text = paragraph.text or ""
        if not full_text:
            continue

        replaced = full_text
        for key, value in replacements.items():
            replaced = replaced.replace(key, str(value))

        if replaced == full_text:
            continue

        # Ensure there is at least one run to receive the replaced text.
        if not paragraph.runs:
            run = paragraph.add_run()
            run.text = replaced
            continue

        paragraph.runs[0].text = replaced
        for run in paragraph.runs[1:]:
            run.text = ""


def _text_frame_contains(text_frame, needle: str) -> bool:
    for paragraph in text_frame.paragraphs:
        if needle in (paragraph.text or ""):
            return True
    return False


def replace_placeholders(presentation, replacements: Dict[str, Any]) -> None:
    # Safe placeholder replacement (preserves formatting)
    for slide in presentation.slides:
        for shape in _iter_slide_shapes(slide):
            if not getattr(shape, "has_text_frame", False):
                continue
            _replace_placeholders_in_text_frame(shape.text_frame, {k: str(v) for k, v in replacements.items()})


def _set_text_frame_bold_line(text_frame, text: str) -> None:
    text_frame.clear()
    p = text_frame.paragraphs[0]
    p.text = ""
    run = p.add_run()
    run.text = str(text or "")
    run.font.bold = True


def _replace_placeholders_in_table_cells(shape, replacements: Dict[str, Any]) -> None:
    if not getattr(shape, "has_table", False):
        return

    table = shape.table
    for r in range(len(table.rows)):
        for c in range(len(table.columns)):
            tf = table.cell(r, c).text_frame
            _replace_placeholders_in_text_frame(tf, {k: str(v) for k, v in replacements.items()})


def _iter_slide_shapes(slide):
    # Includes shapes inside groups (recursive)
    def _walk(shape_container):
        for shp in shape_container:
            yield shp
            try:
                if getattr(shp, "shape_type", None) == MSO_SHAPE_TYPE.GROUP:
                    for inner in _walk(shp.shapes):
                        yield inner
            except Exception:
                continue

    yield from _walk(slide.shapes)


def _delete_shape(slide, shape) -> None:
    # Some templates place placeholders inside grouped shapes; in that case, the
    # shape's XML parent isn't the slide spTree. Fall back to removing from the
    # element's actual parent.
    try:
        slide.shapes._spTree.remove(shape._element)
        return
    except Exception:
        pass

    try:
        parent = shape._element.getparent()
        if parent is not None:
            parent.remove(shape._element)
    except Exception:
        pass


def _apply_bullets(text_frame, items: List[str]) -> None:
    text_frame.clear()
    if not items:
        return

    first = text_frame.paragraphs[0]
    first.text = str(items[0])
    first.level = 0
    for item in items[1:]:
        p = text_frame.add_paragraph()
        p.text = str(item)
        p.level = 0


def _apply_bullet_runs(text_frame, lines: List[Dict[str, str]]) -> None:
    """Insert bullet-looking lines with partial bolding.

    lines: [{"title": "Phase 1 – ...", "detail": "(2 days)"}, ...]
    """
    text_frame.clear()
    if not lines:
        return

    # Ensure at least one paragraph exists
    p0 = text_frame.paragraphs[0]
    p0.text = ""
    paragraphs = [p0]
    for _ in range(len(lines) - 1):
        paragraphs.append(text_frame.add_paragraph())

    for p, line in zip(paragraphs, lines):
        p.level = 0
        p.text = ""

        run_bullet = p.add_run()
        run_bullet.text = "• "
        run_bullet.font.bold = False

        run_title = p.add_run()
        run_title.text = _strip_template_braces(str(line.get("title") or "")).strip()
        run_title.font.bold = True

        detail = _strip_template_braces(str(line.get("detail") or "")).strip()
        if detail:
            run_detail = p.add_run()
            run_detail.text = f" {detail}" if not detail.startswith("(") else f" {detail}"
            run_detail.font.bold = False


def _apply_timeline(text_frame, phase_1: str, phase_2: str, phase_3: str, phase_4: str) -> None:
    text_frame.clear()

    phases = [
        ("Phase 1 – Requirement Finalization", phase_1),
        ("Phase 2 – Procurement & Manufacturing", phase_2),
        ("Phase 3 – Testing & QA", phase_3),
        ("Phase 4 – Delivery & Handover", phase_4),
    ]

    for title, desc in phases:
        p = text_frame.add_paragraph()
        p.text = title
        p.font.bold = True
        p.level = 0

        p2 = text_frame.add_paragraph()
        p2.text = str(desc or "")
        p2.level = 1


def _insert_bullets_for_risk_list(text_frame, bullet_items: List[str]) -> None:
    if not bullet_items:
        bullet_items = ["No significant risks identified."]

    text_frame.clear()
    first = text_frame.paragraphs[0]
    first.text = bullet_items[0]
    first.level = 0

    for item in bullet_items[1:]:
        p = text_frame.add_paragraph()
        p.text = item
        p.level = 0


def _set_cell_text(cell, text: str, *, bold: bool = False, font_size: int = 12, color: RGBColor | None = None, align: int | None = None) -> None:
    tf = cell.text_frame
    tf.clear()
    tf.word_wrap = True
    p = tf.paragraphs[0]
    if align is not None:
        p.alignment = align
    run = p.add_run()
    run.text = str(text or "")
    run.font.bold = bold
    run.font.size = Pt(font_size)
    if color is not None:
        run.font.color.rgb = color


def _add_spec_matrix_table(slide, left, top, width, height, tech_items: List[Dict[str, Any]]) -> None:
    # 1 header row + N data rows
    rows = 1 + len(tech_items)
    cols = 4
    table_shape = slide.shapes.add_table(rows, cols, left, top, width, height)
    table = table_shape.table

    # Column widths (professional balance)
    table.columns[0].width = int(width * 0.22)
    table.columns[1].width = int(width * 0.36)
    table.columns[2].width = int(width * 0.26)
    table.columns[3].width = int(width * 0.16)

    header_bg = RGBColor(64, 64, 64)
    header_fg = RGBColor(255, 255, 255)
    alt_bg = RGBColor(242, 242, 242)

    headers = ["Parameter", "RFP Requirement", "Proposed SKU", "Match %"]
    for c, title in enumerate(headers):
        cell = table.cell(0, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = header_bg
        _set_cell_text(cell, title, bold=True, font_size=14, color=header_fg, align=PP_ALIGN.CENTER)

    for r, item in enumerate(tech_items, start=1):
        if r % 2 == 1:
            for c in range(cols):
                cell = table.cell(r, c)
                cell.fill.solid()
                cell.fill.fore_color.rgb = alt_bg

        best_match = item.get("best_match") if isinstance(item.get("best_match"), dict) else {}
        parameter = str(item.get("parameter") or item.get("item_name") or item.get("name") or f"Item {r}").strip()
        requirement = (
            str(
                item.get("rfp_requirement")
                or item.get("requirement")
                or item.get("required_spec")
                or item.get("required_specs")
                or item.get("required_specs_text")
                or item.get("rfp_spec")
                or ""
            )
            .strip()
        )
        proposed_sku = str(
            best_match.get("sku_code")
            or best_match.get("sku")
            or best_match.get("sku_id")
            or item.get("best_match_sku")
            or ""
        ).strip()
        match_percent = _safe_number(best_match.get("spec_match_percent") if isinstance(best_match, dict) else None, None)
        if match_percent is None:
            match_percent = _safe_number(item.get("spec_match_percent"), 0.0)
        match_text = f"{match_percent:.1f}%"

        _set_cell_text(table.cell(r, 0), parameter, font_size=12, align=PP_ALIGN.LEFT)
        _set_cell_text(table.cell(r, 1), requirement, font_size=12, align=PP_ALIGN.LEFT)
        _set_cell_text(table.cell(r, 2), proposed_sku, font_size=12, align=PP_ALIGN.LEFT)
        _set_cell_text(table.cell(r, 3), match_text, font_size=12, align=PP_ALIGN.CENTER)


@app.get("/api/proposal/export-ppt/{rfp_id:path}")
def export_proposal_ppt(rfp_id: str):
    master = get_master_output() or {}
    pricing = get_pricing_output() or {}
    compliance = get_compliance_output() or []
    technical = get_technical_output() or {}
    proposal_text = get_proposal_output() or ""

    selected = master.get("selected_rfp", {}) or {}
    summaries_tech = (master.get("summaries", {}) or {}).get("technical", {}) or {}

    buyer_name = str(selected.get("buyer") or "").strip()
    if not buyer_name:
        buyer_name = "the Client"

    client_name = buyer_name
    bid_id = str(selected.get("rfp_id") or summaries_tech.get("rfp_id") or rfp_id or "")
    submission_date_raw = (selected.get("submission_deadline") or summaries_tech.get("deadline") or "")
    submission_date = _format_date_display(submission_date_raw)
    est_value_raw = (selected.get("estimated_project_value") or summaries_tech.get("estimated_value") or "")
    est_value = _format_inr_from_any(est_value_raw) if est_value_raw else ""

    priority_level = str(selected.get("priority") or "").strip() or "Medium"

    pricing_items = pricing.get("items") or []

    # -----------------------------
    # Technical match KPIs (compute from structured technical/spec data) — do NOT read summary/prose text.
    # -----------------------------
    tech_items_raw = (technical.get("items") or []) if isinstance(technical, dict) else []
    tech_items = [x for x in tech_items_raw if isinstance(x, dict)]

    def _get_item_status(item: Dict[str, Any]) -> str:
        best_match = item.get("best_match") if isinstance(item.get("best_match"), dict) else None
        status = (best_match.get("status") if best_match else None) or item.get("status")
        return str(status or "").strip()

    def _get_item_match_percent(item: Dict[str, Any]) -> float:
        best_match = item.get("best_match") if isinstance(item.get("best_match"), dict) else None
        percent = (best_match.get("spec_match_percent") if best_match else None)
        if percent is None:
            percent = item.get("spec_match_percent")
        return _safe_number(percent, 0.0)

    total_items = len(tech_items)

    # Average spec match (per-item spec_match_percent)
    spec_sum = 0.0
    for item in tech_items:
        spec_sum += _get_item_match_percent(item)
    average_spec_match = (spec_sum / total_items) if total_items else 0.0
    average_spec_match_text = f"{average_spec_match:.1f}%"

    # Overall technical match % (do NOT use average spec match): use technical.summary.success_rate
    tech_summary = technical.get("summary") if isinstance(technical, dict) else {}
    success_rate = _safe_number((tech_summary or {}).get("success_rate"), None)
    if success_rate is None:
        matched_items = _safe_number((tech_summary or {}).get("matched_items"), None)
        total_items_summary = _safe_number((tech_summary or {}).get("total_items"), None)
        if matched_items is not None and total_items_summary and total_items_summary > 0:
            success_rate = (matched_items / total_items_summary) * 100.0
    if success_rate is None:
        # Fallback only if summary fields are missing.
        success_rate = average_spec_match
    overall_match_percent_text = f"{_safe_number(success_rate, 0.0):.1f}%"

    # Confidence Level
    if average_spec_match >= 90.0:
        confidence_level = "High"
    elif average_spec_match >= 75.0:
        confidence_level = "Strong"
    elif average_spec_match >= 60.0:
        confidence_level = "Moderate"
    else:
        confidence_level = "Needs Review"

    # Priority & overall risk rating must always be populated.
    # Overall risk driven by computed technical KPIs.
    # Section 3: Risk rating driven by overall match percent.
    # Keep risk rating driven by overall technical match (slide KPI alignment)
    overall_match_value = _safe_number(success_rate, 0.0)
    if overall_match_value >= 85.0:
        overall_risk_rating = "Low"
    elif overall_match_value >= 70.0:
        overall_risk_rating = "Moderate"
    else:
        overall_risk_rating = "High"

    # Risk score for badge (visual-only). Lower is better.
    risk_score = max(0.0, min(100.0, 100.0 - overall_match_value))

    material_total = pricing.get("material_total", 0)
    testing_total = pricing.get("testing_total", 0)
    # Use precomputed risk provision if present; do not recalculate.
    risk_provision = pricing.get("risk_provision", pricing.get("risk_total", pricing.get("risk_amount", 0)))
    grand_total = pricing.get("grand_total", 0)

    # Section 6: Fixed, professional risk bullets.
    risk_items: List[str] = [
        "Tight submission deadline",
        "Compliance adherence to IS/IEC standards",
        "Testing & certification dependencies",
        "Delivery coordination risks",
    ]

    assumptions_items: List[str] = []
    # Prefer consolidated fields if present; otherwise fall back to the same static assumptions used by Proposal Builder.
    raw_assumptions = (master.get("assumptions") or pricing.get("assumptions") or technical.get("assumptions"))
    if isinstance(raw_assumptions, list):
        assumptions_items = [str(x).strip() for x in raw_assumptions if str(x).strip()]
    if not assumptions_items:
        assumptions_items = [
            "Buyer provides uninterrupted site access",
            "Single inspection authority",
        ]

    # -----------------------------
    # Section 1: Executive Summary (concise, structured; no prose dumping).
    # -----------------------------
    domain = str(technical.get("domain") if isinstance(technical, dict) else "").strip()
    if not domain:
        domain = str(selected.get("domain") or selected.get("category") or "").strip()
    if not domain:
        domain = "Project"

    exec_grand_total = grand_total
    if _safe_number(exec_grand_total, 0.0) <= 0:
        exec_grand_total = material_total + testing_total + risk_provision
    grand_total_text = _format_inr(exec_grand_total)

    structured_exec = "\n".join(
        [
            f"This proposal addresses the {domain} requirements under Bid {bid_id}.",
            f"Our technical evaluation indicates an overall specification match of {overall_match_percent_text} across {total_items} line items.",
            f"The total proposed commercial value is {grand_total_text}.",
            f"Risk assessment is rated as {overall_risk_rating}.",
        ]
    )

    # FIX 1: Executive Summary must be a 3–4 line summary (no full bid prose).
    executive_summary = structured_exec

    replacements = {
        "{{EXECUTIVE_SUMMARY}}": executive_summary,
        "{{DOMAIN}}": domain,
        "{{CLIENT_NAME}}": client_name,
        "{{BID_ID}}": bid_id,
        "{{SUBMISSION_DATE}}": submission_date,
        "{{EST_VALUE}}": est_value,
        "{{PRIORITY_LEVEL}}": priority_level,
        "{{OVERALL_RISK_RATING}}": overall_risk_rating,
        "{{OVERALL_MATCH_PERCENT}}": overall_match_percent_text,
        "{{AVERAGE_SPEC_MATCH}}": average_spec_match_text,
        "{{CONFIDENCE_LEVEL}}": confidence_level,
        "{{TOTAL_ITEMS}}": str(total_items),
        "{{MATERIAL_COST}}": _format_inr(material_total),
        "{{TESTING_COST}}": _format_inr(testing_total),
        "{{GRAND_TOTAL}}": grand_total_text,
        "{{OVERALL_RISK_BADGE}}": f"Overall Risk Rating: {overall_risk_rating}",
        "{{PHASE_1}}": "Phase 1 – Engineering & Planning (2 Weeks)",
        "{{PHASE_2}}": "Phase 2 – Manufacturing (4–6 Weeks)",
        "{{PHASE_3}}": "Phase 3 – Testing & QA (1 Week)",
        "{{PHASE_4}}": "Phase 4 – Dispatch & Delivery (1–2 Weeks)",
    }

    template_path = Path(__file__).resolve().parent / "rfp_master_template.pptx"
    prs = Presentation(str(template_path))

    # SPEC MATRIX rows come directly from technical items (structured values).
    spec_matrix_items: List[Dict[str, Any]] = tech_items

    for slide in prs.slides:
        for shape in list(_iter_slide_shapes(slide)):
            # SPEC MATRIX placeholder can be in a text box or a placeholder table
            if getattr(shape, "has_text_frame", False) and (getattr(shape, "text", "") or "").strip() == "{{SPEC_MATRIX}}":
                left, top, width, height = shape.left, shape.top, shape.width, shape.height
                _delete_shape(slide, shape)
                _add_spec_matrix_table(slide, left, top, width, height, spec_matrix_items)
                continue

            if getattr(shape, "has_table", False):
                found_spec = False
                try:
                    for r in range(len(shape.table.rows)):
                        for c in range(len(shape.table.columns)):
                            if (shape.table.cell(r, c).text or "").strip() == "{{SPEC_MATRIX}}":
                                found_spec = True
                                break
                        if found_spec:
                            break
                except Exception:
                    found_spec = False

                if found_spec:
                    left, top, width, height = shape.left, shape.top, shape.width, shape.height
                    _delete_shape(slide, shape)
                    _add_spec_matrix_table(slide, left, top, width, height, spec_matrix_items)
                    continue

            # FIX 3: Cost bar visual placeholder -> clustered COLUMN chart
            if getattr(shape, "has_text_frame", False) and _text_frame_contains(shape.text_frame, "{{COST_BAR_VISUAL}}"):
                left, top, width, height = shape.left, shape.top, shape.width, shape.height
                _delete_shape(slide, shape)

                material_val = _safe_number(material_total, 0.0)
                testing_val = _safe_number(testing_total, 0.0)

                # Category charts should use CategoryChartData for consistent rendering.
                chart_data = CategoryChartData()
                chart_data.categories = ["Material", "Testing"]
                chart_data.add_series("Cost", (material_val, testing_val))

                # Ensure the chart area is visible even if the template placeholder is too short.
                if height < Inches(1.5):
                    height = Inches(1.5)

                chart_shape = slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, left, top, width, height, chart_data)
                chart = chart_shape.chart
                chart.has_legend = False
                chart.has_title = True
                chart.chart_title.text_frame.text = "Cost Distribution"

                # Blue bars, minimal styling
                try:
                    series = chart.series[0]
                    # Some PPT themes ignore series fill; color points to be safe.
                    for pt in getattr(series, "points", []) or []:
                        fill = pt.format.fill
                        fill.solid()
                        fill.fore_color.rgb = RGBColor(0, 112, 192)
                    fill = series.format.fill
                    fill.solid()
                    fill.fore_color.rgb = RGBColor(0, 112, 192)
                except Exception:
                    pass
                continue

            # Risk & assumptions bullets and delivery timeline (text boxes)
            if getattr(shape, "has_text_frame", False):
                tf = shape.text_frame

                # FIX 4.2: Risk badge -> circular shape with colored fill
                if _text_frame_contains(tf, "{{OVERALL_RISK_BADGE}}"):
                    left, top, width, height = shape.left, shape.top, shape.width, shape.height
                    _delete_shape(slide, shape)

                    if risk_score < 30.0:
                        badge_color = RGBColor(0, 176, 80)
                        badge_text = "Low Risk"
                    elif risk_score <= 60.0:
                        badge_color = RGBColor(255, 192, 0)
                        badge_text = "Moderate Risk"
                    else:
                        badge_color = RGBColor(192, 0, 0)
                        badge_text = "High Risk"

                    badge = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, left, top, width, height)
                    badge.fill.solid()
                    badge.fill.fore_color.rgb = badge_color
                    badge.line.color.rgb = badge_color

                    btf = badge.text_frame
                    btf.clear()
                    p = btf.paragraphs[0]
                    p.alignment = PP_ALIGN.CENTER
                    run = p.add_run()
                    run.text = badge_text
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
                    run.font.size = Pt(14)
                    continue

                # KPI placeholders are expected to be exact-text; handled by replace_placeholders().

                # FIX 4.1: Risk list -> max 5 clean bullets (no labels)
                if _text_frame_contains(tf, "{{RISK_LIST}}"):
                    cleaned = []
                    for x in (risk_items or []):
                        t = str(x or "").strip()
                        if not t:
                            continue
                        t = re.sub(r"\s*[\-–]\s*(Warning|Review)\b.*$", "", t, flags=re.IGNORECASE).strip()
                        t = re.sub(r"\b(Warning|Review)\b\s*[:\-–]?\s*", "", t, flags=re.IGNORECASE).strip()
                        if t:
                            cleaned.append(t)
                    cleaned = cleaned[:5]
                    _apply_bullets(tf, [f"• {x}" for x in cleaned])
                    continue

                if _text_frame_contains(tf, "{{ASSUMPTIONS_LIST}}"):
                    _apply_bullets(tf, assumptions_items)
                    continue

                # FIX 5: Delivery phases replaced individually (only placeholders present in this shape)
                if (
                    _text_frame_contains(tf, "{{PHASE_1}}")
                    or _text_frame_contains(tf, "{{PHASE_2}}")
                    or _text_frame_contains(tf, "{{PHASE_3}}")
                    or _text_frame_contains(tf, "{{PHASE_4}}")
                ):
                    _replace_placeholders_in_text_frame(tf, {
                        "{{PHASE_1}}": replacements.get("{{PHASE_1}}", ""),
                        "{{PHASE_2}}": replacements.get("{{PHASE_2}}", ""),
                        "{{PHASE_3}}": replacements.get("{{PHASE_3}}", ""),
                        "{{PHASE_4}}": replacements.get("{{PHASE_4}}", ""),
                    })
                    continue

            # Risk & assumptions bullets and delivery timeline (table cells)
            if getattr(shape, "has_table", False):
                try:
                    for r in range(len(shape.table.rows)):
                        for c in range(len(shape.table.columns)):
                            tf = shape.table.cell(r, c).text_frame
                            # Exact-text cell placeholders handled by table replacement or text frame exact replacement.
                            if _text_frame_contains(tf, "{{RISK_LIST}}"):
                                cleaned = []
                                for x in (risk_items or []):
                                    t = str(x or "").strip()
                                    if not t:
                                        continue
                                    t = re.sub(r"\s*[\-–]\s*(Warning|Review)\b.*$", "", t, flags=re.IGNORECASE).strip()
                                    t = re.sub(r"\b(Warning|Review)\b\s*[:\-–]?\s*", "", t, flags=re.IGNORECASE).strip()
                                    if t:
                                        cleaned.append(t)
                                cleaned = cleaned[:5]
                                _apply_bullets(tf, [f"• {x}" for x in cleaned])
                            if _text_frame_contains(tf, "{{ASSUMPTIONS_LIST}}"):
                                _apply_bullets(tf, assumptions_items)
                            if (
                                _text_frame_contains(tf, "{{PHASE_1}}")
                                or _text_frame_contains(tf, "{{PHASE_2}}")
                                or _text_frame_contains(tf, "{{PHASE_3}}")
                                or _text_frame_contains(tf, "{{PHASE_4}}")
                            ):
                                _replace_placeholders_in_text_frame(tf, {
                                    "{{PHASE_1}}": replacements.get("{{PHASE_1}}", ""),
                                    "{{PHASE_2}}": replacements.get("{{PHASE_2}}", ""),
                                    "{{PHASE_3}}": replacements.get("{{PHASE_3}}", ""),
                                    "{{PHASE_4}}": replacements.get("{{PHASE_4}}", ""),
                                })
                except Exception:
                    pass

    # Safe placeholder replacement pass (run-level only)
    replace_placeholders(prs, replacements)
    # Replace placeholders inside table cells too
    for slide in prs.slides:
        for shape in _iter_slide_shapes(slide):
            _replace_placeholders_in_table_cells(shape, replacements)

    # Do not perform partial brace-stripping replacements; rely on exact placeholder mapping.

    out = BytesIO()
    prs.save(out)
    out.seek(0)

    # Final cleanup pass: warn if any placeholders remain
    for slide in prs.slides:
        for shape in _iter_slide_shapes(slide):
            if getattr(shape, "has_text_frame", False):
                try:
                    if "{{" in (shape.text or ""):
                        print("WARNING: Unreplaced placeholder found:", shape.text)
                except Exception:
                    pass
            if getattr(shape, "has_table", False):
                try:
                    for r in range(len(shape.table.rows)):
                        for c in range(len(shape.table.columns)):
                            cell_text = shape.table.cell(r, c).text
                            if "{{" in (cell_text or ""):
                                print("WARNING: Unreplaced placeholder found:", cell_text)
                except Exception:
                    pass

    print("PPT Export completed successfully.")

    headers = {
        "Content-Disposition": f'attachment; filename="RFP_Response_{rfp_id}.pptx"'
    }

    return StreamingResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers=headers,
    )
