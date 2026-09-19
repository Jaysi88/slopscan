const HELP = `
slopscan — grade any repo for AI slop, sketchy agent skills, and hygiene.

Usage:
  slopscan <owner/repo>        Scan a GitHub repo (public, needs no auth)
  slopscan .                   Scan the current directory
  slopscan <path>              Scan a local folder

Options:
  --card [path]       Write a 1200x630 SVG X card (default: slopscan-card.svg)
  --badge-url         Print the Shields.io badge URL for your README
  --json              Print the full report as JSON
  --fail-under <S|A|B|C|D|F>  Exit 1 if the grade is worse than this
  --token <token>     GitHub token (or set GITHUB_TOKEN) to raise rate limits
  -h, --help          Show this help
  -v, --version       Show version

Examples:
  npx slopscan anthropics/skills --card --badge-url
  slopscan . --fail-under B
`;

export const GRADE_ORDER = ['F', 'D', 'C', 'B', 'A', 'S'];

export function parseArgs(argv) {
  const opts = {
    target: null,
    card: null,
    badgeUrl: false,
    json: false,
    failUnder: null,
    token: process.env.GITHUB_TOKEN || null,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '-v' || a === '--version') opts.version = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--badge-url') opts.badgeUrl = true;
    else if (a === '--card') {
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) { opts.card = next; i++; }
      else opts.card = 'slopscan-card.svg';
    } else if (a === '--fail-under') {
      const next = (argv[i + 1] || '').toUpperCase();
      if (!GRADE_ORDER.includes(next)) throw new Error(`--fail-under expects one of ${GRADE_ORDER.join('|')}`);
      opts.failUnder = next; i++;
    } else if (a === '--token') {
      opts.token = argv[i + 1]; i++;
      if (!opts.token) throw new Error('--token expects a value');
    } else if (a.startsWith('-')) {
      throw new Error(`Unknown flag: ${a} (try --help)`);
    } else if (!opts.target) {
      opts.target = a;
    } else {
      throw new Error(`Unexpected argument: ${a}`);
    }
  }

  if (!opts.help && !opts.version && !opts.target) {
    throw new Error(`No target given.\n${HELP}`);
  }
  return opts;
}

export const HELP_TEXT = HELP;
