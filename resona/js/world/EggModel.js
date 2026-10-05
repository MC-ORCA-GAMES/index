/*
  EggModel – das „Resonanz-Ei“ der Eistufe (Phase 25).
  Reiner Aufbau aus Three.js-Primitiven (keine Modelldatei), im Stil der Kreatur: dunkle Schale, goldene Bänder, ein leuchtender
  oranger Kern (wie Resons Brustkern), kleine türkise Zeichen und ein kleiner schwebender Kristall darüber. Das Ei schwebt knapp
  über dem Boden. Aussehen aus `CONFIG.creature.appearance`, damit es zur Kreatur passt (Farbentwicklung Phase 29 kann dasselbe Objekt übergeben).

  Konventionen: Ursprung der Gruppe = Boden unter dem Ei (y = 0), Höhe ca. 0,85 Einheiten bei scale 1, Kern und Zeichen zeigen nach +z (zur Kamera).

  Was es tut (alles in `update`):
    Herzschlag   Kern und Schale pulsieren, der Takt wird mit dem Fortschritt schneller (3,0 s -> 1,3 s je Schlag)
    Wiegen       leichtes Wackeln und Schweben; Antippen (`poke()`) bringt es als gedämpfte Feder zum Schaukeln
    Schlüpfen    `hatch` 0..1 (Übergang der Lebenszyklus-Logik): Beben wird stärker, Kern, Schale und Hof leuchten auf
    Platzen      `startBurst()`: die Schale verschwindet, ein heller Blitz und eine Welle auf dem Boden klingen aus (`isBursting()`)
  „Reduzierte Bewegung“ (`calm`): kein Schweben, Wackeln und Beben nur schwach, Herzschlag und Leuchten bleiben.

  Dieses Modul kennt keine Spiellogik. Sichtbarkeit, Antippen und Zusammenspiel mit der Kreatur: js/creature/Growth.js.
  Die Form ist nicht visuell geprüft (keine Laufzeittests), alle Werte sind Startwerte.

  createEggModel(appearance) -> { group, update(dt, t, { progress, hatch, calm }), poke(), startBurst(), isBursting(), reset(), getHit(), dispose() }
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createBlobShadow } from '../creature/CreatureModel.js';

const TAU = Math.PI * 2;
const EGG_H = 0.85;                  // Höhe der Schale bei scale 1
const BASE_FLOAT = 0.06;             // Schwebehöhe über dem Boden
const BURST_FLASH_SEC = 0.55;
const BURST_WAVE_SEC = 1.0;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, u) => a + (b - a) * u;

/** Eiförmige Schale als Drehkörper (Profil: Radius, Höhe), unten bei 0, Spitze bei EGG_H. */
function createShellGeometry() {
  const profile = [
    [0.0, 0.0], [0.17, 0.015], [0.31, 0.1], [0.39, 0.26], [0.395, 0.42], [0.33, 0.6], [0.2, 0.76], [0.07, 0.84], [0.0, EGG_H],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const smooth = new THREE.SplineCurve(profile).getPoints(30)
    .map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return new THREE.LatheGeometry(smooth, 36);
}

function glow(color, intensity, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0, ...extra });
}

function additive(color, opacity, extra = {}) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, ...extra,
  });
}

export function createEggModel(appearance = CONFIG.creature.appearance) {
  const a = appearance;
  const group = new THREE.Group();
  group.name = 'egg';

  const mats = {
    shell: new THREE.MeshStandardMaterial({ color: a.body, roughness: 0.38, metalness: 0.3, emissive: a.crystal, emissiveIntensity: 0.12 }),
    band: new THREE.MeshStandardMaterial({ color: a.accent, emissive: a.accent, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.6 }),
    core: glow(a.core, 1.2),
    glyph: glow(a.crystal, 1.2),
    crystal: glow(a.crystal, 1.5),
    halo: additive(a.core, 0.06),
    flash: additive(0xfff1d0, 0),
    wave: additive(a.core, 0, { side: THREE.DoubleSide }),
  };
  const base = { core: mats.core.emissiveIntensity, shell: mats.shell.emissiveIntensity, halo: mats.halo.opacity, glyph: mats.glyph.emissiveIntensity };

  // Körper-Pivot: schwebt und wackelt (Drehpunkt am Boden des Eis).
  const body = new THREE.Group();
  body.name = 'eggBody';
  group.add(body);

  const shellParts = new THREE.Group();   // alles, was beim Platzen verschwindet
  shellParts.name = 'eggShell';
  body.add(shellParts);

  shellParts.add(new THREE.Mesh(createShellGeometry(), mats.shell));

  for (const [y, r] of [[0.26, 0.396], [0.6, 0.338]]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 8, 56), mats.band);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    shellParts.add(band);
  }

  // Kern vorn (wie Resons Brustkern) mit Ring
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), mats.core);
  core.position.set(0, 0.43, 0.385);
  shellParts.add(core);
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 8, 40), mats.band);
  coreRing.position.set(0, 0.43, 0.372);
  shellParts.add(coreRing);

  // Fünf kleine Zeichen um die Schale (Winkel von vorn, Grad)
  const glyphs = [];
  for (const deg of [-65, 65, -115, 115, 180]) {
    const th = (deg * Math.PI) / 180;
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), mats.glyph);
    g.position.set(Math.sin(th) * 0.396, 0.43, Math.cos(th) * 0.396);
    shellParts.add(g);
    glyphs.push(g);
  }

  // Kleiner Kristall, der über dem Ei schwebt
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), mats.crystal);
  crystal.scale.y = 1.6;
  crystal.position.y = EGG_H + 0.26;
  shellParts.add(crystal);

  // Weicher Hof (additiv, sehr schwach)
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), mats.halo);
  halo.position.y = 0.43;
  shellParts.add(halo);

  // Schatten am Boden (wie bei der Kreatur)
  const shadow = createBlobShadow(CONFIG.creature.blobShadowOpacity);
  group.add(shadow);

  // Platz-Effekt: Blitz (Kugel) und Welle auf dem Boden
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), mats.flash);
  flash.position.y = 0.43;
  flash.visible = false;
  group.add(flash);
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.52, 48), mats.wave);
  wave.rotation.x = -Math.PI / 2;
  wave.position.y = 0.025;
  wave.visible = false;
  group.add(wave);

  // ---------- Zustand ----------
  let phase = 0;            // Herzschlag-Phase
  let pokeX = 0;            // Feder fürs Antippen (Winkel, rad)
  let pokeV = 0;
  let scale = 0.88;         // aktuelle Eigröße (wächst mit dem Fortschritt)
  let floatY = BASE_FLOAT;
  let burst = null;         // { t } während des Platzens, sonst null

  function poke() { pokeV += 1.6; }

  function startBurst() {
    burst = { t: 0 };
    shellParts.visible = false;
    flash.visible = true;
    wave.visible = true;
    shadow.visible = false;
  }

  const isBursting = () => burst !== null;

  /** Zurück in den Ausgangszustand (Ei sichtbar, kein Platzen, Materialien in Ruhe). */
  function reset() {
    burst = null;
    pokeX = 0;
    pokeV = 0;
    shellParts.visible = true;
    flash.visible = false;
    wave.visible = false;
    shadow.visible = true;
    mats.flash.opacity = 0;
    mats.wave.opacity = 0;
    body.rotation.set(0, 0, 0);
  }

  /** Trefferkugel zum Antippen: Mitte über dem Boden und Radius (Welteinheiten, großzügig für Touch). */
  function getHit() {
    return { centerY: floatY + 0.45 * scale, radius: Math.max(0.7, 0.62 * scale) };
  }

  function updateBurst(dt) {
    burst.t += dt;
    const f = clamp01(burst.t / BURST_FLASH_SEC);
    flash.scale.setScalar(lerp(0.7, 2.3, f));
    mats.flash.opacity = 0.9 * (1 - f) * (1 - f);
    const w = clamp01(burst.t / BURST_WAVE_SEC);
    wave.scale.setScalar(lerp(1, 4.2, w));
    mats.wave.opacity = 0.7 * (1 - w);
    if (burst.t >= Math.max(BURST_FLASH_SEC, BURST_WAVE_SEC)) {
      flash.visible = false;
      wave.visible = false;
      burst = null;
      // `shellParts` bleibt unsichtbar, bis `reset()` es zurückholt; Growth blendet die ganze Gruppe aus.
    }
  }

  /**
   * dt in Sekunden, t = Laufzeit. progress = Fortschritt der Eistufe 0..1, hatch = Schlüpf-Übergang 0..1 (sonst 0),
   * calm = „reduzierte Bewegung“.
   */
  function update(dt, t, { progress = 0, hatch = 0, calm = false } = {}) {
    const d = Math.min(dt, 0.05);   // die Feder bleibt bei kleinen Schritten stabil

    if (burst) updateBurst(d);
    if (!shellParts.visible) return;

    // Eigröße wächst leicht mit dem Fortschritt
    scale = lerp(0.88, 1.1, clamp01(progress));
    body.scale.setScalar(scale);

    // Herzschlag: schneller mit dem Fortschritt
    const period = lerp(3.0, 1.3, clamp01(progress));
    phase += (d * TAU) / period;
    const beat = Math.pow(Math.max(0, Math.sin(phase)), 8);
    const h = clamp01(hatch);
    const hk = h * h;

    mats.core.emissiveIntensity = base.core * (1 + 0.55 * beat + 2.6 * hk);
    mats.shell.emissiveIntensity = base.shell * (1 + 1.5 * beat) + 0.5 * hk;
    mats.halo.opacity = base.halo * (1 + 1.2 * beat) + 0.22 * hk;
    mats.glyph.emissiveIntensity = base.glyph * (1 + 0.7 * beat + hk);
    for (let i = 0; i < glyphs.length; i++) glyphs[i].scale.setScalar(1 + 0.25 * beat * (1 + (i % 2) * 0.3));

    // Feder fürs Antippen (gedämpft)
    pokeV += (-70 * pokeX - 6 * pokeV) * d;
    pokeX += pokeV * d;

    // Wiegen, Schweben, Beben beim Schlüpfen
    const calmK = calm ? 0.35 : 1;
    const sway = 0.03 * calmK * Math.sin(t * 0.9);
    const shake = (0.02 + 0.2 * hk) * (calm ? 0.4 : 1) * Math.sin(t * 26) * h;
    body.rotation.z = sway + pokeX + shake;
    body.rotation.x = 0.012 * calmK * Math.sin(t * 0.63 + 1) + 0.5 * shake * Math.cos(t * 19);
    floatY = BASE_FLOAT + (calm ? 0 : 0.025 * Math.sin(t * 1.3));
    body.position.y = floatY;
    shadow.scale.setScalar(1.1 - (floatY - BASE_FLOAT) * 2);

    // Kristall und Ringe
    if (!calm) {
      crystal.rotation.y += d * 0.7;
      crystal.position.y = EGG_H + 0.26 + 0.018 * Math.sin(t * 1.6 + 1);
    }
  }

  function dispose() {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of Object.values(mats)) m.dispose();
    if (shadow.material.map) shadow.material.map.dispose();
    shadow.material.dispose();
  }

  return { group, update, poke, startBurst, isBursting, reset, getHit, dispose };
}
