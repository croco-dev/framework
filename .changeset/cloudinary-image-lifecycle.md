---
"@croco/storage-cloudinary": minor
"@croco/testing": minor
"@croco/problems-core": patch
---

Keep accepted Cloudinary uploads addressable across reads, metadata checks, existence checks, and deletion by restricting the provider to the image resource namespace.

Allow storage provider conformance suites to select a provider-supported upload content type.

Update Cloudinary Problem metadata for the image-only resource contract.

Existing video or raw assets uploaded through earlier releases are not reachable through the image-only provider. Operators must inventory and clean up those legacy assets separately through Cloudinary before upgrading.
