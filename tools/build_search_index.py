#!/usr/bin/env python3
"""Baut search-index.js für die ORBIT-Suche (suche.html).

Aufruf im Repo-Root:   python3 tools/build_search_index.py
Oder mit Pfad:         python3 tools/build_search_index.py /pfad/zum/repo
Ergebnis:              <repo>/search-index.js
"""
import json, os, re, sys
from html.parser import HTMLParser

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'))
GAMES = {'aetheris': 'Aetheris', 'astrion': 'Astrion', 'deepanchor': 'Deep Anchor',
         'pathofthestars': 'Path of the Stars', 'nexus': 'NEXUS', 'foundry': 'FOUNDRY',
         'domus-prime': 'Domus Prime', 'nexus-breach': 'NEXUS: BREACH', 'assets': 'Assets', 'bilder': 'Hub'}
KIND = {'index.html': 'Infoseite', 'game.html': 'Spiel', 'medien.html': 'Medien', 'impressum.html': 'Rechtliches'}
IMG, AUD, VID = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'}, {'.ogg', '.mp3', '.wav'}, {'.mp4', '.webm'}
SKIP_DIRS = {'.git', 'node_modules', 'tools'}
HIDE = set()   # unveröffentlichte Test-Spiele: hier Ordner eintragen, die NICHT auffindbar sein sollen
SKIP_PAGES = {'suche.html'}

class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True)
        s.title = ''; s.desc = ''; s.noindex = False; s.h = []; s.text = []
        s._skip = 0; s._in = None; s._buf = []
    def handle_starttag(s, tag, a):
        a = dict(a)
        if tag in ('script', 'style', 'noscript', 'svg', 'template'): s._skip += 1
        if tag == 'title': s._in = 'title'; s._buf = []
        if tag in ('h1', 'h2', 'h3') and not s._skip: s._in = 'h'; s._buf = []
        if tag == 'meta':
            n = (a.get('name') or '').lower()
            if n == 'description': s.desc = a.get('content', '')
            if n == 'robots' and 'noindex' in (a.get('content') or '').lower(): s.noindex = True
    def handle_endtag(s, tag):
        if tag in ('script', 'style', 'noscript', 'svg', 'template') and s._skip: s._skip -= 1
        if tag == 'title' and s._in == 'title': s.title = ' '.join(''.join(s._buf).split()); s._in = None
        if tag in ('h1', 'h2', 'h3') and s._in == 'h':
            t = ' '.join(''.join(s._buf).split())
            if t and t not in s.h: s.h.append(t)
            s._in = None
    def handle_data(s, d):
        if s._in: s._buf.append(d)
        if not s._skip and s._in != 'title':
            d = ' '.join(d.split())
            if d: s.text.append(d)

def words(path):
    p = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', path)
    return re.sub(r'[\\/_\-.]+', ' ', p)

pages, media = [], []
for dp, dn, fn in os.walk(ROOT):
    dn[:] = sorted(d for d in dn if d not in SKIP_DIRS and not (d in HIDE and os.path.abspath(dp) == ROOT))
    for f in sorted(fn):
        full = os.path.join(dp, f); rel = os.path.relpath(full, ROOT).replace(os.sep, '/')
        top = rel.split('/')[0] if '/' in rel else ''
        game = GAMES.get(top, 'Hub')
        ext = os.path.splitext(f)[1].lower()
        if ext == '.html':
            if f in SKIP_PAGES and '/' not in rel: continue
            p = P()
            try: p.feed(open(full, encoding='utf-8', errors='ignore').read())
            except Exception: continue
            text = ' '.join(p.text)[:4000]
            kind = KIND.get(f, 'Seite') if '/' in rel else {'index.html': 'Startseite', 'portal.html': 'Hub', 'impressum.html': 'Rechtliches', 'nutzungsbedingungen.html': 'Rechtliches'}.get(f, 'Seite')
            pages.append({'t': 'seite', 'u': rel, 'title': p.title or f, 'd': p.desc, 'h': p.h[:12], 'x': text, 'g': game, 'k': kind})
        elif ext in IMG | AUD | VID:
            t = 'bild' if ext in IMG else 'audio' if ext in AUD else 'video'
            media.append({'t': t, 'u': rel, 'n': f, 'g': game, 'w': words(rel)})

out = {'built': __import__('datetime').date.today().isoformat(), 'items': pages + media}
js = 'window.ORBIT_INDEX=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';'
open(os.path.join(ROOT if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'), 'search-index.js'), 'w', encoding='utf-8').write(js)
print(f'{len(pages)} Seiten, {len(media)} Medien, {len(js)//1024} KB')
