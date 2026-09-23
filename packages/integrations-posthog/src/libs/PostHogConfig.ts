import { Token, type ILogger } from "@croco/framework-context";

import { PostHogConfigProblem } from "./problems/PostHogProblems";

export interface PostHogConfig {
  apiKey: string;
  host?: string;
}

/** PostHog 설정을 Croco DI에 등록하고 조회할 때 사용하는 토큰입니다. */
export const POSTHOG_CONFIG_TOKEN = new Token<Readonly<PostHogConfig>>("PostHogConfig");

/**
 * 명시적인 애플리케이션 provider에 전달할 PostHog 설정을 검증하고 동결합니다.
 *
 * @param config - PostHog API key와 선택적 HTTP(S) host입니다.
 * @returns 검증된 host를 포함하는 동결 설정입니다.
 */
export function createPostHogConfig(
  config: PostHogConfig,
  logger?: ILogger,
): Readonly<Required<PostHogConfig>> {
  const validConfig = validatePostHogConfig(config);

  if (!config.host) {
    warnAboutEnvironmentHost(logger);
  }

  return Object.freeze(validConfig);
}

export function warnAboutEnvironmentHost(logger?: ILogger): void {
  logger?.warn(
    "[PostHogClient] POSTHOG_HOST env var is used for PostHog host. " +
      "Set host explicitly in config to confirm data residency compliance.",
  );
}

/**
 * PostHog 설정과 환경 기반 host를 검증하고 런타임에서 사용할 완전한 설정을 반환합니다.
 *
 * @param config - 검증할 부분 PostHog 설정입니다.
 * @returns API key와 검증된 HTTP(S) host를 포함한 설정입니다.
 */
export function validatePostHogConfig(config: Partial<PostHogConfig>): Required<PostHogConfig> {
  if (typeof config?.apiKey !== "string" || config.apiKey.trim().length === 0) {
    throw new PostHogConfigProblem("[PostHogClient] PostHog apiKey must be a non-empty string.");
  }

  const host = config.host ?? process.env.POSTHOG_HOST;
  if (!host) {
    throw new PostHogConfigProblem(
      "[PostHogClient] PostHog host is required for data residency compliance. " +
        "Set host in config or POSTHOG_HOST env var. " +
        "Default (app.posthog.com) routes data to US servers.",
    );
  }

  let parsedHost: URL;
  try {
    parsedHost = new URL(host);
  } catch {
    throw new PostHogConfigProblem("[PostHogClient] PostHog host must be a valid HTTP(S) URL.");
  }

  if (parsedHost.protocol !== "http:" && parsedHost.protocol !== "https:") {
    throw new PostHogConfigProblem("[PostHogClient] PostHog host must be a valid HTTP(S) URL.");
  }

  return {
    apiKey: config.apiKey,
    host,
  };
}
