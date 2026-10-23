import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('frontend release safeguards', () => {
  it('checks archives and serializes releases before switching', () => {
    const script = readFileSync('deploy/update-frontend.sh', 'utf8');
    expect(script).toContain('sha256sum -c checksums.txt');
    expect(script).toContain('.release-deploy.lock');
    expect(script).toContain('.backend-deploy.lock');
    expect(script).toContain('flock -w 600 9');
    expect(script).toContain('flock -w 600 8');
    expect(script).not.toContain('flock -n');
    expect(script.indexOf('sha256sum -c')).toBeLessThan(script.indexOf('docker build'));
    expect(script).toContain('Concurrent deployment detected');
    expect(script).toContain('rollback-');
    expect(script).not.toMatch(/docker (system prune|compose down)/);
  });
});

it('rejects malformed release and image arguments before any external command', async () => {
  const { execFileSync } = await import('node:child_process');
  expect(() => execFileSync('bash', ['deploy/update-frontend.sh', '../../etc', `sha256:${'a'.repeat(64)}`], { stdio: 'pipe' })).toThrow();
  expect(() => execFileSync('bash', ['deploy/update-frontend.sh', 'frontend-20261013-1-1', 'injected;touch /tmp/x'], { stdio: 'pipe' })).toThrow();
});

it('fails the switch guard when the running image changes', async () => {
  const { execFileSync } = await import('node:child_process');
  const script = readFileSync('deploy/update-frontend.sh', 'utf8');
  const guard = script.split('\n').find((line) => line.startsWith('[[ "$current" == "$expected" ]]'))!;
  expect(() => execFileSync('bash', ['-c', `set -e; current=changed; expected=previous; ${guard}`], { stdio: 'pipe' })).toThrow();
  expect(execFileSync('bash', ['-c', `set -e; current=previous; expected=previous; ${guard}; printf ok`], { encoding: 'utf8' })).toBe('ok');
});

it('continues exact image rollback and nginx reload when source restore fails', async () => {
  const { execFileSync } = await import('node:child_process');
  const script = readFileSync('deploy/update-frontend.sh', 'utf8');
  const restore = script.slice(script.indexOf('restore() {'), script.indexOf('trap restore EXIT'));
  try {
    execFileSync('bash', ['-c', `set -e; source_changed=true; switched=true; backup=backup; current=old; reference=app; rsync() { return 1; }; sudo() { printf '%s\\n' "$*"; return 0; }; ${restore}\ntrap restore EXIT; false`], { stdio: 'pipe' });
    throw new Error('failure should retain nonzero exit');
  } catch (error) {
    const result = error as { stdout: Buffer; stderr: Buffer; status: number };
    expect(result.status).toBe(1);
    expect(result.stdout.toString()).toContain('docker tag old app');
    expect(result.stdout.toString()).toContain('docker compose up -d --no-deps --no-build frontend');
    expect(result.stdout.toString()).toContain('nginx -s reload');
    expect(result.stderr.toString()).toContain('Rollback incomplete');
  }
});

// These cases execute tar and a shell release script; health_failure runs all 30 probes.
// Full-suite CPU contention can push the successful shell fixture past 15s on macOS.
// Keep a bounded timeout local; all release/rollback assertions remain unchanged.
it.each([['success', 0], ['health_failure', 1], ['stale_image', 1], ['post_copy_stale', 1]] as const)('runs the release state machine: %s', async (mode, status) => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const root = mkdtempSync(join(tmpdir(), 'frontend-release-'));
  const release = 'frontend-20261013-1-1';
  const old = `sha256:${'a'.repeat(64)}`;
  const candidate = `sha256:${'b'.repeat(64)}`;
  const incoming = join(root, 'releases', release);
  const bin = join(root, 'bin');
  mkdirSync(incoming, { recursive: true });
  mkdirSync(bin);
  mkdirSync(join(root, 'frontend'));
  writeFileSync(join(root, 'frontend', 'old.txt'), 'old');
  writeFileSync(join(incoming, 'checksums.txt'), 'fixture');
  const fixture = join(root, 'fixture');
  mkdirSync(join(fixture, 'app'), { recursive: true });
  writeFileSync(join(fixture, 'app', 'server.js'), '// fixture');
  for (const name of ['runtime', 'source']) {
    expect(spawnSync('tar', ['-czf', join(incoming, `${name}.tar.gz`), '-C', fixture, '.']).status).toBe(0);
  }
  const stub = (name: string, body: string) => writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o700 });
  stub('flock', 'exit 0');
  stub('sha256sum', 'exit 0');
  stub('df', 'printf "Avail\\n99999999999\\n"');
  stub('rsync', 'printf "rsync\\n" >> "$LOG"; touch "$COPIED"');
  stub('sleep', 'exit 0');
  stub('sudo', `echo "$*" >> "$LOG"
shift
case "$*" in
  'docker compose ps -q frontend') echo container ;;
  'docker run --rm --entrypoint node '*) echo 24 ;;
  'docker image inspect --format {{index .Config.Labels "org.opencontainers.image.revision"}} '*) echo '${'c'.repeat(40)}' ;;
  'docker inspect --format {{.Config.Image}} container') echo app:current ;;
  'docker inspect --format {{.Image}} container')
    if [[ -f "$STATE" ]]; then echo '${candidate}'; elif [[ "$MODE" == stale_image || ( "$MODE" == post_copy_stale && -f "$COPIED" ) ]]; then echo '${candidate}'; else echo '${old}'; fi ;;
  'docker image inspect --format {{.Id}} aigc-frontend:'*) echo '${candidate}' ;;
  'docker compose up -d --no-deps --no-build frontend') touch "$STATE" ;;
esac
exit 0`);
  stub('curl', `if [[ "$MODE" == health_failure ]]; then exit 1; fi
while [[ $# -gt 0 ]]; do
  if [[ "$1" == -o ]]; then shift; echo '<html>healthy</html>' > "$1"; fi
  shift
done`);
  const helper = join(root, 'helper.sh');
  writeFileSync(helper, readFileSync('deploy/update-frontend.sh', 'utf8').replaceAll('/opt/aigc-prompt', root));
  const log = join(root, 'calls');
  try {
    const result = spawnSync('bash', [helper, release, old, 'c'.repeat(40)], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, MODE: mode, LOG: log, STATE: join(root, 'state'), COPIED: join(root, 'copied') } });
    expect(result.status, result.stderr).toBe(status);
    const calls = readFileSync(log, 'utf8');
    if (mode === 'success') expect(result.stdout).toContain('Frontend deployed');
    if (mode === 'health_failure') {
      expect(calls).toContain(`docker tag ${old} app:current`);
      expect(calls.match(/nginx -s reload/g)).toHaveLength(2);
    }
    if (mode === 'stale_image') expect(calls).not.toContain('docker build');
    if (mode === 'post_copy_stale') expect(calls).not.toContain('docker compose up');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

it('uploads only committed production source, excluding reference screenshots', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const archiveLine = workflow.split('\n').find((line) => line.includes('git archive'))!;
  expect(archiveLine).toContain('git archive "$GITHUB_SHA"');
  for (const path of ['Dockerfile', '.dockerignore', 'package-lock.json', 'next.config.ts', 'messages', 'public', 'src', 'deploy']) expect(archiveLine).toContain(path);
  expect(archiveLine).not.toContain('docs');
  expect(archiveLine).not.toContain('e2e');
  expect(workflow).toContain('du -b release/runtime.tar.gz release/source.tar.gz');
});
