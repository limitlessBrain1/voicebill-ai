"""Automated verification script for Voice Product Confirmation -> Product Creation feature."""
import json
import sys
from decimal import Decimal

from fastapi.testclient import TestClient

from app.database.session import SessionLocal
from app.main import app
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.utils.jwt import create_access_token


def run_all_tests():
    client = TestClient(app)
    db = SessionLocal()

    print("=" * 60)
    print("STARTING VOICE PRODUCT CONFIRMATION FEATURE TESTS")
    print("=" * 60)

    # Setup owner user (User id 1, shop 2)
    owner = db.query(User).filter(User.role == "owner").first()
    assert owner is not None, "No owner user found in DB"
    owner_token = create_access_token({"sub": str(owner.id)})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    shop_id = owner.shop_id
    print(f"Testing with Owner User ID {owner.id} (shop_id={shop_id}, role={owner.role})")

    # Ensure Category 'Grocery' exists for this shop
    grocery_cat = db.query(Category).filter(
        Category.shop_id == shop_id,
        Category.name == "Grocery"
    ).first()
    if not grocery_cat:
        grocery_cat = Category(name="Grocery", shop_id=shop_id)
        db.add(grocery_cat)
        db.commit()
        db.refresh(grocery_cat)
    print(f"Verified Category 'Grocery' (id={grocery_cat.id}, shop_id={grocery_cat.shop_id})")

    # -------------------------------------------------------------------------
    # TEST 1 - kg
    # Command: "Add normal Salt, 4 kg, purchase price 22, selling price 28, stock 10 kg."
    # -------------------------------------------------------------------------
    print("\n--- TEST 1: Parse and Confirm (kg) ---")
    cmd_1 = "Add normal Salt, 4 kg, purchase price 22, selling price 28, stock 10 kg."
    parse_resp_1 = client.post(
        "/api/voice/products/parse",
        json={"command": cmd_1},
        headers=owner_headers,
    )
    assert parse_resp_1.status_code == 200, f"Parse failed: {parse_resp_1.text}"
    p_data_1 = parse_resp_1.json()
    print("Parsed output:", p_data_1)
    assert p_data_1["name"] == "normal Salt"
    assert Decimal(str(p_data_1["pack_size"])) == Decimal("4")
    assert p_data_1["unit"] == "kg"
    assert Decimal(str(p_data_1["purchase_price"])) == Decimal("22")
    assert Decimal(str(p_data_1["selling_price"])) == Decimal("28")
    assert Decimal(str(p_data_1["stock_quantity"])) == Decimal("10")
    print("  -> /parse returned correct read-only preview.")

    # Confirm it
    confirm_resp_1 = client.post(
        "/api/voice/products/confirm",
        json=p_data_1,
        headers=owner_headers,
    )
    assert confirm_resp_1.status_code == 201, f"Confirm failed: {confirm_resp_1.text}"
    created_1 = confirm_resp_1.json()
    print("Created Product in DB:", created_1)
    assert created_1["name"] == "normal Salt"
    assert Decimal(str(created_1["pack_size"])) == Decimal("4.000")
    assert created_1["unit"] == "kg"
    assert Decimal(str(created_1["purchase_price"])) == Decimal("22.00")
    assert Decimal(str(created_1["selling_price"])) == Decimal("28.00")
    assert Decimal(str(created_1["stock_quantity"])) == Decimal("10.000")
    assert created_1["shop_id"] == shop_id
    assert created_1["is_active"] is True
    print("TEST 1 PASSED: 'normal Salt' created successfully.")

    # -------------------------------------------------------------------------
    # TEST 2 - grams
    # Command: "Add turmeric powder, 500 g, purchase price 80, selling price 100, stock 20 kg."
    # -------------------------------------------------------------------------
    print("\n--- TEST 2: Parse and Confirm (grams) ---")
    cmd_2 = "Add turmeric powder, 500 g, purchase price 80, selling price 100, stock 20 kg."
    parse_resp_2 = client.post(
        "/api/voice/products/parse",
        json={"command": cmd_2},
        headers=owner_headers,
    )
    assert parse_resp_2.status_code == 200, f"Parse failed: {parse_resp_2.text}"
    p_data_2 = parse_resp_2.json()
    print("Parsed output:", p_data_2)
    assert p_data_2["name"] == "turmeric powder"
    assert Decimal(str(p_data_2["pack_size"])) == Decimal("500")
    assert p_data_2["unit"] == "g"

    confirm_resp_2 = client.post(
        "/api/voice/products/confirm",
        json=p_data_2,
        headers=owner_headers,
    )
    assert confirm_resp_2.status_code == 201, f"Confirm failed: {confirm_resp_2.text}"
    created_2 = confirm_resp_2.json()
    print("Created Product in DB:", created_2)
    assert created_2["name"] == "turmeric powder"
    assert Decimal(str(created_2["pack_size"])) == Decimal("500.000")
    assert created_2["unit"] == "g"
    assert created_2["shop_id"] == shop_id
    print("TEST 2 PASSED: 'turmeric powder' created successfully.")

    # -------------------------------------------------------------------------
    # TEST 3 - litre
    # Command: "Add cooking oil, 1 litre, purchase price 100, selling price 120, stock 20 litre."
    # -------------------------------------------------------------------------
    print("\n--- TEST 3: Parse and Confirm (litre) ---")
    cmd_3 = "Add cooking oil, 1 litre, purchase price 100, selling price 120, stock 20 litre."
    parse_resp_3 = client.post(
        "/api/voice/products/parse",
        json={"command": cmd_3},
        headers=owner_headers,
    )
    assert parse_resp_3.status_code == 200, f"Parse failed: {parse_resp_3.text}"
    p_data_3 = parse_resp_3.json()
    print("Parsed output:", p_data_3)
    assert Decimal(str(p_data_3["pack_size"])) == Decimal("1")
    assert p_data_3["unit"] == "litre"
    assert Decimal(str(p_data_3["stock_quantity"])) == Decimal("20")

    confirm_resp_3 = client.post(
        "/api/voice/products/confirm",
        json=p_data_3,
        headers=owner_headers,
    )
    assert confirm_resp_3.status_code == 201, f"Confirm failed: {confirm_resp_3.text}"
    created_3 = confirm_resp_3.json()
    print("Created Product in DB:", created_3)
    assert created_3["name"] == "cooking oil"
    assert Decimal(str(created_3["pack_size"])) == Decimal("1.000")
    assert created_3["unit"] == "litre"
    assert Decimal(str(created_3["stock_quantity"])) == Decimal("20.000")
    print("TEST 3 PASSED: 'cooking oil' created with unit=litre, pack_size=1, stock=20.")

    # -------------------------------------------------------------------------
    # TEST 4 - Category resolution
    # Command: "Add Tata Salt, 1 kg, purchase price 20, selling price 25, stock 10 kg, category Grocery."
    # -------------------------------------------------------------------------
    print("\n--- TEST 4: Category Resolution ---")
    cmd_4 = "Add Tata Salt, 1 kg, purchase price 20, selling price 25, stock 10 kg, category Grocery."
    parse_resp_4 = client.post(
        "/api/voice/products/parse",
        json={"command": cmd_4},
        headers=owner_headers,
    )
    assert parse_resp_4.status_code == 200, f"Parse failed: {parse_resp_4.text}"
    p_data_4 = parse_resp_4.json()
    print("Parsed output:", p_data_4)
    assert p_data_4["category_name"] == "Grocery"

    confirm_resp_4 = client.post(
        "/api/voice/products/confirm",
        json=p_data_4,
        headers=owner_headers,
    )
    assert confirm_resp_4.status_code == 201, f"Confirm failed: {confirm_resp_4.text}"
    created_4 = confirm_resp_4.json()
    print("Created Product in DB:", created_4)
    assert created_4["category_id"] == grocery_cat.id
    assert created_4["name"] == "Tata Salt"
    print(f"TEST 4 PASSED: category_id correctly assigned to {grocery_cat.id} ('Grocery').")

    # -------------------------------------------------------------------------
    # TEST 4b - Non-existent category name should reject with 400
    # -------------------------------------------------------------------------
    print("\n--- TEST 4b: Non-existent category rejection ---")
    invalid_cat_payload = {
        "name": "Unknown Cat Item",
        "pack_size": 1,
        "unit": "kg",
        "purchase_price": 50,
        "selling_price": 60,
        "stock_quantity": 10,
        "category_name": "NonExistentCategory999",
    }
    invalid_cat_resp = client.post(
        "/api/voice/products/confirm",
        json=invalid_cat_payload,
        headers=owner_headers,
    )
    print("Non-existent category response status:", invalid_cat_resp.status_code)
    print("Non-existent category response body:", invalid_cat_resp.text)
    assert invalid_cat_resp.status_code == 400
    print("TEST 4b PASSED: Non-existent category correctly rejected with 400 Bad Request.")

    # -------------------------------------------------------------------------
    # TEST 5 - Unauthorized role (non-owner)
    # -------------------------------------------------------------------------
    print("\n--- TEST 5: Unauthorized Role (Non-Owner) ---")
    # Create or retrieve a test staff user with role="staff"
    staff_user = db.query(User).filter(User.role == "staff").first()
    if not staff_user:
        staff_user = User(
            name="Test Staff",
            email="staff_test@example.com",
            phone="9876543210",
            password_hash="testpasshash",
            shop_id=shop_id,
            role="staff",
            is_active=True,
        )
        db.add(staff_user)
        db.commit()
        db.refresh(staff_user)

    staff_token = create_access_token({"sub": str(staff_user.id)})
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    staff_resp = client.post(
        "/api/voice/products/confirm",
        json={
            "name": "Staff Added Product",
            "pack_size": 1,
            "unit": "kg",
            "purchase_price": 10,
            "selling_price": 15,
            "stock_quantity": 5,
        },
        headers=staff_headers,
    )
    print("Staff user response status:", staff_resp.status_code)
    print("Staff user response body:", staff_resp.text)
    assert staff_resp.status_code == 403, f"Expected 403, got {staff_resp.status_code}"
    print("TEST 5 PASSED: Non-owner user rejected with 403 Forbidden.")

    # -------------------------------------------------------------------------
    # TEST 6 - Invalid price (negative purchase price)
    # -------------------------------------------------------------------------
    print("\n--- TEST 6: Invalid Price Rejection ---")
    invalid_price_payload = {
        "name": "Test Product",
        "pack_size": 1,
        "unit": "kg",
        "purchase_price": -10,
        "selling_price": 20,
        "stock_quantity": 10,
    }
    invalid_resp = client.post(
        "/api/voice/products/confirm",
        json=invalid_price_payload,
        headers=owner_headers,
    )
    print("Invalid price response status:", invalid_resp.status_code)
    print("Invalid price response body:", invalid_resp.text)
    assert invalid_resp.status_code in (400, 422), f"Expected 400 or 422, got {invalid_resp.status_code}"
    print(f"TEST 6 PASSED: Invalid price rejected with status {invalid_resp.status_code}.")

    # -------------------------------------------------------------------------
    # TEST 7 - Invalid unit
    # -------------------------------------------------------------------------
    print("\n--- TEST 7: Invalid Unit Rejection ---")
    invalid_unit_payload = {
        "name": "Test Product Invalid Unit",
        "pack_size": 1,
        "unit": "spaceships",
        "purchase_price": 10,
        "selling_price": 20,
        "stock_quantity": 10,
    }
    invalid_unit_resp = client.post(
        "/api/voice/products/confirm",
        json=invalid_unit_payload,
        headers=owner_headers,
    )
    print("Invalid unit response status:", invalid_unit_resp.status_code)
    print("Invalid unit response body:", invalid_unit_resp.text)
    assert invalid_unit_resp.status_code in (400, 422)
    print(f"TEST 7 PASSED: Invalid unit rejected with status {invalid_unit_resp.status_code}.")

    # -------------------------------------------------------------------------
    # DATABASE VERIFICATION - GET /api/products
    # -------------------------------------------------------------------------
    print("\n--- DATABASE VERIFICATION: GET /api/products ---")
    list_resp = client.get("/api/products", headers=owner_headers)
    assert list_resp.status_code == 200, f"List products failed: {list_resp.text}"
    products_list = list_resp.json()
    product_names = [p["name"] for p in products_list]
    print(f"Fetched {len(products_list)} products for shop_id {shop_id}:")
    for p in products_list:
        print(f" - [{p['id']}] {p['name']} | Unit: {p['unit']} | Price: {p['selling_price']} | Stock: {p['stock_quantity']} | Cat ID: {p['category_id']}")

    assert "normal Salt" in product_names
    assert "turmeric powder" in product_names
    assert "cooking oil" in product_names
    assert "Tata Salt" in product_names
    print("DATABASE VERIFICATION PASSED: All newly created products appear in GET /api/products.")

    # -------------------------------------------------------------------------
    # READ-ONLY VERIFICATION OF /api/voice/products/parse
    # -------------------------------------------------------------------------
    print("\n--- READ-ONLY VERIFICATION OF /api/voice/products/parse ---")
    count_before = len(products_list)
    client.post(
        "/api/voice/products/parse",
        json={"command": "Add cardamom, 100 g, purchase price 200, selling price 250, stock 5 kg."},
        headers=owner_headers,
    )
    list_resp_after = client.get("/api/products", headers=owner_headers)
    count_after = len(list_resp_after.json())
    assert count_after == count_before, "Parse endpoint modified database products count!"
    print(f"READ-ONLY VERIFICATION PASSED: Product count remained {count_after} after calling /parse.")

    # -------------------------------------------------------------------------
    # NORMAL PRODUCT CREATION API VERIFICATION
    # -------------------------------------------------------------------------
    print("\n--- NORMAL PRODUCT CREATION API (POST /api/products) ---")
    normal_prod_payload = {
        "name": "Standard Wheat Flour",
        "category_id": grocery_cat.id,
        "purchase_price": "45.00",
        "selling_price": "55.00",
        "pack_size": "5.000",
        "unit": "kg",
        "stock_quantity": "50.000",
        "low_stock_threshold": "10.000",
        "barcode": None,
    }
    normal_resp = client.post(
        "/api/products",
        json=normal_prod_payload,
        headers=owner_headers,
    )
    assert normal_resp.status_code == 201, f"Normal product creation failed: {normal_resp.text}"
    normal_created = normal_resp.json()
    print("Normal created product:", normal_created)
    assert normal_created["name"] == "Standard Wheat Flour"
    assert normal_created["shop_id"] == shop_id
    assert normal_created["category_id"] == grocery_cat.id
    print("NORMAL PRODUCT CREATION VERIFIED: Both endpoints share the same backend service seamlessly.")

    db.close()
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)



if __name__ == "__main__":
    run_all_tests()
