import { describe, it, expect } from 'vitest';
import { Problem, ProblemCategory } from '../index';

class NotFoundProblem extends Problem {
  constructor(resource: string) {
    super('RESOURCE_NOT_FOUND', ProblemCategory.NotFound, `The requested ${resource} could not be found`);
  }
}

class ValidationProblem extends Problem {
  constructor(field: string) {
    super('VALIDATION_FAILED', ProblemCategory.ValidationError, `Field '${field}' failed validation`);
  }
}

class UnauthorizedProblem extends Problem {
  constructor() {
    super('UNAUTHORIZED', ProblemCategory.Unauthorized, 'Authentication required');
  }
}

describe('Problem', () => {
  it('should extend Error', () => {
    const problem = new NotFoundProblem('User');

    expect(problem).toBeInstanceOf(Error);
    expect(problem).toBeInstanceOf(Problem);
  });

  it('should have correct message', () => {
    const problem = new NotFoundProblem('User');

    expect(problem.message).toBe('The requested User could not be found');
  });

  it('should have correct code', () => {
    const problem = new NotFoundProblem('User');

    expect(problem.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('should have correct category', () => {
    const problem = new NotFoundProblem('User');

    expect(problem.category).toBe(ProblemCategory.NotFound);
  });

  it('should have correct detail', () => {
    const problem = new NotFoundProblem('User');

    expect(problem.detail).toBe('The requested User could not be found');
  });

  it('should maintain prototype chain for instanceof checks', () => {
    const problem = new NotFoundProblem('Resource');

    expect(problem instanceof NotFoundProblem).toBe(true);
    expect(problem instanceof Problem).toBe(true);
    expect(problem instanceof Error).toBe(true);
  });

  it('should be throwable and catchable', () => {
    expect(() => {
      throw new NotFoundProblem('Item');
    }).toThrow(NotFoundProblem);

    expect(() => {
      throw new NotFoundProblem('Item');
    }).toThrow('The requested Item could not be found');
  });
});

describe('ProblemCategory', () => {
  it('should have BadRequest category', () => {
    expect(ProblemCategory.BadRequest).toBeDefined();
  });

  it('should have Unauthorized category', () => {
    expect(ProblemCategory.Unauthorized).toBeDefined();

    const problem = new UnauthorizedProblem();
    expect(problem.category).toBe(ProblemCategory.Unauthorized);
  });

  it('should have Forbidden category', () => {
    expect(ProblemCategory.Forbidden).toBeDefined();
  });

  it('should have NotFound category', () => {
    expect(ProblemCategory.NotFound).toBeDefined();
  });

  it('should have Conflict category', () => {
    expect(ProblemCategory.Conflict).toBeDefined();
  });

  it('should have Gone category', () => {
    expect(ProblemCategory.Gone).toBeDefined();
  });

  it('should have ValidationError category', () => {
    expect(ProblemCategory.ValidationError).toBeDefined();

    const problem = new ValidationProblem('email');
    expect(problem.category).toBe(ProblemCategory.ValidationError);
  });

  it('should have BusinessRuleViolation category', () => {
    expect(ProblemCategory.BusinessRuleViolation).toBeDefined();
  });

  it('should have TooManyRequests category', () => {
    expect(ProblemCategory.TooManyRequests).toBeDefined();
  });

  it('should have InternalServerError category', () => {
    expect(ProblemCategory.InternalServerError).toBeDefined();
  });

  it('should have NotImplemented category', () => {
    expect(ProblemCategory.NotImplemented).toBeDefined();
  });
});

describe('Problem with different categories', () => {
  it('should work with ValidationError category', () => {
    const problem = new ValidationProblem('email');

    expect(problem.code).toBe('VALIDATION_FAILED');
    expect(problem.category).toBe(ProblemCategory.ValidationError);
    expect(problem.detail).toBe("Field 'email' failed validation");
  });

  it('should work with Unauthorized category', () => {
    const problem = new UnauthorizedProblem();

    expect(problem.code).toBe('UNAUTHORIZED');
    expect(problem.category).toBe(ProblemCategory.Unauthorized);
    expect(problem.detail).toBe('Authentication required');
  });
});
