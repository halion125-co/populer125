# md_to_pdf.py
import markdown
from weasyprint import HTML

md_text = open("coupang_openapi_ko.md", "r", encoding="utf-8").read()
html = markdown.markdown(md_text, extensions=["tables", "fenced_code", "toc"])
HTML(string=html).write_pdf("coupang_openapi_ko.pdf")
print("OK: coupang_openapi_ko.pdf")
