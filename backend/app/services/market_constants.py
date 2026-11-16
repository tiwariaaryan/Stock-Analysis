"""Static market data constants: popular stocks, symbol aliases, default indices.

Extracted from market_service.py to reduce file size and make these
widely-imported constants easy to locate.
"""
from decimal import Decimal

POPULAR_STOCKS = [
    ("TATAPOWER", "Tata Power Company", "Energy"),
    ("NTPC", "NTPC Limited", "Utilities"),
    ("POWERGRID", "Power Grid Corporation", "Utilities"),
    ("ONGC", "Oil & Natural Gas Corporation", "Energy"),
    ("BPCL", "Bharat Petroleum", "Energy"),
    ("COALINDIA", "Coal India Limited", "Mining"),
    ("TATASTEEL", "Tata Steel", "Metals"),
    ("JSWSTEEL", "JSW Steel", "Metals"),
    ("HINDALCO", "Hindalco Industries", "Metals"),
    ("VEDL", "Vedanta Limited", "Metals"),
    ("NESTLEIND", "Nestle India", "FMCG"),
    ("BRITANNIA", "Britannia Industries", "FMCG"),
    ("DABUR", "Dabur India", "FMCG"),
    ("CIPLA", "Cipla Limited", "Pharma"),
    ("DRREDDY", "Dr. Reddy's Laboratories", "Pharma"),
    ("DIVISLAB", "Divi's Laboratories", "Pharma"),
    ("APOLLOHOSP", "Apollo Hospitals Enterprise", "Healthcare"),
    ("BEL", "Bharat Electronics", "Defence"),
    ("HAL", "Hindustan Aeronautics", "Defence"),
    ("INDUSINDBK", "IndusInd Bank", "Banking"),
    ("ULTRACEMCO", "UltraTech Cement", "Materials"),
    ("HEROMOTOCO", "Hero MotoCorp", "Auto"),
]

SYMBOL_ALIASES = {
    # Tata Motors Demerger mapping
    "TATAMOTORS": "TMPV",
    "TATA MOTORS": "TMPV",
    "TATAMOTOR": "TMPV",
    "TATA MOTOR": "TMPV",
    "TMPV": "TMPV",
    "TMCV": "TMCV",
    # ETFs & Typos
    "ITBEE": "ITBEES",
    "ITBEES": "ITBEES",
    "GOLDBEE": "GOLDBEES",
    "GOLDBEES": "GOLDBEES",
    "NIFTYBEE": "NIFTYBEES",
    "NIFTYBEES": "NIFTYBEES",
    "BANKBEE": "BANKBEES",
    "BANKBEES": "BANKBEES",
    "JUNIORBEE": "JUNIORBEES",
    "JUNIORBEES": "JUNIORBEES",
    "LIQUIDBEE": "LIQUIDBEES",
    "LIQUIDBEES": "LIQUIDBEES",
    "SILVERBEE": "SILVERBEES",
    "SILVERBEES": "SILVERBEES",
    "SUZLON": "SUZLON",
    "SRESTHAX": "SRESTHA",
    "JP POWER": "JPPOWER",
    "JPPOWER": "JPPOWER",
    # Popular stocks aliases
    "RELAINCE": "RELIANCE", "RELIANCE": "RELIANCE",
    "INFOSYS": "INFY", "INFY": "INFY",
    "HDFC": "HDFCBANK", "HDFCBANK": "HDFCBANK", "HDFC BANK": "HDFCBANK",
    "TATA POWER": "TATAPOWER", "TATAPOWER": "TATAPOWER",
    "TCS": "TCS", "AIRTEL": "BHARTIARTL",
    "BHARTI AIRTEL": "BHARTIARTL", "BHARTIARTL": "BHARTIARTL",
    "SBI": "SBIN", "SBIN": "SBIN",
    "L&T": "LT", "LARSEN": "LT", "LT": "LT", "LTM": "LT",
    "ITC": "ITC", "WIPRO": "WIPRO",
    "BAJAJ FINANCE": "BAJFINANCE", "BAJFINANCE": "BAJFINANCE",
    "BAJAJ FINSERV": "BAJAJFINSV", "BAJAJFINSV": "BAJAJFINSV",
    "MARUTI": "MARUTI", "MARUTI SUZUKI": "MARUTI",
    "ZOMATO": "ETERNAL", "ETERNAL": "ETERNAL",
    "PAYTM": "PAYTM", "TITAN": "TITAN",
    "ADANI": "ADANIENT", "ADANIENT": "ADANIENT", "ADANI ENT": "ADANIENT",
    "NTPC": "NTPC", "DMART": "DMART", "AVENUE SUPERMARTS": "DMART",
    "ASIAN PAINTS": "ASIANPAINT", "ASIANPAINT": "ASIANPAINT",
    "SUNPHARMA": "SUNPHARMA", "SUN PHARMA": "SUNPHARMA",
    "ICICI BANK": "ICICIBANK", "ICICIBANK": "ICICIBANK",
    "KOTAK BANK": "KOTAKBANK", "KOTAKBANK": "KOTAKBANK",
    "AXIS BANK": "AXISBANK", "AXISBANK": "AXISBANK",
    "HCLTECH": "HCLTECH", "HCL TECH": "HCLTECH",
}

DEFAULT_INDICES = [
    ("NIFTY 50", "NIFTY 50", Decimal("22620.35"), Decimal("192.45"), 0.85),
    ("SENSEX", "BSE SENSEX", Decimal("74512.34"), Decimal("526.80"), 0.71),
    ("NIFTY BANK", "NIFTY Bank", Decimal("48153.35"), Decimal("485.10"), 1.02),
    ("NIFTY IT", "NIFTY IT", Decimal("33245.10"), Decimal("-106.85"), -0.32),
]
