"""Comprehensive test suite for the Final Voice Product Batch Creation Architecture.

Verifies:
1. Parser tests A, B, C (read-only command parsing).
2. Batch creation: POST /api/voice/products/create-batch with multiple reviewed products.
3. Atomic transaction failure: when 1 item in a batch is invalid, NO products are created.
4. Intra-batch duplicate barcode rejection.
5. Category scoped lookup and non-existent category rejection.
6. Authorization: role == 'owner' enforced (HTTP 403 for non-owners).
7. Shop isolation: current_user.shop_id enforced.
8. Database verification via GET /api/products.
9. Verify /api/voice/products/parse is strictly read-only.
"""
from decimal import Decimal
import sys

from fastapi.testclient import TestClient

from app.database.session import SessionLocal
from app.main import app
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.utils.jwt import create_access_token


def run_tests():
    client = TestClient(app)
    db = SessionLocal()

    print("=" * 70)
    print("STARTING FINAL BATCH VOICE PRODUCT CREATION TESTS")
    print("=" * 70)

    # 1. Setup owner user
    owner = db.query(User).filter(User.role == "owner").first()
    assert owner is not None, "Owner user not found in DB"
    owner_token = create_access_token({"sub": str(owner.id)})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    shop_id = owner.shop_id
    print(f"Testing with Owner ID {owner.id} | Shop ID {shop_id} | Role {owner.role}")

    # Ensure Category 'Grocery' exists for shop_id
    grocery_cat = db.query(Category).filter(
        Category.shop_id == shop_id,
        Category.name == "Grocery",
    ).first()
    if not grocery_cat:
        grocery_cat = Category(name="Grocery", shop_id=shop_id)
        db.add(grocery_cat)
        db.commit()
        db.refresh(grocery_cat)
    print(f"Shop Category 'Grocery' verified (id={grocery_cat.id})")

    # Count initial products in shop
    initial_product_count = db.query(Product).filter(Product.shop_id == shop_id).count()
    print(f"Initial product count in shop {shop_id}: {initial_product_count}")

    # -------------------------------------------------------------------------
    # TEST A - kg Parser
    # -------------------------------------------------------------------------
    print("\n--- TEST A: Parse 'normal Salt, 4 kg...' (Read-Only) ---")
    resp_a = client.post(
        "/api/voice/products/parse",
        json={"command": "Add normal Salt, 4 kg, purchase price 22, selling price 28, stock 10 kg."},
        headers=owner_headers,
    )
    assert resp_a.status_code == 200, f"Parse A failed: {resp_a.text}"
    data_a = resp_a.json()
    print("Parsed A:", data_a)
    assert data_a["name"] == "normal Salt"
    assert Decimal(str(data_a["pack_size"])) == Decimal("4")
    assert data_a["unit"] == "kg"
    assert Decimal(str(data_a["purchase_price"])) == Decimal("22")
    assert Decimal(str(data_a["selling_price"])) == Decimal("28")
    assert Decimal(str(data_a["stock_quantity"])) == Decimal("10")
    print("TEST A PASSED: Parsed name='normal Salt', pack_size=4, unit=kg, purchase=22, selling=28, stock=10.")

    # -------------------------------------------------------------------------
    # TEST B - grams Parser
    # -------------------------------------------------------------------------
    print("\n--- TEST B: Parse 'turmeric powder, 500 g...' (Read-Only) ---")
    resp_b = client.post(
        "/api/voice/products/parse",
        json={"command": "Add turmeric powder, 500 g, purchase price 80, selling price 100, stock 20 kg."},
        headers=owner_headers,
    )
    assert resp_b.status_code == 200, f"Parse B failed: {resp_b.text}"
    data_b = resp_b.json()
    print("Parsed B:", data_b)
    assert data_b["name"] == "turmeric powder"
    assert Decimal(str(data_b["pack_size"])) == Decimal("500")
    assert data_b["unit"] == "g"
    assert Decimal(str(data_b["stock_quantity"])) == Decimal("20")
    print("TEST B PASSED: Parsed pack_size=500, unit=g, stock_quantity=20.")

    # -------------------------------------------------------------------------
    # TEST C - litre Parser
    # -------------------------------------------------------------------------
    print("\n--- TEST C: Parse 'cooking oil, 1 litre...' (Read-Only) ---")
    resp_c = client.post(
        "/api/voice/products/parse",
        json={"command": "Add cooking oil, 1 litre, purchase price 100, selling price 120, stock 20 litre."},
        headers=owner_headers,
    )
    assert resp_c.status_code == 200, f"Parse C failed: {resp_c.text}"
    data_c = resp_c.json()
    print("Parsed C:", data_c)
    assert data_c["name"] == "cooking oil"
    assert Decimal(str(data_c["pack_size"])) == Decimal("1")
    assert data_c["unit"] == "litre"
    assert Decimal(str(data_c["stock_quantity"])) == Decimal("20")
    print("TEST C PASSED: Parsed pack_size=1, unit=litre, stock_quantity=20.")

    # Verify parser did not write anything to DB
    count_after_parsers = db.query(Product).filter(Product.shop_id == shop_id).count()
    assert count_after_parsers == initial_product_count, "Parser wrote to database!"
    print(f"VERIFIED: Database product count remained {count_after_parsers} during parser calls (strictly read-only).")

    # -------------------------------------------------------------------------
    # TEST 18 - Batch Product Creation: POST /api/voice/products/create-batch
    # -------------------------------------------------------------------------
    print("\n--- TEST 18: Batch Creation (2 valid products) ---")
    batch_payload = {
        "products": [
            {
                "name": "Batch Sugar Premium",
                "pack_size": 1,
                "unit": "kg",
                "purchase_price": 40,
                "selling_price": 45,
                "stock_quantity": 20,
                "low_stock_threshold": 5,
                "category_name": "Grocery",
                "barcode": None,
            },
            {
                "name": "Batch Basmati Rice",
                "pack_size": 5,
                "unit": "kg",
                "purchase_price": 50,
                "selling_price": 60,
                "stock_quantity": 30,
                "low_stock_threshold": 5,
                "category_name": "Grocery",
                "barcode": None,
            },
        ]
    }
    batch_resp = client.post(
        "/api/voice/products/create-batch",
        json=batch_payload,
        headers=owner_headers,
    )
    assert batch_resp.status_code == 201, f"Batch creation failed: {batch_resp.text}"
    batch_data = batch_resp.json()
    print("Batch Response:", batch_data)
    assert batch_data["created_count"] == 2
    assert len(batch_data["products"]) == 2
    created_names = [p["name"] for p in batch_data["products"]]
    assert "Batch Sugar Premium" in created_names
    assert "Batch Basmati Rice" in created_names
    for p in batch_data["products"]:
        assert p["shop_id"] == shop_id
        assert p["category_id"] == grocery_cat.id
        assert p["is_active"] is True
    print("TEST 18 PASSED: created_count=2, products created with correct shop_id and category_id.")

    # Verify via GET /api/products
    list_resp = client.get("/api/products", headers=owner_headers)
    assert list_resp.status_code == 200
    listed_names = [p["name"] for p in list_resp.json()]
    assert "Batch Sugar Premium" in listed_names
    assert "Batch Basmati Rice" in listed_names
    print("VERIFIED VIA GET /api/products: Both batch created products exist in shop's product list.")

    # -------------------------------------------------------------------------
    # TEST 19 - Atomic Transaction Failure (Validate Entire Batch First)
    # Batch has:
    # Product 1 -> Valid
    # Product 2 -> Valid
    # Product 3 -> Invalid negative price
    # Expected: 400 or 422 error, 0 products created, Product 1 and 2 NOT inserted!
    # -------------------------------------------------------------------------
    print("\n--- TEST 19: Atomic Transaction Failure ---")
    count_before_atomic = db.query(Product).filter(Product.shop_id == shop_id).count()

    atomic_payload = {
        "products": [
            {
                "name": "Atomic Apple Valid",
                "pack_size": 1,
                "unit": "kg",
                "purchase_price": 100,
                "selling_price": 120,
                "stock_quantity": 10,
            },
            {
                "name": "Atomic Banana Valid",
                "pack_size": 1,
                "unit": "dozen",
                "purchase_price": 40,
                "selling_price": 50,
                "stock_quantity": 15,
            },
            {
                "name": "Atomic Invalid Orange",
                "pack_size": 1,
                "unit": "kg",
                "purchase_price": -50,  # INVALID NEGATIVE PRICE!
                "selling_price": 60,
                "stock_quantity": 10,
            },
        ]
    }
    atomic_resp = client.post(
        "/api/voice/products/create-batch",
        json=atomic_payload,
        headers=owner_headers,
    )
    print("Atomic test response status:", atomic_resp.status_code)
    print("Atomic test response text:", atomic_resp.text)
    assert atomic_resp.status_code in (400, 422), f"Expected 400/422, got {atomic_resp.status_code}"

    # Critical check: verify ZERO products from this batch were added to PostgreSQL
    db.expire_all()
    count_after_atomic = db.query(Product).filter(Product.shop_id == shop_id).count()
    assert count_after_atomic == count_before_atomic, f"Atomicity violated! Expected {count_before_atomic}, got {count_after_atomic}"

    check_apple = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.name == "Atomic Apple Valid",
    ).first()
    assert check_apple is None, "Product 1 was created despite subsequent product failure!"

    check_banana = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.name == "Atomic Banana Valid",
    ).first()
    assert check_banana is None, "Product 2 was created despite subsequent product failure!"

    print("TEST 19 PASSED: Entire batch rejected atomically. ZERO products were inserted into PostgreSQL.")

    # -------------------------------------------------------------------------
    # TEST 20 - Intra-Batch Duplicate Barcode Rejection
    # -------------------------------------------------------------------------
    print("\n--- TEST 20: Intra-Batch Duplicate Barcode Rejection ---")
    dup_barcode_payload = {
        "products": [
            {
                "name": "Item with Barcode A",
                "pack_size": 1,
                "unit": "kg",
                "purchase_price": 10,
                "selling_price": 15,
                "stock_quantity": 5,
                "barcode": "BATCH-DUP-123",
            },
            {
                "name": "Item with Barcode B (Duplicate)",
                "pack_size": 1,
                "unit": "kg",
                "purchase_price": 10,
                "selling_price": 15,
                "stock_quantity": 5,
                "barcode": "BATCH-DUP-123",
            },
        ]
    }
    dup_resp = client.post(
        "/api/voice/products/create-batch",
        json=dup_barcode_payload,
        headers=owner_headers,
    )
    print("Duplicate barcode response status:", dup_resp.status_code)
    print("Duplicate barcode response text:", dup_resp.text)
    assert dup_resp.status_code == 400
    assert "duplicate barcode" in dup_resp.text.lower()
    print("TEST 20 PASSED: Duplicate barcode within batch rejected with HTTP 400.")

    # -------------------------------------------------------------------------
    # TEST 21 - Non-existent Category in Batch
    # -------------------------------------------------------------------------
    print("\n--- TEST 21: Non-Existent Category in Batch Rejection ---")
    bad_cat_payload = {
        "products": [
            {
                "name": "Good Product",
                "pack_size": 1,
                "unit": "kg",
                "purchase_price": 10,
                "selling_price": 15,
                "stock_quantity": 5,
                "category_name": "DefinitelyFakeCategory999",
            }
        ]
    }
    bad_cat_resp = client.post(
        "/api/voice/products/create-batch",
        json=bad_cat_payload,
        headers=owner_headers,
    )
    print("Bad category response status:", bad_cat_resp.status_code)
    print("Bad category response text:", bad_cat_resp.text)
    assert bad_cat_resp.status_code == 400
    assert "not found" in bad_cat_resp.text.lower()
    print("TEST 21 PASSED: Non-existent category rejected with HTTP 400.")

    # -------------------------------------------------------------------------
    # TEST 22 - Authorization Role Check (Non-Owner)
    # -------------------------------------------------------------------------
    print("\n--- TEST 22: Unauthorized Role (Non-Owner) Rejection ---")
    staff_user = db.query(User).filter(User.role == "staff").first()
    if not staff_user:
        staff_user = User(
            name="Staff User",
            email="staff_batch_test@example.com",
            phone="9988776655",
            password_hash="testhash",
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
        "/api/voice/products/create-batch",
        json={"products": [{"name": "Staff Item", "pack_size": 1, "unit": "kg", "purchase_price": 10, "selling_price": 20, "stock_quantity": 5}]},
        headers=staff_headers,
    )
    print("Staff batch response status:", staff_resp.status_code)
    print("Staff batch response text:", staff_resp.text)
    assert staff_resp.status_code == 403
    print("TEST 22 PASSED: Non-owner user rejected with HTTP 403 Forbidden.")

    db.close()
    print("\n" + "=" * 70)
    print("ALL TESTS PASSED SUCCESSFULLY! ARCHITECTURE FULLY VERIFIED.")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
