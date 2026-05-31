import hashlib
import json

import pandas as pd


def parse_excel(file_path: str, report_type: str) -> tuple[str, list[dict]]:
    """
    Parse downloaded 직꾸 Excel file.
    Returns (file_hash, rows).
    """
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
    return hashlib.sha256(
        json.dumps({"type": report_type, **data}, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def _extract_row_date(data: dict) -> str:
    candidates = ["주문일", "입고일", "날짜", "date", "Date", "기준일"]
    for key in candidates:
        if key in data and data[key]:
            return data[key]
    return ""
