import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../src/lib/character-assets.json', import.meta.url), 'utf8'));
const directories = ['library', 'outfits', 'visuals', 'demo'].map(name => `public/character-${name}`);
const [revision, ...options] = process.argv.slice(2);
const option = (key, fallback) => {
  const index = options.indexOf(key);
  return index < 0 ? fallback : options[index + 1];
};
const repo = option('--repo', process.cwd());
const baseUrl = option('--base-url', config.baseUrl).replace(/\/$/, '');
const timeout = Number(option('--timeout-ms', '10000'));
const concurrency = 8;

function hashFile(path) {
  return new Promise((resolve, reject) => {
    const git = spawn('git', ['-C', repo, 'show', `${revision}:${path}`], { stdio: ['ignore', 'pipe', 'ignore'] });
    const hash = createHash('sha256');
    git.stdout.on('data', chunk => hash.update(chunk));
    git.on('error', reject);
    git.on('close', code => code === 0 ? resolve(hash.digest('hex')) : reject(new Error('unable to read git blob')));
  });
}

async function fetchWithRetry(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(timeout) });
      if (response.status !== 429 && response.status < 500) return response;
      if (attempt === 2) return response;
    } catch (error) {
      if (attempt === 2) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 200 * 2 ** attempt));
  }
  throw new Error('request failed');
}

async function verifyFile(entry) {
  const urlPath = entry.path.slice('public/'.length).split('/').map(encodeURIComponent).join('/');
  try {
    const [hash, response] = await Promise.all([
      hashFile(entry.path),
      fetchWithRetry(`${baseUrl}/${urlPath}`),
    ]);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (response.headers.get('content-length') !== String(entry.size)) throw new Error('size mismatch');
    if (response.headers.get('x-cos-meta-sha256')?.toLowerCase() !== hash) throw new Error('SHA-256 metadata mismatch');
  } catch (error) {
    throw new Error(`${entry.path}: ${error instanceof Error && /^(HTTP \d+|size mismatch|SHA-256 metadata mismatch)$/.test(error.message) ? error.message : 'request or git read failed'}`);
  }
}

async function main() {
  if (!/^(?:[0-9a-f]{40}|HEAD)$/.test(revision ?? '') || !Number.isInteger(timeout) || timeout < 1 || timeout > 60000) throw new Error('Invalid revision or timeout');
  const listing = execFileSync('git', ['-C', repo, 'ls-tree', '-r', '-l', '-z', revision, '--', ...directories], { encoding: 'utf8' });
  const entries = listing.split('\0').filter(Boolean).map(line => {
    const match = /^(\d+) blob ([0-9a-f]+)\s+(\d+)\t(.+)$/.exec(line);
    if (!match || match[1] === '120000') throw new Error('Invalid asset in Git tree');
    return { path: match[4], size: Number(match[3]) };
  });
  for (const dir of directories) if (!entries.some(entry => entry.path.startsWith(`${dir}/`))) throw new Error(`No assets found in ${dir}`);
  let cursor = 0;
  const errors = [];
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (cursor < entries.length) {
      const entry = entries[cursor++];
      try { await verifyFile(entry); } catch (error) { errors.push(error.message); }
    }
  }));
  if (errors.length) throw new Error(`${errors.length} asset(s) failed verification:\n${errors.join('\n')}`);
  console.log(`Verified ${entries.length} character assets against COS.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
