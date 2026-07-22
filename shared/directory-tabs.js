(function () {
  "use strict";

  // Add a new database to the directory by adding one entry here - no other
  // changes needed for it to appear as a tab. Used by both index.html (full
  // page) and embed.html (header-less, for embedding elsewhere e.g. WordPress).
  const DATABASES = [
    { key: "agentic", label: "Agentic", path: "agentic/index.html" },
    { key: "redteam", label: "Red Teaming", path: "redteam/index.html" },
  ];

  const tabsEl = document.getElementById("db-tabs");
  const iframeEl = document.getElementById("db-iframe");
  let resizeObserver = null;

  function keyFromHash() {
    const key = location.hash.replace(/^#/, "");
    return DATABASES.some((d) => d.key === key) ? key : DATABASES[0].key;
  }

  function activate(key, { updateHash = true } = {}) {
    const db = DATABASES.find((d) => d.key === key) || DATABASES[0];

    tabsEl.querySelectorAll(".db-tab").forEach((btn) => {
      const isActive = btn.dataset.key === db.key;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
      btn.tabIndex = isActive ? 0 : -1;
    });

    if (updateHash) history.replaceState(null, "", `#${db.key}`);

    iframeEl.style.height = "600px";
    iframeEl.src = `${db.path}?embedded=1`;
  }

  function attachAutoResize() {
    if (resizeObserver) resizeObserver.disconnect();
    try {
      const doc = iframeEl.contentDocument;
      if (!doc) return;
      const resize = () => {
        const h = doc.documentElement.scrollHeight;
        if (h) iframeEl.style.height = `${h}px`;
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(doc.documentElement);
      resize();
    } catch (err) {
      console.error("Could not observe iframe content size", err);
    }
  }

  DATABASES.forEach((db) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "db-tab";
    btn.textContent = db.label;
    btn.dataset.key = db.key;
    btn.setAttribute("role", "tab");
    btn.addEventListener("click", () => activate(db.key));
    btn.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const idx = DATABASES.findIndex((d) => d.key === db.key);
      const next = e.key === "ArrowRight"
        ? DATABASES[(idx + 1) % DATABASES.length]
        : DATABASES[(idx - 1 + DATABASES.length) % DATABASES.length];
      activate(next.key);
      tabsEl.querySelector(`.db-tab[data-key="${next.key}"]`).focus();
    });
    tabsEl.appendChild(btn);
  });

  iframeEl.addEventListener("load", attachAutoResize);
  window.addEventListener("hashchange", () => activate(keyFromHash()));

  activate(keyFromHash(), { updateHash: false });
})();
