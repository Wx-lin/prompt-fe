"""Local SEO fixture, no database or external service writes."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit


def item(number):
    return dict(id=f"seo-{number}", title=f"SEO portrait {number}", category="avatar", models=["FLUX"], thumbnail_url="/demo/portrait.jpg", like_count=0, view_count=0, author_name="Fixture author", created_at="2026-10-16T00:00:00Z")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route = urlsplit(self.path)
        params = parse_qs(route.query)
        if route.path == "/api/categories":
            data = [dict(key="avatar", label="头像", label_en="Avatars", count=45)]
        elif route.path == "/api/models":
            data = []
        elif route.path in ("/api/prompts", "/api/prompts/search"):
            page, size = int(params.get("page", [1])[0]), int(params.get("page_size", [20])[0])
            data = dict(items=[item(n) for n in range((page - 1) * size + 1, min(page * size, 45) + 1)], total=45, page=page, page_size=size, has_more=page * size < 45)
        elif route.path.endswith("/similar"):
            data = []
        elif route.path.startswith("/api/prompts/seo-"):
            data = dict(item(int(route.path.split("-")[-1])), prompt_text="A cinematic portrait", description="Fixture", source_url=None, collect_count=0, images=[], is_liked=False, is_collected=False, author_avatar_url=None)
        else:
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


ThreadingHTTPServer(("127.0.0.1", 8039), Handler).serve_forever()
