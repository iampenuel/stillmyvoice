/** Vercel Web handler: server-only environment; no local .env or gate-file loading. */
import { createPublicDemoHandler } from '../server/public-demo-http.mts';
const handler = createPublicDemoHandler(process.env);
export default { fetch: handler };
