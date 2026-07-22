# Agentic Security Solutions

A searchable database of agentic AI security solutions, published via GitHub Pages.

- `index.html` / `styles.css` / `app.js` — the card gallery with search and facet filters.
- `add.html` / `add.js` — a submission form that opens a pre-filled GitHub Issue for review.
- `edit.html` / `edit.js` — per-entry "Suggest an edit" form (linked from each card's ✎ icon),
  pre-filled with the entry's current values, opening a pre-filled GitHub Issue for review.
- `data/manifest.json` — list of per-solution `meta.json` paths.
- `data/solutions/<folder>/` — one folder per solution, containing:
  - `meta.json` — `{slug, id, current_version, versions: [...]}`
  - `v1.json`, `v2.json`, ... — one immutable file per version.
- `AgenticSolutions.csv` — source data.
- `build_data.py` — imports `AgenticSolutions.csv` into `data/solutions/` as v1 of each
  solution. Safe to re-run: it skips any folder that already has a `meta.json`, so it never
  clobbers edit history.
- `apply_edit.py` — maintainer tool to accept an edit suggestion (creates a new version and
  points "current" at it) or roll back to an earlier version.

## Versioning model

Every solution's data lives under `data/solutions/<id>-<slug>/`. `meta.json` tracks which
version is currently shown on the site (`current_version`) and the full list of versions that
exist. Editing an entry never overwrites a version file — it always writes the next `vN.json`
and repoints `current_version`. Older version files are never deleted, so any version can be
restored.

```
python3 apply_edit.py <slug> --history
python3 apply_edit.py <slug> --changes changes.json   # apply an approved edit as a new version
python3 apply_edit.py <slug> --rollback 2             # repoint "current" back to v2
```

`changes.json` only needs to contain the fields being changed, e.g.:

```json
{ "description": "Updated description text.", "link": "https://example.com/new-path" }
```

## Updating the data from the CSV

1. Edit `AgenticSolutions.csv`.
2. Run `python3 build_data.py`.
3. Commit the regenerated files in `data/`.

## Reviewing submissions and edits

- New-solution submissions (via "Submit a Solution") arrive as GitHub Issues labeled
  `new-submission`. Add an approved entry as a new row in `AgenticSolutions.csv` and rebuild,
  or create its `data/solutions/<folder>/` (`meta.json` + `v1.json`) by hand and add the
  `meta.json` path to `data/manifest.json`.
- Edit suggestions (via each card's ✎ icon) arrive as GitHub Issues labeled `edit-suggestion`,
  naming the entry's slug and current version. To accept one, save the proposed field changes
  as a JSON file and run `apply_edit.py <slug> --changes changes.json`, then commit.
