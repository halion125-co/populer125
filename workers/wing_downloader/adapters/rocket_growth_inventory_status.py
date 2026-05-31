"""
Wing 로켓그로스 재고현황 다운로드 adapter.
"""
import os
from pathlib import Path

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeout


LOGIN_URL = (
    "https://xauth.coupang.com/auth/realms/seller/protocol/openid-connect/auth?response_type=code&client_id=wing&redirect_uri=https%3A%2F%2Fwing.coupang.com%2Fsso%2Flogin?returnUrl%3Dhttp%253A%252F%252Fwing.coupang.com%252F&state=a5e8074f-8d90-4fd3-9cfd-a7bb5976ce1f&login=true&ui_locales=ko-KR&scope=openid"
)
INVENTORY_URL = os.environ.get(
    "WING_ROCKET_GROWTH_INVENTORY_URL",
    "https://wing.coupang.com/tenants/rfm-inventory/management/list",
)

LOGIN_TIMEOUT_MS    = 30_000
NAV_TIMEOUT_MS      = 30_000
DOWNLOAD_TIMEOUT_MS = 90_000


def run(page: Page, login_id: str, login_pw: str, download_dir: str, from_date: str, to_date: str) -> str:
    _login(page, login_id, login_pw)
    _navigate_to_inventory(page)
    return _download_excel(page, download_dir)


def _login(page: Page, login_id: str, login_pw: str) -> None:
    page.goto(LOGIN_URL, timeout=NAV_TIMEOUT_MS)

    try:
        page.wait_for_selector("input[placeholder='아이디를 입력해주세요']", timeout=LOGIN_TIMEOUT_MS)
    except PlaywrightTimeout:
        raise RuntimeError("LOGIN_FAILED|login page did not load")

    try:
        page.get_by_placeholder("아이디를 입력해주세요").fill(login_id)
        page.get_by_placeholder("비밀번호를 입력해주세요").fill(login_pw)
        page.get_by_role("button", name="로그인").click()
    except Exception as e:
        raise RuntimeError(f"LOGIN_FAILED|could not fill login form: {e}")

    # 팝업 — "오늘 하루 보지 않기" 체크박스가 있으면 닫기
    try:
        checkbox = page.get_by_role("checkbox", name="오늘 하루 보지 않기")
        checkbox.wait_for(timeout=5_000)
        checkbox.check()
    except PlaywrightTimeout:
        pass  # 팝업 없으면 무시

    # 로그인 완료 대기 — xauth 인증 처리 후 wing.coupang.com 으로 리다이렉트
    try:
        # login-actions/authenticate 단계를 거친 뒤 wing 도메인 도달까지 대기
        page.wait_for_url(
            lambda url: "wing.coupang.com" in url,
            timeout=LOGIN_TIMEOUT_MS,
        )
    except PlaywrightTimeout:
        content = page.content()
        if any(kw in content for kw in ["captcha", "CAPTCHA", "otp", "OTP", "추가인증", "보안코드"]):
            raise RuntimeError("NEEDS_MANUAL_AUTH|additional authentication required")
        raise RuntimeError(f"LOGIN_FAILED|login redirect did not occur (url={page.url})")


def _navigate_to_inventory(page: Page) -> None:
    try:
        page.goto(INVENTORY_URL, timeout=NAV_TIMEOUT_MS)
        page.wait_for_load_state("networkidle", timeout=NAV_TIMEOUT_MS)
    except PlaywrightTimeout:
        raise RuntimeError("NAVIGATION_FAILED|inventory page did not load")


def _download_excel(page: Page, download_dir: str) -> str:
    Path(download_dir).mkdir(parents=True, exist_ok=True)

    # 전체기간 버튼 클릭
    try:
        page.locator(".blue > p > .wing-web-component").wait_for(timeout=10_000)
        page.locator(".blue > p > .wing-web-component").click()
    except PlaywrightTimeout:
        pass  # 없으면 기본 기간으로 진행

    # 조회 버튼 클릭
    try:
        page.locator("._8mgm1d1._8mgm1d0._8mgm1d3").wait_for(timeout=10_000)
        page.locator("._8mgm1d1._8mgm1d0._8mgm1d3").click()
        page.wait_for_load_state("networkidle", timeout=NAV_TIMEOUT_MS)
    except PlaywrightTimeout:
        pass

    # 엑셀 다운로드 드롭다운 열기
    # — "전체 상품목록 엑셀 다운로드" 버튼을 제외하고 짧은 버튼(드롭다운 트리거)만 클릭
    try:
        # data-v-9b5aaab5 속성을 가진 버튼이 드롭다운 트리거 (녹화 기준)
        btn = page.locator("button[data-v-9b5aaab5]").filter(has_text="엑셀 다운로드")
        if btn.count() == 0:
            # fallback: 텍스트가 짧은 버튼 (아이콘 포함, '전체' 미포함)
            btn = page.get_by_role("button", name="엑셀 다운로드").filter(has_not_text="전체")
        btn.first.wait_for(timeout=10_000)
        btn.first.click()
    except PlaywrightTimeout:
        raise RuntimeError("DOWNLOAD_BUTTON_NOT_FOUND|could not locate 엑셀 다운로드 button")

    # 드롭다운에서 "엑셀 다운로드 요청" 클릭 후 파일 수신
    try:
        with page.expect_download(timeout=DOWNLOAD_TIMEOUT_MS) as dl_info:
            page.get_by_text("엑셀 다운로드 요청", exact=True).click()
        dl = dl_info.value
        dest = str(Path(download_dir) / dl.suggested_filename)
        dl.save_as(dest)
        return dest
    except PlaywrightTimeout:
        raise RuntimeError("DOWNLOAD_FAILED|download did not complete within timeout")
    except Exception as e:
        raise RuntimeError(f"DOWNLOAD_FAILED|{e}")
