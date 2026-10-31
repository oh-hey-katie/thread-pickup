/* Bounded sidebar discovery. Never clicks chat links, new-chat controls, or approval actions. */
(() => {
  const attempted = new Set();
  const expandedLists = new WeakSet();
  let expansions = 0, moreClicks = 0, lastAction = -Infinity;
  function step(doc, href, now = Date.now()) {
    const page = new URL(href);
    if (page.origin !== 'https://chatgpt.com' || /^\/(auth|share)(\/|$)/.test(page.pathname) || now-lastAction < 1100) return;
    const rows = [...doc.querySelectorAll('[data-app-action-sidebar-project-row][data-app-action-sidebar-project-id]')]
      .filter(row=>!row.closest('main') && row.getClientRects().length);
    for (const row of rows) {
      const id = row.getAttribute('data-app-action-sidebar-project-id');
      const name = row.getAttribute('data-app-action-sidebar-project-label');
      if (!id || !name || attempted.has(id)) continue;
      if (row.getAttribute('data-app-action-sidebar-project-collapsed') === 'false') {
        // Respect projects the user had already opened, including any later manual collapse.
        attempted.add(id); continue;
      }
      if (expansions >= 25 || row.getAttribute('data-app-action-sidebar-project-collapsed') !== 'true') continue;
      const toggle = [...row.querySelectorAll('button[aria-expanded="false"]')]
        .find(button=>button.getAttribute('aria-label') === `Expand ${name}`)
        || (row.getAttribute('role') === 'button' && row.getAttribute('aria-expanded') === 'false' ? row : null);
      if (!toggle || toggle.disabled || toggle.getAttribute('aria-disabled') === 'true') continue;
      attempted.add(id); expansions++; lastAction=now;
      toggle.click(); return;
    }
    // Restrict "Show more" to the project list itself, never chat history or message content.
    if (moreClicks >= 3 || expansions >= 25) return;
    for (const list of new Set(rows.map(row=>row.closest('[role="list"]')).filter(Boolean))) {
      if (expandedLists.has(list)) continue;
      const more = [...list.querySelectorAll('button')].find(button=>
        button.textContent.trim() === 'Show more' && !button.closest('[data-app-action-sidebar-project-row]') &&
        button.closest('[role="list"]') === list && button.getClientRects().length && !button.disabled && button.getAttribute('aria-disabled') !== 'true');
      if (!more) continue;
      expandedLists.add(list); moreClicks++; lastAction=now;
      more.click(); return;
    }
  }
  globalThis.ThreadPickupDiscovery = {step};
})();
