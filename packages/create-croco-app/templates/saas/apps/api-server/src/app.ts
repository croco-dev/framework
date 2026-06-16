import "reflect-metadata";
import {
  bodyLimitMiddleware,
  corsMiddleware,
  createApp,
  mb,
  securityHeadersMiddleware,
} from "@croco/transports-http";
import { OperationsController } from "./controllers/OperationsController";
import { SaasController } from "./controllers/SaasController";

export function createCrocoApp() {
  return createApp({
    controllers: [OperationsController, SaasController],
    middlewares: [
      securityHeadersMiddleware(),
      corsMiddleware({ origins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"] }),
      bodyLimitMiddleware({ limit: mb(1) }),
    ],
  });
}
