# FERRUM-11984 Voice-Lines

Alle Dateien nach `art/voice/` legen (Format .ogg, alternativ .mp3).
Sprecher: **BC** = Bordcomputer (ruhig, leichter Hall) · **ST** = Station (Funk-Filter) · **PI** = Pilot (Funk-Filter, andere Stimme als ST)

Varianten `_a/_b/_c` sind absichtlich: das Spiel wählt zufällig eine.

## 1. ANTRIEB / WARP / SPRUNG

| Datei | Sprecher | Text |
|---|---|---|
| `warp_laden.ogg` | BC | Warpantrieb wird aufgeladen. |
| `warp_bereit.ogg` | BC | Warpantrieb bereit. |
| `warp_aktiv.ogg` | BC | Warpantrieb aktiviert. |
| `warp_ausstieg.ogg` | BC | Warpantrieb deaktiviert. Normalflug. |
| `warp_abbruch.ogg` | BC | Warp abgebrochen. |
| `warp_leer.ogg` | BC | Warpenergie erschöpft. Austritt aus dem Warp. |
| `warp_instabil.ogg` | BC | Warnung. Warpfeld instabil. |
| `warp_zu_nah.ogg` | BC | Warp nicht möglich. Ziel zu nah, Autopilot übernimmt. |
| `sprung_start.ogg` | BC | Sprungtor-Sequenz eingeleitet. |
| `sprung_fertig.ogg` | BC | Sprung abgeschlossen. Willkommen im neuen System. |
| `sprung_kein_treibstoff.ogg` | BC | Sprung nicht möglich. Treibstoff unzureichend. |
| `sonne_hitze.ogg` | BC | Warnung. Sonnennähe. Hülle erhitzt sich. |

## 2. AUTOPILOT

| Datei | Sprecher | Text |
|---|---|---|
| `ap_an.ogg` | BC | Autopilot aktiviert. |
| `ap_kurs.ogg` | BC | Kurs berechnet. Autopilot fliegt zum Ziel. |
| `ap_route_tor.ogg` | BC | Route über Sprungtore berechnet. |
| `ap_ziel_erreicht.ogg` | BC | Ziel erreicht. Autopilot beendet. |
| `ap_aus.ogg` | BC | Autopilot deaktiviert. Manuelle Kontrolle. |
| `ap_abbruch.ogg` | BC | Autopilot abgebrochen. |
| `ap_hindernis.ogg` | BC | Hindernis erkannt. Kurs wird korrigiert. |
| `ap_nicht_verfuegbar.ogg` | BC | Autopilot nicht verfügbar. Sensorstörung. |
| `ap_andocken_start.ogg` | BC | Autopilot-Andocksequenz eingeleitet. |
| `ap_andocken_fertig.ogg` | BC | Andocksequenz abgeschlossen. Autopilot beendet. |

## 3. ANDOCKEN (FUNK)

| Datei | Sprecher | Text |
|---|---|---|
| `dock_anfrage_a.ogg` | PI | Station, hier Frachter Ferrum. Erbitten Landeerlaubnis. |
| `dock_anfrage_b.ogg` | PI | Hier Ferrum an Station. Bitte um Andockfreigabe. |
| `dock_ok_a.ogg` | ST | Landeerlaubnis erteilt. Bitte in den Hangar einfliegen. |
| `dock_ok_b.ogg` | ST | Andockfreigabe erteilt. Folgen Sie dem Leitstrahl. |
| `dock_ok_c.ogg` | ST | Hangar frei. Willkommen an Bord. |
| `dock_verweigert_voll.ogg` | ST | Andocken verweigert. Alle Hangarbuchten belegt. |
| `dock_verweigert_schnell.ogg` | ST | Andocken verweigert. Geschwindigkeit zu hoch. Bitte abbremsen. |
| `dock_verweigert_feindlich.ogg` | ST | Andocken verweigert. Ihr Schiff ist nicht willkommen. |
| `dock_verweigert_gross.ogg` | ST | Andocken verweigert. Ihr Schiff ist zu groß für unseren Hangar. |
| `dock_verweigert_gebuehren.ogg` | ST | Andocken verweigert. Offene Gebühren. |
| `dock_verweigert_alarm.ogg` | ST | Andocken verweigert. Station im Alarmzustand. |
| `dock_warteschlange.ogg` | ST | Bitte Position halten. Sie sind in der Warteschlange. |
| `dock_anflug_langsamer.ogg` | BC | Geschwindigkeit reduzieren. |
| `dock_ausrichtung_ok.ogg` | BC | Ausrichtung korrekt. |
| `dock_klammern.ogg` | BC | Andockklammern greifen. |
| `dock_fertig.ogg` | BC | Andocken abgeschlossen. |
| `dock_reichweite.ogg` | BC | Station in Reichweite. Andocken möglich. |
| `undock_anfrage.ogg` | PI | Station, hier Ferrum. Erbitten Startfreigabe. |
| `undock_frei.ogg` | ST | Startfreigabe erteilt. Guten Flug. |
| `undock_klammern.ogg` | BC | Klammern gelöst. |

## 4. WARNUNGEN / STATUS

| Datei | Sprecher | Text |
|---|---|---|
| `huelle_kritisch.ogg` | BC | Warnung. Hüllenintegrität kritisch. |
| `huelle_50.ogg` | BC | Hülle bei fünfzig Prozent. |
| `schilde_50.ogg` | BC | Schilde bei fünfzig Prozent. |
| `schilde_aus.ogg` | BC | Schilde ausgefallen. |
| `schilde_online.ogg` | BC | Schilde online. |
| `treibstoff_niedrig.ogg` | BC | Warnung. Treibstoff niedrig. |
| `sauerstoff_niedrig.ogg` | BC | Warnung. Sauerstoff niedrig. |
| `energie_niedrig.ogg` | BC | Warnung. Energie niedrig. |
| `ueberhitzung.ogg` | BC | Warnung. Triebwerke überhitzt. |
| `kollision.ogg` | BC | Alarm. Kollision droht. |
| `feind_erkannt.ogg` | BC | Feindliche Signatur erkannt. |
| `feind_mehrere.ogg` | BC | Mehrere feindliche Signaturen erkannt. |
| `fracht_voll.ogg` | BC | Frachtraum voll. |
| `systemfehler.ogg` | BC | Systemfehler. |
| `schiff_zerstoert.ogg` | BC | Hülle zerstört. |
| `boss_warnung.ogg` | BC | Warnung. Gewaltige Energiesignatur erkannt. |

## 5. INDUSTRIE / SANDBOX

| Datei | Sprecher | Text |
|---|---|---|
| `abbau_start.ogg` | BC | Abbau gestartet. |
| `erz_entdeckt.ogg` | BC | Erzvorkommen entdeckt. |
| `lager_voll.ogg` | BC | Lager voll. |
| `rohstoff_gespeichert.ogg` | BC | Rohstoffe eingelagert. |
| `raffinerie_fertig.ogg` | BC | Raffinerie: Produktion abgeschlossen. |
| `bau_fertig.ogg` | BC | Bauauftrag abgeschlossen. |
| `reparatur_fertig.ogg` | BC | Reparatur abgeschlossen. |
| `tanken_fertig.ogg` | BC | Tanks gefüllt. |
| `drohne_aus.ogg` | BC | Drohne ausgesandt. |
| `handel_ok.ogg` | BC | Handel abgeschlossen. |
| `forschung_fertig.ogg` | BC | Forschung abgeschlossen. |

## 6. MISSION / ENTDECKUNG / MENÜ

| Datei | Sprecher | Text |
|---|---|---|
| `mission_neu.ogg` | BC | Neuer Auftrag verfügbar. |
| `mission_geschafft.ogg` | BC | Auftrag abgeschlossen. |
| `mission_gescheitert.ogg` | BC | Auftrag gescheitert. |
| `levelup.ogg` | BC | Aufstieg. Neue Stufe erreicht. |
| `entdeckung.ogg` | BC | Neue Entdeckung verzeichnet. |
| `anomalie.ogg` | BC | Anomalie erkannt. |
| `wrack.ogg` | BC | Wrack geortet. |
| `speichern.ogg` | BC | Spielstand gespeichert. |
| `laden.ogg` | BC | Spielstand geladen. |
