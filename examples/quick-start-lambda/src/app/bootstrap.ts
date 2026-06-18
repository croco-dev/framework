import { AUTH_PROVIDER_TOKEN, AuthGuard } from "@croco/auth-core";
import { Container, type ILogger, LOGGER_TOKEN } from "@croco/framework-context";
import { setMeteringService } from "@croco/metering-core";
import { createApp } from "@croco/transports-http";
import { TestAuthProvider } from "../integrations/TestAuthProvider";
import { createMeteringService } from "../integrations/inMemoryMetering";
import { HealthController } from "../protocols/HealthController";
import { UserController } from "../protocols/UserController";

type LambdaExampleApp = ReturnType<typeof createApp>;

const demoLogger: ILogger = {
  debug: (message, context) => {
    if (context === undefined) {
      console.debug(message);
      return;
    }
    console.debug(message, context);
  },
  info: (message, context) => {
    if (context === undefined) {
      console.info(message);
      return;
    }
    console.info(message, context);
  },
  warn: (message, context) => {
    if (context === undefined) {
      console.warn(message);
      return;
    }
    console.warn(message, context);
  },
  error: (message, context) => {
    if (context === undefined) {
      console.error(message);
      return;
    }
    console.error(message, context);
  },
  child: () => demoLogger,
};

export function createLambdaExampleApp(): LambdaExampleApp {
  registerDemoRuntime();

  return createApp({
    controllers: [HealthController, UserController],
    securityValidation: "off",
  });
}

export function startLocalServer(app: LambdaExampleApp): void {
  const port = Number(process.env.PORT ?? 3000);

  app.listen(port).then(() => {
    console.log(`SaaS demo API running at http://localhost:${port}/api`);
  });
}

function registerDemoRuntime(): void {
  setMeteringService(createMeteringService());
  Container.set(LOGGER_TOKEN, demoLogger);
  Container.set(AUTH_PROVIDER_TOKEN, new TestAuthProvider());
  Container.set(AuthGuard, new AuthGuard());
  Container.set(HealthController, new HealthController());
  Container.set(UserController, new UserController());
}
