#!/usr/bin/env python3
"""
Fetch and print the full JSON from Cursor's dashboard billing usage endpoint
(same as the Cursor Spending extension). Undocumented; shape may change.

Token (WorkosCursorSessionToken value), never commit it:

  PowerShell:
    $env:CURSOR_SESSION_TOKEN = "paste-here"
    python scripts/dump_cursor_billing.py

  Or file (chmod/ACL restrict on your machine):
    python scripts/dump_cursor_billing.py --token-file %USERPROFILE%\\.cursor_billing_token

Output:
  - Pretty JSON to stdout
  - Flattened path -> value listing (helps spot nested keys like spendLimitUsage)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

API_URL = "https://cursor.com/api/dashboard/get-current-period-usage"
REFERRER = "https://cursor.com/dashboard?tab=spending"


def load_token(args: argparse.Namespace) -> str:
    if args.token_file:
        path = os.path.expanduser(args.token_file)
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    t = os.environ.get("CURSOR_SESSION_TOKEN", "").strip()
    if t:
        return t
    print(
        "No token: set CURSOR_SESSION_TOKEN or use --token-file path",
        file=sys.stderr,
    )
    sys.exit(1)


def flatten(prefix: str, obj: Any, out: list[tuple[str, Any]]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else str(k)
            flatten(key, v, out)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            flatten(f"{prefix}[{i}]", item, out)
    else:
        out.append((prefix, obj))


def main() -> None:
    parser = argparse.ArgumentParser(description="Dump Cursor get-current-period-usage JSON")
    parser.add_argument(
        "--token-file",
        help="Path to file containing WorkosCursorSessionToken (one line)",
    )
    parser.add_argument(
        "--paths-only",
        action="store_true",
        help="Print flattened keys only (no full JSON)",
    )
    args = parser.parse_args()
    token = load_token(args)

    req = urllib.request.Request(
        API_URL,
        data=b"{}",
        method="POST",
        headers={
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Content-Type": "application/json",
            "Origin": "https://cursor.com",
            "Referer": REFERRER,
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Safari/605.1.15"
            ),
            "Cookie": f"WorkosCursorSessionToken={token}",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code} {e.reason}\n{body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Request failed: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print("Response was not JSON:\n", raw[:2000], file=sys.stderr)
        sys.exit(1)

    if not args.paths_only:
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print("\n" + "=" * 60 + "\nFlattened paths:\n")

    rows: list[tuple[str, Any]] = []
    flatten("", data, rows)
    for path, val in rows:
        print(f"  {path} = {json.dumps(val, ensure_ascii)}")


if __name__ == "__main__":
    main()
