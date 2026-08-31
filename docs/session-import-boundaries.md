# Configuration and session import: separate steps

[English README](../README.md) · [中文首次迁移指南](./first-migration.zh.md#重复导入不是覆盖也不是完整回滚)

Use Movein for configuration and [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import) for conversation history. Install only the tool you need. The projects link to each other, but the combined workflow is **not jointly validated or endorsed**. This guide does not install both plugins, enable automatic synchronization, or reuse private transcripts.

## Preview, apply, then check each operation

1. In Movein, preview the selected configuration, inspect conflicts and unsupported entries, then explicitly apply. Run `npx dsh-movein doctor` and inspect its recorded destinations. Existing targets are skipped, not overwritten.
2. If history is also needed, separately preview the chosen sources with chat-import's panel, `scan_discover`, or `preview: true`. After confirming the selection, import and inspect each result's `status` and session ID. A successful Movein run says nothing about this result.
3. Run chat-import's read-only `doctor` tool or `/doctor` command in its own host context. It checks registry records, imported sessions, skills, and workspace availability; it does not import, synchronize, or delete files. Neither doctor's result certifies a combined live session.

Chat-import also offers a lightweight `import_agents` path; it is not a replacement for complete hooks, permission-rule, or settings migration. Do not migrate the same skill with both tools without reviewing the existing destination.

## Repeating a history import

These behaviors cover the default append-only import path, with `replace` and automatic sync left off. They are documented against chat-import source snapshot [`f457adb`](https://github.com/Nwflower/dsh-chat-import/tree/f457adb3fc0510761e2c08fb3c99f77ec7c61cc6) and the [maintainer's review](https://github.com/Nwflower/dsh-chat-import/discussions/32#discussioncomment-18217949). Recheck the installed version's documentation before relying on them.

| Scenario | Expected result | What is preserved |
| --- | --- | --- |
| Same source, unchanged | `already-imported`; the unchanged-source fast path does not reread or append | Existing session and events |
| Source gains new turns | `appended` to the same session | Previously imported events |
| Source loses turns | `already-imported` with `sourceShrunk: true` | Target is not truncated |
| Source changes within existing turns | May report `changedInPlace` and skip | Existing history is not rewritten |
| Explicit `force: true` | Complete copy under a new suffixed ID | Old session remains; this is not overwrite |
| Reimport after retraction and artifact deletion meets a stale host ID | `staleGhost` with a new suffixed ID | The stale ID is not reused |

Do not interpret `already-imported` as a guarantee that edited source history replaced the destination. Inspect warning flags. Do not use `force` as a generic retry: it intentionally creates another copy.

The separate explicit `replace: true` mode is outside this preservation contract: the pinned tests include replacing a Cursor import under the same ID with `status: replaced`. Leave it off for this walkthrough; `force` and `replace` are not interchangeable.

## Undo and deletion have different boundaries

- **Movein `restore`:** restores the newest `cordis.patch.yml` backup. It does not remove migrated skills, undo chat imports, or roll back a whole profile. Inspect the manifest and individual destinations before any manual cleanup. Copied skills are also not a sync channel: later source edits do not overwrite existing copies on another apply. Symlinks are different because they still point at their source.
- **Chat-import `retract_import`:** removes the import registry record and returns manual deletion guidance. It never deletes session artifacts. `removed: true` refers to the registry operation, not file deletion. Reimporting while the old session remains can recover the registry record instead of creating a fresh session.
- **Chat-import History panel:** a separately confirmed deletion can remove sessions recorded as created by that plugin. The host currently has no official session-delete API, so this uses out-of-band maintenance. Verify the exact session and any backup needs before confirming; this is not the non-deleting retract operation.
- **Stale host entries:** after artifacts are deleted, the old ID may remain visible until the host restarts. A lingering list entry alone does not prove a second import occurred.

## Synthetic checks and their limits

Movein's [first-migration demo](../demo/verify-first-migration.mjs) runs the real scan, plan, apply, backup, and restore functions inside an owned temporary root. It checks preview without writes, conflict preservation, byte-identical skill copies, unchanged source and session-placeholder files, a no-op repeat, changed-source copy preservation, and patch-only restore. CI runs it on Linux, Windows, and macOS. Run it from this repository after `npm ci`:

```sh
node demo/verify-first-migration.mjs
```

The transcript and destination session placeholders are synthetic files, not a live DSH session. No model, hook, GitHub action, DSH installation, or companion-plugin installation runs in this demo. The script removes only its own temporary root, including on assertion failure.

Chat-import has its own synthetic tests at the pinned source snapshot:

- [`test/index.test.mjs`](https://github.com/Nwflower/dsh-chat-import/blob/f457adb3fc0510761e2c08fb3c99f77ec7c61cc6/test/index.test.mjs): unchanged-source fast path, append-only growth, shrinking/in-place changes, force-copy behavior, and batch counters.
- [`test/req33.test.mjs`](https://github.com/Nwflower/dsh-chat-import/blob/f457adb3fc0510761e2c08fb3c99f77ec7c61cc6/test/req33.test.mjs): non-deleting retraction, repeat retraction, registry recovery, and stale-host-ID reimport.
- [`test/purge.test.mjs`](https://github.com/Nwflower/dsh-chat-import/blob/f457adb3fc0510761e2c08fb3c99f77ec7c61cc6/test/purge.test.mjs): the separately gated artifact-deletion path.
- [`test/command.test.mjs`](https://github.com/Nwflower/dsh-chat-import/blob/f457adb3fc0510761e2c08fb3c99f77ec7c61cc6/test/command.test.mjs) and [`test/doctor.test.mjs`](https://github.com/Nwflower/dsh-chat-import/blob/f457adb3fc0510761e2c08fb3c99f77ec7c61cc6/test/doctor.test.mjs): import/doctor command behavior and registry-ID collection.

Those tests use mocked host services and synthetic data, with temporary files where needed. Run them only from a separate test checkout with disposable `DSH_HOME` and temporary-directory settings, following that project's development instructions. Movein does not download or run another repository's tests as part of its normal installation or CI.

Separate passing checks are evidence for each component's contract, **not** for installing both plugins into one real DSH profile, browser interaction, model continuation, or cross-platform combined acceptance. Keep these gates separate until a real joint test is reviewed.
