import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import {
  IndexNotFoundProblem,
  MissingTenantProblem,
  StrategyUnavailableProblem,
  TransformNotFoundProblem,
} from '../libs/problems/SearchProblems';

describe('SearchProblems', () => {
  describe('MissingTenantProblem', () => {
    it('has correct code and category', () => {
      const problem = new MissingTenantProblem('search');
      expect(problem.code).toBe('MISSING_TENANT');
      expect(problem.category).toBe(ProblemCategory.BadRequest);
      expect(problem.message).toContain('search');
      expect(problem.status).toBe(400);
    });

    it('extends Error and Problem', () => {
      const problem = new MissingTenantProblem('indexing');
      expect(problem).toBeInstanceOf(Error);
      expect(problem.name).toBe('MissingTenantProblem');
    });
  });

  describe('TransformNotFoundProblem', () => {
    it('has correct code and category', () => {
      const problem = new TransformNotFoundProblem('text.initials');
      expect(problem.code).toBe('search-core/transform-not-found');
      expect(problem.category).toBe(ProblemCategory.NotFound);
      expect(problem.message).toBe("Transform not found: 'text.initials'");
      expect(problem.status).toBe(404);
    });

    it('does not include extensions', () => {
      const problem = new TransformNotFoundProblem('user.name');
      expect(problem.extensions).toBeUndefined();
    });
  });

  describe('StrategyUnavailableProblem', () => {
    it('has correct code and category', () => {
      const problem = new StrategyUnavailableProblem('pgSearch', 'extension not installed');
      expect(problem.code).toBe('STRATEGY_UNAVAILABLE');
      expect(problem.category).toBe(ProblemCategory.InternalServerError);
      expect(problem.message).toContain('pgSearch');
      expect(problem.message).toContain('extension not installed');
      expect(problem.status).toBe(500);
    });

    it('includes strategyName and reason in extensions', () => {
      const problem = new StrategyUnavailableProblem('elasticSearch', 'connection timeout');
      expect(problem.extensions?.strategyName).toBe('elasticSearch');
      expect(problem.extensions?.reason).toBe('connection timeout');
    });
  });

  describe('IndexNotFoundProblem', () => {
    it('has correct code and category', () => {
      const problem = new IndexNotFoundProblem('products');
      expect(problem.code).toBe('INDEX_NOT_FOUND');
      expect(problem.category).toBe(ProblemCategory.NotFound);
      expect(problem.message).toContain('products');
      expect(problem.status).toBe(404);
    });

    it('includes indexName in extensions', () => {
      const problem = new IndexNotFoundProblem('orders');
      expect(problem.extensions?.indexName).toBe('orders');
    });
  });
});
