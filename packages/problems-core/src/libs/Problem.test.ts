import { describe, expect, it } from 'vitest';
import { Problem, ProblemCategory, ProblemCategoryMapper, ProblemFactory } from '../index';

describe('ProblemCategoryMapper', () => {
  it('should map all categories to HTTP status', () => {
    expect(ProblemCategoryMapper.toHttpStatus(ProblemCategory.NotFound)).toBe(404);
    expect(ProblemCategoryMapper.toHttpStatus(ProblemCategory.BadRequest)).toBe(400);
    expect(ProblemCategoryMapper.toHttpStatus(ProblemCategory.ValidationError)).toBe(422);
  });

  it('should map all categories to titles', () => {
    expect(ProblemCategoryMapper.toTitle(ProblemCategory.NotFound)).toBe('Not Found');
    expect(ProblemCategoryMapper.toTitle(ProblemCategory.BadRequest)).toBe('Bad Request');
    expect(ProblemCategoryMapper.toTitle(ProblemCategory.ValidationError)).toBe('Validation Error');
  });
});

describe('Problem', () => {
  it('should have correct getters', () => {
    const problem = ProblemFactory.notFound('USER_NOT_FOUND', 'User does not exist');
    expect(problem.status).toBe(404);
    expect(problem.title).toBe('Not Found');
    expect(problem.code).toBe('USER_NOT_FOUND');
  });

  it('should produce valid RFC 7807 JSON', () => {
    const problem = ProblemFactory.badRequest('INVALID_INPUT', 'Email is required');
    const json = problem.toJSON();

    expect(json.type).toBe('about:blank');
    expect(json.title).toBe('Bad Request');
    expect(json.status).toBe(400);
    expect(json.detail).toBe('Email is required');
    expect(json.code).toBe('INVALID_INPUT');
  });

  it('should include extensions in JSON', () => {
    const problem = ProblemFactory.validationError('VALIDATION_FAILED', 'Multiple errors', {
      extensions: { errors: [{ field: 'email', message: 'invalid' }] },
    });
    const json = problem.toJSON();
    expect(json.errors).toEqual([{ field: 'email', message: 'invalid' }]);
  });

  it('should support custom type and instance', () => {
    const problem = ProblemFactory.conflict('DUPLICATE_EMAIL', 'Email already exists', {
      type: 'https://example.com/problems/duplicate-email',
      instance: '/users/123',
    });

    expect(problem.type).toBe('https://example.com/problems/duplicate-email');
    expect(problem.instance).toBe('/users/123');
  });

  it('should preserve backward compatibility with subclasses', () => {
    class CustomProblem extends Problem {}

    const problem = new CustomProblem('CUSTOM_ERROR', ProblemCategory.BadRequest, 'Custom message');
    expect(problem.status).toBe(400);
    expect(problem.title).toBe('Bad Request');
    expect(problem.code).toBe('CUSTOM_ERROR');
  });

  it('should correctly identify as an instance of Error', () => {
    const problem = ProblemFactory.notFound('NOT_FOUND');
    expect(problem instanceof Error).toBe(true);
    expect(problem instanceof Problem).toBe(true);
  });
});

describe('ProblemFactory', () => {
  it('should create problems for all categories', () => {
    const problems = [
      ProblemFactory.badRequest('BAD_REQ'),
      ProblemFactory.unauthorized('UNAUTH'),
      ProblemFactory.forbidden('FORBIDDEN'),
      ProblemFactory.notFound('NOT_FOUND'),
      ProblemFactory.conflict('CONFLICT'),
      ProblemFactory.gone('GONE'),
      ProblemFactory.validationError('VALIDATION'),
      ProblemFactory.businessRuleViolation('BUSINESS_RULE'),
      ProblemFactory.tooManyRequests('TOO_MANY'),
      ProblemFactory.internalServerError('INTERNAL'),
      ProblemFactory.notImplemented('NOT_IMPLEMENTED'),
    ];

    problems.forEach((problem) => {
      expect(problem instanceof Problem).toBe(true);
      expect(problem.status).toBeGreaterThan(0);
      expect(problem.title).toBeTruthy();
    });
  });
});
