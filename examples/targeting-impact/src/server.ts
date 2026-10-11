import { createDemoServer } from "./http";
void createDemoServer(process.cwd())
  .then((server) =>
    server.listen(4185, "127.0.0.1", () =>
      console.log("Synthetic targeting impact: http://127.0.0.1:4185/"),
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
