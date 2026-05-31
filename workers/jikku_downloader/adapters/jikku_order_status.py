"""
직꾸 주문현황 다운로드 adapter (skeleton).
환경변수 JIKKU_LOGIN_URL, JIKKU_ORDER_STATUS_URL 로 URL을 지정한다.
실제 직꾸 화면 확인 후 selector를 채운다.
"""
import os
from pathlib import Path

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeout


LOGIN_URL = os.environ.get("JIKKU_LOGIN_URL", "")
PAGE_URL = os.environ.get("JIKKU_ORDER_STATUS_URL", "")

NAV_TIMEOUT_MS = 30_000
DOWNLOAD_TIMEOUT_MS = 60_000


def run(page: Page, login_id: str, login_pw: str, download_dir: str, from_date: str, to_date: str) -> str:
    if not LOGIN_URL or not PAGE_URL:
        raise RuntimeError("NAVIGATION_FAILED|JIKKU_LOGIN_URL or JIKKU_ORDER_STATUS_URL not configured")

    _login(page, login_id, login_pw)
    _navigate(page)
    return _download(page, download_dir)


def _login(page: Page, login_id: str, login_pw: str) -> None:
    page.goto(LOGIN_URL, timeout=NAV_TIMEOUT_MS)
    # TODO: fill in actual selectors after inspecting 직꾸 login page
    raise RuntimeError("UNKNOWN_ERROR|jikku_order_status adapter not yet implemented — update selectors")


def _navigate(page: Page) -> None:
    page.goto(PAGE_URL, timeout=NAV_TIMEOUT_MS)
    page.wait_for_load_state("networkidle", timeout=NAV_TIMEOUT_MS)


def _download(page: Page, download_dir: str) -> str:
    Path(download_dir).mkdir(parents=True, exist_ok=True)
    raise RuntimeError("UNKNOWN_ERROR|jikku_order_status adapter not yet implemented")
