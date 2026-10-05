/*
  Engine – Renderer, Szene, Kamera, Hauptschleife.
  Verantwortlich NUR für die technische Grundlage. Inhalte (Habitat, Kreatur ...)
  werden von außen über engine.scene.add(...) und engine.addUpdater(...) angehängt.
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Engine {
  constructor(container) {
    this.container = container;
    this.updaters = new Set();
    this.resizeListeners = new Set();
    this.running = false;
    this.elapsed = 0;
    this._raf = 0;
    this._last = 0;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: CONFIG.render.antialias, alpha: false });
    } catch (err) {
      const e = new Error('WebGL ist auf diesem Gerät oder Browser nicht verfügbar.');
      e.cause = err;
      throw e;
    }
    this.renderer = renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = CONFIG.render.toneMappingExposure;
    renderer.shadowMap.enabled = CONFIG.render.shadows;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Dreidimensionale Ansicht des RESONA-Habitats');
    container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.colors.bg);
    this.scene.fog = new THREE.FogExp2(CONFIG.colors.bg, CONFIG.render.fogDensity);

    const c = CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, 1, c.near, c.far);

    this._tick = this._tick.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
    this._onContextLost = (e) => { e.preventDefault(); this.stop(); };
    this._onContextRestored = () => { this.resize(); this.start(); };

    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(container);
    document.addEventListener('visibilitychange', this._onVisibility);
    canvas.addEventListener('webglcontextlost', this._onContextLost);
    canvas.addEventListener('webglcontextrestored', this._onContextRestored);

    this.resize();
  }

  get aspect() { return this.camera.aspect; }

  /** fn({ width, height, aspect }) wird bei jeder Größenänderung aufgerufen. */
  onResize(fn) {
    this.resizeListeners.add(fn);
    return () => this.resizeListeners.delete(fn);
  }

  /** fn(dt, elapsed) wird jeden Frame aufgerufen. dt in Sekunden (max. 0.1). */
  addUpdater(fn) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const info = { width, height, aspect: this.camera.aspect };
    for (const fn of this.resizeListeners) fn(info);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  _tick(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);
    const dt = Math.min((now - this._last) / 1000, 0.1);
    this._last = now;
    this.elapsed += dt;
    for (const fn of this.updaters) fn(dt, this.elapsed);
    this.renderer.render(this.scene, this.camera);
  }

  _onVisibility() {
    if (document.hidden) this.stop();
    else this.start();
  }

  dispose() {
    this.stop();
    this._resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this._onVisibility);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this._onContextLost);
    canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      const m = obj.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
    });
    this.renderer.dispose();
    canvas.remove();
  }
}
