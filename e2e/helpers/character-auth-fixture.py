"""Loopback-only fake auth for character editor Playwright tests.

Start: python3 e2e/helpers/character-auth-fixture.py
Run an isolated Next instance with API_BASE_URL=http://127.0.0.1:38191,
then run with CHARACTER_AUTH_FIXTURE=1 and PLAYWRIGHT_BASE_URL pointing to it.
The tests intercept every image-generation request; no model is contacted.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/api/auth/me" or self.headers.get("Authorization") != "Bearer character-test-session":
            self.send_error(401)
            return
        data = json.dumps({
            "id": "character-test-user",
            "email": "fixture@example.test",
            "nickname": "测试用户",
            "avatar_url": None,
            "created_at": "2026-01-01T00:00:00Z",
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 38191), Handler).serve_forever()
