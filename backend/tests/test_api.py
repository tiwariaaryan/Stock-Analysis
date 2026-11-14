from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_invalid_symbol():
    assert client.get("/api/v1/quotes/bad!symbol").status_code == 400


def test_watchlists_crud():
    import random
    uname = f"testuser_{random.randint(1000,9999)}"
    profile_res = client.post("/api/v1/profiles", json={"username": uname, "display_name": "Test", "pin": "1234"})
    assert profile_res.status_code == 200
    uid = profile_res.json()["id"]

    # 2. Create a watchlist
    create_res = client.post(f"/api/v1/watchlists?user_id={uid}", json={"name": "Test Watchlist"})
    assert create_res.status_code == 200
    w_id = create_res.json()["id"]

    # 3. List watchlists
    res = client.get(f"/api/v1/watchlists?user_id={uid}")
    assert res.status_code == 200
    lists = res.json()
    assert len(lists) >= 1

    # 4. Add an item to watchlist
    item_res = client.post(
        f"/api/v1/watchlists/{w_id}/items",
        json={"symbol": "INFY", "target_buy_price": 1750.50, "notes": "Buy on dip", "tags": "tech,dividend"},
    )
    assert item_res.status_code == 200
    item = item_res.json()
    assert item["symbol"] == "INFY"
    item_id = item["id"]

    # 5. Remove item
    del_res = client.delete(f"/api/v1/watchlists/{w_id}/items/{item_id}")
    assert del_res.status_code == 200


def test_market_indices():
    res = client.get("/api/v1/market/indices")
    assert res.status_code == 200
    indices = res.json()
    assert len(indices) >= 4
    symbols = [idx["symbol"] for idx in indices]
    assert "NIFTY 50" in symbols
    assert "SENSEX" in symbols
