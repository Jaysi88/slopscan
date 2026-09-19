// Shared constants + local directory walker.
// A scanned "repo" is always normalized to { name, files: [{ path, size, content }] }.

import { promises as fs } from 'node:fs';
import path from 'node:path';

export const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt',
  '.cache', '.turbo', '.vercel', 'vendor', 'target', '__pycache__', '.venv',
  'venv', '.idea', '.vscode-test', 'tmp', '.hg', '.svn',
]);

export const MAX_FILE_BYTES = 256 * 1024; // skip binaries / minified bundles
export const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

export const README_MAX_BYTES = 48 * 1024; // READMEs are scanned for hygiene only, not slop patterns

const README_RE = /(^|\/)readme(\.[a-z0-9]+)?$/i;

export function isConfigFile(p) {
  return /(^|\/)(package\.json|pyproject\.toml|requirements.*\.txt|go\.mod|cargo\.toml|pom\.xml|build\.gradle|gemfile|composer\.json|dockerfile)$/i.test(p);
}

export function isMarkdownFile(p) {
  return /\.(md|mdx|rst|txt)$/i.test(p) || /(^|\/)(skill\.md|claude\.md|agents\.md|gemini\.md)$/i.test(p);
}

export function isReadme(p) {
  return README_RE.test(p);
}

export function isCodeFile(p) {
  if (isConfigFile(p) || isReadme(p)) return false;
  return /\.[a-z0-9]{1,10}$/i.test(p);
}

export function isSkillishFile(p) {
  return /(^|\/)(skill\.md|claude\.md|agents\.md|gemini\.md|warp\.md|\.cursorrules|mcp\.json)$/i.test(p)
    || /(^|\/)\.claude\//i.test(p)
    || /(^|\/)\.cursor\//i.test(p)
    || /(^|\/)\.github\/copilot-instructions\.md$/i.test(p)
    || /(^|\/)\.mcp\.json$/i.test(p);
}

export async function walkLocal(rootDir) {
  const files = [];
  let total = 0;

  async function walk(dir, rel) {
    if (total > MAX_TOTAL_BYTES) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir — skip
    }
    for (const entry of entries) {
      if (total > MAX_TOTAL_BYTES) return;
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.') && entry.name !== '.claude' && entry.name !== '.cursor' && entry.name !== '.github') {
          // skip junk dirs but keep agent-config dirs (.claude, .cursor, .github)
          if (!['.claude', '.cursor', '.github'].includes(entry.name)) continue;
        }
        await walk(full, entryRel);
      } else if (entry.isFile()) {
        let stat;
        try { stat = await fs.stat(full); } catch { continue; }
        if (stat.size > MAX_FILE_BYTES) continue;
        if (stat.size === 0) { files.push({ path: entryRel, size: 0, content: '' }); continue; }
        let content;
        try { content = await fs.readFile(full, 'utf8'); } catch { continue; }
        if (content.indexOf(String.fromCharCode(0)) !== -1) continue; // binary
        total += stat.size;
        files.push({ path: entryRel, size: stat.size, content });
      }
    }
  }

  await walk(rootDir, '');
  const name = path.basename(path.resolve(rootDir));
  return { name, files };
}
