#!/usr/bin/env python3
"""Baut assets/audio/signals.json für den Frequenzanalysator (desktop.html).

Aufruf im Repo-Root:   python3 tools/build_audio_manifest.py
Oder mit Pfad:         python3 tools/build_audio_manifest.py /pfad/zum/repo

Jede .ogg/.oga/.mp3/.wav in assets/audio/ wird automatisch ein Kanal im Analysator.
Gibt es dieselbe Datei in mehreren Formaten (z.B. signal_theta1.wav und signal_theta1.ogg),
gewinnt das erste Format der Rangliste EXT_ORDER (Standard: .ogg vor .wav).
Namenskonvention (setzt das Bild→Audio-Tool beim Download automatisch):
  signal_theta1.wav                  -> Graustufen-Signal, Label "THETA1"
  signal_theta1_rgb_300-7000.wav     -> Farbsignal, Frequenzbereich 300-7000 Hz
  signal_theta1_rgb.wav              -> Farbsignal mit Standardbereich 300-7000 Hz
(gilt genauso für .ogg, z.B. signal_theta1_rgb_300-7000.ogg)
Der Filter unten (PREFIX) sorgt dafür, dass nur Dateien "signal*" auftauchen.
"""
import json, os, re, sys

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'))
AUDIO_DIR = os.path.join(ROOT, 'assets', 'audio')
OUT = os.path.join(AUDIO_DIR, 'signals.json')
PREFIX = 'signal'
EXT_ORDER = ['.ogg', '.oga', '.mp3', '.wav']   # bevorzugtes Format zuerst
RGB = re.compile(r'_rgb(?:_(\d+)-(\d+))?$', re.I)

def label_for(stem):
    base = RGB.sub('', stem)
    base = re.sub(r'^signal[_\-]?', '', base, flags=re.I) or stem
    return re.sub(r'[_\-]+', ' ', base).strip().upper() or stem

best = {}   # Dateiname ohne Endung -> (Rang, Dateiname)
for f in sorted(os.listdir(AUDIO_DIR)):
    stem, ext = os.path.splitext(f)
    ext = ext.lower()
    if ext not in EXT_ORDER or not stem.lower().startswith(PREFIX):
        continue
    rank = EXT_ORDER.index(ext)
    if stem not in best or rank < best[stem][0]:
        best[stem] = (rank, f)

entries = []
for stem in sorted(best):
    f = best[stem][1]
    e = {'file': f, 'label': label_for(stem)}
    m = RGB.search(stem)
    if m:
        e['color'] = True
        e['fmin'] = int(m.group(1)) if m.group(1) else 300
        e['fmax'] = int(m.group(2)) if m.group(2) else 7000
        e['label'] += ' (Farbe)'
    entries.append(e)

with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump(entries, fh, ensure_ascii=False, indent=1)
print(f'{len(entries)} Signale -> {os.path.relpath(OUT, ROOT)}')
for e in entries: print('  ', e)
