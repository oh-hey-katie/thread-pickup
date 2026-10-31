import {validateSnapshot, safeChatUrl} from './model.js';
const text = (value, max) => typeof value === 'string' ? value.replace(/\s+/g,' ').trim().slice(0,max) : '';
export function acceptSender(sender) {
  try { return sender.frameId === 0 && Number.isInteger(sender.tab?.id) && new URL(sender.url).origin === 'https://chatgpt.com'; }
  catch { return false; }
}
export function makeSnapshot(observation, previous, now = new Date().toISOString(), tabId = 0) {
  if (!observation || !Array.isArray(observation.chats) || observation.chats.length > 500) throw new Error('Unsupported page observation.');
  const url = new URL(observation.pageUrl);
  if (url.origin !== 'https://chatgpt.com' || url.search || url.hash) throw new Error('Unsupported page URL.');
  const before = previous?.pageUrl === observation.pageUrl ? previous : null;
  // Page-local snapshots intentionally do not merge history across routes, accounts, or tabs.
  const rows = new Map();
  for (const item of observation.chats) {
    const link = safeChatUrl(item.url), title = text(item.title,300);
    if (!link || !link.startsWith('https://chatgpt.com/c/') || item.id !== `chatgpt:${new URL(link).pathname.split('/').at(-1)}` || !title) continue;
    const prior = before?.snapshot.chats.find(c=>c.id===item.id);
    const project = item.project?.id && item.project?.name ? {id:text(item.project.id,200),name:text(item.project.name,100)} : null;
    let summary = 'Seen in your ChatGPT sidebar. No readable conversation excerpt on this page.';
    let handoff = summary;
    let evidence = 'Observed sidebar metadata only. Chat modification time and approval status are unknown.';
    if (item.id === observation.currentId && !observation.streaming) {
      const turns = (Array.isArray(observation.turns) ? observation.turns : []).slice(-2);
      const excerpts = turns.filter(t=>['user','assistant'].includes(t.role) && text(t.text,1800) && !t.unavailable)
        .map(t=>`${t.role === 'user' ? 'You' : 'ChatGPT'}: “${text(t.text,700)}”`);
      if (excerpts.length) {
        summary = `Visible excerpt — ${excerpts.at(-1).slice(0,260)}`;
        handoff = excerpts.join('\n\n');
        if (turns.some(t=>t.unavailable)) handoff += '\n\nChatGPT could not load one of the visible replies.';
        evidence = `Copied from the rendered conversation, not an AI summary. ${observation.atBottom ? 'The page appeared scrolled to the bottom; completeness is not guaranteed.' : 'The page was not at the bottom, so this may be an older exchange.'} No live approval state is available.`;
      }
    }
    if (item.id === observation.currentId && observation.streaming) {
      summary = 'ChatGPT is responding. The excerpt updates after the response finishes.';
      handoff = summary;
    }
    const row = {id:item.id,title,url:link,source:'chatgpt',pinned:item.pinned===true,pinOrder:Number.isFinite(item.order)?item.order:999,project,
      summary,handoff,evidence,nextStep:'Return to the original chat to read the conversation and continue.',approval:{state:'unknown'},updatedAt:now};
    // Repeated observations must not continually resurface dismissed cards or imply fresh activity.
    if (prior && prior.summary === row.summary && prior.handoff === row.handoff && prior.title === row.title && prior.pinned === row.pinned && JSON.stringify(prior.project) === JSON.stringify(row.project)) row.updatedAt = prior.updatedAt;
    rows.set(row.id,row);
  }
  const snapshot = validateSnapshot({version:1,id:`browser-tab:${tabId}`,name:'Automatic browser connection',capturedAt:now,
    coverage:'Only chats rendered in the selected ChatGPT tab. Collapsed projects and unloaded history are missing. Project selection uses observation order, not a verified last-modified time. Excerpts are not AI summaries. Approval status is unknown. Data clears when Chrome closes.',chats:[...rows.values()]});
  return {pageUrl:observation.pageUrl,snapshot,recognized:observation.recognized===true};
}
