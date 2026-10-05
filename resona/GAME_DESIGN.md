# GAME DESIGN – RESONA

**Stand:** 2026-10-03 · **Status:** neu geschrieben (Rekonstruktion). Das Original aus Phase 02 ging verloren. Grundlage: Master-Prompt `resona.txt` (v2.0), `PHASE_LOG.md`, `PROJECT_STATE.md` und der Code in `resona/`.
**Nicht rekonstruierbar:** der genaue Wortlaut des Originals und seiner 8 Annahmen. Bekannt sind aus `PHASE_LOG.md` nur: Artname „Reson", Hochformat, Komfortboden, Stufendauern. Alles mit **(Vorschlag)** ist ein Startwert von Claude, kein bestätigter Beschluss, und darf jederzeit geändert werden. Werte sind unbalanciert und nicht getestet.

## 1. Vision und Säulen
„Ein kleines lebendiges Wesen aus dem MC ORCA GAMES Universum." Kein Tamagotchi-Klon, kein Balkenmanagement. Ton: futuristisch, geheimnisvoll, hochwertig, leicht mysteriös, niedlich ohne kindisch, ruhig, gelegentlich humorvoll.
Säulen: (1) Die Kreatur lebt auch ohne Eingabe. (2) Beziehung durch Verhalten, Erinnerung, Überraschung, Persönlichkeit. (3) Kein Druck: keine FOMO, keine Strafe fürs Wegbleiben. (4) Touch zuerst. (5) Dokumentation ist Teil des Projekts.

## 2. Core Loop
Beobachten → Bedürfnis erkennen → pflegen (füttern, spielen, reinigen, schlafen lassen) → Reaktion und Erinnerung → Wachstum/Entdeckung → neue Verhaltensweisen. Kurze Besuche (5, 10, 20 Minuten) müssen funktionieren. Die Kreatur handelt selbst (Spielen, Umsehen, Untersuchen, Schlafen), der Spieler muss nicht jeden Vorgang auslösen.

## 3. Kreatur
Eigene Silhouette: weich, bio-technisch, expressive Augen/Sensoren, kleine leuchtende Elemente. Art (Vorschlag): **„Reson"**, Plural gleich. Verborgene Merkmale pro Individuum, aus einem Seed erzeugt (`createRng`): Energiebedarf, Wachstum, Farbpigmente, Persönlichkeitstendenzen, Evolutionsneigung, Lieblingsumgebung. Datenmodell laut Master-Prompt Abschnitt 17 (`id, name, species, age, lifeStage, personality, needs, emotions, bond, traits, genetics, skills, evolutionHistory, favoriteFood/Toy/Place, memories, inventory, appearance, habitatData, statistics`), alles serialisierbar.

## 4. Bedürfnisse
Hunger, Energie, Hygiene, Glück, Gesundheit, Bindung, Neugier. Sie ändern sich langsam. **Komfortboden (Annahme aus Phase 02, sinngemäß):** Werte fallen nicht in einen Bereich, in dem die Kreatur leidet oder stirbt; Erholung ist immer möglich. Richtwerte (Vorschlag): Hunger und Energie sinken in mehreren Stunden spürbar, Hygiene langsamer, Glück folgt den anderen Werten, Gesundheit reagiert nur auf langfristige Pflege. UI zeigt wenige wichtige Werte (Phase 10).

## 5. Emotionen
Glücklich, neugierig, müde, hungrig, einsam, aufgeregt, zufrieden, vorsichtig, überrascht. Ableitung aus Bedürfnissen, Persönlichkeit und Ereignissen; sichtbar durch Haltung, Augen, Licht, Bewegung (nicht nur Icons, wegen Barrierefreiheit auch nicht nur Farbe).

## 6. Persönlichkeit
Neugierig, ruhig, verspielt, schüchtern, mutig, energiegeladen, vorsichtig, sozial, stur. Pro Kreatur eine Mischung (Vorschlag: zwei dominante Züge plus leichte Gewichte). Sie verschiebt Prioritäten im Behavior-System (z. B. schüchtern → beobachtet länger, mutig → untersucht Neues zuerst).

## 7. Bindung und Erinnerungen
Bindung wächst durch häufige, freundliche Interaktion und gemeinsame Ereignisse. Gespeichert: häufige Interaktionen, Lieblingsfutter, Lieblingsspielzeug, Lieblingsplatz, besondere Ereignisse. Erinnerungen (Schlüssel): `first_feed, first_play, first_discovery, first_evolution, favorite_toy_found, special_event`; später beeinflussen sie das Verhalten. Rückkehr: nie dieselbe Begrüßung (hinlaufen, anschauen, springen, weiterschlafen, beschäftigt bleiben).

## 8. Lebenszyklus
Ei/Keim → Baby → Jungtier → Heranwachsende Form → Erwachsene Form → Spezialform. Stufendauern: Annahme aus Phase 02, konkrete Zahlen offen; Vorschlag: Baby in Stunden, spätere Stufen über Tage, abhängig von Pflege statt reiner Zeit.

## 9. Evolution
Nicht „XP = 100". Einflüsse: Pflege, Ernährung, Training, Bindung, Spiel, Entdeckung, Persönlichkeit, Umgebung. Konfigurierbare Faktoren: Curiosity, Care, Bond, Training, Exploration, Social, Creativity, Balance. Verzweigungen: Neugier → Entdeckerform, Bindung → Begleiterform, Training → Wächterform, Kreativität → Resonanzform, Balance → harmonische Form. Jede Evolution ist ein Datenobjekt (Name, Beschreibung, Voraussetzungen, Gewichtung, Model, Material, AnimationSet, Fähigkeiten, Verhalten, seltene Variante). Erscheinung kann sich ändern; Grundfarben Schwarz, Rot, Gold, Neonorange, dazu Blau, Violett, Cyan und seltene Farben.

## 10. Habitat
Persönlicher Lebensraum „Kuppel" (im Code: `Habitat`, Radius 4,8). Fünf Zonen: Schlafplatz, Futterplatz, Spielbereich, Forschungsbereich, Dekoration (Positionen in `CONFIG.habitat.zones`). Später Dekoration (Pflanzen, Möbel, Kristalle, Lampen, Maschinen, Hologramme), Tageszeit (Morgen/Tag/Abend/Nacht) mit Licht, Verhalten, Ambient, Umgebungsereignisse (Nebel, Sternenregen, Energieflimmern, fremde Signale). Welterweiterungen (Station, Planet, Mond …) erst später, die Kreatur bleibt Mittelpunkt.

## 11. Interaktion
Antippen/Anklicken der Kreatur: Blick, Animation, Sound, Emotion (Phase 08). Kamera frei drehbar und zoombar (Phase 04, fertig). Füttern, Reinigen, Spielzeuge geben, Schlaf zulassen. Alles groß genug für Touch; Desktop mit Maus, Tastatur optional. **Hochformat** ist die Hauptausrichtung (Annahme aus Phase 02); Querformat muss ebenfalls passen (`CameraRig.fit`).

## 12. Training und Spiel
Spielzeuge (Leuchtball, schwebender Würfel, Mini-Drohne, Kristall, Resonanzring) beeinflussen Verhalten; freies Spiel ohne Zutun. Minispiele: Reaktion, Memory, kleines 3D-Geschicklichkeitsspiel; Belohnung Glück, Bindung, kleine Ressourcen. Training: Folgen, Warten, Springen, Objekt bringen, Geräusche erkennen. Lernen: Orte/Objekte werden mit positiven Erfahrungen verbunden.

## 13. Entdeckung und Story
Die Kreatur entdeckt Signale, Kristalle, Geräte, Energiequellen, Spuren. Story ohne Textblöcke: Fundstücke, Umgebung, kurze Nachrichten, Reaktionen. Seltene Ereignisse ohne sofortige Erklärung (z. B. unbekanntes Objekt im Habitat). **Verbindung zum Universum** (Phase 36): optionale Hinweise für Fans, etwa zum Signalmotiv aus TERMINUS-7 (siehe `STORY.md` im Hub); das Spiel muss ohne Vorwissen funktionieren.

## 14. Inventar und Wirtschaft
Inventar: Futter, Spielzeuge, Materialien, Dekoration, Fundstücke. Spielinterne Währung, optional, **keine Pflicht-Echtgeldmechanik**. Keine Anbindung an die Hub-Wirtschaft (Nexus/MOGC) im MVP; spätere Anbindung nur nach Entscheidung des Nutzers.

## 15. Langzeitmotivation
Evolutionen, Verhalten, Entdeckungen, Sammlung, Habitat, Erinnerungen, Persönlichkeiten, seltene Varianten, Geheimnisse, Achievements (erste Bindung, erste Evolution, seltenes Fundstück, 100 Interaktionen, Spezialform, Geheimnis), kleine Quests ohne Daily-Zwang. Mehrere Kreaturen und Multiplayer: nicht MVP.

## 16. Anti-FOMO
Keine Strafe fürs Wegbleiben, keine Zwangslogins, keine Schuldmechanik, keine Pflicht zur Rückkehr. Offline-Zeit läuft weiter (Phase 45), Rückkehr wird nicht unnötig bestraft, Schlaf wird berücksichtigt. Gesundheit: keine brutale Bestrafung, Erholung immer möglich. Keine aggressive Werbung, keine überladene Oberfläche.

## 17. MVP-Zuordnung und Annahmen
**MVP** laut Master-Prompt: 3D-Habitat, 1 Kreatur, Bewegung, Idle, Füttern, Spielen, Schlafen, Bedürfnisse, Persönlichkeit, Speichern, Tag/Nacht, erste Evolution. Phasen-Zuordnung: Technik/3D/Kamera 03–04 (fertig), Kreatur/Idle/Bewegung/Interaktion 05–08, Bedürfnisse und Pflege 09–17, Spiel 18–24, Wachstum/Evolution 25–29, Habitat/Welt 30–34, Story/Meta 35–40, Polish/Technik 41–50.
**Annahmen (bis der Nutzer etwas anderes sagt):**
1. Artname „Reson" (aus Phase 02 bekannt).
2. Hochformat als Hauptausrichtung (aus Phase 02 bekannt).
3. Komfortboden bei den Bedürfnissen (aus Phase 02 bekannt, sinngemäß).
4. Stufendauern pflegeabhängig statt reiner Zeit (aus Phase 02 bekannt als Thema, Zahlen offen).
5. Kein Backend, kein Hub-Konto, keine Hub-Wirtschaft im MVP (bestätigt in Phase 01).
6. Drei bis fünf Persönlichkeitszüge pro Kreatur, zwei dominant **(Vorschlag)**.
7. Deutsche Oberfläche zuerst **(Vorschlag, passend zum Hub)**.
8. Ein Spielstand, eine Kreatur **(Vorschlag, passend zum MVP)**.
