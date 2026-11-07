---
"@croco/referral-core": patch
"@croco/problems-core": patch
---

Reject positive qualification evidence that does not match the pinned referral program action or lacks a non-blank event identity or eligibility reason, preserving the claim and reservation for a corrected adapter retry. The exported `ReferralQualificationEvidenceInvalidProblem` uses `referral-core/qualification-evidence-invalid` (status 500, `retryable: false`); its registry recovery metadata requires correcting the adapter before retrying.
