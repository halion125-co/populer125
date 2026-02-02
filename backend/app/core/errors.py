from dataclasses import dataclass
from typing import Any, Optional

@dataclass
class ApiError(Exception):
    code: str
    message: str
    details: Optional[dict[str, Any]] = None
    retry_after_seconds: int = 0
    status_code: int = 400

    def to_dict(self):
        return {
            "code": self.code,
            "message": self.message,
            "details": self.details or {},
            "retryAfterSeconds": self.retry_after_seconds,
        }
