# OWASP GenAI Security Project Solution Directory

The published static site for the OWASP GenAI Security Project Solution Directory, served via
GitHub Pages: https://sclinton.github.io/agentic-security-solutions/

**This repo holds only the published output** — HTML/CSS/JS and the generated per-solution JSON
data each database's pages fetch at runtime. Source CSVs, build scripts, `apply_edit.py`, and
the red-team capability taxonomy's markdown source are maintained in a private companion repo
and are not part of this repo's history. This split exists so that repo/source access can be
restricted to invited collaborators while the directory itself stays publicly viewable, which
GitHub Pages requires for any content it serves.

## Layout

- `index.html` — the umbrella page: a tab bar (one tab per database) above an iframe that loads
  the selected database's own `index.html` with `?embedded=1`.
- `embed.html` — the same tab bar + iframe, with no page header/title, meant to be dropped into
  an `<iframe>` on another site (e.g. a WordPress page) as a self-contained widget.
- `shared/directory-tabs.js` — drives both of the above: the `DATABASES` list, tab rendering,
  and the iframe's src/height management.
- `styles.css` — shared styles used by every page in the site.
- `app.config.js` — shared config (`githubOwner`/`githubRepo`) used when building GitHub Issue
  links from any database.
- `shared/site.js` — the card-gallery engine (search, sidebar filters, sort, card rendering),
  driven entirely by each database's `db.config.js`.
- `shared/form.js` — the add/edit form engine (checkbox groups, pre-fill on edit, GitHub Issue
  body, optional taxonomy checklist, optional logo upload, optional math captcha), also driven
  by `db.config.js`.
- `<db>/` (currently `agentic/` and `redteam/`) — each a self-contained database:
  ```
  <db>/
    index.html        - card gallery (search + sidebar filters)
    add.html          - "Submit a Solution" form
    edit.html         - "Suggest an Edit" form (linked from each card's ✎ icon)
    db.config.js      - facets, labels, GitHub issue labels for this database
    logos/, badges/   - solution/company logo and badge images
    data/manifest.json
    data/solutions/<id-slug>/
      meta.json       - {slug, id, current_version, versions: [...]}
      v1.json, v2.json, ... - one immutable file per version
  ```
- `redteam/taxonomy/rt_taxonomy.json` — generated output fetched at runtime by the "Red Team
  Coverage" checklist; its markdown source and generator script live in the private repo.

## Embedding elsewhere

`embed.html` is `index.html` with the page header/banner-title removed, for embedding the whole
tabbed directory (tabs + all databases) into another site:

```html
<iframe src="https://sclinton.github.io/agentic-security-solutions/embed.html"
        style="width:100%; border:0; min-height:700px"></iframe>
```

It still includes the "design concept only" banner and the site footer — only the
`<header class="site-header">` title block is omitted. Both `index.html` and `embed.html` share
the same `shared/directory-tabs.js`, so they always stay in sync.

## Versioning model

Every solution's data lives under `<db>/data/solutions/<id>-<slug>/`. `meta.json` tracks which
version is currently shown on the site (`current_version`) and the full list of versions that
exist. Accepted edits are published here as a new `vN.json` with `current_version` repointed;
older version files are never deleted. The tooling that produces these commits
(`apply_edit.py`, `build_data.py`) lives in the private source repo, not here.

## Reviewing submissions and edits

New-solution submissions and edit suggestions arrive as GitHub Issues on this repo, labeled
`<db>-new-submission` / `<db>-edit-suggestion` respectively. They're reviewed and applied from
the private source repo, then published here as a new commit.
