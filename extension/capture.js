/* Read rendered ChatGPT UI only. No cookies, private endpoints, drafts, or page globals. */
(() => {
  function chatUrl(value, base = 'https://chatgpt.com') {
    try {
      const url = new URL(value, base);
      if (url.origin !== 'https://chatgpt.com' || url.username || url.password || url.search || url.hash) return null;
      const match = url.pathname.match(/^(?:\/g\/(g-p-[\w-]+))?\/c\/([\w-]+)$/);
      return match ? {id: `chatgpt:${match[2]}`, url: `https://chatgpt.com/c/${match[2]}`, projectId: match[1] || null} : null;
    } catch { return null; }
  }
  const clean = (s, limit = 1800) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, limit);
  function read(doc, href) {
    const page = new URL(href);
    if (page.origin !== 'https://chatgpt.com' || page.search || /^\/(auth|share)(\/|$)/.test(page.pathname)) return null;
    const current = chatUrl(href);
    const rows = new Map();
    for (const a of doc.querySelectorAll('a[data-interactive-row-link][href]')) {
      const link = chatUrl(a.getAttribute('href'));
      const row = a.closest('[data-sidebar-cycle-item][role="group"]');
      if (!link || !row) continue;
      const title = clean(a.getAttribute('aria-label') || a.innerText, 300);
      if (!title) continue;
      const list = a.closest('[role="list"][aria-label^="Chats in "]');
      const projectName = clean(list?.getAttribute('aria-label')?.slice(9), 100);
      const pin = row.querySelector('button[aria-label="Unpin chat"]') ? true : row.querySelector('button[aria-label="Pin chat"]') ? false : null;
      const prior = rows.get(link.id);
      rows.set(link.id, {
        id: link.id, url: link.url, title,
        pinned: pin === true || prior?.pinned === true,
        project: projectName && link.projectId ? {id:link.projectId, name:projectName} : prior?.project || null,
        order: prior?.order ?? rows.size,
      });
    }
    // Only read message bodies, never contenteditable/composer text. Both observed and legacy layouts.
    const turns = [];
    for (const h of doc.querySelectorAll('main [data-conversation-role]')) {
      const role = h.getAttribute('data-conversation-role');
      if (!['user','assistant'].includes(role)) continue;
      const container = h.parentElement;
      const body = container.querySelector(role === 'user' ? '[data-user-message-bubble]' : '[data-markdown-text-style="assistant-message"]');
      const failed = !!container.querySelector('[data-dil-render-failed]');
      const text = failed ? '' : clean(body?.innerText);
      if (text || failed) turns.push({role, text, unavailable:failed});
    }
    if (!turns.length) {
      for (const m of doc.querySelectorAll('main [data-message-author-role]')) {
        const role = m.getAttribute('data-message-author-role');
        if (['user','assistant'].includes(role)) turns.push({role,text:clean(m.innerText),unavailable:false});
      }
    }
    const streaming = !!doc.querySelector('button[aria-label="Stop generating"], button[data-testid="stop-button"], [data-talvt-turn-state="streaming"]');
    const expectedTitle = current && rows.get(current.id)?.title;
    const pageTitle = clean(doc.title,300).replace(/\s*[-–] ChatGPT$/, '');
    const conversationIds = [...doc.querySelectorAll('main [data-chatgpt-selection-conversation-id]')].map(e=>e.getAttribute('data-chatgpt-selection-conversation-id'));
    const currentMatches = !!expectedTitle && pageTitle === expectedTitle && conversationIds.every(id=>`chatgpt:${id}`===current.id);
    // UI virtualization can mean the last rendered message is not the actual last message.
    const markers = [...doc.querySelectorAll('main [data-conversation-role], main [data-message-author-role]')];
    let scroller = markers.at(-1)?.parentElement;
    let atBottom = false;
    while (scroller && scroller !== doc.body) {
      if (scroller.scrollHeight > scroller.clientHeight + 30 && ['auto','scroll'].includes(getComputedStyle(scroller).overflowY)) {
        atBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 120;
        break;
      }
      scroller = scroller.parentElement;
    }
    if (!scroller || scroller === doc.body) atBottom = true;
    return {
      pageUrl: page.href, currentId: current?.id || null,
      chats: [...rows.values()].slice(0,500),
      turns: streaming || !currentMatches ? [] : turns.slice(-2), streaming, atBottom,
      recognized: rows.size > 0,
    };
  }
  globalThis.ThreadPickupCapture = {read, chatUrl};
})();
