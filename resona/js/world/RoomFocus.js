/*
  RoomFocus – welcher Raum gerade im Blick der Kamera ist (Phase 30 Teil A, Teil C).
  Zwei Betriebsarten:
    folgen   die Kamera folgt dem Raum, in dem Reson ist. Kurz im Türdurchgang (Raumwechsel) wird nicht sofort umgeschaltet:
             erst nach `delay` Sekunden im neuen Raum, damit die Kamera beim Durchlaufen nicht hin und her springt.
    halten   (Raumwahl, Teil C) die Kamera bleibt im gewählten Raum, auch wenn Reson woanders hingeht, bis `follow()` aufgerufen wird.
  Kennt kein Three.js: `getRoomAt()`/`getRoomCenter()` kommen vom Habitat, `apply(id)` richtet Kamera und Licht aus (main.js).

  createRoomFocus({ getHereId, hasRoom, apply, delay = 0.7 })
    -> { update(dt), view(id) -> bool, follow(), getViewed() -> id|null, getFocused() -> id, getHere() -> id }
  NICHT im Browser getestet (Rechnung in Node).
*/
export function createRoomFocus({ getHereId, hasRoom, apply, delay = 0.7 }) {
  let focused = getHereId();
  let pending = null;
  let pendingT = 0;
  let manual = null;

  apply(focused);

  function update(dt) {
    if (manual) return;
    const here = getHereId();
    if (here === focused) { pending = null; return; }
    if (here !== pending) { pending = here; pendingT = 0; return; }
    pendingT += dt;
    if (pendingT >= delay) { focused = here; pending = null; apply(focused); }
  }

  /** Kamera in diesen Raum schicken und dort halten. Unbekannter Raum: nichts passiert (false). */
  function view(id) {
    if (!hasRoom(id)) return false;
    manual = id;
    focused = id;
    pending = null;
    apply(id);
    return true;
  }

  /** Zurück zum Folgen: die Kamera geht zum Raum, in dem Reson jetzt ist. */
  function follow() {
    manual = null;
    pending = null;
    focused = getHereId();
    apply(focused);
  }

  return { update, view, follow, getViewed: () => manual, getFocused: () => focused, getHere: getHereId };
}
