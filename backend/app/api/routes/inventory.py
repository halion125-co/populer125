from fastapi import APIRouter, Depends, Query
from app.api.deps import get_coupang_client
from app.core.config import settings

router = APIRouter()

@router.get("/inventory/summaries")
async def inventory_summaries(
    vendorItemId: str | None = Query(None),
    nextToken: str | None = Query(None),
    vendorId: str | None = Query(None),
    client = Depends(get_coupang_client),
):
    vendor_id = vendorId or settings.coupang_vendor_id
    path = f"/v2/providers/rg_open_api/apis/api/v1/vendors/{vendor_id}/rg/inventory/summaries"
    params = {}
    if vendorItemId:
        params["vendorItemId"] = vendorItemId
    elif nextToken:
        params["nextToken"] = nextToken
    data = await client.request("GET", path, params=params)
    return {"data": data, "meta": {}}
