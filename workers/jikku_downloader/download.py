"""
직꾸 downloader worker entry point.
Usage: python download.py --input /path/to/input.json
Writes JSON result to stdout. Never logs loginPw.
"""
import argparse
import json
import os
import sys
import traceback

from playwright.sync_api import sync_playwright

import parser as excel_parser


ADAPTER_MAP = {
    "jikku_order_status": "adapters.jikku_order_status",
    "jikku_inbound_history": "adapters.jikku_inbound_history",
    "jikku_inventory_status": "adapters.jikku_inventory_status",
}


def main():
    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument("--input", required=True, help="Path to input JSON file")
    args = arg_parser.parse_args()

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            inp = json.load(f)
    except Exception as e:
        _fail("UNKNOWN_ERROR", f"could not read input file: {e}")
        return

    report_type = inp.get("reportType", "")
    login_id = inp.get("loginId", "")
    login_pw = inp.get("loginPw", "")
    from_date = inp.get("fromDate", "")
    to_date = inp.get("toDate", "")
    download_dir = inp.get("downloadDir", "./downloads")

    inp.pop("loginPw", None)

    module_name = ADAPTER_MAP.get(report_type)
    if not module_name:
        _fail("UNKNOWN_ERROR", f"unsupported reportType: {report_type}")
        return

    import importlib
    try:
        adapter = importlib.import_module(module_name)
    except ImportError as e:
        _fail("UNKNOWN_ERROR", f"adapter import error: {e}")
        return

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            context = browser.new_context(accept_downloads=True)
            page = context.new_page()
            try:
                file_path = adapter.run(page, login_id, login_pw, download_dir, from_date, to_date)
            finally:
                context.close()
                browser.close()
    except RuntimeError as e:
        parts = str(e).split("|", 1)
        error_code = parts[0] if parts else "UNKNOWN_ERROR"
        message = parts[1] if len(parts) > 1 else str(e)
        _fail(error_code, message)
        return
    except Exception:
        _fail("UNKNOWN_ERROR", traceback.format_exc())
        return

    try:
        file_hash, rows = excel_parser.parse_excel(file_path, report_type)
    except Exception as e:
        _fail("PARSE_FAILED", str(e))
        return

    file_name = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)

    result = {
        "ok": True,
        "filePath": file_path,
        "fileName": file_name,
        "fileSize": file_size,
        "fileHash": file_hash,
        "recordCount": len(rows),
        "rows": rows,
    }
    print(json.dumps(result, ensure_ascii=False))


def _fail(error_code: str, message: str):
    result = {"ok": False, "errorCode": error_code, "message": message}
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(1)


if __name__ == "__main__":
    main()
