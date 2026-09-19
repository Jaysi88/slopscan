import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkLocal } from '../src/walker.js';
import { analyzeSlop } from '../src/analyzers/slop.js';
import { analyzeSecurity } from '../src/analyzers/security.js';
import { analyzeHygiene } from '../src/analyzers/hygiene.js';
import { buildReport, gradeIsWorse } from '../src/score.js';
import { parseRepoRef } from '../src/github.js';
import { parseArgs } from '../src/args.js';
import { renderCard } from '../src/card.js';
import { badgeUrl, renderTerminal } from '../src/report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(__dirname, 'fixtures', name);

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; console.error(`  ✗ ${name}\n    ${err.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function scan(name) {
  const { name: n, files } = await walkLocal(fixture(name));
  return buildReport({
    name: n, files,
    slop: analyzeSlop(files),
    security: analyzeSecurity(files),
    hygiene: analyzeHygiene(files),
  });
}

console.log('\nslopscan test suite\n');

await test('walker finds fixture files', async () => {
  const { files } = await walkLocal(fixture('sloppy'));
  assert(files.length === 2, `expected 2 files, got ${files.length}`);
});

await test('sloppy fixture gets a bad grade', async () => {
  const r = await scan('sloppy');
  assert(['D', 'F'].includes(r.grade), `expected D or F, got ${r.grade} (score ${r.score})`);
  assert(r.breakdown.slop.findings >= 5, 'expected >=5 slop findings');
});

await test('slop analyzer catches AI confessions and placeholders', async () => {
  const { files } = await walkLocal(fixture('sloppy'));
  const slop = analyzeSlop(files);
  const rules = new Set(slop.findings.map((f) => f.rule));
  assert(rules.has('ai-confession'), 'missed ai-confession');
  assert(rules.has('llm-placeholder'), 'missed llm-placeholder');
  assert(rules.has('todo-spam'), 'missed todo-spam');
  assert(rules.has('debug-logging'), 'missed debug-logging');
  assert(rules.has('lazy-error-handling'), 'missed lazy-error-handling');
  assert(rules.has('generated-header'), 'missed generated-header');
});

await test('evil skill fixture triggers critical security findings', async () => {
  const r = await scan('evil-skill');
  assert(r.breakdown.security.criticals >= 2, `expected >=2 criticals, got ${r.breakdown.security.criticals}`);
  const labels = r.analyzers.security.summary.join(' | ');
  assert(labels.includes('curl | sh'), `missed curl|sh in: ${labels}`);
  assert(labels.includes('prompt-injection override'), `missed prompt injection in: ${labels}`);
  assert(labels.includes('exfiltration endpoint'), `missed exfiltration in: ${labels}`);
  assert(['D', 'F'].includes(r.grade), `evil skill should grade D/F, got ${r.grade}`);
});

await test('clean fixture gets a good grade', async () => {
  const r = await scan('clean');
  assert(['S', 'A', 'B'].includes(r.grade), `expected S/A/B, got ${r.grade} (score ${r.score})`);
  assert(r.breakdown.hygiene.missing === 0, 'clean fixture should pass all hygiene checks');
  assert(r.breakdown.security.findings === 0, 'clean fixture should have no security findings');
});

await test('hygiene detects missing files', async () => {
  const { files } = await walkLocal(fixture('sloppy'));
  const h = analyzeHygiene(files);
  const failed = new Set(h.findings.map((f) => f.rule));
  assert(failed.has('readme') && failed.has('license') && failed.has('tests') && failed.has('ci'), `unexpected hygiene result: ${[...failed]}`);
});

await test('grades are ordered correctly', () => {
  assert(gradeIsWorse('F', 'S'), 'F should be worse than S');
  assert(!gradeIsWorse('A', 'C'), 'A should not be worse than C');
  assert(!gradeIsWorse('B', 'B'), 'B should not be worse than B');
});

await test('parseRepoRef handles owner/repo and URLs', () => {
  assert(parseRepoRef('a/b')?.owner === 'a', 'owner/repo failed');
  assert(parseRepoRef('https://github.com/a/b')?.repo === 'b', 'URL failed');
  assert(parseRepoRef('https://github.com/a/b.git')?.repo === 'b', '.git URL failed');
  assert(parseRepoRef('C:\\foo\\bar') === null, 'windows path should not parse as repo');
});

await test('parseArgs validates flags', () => {
  const o = parseArgs(['owner/repo', '--card', '--fail-under', 'B', '--json']);
  assert(o.target === 'owner/repo' && o.card === 'slopscan-card.svg' && o.failUnder === 'B' && o.json, 'parseArgs mismatch');
  let threw = false;
  try { parseArgs([]); } catch { threw = true; }
  assert(threw, 'expected error with no target');
});

await test('card renders valid SVG with grade', async () => {
  const r = await scan('sloppy');
  const svg = renderCard(r);
  assert(svg.startsWith('<svg') && svg.includes(`>${r.grade}<`), 'card missing grade');
  assert(svg.includes('1200') && svg.includes('630'), 'wrong card dimensions');
});

await test('terminal report renders without throwing', async () => {
  const r = await scan('evil-skill');
  const out = renderTerminal(r);
  assert(out.includes(r.grade) && out.includes('slop score'), 'report missing key fields');
});

await test('badge URL encodes grade', () => {
  assert(badgeUrl('S') === 'https://img.shields.io/badge/slopscan-S-2ea043', 'badge URL mismatch');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
