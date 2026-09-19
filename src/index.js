import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { parseArgs, HELP_TEXT } from './args.js';
import { walkLocal } from './walker.js';
import { parseRepoRef, fetchRepo } from './github.js';
import { analyzeSlop } from './analyzers/slop.js';
import { analyzeSecurity } from './analyzers/security.js';
import { analyzeHygiene } from './analyzers/hygiene.js';
import { buildReport, gradeIsWorse } from './score.js';
import { renderTerminal, badgeUrl } from './report.js';
import { renderCard } from './card.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

async function resolveTarget(target, opts) {
  // A local directory always wins — even if it looks like owner/repo.
  const root = path.resolve(process.cwd(), target);
  const stat = await fs.stat(root).catch(() => null);
  if (stat?.isDirectory()) return walkLocal(root);

  const ref = parseRepoRef(target);
  if (ref) {
    process.stderr.write(`Fetching ${ref.owner}/${ref.repo} from GitHub...\n`);
    return fetchRepo(ref.owner, ref.repo, opts.token);
  }

  throw new Error(`Can't understand target "${target}". Use a local path or owner/repo.`);
}

export async function run(argv) {
  const opts = parseArgs(argv);

  if (opts.help) { console.log(HELP_TEXT); return; }
  if (opts.version) { console.log(version); return; }

  const { name, files, meta } = await resolveTarget(opts.target, opts);
  if (files.length === 0) throw new Error('No scannable files found.');

  const slop = analyzeSlop(files);
  const security = analyzeSecurity(files);
  const hygiene = analyzeHygiene(files);
  const report = buildReport({ name, meta, files, slop, security, hygiene });

  if (opts.json) {
    console.log(JSON.stringify(report, (k, v) => (k === 'content' ? undefined : v), 2));
  } else {
    console.log(renderTerminal(report));
  }

  if (opts.card) {
    const out = path.resolve(process.cwd(), opts.card);
    await fs.writeFile(out, renderCard(report), 'utf8');
    console.log(`  🖼  X card written to ${out}`);
  }

  if (opts.badgeUrl) {
    console.log(`  🏷  Badge: ${badgeUrl(report.grade)}\n`);
  }

  if (opts.failUnder && gradeIsWorse(report.grade, opts.failUnder)) {
    console.error(`  ✖ Grade ${report.grade} is worse than required ${opts.failUnder}`);
    process.exit(1);
  }
}
