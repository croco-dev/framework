import 'reflect-metadata';
import { Controller, Get } from '@croco/protocols-rest';
import { createApp } from '@croco/transports-http';

@Controller('/api')
class HealthController {
  @Get('/health')
  health() {
    return { status: 'ok', message: 'Croco Quick Start is running!' };
  }
}

const app = createApp({
  controllers: [HealthController],
});

export const handler = app.lambdaHandler();

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000).then(() => {
    console.log('Health API running at http://localhost:3000/api/health');
  });
}
