/*
  Seed-basierter Zufallsgenerator (mulberry32).
  Gleicher Seed = gleiche Zahlenfolge. Wird jetzt für Sterne/Staub genutzt und
  später für die verborgenen Merkmale der Kreatur (Phase 28), damit eine Kreatur
  aus ihrem Seed reproduzierbar ist.
*/
export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
