#!/usr/bin/env python3
import hashlib
import json
import pathlib
import posixpath
import sys
import tarfile

archive_path, expected_id = sys.argv[1:]
expected_hash = expected_id.removeprefix('sha256:')

def fail(message):
    raise SystemExit('Invalid runtime base archive: ' + message)

def normalized(name):
    path = pathlib.PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts:
        fail('unsafe archive path')
    return str(path)

def sha256_file(stream):
    digest = hashlib.sha256()
    while chunk := stream.read(1024 * 1024):
        digest.update(chunk)
    return digest.hexdigest()

with tarfile.open(archive_path, 'r:gz') as archive:
    members = {}
    for item in archive:
        name = normalized(item.name)
        if name in members:
            fail('duplicate archive path')
        if not (item.isfile() or item.isdir() or item.issym()):
            fail('unsupported archive member')
        members[name] = item

    def regular(name, max_size=None):
        item = members.get(normalized(name))
        if item is None or not item.isfile() or (max_size is not None and item.size > max_size):
            fail('missing or invalid archive file')
        return archive.extractfile(item)

    if 'index.json' in members:
        fail('unsupported OCI index; archive must use untagged Docker format')
    manifest = json.load(regular('manifest.json', 1024 * 1024))
    if not isinstance(manifest, list) or len(manifest) != 1:
        fail('archive must contain exactly one image')
    image = manifest[0]
    if image.get('RepoTags') not in (None, []):
        fail('base archive must not contain image tags')
    if 'repositories' in members and json.load(regular('repositories', 1024 * 1024)) != {}:
        fail('base archive must not contain repository tags')
    config_name = normalized(image.get('Config', ''))
    if config_name not in {expected_hash + '.json', 'blobs/sha256/' + expected_hash}:
        fail('image config does not match pinned ID')
    config_data = regular(config_name, 4 * 1024 * 1024).read()
    if hashlib.sha256(config_data).hexdigest() != expected_hash:
        fail('image config digest mismatch')
    config = json.loads(config_data)
    if config.get('os') != 'linux' or config.get('architecture') != 'amd64':
        fail('base must target linux/amd64')
    layers = image.get('Layers')
    diff_ids = config.get('rootfs', {}).get('diff_ids')
    if not isinstance(layers, list) or not layers or not isinstance(diff_ids, list) or len(layers) != len(diff_ids):
        fail('invalid root filesystem layers')
    layer_names = {normalized(name) for name in layers}
    if len(layer_names) != len(layers):
        fail('duplicate root filesystem layer')
    for name, digest in zip(layers, diff_ids, strict=True):
        if not isinstance(digest, str) or digest != 'sha256:' + sha256_file(regular(name)):
            fail('root filesystem layer digest mismatch')
    # Some Docker-format writers include compatibility layer.tar symlinks.
    # They may only point to one of the verified regular layers in this archive.
    for name, item in members.items():
        if item.issym():
            if item.linkname.startswith('/'):
                fail('absolute symlink')
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), item.linkname))
            if target not in layer_names or not members[target].isfile():
                fail('unsafe symlink target')
