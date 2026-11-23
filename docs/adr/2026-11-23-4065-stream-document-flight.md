# Stream a document's Flight payload with its HTML so the shell hydrates early

Ticket: #4065. Supersedes the document-payload decisions of
[2026-11-22-4064-node-rsc-build-worker](2026-11-22-4064-node-rsc-build-worker.md).

## Context

- The #4064 worker buffered a document's whole Flight payload and the host appended it, with a
  `<script type="module">`, after the HTML ended (`rscBuildWorker.mts` `readBase64`, `renderServer.ts`
  `createRscDocumentTail` at `47dbd57`). A pending Suspense boundary keeps that HTML open, so the client
  entry neither arrived nor ran until every boundary resolved. On the PDP lab, holding the
  recommendation source kept `pdp:hydrated` from firing for the whole hold; the preview CTA was visible
  but did nothing.
- A module script without `async` waits for the document to finish parsing, so moving it earlier alone
  does not help. React writes bootstrap modules as `async` right after the shell.
- React may split one flush into several chunks at arbitrary byte offsets, including inside a tag or
  an inline `<style>`, but enqueues all chunks of one flush in the same task.
- The host receives HTML from the worker one message per pull and cannot see where a React flush ends.
- The #4064 document API was unreleased (its changeset was still pending), with three in-repo callers of
  `readRscInitialFlight()`: the example, the create-croco-app template and the packed-consumer fixture.

## Decision

- The worker tees the Flight stream: one branch feeds SSR, the other is written into the HTML as base64
  `<script type="application/json" data-croco-rsc-flight="chunk">` blocks and closed by a
  `data-croco-rsc-flight="end"` block. Blocks are written only after the shell and only when a pending
  HTML read is still unresolved after a macrotask, which marks the end of a React flush. Merging two
  flushes is harmless; splitting one is what the rule prevents.
- `defineRscSsrEntry()` passes the build's client entry to React as `bootstrapModules`; the host no
  longer appends a script or a payload after the HTML. `createRscHtmlShell()` writes
  `<meta name="croco:rsc-initial-flight" content="streamed">` in the head so a client entry that runs
  before the first block still knows the payload is coming.
- `readRscInitialFlight()` keeps its signature and returns a stream that yields each block once its
  text is complete (a closing quote, or `null` for the end block), watches the document for later
  blocks, closes at the end block and fails with `meta-vite/rsc-initial-flight-incomplete` if the
  document finishes without it.
- `RscDocumentRender` loses `embeddedFlight`; its `html` stream carries the payload.

Alternatives not chosen:

- Keep the single element and add the blocks beside it. It keeps the old element readable, but sends
  every Flight byte twice and keeps two delivery paths, with no released consumer to protect.
- Interleave on the host. It keeps the worker unchanged, but the host cannot see React flush
  boundaries across the thread, so a block could land inside a tag.
- Inline executable scripts that push rows into a global, as `rsc-html-stream` does. It needs no
  document observer, but adds a dependency and an inline-script CSP requirement that data blocks avoid.

## Consequences

- The shell and its client islands hydrate and respond while late boundaries are pending; those
  boundaries fill in later without remounting the hydrated islands. The PDP lab's slow-source control
  now regresses recommendation time and must not regress hydration-ready time.
- The worker reads one HTML chunk ahead of the consumer to find flush ends and reads Flight eagerly, as
  the previous full buffering already did; memory per document stays bounded by its Flight payload.
- Cancelling a document does not await the Flight branch, because a tee branch's cancel settles only once
  the SSR decoder's branch is cancelled too; the render's abort signal stops the encoder.
- React writes `<link rel="modulepreload">` at the start of `#root` and its bootstrap script after the
  shell; Chromium hydration of the example and the packed consumer reports no recoverable errors.
- Lambda and Workers hosting for this path stay unverified, as in #4064.
