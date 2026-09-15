# C64 Web Emulator

Ein Commodore 64 im Browser. Kein Server, kein Build-Schritt, keine externen
Abhängigkeiten: reine ES-Module, Canvas und Web Audio. Nach dem ersten Laden
läuft die Anwendung dank Service Worker auch offline.

Der Emulator ist keine Nachbildung der Optik, sondern führt echten 6510-Code
aus. Die CPU besteht die Testsuite von Klaus Dormann
(`6502_functional_test`, inklusive Dezimalmodus).

## Starten

ES-Module brauchen `http://` statt `file://`:

```bash
python3 serve.py        # danach http://localhost:8000/
# oder
npx serve .
```

## Was emuliert wird

| Baustein | Umfang |
|---|---|
| MOS 6510 | alle offiziellen Opcodes, Dezimalmodus, gebräuchliche illegale Opcodes, NMOS-Bug bei `JMP ($xxFF)`, Zyklenzählung inkl. Page-Cross und Branch |
| VIC-II (6569 PAL) | 312 Rasterzeilen à 63 Zyklen, Textmodus, Multicolor-Text, ECM, Hires- und Multicolor-Bitmap, 8 Sprites (Multicolor, X/Y-Vergrößerung, Priorität, Kollisionsregister), Hardware-Scrolling, 38/24-Zeichen-Modus, Rasterinterrupts, 16-Farben-Palette |
| SID (6581) | 3 Stimmen, Dreieck/Sägezahn/Rechteck/Rauschen und Kombinationen, ADSR mit Originalraten, Ringmodulation, Oszillator-Sync, Multimode-Filter mit Resonanz, Lautstärke, Register `$D41B`/`$D41C` |
| CIA 6526 (2x) | Timer A/B inkl. Verkettung, TOD, Interruptmasken, Tastaturmatrix, beide Joystickports, VIC-Bankumschaltung, NMI über CIA2 |
| Speicher | 64K RAM, 1K Farb-RAM, PLA-Banking über `$01`, I/O-Fenster, VIC-Bus mit Zeichensatz-Einblendung |
| 1541 | virtuelles Laufwerk auf Dateiebene: Diskette einlegen/auswerfen, Verzeichnis, LOAD, SAVE |
| Datenträger | PRG, D64, T64, TAP, CRT, SID |

Die Emulation läuft rasterzeilengenau: pro Zeile 63 CPU-Zyklen, danach CIA-Timer,
SID-Takt und die Bildausgabe dieser Zeile. Rastersplits und IRQ-Effekte
funktionieren dadurch, zyklusgenaue Tricks innerhalb einer Zeile (etwa
FLD oder Sprite-Multiplexer mit Timing auf einzelne Zyklen) nicht.

## ROMs: der offene KERNAL

KERNAL, BASIC und Zeichensatz des C64 sind urheberrechtlich geschützt und
liegen dem Projekt **nicht** bei. Damit der Emulator trotzdem sofort startet,
enthält er Eigenentwicklungen:

* **Freier Zeichensatz** (`src/vic/font.js`) – ein selbst gezeichneter
  8×8-PETSCII-Satz im Originallayout.
* **Offener KERNAL** (`src/emulator/kernal-shim.js`) – die dokumentierten
  Einsprungadressen (`$FFD2` CHROUT, `$FFE4` GETIN, `$FFD5` LOAD, `$FFF0` PLOT,
  IRQ-Einsprung `$FF48` mit Vektor `$0314`, `$EA31`/`$EA81` …) werden als Traps
  abgefangen und in JavaScript ausgeführt. Maschinenprogramme, die über diese
  Vektoren arbeiten – auch mit eigenen Raster-Interrupts – laufen damit ohne ROM.
* **BASIC V2 in JavaScript** (`src/basic/basic.js`) – Interpreter,
  Bildschirmeditor und Tokenizer. Programme werden zusätzlich tokenisiert ab
  `$0801` im RAM abgelegt, sodass PEEK, POKE und SYS zusammenpassen.

Wer die Original-ROMs des eigenen Geräts besitzt, lädt sie unter
*Einstellungen → Original-ROMs*. Dann läuft der echte ROM-Code auf der
emulierten CPU, der JavaScript-Ersatz schaltet sich ab, und nur der
LOAD/SAVE-Trap bleibt aktiv (Schnellzugriff auf das virtuelle Laufwerk).
Das ist der Modus für kommerzielle Spiele mit eigenen Laderoutinen und für
TAP-Bänder.

## Bedienung

Der C64 bootet zuerst – erst danach führt die Leiste oben zu Bibliothek,
Diskette, Speicherständen und Einstellungen.

```
10 PRINT "HELLO WORLD"
20 GOTO 10
RUN
```

| Taste | Wirkung |
|---|---|
| Esc | RUN/STOP, bricht ein laufendes Programm ab |
| Pos1 | CLR/HOME |
| Entf / Rücktaste | INST/DEL |
| F1–F8 | Funktionstasten |
| Strg / Alt | CTRL und Commodore-Taste |
| Pfeiltasten | Cursor, oder Joystick wenn eingeschaltet |

Unterstützte BASIC-Befehle: PRINT, INPUT, GET, LET, IF/THEN, FOR/NEXT/STEP,
GOTO, GOSUB/RETURN, ON…GOTO/GOSUB, DATA/READ/RESTORE, DIM, DEF FN, POKE, PEEK,
SYS, WAIT, REM, END, STOP, CONT, RUN, LIST, NEW, CLR, LOAD, SAVE sowie die
Funktionen ABS, INT, SGN, SQR, SIN, COS, TAN, ATN, EXP, LOG, RND, LEN, ASC,
VAL, STR\$, CHR\$, LEFT\$, RIGHT\$, MID\$, FRE, POS, TI, TI\$.

Dateien lassen sich per Drag & Drop ablegen. `LOAD"$",8` und `LIST` zeigen das
Verzeichnis der eingelegten Diskette, `LOAD"NAME",8` lädt ein BASIC-Programm,
`LOAD"NAME",8,1` ein Maschinenprogramm an seine Ladeadresse.

## Mitgelieferte Programme

Alles selbst geschrieben und gemeinfrei (CC0): Hello World, Farbwechsel,
Sprite Ball (bewegtes Hardware-Sprite), SID Sound (ADSR-Tonleiter), Zahlenraten
(kleines Spiel mit INPUT/GET), Zeichensatz-Übersicht und **Rasterbars** – ein
echter Raster-Interrupt in 6510-Maschinensprache, der den Rahmen zeilenweise
umfärbt.

Es werden keine Dateien aus dem Netz nachgeladen. Eigene Programme landen in
IndexedDB und bleiben im Browser.

## Verzeichnisstruktur

```
index.html          Gehäuse, Bildschirm, Bedienleiste
serve.py            lokaler Webserver
sw.js               Offline-Cache
src/
  cpu/cpu6510.js        CPU
  memory/memory.js      RAM, Farb-RAM, Banking, I/O-Verteilung
  vic/vic2.js           VIC-II
  vic/font.js           freier Zeichensatz
  sid/sid.js            SID
  cia/cia.js            CIA 6526
  emulator/machine.js       Verdrahtung und Rastertiming
  emulator/kernal-shim.js   offener KERNAL
  basic/basic.js        BASIC V2, Tokenizer
  basic/screen.js       Bildschirmeditor, PETSCII
  disk/drive1541.js     virtuelles Laufwerk
  formats/              d64, t64, tap, crt, sidfile, detect
  keyboard/ joystick/   Eingabe
  storage/storage.js    IndexedDB
  games/                Demos und Bibliothek
  ui/                   app.js, panels.js, vkeyboard.js, styles.css
```

## Verwendete fremde Komponenten

Keine. Der gesamte Emulator ist Eigencode ohne Laufzeitabhängigkeiten – es wird
weder eine Emulationsbibliothek eingebunden noch ein Paket nachgeladen.
Referenzmaterial waren öffentlich dokumentierte Hardwarebeschreibungen
(6502-Opcode-Tabellen, VIC-II- und SID-Registerdokumentation, D64/T64/CRT/PSID-
Formatbeschreibungen) sowie zur Verifikation der CPU die Testsuite
`6502_65C02_functional_tests` von Klaus Dormann (GPL-3.0), die nur zum Testen
ausgeführt und **nicht** mit ausgeliefert wird.

Falls später doch eine fremde Emulationsbibliothek eingebunden wird, gehören
Name, Herkunft und Lizenz an diese Stelle. Beispiele mit passender Lizenz wären
VICE (GPL-2.0-or-later), reSID (GPL-2.0-or-later) oder chips von Andre Weissflog
(Zlib).

Der Code dieses Projekts steht unter der MIT-Lizenz. Die Marken Commodore und
C64 gehören ihren jeweiligen Inhabern; dieses Projekt steht in keiner Verbindung
zu ihnen.

## Bekannte Grenzen

* Kein zyklusgenaues Badline-/Sprite-DMA-Modell; Effekte, die auf einzelne
  Zyklen innerhalb einer Rasterzeile bauen, laufen nicht korrekt.
* Kein eigener 6502 im Laufwerk: das 1541 arbeitet auf Dateiebene, Kopierschutz
  auf Spurebene (GCR, Halbspuren) funktioniert nicht. G64 wird nicht gelesen.
* Steckmodule nur als Standardtyp (8K/16K, Ultimax); keine Bank-Switching-Typen.
* TAP-Bänder brauchen die Original-ROMs, da die Laderoutine im KERNAL steckt.
* Der SID nutzt eine Filterannäherung, keine Nachbildung der Bauteilstreuung
  einzelner 6581-Exemplare.
