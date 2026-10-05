/*
  FormBehavior – leichte Verhaltensneigung, eigene Geste und Fähigkeit je Evolutionsform (Phase 27 Teil B3 und B4).
  Bisher verhielten sich alle Formen gleich. FormBehavior gibt jeder Form eine kleine, DAUERHAFTE Neigung auf die selbstständige Wahl
  (`EVOLUTIONS[id].behavior`, aufgebaut mit `formTendency` in `js/data/evolution.js`):
    Faktoren auf Erkunden / Untersuchen / zum Spieler schauen, auf die Länge der Ruhephasen, auf die Verweildauer vor einer Zone, auf die Dauer des Blicks,
    auf die Neigung, dieselbe Zone nochmal anzulaufen, und bei zwei Formen eine Neigung zu einer bestimmten Zone (Entdecker: Forschungsbereich, Resonanz: Spielbereich).
  Die Neigung wirkt über `behavior.setTendency(...)` (eigene Schicht in `Behavior.js`, neben `setBias`, dem zeitlich begrenzten Spielzeug-Nachklang):
  beide multiplizieren sich, keine überschreibt die andere. Persönlichkeit, Nachwirkung und Neigung der Form liegen zusammen im Bereich weniger Zehntel
  Unterschied, die Neigung der Form ist die kleinste der drei (Grenzen `FORM_RULES.tendency`: Faktoren 0,8–1,25, Zonen 0,85–1,25).

  Gleitend: die Faktoren werden mit dem Anteil des Übergangs in die Spezialform (`form.getShare()`, 0..1, dieselbe Quelle wie Farbton, Schein und Zusatzteile)
  gemischt: Faktor = 1 + (Zielfaktor - 1) * Anteil. Ohne Form, in der Grundform (`behavior: null`) und im Ei (Anteil 0) gibt es keine Neigung.
  Keine Form ist besser oder schlechter: die Neigung verschiebt nur, WAS Reson von selbst öfter tut, sperrt nichts, ändert keine Werte, Wirkungen oder Aufgaben
  (Füttern, Schlafen, Waschen, Spielen, Minispiele, Üben auf Knopfdruck laufen unverändert) und lässt Reson nie etwas tun, was sie sonst nicht auch tut.

  Teil B4: Geste und Fähigkeit. Mit `idle` (optional) gibt FormBehavior der Form ihre eigene kleine Geste (`EVOLUTIONS[id].animationSet`, über
  `idle.setFormGesture(def, share)`: sie kommt im Zufallstopf der kleinen Gesten vor, wie Flossenzucken oder Kopfneigen). Die Fähigkeit (`abilities`, genau eine je
  Form) ist eine Gelegenheit: wechselt `Behavior` in den Zustand `on.to` (bei `on.from` nur aus diesen Zuständen), spielt die Form mit der Wahrscheinlichkeit
  `FORM_RULES.ability.chance` kurz danach (`delaySec`) ihre Geste, höchstens alle `cooldownSec`, nur wenn der Zustand dann noch gilt und der Übergang fast
  abgeschlossen ist (`minShare`). Mehr tut sie nicht: keine Werte, keine Aufgaben, kein Gewinn, nichts gesperrt. Bei „reduzierte Bewegung“ spielt Idle keine Geste.
  Dieselben Zahlen für alle Formen (`FORM_RULES.gesture`, `FORM_RULES.ability`).

  createFormBehavior({ behavior, form, idle = null, seed }) -> {
    update(dt)       pro Frame (von `main.js` nach `growth`, weil `form.update` in `growth.update` läuft); schreibt nur bei Änderung (Form oder Anteil auf 0,01 gerundet)
    getTendency()    -> Kopie der gerade gesetzten Neigung oder null (für Debug/Anzeige)
    getFormId()      Id der Form, deren Neigung gerade gesetzt ist, oder null
    getAbilities()   Fähigkeiten der gerade geltenden Form (Kopie der Liste, leer ohne Form; für Debug/Anzeige)
    dispose()        Neigung, Geste und Zustands-Hörer löschen
  }
  `form` ist FormLook (getFormId, getShare). NICHT im Browser getestet, nicht ausgeführt. Alle Werte sind Startwerte.
*/
import { EVOLUTIONS, FORM_RULES } from '../data/evolution.js';
import { createRng } from '../core/rng.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createFormBehavior({ behavior, form, idle = null, seed = 2727 }) {
  let key = '';           // zuletzt angewandter Stand (Form + Anteil), um unnötiges Schreiben zu sparen
  let shownId = null;
  let applied = null;
  const rng = createRng(seed);
  let clock = 0;                 // Laufzeit in Sekunden (nur für die Pause der Fähigkeit)
  let lastAbilityAt = -Infinity;
  let pending = null;            // { ability, left } wartet auf `delaySec`

  /** Neigung der Form mit dem Anteil `share` gemischt (1 = unverändert); null ohne Daten oder ohne Anteil. */
  function build(def, share) {
    if (!def || !(share > 0)) return null;
    const L = FORM_RULES.tendency;
    const out = { zones: {} };
    for (const k of Object.keys(def)) {
      if (k === 'zones') continue;
      const v = def[k];
      if (Number.isFinite(v)) out[k] = 1 + (clamp(v, L.factor[0], L.factor[1]) - 1) * share;
    }
    const zones = def.zones || {};
    for (const id of Object.keys(zones)) {
      const v = zones[id];
      if (Number.isFinite(v)) out.zones[id] = 1 + (clamp(v, L.zone[0], L.zone[1]) - 1) * share;
    }
    return out;
  }

  /** Fähigkeiten der gerade geltenden Form (leer ohne Form oder im Ei). */
  function currentAbilities() {
    const id = form.getFormId();
    const ev = id ? EVOLUTIONS[id] : null;
    return ev && Array.isArray(ev.abilities) ? ev.abilities : [];
  }

  function update(dt = 0) {
    clock += dt;
    const id = form.getFormId();
    const share = form.getShare();
    const ev = id ? EVOLUTIONS[id] : null;
    const def = ev ? ev.behavior : null;
    const gdef = ev ? ev.animationSet : null;
    const next = (def || gdef) ? id + ':' + share.toFixed(2) : '-';
    if (next !== key) {
      key = next;
      const t = build(def, share);
      shownId = t ? id : null;
      applied = t;
      behavior.setTendency(t);
      if (idle) idle.setFormGesture(gdef, share);
    }
    // Fähigkeit: nach `delaySec` die eigene Geste, wenn der Zustand dann noch gilt
    if (pending) {
      pending.left -= dt;
      if (pending.left <= 0) {
        const p = pending;
        pending = null;
        if (idle && behavior.getState() === p.ability.on.to && form.getShare() >= FORM_RULES.ability.minShare) {
          if (idle.triggerGesture('form')) lastAbilityAt = clock;
        }
      }
    }
  }

  function onState(to, from) {
    if (!idle || pending) return;
    const R = FORM_RULES.ability;
    if (form.getShare() < R.minShare || clock - lastAbilityAt < R.cooldownSec) return;
    for (const ab of currentAbilities()) {
      if (ab.on.to !== to) continue;
      if (ab.on.from && !ab.on.from.includes(from)) continue;
      if (rng() < R.chance) pending = { ability: ab, left: R.delaySec };
      return;
    }
  }
  const offState = behavior.onStateChange(onState);

  function dispose() {
    key = '';
    shownId = null;
    applied = null;
    pending = null;
    behavior.setTendency(null);
    if (idle) idle.setFormGesture(null, 0);
    if (typeof offState === 'function') offState();
  }

  return {
    update,
    getTendency: () => (applied ? { ...applied, zones: { ...applied.zones } } : null),
    getFormId: () => shownId,
    getAbilities: () => currentAbilities().slice(),
    dispose,
  };
}
