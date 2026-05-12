import { DomainEvent } from "@croco/events-core";

export type ApiKeyUsedEventData = {
  keyId: string;
  tenantId: string;
  timestamp: Date;
};

export type ApiKeyCreatedEventData = {
  keyId: string;
  tenantId: string;
  name: string;
};

export type ApiKeyRevokedEventData = {
  keyId: string;
  tenantId: string;
  revokedAt: Date;
};

export type ApiKeyRotatedEventData = {
  oldKeyId: string;
  newKeyId: string;
  tenantId: string;
};

export class ApiKeyUsedEvent extends DomainEvent {
  static eventName = "auth.api_key_used";

  constructor(public readonly data: ApiKeyUsedEventData) {
    super();
  }
}

export class ApiKeyCreatedEvent extends DomainEvent {
  static eventName = "auth.api_key_created";

  constructor(public readonly data: ApiKeyCreatedEventData) {
    super();
  }
}

export class ApiKeyRevokedEvent extends DomainEvent {
  static eventName = "auth.api_key_revoked";
  constructor(public readonly data: ApiKeyRevokedEventData) {
    super();
  }
}

export class ApiKeyRotatedEvent extends DomainEvent {
  static eventName = "auth.api_key_rotated";

  constructor(public readonly data: ApiKeyRotatedEventData) {
    super();
  }
}
