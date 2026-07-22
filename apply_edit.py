#!/usr/bin/env python3
"""Apply an approved edit-suggestion, or roll back to a prior version.

Works across all databases in this repo (agentic, redteam, ...). A
"Suggest an Edit" submission (opened via the site as a GitHub Issue
labeled <db>-edit-suggestion) proposes new field values for an existing
solution. Once a maintainer decides to accept it, this script writes
those changes as a NEW version file and repoints the solution's
"current" pointer at it. The prior version file is never modified or
deleted, so it stays available for inspection or rollback.

Usage:
    # Apply changes from a JSON file containing only the fields to override
    # (any subset of: title, company, description, link, tags, coverage,
    # submitter_affiliation - "tags" may be a partial dict, e.g. just
    # {"top10_2026": [...]}, and is merged key-by-key)
    python3 apply_edit.py agentic <slug> --changes changes.json
    python3 apply_edit.py redteam <slug> --changes changes.json

    # Roll back to a previously-recorded version (no files are deleted;
    # this only repoints which version is "current")
    python3 apply_edit.py agentic <slug> --rollback 2

    # List a solution's version history
    python3 apply_edit.py agentic <slug> --history
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent
EDITABLE_FIELDS = {"title", "company", "description", "link", "tags", "coverage", "submitter_affiliation"}


def data_dir_for(db: str) -> Path:
    data_dir = ROOT / db / "data" / "solutions"
    if not data_dir.is_dir():
        sys.exit(f"No such database '{db}' (expected {data_dir} to exist)")
    return data_dir


def find_solution_folder(data_dir: Path, slug: str) -> Path:
    matches = []
    for folder in data_dir.iterdir():
        meta_path = folder / "meta.json"
        if not meta_path.exists():
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if meta.get("slug") == slug or folder.name == slug or folder.name.endswith(f"-{slug}"):
            matches.append(folder)
    if not matches:
        sys.exit(f"No solution folder found matching slug '{slug}' in {data_dir}")
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

    updated = {**base, **changes}
    if "tags" in changes:
        updated["tags"] = {**base.get("tags", {}), **changes["tags"]}

    new_version = max(meta["versions"]) + 1
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
    parser.add_argument("db", help="Database folder to modify, e.g. agentic or redteam")
    parser.add_argument("slug", help="Solution slug (or folder name) to modify")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--changes", type=Path, help="JSON file with fields to override")
    group.add_argument("--rollback", type=int, metavar="VERSION", help="Version number to roll back to")
    group.add_argument("--history", action="store_true", help="Show version history")
    args = parser.parse_args()

    folder = find_solution_folder(data_dir_for(args.db), args.slug)

    if args.changes:
        apply_changes(folder, args.changes)
    elif args.rollback is not None:
        rollback(folder, args.rollback)
    elif args.history:
        show_history(folder)


if __name__ == "__main__":
    main()
