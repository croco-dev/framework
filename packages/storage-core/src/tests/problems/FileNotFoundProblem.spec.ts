import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { FileNotFoundProblem } from '../../libs/problems/FileNotFoundProblem';

describe('FileNotFoundProblem', () => {
  it('code, category, message가 올바르게 설정됨', () => {
    const problem = new FileNotFoundProblem('test/file.txt');

    expect(problem.code).toBe('STORAGE_FILE_NOT_FOUND');
    expect(problem.category).toBe(ProblemCategory.NotFound);
    expect(problem.detail).toBe("File with key 'test/file.txt' not found");
  });

  it('다양한 키로 메시지 생성', () => {
    const problem1 = new FileNotFoundProblem('documents/report.pdf');
    expect(problem1.detail).toBe("File with key 'documents/report.pdf' not found");

    const problem2 = new FileNotFoundProblem('a/b/c/d/e.png');
    expect(problem2.detail).toBe("File with key 'a/b/c/d/e.png' not found");
  });

  it('Problem 인스턴스로 throw/catch 가능', () => {
    expect(() => {
      throw new FileNotFoundProblem('missing/file.txt');
    }).toThrow(FileNotFoundProblem);
  });
});
