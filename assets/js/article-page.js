(function () {
  "use strict";

  const fallback = document.querySelector("[data-close-fallback]");

  function showFallback() {
    if (fallback) fallback.hidden = false;
  }

  document.querySelectorAll("[data-close-article]").forEach(button => {
    button.addEventListener("click", () => {
      window.close();
      window.setTimeout(showFallback, 300);
    });
  });
}());
