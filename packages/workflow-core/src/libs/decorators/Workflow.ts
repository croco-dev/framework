import { MetadataStorage } from "@croco/framework-context";
import type { WorkflowMetadata, WorkflowOptions } from "../types";

export const WORKFLOW_METADATA_KEY = Symbol("WORKFLOW_METADATA");

function getWorkflowOwnerName(target: object): string {
  return typeof target === "function" ? target.name : target.constructor.name;
}

export function Workflow(options: WorkflowOptions): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const name = options.name ?? `${getWorkflowOwnerName(target)}.${String(propertyKey)}`;
    const metadata: WorkflowMetadata = {
      name,
      description: options.description,
      options,
      target,
      methodName: propertyKey,
    };

    MetadataStorage.define(WORKFLOW_METADATA_KEY, target, metadata, propertyKey);

    return descriptor;
  };
}
