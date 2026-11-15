from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_test_user_id() -> int:
    res = client.get("/api/v1/profiles")
    assert res.status_code == 200
    for p in res.json():
        if p.get("username") == "test":
            return p["id"]
    return res.json()[0]["id"]


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_invalid_symbol():
    assert client.get("/api/v1/quotes/bad!symbol").status_code == 400


def test_profile_pin_verify_and_protection():
    uid = get_test_user_id()
    # 1. Verify correct PIN for test user
    verify_res = client.post(f"/api/v1/profiles/{uid}/verify", json={"pin": "0000"})
    assert verify_res.status_code == 200

    # 2. Verify wrong PIN fails
    wrong_res = client.post(f"/api/v1/profiles/{uid}/verify", json={"pin": "9999"})
    assert wrong_res.status_code == 401

    # 3. Verify protected accounts (ID 1 & 2) cannot be deleted
    del_protected_1 = client.request("DELETE", "/api/v1/profiles/1", json={"pin": "1234"})
    assert del_protected_1.status_code in (401, 403)
    del_protected_2 = client.request("DELETE", "/api/v1/profiles/2", json={"pin": "1234"})
    assert del_protected_2.status_code in (401, 403)


def test_watchlists_crud():
    uid = get_test_user_id()

    # 1. Create a watchlist
    create_res = client.post(f"/api/v1/watchlists?user_id={uid}", json={"name": "Test Watchlist"})
    assert create_res.status_code == 200
    w_id = create_res.json()["id"]

    try:
        # 2. List watchlists
        res = client.get(f"/api/v1/watchlists?user_id={uid}")
        assert res.status_code == 200
        lists = res.json()
        assert len(lists) >= 1

        # 3. Add an item to watchlist
        item_res = client.post(
            f"/api/v1/watchlists/{w_id}/items",
            json={"symbol": "INFY", "target_buy_price": 1750.50, "notes": "Buy on dip", "tags": "tech,dividend"},
        )
        assert item_res.status_code == 200
        item = item_res.json()
        assert item["symbol"] == "INFY"
        item_id = item["id"]

        # 4. Remove item
        del_res = client.delete(f"/api/v1/watchlists/{w_id}/items/{item_id}")
        assert del_res.status_code == 200
    finally:
        # Clean up test watchlist
        client.delete(f"/api/v1/watchlists/{w_id}")


def test_market_indices():
    res = client.get("/api/v1/market/indices")
    assert res.status_code == 200
    indices = res.json()
    assert len(indices) >= 4
    symbols = [idx["symbol"] for idx in indices]
    assert "NIFTY 50" in symbols
    assert "SENSEX" in symbols
