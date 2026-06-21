import { createSsrHandler } from "@croco/frontend-cloudflare";
import { RenderServer } from "@croco/meta-vite";
import registry from "./pages/route";

const renderServer = new RenderServer(registry.compile());
const fetch = createSsrHandler({ renderServer });

export default { fetch };
