---
"@croco/storage-cloudinary": patch
---

- fix(storage-cloudinary): reject keys that URL normalization would resolve to another public ID. Keys containing `?`, `&`, `#`, `\`, `%`, `<`, `>`, leading or trailing spaces, control characters, or lone surrogates now fail with `InvalidKeyProblem` before any URL is built or requested.
