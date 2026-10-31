# Automatic browser connection — developer preview

This is the first connection prototype, not a finished account-wide sync. It uses the same Thread Pickup shelf and updates without a per-chat Save button. It runs entirely in your Chrome browser. No AI account, API key, paid service, or author-owned credentials are used in this preview.

## One-time setup

1. Download or clone this repository. Install Node.js 22 or newer.
2. In the project folder, run `npm run build:extension`. No dependency installation is needed.
3. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
4. Choose **Load unpacked** and select the generated **extension-dist** folder.
5. Open or reload ChatGPT. Use the extension's toolbar button to open your shelf.

The toolbar button only opens the shelf. It does not capture or save a particular chat. Capture runs automatically from loaded ChatGPT tabs, including background tabs, normally after the page settles for about a second, with a five-second recovery check. Leave the extension folder in place. After pulling code updates, rebuild and use Chrome's Reload control for the extension, then reload ChatGPT.

## What works in this preview

- Detects pin status from ChatGPT's explicit Pin/Unpin controls.
- Automatically expands up to 25 sidebar projects per page load and reveals up to three project-list “Show more” controls (once per list). It never opens chat links or clicks New chat.
- Respects projects you collapse afterward until the page reloads. Detects project membership from the resulting conversation lists.
- Reads up to the last two rendered message bodies in the current chat. These are labeled as excerpts, not generated summaries.
- Updates an open shelf through extension storage change events.
- Preserves a hidden card across unchanged observations; a changed excerpt or metadata resurfaces it.
- Handles unloaded replies and streaming responses without representing either as a completed summary.
- Uses only metadata from sidebar rows and rendered message bodies. Unsent composer drafts are excluded.

## What does not work yet

- **Complete history:** projects beyond the discovery limit, unsupported controls, and chats missing from the rendered sidebar remain unavailable. The extension does not navigate through chats or call undocumented ChatGPT endpoints.
- **Persistent collected history:** snapshots are per tab and replace the previous page observation. Moving to another chat replaces its excerpt; earlier excerpts are not accumulated. Closing a ChatGPT tab retains its last snapshot, labeled as closed. Closing Chrome clears all captured text.
- **Account-wide latest activity:** ChatGPT's rendered sidebar does not provide a verified last-modified timestamp. Project representatives use observed sidebar order. Stored dates are observation dates.
- **Guaranteed latest reply:** virtualization or scrolling may expose older messages. Excerpts report whether the page appeared at the bottom, without claiming completeness.
- **AI summaries or subscription connection:** neither is implemented. The planned user-owned ChatGPT plan connection is separate from reading chat history.
- **Approvals:** the browser adapter always reports unknown. It never guesses a pending approval from conversational text.
- **Other clients and languages:** the adapter targets the English ChatGPT website structure observed October 30, 2026. Native desktop/mobile apps, Codex, other AI providers, and other sidebar layouts are not supported by this adapter.

In **Your sources**, choose a ChatGPT tab when multiple tabs are open. Tabs are kept separate and do not merge into an account history. **Clear captured excerpts** clears the session data; subsequent changed pages can populate it again. Disable or remove the extension in Chrome to stop observation.

## Privacy and permissions

The extension requests `storage` plus automatic content-script access to `https://chatgpt.com/*`. It has no cookie permission, no browsing-history permission, no remote scripts, no analytics, no external messaging, and no external backend. Its toolbar button opens its own packaged shelf. It stores up to eight tab snapshots with at most 500 sidebar rows per tab and bounded excerpts in Chrome session storage. Session storage is unavailable to content scripts by default.

The shelf's hide preferences use extension-origin local storage and may persist across browser restarts; they contain identifiers/revision strings, not full transcripts. Imported snapshots, if you choose to use the separate developer import feature, also persist locally until removed. Browser profile storage is not an encrypted vault. This preview does not send captured excerpts to an AI provider.

A future AI summary feature must explicitly connect the user's own account and explain which captured excerpts are sent to OpenAI. Never put a developer's credentials or personal snapshots in the public repository.

## Verification

`npm run check` covers model behavior and capture boundaries. `node scripts/test-browser.mjs` serves a fictional DOM fixture on localhost port 4174. It runs the actual capture/observer scripts with an in-memory transport. Use its buttons to verify that edits, missing replies, and pin changes trigger automatic updates; check that the unsent draft never appears in the output.

This fixture is not a substitute for loading the packaged extension. A real installed-extension test is still required for permissions, service-worker messaging, and shelf updates across tabs. Test those before calling this release ready.

Official references: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [load an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked), [user-owned ChatGPT plan usage for open-source apps](https://developers.openai.com/siwc/token-sharing-open-source).


The browser adapter is an earlier preview. Its DOM discovery and capture boundaries are covered by the automated tests, but website layout changes can break detection. Use the desktop reader described in the main README for local desktop history.
