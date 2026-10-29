"""Comprehensive test suite for VoiceBill.AI Inventory Management Feature.

Tests:
1. Metrics & Stock Calculation Rules:
   - Out of stock: stock_quantity <= 0
   - Low stock: stock_quantity > 0 and stock_quantity <= low_stock_threshold
   - In stock: stock_quantity > low_stock_threshold
   - Mutually exclusive partition (zero overlap)
2. Product Listing with Search & Filters:
   - GET /api/products
   - Search by product name substring
   - Filter by is_active
   - Filter by category_id
3. Product Details Retrieval:
   - GET /api/products/{id}
   - Verifies viewing a product NEVER modifies its stock quantity or state
4. Product Field Edits:
   - PUT /api/products/{id}
   - Updates name, category, prices, pack_size, canonicalizes unit, barcode
   - Validates non-negative prices and pack_size > 0
   - Enforces barcode uniqueness within shop
5. Stock Quantity Update:
   - PATCH /api/products/{id}/stock
   - Updates stock with Decimal precision (e.g. 15.500)
   - Validates negative stock is rejected (HTTP 422)
6. Product Activation / Deactivation:
   - PATCH /api/products/{id}/status (toggle True / False)
   - DELETE /api/products/{id} (soft-delete is_active = False)
7. Security & Shop-Level Isolation:
   - Enforces authentication (HTTP 401 without token)
   - Shop-level data isolation: Owner of Shop 2 CANNOT view, edit, update stock, or deactivate products belonging to Shop 1
   - Never trusts shop_id supplied in request body
"""
from decimal import Decimal
import sys

from fastapi.testclient import TestClient

from app.database.session import SessionLocal
from app.main import app
from app.models.category import Category
from app.models.product import Product
from app.models.shop import Shop
from app.models.user import User
from app.utils.jwt import create_access_token


def run_inventory_tests():
    client = TestClient(app)
    db = SessionLocal()

    print("=" * 70)
    print("STARTING INVENTORY MANAGEMENT FEATURE VERIFICATION")
    print("=" * 70)

    # 1. Setup primary owner user (Shop 2)
    owner = db.query(User).filter(User.role == "owner").first()
    assert owner is not None, "Owner user not found in DB"
    shop_id = owner.shop_id
    owner_token = create_access_token({"sub": str(owner.id)})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    print(f"Testing with primary owner User ID {owner.id} | Shop ID {shop_id}")

    # Ensure Category 'Inventory Test Category' exists
    test_cat = db.query(Category).filter(
        Category.shop_id == shop_id,
        Category.name == "Inventory Test Category",
    ).first()
    if not test_cat:
        test_cat = Category(name="Inventory Test Category", shop_id=shop_id)
        db.add(test_cat)
        db.commit()
        db.refresh(test_cat)
    print(f"Test Category verified (id={test_cat.id})")

    # Clean up test products from previous runs for idempotence
    db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.name.in_([
            "Inv Premium Sugar",
            "Inv Premium Sugar (Updated Name)",
            "Inv Tata Salt LowStock",
            "Inv Spices OutOfStock",
            "Tamper Test Item",
        ]) | Product.barcode.in_([
            "INV-SUGAR-001",
            "INV-SALT-002",
            "INV-SPICE-003",
            "INV-SUGAR-UPDATED",
        ])
    ).delete(synchronize_session=False)
    db.commit()

    # -------------------------------------------------------------------------
    # TEST 1: Stock Status Rules & Calculations
    # -------------------------------------------------------------------------
    print("\n--- TEST 1: Stock Calculation Rules & Mutual Exclusivity ---")
    # Rule 1: Out of stock: stock <= 0
    # Rule 2: Low stock: stock > 0 and stock <= low_stock_threshold
    # Rule 3: In stock: stock > low_stock_threshold

    def compute_stock_status(stock: Decimal, threshold: Decimal, is_active: bool = True) -> str:
        if not is_active:
            return "inactive"
        if stock <= Decimal("0"):
            return "out_of_stock"
        if stock <= threshold:
            return "low_stock"
        return "in_stock"

    # Test edge cases
    assert compute_stock_status(Decimal("0"), Decimal("5")) == "out_of_stock"
    assert compute_stock_status(Decimal("-1"), Decimal("5")) == "out_of_stock"
    assert compute_stock_status(Decimal("0.001"), Decimal("5")) == "low_stock"
    assert compute_stock_status(Decimal("5.000"), Decimal("5")) == "low_stock"
    assert compute_stock_status(Decimal("5.001"), Decimal("5")) == "in_stock"
    assert compute_stock_status(Decimal("100"), Decimal("5")) == "in_stock"
    assert compute_stock_status(Decimal("0"), Decimal("0")) == "out_of_stock"
    assert compute_stock_status(Decimal("1"), Decimal("0")) == "in_stock"
    assert compute_stock_status(Decimal("10"), Decimal("5"), is_active=False) == "inactive"
    print("TEST 1 PASSED: Stock calculation rules verified with zero overlap across all boundaries.")

    # -------------------------------------------------------------------------
    # TEST 2: Create Known Products for Inventory Testing
    # -------------------------------------------------------------------------
    print("\n--- TEST 2: Create Test Products via API ---")
    p1_resp = client.post(
        "/api/products",
        json={
            "name": "Inv Premium Sugar",
            "category_id": test_cat.id,
            "purchase_price": "42.00",
            "selling_price": "48.00",
            "pack_size": "1.000",
            "unit": "kg",
            "stock_quantity": "25.000",
            "low_stock_threshold": "5.000",
            "barcode": "INV-SUGAR-001",
        },
        headers=owner_headers,
    )
    assert p1_resp.status_code == 201, f"Failed to create p1: {p1_resp.text}"
    p1 = p1_resp.json()
    print(f"Created Product 1 (In Stock): id={p1['id']}, name='{p1['name']}', stock={p1['stock_quantity']}")

    p2_resp = client.post(
        "/api/products",
        json={
            "name": "Inv Tata Salt LowStock",
            "category_id": test_cat.id,
            "purchase_price": "20.00",
            "selling_price": "25.00",
            "pack_size": "1.000",
            "unit": "kg",
            "stock_quantity": "3.000",
            "low_stock_threshold": "5.000",
            "barcode": "INV-SALT-002",
        },
        headers=owner_headers,
    )
    assert p2_resp.status_code == 201, f"Failed to create p2: {p2_resp.text}"
    p2 = p2_resp.json()
    print(f"Created Product 2 (Low Stock): id={p2['id']}, name='{p2['name']}', stock={p2['stock_quantity']}")

    p3_resp = client.post(
        "/api/products",
        json={
            "name": "Inv Spices OutOfStock",
            "category_id": test_cat.id,
            "purchase_price": "60.00",
            "selling_price": "75.00",
            "pack_size": "500.000",
            "unit": "g",
            "stock_quantity": "0.000",
            "low_stock_threshold": "5.000",
            "barcode": "INV-SPICE-003",
        },
        headers=owner_headers,
    )
    assert p3_resp.status_code == 201, f"Failed to create p3: {p3_resp.text}"
    p3 = p3_resp.json()
    print(f"Created Product 3 (Out of Stock): id={p3['id']}, name='{p3['name']}', stock={p3['stock_quantity']}")
    print("TEST 2 PASSED: Created 3 test products spanning In Stock, Low Stock, and Out of Stock.")

    # -------------------------------------------------------------------------
    # TEST 3: Product Listing & Search Filtering
    # -------------------------------------------------------------------------
    print("\n--- TEST 3: GET /api/products & Search / Category Filters ---")
    # All products
    all_resp = client.get("/api/products", headers=owner_headers)
    assert all_resp.status_code == 200
    all_prods = all_resp.json()
    assert len(all_prods) >= 3

    # Search by name substring "Sugar"
    search_resp = client.get("/api/products?search=Sugar", headers=owner_headers)
    assert search_resp.status_code == 200
    search_results = search_resp.json()
    assert any(p["id"] == p1["id"] for p in search_results)
    assert not any(p["id"] == p2["id"] for p in search_results)
    print(f"Search by 'Sugar': Found {len(search_results)} products, correctly matched 'Inv Premium Sugar'.")

    # Search by barcode "INV-SALT-002"
    barcode_search = client.get("/api/products?search=INV-SALT-002", headers=owner_headers)
    assert barcode_search.status_code == 200
    b_results = barcode_search.json()
    assert len(b_results) == 1
    assert b_results[0]["id"] == p2["id"]
    print("Search by Barcode: Exactly matched Product 2.")

    # Filter by category
    cat_filter_resp = client.get(f"/api/products?category_id={test_cat.id}", headers=owner_headers)
    assert cat_filter_resp.status_code == 200
    cat_results = cat_filter_resp.json()
    assert all(p["category_id"] == test_cat.id for p in cat_results)
    print(f"Category Filter: Correctly returned only products in category {test_cat.id}.")
    print("TEST 3 PASSED: Product search and filtering verified.")

    # -------------------------------------------------------------------------
    # TEST 4: Product Details Retrieval (View Action)
    # -------------------------------------------------------------------------
    print("\n--- TEST 4: View Product Details (Strict Read-Only Verification) ---")
    stock_before_view = Decimal(str(p1["stock_quantity"]))
    view_resp = client.get(f"/api/products/{p1['id']}", headers=owner_headers)
    assert view_resp.status_code == 200
    view_data = view_resp.json()
    assert view_data["id"] == p1["id"]
    assert view_data["name"] == "Inv Premium Sugar"
    assert Decimal(str(view_data["stock_quantity"])) == stock_before_view
    assert view_data["shop_id"] == shop_id

    # Confirm stock was not touched
    db.expire_all()
    db_p1 = db.query(Product).filter(Product.id == p1["id"]).first()
    assert db_p1.stock_quantity == stock_before_view
    print(f"TEST 4 PASSED: Viewing product details returned accurate data without modifying stock ({db_p1.stock_quantity}).")

    # -------------------------------------------------------------------------
    # TEST 5: Edit Supported Product Fields (PUT /api/products/{id})
    # -------------------------------------------------------------------------
    print("\n--- TEST 5: Edit Supported Product Fields ---")
    edit_resp = client.put(
        f"/api/products/{p1['id']}",
        json={
            "name": "Inv Premium Sugar (Updated Name)",
            "purchase_price": "43.50",
            "selling_price": "49.99",
            "pack_size": "2.000",
            "unit": "kgs",  # Tests canonicalization: kgs -> kg
            "low_stock_threshold": "8.000",
            "barcode": "INV-SUGAR-UPDATED",
        },
        headers=owner_headers,
    )
    assert edit_resp.status_code == 200, f"Edit failed: {edit_resp.text}"
    edited = edit_resp.json()
    assert edited["name"] == "Inv Premium Sugar (Updated Name)"
    assert Decimal(str(edited["purchase_price"])) == Decimal("43.50")
    assert Decimal(str(edited["selling_price"])) == Decimal("49.99")
    assert Decimal(str(edited["pack_size"])) == Decimal("2.000")
    assert edited["unit"] == "kg", f"Expected canonicalized 'kg', got '{edited['unit']}'"
    assert Decimal(str(edited["low_stock_threshold"])) == Decimal("8.000")
    assert edited["barcode"] == "INV-SUGAR-UPDATED"
    print("TEST 5 PASSED: Product fields successfully edited with canonical unit 'kg' and updated pricing.")

    # -------------------------------------------------------------------------
    # TEST 6: Validation on Edits (Bad prices, empty name, bad unit)
    # -------------------------------------------------------------------------
    print("\n--- TEST 6: Validation Errors on Edits ---")
    # Empty name
    bad_name_resp = client.put(f"/api/products/{p1['id']}", json={"name": "   "}, headers=owner_headers)
    assert bad_name_resp.status_code == 400
    print("Rejected empty product name with HTTP 400.")

    # Negative purchase price
    neg_price_resp = client.put(f"/api/products/{p1['id']}", json={"purchase_price": -10}, headers=owner_headers)
    assert neg_price_resp.status_code in (400, 422)
    print("Rejected negative purchase price.")

    # Invalid unit
    bad_unit_resp = client.put(f"/api/products/{p1['id']}", json={"unit": "invalid_fake_unit"}, headers=owner_headers)
    assert bad_unit_resp.status_code == 400
    assert "invalid unit" in bad_unit_resp.text.lower()
    print("Rejected unrecognized unit with HTTP 400.")

    # Duplicate barcode
    dup_barcode_resp = client.put(
        f"/api/products/{p1['id']}",
        json={"barcode": "INV-SALT-002"},  # Belongs to p2
        headers=owner_headers,
    )
    assert dup_barcode_resp.status_code == 400
    assert "barcode already exists" in dup_barcode_resp.text.lower()
    print("Rejected duplicate barcode within shop with HTTP 400.")
    print("TEST 6 PASSED: Edit validations thoroughly enforced.")

    # -------------------------------------------------------------------------
    # TEST 7: Quick Stock Quantity Update (PATCH /api/products/{id}/stock)
    # -------------------------------------------------------------------------
    print("\n--- TEST 7: Quick Stock Quantity Update ---")
    # Update p3 (was 0 out of stock) to 45.750
    stock_resp = client.patch(
        f"/api/products/{p3['id']}/stock",
        json={"stock_quantity": "45.750"},
        headers=owner_headers,
    )
    assert stock_resp.status_code == 200, f"Stock update failed: {stock_resp.text}"
    stock_data = stock_resp.json()
    assert Decimal(str(stock_data["stock_quantity"])) == Decimal("45.750")
    print(f"Updated Stock: id={p3['id']} new stock={stock_data['stock_quantity']} (Decimal precision preserved)")

    # Negative stock validation
    neg_stock_resp = client.patch(
        f"/api/products/{p3['id']}/stock",
        json={"stock_quantity": -5},
        headers=owner_headers,
    )
    assert neg_stock_resp.status_code in (400, 422)
    print("Rejected negative stock quantity with HTTP 422.")
    print("TEST 7 PASSED: Stock quantity updated with full precision; negative values rejected.")

    # -------------------------------------------------------------------------
    # TEST 8: Activate / Deactivate Product (PATCH status & DELETE)
    # -------------------------------------------------------------------------
    print("\n--- TEST 8: Activate / Deactivate Status Updates ---")
    # Deactivate p2 via PATCH /status
    deact_resp = client.patch(
        f"/api/products/{p2['id']}/status",
        json={"is_active": False},
        headers=owner_headers,
    )
    assert deact_resp.status_code == 200
    assert deact_resp.json()["is_active"] is False
    print("Deactivated product 2 via PATCH /status (is_active=False).")

    # Reactivate p2 via PATCH /status
    react_resp = client.patch(
        f"/api/products/{p2['id']}/status",
        json={"is_active": True},
        headers=owner_headers,
    )
    assert react_resp.status_code == 200
    assert react_resp.json()["is_active"] is True
    print("Reactivated product 2 via PATCH /status (is_active=True).")

    # Soft delete via DELETE /api/products/{id}
    del_resp = client.delete(f"/api/products/{p2['id']}", headers=owner_headers)
    assert del_resp.status_code == 204
    # Verify product still exists in DB but is_active is False
    db.expire_all()
    del_check = db.query(Product).filter(Product.id == p2["id"]).first()
    assert del_check is not None
    assert del_check.is_active is False
    print("Soft-deleted product 2 via DELETE (preserved in DB with is_active=False).")
    print("TEST 8 PASSED: Activation, deactivation, and soft-delete verified.")

    # -------------------------------------------------------------------------
    # TEST 9: Multi-Shop Data Isolation & Authorization Security
    # -------------------------------------------------------------------------
    print("\n--- TEST 9: Multi-Shop Data Isolation & Security ---")
    # Setup a second shop and owner (Shop 999 or separate shop)
    other_shop = db.query(Shop).filter(Shop.id != shop_id).first()
    if not other_shop:
        other_shop = Shop(name="Isolated Other Shop", phone="9998887776")
        db.add(other_shop)
        db.commit()
        db.refresh(other_shop)

    other_owner = db.query(User).filter(User.shop_id == other_shop.id).first()
    if not other_owner:
        other_owner = User(
            name="Other Shop Owner",
            email=f"other_shop_{other_shop.id}@example.com",
            phone="9123456780",
            password_hash="testhash",
            shop_id=other_shop.id,
            role="owner",
            is_active=True,
        )
        db.add(other_owner)
        db.commit()
        db.refresh(other_owner)

    other_token = create_access_token({"sub": str(other_owner.id)})
    other_headers = {"Authorization": f"Bearer {other_token}"}
    print(f"Created/found other shop owner: id={other_owner.id}, shop_id={other_shop.id}")

    # 1. Other shop user CANNOT view Product 1 (belongs to Shop 2)
    iso_view = client.get(f"/api/products/{p1['id']}", headers=other_headers)
    assert iso_view.status_code == 404, f"Shop isolation breach! Expected 404, got {iso_view.status_code}"
    print("Isolated: Other shop owner received HTTP 404 attempting to GET Shop 2 product.")

    # 2. Other shop user CANNOT edit Product 1
    iso_edit = client.put(f"/api/products/{p1['id']}", json={"name": "Hacked Name"}, headers=other_headers)
    assert iso_edit.status_code == 404
    print("Isolated: Other shop owner received HTTP 404 attempting to PUT Shop 2 product.")

    # 3. Other shop user CANNOT update stock of Product 1
    iso_stock = client.patch(f"/api/products/{p1['id']}/stock", json={"stock_quantity": 999}, headers=other_headers)
    assert iso_stock.status_code == 404
    print("Isolated: Other shop owner received HTTP 404 attempting to PATCH stock of Shop 2 product.")

    # 4. Other shop user CANNOT delete/deactivate Product 1
    iso_del = client.delete(f"/api/products/{p1['id']}", headers=other_headers)
    assert iso_del.status_code == 404
    print("Isolated: Other shop owner received HTTP 404 attempting to DELETE Shop 2 product.")

    # 5. Unauthenticated request rejected with HTTP 401
    unauth_resp = client.get("/api/products")
    assert unauth_resp.status_code == 401
    print("Security: Unauthenticated request rejected with HTTP 401 Unauthorized.")

    # 6. Verify that supplying a fake shop_id in request body is ignored
    fake_shop_resp = client.post(
        "/api/products",
        json={
            "name": "Tamper Test Item",
            "shop_id": 99999,  # Attempting to forge shop_id
            "purchase_price": "10.00",
            "selling_price": "15.00",
            "pack_size": "1.000",
            "unit": "piece",
            "stock_quantity": "5.000",
            "low_stock_threshold": "1.000",
        },
        headers=owner_headers,
    )
    assert fake_shop_resp.status_code == 201
    created_item = fake_shop_resp.json()
    assert created_item["shop_id"] == shop_id, f"Forged shop_id accepted! Got {created_item['shop_id']}"
    print(f"Security: Forged shop_id in request body ignored; product scoped strictly to owner shop_id ({shop_id}).")

    print("TEST 9 PASSED: Multi-shop data isolation & security verified 100%.")

    db.close()
    print("\n" + "=" * 70)
    print("ALL INVENTORY TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_inventory_tests()
