---
editUrl: false
next: false
prev: false
title: "TransformOptions"
---

> **TransformOptions** = `object`

이미지 변환 옵션

## Properties

### dpr?

> `optional` **dpr?**: `number`

Device Pixel Ratio (1-3)

---

### fit?

> `optional` **fit?**: `"cover"` \| `"contain"` \| `"fill"` \| `"inside"` \| `"outside"`

리사이징 모드

- cover: 비율 유지하면서 채우기 (자르기)
- contain: 비율 유지하면서 맞추기 (여백)
- fill: 비율 무시하고 채우기
- inside: 비율 유지, 지정 크기 내에 맞춤
- outside: 비율 유지, 지정 크기覆盖

---

### format?

> `optional` **format?**: `"webp"` \| `"avif"` \| `"jpg"` \| `"png"` \| `"auto"`

출력 형식

---

### height?

> `optional` **height?**: `number`

대상 높이 (px)

---

### quality?

> `optional` **quality?**: `number`

품질 (1-100)

---

### width?

> `optional` **width?**: `number`

대상 너비 (px)
