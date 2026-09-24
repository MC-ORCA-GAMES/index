#!/usr/bin/env python3
"""Baut assets/audio/signals.json für den Frequenzanalysator (desktop.html).

Aufruf im Repo-Root:   python3 tools/build_audio_manifest.py
Oder mit Pfad:         python3 tools/build_audio_manifest.py /pfad/zum/repo

Jede .wav in assets/audio/ wird automatisch ein Kanal im Analysator.
Namenskonvention (setzt das Bild→Audio-Tool beim Download automatisch):
  signal_theta1.wav                  -> Graustufen-Signal, Label "THETA1"
  signal_theta1_rgb_300-7000.wav     -> Farbsignal, Frequenzbereich 300-7000 Hz
  signal_theta1_rgb.wav              -> Farbsignal mit Standardbereich 300-7000 Hz
Der Filter unten (PREFIX) sorgt dafür, dass nur Dateien "signal*.wav" auftauchen.
"""
import json, os, re, sys

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'))
AUDIO_DIR = os.path.join(ROOT, 'assets', 'audio')
OUT = os.path.join(AUDIO_DIR, 'signals.json')
PREFIX = 'signal'
RGB = re.compile(r'_rgb(?:_(\d+)-(\d+))?$', re.I)

def label_for(stem):
    base = RGB.sub('', stem)
    base = re.sub(r'^signal[_\-]?', '', base, flags=re.I) or stem
    return re.sub(r'[_\-]+', ' ', base).strip().upper() or stem

entries = []
for f in sorted(os.listdir(AUDIO_DIR)):
    stem, ext = os.path.splitext(f)
    if ext.lower() != '.wav' or not stem.lower().startswith(PREFIX):
        continue
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
