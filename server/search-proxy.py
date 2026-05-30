#!/usr/bin/env python3
"""搜索代理服务 — 接收搜索请求，用本地网络搜索，返回结果"""
import http.server
import json
import urllib.parse
import urllib.request
import re
import sys

PORT = 3456

class SearchHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        query = params.get('q', [''])[0]

        if not query:
            self.send_error(400, 'Missing q parameter')
            return

        results = self.search(query)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(results, ensure_ascii=False).encode('utf-8'))

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        query = body.get('q', '')

        if not query:
            self.send_error(400, 'Missing q')
            return

        results = self.search(query)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(results, ensure_ascii=False).encode('utf-8'))

    def search(self, query):
        snippets = []

        # 用 Google 搜索（从本地Mac可以访问）
        try:
            q = urllib.parse.quote(query)
            req = urllib.request.Request(
                f'https://www.google.com/search?q={q}&hl=zh-CN',
                headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
                # 提取搜索结果片段
                # Google 结果通常在 <div class="BNeawe s3v9rd AP7Wnd"> 或 <span class="st">
                for pattern in [
                    r'<div class="BNeawe s3v9rd AP7Wnd">(.*?)</div>',
                    r'<span class="st">(.*?)</span>',
                    r'<div class="VwiC3b[^"]*">(.*?)</div>',
                    r'<h3[^>]*>(.*?)</h3>',
                ]:
                    for m in re.findall(pattern, html, re.DOTALL):
                        text = re.sub(r'<[^>]+>', '', m).strip()
                        text = re.sub(r'&[a-z]+;', ' ', text)
                        text = re.sub(r'\s+', ' ', text)
                        if len(text) > 15 and text not in snippets:
                            snippets.append(text[:500])
                    if len(snippets) >= 5:
                        break
        except Exception as e:
            snippets.append(f'[Google搜索失败: {str(e)}]')

        # 如果 Google 结果不够，试试 Bing
        if len(snippets) < 3:
            try:
                q = urllib.parse.quote(query)
                req = urllib.request.Request(
                    f'https://www.bing.com/search?q={q}&setlang=zh-Hans',
                    headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    html = resp.read().decode('utf-8', errors='ignore')
                    for m in re.findall(r'<li class="b_algo"[^>]*>(.*?)</li>', html, re.DOTALL):
                        text = re.sub(r'<[^>]+>', ' ', m).strip()
                        text = re.sub(r'&[a-z]+;', ' ', text)
                        text = re.sub(r'\s+', ' ', text)
                        if len(text) > 20 and text not in snippets:
                            snippets.append(text[:500])
            except Exception as e:
                snippets.append(f'[Bing搜索失败: {str(e)}]')

        return {
            'query': query,
            'results': snippets[:10],
            'count': len(snippets),
            'engine': 'Google+Bing (via Mac proxy)'
        }

    def log_message(self, format, *args):
        print(f'[搜索代理] {args[0]}', flush=True)

if __name__ == '__main__':
    server = http.server.HTTPServer(('127.0.0.1', PORT), SearchHandler)
    print(f'🔍 搜索代理运行在 http://127.0.0.1:{PORT}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
