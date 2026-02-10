import { MetadataStorage } from '@croco/framework-context';
import type { AnyTriggerMetadata, TriggerType } from './types';

export const TRIGGER_METADATA_KEY = Symbol('TRIGGER_METADATA');

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
    MetadataStorage.define(TRIGGER_METADATA_KEY, metadata.target, metadata, metadata.methodName);
  }

  getTriggers(target: object): Map<string | symbol, AnyTriggerMetadata> {
    const entries = MetadataStorage.getAllForTarget<AnyTriggerMetadata>(TRIGGER_METADATA_KEY, target);
    const map = new Map<string | symbol, AnyTriggerMetadata>();

    for (const entry of entries) {
      if (entry.propertyKey) {
        map.set(entry.propertyKey, entry.value);
      }
    }

    return map;
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
    const entries = MetadataStorage.getAll<AnyTriggerMetadata>(TRIGGER_METADATA_KEY);
    const result = new Map<object, Map<string | symbol, AnyTriggerMetadata>>();

    for (const entry of entries) {
      const target = entry.target as object;

      if (!result.has(target)) {
        result.set(target, new Map<string | symbol, AnyTriggerMetadata>());
      }

      const targetMap = result.get(target);
      if (targetMap && entry.propertyKey) {
        targetMap.set(entry.propertyKey, entry.value);
      }
    }

    return result;
  }
}

export const triggerRegistry = TriggerRegistry.getInstance();
