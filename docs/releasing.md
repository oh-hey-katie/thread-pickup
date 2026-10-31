# Preparing a public release

Describe this release as a **local desktop preview for Work/Codex history**, not full ChatGPT account sync.

## Source distribution

Run `npm run check`, `npm run build`, then `npm run package:source`. The source archive includes an explicit list of code, tests, documentation, fictional fixtures, and font licenses. It excludes `.private`, real chat data, local screenshots, credentials, and generated builds. Review the archive before uploading it.

Before the first public commit, inspect the staged diff and file list for personal records and secrets. Review the MIT license, README, and bundled font notices. Test setup on a second machine with a compatible desktop app. Other OSes remain unverified. No GitHub repository or remote is created automatically.

A public repository shares code. Each user runs their own local reader; no author's account, subscription, or chat data is included.

## Demo and video

Run the server, open `/walkthrough.html`, and press Play the tour. The 30-second tour uses fictional conversations. Film that page for a safe interface demonstration. To demonstrate an actual desktop handoff publicly, use a dedicated account/project containing only material you intend to show; the author's live shelf contains private information.

Suggested narration:

1. “Thread pickup is a visual place to find where your desktop conversations left off.”
2. “Open a card to catch up on the saved reply.”
3. “Set it aside when you don't need it. The next conversation takes its place, and Undo brings it back.”
4. “The local reader refreshes automatically. Continue in desktop returns you to the original conversation.”
5. “This preview supports local Work/Codex history, with folder grouping where project membership isn't available.”

The fictional demo illustrates approval styling. Do not present it as evidence of live approval integration.

## Optional static hosting

Only deploy the `dist/` output from `npm run build`. This is a fictional demo; a hosted static page cannot read a visitor's desktop history. Never expose the local reader to the public network or deploy the repository root.

## Before a broader release

Verify a clean install on another computer, project membership across app versions, localized pins, and physical touch gestures. Consider a packaged launcher to avoid keeping a terminal open. These are follow-up release improvements, not features claimed by this preview.
