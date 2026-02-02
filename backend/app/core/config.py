import os
from functools import lru_cache

class Settings:
    COUPANG_ACCESS_KEY: str
    COUPANG_SECRET_KEY: str
    COUPANG_DEFAULT_VENDOR_ID: str

    def __init__(self):
        self.COUPANG_ACCESS_KEY = os.getenv("COUPANG_ACCESS_KEY")
        self.COUPANG_SECRET_KEY = os.getenv("COUPANG_SECRET_KEY")
        # fallback default vendor id - safe for dev but prefer env in prod
        self.COUPANG_DEFAULT_VENDOR_ID = os.getenv("COUPANG_DEFAULT_VENDOR_ID", "A01407257")

        if not self.COUPANG_ACCESS_KEY or not self.COUPANG_SECRET_KEY:
            raise RuntimeError("Coupang API keys are not configured in environment variables.")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
