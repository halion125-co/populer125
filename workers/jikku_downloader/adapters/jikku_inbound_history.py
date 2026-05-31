"""직꾸 입고내역 adapter (skeleton). 직꾸 화면 확인 후 구현."""
import os
from playwright.sync_api import Page

LOGIN_URL = os.environ.get("JIKKU_LOGIN_URL", "")
PAGE_URL = os.environ.get("JIKKU_INBOUND_HISTORY_URL", "")


def run(page: Page, login_id: str, login_pw: str, download_dir: str, from_date: str, to_date: str) -> str:
    raise RuntimeError("UNKNOWN_ERROR|jikku_inbound_history adapter not yet implemented")
