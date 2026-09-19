// Generate the 1200x630 SVG card people post on X.

import { GRADE_COLORS } from './report.js';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderCard(report) {
  const color = GRADE_COLORS[report.grade];
  const { slop, security, hygiene } = report.breakdown;

  const row = (label, score, max, y) => {
    const pct = Math.max(0.02, score / max);
    return `
    <text x="80" y="${y}" font-family="ui-monospace, monospace" font-size="26" fill="#8b949e">${esc(label)}</text>
    <rect x="280" y="${y - 20}" width="500" height="16" rx="8" fill="#21262d"/>
    <rect x="280" y="${y - 20}" width="${Math.round(500 * pct)}" height="16" rx="8" fill="${color}"/>
    <text x="800" y="${y}" font-family="ui-monospace, monospace" font-size="26" fill="#c9d1d9">${score}/${max}</text>`;
  };

  const stars = report.meta.stars != null ? `  ·  ★ ${report.meta.stars}` : '';

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="85%" cy="20%" r="70%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0d1117"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="24" y="24" width="1152" height="582" rx="24" fill="none" stroke="#30363d" stroke-width="2"/>

  <text x="80" y="110" font-family="ui-monospace, monospace" font-size="30" fill="#8b949e">$ npx slopscan ${esc(report.target)}</text>
  ${stars ? `<text x="80" y="150" font-family="ui-monospace, monospace" font-size="22" fill="#6e7681">${esc(stars.trim())}</text>` : ''}

  <text x="880" y="380" font-family="ui-monospace, monospace" font-size="340" font-weight="bold" fill="${color}">${esc(report.grade)}</text>
  <text x="880" y="440" font-family="ui-monospace, monospace" font-size="28" fill="#8b949e">slop score ${report.score}/100</text>

  ${row('AI SLOP', slop.score, slop.max, 250)}
  ${row('SECURITY', security.score, security.max, 310)}
  ${row('HYGIENE', hygiene.score, hygiene.max, 370)}

  <text x="80" y="440" font-family="ui-monospace, monospace" font-size="24" fill="#c9d1d9">${esc(report.verdict)}</text>

  <text x="80" y="560" font-family="ui-monospace, monospace" font-size="26" fill="#6e7681">slopscan — how vibed is your repo?</text>
  <text x="1120" y="560" text-anchor="end" font-family="ui-monospace, monospace" font-size="26" fill="${color}">github.com/Jaysi88/slopscan</text>
</svg>
`;
}
