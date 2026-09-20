#!/usr/bin/env node
import { run } from '../src/index.js';

run(process.argv.slice(2)).catch((err) => {
  console.error(`\n✖ slopgrade: ${err.message}\n`);
  process.exit(2);
});
