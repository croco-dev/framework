---
---

CI runs cacheable verification experiments only for publish-profile pull requests and manual runs. Documentation builds run alongside API documentation drift checks, so link verification does not wait for the independent drift check.

CI, benchmark, and release Chromium setup bounds APT mirror requests and retries, with a ten-minute installation limit that preserves time for verification and reports setup failures.
