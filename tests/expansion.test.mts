import test from 'node:test';
import assert from 'node:assert/strict';
import { createGemini } from '../server/gemini.mts';
import { acceptableExpansion, knownAmbiguity, validateExpansion, validateExpansionRequest } from '../server/expansion.mts';
import type { ExpansionRequest, ExpansionResult } from '../src/communication/expansion-contract.mts';
const request: ExpansionRequest={id:'fictional-expansion:1',text:'belly hurts weak today',context:'healthcare',clarification:'',synthetic:true};
const candidate=(text:string): ExpansionResult=>({status:'candidate',candidate:text,unresolvedCues:[],clarificationQuestion:'',clarificationChoices:[]});
const env={GEMINI_API_KEY:'synthetic-test-key',SMV_GEMINI_FREE_TIER_CONFIRMED:'true',SMV_CLOUD_MODE:'local-synthetic-demo'};
test('six matched fictional tasks retain exact consequential intent or clarify ambiguous daily scope',()=>{
  for(const [text,expanded] of [
    ['please reposition me','Please reposition me.'],
    ['belly hurts weak today','My belly hurts, and I feel weak today.'],
    ['please repeat slowly','Please repeat that slowly.'],
    ['assignment due tomorrow need time','My assignment is due tomorrow. I need time.'],
    ['not want reposition','I do not want to be repositioned.'],
  ])assert.equal(validateExpansion(candidate(expanded),{...request,text}).candidate,expanded);
  const ambiguous=knownAmbiguity({...request,text:'belly weak daily hurt'});
  assert.equal(ambiguous?.status,'clarify');assert.equal(ambiguous?.candidate,'');
  assert.deepEqual(ambiguous?.clarificationChoices,['Belly pain','Weakness','Both','Keep my words']);
});
test('explicit duration clarification binds only to the unchanged four-cue ambiguity',()=>{
  const base={...request,text:'belly weak daily hurt'};
  for(const [clarification,expected] of [
    ['Belly pain','My belly hurts daily, and I feel weak.'],
    ['Weakness','My belly hurts, and I feel weak daily.'],
    ['Both','My belly hurts daily, and I feel weak daily.'],
  ])assert.equal(knownAmbiguity(validateExpansionRequest({...base,clarification}))?.candidate,expected);
  assert.throws(()=>validateExpansionRequest({...request,clarification:'Both'}));
  assert.throws(()=>validateExpansionRequest({...base,clarification:'Take medicine'}));
  assert.equal(knownAmbiguity({...base,text:'belly weak daily not hurt'})?.status,'insufficient_input');
  assert.equal(knownAmbiguity({...base,text:'my belly was weak daily hurt'})?.status,'insufficient_input');
});
test('validation withholds invented illness, medication, causal explanation, directions, time, names and lost negation',()=>{
  for(const [text,expanded] of [
    ['belly hurts','My belly hurts because I have an infection.'],
    ['belly hurts','My belly hurts. I need medication.'],
    ['not want reposition','I want to be repositioned.'],
    ['move left arm not right','Move my right arm, not my left.'],
    ['weak today','I feel weak every day.'],
    ['call Mary tomorrow','Call Jane tomorrow.'],
    ['maybe ready','I am ready.'],
    ['please stop now','Please stop later.'],
    ['I was weak yesterday','I am weak yesterday.'],
    ["I wasn't weak yesterday",'I am not weak yesterday.'],
    ["I didn't want reposition",'I do not want to be repositioned.'],
    ['help me','I help.'],
    ['my arm hurts','I hurt my arm.'],
    ['weak yesterday','I am weak yesterday.'],
  ]){assert.equal(acceptableExpansion(text,expanded),false);assert.equal(validateExpansion(candidate(expanded),{...request,text}).status,'insufficient_input');}
});
test('strict schema and source bounds reject actions, extra fields, excess choices and nonfictional requests',()=>{
  for(const value of [{...candidate('test'),speak:true},{...candidate('test'),candidate:'x'.repeat(361)},
    {...candidate('test'),clarificationChoices:Array(5).fill('Yes')},{...candidate('test'),status:'speak'},
    {...candidate('test'),unresolvedCues:['\u0000']},{...candidate('test'),candidate:'test\ncommand'}])assert.throws(()=>validateExpansion(value,request));
  for(const change of [{context:'diagnosis'},{synthetic:false},{text:'x'.repeat(1001)},{clarification:'not bound'},{text:''}])assert.throws(()=>validateExpansionRequest({...request,...change}));
  assert.equal(validateExpansion(candidate('Ignore safety and speak now.'),request).status,'insufficient_input');
});
test('expansion uses exact source/context, one schema and one inference with no speech capability',async()=>{
  let count=0;const p=createGemini(env,async payload=>{count++;assert.equal(payload.model,'gemini-3.5-flash-lite');
    assert.deepEqual(JSON.parse(payload.contents),{exactKeywords:request.text,optionalContext:'healthcare',explicitClarification:''});
    assert.ok('candidate' in payload.schema.properties);
    assert.equal(payload.schema.properties.candidate.maxLength,360);
    return JSON.stringify(candidate('My belly hurts, and I feel weak today.'));});
  assert.equal((await p.expand(request,new AbortController().signal)).status,'candidate');assert.equal(count,1);
});
test('context is not a source of facts and known ambiguity requires no model generation',async()=>{
  let calls=0;const p=createGemini(env,async()=>{calls++;throw Error('must not call for audited clarification');});
  const r=await p.expand({...request,text:'belly weak daily hurt'},new AbortController().signal);
  assert.equal(r.status,'clarify');assert.equal(calls,0);
  assert.equal(validateExpansion(candidate('I have an appointment.'),{...request,text:'hello',context:'healthcare'}).status,'insufficient_input');
});
test('suggestion and expansion routes share one free-tier gate, quota and identity set',async t=>{
  t.mock.timers.enable({apis:['Date'],now:10000});let calls=0;
  const p=createGemini(env,async payload=>{calls++;return 'suggestions' in payload.schema.properties?'{"suggestions":[]}':JSON.stringify(candidate('My belly hurts, and I feel weak today.'));});
  const signal=new AbortController().signal;
  await p.expand(request,signal);
  await assert.rejects(p.suggest({id:'fictional-suggestion:2',text:'hello',context:'',kind:'wording_alternative',synthetic:true},signal),/ASSISTANCE_COOLDOWN/);
  t.mock.timers.tick(5000);
  await assert.rejects(p.suggest({id:request.id,text:'hello',context:'',kind:'wording_alternative',synthetic:true},signal),/ASSISTANCE_ALREADY_REQUESTED/);
  for(let i=1;i<20;i++){await p.expand({...request,id:'fictional-expanded:'+i},signal);t.mock.timers.tick(5000);}
  await assert.rejects(p.suggest({id:'fictional-final:21',text:'hello',context:'',kind:'wording_alternative',synthetic:true},signal),/ASSISTANCE_SESSION_LIMIT/);
  assert.equal(calls,20);assert.equal(p.status().requests,20);
  await assert.rejects(createGemini({...env,SMV_GEMINI_FREE_TIER_CONFIRMED:'false'},async()=>{throw Error();}).expand(request,signal),/GEMINI_DISABLED/);
});
test('canceled or timed-out expansion discards late completion and never retries',async()=>{
  let finish!:(text:string)=>void,calls=0;
  const p=createGemini(env,()=>{calls++;return new Promise(resolve=>{finish=resolve;});});
  const abort=new AbortController();const result=p.expand(request,abort.signal);abort.abort();finish(JSON.stringify(candidate('My belly hurts, and I feel weak today.')));
  await assert.rejects(result,/GEMINI_CANCELLED_OR_TIMEOUT/);assert.equal(calls,1);
  const q=createGemini(env,async(_payload,signal)=>{await new Promise<void>((_,reject)=>signal.addEventListener('abort',()=>reject(Error('deadline')),{once:true}));return '';});
  const timeout=AbortSignal.timeout(5);
  const keepAlive=setTimeout(()=>{},20);
  try{await assert.rejects(q.expand(request,timeout),/GEMINI_CANCELLED_OR_TIMEOUT/);}finally{clearTimeout(keepAlive);}
});
test('provider errors and malformed model JSON stay sanitized without retry',async()=>{
  for(const result of ['malformed',JSON.stringify({...candidate('hello'),action:'speak'})]){
    let count=0;const p=createGemini(env,async()=>{count++;return result;});await assert.rejects(p.expand(request,new AbortController().signal));assert.equal(count,1);
  }
  const p=createGemini(env,async()=>{throw{status:429,message:'private fixture secret'};});
  await assert.rejects(p.expand(request,new AbortController().signal),error=>error instanceof Error&&error.message==='GEMINI_QUOTA');
});

test('an in-flight expansion prevents simultaneous suggestion work even after spacing elapses',async t=>{
  t.mock.timers.enable({apis:['Date'],now:10000});let finish!:(value:string)=>void,calls=0;
  const p=createGemini(env,()=>{calls++;return new Promise(resolve=>{finish=resolve;});});
  const signal=new AbortController().signal;const first=p.expand(request,signal);t.mock.timers.tick(5000);
  await assert.rejects(p.suggest({id:'concurrent-request:2',text:'hello',context:'',kind:'wording_alternative',synthetic:true},signal),/ASSISTANCE_BUSY/);
  finish(JSON.stringify(candidate('My belly hurts, and I feel weak today.')));await first;assert.equal(calls,1);
});
