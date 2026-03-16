import { toWorkersHandler } from '@croco/transports-cloudflare-workers';
import { createApp } from '@croco/transports-http';

const app = createApp({ controllers: [] });

export default toWorkersHandler(app);
