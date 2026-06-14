(function () {
  "use strict";

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function setupFilter(container) {
    const inputSelector = container.getAttribute("data-filter-input");
    if (!inputSelector) return;

    const input = document.querySelector(inputSelector);
    if (!input) return;

    const sections = Array.from(container.querySelectorAll("[data-filter-section]"));
    const rows = Array.from(container.querySelectorAll("[data-filter-item]"));
    const empty = container.querySelector("[data-filter-empty]");

    function applyFilter() {
      const query = normalize(input.value);
      let visibleRows = 0;

      rows.forEach(row => {
        const haystack = normalize(row.getAttribute("data-filter-text") || row.textContent);
        const visible = !query || haystack.includes(query);
        row.hidden = !visible;
        if (visible) visibleRows += 1;
      });

      sections.forEach(section => {
        const hasVisibleRows = Array.from(section.querySelectorAll("[data-filter-item]")).some(row => !row.hidden);
        section.hidden = !hasVisibleRows;
      });

      if (empty) empty.hidden = visibleRows !== 0;
      container.classList.toggle("hw-filter-empty", visibleRows === 0);
    }

    input.addEventListener("input", applyFilter);
    applyFilter();
  }

  document.querySelectorAll("[data-filter-list]").forEach(setupFilter);
}());
