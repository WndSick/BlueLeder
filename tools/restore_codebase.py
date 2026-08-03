#!/usr/bin/env python3
"""Safely reconstruct a source tree from a BLUECODEBASE bundle."""

from __future__ import annotations

import argparse
import base64
import hashlib
import os
import re
import stat
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


MAGIC = b"# BLUECODEBASE_BUNDLE_V1\n"
FILE_HEADER = re.compile(rb"# ===== FILE: ([^\r\n]+) =====\n")


@dataclass(frozen=True)
class Entry:
    path: str
    mode: int
    encoding: str
    original_size: int
    checksum: str
    payload: bytes


def read_line(stream, label: str) -> bytes:
    line = stream.readline()
    if not line:
        raise ValueError(f"Unexpected end of bundle while reading {label}.")
    return line


def header_value(line: bytes, prefix: bytes, label: str) -> str:
    if not line.startswith(prefix) or not line.endswith(b"\n"):
        raise ValueError(f"Invalid {label} header.")
    return line[len(prefix):-1].decode("utf-8")


def safe_relative_path(raw_path: str) -> PurePosixPath:
    path = PurePosixPath(raw_path)
    if path.is_absolute() or not path.parts:
        raise ValueError(f"Unsafe absolute or empty path: {raw_path!r}")
    if any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError(f"Unsafe traversal path: {raw_path!r}")
    if "\x00" in raw_path or "\\" in raw_path:
        raise ValueError(f"Unsafe path characters: {raw_path!r}")
    return path


def read_entries(bundle_path: Path) -> list[Entry]:
    entries: list[Entry] = []
    seen: set[str] = set()
    with bundle_path.open("rb") as stream:
        if stream.readline() != MAGIC:
            raise ValueError("Not a BLUECODEBASE_BUNDLE_V1 file.")
        # Read the bundle-level comment header until the first blank line.
        while True:
            line = read_line(stream, "bundle header")
            if line == b"\n":
                break
            if not line.startswith(b"# "):
                raise ValueError("Invalid bundle-level comment header.")
        while True:
            position = stream.tell()
            line = stream.readline()
            if not line:
                raise ValueError("Bundle end marker is missing.")
            if line == b"# ===== END BLUECODEBASE BUNDLE =====\n":
                break
            match = FILE_HEADER.fullmatch(line)
            if not match:
                raise ValueError(f"Invalid file header at byte {position}.")
            raw_path = match.group(1).decode("utf-8")
            safe_relative_path(raw_path)
            if raw_path in seen:
                raise ValueError(f"Duplicate bundle path: {raw_path}")
            seen.add(raw_path)
            mode = int(header_value(read_line(stream, "mode"), b"# MODE: ", "mode"), 8)
            encoding = header_value(
                read_line(stream, "encoding"), b"# ENCODING: ", "encoding"
            )
            original_size = int(
                header_value(
                    read_line(stream, "original size"),
                    b"# ORIGINAL-SIZE: ",
                    "original size",
                )
            )
            payload_size = int(
                header_value(
                    read_line(stream, "payload size"),
                    b"# PAYLOAD-SIZE: ",
                    "payload size",
                )
            )
            checksum = header_value(
                read_line(stream, "checksum"), b"# SHA256: ", "checksum"
            )
            if not re.fullmatch(r"[0-9a-f]{64}", checksum):
                raise ValueError(f"Invalid SHA-256 for {raw_path}.")
            if read_line(stream, "content marker") != b"# ===== CONTENT =====\n":
                raise ValueError(f"Missing content marker for {raw_path}.")
            payload = stream.read(payload_size)
            if len(payload) != payload_size:
                raise ValueError(f"Truncated payload for {raw_path}.")
            if stream.read(len(b"\n# ===== END FILE =====\n")) != b"\n# ===== END FILE =====\n":
                raise ValueError(f"Missing end marker for {raw_path}.")
            separator_or_end = read_line(stream, "entry separator")
            if separator_or_end == b"# ===== END BLUECODEBASE BUNDLE =====\n":
                entries.append(
                    Entry(raw_path, mode, encoding, original_size, checksum, payload)
                )
                break
            if separator_or_end != b"\n":
                raise ValueError(f"Invalid separator after {raw_path}.")
            entries.append(Entry(raw_path, mode, encoding, original_size, checksum, payload))
    return entries


def decode_entry(entry: Entry) -> bytes:
    if entry.encoding == "utf-8":
        entry.payload.decode("utf-8")
        data = entry.payload
    elif entry.encoding == "base64":
        data = base64.b64decode(entry.payload, validate=True)
    elif entry.encoding == "symlink":
        entry.payload.decode("utf-8")
        data = entry.payload
    else:
        raise ValueError(f"Unsupported encoding {entry.encoding!r} for {entry.path}.")
    if len(data) != entry.original_size:
        raise ValueError(f"Size check failed for {entry.path}.")
    if hashlib.sha256(data).hexdigest() != entry.checksum:
        raise ValueError(f"Checksum check failed for {entry.path}.")
    return data


def ensure_empty_target(target: Path) -> None:
    if target.exists():
        if not target.is_dir():
            raise ValueError(f"Target exists and is not a directory: {target}")
        if any(target.iterdir()):
            raise ValueError(
                f"Target directory is not empty: {target}. "
                "Use a new or empty directory to avoid overwriting files."
            )
    else:
        target.mkdir(parents=True)


def restore(bundle_path: Path, target: Path) -> int:
    entries = read_entries(bundle_path)
    ensure_empty_target(target)
    target_root = target.resolve()
    for entry in entries:
        relative = safe_relative_path(entry.path)
        destination = target.joinpath(*relative.parts)
        resolved_parent = destination.parent.resolve()
        if target_root != resolved_parent and target_root not in resolved_parent.parents:
            raise ValueError(f"Path escapes target directory: {entry.path}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        data = decode_entry(entry)
        if entry.encoding == "symlink":
            link_target = data.decode("utf-8")
            if os.path.isabs(link_target):
                raise ValueError(f"Absolute symlink target rejected: {entry.path}")
            destination.symlink_to(link_target)
        else:
            destination.write_bytes(data)
            os.chmod(destination, stat.S_IMODE(entry.mode))
    # Re-read the written results before reporting success.
    for entry in entries:
        destination = target.joinpath(*PurePosixPath(entry.path).parts)
        if entry.encoding == "symlink":
            written = os.readlink(destination).encode("utf-8")
        else:
            written = destination.read_bytes()
        if hashlib.sha256(written).hexdigest() != entry.checksum:
            raise ValueError(f"Post-write verification failed for {entry.path}.")
    return len(entries)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path, help="Path to codebase_bundle.txt")
    parser.add_argument("target", type=Path, help="New or empty destination directory")
    args = parser.parse_args()
    try:
        count = restore(args.bundle.resolve(), args.target.resolve())
    except (OSError, ValueError) as error:
        print(f"Restore failed: {error}", file=sys.stderr)
        return 1
    print(f"Restored {count} files into {args.target.resolve()}")
    print("Every file passed SHA-256 verification after writing.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
