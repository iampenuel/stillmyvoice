import { choose, initialModel } from '../src/communication/model.mts';

/** Existing workflow tests begin after the newly required context selection. */
export function initialComposeModel(session: string) {
  const initial = initialModel(session);
  return choose(initial, 'context-set:general', initial.uiRevision);
}
