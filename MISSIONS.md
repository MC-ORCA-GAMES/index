# TERMINUS-7 · Missions-Roadmap (15h-Ausbau)

Zweck: Plant den großen Ausbau von TERMINUS-7 von einem atmosphärischen Easter-Egg zu einer vollen
Spielerfahrung mit Missionen und Minispielen (Ziel: locker 15 Stunden Spielzeit). Ergänzt `STORY.md`
(Kanon/Lore/Changelog) um die Struktur: welche Sektoren es gibt, in welcher Reihenfolge, welches Minispiel
pro Sektor, und was pro Sektor an Kanon dazukommt. **Bei jeder Sektor-Umsetzung hier abhaken und in
STORY.md den Changelog-Eintrag ergänzen.**

Stand: 26.09.2026.

---

## 0. Eckdaten (mit dir abgestimmt)

- Minispiele laufen **im bestehenden Desktop-Fenster** (wie Terminal/Frequenzanalysator jetzt), keine eigenen
  Vollbild-Screens.
- **Nur Rätsel/Logik**, kein Zeitdruck, keine Reflex-Mechanik — auch dort, wo das Referenz-Spiel selbst
  Action ist (z. B. NEXUS: BREACH ist ein Shooter, der zugehörige TERMINUS-7-Sektor ist trotzdem ein reines
  Logikrätsel, nur thematisch inspiriert, kein Nachbau).
- **Feste, lineare Reihenfolge** der Sektoren (kein frei wählbarer Hub).
- Acht "Außenposten" plus TERMINUS-7 selbst als Hub — die sechs ursprünglichen `knoten`-Einträge plus die
  zwei zusätzlichen, eigenständigen Spiele NEXUS: BREACH und DOMUS PRIME: VERDANTIS.

## 1. Sektor-Reihenfolge (Entwurf — bitte gegenlesen)

| # | Sektor | Referenz-Spiel | Minispiel-Idee (reines Logikrätsel) | ca. Spielzeit |
|---|--------|-----------------|--------------------------------------|----------------|
| 0 | TERMINUS-7 (Hub) | — | SSTV-Entschlüsseln, DataRescue, Terminal (**bereits gebaut**) | ~1,5h |
| 1 | Aetheris | Aetheris (Dyson-Sphäre, Screaming Suns) | Sternkarten-Trilateration: aus 3 Signal-Peilungen die richtige Koordinate errechnen | ~2h |
| 2 | Astrion | Astrion | Signatur-Zuordnung: Muster ohne Zeitdruck den richtigen Quellen zuordnen (Mastermind-artig) | ~1,5h |
| 3 | Deep Anchor | Deep Anchor | Ventil-/Drucklogik: Sequenz von Ventilen in richtiger Reihenfolge öffnen, ohne dass der Druck kippt | ~1,5h |
| 4 | Path of the Stars | Path of the Stars | Fraktions-Logikrätsel: Zuordnungsrätsel (wer gehört zu wem, per Ausschlussverfahren) | ~2h |
| 5 | Foundry | Foundry | Kurs-Muster-Rätsel: verborgene Regel in einer Zahlenreihe finden | ~1,5h |
| 6 | NEXUS: BREACH | Nexus: Breach (Shooter, bewusst nicht mit Supabase/Account/MOGC verbunden) | Schaltkreis/Leitungslegen durchs "Bunker"-Layout — der Sektor, der sich weigert, sich zu verbinden | ~2h |
| 7 | Domus Prime: Verdantis | Domus Prime (Kolonie-Aufbau, importiert Rohstoffe aus Nexus) | Ressourcenfluss-Puzzle: Rohre/Bänder richtig verbinden, damit Rohstoffe ankommen | ~1,5h |
| 8 | NEXUS (Finale) | Nexus (idle crypto, zwei Kerne) | Kern-Synchronisation: beide Kerne per Logikrätsel in Einklang bringen | ~2,5h |

**Angenommene Platzierung von NEXUS: BREACH (6) und DOMUS PRIME (7):** Breach kommt direkt nach Foundry als
"versteckter, unverbundener Sektor" (passt zur Isolations-Thematik der Haupthandlung — ein Prozess, der sich
nicht anschließen lässt). Domus Prime kommt danach als ruhiger Gegenpol vor dem Finale, weil es inhaltlich
Rohstoffe aus NEXUS bezieht und damit direkt zum Finalsektor hinführt. **Sag Bescheid, falls du die beiden
lieber anders einsortiert haben willst** — reine Reihenfolge-Entscheidung, ändert nichts an den Minispielen.

Summe: ~16h Kern-Content, plus Erkundung/Backtracking → passt zu "locker 15 Stunden".

## 2. Wie ein Sektor freigeschaltet wird (Entwurf)

Bleibt im Stil des bisherigen `unbenannter_ordner`-Fund-Systems: pro Sektor eine neue Datei/ein neues Icon im
Explorer, das erst nach Abschluss des vorherigen Sektors erscheint (analog zu `p46-row`/`t0-row`, per
`localStorage`-Flag `t7-sektor-<n>`). Jeder Sektor bekommt:
- einen kurzen Fiction-Rahmen (warum man diesen Sektor überhaupt aufruft — z. B. „ein Fragment des Prozesses
  hat sich hierhin verzweigt")
- ein Minispiel-Fenster (neuer `CONTENT`-Eintrag, wie `backupzip`/`tag0log`, aber interaktiv statt reinem Text)
- eine Belohnung: ein neuer Log/Text, der die Rahmenhandlung (1846/1847, „er", KONTO_B) ein Stück weiterträgt
  — jeder Sektor liefert einen kleinen Kanon-Beitrag zur Haupthandlung, kein reiner Minispiel-Selbstzweck.

## 3. Noch offen / nächste Schritte

- [ ] Reihenfolge von Sektor 6/7 (Breach/Domus Prime) bestätigen oder ändern
- [ ] Sektor 1 (Aetheris) im Detail ausarbeiten: genaue Rätsel-Mechanik, UI im Desktop-Fenster, Kanon-Belohnung
- [ ] Freischalt-Mechanik (Explorer-Icons pro Sektor) im Detail festlegen
- [ ] Danach: Sektor für Sektor umsetzen, jeweils mit Changelog-Eintrag hier und in `STORY.md`
