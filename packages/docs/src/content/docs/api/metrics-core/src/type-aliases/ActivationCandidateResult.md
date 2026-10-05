---
editUrl: false
next: false
prev: false
title: "ActivationCandidateResult"
---

> **ActivationCandidateResult** = `object`

## Properties

### achievementCurve

> `readonly` **achievementCurve**: \{ `reason`: `"missingVerifiedAchievementTimes"` \| `"noAchievedSubjects"`; `status`: `"unsupported"`; \} \| \{ `points`: readonly `object`[]; `status`: `"available"`; \}

---

### candidate

> `readonly` **candidate**: [`ActivationCandidate`](/api/metrics-core/src/type-aliases/activationcandidate/)

---

### cohort

> `readonly` **cohort**: `"new"` \| `"returning"`

---

### coverage

> `readonly` **coverage**: [`ActivationRatio`](/api/metrics-core/src/type-aliases/activationratio/)

---

### DO

> `readonly` **DO**: `number`

---

### eligibleN

> `readonly` **eligibleN**: `number`

---

### excluded

> `readonly` **excluded**: `Readonly`\<`Record`\<`"cohort"` \| `"missingOutcome"` \| `"incompleteObservation"` \| `"missingCount"`, `number`\>\>

---

### NO

> `readonly` **NO**: `number`

---

### noRedo

> `readonly` **noRedo**: [`ActivationRatio`](/api/metrics-core/src/type-aliases/activationratio/)

---

### passesMinSupport

> `readonly` **passesMinSupport**: `boolean`

---

### precision

> `readonly` **precision**: [`ActivationRatio`](/api/metrics-core/src/type-aliases/activationratio/)

---

### RE

> `readonly` **RE**: `number`

---

### support

> `readonly` **support**: [`ActivationRatio`](/api/metrics-core/src/type-aliases/activationratio/)
