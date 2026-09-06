import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  REST_FILTERS_KEY,
  REST_GUARDS_KEY,
  REST_INTERCEPTORS_KEY,
  REST_PIPES_KEY,
} from "../libs/constants";
import { Controller } from "../libs/decorators/Controller";
import { Get } from "../libs/decorators/HttpMethod";
import { UseFilters, UseGuards, UseInterceptors, UsePipes } from "../libs/decorators/Lifecycle";
import type { Guard } from "@croco/framework-context";

import type { CallHandler } from "../libs/interfaces/CallHandler";
import type { ExceptionFilter, ExceptionFilterResult } from "../libs/interfaces/ExceptionFilter";
import type { ExecutionContext } from "../libs/interfaces/ExecutionContext";
import type { ArgumentMetadata, PipeTransform } from "../libs/interfaces/PipeTransform";

import { getFilters, getGuards, getInterceptors, getPipes } from "../libs/metadata/MetadataReader";

class GuardA implements Guard {
  canActivate(): boolean {
    return true;
  }
}

class GuardB implements Guard {
  canActivate(): boolean {
    return true;
  }
}

class GuardC implements Guard {
  canActivate(): boolean {
    return true;
  }
}

class PipeA implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    return value;
  }
}

class PipeB implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    return value;
  }
}

class PipeC implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    return value;
  }
}

class InterceptorA {
  async intercept(_context: unknown, next: CallHandler): Promise<unknown> {
    return next.handle();
  }
}

class InterceptorB {
  async intercept(_context: unknown, next: CallHandler): Promise<unknown> {
    return next.handle();
  }
}

class FilterA implements ExceptionFilter {
  catch(_exception: unknown, _context: unknown): ExceptionFilterResult {
    return undefined;
  }
}

class FilterB implements ExceptionFilter {
  catch(_exception: unknown, _context: unknown): ExceptionFilterResult {
    return undefined;
  }
}

describe("Lifecycle decorators stacking", () => {
  describe("@UseGuards stacking", () => {
    it("should preserve all guards when stacking @UseGuards at class level", () => {
      @Controller("/test")
      @UseGuards(GuardA)
      @UseGuards(GuardB)
      class StackedClassController {}

      const guards = Reflect.getMetadata(REST_GUARDS_KEY, StackedClassController);
      expect(guards).toBeDefined();
      expect(guards).toHaveLength(2);
      expect(guards).toEqual([GuardB, GuardA]);
    });

    it("should preserve all guards when stacking @UseGuards at method level", () => {
      @Controller("/test")
      class StackedMethodController {
        @Get("/test")
        @UseGuards(GuardA)
        @UseGuards(GuardB)
        testMethod() {}
      }

      const guards = Reflect.getMetadata(REST_GUARDS_KEY, StackedMethodController, "testMethod");
      expect(guards).toBeDefined();
      expect(guards).toHaveLength(2);
      expect(guards).toEqual([GuardB, GuardA]);
    });

    it("should preserve multiple guards declared across multiple decorators with varied argument counts", () => {
      @Controller("/test")
      class MultiArgController {
        @Get("/test")
        @UseGuards(GuardA)
        @UseGuards(GuardB, GuardC)
        testMethod() {}
      }

      const guards = Reflect.getMetadata(REST_GUARDS_KEY, MultiArgController, "testMethod");
      expect(guards).toEqual([GuardB, GuardC, GuardA]);
    });

    it("should correctly resolve combined class-level and method-level stacked guards via getGuards", () => {
      @Controller("/test")
      @UseGuards(GuardA)
      @UseGuards(GuardB)
      class CombinedController {
        @Get("/test")
        @UseGuards(GuardC)
        testMethod() {}
      }

      const allGuards = getGuards(CombinedController, "testMethod");
      expect(allGuards).toEqual([GuardB, GuardA, GuardC]);
    });

    it("should execute all stacked guards in order and track calls", async () => {
      const executionOrder: string[] = [];

      class TrackingGuard1 implements Guard {
        canActivate(): boolean {
          executionOrder.push("guard1");
          return true;
        }
      }

      class TrackingGuard2 implements Guard {
        canActivate(): boolean {
          executionOrder.push("guard2");
          return true;
        }
      }

      class TrackingGuard3 implements Guard {
        canActivate(): boolean {
          executionOrder.push("guard3");
          return true;
        }
      }

      @Controller("/tracked")
      @UseGuards(TrackingGuard1)
      class TrackedController {
        @Get("/run")
        @UseGuards(TrackingGuard2)
        @UseGuards(TrackingGuard3)
        action() {}
      }

      const guards = getGuards(TrackedController, "action");
      expect(guards).toEqual([TrackingGuard1, TrackingGuard3, TrackingGuard2]);

      const dummyContext = {} as ExecutionContext;
      for (const GuardCtor of guards) {
        const instance = new GuardCtor();
        const allowed = await instance.canActivate(dummyContext);
        expect(allowed).toBe(true);
      }

      expect(executionOrder).toEqual(["guard1", "guard3", "guard2"]);
    });

    it("should isolate subclass own metadata when derived class stacks guards", () => {
      @Controller("/base")
      @UseGuards(GuardA)
      class BaseController {}

      @Controller("/derived")
      @UseGuards(GuardB)
      @UseGuards(GuardC)
      class DerivedController extends BaseController {}

      expect(Reflect.getOwnMetadata(REST_GUARDS_KEY, BaseController)).toEqual([GuardA]);
      expect(Reflect.getOwnMetadata(REST_GUARDS_KEY, DerivedController)).toEqual([GuardC, GuardB]);
    });
  });

  describe("@UsePipes stacking", () => {
    it("should preserve all pipes when stacking @UsePipes at class and method level", () => {
      @Controller("/test")
      @UsePipes(PipeA)
      @UsePipes(PipeB)
      class StackedPipesController {
        @Get("/test")
        @UsePipes(PipeA)
        @UsePipes(PipeB, PipeC)
        testMethod() {}
      }

      const classPipes = Reflect.getMetadata(REST_PIPES_KEY, StackedPipesController);
      expect(classPipes).toHaveLength(2);
      expect(classPipes).toEqual([PipeB, PipeA]);

      const methodPipes = Reflect.getMetadata(REST_PIPES_KEY, StackedPipesController, "testMethod");
      expect(methodPipes).toHaveLength(3);
      expect(methodPipes).toEqual([PipeB, PipeC, PipeA]);

      const allPipes = getPipes(StackedPipesController, "testMethod");
      expect(allPipes).toEqual([PipeB, PipeA, PipeB, PipeC, PipeA]);
    });
  });

  describe("@UseInterceptors stacking", () => {
    it("should preserve all interceptors when stacking @UseInterceptors at class and method level", () => {
      @Controller("/test")
      @UseInterceptors(InterceptorA)
      @UseInterceptors(InterceptorB)
      class StackedInterceptorsController {
        @Get("/test")
        @UseInterceptors(InterceptorA)
        @UseInterceptors(InterceptorB)
        testMethod() {}
      }

      const classInterceptors = Reflect.getMetadata(
        REST_INTERCEPTORS_KEY,
        StackedInterceptorsController,
      );
      expect(classInterceptors).toHaveLength(2);
      expect(classInterceptors).toEqual([InterceptorB, InterceptorA]);

      const methodInterceptors = Reflect.getMetadata(
        REST_INTERCEPTORS_KEY,
        StackedInterceptorsController,
        "testMethod",
      );
      expect(methodInterceptors).toHaveLength(2);
      expect(methodInterceptors).toEqual([InterceptorB, InterceptorA]);

      const allInterceptors = getInterceptors(StackedInterceptorsController, "testMethod");
      expect(allInterceptors).toEqual([InterceptorB, InterceptorA, InterceptorB, InterceptorA]);
    });
  });

  describe("@UseFilters stacking", () => {
    it("should preserve all filters when stacking @UseFilters at class and method level", () => {
      @Controller("/test")
      @UseFilters(FilterA)
      @UseFilters(FilterB)
      class StackedFiltersController {
        @Get("/test")
        @UseFilters(FilterA)
        @UseFilters(FilterB)
        testMethod() {}
      }

      const classFilters = Reflect.getMetadata(REST_FILTERS_KEY, StackedFiltersController);
      expect(classFilters).toHaveLength(2);
      expect(classFilters).toEqual([FilterB, FilterA]);

      const methodFilters = Reflect.getMetadata(
        REST_FILTERS_KEY,
        StackedFiltersController,
        "testMethod",
      );
      expect(methodFilters).toHaveLength(2);
      expect(methodFilters).toEqual([FilterB, FilterA]);

      const allFilters = getFilters(StackedFiltersController, "testMethod");
      expect(allFilters).toEqual([FilterB, FilterA, FilterB, FilterA]);
    });
  });
});
