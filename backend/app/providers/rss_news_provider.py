import os
import re
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from typing import Any
import httpx


class RSSNewsProvider:
    """Free RSS Provider for Google News, SEBI Circulars, and RBI Press Releases."""

    def __init__(self):
        self.google_news_base = "https://news.google.com/rss/search"
        self.rbi_rss = "https://www.rbi.org.in/pressreleases_rss.xml"
        self.sebi_rss = "https://www.sebi.gov.in/sebirss.xml"

    def fetch_google_news(self, query: str, max_items: int = 10) -> list[dict[str, Any]]:
        """Fetches latest Indian financial and stock news via Google News RSS."""
        saved_proxy = {}
        for k in list(os.environ):
            if "proxy" in k.lower():
                saved_proxy[k] = os.environ.pop(k)

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
            "Accept": "application/rss+xml, application/xml, text/xml",
        }

        params = {
            "q": query,
            "hl": "en-IN",
            "gl": "IN",
            "ceid": "IN:en",
        }

        try:
            with httpx.Client(timeout=10, headers=headers, follow_redirects=True) as client:
                resp = client.get(self.google_news_base, params=params)

            if resp.status_code != 200:
                return []

            root = ET.fromstring(resp.content)
            items = []
            for item in root.findall(".//item"):
                title = item.findtext("title") or ""
                link = item.findtext("link") or ""
                pub_date = item.findtext("pubDate") or ""
                desc = item.findtext("description") or ""
                source_tag = item.find("source")
                publisher = source_tag.text if source_tag is not None else "Google News"

                # Clean html tags from description if any
                clean_desc = re.sub(r'<[^>]+>', '', desc)

                items.append({
                    "title": title.strip(),
                    "link": link.strip(),
                    "published_at": pub_date.strip(),
                    "snippet": clean_desc.strip(),
                    "publisher": publisher,
                    "feed_source": "google_news_rss",
                })
                if len(items) >= max_items:
                    break

            return items
        except Exception:
            return []
        finally:
            os.environ.update(saved_proxy)

    def fetch_regulatory_updates(self, max_items: int = 6) -> list[dict[str, Any]]:
        """Fetches SEBI and RBI regulatory updates."""
        saved_proxy = {}
        for k in list(os.environ):
            if "proxy" in k.lower():
                saved_proxy[k] = os.environ.pop(k)

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/xml, text/xml, */*",
        }

        updates = []
        # Try RBI RSS
        try:
            with httpx.Client(timeout=8, headers=headers, follow_redirects=True) as client:
                resp = client.get(self.rbi_rss)
            if resp.status_code == 200:
                root = ET.fromstring(resp.content)
                for item in root.findall(".//item")[:max_items]:
                    t = item.findtext("title") or ""
                    l = item.findtext("link") or ""
                    d = item.findtext("pubDate") or ""
                    if t:
                        updates.append({
                            "title": t.strip(),
                            "link": l.strip(),
                            "published_at": d.strip(),
                            "authority": "RBI",
                            "category": "Monetary Policy & Banking",
                        })
        except Exception:
            pass

        # Also query Google News for SEBI Circulars
        sebi_news = self.fetch_google_news("SEBI circular regulatory framework Indian stock market", max_items=4)
        for sn in sebi_news:
            updates.append({
                "title": sn["title"],
                "link": sn["link"],
                "published_at": sn["published_at"],
                "authority": "SEBI",
                "category": "Capital Markets & Exchange Regulations",
            })

        os.environ.update(saved_proxy)
        return updates
