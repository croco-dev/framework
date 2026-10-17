import { createDemoServer } from "./http";
void createDemoServer(process.env.ANALYTICS_POSTGRES_URL ?? "", process.cwd())
  .then(({ server, close }) => {
    server.listen(4187, "127.0.0.1", () =>
      console.log("Synthetic acquisition: http://127.0.0.1:4187/"),
    );
    const stop = () => {
      server.close(() => {
        void close();
      });
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  })
  .catch(() => {
    console.error("Synthetic acquisition startup failed");
    process.exitCode = 1;
  });
