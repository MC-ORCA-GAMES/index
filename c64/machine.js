// Der virtuelle C64: verbindet alle Bausteine und taktet sie rasterzeilengenau.

import { Memory } from '../memory/memory.js';
import { CPU6510 } from '../cpu/cpu6510.js';
import { VICII } from '../vic/vic2.js';
import { SID } from '../sid/sid.js';
import { CIA } from '../cia/cia.js';
import { buildCharRom } from '../vic/font.js';
import { Screen } from '../basic/screen.js';
import { Basic } from '../basic/basic.js';
import { buildShimRoms, installTraps } from './kernal-shim.js';
import { Drive1541 } from '../disk/drive1541.js';

export const CYCLES_PER_LINE = 63;
export const LINES_PER_FRAME = 312;
export const CLOCK = CYCLES_PER_LINE * LINES_PER_FRAME * 50.125; // ~985248 Hz

export class Machine {
  constructor(sampleRate = 44100) {
    this.mem = new Memory();
    this.cpu = new CPU6510(this.mem);
    this.vic = new VICII(this.mem, this.cpu);
    this.sid = new SID(CLOCK, sampleRate);
    this.cia1 = new CIA(this.cpu, 1);
    this.cia2 = new CIA(this.cpu, 2);
    this.mem.vic = this.vic; this.mem.sid = this.sid;
    this.mem.cia1 = this.cia1; this.mem.cia2 = this.cia2;
    this.cia2.onPortA = (v) => { this.mem.vicBank = (~v) & 3; };

    this.builtinCharRom = buildCharRom();
    const shim = buildShimRoms();
    this.shimKernal = shim.kernal;
    this.shimBasic = shim.basic;
    this.realRoms = { basic: null, kernal: null, char: null };

    this.screen = new Screen(this.mem);
    this.screen.vic = this.vic;
    this.basic = new Basic(this);
    this.drive = new Drive1541(this);

    this.SYS_RETURN = 0xfff5;
    this.traps = new Map();
    installTraps(this);
    this.alwaysTraps = new Set([0xffd5, 0xffd8, this.SYS_RETURN]);

    this.jiffies = 0;
    this.inSys = false;
    this.stopKeyDown = false;
    this.ioStatus = 0;
    this.fileName = ''; this.device = 8; this.secondary = 0; this.lfn = 0;
    this.outChannel = 0;
    this.frameCount = 0;
    this.paused = false;
    this.onMessage = null;

    this.applyRoms();
    this.reset(true);
  }

  get romMode() { return !!(this.realRoms.kernal && this.realRoms.basic); }

  applyRoms() {
    this.mem.kernalRom = this.realRoms.kernal || this.shimKernal;
    this.mem.basicRom = this.realRoms.basic || this.shimBasic;
    this.mem.charRom = this.realRoms.char || this.builtinCharRom;
  }

  setRom(kind, bytes) {
    if (kind === 'char' && bytes.length >= 4096) this.realRoms.char = bytes.slice(0, 4096);
    if (kind === 'kernal' && bytes.length >= 8192) this.realRoms.kernal = bytes.slice(-8192);
    if (kind === 'basic' && bytes.length >= 8192) this.realRoms.basic = bytes.slice(-8192);
    this.applyRoms();
  }

  reset(hard) {
    if (hard) this.mem.powerOnPattern();
    this.mem.dirPort = 0x2f; this.mem.dataPort = 0x37;
    this.vic.reset();
    this.sid.reset();
    this.cia1.reset(); this.cia2.reset();
    this.cia2.pra = 0xff; this.cia2.ddra = 0x3f;
    this.mem.vicBank = 0;
    this.cpu.reset();
    this.inSys = false;
    this.jiffies = 0;
    if (!this.romMode) {
      this.shimBoot(hard);
      // Ohne ROM laeuft die CPU in der Leerlaufschleife, BASIC arbeitet in JS
      if (!this.inSys) this.cpu.pc = 0xfce5;
    }
  }

  warmStart() {
    if (this.romMode) return;
    this.basic.state = 'ready';
    this.screen.printString('\rREADY.\r');
  }

  shimBoot(hard) {
    this.mem.ram[0x0288] = 0x04;
    this.mem.ram[0x0314] = 0x31; this.mem.ram[0x0315] = 0xea;
    this.mem.ram[0x0318] = 0x43; this.mem.ram[0x0319] = 0xfe;
    this.vic.reg[0x18] = 0x14;
    this.vic.reg[0x20] = 14; this.vic.reg[0x21] = 6;
    // Steckmodul mit CBM80-Signatur uebernimmt den Start
    const sig = [0xc3, 0xc2, 0xcd, 0x38, 0x30];
    if (this.mem.cartLo && sig.every((v, i) => this.mem.read(0x8004 + i) === v)) {
      this.cpu.pc = this.mem.read(0x8000) | (this.mem.read(0x8001) << 8);
      this.basic.state = 'ready';
      this.inSys = true;
      return;
    }
    if (hard) this.basic.newProgram();
    this.basic.bootMessage();
  }

  // ------------------------------------------------------------------ Timing
  runFrame() {
    if (this.paused) return;
    const cpu = this.cpu;
    // SID-Musik: einmal pro Frame die Play-Routine aufrufen
    if (this.sidTune && this.sidTune.active && !this.inSys && this.sidTune.play) this.sys(this.sidTune.play);
    for (let line = 0; line < LINES_PER_FRAME; line++) {
      let cyc = 0;
      while (cyc < CYCLES_PER_LINE) {
        const trap = this.traps.get(cpu.pc);
        if (trap && (!this.romMode || this.alwaysTraps.has(cpu.pc))) {
          const r = trap(cpu);
          if (r !== 'jump') cpu.pc = (cpu.pop() | (cpu.pop() << 8)) + 1 & 0xffff;
          cyc += 8;
        } else {
          cyc += cpu.step();
        }
      }
      this.cia1.tick(cyc);
      this.cia2.tick(cyc);
      this.sid.clock(cyc);
      if (this.tape) this.tape.tick(cyc);
      this.vic.endLine();
    }
    this.frameCount++;

    if (!this.romMode && !this.inSys) {
      if (this.basic.state === 'run') this.basic.slice(this.statementsPerFrame || 90);
      else if (this.basic.state === 'wait') this.checkWait();
      else if (this.basic.state === 'ready' || this.basic.state === 'input') {
        this.screen.tickCursor(Math.floor(this.frameCount / 15) % 2 === 0);
      }
    }
    this.jiffies++;
    const j = Math.floor(this.jiffies);
    this.mem.ram[0xa0] = (j >> 16) & 0xff;
    this.mem.ram[0xa1] = (j >> 8) & 0xff;
    this.mem.ram[0xa2] = j & 0xff;
  }

  checkWait() {
    const { a, msk, xor } = this.basic.waitArgs;
    if (((this.mem.read(a) ^ xor) & msk) !== 0) this.basic.state = this.basic.running ? 'run' : 'ready';
  }

  // ------------------------------------------------------------------ Eingabe
  typeKey(petscii) {
    if (this.romMode || this.inSys) { this.screen.keyPress(petscii); return; }
    this.basic.keyPress(petscii);
  }
  typeText(text) {
    for (const ch of text.replace(/\r?\n/g, '\r')) this.typeKey(ch.charCodeAt(0));
  }

  // ----------------------------------------------------------------- Ausgabe
  chrout(c) {
    if (this.outChannel >= 8) return;
    this.screen.print(c);
  }

  sys(addr) {
    this.cpu.pc = addr & 0xffff;
    const ret = (this.SYS_RETURN - 1) & 0xffff;
    this.cpu.push((ret >> 8) & 0xff);
    this.cpu.push(ret & 0xff);
    this.cpu.a = this.mem.ram[0x030c]; this.cpu.x = this.mem.ram[0x030d]; this.cpu.y = this.mem.ram[0x030e];
    this.cpu.jammed = false;
    this.inSys = true;
  }

  // ------------------------------------------------------------ LOAD / SAVE
  kernalLoad(name, addr, secondary) {
    const file = this.drive.findFile(name);
    if (!file) { this.message('FILE NOT FOUND'); return null; }
    return this.loadPRG(file.data, secondary === 0 ? addr : undefined);
  }

  kernalSave(name, start, end) {
    const data = new Uint8Array(end - start + 2);
    data[0] = start & 0xff; data[1] = start >> 8;
    for (let i = 0; i < end - start; i++) data[i + 2] = this.mem.read(start + i);
    this.drive.saveFile(name, data);
  }

  // PRG-Abbild in den Speicher legen. Rueckgabe: Start/Ende.
  loadPRG(bytes, forceAddr) {
    const load = forceAddr !== undefined ? forceAddr : (bytes[0] | (bytes[1] << 8));
    for (let i = 2; i < bytes.length; i++) this.mem.ram[(load + i - 2) & 0xffff] = bytes[i];
    const end = load + bytes.length - 2;
    return { start: load, end };
  }

  // LOAD aus dem BASIC-Interpreter
  basicLoad(name, secondary = 0) {
    const file = this.drive.findFile(name);
    if (!file) {
      this.screen.printString('\r?FILE NOT FOUND  ERROR\r');
      this.basic.state = 'ready';
      return;
    }
    this.screen.printString('\rSEARCHING FOR ' + (name || '*') + '\rLOADING\r');
    if (secondary === 1) this.injectFile(file.data);
    else this.loadAsBasic(file.data);
    this.basic.state = 'ready';
  }

  // LOAD ohne Sekundaeradresse: Datei kommt immer an den BASIC-Anfang
  loadAsBasic(bytes) {
    const body = bytes.subarray(2);
    for (let i = 0; i < body.length; i++) this.mem.ram[(0x0801 + i) & 0xffff] = body[i];
    if (!this.romMode) {
      this.basic.detokenize(body, 0x0801);
      this.basic.sortLines();
    }
    const end = 0x0801 + body.length;
    this.mem.ram[0x2b] = 0x01; this.mem.ram[0x2c] = 0x08;
    this.mem.ram[0x2d] = end & 0xff; this.mem.ram[0x2e] = end >> 8;
  }

  basicSave(name) {
    const bytes = this.basic.tokenize();
    const data = new Uint8Array(bytes.length + 2);
    data[0] = 0x01; data[1] = 0x08; data.set(bytes, 2);
    this.drive.saveFile(name, data);
    this.screen.printString('\rSAVING ' + name + '\r');
    this.basic.state = 'ready';
  }

  // Datei laden: BASIC-Programme werden in den Interpreter uebernommen,
  // Maschinenprogramme direkt in den Speicher.
  injectFile(bytes) {
    const load = bytes[0] | (bytes[1] << 8);
    const r = this.loadPRG(bytes);
    if (!this.romMode && load === 0x0801) {
      this.basic.detokenize(bytes.subarray(2), 0x0801);
      this.basic.sortLines();
    }
    return r;
  }

  // Datei laden und starten (RUN bzw. SYS)
  autoStart(bytes) {
    const load = bytes[0] | (bytes[1] << 8);
    const r = this.injectFile(bytes);
    if (load === 0x0801) {
      if (this.romMode) { this.typeText('RUN\r'); return; }
      this.screen.printString('\rRUN\r');
      this.basic.run();
    } else {
      this.sys(load);
      this.message('SYS ' + load);
    }
    return r;
  }

  message(text) { if (this.onMessage) this.onMessage(text); }

  // -------------------------------------------------------------- Zustaende
  saveState() {
    return {
      version: 1,
      mem: this.mem.saveState(),
      cpu: this.cpu.saveState(),
      vic: this.vic.saveState(),
      sid: this.sid.saveState(),
      cia1: this.cia1.saveState(),
      cia2: this.cia2.saveState(),
      jiffies: this.jiffies,
      inSys: this.inSys,
      romMode: this.romMode,
      basic: {
        program: [...this.basic.program.entries()],
        state: this.basic.state,
        li: this.basic.li, p: this.basic.p,
        vars: [...this.basic.vars.entries()],
      },
      screen: { col: this.screen.col, row: this.screen.row, color: this.screen.color },
    };
  }

  loadState(st) {
    this.mem.loadState(st.mem);
    this.cpu.loadState(st.cpu);
    this.vic.loadState(st.vic);
    this.sid.loadState(st.sid);
    this.cia1.loadState(st.cia1);
    this.cia2.loadState(st.cia2);
    this.jiffies = st.jiffies;
    this.inSys = st.inSys;
    if (st.basic) {
      this.basic.program = new Map(st.basic.program);
      this.basic.sortLines();
      this.basic.vars = new Map(st.basic.vars);
      this.basic.state = st.basic.state === 'run' ? 'run' : 'ready';
      this.basic.li = st.basic.li; this.basic.p = st.basic.p;
      if (this.basic.state === 'run') this.basic.src = this.basic.program.get(this.basic.order[this.basic.li]) || '';
    }
    if (st.screen) Object.assign(this.screen, st.screen);
  }
}
