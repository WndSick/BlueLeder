#!/usr/bin/env python3
"""Create a single, reversible text bundle of this source tree.

The bundle keeps UTF-8 source files as readable text and stores non-text files
as Base64. Every entry includes its relative path, byte length, Unix mode and
SHA-256 checksum. Files ignored by .gitignore and generated dependency/cache
directories are excluded.
"""

from __future__ import annotations

import argparse
import base64
import fnmatch
import hashlib
import os
import stat
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


MAGIC = b"# BLUECODEBASE_BUNDLE_V1\n"
DEFAULT_BUNDLE = "codebase_bundle.txt"
ALWAYS_EXCLUDED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".vite",
    "__pycache__",
    "node_modules",
}
ALWAYS_EXCLUDED_FILES = {
    DEFAULT_BUNDLE,
    ".DS_Store",
}


@dataclass(frozen=True)
class IgnoreRule:
    pattern: str
    negated: bool
    directory_only: bool
    anchored: bool


def load_ignore_rules(root: Path) -> list[IgnoreRule]:
    ignore_file = root / ".gitignore"
    if not ignore_file.exists():
        return []
    rules: list[IgnoreRule] = []
    for raw_line in ignore_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        negated = line.startswith("!")
        if negated:
            line = line[1:]
        if not line:
            continue
        anchored = line.startswith("/")
        if anchored:
            line = line[1:]
        directory_only = line.endswith("/")
        line = line.rstrip("/")
        if line:
            rules.append(IgnoreRule(line, negated, directory_only, anchored))
    return rules


def rule_matches(rule: IgnoreRule, relative_path: str, is_directory: bool) -> bool:
    if rule.directory_only and not is_directory:
        # A directory rule also ignores every descendant.
        if relative_path == rule.pattern or relative_path.startswith(f"{rule.pattern}/"):
            return True
    path = PurePosixPath(relative_path)
    pattern = rule.pattern
    if rule.anchored:
        return fnmatch.fnmatchcase(relative_path, pattern) or relative_path.startswith(f"{pattern}/")
    if "/" in pattern:
        return (
            fnmatch.fnmatchcase(relative_path, pattern)
            or path.match(pattern)
            or relative_path.startswith(f"{pattern}/")
        )
    return any(fnmatch.fnmatchcase(part, pattern) for part in path.parts)


def is_ignored(relative_path: str, is_directory: bool, rules: list[IgnoreRule]) -> bool:
    parts = PurePosixPath(relative_path).parts
    if any(part in ALWAYS_EXCLUDED_DIRS for part in parts):
        return True
    if not is_directory and PurePosixPath(relative_path).name in ALWAYS_EXCLUDED_FILES:
        return True
    ignored = False
    for rule in rules:
        if rule_matches(rule, relative_path, is_directory):
            ignored = not rule.negated
    return ignored


def collect_files(root: Path, bundle_path: Path | None = None) -> list[Path]:
    rules = load_ignore_rules(root)
    selected: list[Path] = []
    resolved_bundle = bundle_path.resolve() if bundle_path else None
    for current_root, directory_names, file_names in os.walk(root, topdown=True):
        current = Path(current_root)
        kept_directories: list[str] = []
        for name in sorted(directory_names):
            candidate = current / name
            relative = candidate.relative_to(root).as_posix()
            if not is_ignored(relative, True, rules):
                kept_directories.append(name)
        directory_names[:] = kept_directories
        for name in sorted(file_names):
            candidate = current / name
            if resolved_bundle and candidate.resolve() == resolved_bundle:
                continue
            relative = candidate.relative_to(root).as_posix()
            if not is_ignored(relative, False, rules):
                selected.append(candidate)
    return sorted(selected, key=lambda path: path.relative_to(root).as_posix())


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def choose_encoding(data: bytes) -> tuple[str, bytes]:
    if b"\x00" in data:
        return "base64", base64.b64encode(data)
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        return "base64", base64.b64encode(data)
    return "utf-8", data


def write_bundle(root: Path, output: Path) -> tuple[int, int]:
    files = collect_files(root, output)
    output.parent.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    with output.open("wb") as bundle:
        bundle.write(MAGIC)
        bundle.write(f"# ROOT-NAME: {root.name}\n".encode("utf-8"))
        bundle.write(f"# FILE-COUNT: {len(files)}\n".encode("utf-8"))
        bundle.write(b"# Headers are comments; UTF-8 file contents follow each header verbatim.\n")
        for file_path in files:
            relative = file_path.relative_to(root).as_posix()
            mode = stat.S_IMODE(file_path.lstat().st_mode)
            if file_path.is_symlink():
                original = os.readlink(file_path).encode("utf-8")
                encoding = "symlink"
                payload = original
            else:
                original = file_path.read_bytes()
                encoding, payload = choose_encoding(original)
            total_bytes += len(original)
            bundle.write(b"\n")
            bundle.write(f"# ===== FILE: {relative} =====\n".encode("utf-8"))
            bundle.write(f"# MODE: {mode:04o}\n".encode("ascii"))
            bundle.write(f"# ENCODING: {encoding}\n".encode("ascii"))
            bundle.write(f"# ORIGINAL-SIZE: {len(original)}\n".encode("ascii"))
            bundle.write(f"# PAYLOAD-SIZE: {len(payload)}\n".encode("ascii"))
            bundle.write(f"# SHA256: {sha256(original)}\n".encode("ascii"))
            bundle.write(b"# ===== CONTENT =====\n")
            bundle.write(payload)
            bundle.write(b"\n# ===== END FILE =====\n")
        bundle.write(b"\n# ===== END BLUECODEBASE BUNDLE =====\n")
    return len(files), total_bytes


def compare_trees(source: Path, restored: Path, bundle_path: Path | None) -> list[str]:
    expected_files = collect_files(source, bundle_path)
    expected = {path.relative_to(source).as_posix(): path for path in expected_files}
    actual_files = collect_files(restored, None)
    actual = {path.relative_to(restored).as_posix(): path for path in actual_files}
    errors: list[str] = []
    for missing in sorted(set(expected) - set(actual)):
        errors.append(f"missing: {missing}")
    for extra in sorted(set(actual) - set(expected)):
        errors.append(f"unexpected: {extra}")
    for relative in sorted(set(expected) & set(actual)):
        source_path = expected[relative]
        restored_path = actual[relative]
        if source_path.is_symlink() != restored_path.is_symlink():
            errors.append(f"type mismatch: {relative}")
            continue
        if source_path.is_symlink():
            if os.readlink(source_path) != os.readlink(restored_path):
                errors.append(f"symlink target mismatch: {relative}")
        elif source_path.read_bytes() != restored_path.read_bytes():
            errors.append(f"content mismatch: {relative}")
        source_mode = stat.S_IMODE(source_path.lstat().st_mode)
        restored_mode = stat.S_IMODE(restored_path.lstat().st_mode)
        if source_mode != restored_mode:
            errors.append(
                f"mode mismatch: {relative} ({source_mode:04o} != {restored_mode:04o})"
            )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Source-code root. Defaults to the parent of this tools directory.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help=f"Bundle path. Defaults to ROOT/{DEFAULT_BUNDLE}.",
    )
    parser.add_argument(
        "--verify-tree",
        type=Path,
        help="Compare a reconstructed tree with the current source instead of packing.",
    )
    args = parser.parse_args()
    root = args.root.resolve()
    output = (args.output or root / DEFAULT_BUNDLE).resolve()
    if args.verify_tree:
        restored = args.verify_tree.resolve()
        if not restored.is_dir():
            parser.error(f"restored tree does not exist: {restored}")
        errors = compare_trees(root, restored, output)
        if errors:
            print("Verification failed:", file=sys.stderr)
            for error in errors:
                print(f"  - {error}", file=sys.stderr)
            return 1
        count = len(collect_files(root, output))
        print(f"Verification passed: {count} files are byte-for-byte identical.")
        return 0
    count, total_bytes = write_bundle(root, output)
    print(f"Created {output}")
    print(f"Packed {count} files ({total_bytes:,} original bytes).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
