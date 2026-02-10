import type { Step } from './Step';

export interface Job {
  name: string;
  steps: Step<unknown, unknown>[];
}

export class JobBuilder {
  private steps: Step<unknown, unknown>[] = [];

  constructor(private name: string) {}

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
      steps: this.steps,
    };
  }
}
