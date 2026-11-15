// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, useState } from 'react';
type Access = { configured: boolean; authorized: boolean; expiresAt?: number };
const locked: Access = { configured: false, authorized: false };
/** The code is sent only to the same-origin server, never stored, logged or placed in a URL. */
export function DemoAccess({ onChanged }: { onChanged: () => void }) {
  const [access, setAccess] = useState<Access>(locked);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('Checking Demo access…');
  const request = useRef<AbortController | null>(null);
  const changed = useRef(onChanged); changed.current = onChanged;
  async function update(method: 'GET' | 'POST' | 'DELETE', value?: string) {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true);
    if (method === 'DELETE') changed.current();
    try {
      const response = await fetch('/api/demo-access', {
        method, credentials: 'same-origin', cache: 'no-store',
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
        body: method === 'POST' ? JSON.stringify({ code: value }) : undefined,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      });
      const text = await response.text();
      if (text.length > 4096) throw Error('Demo access returned an invalid response.');
      if (!response.ok) throw Error(response.status === 429 ? 'Too many access attempts. Wait before trying again.' : response.status === 401 || response.status === 403 ? 'Demo access was not accepted. Check the code with the owner.' : 'Demo access is unavailable. Basic communication still works.');
      const data: unknown = JSON.parse(text);
      if (!data || typeof data !== 'object' || !('configured' in data) || typeof data.configured !== 'boolean' || !('authorized' in data) || typeof data.authorized !== 'boolean') throw Error('Demo access returned an invalid response.');
      if (controller.signal.aborted) return;
      const next = data as Access; setAccess(next);
      setNotice(next.authorized ? 'Demo access unlocked for a limited session. Cloud consent and each message approval are still required.' : next.configured ? 'Enter the judge demo code to unlock cloud features.' : 'The public backend is not configured yet. Basic communication still works.');
      // Refresh after the revoked cookie is cleared; the earlier DELETE callback cancels active work.
      if (method === 'POST' || method === 'DELETE') changed.current();
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error instanceof Error && /^(Demo access|Too many|The public)/.test(error.message) ? error.message : 'Demo access is unavailable. Basic communication still works.');
    } finally {
      if (!controller.signal.aborted) { setBusy(false); setCode(''); }
    }
  }
  useEffect(() => { void update('GET'); return () => { request.current?.abort(); }; }, []);
  return <section aria-labelledby="demo-access-title">
    <h3 id="demo-access-title">Demo access</h3>
    <p role="status">{notice}</p>
    {access.authorized ? <button type="button" disabled={busy} onClick={() => void update('DELETE')}>Lock cloud features</button> : <form onSubmit={event => { event.preventDefault(); if (!busy && access.configured) void update('POST', code); }}>
      <label>Judge demo code <input type="password" autoComplete="off" spellCheck={false} minLength={12} maxLength={128} value={code} disabled={busy || !access.configured} onChange={event => setCode(event.target.value)} /></label>
      <button type="submit" disabled={busy || !access.configured || code.length < 12}>Unlock cloud features</button>
    </form>}
  </section>;
}
