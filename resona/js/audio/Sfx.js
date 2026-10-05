/*
  Sfx – kleine prozedurale Kreaturlaute per Web Audio API (Phase 08).
  PLATZHALTER bis zum AudioSystem (Phase 42): keine Audiodateien, nur kurze Sinus-/Dreieckstöne.
  Läuft ohne Assets und offline. Der AudioContext wird erst beim ersten Abspielen angelegt, also
  nach einer Spielereingabe (Browser erlauben Ton erst nach Interaktion). Fehlt Web Audio oder
  schlägt etwas fehl, passiert nichts (kein Fehler, nur kein Ton).

  Laute (leise, weich, jedes Mal minimal anders in der Tonhöhe):
    curious    zwei aufsteigende Töne („hm?")
    happy      drei kurze, hüpfende Töne
    surprised  kurzer, hoher Piepser, der nach unten gleitet
    content    tiefes, warmes Summen mit leichtem Vibrato
    munch      drei weiche, tiefe Knabbertöne (Phase 11, Fressen)
    yawn       langsam absinkender, weicher Ton (Phase 15, Hinlegen und Aufwachen)
    sigh       sehr leiser, tiefer Atemlaut (Phase 15, im Schlaf)
    splash     vier kurze, weiche Blubbertöne (Phase 16, Waschen beginnt)
    fresh      zwei helle, aufsteigende Töne (Phase 16, frisch gewaschen)
    pop        kurzes, weiches Aufploppen (Phase 18, Spielzeug erscheint)
    bounce     kurzer, tiefer Hüpfer mit leisem Nachklang (Phase 18, Leuchtball)
    tick       zwei winzige, helle Klicks (Phase 18, schwebender Würfel)
    whirr      leises, schwebendes Surren (Phase 18, Mini-Drohne)
    chime      zwei weiche, klare Glockentöne (Phase 18, Kristall)
    resonate   langer, leicht schwebender Doppelton (Phase 18, Resonanzring)
    hum        leises, warmes Summen (Phase 25, das Ei wird gewärmt)
    hatch      drei aufsteigende Glockentöne (Phase 25, Reson schlüpft)

  Phase 25: `setPitch(f)` verschiebt alle Laute mit der Stimmlage der Lebensstufe (Baby höher, erwachsen 1).

  Werte in CONFIG.sfx. NICHT im Browser getestet, Klang nicht beurteilt.

  createSfx() -> { play(name), setMuted(bool), isMuted(), setPitch(f), dispose() }
*/
import { CONFIG } from '../config.js';
import { createRng } from '../core/rng.js';

export function createSfx({ seed = 8808 } = {}) {
  const cfg = CONFIG.sfx;
  const rng = createRng(seed);
  let ctx = null;
  let master = null;
  let muted = !cfg.enabled;
  let failed = false;
  let pitchScale = 1;      // Phase 25: Stimmlage der Lebensstufe

  function ensure() {
    if (failed) return false;
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { failed = true; return false; }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = cfg.volume;
        master.connect(ctx.destination);
      } catch (_) {
        failed = true;
        ctx = null;
        return false;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }

  /** Ein Ton mit weicher Hüllkurve. freq2 != freq gleitet exponentiell. */
  function tone({ freq, freq2 = freq, start = 0, dur = 0.15, type = 'sine', gain = 0.5, vibrato = 0 }) {
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freq2 !== freq) osc.frequency.exponentialRampToValueAtTime(freq2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    if (vibrato > 0) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 5.5;
      lfoGain.gain.value = vibrato;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  const SOUNDS = {
    curious: (p) => {
      tone({ freq: 520 * p, freq2: 780 * p, dur: 0.14, gain: 0.45 });
      tone({ freq: 700 * p, freq2: 930 * p, start: 0.13, dur: 0.17, gain: 0.4 });
    },
    happy: (p) => {
      tone({ freq: 660 * p, dur: 0.09, type: 'triangle', gain: 0.45 });
      tone({ freq: 880 * p, start: 0.1, dur: 0.09, type: 'triangle', gain: 0.45 });
      tone({ freq: 1100 * p, start: 0.2, dur: 0.14, type: 'triangle', gain: 0.4 });
    },
    surprised: (p) => {
      tone({ freq: 1250 * p, freq2: 720 * p, dur: 0.13, type: 'triangle', gain: 0.4 });
    },
    munch: (p) => {
      for (let i = 0; i < 3; i++) tone({ freq: 190 * p, freq2: 120 * p, start: i * 0.2, dur: 0.1, type: 'triangle', gain: 0.35 });
    },
    yawn: (p) => {
      tone({ freq: 340 * p, freq2: 190 * p, dur: 0.95, gain: 0.35, vibrato: 3 });
      tone({ freq: 510 * p, freq2: 285 * p, start: 0.05, dur: 0.8, gain: 0.1, vibrato: 2 });
    },
    sigh: (p) => {
      tone({ freq: 150 * p, freq2: 110 * p, dur: 1.2, gain: 0.14 });
    },
    splash: (p) => {
      for (let i = 0; i < 4; i++) tone({ freq: (300 + i * 70) * p, freq2: (460 + i * 90) * p, start: i * 0.11, dur: 0.1, gain: 0.22 });
    },
    fresh: (p) => {
      tone({ freq: 740 * p, freq2: 880 * p, dur: 0.16, type: 'triangle', gain: 0.35 });
      tone({ freq: 990 * p, freq2: 1180 * p, start: 0.14, dur: 0.22, type: 'triangle', gain: 0.3 });
    },
    pop: (p) => {
      tone({ freq: 420 * p, freq2: 760 * p, dur: 0.12, gain: 0.3 });
    },
    bounce: (p) => {
      tone({ freq: 300 * p, freq2: 180 * p, dur: 0.09, type: 'triangle', gain: 0.35 });
      tone({ freq: 520 * p, freq2: 330 * p, start: 0.1, dur: 0.07, type: 'triangle', gain: 0.2 });
    },
    tick: (p) => {
      tone({ freq: 880 * p, dur: 0.05, gain: 0.22 });
      tone({ freq: 1180 * p, start: 0.08, dur: 0.05, gain: 0.2 });
    },
    whirr: (p) => {
      tone({ freq: 180 * p, freq2: 260 * p, dur: 0.6, type: 'triangle', gain: 0.12, vibrato: 14 });
    },
    chime: (p) => {
      tone({ freq: 880 * p, dur: 0.5, gain: 0.25 });
      tone({ freq: 1320 * p, start: 0.08, dur: 0.45, gain: 0.12 });
    },
    resonate: (p) => {
      tone({ freq: 330 * p, dur: 1.2, gain: 0.22, vibrato: 3 });
      tone({ freq: 335 * p, dur: 1.2, gain: 0.22 });
      tone({ freq: 660 * p, start: 0.05, dur: 1.0, gain: 0.08 });
    },
    content: (p) => {
      tone({ freq: 220 * p, freq2: 262 * p, dur: 0.55, gain: 0.5, vibrato: 5 });
      tone({ freq: 330 * p, freq2: 392 * p, start: 0.06, dur: 0.45, gain: 0.16, vibrato: 4 });
    },
    hum: (p) => {
      tone({ freq: 196 * p, freq2: 208 * p, dur: 0.9, gain: 0.3, vibrato: 4 });
      tone({ freq: 294 * p, start: 0.04, dur: 0.7, gain: 0.1, vibrato: 3 });
    },
    hatch: (p) => {
      tone({ freq: 660 * p, dur: 0.5, gain: 0.25 });
      tone({ freq: 880 * p, start: 0.16, dur: 0.5, gain: 0.22 });
      tone({ freq: 1320 * p, start: 0.32, dur: 0.6, gain: 0.2 });
      tone({ freq: 1760 * p, start: 0.34, dur: 0.5, gain: 0.07 });
    },
  };

  function play(name) {
    if (muted || !SOUNDS[name]) return false;
    if (!ensure()) return false;
    try {
      SOUNDS[name](pitchScale * (1 + (rng() - 0.5) * 0.12));   // Tonhöhe ±6 %, damit nichts exakt gleich klingt, mal Stimmlage der Stufe
      return true;
    } catch (_) {
      return false;
    }
  }

  function setMuted(on) { muted = !!on; }
  function isMuted() { return muted; }

  /** Phase 25: Stimmlage der Lebensstufe (1 = erwachsen, höher = jünger), begrenzt auf 0,5 bis 2. */
  function setPitch(f) { pitchScale = Number.isFinite(f) ? Math.min(2, Math.max(0.5, f)) : 1; }

  function dispose() {
    if (ctx) ctx.close().catch(() => {});
    ctx = null;
    master = null;
  }

  return { play, setMuted, isMuted, setPitch, dispose };
}
