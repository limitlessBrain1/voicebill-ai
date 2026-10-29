"""Automated test suite for Voice Billing parsing and product matching."""
from decimal import Decimal
import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.user import User
from app.models.shop import Shop
from app.models.product import Product
from app.models.category import Category
from app.services.voice_billing_parser import (
    extract_billing_command_elements,
    convert_quantity_to_product_unit,
    parse_voice_billing_command,
)

from app.utils.jwt import create_access_token

client = TestClient(app)


def get_auth_token(user):
    return create_access_token({"sub": str(user.id)})



def setup_test_products(db, shop_id: int):
    """Ensure standard test products exist for shop_id."""
    # Ensure categories
    grocery_cat = db.query(Category).filter_by(shop_id=shop_id, name="Test Groceries").first()
    if not grocery_cat:
        grocery_cat = Category(shop_id=shop_id, name="Test Groceries")
        db.add(grocery_cat)
        db.commit()
        db.refresh(grocery_cat)

    # 1. Sugar (kg)
    sugar = db.query(Product).filter_by(shop_id=shop_id, name="Sugar").first()
    if not sugar:
        sugar = Product(
            name="Sugar",
            shop_id=shop_id,
            category_id=grocery_cat.id,
            purchase_price=Decimal("38.00"),
            selling_price=Decimal("44.00"),
            pack_size=Decimal("1.000"),
            unit="kg",
            stock_quantity=Decimal("50.000"),
            low_stock_threshold=Decimal("10.000"),
            barcode="8901234001",
            is_active=True,
        )
        db.add(sugar)

    # 2. Turmeric Powder (kg unit, but customer often buys grams)
    turmeric = db.query(Product).filter_by(shop_id=shop_id, name="Turmeric Powder").first()
    if not turmeric:
        turmeric = Product(
            name="Turmeric Powder",
            shop_id=shop_id,
            category_id=grocery_cat.id,
            purchase_price=Decimal("200.00"),
            selling_price=Decimal("260.00"),
            pack_size=Decimal("1.000"),
            unit="kg",
            stock_quantity=Decimal("25.000"),
            low_stock_threshold=Decimal("5.000"),
            barcode="8901234002",
            is_active=True,
        )
        db.add(turmeric)

    # 3. Biscuits (packet)
    biscuits = db.query(Product).filter_by(shop_id=shop_id, name="Parle-G Biscuits").first()
    if not biscuits:
        biscuits = Product(
            name="Parle-G Biscuits",
            shop_id=shop_id,
            category_id=grocery_cat.id,
            purchase_price=Decimal("8.00"),
            selling_price=Decimal("10.00"),
            pack_size=Decimal("1.000"),
            unit="packet",
            stock_quantity=Decimal("100.000"),
            low_stock_threshold=Decimal("20.000"),
            barcode="8901234003",
            is_active=True,
        )
        db.add(biscuits)

    # 4. Two cooking oils to test multiple ambiguous matches (Sunflower Oil & Mustard Oil)
    oil1 = db.query(Product).filter_by(shop_id=shop_id, name="Fortune Sunflower Oil").first()
    if not oil1:
        oil1 = Product(
            name="Fortune Sunflower Oil",
            shop_id=shop_id,
            category_id=grocery_cat.id,
            purchase_price=Decimal("120.00"),
            selling_price=Decimal("145.00"),
            pack_size=Decimal("1.000"),
            unit="litre",
            stock_quantity=Decimal("30.000"),
            low_stock_threshold=Decimal("5.000"),
            barcode="8901234004",
            is_active=True,
        )
        db.add(oil1)

    oil2 = db.query(Product).filter_by(shop_id=shop_id, name="Engine Mustard Oil").first()
    if not oil2:
        oil2 = Product(
            name="Engine Mustard Oil",
            shop_id=shop_id,
            category_id=grocery_cat.id,
            purchase_price=Decimal("130.00"),
            selling_price=Decimal("160.00"),
            pack_size=Decimal("1.000"),
            unit="litre",
            stock_quantity=Decimal("15.000"),
            low_stock_threshold=Decimal("3.000"),
            barcode="8901234005",
            is_active=True,
        )
        db.add(oil2)

    db.commit()


def run_all_voice_billing_tests():
    print("=" * 70)
    print("STARTING VOICE BILLING AUTOMATED TESTS")
    print("=" * 70)

    db = SessionLocal()
    user = db.query(User).filter_by(email="rahul@example.com").first()
    if not user:
        user = db.query(User).filter(User.role == "owner").first()
    assert user is not None, "Owner user not found"
    token = get_auth_token(user)
    headers = {"Authorization": f"Bearer {token}"}
    shop_id = user.shop_id
    setup_test_products(db, shop_id)

    passed = 0
    total = 0

    # -------------------------------------------------------------------------
    # TEST 1: Unit extraction helper
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 1: Unit extraction & command element parsing ---")
    c1, q1, u1 = extract_billing_command_elements("Add sugar 2 kg")
    assert c1.lower() == "sugar" and q1 == Decimal("2") and u1 == "kg", f"Got: {c1}, {q1}, {u1}"

    c2, q2, u2 = extract_billing_command_elements("Add five packets of biscuits")
    assert c2.lower() == "biscuits" and q2 == Decimal("5") and u2 == "packet", f"Got: {c2}, {q2}, {u2}"

    c3, q3, u3 = extract_billing_command_elements("Add 500 grams of turmeric")
    assert c3.lower() == "turmeric" and q3 == Decimal("500") and u3 == "g", f"Got: {c3}, {q3}, {u3}"

    c4, q4, u4 = extract_billing_command_elements("Add two litres of cooking oil")
    assert "cooking oil" in c4.lower() and q4 == Decimal("2") and u4 in ("litre", "liter"), f"Got: {c4}, {q4}, {u4}"

    print(f"Test 1 PASSED: Commands cleanly parsed into product, quantity, unit")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 2: Fractional and Multilingual quantities
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 2: Fractional and Hindi/Marathi quantities ---")
    c_frac1, q_frac1, u_frac1 = extract_billing_command_elements("Add 0.5 kg sugar")
    assert q_frac1 == Decimal("0.500")

    c_frac2, q_frac2, u_frac2 = extract_billing_command_elements("Add half kg sugar")
    assert q_frac2 == Decimal("0.500")

    c_frac3, q_frac3, u_frac3 = extract_billing_command_elements("Add 1.5 kg wheat")
    assert q_frac3 == Decimal("1.500")

    c_hi, q_hi, u_hi = extract_billing_command_elements("ek kg sugar add karo")
    assert q_hi == Decimal("1.000")

    c_mr, q_mr, u_mr = extract_billing_command_elements("don packet biscuits ghya")
    assert q_mr == Decimal("2.000")

    print(f"Test 2 PASSED: Fractional & multilingual words mapped to Decimals")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 3: Unit conversions (grams -> kg, ml -> litre)
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 3: Unit conversions to DB product unit ---")
    # 500 grams for a product stored in kg -> 0.500 kg
    res_qty1 = convert_quantity_to_product_unit(Decimal("500"), "g", "kg")
    assert res_qty1 == Decimal("0.500"), f"Expected 0.500, got {res_qty1}"

    # 250 ml for a product stored in litre -> 0.250 litre
    res_qty2 = convert_quantity_to_product_unit(Decimal("250"), "ml", "litre")
    assert res_qty2 == Decimal("0.250"), f"Expected 0.250, got {res_qty2}"

    # 2 dozen for a product stored in pcs -> 24 pcs
    res_qty3 = convert_quantity_to_product_unit(Decimal("2"), "dozen", "pcs")
    assert res_qty3 == Decimal("24.000"), f"Expected 24.000, got {res_qty3}"

    print(f"Test 3 PASSED: Unit conversions calculated with Decimal accuracy")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 4: Backend API POST /api/billing/voice/parse - Exact Match ("Add sugar 2 kg")
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 4: API exact match for 'Add sugar 2 kg' ---")
    resp = client.post("/api/billing/voice/parse", json={"command": "Add sugar 2 kg"}, headers=headers)
    assert resp.status_code == 200, f"Error: {resp.text}"
    data = resp.json()
    assert data["match_type"] == "exact", f"Expected exact, got {data['match_type']}"
    assert data["parsed_quantity"] == "2.000"
    assert data["resolved_quantity"] == "2.000"
    assert len(data["matches"]) == 1
    matched = data["matches"][0]
    sugar_db = db.query(Product).filter_by(shop_id=shop_id, name="Sugar").first()
    assert Decimal(str(matched["selling_price"])) == sugar_db.selling_price
    print(f"Test 4 PASSED: Exact match returned Sugar, price {sugar_db.selling_price}, qty 2.000")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 5: Unit conversion via API ("Add 500 grams of turmeric")
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 5: API unit conversion for 'Add 500 grams of turmeric' ---")
    resp = client.post("/api/billing/voice/parse", json={"command": "Add 500 grams of turmeric"}, headers=headers)
    assert resp.status_code == 200, f"Error: {resp.text}"
    data = resp.json()
    assert data["match_type"] == "exact", f"Expected exact, got {data['match_type']}"
    assert data["parsed_quantity"] == "500.000"
    assert data["parsed_unit"] == "g"
    matched_prod = data["matches"][0]
    assert "turmeric" in matched_prod["name"].lower()
    expected_resolved = convert_quantity_to_product_unit(Decimal("500"), "g", matched_prod["unit"])
    assert Decimal(str(data["resolved_quantity"])) == expected_resolved, f"Expected {expected_resolved}, got {data['resolved_quantity']}"
    print(f"Test 5 PASSED: 500g parsed and resolved to {expected_resolved} {matched_prod['unit']} for {matched_prod['name']}")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 6: Ambiguous product matches ("Add oil 1 litre")
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 6: Ambiguous product matches returns multiple ---")
    resp = client.post("/api/billing/voice/parse", json={"command": "Add oil 1 litre"}, headers=headers)
    assert resp.status_code == 200, f"Error: {resp.text}"
    data = resp.json()
    assert data["match_type"] == "multiple", f"Expected multiple, got {data['match_type']}"
    assert len(data["matches"]) >= 2
    match_names = [m["name"] for m in data["matches"]]
    assert any("Sunflower" in n for n in match_names)
    assert any("Mustard" in n for n in match_names)
    print(f"Test 6 PASSED: Multiple candidate options returned ({match_names})")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 7: Unknown product ("Add dragonfruit 2 kg")
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 7: Unknown product returns match_type='none' ---")
    resp = client.post("/api/billing/voice/parse", json={"command": "Add dragonfruit 2 kg"}, headers=headers)
    assert resp.status_code == 200, f"Error: {resp.text}"
    data = resp.json()
    assert data["match_type"] == "none", f"Expected none, got {data['match_type']}"
    assert len(data["matches"]) == 0
    assert "not found" in data["message"].lower()

    # Verify dragonfruit was NOT added to database
    db_df = db.query(Product).filter_by(shop_id=shop_id, name="dragonfruit").first()
    assert db_df is None, "Product should NOT be auto-created!"
    print(f"Test 7 PASSED: Unknown product correctly reports not found and does not auto-create")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 8: Cross-shop isolation & Unauthorized rejection
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 8: Cross-shop isolation and 401 unauthorized ---")
    # Unauthenticated request
    resp_unauth = client.post("/api/billing/voice/parse", json={"command": "Add sugar 2 kg"})
    assert resp_unauth.status_code == 401, f"Expected 401, got {resp_unauth.status_code}"

    # Verify products from another shop are not visible
    other_shop = db.query(Shop).filter(Shop.id != shop_id).first()
    if not other_shop:
        other_shop = Shop(name="Other Unique Shop", address="Other Street")
        db.add(other_shop)
        db.commit()
        db.refresh(other_shop)

    secret_prod = db.query(Product).filter_by(shop_id=other_shop.id, name="Secret Foreign Item").first()
    if not secret_prod:
        secret_prod = Product(
            name="Secret Foreign Item",
            shop_id=other_shop.id,
            purchase_price=Decimal("10.00"),
            selling_price=Decimal("20.00"),
            pack_size=Decimal("1.000"),
            unit="piece",
            stock_quantity=Decimal("5.000"),
            low_stock_threshold=Decimal("1.000"),
            is_active=True,
        )
        db.add(secret_prod)
        db.commit()

    # Searching with current user's token should not match Secret Foreign Item
    resp_cross = client.post("/api/billing/voice/parse", json={"command": "Add Secret Foreign Item 1 piece"}, headers=headers)
    assert resp_cross.status_code == 200
    assert resp_cross.json()["match_type"] == "none", "Should not match other shop's product!"
    print(f"Test 8 PASSED: 401 enforced and cross-shop isolation verified")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 9: Add parsed voice product to billing cart via existing billing cart API
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 9: Add parsed product to billing cart & validate stock rules ---")
    # 1. Get current active cart
    cart_res = client.get("/api/billing/cart/active/current", headers=headers)
    assert cart_res.status_code == 200
    cart_id = cart_res.json()["id"]

    # Clear cart before test
    client.delete(f"/api/billing/cart/{cart_id}/clear", headers=headers)

    # 2. Parse command "Add sugar 2 kg"
    p_res = client.post("/api/billing/voice/parse", json={"command": "Add sugar 2 kg"}, headers=headers)
    p_data = p_res.json()
    sugar_id = p_data["matches"][0]["id"]
    resolved_qty = Decimal(p_data["resolved_quantity"])

    sugar_db_before = db.query(Product).filter_by(id=sugar_id).first()
    init_stock = sugar_db_before.stock_quantity
    expected_price = sugar_db_before.selling_price

    # 3. Add to cart using existing POST /api/billing/cart/{cart_id}/items
    add_res = client.post(
        f"/api/billing/cart/{cart_id}/items",
        json={"product_id": sugar_id, "quantity": float(resolved_qty)},
        headers=headers,
    )
    assert add_res.status_code == 200, f"Add item failed: {add_res.text}"
    cart_data = add_res.json()
    assert len(cart_data["items"]) == 1
    item = cart_data["items"][0]
    assert item["product_id"] == sugar_id
    assert Decimal(str(item["quantity"])) == Decimal("2.000")
    assert Decimal(str(item["unit_price"])) == expected_price
    assert Decimal(str(item["line_total"])) == Decimal("2.000") * expected_price

    # Verify inventory was NOT permanently deducted from products table
    db.expire_all()
    sugar_db_after = db.query(Product).filter_by(id=sugar_id).first()
    assert sugar_db_after.stock_quantity == init_stock, "Stock should NOT be permanently deducted upon cart addition!"

    # 4. Stock validation: Attempt to add quantity exceeding available stock
    excess_res = client.post(
        f"/api/billing/cart/{cart_id}/items",
        json={"product_id": sugar_id, "quantity": float(init_stock + 100)},
        headers=headers,
    )
    assert excess_res.status_code == 400
    assert "insufficient stock" in excess_res.text.lower()
    print(f"Test 9 PASSED: Cart addition, price snapshotting, stock non-deduction, and insufficient stock checks verified")
    passed += 1

    print("\n" + "=" * 70)
    print(f"VOICE BILLING TESTS SUMMARY: {passed}/{total} TESTS PASSED (100%)")
    print("=" * 70)
    db.close()


if __name__ == "__main__":
    run_all_voice_billing_tests()
