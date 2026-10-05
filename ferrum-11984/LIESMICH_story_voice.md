# FERRUM-11984 Story-Voice-Lines (Version 2 · mit Sprechern)

ST= Stimme Hans - Robitic and Strange
    Audioeffekte
    Filter Old Radio
    Rauschen Call center
    Leertaste Small Room

PI= Stimme Horst - Sleazy & Pushy
    Audioeffekte
    Filter Old Radio
    Leertaste Small Room

BC= Stimme Nora Vale - Mission Control
    Audioeffekte
    Filter Robot
    Leertaste Street

SI= Stimme Haunting-Hector – Dark Cinematic
    Audioeffekte
    Filter Robot
    Leertaste Tunnel

KA= Stimme William - Soothing and Calm
    Audioeffekte
    Filter Old Radio
    Leertaste Street
    Abstand Weit

HA= Stimme Zara - Made for Numbers & Finance
    Audioeffekte
    Filter Old Radio
    Leertaste Street
    Abstand Weit

**Wichtig:** Diese Liste ersetzt die erste `LIESMICH_story_voice.md`. Die Texte wurden auf MC ORCA und mehrere Sprecher umgeschrieben — bitte die alten Dateinamen (`story_01.ogg` … `story_12.ogg`) **nicht** mehr aufnehmen.

Alle Dateien nach `art/voice/` (Format .ogg, alternativ .mp3), gleicher Ordner wie die Bordcomputer-Zeilen. Fehlt eine Datei, läuft das Spiel ohne Ton weiter und zeigt den Dialog als Text.
Zeilen mit Nummer am Ende (`_1`, `_2`, `_3`) laufen direkt nacheinander als Dialog. Die Anführungszeichen werden nicht mitgesprochen.

## Wer spricht?

| Sprecher | Wer ist das | Geschlecht · Alter | Klang |
|---|---|---|---|
| **MC ORCA** | Du, der Spielercharakter. Gedanken und Logbuch in der Ich-Form. | männlich · ca. 30–38 | tief, ruhig, nachdenklich. Dieselbe Stimme wie **PI** (Funk-Zeilen „Station, hier Frachter Ferrum …“). Bei Gedanken **ohne** Funk-Filter, leise und nah. |
| **BORDCOMPUTER** | Bordcomputer deines Schiffes | weiblich (die vorhandene **BC**-Stimme verwenden) | ruhig, leichter Hall, wie bei allen `warp_*`, `dock_*`-Zeilen |
| **SIGNAL** | Das fremde Signal | geschlechtslos, kein Mensch | verzerrt/Vocoder, metallisch, monoton, Echo, flüsternd |
| **KESTREL-9** | Kommandant der verschollenen Expedition (Logbuch-Aufnahme) | männlich · ca. 55–65 | rau, müde, deutlich älter als MC ORCA, Funk-/Aufnahme-Rauschen |
| **HALCYON** | Forscherin der verlassenen Station (letzte Aufzeichnung) | weiblich · ca. 35–45 | erschöpft, leise, Aufnahme-Filter. Kann die **ST**-Stimme mit Aufnahme-Filter sein. |

Der Bordcomputer ist weiblich (bestätigt). Er und MC ORCA (männlich) sind damit klar unterscheidbar. HALCYON bitte mit einer anderen Stimme als dem Bordcomputer besetzen (älter, müder, mit Aufnahme-Filter), damit sich die zwei Frauenstimmen nicht verwechseln lassen.

Aussprache: **FERRUM** = „Ferrum“ · **KESTREL-9** = „Kestrel neun“ · **HALCYON** = „Halzion“ · **11984** = Ziffer für Ziffer „eins eins neun acht vier“.

## 1. FERRUM-SIGNAL (Hauptstory, 12 Schritte)

Kommt jeweils beim Abschluss des Schritts, nach der Belohnungsmeldung.

| Datei | Sprecher | Text | Sprechhinweis |
|---|---|---|---|
| **Schritt 1: EIN SIGNAL AUS DEM NICHTS** | | _Erstes unbekanntes Signal untersucht_ | |
| `story_01_1.ogg` | SIGNAL | 11984. 11984. 11984. | Ziffer für Ziffer „eins, eins, neun, acht, vier“, dreimal, monoton, verzerrt, mit Echo |
| `story_01_2.ogg` | MC ORCA | Nur diese eine Zahl, immer wieder. Das Signal ist älter als jede Karte, die ich besitze — und es klingt, als hätte es auf mich gewartet. | nachdenklich, leise, nah am Mikro (kein Funk-Filter) |
| **Schritt 2: DAS MUSTER ENTSCHLÜSSELN** | | _Signal entschlüsselt_ | |
| `story_02_1.ogg` | BORDCOMPUTER | Entschlüsselung abgeschlossen. Koordinaten extrahiert. Zusätzlich eine Kennung: KESTREL-9. | ruhig wie die übrigen Bordcomputer-Zeilen |
| `story_02_2.ogg` | MC ORCA | KESTREL-9. Eine Expedition, die vor Generationen als verschollen galt. | nachdenklich, leise, nah am Mikro (kein Funk-Filter) |
| **Schritt 3: ERSTE KOORDINATEN** | | _Erstes Zielsystem erreicht_ | |
| `story_03.ogg` | MC ORCA | Die Sterne stehen genau so, wie es das Signal beschrieben hat. Etwas treibt hier in der Nähe. | nachdenklich, leise, nah am Mikro (kein Funk-Filter) |
| **Schritt 4: DAS LOGBUCH DER KESTREL-9** | | _Wrack der KESTREL-9 untersucht_ | |
| `story_04_1.ogg` | KESTREL-9 | Es antwortet auf uns. Das Signal hat uns die ganze Zeit … | Funk-Rauschen, müde, bricht mitten im Satz ab (letztes Wort „…“ verschlucken) |
| `story_04_2.ogg` | MC ORCA | Der Eintrag bricht mitten im Satz ab. Und die Datenkerne sind verschlüsselt. | nachdenklich, leise, nah am Mikro (kein Funk-Filter) |
| **Schritt 5: VERSCHLÜSSELTE DATEN** | | _Logbuch-Daten entschlüsselt_ | |
| `story_05_1.ogg` | BORDCOMPUTER | Entschlüsselung erfolgreich. Neues Ziel: Forschungsstation HALCYON. | ruhig wie die übrigen Bordcomputer-Zeilen |
| `story_05_2.ogg` | MC ORCA | Die Besatzung hat HALCYON planmäßig verlassen — und niemand weiß, wohin sie gegangen ist. | nachdenklich, leise, nah am Mikro (kein Funk-Filter) |
| **Schritt 6: AUF DEM WEG NACH HALCYON** | | _Auf dem Weg nach HALCYON (System erreicht)_ | |
| `story_06_1.ogg` | BORDCOMPUTER | Funkanruf unbeantwortet. Keine Notbeleuchtung. | ruhig wie die übrigen Bordcomputer-Zeilen |
| `story_06_2.ogg` | MC ORCA | Nur ein Kurs, der in den Navigationsdaten der Station noch immer eingetragen ist. | nachdenklich, leise, nah am Mikro (kein Funk-Filter) |
| **Schritt 7: STATION HALCYON** | | _Station HALCYON untersucht_ | |
| `story_07_1.ogg` | MC ORCA | In den Laboren stehen Werkbänke mit Teilen, die niemand gebaut haben kann. | nachdenklich, leise, nah am Mikro (kein Funk-Filter) |
| `story_07_2.ogg` | HALCYON | Letzter Eintrag. Das Signal ist verstummt. | müde, leise, wie eine alte Aufnahme |
| `story_07_3.ogg` | BORDCOMPUTER | Alle Aufzeichnungen enden am selben Tag. | ruhig wie die übrigen Bordcomputer-Zeilen |
| **Schritt 8: FREMDE TECHNOLOGIE ANALYSIEREN** | | _Fremde Technologie analysiert_ | |
| `story_08_1.ogg` | BORDCOMPUTER | Analyse abgeschlossen. Die Probe reagiert auf das Signal wie auf einen Takt. | ruhig wie die übrigen Bordcomputer-Zeilen |
| `story_08_2.ogg` | MC ORCA | Und sie zeigt mir einen dritten Ort: ein Feld aus Wracks, die sich nicht bewegen. | nachdenklich, leise, nah am Mikro (kein Funk-Filter) |
| **Schritt 9: DAS WRACKFELD** | | _Wrackfeld erreicht_ | |
| `story_09.ogg` | MC ORCA | Schiffe aus verschiedenen Epochen treiben hier — und alle Bugs zeigen auf denselben Punkt. | nachdenklich, leise, nah am Mikro (kein Funk-Filter) |
| **Schritt 10: DIE VERSCHWUNDENE FLOTTE** | | _Verschwundene Flotte untersucht (Hinterhalt folgt)_ | |
| `story_10.ogg` | MC ORCA | Die verschollenen Expeditionen sind nie verschwunden. Sie wurden hierher gerufen. Und jemand hat mich bereits erwartet. | ruhig, bedrohlich |
| **Schritt 11: JÄGER ABWEHREN** | | _3 Piraten abgewehrt_ | |
| `story_11_1.ogg` | BORDCOMPUTER | Peilsender an den Angreifern erkannt. Frequenz: FERRUM. | ruhig wie die übrigen Bordcomputer-Zeilen |
| `story_11_2.ogg` | MC ORCA | Sie sollten das Signal schützen. Oder es verkaufen. | nachdenklich, leise, nah am Mikro (kein Funk-Filter) |
| `story_11_3.ogg` | BORDCOMPUTER | Neuer Ort auf der Sternkarte verzeichnet. | ruhig wie die übrigen Bordcomputer-Zeilen |
| **Schritt 12: DER FERRUM-KERN** | | _FERRUM-KERN berührt (Finale)_ | |
| `story_12_1.ogg` | MC ORCA | Das ist kein Wrack und keine Station. Das ist die Quelle. | ehrfürchtig, leise |
| `story_12_2.ogg` | SIGNAL | 11984 … 119 … | Ziffern werden leiser und brechen ab: „eins, eins, neun …“ (ausblenden) |
| `story_12_3.ogg` | MC ORCA | Es ist verstummt. Und die Karte zeigt mir Orte, die es zuvor nicht gab. | nachdenklich, leise, nah am Mikro (kein Funk-Filter) |

## 2. FUNDORT-TEXTE (zufällig bei Erkundung von Wracks, Ruinen, Anomalien, Signalen)

| Datei | Sprecher | Text |
|---|---|---|
| `lore_fund_01.ogg` | BORDCOMPUTER | Letzter Logbucheintrag: „Reaktor drei ausgefallen. Kurs unhaltbar. Wir treiben ab.“ |
| `lore_fund_02.ogg` | MC ORCA | Zwischen den Trümmern sind Koordinaten eingeritzt. Sie passen zu keiner Route, die ich kenne. |
| `lore_fund_03.ogg` | BORDCOMPUTER | Datenfragment gesichert. Es beschreibt eine Zivilisation, die „vor dem Schweigen“ existierte. |
| `lore_fund_04.ogg` | MC ORCA | Diese Hüllenmarkierungen kenne ich nicht. Keine Werft-Registratur führt sie. |
| `lore_fund_05.ogg` | BORDCOMPUTER | Frachtliste gefunden. Eine Ladung ist als „nicht klassifizierbar“ vermerkt. |
| `lore_fund_06.ogg` | MC ORCA | Ein automatisches Notsignal. Es wiederholt seit unbekannter Zeit dieselben drei Worte. |
| `lore_fund_07.ogg` | MC ORCA | Die Instrumente zeigen Werte, die es laut Lehrbuch nicht geben dürfte. |
| `lore_fund_08.ogg` | BORDCOMPUTER | Wartungsprotokolle gefunden. Sie brechen abrupt mitten im Satz ab. |
| `lore_fund_09.ogg` | MC ORCA | Ein versiegeltes Modul. Es widersteht jedem Öffnungscode, den ich kenne. |
| `lore_fund_10.ogg` | BORDCOMPUTER | Sensorspuren deuten auf einen Besucher hin, der lange vor uns hier war. |

## 3. EVENT-TEXTE (zufällig nach einem untersuchten Weltraum-Ereignis)

| Datei | Sprecher | Text |
|---|---|---|
| `lore_event_01.ogg` | BORDCOMPUTER | Die Sensoren zeigen eine Struktur, die in keiner Sternkarte verzeichnet ist. |
| `lore_event_02.ogg` | BORDCOMPUTER | Zeitstempel der Aufzeichnung: Zukunft. Die Bordzeit widerspricht sich selbst. |
| `lore_event_03.ogg` | MC ORCA | Ein Funkspruch ohne Absender. Er wiederholt dieselben Koordinaten — unsere eigenen. |
| `lore_event_04.ogg` | MC ORCA | Das Ereignis verschwindet, als hätte es nie existiert. Nur die Messdaten bleiben. |

## 4. MEGA-PROJEKT

| Datei | Sprecher | Text |
|---|---|---|
| `lore_mega.ogg` | MC ORCA | Die Grenzen meines Einflusses verschieben sich. Was ich hier gebaut habe, wird noch fliegen, wenn ich längst weitergezogen bin. |

## Übersicht: wer wie viele Zeilen hat

| Sprecher | Dateien |
|---|---|
| MC ORCA | 21 |
| BORDCOMPUTER | 14 |
| SIGNAL | 2 |
| KESTREL-9 | 1 |
| HALCYON | 1 |
| **Gesamt** | **39** |
