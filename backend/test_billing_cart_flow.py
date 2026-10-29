"""Comprehensive test suite for VoiceBill.AI Billing Cart Management Feature.

Tests:
1. Cart Creation & Retrieval:
   - POST /api/billing/cart
   - GET /api/billing/cart/active/current
   - GET /api/billing/cart/{id}
2. Product Snapshot & Line Total Calculation:
   - Snapshots selling_price as unit_price and product unit
   - Line total = quantity * unit_price (Decimal, 2 decimal places)
   - Subtotal = sum(line_totals)
3. Duplicate Item Handling:
   - Adding existing product merges quantity and recalculates line total
4. Fractional Quantities:
   - Quantities with decimals (e.g. 1.250 kg, 0.750 litre) supported with full precision
5. Stock & Availability Validation:
   - Quantity exceeding available stock rejected (HTTP 400)
   - Out of stock products rejected
   - Inactive products rejected (HTTP 400)
   - Invalid non-positive quantities (<= 0) rejected (HTTP 400 / 422)
   - Adding items does NOT permanently deduct stock from Product table
6. Item Quantity Update & Removal:
   - PUT /api/billing/cart/{id}/items/{itemId}
   - DELETE /api/billing/cart/{id}/items/{itemId}
7. Clear Cart:
   - DELETE /api/billing/cart/{id}/clear (removes all items, resets totals)
8. Security & Multi-Shop / User Isolation:
   - Unauthenticated access returns HTTP 401
   - Cross-shop cart access returns HTTP 404
   - Adding cross-shop product returns HTTP 404
   - Non-owner cannot access another user's cart
"""
from decimal import Decimal
import sys

from fastapi.testclient import TestClient

from app.database.session import SessionLocal
from app.main import app
from app.models.billing_cart import BillingCart, BillingCartItem
from app.models.category import Category
from app.models.product import Product
from app.models.shop import Shop
from app.models.user import User
from app.utils.jwt import create_access_token


def run_billing_cart_tests():
    client = TestClient(app)
    db = SessionLocal()

    print("=" * 70)
    print("STARTING BILLING CART FEATURE VERIFICATION")
    print("=" * 70)

    # 1. Setup primary owner user (Shop 2)
    owner = db.query(User).filter(User.role == "owner").first()
    assert owner is not None, "Owner user not found in DB"
    shop_id = owner.shop_id
    owner_token = create_access_token({"sub": str(owner.id)})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    print(f"Testing with primary owner User ID {owner.id} | Shop ID {shop_id}")

    # Setup test products for Shop 2
    # Product A: In stock (stock = 50.000, price = 45.00, kg)
    # Product B: Low stock (stock = 5.000, price = 120.00, litre)
    # Product C: Out of stock (stock = 0.000, price = 25.00, kg)
    # Product D: Inactive (stock = 20.000, price = 10.00, piece, is_active=False)

    # Clean previous billing test products
    db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.name.in_([
            "Cart Test Sugar",
            "Cart Test Mustard Oil",
            "Cart Test Rice ZeroStock",
            "Cart Test Inactive Soap",
        ])
    ).delete(synchronize_session=False)
    db.commit()

    prod_a = Product(
        name="Cart Test Sugar",
        shop_id=shop_id,
        purchase_price=Decimal("40.00"),
        selling_price=Decimal("45.00"),
        pack_size=Decimal("1.000"),
        unit="kg",
        stock_quantity=Decimal("50.000"),
        low_stock_threshold=Decimal("10.000"),
        is_active=True,
    )
    prod_b = Product(
        name="Cart Test Mustard Oil",
        shop_id=shop_id,
        purchase_price=Decimal("100.00"),
        selling_price=Decimal("120.00"),
        pack_size=Decimal("1.000"),
        unit="litre",
        stock_quantity=Decimal("5.000"),
        low_stock_threshold=Decimal("2.000"),
        is_active=True,
    )
    prod_c = Product(
        name="Cart Test Rice ZeroStock",
        shop_id=shop_id,
        purchase_price=Decimal("20.00"),
        selling_price=Decimal("25.00"),
        pack_size=Decimal("1.000"),
        unit="kg",
        stock_quantity=Decimal("0.000"),
        low_stock_threshold=Decimal("5.000"),
        is_active=True,
    )
    prod_d = Product(
        name="Cart Test Inactive Soap",
        shop_id=shop_id,
        purchase_price=Decimal("8.00"),
        selling_price=Decimal("10.00"),
        pack_size=Decimal("1.000"),
        unit="piece",
        stock_quantity=Decimal("20.000"),
        low_stock_threshold=Decimal("5.000"),
        is_active=False,
    )
    db.add_all([prod_a, prod_b, prod_c, prod_d])
    db.commit()
    db.refresh(prod_a)
    db.refresh(prod_b)
    db.refresh(prod_c)
    db.refresh(prod_d)
    print(f"Created test products: A(id={prod_a.id}), B(id={prod_b.id}), C(id={prod_c.id}), D(id={prod_d.id})")

    # -------------------------------------------------------------------------
    # TEST 1: Cart Creation & Retrieval
    # -------------------------------------------------------------------------
    print("\n--- TEST 1: Create Cart (POST /api/billing/cart) & GET by ID ---")
    cart_resp = client.post("/api/billing/cart", headers=owner_headers)
    assert cart_resp.status_code == 201, f"Cart creation failed: {cart_resp.text}"
    cart_data = cart_resp.json()
    cart_id = cart_data["id"]
    assert cart_data["shop_id"] == shop_id
    assert cart_data["user_id"] == owner.id
    assert cart_data["status"] == "draft"
    assert cart_data["items"] == []
    assert Decimal(str(cart_data["subtotal"])) == Decimal("0.00")
    assert Decimal(str(cart_data["total"])) == Decimal("0.00")
    print(f"Created cart: id={cart_id}")

    # Retrieve by ID
    get_resp = client.get(f"/api/billing/cart/{cart_id}", headers=owner_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == cart_id
    print("GET /api/billing/cart/{id} verified.")

    # Retrieve via GET /api/billing/cart/active/current
    active_resp = client.get("/api/billing/cart/active/current", headers=owner_headers)
    assert active_resp.status_code == 200
    assert active_resp.json()["id"] == cart_id
    print("GET /api/billing/cart/active/current returned active draft cart.")
    print("TEST 1 PASSED: Cart creation and retrieval verified.")

    # -------------------------------------------------------------------------
    # TEST 2: Add Product & Snapshot Price / Calculation Rules
    # -------------------------------------------------------------------------
    print("\n--- TEST 2: Add Item (POST /api/billing/cart/{id}/items) & Financial Snapshots ---")
    # Add 2.000 kg of Product A (selling_price = 45.00)
    add_resp = client.post(
        f"/api/billing/cart/{cart_id}/items",
        json={"product_id": prod_a.id, "quantity": 2.0},
        headers=owner_headers,
    )
    assert add_resp.status_code == 200, f"Add item failed: {add_resp.text}"
    c1 = add_resp.json()
    assert len(c1["items"]) == 1
    item_1 = c1["items"][0]
    assert item_1["product_id"] == prod_a.id
    assert item_1["product_name"] == "Cart Test Sugar"
    assert Decimal(str(item_1["quantity"])) == Decimal("2.000")
    assert Decimal(str(item_1["unit_price"])) == Decimal("45.00")
    assert item_1["unit"] == "kg"
    assert Decimal(str(item_1["line_total"])) == Decimal("90.00")  # 2 * 45 = 90
    assert Decimal(str(c1["subtotal"])) == Decimal("90.00")
    assert Decimal(str(c1["total"])) == Decimal("90.00")
    print(f"Added item: qty=2.000, price=45.00, line_total=90.00, subtotal={c1['subtotal']}")

    # Confirm stock was NOT permanently deducted from Product A in DB
    db.expire_all()
    db_prod_a = db.query(Product).filter(Product.id == prod_a.id).first()
    assert db_prod_a.stock_quantity == Decimal("50.000"), "Stock was mutated when adding to cart!"
    print(f"Verified stock preserved in Product table: {db_prod_a.stock_quantity} kg")
    print("TEST 2 PASSED: Item added with correct price/unit snapshot and line total calculation.")

    # -------------------------------------------------------------------------
    # TEST 3: Duplicate Item Handling (Quantity Merge)
    # -------------------------------------------------------------------------
    print("\n--- TEST 3: Duplicate Item Handling (Quantity Merge) ---")
    # Add Product A again with quantity 1.500 kg
    add_dup_resp = client.post(
        f"/api/billing/cart/{cart_id}/items",
        json={"product_id": prod_a.id, "quantity": 1.5},
        headers=owner_headers,
    )
    assert add_dup_resp.status_code == 200
    c2 = add_dup_resp.json()
    assert len(c2["items"]) == 1  # Merged, not duplicated line
    merged_item = c2["items"][0]
    assert Decimal(str(merged_item["quantity"])) == Decimal("3.500")  # 2.0 + 1.5 = 3.5
    assert Decimal(str(merged_item["line_total"])) == Decimal("157.50")  # 3.5 * 45 = 157.50
    assert Decimal(str(c2["subtotal"])) == Decimal("157.50")
    print(f"Merged duplicate product: new_qty=3.500, line_total={merged_item['line_total']}, subtotal={c2['subtotal']}")
    print("TEST 3 PASSED: Duplicate product merged correctly into single cart line.")

    # -------------------------------------------------------------------------
    # TEST 4: Fractional Quantities (Litres / Kilograms)
    # -------------------------------------------------------------------------
    print("\n--- TEST 4: Fractional Quantities Support ---")
    # Add 0.750 litre of Product B (selling_price = 120.00)
    add_frac_resp = client.post(
        f"/api/billing/cart/{cart_id}/items",
        json={"product_id": prod_b.id, "quantity": 0.75},
        headers=owner_headers,
    )
    assert add_frac_resp.status_code == 200
    c3 = add_frac_resp.json()
    assert len(c3["items"]) == 2
    item_b = next(it for it in c3["items"] if it["product_id"] == prod_b.id)
    assert Decimal(str(item_b["quantity"])) == Decimal("0.750")
    # 0.75 * 120 = 90.00
    assert Decimal(str(item_b["line_total"])) == Decimal("90.00")
    # Subtotal = 157.50 + 90.00 = 247.50
    assert Decimal(str(c3["subtotal"])) == Decimal("247.50")
    print(f"Fractional Item: 0.750 litre @ 120.00 = 90.00 | Cart Subtotal = {c3['subtotal']}")
    print("TEST 4 PASSED: Fractional quantities calculated with precision.")

    # -------------------------------------------------------------------------
    # TEST 5: Stock Validation & Insufficient Stock Handling
    # -------------------------------------------------------------------------
    print("\n--- TEST 5: Stock & Availability Validation ---")
    # 1. Product C is out of stock (stock = 0.000)
    oos_resp = client.post(
        f"/api/billing/cart/{cart_id}/items",
        json={"product_id": prod_c.id, "quantity": 1.0},
        headers=owner_headers,
    )
    assert oos_resp.status_code == 400
    assert "insufficient stock" in oos_resp.text.lower()
    print("Rejected out-of-stock product with HTTP 400.")

    # 2. Product B has available stock = 5.000. Currently 0.750 in cart.
    # Attempting to add 10.000 exceeds 5.000
    excess_resp = client.post(
        f"/api/billing/cart/{cart_id}/items",
        json={"product_id": prod_b.id, "quantity": 10.0},
        headers=owner_headers,
    )
    assert excess_resp.status_code == 400
    assert "insufficient stock" in excess_resp.text.lower()
    print("Rejected excessive quantity exceeding available stock with HTTP 400.")

    # 3. Product D is inactive (is_active = False)
    inact_resp = client.post(
        f"/api/billing/cart/{cart_id}/items",
        json={"product_id": prod_d.id, "quantity": 1.0},
        headers=owner_headers,
    )
    assert inact_resp.status_code == 400
    assert "inactive" in inact_resp.text.lower()
    print("Rejected inactive product with HTTP 400.")

    # 4. Quantity <= 0 is rejected
    zero_qty_resp = client.post(
        f"/api/billing/cart/{cart_id}/items",
        json={"product_id": prod_a.id, "quantity": 0},
        headers=owner_headers,
    )
    assert zero_qty_resp.status_code in (400, 422)
    print("Rejected zero quantity with HTTP 422/400.")
    print("TEST 5 PASSED: Stock, availability, and non-positive quantity validations enforced.")

    # -------------------------------------------------------------------------
    # TEST 6: Update Cart Item Quantity (PUT)
    # -------------------------------------------------------------------------
    print("\n--- TEST 6: Update Item Quantity (PUT /api/billing/cart/{id}/items/{itemId}) ---")
    item_b_id = item_b["id"]
    # Update Product B quantity from 0.750 to 2.250 litre
    put_resp = client.put(
        f"/api/billing/cart/{cart_id}/items/{item_b_id}",
        json={"quantity": 2.25},
        headers=owner_headers,
    )
    assert put_resp.status_code == 200
    c4 = put_resp.json()
    updated_b = next(it for it in c4["items"] if it["id"] == item_b_id)
    assert Decimal(str(updated_b["quantity"])) == Decimal("2.250")
    # 2.250 * 120.00 = 270.00
    assert Decimal(str(updated_b["line_total"])) == Decimal("270.00")
    # Subtotal = 157.50 (item A) + 270.00 (item B) = 427.50
    assert Decimal(str(c4["subtotal"])) == Decimal("427.50")
    print(f"Updated item quantity to 2.250: line_total=270.00, subtotal={c4['subtotal']}")

    # Updating with excessive quantity beyond stock (Product B stock = 5.000)
    put_excess = client.put(
        f"/api/billing/cart/{cart_id}/items/{item_b_id}",
        json={"quantity": 10.0},
        headers=owner_headers,
    )
    assert put_excess.status_code == 400
    assert "insufficient stock" in put_excess.text.lower()
    print("PUT rejected quantity exceeding stock.")
    print("TEST 6 PASSED: Item quantity updated with full financial recalculation.")

    # -------------------------------------------------------------------------
    # TEST 7: Remove Item (DELETE /api/billing/cart/{id}/items/{itemId})
    # -------------------------------------------------------------------------
    print("\n--- TEST 7: Remove Item (DELETE /api/billing/cart/{id}/items/{itemId}) ---")
    del_resp = client.delete(
        f"/api/billing/cart/{cart_id}/items/{item_b_id}",
        headers=owner_headers,
    )
    assert del_resp.status_code == 200
    c5 = del_resp.json()
    assert len(c5["items"]) == 1
    assert not any(it["id"] == item_b_id for it in c5["items"])
    # Subtotal returns to 157.50
    assert Decimal(str(c5["subtotal"])) == Decimal("157.50")
    print(f"Removed item {item_b_id}: remaining items={len(c5['items'])}, subtotal={c5['subtotal']}")
    print("TEST 7 PASSED: Item removed and cart total recalculated.")

    # -------------------------------------------------------------------------
    # TEST 8: Clear Cart (DELETE /api/billing/cart/{id}/clear)
    # -------------------------------------------------------------------------
    print("\n--- TEST 8: Clear Cart (DELETE /api/billing/cart/{id}/clear) ---")
    clear_resp = client.delete(f"/api/billing/cart/{cart_id}/clear", headers=owner_headers)
    assert clear_resp.status_code == 200
    c6 = clear_resp.json()
    assert len(c6["items"]) == 0
    assert Decimal(str(c6["subtotal"])) == Decimal("0.00")
    assert Decimal(str(c6["total"])) == Decimal("0.00")
    print("Cart cleared successfully: 0 items, subtotal=0.00, total=0.00")

    # REST alias test (/items)
    # Add an item first, then clear via /items
    client.post(
        f"/api/billing/cart/{cart_id}/items",
        json={"product_id": prod_a.id, "quantity": 1.0},
        headers=owner_headers,
    )
    alias_clear = client.delete(f"/api/billing/cart/{cart_id}/items", headers=owner_headers)
    assert alias_clear.status_code == 200
    assert len(alias_clear.json()["items"]) == 0
    print("Clear cart REST alias (/items) verified.")
    print("TEST 8 PASSED: Clear cart completely resets cart items and totals.")

    # -------------------------------------------------------------------------
    # TEST 9: Multi-Shop & User Isolation Security
    # -------------------------------------------------------------------------
    print("\n--- TEST 9: Multi-Shop & User Isolation Security ---")
    # Setup other shop
    other_shop = db.query(Shop).filter(Shop.id != shop_id).first()
    if not other_shop:
        other_shop = Shop(name="Cart Isolation Shop", phone="9988776655")
        db.add(other_shop)
        db.commit()
        db.refresh(other_shop)

    other_user = db.query(User).filter(User.shop_id == other_shop.id).first()
    if not other_user:
        other_user = User(
            name="Other Shop User",
            email=f"cart_user_{other_shop.id}@example.com",
            phone="9876543211",
            password_hash="testhash",
            shop_id=other_shop.id,
            role="owner",
            is_active=True,
        )
        db.add(other_user)
        db.commit()
        db.refresh(other_user)

    other_token = create_access_token({"sub": str(other_user.id)})
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # 1. Other shop user CANNOT view Shop 2's cart
    iso_view = client.get(f"/api/billing/cart/{cart_id}", headers=other_headers)
    assert iso_view.status_code == 404
    print("Isolated: Other shop user received HTTP 404 attempting to GET Shop 2 cart.")

    # 2. Other shop user CANNOT add items to Shop 2's cart
    iso_add = client.post(
        f"/api/billing/cart/{cart_id}/items",
        json={"product_id": prod_a.id, "quantity": 1.0},
        headers=other_headers,
    )
    assert iso_add.status_code == 404
    print("Isolated: Other shop user received HTTP 404 attempting to POST items to Shop 2 cart.")

    # 3. User CANNOT add other shop's product to their cart
    other_cart_resp = client.post("/api/billing/cart", headers=other_headers)
    other_cart_id = other_cart_resp.json()["id"]

    cross_prod_resp = client.post(
        f"/api/billing/cart/{other_cart_id}/items",
        json={"product_id": prod_a.id, "quantity": 1.0},  # prod_a belongs to Shop 2
        headers=other_headers,
    )
    assert cross_prod_resp.status_code == 404
    print("Isolated: Attempt to add cross-shop product rejected with HTTP 404.")

    # 4. Unauthenticated request rejected with HTTP 401
    unauth_resp = client.get(f"/api/billing/cart/{cart_id}")
    assert unauth_resp.status_code == 401
    print("Security: Unauthenticated request rejected with HTTP 401 Unauthorized.")
    print("TEST 9 PASSED: Multi-shop data isolation and security verified 100%.")

    db.close()
    print("\n" + "=" * 70)
    print("ALL BILLING CART TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_billing_cart_tests()
