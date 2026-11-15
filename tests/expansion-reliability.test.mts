import test from 'node:test';
import assert from 'node:assert/strict';
import { assessExpansion, validateExpansion, knownAmbiguity } from '../server/expansion.mts';
import { createGemini } from '../server/gemini.mts';
import { isExpansionResult, type ExpansionRequest, type ExpansionResult } from '../src/communication/expansion-contract.mts';
import { initialModel, choose, finishExpansion, choices, presented, interrupt, type Model } from '../src/communication/model.mts';
import { cloudFailure } from '../src/communication/cloud-error.mts';
const request: ExpansionRequest = { id:'reliability-fixture:1',text:'',context:'healthcare',clarification:'',synthetic:true };
const candidate=(text:string):ExpansionResult=>({status:'candidate',candidate:text,unresolvedCues:[],clarificationQuestion:'',clarificationChoices:[]});
const clarify=(options:string[]):ExpansionResult=>({status:'clarify',candidate:'',unresolvedCues:['wording'],clarificationQuestion:'Which meaning?',clarificationChoices:[...options,'Keep my words']});
const step=(m:Model,id:string)=>{assert.ok(choices(m).some(c=>c.id===id&&!c.disabled),id);return choose(m,id,m.uiRevision);};
const pending=(text:string)=>{
  let m=step(initialModel('reliability-test'),'context-set:healthcare');
  m.draft=text;m.cloud.consent=true;m.cloud.gemini=true;m.settings.voice='fixture-local';return step(m,'expand');
};
const matrix:[string,ExpansionResult,ExpansionResult['status']][]=[
  ['belly hurts weak today',candidate('My belly hurts, and I feel weak today.'),'candidate'],
  ['my hed herts',candidate('My head hurts.'),'clarify'],
  ['belly hurtsweek',clarify(['My belly hurts this week.','My belly hurts, and I feel weak.']),'clarify'],
  ['i not redy',candidate('I am not ready.'),'clarify'],
  ['do not reposition me',candidate('Do not reposition me.'),'candidate'],
  ['move left arm not right',candidate('Move my left arm, not my right.'),'candidate'],
  ['plese repet',candidate('Please repeat that.'),'clarify'],
  ['bach',candidate('Bach.'),'candidate'],
  ['a',{...candidate(''),status:'insufficient_input'},'insufficient_input'],
  ['belly weak daily hurt',clarify(['unused']),'clarify'],
];
for(const [text,raw,status] of matrix)test(`mock provider matrix: ${text}`,async()=>{
  let calls=0;const service=createGemini({GEMINI_API_KEY:'synthetic-fixture-key',SMV_CLOUD_MODE:'local-synthetic-demo',SMV_GEMINI_FREE_TIER_CONFIRMED:'true'},async()=>{calls++;return JSON.stringify(raw);});
  const m=pending(text), req=m.expansion.request!;
  const result=await service.expand(req,new AbortController().signal), next=finishExpansion(m,req,result);
  const local=!!knownAmbiguity(req);
  assert.equal(calls,local?0:1);assert.equal(service.status().diagnostics.lastRequest?.providerOutcome,local?'not_called':'success');
  assert.equal(result.status,status);assert.ok(isExpansionResult(result));assert.equal(next.draft,text);assert.equal(next.authorization,null);
  assert.equal(service.status().diagnostics.lastRequest?.validationOutcome,status);
});
test('spacing, case, punctuation and unseen typos use the same bounded rule',()=>{
  for(const [text,proposed] of [[' MY   HED, HERTS! ','My head hurts.'],['plase repeet','Please repeat.'],['need blnket','I need a blanket.'],['headhurts','My head hurts.'],['re pe at','repeat']]){
    const result=validateExpansion(candidate(proposed),{...request,text});
    // More than two joined source fragments remains outside the bounded repair.
    assert.equal(result.status,text==='re pe at'?'validation_rejected':'clarify');
  }
});
test('all uncertain lexical changes, including unfamiliar names, require choice',()=>{
  assert.equal(validateExpansion(candidate('Back.'),{...request,text:'bach'}).status,'clarify');
  assert.equal(validateExpansion(candidate('Bach.'),{...request,text:'bach'}).status,'candidate');
  assert.equal(validateExpansion(candidate('My belly hurts this week.'),{...request,text:'belly hurtsweek'}).status,'clarify');
});
test('each interpretation independently preserves negation, direction, quantities, urgency and facts',()=>{
  for(const [text,proposed] of [
    ['do not reposition me','Please reposition me.'],['move left arm not right','Move my right arm, not my left.'],
    ['call Mary tomorrow','Call Jane tomorrow.'],['need 1.5 ml','I need 1,5 ml.'],['need two blankets','I need ten blankets.'],
    ['not ready','Now ready.'],['belly hurtsweek','My belly hurts and I feel weak today.'],
    ['belly hurtsweek','My belly hurts because I have an infection.'],['no help','Help.'],['stop now','Stop later.'],
    ['belly hurtsweek','My belly hurts weekly.'],['belly hurts','My belly hurts badly.'],['my hed herts','My head hurts. I need medicine.'],
  ])assert.equal(assessExpansion(text,proposed),'reject',text+' -> '+proposed);
  const invalidSet=validateExpansion(clarify(['My belly hurts this week.','My belly hurts today.']),{...request,text:'belly hurtsweek'});
  assert.equal(invalidSet.status,'clarify');assert.deepEqual(invalidSet.clarificationChoices,['My belly hurts this week.','Keep my words']);
  assert.equal(validateExpansion(clarify(['My belly is weak.','My belly hurts every week.']),{...request,text:'belly hurtsweek'}).status,'validation_rejected');
});
test('wording choice is silent, stages exact interpretation without a second request, and can be rejected',()=>{
  const original=pending('my hed herts'), req=original.expansion.request!;
  let m=finishExpansion(original,req,validateExpansion(candidate('My head hurts.'),req));
  const serial=m.serial,revision=m.uiRevision;
  m=step(m,'clarify-expansion:0');
  assert.equal(m.draft,'my hed herts');assert.equal(m.authorization,null);assert.equal(m.expansion.request,null);assert.equal(m.serial,serial);
  assert.equal(m.expansion.result?.candidate,'My head hurts.');
  assert.equal(choose(m,'accept-expansion',revision),m);
  assert.equal(step(m,'keep-words').draft,'my hed herts');
  const edit=step(m,'edit-expansion');assert.equal(edit.expansion.buffer,'My head hurts.');assert.equal(edit.draft,'my hed herts');
  m=step(m,'accept-expansion');assert.equal(m.draft,'My head hurts.');assert.ok(m.undo.includes('my hed herts'));assert.equal(m.authorization,null);
  m=presented(m,m.revision,0);m=step(m,'speak');assert.equal(m.authorization?.text,'My head hurts.');
});
test('cancellation, editing and new context discard stale results; spelling remains direct',()=>{
  const m=pending('my hed herts'),req=m.expansion.request!,result=validateExpansion(candidate('My head hurts.'),req);
  for(const obsolete of [step(m,'back'),step(m,'keep-words'),step(m,'continue-spelling'),interrupt(m,'Focus lost'),{...m,draft:'new text',revision:m.revision+1}]){
    assert.equal(finishExpansion(obsolete,req,result),obsolete);assert.equal(obsolete.authorization,null);
  }
  const failed=finishExpansion(m,req,{...candidate(''),status:'validation_rejected'});
  assert.equal(step(failed,'continue-spelling').screen.name,'keyboard');assert.equal(failed.draft,'my hed herts');
});
test('strict client schema and useful error classes remain separate',async()=>{
  for(const invalid of [{...candidate('hello'),unresolvedCues:['maybe']},{...candidate(''),status:'clarify'}, {...candidate('hello'),speech:true},clarify(['x'.repeat(361)]),{...candidate(''),status:'insufficient_input',clarificationChoices:['Yes']}])assert.equal(isExpansionResult(invalid),false);
  assert.match(cloudFailure(502,{error:'INVALID_EXPANSION'}),/invalid structured response/);
  assert.match(cloudFailure(503,{error:'GEMINI_UNAVAILABLE'}),/temporarily unavailable/);
  const errors=['ASSISTANCE_COOLDOWN','ASSISTANCE_SESSION_LIMIT','GEMINI_QUOTA','INVALID_EXPANSION','GEMINI_UNAVAILABLE'];
  assert.equal(new Set(errors.map(error=>cloudFailure(429,{error}))).size,errors.length);
  const service=createGemini({GEMINI_API_KEY:'synthetic-fixture-key',SMV_CLOUD_MODE:'local-synthetic-demo',SMV_GEMINI_FREE_TIER_CONFIRMED:'true'},async()=>'{bad-json');
  await assert.rejects(service.expand({...request,text:'my hed herts'},new AbortController().signal),/INVALID_EXPANSION/);
  assert.equal(service.status().diagnostics.lastRequest?.providerOutcome,'success');
  assert.equal(service.status().diagnostics.lastRequest?.schemaValidated,false);
});

test('retained interpretation stays inspectable when Gemini becomes unavailable',()=>{
 const m=pending('my hed herts'), req=m.expansion.request!;
 const received=finishExpansion(m,req,validateExpansion(candidate('My head hurts.'),req));
 received.cloud.gemini=false;
 const selected=step(received,'clarify-expansion:0');
 assert.equal(selected.expansion.result?.status,'candidate');assert.equal(selected.expansion.request,null);
 assert.deepEqual(choices(selected).map(c=>c.id),['accept-expansion','edit-expansion','keep-words','back']);
 assert.equal(selected.draft,'my hed herts');assert.equal(selected.authorization,null);
});
test('opening context Back enters General without an extra screen or discarded draft',()=>{
 const initial=initialModel('back-fixture');initial.draft='Kept words';
 const next=step(initial,'back');assert.equal(next.screen.name,'compose');assert.equal(next.context,'general');
 assert.equal(next.draft,'Kept words');assert.equal(next.authorization,null);
});

test('recorded live alternatives cannot introduce recurrence or drop the authored action',()=>{
 for(const invalid of ['My belly hurts weekly.','My belly hurts every week.','My belly is weak.']) {
  const result=validateExpansion(clarify(['My belly hurts this week.',invalid]),{...request,text:'belly hurtsweek'});
  assert.deepEqual(result.clarificationChoices,['My belly hurts this week.','Keep my words']);
 }
});
