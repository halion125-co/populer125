from fastapi import APIRouter, Depends, Query, Body
from app.api.deps import get_coupang_client

router = APIRouter()

@router.get("/products")
async def list_products(
    vendorId: str = Query(...),
    businessType: str | None = Query(None),
    sellerProductId: str | None = Query(None),
    sellerProductName: str | None = Query(None),
    status: str | None = Query(None),
    manufacture: str | None = Query(None),
    createdAt: str | None = Query(None),
    maxPerPage: int | None = Query(None),
    nextToken: str | None = Query(None),
    client = Depends(get_coupang_client),
):
    path = "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products"
    params = {"vendorId": vendorId}
    if businessType:
        params["businessTypes"] = businessType
    for k,v in {
        "sellerProductId": sellerProductId,
        "sellerProductName": sellerProductName,
        "status": status,
        "manufacture": manufacture,
        "createdAt": createdAt,
        "maxPerPage": maxPerPage,
        "nextToken": nextToken,
    }.items():
        if v is not None and v != "":
            params[k] = v

    data = await client.request("GET", path, params=params)
    return {"data": data, "meta": {}}

@router.get("/products/{sellerProductId}")
async def get_product(sellerProductId: str, client = Depends(get_coupang_client)):
    path = f"/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}"
    data = await client.request("GET", path)
    return {"data": data, "meta": {}}

@router.put("/products/{sellerProductId}")
async def update_product(sellerProductId: str, payload: dict = Body(...), client = Depends(get_coupang_client)):
    path = "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products"
    # NOTE: Coupang PUT expects full JSON payload; sellerProductId is included in payload.
    data = await client.request("PUT", path, json=payload)
    return {"data": data, "meta": {}}

@router.post("/products")
async def create_product(payload: dict = Body(...), client = Depends(get_coupang_client)):
    path = "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products"
    data = await client.request("POST", path, json=payload)
    return {"data": data, "meta": {}}
