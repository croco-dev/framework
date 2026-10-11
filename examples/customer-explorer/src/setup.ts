import { setup, pool } from "./fixture";
void setup()
  .then(() => console.log("Synthetic schema, source records and fixed sample created."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
