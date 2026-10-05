/*
  CameraRig – Kamera um das Habitat (Phase 04).
  Steuerung: Ziehen = Orbit, Pinch / Mausrad = Zoom, Pfeiltasten und +/- (optional),
  Doppelklick oder R = Ansicht zurücksetzen. Polarwinkel und Abstand sind begrenzt.
  Der Blickpunkt bleibt fest (CONFIG.camera.target); Verschieben ist bewusst nicht vorgesehen.
  Eigene Pointer-Events-Steuerung statt OrbitControls: keine zusätzliche Datei in vendor/,
  und die Grenzen hängen am Seitenverhältnis (fit).
  Ein kurzes Tippen ohne Ziehen wird über onTap() gemeldet (Grundlage für Phase 08).
  Werte stammen aus CONFIG.camera.controls und sind NICHT im Browser getestet.
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { prefersReducedMotion } from '../core/env.js';

const { MathUtils } = THREE;
const LINE_HEIGHT_PX = 16;      // Mausrad im Zeilenmodus -> Pixel
const WHEEL_ZOOM_RATE = 0.0015; // Zoomfaktor pro Wheel-Pixel (exponentiell)
const KEY_ZOOM_FACTOR = 0.9;

export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} domElement  Element, das die Eingaben empfängt (Canvas)
   */
  constructor(camera, domElement) {
    const c = CONFIG.camera;
    const k = c.controls;
    this.camera = camera;
    this.dom = domElement;
    this.target = new THREE.Vector3(...c.target);

    // Grenzen
    this.minDistance = k.minDistance;
    this.maxDistance = Math.max(k.maxDistance, k.minDistance);
    this.minPolar = MathUtils.degToRad(k.minPolarDeg);
    this.maxPolar = MathUtils.degToRad(k.maxPolarDeg);
    this.minAzimuth = k.minAzimuthDeg == null ? -Infinity : MathUtils.degToRad(k.minAzimuthDeg);
    this.maxAzimuth = k.maxAzimuthDeg == null ? Infinity : MathUtils.degToRad(k.maxAzimuthDeg);

    // Startansicht aus der Konfiguration (Kugelkoordinaten um den Blickpunkt)
    const offset = new THREE.Vector3(...c.position).sub(this.target);
    const s = new THREE.Spherical().setFromVector3(offset);
    this.baseDistance = s.radius;
    this.defaultPolar = MathUtils.clamp(s.phi, this.minPolar, this.maxPolar);
    this.defaultAzimuth = MathUtils.clamp(s.theta, this.minAzimuth, this.maxAzimuth);
    this.defaultDistance = MathUtils.clamp(s.radius, this.minDistance, this.maxDistance);

    // Aktueller und Ziel-Zustand (Ziel wird von der Eingabe verändert, aktuell läuft nach)
    this.theta = this.targetTheta = this.defaultAzimuth;
    this.phi = this.targetPhi = this.defaultPolar;
    this.distance = this.targetDistance = this.defaultDistance;
    this._userZoomed = false;

    this._calm = prefersReducedMotion();
    this._offset = new THREE.Vector3();
    this._pointers = new Map();     // pointerId -> { x, y }
    this._pinchDist = 0;
    this._tap = null;
    this._tapListeners = new Set();

    this._bind();
    this._apply();
  }

  /** fn({ x, y, event }) bei kurzem Tippen ohne Ziehen (Client-Koordinaten). Liefert Abmelde-Funktion. */
  onTap(fn) {
    this._tapListeners.add(fn);
    return () => this._tapListeners.delete(fn);
  }

  /** Bei jeder Größenänderung aufrufen: berechnet den Standardabstand, damit das Habitat ins Bild passt. */
  fit(aspect) {
    const c = CONFIG.camera;
    const vHalf = MathUtils.degToRad(c.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const fitDistance = c.fitHalfWidth / Math.tan(hHalf);
    const wanted = Math.min(Math.max(this.baseDistance, fitDistance), c.maxDistance);
    this.defaultDistance = MathUtils.clamp(wanted, this.minDistance, this.maxDistance);
    if (!this._userZoomed) {
      this.targetDistance = this.defaultDistance;
      if (!this._booted) this.distance = this.defaultDistance;   // erster Aufruf: ohne Nachlauf
    } else {
      this.targetDistance = MathUtils.clamp(this.targetDistance, this.minDistance, this.maxDistance);
    }
    this._booted = true;
    this._apply();
  }

  /** Zurück zur Standardansicht. */
  resetView() {
    this.targetTheta = this.defaultAzimuth;
    this.targetPhi = this.defaultPolar;
    this.targetDistance = this.defaultDistance;
    this._userZoomed = false;
  }

  /** Pro Frame aufrufen (engine.addUpdater). */
  update(dt) {
    const k = this._calm ? 1 : 1 - Math.exp(-dt * CONFIG.camera.controls.damping);
    this.theta += (this.targetTheta - this.theta) * k;
    this.phi += (this.targetPhi - this.phi) * k;
    this.distance += (this.targetDistance - this.distance) * k;
    this._apply();
  }

  dispose() {
    const d = this.dom;
    d.removeEventListener('pointerdown', this._onDown);
    d.removeEventListener('pointermove', this._onMove);
    d.removeEventListener('pointerup', this._onUp);
    d.removeEventListener('pointercancel', this._onUp);
    d.removeEventListener('lostpointercapture', this._onLost);
    d.removeEventListener('wheel', this._onWheel);
    d.removeEventListener('dblclick', this._onDblClick);
    d.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('blur', this._onBlur);
    this._pointers.clear();
    this._tapListeners.clear();
  }

  // ---------- intern ----------

  _apply() {
    this._offset.setFromSphericalCoords(this.distance, this.phi, this.theta);
    this.camera.position.copy(this.target).add(this._offset);
    this.camera.lookAt(this.target);
  }

  _bind() {
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onLost = this._onLost.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onDblClick = () => this.resetView();
    this._onContextMenu = (e) => e.preventDefault();
    this._onKey = this._onKey.bind(this);
    this._onBlur = () => { this._pointers.clear(); this._pinchDist = 0; this._tap = null; this._setCursor(false); };

    const d = this.dom;
    d.style.touchAction = 'none';
    d.style.cursor = 'grab';
    d.addEventListener('pointerdown', this._onDown);
    d.addEventListener('pointermove', this._onMove);
    d.addEventListener('pointerup', this._onUp);
    d.addEventListener('pointercancel', this._onUp);
    d.addEventListener('lostpointercapture', this._onLost);
    d.addEventListener('wheel', this._onWheel, { passive: false });
    d.addEventListener('dblclick', this._onDblClick);
    d.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('blur', this._onBlur);
  }

  _setCursor(grabbing) {
    this.dom.style.cursor = grabbing ? 'grabbing' : 'grab';
  }

  _rotate(dx, dy) {
    const h = Math.max(1, this.dom.clientHeight);
    const k = (Math.PI * CONFIG.camera.controls.rotateSpeed) / h;
    this._rotateBy(-dx * k, -dy * k);
  }

  _rotateBy(dTheta, dPhi) {
    this.targetTheta = MathUtils.clamp(this.targetTheta + dTheta, this.minAzimuth, this.maxAzimuth);
    this.targetPhi = MathUtils.clamp(this.targetPhi + dPhi, this.minPolar, this.maxPolar);
  }

  /** factor < 1 = näher heran, > 1 = weiter weg. */
  _zoomBy(factor) {
    if (!(factor > 0) || !isFinite(factor)) return;
    this.targetDistance = MathUtils.clamp(this.targetDistance * factor, this.minDistance, this.maxDistance);
    this._userZoomed = true;
  }

  _pinchDistance() {
    const pts = [...this._pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  _onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { this.dom.setPointerCapture(e.pointerId); } catch (_) { /* nicht kritisch */ }
    if (this._pointers.size === 1) {
      this._tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    } else {
      this._tap = null;
      this._pinchDist = this._pinchDistance();
    }
    this._setCursor(true);
  }

  _onMove(e) {
    const p = this._pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this._pointers.size === 1) {
      if (this._tap && Math.hypot(e.clientX - this._tap.x, e.clientY - this._tap.y) > CONFIG.camera.controls.tapMaxMovePx) {
        this._tap = null;
      }
      this._rotate(dx, dy);
    } else if (this._pointers.size === 2) {
      const d = this._pinchDistance();
      if (this._pinchDist > 0 && d > 0) {
        this._zoomBy((this._pinchDist / d) / CONFIG.camera.controls.zoomSpeed);
      }
      this._pinchDist = d;
    }
  }

  _onUp(e) {
    if (!this._pointers.has(e.pointerId)) return;
    const tap = this._tap;
    this._pointers.delete(e.pointerId);
    try { this.dom.releasePointerCapture(e.pointerId); } catch (_) { /* nicht kritisch */ }
    if (this._pointers.size < 2) this._pinchDist = 0;
    if (this._pointers.size === 0) this._setCursor(false);

    if (e.type === 'pointerup' && tap && tap.id === e.pointerId &&
        performance.now() - tap.t <= CONFIG.camera.controls.tapMaxMs) {
      for (const fn of this._tapListeners) fn({ x: e.clientX, y: e.clientY, event: e });
    }
    this._tap = null;
  }

  _onLost(e) {
    // Capture verloren (z. B. Systemgeste): Zeiger vergessen, kein Tippen melden.
    if (this._pointers.delete(e.pointerId)) {
      if (this._pointers.size < 2) this._pinchDist = 0;
      if (this._pointers.size === 0) this._setCursor(false);
      this._tap = null;
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? LINE_HEIGHT_PX : e.deltaMode === 2 ? this.dom.clientHeight : 1;
    const delta = e.deltaY * unit;
    this._zoomBy(Math.exp(delta * WHEEL_ZOOM_RATE * CONFIG.camera.controls.zoomSpeed));
  }

  _onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const step = MathUtils.degToRad(CONFIG.camera.controls.keyRotateDeg);
    switch (e.key) {
      case 'ArrowLeft':  this._rotateBy(-step, 0); break;
      case 'ArrowRight': this._rotateBy(step, 0); break;
      case 'ArrowUp':    this._rotateBy(0, -step); break;
      case 'ArrowDown':  this._rotateBy(0, step); break;
      case '+': case '=': this._zoomBy(KEY_ZOOM_FACTOR); break;
      case '-': case '_': this._zoomBy(1 / KEY_ZOOM_FACTOR); break;
      case 'r': case 'R': case 'Home': this.resetView(); break;
      default: return;
    }
    e.preventDefault();
  }
}
