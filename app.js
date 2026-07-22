(function () {
  "use strict";

  const state = {
    all: [],
    filters: {
      solution_types: new Set(),
      stage: new Set(),
      top10_2026: new Set(),
    },
    query: "",
  };

  const FACET_LABELS = {
    solution_types: "Solution Type",
    stage: "Stage",
    top10_2026: "Top 10 Risk",
  };

  const cardsEl = document.getElementById("cards");
  const emptyEl = document.getElementById("empty-state");
  const countEl = document.getElementById("result-count");
  const searchEl = document.getElementById("search");
  const activeFiltersEl = document.getElementById("active-filters");
  const template = document.getElementById("card-template");

  async function loadData() {
    const manifestRes = await fetch("data/manifest.json");
    const metaPaths = await manifestRes.json();

    const solutions = await Promise.all(
      metaPaths.map(async (metaPath) => {
        const meta = await fetch(`data/${metaPath}`).then((r) => r.json());
        const folder = metaPath.replace(/\/meta\.json$/, "");
        const current = await fetch(
          `data/${folder}/v${meta.current_version}.json`
        ).then((r) => r.json());
        return {
          ...current,
          version: meta.current_version,
          versionCount: meta.versions.length,
        };
      })
    );

    state.all = solutions.map((s) => {
      const sldc_stages = (s.agentic_sldc || []).map((st) => st.stage);
      const stage = Array.from(new Set([...(s.llmops_stages || []), ...sldc_stages]));
      return { ...s, sldc_stages, stage };
    });
  }

  function buildFacets() {
    const values = {
      solution_types: new Set(),
      stage: new Set(),
      top10_2026: new Set(),
    };
    for (const s of state.all) {
      s.solution_types.forEach((v) => values.solution_types.add(v));
      s.stage.forEach((v) => values.stage.add(v));
      s.top10_2026.forEach((v) => values.top10_2026.add(v));
    }
    for (const facet of Object.keys(values)) {
      const container = document.getElementById(`facet-${facet}`);
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
    const haystack = [
      solution.title,
      solution.company,
      solution.description,
      ...(solution.solution_types || []),
      ...(solution.llmops_stages || []),
      ...(solution.top10_2026 || []),
    ]
      .join(" ")
      .toLowerCase();
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
      editBtn.href = `edit.html?slug=${encodeURIComponent(s.slug)}`;
      editBtn.setAttribute("aria-label", `Suggest an edit to ${s.title}`);

      const versionEl = node.querySelector(".card-version");
      versionEl.textContent = `v${s.version}`;
      versionEl.title = s.versionCount > 1
        ? `Version ${s.version} of ${s.versionCount}`
        : `Version ${s.version}`;

      const typesEl = node.querySelector(".card-tags-types");
      s.solution_types.forEach((t) => {
        const tag = document.createElement("span");
        tag.className = "tag tag-type";
        tag.textContent = t;
        typesEl.appendChild(tag);
      });

      const llmopsEl = node.querySelector(".card-tags-llmops");
      s.llmops_stages.forEach((t) => {
        const tag = document.createElement("span");
        tag.className = "tag tag-llmops";
        tag.textContent = t;
        llmopsEl.appendChild(tag);
      });

      const risksEl = node.querySelector(".card-tags-risks");
      s.top10_2026.forEach((t) => {
        const tag = document.createElement("span");
        tag.className = "tag tag-risk";
        tag.textContent = t;
        risksEl.appendChild(tag);
      });

      const sldcEl = node.querySelector(".card-sldc");
      if (s.agentic_sldc && s.agentic_sldc.length) {
        s.agentic_sldc.forEach((stage) => {
          const div = document.createElement("div");
          div.className = "sldc-stage";
          const h4 = document.createElement("h4");
          h4.textContent = stage.stage;
          div.appendChild(h4);
          const ul = document.createElement("ul");
          stage.items.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item;
            ul.appendChild(li);
          });
          div.appendChild(ul);
          sldcEl.appendChild(div);
        });
      } else {
        node.querySelector(".card-details").remove();
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

  function render() {
    const filtered = state.all.filter(
      (s) => matchesFilters(s) && matchesQuery(s)
    );
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

  loadData()
    .then(() => {
      buildFacets();
      setupDropdowns();
      render();
    })
    .catch((err) => {
      countEl.textContent = "Failed to load solutions data.";
      console.error(err);
    });
})();
