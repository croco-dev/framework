import type { z } from 'zod';
import type { ArgumentMetadata, PipeTransform } from '../interfaces/PipeTransform';
import { RequestValidationProblem } from './ValidationProblem';

/**
 * 파라미터 값을 Zod 스키마로 검증하는 기본 Pipe 구현체입니다.
 */
export class ValidationPipe<T = unknown> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'value',
        message: issue.message,
      }));

      const source = this.mapMetadataTypeToSource(metadata.type);
      throw new RequestValidationProblem(source, issues);
    }

    return result.data;
  }

  private mapMetadataTypeToSource(type: ArgumentMetadata['type']): 'body' | 'query' | 'params' | 'headers' {
    switch (type) {
      case 'body':
        return 'body';
      case 'query':
        return 'query';
      case 'param':
        return 'params';
      case 'header':
        return 'headers';
      default:
        return 'body';
    }
  }
}

/**
 * Zod 스키마 기반 ValidationPipe 인스턴스를 생성합니다.
 */
export function createValidationPipe<T>(schema: z.ZodType<T>): ValidationPipe<T> {
  return new ValidationPipe(schema);
}
