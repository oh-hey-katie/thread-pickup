# thread pickup

**Where your chats left off.** A free, local visual shelf for desktop conversations: open a card, read the last saved reply, and jump back into that exact chat.

**Status: working desktop preview, tested on macOS.** Reads local Work/Codex conversation history through an installed compatible app-server. It does **not** sync all regular ChatGPT cloud chats. This is an independent project, not an OpenAI product.

## Start here

1. Install Node.js 22 or newer and a compatible ChatGPT Desktop / Codex installation with existing local conversations.
2. Download and unzip this repository, or clone it. Open a terminal in the project folder.
3. Run:

```sh
npm run doctor
npm start
```

4. Open **http://127.0.0.1:4173/** in Chrome. Keep the terminal running while you use the shelf; Ctrl+C stops it.

There are no npm dependencies to install, API keys to paste, exports to prepare, or per-chat Save buttons. Each person reads their own computer's history. Thread Pickup makes no AI requests and charges neither the author nor the user for model calls. Continuing a chat happens in the user's own desktop app and account.

On macOS the reader detects known app locations, then tries `codex` on PATH. For other installations, set `THREAD_PICKUP_CODEX` to the compatible executable path. The tested executable reports `codex-cli 0.166.0-alpha.5.1`; older or different app-server versions may not support these methods. A second machine and other operating systems have not yet been verified.

## Everyday use

- The shelf checks saved history every 10 seconds and when the page regains focus.
- Pinned-section chats appear first, followed by the newest chat per known project or working folder, plus standalone chats. Nine cards appear at a time.
- Open a card for its last saved reply and the corresponding request. These are excerpts, not AI-generated summaries.
- **Continue in desktop** opens the original chat. Chrome may ask once to open the desktop app. Some embedded browsers block app links; use regular Chrome.
- Swipe a card sideways or press × to set it aside. The next eligible chat takes its place. Undo or Hidden restores it.
- Hiding only changes the shelf. It never deletes, archives, or unpins the source chat. New saved activity can bring a hidden chat back.

## Try or film the demo

With the server running, open **http://127.0.0.1:4173/walkthrough.html** and press **Play the tour**. The 30-second walkthrough opens a card, hides it, and restores it with the actual interface controls. It uses fictional conversations and does not connect that page to desktop history.

For manual exploration, use **http://127.0.0.1:4173/?demo=1**. Demo approval badges illustrate the design; live desktop approval detection is not implemented.

## Privacy

The reader binds to this computer's loopback address only. Chat text is held in the local server and page memory, not written to a Thread Pickup snapshot file or uploaded. Hidden-card IDs/revisions are saved in this browser's local storage. The optional legacy snapshot importer also stores its imported text in local storage; it is not part of desktop setup.

No analytics, remote fonts, credentials collection, or model requests are added by Thread Pickup. The installed app-server can perform its own normal startup housekeeping. The reader only requests allowed history/project read operations; it cannot start turns or execute approvals. Use a trusted browser profile and device: local storage is not an encrypted vault.

Publishing this source code does not publish your chats. Keep private files out of `public/`; the build and source packaging scripts use explicit allowlists. Nothing in this project publishes automatically.

## Coverage and limits

- Reads a bounded recent sample of up to 100 non-archived local records. This is not an account-wide history search.
- Fetches up to three recent turns for context, preferring a completed final reply. Replies still being generated are excluded.
- Uses exact project IDs when available. Otherwise groups by working folder and explicitly labels it **Folder**. Folder grouping may differ from the desktop sidebar; project names may be stale.
- Pins currently rely on a persisted section named `Pinned`; renamed/localized sections need further testing.
- Regular ChatGPT cloud conversations, remote computers, live approvals, and live running status are not connected.
- Tested on the author's Mac, including opening the correct conversation from Chrome. A clean install on a second machine remains a release check.

See [desktop architecture and verification](docs/desktop-connection.md) and [release instructions](docs/releasing.md).

## Development

```sh
npm run check
npm run build
npm run package:source
```

Plain HTML/CSS/JavaScript with a dependency-free Node server. `desktop/` contains the local reader; `public/` contains the interface and fictional demo. The test suite covers selection, hiding/restoring, safe links, bounded read permissions, refresh, reconnects, and local request protections.

`npm run build` creates a static fictional demo in `dist/`. A static hosted site cannot read a visitor's desktop history: the live shelf requires the local server. `npm run package:source` creates an allowlisted source archive in `release/`, excluding private data and generated builds.

The [earlier Chrome extension](docs/browser-connection.md) remains available through `npm run build:extension`. It reads rendered ChatGPT browser pages and is not needed for the desktop shelf. The [snapshot format](docs/snapshot-format.md) remains available for adapter development.

## License

MIT for application code; bundled fonts retain their SIL Open Font Licenses. See [LICENSE](LICENSE) and [font notices](public/fonts/README.md).
