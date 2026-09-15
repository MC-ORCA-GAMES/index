// MOS 6510 / NMOS 6502 CPU core.
// Zyklengenau auf Instruktionsebene (inkl. Page-Cross- und Branch-Extrazyklen)
// und mit den gebraeuchlichen "illegalen" Opcodes, die viele C64-Spiele nutzen.

const CYC = [
  7,6,2,8,3,3,5,5,3,2,2,2,4,4,6,6, 2,5,2,8,4,4,6,6,2,4,2,7,4,4,7,7,
  6,6,2,8,3,3,5,5,4,2,2,2,4,4,6,6, 2,5,2,8,4,4,6,6,2,4,2,7,4,4,7,7,
  6,6,2,8,3,3,5,5,3,2,2,2,3,4,6,6, 2,5,2,8,4,4,6,6,2,4,2,7,4,4,7,7,
  6,6,2,8,3,3,5,5,4,2,2,2,5,4,6,6, 2,5,2,8,4,4,6,6,2,4,2,7,4,4,7,7,
  2,6,2,6,3,3,3,3,2,2,2,2,4,4,4,4, 2,6,2,6,4,4,4,4,2,5,2,5,5,5,5,5,
  2,6,2,6,3,3,3,3,2,2,2,2,4,4,4,4, 2,5,2,5,4,4,4,4,2,4,2,4,4,4,4,4,
  2,6,2,8,3,3,5,5,2,2,2,2,4,4,6,6, 2,5,2,8,4,4,6,6,2,4,2,7,4,4,7,7,
  2,6,2,8,3,3,5,5,2,2,2,2,4,4,6,6, 2,5,2,8,4,4,6,6,2,4,2,7,4,4,7,7,
];

export class CPU6510 {
  constructor(bus) {
    this.bus = bus;
    this.a = 0; this.x = 0; this.y = 0; this.s = 0xfd; this.pc = 0;
    this.c = 0; this.z = 1; this.i = 1; this.d = 0; this.v = 0; this.n = 0;
    this.irqLine = 0;      // Bitmaske aller IRQ-Quellen (VIC, CIA1, ...)
    this.nmiEdge = false;  // steigende Flanke der NMI-Leitung
    this.nmiLine = 0;
    this.cycles = 0;
    this.jammed = false;
  }

  reset() {
    this.s = 0xfd; this.i = 1; this.d = 0; this.jammed = false;
    this.pc = this.rd(0xfffc) | (this.rd(0xfffd) << 8);
  }

  rd(a) { return this.bus.read(a & 0xffff); }
  wr(a, v) { this.bus.write(a & 0xffff, v & 0xff); }
  rd16(a) { return this.rd(a) | (this.rd(a + 1) << 8); }

  getP(brk) {
    return (this.n ? 0x80 : 0) | (this.v ? 0x40 : 0) | 0x20 | (brk ? 0x10 : 0) |
           (this.d ? 8 : 0) | (this.i ? 4 : 0) | (this.z ? 2 : 0) | (this.c ? 1 : 0);
  }
  setP(v) {
    this.n = (v >> 7) & 1; this.v = (v >> 6) & 1; this.d = (v >> 3) & 1;
    this.i = (v >> 2) & 1; this.z = (v >> 1) & 1; this.c = v & 1;
  }

  push(v) { this.wr(0x100 + this.s, v); this.s = (this.s - 1) & 0xff; }
  pop() { this.s = (this.s + 1) & 0xff; return this.rd(0x100 + this.s); }

  setNZ(v) { this.z = (v & 0xff) === 0 ? 1 : 0; this.n = (v >> 7) & 1; return v & 0xff; }

  setIRQ(mask, on) {
    if (on) this.irqLine |= mask; else this.irqLine &= ~mask;
  }
  setNMI(mask, on) {
    const before = this.nmiLine;
    if (on) this.nmiLine |= mask; else this.nmiLine &= ~mask;
    if (!before && this.nmiLine) this.nmiEdge = true;
  }

  interrupt(vector, brk) {
    this.push((this.pc >> 8) & 0xff);
    this.push(this.pc & 0xff);
    this.push(this.getP(brk));
    this.i = 1;
    this.pc = this.rd16(vector);
    return 7;
  }

  // --- Adressierungsarten -------------------------------------------------
  aImm() { const a = this.pc; this.pc = (this.pc + 1) & 0xffff; return a; }
  aZp() { return this.rd(this.aImm()); }
  aZpX() { return (this.rd(this.aImm()) + this.x) & 0xff; }
  aZpY() { return (this.rd(this.aImm()) + this.y) & 0xff; }
  aAbs() { const a = this.rd16(this.pc); this.pc = (this.pc + 2) & 0xffff; return a; }
  aAbsX(pc) {
    const b = this.aAbs(), a = (b + this.x) & 0xffff;
    if (pc && (b & 0xff00) !== (a & 0xff00)) this.cycles++;
    return a;
  }
  aAbsY(pc) {
    const b = this.aAbs(), a = (b + this.y) & 0xffff;
    if (pc && (b & 0xff00) !== (a & 0xff00)) this.cycles++;
    return a;
  }
  aIndX() { const z = (this.rd(this.aImm()) + this.x) & 0xff; return this.rd(z) | (this.rd((z + 1) & 0xff) << 8); }
  aIndY(pc) {
    const z = this.rd(this.aImm());
    const b = this.rd(z) | (this.rd((z + 1) & 0xff) << 8);
    const a = (b + this.y) & 0xffff;
    if (pc && (b & 0xff00) !== (a & 0xff00)) this.cycles++;
    return a;
  }

  branch(cond) {
    const off = (this.rd(this.aImm()) << 24) >> 24;
    if (cond) {
      const t = (this.pc + off) & 0xffff;
      this.cycles += ((t & 0xff00) !== (this.pc & 0xff00)) ? 2 : 1;
      this.pc = t;
    }
  }

  // --- Kernoperationen ----------------------------------------------------
  adc(m) {
    if (this.d) {
      let lo = (this.a & 0x0f) + (m & 0x0f) + this.c;
      let hi = (this.a >> 4) + (m >> 4);
      if (lo > 9) { lo += 6; hi++; }
      const bin = this.a + m + this.c;
      this.z = (bin & 0xff) === 0 ? 1 : 0;
      this.n = (hi >> 3) & 1;
      this.v = ((~(this.a ^ m) & (this.a ^ (hi << 4)) & 0x80) !== 0) ? 1 : 0;
      if (hi > 9) hi += 6;
      this.c = hi > 15 ? 1 : 0;
      this.a = ((hi << 4) | (lo & 0x0f)) & 0xff;
    } else {
      const r = this.a + m + this.c;
      this.v = ((~(this.a ^ m) & (this.a ^ r) & 0x80) !== 0) ? 1 : 0;
      this.c = r > 0xff ? 1 : 0;
      this.a = this.setNZ(r);
    }
  }
  sbc(m) {
    if (this.d) {
      const r = this.a - m - (1 - this.c);
      let lo = (this.a & 0x0f) - (m & 0x0f) - (1 - this.c);
      let hi = (this.a >> 4) - (m >> 4);
      if (lo & 0x10) { lo -= 6; hi--; }
      if (hi & 0x10) hi -= 6;
      this.v = (((this.a ^ m) & (this.a ^ r) & 0x80) !== 0) ? 1 : 0;
      this.c = (r & 0x100) ? 0 : 1;
      this.setNZ(r & 0xff);
      this.a = ((hi << 4) | (lo & 0x0f)) & 0xff;
    } else {
      const r = this.a - m - (1 - this.c);
      this.v = (((this.a ^ m) & (this.a ^ r) & 0x80) !== 0) ? 1 : 0;
      this.c = (r & 0x100) ? 0 : 1;
      this.a = this.setNZ(r);
    }
  }
  cmp(r, m) { const t = r - m; this.c = t >= 0 ? 1 : 0; this.setNZ(t & 0xff); }
  aslV(v) { this.c = (v >> 7) & 1; return this.setNZ((v << 1) & 0xff); }
  lsrV(v) { this.c = v & 1; return this.setNZ(v >> 1); }
  rolV(v) { const c = this.c; this.c = (v >> 7) & 1; return this.setNZ(((v << 1) | c) & 0xff); }
  rorV(v) { const c = this.c; this.c = v & 1; return this.setNZ((v >> 1) | (c << 7)); }
  rmw(a, fn) { const v = this.rd(a); this.wr(a, v); this.wr(a, fn.call(this, v)); }

  step() {
    if (this.nmiEdge) { this.nmiEdge = false; return this.interrupt(0xfffa, false); }
    if (this.irqLine && !this.i) return this.interrupt(0xfffe, false);
    if (this.jammed) return 2;

    const op = this.rd(this.pc);
    this.pc = (this.pc + 1) & 0xffff;
    this.cycles = CYC[op];
    let a, v;

    switch (op) {
      // LDA
      case 0xa9: this.a = this.setNZ(this.rd(this.aImm())); break;
      case 0xa5: this.a = this.setNZ(this.rd(this.aZp())); break;
      case 0xb5: this.a = this.setNZ(this.rd(this.aZpX())); break;
      case 0xad: this.a = this.setNZ(this.rd(this.aAbs())); break;
      case 0xbd: this.a = this.setNZ(this.rd(this.aAbsX(1))); break;
      case 0xb9: this.a = this.setNZ(this.rd(this.aAbsY(1))); break;
      case 0xa1: this.a = this.setNZ(this.rd(this.aIndX())); break;
      case 0xb1: this.a = this.setNZ(this.rd(this.aIndY(1))); break;
      // LDX / LDY
      case 0xa2: this.x = this.setNZ(this.rd(this.aImm())); break;
      case 0xa6: this.x = this.setNZ(this.rd(this.aZp())); break;
      case 0xb6: this.x = this.setNZ(this.rd(this.aZpY())); break;
      case 0xae: this.x = this.setNZ(this.rd(this.aAbs())); break;
      case 0xbe: this.x = this.setNZ(this.rd(this.aAbsY(1))); break;
      case 0xa0: this.y = this.setNZ(this.rd(this.aImm())); break;
      case 0xa4: this.y = this.setNZ(this.rd(this.aZp())); break;
      case 0xb4: this.y = this.setNZ(this.rd(this.aZpX())); break;
      case 0xac: this.y = this.setNZ(this.rd(this.aAbs())); break;
      case 0xbc: this.y = this.setNZ(this.rd(this.aAbsX(1))); break;
      // STA / STX / STY
      case 0x85: this.wr(this.aZp(), this.a); break;
      case 0x95: this.wr(this.aZpX(), this.a); break;
      case 0x8d: this.wr(this.aAbs(), this.a); break;
      case 0x9d: this.wr(this.aAbsX(0), this.a); break;
      case 0x99: this.wr(this.aAbsY(0), this.a); break;
      case 0x81: this.wr(this.aIndX(), this.a); break;
      case 0x91: this.wr(this.aIndY(0), this.a); break;
      case 0x86: this.wr(this.aZp(), this.x); break;
      case 0x96: this.wr(this.aZpY(), this.x); break;
      case 0x8e: this.wr(this.aAbs(), this.x); break;
      case 0x84: this.wr(this.aZp(), this.y); break;
      case 0x94: this.wr(this.aZpX(), this.y); break;
      case 0x8c: this.wr(this.aAbs(), this.y); break;
      // Transfers
      case 0xaa: this.x = this.setNZ(this.a); break;
      case 0xa8: this.y = this.setNZ(this.a); break;
      case 0x8a: this.a = this.setNZ(this.x); break;
      case 0x98: this.a = this.setNZ(this.y); break;
      case 0xba: this.x = this.setNZ(this.s); break;
      case 0x9a: this.s = this.x; break;
      // Stack
      case 0x48: this.push(this.a); break;
      case 0x68: this.a = this.setNZ(this.pop()); break;
      case 0x08: this.push(this.getP(true)); break;
      case 0x28: this.setP(this.pop()); break;
      // Logik
      case 0x29: this.a = this.setNZ(this.a & this.rd(this.aImm())); break;
      case 0x25: this.a = this.setNZ(this.a & this.rd(this.aZp())); break;
      case 0x35: this.a = this.setNZ(this.a & this.rd(this.aZpX())); break;
      case 0x2d: this.a = this.setNZ(this.a & this.rd(this.aAbs())); break;
      case 0x3d: this.a = this.setNZ(this.a & this.rd(this.aAbsX(1))); break;
      case 0x39: this.a = this.setNZ(this.a & this.rd(this.aAbsY(1))); break;
      case 0x21: this.a = this.setNZ(this.a & this.rd(this.aIndX())); break;
      case 0x31: this.a = this.setNZ(this.a & this.rd(this.aIndY(1))); break;
      case 0x09: this.a = this.setNZ(this.a | this.rd(this.aImm())); break;
      case 0x05: this.a = this.setNZ(this.a | this.rd(this.aZp())); break;
      case 0x15: this.a = this.setNZ(this.a | this.rd(this.aZpX())); break;
      case 0x0d: this.a = this.setNZ(this.a | this.rd(this.aAbs())); break;
      case 0x1d: this.a = this.setNZ(this.a | this.rd(this.aAbsX(1))); break;
      case 0x19: this.a = this.setNZ(this.a | this.rd(this.aAbsY(1))); break;
      case 0x01: this.a = this.setNZ(this.a | this.rd(this.aIndX())); break;
      case 0x11: this.a = this.setNZ(this.a | this.rd(this.aIndY(1))); break;
      case 0x49: this.a = this.setNZ(this.a ^ this.rd(this.aImm())); break;
      case 0x45: this.a = this.setNZ(this.a ^ this.rd(this.aZp())); break;
      case 0x55: this.a = this.setNZ(this.a ^ this.rd(this.aZpX())); break;
      case 0x4d: this.a = this.setNZ(this.a ^ this.rd(this.aAbs())); break;
      case 0x5d: this.a = this.setNZ(this.a ^ this.rd(this.aAbsX(1))); break;
      case 0x59: this.a = this.setNZ(this.a ^ this.rd(this.aAbsY(1))); break;
      case 0x41: this.a = this.setNZ(this.a ^ this.rd(this.aIndX())); break;
      case 0x51: this.a = this.setNZ(this.a ^ this.rd(this.aIndY(1))); break;
      // BIT
      case 0x24: case 0x2c: {
        v = this.rd(op === 0x24 ? this.aZp() : this.aAbs());
        this.z = (this.a & v) === 0 ? 1 : 0; this.n = (v >> 7) & 1; this.v = (v >> 6) & 1;
        break;
      }
      // Arithmetik
      case 0x69: this.adc(this.rd(this.aImm())); break;
      case 0x65: this.adc(this.rd(this.aZp())); break;
      case 0x75: this.adc(this.rd(this.aZpX())); break;
      case 0x6d: this.adc(this.rd(this.aAbs())); break;
      case 0x7d: this.adc(this.rd(this.aAbsX(1))); break;
      case 0x79: this.adc(this.rd(this.aAbsY(1))); break;
      case 0x61: this.adc(this.rd(this.aIndX())); break;
      case 0x71: this.adc(this.rd(this.aIndY(1))); break;
      case 0xe9: case 0xeb: this.sbc(this.rd(this.aImm())); break;
      case 0xe5: this.sbc(this.rd(this.aZp())); break;
      case 0xf5: this.sbc(this.rd(this.aZpX())); break;
      case 0xed: this.sbc(this.rd(this.aAbs())); break;
      case 0xfd: this.sbc(this.rd(this.aAbsX(1))); break;
      case 0xf9: this.sbc(this.rd(this.aAbsY(1))); break;
      case 0xe1: this.sbc(this.rd(this.aIndX())); break;
      case 0xf1: this.sbc(this.rd(this.aIndY(1))); break;
      // Vergleiche
      case 0xc9: this.cmp(this.a, this.rd(this.aImm())); break;
      case 0xc5: this.cmp(this.a, this.rd(this.aZp())); break;
      case 0xd5: this.cmp(this.a, this.rd(this.aZpX())); break;
      case 0xcd: this.cmp(this.a, this.rd(this.aAbs())); break;
      case 0xdd: this.cmp(this.a, this.rd(this.aAbsX(1))); break;
      case 0xd9: this.cmp(this.a, this.rd(this.aAbsY(1))); break;
      case 0xc1: this.cmp(this.a, this.rd(this.aIndX())); break;
      case 0xd1: this.cmp(this.a, this.rd(this.aIndY(1))); break;
      case 0xe0: this.cmp(this.x, this.rd(this.aImm())); break;
      case 0xe4: this.cmp(this.x, this.rd(this.aZp())); break;
      case 0xec: this.cmp(this.x, this.rd(this.aAbs())); break;
      case 0xc0: this.cmp(this.y, this.rd(this.aImm())); break;
      case 0xc4: this.cmp(this.y, this.rd(this.aZp())); break;
      case 0xcc: this.cmp(this.y, this.rd(this.aAbs())); break;
      // INC / DEC
      case 0xe6: a = this.aZp(); this.wr(a, this.setNZ(this.rd(a) + 1)); break;
      case 0xf6: a = this.aZpX(); this.wr(a, this.setNZ(this.rd(a) + 1)); break;
      case 0xee: a = this.aAbs(); this.wr(a, this.setNZ(this.rd(a) + 1)); break;
      case 0xfe: a = this.aAbsX(0); this.wr(a, this.setNZ(this.rd(a) + 1)); break;
      case 0xc6: a = this.aZp(); this.wr(a, this.setNZ(this.rd(a) - 1)); break;
      case 0xd6: a = this.aZpX(); this.wr(a, this.setNZ(this.rd(a) - 1)); break;
      case 0xce: a = this.aAbs(); this.wr(a, this.setNZ(this.rd(a) - 1)); break;
      case 0xde: a = this.aAbsX(0); this.wr(a, this.setNZ(this.rd(a) - 1)); break;
      case 0xe8: this.x = this.setNZ(this.x + 1); break;
      case 0xc8: this.y = this.setNZ(this.y + 1); break;
      case 0xca: this.x = this.setNZ(this.x - 1); break;
      case 0x88: this.y = this.setNZ(this.y - 1); break;
      // Shifts
      case 0x0a: this.a = this.aslV(this.a); break;
      case 0x06: a = this.aZp(); this.wr(a, this.aslV(this.rd(a))); break;
      case 0x16: a = this.aZpX(); this.wr(a, this.aslV(this.rd(a))); break;
      case 0x0e: a = this.aAbs(); this.wr(a, this.aslV(this.rd(a))); break;
      case 0x1e: a = this.aAbsX(0); this.wr(a, this.aslV(this.rd(a))); break;
      case 0x4a: this.a = this.lsrV(this.a); break;
      case 0x46: a = this.aZp(); this.wr(a, this.lsrV(this.rd(a))); break;
      case 0x56: a = this.aZpX(); this.wr(a, this.lsrV(this.rd(a))); break;
      case 0x4e: a = this.aAbs(); this.wr(a, this.lsrV(this.rd(a))); break;
      case 0x5e: a = this.aAbsX(0); this.wr(a, this.lsrV(this.rd(a))); break;
      case 0x2a: this.a = this.rolV(this.a); break;
      case 0x26: a = this.aZp(); this.wr(a, this.rolV(this.rd(a))); break;
      case 0x36: a = this.aZpX(); this.wr(a, this.rolV(this.rd(a))); break;
      case 0x2e: a = this.aAbs(); this.wr(a, this.rolV(this.rd(a))); break;
      case 0x3e: a = this.aAbsX(0); this.wr(a, this.rolV(this.rd(a))); break;
      case 0x6a: this.a = this.rorV(this.a); break;
      case 0x66: a = this.aZp(); this.wr(a, this.rorV(this.rd(a))); break;
      case 0x76: a = this.aZpX(); this.wr(a, this.rorV(this.rd(a))); break;
      case 0x6e: a = this.aAbs(); this.wr(a, this.rorV(this.rd(a))); break;
      case 0x7e: a = this.aAbsX(0); this.wr(a, this.rorV(this.rd(a))); break;
      // Spruenge
      case 0x4c: this.pc = this.aAbs(); break;
      case 0x6c: {
        const p = this.aAbs();
        // NMOS-Bug: Seitenueberlauf beim indirekten Sprung
        this.pc = this.rd(p) | (this.rd((p & 0xff00) | ((p + 1) & 0xff)) << 8);
        break;
      }
      case 0x20: {
        const t = this.rd16(this.pc); this.pc = (this.pc + 1) & 0xffff;
        this.push((this.pc >> 8) & 0xff); this.push(this.pc & 0xff);
        this.pc = t; break;
      }
      case 0x60: this.pc = (this.pop() | (this.pop() << 8)) + 1 & 0xffff; break;
      case 0x40: this.setP(this.pop()); this.pc = this.pop() | (this.pop() << 8); break;
      case 0x00: this.pc = (this.pc + 1) & 0xffff; this.interrupt(0xfffe, true); break;
      // Branches
      case 0x10: this.branch(!this.n); break;
      case 0x30: this.branch(this.n); break;
      case 0x50: this.branch(!this.v); break;
      case 0x70: this.branch(this.v); break;
      case 0x90: this.branch(!this.c); break;
      case 0xb0: this.branch(this.c); break;
      case 0xd0: this.branch(!this.z); break;
      case 0xf0: this.branch(this.z); break;
      // Flags
      case 0x18: this.c = 0; break;
      case 0x38: this.c = 1; break;
      case 0x58: this.i = 0; break;
      case 0x78: this.i = 1; break;
      case 0xb8: this.v = 0; break;
      case 0xd8: this.d = 0; break;
      case 0xf8: this.d = 1; break;
      case 0xea: break;

      // --- Illegale Opcodes -------------------------------------------------
      case 0xa7: this.a = this.x = this.setNZ(this.rd(this.aZp())); break;          // LAX
      case 0xb7: this.a = this.x = this.setNZ(this.rd(this.aZpY())); break;
      case 0xaf: this.a = this.x = this.setNZ(this.rd(this.aAbs())); break;
      case 0xbf: this.a = this.x = this.setNZ(this.rd(this.aAbsY(1))); break;
      case 0xa3: this.a = this.x = this.setNZ(this.rd(this.aIndX())); break;
      case 0xb3: this.a = this.x = this.setNZ(this.rd(this.aIndY(1))); break;
      case 0x87: this.wr(this.aZp(), this.a & this.x); break;                        // SAX
      case 0x97: this.wr(this.aZpY(), this.a & this.x); break;
      case 0x8f: this.wr(this.aAbs(), this.a & this.x); break;
      case 0x83: this.wr(this.aIndX(), this.a & this.x); break;
      case 0xc7: case 0xd7: case 0xcf: case 0xdf: case 0xdb: case 0xc3: case 0xd3: { // DCP
        a = this.addrFor(op); v = (this.rd(a) - 1) & 0xff; this.wr(a, v); this.cmp(this.a, v); break;
      }
      case 0xe7: case 0xf7: case 0xef: case 0xff: case 0xfb: case 0xe3: case 0xf3: { // ISC
        a = this.addrFor(op); v = (this.rd(a) + 1) & 0xff; this.wr(a, v); this.sbc(v); break;
      }
      case 0x07: case 0x17: case 0x0f: case 0x1f: case 0x1b: case 0x03: case 0x13: { // SLO
        a = this.addrFor(op); v = this.aslV(this.rd(a)); this.wr(a, v); this.a = this.setNZ(this.a | v); break;
      }
      case 0x27: case 0x37: case 0x2f: case 0x3f: case 0x3b: case 0x23: case 0x33: { // RLA
        a = this.addrFor(op); v = this.rolV(this.rd(a)); this.wr(a, v); this.a = this.setNZ(this.a & v); break;
      }
      case 0x47: case 0x57: case 0x4f: case 0x5f: case 0x5b: case 0x43: case 0x53: { // SRE
        a = this.addrFor(op); v = this.lsrV(this.rd(a)); this.wr(a, v); this.a = this.setNZ(this.a ^ v); break;
      }
      case 0x67: case 0x77: case 0x6f: case 0x7f: case 0x7b: case 0x63: case 0x73: { // RRA
        a = this.addrFor(op); v = this.rorV(this.rd(a)); this.wr(a, v); this.adc(v); break;
      }
      case 0x0b: case 0x2b: this.a = this.setNZ(this.a & this.rd(this.aImm())); this.c = this.n; break; // ANC
      case 0x4b: this.a = this.a & this.rd(this.aImm()); this.a = this.lsrV(this.a); break;             // ALR
      case 0x6b: {                                                                                      // ARR
        this.a &= this.rd(this.aImm());
        this.a = ((this.a >> 1) | (this.c << 7)) & 0xff;
        this.setNZ(this.a);
        this.c = (this.a >> 6) & 1;
        this.v = (((this.a >> 6) ^ (this.a >> 5)) & 1);
        break;
      }
      case 0xcb: { const m = this.rd(this.aImm()); const t = (this.a & this.x) - m; this.c = t >= 0 ? 1 : 0; this.x = this.setNZ(t & 0xff); break; } // AXS
      case 0x9b: this.s = this.a & this.x; this.wr(this.aAbsY(0), this.s & 0xff); break; // TAS (Naeherung)
      case 0x9c: a = this.aAbsX(0); this.wr(a, this.y & (((a >> 8) + 1) & 0xff)); break; // SHY
      case 0x9e: a = this.aAbsY(0); this.wr(a, this.x & (((a >> 8) + 1) & 0xff)); break; // SHX
      case 0x9f: a = this.aAbsY(0); this.wr(a, this.a & this.x & (((a >> 8) + 1) & 0xff)); break; // AHX
      case 0x93: a = this.aIndY(0); this.wr(a, this.a & this.x & (((a >> 8) + 1) & 0xff)); break;
      case 0xbb: v = this.rd(this.aAbsY(1)) & this.s; this.a = this.x = this.s = this.setNZ(v); break; // LAS
      case 0xab: this.a = this.x = this.setNZ(this.rd(this.aImm())); break; // LAX #

      // NOPs mit Operanden
      case 0x1a: case 0x3a: case 0x5a: case 0x7a: case 0xda: case 0xfa: break;
      case 0x80: case 0x82: case 0x89: case 0xc2: case 0xe2: this.aImm(); break;
      case 0x04: case 0x44: case 0x64: this.aZp(); break;
      case 0x14: case 0x34: case 0x54: case 0x74: case 0xd4: case 0xf4: this.aZpX(); break;
      case 0x0c: this.aAbs(); break;
      case 0x1c: case 0x3c: case 0x5c: case 0x7c: case 0xdc: case 0xfc: this.aAbsX(1); break;

      default: // JAM / KIL
        this.jammed = true;
        this.pc = (this.pc - 1) & 0xffff;
        break;
    }
    return this.cycles;
  }

  // Adressberechnung fuer die Read-Modify-Write-Illegalen
  addrFor(op) {
    switch (op & 0x1f) {
      case 0x07: return this.aZp();
      case 0x17: return (op === 0x97 || op === 0xb7) ? this.aZpY() : this.aZpX();
      case 0x0f: return this.aAbs();
      case 0x1f: return this.aAbsX(0);
      case 0x1b: return this.aAbsY(0);
      case 0x03: return this.aIndX();
      case 0x13: return this.aIndY(0);
    }
    return this.aAbs();
  }

  saveState() {
    return { a: this.a, x: this.x, y: this.y, s: this.s, pc: this.pc,
      c: this.c, z: this.z, i: this.i, d: this.d, v: this.v, n: this.n,
      irqLine: this.irqLine, nmiLine: this.nmiLine, nmiEdge: this.nmiEdge, jammed: this.jammed };
  }
  loadState(o) { Object.assign(this, o); }
}
