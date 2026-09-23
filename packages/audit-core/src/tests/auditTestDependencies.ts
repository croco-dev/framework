import { Container, LOGGER_TOKEN, type ILogger } from "@croco/framework-context";
import { Auditable as createAuditable } from "../libs/Auditable";
import type { AuditLogRepository } from "../libs/AuditLogRepository";
import { AUDIT_LOG_REPOSITORY_TOKEN } from "../libs/AuditLogRepositoryToken";
import type { AuditableOptions } from "../libs/types";

// Existing persistence fixtures use Container mocks; production receives explicit dependencies.
export function Auditable(options: Omit<AuditableOptions, "dependencies">): MethodDecorator {
  return createAuditable({
    ...options,
    dependencies: () => {
      const [repository, logger] = Container.getMany([
        AUDIT_LOG_REPOSITORY_TOKEN,
        LOGGER_TOKEN,
      ]) as [AuditLogRepository, ILogger];
      return { repository, logger };
    },
  });
}
