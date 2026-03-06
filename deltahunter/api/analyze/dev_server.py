"""
Local development server for the analyze endpoint.
Run: python api/analyze/dev_server.py
Then start Next.js with: npm run dev
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import sys
import os
import traceback
import urllib.request

# Add parent dir so we can import route
sys.path.insert(0, os.path.dirname(__file__))
from route import analyze, parse_multipart


class DevHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            content_type = self.headers.get("Content-Type", "")

            if content_length > 20 * 1024 * 1024:
                self._error(413, "Files too large (max 10MB each)")
                return

            body = self.rfile.read(content_length)

            if "application/json" in content_type:
                payload = json.loads(body)
                user_url = payload.get("user_url")
                ref_url = payload.get("ref_url")
                if not user_url or not ref_url:
                    self._error(400, "Both user_url and ref_url are required")
                    return
                user_file = urllib.request.urlopen(user_url).read()
                ref_file = urllib.request.urlopen(ref_url).read()
            else:
                files = parse_multipart(body, content_type)
                user_file = files.get("user_file")
                ref_file = files.get("ref_file")

            if not user_file or not ref_file:
                self._error(400, "Both user_file and ref_file are required")
                return

            result = analyze(user_file, ref_file)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        except ValueError as e:
            self._error(400, str(e))
        except Exception as e:
            traceback.print_exc()
            self._error(500, f"Analysis failed: {str(e)}")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _error(self, code: int, msg: str):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"error": msg}).encode())


if __name__ == "__main__":
    port = 5328
    print(f"DeltaHunter API running at http://localhost:{port}")
    HTTPServer(("0.0.0.0", port), DevHandler).serve_forever()
