# TERMINUS-7 · Story-Stand & Changelog

Zweck: Ein Ort, an dem steht, was in der Geschichte von `desktop.html` (TERMINUS-7) schon festgelegt ist,
was noch offen ist und was wann geändert wurde. **Bei jeder Story- oder Desktop-Änderung hier eintragen.**

Stand: 24.09.2026 (aus dem Code gelesen; Punkte unter „Offene Fäden" sind Ideen, kein Kanon).

---

## 1. Kanon (steht schon im Code)

**Der Rechner.** TERMINUS-7 ist ein alter Rechner im MC-ORCA-Universum. Letzter Neustart: vor **1847 Tagen**
(= 44.328 Stunden). Konten: 1 aktiv (der Gast), 2 verwaist. Betriebssystem: unbekannt / nicht lizenziert.
Letzter Nutzer: unbekannt.

**Boot** (`bootLines` in `desktop.html`): Speicher meldet „Anomalie in Sektor 4"; „willkommen zurück."

**tagebuch.txt** – 12. März: Rechner läuft warm. 13. März: `unbenannter_ordner` taucht wieder auf, dreimal gelöscht.
14. März: „Vielleicht liest das ja wer irgendwann. Falls ja: das Terminal fragt manchmal nach dir, nicht nach mir."
Rest der Datei beschädigt.

**FOTO_037.jpg** – aufgenommen 03:14 Uhr, Kamera: unbekanntes Gerät, wiederhergestellt aus Sektor-Cache.

**Log im Terminal** – 03:11 / 03:12 Anmeldung fehlgeschlagen, 03:14 Anmeldung erfolgreich, 03:14 unbekannter Prozess gestartet.

**Papierkorb** – „0 Objekte" (war vorhin noch nicht leer).

**unbenannter_ordner** – jetzt ein Dateifenster (Klick markiert, **Doppelklick öffnet**): `brief_an_dich.txt`,
`nicht_öffnen.txt`, `backup_backup_final.zip` (alle drei noch ohne Funktion: „keine Funktion in diesem Prototyp,
vielleicht später") und **`echo_1847.ogg`** (öffnet den Audioplayer, siehe Abschnitt 2).

**Sektor 4 / das Signal** – Terminal `signal`: älter als der Rechner, Quelle nicht auflösbar, wiederholt sich alle
1847 Tage. Terminal `sektor4`: standardmäßig „zugriff verweigert. (das echo antwortet nur, wenn jemand zuhört.)" —
**seit 25.09.2026 freischaltbar** (siehe Abschnitt 2, „Sektor 4 öffnen"): danach „zugriff gewährt." und die neue
Datei `sektor4_log.txt` liegt im `unbenannter_ordner`.
Der Assistent verweist darauf, dass es dem Signal aus *Path of the Stars* ähnelt.

**Weitere Terminal-Befehle** – `hilfe, dir, whoami, log, hallo, warum, exit, knoten, signal, sektor4, rift, kern,
.versteckt~, t7, sprich`. `.versteckt~` sagt „frag T-7 nach dem brief". `knoten`: „sechs antworten, einer hört zu"
(1 Aetheris, 2 Astrion, 3 Deep Anchor, 4 Path of the Stars, 5 Foundry, 6 Nexus, 7 Terminus).

**T-7 Assistent** (`assistent.html`, `worker/orca-assistent/worker.js`) – Bordcomputer von TERMINUS-7, KI-Figur.
Kennt Anomalie, Signal, Desktop-Dateien und die Spiele. Fragt gern nach dem Namen des Besuchers.
Vermutung im Persona-Text: Der letzte Nutzer war vielleicht ein Kartograph, der das Tagebuch schrieb.
Kennt seit 25.09.2026 auch `sektor4_log.txt`: deutet an (nie bestätigend), dass „er“ vielleicht ein Teil von ihm
selbst sein könnte, aus einem Speicherbereich, an den er sich nicht erinnert.

## 2. Signale & SSTV (technischer Ablauf)

Der **Frequenzanalysator** (Icon „Frequenzanalysator" in `desktop.html`) hat zwei Modi:

- **▶ abspielen** – Live-Wasserfall (Spektrogramm) der Audiodatei, volle Lautstärke.
- **◧ SSTV entschlüsseln** – erkennt Robot 36 / Robot 72, baut das 320×240-Bild **in Echtzeit zum Ton** auf
  (Zeile für Zeile, gleich lang wie die Audiodatei), Ton nur mit **5 %** Lautstärke. Bei Nicht-SSTV-Dateien:
  „kein SSTV-Signal erkannt".

**Fund-Mechanik (seit 24.09.2026):** Manche Signale sind *Funde* und erscheinen im Analysator erst, wenn man sie
gefunden und angehört hat:
1. Datei liegt im `unbenannter_ordner` (Desktop-Icon anklicken, dann Doppelklick auf `echo_1847.ogg`).
2. Es öffnet der **Audioplayer** (Lautstärke voreingestellt auf 30 %, Signal ist schrill). Man hört das Signal ab.
3. Nach **8 Sekunden** Anhören erscheint „◧ mit Frequenzanalysator analysieren" und der Kanal ist im Analysator
   freigeschaltet (bleibt per `localStorage`-Key `t7-found` erhalten; zum Zurücksetzen im Browser
   `localStorage.removeItem('t7-found')`).
4. Im Analysator dann „◧ SSTV entschlüsseln" (Bild live zum Ton).
Weitere Funde: in `desktop.html` in der Liste `FUNDE` ergänzen (`{file, name}`) und die Datei in eine Ordnerliste
(`CONTENT.ordner` bzw. ein neuer Ordner) aufnehmen. Signale, die **nicht** in `FUNDE` stehen, sind wie bisher
sofort im Analysator sichtbar (`signal.wav`, `signal_sektor4.wav`, `signal_foto037_rgb_300-7000.wav`).

**Sektor 4 öffnen (seit 25.09.2026):** Sobald `echo_1847.ogg` im Frequenzanalysator **einmal komplett per SSTV
entschlüsselt** wurde (Bild läuft bis zur letzten Zeile durch, nicht nur die 8 s zum Freischalten des Fundes),
speichert `localStorage`-Key `t7-sektor4` den Zugriff dauerhaft. Danach:
- Terminal `sektor4` antwortet „zugriff gewährt." statt „zugriff verweigert."
- Im `unbenannter_ordner` erscheint eine neue, lesbare Datei `sektor4_log.txt` (Doppelklick öffnet Text-Editor-
  Fenster wie `tagebuch.txt`). Inhalt: die „Antwort" auf 03:14 kam in < 1 s – zu schnell für ein Echo; der
  unbekannte Prozess aus dem `log`-Befehl lief schon zwei Sekunden davor. Offene Frage im Text: „wer hat zuerst
  zugehört — du, oder er?" (keine Auflösung, neuer Faden statt Antwort).
- Zurücksetzen zum Testen: `localStorage.removeItem('t7-sektor4')`.

**Neues Signal einbauen:**
1. Bild → Audio mit `tools/sstv-robot36.html` (SSTV, Robot 36/72) oder `tools/bild-zu-audio.html` (Wasserfall-Schema).
2. Dateiname muss mit **`signal`** beginnen (Präfix ist im SSTV-Tool frei einstellbar, Standard `signal_`).
   Format: **.ogg bevorzugt** (auch .wav/.mp3 möglich; bei gleichem Namen gewinnt .ogg).
3. Nach `assets/audio/` legen und pushen. Die GitHub Action `build-audio-manifest.yml` schreibt `signals.json`
   neu (manuell: `python3 tools/build_audio_manifest.py .`). Danach erscheint der Kanal automatisch im Analysator.

**Vorhandene Signale in `assets/audio/`:**
- `signal.wav`, `signal_sektor4.wav` – Rauschen/Signal ohne SSTV.
- `signal_foto037_rgb_300-7000.wav` – Wasserfall-Farbbild (Frequenzband-Schema, Ansicht „RGB-Bänder / Farbbild").
- `signal_echo1847.ogg` – **erstes SSTV-Signal** (Robot 36, ca. 37 s), ein *Fund* (im Analysator erst nach Anhören). Bild: Karte „TERMINUS-7 // SEKTOR 4 – ECHO,
  ZYKLUS 1847 TAGE, QUELLE ---, ANTWORT NUR, WENN JEMAND ZUHÖRT, 03:14". Alle Texte stammen aus dem bestehenden
  Kanon (Boot, Terminal `signal`/`sektor4`, Log 03:14) – keine neue Lore.

### Musikarchiv (Icon „Musikarchiv“ + Startmenü)

Ein Player für die Musik aller Spiele. Links Spielauswahl (plus „Alle Spiele“), rechts Titelliste (Doppelklick,
Enter oder zweimal tippen spielt), unten Player: Vor/Zurück, Play/Pause, Fortschrittsbalken (klickbar), zufällige
Reihenfolge, Lautstärke (wird gemerkt, `t7-music-vol`). Die Wiedergabeliste ist die gerade angezeigte Liste.
`MUSIC_LIB` in `desktop.html` ist aus dem echten Code der Spiele gelesen (113 Titel: Aetheris 10, Astrion 39,
Deep Anchor 10, FOUNDRY 5, NEXUS 11, NEXUS Singularity 3, Path of the Stars 35 = Sandbox 15 + Drifting Worlds 20).
Domus Prime und Nexus: Breach haben keine eigene Musik. Die Pfade sind spielordner-relativ (`aetheris/musik/...`),
die OST-Dateien liegen nur auf dem Live-Server; fehlt eine, meldet der Player es und springt zum nächsten Titel.
Neue Tracks: Eintrag in `MUSIC_LIB` ergänzen.

## 3. Offene Fäden (Ideen – noch nicht entschieden)

- [ ] Brief (`brief_an_dich.txt`) und die anderen Ordnerdateien sind nicht lesbar.
- [x] Sektor 4 verweigert den Zugriff – was öffnet ihn? Gelöst: vollständiges SSTV-Entschlüsseln von `echo_1847.ogg`.
- [ ] Neuer Faden aus `sektor4_log.txt`: die Antwort kam schneller als ein Echo könnte, ein unbekannter Prozess lief schon vorher – wer/was war das („er")? Terminal-Befehl `er` und T-7 deuten seit 25.09.2026 an, dass „er" ein Teil von T-7 selbst sein könnte – ohne Bestätigung.
- [x] Erstes SSTV-Signal im Archiv (`signal_echo1847.ogg`), liegt als Fund im `unbenannter_ordner`.
- [ ] Hinweis für den Besucher, dass es den Ordner/das Signal gibt (Terminal `dir`/`signal`, T-7-Antwort, Tagebuch?).
- [x] T-7 (`assistent.html`, `worker/orca-assistent/worker.js`) kennt `echo_1847.ogg` als vierte Datei („war gestern noch nicht da“), verrät aber nicht mehr, und kennt das Musikarchiv.
- [ ] Ein zweites Signal.
- [ ] 1847-Tage-Zyklus ist erwähnt, löst aber nichts aus (Countdown / Wiederkehr des Signals?).
- [ ] Verbindung zu den sechs Spielen läuft bisher nur über `knoten`, `rift`, `kern`.
- [ ] Wer hat das Tagebuch geschrieben, wer ist der „letzte Nutzer", was passierte um 03:14?

## 4. Entscheidungen

- Audio-Signale bevorzugt als **.ogg**.
- Entschlüsseln läuft **in Echtzeit** zum Ton (kein sofortiges Bild) und **leise (5 %)**.
- SSTV-Dateinamen sollen mit `signal` beginnen, damit sie automatisch im Analysator auftauchen.

## 5. Changelog `desktop.html`

**25.09.2026 (2)**
- Terminal-Befehl `er` ergänzt (Anspielung auf die Frage aus `sektor4_log.txt`, immer verfügbar, kein Unlock nötig).
- T-7-Assistent (`worker.js`) kennt jetzt `sektor4_log.txt` und deutet an (nie bestätigend), „er" könnte ein
  vergessener Teil von ihm selbst sein.

**25.09.2026**
- `desktop.html` ist jetzt `index.html` im Repo-Root.
- Sektor 4 freischaltbar: vollständiges SSTV-Entschlüsseln von `echo_1847.ogg` setzt `localStorage`-Key
  `t7-sektor4`, danach Terminal `sektor4` → „zugriff gewährt.", neue Datei `sektor4_log.txt` im
  `unbenannter_ordner` (lesbarer Text-Editor, wie `tagebuch.txt`).

**24.09.2026**
- `unbenannter_ordner` ist jetzt ein Dateifenster (Doppelklick); neue Datei `echo_1847.ogg` öffnet einen Audioplayer.
- Fund-Mechanik: `signal_echo1847.ogg` erscheint im Analysator erst nach 8 s Anhören (`FUNDE`, `t7-found`).
- Erstes SSTV-Signal ins Archiv gelegt: `assets/audio/signal_echo1847.ogg` (Robot 36), `signals.json` neu gebaut.
- Frequenzanalysator: Button „SSTV entschlüsseln" (Robot 36 / Robot 72), Bildaufbau live zum Ton, Lautstärke 5 %.
- Decoder-Fix: erste Bildzeile wurde übersehen (ihr Sync hing am VIS-Header) – Bild war eine Zeile verschoben.
- Kanalliste nimmt jetzt auch `.ogg` (Manifest-Builder `tools/build_audio_manifest.py`).
- `tools/sstv-robot36.html`: Robot 72 ergänzt, Präfix im Dateinamen frei wählbar, OGG-Export (Opus).
