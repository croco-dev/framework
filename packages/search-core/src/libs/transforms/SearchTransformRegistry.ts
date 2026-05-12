import { Token } from "@croco/framework-context";
import { TransformNotFoundProblem } from "../problems/SearchProblems";
import type { SearchTransformAdapter, SearchTransformRef } from "./types";

export abstract class SearchTransformRegistry {
  static readonly token = new Token<SearchTransformRegistry>("SearchTransformRegistry");

  abstract register<TOptions>(adapter: SearchTransformAdapter<TOptions>): void;
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
  private readonly adapters = new Map<string, SearchTransformAdapter>();

  register<TOptions>(adapter: SearchTransformAdapter<TOptions>): void {
    this.adapters.set(adapter.id, adapter);
  }

  get<TOptions>(ref: SearchTransformRef<TOptions>): SearchTransformAdapter<TOptions> | undefined {
    return this.adapters.get(ref.id) as SearchTransformAdapter<TOptions> | undefined;
  }

  apply<TOptions>(ref: SearchTransformRef<TOptions>, input: string, options?: TOptions): string {
    const adapter = this.get(ref);
    if (!adapter) {
      throw new TransformNotFoundProblem(ref.id);
    }

    return adapter.transform(input, options as TOptions);
  }
}
