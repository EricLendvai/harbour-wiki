(function () {
  "use strict";
  function initTooltips() {
    if (!window.bootstrap || !bootstrap.Tooltip) return;
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (element) {
      bootstrap.Tooltip.getOrCreateInstance(element, { container: "body", trigger: "hover focus" });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initTooltips); else initTooltips();
}());
