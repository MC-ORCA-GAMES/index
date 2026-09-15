// VIC-II (6569 PAL). Scanline-genauer Renderer:
// Rastersplits, Hardware-Scrolling, alle fuenf Grafikmodi, 8 Sprites,
// Kollisionsregister und Raster-Interrupts.

export const PALETTE = [
  0x000000, 0xffffff, 0x813338, 0x75cec8, 0x8e3c97, 0x56ac4d, 0x2e2c9b, 0xedf171,
  0x8e5029, 0x553800, 0xc46c71, 0x4a4a4a, 0x7b7b7b, 0xa9ff9f, 0x706deb, 0xb2b2b2,
];

export const SCREEN_W = 384;
export const SCREEN_H = 272;
const FIRST_LINE = 16;          // erste im Fenster sichtbare Rasterzeile
const DISPLAY_X = 32;           // linker Rand des 320px-Bereichs im Fenster
const LINES = 312;              // PAL

function abgr(rgb) {
  return 0xff000000 | ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff);
}
const RGBA = PALETTE.map(abgr);

export class VICII {
  constructor(mem, cpu) {
    this.mem = mem; this.cpu = cpu;
    this.reg = new Uint8Array(0x40);
    this.framebuffer = new Uint32Array(SCREEN_W * SCREEN_H);
    this.spriteX = new Uint16Array(8);
    this.spriteY = new Uint8Array(8);
    this.rasterY = 0;
    this.rasterCmp = 0;
    this.irqFlags = 0; this.irqMask = 0;
    this.lineFg = new Uint8Array(SCREEN_W);   // Vordergrundmaske fuer Kollisionen
    this.lineSprite = new Uint8Array(SCREEN_W);
    this.frameDone = false;
    this.reset();
  }

  reset() {
    this.reg.fill(0);
    this.reg[0x11] = 0x1b; this.reg[0x16] = 0xc8; this.reg[0x18] = 0x14;
    this.reg[0x20] = 14; this.reg[0x21] = 6;
    this.reg[0x22] = 1; this.reg[0x23] = 2; this.reg[0x24] = 3;
    this.reg[0x25] = 4; this.reg[0x26] = 0;
    for (let i = 0; i < 8; i++) this.reg[0x27 + i] = [1, 2, 3, 4, 5, 6, 7, 12][i];
    this.rasterY = 0; this.irqFlags = 0; this.irqMask = 0;
    this.framebuffer.fill(RGBA[0]);
  }

  get yscroll() { return this.reg[0x11] & 7; }
  get xscroll() { return this.reg[0x16] & 7; }
  get rsel() { return (this.reg[0x11] >> 3) & 1; }
  get csel() { return (this.reg[0x16] >> 3) & 1; }
  get den() { return (this.reg[0x11] >> 4) & 1; }
  get bmm() { return (this.reg[0x11] >> 5) & 1; }
  get ecm() { return (this.reg[0x11] >> 6) & 1; }
  get mcm() { return (this.reg[0x16] >> 4) & 1; }
  get videoBase() { return ((this.reg[0x18] >> 4) & 0x0f) << 10; }
  get charBase() { return ((this.reg[0x18] >> 1) & 0x07) << 11; }
  get bitmapBase() { return ((this.reg[0x18] >> 3) & 1) << 13; }

  read(r) {
    switch (r) {
      case 0x11: return (this.reg[0x11] & 0x7f) | ((this.rasterY >> 1) & 0x80);
      case 0x12: return this.rasterY & 0xff;
      case 0x13: case 0x14: return this.reg[r];
      case 0x19: return this.irqFlags | 0x70 | (this.irqFlags & this.irqMask & 0x0f ? 0x80 : 0);
      case 0x1a: return this.irqMask | 0xf0;
      case 0x1e: { const v = this.reg[0x1e]; this.reg[0x1e] = 0; return v; }
      case 0x1f: { const v = this.reg[0x1f]; this.reg[0x1f] = 0; return v; }
      default:
        if (r >= 0x20 && r <= 0x2e) return this.reg[r] | 0xf0;
        if (r >= 0x2f) return 0xff;
        return this.reg[r];
    }
  }

  write(r, v) {
    this.reg[r] = v;
    if (r < 0x10) {
      if (r & 1) this.spriteY[r >> 1] = v;
      else this.spriteX[r >> 1] = (this.spriteX[r >> 1] & 0x100) | v;
    } else if (r === 0x10) {
      for (let i = 0; i < 8; i++)
        this.spriteX[i] = (this.spriteX[i] & 0xff) | (((v >> i) & 1) << 8);
    } else if (r === 0x11) {
      this.rasterCmp = (this.rasterCmp & 0xff) | ((v & 0x80) << 1);
    } else if (r === 0x12) {
      this.rasterCmp = (this.rasterCmp & 0x100) | v;
    } else if (r === 0x18) {
      this.mem.vicBank = this.mem.vicBank; // Bank kommt aus CIA2
    } else if (r === 0x19) {
      this.irqFlags &= ~(v & 0x0f);
      this.updateIRQ();
    } else if (r === 0x1a) {
      this.irqMask = v & 0x0f;
      this.updateIRQ();
    }
  }

  updateIRQ() {
    this.cpu.setIRQ(1, (this.irqFlags & this.irqMask & 0x0f) !== 0);
  }
  raiseIRQ(bit) {
    this.irqFlags |= bit;
    this.updateIRQ();
  }

  // Eine komplette Rasterzeile emulieren (Aufruf am Zeilenende).
  lineStart() {
    if (this.rasterY === this.rasterCmp) this.raiseIRQ(1);
  }

  endLine() {
    this.renderLine(this.rasterY);
    this.rasterY++;
    if (this.rasterY >= LINES) {
      this.rasterY = 0;
      this.frameDone = true;
    }
    this.lineStart();
  }

  renderLine(y) {
    const wy = y - FIRST_LINE;
    if (wy < 0 || wy >= SCREEN_H) return;
    const fb = this.framebuffer;
    const off = wy * SCREEN_W;
    const border = RGBA[this.reg[0x20] & 15];
    const fg = this.lineFg; const sp = this.lineSprite;
    fg.fill(0); sp.fill(0xff);

    // Hintergrund/Grafik
    const rowTop = this.rsel ? 51 : 55;
    const rowBot = this.rsel ? 250 : 246;
    const inRows = y >= rowTop && y <= rowBot && this.den;

    const bg0 = RGBA[this.reg[0x21] & 15];
    for (let i = 0; i < SCREEN_W; i++) fb[off + i] = bg0;

    if (inRows) this.renderGraphics(y, off);
    this.renderSprites(y, off);

    // Rahmen zeichnen (ueberdeckt alles)
    const left = DISPLAY_X - (this.csel ? 0 : -7);
    const right = DISPLAY_X + 320 + (this.csel ? 0 : -9);
    const topEdge = this.rsel ? 51 : 55;
    const botEdge = this.rsel ? 250 : 246;
    if (y < topEdge || y > botEdge) {
      for (let i = 0; i < SCREEN_W; i++) fb[off + i] = border;
    } else {
      for (let i = 0; i < left; i++) fb[off + i] = border;
      for (let i = right; i < SCREEN_W; i++) fb[off + i] = border;
    }
  }

  renderGraphics(y, off) {
    const fb = this.framebuffer;
    const ry = y - 48 - this.yscroll;
    const row = ry >> 3, sub = ry & 7;
    if (row < 0 || row > 24) return;

    const vm = this.videoBase;
    const bmm = this.bmm, ecm = this.ecm, mcm = this.mcm;
    const cb = this.charBase, bb = this.bitmapBase;
    const bg = [this.reg[0x21] & 15, this.reg[0x22] & 15, this.reg[0x23] & 15, this.reg[0x24] & 15];
    const xs = this.xscroll;

    for (let col = 0; col < 40; col++) {
      const vmOff = row * 40 + col;
      const ch = this.mem.vicRead(vm + vmOff);
      const color = this.mem.colorRam[vmOff & 0x3ff] & 0x0f;
      let bits, c0, c1, c2, c3, multi = false;

      if (bmm) {
        bits = this.mem.vicRead(bb + row * 320 + col * 8 + sub);
        if (mcm) {
          multi = true;
          c0 = bg[0]; c1 = (ch >> 4) & 15; c2 = ch & 15; c3 = color;
        } else {
          c0 = ch & 15; c1 = (ch >> 4) & 15;
        }
      } else {
        let cc = ch;
        if (ecm) cc = ch & 0x3f;
        bits = this.mem.vicRead(cb + cc * 8 + sub);
        if (mcm && (color & 8)) {
          multi = true;
          c0 = bg[0]; c1 = bg[1]; c2 = bg[2]; c3 = color & 7;
        } else {
          c0 = ecm ? bg[(ch >> 6) & 3] : bg[0];
          c1 = color;
        }
      }

      const base = DISPLAY_X + col * 8 + xs;
      if (multi) {
        for (let p = 0; p < 4; p++) {
          const two = (bits >> (6 - p * 2)) & 3;
          const ci = two === 0 ? c0 : two === 1 ? c1 : two === 2 ? c2 : c3;
          const px = base + p * 2;
          const solid = two >= 2 ? 1 : 0;
          for (let k = 0; k < 2; k++) {
            const xx = px + k;
            if (xx >= 0 && xx < 384) { fb[off + xx] = RGBA[ci]; this.lineFg[xx] = solid; }
          }
        }
      } else {
        for (let p = 0; p < 8; p++) {
          const bit = (bits >> (7 - p)) & 1;
          const xx = base + p;
          if (xx >= 0 && xx < 384) {
            fb[off + xx] = RGBA[bit ? c1 : c0];
            this.lineFg[xx] = bit;
          }
        }
      }
    }
  }

  renderSprites(y, off) {
    const fb = this.framebuffer;
    const enable = this.reg[0x15];
    if (!enable) return;
    const vm = this.videoBase;
    const mcFlag = this.reg[0x1c], expX = this.reg[0x1d], expY = this.reg[0x17];
    const prio = this.reg[0x1b];
    const mc0 = this.reg[0x25] & 15, mc1 = this.reg[0x26] & 15;
    let hitData = 0, hitSprite = 0;

    for (let n = 7; n >= 0; n--) {
      if (!((enable >> n) & 1)) continue;
      const sy = this.spriteY[n];
      const h = ((expY >> n) & 1) ? 42 : 21;
      let dy = y - sy;
      if (dy < 0 || dy >= h) continue;
      if ((expY >> n) & 1) dy >>= 1;

      const ptr = this.mem.vicRead(vm + 0x3f8 + n);
      const dataBase = ptr * 64 + dy * 3;
      const sx = this.spriteX[n] + DISPLAY_X - 24;
      const wide = (expX >> n) & 1;
      const isMc = (mcFlag >> n) & 1;
      const col = this.reg[0x27 + n] & 15;
      const behind = (prio >> n) & 1;

      for (let b = 0; b < 3; b++) {
        const byte = this.mem.vicRead(dataBase + b);
        if (isMc) {
          for (let p = 0; p < 4; p++) {
            const two = (byte >> (6 - p * 2)) & 3;
            if (!two) continue;
            const ci = two === 1 ? mc0 : two === 2 ? col : mc1;
            const w = wide ? 4 : 2;
            const px = sx + (b * 8 + p * 2) * (wide ? 2 : 1);
            this.plotSprite(off, px, w, ci, n, behind, () => { hitData |= 1 << n; },
              (o) => { hitSprite |= (1 << n) | (1 << o); });
          }
        } else {
          for (let p = 0; p < 8; p++) {
            if (!((byte >> (7 - p)) & 1)) continue;
            const w = wide ? 2 : 1;
            const px = sx + (b * 8 + p) * (wide ? 2 : 1);
            this.plotSprite(off, px, w, col, n, behind, () => { hitData |= 1 << n; },
              (o) => { hitSprite |= (1 << n) | (1 << o); });
          }
        }
      }
    }

    if (hitData) {
      const before = this.reg[0x1f];
      this.reg[0x1f] |= hitData;
      if (!before && this.reg[0x1f]) this.raiseIRQ(2);
    }
    if (hitSprite) {
      const before = this.reg[0x1e];
      this.reg[0x1e] |= hitSprite;
      if (!before && this.reg[0x1e]) this.raiseIRQ(4);
    }
  }

  plotSprite(off, px, w, ci, n, behind, onData, onSprite) {
    const fb = this.framebuffer;
    for (let k = 0; k < w; k++) {
      const xx = px + k;
      if (xx < 0 || xx >= SCREEN_W) continue;
      if (this.lineFg[xx]) onData();
      if (this.lineSprite[xx] !== 0xff && this.lineSprite[xx] !== n) onSprite(this.lineSprite[xx]);
      if (this.lineSprite[xx] === 0xff) {
        this.lineSprite[xx] = n;
        if (!(behind && this.lineFg[xx])) fb[off + xx] = RGBA[ci];
      }
    }
  }

  saveState() {
    return { reg: this.reg.slice(), rasterY: this.rasterY, rasterCmp: this.rasterCmp,
      irqFlags: this.irqFlags, irqMask: this.irqMask,
      spriteX: this.spriteX.slice(), spriteY: this.spriteY.slice() };
  }
  loadState(o) {
    this.reg.set(o.reg); this.rasterY = o.rasterY; this.rasterCmp = o.rasterCmp;
    this.irqFlags = o.irqFlags; this.irqMask = o.irqMask;
    this.spriteX.set(o.spriteX); this.spriteY.set(o.spriteY);
  }
}
