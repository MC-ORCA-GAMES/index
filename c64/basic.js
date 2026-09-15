// C64 BASIC V2 – Interpreter, Zeileneditor und Tokenizer.
// Wird verwendet, wenn kein originales BASIC-ROM geladen ist. Der Interpreter
// schreibt ueber den Bildschirmeditor direkt in das Video-RAM des emulierten
// C64 und teilt sich Speicher, PEEK/POKE und SYS mit der echten CPU.

export const TOKENS = [
  'END', 'FOR', 'NEXT', 'DATA', 'INPUT#', 'INPUT', 'DIM', 'READ', 'LET', 'GOTO', 'RUN', 'IF',
  'RESTORE', 'GOSUB', 'RETURN', 'REM', 'STOP', 'ON', 'WAIT', 'LOAD', 'SAVE', 'VERIFY', 'DEF',
  'POKE', 'PRINT#', 'PRINT', 'CONT', 'LIST', 'CLR', 'CMD', 'SYS', 'OPEN', 'CLOSE', 'GET', 'NEW',
  'TAB(', 'TO', 'FN', 'SPC(', 'THEN', 'NOT', 'STEP', '+', '-', '*', '/', '^', 'AND', 'OR',
  '>', '=', '<', 'SGN', 'INT', 'ABS', 'USR', 'FRE', 'POS', 'SQR', 'RND', 'LOG', 'EXP', 'COS',
  'SIN', 'TAN', 'ATN', 'PEEK', 'LEN', 'STR$', 'VAL', 'ASC', 'CHR$', 'LEFT$', 'RIGHT$', 'MID$', 'GO',
];

const ERR = (msg) => { const e = new Error(msg); e.basic = true; throw e; };

export class Basic {
  constructor(machine) {
    this.m = machine;
    this.screen = machine.screen;
    this.program = new Map();
    this.order = [];
    this.reset();
  }

  reset() {
    this.vars = new Map();
    this.arrays = new Map();
    this.fns = new Map();
    this.forStack = [];
    this.gosubStack = [];
    this.dataItems = null;
    this.dataPtr = 0;
    this.running = false;
    this.state = 'ready';     // ready | run | input | wait
    this.li = 0; this.p = 0; this.src = '';
    this.inputTarget = null;
    this.printCol = 0;
    this.contLine = -1;
    this.rndLast = Math.random();
  }

  newProgram() { this.program.clear(); this.order = []; this.reset(); }

  sortLines() { this.order = [...this.program.keys()].sort((a, b) => a - b); }

  // ---------------------------------------------------------------- Editor
  bootMessage() {
    const s = this.screen;
    s.color = 14;
    s.clear();
    s.printString('\r    **** COMMODORE 64 BASIC V2 ****\r\r');
    s.printString(' 64K RAM SYSTEM  38911 BASIC BYTES FREE\r\r');
    s.printString('READY.\r');
    this.state = 'ready';
  }

  keyPress(code) {
    const s = this.screen;
    if (this.state === 'run') {
      if (code === 3) { this.breakRun(); return; }   // RUN/STOP
      s.keyPress(code);
      return;
    }
    if (code === 13) {
      s.tickCursor(false);
      const line = s.readLogicalLine();
      s.print(13);
      if (this.state === 'input') this.finishInput(line);
      else this.submit(line);
      return;
    }
    s.tickCursor(false);
    s.print(code);
  }

  submit(text) {
    const t = text.replace(/^\s+/, '');
    if (!t) { this.prompt(); return; }
    const mNum = /^(\d+)\s?(.*)$/.exec(t);
    if (mNum) {
      const ln = parseInt(mNum[1], 10);
      if (ln > 63999) { this.error('SYNTAX ERROR'); return; }
      if (mNum[2].trim() === '') this.program.delete(ln);
      else this.program.set(ln, mNum[2]);
      this.sortLines();
      this.prompt(false);
      return;
    }
    try {
      this.src = t; this.p = 0; this.li = -1;
      this.runDirect();
    } catch (e) {
      if (e.basic) this.error(e.message); else { console.error(e); this.error('SYNTAX ERROR'); }
    }
  }

  runDirect() {
    while (this.p < this.src.length) {
      this.skipSpace();
      if (this.p >= this.src.length) break;
      this.statement();
      if (this.state === 'run' || this.state === 'input' || this.state === 'wait') return;
      this.skipSpace();
      if (this.src[this.p] === ':') { this.p++; continue; }
      break;
    }
    if (this.state === 'ready') this.prompt();
  }

  prompt(showReady = true) {
    if (showReady) this.screen.printString('READY.\r');
    this.state = 'ready';
  }

  error(msg, lineNo) {
    const s = this.screen;
    if (s.col > 0) s.print(13);
    s.printString('?' + msg + (lineNo !== undefined ? ' IN ' + lineNo : '') + '\r');
    this.state = 'ready';
    this.running = false;
    s.printString('READY.\r');
  }

  breakRun() {
    const ln = this.order[this.li];
    this.contLine = this.li;
    this.running = false;
    this.state = 'ready';
    this.screen.print(13);
    this.screen.printString('BREAK' + (ln !== undefined ? ' IN ' + ln : '') + '\rREADY.\r');
  }

  // ------------------------------------------------------------- Ausfuehrung
  run(fromLine) {
    this.sortLines();
    if (!this.order.length) { this.prompt(); return; }
    this.vars.clear(); this.arrays.clear(); this.forStack = []; this.gosubStack = [];
    this.collectData();
    this.li = fromLine === undefined ? 0 : this.order.indexOf(fromLine);
    if (this.li < 0) ERR('UNDEF\'D STATEMENT ERROR');
    this.src = this.program.get(this.order[this.li]);
    this.p = 0;
    this.running = true;
    this.state = 'run';
    this.writeProgramToRam();
  }

  // Wird pro Frame von der Maschine aufgerufen
  slice(maxStatements) {
    if (this.state !== 'run') return;
    for (let i = 0; i < maxStatements && this.state === 'run'; i++) {
      try {
        this.step();
      } catch (e) {
        if (e.basic) this.error(e.message, this.order[this.li]);
        else { console.error(e); this.error('SYNTAX ERROR', this.order[this.li]); }
        return;
      }
    }
  }

  step() {
    this.skipSpace();
    while (this.p >= this.src.length || this.src[this.p] === undefined) {
      if (!this.nextLine()) return;
      this.skipSpace();
    }
    if (this.src[this.p] === ':') { this.p++; return; }
    this.statement();
    this.skipSpace();
    if (this.src[this.p] === ':') this.p++;
    else if (this.p >= this.src.length) this.nextLine();
  }

  nextLine() {
    this.li++;
    if (this.li >= this.order.length) {
      this.running = false;
      this.state = 'ready';
      this.screen.printString('READY.\r');
      return false;
    }
    this.src = this.program.get(this.order[this.li]);
    this.p = 0;
    return true;
  }

  gotoLine(n) {
    const idx = this.order.indexOf(n);
    if (idx < 0) ERR('UNDEF\'D STATEMENT ERROR');
    this.li = idx;
    this.src = this.program.get(n);
    this.p = 0;
  }

  // ----------------------------------------------------------------- Lexer
  skipSpace() { while (this.src[this.p] === ' ') this.p++; }

  peekWord(w) {
    this.skipSpace();
    if (this.src.substr(this.p, w.length).toUpperCase() === w) return true;
    return false;
  }
  eatWord(w) {
    if (this.peekWord(w)) { this.p += w.length; return true; }
    return false;
  }
  expect(ch) {
    this.skipSpace();
    if (this.src[this.p] !== ch) ERR('SYNTAX ERROR');
    this.p++;
  }

  readName() {
    this.skipSpace();
    const m = /^[A-Za-z][A-Za-z0-9]*[$%]?/.exec(this.src.slice(this.p));
    if (!m) ERR('SYNTAX ERROR');
    this.p += m[0].length;
    const n = m[0].toUpperCase();
    const suffix = /[$%]$/.test(n) ? n.slice(-1) : '';
    const base = (suffix ? n.slice(0, -1) : n).slice(0, 2);
    return base + suffix;
  }

  // -------------------------------------------------------------- Statements
  statement() {
    this.skipSpace();
    const s = this.src;
    if (this.p >= s.length) return;

    const kw = /^[A-Za-z]+[$#(]?/.exec(s.slice(this.p));
    const word = kw ? kw[0].toUpperCase() : '';

    if (word.startsWith('REM')) { this.p = s.length; return; }
    if (this.eatWord('PRINT#') || this.eatWord('CMD')) { this.skipToEnd(); return; }
    if (this.eatWord('PRINT') || (s[this.p] === '?' && ++this.p)) return this.doPrint();
    if (this.eatWord('INPUT#')) { this.skipToEnd(); return; }
    if (this.eatWord('INPUT')) return this.doInput();
    if (this.eatWord('IF')) return this.doIf();
    if (this.eatWord('FOR')) return this.doFor();
    if (this.eatWord('NEXT')) return this.doNext();
    if (this.eatWord('GOTO')) { this.gotoLine(this.num()); return; }
    if (this.eatWord('GOSUB')) {
      const t = this.num();
      this.gosubStack.push({ li: this.li, p: this.p });
      this.gotoLine(t);
      return;
    }
    if (this.eatWord('GO TO')) { this.gotoLine(this.num()); return; }
    if (this.eatWord('RETURN')) {
      const f = this.gosubStack.pop();
      if (!f) ERR('RETURN WITHOUT GOSUB ERROR');
      this.li = f.li; this.src = this.program.get(this.order[this.li]); this.p = f.p;
      return;
    }
    if (this.eatWord('ON')) return this.doOn();
    if (this.eatWord('END')) { this.endRun(); return; }
    if (this.eatWord('STOP')) { this.breakRun(); return; }
    if (this.eatWord('RUN')) {
      this.skipSpace();
      const ln = /^\d/.test(this.src[this.p] || '') ? this.num() : undefined;
      this.run(ln); return;
    }
    if (this.eatWord('LIST')) return this.doList();
    if (this.eatWord('NEW')) { this.newProgram(); this.screen.printString('\rREADY.\r'); return; }
    if (this.eatWord('CLR')) { this.vars.clear(); this.arrays.clear(); this.forStack = []; this.gosubStack = []; return; }
    if (this.eatWord('CONT')) {
      if (this.contLine < 0) ERR('CAN\'T CONTINUE ERROR');
      this.li = this.contLine; this.src = this.program.get(this.order[this.li]); this.p = 0;
      this.running = true; this.state = 'run'; return;
    }
    if (this.eatWord('POKE')) {
      const a = this.num(); this.expect(','); const v = this.num();
      this.m.mem.write(a & 0xffff, v & 0xff); return;
    }
    if (this.eatWord('SYS')) { this.m.sys(this.num() & 0xffff); return; }
    if (this.eatWord('WAIT')) {
      const a = this.num(); this.expect(','); const msk = this.num();
      let xor = 0;
      this.skipSpace();
      if (this.src[this.p] === ',') { this.p++; xor = this.num(); }
      this.waitArgs = { a, msk, xor };
      this.state = 'wait';
      return;
    }
    if (this.eatWord('DIM')) return this.doDim();
    if (this.eatWord('DATA')) { this.skipToEnd(); return; }
    if (this.eatWord('READ')) return this.doRead();
    if (this.eatWord('RESTORE')) { this.dataPtr = 0; return; }
    if (this.eatWord('GET')) return this.doGet();
    if (this.eatWord('DEF')) return this.doDef();
    if (this.eatWord('LOAD')) return this.doLoad();
    if (this.eatWord('SAVE')) return this.doSave();
    if (this.eatWord('VERIFY') || this.eatWord('OPEN') || this.eatWord('CLOSE')) { this.skipToEnd(); return; }
    this.eatWord('LET');
    return this.doAssign();
  }

  skipToEnd() {
    // Bis zum naechsten Doppelpunkt ausserhalb von Anfuehrungszeichen
    let q = false;
    while (this.p < this.src.length) {
      const c = this.src[this.p];
      if (c === '"') q = !q;
      if (c === ':' && !q) break;
      this.p++;
    }
  }

  endRun() {
    this.contLine = this.li;
    this.running = false;
    this.state = 'ready';
    this.screen.printString('\rREADY.\r');
  }

  doAssign() {
    const name = this.readName();
    let target = { name, index: null };
    this.skipSpace();
    if (this.src[this.p] === '(') {
      this.p++;
      const idx = [this.num()];
      while (this.eatChar(',')) idx.push(this.num());
      this.expect(')');
      target.index = idx;
    }
    this.expect('=');
    const v = name.endsWith('$') ? this.str() : this.num();
    this.setVar(target, v);
  }

  eatChar(c) { this.skipSpace(); if (this.src[this.p] === c) { this.p++; return true; } return false; }

  doPrint() {
    const s = this.screen;
    let trailing = false;
    for (;;) {
      this.skipSpace();
      const c = this.src[this.p];
      if (c === undefined || c === ':') break;
      if (c === ';') { this.p++; trailing = true; continue; }
      if (c === ',') {
        this.p++;
        const tab = 10 - (s.col % 10);
        for (let i = 0; i < tab; i++) s.print(32);
        trailing = true;
        continue;
      }
      if (this.peekWord('TAB(')) {
        this.p += 4; const n = this.num(); this.expect(')');
        while (s.col < n) s.print(32);
        trailing = true; continue;
      }
      if (this.peekWord('SPC(')) {
        this.p += 4; const n = this.num(); this.expect(')');
        for (let i = 0; i < n; i++) s.print(32);
        trailing = true; continue;
      }
      const v = this.expr();
      s.printString(typeof v === 'string' ? v : fmtNum(v));
      trailing = false;
    }
    if (!trailing) s.print(13);
  }

  doInput() {
    this.skipSpace();
    let prompt = '';
    if (this.src[this.p] === '"') {
      prompt = this.stringLiteral();
      this.skipSpace();
      if (this.src[this.p] === ';') this.p++;
    }
    const targets = [this.readTarget()];
    while (this.eatChar(',')) targets.push(this.readTarget());
    this.screen.printString(prompt + '? ');
    this.inputTarget = targets;
    this.inputResume = { li: this.li, p: this.p, state: this.running ? 'run' : 'ready' };
    this.state = 'input';
  }

  readTarget() {
    const name = this.readName();
    let index = null;
    if (this.eatChar('(')) {
      index = [this.num()];
      while (this.eatChar(',')) index.push(this.num());
      this.expect(')');
    }
    return { name, index };
  }

  finishInput(line) {
    const parts = line.split(',');
    const t = this.inputTarget || [];
    for (let i = 0; i < t.length; i++) {
      const raw = (parts[i] || '').trim();
      if (t[i].name.endsWith('$')) this.setVar(t[i], raw);
      else {
        const v = parseFloat(raw.replace(/^\+/, ''));
        this.setVar(t[i], isNaN(v) ? 0 : v);
      }
    }
    this.inputTarget = null;
    const r = this.inputResume;
    this.state = r.state;
    if (r.state !== 'run') this.prompt();
  }

  doGet() {
    const t = this.readTarget();
    const k = this.screen.getKey();
    if (t.name.endsWith('$')) this.setVar(t, k ? String.fromCharCode(k) : '');
    else this.setVar(t, k);
  }

  doIf() {
    const cond = this.num();
    this.skipSpace();
    const isThen = this.eatWord('THEN');
    const isGoto = !isThen && this.eatWord('GOTO');
    if (!isThen && !isGoto) ERR('SYNTAX ERROR');
    if (cond) {
      this.skipSpace();
      if (/^\d/.test(this.src[this.p] || '')) { this.gotoLine(this.num()); return; }
      return; // Rest der Zeile normal weiter ausfuehren
    }
    this.p = this.src.length; // Rest der Zeile ueberspringen
  }

  doFor() {
    const name = this.readName();
    if (name.endsWith('$')) ERR('TYPE MISMATCH ERROR');
    this.expect('=');
    const from = this.num();
    if (!this.eatWord('TO')) ERR('SYNTAX ERROR');
    const to = this.num();
    let stp = 1;
    if (this.eatWord('STEP')) stp = this.num();
    this.vars.set(name, from);
    this.forStack = this.forStack.filter((f) => f.name !== name);
    this.forStack.push({ name, to, step: stp, li: this.li, p: this.p });
  }

  doNext() {
    this.skipSpace();
    let name = null;
    if (/^[A-Za-z]/.test(this.src[this.p] || '')) name = this.readName();
    let f = null;
    if (name) {
      while (this.forStack.length && this.forStack[this.forStack.length - 1].name !== name) this.forStack.pop();
      f = this.forStack[this.forStack.length - 1];
    } else f = this.forStack[this.forStack.length - 1];
    if (!f) ERR('NEXT WITHOUT FOR ERROR');
    const v = (this.vars.get(f.name) || 0) + f.step;
    this.vars.set(f.name, v);
    const done = f.step > 0 ? v > f.to : v < f.to;
    if (done) { this.forStack.pop(); return; }
    this.li = f.li;
    this.src = this.li >= 0 ? this.program.get(this.order[this.li]) : this.src;
    this.p = f.p;
  }

  doOn() {
    const v = Math.trunc(this.num());
    const isGosub = this.eatWord('GOSUB');
    if (!isGosub && !this.eatWord('GOTO')) ERR('SYNTAX ERROR');
    const list = [this.num()];
    while (this.eatChar(',')) list.push(this.num());
    if (v >= 1 && v <= list.length) {
      if (isGosub) this.gosubStack.push({ li: this.li, p: this.p });
      this.gotoLine(list[v - 1]);
    }
  }

  doDim() {
    for (;;) {
      const name = this.readName();
      this.expect('(');
      const dims = [Math.trunc(this.num()) + 1];
      while (this.eatChar(',')) dims.push(Math.trunc(this.num()) + 1);
      this.expect(')');
      const size = dims.reduce((a, b) => a * b, 1);
      this.arrays.set(name, { dims, data: new Array(size).fill(name.endsWith('$') ? '' : 0) });
      if (!this.eatChar(',')) break;
    }
  }

  doDef() {
    if (!this.eatWord('FN')) ERR('SYNTAX ERROR');
    const name = this.readName();
    this.expect('(');
    const arg = this.readName();
    this.expect(')');
    this.expect('=');
    const body = this.src.slice(this.p);
    this.p = this.src.length;
    this.fns.set(name, { arg, body });
  }

  collectData() {
    this.dataItems = [];
    this.dataPtr = 0;
    for (const ln of this.order) {
      const text = this.program.get(ln);
      const re = /(^|:)\s*DATA\s?([^:]*)/gi;
      let m;
      while ((m = re.exec(text))) {
        for (const item of splitData(m[2])) this.dataItems.push(item);
      }
    }
  }

  doRead() {
    if (!this.dataItems) this.collectData();
    for (;;) {
      const t = this.readTarget();
      if (this.dataPtr >= this.dataItems.length) ERR('OUT OF DATA ERROR');
      const raw = this.dataItems[this.dataPtr++];
      if (t.name.endsWith('$')) this.setVar(t, raw.replace(/^"|"$/g, ''));
      else {
        const v = parseFloat(raw);
        if (isNaN(v)) ERR('TYPE MISMATCH ERROR');
        this.setVar(t, v);
      }
      if (!this.eatChar(',')) break;
    }
  }

  doList() {
    this.sortLines();
    this.skipSpace();
    let from = 0, to = 63999;
    if (/^[\d]/.test(this.src[this.p] || '')) from = to = this.num();
    if (this.eatChar('-')) { to = 63999; this.skipSpace(); if (/^\d/.test(this.src[this.p] || '')) to = this.num(); }
    for (const ln of this.order) {
      if (ln < from || ln > to) continue;
      this.screen.printString(Math.trunc(ln) + ' ' + this.program.get(ln) + '\r');
    }
  }

  doLoad() {
    this.skipSpace();
    let name = '';
    if (this.src[this.p] === '"') name = this.stringLiteral();
    let device = 8, secondary = 0;
    if (this.eatChar(',')) device = this.num();
    if (this.eatChar(',')) secondary = this.num();
    this.skipToEnd();
    this.m.basicLoad(name, secondary);
  }

  doSave() {
    this.skipSpace();
    let name = 'UNTITLED';
    if (this.src[this.p] === '"') name = this.stringLiteral();
    this.skipToEnd();
    this.m.basicSave(name);
  }

  // ---------------------------------------------------------------- Variablen
  setVar(t, v) {
    if (t.name.endsWith('%')) v = Math.trunc(v);
    if (t.index) {
      let arr = this.arrays.get(t.name);
      if (!arr) {
        const dims = t.index.map(() => 11);
        arr = { dims, data: new Array(dims.reduce((a, b) => a * b, 1)).fill(t.name.endsWith('$') ? '' : 0) };
        this.arrays.set(t.name, arr);
      }
      arr.data[this.arrayIndex(arr, t.index)] = v;
    } else this.vars.set(t.name, v);
  }

  arrayIndex(arr, idx) {
    let off = 0;
    for (let i = 0; i < arr.dims.length; i++) {
      const k = Math.trunc(idx[i] || 0);
      if (k < 0 || k >= arr.dims[i]) ERR('BAD SUBSCRIPT ERROR');
      off = off * arr.dims[i] + k;
    }
    return off;
  }

  getVar(name, idx) {
    if (idx) {
      let arr = this.arrays.get(name);
      if (!arr) {
        const dims = idx.map(() => 11);
        arr = { dims, data: new Array(dims.reduce((a, b) => a * b, 1)).fill(name.endsWith('$') ? '' : 0) };
        this.arrays.set(name, arr);
      }
      return arr.data[this.arrayIndex(arr, idx)];
    }
    if (this.vars.has(name)) return this.vars.get(name);
    return name.endsWith('$') ? '' : 0;
  }

  // ---------------------------------------------------------------- Ausdruecke
  num() {
    const v = this.expr();
    if (typeof v === 'string') ERR('TYPE MISMATCH ERROR');
    return v;
  }
  str() {
    const v = this.expr();
    if (typeof v !== 'string') ERR('TYPE MISMATCH ERROR');
    return v;
  }

  expr() { return this.orExpr(); }

  orExpr() {
    let l = this.andExpr();
    for (;;) {
      if (this.eatWord('OR')) { const r = this.andExpr(); l = (toI(l) | toI(r)); }
      else return l;
    }
  }
  andExpr() {
    let l = this.notExpr();
    for (;;) {
      if (this.eatWord('AND')) { const r = this.notExpr(); l = (toI(l) & toI(r)); }
      else return l;
    }
  }
  notExpr() {
    if (this.eatWord('NOT')) return ~toI(this.notExpr());
    return this.cmpExpr();
  }
  cmpExpr() {
    let l = this.addExpr();
    for (;;) {
      this.skipSpace();
      const two = this.src.substr(this.p, 2);
      let op = null;
      if (two === '<=' || two === '>=' || two === '<>') { op = two; this.p += 2; }
      else if ('<>='.includes(this.src[this.p] || '\0')) { op = this.src[this.p]; this.p++; }
      else return l;
      const r = this.addExpr();
      const res = compare(l, r, op);
      l = res ? -1 : 0;
    }
  }
  addExpr() {
    let l = this.mulExpr();
    for (;;) {
      this.skipSpace();
      const c = this.src[this.p];
      if (c === '+') {
        this.p++;
        const r = this.mulExpr();
        if (typeof l === 'string' || typeof r === 'string') {
          if (typeof l !== typeof r) ERR('TYPE MISMATCH ERROR');
          l = l + r;
        } else l = l + r;
      } else if (c === '-') { this.p++; l = toN(l) - toN(this.mulExpr()); }
      else return l;
    }
  }
  mulExpr() {
    let l = this.powExpr();
    for (;;) {
      this.skipSpace();
      const c = this.src[this.p];
      if (c === '*') { this.p++; l = toN(l) * toN(this.powExpr()); }
      else if (c === '/') {
        this.p++;
        const r = toN(this.powExpr());
        if (r === 0) ERR('DIVISION BY ZERO ERROR');
        l = toN(l) / r;
      } else return l;
    }
  }
  powExpr() {
    let l = this.unary();
    this.skipSpace();
    while (this.src[this.p] === '^') { this.p++; l = Math.pow(toN(l), toN(this.unary())); this.skipSpace(); }
    return l;
  }
  unary() {
    this.skipSpace();
    if (this.src[this.p] === '-') { this.p++; return -toN(this.unary()); }
    if (this.src[this.p] === '+') { this.p++; return this.unary(); }
    return this.atom();
  }

  atom() {
    this.skipSpace();
    const c = this.src[this.p];
    if (c === undefined) ERR('SYNTAX ERROR');
    if (c === '(') { this.p++; const v = this.expr(); this.expect(')'); return v; }
    if (c === '"') return this.stringLiteral();
    if (/[0-9.]/.test(c)) return this.numberLiteral();
    if (c === '\u03c0') { this.p++; return Math.PI; }

    const fn = /^[A-Za-z][A-Za-z0-9]*\$?/.exec(this.src.slice(this.p));
    if (!fn) ERR('SYNTAX ERROR');
    const upper = fn[0].toUpperCase();

    const call1 = (f) => { this.expect('('); const v = this.expr(); this.expect(')'); return f(v); };

    switch (upper) {
      case 'ABS': this.p += 3; return call1((v) => Math.abs(toN(v)));
      case 'INT': this.p += 3; return call1((v) => Math.floor(toN(v)));
      case 'SGN': this.p += 3; return call1((v) => Math.sign(toN(v)));
      case 'SQR': this.p += 3; return call1((v) => { if (v < 0) ERR('ILLEGAL QUANTITY ERROR'); return Math.sqrt(v); });
      case 'SIN': this.p += 3; return call1(Math.sin);
      case 'COS': this.p += 3; return call1(Math.cos);
      case 'TAN': this.p += 3; return call1(Math.tan);
      case 'ATN': this.p += 3; return call1(Math.atan);
      case 'EXP': this.p += 3; return call1(Math.exp);
      case 'LOG': this.p += 3; return call1((v) => { if (v <= 0) ERR('ILLEGAL QUANTITY ERROR'); return Math.log(v); });
      case 'RND': this.p += 3; return call1(() => (this.rndLast = Math.random()));
      case 'PEEK': this.p += 4; return call1((v) => this.m.mem.read(toN(v) & 0xffff));
      case 'LEN': this.p += 3; return call1((v) => String(v).length);
      case 'ASC': this.p += 3; return call1((v) => {
        const s = String(v); if (!s.length) ERR('ILLEGAL QUANTITY ERROR'); return s.charCodeAt(0);
      });
      case 'VAL': this.p += 3; return call1((v) => { const n = parseFloat(String(v)); return isNaN(n) ? 0 : n; });
      case 'CHR$': this.p += 4; return call1((v) => String.fromCharCode(toN(v) & 0xff));
      case 'STR$': this.p += 4; return call1((v) => fmtNum(toN(v)).replace(/ $/, ''));
      case 'FRE': this.p += 3; return call1(() => 38911);
      case 'POS': this.p += 3; return call1(() => this.screen.col);
      case 'USR': this.p += 3; return call1(() => 0);
      case 'TI': this.p += 2; return Math.floor(this.m.jiffies);
      case 'TI$': {
        this.p += 3;
        const t = Math.floor(this.m.jiffies / 60);
        const pad = (n) => String(n).padStart(2, '0');
        return pad(Math.floor(t / 3600)) + pad(Math.floor(t / 60) % 60) + pad(t % 60);
      }
      case 'ST': this.p += 2; return 0;
      case 'LEFT$': case 'RIGHT$': case 'MID$': {
        this.p += upper.length;
        this.expect('(');
        const s = String(this.expr());
        this.expect(',');
        const n = Math.trunc(this.num());
        let r;
        if (upper === 'LEFT$') r = s.slice(0, Math.max(0, n));
        else if (upper === 'RIGHT$') r = n <= 0 ? '' : s.slice(-n);
        else {
          let len = s.length;
          if (this.eatChar(',')) len = Math.trunc(this.num());
          r = s.substr(Math.max(0, n - 1), len);
        }
        this.expect(')');
        return r;
      }
      case 'FN': {
        this.p += 2;
        const name = this.readName();
        this.expect('(');
        const arg = this.expr();
        this.expect(')');
        const f = this.fns.get(name);
        if (!f) ERR('UNDEF\'D FUNCTION ERROR');
        const sub = new Basic(this.m);
        sub.vars = new Map(this.vars);
        sub.vars.set(f.arg, arg);
        sub.src = f.body; sub.p = 0;
        return sub.expr();
      }
    }

    // Variable
    const name = this.readName();
    let idx = null;
    this.skipSpace();
    if (this.src[this.p] === '(') {
      this.p++;
      idx = [this.num()];
      while (this.eatChar(',')) idx.push(this.num());
      this.expect(')');
    }
    return this.getVar(name, idx);
  }

  numberLiteral() {
    const m = /^\d*\.?\d*(?:[eE][-+]?\d+)?/.exec(this.src.slice(this.p));
    this.p += m[0].length;
    return parseFloat(m[0]);
  }

  stringLiteral() {
    this.p++; // "
    let out = '';
    while (this.p < this.src.length && this.src[this.p] !== '"') out += this.src[this.p++];
    if (this.src[this.p] === '"') this.p++;
    return out;
  }

  // ------------------------------------------------------- PRG-Tokenisierung
  writeProgramToRam() {
    const bytes = this.tokenize();
    const ram = this.m.mem.ram;
    for (let i = 0; i < bytes.length; i++) ram[0x0801 + i] = bytes[i];
    const end = 0x0801 + bytes.length;
    ram[0x2b] = 0x01; ram[0x2c] = 0x08;
    ram[0x2d] = end & 0xff; ram[0x2e] = end >> 8;
  }

  tokenize() {
    this.sortLines();
    const out = [];
    let addr = 0x0801;
    for (const ln of this.order) {
      const body = tokenizeLine(this.program.get(ln));
      const len = 4 + body.length + 1;
      const next = addr + len;
      out.push(next & 0xff, next >> 8, ln & 0xff, ln >> 8, ...body, 0);
      addr = next;
    }
    out.push(0, 0);
    return Uint8Array.from(out);
  }

  detokenize(bytes, loadAddr) {
    // bytes: PRG-Inhalt ohne Ladeadresse
    this.program.clear();
    let p = 0;
    let base = loadAddr;
    while (p + 4 <= bytes.length) {
      const next = bytes[p] | (bytes[p + 1] << 8);
      if (!next) break;
      const ln = bytes[p + 2] | (bytes[p + 3] << 8);
      p += 4;
      let text = '';
      while (p < bytes.length && bytes[p] !== 0) {
        const b = bytes[p++];
        if (b >= 0x80 && b - 0x80 < TOKENS.length) text += TOKENS[b - 0x80];
        else text += String.fromCharCode(petsciiToAscii(b));
      }
      p++;
      // Verzeichnislisten koennen dieselbe Zeilennummer mehrfach enthalten
      let key = ln;
      while (this.program.has(key)) key += 0.001;
      this.program.set(key, text);
      base = next;
    }
    this.sortLines();
  }
}

function petsciiToAscii(b) {
  if (b >= 0xc1 && b <= 0xda) return b - 0x80;
  if (b >= 0x61 && b <= 0x7a) return b - 0x20;
  return b;
}

export function tokenizeLine(text) {
  const out = [];
  let i = 0, quote = false;
  const upper = text.toUpperCase();
  while (i < text.length) {
    const c = text[i];
    if (c === '"') { quote = !quote; out.push(34); i++; continue; }
    if (!quote) {
      let matched = false;
      for (let t = 0; t < TOKENS.length; t++) {
        const kw = TOKENS[t];
        if (kw.length > 1 && upper.startsWith(kw, i)) {
          out.push(0x80 + t); i += kw.length; matched = true; break;
        }
      }
      if (matched) continue;
      if (upper.startsWith('REM', i)) { out.push(0x8f); i += 3; while (i < text.length) out.push(text.charCodeAt(i++)); break; }
    }
    let ch = text.charCodeAt(i++);
    if (ch >= 0x61 && ch <= 0x7a) ch -= 0x20;
    out.push(ch & 0xff);
  }
  return out;
}

function splitData(s) {
  const items = [];
  let cur = '', q = false;
  for (const ch of s) {
    if (ch === '"') { q = !q; cur += ch; continue; }
    if (ch === ',' && !q) { items.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim() !== '' || items.length) items.push(cur.trim());
  return items;
}

function toN(v) { if (typeof v === 'string') ERR('TYPE MISMATCH ERROR'); return v; }
function toI(v) { return Math.trunc(toN(v)) | 0; }

function compare(l, r, op) {
  if (typeof l === 'string' || typeof r === 'string') {
    l = String(l); r = String(r);
  }
  switch (op) {
    case '=': return l === r;
    case '<>': return l !== r;
    case '<': return l < r;
    case '>': return l > r;
    case '<=': return l <= r;
    case '>=': return l >= r;
  }
  return false;
}

export function fmtNum(v) {
  if (!isFinite(v)) return v > 0 ? ' INF ' : '-INF ';
  if (Number.isInteger(v) && Math.abs(v) < 1e9) return (v < 0 ? '' : ' ') + v + ' ';
  let s;
  const a = Math.abs(v);
  if (a >= 1e10 || (a < 0.01 && a > 0)) {
    s = v.toExponential(8).replace(/(\.\d*?)0+e/, '$1e').replace(/\.e/, 'e');
    s = s.replace('e+', 'E+').replace('e-', 'E-');
  } else {
    s = String(parseFloat(v.toPrecision(9)));
  }
  return (v < 0 ? '' : ' ') + s + ' ';
}

// BASIC-Quelltext direkt in ein PRG-Abbild (Ladeadresse $0801) verwandeln.
export function sourceToPrg(text) {
  const out = [0x01, 0x08];
  let addr = 0x0801;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = /^(\d+)\s?(.*)$/.exec(line);
    if (!m) continue;
    const body = tokenizeLine(m[2]);
    const next = addr + 4 + body.length + 1;
    out.push(next & 0xff, next >> 8, parseInt(m[1], 10) & 0xff, parseInt(m[1], 10) >> 8, ...body, 0);
    addr = next;
  }
  out.push(0, 0);
  return Uint8Array.from(out);
}
