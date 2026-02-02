from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from ...coupang.client import request as coupang_request
from ...core.config import get_settings

router = APIRouter(tags=["orders"])

@router.get("", summary="Proxy: Coupang RocketGrowth orders list")
async def list_orders(
    paidDateFrom: str = Query(..., regex=r"^\d{8}$"),
    paidDateTo: str = Query(..., regex=r"^\d{8}$"),
    nextToken: Optional[str] = None,
):
    """GET /api/orders?paidDateFrom=YYYYMMDD&paidDateTo=YYYYMMDD"""
    settings = get_settings()
    vendor_id = settings.COUPANG_DEFAULT_VENDOR_ID
    path = f"/v2/providers/rg_open_api/apis/api/v1/vendors/{vendor_id}/rg/orders"

    params = {"paidDateFrom": paidDateFrom, "paidDateTo": paidDateTo}
    if nextToken:
        params["nextToken"] = nextToken

    try:
        data = await coupang_request("GET", path, params=params)
    except Exception as e:
        # transform to a clean HTTP error for frontend
        raise HTTPException(status_code=502, detail=str(e))
    return {"data": data}
