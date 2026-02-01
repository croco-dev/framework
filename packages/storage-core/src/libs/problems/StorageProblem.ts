import { Problem, type ProblemCategory } from '@croco/problems-core';

/**
 * Storage 관련 기반 Problem 클래스
 */
export abstract class StorageProblem extends Problem {
  constructor(code: string, category: ProblemCategory, detail?: string) {
    super(code, category, detail);
  }
}
