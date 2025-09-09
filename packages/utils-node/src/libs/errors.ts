export class BootstrapError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'BootstrapError';
  }
}

export class ContainerInitializationError extends BootstrapError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'ContainerInitializationError';
  }
}

export class ServiceRegistrationError extends BootstrapError {
  constructor(serviceName: string, cause?: unknown) {
    super(`Failed to register service: ${serviceName}`, cause);
    this.name = 'ServiceRegistrationError';
  }
}
