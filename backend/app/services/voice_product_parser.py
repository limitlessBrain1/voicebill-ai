"""Voice product command parser service.

Deterministically extracts structured product attributes from speech-to-text transcripts
without external AI calls or database modifications.
"""
from decimal import Decimal, InvalidOperation
import re
from typing import Any, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.category import Category
from app.schemas.voice_product import VoiceProductParseResponse

# Canonical dictionary of supported measurement and packaging units
SUPPORTED_UNITS_MAP = {
    # Weight
    "kg": "kg",
    "kgs": "kg",
    "kilo": "kg",
    "kilos": "kg",
    "kilogram": "kg",
    "kilograms": "kg",
    "g": "g",
    "gm": "g",
    "gms": "g",
    "gram": "g",
    "grams": "g",
    "mg": "mg",
    "milligram": "mg",
    "milligrams": "mg",
    "quintal": "quintal",
    "ton": "ton",
    "tonne": "ton",
    # Volume
    "litre": "litre",
    "litres": "litre",
    "liter": "liter",
    "liters": "liter",
    "l": "l",
    "ltr": "ltr",
    "ltrs": "ltr",
    "ml": "ml",
    "mls": "ml",
    "milliliter": "ml",
    "millilitre": "ml",
    # Count / Packaging
    "piece": "piece",
    "pieces": "pieces",
    "pc": "pcs",
    "pcs": "pcs",
    "packet": "packet",
    "packets": "packet",
    "pkt": "packet",
    "pkts": "packet",
    "pack": "pack",
    "packs": "pack",
    "pouch": "pouch",
    "pouches": "pouch",
    "box": "box",
    "boxes": "box",
    "bottle": "bottle",
    "bottles": "bottle",
    "can": "can",
    "cans": "can",
    "jar": "jar",
    "jars": "jar",
    "tin": "tin",
    "tins": "tin",
    "tub": "tub",
    "tubs": "tub",
    "bag": "bag",
    "bags": "bag",
    "sack": "sack",
    "sacks": "sack",
    "carton": "carton",
    "cartons": "carton",
    "dozen": "dozen",
    "dozens": "dozen",
    "strip": "strip",
    "strips": "strip",
    "bar": "bar",
    "bars": "bar",
    "bundle": "bundle",
    "bundles": "bundle",
    "meter": "meter",
    "meters": "meter",
    "m": "meter",
    "roll": "roll",
    "rolls": "roll",
    "unit": "unit",
    "units": "unit",
}

KEYWORD_PREFIXES = {
    "purchase",
    "selling",
    "stock",
    "quantity",
    "price",
    "category",
    "barcode",
    "low",
    "min",
    "minimum",
    "cost",
    "buying",
    "sale",
    "mrp",
    "upc",
    "ean",
}


class VoiceProductParseError(Exception):
    """Raised when voice command text cannot be parsed or fails semantic validation."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def parse_decimal_value(raw_val: str, field_name: str) -> Decimal:
    """Parse raw string into Decimal, handling currency symbols and sign."""
    clean = raw_val.strip().rstrip(",;.")
    clean = re.sub(r"^(?:₹|rs\.?|\$)\s*", "", clean, flags=re.IGNORECASE).strip()
    try:
        val = Decimal(clean)
        return val
    except InvalidOperation:
        raise VoiceProductParseError(f"Invalid {field_name}: '{raw_val}'. Must be a valid number.")


def parse_voice_product_command(
    command: str,
    shop_id: Optional[int] = None,
    db: Optional[Session] = None,
) -> VoiceProductParseResponse:
    """
    Parse a voice command into structured product information.
    
    Validates:
    - Product name presence
    - Pack size presence / default to 1 and positivity
    - Unit presence and validity against SUPPORTED_UNITS_MAP
    - Purchase price non-negativity and valid decimal
    - Selling price non-negativity and valid decimal
    - Stock quantity non-negativity and valid decimal
    - Optional low stock threshold non-negativity
    - Optional category name
    - Optional barcode
    
    Does NOT write or commit anything to the database.
    """
    if not command or not command.strip():
        raise VoiceProductParseError("Voice command cannot be empty.")

    text = command.strip()
    text = re.sub(r"[;\.]+$", "", text).strip()

    spans: List[Tuple[int, int]] = []

    # 1. Purchase price
    purchase_price_val: Optional[Decimal] = None
    m_purch = re.search(
        r"(?i)\b(?:purchase\s*price|purchase\s*rate|cost\s*price|buying\s*price)\s*(?:is|of|:)?\s*(-?\s*[^\s,;]+)",
        text,
    )
    if m_purch:
        spans.append(m_purch.span())
        raw = m_purch.group(1).replace(" ", "")
        val = parse_decimal_value(raw, "purchase price")
        if val < 0:
            raise VoiceProductParseError(f"Purchase price cannot be negative ({val}).")
        purchase_price_val = val

    # 2. Selling price
    selling_price_val: Optional[Decimal] = None
    m_sell = re.search(
        r"(?i)\b(?:selling\s*price|sale\s*price|sell\s*price|selling\s*rate|mrp)\s*(?:is|of|:)?\s*(-?\s*[^\s,;]+)",
        text,
    )
    if m_sell:
        spans.append(m_sell.span())
        raw = m_sell.group(1).replace(" ", "")
        val = parse_decimal_value(raw, "selling price")
        if val < 0:
            raise VoiceProductParseError(f"Selling price cannot be negative ({val}).")
        selling_price_val = val

    # 3. Low stock threshold (optional) - checked before general stock
    low_stock_val: Optional[Decimal] = None
    m_low = re.search(
        r"(?i)\b(?:low\s*stock\s*threshold|low\s*stock\s*alert|low\s*stock|minimum\s*stock|min\s*stock)\s*(?:is|of|:)?\s*(-?\s*[^\s,;]+)",
        text,
    )
    if m_low:
        spans.append(m_low.span())
        raw = m_low.group(1).replace(" ", "")
        val = parse_decimal_value(raw, "low stock threshold")
        if val < 0:
            raise VoiceProductParseError(f"Low stock threshold cannot be negative ({val}).")
        low_stock_val = val

    # 4. Stock quantity
    stock_quantity_val: Optional[Decimal] = None
    stock_unit_candidate: Optional[str] = None
    m_stock = re.search(
        r"(?i)\b(?:stock\s*quantity|stock\s*qty|stock|quantity|qty)\s*(?:is|of|:)?\s*(-?\s*[^\s,;]+)(?:\s*([a-zA-Z]+))?",
        text,
    )
    if m_stock:
        # Avoid overlapping with low stock match
        if not (m_low and m_stock.start() >= m_low.start() and m_stock.end() <= m_low.end()):
            spans.append(m_stock.span())
            raw = m_stock.group(1).replace(" ", "")
            val = parse_decimal_value(raw, "stock quantity")
            if val < 0:
                raise VoiceProductParseError(f"Stock quantity cannot be negative ({val}).")
            stock_quantity_val = val
            if m_stock.group(2):
                stock_unit_candidate = m_stock.group(2).strip().lower()

    # 5. Category (optional)
    category_name_val: Optional[str] = None
    m_cat = re.search(
        r"(?i)\b(?:category\s*name|category)\s*(?:is|:)?\s*([^,;]+)",
        text,
    )
    if m_cat:
        spans.append(m_cat.span())
        category_name_val = m_cat.group(1).strip()
        category_name_val = re.sub(r"[;\.]+$", "", category_name_val).strip()

    # 6. Barcode (optional)
    barcode_val: Optional[str] = None
    m_bar = re.search(
        r"(?i)\b(?:barcode\s*number|barcode|bar\s*code|upc|ean)\s*(?:is|:)?\s*([a-zA-Z0-9_-]+)",
        text,
    )
    if m_bar:
        spans.append(m_bar.span())
        barcode_val = m_bar.group(1).strip()

    # 7. Pack size & Unit detection
    pack_size_val: Optional[Decimal] = None
    unit_val: Optional[str] = None

    # 7a. Explicit "pack size <num> <unit>" or "pack of <num> <unit>"
    m_explicit_pack = re.search(
        r"(?i)\b(?:pack\s*size|pack\s*of|packet\s*size|package\s*size)\s*(?:is|:)?\s*(-?\s*\d+(?:\.\d+)?)\s*([a-zA-Z]+)?",
        text,
    )
    if m_explicit_pack:
        spans.append(m_explicit_pack.span())
        raw_qty = m_explicit_pack.group(1).replace(" ", "")
        val = parse_decimal_value(raw_qty, "pack size")
        if val <= 0:
            raise VoiceProductParseError(f"Pack size must be greater than zero ({val}).")
        pack_size_val = val
        if m_explicit_pack.group(2):
            raw_u = m_explicit_pack.group(2).strip().lower()
            if raw_u not in SUPPORTED_UNITS_MAP:
                raise VoiceProductParseError(f"Unsupported or unknown unit: '{raw_u}'.")
            unit_val = SUPPORTED_UNITS_MAP[raw_u]

    # 7b. Explicit unit keyword: e.g. "unit kg", "unit: packet", "unit elephant"
    m_unit = re.search(
        r"(?i)\bunit\s*(?:is|:)?\s*([a-zA-Z]+)",
        text,
    )
    if m_unit:
        spans.append(m_unit.span())
        raw_u = m_unit.group(1).strip().lower()
        if raw_u not in SUPPORTED_UNITS_MAP:
            raise VoiceProductParseError(f"Unsupported or unknown unit: '{raw_u}'.")
        unit_val = SUPPORTED_UNITS_MAP[raw_u]

    # 7c. Check comma segments for pack size + unit (e.g. "4 kg", "1 litre", "500 g", "1 elephant")
    if "," in text:
        segments = [s.strip() for s in text.split(",") if s.strip()]
        for seg in segments[1:]:
            seg_clean = re.sub(r"[;\.]+$", "", seg).strip()
            # Match "<num> <unit>"
            m_seg_pack = re.match(r"^(-?\s*\d+(?:\.\d+)?)\s+([a-zA-Z]+)$", seg_clean)
            if m_seg_pack:
                cand_qty_str = m_seg_pack.group(1).replace(" ", "")
                cand_unit = m_seg_pack.group(2).lower()
                if cand_unit not in KEYWORD_PREFIXES:
                    m_in_text = re.search(r"\b" + re.escape(seg_clean) + r"\b", text)
                    if m_in_text:
                        spans.append(m_in_text.span())
                    if cand_unit not in SUPPORTED_UNITS_MAP:
                        raise VoiceProductParseError(f"Unsupported or unknown unit: '{cand_unit}'.")
                    val = parse_decimal_value(cand_qty_str, "pack size")
                    if val <= 0:
                        raise VoiceProductParseError(f"Pack size must be greater than zero ({val}).")
                    if pack_size_val is None:
                        pack_size_val = val
                    if not unit_val:
                        unit_val = SUPPORTED_UNITS_MAP[cand_unit]
            else:
                m_seg_unit_only = re.match(r"^([a-zA-Z]+)$", seg_clean)
                if m_seg_unit_only:
                    cand_unit = m_seg_unit_only.group(1).lower()
                    if cand_unit not in KEYWORD_PREFIXES:
                        m_in_text = re.search(r"\b" + re.escape(seg_clean) + r"\b", text)
                        if m_in_text:
                            spans.append(m_in_text.span())
                        if cand_unit not in SUPPORTED_UNITS_MAP:
                            raise VoiceProductParseError(f"Unsupported or unknown unit: '{cand_unit}'.")
                        if not unit_val:
                            unit_val = SUPPORTED_UNITS_MAP[cand_unit]

    # 7d. Check for pattern: number + unit (e.g. "4 kg", "1 litre", "500 g") not inside other spans
    for m_pack in re.finditer(r"(?<![a-zA-Z0-9_.-])(-?\s*\d+(?:\.\d+)?)\s*([a-zA-Z]+)\b", text):
        pack_span = m_pack.span()
        inside_other = any(s[0] <= pack_span[0] and pack_span[1] <= s[1] for s in spans)
        if not inside_other:
            cand_unit = m_pack.group(2).lower()
            if cand_unit in SUPPORTED_UNITS_MAP:
                spans.append(pack_span)
                cand_qty_str = m_pack.group(1).replace(" ", "")
                val = parse_decimal_value(cand_qty_str, "pack size")
                if val <= 0:
                    raise VoiceProductParseError(f"Pack size must be greater than zero ({val}).")
                if pack_size_val is None:
                    pack_size_val = val
                if not unit_val:
                    unit_val = SUPPORTED_UNITS_MAP[cand_unit]

    # 7e. Fallback to unit attached to stock (e.g. "stock 20 kg" or "stock 20 litre")
    if stock_unit_candidate:
        if stock_unit_candidate not in SUPPORTED_UNITS_MAP:
            raise VoiceProductParseError(f"Unsupported or unknown unit: '{stock_unit_candidate}'.")
        if not unit_val:
            unit_val = SUPPORTED_UNITS_MAP[stock_unit_candidate]

    # Default pack_size to 1 if no explicit pack size was specified
    if pack_size_val is None:
        pack_size_val = Decimal("1")
    elif pack_size_val <= 0:
        raise VoiceProductParseError(f"Pack size must be greater than zero ({pack_size_val}).")

    # 8. Extract Product Name
    earliest_field_pos = len(text)
    for s in spans:
        if s[0] < earliest_field_pos:
            earliest_field_pos = s[0]

    raw_name_part = text[:earliest_field_pos].strip()

    # Remove leading command words: "Add product", "Add", "Create product", "Create", "New product", "Insert product"
    m_cmd = re.match(
        r"(?i)^(?:add\s+product|add|create\s+product|create|new\s+product|insert\s+product|insert)(?:\s+|[,\s:]+|$)",
        raw_name_part,
    )
    if m_cmd:
        name_candidate = raw_name_part[m_cmd.end():].strip()
    else:
        name_candidate = raw_name_part.strip()

    # Clean punctuation from product name
    product_name = re.sub(r"^[,\s:]+|[,\s:]+$", "", name_candidate).strip()

    # 9. Validation checks: verify all required attributes are present
    missing_fields: List[str] = []
    if not product_name:
        missing_fields.append("product name")
    if not unit_val:
        missing_fields.append("unit")
    if purchase_price_val is None:
        missing_fields.append("purchase price")
    if selling_price_val is None:
        missing_fields.append("selling price")
    if stock_quantity_val is None:
        missing_fields.append("stock quantity")

    if missing_fields:
        fields_str = ", ".join(missing_fields)
        raise VoiceProductParseError(f"Required product information is missing: {fields_str}.")

    # 10. Optional category lookup (read-only) to match shop category casing if available
    if category_name_val and shop_id is not None and db is not None:
        existing_cat = (
            db.query(Category)
            .filter(
                Category.shop_id == shop_id,
                func.lower(Category.name) == category_name_val.lower(),
            )
            .first()
        )
        if existing_cat:
            category_name_val = existing_cat.name

    return VoiceProductParseResponse(
        name=product_name,
        pack_size=pack_size_val,
        unit=unit_val,
        purchase_price=purchase_price_val,
        selling_price=selling_price_val,
        stock_quantity=stock_quantity_val,
        low_stock_threshold=low_stock_val,
        category_name=category_name_val,
        barcode=barcode_val,
    )
