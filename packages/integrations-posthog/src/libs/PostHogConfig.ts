import { Container, LOGGER_TOKEN, Token } from "@croco/framework-context";

import { PostHogConfigProblem } from "./problems/PostHogProblems";

export interface PostHogConfig {
  apiKey: string;
  host?: string;
}

/** PostHog 설정을 Croco DI에 등록하고 조회할 때 사용하는 토큰입니다. */
export const POSTHOG_CONFIG_TOKEN = new Token<Readonly<PostHogConfig>>("PostHogConfig");

/**
 * PostHog 설정을 검증하고 환경 기반 host를 정규화한 뒤 Croco DI에 등록합니다.
 *
 * @param config - 등록할 PostHog API key와 선택적 HTTP(S) host입니다.
 * @returns 컨테이너에 등록된 동결 설정입니다.
 */
export function registerPostHogConfig(config: PostHogConfig): Readonly<PostHogConfig> {
  const host = validatePostHogConfig(config);

  if (!config.host) {
    warnAboutEnvironmentHost();
  }

  const registeredConfig = Object.freeze({ ...config, host });
  Container.set(POSTHOG_CONFIG_TOKEN, registeredConfig);
  return registeredConfig;
}

export function warnAboutEnvironmentHost(): void {
  Container.getOptional(LOGGER_TOKEN)?.warn(
    "[PostHogClient] POSTHOG_HOST env var is used for PostHog host. " +
      "Set host explicitly in config to confirm data residency compliance.",
  );
}

export function validatePostHogConfig(config: PostHogConfig): string {
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

  return host;
}
