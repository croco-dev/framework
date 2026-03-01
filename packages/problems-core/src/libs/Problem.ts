import type { ProblemCategory } from './ProblemCategory';
import { ProblemCategoryMapper } from './ProblemCategoryMapper';

export interface ProblemOptions {
  type?: string;
  instance?: string;
  extensions?: Record<string, unknown>;
  cause?: Error;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  [key: string]: unknown;
}

export abstract class Problem extends Error {
  public readonly code: string;
  public readonly category: ProblemCategory;
  public readonly detail?: string;
  public readonly type: string;
  public readonly instance?: string;
  public readonly extensions?: Record<string, unknown>;
  public readonly cause?: Error;

  protected constructor(code: string, category: ProblemCategory, detail?: string, options?: ProblemOptions) {
    super(detail ?? code);

    this.code = code;
    this.category = category;
    this.detail = detail;
    this.type = options?.type ?? 'about:blank';
    this.instance = options?.instance;
    this.extensions = options?.extensions;
    this.name = new.target.name;

    if (options?.cause && this.cause === undefined) {
      Object.defineProperty(this, 'cause', {
        configurable: true,
        enumerable: false,
        value: options.cause,
        writable: true,
      });
    }

    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }

  public get title(): string {
    return ProblemCategoryMapper.toTitle(this.category);
  }

  public get status(): number {
    return ProblemCategoryMapper.toHttpStatus(this.category);
  }

  public toJSON(): ProblemDetails {
    const result: ProblemDetails = {
      type: this.type,
      title: this.title,
      status: this.status,
      code: this.code,
    };

    if (this.detail) {
      result.detail = this.detail;
    }

    if (this.instance) {
      result.instance = this.instance;
    }

    if (this.extensions) {
      Object.assign(result, this.extensions);
    }

    return result;
  }
}
