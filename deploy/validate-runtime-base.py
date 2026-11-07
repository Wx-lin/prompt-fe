#!/usr/bin/env python3
import gzip
import hashlib
import io
import json
import pathlib
import posixpath
import sys
import tarfile
import tempfile
from contextlib import ExitStack

if len(sys.argv) not in (3, 4):
    raise SystemExit('Usage: validate-runtime-base.py ARCHIVE IMAGE_ID [NORMALIZED_ARCHIVE]')
archive_path, expected_id = sys.argv[1:3]
normalized_output = sys.argv[3] if len(sys.argv) == 4 else None
if normalized_output and pathlib.Path(archive_path).resolve() == pathlib.Path(normalized_output).resolve():
    raise SystemExit('Input and output archive must differ')
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

    if 'index.json' in members and not normalized_output:
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
    # Some Docker-format writers include compatibility layer.tar symlinks.
    # They may only point to one of the verified regular layers in this archive.
    for name, item in members.items():
        if item.issym():
            if item.linkname.startswith('/'):
                fail('absolute symlink')
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), item.linkname))
            if target not in layer_names or not members[target].isfile():
                fail('unsafe symlink target')
    # Verify ordinary archives directly; during CI normalization, decompress
    # OCI gzip blobs and hash the uncompressed data against trusted diff_ids.
    # Bound scratch usage even when an untrusted archive is supplied.
    with ExitStack() as stack:
        normalized_layers = []
        total_size = 0
        for index, (name, digest) in enumerate(zip(layers, diff_ids, strict=True)):
            layer = regular(name)
            if normalized_output:
                signature = layer.read(2)
                layer.seek(0)
                stream = gzip.GzipFile(fileobj=layer) if signature == b'\x1f\x8b' else layer
                temp = stack.enter_context(tempfile.TemporaryFile())
                hashed = hashlib.sha256()
                size = 0
                while chunk := stream.read(1024 * 1024):
                    size += len(chunk)
                    total_size += len(chunk)
                    if size > 1024**3 or total_size > 2 * 1024**3:
                        fail('uncompressed layers exceed size limit')
                    hashed.update(chunk)
                    temp.write(chunk)
                computed = hashed.hexdigest()
                temp.seek(0)
                normalized_layers.append((f'layers/{index:04d}.tar', temp, size))
            else:
                computed = sha256_file(layer)
            if not isinstance(digest, str) or digest != 'sha256:' + computed:
                fail('root filesystem layer digest mismatch')
        if normalized_output:
            # Construct a fresh archive from validated content only. In
            # particular, no OCI index, annotations, repositories, or links
            # can be passed to docker load by this path.
            with tarfile.open(normalized_output, 'w:gz', compresslevel=1) as clean:
                config_entry = tarfile.TarInfo(config_name)
                config_entry.size = len(config_data)
                clean.addfile(config_entry, io.BytesIO(config_data))
                for name, stream, size in normalized_layers:
                    layer_entry = tarfile.TarInfo(name)
                    layer_entry.size = size
                    clean.addfile(layer_entry, stream)
                clean_manifest = json.dumps([{'Config': config_name, 'RepoTags': [], 'Layers': [entry[0] for entry in normalized_layers]}]).encode()
                manifest_entry = tarfile.TarInfo('manifest.json')
                manifest_entry.size = len(clean_manifest)
                clean.addfile(manifest_entry, io.BytesIO(clean_manifest))
