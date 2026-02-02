import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { UploadFailedProblem } from '../../libs/problems/UploadFailedProblem';

describe('UploadFailedProblem', () => {
  it('code, category, message가 올바르게 설정됨 (reason 없음)', () => {
    const problem = new UploadFailedProblem('test/file.txt');

    expect(problem.code).toBe('STORAGE_UPLOAD_FAILED');
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("Failed to upload file 'test/file.txt'");
  });

  it('reason 포함하여 생성 시 메시지에 reason 포함됨', () => {
    const problem = new UploadFailedProblem('documents/report.pdf', 'Network timeout');

    expect(problem.code).toBe('STORAGE_UPLOAD_FAILED');
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("Failed to upload file 'documents/report.pdf': Network timeout");
  });

  it('다양한 reason으로 메시지 생성', () => {
    const problem1 = new UploadFailedProblem('a/b/c.png', 'Insufficient storage');
    expect(problem1.detail).toBe("Failed to upload file 'a/b/c.png': Insufficient storage");

    const problem2 = new UploadFailedProblem('large/file.bin', 'File size exceeds limit');
    expect(problem2.detail).toBe("Failed to upload file 'large/file.bin': File size exceeds limit");
  });

  it('Problem 인스턴스로 throw/catch 가능', () => {
    expect(() => {
      throw new UploadFailedProblem('upload.txt', 'Connection lost');
    }).toThrow(UploadFailedProblem);
  });
});
