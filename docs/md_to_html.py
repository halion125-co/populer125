import markdown
from pathlib import Path

# 현재 폴더에서 md 파일 자동 탐색
md_files = sorted(Path(".").glob("*.md"))
if not md_files:
    raise FileNotFoundError("현재 폴더에 .md 파일이 없습니다. md 파일을 이 폴더로 옮기거나, cd로 이동 후 실행하세요.")

md_path = md_files[0]  # 첫 번째 md 사용
html_path = md_path.with_suffix(".html")

md_text = md_path.read_text(encoding="utf-8")

html_body = markdown.markdown(
    md_text,
    extensions=["tables", "fenced_code", "toc"]
)

html = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{md_path.stem}</title>
<style>
body {{ font-family: "Malgun Gothic", Arial, sans-serif; line-height: 1.5; padding: 24px; }}
code, pre {{ font-family: Consolas, "Courier New", monospace; }}
pre {{ white-space: pre-wrap; word-break: break-word; background: #f6f6f6; padding: 12px; border-radius: 8px; }}
table {{ border-collapse: collapse; width: 100%; }}
th, td {{ border: 1px solid #ddd; padding: 8px; vertical-align: top; }}
th {{ background: #f0f0f0; }}
h1, h2, h3 {{ page-break-after: avoid; }}
</style>
</head>
<body>
{html_body}
</body>
</html>
"""

html_path.write_text(html, encoding="utf-8")
print("OK:", html_path)
print("SOURCE MD:", md_path)
