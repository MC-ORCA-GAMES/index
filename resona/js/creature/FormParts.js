/*
  FormParts – kleine Zusatzteile je Evolutionsform (Phase 27 Teil B2).
  Jede Form bekommt drei kleine Teile aus Primitiven (Daten: `EVOLUTIONS[id].model`, Beschreibung der Felder bei `modelPart` in js/data/evolution.js):
    Entdecker: zwei feine Sensorbögen über den Flossen und ein Stirnstein        Begleiter: weicher Kragenring am Hals und zwei warme Wangenpunkte
    Wächter:   Stirnplatte und zwei matte Schulterplatten                        Resonanz:  Ring um den Kristall und zwei Funken, die auf ihm kreisen
    Harmonisch: ruhiger Halo über dem Kristall, innerer Ring und eine kleine Perle, die ihn langsam umrundet     Grundform: keine Zusatzteile.
  Die Teile hängen an vorhandenen Pivots (Kopf, Körper) bzw. an einem eigenen Punkt über dem Kopf an der Stelle des Kristalls (`crystal`; der Punkt
  folgt dem Kopf, aber nicht dem Schweben und Drehen des Kristalls selbst), wachsen mit dem Übergang in die Spezialform ein (Anteil `form.getShare()`,
  gleicher Anteil wie Farbton und Schein) und bewegen sich nur leicht (Wippen, Atmen, Kreisen). „Reduzierte Bewegung“: alles steht still.

  Eigene Materialien und Geometrien; es werden keine Materialien der Kreatur angefasst (Idle, Stimmung, Schlaf und Interaktion schreiben weiter nur
  an ihren eigenen). Die Teile stehen NICHT in `creature.parts`, niemand sonst kennt sie. Treffer (`Interaction.hitTest` ist eine Kugel), Wege, Werte
  und Aufgaben bleiben unberührt. Keine Form ist besser oder schlechter: gleiche Anzahl, ähnliche Größe, nur Gestalt und Farbe unterscheiden sich.
  Farben: die Farbnamen der Teile werden mit `material` der Form aufgelöst (`eye`/`core`/`accent`/`crystal`/`ring`/`aura`), sonst mit den Grundfarben
  `creature.appearance`; sie sind ganz in der Farbe der Form (die Tönung der Kreatur-Materialien mischt dagegen nur mit `FORM_RULES.tintMix`).

  createFormParts({ creature, form }) -> { update(dt), getCount(), getFormId(), dispose() }
    form: FormLook (liefert `getFormId()` und `getShare()`). `update(dt)` muss NACH `form.update(dt)` laufen (Growth ruft beide in dieser Reihenfolge).
    Die Teile werden neu gebaut, wenn sich die Form ändert (z. B. Verwandlung, später Laden in Phase 44), und verschwinden bei Form `null`.
  NICHT im Browser getestet, nicht ausgeführt. Alle Maße und Zahlen sind Startwerte.
*/
import * as THREE from 'three';
import { EVOLUTIONS } from '../data/evolution.js';
import { NECK_Y } from './CreatureModel.js';
import { prefersReducedMotion } from '../core/env.js';

const CRYSTAL_BASE_Y = 1.13 - NECK_Y;   // Höhe des Kristalls im Kopf-Raum (wie in CreatureModel)
const ease = (u) => u * u * (3 - 2 * u);
const MIN_SCALE = 0.001;

function makeGeometry(shape, a) {
  switch (shape) {
    case 'torus': return new THREE.TorusGeometry(a[0], a[1], 8, 40, Number.isFinite(a[2]) ? a[2] : Math.PI * 2);
    case 'octahedron': return new THREE.OctahedronGeometry(a[0], 0);
    case 'capsule': return new THREE.CapsuleGeometry(a[0], a[1], 4, 10);
    case 'sphere':
    default: return new THREE.SphereGeometry(a[0], 14, 10);
  }
}

export function createFormParts({ creature, form }) {
  const { parts, appearance } = creature;
  const calm = prefersReducedMotion();

  // Punkt über dem Kopf an der Stelle des Kristalls (eigener Anker, damit die Teile nicht mit dessen Schweben mitwackeln).
  const crystalAnchor = new THREE.Group();
  crystalAnchor.name = 'formCrystalAnchor';
  crystalAnchor.position.set(0, CRYSTAL_BASE_Y, 0);
  parts.head.add(crystalAnchor);
  const anchors = { head: parts.head, body: parts.body, crystal: crystalAnchor };

  let builtId = null;
  let items = [];     // { holder, mesh, def, side, base: { pos, rot } }
  let clock = 0;

  function colorHex(def, name) {
    const m = def && def.material;
    const fromForm = m && m[name] !== undefined ? m[name] : null;
    if (fromForm !== null) return fromForm;
    const fallback = { ring: 'accent', aura: 'accent' }[name] || name;   // Grundfarben kennen kein `ring`/`aura`
    return appearance[fallback] !== undefined ? appearance[fallback] : appearance.accent;
  }

  function clear() {
    for (const it of items) {
      it.holder.removeFromParent();
      it.mesh.geometry.dispose();
      it.mesh.material.dispose();
    }
    items = [];
  }

  function build(id) {
    clear();
    builtId = id;
    const def = id ? EVOLUTIONS[id] : null;
    const model = def && def.model;
    if (!model) return;
    for (const p of model) {
      for (const side of (p.mirror ? [1, -1] : [1])) {
        const hex = colorHex(def, p.color);
        const mat = new THREE.MeshStandardMaterial({
          color: hex, roughness: 0.4, metalness: 0.35,
          emissive: p.glow > 0 ? hex : 0x000000, emissiveIntensity: p.glow,
        });
        const mesh = new THREE.Mesh(makeGeometry(p.shape, p.args), mat);
        mesh.scale.set(p.scale[0], p.scale[1], p.scale[2]);
        mesh.name = 'formPart_' + id;
        const holder = new THREE.Group();
        holder.name = 'formHolder_' + id;
        const base = { pos: [p.pos[0] * side, p.pos[1], p.pos[2]], rot: [p.rot[0], p.rot[1] * side, p.rot[2] * side] };
        holder.position.set(base.pos[0], base.pos[1], base.pos[2]);
        holder.rotation.set(base.rot[0], base.rot[1], base.rot[2]);
        holder.scale.setScalar(MIN_SCALE);
        holder.visible = false;
        holder.add(mesh);
        (anchors[p.anchor] || anchors.head).add(holder);
        items.push({ holder, mesh, def: p, side, base });
      }
    }
  }

  function update(dt) {
    if (dt > 0) clock += Math.min(dt, 0.25);
    const id = form.getFormId();
    if (id !== builtId) build(id);
    if (!items.length) return;

    const share = form.getShare();
    const k = share > 0.01 ? Math.max(MIN_SCALE, ease(share)) : 0;
    for (const it of items) {
      const h = it.holder;
      h.visible = k > 0;
      if (k <= 0) continue;
      const m = it.def.motion;
      let scale = k;
      if (m && !calm) {
        const w = clock * m.rate + (m.phase || 0);
        if (m.type === 'sway') {
          h.rotation.z = it.base.rot[2] + it.side * m.amp * Math.sin(w);
        } else if (m.type === 'pulse') {
          scale = k * (1 + m.amp * Math.sin(w));
        } else if (m.type === 'orbit') {
          h.position.set(Math.cos(w) * m.radius, m.y || 0, Math.sin(w) * m.radius);
        }
      } else if (m && m.type === 'orbit') {
        const w = m.phase || 0;   // ruhig: bleibt an seinem Startplatz auf dem Ring stehen
        h.position.set(Math.cos(w) * m.radius, m.y || 0, Math.sin(w) * m.radius);
      }
      h.scale.setScalar(scale);
    }
  }

  function dispose() {
    clear();
    crystalAnchor.removeFromParent();
    builtId = null;
  }

  return { update, getCount: () => items.length, getFormId: () => builtId, dispose };
}
