import 'reflect-metadata';
import { REST_CONTROLLER_KEY } from '../constants';
import type { ControllerMetadata } from '../types';

export function Controller(path: string = ''): ClassDecorator {
  return (target: Function) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const metadata: ControllerMetadata = {
      path: normalizedPath === '/' ? '' : normalizedPath,
      target,
    };
    Reflect.defineMetadata(REST_CONTROLLER_KEY, metadata, target);
  };
}
