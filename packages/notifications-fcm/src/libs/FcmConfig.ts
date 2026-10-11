import { FcmProblem } from "./FcmProblem";

export type FcmConfig = {
  readonly projectId: string;
  readonly credential:
    | { readonly type: "application-default" }
    | {
        readonly type: "service-account";
        readonly clientEmail: string;
        readonly privateKey: string;
      };
};

export function validateFcmConfig(config: FcmConfig): FcmConfig {
  if (
    !config ||
    typeof config.projectId !== "string" ||
    !config.projectId.trim() ||
    !config.credential ||
    (config.credential.type !== "application-default" &&
      config.credential.type !== "service-account") ||
    (config.credential.type === "service-account" &&
      (typeof config.credential.clientEmail !== "string" ||
        !config.credential.clientEmail.trim() ||
        typeof config.credential.privateKey !== "string" ||
        !config.credential.privateKey.trim()))
  ) {
    throw new FcmProblem("configuration", "configuration");
  }
  return config;
}
