// Placeholder word timings from a script, for building scenes before the voiceover exists.
// Usage: node tools/estimate_timings.mjs <script.txt> <out.json>
// Replace with real timings from tools/align.py once voice.mp3 is in place.
import fs from 'node:fs';

const [src, out] = process.argv.slice(2);
const lines = fs.readFileSync(src, 'utf8').split(/\r?\n\s*\r?\n/).map((b) => b.replace(/\s+/g, ' ').trim()).filter(Boolean);
const words = [];
let t = 0.35;
lines.forEach((line, li) => {
  for (const w of line.split(' ')) {
    if (!/[A-Za-z0-9]/.test(w)) continue;
    const syl = Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || []).length);
    const dur = 0.13 + syl * 0.15;
    words.push({text: w, line: li, start: +t.toFixed(3), end: +(t + dur).toFixed(3)});
    t += dur + 0.04;
    if (/\.\.\.|…/.test(w)) t += 0.6;
    else if (/[.!?]["”]?$/.test(w)) t += 0.45;
    else if (/[,:;]["”]?$/.test(w)) t += 0.22;
  }
  t += 0.35;
});
const outLines = lines.map((text, li) => {
  const ws = words.filter((w) => w.line === li);
  return {text, start: ws[0].start, end: ws[ws.length - 1].end};
});
const duration = +(words[words.length - 1].end + 0.6).toFixed(3);
fs.writeFileSync(out, JSON.stringify({duration, estimated: true, lines: outLines, words}, null, 1));
console.log(`${words.length} words, ${lines.length} lines, ~${duration}s (estimated)`);
