import { MetadataStorage } from '@croco/framework-context';
import type { TaskMetadata, TaskOptions } from '../types';

export const TASK_METADATA_KEY = Symbol('TASK_METADATA');

export function Task(options: TaskOptions = {}): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor): PropertyDescriptor => {
    const target = _target.constructor;
    const methodName = propertyKey.toString();
    const name = options.name ?? `${target.name}.${methodName}`;

    const metadata: TaskMetadata = {
      name,
      options,
      target,
      methodName,
    };

    MetadataStorage.define(TASK_METADATA_KEY, metadata, target, propertyKey);

    return _descriptor;
  };
}
