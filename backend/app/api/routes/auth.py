from fastapi import APIRouter, Depends
from app.api.deps import get_coupang_client

router = APIRouter()

@router.post("/auth/test")
async def auth_test(client = Depends(get_coupang_client)):
    # NOTE: Use a lightweight endpoint in real implementation.
    # Here we just validate config/instantiation.
    return {"data": {"ok": True}, "meta": {}}
