import { Token } from "@croco/framework-context";
import {
  SearchTransformRegistrationConflictProblem,
  TransformNotFoundProblem,
} from "../problems/SearchProblems";
import { createSearchTransformRef } from "./types";
import type { SearchTransformAdapter, SearchTransformRef } from "./types";

type SearchTransformRegistration = {
  readonly adapter: SearchTransformAdapter;
  readonly ref: {
    readonly id: string;
    readonly defaultSuffix: string;
  };
};

export abstract class SearchTransformRegistry {
  static readonly token = new Token<SearchTransformRegistry>("SearchTransformRegistry");

  abstract register<TOptions>(
    adapter: SearchTransformAdapter<TOptions>,
  ): SearchTransformRef<TOptions>;
  abstract get<TOptions>(
    ref: SearchTransformRef<TOptions>,
  ): SearchTransformAdapter<TOptions> | undefined;
  abstract apply<TOptions>(
    ref: SearchTransformRef<TOptions>,
    input: string,
    options?: TOptions,
  ): string;
}

export class InMemorySearchTransformRegistry extends SearchTransformRegistry {
  private readonly registrations = new Map<string, SearchTransformRegistration>();

  register<TOptions>(adapter: SearchTransformAdapter<TOptions>): SearchTransformRef<TOptions> {
    const existing = this.registrations.get(adapter.id);
    if (existing) {
      if (existing.adapter === adapter) {
        return existing.ref as SearchTransformRef<TOptions>;
      }

      throw new SearchTransformRegistrationConflictProblem(
        adapter.id,
        existing.adapter.defaultSuffix,
        adapter.defaultSuffix,
      );
    }

    const ref = createSearchTransformRef<TOptions>(adapter.id, adapter.defaultSuffix);
    this.registrations.set(adapter.id, {
      adapter: adapter as SearchTransformAdapter,
      ref,
    });
    return ref;
  }

  get<TOptions>(ref: SearchTransformRef<TOptions>): SearchTransformAdapter<TOptions> | undefined {
    const registration = this.registrations.get(ref.id);
    if (!registration || registration.ref !== ref) {
      return undefined;
    }

    return registration.adapter as SearchTransformAdapter<TOptions>;
  }

  apply<TOptions>(ref: SearchTransformRef<TOptions>, input: string, options?: TOptions): string {
    const adapter = this.get(ref);
    if (!adapter) {
      throw new TransformNotFoundProblem(ref.id);
    }

    return adapter.transform(input, options as TOptions);
  }
}
