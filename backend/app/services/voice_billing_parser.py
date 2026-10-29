"""Voice billing command parser and product matcher service.

Extracts requested product name, quantity, and unit from voice billing commands.
Performs intelligent matching against the authenticated shop's active product catalog.
Handles multilingual number words (English, Hindi, Marathi), fractional quantities,
unit canonicalization, and unit conversions.
"""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Product
from app.schemas.voice_billing import (
    VoiceBillingMatchedProduct,
    VoiceBillingParseResponse,
)
from app.services.voice_product_parser import SUPPORTED_UNITS_MAP

# Multilingual number words mapped to Decimal values
NUMBER_WORDS: dict[str, Decimal] = {
    # English numbers
    "zero": Decimal("0"),
    "a": Decimal("1"),
    "an": Decimal("1"),
    "one": Decimal("1"),
    "two": Decimal("2"),
    "three": Decimal("3"),
    "four": Decimal("4"),
    "five": Decimal("5"),
    "six": Decimal("6"),
    "seven": Decimal("7"),
    "eight": Decimal("8"),
    "nine": Decimal("9"),
    "ten": Decimal("10"),
    "eleven": Decimal("11"),
    "twelve": Decimal("12"),
    "thirteen": Decimal("13"),
    "fourteen": Decimal("14"),
    "fifteen": Decimal("15"),
    "sixteen": Decimal("16"),
    "seventeen": Decimal("17"),
    "eighteen": Decimal("18"),
    "nineteen": Decimal("19"),
    "twenty": Decimal("20"),
    "thirty": Decimal("30"),
    "forty": Decimal("40"),
    "fifty": Decimal("50"),
    "sixty": Decimal("60"),
    "seventy": Decimal("70"),
    "eighty": Decimal("80"),
    "ninety": Decimal("90"),
    "hundred": Decimal("100"),
    "half": Decimal("0.5"),
    "quarter": Decimal("0.25"),
    # Hindi / Hinglish numbers & fractions
    "ek": Decimal("1"),
    "do": Decimal("2"),
    "teen": Decimal("3"),
    "tin": Decimal("3"),
    "chaar": Decimal("4"),
    "char": Decimal("4"),
    "paanch": Decimal("5"),
    "panch": Decimal("5"),
    "chhe": Decimal("6"),
    "chhah": Decimal("6"),
    "saat": Decimal("7"),
    "sat": Decimal("7"),
    "aath": Decimal("8"),
    "ath": Decimal("8"),
    "nau": Decimal("9"),
    "das": Decimal("10"),
    "gyarah": Decimal("11"),
    "baarah": Decimal("12"),
    "aadha": Decimal("0.5"),
    "adha": Decimal("0.5"),
    "paav": Decimal("0.25"),
    "pav": Decimal("0.25"),
    "dedh": Decimal("1.5"),
    "dhai": Decimal("2.5"),
    "sawa": Decimal("1.25"),
    # Marathi numbers & fractions
    "don": Decimal("2"),
    "daha": Decimal("10"),
    "ardha": Decimal("0.5"),
    "nav": Decimal("9"),
}

# Action prefix words to strip from beginning of commands
ACTION_PREFIXES = [
    r"^please\s+add\s+",
    r"^can\s+you\s+add\s+",
    r"^add\s+",
    r"^put\s+",
    r"^take\s+",
    r"^give\s+",
    r"^buy\s+",
    r"^plus\s+",
    r"^karo\s+add\s+",
]

# Action suffix words to strip from end of commands
ACTION_SUFFIXES = [
    r"\s+add\s*karo$",
    r"\s+karo\s*add$",
    r"\s+add\s*kara$",
    r"\s+daalo$",
    r"\s+dalo$",
    r"\s+taka$",
    r"\s+ghya$",
    r"\s+dya$",
    r"\s+joda$",
    r"\s+chahiye$",
    r"\s+pahije$",
    r"\s+please$",
]


def normalize_text(text: str) -> str:
    """Normalize whitespace and strip peripheral punctuation."""
    t = text.strip()
    t = re.sub(r"[\.,;!?]+$", "", t).strip()
    t = re.sub(r"^[\.,;!?]+", "", t).strip()
    t = re.sub(r"\s+", " ", t)
    return t


def strip_command_action_phrases(command: str) -> str:
    """Remove conversational prefix and suffix markers."""
    clean = normalize_text(command)
    for p in ACTION_PREFIXES:
        clean = re.sub(p, "", clean, flags=re.IGNORECASE).strip()
    for s in ACTION_SUFFIXES:
        clean = re.sub(s, "", clean, flags=re.IGNORECASE).strip()
    return clean


def parse_number_token(token: str) -> Optional[Decimal]:
    """Parse numeric token from digits, fractions, or number words."""
    clean_tok = token.strip().lower()
    # Check number words map
    if clean_tok in NUMBER_WORDS:
        return NUMBER_WORDS[clean_tok]
    # Check fraction e.g. 1/2 or 1/4
    if "/" in clean_tok:
        parts = clean_tok.split("/")
        if len(parts) == 2:
            try:
                num = Decimal(parts[0].strip())
                den = Decimal(parts[1].strip())
                if den != 0:
                    return (num / den).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
            except (InvalidOperation, ZeroDivisionError):
                pass
    # Check regular decimal/integer
    try:
        val = Decimal(clean_tok)
        return val.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    except InvalidOperation:
        return None


def extract_billing_command_elements(command: str) -> Tuple[str, Decimal, Optional[str]]:
    """
    Extract (product_name, quantity, canonical_unit) from raw speech command.
    
    Supports formats:
    - Format A (Product first): "sugar 2 kg", "cooking oil 2 litres", "Parle-G 3 packets", "tea half kg"
    - Format B (Quantity first): "5 packets of biscuits", "500 grams of turmeric", "2 litres of cooking oil", "2 kg sugar"
    - Default fallback: product name only, quantity=1, unit=None
    """
    clean = strip_command_action_phrases(command)

    # 1. Check Format B with leading quantity & unit:
    # Example: "five packets of biscuits", "500 grams of turmeric", "two litres of cooking oil", "2 kg sugar"
    # Matches: [quantity] [unit]? (of)? [product_name]
    unit_keys = sorted(SUPPORTED_UNITS_MAP.keys(), key=len, reverse=True)
    unit_pattern = r"(?:" + "|".join(re.escape(k) for k in unit_keys) + r")"
    
    # Pattern B1: Leading number + explicit unit + optional 'of' + product
    # e.g. "five packets of biscuits", "500 grams of turmeric", "2 kg sugar"
    m_lead_unit = re.match(
        rf"^([a-zA-Z0-9_\./]+)\s+({unit_pattern})\s+(?:of\s+)?(.+)$",
        clean,
        flags=re.IGNORECASE,
    )
    if m_lead_unit:
        num_part = m_lead_unit.group(1).strip()
        raw_unit = m_lead_unit.group(2).strip().lower()
        prod_part = m_lead_unit.group(3).strip()
        parsed_num = parse_number_token(num_part)
        if parsed_num is not None and parsed_num > 0 and prod_part:
            canonical_unit = SUPPORTED_UNITS_MAP.get(raw_unit, raw_unit)
            # Remove any trailing "of" or filler
            prod_clean = re.sub(r"^(?:of\s+)", "", prod_part, flags=re.IGNORECASE).strip()
            return prod_clean, parsed_num, canonical_unit

    # Pattern B2: Leading number without space to unit, e.g. "2kg sugar" or "500g turmeric"
    m_lead_compact = re.match(
        rf"^(\d+(?:\.\d+)?)\s*({unit_pattern})\s+(?:of\s+)?(.+)$",
        clean,
        flags=re.IGNORECASE,
    )
    if m_lead_compact:
        num_part = m_lead_compact.group(1).strip()
        raw_unit = m_lead_compact.group(2).strip().lower()
        prod_part = m_lead_compact.group(3).strip()
        parsed_num = parse_number_token(num_part)
        if parsed_num is not None and parsed_num > 0 and prod_part:
            canonical_unit = SUPPORTED_UNITS_MAP.get(raw_unit, raw_unit)
            prod_clean = re.sub(r"^(?:of\s+)", "", prod_part, flags=re.IGNORECASE).strip()
            return prod_clean, parsed_num, canonical_unit

    # Pattern B3: Leading number + product without explicit unit, e.g. "five biscuits", "3 soaps"
    m_lead_nounit = re.match(
        r"^([a-zA-Z0-9_\./]+)\s+(?:packets?\s+of\s+|pieces?\s+of\s+|of\s+)?(.+)$",
        clean,
        flags=re.IGNORECASE,
    )
    if m_lead_nounit:
        num_part = m_lead_nounit.group(1).strip()
        prod_part = m_lead_nounit.group(2).strip()
        parsed_num = parse_number_token(num_part)
        if parsed_num is not None and parsed_num > 0 and prod_part:
            prod_clean = re.sub(r"^(?:of\s+)", "", prod_part, flags=re.IGNORECASE).strip()
            return prod_clean, parsed_num, None

    # 2. Check Format A with trailing quantity & unit:
    # Example: "sugar 2 kg", "cooking oil two litres", "turmeric 500 grams", "sugar 2kg"
    # Pattern A1: Product + number + unit
    m_trail_unit = re.search(
        rf"^(.+?)\s+([a-zA-Z0-9_\./]+)\s+({unit_pattern})$",
        clean,
        flags=re.IGNORECASE,
    )
    if m_trail_unit:
        prod_part = m_trail_unit.group(1).strip()
        num_part = m_trail_unit.group(2).strip()
        raw_unit = m_trail_unit.group(3).strip().lower()
        parsed_num = parse_number_token(num_part)
        if parsed_num is not None and parsed_num > 0 and prod_part:
            canonical_unit = SUPPORTED_UNITS_MAP.get(raw_unit, raw_unit)
            return prod_part, parsed_num, canonical_unit

    # Pattern A2: Product + compact number-unit (e.g. "sugar 2kg")
    m_trail_compact = re.search(
        rf"^(.+?)\s+(\d+(?:\.\d+)?)\s*({unit_pattern})$",
        clean,
        flags=re.IGNORECASE,
    )
    if m_trail_compact:
        prod_part = m_trail_compact.group(1).strip()
        num_part = m_trail_compact.group(2).strip()
        raw_unit = m_trail_compact.group(3).strip().lower()
        parsed_num = parse_number_token(num_part)
        if parsed_num is not None and parsed_num > 0 and prod_part:
            canonical_unit = SUPPORTED_UNITS_MAP.get(raw_unit, raw_unit)
            return prod_part, parsed_num, canonical_unit

    # Pattern A3: Product + trailing number only (e.g. "sugar 2", "Parle-G five")
    m_trail_nounit = re.search(
        r"^(.+?)\s+([a-zA-Z0-9_\./]+)$",
        clean,
        flags=re.IGNORECASE,
    )
    if m_trail_nounit:
        prod_part = m_trail_nounit.group(1).strip()
        num_part = m_trail_nounit.group(2).strip()
        parsed_num = parse_number_token(num_part)
        if parsed_num is not None and parsed_num > 0 and prod_part:
            return prod_part, parsed_num, None

    # Fallback: Treat whole string as product name with default quantity 1
    return clean, Decimal("1.000"), None


def convert_quantity_to_product_unit(
    parsed_quantity: Decimal,
    parsed_unit: Optional[str],
    product_unit: str,
) -> Decimal:
    """
    Convert requested quantity into the product's database measurement unit.
    
    Examples:
    - Customer requests 500 grams, product is priced/measured in kg -> 0.500 kg
    - Customer requests 2 kg, product is measured in grams -> 2000.000 g
    - Customer requests 500 ml, product is measured in litres -> 0.500 litre
    - Customer requests 2 litres, product is measured in ml -> 2000.000 ml
    - Customer requests 2 dozen, product is measured in pieces -> 24.000 pcs
    - Customer requests 5 packets, product is measured in packet -> 5.000 packet
    """
    if not parsed_unit:
        return parsed_quantity.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)

    p_unit = product_unit.strip().lower()
    c_unit = parsed_unit.strip().lower()

    # Standardize variations
    kg_units = {"kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"}
    g_units = {"g", "gm", "gms", "gram", "grams"}
    l_units = {"l", "litre", "litres", "liter", "liters", "ltr", "ltrs"}
    ml_units = {"ml", "mls", "milliliter", "millilitre"}
    pcs_units = {"pc", "pcs", "piece", "pieces", "unit", "units"}
    pkt_units = {"packet", "packets", "pkt", "pkts", "pack", "packs"}

    # Weight conversions
    if c_unit in g_units and p_unit in kg_units:
        return (parsed_quantity / Decimal("1000")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    if c_unit in kg_units and p_unit in g_units:
        return (parsed_quantity * Decimal("1000")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)

    # Volume conversions
    if c_unit in ml_units and p_unit in l_units:
        return (parsed_quantity / Decimal("1000")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    if c_unit in l_units and p_unit in ml_units:
        return (parsed_quantity * Decimal("1000")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)

    # Dozen conversion
    if c_unit in {"dozen", "dozens"} and p_unit in pcs_units:
        return (parsed_quantity * Decimal("12")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)

    # Direct match or compatible packaging units
    return parsed_quantity.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def calculate_match_score(query: str, product_name: str, barcode: Optional[str]) -> int:
    """Calculate similarity score (0 to 100) between user query and product catalog item."""
    q = query.strip().lower()
    p = product_name.strip().lower()
    
    # Direct exact match
    if q == p:
        return 100
    
    # Exact barcode match
    if barcode and q == barcode.strip().lower():
        return 100

    # Stem / plural match (e.g. "biscuit" vs "biscuits", "oil" vs "oils")
    if q.rstrip("s") == p.rstrip("s"):
        return 95

    # Word boundary match (e.g. query "sugar" matches "Sugar 1kg" or "White Sugar")
    if re.search(rf"\b{re.escape(q)}\b", p):
        # Prefer closer length match
        len_penalty = min(20, abs(len(p) - len(q)))
        return 90 - len_penalty

    # Substring match (query is inside product name or product name inside query)
    if q in p or p in q:
        len_penalty = min(25, abs(len(p) - len(q)))
        return 80 - len_penalty

    # Word token matching
    q_words = set(re.findall(r"\w+", q))
    p_words = set(re.findall(r"\w+", p))
    if q_words and p_words:
        common = q_words.intersection(p_words)
        if len(common) == len(q_words):
            # All query words present in product name (e.g. "cooking oil" in "Fortune Cooking Oil")
            return 75
        if common:
            # Partial word overlap
            ratio = len(common) / max(len(q_words), len(p_words))
            return int(ratio * 60)

    return 0


def parse_voice_billing_command(
    command: str,
    shop_id: int,
    db: Session,
) -> VoiceBillingParseResponse:
    """
    Parse a voice billing command and match against the shop's active product catalog.
    
    Returns structured result with:
    - parsed_product_name: extracted product name
    - parsed_quantity: extracted quantity requested by user
    - parsed_unit: extracted measurement unit
    - resolved_quantity: unit-converted quantity suitable for billing cart
    - match_type: "exact" | "multiple" | "none"
    - matches: list of VoiceBillingMatchedProduct (empty if none)
    - message: human-readable explanation
    """
    if not command or not command.strip():
        return VoiceBillingParseResponse(
            command="",
            parsed_product_name="",
            parsed_quantity=Decimal("1.000"),
            parsed_unit=None,
            resolved_quantity=Decimal("1.000"),
            match_type="none",
            matches=[],
            message="Voice command was empty. Please speak a command like 'Add sugar 2 kg'.",
        )

    product_query, parsed_qty, parsed_unit = extract_billing_command_elements(command)

    # Fetch active products for the authenticated user's shop
    raw_products = (
        db.query(Product, Category.name.label("category_name"))
        .outerjoin(Category, Product.category_id == Category.id)
        .filter(Product.shop_id == shop_id, Product.is_active == True)
        .all()
    )

    scored_candidates: List[Tuple[int, Product, Optional[str]]] = []
    for prod, cat_name in raw_products:
        score = calculate_match_score(product_query, prod.name, prod.barcode)
        # Require meaningful similarity threshold (>= 45) to prevent spurious single-token overlaps
        if score >= 45:
            scored_candidates.append((score, prod, cat_name))

    # Sort candidates by score descending, stock descending, then by name length
    scored_candidates.sort(key=lambda x: (x[0], x[1].stock_quantity, -len(x[1].name)), reverse=True)

    if not scored_candidates:
        return VoiceBillingParseResponse(
            command=command,
            parsed_product_name=product_query,
            parsed_quantity=parsed_qty,
            parsed_unit=parsed_unit,
            resolved_quantity=parsed_qty,
            match_type="none",
            matches=[],
            message=f"Product '{product_query}' not found in your shop catalog.",
        )

    # Deduplicate candidates with identical name, selling price, and unit
    unique_candidates: List[Tuple[int, Product, Optional[str]]] = []
    seen_keys = set()
    for score, prod, cat_name in scored_candidates:
        key = (prod.name.strip().lower(), prod.selling_price, prod.unit)
        if key not in seen_keys:
            seen_keys.add(key)
            unique_candidates.append((score, prod, cat_name))

    top_score = unique_candidates[0][0]
    distinct_names = {c[1].name.strip().lower() for c in unique_candidates}

    # Determine whether we have an unambiguous exact match or multiple choices:
    # Exact match criteria:
    # 1. Only 1 unique candidate found
    # 2. Or only 1 distinct product name found in catalog matching the query
    # 3. Or top candidate has score >= 90 and second candidate is significantly lower (diff >= 20)
    # 4. Or top candidate is a 100% exact match and next candidate is not 100%
    is_exact = False
    if len(unique_candidates) == 1:
        is_exact = True
    elif len(distinct_names) == 1 and top_score >= 60:
        is_exact = True
    elif len(unique_candidates) > 1 and top_score >= 90 and (top_score - unique_candidates[1][0] >= 20):
        is_exact = True
    elif len(unique_candidates) > 1 and top_score == 100 and unique_candidates[1][0] < 100:
        is_exact = True

    if is_exact:
        best_score, best_prod, cat_name = unique_candidates[0]
        resolved_qty = convert_quantity_to_product_unit(parsed_qty, parsed_unit, best_prod.unit)
        matched_item = VoiceBillingMatchedProduct(
            id=best_prod.id,
            name=best_prod.name,
            category_id=best_prod.category_id,
            category_name=cat_name,
            selling_price=best_prod.selling_price,
            pack_size=best_prod.pack_size,
            unit=best_prod.unit,
            stock_quantity=best_prod.stock_quantity,
            low_stock_threshold=best_prod.low_stock_threshold,
            barcode=best_prod.barcode,
            is_active=best_prod.is_active,
        )
        return VoiceBillingParseResponse(
            command=command,
            parsed_product_name=product_query,
            parsed_quantity=parsed_qty,
            parsed_unit=parsed_unit,
            resolved_quantity=resolved_qty,
            match_type="exact",
            matches=[matched_item],
            message=f"Matched '{best_prod.name}' ({resolved_qty} {best_prod.unit}).",
        )

    # Multiple matching candidates
    # Return top matches (up to 8)
    top_matches = unique_candidates[:8]
    matched_items = []
    # Use first product for default resolved_quantity estimation
    default_resolved = convert_quantity_to_product_unit(parsed_qty, parsed_unit, top_matches[0][1].unit)

    for score, prod, cat_name in top_matches:
        matched_items.append(
            VoiceBillingMatchedProduct(
                id=prod.id,
                name=prod.name,
                category_id=prod.category_id,
                category_name=cat_name,
                selling_price=prod.selling_price,
                pack_size=prod.pack_size,
                unit=prod.unit,
                stock_quantity=prod.stock_quantity,
                low_stock_threshold=prod.low_stock_threshold,
                barcode=prod.barcode,
                is_active=prod.is_active,
            )
        )

    return VoiceBillingParseResponse(
        command=command,
        parsed_product_name=product_query,
        parsed_quantity=parsed_qty,
        parsed_unit=parsed_unit,
        resolved_quantity=default_resolved,
        match_type="multiple",
        matches=matched_items,
        message=f"Found {len(matched_items)} matching products for '{product_query}'. Please select the intended product.",
    )
