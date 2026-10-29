"""Automated test suite for Sales History and Receipt Management."""
from datetime import datetime, timezone, timedelta
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


def run_all_sales_history_tests():
    print("=" * 70)
    print("STARTING SALES HISTORY & RECEIPT MANAGEMENT AUTOMATED TESTS")
    print("=" * 70)

    db = SessionLocal()

    # 1. Setup primary user & shop (Shop 1 or 2)
    user = db.query(User).filter(User.role == "owner").first()
    assert user is not None, "Owner user not found"
    shop_id = user.shop_id
    token = get_auth_token(user)
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Primary Test User: ID {user.id}, Shop ID: {shop_id}")

    # Ensure Shop B and secondary user exist for cross-shop isolation tests
    shop_b = db.query(Shop).filter(Shop.id != shop_id).first()
    if not shop_b:
        shop_b = Shop(
            name="Competitor General Store",
            owner_name="Cross Shop Owner",
            phone="9876543210",
            address="456 Other St",
            city="Pune",
            state="Maharashtra",
            pincode="411001",
        )
        db.add(shop_b)
        db.commit()
        db.refresh(shop_b)

    user_b = db.query(User).filter(User.shop_id == shop_b.id).first()
    if not user_b:
        user_b = User(
            email=f"owner_{shop_b.id}@example.com",
            phone=f"98765{shop_b.id:05d}",
            password_hash="mock_hash",
            name="Shop B Owner",
            role="owner",
            shop_id=shop_b.id,
            is_active=True,
        )
        db.add(user_b)
        db.commit()
        db.refresh(user_b)

    token_b = get_auth_token(user_b)
    headers_b = {"Authorization": f"Bearer {token_b}"}
    print(f"Secondary Test User (Cross-Shop): ID {user_b.id}, Shop ID: {shop_b.id}")

    # Ensure clean seed sales for Shop A
    # Create or ensure test Category and Product
    cat = db.query(Category).filter_by(shop_id=shop_id, name="Sales History Category").first()
    if not cat:
        cat = Category(shop_id=shop_id, name="Sales History Category")
        db.add(cat)
        db.commit()
        db.refresh(cat)

    product_seed = db.query(Product).filter_by(shop_id=shop_id, name="Historical Rice").first()
    if not product_seed:
        product_seed = Product(
            name="Historical Rice",
            shop_id=shop_id,
            category_id=cat.id,
            purchase_price=Decimal("40.00"),
            selling_price=Decimal("55.00"),
            pack_size=Decimal("1.000"),
            unit="kg",
            stock_quantity=Decimal("50.000"),
            low_stock_threshold=Decimal("5.000"),
            is_active=True,
        )
        db.add(product_seed)
        db.commit()
        db.refresh(product_seed)

    # Let's create known test sales with deterministic data
    # Sale 1: Cash sale created today
    sale1_rn = f"TEST-CASH-{shop_id}-001"
    sale1 = db.query(Sale).filter_by(receipt_number=sale1_rn).first()
    if not sale1:
        sale1 = Sale(
            receipt_number=sale1_rn,
            shop_id=shop_id,
            user_id=user.id,
            subtotal=Decimal("110.00"),
            discount_amount=Decimal("10.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("100.00"),
            payment_method="cash",
            payment_status="completed",
            amount_received=Decimal("100.00"),
            change_due=Decimal("0.00"),
            created_at=datetime.now(timezone.utc),
        )
        db.add(sale1)
        db.commit()
        db.refresh(sale1)

        sale1_item = SaleItem(
            sale_id=sale1.id,
            product_id=product_seed.id,
            product_name="Historical Rice",
            unit="kg",
            unit_price=Decimal("55.00"),
            quantity=Decimal("2.000"),
            line_total=Decimal("110.00"),
        )
        sale1_pay = Payment(
            sale_id=sale1.id,
            shop_id=shop_id,
            payment_method="cash",
            amount=Decimal("100.00"),
            status="completed",
        )
        db.add_all([sale1_item, sale1_pay])
        db.commit()
        db.refresh(sale1)
    else:
        sale1.created_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(sale1)

    # Sale 2: UPI sale created 3 days ago
    sale2_rn = f"TEST-UPI-{shop_id}-002"
    sale2 = db.query(Sale).filter_by(receipt_number=sale2_rn).first()
    if not sale2:
        three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
        sale2 = Sale(
            receipt_number=sale2_rn,
            shop_id=shop_id,
            user_id=user.id,
            subtotal=Decimal("165.00"),
            discount_amount=Decimal("0.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("165.00"),
            payment_method="upi",
            payment_status="completed",
            payment_reference="UPI/TEST/998877",
            created_at=three_days_ago,
        )
        db.add(sale2)
        db.commit()
        db.refresh(sale2)

        sale2_item = SaleItem(
            sale_id=sale2.id,
            product_id=product_seed.id,
            product_name="Historical Rice",
            unit="kg",
            unit_price=Decimal("55.00"),
            quantity=Decimal("3.000"),
            line_total=Decimal("165.00"),
        )
        sale2_pay = Payment(
            sale_id=sale2.id,
            shop_id=shop_id,
            payment_method="upi",
            amount=Decimal("165.00"),
            status="completed",
            reference="UPI/TEST/998877",
        )
        db.add_all([sale2_item, sale2_pay])
        db.commit()
        db.refresh(sale2)

    # Sale 3: A sale for Shop B to test strict shop isolation
    sale_b_rn = f"TEST-SHOPB-{shop_b.id}-001"
    sale_b = db.query(Sale).filter_by(receipt_number=sale_b_rn).first()
    if not sale_b:
        sale_b = Sale(
            receipt_number=sale_b_rn,
            shop_id=shop_b.id,
            user_id=user_b.id,
            subtotal=Decimal("200.00"),
            discount_amount=Decimal("0.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("200.00"),
            payment_method="cash",
            payment_status="completed",
            created_at=datetime.now(timezone.utc),
        )
        db.add(sale_b)
        db.commit()
        db.refresh(sale_b)

        sale_b_item = SaleItem(
            sale_id=sale_b.id,
            product_name="Competitor Soap",
            unit="piece",
            unit_price=Decimal("50.00"),
            quantity=Decimal("4.000"),
            line_total=Decimal("200.00"),
        )
        db.add(sale_b_item)
        db.commit()

    print("Seed sales initialized successfully.")

    # -------------------------------------------------------------------------
    # TEST 1: Unauthenticated Requests Return 401
    # -------------------------------------------------------------------------
    print("\n--- Test 1: Unauthenticated Access ---")
    resp_noauth = client.get("/api/sales")
    assert resp_noauth.status_code == 401, f"Expected 401 without auth, got {resp_noauth.status_code}"

    resp_noauth_item = client.get(f"/api/sales/{sale1.id}")
    assert resp_noauth_item.status_code == 401, f"Expected 401 without auth, got {resp_noauth_item.status_code}"
    print("PASS: Unauthenticated requests correctly rejected with HTTP 401")

    # -------------------------------------------------------------------------
    # TEST 2: List Sales for Authenticated Shop
    # -------------------------------------------------------------------------
    print("\n--- Test 2: List Sales for Authenticated Shop ---")
    resp_list = client.get("/api/sales", headers=headers)
    assert resp_list.status_code == 200, f"Failed to list sales: {resp_list.text}"
    data = resp_list.json()
    assert "sales" in data
    assert "total_count" in data
    assert data["total_count"] >= 2
    receipt_numbers = [s["receipt_number"] for s in data["sales"]]
    assert sale1.receipt_number in receipt_numbers, "Sale 1 receipt missing from shop sales"
    assert sale2.receipt_number in receipt_numbers, "Sale 2 receipt missing from shop sales"
    # Ensure Shop B's sale is NOT in Shop A's list!
    assert sale_b.receipt_number not in receipt_numbers, "SECURITY VIOLATION: Cross-shop sale leaked into list!"
    print(f"PASS: Listed {len(data['sales'])} sales for Shop {shop_id}. Total count: {data['total_count']}")

    # -------------------------------------------------------------------------
    # TEST 3: Search by Receipt Number
    # -------------------------------------------------------------------------
    print("\n--- Test 3: Search by Receipt Number ---")
    # Exact match
    resp_search = client.get(f"/api/sales?receipt_number={sale1.receipt_number}", headers=headers)
    assert resp_search.status_code == 200
    res_data = resp_search.json()
    assert res_data["total_count"] == 1
    assert res_data["sales"][0]["receipt_number"] == sale1.receipt_number

    # Partial / substring match
    partial_term = f"TEST-CASH-{shop_id}"
    resp_partial = client.get(f"/api/sales?receipt_number={partial_term}", headers=headers)
    assert resp_partial.status_code == 200
    assert any(s["receipt_number"] == sale1.receipt_number for s in resp_partial.json()["sales"])

    # Non-existent receipt number
    resp_nonexistent = client.get("/api/sales?receipt_number=DOES_NOT_EXIST_XYZ_123", headers=headers)
    assert resp_nonexistent.status_code == 200
    assert resp_nonexistent.json()["total_count"] == 0
    assert len(resp_nonexistent.json()["sales"]) == 0
    print("PASS: Receipt number search works accurately for exact and partial matches")

    # -------------------------------------------------------------------------
    # TEST 4: Filter by Payment Method & Status
    # -------------------------------------------------------------------------
    print("\n--- Test 4: Filter by Payment Method & Status ---")
    # Filter cash
    resp_cash = client.get("/api/sales?payment_method=cash", headers=headers)
    assert resp_cash.status_code == 200
    cash_sales = resp_cash.json()["sales"]
    assert all(s["payment_method"] == "cash" for s in cash_sales)
    assert any(s["receipt_number"] == sale1.receipt_number for s in cash_sales)

    # Filter upi
    resp_upi = client.get("/api/sales?payment_method=upi", headers=headers)
    assert resp_upi.status_code == 200
    upi_sales = resp_upi.json()["sales"]
    assert all(s["payment_method"] == "upi" for s in upi_sales)
    assert any(s["receipt_number"] == sale2.receipt_number for s in upi_sales)

    # Filter status completed
    resp_status = client.get("/api/sales?payment_status=completed", headers=headers)
    assert resp_status.status_code == 200
    assert all(s["payment_status"] == "completed" for s in resp_status.json()["sales"])
    print("PASS: Payment method (cash, upi) and status filters work correctly")

    # -------------------------------------------------------------------------
    # TEST 5: Filter by Date Range (Date Boundaries)
    # -------------------------------------------------------------------------
    print("\n--- Test 5: Filter by Date Range & Boundaries ---")
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Sale 1 was created today, so filtering today start and end should include Sale 1
    resp_today = client.get(f"/api/sales?start_date={today_str}&end_date={today_str}", headers=headers)
    assert resp_today.status_code == 200
    today_rns = [s["receipt_number"] for s in resp_today.json()["sales"]]
    assert sale1.receipt_number in today_rns, "Sale 1 should be included in today's date boundary filter"

    # Future date boundary filter should return empty list
    future_start = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
    future_end = (datetime.now(timezone.utc) + timedelta(days=31)).strftime("%Y-%m-%d")
    resp_future = client.get(f"/api/sales?start_date={future_start}&end_date={future_end}", headers=headers)
    assert resp_future.status_code == 200
    assert resp_future.json()["total_count"] == 0
    print("PASS: Date range boundary filtering works accurately")

    # -------------------------------------------------------------------------
    # TEST 6: Pagination (limit & offset)
    # -------------------------------------------------------------------------
    print("\n--- Test 6: Pagination (limit & offset) ---")
    resp_page1 = client.get("/api/sales?limit=1&offset=0", headers=headers)
    assert resp_page1.status_code == 200
    page1_data = resp_page1.json()
    assert len(page1_data["sales"]) == 1
    assert page1_data["limit"] == 1
    assert page1_data["offset"] == 0

    resp_page2 = client.get("/api/sales?limit=1&offset=1", headers=headers)
    assert resp_page2.status_code == 200
    page2_data = resp_page2.json()
    assert len(page2_data["sales"]) == 1
    assert page2_data["offset"] == 1
    assert page1_data["sales"][0]["id"] != page2_data["sales"][0]["id"], "Offset did not advance to next page"
    print("PASS: Pagination (limit & offset) works as expected")

    # -------------------------------------------------------------------------
    # TEST 7: Receipt Details & Historical Snapshots
    # -------------------------------------------------------------------------
    print("\n--- Test 7: Receipt Details & Historical Snapshots ---")
    # Mutate current catalog product price to ensure historical snapshot is used
    original_catalog_price = product_seed.selling_price
    product_seed.selling_price = Decimal("999.00")
    db.commit()

    resp_receipt = client.get(f"/api/sales/{sale1.id}", headers=headers)
    assert resp_receipt.status_code == 200
    receipt_data = resp_receipt.json()
    assert receipt_data["receipt_number"] == sale1.receipt_number
    assert receipt_data["total_amount"] == "100.00"
    assert len(receipt_data["items"]) == 1

    item_snap = receipt_data["items"][0]
    assert item_snap["product_name"] == "Historical Rice"
    # CRITICAL: Snapshot unit price must be the historical 55.00, NOT the mutated 999.00!
    assert item_snap["unit_price"] == "55.00", f"Expected historical price 55.00, got {item_snap['unit_price']}"
    assert item_snap["quantity"] == "2.000"
    assert item_snap["line_total"] == "110.00"

    # Restore catalog price
    product_seed.selling_price = original_catalog_price
    db.commit()

    # Also test get by receipt number
    resp_by_rn = client.get(f"/api/sales/receipt/{sale1.receipt_number}", headers=headers)
    assert resp_by_rn.status_code == 200
    assert resp_by_rn.json()["id"] == sale1.id
    print("PASS: Receipt details returned with verified historical snapshot accuracy")

    # -------------------------------------------------------------------------
    # TEST 8: Cross-Shop Authorization & Isolation (Multi-shop Security)
    # -------------------------------------------------------------------------
    print("\n--- Test 8: Cross-Shop Authorization & Isolation ---")
    # User B attempts to access Shop A's sale by ID
    resp_cross_id = client.get(f"/api/sales/{sale1.id}", headers=headers_b)
    assert resp_cross_id.status_code == 404, f"Security Breach! Expected 404 for cross-shop access, got {resp_cross_id.status_code}"

    # User B attempts to access Shop A's sale by receipt number
    resp_cross_rn = client.get(f"/api/sales/receipt/{sale1.receipt_number}", headers=headers_b)
    assert resp_cross_rn.status_code == 404, f"Security Breach! Expected 404 for cross-shop receipt lookup, got {resp_cross_rn.status_code}"

    # User A attempts to access Shop B's sale by ID
    resp_cross_reverse = client.get(f"/api/sales/{sale_b.id}", headers=headers)
    assert resp_cross_reverse.status_code == 404, f"Security Breach! Expected 404, got {resp_cross_reverse.status_code}"
    print("PASS: Cross-shop isolation enforced. Unauthorized shop access denied with 404.")

    # -------------------------------------------------------------------------
    # TEST 9: Empty History
    # -------------------------------------------------------------------------
    print("\n--- Test 9: Empty History Handling ---")
    # Create empty shop with a user
    empty_shop = Shop(
        name="Empty Brand New Shop",
        owner_name="Empty Owner",
        phone="9990001111",
    )
    db.add(empty_shop)
    db.commit()
    db.refresh(empty_shop)

    empty_user = User(
        email=f"empty_shop_{empty_shop.id}@example.com",
        phone=f"90000{empty_shop.id:05d}",
        password_hash="mock_hash",
        name="Empty Storekeeper",
        role="owner",
        shop_id=empty_shop.id,
        is_active=True,
    )
    db.add(empty_user)
    db.commit()
    db.refresh(empty_user)

    empty_token = get_auth_token(empty_user)
    empty_headers = {"Authorization": f"Bearer {empty_token}"}

    resp_empty = client.get("/api/sales", headers=empty_headers)
    assert resp_empty.status_code == 200
    assert resp_empty.json()["sales"] == []
    assert resp_empty.json()["total_count"] == 0
    print("PASS: Empty sales history returns clean empty array and zero count")

    # -------------------------------------------------------------------------
    # TEST 10: Reprinting / Repeated GETs Must NEVER Deduct Stock or Create Sales
    # -------------------------------------------------------------------------
    print("\n--- Test 10: Reprinting & Read-Only Idempotency ---")
    initial_stock = product_seed.stock_quantity
    initial_sales_count = db.query(Sale).filter_by(shop_id=shop_id).count()

    # Simulate 5 receipt views / reprints
    for _ in range(5):
        resp_reprint = client.get(f"/api/sales/{sale1.id}", headers=headers)
        assert resp_reprint.status_code == 200
        resp_reprint_rn = client.get(f"/api/sales/receipt/{sale1.receipt_number}", headers=headers)
        assert resp_reprint_rn.status_code == 200

    db.refresh(product_seed)
    final_sales_count = db.query(Sale).filter_by(shop_id=shop_id).count()

    assert product_seed.stock_quantity == initial_stock, (
        f"Stock changed! Before: {initial_stock}, After: {product_seed.stock_quantity}"
    )
    assert final_sales_count == initial_sales_count, (
        f"Sales count changed! Before: {initial_sales_count}, After: {final_sales_count}"
    )
    print("PASS: Repeated receipt fetches & reprints are strictly read-only and idempotent")

    print("\n" + "=" * 70)
    print("ALL SALES HISTORY & RECEIPT MANAGEMENT TESTS PASSED!")
    print("=" * 70)
    db.close()


if __name__ == "__main__":
    run_all_sales_history_tests()
