# T-7 · MC-ORCA-Assistent (Cloudflare Worker, ohne Datenbank)

Kostenlos: Workers AI im Free-Plan (Tageskontingent, keine Kreditkarte). Ist es leer, antwortet die Seite automatisch im Archiv-Modus.

1. Kostenloses Cloudflare-Konto anlegen (dash.cloudflare.com).
2. `npm i -g wrangler` und `wrangler login`
3. In diesem Ordner: `wrangler deploy`
4. Die ausgegebene URL (https://orca-assistent.<dein-name>.workers.dev) in `assistent-config.js` bei `endpoint` eintragen und hochladen.
5. Optional: In `worker.js` bei `ALLOWED` prüfen, dass deine Domain(s) stimmen, und `MODEL` nach Wunsch ändern.

Hinweis: Chat-Texte laufen über Cloudflare. Bitte im Datenschutz erwähnen. Der Worker speichert nichts.
