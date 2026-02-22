import 'reflect-metadata';

const EVENT_FIELDS_META_KEY = '@croco/events-core:event-fields';

export function EventField(options?: { name?: string }): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    const existing: EventFieldMeta[] = Reflect.getMetadata(EVENT_FIELDS_META_KEY, target.constructor) ?? [];
    existing.push({ propertyKey: String(propertyKey), serializedKey: options?.name ?? String(propertyKey) });
    Reflect.defineMetadata(EVENT_FIELDS_META_KEY, existing, target.constructor);
  };
}

export type EventFieldMeta = {
  propertyKey: string;
  serializedKey: string;
};

export function getEventFields(EventClass: new (...args: unknown[]) => unknown): EventFieldMeta[] | null {
  const fields: EventFieldMeta[] | undefined = Reflect.getMetadata(EVENT_FIELDS_META_KEY, EventClass);
  return fields && fields.length > 0 ? fields : null;
}
