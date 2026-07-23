(function () {
  "use strict";

  const cfg = window.DB_CONFIG;
  if (!cfg) throw new Error("shared/form.js requires window.DB_CONFIG to be set before it loads");

  const mode = document.body.dataset.formMode === "edit" ? "edit" : "add";

  // --- Math captcha (optional, config-driven) --------------------------------

  let captchaAnswer = null;

  function initCaptcha() {
    if (!cfg.captcha) return;
    const questionEl = document.getElementById("captcha-question");
    const answerEl = document.getElementById("captcha_answer");
    const hintEl = document.getElementById("captcha-hint");
    if (!questionEl || !answerEl) return;

    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const isAddition = Math.random() < 0.5;
    if (isAddition) {
      captchaAnswer = a + b;
      questionEl.textContent = `${a} + ${b}`;
    } else {
      const hi = Math.max(a, b);
      const lo = Math.min(a, b);
      captchaAnswer = hi - lo;
      questionEl.textContent = `${hi} − ${lo}`;
    }
    answerEl.value = "";
    if (hintEl) hintEl.textContent = "";
  }

  function captchaPasses() {
    if (!cfg.captcha) return true;
    const answerEl = document.getElementById("captcha_answer");
    const hintEl = document.getElementById("captcha-hint");
    if (!answerEl) return true;
    const ok = Number(answerEl.value.trim()) === captchaAnswer;
    if (!ok) {
      initCaptcha();
      if (hintEl) hintEl.textContent = "That's not quite right — try the new question below.";
      answerEl.focus();
    }
    return ok;
  }

  function makeCheckbox(container, name, value, isChecked) {
    const label = document.createElement("label");
    label.className = "checkbox-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.value = value;
    if (isChecked) input.checked = true;
    label.appendChild(input);
    label.appendChild(document.createTextNode(value));
    container.appendChild(label);
  }

  async function loadAllCurrentSolutions() {
    const manifestRes = await fetch(cfg.manifestPath);
    const metaPaths = await manifestRes.json();
    const base = cfg.manifestPath.replace(/manifest\.json$/, "");
    return Promise.all(
      metaPaths.map(async (metaPath) => {
        const meta = await fetch(`${base}${metaPath}`).then((r) => r.json());
        const folder = metaPath.replace(/\/meta\.json$/, "");
        const current = await fetch(`${base}${folder}/v${meta.current_version}.json`).then((r) =>
          r.json()
        );
        const flattened = {
          ...current,
          ...(current.tags || {}),
          sldc_stages: (current.coverage || []).map((g) => g.group),
        };
        return { meta, current: flattened };
      })
    );
  }

  function buildFacetValueSets(entries) {
    const values = {};
    cfg.formFacets.forEach((f) => (values[f.key] = new Set()));
    entries.forEach(({ current }) => {
      cfg.formFacets.forEach((f) => {
        (current[f.key] || []).forEach((v) => values[f.key].add(v));
      });
    });
    return values;
  }

  function renderFacetCheckboxes(values, checkedSource) {
    cfg.formFacets.forEach((f) => {
      const container = document.getElementById(f.key);
      if (!container) return;
      const sorted = Array.from(values[f.key]).sort();
      const checkedValues = (checkedSource && checkedSource[f.key]) || [];
      sorted.forEach((v) => makeCheckbox(container, f.key, v, checkedValues.includes(v)));
    });
  }

  function getChecked(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(
      (el) => el.value
    );
  }

  // --- Taxonomy checklist (optional, config-driven) -------------------------

  let taxonomyData = null;

  async function loadTaxonomy() {
    if (!cfg.taxonomy) return null;
    if (taxonomyData) return taxonomyData;
    taxonomyData = await fetch(cfg.taxonomy.path).then((r) => r.json());
    return taxonomyData;
  }

  function isCapabilityChecked(existingCoverage, team, stage, name) {
    if (!existingCoverage) return false;
    const target = name.toLowerCase();

    // Exact team+stage+name match (data already produced by this checklist).
    const structuredMatch = existingCoverage.some((group) => {
      const teamMatches = group.team ? group.team === team : true;
      const stageMatches = group.group === stage;
      if (!teamMatches || !stageMatches) return false;
      return (group.items || []).some((item) => item.trim().toLowerCase() === target);
    });
    if (structuredMatch) return true;

    // Fallback for legacy entries predating this taxonomy, whose coverage
    // items aren't grouped by team/stage: match the name anywhere.
    return existingCoverage.some((group) =>
      !group.team && (group.items || []).some((item) => item.trim().toLowerCase() === target)
    );
  }

  function renderTaxonomyChecklist(taxonomy, existingCoverage) {
    if (!cfg.taxonomy) return;
    const container = document.getElementById(cfg.taxonomy.containerId);
    if (!container) return;
    container.innerHTML = "";

    Object.keys(taxonomy).forEach((team) => {
      const teamFieldset = document.createElement("fieldset");
      teamFieldset.className = "taxonomy-team";
      const legend = document.createElement("legend");
      legend.textContent = team;
      teamFieldset.appendChild(legend);

      Object.keys(taxonomy[team]).forEach((stage) => {
        const stageBlock = document.createElement("div");
        stageBlock.className = "taxonomy-stage";
        const h4 = document.createElement("h4");
        h4.textContent = stage;
        stageBlock.appendChild(h4);

        const grid = document.createElement("div");
        grid.className = "checkbox-grid";
        taxonomy[team][stage].forEach((cap) => {
          const label = document.createElement("label");
          label.className = "checkbox-chip";
          const hasDescription = Boolean(cap.description && cap.description.trim());
          if (hasDescription) {
            label.title = cap.description;
            label.classList.add("has-description");
          }
          const input = document.createElement("input");
          input.type = "checkbox";
          input.name = "taxonomy";
          input.dataset.team = team;
          input.dataset.stage = stage;
          input.value = cap.name;
          if (isCapabilityChecked(existingCoverage, team, stage, cap.name)) input.checked = true;
          label.appendChild(input);
          const nameSpan = document.createElement("span");
          nameSpan.textContent = cap.name;
          label.appendChild(nameSpan);
          grid.appendChild(label);
        });
        stageBlock.appendChild(grid);
        teamFieldset.appendChild(stageBlock);
      });

      container.appendChild(teamFieldset);
    });
  }

  function collectTaxonomySelections() {
    const groups = new Map();
    document.querySelectorAll('input[name="taxonomy"]:checked').forEach((input) => {
      const key = `${input.dataset.team}::${input.dataset.stage}`;
      if (!groups.has(key)) {
        groups.set(key, { team: input.dataset.team, group: input.dataset.stage, items: [] });
      }
      groups.get(key).items.push(input.value);
    });
    return Array.from(groups.values());
  }

  // --- Logo upload (rename-on-download helper; no backend to receive it) ----

  function slugify(text) {
    return (
      (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "solution"
    );
  }

  function initLogoUpload() {
    const fileInput = document.getElementById("logo_file");
    const companyInput = document.getElementById("company");
    const preview = document.getElementById("logo-preview");
    const hint = document.getElementById("logo-hint");
    if (!fileInput || !companyInput || !preview || !hint) return;

    function targetFilename() {
      const file = fileInput.files[0];
      if (!file) return null;
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      return `${slugify(companyInput.value)}.${ext}`;
    }

    function refresh() {
      const file = fileInput.files[0];
      if (!file) {
        preview.hidden = true;
        preview.innerHTML = "";
        hint.textContent =
          "PNG, SVG, JPEG, or WebP. Since this goes through a GitHub Issue, you'll attach the " +
          "image to the issue yourself after it opens (drag & drop into the comment box).";
        return;
      }
      const filename = targetFilename();
      const url = URL.createObjectURL(file);
      preview.hidden = false;
      preview.innerHTML = "";
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Logo preview";
      preview.appendChild(img);
      const dl = document.createElement("a");
      dl.href = url;
      dl.download = filename;
      dl.className = "btn logo-download-btn";
      dl.textContent = `Download as ${filename}`;
      preview.appendChild(dl);
      hint.textContent =
        `If approved, this will be saved as ${cfg.dbKey}/logos/${filename}. Download it renamed ` +
        `above, then drag that file into the GitHub Issue after it opens.`;
    }

    fileInput.addEventListener("change", refresh);
    companyInput.addEventListener("input", () => {
      if (fileInput.files[0]) refresh();
    });
    refresh();
  }

  function logoIssueLines() {
    const fileInput = document.getElementById("logo_file");
    const companyInput = document.getElementById("company");
    if (!fileInput || !fileInput.files[0]) return [];
    const file = fileInput.files[0];
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const filename = `${slugify(companyInput.value)}.${ext}`;
    return [
      "",
      `**Company Logo:** attached below — if approved, save as \`${cfg.dbKey}/logos/${filename}\`.`,
    ];
  }

  function buildIssueBody(data, target) {
    const lines = [];
    if (mode === "edit") {
      lines.push(
        `**Editing existing entry:** ${target.current.title} (slug: \`${target.meta.slug}\`, currently v${target.meta.current_version})`,
        ""
      );
    }
    lines.push(
      `**Solution / Product Name:** ${data.title}`,
      `**Company / Project Name:** ${data.company}`,
      "",
      `**Description:**`,
      data.description,
      "",
      `**Solution Link:** ${data.link}`,
      ""
    );
    cfg.formFacets.forEach((f) => {
      lines.push(`**${f.label}:** ${(data[f.key] || []).join(", ") || "—"}`);
    });

    if (cfg.taxonomy) {
      lines.push("", `**${cfg.coverageLabel}:**`);
      if (data.coverage.length) {
        data.coverage.forEach((group) => {
          lines.push(`- ${group.team} — ${group.group}: ${group.items.join(", ")}`);
        });
      } else {
        lines.push("—");
      }
    } else {
      lines.push("", `**${cfg.coverageLabel}:**`, data.characteristics || "—");
    }

    lines.push(...logoIssueLines());

    if (mode === "edit") {
      lines.push("", `**Reason for this change:**`, data.edit_reason || "—");
    }
    lines.push(
      "",
      `---`,
      `Submitted by: ${data.submitter_name || "—"} (${data.submitter_affiliation || "—"})`,
      `Contact: ${data.submitter_email || "—"}`
    );
    if (mode === "edit") {
      lines.push(
        "",
        `If accepted, apply with:`,
        "```",
        `python3 apply_edit.py ${cfg.dbKey} ${target.meta.slug} --changes <changes.json>`,
        "```"
      );
    }
    return lines.join("\n");
  }

  function collectFormData() {
    const data = {
      title: document.getElementById("title").value.trim(),
      company: document.getElementById("company").value.trim(),
      description: document.getElementById("description").value.trim(),
      link: document.getElementById("link").value.trim(),
      submitter_name: document.getElementById("submitter_name").value.trim(),
      submitter_affiliation: document.getElementById("submitter_affiliation").value.trim(),
      submitter_email: document.getElementById("submitter_email").value.trim(),
    };
    if (cfg.taxonomy) {
      data.coverage = collectTaxonomySelections();
    } else {
      const charsEl = document.getElementById("characteristics");
      data.characteristics = charsEl ? charsEl.value.trim() : "";
    }
    cfg.formFacets.forEach((f) => {
      data[f.key] = getChecked(f.key);
    });
    if (mode === "edit") {
      const reasonEl = document.getElementById("edit_reason");
      data.edit_reason = reasonEl ? reasonEl.value.trim() : "";
    }
    cfg.formFacets.forEach((f) => {
      if (!f.allowOther) return;
      const otherInput = document.getElementById(`${f.key}_other`);
      if (otherInput && otherInput.value.trim()) data[f.key].push(otherInput.value.trim());
    });
    return data;
  }

  function openIssue(data, target, note) {
    const { githubOwner, githubRepo } = window.SITE_CONFIG;
    const label = mode === "edit" ? cfg.issueLabelEdit : cfg.issueLabelNew;
    const titlePrefix = mode === "edit" ? "Edit suggestion" : "New solution";
    const issueUrl =
      `https://github.com/${githubOwner}/${githubRepo}/issues/new` +
      `?title=${encodeURIComponent(`${titlePrefix}: ${data.title}`)}` +
      `&labels=${encodeURIComponent(label)}` +
      `&body=${encodeURIComponent(buildIssueBody(data, target))}`;

    const win = window.open(issueUrl, "_blank", "noopener,noreferrer");
    if (win) {
      note.textContent = "Opened a GitHub Issue in a new tab — submit it there to complete your request.";
    } else {
      note.innerHTML =
        'Your browser blocked the popup. <a href="' +
        issueUrl +
        '" target="_blank" rel="noopener noreferrer">Click here to open the GitHub Issue</a>.';
    }
  }

  async function initAdd() {
    const form = document.getElementById("submit-form");
    const note = document.getElementById("form-note");
    initLogoUpload();
    initCaptcha();
    try {
      const entries = await loadAllCurrentSolutions();
      renderFacetCheckboxes(buildFacetValueSets(entries), null);
      if (cfg.taxonomy) renderTaxonomyChecklist(await loadTaxonomy(), null);
    } catch (err) {
      console.error("Failed to load facet values", err);
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!captchaPasses()) return;
      openIssue(collectFormData(), null, note);
    });
  }

  async function initEdit() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    const form = document.getElementById("edit-form");
    const loadError = document.getElementById("load-error");
    const editingNote = document.getElementById("editing-note");
    const note = document.getElementById("form-note");

    if (!slug) {
      loadError.hidden = false;
      return;
    }

    let entries;
    try {
      entries = await loadAllCurrentSolutions();
    } catch (err) {
      console.error("Failed to load solutions data", err);
      loadError.hidden = false;
      return;
    }

    const target = entries.find((e) => e.meta.slug === slug);
    if (!target) {
      loadError.hidden = false;
      return;
    }

    const s = target.current;

    editingNote.hidden = false;
    editingNote.textContent = `Editing "${s.title}" — currently version ${target.meta.current_version} of ${target.meta.versions.length}.`;

    document.getElementById("title").value = s.title || "";
    document.getElementById("company").value = s.company || "";
    document.getElementById("description").value = s.description || "";
    document.getElementById("link").value = s.link || "";

    if (cfg.taxonomy) {
      renderTaxonomyChecklist(await loadTaxonomy(), s.coverage || []);
    } else {
      const charsEl = document.getElementById("characteristics");
      if (charsEl) {
        charsEl.value = (s.coverage || []).map((g) => `${g.group}: ${g.items.join(" ")}`).join("\n");
      }
    }

    renderFacetCheckboxes(buildFacetValueSets(entries), s);
    initLogoUpload();
    initCaptcha();

    form.hidden = false;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!captchaPasses()) return;
      openIssue(collectFormData(), target, note);
    });
  }

  if (mode === "edit") {
    initEdit();
  } else {
    initAdd();
  }
})();
