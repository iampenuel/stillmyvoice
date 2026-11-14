import type { Choice } from './model.mts';

type Props = {
  option: Choice; selected: boolean; held: boolean;
  register: (element: HTMLButtonElement | null) => void;
  activate: () => void;
};
/** Semantic companion activation. Hardware selection remains in the coordinator. */
export function ChoiceButton({ option, selected, held, register, activate }: Props) {
  return <div className="target-envelope" data-scan={selected} data-held={selected && held} data-choice={option.id}>
    <button ref={register} type="button" disabled={option.disabled} onClick={activate}>
      <span className="choice-label">{option.label}</span>
      {option.detail ? <span className="choice-detail">{option.detail}</span> : null}
      <span className="scan-label" aria-hidden="true">{selected && held ? 'Release to choose' : selected ? 'Scan focus' : '\u00a0'}</span>
    </button>
  </div>;
}
