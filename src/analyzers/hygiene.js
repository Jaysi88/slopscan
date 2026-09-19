// Hygiene analyzer: does this repo look like a real project or a weekend prompt?

import { isReadme } from '../walker.js';

const CHECKS = [
  {
    id: 'readme',
    label: 'README exists and says something',
    test: (files) => {
      const readme = files.find((f) => isReadme(f.path));
      if (!readme) return { ok: false, detail: 'no README found' };
      if (readme.content.trim().length < 200) return { ok: false, detail: 'README is under 200 characters' };
      return { ok: true };
    },
  },
  {
    id: 'license',
    label: 'LICENSE file',
    test: (files) => files.some((f) => /(^|\/)licen[cs]e(\.|$)/i.test(f.path))
      ? { ok: true } : { ok: false, detail: 'no LICENSE file' },
  },
  {
    id: 'gitignore',
    label: '.gitignore present',
    test: (files) => files.some((f) => f.path === '.gitignore')
      ? { ok: true } : { ok: false, detail: 'no .gitignore (node_modules in git, anyone?)' },
  },
  {
    id: 'tests',
    label: 'Tests exist',
    test: (files) => files.some((f) => /(^|\/)(tests?|__tests__|spec)\//i.test(f.path) || /(^|\/)(test|spec)_[\w.-]+\.(py|rb|php)$/i.test(f.path) || /\.(test|spec)\.[jt]sx?$/i.test(f.path) || /_test\.(go|py|rs)$/i.test(f.path))
      ? { ok: true } : { ok: false, detail: 'no test files found' },
  },
  {
    id: 'ci',
    label: 'CI configured',
    test: (files) => files.some((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(f.path) || /(^|\/)\.(gitlab-ci\.yml|circleci\/config\.yml|travis\.yml)$/.test(f.path))
      ? { ok: true } : { ok: false, detail: 'no CI workflow found' },
  },
  {
    id: 'manifest',
    label: 'Package manifest',
    test: (files) => files.some((f) => /(^|\/)(package\.json|pyproject\.toml|go\.mod|cargo\.toml|pom\.xml|gemfile|composer\.json)$/i.test(f.path))
      ? { ok: true } : { ok: false, detail: 'no package manifest (package.json, go.mod, ...)' },
  },
];

export function analyzeHygiene(files) {
  const results = CHECKS.map((c) => ({ id: c.id, label: c.label, ...c.test(files) }));
  const failed = results.filter((r) => !r.ok);
  // Weight: missing README/LICENSE/tests hurt most
  const weights = { readme: 5, license: 3, gitignore: 2, tests: 5, ci: 3, manifest: 2 };
  const score = Math.min(20, failed.reduce((s, f) => s + (weights[f.id] || 2), 0));

  return {
    id: 'hygiene',
    label: 'Hygiene',
    score,
    max: 20,
    findings: failed.map((f) => ({ rule: f.id, file: null, excerpt: f.detail, weight: weights[f.id] })),
    checks: results,
  };
}
