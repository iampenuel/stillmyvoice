import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { boundedBody } from './elevenlabs.mts';
import type { Generate } from './gemini.mts';

/** Official SDK, explicit direct Developer API, single attempt, no tools or storage. */
export function googleGenerator(key: string | undefined, fetcher: typeof fetch = fetch): Generate {
  let client: GoogleGenAI | null = null;
  return async (request, signal) => {
    if (!key) throw Error('Provider not configured');
    client ??= new GoogleGenAI({ apiKey: key, apiVersion: 'v1beta', enterprise: false, vertexai: false,
      httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com', timeout: 10_000, retryOptions: { attempts: 1 },
        fetch: async (url, options) => {
          // Refuse SDK redirects or environment overrides to another destination.
          const endpoint = new URL(String(url));
          if (endpoint.origin !== 'https://generativelanguage.googleapis.com') throw Error('Provider origin rejected');
          const response = await fetcher(url, { ...options, redirect: 'error' });
          const bytes = await boundedBody(response, 65_536, options?.signal ?? AbortSignal.timeout(10_000));
          return new Response(new Uint8Array(bytes), { status: response.status, headers: response.headers });
        } },
    });
    const response = await client.models.generateContent({ model: request.model, contents: request.contents,
      config: { systemInstruction: request.instruction, responseMimeType: 'application/json', responseJsonSchema: request.schema,
        maxOutputTokens: 600, temperature: 0.1, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }, abortSignal: signal } });
    return response.text ?? '';
  };
}
