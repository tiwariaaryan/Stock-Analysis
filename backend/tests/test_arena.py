from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import ArenaSandbox, ArenaPosition
from app.services import arena_service

client = TestClient(app)


def get_test_user_id() -> int:
    res = client.get("/api/v1/profiles")
    assert res.status_code == 200
    for p in res.json():
        if p.get("username") == "test":
            return p["id"]
    return res.json()[0]["id"]


def test_create_and_list_sandboxes():
    uid = get_test_user_id()

    # List sandboxes - should auto-seed default starter sandboxes
    res = client.get(f"/api/v1/arena/sandboxes?user_id={uid}")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1

    # Create custom sandbox with arbitrary custom capital (e.g. ₹25,000)
    create_payload = {
        "name": "My Custom 25K Sandbox",
        "description": "Testing micro-capital strategy",
        "category": "CUSTOM",
        "horizon": "1W",
        "initial_capital": 25000.0,
        "auto_execute": True,
    }
    res2 = client.post(f"/api/v1/arena/sandboxes?user_id={uid}", json=create_payload)
    assert res2.status_code == 200
    sb_data = res2.json()
    assert sb_data["name"] == "My Custom 25K Sandbox"
    assert float(sb_data["initial_capital"]) == 25000.0
    assert float(sb_data["current_cash"]) == 25000.0

    # Clean up custom sandbox
    client.delete(f"/api/v1/arena/sandboxes/{sb_data['id']}")


def test_paper_buy_and_sell_order():
    uid = get_test_user_id()

    # Create sandbox with 50,000 capital
    sb_res = client.post(f"/api/v1/arena/sandboxes?user_id={uid}", json={
        "name": "Swing Trading Lab",
        "category": "USER_INTUITION",
        "horizon": "1M",
        "initial_capital": 50000.0,
        "auto_execute": True,
    })
    sb_id = sb_res.json()["id"]

    try:
        # Place Buy order for 5 shares of RELIANCE with custom buy price 1300
        buy_order = {
            "symbol": "RELIANCE",
            "quantity": 5.0,
            "custom_buy_price": 1300.0,
            "target_sell_price": 1450.0,
            "stop_loss_price": 1200.0,
            "horizon": "1M",
            "rationale": "Swing pullback near EMA support",
        }
        order_res = client.post(f"/api/v1/arena/sandboxes/{sb_id}/orders", json=buy_order)
        assert order_res.status_code == 200
        pos_data = order_res.json()
        assert pos_data["symbol"] == "RELIANCE"
        assert float(pos_data["quantity"]) == 5.0
        assert float(pos_data["avg_buy_price"]) == 1300.0
        assert float(pos_data["target_sell_price"]) == 1450.0

        # Verify Sandbox Cash updated: 50,000 - (5 * 1300 = 6500) = 43,500
        detail_res = client.get(f"/api/v1/arena/sandboxes/{sb_id}")
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert float(detail["current_cash"]) == 43500.0
        assert len(detail["positions"]) == 1
        assert len(detail["trades"]) == 1

        # Manual sell
        pos_id = pos_data["id"]
        sell_res = client.post(f"/api/v1/arena/sandboxes/{sb_id}/positions/{pos_id}/sell")
        assert sell_res.status_code == 200
        sell_data = sell_res.json()
        assert sell_data["trade_type"] == "SELL_MANUAL"

        # Positions should now be empty and cash restored with proceeds
        detail_after = client.get(f"/api/v1/arena/sandboxes/{sb_id}").json()
        assert len(detail_after["positions"]) == 0
    finally:
        client.delete(f"/api/v1/arena/sandboxes/{sb_id}")


def test_auto_pilot_triggers():
    db = SessionLocal()
    sb = None
    try:
        # Create auto-executing sandbox
        sb = ArenaSandbox(
            user_id=1,
            name="Auto Pilot Unit Test",
            category="AI_INSTITUTIONAL",
            horizon="1M",
            initial_capital=Decimal("100000.00"),
            current_cash=Decimal("74000.00"),
            auto_execute=True,
        )
        db.add(sb)
        db.commit()
        db.refresh(sb)

        # Position 1: Target hit (target 100 while CMP is > 100)
        pos1 = ArenaPosition(
            sandbox_id=sb.id,
            symbol="RELIANCE",
            quantity=Decimal("5"),
            avg_buy_price=Decimal("1200.00"),
            target_sell_price=Decimal("100.00"),
            stop_loss_price=Decimal("50.00"),
        )
        db.add(pos1)
        db.commit()

        # Run trigger evaluation
        triggered = arena_service.check_and_execute_arena_triggers(db)
        assert len(triggered) >= 1

        # Verify position closed and trade history logged
        sb_detail = arena_service.get_sandbox_detail(db, sb.id)
        assert len(sb_detail.positions) == 0
        types = [t.trade_type for t in sb_detail.trades]
        assert "SELL_TARGET_HIT" in types
    finally:
        if sb and sb.id:
            try:
                arena_service.delete_sandbox(db, sb.id)
            except Exception:
                pass
        db.close()


def test_arena_leaderboard():
    uid = get_test_user_id()
    res = client.get(f"/api/v1/arena/leaderboard?user_id={uid}")
    assert res.status_code == 200
    lb = res.json()
    assert isinstance(lb, list)
    assert len(lb) >= 1
    for idx, item in enumerate(lb):
        assert item["rank"] == idx + 1


def test_position_quantity_and_target_update():
    uid = get_test_user_id()

    sb_res = client.post(f"/api/v1/arena/sandboxes?user_id={uid}", json={
        "name": "Edit Test Sandbox",
        "initial_capital": 50000.0,
        "auto_execute": True,
    })
    sb_id = sb_res.json()["id"]

    try:
        # Place buy order
        order_res = client.post(f"/api/v1/arena/sandboxes/{sb_id}/orders", json={
            "symbol": "RELIANCE",
            "quantity": 10.0,
            "custom_buy_price": 1000.0,
            "target_sell_price": 1200.0,
            "stop_loss_price": 900.0,
        })
        pos_id = order_res.json()["id"]

        # Update Custom Target and Quantity
        patch_res = client.patch(f"/api/v1/arena/sandboxes/{sb_id}/positions/{pos_id}", json={
            "custom_target_price": 1350.0,
            "quantity": 12.0,  # Increase by 2 shares
        })
        assert patch_res.status_code == 200
        updated_detail = patch_res.json()
        pos = updated_detail["positions"][0]
        assert float(pos["quantity"]) == 12.0
        assert float(pos["custom_target_price"]) == 1350.0
    finally:
        client.delete(f"/api/v1/arena/sandboxes/{sb_id}")
