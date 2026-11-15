// SPDX-License-Identifier: AGPL-3.0-or-later
import { createPublicDemoHandler } from '../.api-build/server/public-demo-http.mjs';
export default { fetch: createPublicDemoHandler(process.env) };
