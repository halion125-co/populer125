import os
import httpx
from ..core.config import get_settings
from .signer import sign_request

API_GATEWAY = "https://api-gateway.coupang.com"

async def request(method: str, path: str, params: dict | None = None, json: dict | None = None, timeout: int = 30):
    settings = get_settings()
    access_key = settings.COUPANG_ACCESS_KEY
    secret_key = settings.COUPANG_SECRET_KEY

    # path expected to already include vendorId or use default
    headers, qs, _ = sign_request(method, path, params, access_key, secret_key)

    url = f"{API_GATEWAY}{path}"
    if qs:
        url = f"{url}?{qs}"

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.request(method, url, headers=headers, json=json)
        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            raise httpx.HTTPStatusError(f"429 Too Many Requests. Retry-After: {retry_after}", request=resp.request, response=resp)
        resp.raise_for_status()
        try:
            return resp.json()
        except Exception:
            return {"raw_text": resp.text}
