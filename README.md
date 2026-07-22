# OWASP GenAI Security Project Solution Directory

An umbrella site hosting multiple searchable, community-maintained databases of solutions for
securing generative and agentic AI systems, published via GitHub Pages.

- `index.html` — the umbrella landing page linking to each database.
- `styles.css` — shared styles used by every page in the site.
- `app.config.js` — shared config (`githubOwner`/`githubRepo`) used when building GitHub Issue
  links from any database.
- `shared/site.js` — the card-gallery engine (search, sidebar filters, card rendering). Driven
  entirely by each database's `db.config.js`; not specific to any one database.
- `shared/form.js` — the add/edit form engine (checkbox groups, pre-fill on edit, GitHub Issue
  body). Also driven by `db.config.js`.
- `shared/build_common.py` — shared Python helpers for turning a landscape CSV into versioned
  per-solution JSON.
- `apply_edit.py` — maintainer tool (works across all databases) to accept an edit suggestion as
  a new version, roll back to an earlier version, or show version history.

## Databases

Each database is a self-contained folder:

```
<db>/
  index.html        - card gallery (search + sidebar filters)
  add.html          - "Submit a Solution" form
  edit.html         - "Suggest an Edit" form (linked from each card's ✎ icon)
  db.config.js      - facets, labels, GitHub issue labels for this database
  build_data.py     - imports this database's CSV into data/
  <Name>.csv        - source data
  data/manifest.json
  data/solutions/<id-slug>/
    meta.json       - {slug, id, current_version, versions: [...]}
    v1.json, v2.json, ... - one immutable file per version
```

Currently:
- **`agentic/`** — Agentic Security Solutions, sourced from `AgenticSolutions.csv`.
- **`redteam/`** — Red Team Solutions, sourced from `RedTeamSolutions.csv`.

### Adding a new database

1. Create `<db>/` with its own CSV and a `build_data.py` that maps CSV columns into the common
   solution shape (see either existing `build_data.py` for the pattern; both import
   `shared/build_common.py`):
   ```json
   {
     "id": 0, "slug": "...", "title": "...", "company": "...",
     "description": "...", "link": "...",
     "tags": { "<facet_key>": ["..."], ... },
     "coverage": [ { "group": "...", "items": ["..."] } ],
     "stars": 0, "forks": 0, "submitter_affiliation": "..."
   }
   ```
2. Copy `agentic/index.html`, `add.html`, `edit.html` into `<db>/`, adjusting only the
   `<title>`/breadcrumb text and the card `<template>`'s detail `<summary>` label — the JS is
   shared and needs no changes.
3. Write `<db>/db.config.js` defining `facets` (sidebar filters + card tag colors), `formFacets`
   (add/edit checkbox groups), `searchKeys`, `coverageLabel`, and the two GitHub issue labels.
4. Run `python3 <db>/build_data.py`.
5. Add a card for it to the root `index.html`'s `.db-grid`.

## Versioning model

Every solution's data lives under `<db>/data/solutions/<id>-<slug>/`. `meta.json` tracks which
version is currently shown on the site (`current_version`) and the full list of versions that
exist. Editing an entry never overwrites a version file — it always writes the next `vN.json`
and repoints `current_version`. Older version files are never deleted, so any version can be
restored.

```
python3 apply_edit.py <db> <slug> --history
python3 apply_edit.py <db> <slug> --changes changes.json   # apply an approved edit as a new version
python3 apply_edit.py <db> <slug> --rollback 2             # repoint "current" back to v2
```

`changes.json` only needs to contain the fields being changed, e.g.:

```json
{ "description": "Updated description text.", "tags": { "risk_maps": ["..."] } }
```

## Updating a database from its CSV

1. Edit `<db>/<Name>.csv`.
2. Run `python3 <db>/build_data.py`.
3. Commit the regenerated files in `<db>/data/`.

`build_data.py` skips any solution folder that already has a `meta.json`, so it never clobbers
edit history — it only adds new rows.

## Reviewing submissions and edits

- New-solution submissions (via "Submit a Solution") arrive as GitHub Issues labeled
  `<db>-new-submission` (e.g. `agentic-new-submission`). Add an approved entry as a new row in
  that database's CSV and rebuild, or create its `data/solutions/<folder>/` (`meta.json` +
  `v1.json`) by hand and add the `meta.json` path to `data/manifest.json`.
- Edit suggestions (via each card's ✎ icon) arrive as GitHub Issues labeled
  `<db>-edit-suggestion`, naming the entry's slug and current version. To accept one, save the
  proposed field changes as a JSON file and run
  `apply_edit.py <db> <slug> --changes changes.json`, then commit.
