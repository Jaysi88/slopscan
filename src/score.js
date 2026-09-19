// Turn analyzer results into the S-F grade people screenshot.

import { GRADE_ORDER } from './args.js';

const BANDS = [
  { max: 5, grade: 'S', verdict: 'Certified fresh. This repo showers daily.' },
  { max: 15, grade: 'A', verdict: 'Mostly clean. Smells faintly of espresso, not slop.' },
  { max: 30, grade: 'B', verdict: 'Human-made, human-reviewed. Respectable.' },
  { max: 50, grade: 'C', verdict: 'Some slop detected. A linter cries somewhere.' },
  { max: 70, grade: 'D', verdict: 'Heavily vibed. Review before you ship.' },
  { max: 100, grade: 'F', verdict: 'Certified slop. Approach with a hazmat suit.' },
];

export function gradeForScore(score) {
  return BANDS.find((b) => score <= b.max) || BANDS[BANDS.length - 1];
}

export function buildReport({ name, meta, files, slop, security, hygiene }) {
  const totalScore = slop.score + security.score + hygiene.score;
  const { grade, verdict } = gradeForScore(totalScore);

  return {
    tool: 'slopscan',
    target: name,
    meta: meta || {},
    stats: {
      filesScanned: files.length,
      bytesScanned: files.reduce((s, f) => s + f.size, 0),
    },
    score: totalScore,
    grade,
    verdict,
    breakdown: {
      slop: { score: slop.score, max: slop.max, findings: slop.findings.length },
      security: { score: security.score, max: security.max, findings: security.findings.length, criticals: security.criticals },
      hygiene: { score: hygiene.score, max: hygiene.max, missing: hygiene.findings.length },
    },
    analyzers: { slop, security, hygiene },
  };
}

export function gradeIsWorse(grade, threshold) {
  return GRADE_ORDER.indexOf(grade) < GRADE_ORDER.indexOf(threshold);
}
