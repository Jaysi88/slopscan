// Fetch a public GitHub repo (tree + file contents) with zero dependencies.
// Optional GITHUB_TOKEN raises the rate limit from 60 to 5000 req/hour.

import { MAX_FILE_BYTES, MAX_TOTAL_BYTES } from './walker.js';

const API = 'https://api.github.com';

function headers(token) {
  const h = {
    'User-Agent': 'slopscan-cli',
    Accept: 'application/vnd.github+json',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function gh(pathname, token) {
  const res = await fetch(`${API}${pathname}`, { headers: headers(token) });
  if (!res.ok) {
    if (res.status === 404) throw new Error(`Not found: ${pathname} (is the repo public?)`);
    if (res.status === 403) throw new Error('GitHub rate limit hit — pass --token or set GITHUB_TOKEN.');
    throw new Error(`GitHub API ${res.status} for ${pathname}`);
  }
  return res.json();
}

const SKIP_PATH = /(^|\/)(node_modules|vendor|dist|build|out|target|__pycache__|\.venv|venv)(\/|$)/;

export function parseRepoRef(target) {
  const m = String(target).match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

export async function fetchRepo(owner, repo, token, onProgress = () => {}) {
  const info = await gh(`/repos/${owner}/${repo}`, token);
  const branch = info.default_branch || 'main';
  const tree = await gh(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, token);

  const blobs = (tree.tree || []).filter(
    (n) => n.type === 'blob' && n.size != null && n.size <= MAX_FILE_BYTES && !SKIP_PATH.test(n.path)
  );

  const files = [];
  let total = 0;
  const CONCURRENCY = 6;

  async function fetchBlob(node) {
    if (total > MAX_TOTAL_BYTES) return;
    const data = await gh(`/repos/${owner}/${repo}/git/blobs/${node.sha}`, token);
    if (data.encoding !== 'base64') return;
    const buf = Buffer.from(String(data.content).replace(/\n/g, ''), 'base64');
    if (buf.includes(0)) return; // binary
    total += buf.length;
    files.push({ path: node.path, size: buf.length, content: buf.toString('utf8') });
    onProgress(files.length, blobs.length);
  }

  for (let i = 0; i < blobs.length; i += CONCURRENCY) {
    if (total > MAX_TOTAL_BYTES) break;
    await Promise.all(blobs.slice(i, i + CONCURRENCY).map((b) => fetchBlob(b).catch(() => {})));
  }

  return {
    name: `${owner}/${repo}`,
    files,
    meta: {
      url: info.html_url,
      stars: info.stargazers_count,
      description: info.description,
    },
  };
}
