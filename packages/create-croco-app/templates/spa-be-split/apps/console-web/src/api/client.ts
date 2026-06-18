const DEFAULT_API_BASE_PATH = "http://localhost:3000";

type ProblemDetails = {
  status: number;
  title: string;
  code: string;
  detail?: string;
};

type ViteImportMeta = ImportMeta & {
  env?: {
    VITE_API_URL?: string;
  };
};

export class ApiProblemError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = "ApiProblemError";
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveApiBaseUrl(): string {
  const configuredUrl = (import.meta as ViteImportMeta).env?.VITE_API_URL?.trim();

  return ensureTrailingSlash(configuredUrl || DEFAULT_API_BASE_PATH);
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path.replace(/^\//, ""), resolveApiBaseUrl()), init);

  if (!response.ok) {
    const problem = (await response.json()) as ProblemDetails;
    throw new ApiProblemError(problem);
  }

  return response.json() as Promise<T>;
}
