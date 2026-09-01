import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import {
  getAllowedHosts,
  getContext,
  getTrustProxyHeaders,
} from '@netlify/angular-runtime/app-engine.js';

const angularAppEngine = new AngularAppEngine({
  allowedHosts: getAllowedHosts(),
  trustProxyHeaders: getTrustProxyHeaders(),
});

export async function netlifyAppEngineHandler(
  request: Request,
): Promise<Response> {
  const context = getContext();

  if (
    context &&
    new URL(request.url).pathname.startsWith('/api/contact-upload/')
  ) {
    return context.next(request);
  }

  const result = await angularAppEngine.handle(request, context);

  return result || new Response('Not found', { status: 404 });
}

/**
 * Request handler used by the Angular CLI during development and builds.
 */
export const reqHandler = createRequestHandler(netlifyAppEngineHandler);
