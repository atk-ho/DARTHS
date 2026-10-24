/* Home-only enhancements. Uses existing player persistence and rendering. */
(() => {
  const init = () => {
    const add = document.getElementById('homeQuickAdd');
    const clear = document.getElementById('homeClearSelection');
    if (!add || !clear) return;
    add.addEventListener('click', () => {
      const name = prompt('New player name:');
      if (name === null) return;
      const trimmed = name.trim().slice(0,30);
      if (!trimmed) return;
      const input = document.getElementById('newName');
      const button = document.getElementById('addPlayer');
      if (input && button) { input.value = trimmed; button.click(); }
    });
    clear.addEventListener('click', () => {
      document.querySelectorAll('#selection input[data-select]:checked').forEach(box => {
        box.checked = false;
        box.dispatchEvent(new Event('change', {bubbles:true}));
      });
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
