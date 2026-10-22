// Applies the saved (or system) theme before first paint. External file so the CSP can
// forbid inline scripts.
(function () {
  var theme;
  try {
    theme = localStorage.getItem("theme");
  } catch {
    theme = null;
  }
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.theme = theme;
})();
