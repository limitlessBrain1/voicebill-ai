"""Automated verification suite for MVP Thermal Receipt Printing (VoiceBill.AI).

Tests:
1. Historical Snapshot Integrity: Modifying product name or price in catalog preserves historical sale snapshot.
2. Single-Item Sale Receipt validation.
3. Multi-Item Sale Receipt with long product names, decimal quantities, and large totals.
4. Reprinting & Idempotency: Multiple reprints must NEVER create sales or deduct stock.
5. Accurate Shop Details & Payment Metadata without inventing missing fields.
"""
from datetime import datetime, timezone
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
from app.utils.jwt import create_access_token

client = TestClient(app)


def get_auth_token(user: User) -> str:
    return create_access_token({"sub": str(user.id)})


def run_thermal_receipt_tests():
    print("=" * 70)
    print("STARTING MVP THERMAL RECEIPT PRINTING AUTOMATED VERIFICATION")
    print("=" * 70)

    db = SessionLocal()

    # Find owner user & shop
    owner = db.query(User).filter(User.role == "owner").first()
    assert owner is not None, "No owner user found in database"
    shop = db.query(Shop).filter(Shop.id == owner.shop_id).first()
    assert shop is not None, "Shop not found for owner"

    token = get_auth_token(owner)
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Testing with User ID: {owner.id}, Shop: '{shop.name}' (ID {shop.id})")

    # Ensure a category exists
    category = db.query(Category).filter(Category.shop_id == shop.id).first()
    if not category:
        category = Category(name="Staples & Groceries", shop_id=shop.id)
        db.add(category)
        db.commit()
        db.refresh(category)

    # -------------------------------------------------------------------------
    # TEST 1: Historical Snapshot Integrity Under Product Modifications
    # -------------------------------------------------------------------------
    print("\n--- Test 1: Historical Sale Snapshot Integrity ---")
    orig_name = "Fortune Pure Mustard Oil Bottle 1L"
    orig_price = Decimal("145.00")
    orig_stock = Decimal("50.000")

    # Create a test product
    product_snap = Product(
        shop_id=shop.id,
        category_id=category.id,
        name=orig_name,
        pack_size=Decimal("1.000"),
        unit="litre",
        purchase_price=Decimal("120.00"),
        selling_price=orig_price,
        stock_quantity=orig_stock,
        low_stock_threshold=Decimal("5.000"),
        is_active=True,
    )
    db.add(product_snap)
    db.commit()
    db.refresh(product_snap)

    # Create a completed sale using this product
    rn_snap = f"TEST-SNAP-{int(datetime.now().timestamp())}"
    sold_qty = Decimal("2.500")
    item_total = Decimal("362.50")  # 2.500 * 145.00

    sale_snap = Sale(
        receipt_number=rn_snap,
        shop_id=shop.id,
        user_id=owner.id,
        subtotal=item_total,
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        total_amount=item_total,
        payment_method="cash",
        payment_status="completed",
        amount_received=Decimal("400.00"),
        change_due=Decimal("37.50"),
    )
    db.add(sale_snap)
    db.commit()
    db.refresh(sale_snap)

    sale_item = SaleItem(
        sale_id=sale_snap.id,
        product_id=product_snap.id,
        product_name=product_snap.name,
        unit=product_snap.unit,
        unit_price=product_snap.selling_price,
        quantity=sold_qty,
        line_total=item_total,
    )
    db.add(sale_item)
    db.commit()

    # Now modify the product in the catalog (price jump, name renamed)
    product_snap.name = "REBRANDED Ultra Mustard Oil 1L Eco Pack"
    product_snap.selling_price = Decimal("195.00")
    db.commit()

    # Fetch the receipt via API
    resp = client.get(f"/api/sales/receipt/{rn_snap}", headers=headers)
    assert resp.status_code == 200, f"Failed to get receipt: {resp.text}"
    receipt_data = resp.json()

    # The receipt snapshot MUST reflect original historical name and price
    receipt_item = receipt_data["items"][0]
    assert receipt_item["product_name"] == orig_name, (
        f"Snapshot broken! Expected '{orig_name}', got '{receipt_item['product_name']}'"
    )
    assert Decimal(str(receipt_item["unit_price"])) == orig_price, (
        f"Snapshot price altered! Expected {orig_price}, got {receipt_item['unit_price']}"
    )
    assert Decimal(str(receipt_item["quantity"])) == sold_qty
    assert Decimal(str(receipt_item["line_total"])) == item_total
    print("PASS: Historical sale-item snapshots preserved intact after catalog product edits.")

    # -------------------------------------------------------------------------
    # TEST 2: Single-Item Sale Receipt Data Model & Totals
    # -------------------------------------------------------------------------
    print("\n--- Test 2: Single-Item Sale Receipt Validation ---")
    assert receipt_data["receipt_number"] == rn_snap
    assert receipt_data["payment_method"] == "cash"
    assert receipt_data["payment_status"] == "completed"
    assert Decimal(str(receipt_data["amount_received"])) == Decimal("400.00")
    assert Decimal(str(receipt_data["change_due"])) == Decimal("37.50")
    assert len(receipt_data["items"]) == 1
    assert receipt_data["shop"]["name"] == shop.name
    print("PASS: Single-item receipt structure, payment tender, and change verified.")

    # -------------------------------------------------------------------------
    # TEST 3: Multi-Item Sale with Long Names & Fractional Quantities
    # -------------------------------------------------------------------------
    print("\n--- Test 3: Multi-Item Sale with Long Product Names & Decimals ---")
    rn_multi = f"TEST-MULTI-{int(datetime.now().timestamp())}"
    multi_items_spec = [
        ("Aashirvaad Superior MP Select Sharbati Atta 5kg Eco Pouch", "kg", Decimal("320.00"), Decimal("1.000")),
        ("Tata Salt Vacuum Evaporated Pure Iodised Table Salt", "kg", Decimal("28.00"), Decimal("3.000")),
        ("Loose Raw Crystal Sugar Premium Superfine Grade", "kg", Decimal("44.00"), Decimal("2.750")),
        ("Amul Taaza Homogenised Toned Long-Life Milk", "litre", Decimal("72.00"), Decimal("1.500")),
        ("Sunfeast Dark Fantasy Choco Fills Premium Cookies Biscuit", "packet", Decimal("40.00"), Decimal("4.000")),
        ("Everest Kanda Lasun Masala Traditional Marathi Blend", "packet", Decimal("65.00"), Decimal("2.000")),
        ("Dettol Original Germ Protection Bathing Bar Soap 125g", "pcs", Decimal("45.00"), Decimal("3.000")),
        ("Cadbury Dairy Milk Silk Chocolate Bubbly", "pcs", Decimal("80.00"), Decimal("1.000")),
    ]

    total_subtotal = Decimal("0.00")
    multi_sale = Sale(
        receipt_number=rn_multi,
        shop_id=shop.id,
        user_id=owner.id,
        subtotal=Decimal("0.00"),
        discount_amount=Decimal("15.00"),
        tax_amount=Decimal("0.00"),
        total_amount=Decimal("0.00"),
        payment_method="upi",
        payment_status="completed",
        payment_reference="UPI/20261029/9876543210/OKAXIS",
    )
    db.add(multi_sale)
    db.commit()
    db.refresh(multi_sale)

    for item_name, unit, unit_price, qty in multi_items_spec:
        line_tot = unit_price * qty
        total_subtotal += line_tot
        db.add(
            SaleItem(
                sale_id=multi_sale.id,
                product_id=None,
                product_name=item_name,
                unit=unit,
                unit_price=unit_price,
                quantity=qty,
                line_total=line_tot,
            )
        )

    multi_sale.subtotal = total_subtotal
    multi_sale.total_amount = total_subtotal - multi_sale.discount_amount
    db.commit()

    resp_multi = client.get(f"/api/sales/{multi_sale.id}", headers=headers)
    assert resp_multi.status_code == 200
    multi_data = resp_multi.json()

    assert len(multi_data["items"]) == 8
    assert Decimal(str(multi_data["subtotal"])) == total_subtotal
    assert Decimal(str(multi_data["discount_amount"])) == Decimal("15.00")
    assert Decimal(str(multi_data["total_amount"])) == total_subtotal - Decimal("15.00")
    assert multi_data["payment_reference"] == "UPI/20261029/9876543210/OKAXIS"

    # Verify decimal handling
    sugar_item = next(it for it in multi_data["items"] if "Sugar" in it["product_name"])
    assert Decimal(str(sugar_item["quantity"])) == Decimal("2.750")
    assert Decimal(str(sugar_item["line_total"])) == Decimal("121.00")  # 44 * 2.750 = 121.00
    print("PASS: Multi-item sale (8 items) with long names, decimal quantities, and UPI reference verified.")

    # -------------------------------------------------------------------------
    # TEST 4: Idempotent Reprinting & Strict Inventory Immutability
    # -------------------------------------------------------------------------
    print("\n--- Test 4: Idempotent Reprinting & Zero Inventory Impact ---")
    # Record current sales count and current product stocks
    initial_sales_count = db.query(Sale).count()
    initial_product_snap_stock = db.query(Product).filter(Product.id == product_snap.id).first().stock_quantity

    # Simulate reprinting receipt 5 consecutive times
    for i in range(1, 6):
        r_resp = client.get(f"/api/sales/{multi_sale.id}", headers=headers)
        assert r_resp.status_code == 200, f"Reprint attempt {i} failed"
        # Also test receipt number lookup reprint
        rn_resp = client.get(f"/api/sales/receipt/{rn_multi}", headers=headers)
        assert rn_resp.status_code == 200

    # Verify no new sale was created
    final_sales_count = db.query(Sale).count()
    assert final_sales_count == initial_sales_count, (
        f"Reprinting created new sales! Initial: {initial_sales_count}, Final: {final_sales_count}"
    )

    # Verify inventory was completely untouched
    final_product_snap_stock = db.query(Product).filter(Product.id == product_snap.id).first().stock_quantity
    assert final_product_snap_stock == initial_product_snap_stock, (
        f"Stock altered by reprint! Initial: {initial_product_snap_stock}, Final: {final_product_snap_stock}"
    )
    print("PASS: Reprinting 5x is strictly idempotent; 0 sales added, 0 stock deducted.")

    # -------------------------------------------------------------------------
    # TEST 5: Shop Details Verification (No Invented Details)
    # -------------------------------------------------------------------------
    print("\n--- Test 5: Shop Details & Absence of Invented Info ---")
    shop_resp = multi_data["shop"]
    assert shop_resp["name"] == shop.name
    assert shop_resp["owner_name"] == shop.owner_name
    assert shop_resp["phone"] == shop.phone
    # Check that taxes/discounts are only shown when legitimately present
    assert Decimal(str(multi_data["tax_amount"])) == Decimal("0.00")
    print("PASS: Real store details preserved; no invented taxes or metadata.")

    print("\n" + "=" * 70)
    print("ALL MVP THERMAL RECEIPT PRINTING TESTS PASSED (5/5, 100%)")
    print("=" * 70)


if __name__ == "__main__":
    run_thermal_receipt_tests()
