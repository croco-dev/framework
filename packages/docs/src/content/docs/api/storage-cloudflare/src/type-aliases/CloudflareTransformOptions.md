---
editUrl: false
next: false
prev: false
title: "CloudflareTransformOptions"
---

> **CloudflareTransformOptions** = `object`

Cloudflare 고유 변환 옵션입니다.

## Properties

### blur?

> `optional` **blur?**: `number`

블러 (1-1000)

---

### dpr?

> `optional` **dpr?**: `number`

Device Pixel Ratio

---

### fit?

> `optional` **fit?**: `"scale-down"` \| `"contain"` \| `"cover"` \| `"fill"`

맞춤 방식

- scale-down: 비율 유지하며 지정 크기 내에서 축소
- contain: 비율 유지하며 지정 크기에 맞춤 (여백 있음)
- cover: 비율 유지하며 지정 크기 채움 (자름)
- fill: 비율 무시하고 지정 크기 채움

---

### format?

> `optional` **format?**: `"webp"` \| `"avif"` \| `"jpeg"` \| `"png"` \| `"gif"`

출력 형식

---

### grayscale?

> `optional` **grayscale?**: `boolean`

그레이스케일 변환

---

### height?

> `optional` **height?**: `number`

높이 (px)

---

### invert?

> `optional` **invert?**: `boolean`

반전

---

### quality?

> `optional` **quality?**: `number`

품질 (1-100)

---

### rotate?

> `optional` **rotate?**: `number`

회전 (0-359)

---

### sharpen?

> `optional` **sharpen?**: `number`

선명화 (1-10)

---

### width?

> `optional` **width?**: `number`

너비 (px)
