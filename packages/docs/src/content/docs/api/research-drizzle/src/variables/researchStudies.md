---
editUrl: false
next: false
prev: false
title: "researchStudies"
---

> `const` **researchStudies**: `PgTableWithColumns`\<\{ `columns`: \{ `identity`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `true`; `name`: `"identity"`; `notNull`: `true`; `tableName`: `"research_studies"`; \}, \{ \}, \{ \}\>; `record`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgJsonb"`; `data`: [`ResearchRecord`](/api/research-core/src/type-aliases/researchrecord/); `dataType`: `"json"`; `driverParam`: `unknown`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"record"`; `notNull`: `true`; `tableName`: `"research_studies"`; \}, \{ \}, \{ `$type`: [`ResearchRecord`](/api/research-core/src/type-aliases/researchrecord/); \}\>; \}; `dialect`: `"pg"`; `name`: `"research_studies"`; `schema`: `undefined`; \}\>

One bounded aggregate owns study, candidate, consent, invitation, note and audit state atomically.
