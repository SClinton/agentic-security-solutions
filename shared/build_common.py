"""Shared helpers for converting a landscape CSV into versioned per-solution JSON.

Used by agentic/build_data.py and redteam/build_data.py. Each database's
build script handles its own CSV column mapping, then calls
write_solution_folder() to produce the common on-disk shape:

    data/solutions/<NNNN-slug>/meta.json   {slug, id, current_version, versions}
    data/solutions/<NNNN-slug>/v1.json     the solution record itself

Common solution JSON shape (fields beyond these are fine, but the site's
shared JS expects at least):
    id, slug, title, company, description, link,
    tags: { <facet_key>: [values...], ... },
    coverage: [ {"group": str, "items": [str, ...]}, ... ],
    stars, forks, submitter_affiliation
"""
import html
import json
import re
from pathlib import Path

ITEM_SENTENCE_SPLIT_RE = re.compile(r"\.,?\s+(?=[A-Z(])")


def clean_text(value: str) -> str:
    if not value:
        return ""
    value = value.replace("�", "—").replace("\xd0", "—")
    value = html.unescape(value)
    return value.strip()


def split_sentence_items(text: str):
    """Split a run-on 'item one. Item two, with commas.' string into items.

    Use when items are full sentences and commas appear inside items, so a
    plain comma split would fragment single items (this is how the Agentic
    landscape CSV is authored).
    """
    text = text.strip()
    if not text:
        return []
    parts = [p.strip() for p in ITEM_SENTENCE_SPLIT_RE.split(text)]
    items = []
    for i, p in enumerate(parts):
        if not p:
            continue
        if i < len(parts) - 1 and not p.endswith("."):
            p += "."
        items.append(p)
    return items


def split_simple(value: str, sep_regex=r"[|,]"):
    """Split short comma/pipe-separated tags (not full sentences)."""
    if not value:
        return []
    parts = re.split(sep_regex, value)
    return [clean_text(p) for p in parts if clean_text(p)]


def split_grouped(value: str, item_splitter=split_simple):
    """Split a '|' separated 'Group>details' string into [{group, items}].

    item_splitter receives the raw (uncleaned) text after '>' for one group
    and must return a list of cleaned item strings.
    """
    result = []
    if not value:
        return result
    for chunk in value.split("|"):
        chunk = clean_text(chunk)
        if not chunk:
            continue
        if ">" in chunk:
            group, items_raw = chunk.split(">", 1)
            item_list = item_splitter(items_raw)
        else:
            group, item_list = chunk, []
        result.append({"group": group.strip(), "items": item_list})
    return result


def slugify(*parts: str) -> str:
    text = "-".join(p for p in parts if p).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "solution"


def write_solution_folder(data_dir: Path, index: int, slug: str, solution: dict) -> str:
    """Write v1 for a new solution folder; skip if it already has history.

    Returns the manifest entry (relative path to meta.json) to append,
    regardless of whether this call wrote anything.
    """
    folder_name = f"{index:04d}-{slug}"
    folder = data_dir / folder_name
    meta_path = folder / "meta.json"
    manifest_entry = f"solutions/{folder_name}/meta.json"

    if meta_path.exists():
        return manifest_entry

    folder.mkdir(parents=True, exist_ok=True)
    (folder / "v1.json").write_text(
        json.dumps(solution, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    meta = {"slug": slug, "id": index, "current_version": 1, "versions": [1]}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest_entry
