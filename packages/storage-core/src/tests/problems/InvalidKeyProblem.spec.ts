import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { InvalidKeyProblem } from '../../libs/problems/InvalidKeyProblem';

describe('InvalidKeyProblem', () => {
  it('code, category, message가 올바르게 설정됨 (reason 없음)', () => {
    const problem = new InvalidKeyProblem('invalid/key');

    expect(problem.code).toBe('STORAGE_INVALID_KEY');
    expect(problem.category).toBe(ProblemCategory.BadRequest);
    expect(problem.detail).toBe("Invalid storage key 'invalid/key'");
  });

  it('reason 포함하여 생성 시 메시지에 reason 포함됨', () => {
    const problem = new InvalidKeyProblem('/invalid', 'Key must not start or end with /');

    expect(problem.code).toBe('STORAGE_INVALID_KEY');
    expect(problem.category).toBe(ProblemCategory.BadRequest);
    expect(problem.detail).toBe("Invalid storage key '/invalid': Key must not start or end with /");
  });

  it('다양한 reason으로 메시지 생성', () => {
    const problem1 = new InvalidKeyProblem('key//path', 'Key must not contain //');
    expect(problem1.detail).toBe("Invalid storage key 'key//path': Key must not contain //");

    const problem2 = new InvalidKeyProblem('', 'Key must be a non-empty string');
    expect(problem2.detail).toBe("Invalid storage key '': Key must be a non-empty string");
  });

  it('Problem 인스턴스로 throw/catch 가능', () => {
    expect(() => {
      throw new InvalidKeyProblem('bad-key', 'Invalid format');
    }).toThrow(InvalidKeyProblem);
  });
});
