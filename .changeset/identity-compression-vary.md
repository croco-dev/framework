---
"@croco/transports-http": patch
---

Compression-eligible identity responses now include Vary: Accept-Encoding, including requests without Accept-Encoding or with all supported encodings rejected. Existing Vary tokens and wildcard values survive route header merging for both identity and compressed responses.
