from decimal import Decimal
from app.services.calculations import holding_market_value
def test_holding_market_value_is_deterministic():
    assert holding_market_value(Decimal("12.5"), Decimal("123.45")) == Decimal("1543.125")
