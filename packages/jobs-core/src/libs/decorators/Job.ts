import { MetadataStorage } from '@croco/framework-context';
import type { JobOptions } from '../types';

export const JOB_METADATA_KEY = Symbol('JOB_METADATA');

export type JobMetadata = {
  name: string;
  options?: JobOptions;
  target: object;
};

export interface JobHandler<T = unknown> {
  handle(payload: T): Promise<void> | void;
}

export function Job(name: string, options?: JobOptions): ClassDecorator {
  return (target: object) => {
    const metadata: JobMetadata = {
      name,
      options,
      target,
    };
    MetadataStorage.define(JOB_METADATA_KEY, metadata, target);
  };
}
