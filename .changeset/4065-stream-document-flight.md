---
"@croco/meta-vite": minor
"@croco/problems-core": patch
---

Hydrate the shell of a Node RSC production-build document before its late Suspense boundaries resolve (#4065).

A document rendered through `loadRscBuild()` now streams the Flight bytes it comes from inside its
HTML, as base64 `<script type="application/json" data-croco-rsc-flight>` blocks. Blocks are written
only after the shell and between whole React flushes, and an `end` block closes them.
`defineRscSsrEntry()` passes the client entry to React as a bootstrap module, which React writes as an
`async` script right after the shell, so the browser entry runs while late boundaries are still
pending. `readRscInitialFlight()` keeps its name and no-argument call and now returns a stream that
yields each block as the parser reaches it, tracking blocks by identity so a hydration mismatch that
makes React empty `#root` does not lose rows. Client islands in the shell hydrate and respond before a slow boundary
resolves, and that boundary fills in later without remounting them. Hydration still uses the same
Flight bytes as the HTML, with no second request. A document that ends without its `end` block, or a
block that cannot be decoded, fails that stream with the new `meta-vite/rsc-initial-flight-incomplete`
Problem.

These changes replace parts of the unreleased #4064 document API:

- `RscDocumentRender` no longer has `embeddedFlight`; its `html` stream carries the payload.
- The single `#croco-rsc-initial-flight` element and the trailing `<script type="module">` are gone.
  `createRscHtmlShell()` takes an optional `{ streamedFlight }` that writes
  `<meta name="croco:rsc-initial-flight" content="streamed">`.
- `readRscInitialFlight(doc?)` takes a DOM `Document`.
- `defineRscSsrEntry()` calls `renderToReadableStream` with `bootstrapModules`, and built `ssr` entries are
  marked `croco.meta-vite.rsc-ssr-entry.v2`: `loadRscBuild()` refuses a build made before this change,
  whose `ssr` entry does not write the client entry. Rebuild the app.

Browser entries that call `readRscInitialFlight()` without arguments need no change. The blocks are data,
not script, so they add no CSP requirement; React's streaming Suspense still writes inline scripts.
