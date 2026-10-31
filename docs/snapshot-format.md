# pick up snapshot format, version 1

pick up accepts UTF-8 JSON files up to 5 MB and 5,000 chats. Unknown fields are discarded. IDs must be unique across the snapshot; prefix IDs with the source name if several sources are combined.

```json
{
  "version": 1,
  "id": "example-collection",
  "name": "Example collection",
  "capturedAt": "2026-10-29T12:00:00Z",
  "coverage": "Pinned chats and a partial project listing.",
  "chats": [{
    "id": "example-1",
    "title": "Plan a neighborhood exhibition",
    "source": "chatgpt",
    "pinned": true,
    "pinOrder": 1,
    "project": { "id": "example-project", "name": "Exhibition" },
    "updatedAt": "2026-10-29T11:30:00Z",
    "summary": "Compare two possible exhibition layouts.",
    "nextStep": "Return to the proposed layout.",
    "evidence": "Based on the latest available messages.",
    "approval": {
      "state": "waiting",
      "summary": "Review the proposed layout.",
      "checkedAt": "2026-10-29T12:00:00Z"
    }
  }]
}
```

Required: version, capturedAt, chats, and each chat's id, title, and updatedAt. Dates are ISO 8601 timestamps. Optional project may be null. Supported source names are `chatgpt`, `codex`, and `other`.

`approval.state` must explicitly equal `waiting` to show yellow. Missing or other values become `unknown`; activity alone never implies approval. `checkedAt` defaults to the snapshot timestamp when absent. Approval summaries are displayed as text, never treated as instructions or executed.

An optional `url` may point to an original conversation on `https://chatgpt.com/c/…` or `codex://threads/…`. Other protocols and hosts, credentials, queries, and fragments are rejected. Omit links if they have not been supplied or verified by the source.

The queue includes all non-hidden pins, the most recently updated non-hidden conversation in each project, and older project chats with a reported approval. It deduplicates these sets, then sorts approvals first, pins in pin order next, and other project conversations by recency. It does not include unpinned chats without a project.

A dismissal records the chat ID, updatedAt, approval state, and approval summary. A new activity timestamp or changed approval returns the chat to the candidate queue. A newer checkedAt alone does not. Imported collection identity is derived from its sorted chat IDs, so changes to the set of IDs start a separate dismissal collection in this prototype.

Source adapters should preserve stable IDs, use actual project membership, label incomplete coverage, and only include status supported by the source. Keep local paths, credentials, and raw system instructions out of shared snapshots.

For useful handoffs, `summary` should describe the last recorded result, and `nextStep` should give one concrete return action. Keep each to one or two short sentences. Distinguish verified results from editorial suggestions in `evidence`. Omit a next step when the source does not support one. Approval summaries should name the decision or permission requested, not repeat the badge label. Never infer a waiting approval from an unfinished task.

`handoff` is an optional, plain-text explanation for the detail dialog (up to 1,800 characters). `summary` stays short for the tile. Write the handoff in everyday language: who did what, where the result is saved, and what is still unfinished. Put one practical action in `nextStep`. Describe missing information plainly instead of inventing completion. Cross-chat results must identify which chat produced them. Existing snapshots without `handoff` use `summary` in the dialog.
