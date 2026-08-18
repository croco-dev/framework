---
editUrl: false
next: false
prev: false
title: "CONTRACT_TEST_SUPPORTED_ZOD_TYPES"
---

> `const` **CONTRACT_TEST_SUPPORTED_ZOD_TYPES**: readonly \[`"ZodString (min/max only)"`, `"ZodNumber (min/max/int only)"`, `"ZodBoolean"`, `"ZodLiteral"`, `"ZodEnum"`, `"ZodNativeEnum"`, `"ZodObject"`, `"ZodArray"`, `"ZodTuple"`, `"ZodUnion"`, `"ZodDiscriminatedUnion"`, `"ZodOptional"`, `"ZodNullable"`, `"ZodDefault"`\]

Generation intentionally supports only deterministic, transport-safe Zod v3 constructs.
Refinements, transforms, records, maps, sets, promises, lazy schemas, `any`, and `unknown`
must be represented by explicit caller-owned arbitraries instead of guessed by this package.
