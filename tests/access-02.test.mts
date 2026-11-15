import { initialComposeModel } from './communication-fixture.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { choose, choices, inputView, alphabetRows, interrupt, listeningEvent, finishExpansion, type Model } from '../src/communication/model.mts';
import { InputCoordinator } from '../src/communication/input-coordinator.mts';
const step = (m: Model, id: string) => { assert.ok(choices(m).some(c => c.id === id && !c.disabled), id); return choose(m,id,m.uiRevision); };
const fixture = () => { const m=initialComposeModel('access-fixture'); m.draft='belly hurts weak today'; m.cloud.consent=true; m.cloud.gemini=true; return m; };
test('visible alphabet retains every letter and reversible grouped fallback with manual exits',()=>{
 let m=step(fixture(),'spell'); assert.equal(m.alphabetMode,'visible'); assert.equal(alphabetRows.join(''),'abcdefghijklmnopqrstuvwxyz');
 for(const row of alphabetRows){const letters=step(m,'row:'+row); for(const letter of row){const typed=step(letters,'char:'+letter);assert.equal(typed.draft,m.draft+letter);assert.equal(typed.screen.value,'rows');assert.equal(inputView(typed).targets[0],'row:'+row);assert.equal(typed.authorization,null);}}
 for(const id of ['char: ','erase','expand','review','back','keyboard-layout'])assert.ok(choices(m).some(c=>c.id===id));
 m=step(m,'keyboard-layout');assert.equal(m.alphabetMode,'grouped');m=step(m,'keyboard-layout');assert.equal(m.alphabetMode,'visible');
});
test('row and letter need separate fresh cycles and holds never type',()=>{
 let m=step(fixture(),'spell');m.focusId=null;let serial=0;
 const c=new InputCoordinator(inputView(m),{changed:()=>{},interrupted:()=>{},selected:selection=>{m=choose(m,selection.targetId,selection.revision);c.setView(inputView(m));}},undefined,()=>true,()=>`grid-${++serial}`,async()=>{});
 c.simulate();const original=m.draft;c.down();for(let i=0;i<20;i++){c.tick();c.down();}assert.equal(m.draft,original);c.up();assert.equal(m.screen.value,'abcde');assert.equal(m.draft,original);c.up();assert.equal(m.draft,original);c.down();for(let i=0;i<20;i++){c.tick();c.down();}assert.equal(m.draft,original);c.up();assert.equal(m.draft,original+'a');c.up();assert.equal(m.draft,original+'a');c.stop('done',false);
});
test('listening requires consent then Start, transcript approval changes only optional context',()=>{
 let m=step(step(fixture(),'more'),'listen');const original=m.draft;assert.equal(m.listen.session,null);assert.equal(m.listen.phase,'consent');assert.equal(choose(m,'listen-start',m.uiRevision),m);
 m=step(m,'listen-consent');assert.equal(m.listen.session,null);m=step(m,'listen-start');const id=m.listen.session!;assert.equal(m.listen.phase,'requesting');
 m=listeningEvent(m,id,'recording');m=step(m,'listen-stop');assert.equal(m.listen.phase,'processing');m=listeningEvent(m,id,'transcript','How are you feeling today?');assert.equal(m.draft,original);assert.equal(m.listenedContext,'');assert.equal(m.authorization,null);
 m=step(m,'listen-accept');assert.equal(m.listenedContext,'How are you feeling today?');assert.equal(m.draft,original);assert.equal(m.listen.session,null);assert.equal(m.authorization,null);m=step(m,'expand');assert.equal(m.expansion.request!.transcript,'How are you feeling today?');
});
test('cancellation, focus loss, failures and stale transcription preserve authorship',()=>{
 let m=step(step(step(step(fixture(),'more'),'listen'),'listen-consent'),'listen-start');const id=m.listen.session!,draft=m.draft;
 for(const stopped of [step(m,'listen-cancel'),interrupt(m,'Focus lost'),listeningEvent(m,id,'error','Upload failed')]){assert.equal(stopped.listen.session,null);assert.equal(stopped.draft,draft);assert.equal(stopped.authorization,null);assert.equal(listeningEvent(stopped,id,'transcript','Wrong transcript'),stopped);}
 m=listeningEvent(m,id,'recording');m=listeningEvent(m,id,'processing');m=listeningEvent(m,id,'transcript','Do not move left.');m=step(m,'listen-cancel');assert.equal(m.listenedContext,'');assert.equal(m.draft,draft);
});
test('changed accepted context rejects delayed keyword candidate',()=>{
 let m=step(fixture(),'expand');const request=m.expansion.request!;m={...m,listenedContext:'Different partner statement'};assert.equal(finishExpansion(m,request,{status:'candidate',candidate:'Text',unresolvedCues:[],clarificationQuestion:'',clarificationChoices:[]}),m);
});
test('accepted context without keywords offers only fixed neutral replies and still requires review',()=>{
 let m=fixture();m.draft='';m.listenedContext='Are you comfortable?';m=step(m,'neutral-replies');
 assert.deepEqual(choices(m).slice(0,3).map(c=>c.label),['Yes.','No.','Please repeat that.']);
 assert.equal(m.expansion.request,null);assert.equal(m.assistance.request,null);assert.equal(m.draft,'');
 m=step(m,'neutral:1');assert.equal(m.draft,'No.');assert.equal(m.screen.name,'review');assert.equal(m.authorization,null);assert.equal(choose(m,'speak',m.uiRevision),m);
});
