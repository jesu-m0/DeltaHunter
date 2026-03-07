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

# Add parent dir so we can import route
sys.path.insert(0, os.path.dirname(__file__))
from route import (
    analyze, parse_multipart, _maybe_decompress,
    parse_single, analyze_from_parsed,
)


class DevHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            content_type = self.headers.get("Content-Type", "")
            path = self.path.split("?")[0].rstrip("/")

            if content_length > 20 * 1024 * 1024:
                self._error(413, "File too large (max 10MB)")
                return

            body = self.rfile.read(content_length)

            if path.endswith("/parse"):
                files = parse_multipart(body, content_type)
                ld_file = files.get("file")
                if not ld_file:
                    self._error(400, "Missing 'file' field")
                    return
                ld_file = _maybe_decompress(ld_file)
                result = parse_single(ld_file)

            elif path.endswith("/compare"):
                payload = json.loads(body)
                user_parsed = payload.get("user_lap")
                ref_parsed = payload.get("ref_lap")
                if not user_parsed or not ref_parsed:
                    self._error(400, "Both user_lap and ref_lap are required")
                    return
                result = analyze_from_parsed(user_parsed, ref_parsed)

            else:
                # Legacy: both files in one request
                files = parse_multipart(body, content_type)
                user_file = files.get("user_file")
                ref_file = files.get("ref_file")
                if not user_file or not ref_file:
                    self._error(400, "Both user_file and ref_file are required")
                    return
                user_file = _maybe_decompress(user_file)
                ref_file = _maybe_decompress(ref_file)
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
