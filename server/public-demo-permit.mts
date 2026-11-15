/** Process-local evidence of an already accepted durable reservation, never a serialized credential.
 * Only the shared-quota module issues these after Redis atomically reserves usage.
 * Objects forged from request JSON or configuration strings cannot authorize a provider call. */
type Operation = 'gemini' | 'speech' | 'scribe' | 'metadata';
export type PublicProviderPermit = Readonly<{ provider: Operation; deadlineAt: number; requestId: string; units: number }>;
const issued = new WeakMap<object, { provider: Operation; deadlineAt: number; requestId: string; units: number; consumed: Set<Operation> }>();
export function registerPublicReservation<T extends PublicProviderPermit>(reservation: T): T {
  if (!['gemini', 'speech', 'scribe', 'metadata'].includes(reservation.provider) || !Number.isFinite(reservation.deadlineAt)
    || !/^[A-Za-z0-9:-]{8,160}$/.test(reservation.requestId) || !Number.isSafeInteger(reservation.units) || reservation.units < 1) throw Error('Invalid public reservation');
  issued.set(reservation, { provider: reservation.provider, deadlineAt: Math.min(reservation.deadlineAt, Date.now() + 15_000), requestId: reservation.requestId, units: reservation.units, consumed: new Set() });
  return reservation;
}
export function consumePublicReservation(reservation: PublicProviderPermit | undefined, operation: Operation, expected: { id: string; units: number }): boolean {
  const record = reservation && issued.get(reservation);
  if (!record || record.deadlineAt <= Date.now() || (record.provider !== operation && !(record.provider === 'speech' && operation === 'metadata'))
    || expected.id !== record.requestId || expected.units !== record.units || record.consumed.has(operation)) return false;
  record.consumed.add(operation);
  return true;
}
export function retirePublicReservation(reservation: PublicProviderPermit): void { issued.delete(reservation); }
export const publicDemoMode = (env: Record<string, string | undefined>): boolean => env.SMV_CLOUD_MODE === 'public-demo' && env.VERCEL === '1';
export const providerModeConfigured = (env: Record<string, string | undefined>): boolean =>
  (env.SMV_CLOUD_MODE === 'local-synthetic-demo' && env.NODE_ENV !== 'production') || publicDemoMode(env);
/** Public readiness is configuration only. Every provider operation separately consumes its permit. */
export const consumeProviderPermit = (env: Record<string, string | undefined>, permit: PublicProviderPermit | undefined, operation: Operation, expected: { id: string; units: number }): boolean =>
  publicDemoMode(env) ? consumePublicReservation(permit, operation, expected) : env.SMV_CLOUD_MODE === 'local-synthetic-demo' && env.NODE_ENV !== 'production';
