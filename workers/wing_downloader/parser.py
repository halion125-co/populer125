import hashlib
import json
import os

import pandas as pd


def parse_excel(file_path: str, report_type: str) -> tuple[str, list[dict]]:
    """
    Parse downloaded Excel file.
    Returns (file_hash, rows) where each row has rowKey, rowDate, data.
    """
    with open(file_path, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()

    df = pd.read_excel(file_path, dtype=str)
    df = df.fillna("")

    rows = []
    for _, record in df.iterrows():
        data = {col: str(val) for col, val in record.items()}
        row_key = _make_row_key(report_type, data)
        row_date = _extract_row_date(report_type, data)
        rows.append({"rowKey": row_key, "rowDate": row_date, "data": data})

    return file_hash, rows


def _make_row_key(report_type: str, data: dict) -> str:
    if report_type == "rocket_growth_inventory_status":
        parts = [
            report_type,
            data.get("vendorItemId", data.get("옵션ID", "")),
            data.get("date", data.get("기준일", "")),
        ]
        key = "|".join(parts)
        if key.strip("|"):
            return key
    # Fallback: hash the entire row JSON
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _extract_row_date(report_type: str, data: dict) -> str:
    candidates = ["기준일", "date", "Date", "날짜", "주문일", "입고일"]
    for key in candidates:
        if key in data and data[key]:
            return data[key]
    return ""
