export type Word = {text: string; line: number; start: number; end: number};
export type Line = {text: string; start: number; end: number};
export type Timings = {duration: number; lines: Line[]; words: Word[]};

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, '');

/** Time helpers bound to one voiceover's timings. */
export const makeCues = (t: Timings) => ({
  line: (i: number) => t.lines[i],
  /** start of the nth word in line `li` that begins with `prefix` */
  word: (li: number, prefix: string, nth = 0): Word => {
    const hits = t.words.filter((w) => w.line === li && clean(w.text).startsWith(prefix));
    if (!hits[nth]) throw new Error(`No word "${prefix}" #${nth} in line ${li}`);
    return hits[nth];
  },
});

export type Chunk = {words: Word[]; start: number; end: number};

/** Group words into short caption chunks (1-3 words) that break on punctuation. */
export const chunkWords = (words: Word[], maxWords = 3, maxChars = 16): Chunk[] => {
  const chunks: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) chunks.push({words: cur, start: cur[0].start, end: cur[cur.length - 1].end});
    cur = [];
  };
  for (const w of words) {
    if (cur.length && (cur[0].line !== w.line || cur.length >= maxWords || [...cur, w].map((x) => x.text).join(' ').length > maxChars)) {
      flush();
    }
    cur.push(w);
    if (/[.,!?…:;—"”]$/.test(w.text)) flush();
  }
  flush();
  // hold each chunk until the next one starts, unless there is a long pause
  for (let i = 0; i < chunks.length; i++) {
    const next = chunks[i + 1];
    const hold = chunks[i].end + 0.45;
    chunks[i].end = next ? Math.min(Math.max(hold, chunks[i].end), next.start) : hold;
  }
  return chunks;
};

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

/** Deterministic pseudo-random in [0,1) from a number. */
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
