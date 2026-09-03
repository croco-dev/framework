import {
  TestResourceMissingDependencyProblem,
  type TestResourceLiveDependency,
  type TestResourceLiveDependencyRequirement,
} from "./problems";

export async function loadTestResourceLiveDependency<TModule>(
  resourceId: string,
  requirement: TestResourceLiveDependencyRequirement,
  load: () => Promise<TModule>,
): Promise<TModule> {
  const { dependency } = requirement;
  try {
    return await load();
  } catch (error) {
    if (isMissingDependencyError(error, dependency)) {
      throw new TestResourceMissingDependencyProblem(resourceId, requirement, error);
    }

    return Promise.reject(error);
  }
}

function isMissingDependencyError(
  error: unknown,
  dependency: TestResourceLiveDependency,
): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as { readonly code?: unknown }).code;
  if (code !== "ERR_MODULE_NOT_FOUND" && code !== "MODULE_NOT_FOUND") {
    return false;
  }

  return [
    `Cannot find package '${dependency}'`,
    `Cannot find package "${dependency}"`,
    `Cannot find module '${dependency}'`,
    `Cannot find module "${dependency}"`,
  ].some((message) => error.message.includes(message));
}
