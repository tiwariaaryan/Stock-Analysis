import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from sqlalchemy.orm import Session

from ..database import SessionLocal, engine, Base
from ..models import ExternalDataRecord

# Ensure table exists
Base.metadata.create_all(bind=engine)


def store_external_record(
    db: Session,
    category: str,
    source_name: str,
    raw_content: str,
    symbol: str | None = None,
    source_url: str | None = None,
    title: str | None = None,
    extracted_data: dict[str, Any] | None = None,
    published_at: datetime | None = None,
    ttl_hours: int = 12,
) -> tuple[ExternalDataRecord, bool]:
    """Stores an external document or data point with SHA-256 deduplication.
    Returns (record, is_new).
    """
    clean_sym = symbol.strip().upper() if symbol else None
    hash_input = f"{source_name}:{source_url or ''}:{title or ''}:{raw_content[:1500]}"
    c_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

    existing = db.query(ExternalDataRecord).filter(ExternalDataRecord.content_hash == c_hash).first()
    now = datetime.now(UTC)

    if existing:
        # Check freshness
        fetched_at = existing.fetched_at
        if fetched_at and fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=UTC)
        if fetched_at and (now - fetched_at).total_seconds() > ttl_hours * 3600:
            existing.fetched_at = now
            existing.freshness_status = "FRESH"
            if raw_content:
                existing.raw_content = raw_content
            if extracted_data:
                existing.extracted_data = json.dumps(extracted_data)
            db.commit()
            db.refresh(existing)
        return existing, False

    record = ExternalDataRecord(
        symbol=clean_sym,
        category=category.upper(),
        source_name=source_name.lower(),
        source_url=source_url,
        title=title,
        content_hash=c_hash,
        raw_content=raw_content,
        extracted_data=json.dumps(extracted_data) if extracted_data else None,
        published_at=published_at or now,
        fetched_at=now,
        freshness_status="FRESH",
    )
    db.add(record)
    try:
        db.commit()
        db.refresh(record)
        return record, True
    except Exception:
        db.rollback()
        existing = db.query(ExternalDataRecord).filter(ExternalDataRecord.content_hash == c_hash).first()
        if existing:
            return existing, False
        raise


def get_fresh_records(
    db: Session,
    symbol: str | None = None,
    category: str | None = None,
    source_name: str | None = None,
    max_age_hours: int = 24,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Fetches normalized fresh records from DB."""
    q = db.query(ExternalDataRecord)
    if symbol:
        q = q.filter(ExternalDataRecord.symbol == symbol.strip().upper())
    if category:
        q = q.filter(ExternalDataRecord.category == category.upper())
    if source_name:
        q = q.filter(ExternalDataRecord.source_name == source_name.lower())

    threshold = datetime.now(UTC) - timedelta(hours=max_age_hours)
    q = q.filter(ExternalDataRecord.fetched_at >= threshold).order_by(ExternalDataRecord.fetched_at.desc())

    records = q.limit(limit).all()
    results = []
    for r in records:
        parsed_extra = {}
        if r.extracted_data:
            try:
                parsed_extra = json.loads(r.extracted_data)
            except Exception:
                pass
        results.append({
            "id": r.id,
            "symbol": r.symbol,
            "category": r.category,
            "source_name": r.source_name,
            "source_url": r.source_url,
            "title": r.title,
            "published_at": r.published_at.isoformat() if r.published_at else None,
            "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
            "extracted_data": parsed_extra,
            "raw_content_preview": r.raw_content[:300] if r.raw_content else "",
        })
    return results
