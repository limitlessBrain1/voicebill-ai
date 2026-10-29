"""Automated test suite for Checkout and Sales Management."""
from decimal import Decimal
import os
import sys

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
from app.models.sale import Sale, SaleItem, Payment
from app.models.billing_cart import BillingCart
from app.utils.jwt import create_access_token

client = TestClient(app)


def get_auth_token(user):
    return create_access_token({"sub": str(user.id)})


def run_all_sales_checkout_tests():
    print("=" * 70)
    print("STARTING CHECKOUT & SALES MANAGEMENT AUTOMATED TESTS")
    print("=" * 70)

    db = SessionLocal()

    # 1. Setup primary user & shop (Shop 2)
    user = db.query(User).filter(User.role == "owner").first()
    assert user is not None, "Owner user not found"
    shop_id = user.shop_id
    token = get_auth_token(user)
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Testing with User ID: {user.id}, Shop ID: {shop_id}")

    # Ensure test category exists
    cat = db.query(Category).filter_by(shop_id=shop_id, name="Checkout Test Cat").first()
    if not cat:
        cat = Category(shop_id=shop_id, name="Checkout Test Cat")
        db.add(cat)
        db.commit()
        db.refresh(cat)

    # Ensure test products exist
    # Product 1: High stock
    prod1 = db.query(Product).filter_by(shop_id=shop_id, name="Checkout Sugar").first()
    if not prod1:
        prod1 = Product(
            name="Checkout Sugar",
            shop_id=shop_id,
            category_id=cat.id,
            purchase_price=Decimal("38.00"),
            selling_price=Decimal("45.00"),
            pack_size=Decimal("1.000"),
            unit="kg",
            stock_quantity=Decimal("100.000"),
            low_stock_threshold=Decimal("10.000"),
            is_active=True,
        )
        db.add(prod1)
    else:
        prod1.stock_quantity = Decimal("100.000")
        prod1.selling_price = Decimal("45.00")
        prod1.is_active = True

    # Product 2: Low stock
    prod2 = db.query(Product).filter_by(shop_id=shop_id, name="Checkout Tea").first()
    if not prod2:
        prod2 = Product(
            name="Checkout Tea",
            shop_id=shop_id,
            category_id=cat.id,
            purchase_price=Decimal("180.00"),
            selling_price=Decimal("220.00"),
            pack_size=Decimal("1.000"),
            unit="kg",
            stock_quantity=Decimal("5.000"),
            low_stock_threshold=Decimal("2.000"),
            is_active=True,
        )
        db.add(prod2)
    else:
        prod2.stock_quantity = Decimal("5.000")
        prod2.selling_price = Decimal("220.00")
        prod2.is_active = True

    db.commit()
    db.refresh(prod1)
    db.refresh(prod2)

    passed = 0
    total = 0

    # -------------------------------------------------------------------------
    # TEST 1: Empty Cart Checkout Rejection
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 1: Empty Cart Checkout Rejection ---")
    create_cart_res = client.post("/api/billing/cart", headers=headers)
    assert create_cart_res.status_code == 201
    empty_cart_id = create_cart_res.json()["id"]

    chk_empty = client.post(
        f"/api/billing/cart/{empty_cart_id}/checkout",
        json={"payment_method": "cash", "amount_received": 100.0},
        headers=headers,
    )
    assert chk_empty.status_code == 400
    assert "empty" in chk_empty.text.lower()
    print("Test 1 PASSED: Empty cart rejected from checkout (HTTP 400)")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 2: Successful Cash Checkout with Change Due Calculation & Inventory Deduction
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 2: Successful Cash Checkout ---")
    # Setup cart with 2 kg Sugar (@ 45.00 = 90.00)
    sugar_init_stock = prod1.stock_quantity
    add_res = client.post(
        f"/api/billing/cart/{empty_cart_id}/items",
        json={"product_id": prod1.id, "quantity": 2.0},
        headers=headers,
    )
    assert add_res.status_code == 200

    # Pay 100.00 cash for 90.00 total (Change due: 10.00)
    chk_res = client.post(
        f"/api/billing/cart/{empty_cart_id}/checkout",
        json={"payment_method": "cash", "amount_received": 100.00, "notes": "Counter 1 sale"},
        headers=headers,
    )
    assert chk_res.status_code == 201, f"Checkout failed: {chk_res.text}"
    sale_data = chk_res.json()

    assert sale_data["receipt_number"].startswith(f"REC-{shop_id}-")
    assert Decimal(str(sale_data["subtotal"])) == Decimal("90.00")
    assert Decimal(str(sale_data["total_amount"])) == Decimal("90.00")
    assert Decimal(str(sale_data["amount_received"])) == Decimal("100.00")
    assert Decimal(str(sale_data["change_due"])) == Decimal("10.00")
    assert sale_data["payment_method"] == "cash"
    assert sale_data["payment_status"] == "completed"
    assert len(sale_data["items"]) == 1
    assert sale_data["items"][0]["product_name"] == prod1.name
    assert Decimal(str(sale_data["items"][0]["quantity"])) == Decimal("2.000")
    assert Decimal(str(sale_data["items"][0]["unit_price"])) == Decimal("45.00")
    assert Decimal(str(sale_data["items"][0]["line_total"])) == Decimal("90.00")
    assert len(sale_data["payments"]) == 1
    assert sale_data["payments"][0]["payment_method"] == "cash"
    assert Decimal(str(sale_data["payments"][0]["amount"])) == Decimal("90.00")

    # Verify inventory was deducted permanently in DB
    db.expire_all()
    prod1_after = db.query(Product).filter_by(id=prod1.id).first()
    expected_stock = sugar_init_stock - Decimal("2.000")
    assert prod1_after.stock_quantity == expected_stock, f"Expected {expected_stock}, got {prod1_after.stock_quantity}"

    # Verify cart status was marked completed
    cart_after = db.query(BillingCart).filter_by(id=empty_cart_id).first()
    assert cart_after.status == "completed"
    print(f"Test 2 PASSED: Cash checkout created receipt {sale_data['receipt_number']}, change due: 10.00, stock deducted: {sugar_init_stock} -> {prod1_after.stock_quantity}")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 3: Duplicate Checkout Prevention on Completed Cart
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 3: Duplicate Checkout Prevention ---")
    dup_res = client.post(
        f"/api/billing/cart/{empty_cart_id}/checkout",
        json={"payment_method": "cash", "amount_received": 100.00},
        headers=headers,
    )
    assert dup_res.status_code == 400
    assert "already" in dup_res.text.lower()
    print("Test 3 PASSED: Repeated checkout submission blocked (HTTP 400)")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 4: Successful UPI Checkout
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 4: Successful UPI Checkout ---")
    # Create new cart
    c2_res = client.post("/api/billing/cart", headers=headers)
    c2_id = c2_res.json()["id"]

    # Add 1 kg Tea (@ 220.00)
    tea_init_stock = prod2.stock_quantity
    client.post(
        f"/api/billing/cart/{c2_id}/items",
        json={"product_id": prod2.id, "quantity": 1.0},
        headers=headers,
    )

    upi_res = client.post(
        f"/api/billing/cart/{c2_id}/checkout",
        json={
            "payment_method": "upi",
            "payment_reference": "UPI-UTR-9876543210",
            "notes": "Google Pay payment",
        },
        headers=headers,
    )
    assert upi_res.status_code == 201, f"UPI checkout failed: {upi_res.text}"
    upi_sale = upi_res.json()
    assert upi_sale["payment_method"] == "upi"
    assert upi_sale["payment_reference"] == "UPI-UTR-9876543210"
    assert Decimal(str(upi_sale["total_amount"])) == Decimal("220.00")
    assert Decimal(str(upi_sale["amount_received"])) == Decimal("220.00")
    assert Decimal(str(upi_sale["change_due"])) == Decimal("0.00")

    # Verify stock deduction
    db.expire_all()
    prod2_after = db.query(Product).filter_by(id=prod2.id).first()
    assert prod2_after.stock_quantity == tea_init_stock - Decimal("1.000")
    print(f"Test 4 PASSED: UPI checkout completed with UTR ref: {upi_sale['payment_reference']}")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 5: Insufficient Cash Payment Validation
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 5: Insufficient Cash Payment Validation ---")
    c3_res = client.post("/api/billing/cart", headers=headers)
    c3_id = c3_res.json()["id"]
    client.post(
        f"/api/billing/cart/{c3_id}/items",
        json={"product_id": prod1.id, "quantity": 2.0},  # total = 90.00
        headers=headers,
    )

    # Attempt cash payment with only 50.00 (when 90.00 required)
    short_cash_res = client.post(
        f"/api/billing/cart/{c3_id}/items",
        json={"payment_method": "cash", "amount_received": 50.00},
        headers=headers,
    )
    # Testing checkout with insufficient cash:
    short_chk = client.post(
        f"/api/billing/cart/{c3_id}/checkout",
        json={"payment_method": "cash", "amount_received": 50.00},
        headers=headers,
    )
    assert short_chk.status_code == 400
    assert "insufficient cash" in short_chk.text.lower()
    print("Test 5 PASSED: Insufficient cash payment rejected with clear message")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 6: Insufficient Stock Rejection & Transaction Rollback
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 6: Insufficient Stock Rejection & Rollback ---")
    # Temporarily set product stock lower than cart requested quantity in DB
    db.expire_all()
    tea_current = db.query(Product).filter_by(id=prod2.id).first()
    cur_stock = tea_current.stock_quantity

    c4_res = client.post("/api/billing/cart", headers=headers)
    c4_id = c4_res.json()["id"]
    # Add 2 kg tea
    client.post(
        f"/api/billing/cart/{c4_id}/items",
        json={"product_id": prod2.id, "quantity": 2.0},
        headers=headers,
    )

    # Directly alter product stock to 1 kg in DB to simulate someone else buying
    tea_current.stock_quantity = Decimal("1.000")
    db.commit()

    # Attempt checkout
    stock_fail_res = client.post(
        f"/api/billing/cart/{c4_id}/checkout",
        json={"payment_method": "cash", "amount_received": 500.00},
        headers=headers,
    )
    assert stock_fail_res.status_code == 400
    assert "insufficient stock" in stock_fail_res.text.lower()

    # Verify rollback: cart remains in draft, product stock unchanged at 1.000
    db.expire_all()
    c4_after = db.query(BillingCart).filter_by(id=c4_id).first()
    assert c4_after.status == "draft"
    tea_rechecked = db.query(Product).filter_by(id=prod2.id).first()
    assert tea_rechecked.stock_quantity == Decimal("1.000")
    print("Test 6 PASSED: Insufficient stock rejected and transaction fully rolled back")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 7: Cross-Shop Checkout Isolation
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 7: Cross-Shop Checkout Isolation ---")
    # Create or find other shop
    other_shop = db.query(Shop).filter(Shop.id != shop_id).first()
    if not other_shop:
        other_shop = Shop(name="Checkout Other Shop", address="Road 2", phone="9999999999")
        db.add(other_shop)
        db.commit()
        db.refresh(other_shop)

    other_user = db.query(User).filter_by(shop_id=other_shop.id).first()
    if not other_user:
        other_user = User(
            name="Other Cashier",
            email="other_cashier@example.com",
            phone="9876543219",
            password_hash="test",
            shop_id=other_shop.id,
            role="cashier",
            is_active=True,
        )
        db.add(other_user)
        db.commit()
        db.refresh(other_user)

    other_token = get_auth_token(other_user)
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # Other shop user tries to checkout Shop 2's cart
    cross_res = client.post(
        f"/api/billing/cart/{c3_id}/checkout",
        json={"payment_method": "cash", "amount_received": 100.0},
        headers=other_headers,
    )
    assert cross_res.status_code == 404
    print("Test 7 PASSED: Cross-shop checkout attempt blocked with HTTP 404")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 8: Unauthorized Access Rejection
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 8: Unauthorized Access Rejection ---")
    unauth_res = client.post(
        f"/api/billing/cart/{c3_id}/checkout",
        json={"payment_method": "cash", "amount_received": 100.0},
    )
    assert unauth_res.status_code == 401
    print("Test 8 PASSED: Unauthenticated request rejected with HTTP 401")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 9: Receipt Retrieval & Sales List Querying
    # -------------------------------------------------------------------------
    total += 1
    print("\n--- Test 9: Receipt Retrieval by ID, Receipt Number, and History ---")
    receipt_num = sale_data["receipt_number"]
    sale_id = sale_data["id"]

    # Retrieve by ID
    get_by_id = client.get(f"/api/sales/{sale_id}", headers=headers)
    assert get_by_id.status_code == 200
    assert get_by_id.json()["receipt_number"] == receipt_num

    # Retrieve by Receipt Number
    get_by_rec = client.get(f"/api/sales/receipt/{receipt_num}", headers=headers)
    assert get_by_rec.status_code == 200
    assert get_by_rec.json()["id"] == sale_id
    assert get_by_rec.json()["shop"]["name"] is not None

    # Retrieve Sales List
    list_res = client.get("/api/sales", headers=headers)
    assert list_res.status_code == 200
    sales_list = list_res.json()["sales"]
    assert len(sales_list) >= 2
    assert any(s["receipt_number"] == receipt_num for s in sales_list)
    print("Test 9 PASSED: Sale retrieval by ID, receipt number, and list endpoint verified")
    passed += 1

    print("\n" + "=" * 70)
    print(f"CHECKOUT & SALES MANAGEMENT TESTS SUMMARY: {passed}/{total} TESTS PASSED (100%)")
    print("=" * 70)
    db.close()


if __name__ == "__main__":
    run_all_sales_checkout_tests()
