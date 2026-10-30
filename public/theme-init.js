// Applies the saved/system theme before first paint, so there is no light/dark flash.
// Lives in its own file (not an inline script) so the server's Content-Security-Policy
// can stay strict: script-src 'self'.
(function () {
  try {
    var t = localStorage.getItem("questly_theme") || "system";
    var dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
