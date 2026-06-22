---
editUrl: false
next: false
prev: false
title: "UploadIntent"
---

> **UploadIntent** = `object`

업로드 의도 (클라이언트 직접 업로드용)

## Properties

### expiresAt

> **expiresAt**: `Date`

만료 시간

---

### fields?

> `optional` **fields?**: `Record`\<`string`, `string`\>

업로드에 필요한 추가 필드 (multipart/form-data)

---

### publicUrl

> **publicUrl**: `string`

업로드 후 public URL

---

### uploadUrl

> **uploadUrl**: `string`

업로드 URL
