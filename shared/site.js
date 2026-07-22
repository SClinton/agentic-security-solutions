(function () {
  "use strict";

  const cfg = window.DB_CONFIG;
  if (!cfg) throw new Error("shared/site.js requires window.DB_CONFIG to be set before it loads");

  const state = {
    all: [],
    filters: {},
    query: "",
    sortOrder: "asc",
  };
  cfg.facets.forEach((f) => (state.filters[f.key] = new Set()));

  const FACET_LABELS = {};
  cfg.facets.forEach((f) => (FACET_LABELS[f.key] = f.label));

  const cardsEl = document.getElementById("cards");
  const emptyEl = document.getElementById("empty-state");
  const countEl = document.getElementById("result-count");
  const searchEl = document.getElementById("search");
  const sortEl = document.getElementById("sort-select");
  const activeFiltersEl = document.getElementById("active-filters");
  const template = document.getElementById("card-template");

  async function loadData() {
    const manifestRes = await fetch(cfg.manifestPath);
    const metaPaths = await manifestRes.json();

    const solutions = await Promise.all(
      metaPaths.map(async (metaPath) => {
        const base = cfg.manifestPath.replace(/manifest\.json$/, "");
        const meta = await fetch(`${base}${metaPath}`).then((r) => r.json());
        const folder = metaPath.replace(/\/meta\.json$/, "");
        const current = await fetch(`${base}${folder}/v${meta.current_version}.json`).then((r) =>
          r.json()
        );
        return {
          ...current,
          ...(current.tags || {}),
          version: meta.current_version,
          versionCount: meta.versions.length,
        };
      })
    );

    state.all = solutions;
  }

  function buildFacetDropdownShells() {
    const container = document.getElementById("facets-container");
    if (!container) return;
    container.innerHTML = "";
    cfg.facets.forEach((f) => {
      const dropdown = document.createElement("div");
      dropdown.className = "facet-dropdown";
      dropdown.dataset.facet = f.key;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "facet-toggle";
      toggle.setAttribute("aria-haspopup", "true");
      toggle.setAttribute("aria-expanded", "false");

      const labelEl = document.createElement("span");
      labelEl.className = "facet-toggle-label";
      labelEl.textContent = f.label;
      const chevron = document.createElement("span");
      chevron.className = "facet-toggle-chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = "⌄";
      toggle.appendChild(labelEl);
      toggle.appendChild(chevron);

      const panel = document.createElement("div");
      panel.className = "facet-panel";
      panel.id = `facet-${f.key}`;

      dropdown.appendChild(toggle);
      dropdown.appendChild(panel);
      container.appendChild(dropdown);
    });
  }

  function buildFacets() {
    const values = {};
    cfg.facets.forEach((f) => (values[f.key] = new Set()));
    for (const s of state.all) {
      cfg.facets.forEach((f) => {
        (s[f.key] || []).forEach((v) => values[f.key].add(v));
      });
    }
    for (const facet of Object.keys(values)) {
      const container = document.getElementById(`facet-${facet}`);
      if (!container) continue;
      container.innerHTML = "";
      const sorted = Array.from(values[facet]).sort();
      for (const val of sorted) {
        const label = document.createElement("label");
        label.className = "facet-check";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.facet = facet;
        input.dataset.value = val;
        input.addEventListener("change", () => toggleFilter(facet, val));
        label.appendChild(input);
        label.appendChild(document.createTextNode(val));
        container.appendChild(label);
      }
    }
  }

  function setupDropdowns() {
    const dropdowns = Array.from(document.querySelectorAll(".facet-dropdown"));
    function closeAll(except) {
      dropdowns.forEach((d) => {
        if (d === except) return;
        d.classList.remove("open");
        d.querySelector(".facet-toggle").setAttribute("aria-expanded", "false");
      });
    }
    dropdowns.forEach((dropdown) => {
      const toggle = dropdown.querySelector(".facet-toggle");
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains("open");
        closeAll(dropdown);
        dropdown.classList.toggle("open", !isOpen);
        toggle.setAttribute("aria-expanded", String(!isOpen));
      });
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".facet-dropdown")) closeAll(null);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll(null);
    });
  }

  function updateFacetToggleLabels() {
    document.querySelectorAll(".facet-dropdown").forEach((dropdown) => {
      const facet = dropdown.dataset.facet;
      const count = state.filters[facet].size;
      const chevron = dropdown.querySelector(".facet-toggle-chevron");
      let countEl = dropdown.querySelector(".facet-toggle-count");
      if (count > 0 && !countEl) {
        countEl = document.createElement("span");
        countEl.className = "facet-toggle-count";
        dropdown.querySelector(".facet-toggle").insertBefore(countEl, chevron);
      }
      if (countEl) {
        if (count > 0) {
          countEl.textContent = String(count);
          countEl.hidden = false;
        } else {
          countEl.remove();
        }
      }
    });
  }

  function toggleFilter(facet, value) {
    const set = state.filters[facet];
    if (set.has(value)) set.delete(value);
    else set.add(value);
    render();
  }

  function clearAllFilters() {
    for (const key of Object.keys(state.filters)) state.filters[key].clear();
    render();
  }

  function matchesFilters(solution) {
    for (const facet of Object.keys(state.filters)) {
      const selected = state.filters[facet];
      if (selected.size === 0) continue;
      const values = solution[facet] || [];
      const hasMatch = values.some((v) => selected.has(v));
      if (!hasMatch) return false;
    }
    return true;
  }

  function matchesQuery(solution) {
    if (!state.query) return true;
    const parts = [solution.title, solution.company, solution.description];
    (cfg.searchKeys || []).forEach((k) => parts.push(...(solution[k] || [])));
    const haystack = parts.join(" ").toLowerCase();
    return haystack.includes(state.query);
  }

  function renderActiveFilterChips() {
    activeFiltersEl.innerHTML = "";
    let any = false;
    for (const facet of Object.keys(state.filters)) {
      for (const value of state.filters[facet]) {
        any = true;
        const chip = document.createElement("span");
        chip.className = "active-filter";
        chip.textContent = `${FACET_LABELS[facet]}: ${value}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove filter ${value}`);
        remove.textContent = "×";
        remove.addEventListener("click", () => toggleFilter(facet, value));
        chip.appendChild(remove);
        activeFiltersEl.appendChild(chip);
      }
    }
    if (any) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "clear-all";
      clear.textContent = "Clear all filters";
      clear.addEventListener("click", clearAllFilters);
      activeFiltersEl.appendChild(clear);
    }
  }

  function syncFacetInputs() {
    document.querySelectorAll(".facet-panel input[type=checkbox]").forEach((input) => {
      const { facet, value } = input.dataset;
      input.checked = state.filters[facet].has(value);
    });
    updateFacetToggleLabels();
  }

  function renderCards(list) {
    cardsEl.innerHTML = "";
    for (const s of list) {
      const node = template.content.cloneNode(true);

      node.querySelector(".card-title").textContent = s.title;
      node.querySelector(".card-company").textContent = s.company;
      node.querySelector(".card-description").textContent = s.description;

      const editBtn = node.querySelector(".card-edit-btn");
      editBtn.href = `${cfg.editBase}?slug=${encodeURIComponent(s.slug)}`;
      editBtn.setAttribute("aria-label", `Suggest an edit to ${s.title}`);

      const versionEl = node.querySelector(".card-version");
      versionEl.textContent = `v${s.version}`;
      versionEl.title =
        s.versionCount > 1 ? `Version ${s.version} of ${s.versionCount}` : `Version ${s.version}`;

      const tagRowsEl = node.querySelector(".card-tag-rows");
      (cfg.cardTagRows || []).forEach((row) => {
        const values = s[row.key] || [];
        if (!values.length) return;
        const rowEl = document.createElement("div");
        rowEl.className = "card-tags";
        values.forEach((v) => {
          const tag = document.createElement("span");
          tag.className = `tag ${row.tagClass}`;
          tag.textContent = v;
          rowEl.appendChild(tag);
        });
        tagRowsEl.appendChild(rowEl);
      });

      const coverageEl = node.querySelector(".card-coverage");
      const detailsEl = node.querySelector(".card-details");
      if (s.coverage && s.coverage.length) {
        detailsEl.querySelector("summary").textContent = cfg.coverageLabel || "Coverage";
        s.coverage.forEach((group) => {
          const div = document.createElement("div");
          div.className = "sldc-stage";
          const h4 = document.createElement("h4");
          h4.textContent = group.group;
          div.appendChild(h4);
          const ul = document.createElement("ul");
          group.items.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item;
            ul.appendChild(li);
          });
          div.appendChild(ul);
          coverageEl.appendChild(div);
        });
      } else {
        detailsEl.remove();
      }

      const linkEl = node.querySelector(".card-link");
      if (s.link) {
        linkEl.href = s.link;
      } else {
        linkEl.remove();
      }

      cardsEl.appendChild(node);
    }
  }

  function sortByTitle(list) {
    const dir = state.sortOrder === "desc" ? -1 : 1;
    return list.slice().sort((a, b) => dir * a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  }

  function render() {
    const filtered = sortByTitle(state.all.filter((s) => matchesFilters(s) && matchesQuery(s)));
    renderCards(filtered);
    countEl.textContent = `${filtered.length} solution${filtered.length === 1 ? "" : "s"}`;
    emptyEl.hidden = filtered.length !== 0;
    renderActiveFilterChips();
    syncFacetInputs();
  }

  searchEl.addEventListener("input", (e) => {
    state.query = e.target.value.trim().toLowerCase();
    render();
  });

  if (sortEl) {
    sortEl.addEventListener("change", (e) => {
      state.sortOrder = e.target.value;
      render();
    });
  }

  loadData()
    .then(() => {
      buildFacetDropdownShells();
      buildFacets();
      setupDropdowns();
      render();
    })
    .catch((err) => {
      countEl.textContent = "Failed to load solutions data.";
      console.error(err);
    });
})();
