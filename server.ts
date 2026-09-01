import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const server = express();
const angularApp = new AngularNodeAppEngine();

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://api.emailjs.com https://ka-f.fontawesome.com https://*.r2.cloudflarestorage.com",
  "font-src 'self' data: https://fonts.gstatic.com https://ka-f.fontawesome.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "object-src 'none'",
  "script-src 'self' https://kit.fontawesome.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://ka-f.fontawesome.com",
].join('; ');

server.use((request, response, next) => {
  response.set({
    'Content-Security-Policy': contentSecurityPolicy,
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });

  const forwardedProtocol = request.get('x-forwarded-proto');
  if (request.secure || forwardedProtocol?.split(',')[0].trim() === 'https') {
    response.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
});

server.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

server.use((request, response, next) => {
  angularApp
    .handle(request)
    .then((angularResponse) =>
      angularResponse
        ? writeResponseToNodeResponse(angularResponse, response)
        : next(),
    )
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;

  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export default createNodeRequestHandler(server);
