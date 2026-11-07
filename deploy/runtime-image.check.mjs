import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync, symlinkSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import test from "node:test";

const helper = resolve("deploy/build-runtime-image.sh");
const revision = "a".repeat(40);

function fixture({ archiveTag = null, architecture = "amd64", runtimeInfo = "v24.21.0 x64 1000 1000", badConfig = false, badLayer = false, escapeLink = false, ociIndex = false, gzipLayer = false, preexisting = false, tagCollision = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "aigc-runtime-test-"));
  const bin = join(root, "bin");
  const incoming = join(root, "incoming");
  const archive = join(root, "archive");
  mkdirSync(bin); mkdirSync(incoming); mkdirSync(join(incoming, "runtime")); mkdirSync(archive);
  const layer = "example layer";
  const diffId = `sha256:${createHash("sha256").update(layer).digest("hex")}`;
  const config = JSON.stringify({ architecture, os: "linux", config: {}, rootfs: { type: "layers", diff_ids: [diffId] } });
  const hash = createHash("sha256").update(config).digest("hex");
  const id = `sha256:${hash}`;
  writeFileSync(join(archive, `${hash}.json`), badConfig ? "corrupted" : config);
  writeFileSync(join(archive, "layer.tar"), gzipLayer ? gzipSync(badLayer ? "tampered layer" : layer) : (badLayer ? "tampered layer" : layer));
  if (ociIndex) {
    writeFileSync(join(archive, "index.json"), JSON.stringify({schemaVersion:2,manifests:[{annotations:{"io.containerd.image.name":"other:tag","org.opencontainers.image.ref.name":"other"}}]}));
    writeFileSync(join(archive, "oci-layout"), '{"imageLayoutVersion":"1.0.0"}');
    writeFileSync(join(archive, "untrusted-oci-blob"), "ignored");
  }
  if (escapeLink) symlinkSync("../../outside", join(archive, "escape"));
  writeFileSync(join(archive, "manifest.json"), JSON.stringify([{ Config: `${hash}.json`, RepoTags: archiveTag ? [archiveTag] : [], Layers: ["layer.tar"] }]));
  const archiveResult = spawnSync("tar", ["-czf", join(incoming, "base-image.tar.gz"), "-C", archive, "."]);
  assert.equal(archiveResult.status, 0);
  const log = join(root, "docker.log");
  const state = join(root, "loaded");
  const fakeSudo = `#!/bin/sh\n[ "$1" = '-n' ] || exit 91\nshift\nexec "$@"\n`;
  const fakeDocker = `#!/usr/bin/env node\nconst fs=require('fs'); const a=process.argv.slice(2); fs.appendFileSync(process.env.DOCKER_LOG,JSON.stringify(a)+'\\n'); if(a[0]==='load'){fs.writeFileSync(process.env.DOCKER_STATE,'1');process.exit(0)} if(a[0]==='image'&&a[1]==='inspect'){if(a.at(-1).startsWith('aigc-frontend-base:')&&!fs.existsSync(process.env.DOCKER_STATE+'.tag'))process.exit(1);if(!fs.existsSync(process.env.DOCKER_STATE))process.exit(1);console.log(a.at(-1).startsWith('aigc-frontend-base:') ? (process.env.TAG_ID||process.env.BASE_ID) : process.env.BASE_ID);process.exit(0)} if(a[0]==='tag'){fs.writeFileSync(process.env.DOCKER_STATE+'.tag','1');process.exit(0)} if(a[0]==='image'&&a[1]==='rm'){fs.unlinkSync(process.env.DOCKER_STATE+'.tag');process.exit(0)} if(a[0]==='run'){console.log(process.env.RUNTIME_INFO);process.exit(0)} if(a[0]==='build')process.exit(0);process.exit(92);\n`;
  writeFileSync(join(bin, "sudo"), fakeSudo); chmodSync(join(bin, "sudo"), 0o755);
  writeFileSync(join(bin, "docker"), fakeDocker); chmodSync(join(bin, "docker"), 0o755);
  if (preexisting) writeFileSync(state, "1");
  if (tagCollision) writeFileSync(state + ".tag", "1");
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, DOCKER_LOG: log, DOCKER_STATE: state,
    BASE_ID: id, TAG_ID: tagCollision ? `sha256:${"b".repeat(64)}` : id, RUNTIME_INFO: runtimeInfo };
  return { incoming, id, log, env };
}

function run(f, expectedId = f.id) {
  return spawnSync("bash", [helper, f.incoming, "aigc-frontend:frontend-123-456-1", revision, expectedId], { env: f.env, encoding: "utf8" });
}

function calls(f) { return existsSync(f.log) ? readFileSync(f.log, "utf8").trim().split("\n").map(JSON.parse) : []; }

test("builds offline from the validated clean pinned base", () => {
  const f = fixture();
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  const dockerfile = readFileSync(join(f.incoming, "runtime", "Dockerfile"), "utf8");
  assert.match(dockerfile, new RegExp(`^FROM aigc-frontend-base:node-24-21-${f.id.slice(7, 19)}\\n`));
  assert.doesNotMatch(dockerfile, /rollback-|rm -rf \/app/);
  const build = calls(f).find(a => a[0] === "build");
  assert.ok(build?.includes("--pull=false") && build.includes("--network=none"));
  assert.match(dockerfile, new RegExp(`org\\.opencontainers\\.image\\.revision="${revision}"`));
});

test("rejects a mismatched or malformed base archive before loading it", () => {
  for (const opts of [{ archiveTag: "other:tag" }, { architecture: "arm64" }, { badConfig: true }, { badLayer: true }, { escapeLink: true }, { ociIndex: true }]) {
    const f = fixture(opts); const result = run(f);
    assert.notEqual(result.status, 0);
    assert.equal(calls(f).some(a => a[0] === "load" || a[0] === "build"), false);
  }
});

test("rejects an archive whose config is not the pinned image ID", () => {
  const f = fixture();
  assert.notEqual(run(f, `sha256:${"b".repeat(64)}`).status, 0);
  assert.equal(calls(f).some(a => a[0] === "load" || a[0] === "build"), false);
});

test("refuses a base with the wrong Node patch or node user before building", () => {
  const f = fixture({ runtimeInfo: "v24.22.2 x64 1000 1000" });
  assert.notEqual(run(f).status, 0);
  assert.equal(calls(f).some(a => a[0] === "build"), false);
  const wrongUser = fixture({ runtimeInfo: "v24.21.0 x64 0 0" });
  assert.notEqual(run(wrongUser).status, 0);
  assert.equal(calls(wrongUser).some(a => a[0] === "build"), false);
});


test("reuses the exact local base without loading another archive", () => {
  const f = fixture({ preexisting: true });
  assert.equal(run(f).status, 0);
  assert.equal(calls(f).some(a => a[0] === "load"), false);
});

test("refuses a conflicting base tag without replacing it", () => {
  const f = fixture({ preexisting: true, tagCollision: true });
  assert.notEqual(run(f).status, 0);
  assert.equal(calls(f).some(a => a[0] === "tag" || a[0] === "build" || (a[0] === "image" && a[1] === "rm")), false);
});


test("normalizes a Docker OCI archive to validated untagged Docker format", () => {
  const f = fixture({ ociIndex: true, gzipLayer: true });
  const normalized = join(f.incoming, "normalized.tar.gz");
  const result = spawnSync("python3", [resolve("deploy/validate-runtime-base.py"), join(f.incoming, "base-image.tar.gz"), f.id, normalized], {encoding:"utf8"});
  assert.equal(result.status, 0, result.stderr);
  const list = spawnSync("tar", ["-tzf", normalized], {encoding:"utf8"});
  assert.equal(list.status, 0, list.stderr);
  assert.doesNotMatch(list.stdout, /index.json|oci-layout|untrusted-oci-blob|repositories/);
  const exportedManifest = spawnSync("tar", ["-xOzf", normalized, "manifest.json"], {encoding:"utf8"});
  assert.equal(exportedManifest.status, 0, exportedManifest.stderr);
  const manifest = JSON.parse(exportedManifest.stdout);
  assert.deepEqual(manifest[0].RepoTags, []);
  assert.deepEqual(manifest[0].Layers, ["layers/0000.tar"]);
  const exportedLayer = spawnSync("tar", ["-xOzf", normalized, "layers/0000.tar"], {encoding:"utf8"});
  assert.equal(exportedLayer.stdout, "example layer");
  copyFileSync(normalized, join(f.incoming, "base-image.tar.gz"));
  assert.equal(run(f).status, 0);
  assert.ok(calls(f).some(a => a[0] === "load"));
});

test("normalization rejects altered layers and tagged Docker manifests", () => {
  for (const options of [{ociIndex:true,badLayer:true,gzipLayer:true},{ociIndex:true,archiveTag:"other:tag"}]) {
    const f = fixture(options);
    const result = spawnSync("python3", [resolve("deploy/validate-runtime-base.py"), join(f.incoming, "base-image.tar.gz"), f.id, join(f.incoming, "normalized.tar.gz")], {encoding:"utf8"});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /layer digest mismatch|must not contain image tags/);
  }
});
