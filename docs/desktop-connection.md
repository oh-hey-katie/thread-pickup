# Desktop connection

Thread Pickup runs a local Node server. Its read-only client launches the installed `codex app-server --stdio`, lists saved local conversations, and reads bounded recent text. It uses the app-server protocol directly; it does not depend on this assistant's private tools, scrape a credentials file, or require exports.

## Flow

1. `npm run doctor` checks Node and the installed executable. `npm start` launches the loopback-only shelf.
2. The page requests a fresh shelf every ten seconds and on focus. The server coalesces simultaneous reads and caches results for eight seconds.
3. Five pages of twenty records bound discovery to one hundred recent local records. Spawned child conversations and ephemeral records are excluded. A remaining cursor is reported as partial coverage.
4. Project IDs are used only when actually present. Exact working folders provide a clearly labeled fallback. Up to thirty representatives have recent excerpts prefetched; opening a card reads its recent context on demand.
5. The last completed saved reply and corresponding request provide resume context. No response is generated and no approval status is inferred.
6. `codex://threads/<thread-id>` returns the user to the existing conversation. Continuing work happens in their own app/account.

## Read boundary

After initialization, only `thread/list`, `thread/read`, `thread/turns/list`, `project/list`, and `project/read` are allowed. Reverse execution requests are rejected. The project API is experimental and may change. `useStateDbOnly: true` avoids list-time scan-and-repair of conversation files. The installed app-server may perform normal startup housekeeping; read-only describes conversation operations, not a guarantee of zero disk writes by that application.

API requests require the expected Host, same-origin context, and a custom header; no CORS is enabled. The server listens on `127.0.0.1`, not the network. Private text stays in memory. The UI retains the last successful shelf during a connection failure and retries automatically. Logs omit private app-server diagnostics.

## Validation

Tested on macOS with Node 24.14.1 and `codex-cli 0.166.0-alpha.5.1`. Local conversation discovery, saved reply/request display, automatic refresh, hide/replacement/Undo, recovery from reader failure, and opening the intended desktop conversation from regular Chrome were exercised. The embedded browser blocked app links, so regular Chrome is recommended.

All 42 automated tests passed. The source package was extracted into a fresh folder on the same machine; setup detection, tests, and the public build passed there too. This is not a second-machine compatibility test.

## Honest gaps

The experimental project API does not reliably provide conversation membership matching the desktop sidebar in the tested version. Therefore the UI uses **Folder** labels when canonical assignments are unavailable. No source project records are modified to work around this.

A separate reader reports `notLoaded` even for a conversation actively running in the desktop app. This is not proof that the conversation is idle or approval-free. Live status and approvals remain unknown.

Regular cloud ChatGPT history and remote-host chats are not covered. Local persisted `Pinned` sections were observed, but localization and custom naming are unverified. No clean second-machine install, Windows/Linux support, or physical touch-device validation is claimed.

## Troubleshooting

- **No desktop command:** install a compatible desktop app/CLI, or set `THREAD_PICKUP_CODEX` to its executable path. Do not paste credentials into Thread Pickup.
- **Reader unavailable:** check the app/CLI version and that local history exists under the same OS user. Retry; the prior successful shelf remains visible.
- **Missing chats:** check Your sources for coverage. This is local bounded history, not all regular ChatGPT chats. Archived/remote history is excluded.
- **App link does nothing:** use regular Chrome and accept its desktop-app prompt. A compatible desktop URL handler must be installed.
- **Port occupied:** stop the previous preview or use `PORT=4175 npm start` and the printed URL.

For aggregate diagnostics, run `npm run probe:desktop`. `--show-titles` prints personal titles and identifiers; keep that output out of public issues and recordings.

Protocol references: [app-server](https://learn.chatgpt.com/docs/app-server) and [supported desktop links](https://learn.chatgpt.com/docs/reference/commands#supported-links).
