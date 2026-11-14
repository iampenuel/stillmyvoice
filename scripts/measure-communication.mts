// Generate the ignored baseline with the command documented in HP26_UX_03_SESSION_01.md.
const old = await import(new URL('../local-reports/UX03_BASELINE_MODEL.mts', import.meta.url).href);
import * as current from '../src/communication/model.mts';
import {writeFileSync} from 'node:fs';
type Library = typeof current;
function run(lib: Library, actions: string[], text = '', completed = false) {
  let state = lib.initialModel('fictional-measure'); state.settings.voice = 'fixture';
  state.draft = text; if(completed) state.screen = {name:'complete'};
  let selections = 0, scanAdvances = 0;
  for(const action of actions) {
    if(action === 'speak') state = lib.presented(state, state.revision, 0);
    const targets = lib.inputView(state).targets, index = targets.indexOf(action);
    if(index < 0) throw Error('Invalid route: ' + action + ' on ' + state.screen.name);
    scanAdvances += index; selections++; state = lib.choose(state, action, state.uiRevision);
  }
  return {selections, scanAdvances, exactResult:state.authorization?.text ?? state.draft};
}
function spell(word: string, direct: boolean) {
  return [...word].flatMap(c => c === ' ' ? direct ? ['char: '] : ['row:editing','char: ']
    : ['row:' + ['abcde','fghij','klmno','pqrst','uvwxyz'].find(r=>r.includes(c)), 'char:' + c])
    .concat(direct ? ['done'] : ['row:navigation','done']);
}
const before = old as Library;
const rows = [
 {task:'Select, review and approve Please reposition me.', before:run(before,['phrases','category:Comfort','phrase:0','review','speak']), after:run(current,['phrases','phrase:2','review','speak'])},
 {task:'After playback, edit to Please do not reposition me., review and approve', before:run(before,['edit','word:1',...spell('do not reposition',false),'review','speak'],'Please reposition me.',true), after:run(current,['edit','word:1','prefix:not','done','review','speak'],'Please reposition me.',true)},
 {task:'Spell help and return to message', before:run(before,['spell',...spell('help',false)]), after:run(current,['spell',...spell('help',true)])},
 {task:'Replace left with right, review and approve', before:run(before,['edit','word:2',...spell('right',false),'review','speak'],'Move my left arm.',true), after:run(current,['edit','word:2',...spell('right',true),'review','speak'],'Move my left arm.',true)},
 {task:'Review and approve an already edited message', before:run(before,['review','speak'],'Please do not reposition me.'), after:run(current,['review','speak'],'Please do not reposition me.')},
];
const report = {evidence:'Deterministic model traversal, not physical measurements or time estimates. Scan advances assume each fresh view starts at its configured initial target and no missed target. Setup, reading time, transport delays and errors excluded.',baseline:'d5b5006',rows};
writeFileSync('local-reports/UX03_EFFICIENCY.json',JSON.stringify(report,null,2),{mode:0o600});
console.log(JSON.stringify(report,null,2));
