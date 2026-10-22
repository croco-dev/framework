---
"@croco/storage-s3": minor
"@croco/problems-core": patch
"create-croco-app": patch
---

Provide an application-owned AWS S3 StorageProvider for Node and Lambda with namespaced objects, signed GET URLs, ranged streams and multipart upload cleanup. Default authentication uses the AWS SDK credential chain; live identity and deployment certification remain unverified. Published Problem and project-role metadata recognize the S3 provider.

Named missing-bucket responses remain provider failures instead of being reported as missing objects; bodyless HEAD responses retain their documented ambiguity.
