from fastapi import APIRouter, Depends, Query
from app.api.deps import get_coupang_client

router = APIRouter()

@router.get("/categories")
async def list_categories(
    registrationType: str = Query("RFM"),
    locale: str = Query("kr"),
    client = Depends(get_coupang_client),
):
    path = "/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories"
    params = {"registrationType": registrationType, "locale": locale}
    data = await client.request("GET", path, params=params)
    return {"data": data, "meta": {}}

@router.get("/categories/{displayCategoryCode}/metas")
async def category_metas(displayCategoryCode: str, client = Depends(get_coupang_client)):
    path = f"/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/{displayCategoryCode}"
    data = await client.request("GET", path)
    return {"data": data, "meta": {}}
