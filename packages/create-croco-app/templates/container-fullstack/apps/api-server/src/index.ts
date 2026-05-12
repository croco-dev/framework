import { createCrocoApp } from "@croco/transports-http";

const app = createCrocoApp();

// Register controllers here
// app.addControllers([UserController]);

// Listen with static file serving for Vike SSR build output
app.listen({
  port: 3000,
  staticDir: "../console-web/dist/client",
  spaFallback: true,
});
