import re
import json
import time
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from markdownify import markdownify as md

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError


BASE = "https://developers.coupangcorp.com"
START = "https://developers.coupangcorp.com/hc/ko"
OUT_MD = "coupang_openapi_ko.md"
OUT_JSON = "coupang_openapi_ko.json"

# 문서 수집 범위(Sections + Articles)
SECTION_RE = re.compile(r"^/hc/ko/sections/\d+")
ARTICLE_RE = re.compile(r"^/hc/ko/articles/\d+")

# Method/Path 추출(문서 내 코드블럭/본문에 섞인 케이스 대응)
METHOD_RE = re.compile(r"\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b", re.I)
PATH_RE = re.compile(r"(/v\d+/providers/[^ \n\r\t\"']+|/v\d+/[^ \n\r\t\"']+)", re.I)

# “필수” 키워드 기반 간단 추출(정교한 스키마 파싱은 문서별 구조가 달라서 휴리스틱)
REQUIRED_HINT_RE = re.compile(r"(필수|required)", re.I)

@dataclass
class EndpointGuess:
    method: Optional[str] = None
    path: Optional[str] = None
    required_params: List[str] = None

@dataclass
class ArticleDoc:
    url: str
    title: str
    section: Optional[str]
    endpoint_guesses: List[EndpointGuess]
    text_excerpt: str

def normalize_url(u: str) -> str:
    # 상대경로면 BASE 붙이고, 쿼리/프래그먼트 제거
    abs_u = urljoin(BASE, u)
    p = urlparse(abs_u)
    return f"{p.scheme}://{p.netloc}{p.path}"

def uniq(seq):
    seen = set()
    out = []
    for x in seq:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out

def extract_title(soup: BeautifulSoup) -> str:
    h1 = soup.select_one("h1")
    if h1 and h1.get_text(strip=True):
        return h1.get_text(strip=True)
    # fallback
    title = soup.title.get_text(strip=True) if soup.title else "Untitled"
    return title

def extract_section_name(soup: BeautifulSoup) -> Optional[str]:
    # breadcrumb에서 섹션명 추출 시도
    bc = soup.select("nav[aria-label='Breadcrumb'] a")
    if bc:
        # 마지막-1 정도가 섹션명인 경우가 많음
        texts = [a.get_text(strip=True) for a in bc if a.get_text(strip=True)]
        if len(texts) >= 2:
            return texts[-2]
    return None

def extract_main_html(soup: BeautifulSoup) -> str:
    # Zendesk HelpCenter 문서의 본문 영역을 최대한 보수적으로 잡음
    main = soup.select_one("article") or soup.select_one("main") or soup.body
    return str(main) if main else str(soup)

def guess_endpoints_from_text(text: str) -> List[EndpointGuess]:
    # 텍스트에서 method/path 조합을 “근처에 같이 있으면” 하나로 묶기
    # 단순 휴리스틱: 라인 단위로 method/path를 같이 찾음
    guesses: List[EndpointGuess] = []
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for ln in lines:
        m = METHOD_RE.search(ln)
        p = PATH_RE.search(ln)
        if m or p:
            guesses.append(EndpointGuess(
                method=(m.group(1).upper() if m else None),
                path=(p.group(1) if p else None),
                required_params=[]
            ))

    # 라인 기반으로 못 잡으면, 전체에서 path/method를 별도로 찾아 조합
    if not guesses:
        methods = [x.upper() for x in METHOD_RE.findall(text)]
        paths = PATH_RE.findall(text)
        methods = uniq(methods)
        paths = uniq(paths)
        # 대충 앞에서부터 매칭
        n = max(len(methods), len(paths))
        for i in range(min(n, 10)):  # 과도한 폭증 방지
            guesses.append(EndpointGuess(
                method=(methods[i] if i < len(methods) else None),
                path=(paths[i] if i < len(paths) else None),
                required_params=[]
            ))

    # required param 간단 추출: “필수/required” 근처의 토큰을 뽑아봄
    # (정확도는 문서마다 다름)
    required_params = []
    for ln in lines:
        if REQUIRED_HINT_RE.search(ln):
            # 예: sellerId (required) / 필수: vendorId 등
            tokens = re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*\b", ln)
            for t in tokens:
                if t.lower() in {"required", "필수"}:
                    continue
                # 너무 일반 단어 제외
                if t.lower() in {"get", "post", "put", "delete", "patch", "api", "url", "path", "method"}:
                    continue
                required_params.append(t)
    required_params = uniq(required_params)[:20]

    # guess들에 공통 required params를 붙임
    for g in guesses:
        g.required_params = required_params

    # 중복 제거(같은 method/path)
    dedup = []
    seen = set()
    for g in guesses:
        key = (g.method or "", g.path or "")
        if key not in seen and (g.method or g.path):
            seen.add(key)
            dedup.append(g)
    return dedup[:20]

def html_to_text_excerpt(html: str, limit=800) -> str:
    soup = BeautifulSoup(html, "html.parser")
    txt = soup.get_text("\n", strip=True)
    return txt[:limit]

def collect_links_from_page(html: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    links = []
    for a in soup.select("a[href]"):
        href = a.get("href")
        if not href:
            continue
        u = normalize_url(href)
        path = urlparse(u).path
        if SECTION_RE.match(path) or ARTICLE_RE.match(path):
            links.append(u)
    return uniq(links)

def render_get_html(page, url: str, wait_ms=1200) -> str:
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(wait_ms)
    # 무한 로딩 대비
    return page.content()

def crawl():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,  # 막히면 False로 바꿔서 테스트
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        )
        context = browser.new_context(
            user_agent=("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/121.0.0.0 Safari/537.36"),
            locale="ko-KR",
        )
        page = context.new_page()

        visited = set()
        to_visit = [START]
        sections = set()
        articles = set()

        print("Collecting sections/articles from:", START)
        while to_visit:
            url = to_visit.pop(0)
            if url in visited:
                continue
            visited.add(url)

            try:
                html = render_get_html(page, url)
            except PWTimeoutError:
                print("Timeout:", url)
                continue

            # 링크 수집
            links = collect_links_from_page(html)
            for u in links:
                path = urlparse(u).path
                if SECTION_RE.match(path):
                    sections.add(u)
                elif ARTICLE_RE.match(path):
                    articles.add(u)

                # 탐색 폭발 방지: sections/articles만 큐에 넣음
                if u not in visited:
                    to_visit.append(u)

            # 섹션 페이지는 페이징/더보기 구조가 있을 수 있어 더 탐색
            # 너무 커지면 조건을 추가해서 제한 가능
            if len(visited) % 30 == 0:
                print(f"Visited {len(visited)} pages… sections={len(sections)} articles={len(articles)}")

            # 안전장치
            if len(visited) > 3000:
                print("Safety stop: too many pages visited.")
                break

        print("Found sections:", len(sections))
        print("Found articles:", len(articles))

        # 각 article 상세 수집
        docs: List[ArticleDoc] = []
        for i, aurl in enumerate(sorted(articles)):
            try:
                html = render_get_html(page, aurl, wait_ms=900)
            except PWTimeoutError:
                print("Timeout article:", aurl)
                continue

            soup = BeautifulSoup(html, "html.parser")
            title = extract_title(soup)
            section_name = extract_section_name(soup)

            main_html = extract_main_html(soup)
            main_text = BeautifulSoup(main_html, "html.parser").get_text("\n", strip=True)

            guesses = guess_endpoints_from_text(main_text)
            excerpt = html_to_text_excerpt(main_html)

            docs.append(ArticleDoc(
                url=aurl,
                title=title,
                section=section_name,
                endpoint_guesses=guesses,
                text_excerpt=excerpt,
            ))

            if (i + 1) % 50 == 0:
                print(f"Parsed {i+1}/{len(articles)} articles…")

        browser.close()

    # 섹션별 정렬
    by_section: Dict[str, List[ArticleDoc]] = {}
    for d in docs:
        sec = d.section or "Unknown"
        by_section.setdefault(sec, []).append(d)

    # Markdown 생성
    md_lines = []
    md_lines.append("# Coupang OpenAPI (KO) - Auto Collected\n")
    md_lines.append(f"- Start: {START}\n")
    md_lines.append(f"- Collected articles: {len(docs)}\n")
    md_lines.append("\n---\n")

    for sec in sorted(by_section.keys()):
        md_lines.append(f"\n## {sec}\n")
        for d in sorted(by_section[sec], key=lambda x: x.title):
            md_lines.append(f"\n### {d.title}\n")
            md_lines.append(f"- Source: {d.url}\n")
            if d.endpoint_guesses:
                md_lines.append("\n**Endpoints (guessed from doc text):**\n")
                md_lines.append("| Method | Path | Required params (heuristic) |\n")
                md_lines.append("|---|---|---|\n")
                for g in d.endpoint_guesses:
                    rp = ", ".join(g.required_params or [])
                    md_lines.append(f"| {g.method or ''} | `{g.path or ''}` | {rp} |\n")
            else:
                md_lines.append("\n> No method/path detected by heuristic.\n")

            md_lines.append("\n<details><summary>Excerpt</summary>\n\n")
            md_lines.append("```\n")
            md_lines.append(d.text_excerpt.replace("```", "'''"))
            md_lines.append("\n```\n")
            md_lines.append("\n</details>\n")

    with open(OUT_MD, "w", encoding="utf-8") as f:
        f.write("".join(md_lines))

    # JSON도 저장(후처리용)
    out = {
        "start": START,
        "collected_articles": len(docs),
        "docs": [
            {
                "url": d.url,
                "title": d.title,
                "section": d.section,
                "endpoint_guesses": [asdict(g) for g in d.endpoint_guesses],
            }
            for d in docs
        ]
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print("Wrote:", OUT_MD, OUT_JSON)


if __name__ == "__main__":
    crawl()
