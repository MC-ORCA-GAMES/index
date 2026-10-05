/*
  SparkField – die 3D-Szene des Minispiels „Lichtfunken“ (Phase 22). Zeichnet den Funken in der Kuppel und prüft Tipps im Bild.
  Die Logik (Bahn, Treffer-Stufen, Punkte) steht in js/systems/SkillGameSystem.js; hier wird nur gezeichnet und der Tipp in einen
  `offset` übersetzt (Abstand des Tipps vom Funkenmittelpunkt in Funkenradien) und an `game.tap(offset)` gegeben.

  Aufbau aus Three.js-Primitiven (kein Asset, offline, wie die Kreatur und die Spielzeuge):
    Funke       leuchtender Kern (Kugel) und weicher Hof (größere, durchscheinende Kugel, additiv)
    Tiefenhilfe Ring am Boden unter dem Funken und ein dünner Strich vom Boden zum Funken (damit man seine Höhe im Bild lesen kann)
    Effekt      bei einem Treffer weitet sich eine durchscheinende Kugel in der Farbe der Stufe aus und verblasst (0,5 s)
  Nicht nur Farbe/Bewegung: ein ablaufender Funke schrumpft in den letzten 25 % seiner Zeit, ein erscheinender wächst in 0,25 s ein. Bei
  „reduzierte Bewegung“ (`game.getState().calm`) pulsiert nichts, der Effekt weitet sich nicht aus, er verblasst nur.

  Tippen: über `rig.onTap` (kurzes Tippen ohne Ziehen, Client-Koordinaten); Ziehen und Pinch bewegen weiter die Kamera. Der Strahl durch den Tipp
  wird gegen die aktuelle Funkenposition geprüft (Abstand Strahl–Mittelpunkt / Funkenradius). Daneben tippen ist nur ein Fehltipp, ohne Abzug.
  Die Trefferfläche (`SKILL.hitOffset` Funkenradien, 1,7) ist bewusst größer als der sichtbare Funke, damit Touch verzeiht.

  createSparkField({ scene, camera, dom, rig, game }) -> { update(dt, t), isActive(), dispose() }
    scene/camera/dom: Szene, Kamera und Canvas der Engine; rig: CameraRig (`onTap`); game: createSkillGameSystem(...) (braucht `getSpark`, `getState`,
    `tap`, `isPlaying`, `onEvent`).
    isActive(): läuft gerade ein Lichtfunken-Spiel (main.js nutzt es, damit ein Doppelklick auf einen Funken die Kamera nicht zurücksetzt)
  Werte in js/data/minigames.js (SKILL), Farben und Größen der Effekte unten (Startwerte). NICHT im Browser getestet (Größe, Helligkeit, Lesbarkeit
  des Funkens vor dem Hintergrund, Trefferfläche auf dem Handy sind Annahmen).
*/
import * as THREE from 'three';
import { SKILL } from '../data/minigames.js';

const CORE_COLOR = 0xffd35a;
const HALO_COLOR = 0xff9a3c;
const FLOOR_COLOR = 0xffd35a;
const BURST_COLORS = { great: 0xffd35a, good: 0x21c7b8, ok: 0xa9b4ff };
const GROW_SEC = 0.25;        // Einwachsen beim Erscheinen
const SHRINK_FROM = 0.25;     // ab diesem Restanteil der Lebenszeit schrumpft der Funke (Ablauf lesbar)
const BURST_SEC = 0.5;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (u) => u * u * (3 - 2 * u);

export function createSparkField({ scene, camera, dom, rig, game }) {
  const R = SKILL.sparkRadius;
  const geos = [];
  const mats = [];
  const keep = (g, m) => { geos.push(g); mats.push(m); };

  const group = new THREE.Group();
  group.name = 'sparkField';
  group.visible = false;

  // ---------- Funke ----------
  const spark = new THREE.Group();
  const coreGeo = new THREE.SphereGeometry(R, 16, 12);
  const coreMat = new THREE.MeshBasicMaterial({ color: CORE_COLOR });
  const core = new THREE.Mesh(coreGeo, coreMat);
  keep(coreGeo, coreMat);
  const haloGeo = new THREE.SphereGeometry(R * 1.9, 16, 12);
  const haloMat = new THREE.MeshBasicMaterial({
    color: HALO_COLOR, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  keep(haloGeo, haloMat);
  spark.add(core, halo);
  spark.visible = false;
  group.add(spark);

  // ---------- Tiefenhilfe: Ring am Boden und Strich zum Funken ----------
  const ringGeo = new THREE.RingGeometry(R * 1.3, R * 1.65, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: FLOOR_COLOR, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  keep(ringGeo, ringMat);
  group.add(ring);

  const lineGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
  lineGeo.translate(0, 0.5, 0);   // Fußpunkt unten, so skaliert `scale.y` die Höhe
  const lineMat = new THREE.MeshBasicMaterial({ color: FLOOR_COLOR, transparent: true, opacity: 0.22, depthWrite: false });
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.visible = false;
  keep(lineGeo, lineMat);
  group.add(line);

  // ---------- Effekt bei einem Treffer ----------
  const burstGeo = new THREE.SphereGeometry(1, 16, 12);
  const burstMat = new THREE.MeshBasicMaterial({
    color: BURST_COLORS.great, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const burst = new THREE.Mesh(burstGeo, burstMat);
  burst.visible = false;
  keep(burstGeo, burstMat);
  group.add(burst);
  let burstT = -1;          // < 0 = aus, sonst Sekunden seit dem Start

  scene.add(group);

  // ---------- Tippen ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const point = new THREE.Vector3();

  function handleTap({ x, y }) {
    const s = game.getSpark();
    if (!s) return;
    const rect = dom.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    point.set(s.x, s.y, s.z);
    const offset = raycaster.ray.distanceToPoint(point) / R;
    game.tap(offset);
  }
  const offTap = rig.onTap(handleTap);

  // ---------- Ereignisse ----------
  const offGame = game.onEvent((e) => {
    if (e.type === 'feedback' && e.kind !== 'miss') {
      burstMat.color.setHex(BURST_COLORS[e.kind] || BURST_COLORS.ok);
      burst.position.set(e.x, e.y, e.z);
      burstT = 0;
    } else if (e.type === 'done' && !e.natural) {
      burstT = -1;   // vorzeitig beendet: nichts mehr zeigen
    }
  });

  // ---------- Frame ----------
  function update(dt, t) {
    const s = game.getSpark();
    const calm = game.getState().calm;

    if (s) {
      const grow = ease(clamp01(s.age / GROW_SEC));
      const shrink = s.k < SHRINK_FROM ? ease(clamp01(s.k / SHRINK_FROM)) : 1;
      const pulse = calm ? 1 : 1 + 0.08 * Math.sin(t * 8);
      const scale = Math.max(0.001, grow * shrink * pulse);
      spark.position.set(s.x, s.y, s.z);
      spark.scale.setScalar(scale);
      spark.visible = true;
      ring.position.set(s.x, 0.03, s.z);
      ring.scale.setScalar(Math.max(0.001, grow * shrink));
      ring.visible = true;
      line.position.set(s.x, 0, s.z);
      line.scale.set(1, Math.max(0.001, s.y), 1);
      line.visible = true;
    } else {
      spark.visible = false;
      ring.visible = false;
      line.visible = false;
    }

    if (burstT >= 0) {
      burstT += dt;
      const u = clamp01(burstT / BURST_SEC);
      if (u >= 1) {
        burstT = -1;
        burst.visible = false;
      } else {
        const size = calm ? R * 2 : R * (1.2 + 3 * ease(u));   // bei „reduzierte Bewegung“ keine Ausdehnung, nur Verblassen
        burst.scale.setScalar(size);
        burstMat.opacity = 0.5 * (1 - u);
        burst.visible = true;
      }
    }

    group.visible = spark.visible || burst.visible;
  }

  const isActive = () => game.isPlaying();

  function dispose() {
    offTap();
    offGame();
    scene.remove(group);
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
  }

  return { update, isActive, dispose };
}
