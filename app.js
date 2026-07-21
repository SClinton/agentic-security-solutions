(function () {
  "use strict";

  const state = {
    all: [],
    filters: {
      solution_types: new Set(),
      llmops_stages: new Set(),
      sldc_stages: new Set(),
      top10_2026: new Set(),
    },
    query: "",
  };

  const FACET_LABELS = {
    solution_types: "Solution Type",
    llmops_stages: "LLMOps Stage",
    sldc_stages: "Agentic SDLC Phase",
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
    const files = await manifestRes.json();
    const solutions = await Promise.all(
      files.map((f) => fetch(`data/${f}`).then((r) => r.json()))
    );
    state.all = solutions.map((s) => ({
      ...s,
      sldc_stages: (s.agentic_sldc || []).map((st) => st.stage),
    }));
  }

  function buildFacets() {
    const values = {
      solution_types: new Set(),
      llmops_stages: new Set(),
      sldc_stages: new Set(),
      top10_2026: new Set(),
    };
    for (const s of state.all) {
      s.solution_types.forEach((v) => values.solution_types.add(v));
      s.llmops_stages.forEach((v) => values.llmops_stages.add(v));
      s.sldc_stages.forEach((v) => values.sldc_stages.add(v));
      s.top10_2026.forEach((v) => values.top10_2026.add(v));
    }
    for (const facet of Object.keys(values)) {
      const container = document.getElementById(`facet-${facet}`);
      container.innerHTML = "";
      const sorted = Array.from(values[facet]).sort();
      for (const val of sorted) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "facet-chip";
        chip.textContent = val;
        chip.dataset.facet = facet;
        chip.dataset.value = val;
        chip.addEventListener("click", () => toggleFilter(facet, val));
        container.appendChild(chip);
      }
    }
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

  function syncChipStates() {
    document.querySelectorAll(".facet-chip").forEach((chip) => {
      const { facet, value } = chip.dataset;
      chip.classList.toggle("active", state.filters[facet].has(value));
    });
  }

  function renderCards(list) {
    cardsEl.innerHTML = "";
    for (const s of list) {
      const node = template.content.cloneNode(true);
      node.querySelector(".card-title").textContent = s.title;
      node.querySelector(".card-company").textContent = s.company;
      node.querySelector(".card-description").textContent = s.description;

      const typesEl = node.querySelector(".card-tags-types");
      s.solution_types.forEach((t) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = t;
        typesEl.appendChild(tag);
      });
      s.llmops_stages.forEach((t) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = t;
        typesEl.appendChild(tag);
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
    syncChipStates();
  }

  searchEl.addEventListener("input", (e) => {
    state.query = e.target.value.trim().toLowerCase();
    render();
  });

  loadData()
    .then(() => {
      buildFacets();
      render();
    })
    .catch((err) => {
      countEl.textContent = "Failed to load solutions data.";
      console.error(err);
    });
})();
