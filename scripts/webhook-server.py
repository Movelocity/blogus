#!/usr/bin/env python3
"""GitHub webhook server — deploys on version tag push (v*)."""

import hashlib
import hmac
import json
import os
import re
import subprocess
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("WEBHOOK_PORT", "9000"))
SECRET = os.environ.get("WEBHOOK_SECRET", "")
DEPLOY_SCRIPT = os.path.expanduser("~/projects/blogus/scripts/deploy.sh")

if not SECRET:
    print("ERROR: WEBHOOK_SECRET not set", file=sys.stderr)
    sys.exit(1)

# Matches semver-ish tags: v1.0.0, v1.2.3-beta, v0.0.1, etc.
TAG_PATTERN = re.compile(r"^refs/tags/v\d+\.\d+\.\d+")


def verify_signature(payload: bytes, signature: str) -> bool:
    if not signature.startswith("sha256="):
        return False
    expected = hmac.new(SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/webhook":
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 1_000_000:
            self.send_response(413)
            self.end_headers()
            return

        payload = self.rfile.read(content_length)

        signature = self.headers.get("X-Hub-Signature-256", "")
        if not verify_signature(payload, signature):
            print(f"Invalid signature from {self.client_address[0]}", file=sys.stderr)
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b"Invalid signature")
            return

        event = self.headers.get("X-GitHub-Event", "")
        if event != "push":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Ignored event")
            return

        body = json.loads(payload)
        ref = body.get("ref", "")

        if not TAG_PATTERN.match(ref):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Not a version tag, skipping")
            return

        tag = ref.removeprefix("refs/tags/")
        pusher = body.get("pusher", {}).get("name", "unknown")
        print(f"Tag {tag} pushed by {pusher}, triggering deploy...")
        subprocess.Popen(
            ["bash", DEPLOY_SCRIPT, tag],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )

        self.send_response(200)
        self.end_headers()
        self.wfile.write(f"Deploy triggered for {tag}".encode())

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, format, *args):
        print(f"[webhook] {args[0]}")


def main():
    server = HTTPServer(("0.0.0.0", PORT), WebhookHandler)
    print(f"Webhook server listening on 0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    main()
