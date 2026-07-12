---
"@croco/transports-http": patch
---

Graceful shutdown callers now join one bounded lifecycle and receive typed phase timeout failures. Shutdown hooks receive an `AbortSignal`; zero-argument hook implementations remain assignable, while callers invoking an extracted configured hook must supply that signal.
Non-finite timeout options now fail synchronously with a typed configuration Problem before shutdown state or signal listeners are created.
