import pytest
from app.database import SessionLocal, Base, engine
from app.models import ExternalDataRecord
from app.services.data_ingestion_service import store_external_record, get_fresh_records
from app.providers.tavily_provider import TavilySearchProvider
from app.providers.ddgs_provider import DuckDuckGoSearchProvider
from app.providers.rss_news_provider import RSSNewsProvider
from app.providers.screener_provider import ScreenerFundamentalsProvider
from app.providers.crawl4ai_provider import Crawl4AIExtractor
from app.providers.search_orchestrator import execute_tiered_search, format_search_context, get_call_stats


@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


def test_tavily_missing_key_handled():
    provider = TavilySearchProvider()
    res = provider.search("Reliance share price")
    assert "source" in res
    assert res["source"] == "tavily"
    assert "results" in res


def test_format_search_context():
    sample_data = {
        "answer": "Nifty is trading at 22,600.",
        "results": [
            {"title": "Tata Motors Q3 Results", "snippet": "Net profit up 15%", "source": "Reuters"}
        ]
    }
    formatted = format_search_context(sample_data)
    assert "Tata Motors Q3 Results" in formatted
    assert "Nifty is trading at 22,600" in formatted


def test_data_ingestion_and_deduplication(setup_db):
    import uuid
    unique_tag = str(uuid.uuid4())[:8]
    raw = f"Headline: TCS secures contract {unique_tag}"

    with SessionLocal() as db:
        # First insert
        rec1, is_new1 = store_external_record(
            db=db,
            category="NEWS",
            source_name="google_news_rss",
            raw_content=raw,
            symbol="TCS",
            title=f"TCS contract win {unique_tag}",
            extracted_data={"contract_value_m": 500},
        )
        assert is_new1 is True
        assert rec1.content_hash is not None

        # Duplicate insert should return existing without re-creating
        rec2, is_new2 = store_external_record(
            db=db,
            category="NEWS",
            source_name="google_news_rss",
            raw_content=raw,
            symbol="TCS",
            title=f"TCS contract win {unique_tag}",
            extracted_data={"contract_value_m": 500},
        )
        assert is_new2 is False
        assert rec1.id == rec2.id

        # Query fresh records
        records = get_fresh_records(db, symbol="TCS", category="NEWS")
        assert len(records) >= 1
        assert records[0]["symbol"] == "TCS"
        assert records[0]["extracted_data"]["contract_value_m"] == 500


def test_search_orchestrator_call_stats():
    stats = get_call_stats()
    assert "tavily" in stats
    assert "ddgs" in stats
    assert "google_news_rss" in stats
