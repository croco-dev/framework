import { Problem, ProblemCategory } from "@croco/problems-core";

export class AcquisitionCollectorProblem extends Problem {
  readonly code = "frontend/acquisition/invalid-path";
  readonly category = ProblemCategory.ValidationError;
  constructor() {
    super(
      "frontend/acquisition/invalid-path",
      ProblemCategory.ValidationError,
      "Invalid acquisition clean path",
    );
  }
}
export type AcquisitionBrowserLocation = {
  readonly href: string;
  readonly referrer: string;
  readonly replace: (cleanPath: string) => void;
};
/** App enables collection only after consent. Sanitizes the address before any request.
 * Never reads cookies/localStorage or derives a fingerprint; the server owns session identity.
 */
export async function collectAcquisitionContext<T>(options: {
  readonly enabled: boolean;
  readonly location: AcquisitionBrowserLocation;
  readonly parse: (input: { url: string; referrer: string; referrerAvailable: boolean }) => T;
  readonly cleanPath: string;
  readonly send: (context: T) => Promise<void>;
}): Promise<"disabled" | "recorded"> {
  if (!options.enabled) return "disabled";
  if (!/^\/[A-Za-z0-9/_-]*$/.test(options.cleanPath) || options.cleanPath.startsWith("//")) {
    throw new AcquisitionCollectorProblem();
  }
  let context: T;
  try {
    context = options.parse({
      url: options.location.href,
      referrer: options.location.referrer,
      referrerAvailable: true,
    });
  } finally {
    options.location.replace(options.cleanPath);
  }
  await options.send(context);
  return "recorded";
}
