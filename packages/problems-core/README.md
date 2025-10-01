# @croco/problems-core

Problem abstraction utilities shared across Croco services.

## Installation

```bash
pnpm add @croco/problems-core
```

## Usage

```ts
import { Problem, ProblemCategory } from '@croco/problems-core';

enum ProjectProblemCode {
  DuplicateProjectName = 'project/duplicate-project-name',
}

class ProjectProblem extends Problem {
  constructor(code: ProjectProblemCode, category: ProblemCategory, detail?: string) {
    super(code, category, detail);
  }
}

export class ProjectProblems {
  static duplicateProjectName(name: string) {
    return new ProjectProblem(
      ProjectProblemCode.DuplicateProjectName,
      ProblemCategory.Conflict,
      name
    );
  }
}
```

## API

- `ProblemCategory` — shared set of problem categories aligned to HTTP semantics.
- `Problem` — extendable error abstraction carrying codes and category metadata.
- `ProblemCategoryMapper.toHttpStatus(category)` — translate a category to an HTTP status code.
