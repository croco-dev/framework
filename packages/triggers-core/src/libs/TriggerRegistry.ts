import { MetadataStorage } from '@croco/framework-context';
import { ProblemFactory } from '@croco/problems-core';
import { CRON_METADATA_KEY, EVENT_METADATA_KEY, TRIGGER_METADATA_KEY, WEBHOOK_METADATA_KEY } from './metadataKeys';
import type { AnyTriggerMetadata, TriggerType } from './types';

/**
 * Registry for trigger metadata.
 * Uses MetadataStorage to store trigger configurations.
 */
export class TriggerRegistry {
  private static instance: TriggerRegistry;

  private constructor() {}

  static getInstance(): TriggerRegistry {
    if (!TriggerRegistry.instance) {
      TriggerRegistry.instance = new TriggerRegistry();
    }
    return TriggerRegistry.instance;
  }

  register(metadata: AnyTriggerMetadata): void {
    MetadataStorage.define(TRIGGER_METADATA_KEY, metadata.target, this.cloneMetadata(metadata), metadata.methodName);
  }

  getTriggers(target: object): Map<string | symbol, AnyTriggerMetadata> {
    return this.createTriggerMap(this.getEntriesForTarget(target));
  }

  getTriggersByType<T extends TriggerType>(target: object, type: T): Map<string | symbol, AnyTriggerMetadata> {
    const triggers = this.getTriggers(target);
    const filtered = new Map<string | symbol, AnyTriggerMetadata>();

    for (const [key, metadata] of triggers.entries()) {
      if (metadata.type === type) {
        filtered.set(key, metadata);
      }
    }

    return filtered;
  }

  getAllTriggers(): Map<object, Map<string | symbol, AnyTriggerMetadata>> {
    const result = new Map<object, Map<string | symbol, AnyTriggerMetadata>>();

    for (const entry of this.getAllEntries()) {
      const target = entry.target as object;

      if (!result.has(target)) {
        result.set(target, new Map<string | symbol, AnyTriggerMetadata>());
      }

      const targetMap = result.get(target);
      if (targetMap && entry.propertyKey) {
        if (targetMap.has(entry.propertyKey)) {
          throw ProblemFactory.internalServerError(
            'triggers-core/duplicate-trigger-metadata',
            `Multiple trigger metadata entries are registered for method '${String(entry.propertyKey)}'`
          );
        }

        targetMap.set(entry.propertyKey, this.cloneMetadata(entry.value));
      }
    }

    return result;
  }

  private getEntriesForTarget(target: object): Array<{ propertyKey?: string | symbol; value: AnyTriggerMetadata }> {
    return [
      ...MetadataStorage.getAllForTarget<AnyTriggerMetadata>(TRIGGER_METADATA_KEY, target),
      ...MetadataStorage.getAllForTarget<AnyTriggerMetadata>(CRON_METADATA_KEY, target),
      ...MetadataStorage.getAllForTarget<AnyTriggerMetadata>(EVENT_METADATA_KEY, target),
      ...MetadataStorage.getAllForTarget<AnyTriggerMetadata>(WEBHOOK_METADATA_KEY, target),
    ].map((entry) => ({
      propertyKey: entry.propertyKey,
      value: this.cloneMetadata(entry.value),
    }));
  }

  private getAllEntries(): Array<{ target: object; propertyKey?: string | symbol; value: AnyTriggerMetadata }> {
    return [
      ...MetadataStorage.getAll<AnyTriggerMetadata>(TRIGGER_METADATA_KEY),
      ...MetadataStorage.getAll<AnyTriggerMetadata>(CRON_METADATA_KEY),
      ...MetadataStorage.getAll<AnyTriggerMetadata>(EVENT_METADATA_KEY),
      ...MetadataStorage.getAll<AnyTriggerMetadata>(WEBHOOK_METADATA_KEY),
    ].map((entry) => ({
      target: entry.target as object,
      propertyKey: entry.propertyKey,
      value: this.cloneMetadata(entry.value),
    }));
  }

  private createTriggerMap(
    entries: Array<{ propertyKey?: string | symbol; value: AnyTriggerMetadata }>
  ): Map<string | symbol, AnyTriggerMetadata> {
    const map = new Map<string | symbol, AnyTriggerMetadata>();

    for (const entry of entries) {
      if (entry.propertyKey) {
        if (map.has(entry.propertyKey)) {
          throw ProblemFactory.internalServerError(
            'triggers-core/duplicate-trigger-metadata',
            `Multiple trigger metadata entries are registered for method '${String(entry.propertyKey)}'`
          );
        }

        map.set(entry.propertyKey, this.cloneMetadata(entry.value));
      }
    }

    return map;
  }

  private cloneMetadata<T>(value: T): T {
    if (value === null || value === undefined || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.cloneMetadata(item)) as T;
    }

    if (value instanceof Date) {
      return new Date(value.getTime()) as T;
    }

    const cloned = {} as Record<string | symbol, unknown>;
    const source = value as Record<string | symbol, unknown>;

    for (const key of Reflect.ownKeys(value)) {
      if (key === 'target') {
        cloned[key] = source[key];
        continue;
      }

      cloned[key] = this.cloneMetadata(source[key]);
    }

    return cloned as T;
  }
}

export { TRIGGER_METADATA_KEY } from './metadataKeys';

export const triggerRegistry = TriggerRegistry.getInstance();
