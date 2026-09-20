// Terminal report with ANSI colors.

const ESC = String.fromCharCode(27);
const c = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  dim: `${ESC}[2m`,
  red: `${ESC}[31m`,
  green: `${ESC}[32m`,
  yellow: `${ESC}[33m`,
  blue: `${ESC}[34m`,
  magenta: `${ESC}[35m`,
  cyan: `${ESC}[36m`,
  white: `${ESC}[37m`,
  bgRed: `${ESC}[41m`,
  bgGreen: `${ESC}[42m`,
  bgYellow: `${ESC}[43m`,
};

export const GRADE_COLORS = { S: '#2ea043', A: '#3fb950', B: '#9ece6a', C: '#d29922', D: '#e0803a', F: '#f85149' };
const GRADE_ANSI = { S: c.green, A: c.green, B: c.green, C: c.yellow, D: c.yellow, F: c.red };

const BAR_WIDTH = 20;

function bar(score, max, color) {
  const filled = Math.round((score / max) * BAR_WIDTH);
  return `${color}${'#'.repeat(filled)}${c.dim}${'-'.repeat(BAR_WIDTH - filled)}${c.reset}`;
}

function findingLine(f) {
  const loc = f.file ? `${c.dim}${f.file}${f.line ? `:${f.line}` : ''}${c.reset}` : '';
  const sev = f.severity ? `${f.severity === 'critical' ? c.red : f.severity === 'high' ? c.yellow : c.blue}[${f.severity}]${c.reset} ` : '';
  return `    ${sev}${loc} ${c.dim}${f.excerpt || f.label || ''}${c.reset}`;
}

export function renderTerminal(report) {
  const gc = GRADE_ANSI[report.grade];
  const lines = [];

  lines.push('');
  lines.push(`  ${c.bold}${c.magenta}slopgrade${c.reset} ${c.dim}v1${c.reset}  ${c.bold}${report.target}${c.reset}`);
  if (report.meta.stars != null) lines.push(`  ${c.dim}${report.meta.url}  ★ ${report.meta.stars}${c.reset}`);
  lines.push(`  ${c.dim}scanned ${report.stats.filesScanned} files (${Math.round(report.stats.bytesScanned / 1024)} KB)${c.reset}`);
  lines.push('');

  // Grade block
  lines.push(`    ${gc}${c.bold}  ┌─────┐${c.reset}`);
  lines.push(`    ${gc}${c.bold}  │  ${report.grade}  │${c.reset}   ${c.bold}slop score: ${report.score}/100${c.reset}`);
  lines.push(`    ${gc}${c.bold}  └─────┘${c.reset}   ${c.dim}${report.verdict}${c.reset}`);
  lines.push('');

  // Breakdown
  const { slop, security, hygiene } = report.breakdown;
  lines.push(`  ${c.bold}AI Slop${c.reset}      ${bar(slop.score, slop.max, c.magenta)} ${slop.score}/${slop.max}  ${c.dim}${slop.findings} findings${c.reset}`);
  lines.push(`  ${c.bold}Security${c.reset}     ${bar(security.score, security.max, c.red)} ${security.score}/${security.max}  ${security.criticals > 0 ? `${c.red}${c.bold}${security.criticals} critical${c.reset}` : `${c.dim}${security.findings} findings${c.reset}`}`);
  lines.push(`  ${c.bold}Hygiene${c.reset}      ${bar(hygiene.score, hygiene.max, c.cyan)} ${hygiene.score}/${hygiene.max}  ${c.dim}${hygiene.missing} missing${c.reset}`);
  lines.push('');

  // Top findings (max 8)
  const all = [
    ...report.analyzers.security.findings.sort((a, b) => (a.severity === 'critical' ? -1 : 0) - (b.severity === 'critical' ? -1 : 0)),
    ...report.analyzers.slop.findings,
    ...report.analyzers.hygiene.findings,
  ].slice(0, 8);

  if (all.length) {
    lines.push(`  ${c.bold}Top findings${c.reset}`);
    for (const f of all) lines.push(findingLine(f));
    lines.push('');
  }

  // Why summary
  const whyItems = [
    ...report.analyzers.security.summary.map((s) => `${c.red}⚠ ${s}${c.reset}`),
    ...report.analyzers.slop.summary.slice(0, 4).map((s) => `${c.magenta}~ ${s.label}${c.reset} ${c.dim}— ${s.why}${c.reset}`),
  ];
  if (whyItems.length) {
    lines.push(`  ${c.bold}Why${c.reset}`);
    for (const w of whyItems.slice(0, 6)) lines.push(`    ${w}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function badgeUrl(grade) {
  const color = GRADE_COLORS[grade].slice(1);
  return `https://img.shields.io/badge/slopgrade-${encodeURIComponent(grade)}-${color}`;
}

export function badgeMarkdown(grade) {
  return `[![slopgrade: ${grade}](${badgeUrl(grade)})](https://github.com/Jaysi88/slopgrade)`;
}
