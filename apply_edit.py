#!/usr/bin/env python3
"""Apply an approved edit-suggestion, or roll back to a prior version.

A "Suggest an Edit" submission (opened via the site as a GitHub Issue
labeled edit-suggestion) proposes new field values for an existing
solution. Once a maintainer decides to accept it, this script writes
those changes as a NEW version file and repoints the solution's
"current" pointer at it. The prior version file is never modified or
deleted, so it stays available for inspection or rollback.

Usage:
    # Apply changes from a JSON file containing only the fields to override
    # (any subset of: title, company, description, link, solution_types,
    # llmops_stages, agentic_sldc, top10_2026, submitter_affiliation)
    python3 apply_edit.py <slug> --changes changes.json

    # Roll back to a previously-recorded version (no files are deleted;
    # this only repoints which version is "current")
    python3 apply_edit.py <slug> --rollback 2

    # List a solution's version history
    python3 apply_edit.py <slug> --history
"""
import argparse
import json
import sys
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data" / "solutions"

EDITABLE_FIELDS = {
    "title", "company", "description", "link", "solution_types",
    "llmops_stages", "agentic_sldc", "top10_2026", "submitter_affiliation",
}


def find_solution_folder(slug: str) -> Path:
    matches = []
    for folder in DATA_DIR.iterdir():
        meta_path = folder / "meta.json"
        if not meta_path.exists():
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if meta.get("slug") == slug or folder.name == slug or folder.name.endswith(f"-{slug}"):
            matches.append(folder)
    if not matches:
        sys.exit(f"No solution folder found matching slug '{slug}'")
    if len(matches) > 1:
        names = ", ".join(m.name for m in matches)
        sys.exit(f"Ambiguous slug '{slug}' matches multiple folders: {names}")
    return matches[0]


def load_meta(folder: Path) -> dict:
    return json.loads((folder / "meta.json").read_text(encoding="utf-8"))


def save_meta(folder: Path, meta: dict) -> None:
    (folder / "meta.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def apply_changes(folder: Path, changes_path: Path) -> None:
    meta = load_meta(folder)
    current_version = meta["current_version"]
    current_path = folder / f"v{current_version}.json"
    base = json.loads(current_path.read_text(encoding="utf-8"))

    changes = json.loads(changes_path.read_text(encoding="utf-8"))
    unknown = set(changes) - EDITABLE_FIELDS
    if unknown:
        sys.exit(f"Refusing to apply unknown fields: {sorted(unknown)}")

    new_version = max(meta["versions"]) + 1
    updated = {**base, **changes}
    (folder / f"v{new_version}.json").write_text(
        json.dumps(updated, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    meta["current_version"] = new_version
    meta["versions"].append(new_version)
    save_meta(folder, meta)

    print(f"Created v{new_version} for {folder.name} (was v{current_version}); now current.")
    print(f"v{current_version} retained at {folder / f'v{current_version}.json'} for rollback.")


def rollback(folder: Path, target_version: int) -> None:
    meta = load_meta(folder)
    if target_version not in meta["versions"]:
        sys.exit(f"Version {target_version} does not exist for {folder.name}. "
                  f"Known versions: {meta['versions']}")
    previous = meta["current_version"]
    meta["current_version"] = target_version
    save_meta(folder, meta)
    print(f"Rolled back {folder.name} from v{previous} to v{target_version}. "
          f"No files were deleted; v{previous} is still on disk.")


def show_history(folder: Path) -> None:
    meta = load_meta(folder)
    print(f"{folder.name}: current = v{meta['current_version']}")
    for v in meta["versions"]:
        marker = " (current)" if v == meta["current_version"] else ""
        print(f"  v{v}{marker}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("slug", help="Solution slug (or folder name) to modify")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--changes", type=Path, help="JSON file with fields to override")
    group.add_argument("--rollback", type=int, metavar="VERSION", help="Version number to roll back to")
    group.add_argument("--history", action="store_true", help="Show version history")
    args = parser.parse_args()

    folder = find_solution_folder(args.slug)

    if args.changes:
        apply_changes(folder, args.changes)
    elif args.rollback is not None:
        rollback(folder, args.rollback)
    elif args.history:
        show_history(folder)


if __name__ == "__main__":
    main()
