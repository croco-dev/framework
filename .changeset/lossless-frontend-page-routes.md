---
"@croco/frontend-react": major
---

Preserve every meta-vite page route field through `createCrocoPageConfig`, expose all render modes and canonical head metadata, and make ISR revalidation seconds explicit without double conversion at route registration.

Migrate `ssr: false` to `mode: "ssg"` and millisecond `revalidate: 60_000` to `revalidateSeconds: 60`. The deprecated inputs remain available only as a separate compatibility branch and cannot be mixed with canonical options.
