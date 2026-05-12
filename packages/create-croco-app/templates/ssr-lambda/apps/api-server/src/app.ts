import "reflect-metadata";
import { Controller, Get } from "@croco/protocols-rest";
import { createApp } from "@croco/transports-http";

@Controller("/api")
class ApiController {
  @Get("/hello")
  hello() {
    return {
      message: "Hello from Croco API",
    };
  }
}

export function createCrocoApp() {
  return createApp({
    controllers: [ApiController],
    securityValidation: "off",
  });
}
