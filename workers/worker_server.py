"""
Python Worker HTTP 서버.
Go 백엔드(Docker)에서 HTTP로 호출하여 Playwright 다운로드 작업을 실행한다.
실행: python workers/worker_server.py
포트: 8100
"""
import io
import json
import os
import sys
import hashlib
import traceback
from pathlib import Path

import pandas as pd
import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from playwright.sync_api import sync_playwright
from pydantic import BaseModel

# 각 worker 디렉토리를 sys.path에 추가
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR / "wing_downloader"))
sys.path.insert(0, str(BASE_DIR / "jikku_downloader"))
print(f"[Worker] BASE_DIR={BASE_DIR}", flush=True)
print(f"[Worker] sys.path[0:2]={sys.path[0:2]}", flush=True)

app = FastAPI()


class WorkerRequest(BaseModel):
    source: str
    reportType: str
    loginId: str
    loginPw: str
    fromDate: str = ""
    toDate: str = ""
    downloadDir: str = "/data/external-downloads/tmp"


WING_ADAPTER_MAP = {
    "rocket_growth_inventory_status": BASE_DIR / "wing_downloader" / "adapters" / "rocket_growth_inventory_status.py",
}
JIKKU_ADAPTER_MAP = {
    "jikku_order_status":    BASE_DIR / "jikku_downloader" / "adapters" / "jikku_order_status.py",
    "jikku_inbound_history": BASE_DIR / "jikku_downloader" / "adapters" / "jikku_inbound_history.py",
    "jikku_inventory_status": BASE_DIR / "jikku_downloader" / "adapters" / "jikku_inventory_status.py",
}


def _load_adapter(file_path: Path):
    import importlib.util
    spec = importlib.util.spec_from_file_location(file_path.stem, str(file_path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@app.post("/run")
def run_worker(req: WorkerRequest):
    if req.source == "wing":
        adapter_map = WING_ADAPTER_MAP
    elif req.source == "jikku":
        adapter_map = JIKKU_ADAPTER_MAP
    else:
        return JSONResponse({"ok": False, "errorCode": "UNKNOWN_ERROR", "message": f"unknown source: {req.source}"})

    adapter_path = adapter_map.get(req.reportType)
    if not adapter_path:
        return JSONResponse({"ok": False, "errorCode": "UNKNOWN_ERROR", "message": f"unsupported reportType: {req.reportType}"})

    try:
        adapter = _load_adapter(adapter_path)
    except Exception as e:
        return JSONResponse({"ok": False, "errorCode": "UNKNOWN_ERROR", "message": f"adapter load error: {e}"})

    download_dir = req.downloadDir
    Path(download_dir).mkdir(parents=True, exist_ok=True)

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=False,  # Xvfb 가상 디스플레이 사용 (DISPLAY=:99)
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--window-size=1920,1080",
                ],
            )
            context = browser.new_context(
                accept_downloads=True,
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
                locale="ko-KR",
                java_script_enabled=True,
                extra_http_headers={
                    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                },
            )
            # navigator.webdriver 제거
            context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            page = context.new_page()
            try:
                file_path = adapter.run(page, req.loginId, req.loginPw, download_dir, req.fromDate, req.toDate)
            finally:
                context.close()
                browser.close()
    except RuntimeError as e:
        parts = str(e).split("|", 1)
        return JSONResponse({"ok": False, "errorCode": parts[0], "message": parts[1] if len(parts) > 1 else str(e)})
    except Exception:
        return JSONResponse({"ok": False, "errorCode": "UNKNOWN_ERROR", "message": traceback.format_exc()})

    try:
        file_hash, rows = _parse_excel(file_path, req.reportType)
    except Exception as e:
        return JSONResponse({"ok": False, "errorCode": "PARSE_FAILED", "message": str(e)})

    return JSONResponse({
        "ok": True,
        "filePath": file_path,
        "fileName": os.path.basename(file_path),
        "fileSize": os.path.getsize(file_path),
        "fileHash": file_hash,
        "recordCount": len(rows),
        "rows": rows,
    })


@app.get("/health")
def health():
    return {"ok": True}


def _parse_excel(file_path: str, report_type: str):
    with open(file_path, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()

    df = pd.read_excel(file_path, dtype=str)
    df = df.fillna("")

    rows = []
    for _, record in df.iterrows():
        data = {col: str(val) for col, val in record.items()}
        row_key = _make_row_key(report_type, data)
        row_date = _extract_row_date(data)
        rows.append({"rowKey": row_key, "rowDate": row_date, "data": data})
    return file_hash, rows


def _make_row_key(report_type: str, data: dict) -> str:
    if report_type == "rocket_growth_inventory_status":
        parts = [report_type, data.get("옵션 ID", ""), data.get("SKU ID", "")]
        key = "|".join(p for p in parts if p)
        if len(key) > len(report_type) + 1:
            return key
    return hashlib.sha256(
        json.dumps({"type": report_type, **data}, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def _extract_row_date(data: dict) -> str:
    for key in ["기준일", "주문일", "입고일", "날짜", "date", "Date"]:
        if key in data and data[key]:
            return data[key]
    return ""


if __name__ == "__main__":
    port = int(os.environ.get("WORKER_PORT", "8100"))
    print(f"[Worker Server] starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
