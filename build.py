"""Builds index.html: src/app.html with src/engine.js inlined, in a standalone page shell."""
import pathlib
root = pathlib.Path(__file__).parent
engine = (root / "src" / "engine.js").read_text(encoding="utf-8")
app = (root / "src" / "app.html").read_text(encoding="utf-8")
assert "/*ENGINE*/" in app
page = app.replace("/*ENGINE*/", engine)
shell = (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    "<style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>"
    '<script src="https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js"></script>'
    "</head><body>" + page + "</body></html>"
)
(root / "index.html").write_text(shell, encoding="utf-8")
print("wrote index.html", len(shell) // 1024, "KB")
