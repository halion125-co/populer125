import hmac
import hashlib
import urllib.parse
from datetime import datetime, timezone

def _now_cea_timestamp() -> str:
    utcnow = datetime.now(timezone.utc)
    return utcnow.strftime('%y%m%dT%H%M%SZ')

def build_query_string(params: dict | None) -> str:
    if not params:
        return ''
    # deterministic ordering for stable signing
    items = []
    for k in sorted(params.keys()):
        v = params[k]
        if isinstance(v, (list, tuple)):
            for vv in v:
                items.append((k, str(vv)))
        else:
            items.append((k, str(v)))
    return urllib.parse.urlencode(items, doseq=True)

def make_message(timestamp: str, method: str, path: str, query_string: str | None) -> str:
    qs = query_string or ''
    return f"{timestamp}{method}{path}{qs}"

def make_signature(secret_key: str, message: str) -> str:
    return hmac.new(secret_key.encode('utf-8'),
                    message.encode('utf-8'),
                    hashlib.sha256).hexdigest()

def build_authorization_header(access_key: str, signature: str, timestamp: str) -> str:
    return f"CEA algorithm=HmacSHA256, access-key={access_key}, signed-date={timestamp}, signature={signature}"

def sign_request(method: str, path: str, params: dict | None,
                 access_key: str, secret_key: str):
    timestamp = _now_cea_timestamp()
    query_string = build_query_string(params)
    message = make_message(timestamp, method.upper(), path, query_string)
    signature = make_signature(secret_key, message)
    auth_header = build_authorization_header(access_key, signature, timestamp)
    headers = {
        "Authorization": auth_header,
        "Content-Type": "application/json;charset=UTF-8",
    }
    return headers, query_string, timestamp
