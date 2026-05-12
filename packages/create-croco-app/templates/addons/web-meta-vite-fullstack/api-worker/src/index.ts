import { toWorkersHandler } from '@croco/transports-cloudflare-workers';
import { createApp } from '@croco/transports-http';

const app = createApp({
  controllers: [],
  securityValidation: 'off',
});

export default toWorkersHandler(app);
