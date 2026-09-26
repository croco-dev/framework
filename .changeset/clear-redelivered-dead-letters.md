---
"@croco/events-core": minor
"@croco/events-inmemory": patch
---

Remove a handler's dead-letter entry when publishing the same event succeeds, so later replay does not repeat its side effects. A failed removal now rejects publication and leaves the entry available for recovery. Custom `DeadLetterQueue` implementations must implement the new required `removeHandlerItem(eventId, handlerId)` method.
