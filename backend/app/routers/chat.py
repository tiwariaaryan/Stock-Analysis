from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..schemas import ChatResponse
from ..services.chat_service import handle_chat_message, handle_files_chat
from ..services.market_service import refresh_all_prices

router = APIRouter(prefix="/api/v1")


@router.post("/chat", response_model=ChatResponse)
async def chat(
    message: str = Form(...),
    user_id: int = Form(1),
    session_id: Optional[int] = Form(None),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    msg = message.strip()

    if msg.lower() in ("refresh prices", "refresh", "update prices"):
        result = await refresh_all_prices(db)
        return ChatResponse(
            reply=f"Prices refreshed for {result['refreshed']}/{result['total']} stocks at {result['timestamp']}.",
        )

    file_data = []
    for f in files:
        if f.filename:
            content = await f.read()
            if content:
                file_data.append({
                    "filename": f.filename,
                    "mime": f.content_type or "application/octet-stream",
                    "bytes": content,
                })

    if file_data:
        result = await handle_files_chat(db, msg, file_data, session_id, user_id=user_id)
    else:
        result = await handle_chat_message(db, msg, session_id, user_id=user_id)

    return ChatResponse(reply=result["reply"], session_id=result.get("session_id"))
