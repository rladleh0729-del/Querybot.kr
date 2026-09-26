"""Repackage the known QueryBot GUI without changing its application bytecode.

Requires Python 3.12, pefile and PyInstaller. On Windows, adds product metadata.
Every retained archive item is byte-verified against the input before delivery.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
from pathlib import Path, PureWindowsPath
import struct
import sys
import zlib

import pefile
from PyInstaller.archive.readers import CArchiveReader

INPUT_SHA256 = "0274936a1a2bee5b4add1cfc7571a116411a319cdb5e0abb4705cd4b14ed63b5"
MAGIC = b"MEI\x0c\x0b\x0a\x0b\x0e"
COOKIE = struct.Struct("!8sIIII64s")
ENTRY = struct.Struct("!IIIIBc")


def sha256(path):
    with Path(path).open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


class Archive:
    def __init__(self, path):
        self.path = Path(path)
        self.data = self.path.read_bytes()
        pos = self.data.rfind(MAGIC)
        if pos < 0 or pos + COOKIE.size != len(self.data):
            raise ValueError("Expected an unsigned PyInstaller EXE with a final cookie")
        magic, length, offset, size, self.pyver, self.pylib = COOKIE.unpack_from(self.data, pos)
        self.start = pos + COOKIE.size - length
        if self.start <= 0 or offset + size + COOKIE.size != length:
            raise ValueError("Invalid archive bounds")
        self.entries = []
        cursor, end = self.start + offset, self.start + offset + size
        while cursor < end:
            length, off, compressed, raw, flag, kind = ENTRY.unpack_from(self.data, cursor)
            if length < ENTRY.size + 1 or cursor + length > end or off + compressed > offset:
                raise ValueError("Invalid archive entry")
            name = self.data[cursor + ENTRY.size:cursor + length].rstrip(b"\0").decode("utf-8")
            self.entries.append(dict(name=name, offset=off, compressed=compressed,
                                     raw=raw, flag=flag, kind=kind.decode("ascii")))
            cursor += length
        if cursor != end or len({e['name'] for e in self.entries}) != len(self.entries):
            raise ValueError("Invalid archive TOC")
        self.by_name = {e["name"]: e for e in self.entries}

    def compressed_bytes(self, entry):
        start = self.start + entry["offset"]
        return self.data[start:start + entry["compressed"]]

    def extract(self, entry):
        data = self.compressed_bytes(entry)
        data = zlib.decompress(data) if entry["flag"] else data
        if len(data) != entry["raw"]:
            raise ValueError(f"Wrong uncompressed length: {entry['name']}")
        return data


def imports(data):
    with pefile.PE(data=data, fast_load=True) as pe:
        pe.parse_data_directories(directories=[
            pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_IMPORT"],
            pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_DELAY_IMPORT"],
        ])
        return {item.dll.decode("ascii").lower()
                for attr in ("DIRECTORY_ENTRY_IMPORT", "DIRECTORY_ENTRY_DELAY_IMPORT")
                for item in getattr(pe, attr, [])}


def select_entries(archive):
    reader = CArchiveReader(str(archive.path))
    pyz_names = set(reader.open_embedded_archive("PYZ.pyz").toc)
    removed = {}
    for e in archive.entries:
        name = e["name"].replace("\\", "/")
        if name.startswith("PySide6/qml/"):
            removed[e["name"]] = "Unused QML modules in this QWidget application"
        elif name.startswith("PySide6/plugins/qmltooling/"):
            removed[e["name"]] = "QML debugging plugins"
        elif name == "PySide6/plugins/platforminputcontexts/qtvirtualkeyboardplugin.dll":
            removed[e["name"]] = "Unused QML virtual-keyboard plugin; native Windows input remains"
        elif name.startswith("PySide6/resources/") and (".debug.pak" in name or ".debug.bin" in name):
            release_name = e["name"].replace(".debug.", ".")
            if release_name not in archive.by_name:
                raise ValueError(f"Missing release counterpart: {release_name}")
            removed[e["name"]] = "Debug-only resource with retained release counterpart"
        elif name.startswith("yt_dlp/") and name.endswith(".py"):
            module = name[:-3].replace("/", ".")
            if module.endswith(".__init__"):
                module = module[:-9]
            if module in pyz_names:
                removed[e["name"]] = "Duplicate Python source; same module remains in PYZ"

    # All extension modules, helper executables and non-QML plugins are roots.
    # Only Qt6 DLLs may be pruned; all other dependencies remain untouched.
    binaries = {e["name"]: e for e in archive.entries
                if e["kind"] == "b" and e["name"] not in removed}
    by_basename = collections.defaultdict(set)
    dependencies = {}
    for name, entry in binaries.items():
        by_basename[PureWindowsPath(name).name.lower()].add(name)
        data = archive.extract(entry)
        if data.startswith(b"MZ"):
            dependencies[name] = imports(data)
    qt_dlls = {n for n in binaries
               if PureWindowsPath(n).parent == PureWindowsPath("PySide6")
               and PureWindowsPath(n).name.lower().startswith("qt6") and n.lower().endswith(".dll")}
    roots = set(binaries) - qt_dlls
    # Retain commonly dynamically loaded rendering libraries conservatively.
    dynamic_names = {"qt6shadertools.dll", "qt6opengl.dll", "qt6svg.dll"}
    roots |= {n for n in qt_dlls if PureWindowsPath(n).name.lower() in dynamic_names}
    reachable, pending = set(), list(roots)
    while pending:
        name = pending.pop()
        if name in reachable:
            continue
        reachable.add(name)
        for dep in dependencies.get(name, set()):
            pending.extend(by_basename.get(dep, set()) - reachable)
    for name in sorted(qt_dlls - reachable):
        removed[name] = "Qt DLL unused by retained native imports, delay imports and dynamic roots"
    missing = []
    original_by_basename = collections.defaultdict(set)
    for e in archive.entries:
        original_by_basename[PureWindowsPath(e["name"]).name.lower()].add(e["name"])
    for name, deps in dependencies.items():
        if name in removed:
            continue
        for dep in deps:
            original = original_by_basename.get(dep, set())
            if original and not original.difference(removed):
                missing.append([name, dep])
    if missing:
        raise ValueError(f"Removed required bundled DLLs: {missing}")
    return [e for e in archive.entries if e["name"] not in removed], removed


def product_metadata(prefix_path):
    from PyInstaller.utils.win32.versioninfo import (
        FixedFileInfo, StringFileInfo, StringStruct, StringTable,
        VarFileInfo, VarStruct, VSVersionInfo, write_version_info_to_executable,
    )
    info = VSVersionInfo(
        ffi=FixedFileInfo(filevers=(2026, 9, 26, 1), prodvers=(2026, 9, 26, 1),
                         mask=0x3F, flags=0, OS=0x40004, fileType=1, subtype=0, date=(0, 0)),
        kids=[StringFileInfo([StringTable("040904B0", [
            StringStruct("CompanyName", "QueryBot"),
            StringStruct("FileDescription", "QueryBot Audio Converter"),
            StringStruct("FileVersion", "2026.9.26.1"),
            StringStruct("InternalName", "QueryBotAudioGUI"),
            StringStruct("OriginalFilename", "QueryBotAudioGUI_optimized.exe"),
            StringStruct("ProductName", "QueryBot Audio Converter"),
            StringStruct("ProductVersion", "2026.9.26.1"),
            StringStruct("Comments", "Packaging optimization; application code unchanged"),
        ])]), VarFileInfo([VarStruct("Translation", [1033, 1200])])],
    )
    write_version_info_to_executable(str(prefix_path), info)


def optimize(source, output, report_path, add_metadata=False):
    source, output, report_path = map(Path, (source, output, report_path))
    if source.resolve() == output.resolve():
        raise ValueError("The source EXE must be preserved")
    actual = sha256(source)
    if actual != INPUT_SHA256:
        raise ValueError(f"This optimization is audited for one input SHA256, got {actual}")
    archive = Archive(source)
    kept, removed = select_entries(archive)
    prefix = archive.data[:archive.start]
    output.parent.mkdir(parents=True, exist_ok=True)
    if add_metadata:
        if sys.platform != "win32":
            raise RuntimeError("Product resource updates require Windows")
        prefix_path = output.with_suffix(".bootloader.tmp.exe")
        try:
            prefix_path.write_bytes(prefix)
            product_metadata(prefix_path)
            prefix = prefix_path.read_bytes()
        finally:
            prefix_path.unlink(missing_ok=True)
    with output.open("wb") as f:
        f.write(prefix)
        toc, offset = [], 0
        for e in kept:
            payload = archive.compressed_bytes(e)
            f.write(payload)
            name = e["name"].encode("utf-8") + b"\0"
            length = (ENTRY.size + len(name) + 15) // 16 * 16
            toc.append(ENTRY.pack(length, offset, len(payload), e["raw"], e["flag"],
                                  e["kind"].encode("ascii")) + name.ljust(length - ENTRY.size, b"\0"))
            offset += len(payload)
        toc_bytes = b"".join(toc)
        f.write(toc_bytes)
        f.write(COOKIE.pack(MAGIC, offset + len(toc_bytes) + COOKIE.size,
                            offset, len(toc_bytes), archive.pyver, archive.pylib))
    with pefile.PE(str(output), fast_load=True) as pe:
        checksum_offset = pe.OPTIONAL_HEADER.get_field_absolute_offset("CheckSum")
        checksum = pe.generate_checksum()
    with output.open("r+b") as f:
        f.seek(checksum_offset)
        f.write(struct.pack("<I", checksum))
    new = Archive(output)
    official = CArchiveReader(str(output))
    verified = 0
    for e in kept:
        current = new.by_name[e["name"]]
        if archive.compressed_bytes(e) != new.compressed_bytes(current):
            raise ValueError(f"Changed payload: {e['name']}")
        if e["kind"] != "o" and official.extract(e["name"]) != archive.extract(e):
            raise ValueError(f"Official reader mismatch: {e['name']}")
        verified += 1
    groups = collections.defaultdict(lambda: {"count": 0, "compressed_bytes": 0, "uncompressed_bytes": 0})
    for name, reason in removed.items():
        entry = archive.by_name[name]
        groups[reason]["count"] += 1
        groups[reason]["compressed_bytes"] += entry["compressed"]
        groups[reason]["uncompressed_bytes"] += entry["raw"]
    report = dict(input_sha256=actual, output_sha256=sha256(output),
                  input_bytes=source.stat().st_size, output_bytes=output.stat().st_size,
                  input_uncompressed_bytes=sum(e["raw"] for e in archive.entries),
                  output_uncompressed_bytes=sum(e["raw"] for e in kept),
                  input_entries=len(archive.entries), output_entries=len(kept),
                  byte_identical_retained_entries=verified, application_code_unchanged=True,
                  product_metadata_added=add_metadata, authenticode_signed=False,
                  webengine_retained=True, ffmpeg_retained=True, all_ytdlp_extractors_retained=True,
                  removed_groups=dict(groups), removed_entries=removed,
                  validation={"archive_and_payloads": "passed", "native_dependency_closure": "passed",
                              "windows_runtime": "not yet run", "live_youtube_conversion": "not run"})
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "removed_entries"}, indent=2))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("output")
    parser.add_argument("--report", required=True)
    parser.add_argument("--metadata", action="store_true")
    args = parser.parse_args()
    optimize(args.source, args.output, args.report, args.metadata)
