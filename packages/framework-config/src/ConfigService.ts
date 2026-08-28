import { Component } from "@croco/framework-context";
import { fullEnv } from "./core";

@Component({ scope: "singleton" })
export class ConfigService {
  /**
   * Type-safe environment variable getter
   */
  get<K extends keyof typeof fullEnv>(key: K): (typeof fullEnv)[K] {
    return fullEnv[key];
  }

  get isProduction(): boolean {
    return this.get("NODE_ENV") === "production";
  }

  get isDevelopment(): boolean {
    return this.get("NODE_ENV") === "development";
  }

  get isTest(): boolean {
    return this.get("NODE_ENV") === "test";
  }
}
