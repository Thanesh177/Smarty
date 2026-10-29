/* Runs before the first paint. Keep the key in sync with lib/appTheme.js. */
(function () {
  var theme = 'dark';
  try { if (localStorage.getItem('smarty:appearance:v1') === 'day') theme = 'day'; } catch (_) { /* Storage is optional. */ }
  var root = document.documentElement;
  root.setAttribute('data-app-theme', theme);
  root.style.colorScheme = theme === 'day' ? 'light' : 'dark';
  root.style.backgroundColor = theme === 'day' ? '#f4efe6' : '#06070a';
  var color = document.querySelector('meta[name="theme-color"]');
  if (color) color.setAttribute('content', theme === 'day' ? '#f4efe6' : '#06070a');
  var scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute('content', theme === 'day' ? 'light' : 'dark');
})();
