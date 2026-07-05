import { Container, getContainer } from '@cloudflare/containers';
import { env as workerEnv } from 'cloudflare:workers';

export class EuroOfficeContainer extends Container {
  defaultPort = 80;
  sleepAfter = '30m';

  envVars = {
    EXAMPLE_ENABLED: 'false',
    JWT_ENABLED: 'true',
    JWT_SECRET: String(workerEnv.EURO_OFFICE_JWT_SECRET || ''),
  };

  override onStart() {
    console.log('Euro-Office DocumentServer started.');
  }

  override onStop() {
    console.log('Euro-Office DocumentServer stopped.');
  }

  override onError(error: unknown) {
    console.error('Euro-Office DocumentServer error:', error);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/_opc/runtime') {
      return Response.json({
        service: 'opc-euro-office',
        status: 'configured',
      });
    }

    const container = getContainer(env.EURO_OFFICE, 'primary');
    return container.fetch(request);
  },
};
