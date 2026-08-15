import type { Step } from "./Step";

export interface Job {
  name: string;

  /**
   * A shallow snapshot of the builder's step collection at build time.
   * Step instances retain their identity and are not cloned.
   */
  steps: Step<unknown, unknown>[];
}

export class JobBuilder {
  private readonly steps: Step<unknown, unknown>[] = [];

  constructor(private readonly name: string) {}

  start(step: Step<unknown, unknown>): this {
    this.steps.push(step);
    return this;
  }

  next(step: Step<unknown, unknown>): this {
    this.steps.push(step);
    return this;
  }

  build(): Job {
    return {
      name: this.name,
      steps: [...this.steps],
    };
  }
}
