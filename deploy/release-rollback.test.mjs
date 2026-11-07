import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const original = readFileSync(resolve('deploy/update-frontend.sh'), 'utf8');
const oldId = `sha256:${'a'.repeat(64)}`;
const newId = `sha256:${'b'.repeat(64)}`;
const revision = 'c'.repeat(40);
function setup(failBuild) {
  const root = mkdtempSync(join(tmpdir(), 'aigc-rollback-test-'));
  const base = join(root, 'server'), bin = join(root, 'bin'), release = 'frontend-123-456-1';
  const incoming = join(base, 'releases', release), frontend = join(base, 'frontend');
  const runtime = join(root, 'runtime'), source = join(root, 'source');
  for (const dir of [bin, incoming, frontend, join(runtime, 'app', 'public'), source]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(frontend, 'app.txt'), 'original');
  writeFileSync(join(runtime, 'app', 'server.js'), 'test');
  writeFileSync(join(source, 'app.txt'), 'replacement');
  for (const [name, path] of [['runtime', runtime], ['source', source]]) assert.equal(spawnSync('tar', ['-czf', join(incoming, `${name}.tar.gz`), '-C', path, '.']).status, 0);
  cpSync(resolve('deploy/check-release-space.sh'), join(incoming, 'check-release-space.sh'));
  writeFileSync(join(incoming, 'runtime-base.env'), `AIGC_RUNTIME_BASE_ID=${oldId}\n`);
  writeFileSync(join(incoming, 'build-runtime-image.sh'), '#!/bin/sh\nprintf called > "$HELPER_MARKER"\n[ "$FAIL_BUILD" != yes ]\n');
  const files = ['runtime.tar.gz', 'source.tar.gz', 'check-release-space.sh', 'runtime-base.env', 'build-runtime-image.sh'];
  writeFileSync(join(incoming, 'checksums.txt'), files.map(f => `${createHash('sha256').update(readFileSync(join(incoming, f))).digest('hex')}  ${f}\n`).join(''));
  const fake = (name, content) => { const path = join(bin, name); writeFileSync(path, content); chmodSync(path, 0o755); };
  fake('sudo', '#!/bin/sh\n[ "$1" = -n ] && shift\nexec "$@"\n');
  fake('flock', '#!/bin/sh\nexit 0\n');
  fake('stat', '#!/bin/sh\necho 1\n');
  fake('df', '#!/bin/sh\nprintf "Avail\\n100000000000\\n"\n');
  fake('du', '#!/bin/sh\nprintf "100\\t%s\\n" "$2"\n');
  fake('sleep', '#!/bin/sh\nexit 0\n');
  fake('curl', '#!/bin/sh\nexit 1\n');
  fake('rsync', `#!/usr/bin/env node
const fs=require('fs');const a=process.argv.slice(2);const src=a.at(-2),dst=a.at(-1);fs.rmSync(dst,{recursive:true,force:true});fs.cpSync(src,dst,{recursive:true});
`);
  fake('docker', `#!/usr/bin/env node
const fs=require('fs');const a=process.argv.slice(2);fs.appendFileSync(process.env.DOCKER_LOG,JSON.stringify(a)+'\\n');const state=process.env.STATE;
if(a[0]==='info'){console.log(process.env.SERVER);process.exit()}
if(a[0]==='compose'){if(a[1]==='ps')console.log('container');process.exit()}
if(a[0]==='inspect'){console.log(a[2].includes('Config.Image')?'aigc-frontend:live':fs.readFileSync(state,'utf8'));process.exit()}
if(a[0]==='run'){console.log('24');process.exit()}
if(a[0]==='image'&&a[1]==='inspect'){console.log(a[3].includes('Labels')?process.env.REVISION:process.env.NEW_ID);process.exit()}
if(a[0]==='tag'){if(a[2]==='aigc-frontend:live')fs.writeFileSync(state,a[1].startsWith('sha256:')?a[1]:process.env.NEW_ID);process.exit()}
process.exit(1);
`);
  const state = join(root, 'image-state'), log = join(root, 'docker.log');
  writeFileSync(state, oldId);
  const script = join(root, 'update.sh');
  writeFileSync(script, original.replaceAll('/opt/aigc-prompt', base));
  return { script, root, frontend, state, log, release, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAIL_BUILD: failBuild ? 'yes' : 'no', HELPER_MARKER: join(root, 'helper-called'), DOCKER_LOG: log, STATE: state, SERVER: base, REVISION: revision, NEW_ID: newId } };
}
for (const [name, failBuild] of [['build fails before switch', true], ['health check fails after switch', false]]) {
  test(`keeps or restores the old image and source when ${name}`, () => {
    const f = setup(failBuild);
    const result = spawnSync('bash', [f.script, f.release, oldId, revision], { env: f.env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.ok(existsSync(join(f.root, 'helper-called')), result.stdout + result.stderr);
    assert.equal(readFileSync(join(f.frontend, 'app.txt'), 'utf8'), 'original');
    assert.equal(readFileSync(f.state, 'utf8'), oldId);
    const calls = readFileSync(f.log, 'utf8').trim().split('\n').map(JSON.parse);
    if (failBuild) assert.equal(calls.some(a => a[0] === 'tag' && a[2] === 'aigc-frontend:live'), false);
    else assert.ok(calls.some(a => a[0] === 'tag' && a[1] === oldId && a[2] === 'aigc-frontend:live'), result.stdout + result.stderr);
  });
}
