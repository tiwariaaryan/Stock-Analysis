import os
import re
from datetime import UTC, datetime
from typing import Any
import httpx
from bs4 import BeautifulSoup


class ScreenerFundamentalsProvider:
    """Free public fundamental data extractor for Indian stocks (Screener.in)."""

    def __init__(self):
        self.base_url = "https://www.screener.in/company"

    def get_fundamentals(self, symbol: str) -> dict[str, Any]:
        """Extracts financial ratios and profile from public Screener page."""
        clean_sym = symbol.strip().upper().replace(".NS", "").replace(".BO", "")

        saved_proxy = {}
        for k in list(os.environ):
            if "proxy" in k.lower():
                saved_proxy[k] = os.environ.pop(k)

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        url = f"{self.base_url}/{clean_sym}/consolidated/"

        try:
            with httpx.Client(timeout=10, follow_redirects=True, headers=headers) as client:
                resp = client.get(url)
                if resp.status_code == 404:
                    # Try standalone
                    url = f"{self.base_url}/{clean_sym}/"
                    resp = client.get(url)

            if resp.status_code != 200:
                return {
                    "symbol": clean_sym,
                    "source": "screener",
                    "available": False,
                    "error": f"HTTP {resp.status_code}",
                }

            soup = BeautifulSoup(resp.text, "html.parser")
            ratios: dict[str, Any] = {}

            # Screener displays top ratios inside #top-ratios or li tags with span.name / span.nowrap
            top_ratios_el = soup.find(id="top-ratios")
            if top_ratios_el:
                for li in top_ratios_el.find_all("li"):
                    name_el = li.find(class_="name")
                    val_el = li.find(class_="nowrap value") or li.find(class_="value")
                    if name_el and val_el:
                        k = name_el.get_text(strip=True)
                        v_str = val_el.get_text(strip=True).replace(",", "").replace("₹", "").replace("%", "")
                        try:
                            ratios[k] = float(v_str)
                        except ValueError:
                            ratios[k] = v_str

            # Company description
            about_el = soup.find(class_="about") or soup.find(class_="company-profile")
            about_text = about_el.get_text(strip=True) if about_el else ""

            # Pros and Cons
            pros = [li.get_text(strip=True) for li in soup.select(".pros ul li")]
            cons = [li.get_text(strip=True) for li in soup.select(".cons ul li")]

            return {
                "symbol": clean_sym,
                "source": "screener",
                "source_url": url,
                "available": True,
                "ratios": ratios,
                "pe_ratio": ratios.get("Stock P/E"),
                "roce_pct": ratios.get("ROCE"),
                "roe_pct": ratios.get("ROE"),
                "market_cap_cr": ratios.get("Market Cap"),
                "book_value": ratios.get("Book Value"),
                "dividend_yield": ratios.get("Dividend Yield"),
                "face_value": ratios.get("Face Value"),
                "about": about_text[:400] if about_text else "",
                "pros": pros[:4],
                "cons": cons[:4],
                "fetched_at": datetime.now(UTC).isoformat(),
            }
        except Exception as e:
            return {
                "symbol": clean_sym,
                "source": "screener",
                "available": False,
                "error": str(e),
            }
        finally:
            os.environ.update(saved_proxy)
