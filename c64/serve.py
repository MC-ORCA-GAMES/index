#!/usr/bin/env python3
"""Kleiner Entwicklungsserver. ES-Module laufen nicht ueber file://,
deshalb das Projekt hiermit starten:  python3 serve.py  ->  http://localhost:8000"""
import http.server, socketserver, functools, os

PORT = int(os.environ.get("PORT", 8000))
Handler = functools.partial(http.server.SimpleHTTPRequestHandler,
                            directory=os.path.dirname(os.path.abspath(__file__)))
Handler.extensions_map.update({".js": "text/javascript", ".mjs": "text/javascript"})
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"C64 Web Emulator laeuft auf http://localhost:{PORT}")
    httpd.serve_forever()
