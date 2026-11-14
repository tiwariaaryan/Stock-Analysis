from fastapi import APIRouter
from ..schemas import Health

router = APIRouter()


@router.get("/health", response_model=Health)
def health():
    return Health(status="ok", service="india-investment-intelligence")
