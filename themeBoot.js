// SPDX-License-Identifier: MPL-2.0
(function () {
  const THEME_KEY = "worldsmith.theme";

  try {
    let theme = localStorage.getItem(THEME_KEY);
    if (!theme && window.matchMedia("(prefers-color-scheme: light)").matches) {
      theme = "light";
    }
    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch {
    // Ignore storage/matchMedia failures and allow the default theme.
  }
})();
