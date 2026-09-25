---
"@croco/transports-http": patch
---

Lambda handlers base64-encode responses that carry a non-identity `Content-Encoding` or a body that is not valid UTF-8, so compressed responses reach clients byte-for-byte.
