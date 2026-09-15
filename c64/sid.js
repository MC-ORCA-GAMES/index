// MOS 6581 SID. Oszillatoren und Huellkurven laufen mit CPU-Takt,
// das Multimode-Filter arbeitet auf Samplerate (guter Kompromiss aus
// Klangtreue und Rechenaufwand im Browser).

const RATE = [9, 32, 63, 95, 149, 220, 267, 313, 392, 977, 1954, 3907, 7813, 15625, 19531, 31250];

class Voice {
  constructor() {
    this.freq = 0; this.pw = 0; this.ctrl = 0;
    this.attack = 0; this.decay = 0; this.sustain = 0; this.release = 0;
    this.acc = 0; this.noise = 0x7ffff8; this.msbRising = false;
    this.env = 0; this.state = 'rel'; this.expCount = 0; this.rateCount = 0;
    this.out = 0;
  }
  gate(on) {
    if (on && this.state === 'rel') { this.state = 'atk'; this.rateCount = 0; }
    else if (!on && this.state !== 'rel') { this.state = 'rel'; this.rateCount = 0; }
  }
  clockEnv() {
    const period = RATE[this.state === 'atk' ? this.attack : this.state === 'dec' ? this.decay : this.release];
    if (++this.rateCount < period) return;
    this.rateCount = 0;
    if (this.state === 'atk') {
      if (++this.env >= 0xff) { this.env = 0xff; this.state = 'dec'; }
      this.expCount = 0;
      return;
    }
    // Exponentielle Annaeherung fuer Decay/Release
    let div = 1;
    const e = this.env;
    if (e <= 0x06) div = 30; else if (e <= 0x0e) div = 16; else if (e <= 0x1a) div = 8;
    else if (e <= 0x36) div = 4; else if (e <= 0x5d) div = 2;
    if (++this.expCount < div) return;
    this.expCount = 0;
    if (this.state === 'dec') {
      const sus = this.sustain * 0x11;
      if (this.env > sus) this.env--;
    } else if (this.env > 0) this.env--;
  }
  clockOsc(prev) {
    const before = this.acc;
    if (this.ctrl & 0x08) { this.acc = 0; this.noise = 0x7ffff8; return; } // TEST
    if ((this.ctrl & 0x02) && (prev.msbRising)) this.acc = 0;              // SYNC
    this.acc = (this.acc + this.freq) & 0xffffff;
    this.msbRising = !(before & 0x800000) && !!(this.acc & 0x800000);
    if (!(before & 0x080000) && (this.acc & 0x080000)) {
      const n = this.noise;
      const bit = (((n >> 22) ^ (n >> 17)) & 1);
      this.noise = ((n << 1) | bit) & 0x7fffff;
    }
  }
  output(prev) {
    const w = (this.ctrl >> 4) & 0x0f;
    if (!w) return 0;
    let v = 0xfff;
    if (w & 1) { // Dreieck
      let a = this.acc;
      if (this.ctrl & 0x04) a ^= prev.acc & 0x800000; // Ringmodulation
      const t = (a & 0x800000) ? ~a : a;
      v &= (t >> 11) & 0xfff;
    }
    if (w & 2) v &= (this.acc >> 12) & 0xfff;                      // Saegezahn
    if (w & 4) v &= ((this.acc >> 12) >= this.pw ? 0xfff : 0x000); // Rechteck
    if (w & 8) {                                                    // Rauschen
      const n = this.noise;
      v &= (((n >> 11) & 0x800) | ((n >> 10) & 0x400) | ((n >> 7) & 0x200) | ((n >> 5) & 0x100) |
            ((n >> 4) & 0x080) | ((n >> 1) & 0x040) | ((n << 1) & 0x020) | ((n << 2) & 0x010)) & 0xfff;
    }
    return (v - 0x800) * this.env;
  }
}

export class SID {
  constructor(clockRate = 985248, sampleRate = 44100) {
    this.clockRate = clockRate;
    this.sampleRate = sampleRate;
    this.voices = [new Voice(), new Voice(), new Voice()];
    this.reg = new Uint8Array(32);
    this.fc = 0; this.res = 0; this.filt = 0; this.mode = 0; this.vol = 15;
    this.lp = 0; this.bp = 0; this.hp = 0;
    this.accFiltered = 0; this.accDirect = 0; this.accCount = 0;
    this.sampleAcc = 0;
    this.buffer = new Float32Array(1 << 16);
    this.wpos = 0; this.rpos = 0;
    this.enabled = true;
    this.potX = 0xff; this.potY = 0xff;
  }

  reset() {
    this.reg.fill(0);
    this.voices = [new Voice(), new Voice(), new Voice()];
    this.lp = this.bp = this.hp = 0;
    this.vol = 15; this.fc = 0; this.res = 0; this.filt = 0; this.mode = 0;
    this.wpos = this.rpos = 0;
  }

  write(r, v) {
    this.reg[r] = v;
    const n = (r / 7) | 0;
    const vo = this.voices[n];
    switch (r) {
      case 0: case 7: case 14: vo.freq = (vo.freq & 0xff00) | v; break;
      case 1: case 8: case 15: vo.freq = (vo.freq & 0xff) | (v << 8); break;
      case 2: case 9: case 16: vo.pw = (vo.pw & 0xf00) | v; break;
      case 3: case 10: case 17: vo.pw = (vo.pw & 0xff) | ((v & 0x0f) << 8); break;
      case 4: case 11: case 18: vo.gate(!!(v & 1)); vo.ctrl = v; break;
      case 5: case 12: case 19: vo.attack = v >> 4; vo.decay = v & 15; break;
      case 6: case 13: case 20: vo.sustain = v >> 4; vo.release = v & 15; break;
      case 21: this.fc = (this.fc & 0x7f8) | (v & 7); break;
      case 22: this.fc = (this.fc & 7) | (v << 3); break;
      case 23: this.res = v >> 4; this.filt = v & 0x0f; break;
      case 24: this.vol = v & 15; this.mode = (v >> 4) & 7; break;
    }
  }

  read(r) {
    switch (r) {
      case 25: return this.potX;
      case 26: return this.potY;
      case 27: return (this.voices[2].output(this.voices[1]) / (this.voices[2].env || 1) + 0x800) >> 4 & 0xff;
      case 28: return this.voices[2].env & 0xff;
      default: return 0x00;
    }
  }

  clock(cycles) {
    const v = this.voices;
    const step = this.clockRate / this.sampleRate;
    for (let i = 0; i < cycles; i++) {
      v[0].clockOsc(v[2]); v[1].clockOsc(v[0]); v[2].clockOsc(v[1]);
      v[0].clockEnv(); v[1].clockEnv(); v[2].clockEnv();
      const o0 = v[0].output(v[2]), o1 = v[1].output(v[0]), o2 = v[2].output(v[1]);
      let f = 0, d = 0;
      if (this.filt & 1) f += o0; else d += o0;
      if (this.filt & 2) f += o1; else d += o1;
      if (this.filt & 4) f += o2; else d += o2;
      if (!(this.mode & 8) || !(this.filt & 8)) d += 0;
      this.accFiltered += f; this.accDirect += d; this.accCount++;

      this.sampleAcc += 1;
      if (this.sampleAcc >= step) {
        this.sampleAcc -= step;
        this.emit();
      }
    }
  }

  emit() {
    const c = this.accCount || 1;
    const inF = this.accFiltered / c / (0xfff * 0xff);
    const inD = this.accDirect / c / (0xfff * 0xff);
    this.accFiltered = this.accDirect = 0; this.accCount = 0;

    // Zweipoliges State-Variable-Filter
    const fcHz = 30 + (this.fc / 2047) * 11000;
    let w = 2 * Math.sin(Math.PI * Math.min(fcHz, this.sampleRate * 0.45) / this.sampleRate);
    const q = 1.4 - (this.res / 15) * 1.35;
    this.hp = inF - this.lp - q * this.bp;
    this.bp += w * this.hp;
    this.lp += w * this.bp;
    let f = 0;
    if (this.mode & 1) f += this.lp;
    if (this.mode & 2) f += this.bp;
    if (this.mode & 4) f += this.hp;

    let out = (inD + f) * (this.vol / 15) * 0.4;
    if (out > 1) out = 1; else if (out < -1) out = -1;
    this.buffer[this.wpos & 0xffff] = out;
    this.wpos++;
  }

  available() { return this.wpos - this.rpos; }
  readSamples(out) {
    const n = out.length;
    for (let i = 0; i < n; i++) {
      if (this.rpos < this.wpos) out[i] = this.buffer[this.rpos++ & 0xffff];
      else out[i] = this.buffer[(this.wpos - 1) & 0xffff] * 0.98; // Unterlauf abfedern
    }
    if (this.wpos - this.rpos > 8192) this.rpos = this.wpos - 4096; // Latenz begrenzen
  }

  saveState() { return { reg: this.reg.slice() }; }
  loadState(o) { for (let i = 0; i < 25; i++) this.write(i, o.reg[i]); }
}
