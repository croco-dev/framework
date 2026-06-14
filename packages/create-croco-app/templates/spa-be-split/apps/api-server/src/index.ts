import { createCrocoApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const app = createCrocoApp();

await app.listen(port);
