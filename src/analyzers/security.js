// Security analyzer: hunts for sketchy agent-skill / MCP / prompt-injection patterns.
// This is the SkillSpector part — the thing people screenshot on X.

import { isSkillishFile, isCodeFile, isConfigFile, isReadme } from '../walker.js';

// severity: 'critical' | 'high' | 'medium'
const SKILL_PATTERNS = [
  { id: 'curl-pipe-sh', sev: 'critical', re: /\b(?:curl|wget)\b[^|\n]*\|\s*(?:sudo\s+)?(?:ba|z|da)?sh\b/, label: 'curl | sh execution', why: 'Downloads and executes a script sight-unseen. The #1 malware vector in skills.' },
  { id: 'base64-exec', sev: 'critical', re: /base64\s+(?:-d|--decode)[^\n]*(?:\||>|sh\b|bash\b)/, label: 'base64-decoded payload executed', why: 'Obfuscated code execution — a classic payload smuggling trick.' },
  { id: 'encode-smuggle', sev: 'high', re: /\b(?:atob|btoa)\s*\([^)]{40,}\)|fromCharCode\s*\(\s*\d{2,3}\s*(?:,\s*\d{2,3}\s*){10,}\)/, label: 'obfuscated/encoded blob', why: 'Long encoded blobs in agent files are how payloads hide from reviewers.' },
  { id: 'prompt-override', sev: 'critical', re: /ignore (?:all )?(?:previous|prior|above) instructions|disregard (?:your|all|previous)|forget (?:your|all) (?:instructions|training)|you are now\b/i, label: 'prompt-injection override', why: 'Attempts to hijack whatever agent reads this file.' },
  { id: 'hidden-instruction', sev: 'high', re: /do not (?:tell|inform|show) the user|without (?:the user|them) knowing|silently\b[^.\n]*(?:send|upload|exfiltrate|delete)/i, label: 'instruction to act covertly', why: 'Skills that tell agents to hide actions from users are malicious by definition.' },
  { id: 'credential-access', sev: 'high', re: /~\/\.ssh\/|\.aws\/credentials|\.env\b|id_rsa|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/, label: 'credential/secret file access', why: 'Touches SSH keys, cloud credentials, or env files.' },
  { id: 'exfiltration', sev: 'critical', re: /https?:\/\/[^\s/)"']*(?:webhook\.site|requestbin|ngrok\.io|pastebin\.com|discord(?:app)?\.com\/api\/webhooks|burpcollaborator)/i, label: 'exfiltration endpoint', why: 'Posts data to a known data-harvesting endpoint.' },
  { id: 'telemetry-callback', sev: 'high', re: /\bfetch\s*\(\s*[`'"]https?:\/\/(?!api\.github\.com)[^\s`'"]+[`'"][^)]*(?:process\.env|os\.environ|HOME|USERPROFILE)/, label: 'sends environment data to a URL', why: 'Ships your env vars to a remote server.' },
  { id: 'shell-download-exec', sev: 'high', re: /(?:irm|iwr|invoke-webrequest|invoke-restmethod)[^\n]*(?:iex|invoke-expression)/i, label: 'PowerShell download-and-execute', why: 'The Windows equivalent of curl | sh.' },
  { id: 'destructive-fs', sev: 'medium', re: /rm\s+-rf\s+(?:~|\/|\$HOME)|del\s+\/[fsq]|Remove-Item\s+-Recurse\s+-Force\s+(?:~|C:\\)/i, label: 'destructive filesystem command', why: 'A skill that can nuke your home directory deserves scrutiny.' },
];

const CODE_PATTERNS = [
  { id: 'hardcoded-secret', sev: 'high', re: /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/i, label: 'hardcoded secret', why: 'Committed credentials — rotate these now.' },
  { id: 'private-key-material', sev: 'critical', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: 'private key committed', why: 'A private key in the repo. Rotate immediately and scrub history.' },
  { id: 'aws-key', sev: 'high', re: /\bAKIA[0-9A-Z]{16}\b/, label: 'AWS access key ID', why: 'AWS credentials committed to source.' },
  { id: 'mcp-shell-out', sev: 'critical', re: /child_process|exec\s*\(|spawn\s*\(|execSync\s*\(|spawnSync\s*\(|eval\s*\(\s*(?:fetch|require|import)|Function\s*\(\s*['"]/i, label: 'MCP tool shells out / evals remote code', why: 'Tools registered by the server can execute arbitrary commands or eval fetched payloads.' },
  { id: 'postinstall-download', sev: 'high', re: /(?:curl|wget|irm|iwr|invoke-webrequest)\b[^|\n]*(?:\||>)/i, label: 'postinstall downloads and executes', why: 'Install-time scripts that fetch and run code bypass static repo review.' },
  { id: 'runtime-config-mutation', sev: 'high', re: /(?:update|modify|rewrite|edit|append to|overwrite)\s+(?:the\s+)?(?:AGENTS\.md|CLAUDE\.md|SKILL\.md|README|instructions|config|rules)/i, label: 'skill rewrites its own instructions', why: 'Skills that mutate AGENTS.md / CLAUDE.md / SKILL.md mid-run bypass static scanning.' },
];

const SEV_WEIGHT = { critical: 12, high: 6, medium: 2 };

// package.json postinstall hooks that download/execute
const POSTINSTALL_RE = /"(?:preinstall|install|postinstall|prepare)"\s*:\s*"[^"]*(?:curl|wget|irm|iwr|invoke-webrequest|node\s+-e|bash|sh\b)/i;

function findPostinstallHooks(files) {
  const findings = [];
  for (const file of files) {
    if (!/(^|\/)package\.json$/i.test(file.path)) continue;
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (POSTINSTALL_RE.test(lines[i])) {
        findings.push({
          rule: 'postinstall-hook',
          severity: 'high',
          label: 'postinstall hook downloads or executes code',
          why: 'Scripts that run on install can fetch payloads after static review.',
          file: file.path,
          line: i + 1,
          excerpt: lines[i].trim().slice(0, 100),
        });
        break;
      }
    }
  }
  return findings;
}

export function analyzeSecurity(files) {
  const findings = [];

  for (const file of files) {
    const skillish = isSkillishFile(file.path);
    const code = isCodeFile(file.path) || isConfigFile(file.path) || isReadme(file.path);

    if (skillish) {
      const lines = file.content.split('\n');
      for (const pat of SKILL_PATTERNS) {
        for (let i = 0; i < lines.length; i++) {
          if (pat.re.test(lines[i])) {
            findings.push({
              rule: pat.id, severity: pat.sev, label: pat.label, why: pat.why,
              file: file.path, line: i + 1, excerpt: lines[i].trim().slice(0, 100),
            });
            break;
          }
        }
      }
    }

    if (code) {
      const lines = file.content.split('\n');
      for (const pat of CODE_PATTERNS) {
        for (let i = 0; i < lines.length; i++) {
          if (pat.re.test(lines[i])) {
            findings.push({
              rule: pat.id, severity: pat.sev, label: pat.label, why: pat.why,
              file: file.path, line: i + 1, excerpt: lines[i].trim().slice(0, 100),
            });
            break;
          }
        }
      }
    }
  }

  findings.push(...findPostinstallHooks(files));

  const criticals = findings.filter((f) => f.severity === 'critical').length;
  const score = Math.min(40, findings.reduce((s, f) => s + SEV_WEIGHT[f.severity], 0));

  return {
    id: 'security',
    label: 'Security',
    score,
    max: 40,
    findings,
    criticals,
    hasAgentConfig: files.some((f) => isSkillishFile(f.path)),
    summary: [...new Set(findings.map((f) => f.label))],
  };
}
