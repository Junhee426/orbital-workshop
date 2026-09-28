#!/usr/bin/env python3
"""Serve the self-contained game. Python standard library; no pip install."""
import argparse
import functools
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent / 'web'


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2'}

    def health(self, include_body):
        body = b'ok\n'
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if include_body:
            self.wfile.write(body)

    def do_GET(self):
        if self.path == '/healthz':
            self.health(True)
            return
        super().do_GET()

    def do_HEAD(self):
        if self.path == '/healthz':
            self.health(False)
            return
        super().do_HEAD()

    def list_directory(self, path):
        # Serve files only; never enumerate the source, vendor or font folders.
        self.send_error(404, 'File not found')
        return None

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        # Revalidate every load so a deploy never mixes cached and new ES modules;
        # unchanged files still answer 304 through Last-Modified.
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description='Orbital Workshop local game server')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', '8000')))
    args = parser.parse_args()
    handler = functools.partial(Handler, directory=str(ROOT))
    with ThreadingHTTPServer((args.host, args.port), handler) as server:
        print(f'궤도 정비소: http://{args.host}:{args.port}', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print('\n정비소를 닫았습니다.')


if __name__ == '__main__':
    main()
