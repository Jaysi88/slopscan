// GitHub Action entry point (composite-style, plain node — no @actions/core dep).
import { run } from '../src/index.js';

const failUnder = process.env['INPUT_FAIL-UNDER'] || 'C';
const scanPath = process.env['INPUT_PATH'] || '.';

const args = [scanPath, '--card', 'slopgrade-card.svg', '--badge-url'];
if (failUnder) args.push('--fail-under', failUnder);

try {
  await run(args);
} catch (err) {
  console.error(`::error::${err.message}`);
  process.exit(1);
}
