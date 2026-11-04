import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const directories = ['library', 'outfits', 'visuals', 'demo'];
const content = Buffer.from('character asset fixture');
const checksum = createHash('sha256').update(content).digest('hex');
let root: string;
let origin: string;
let mode = 'ok';
const attempts = new Map<string, number>();
const server = createServer((request, response) => {
  const path = request.url ?? '';
  attempts.set(path, (attempts.get(path) ?? 0) + 1);
  if (mode === 'missing' && request.url?.includes('character-library')) {
    response.writeHead(404).end();
    return;
  }
  if (mode === 'unavailable' || (mode === 'transient' && attempts.get(path) === 1)) {
    response.writeHead(503).end();
    return;
  }
  if (mode === 'timeout') return;
  const headers: Record<string, string | number> = {
    'content-length': mode === 'size' ? content.length + 1 : content.length,
  };
  if (mode !== 'nohash') headers['x-cos-meta-sha256'] = mode === 'checksum' ? '0'.repeat(64) : checksum;
  response.writeHead(200, headers).end();
});

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'character-assets-check-'));
  execFileSync('git', ['init', '-q', root]);
  for (const dir of directories) {
    const path = join(root, 'public', `character-${dir}`);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'image.png'), content);
  }
  execFileSync('git', ['-C', root, 'add', 'public']);
  execFileSync('git', ['-C', root, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'fixture']);
  // The check must compare against the committed revision, not dirty working files.
  writeFileSync(join(root, 'public', 'character-library', 'image.png'), 'uncommitted change');
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not start');
  origin = `http://127.0.0.1:${address.port}/test-prefix`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  rmSync(root, { recursive: true, force: true });
});

function verify() {
  return new Promise<{ code: number | null; output: string }>((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve('deploy/verify-character-assets.mjs'), 'HEAD', '--repo', root, '--base-url', origin, '--timeout-ms', '1000']);
    let output = '';
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => resolvePromise({ code, output }));
  });
}

describe('release asset validation', () => {
  it.each(['ok', 'missing', 'size', 'checksum', 'nohash', 'timeout', 'transient', 'unavailable'])('checks all files and fails closed for %s', async scenario => {
    mode = scenario;
    attempts.clear();
    const result = await verify();
    expect(result.code, result.output).toBe(scenario === 'ok' || scenario === 'transient' ? 0 : 1);
    if (scenario !== 'ok' && scenario !== 'transient') expect(result.output).toMatch(/character-/);
    if (scenario === 'transient') expect([...attempts.values()]).toEqual([2, 2, 2, 2]);
    if (scenario === 'unavailable' || scenario === 'timeout') expect([...attempts.values()]).toEqual([3, 3, 3, 3]);
    if (scenario === 'missing' || scenario === 'checksum') expect([...attempts.values()]).toEqual([1, 1, 1, 1]);
  }, 10000);
});
