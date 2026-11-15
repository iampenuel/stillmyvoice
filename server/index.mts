import { createServer } from 'node:http';
import { createElevenLabs } from './elevenlabs.mts';
import { createGemini } from './gemini.mts';
import { createScribe } from './scribe.mts';
import { googleGenerator } from './google-sdk.mts';
import { createApiHandler } from './http.mts';
import { loadServerEnvironment } from './environment.mts';

if (import.meta.main) {
  const environment = loadServerEnvironment();
  const eleven = createElevenLabs(environment);
  const gemini = createGemini(environment, googleGenerator(environment.GEMINI_API_KEY));
  const server = createServer(createApiHandler(eleven, gemini, createScribe(environment)));
  server.requestTimeout = 15_000; server.headersTimeout = 10_000; server.keepAliveTimeout = 5000;
  server.on('error', () => { console.error('SMV local API could not start. Check the local port.'); process.exitCode = 1; });
  server.listen(5174, '127.0.0.1', () => console.info('SMV local API listening on http://127.0.0.1:5174. Cloud account gates apply.'));
  const close = () => { server.close(); server.closeAllConnections(); };
  process.on('SIGTERM', close); process.on('SIGINT', close);
}
