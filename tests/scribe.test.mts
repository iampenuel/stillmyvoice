import test from 'node:test';import assert from 'node:assert/strict';
import {createScribe,validateRecording,SCRIBE_MODEL} from '../server/scribe.mts';
import {knownAmbiguity,validateExpansionRequest,validateExpansion} from '../server/expansion.mts';
import {createGemini} from '../server/gemini.mts';
const env={ELEVENLABS_API_KEY:'synthetic-test-key',SMV_CLOUD_MODE:'local-synthetic-demo',SMV_ELEVENLABS_CREDITS_CONFIRMED:'true'};
const input={id:'fictional-recording:1',audioBase64:Buffer.from('ID3fake-audio').toString('base64'),mimeType:'audio/mpeg',durationMs:2000,synthetic:true,recordingConsent:true};
test('recording gate, consent, MIME, magic, base64, size and declared duration fail closed',async()=>{
 for(const change of [{recordingConsent:false},{synthetic:false},{mimeType:'text/plain'},{audioBase64:'YWJjZA=='},{durationMs:20001},{durationMs:0},{audioBase64:'ID3!'},{audioBase64:'a'.repeat(1398108)}])assert.throws(()=>validateRecording({...input,...change}));
 let calls=0;await assert.rejects(createScribe({},async()=>{calls++;throw Error();}).transcribe(input,new AbortController().signal),/SCRIBE_DISABLED/);assert.equal(calls,0);
});
test('Scribe submits one bounded multipart batch and returns transcript data only',async()=>{
 let calls=0;const p=createScribe(env,async(url,options)=>{calls++;assert.equal(String(url),'https://api.elevenlabs.io/v1/speech-to-text');
  assert.equal(options?.method,'POST');assert.equal(options?.redirect,'error');const form=options!.body as FormData;
  assert.equal(form.get('model_id'),SCRIBE_MODEL);assert.equal(form.get('diarize'),'false');assert.equal(form.get('tag_audio_events'),'false');assert.ok(form.get('file') instanceof Blob);assert.equal(form.has('enable_logging'),false);
  return Response.json({text:'How are you feeling today?',words:[{text:'ignored metadata'}]});});
 assert.deepEqual(await p.transcribe(input,new AbortController().signal),{text:'How are you feeling today?'});assert.equal(calls,1);
 await assert.rejects(p.transcribe(input,new AbortController().signal),/ALREADY_SUBMITTED/);assert.equal(calls,1);
});
test('recorded-duration budget, concurrent requests and stale cancellation never retry',async()=>{
 const signal=new AbortController().signal;let count=0;
 const p=createScribe(env,async()=>{count++;return Response.json({text:'Fictional question.'});});
 for(let i=0;i<6;i++)await p.transcribe({...input,id:'fictional-budget:'+i,durationMs:20000},signal);
 await assert.rejects(p.transcribe({...input,id:'fictional-budget:7',durationMs:1},signal),/TRANSCRIPTION_LIMIT/);assert.equal(count,6);
 let resolve!:(response:Response)=>void;const q=createScribe(env,()=>new Promise(done=>{resolve=done;}));const abort=new AbortController();
 const pending=q.transcribe(input,abort.signal);await assert.rejects(q.transcribe({...input,id:'fictional-concurrent:2'},signal),/TRANSCRIPTION_BUSY/);
 abort.abort();resolve(Response.json({text:'Too late.'}));await assert.rejects(pending,/SCRIBE_CANCELLED_OR_TIMEOUT/);
});
test('provider quota, malformed and oversized transcripts expose only sanitized failures',async()=>{
 for(const response of [Response.json({text:'x'.repeat(1001)}),Response.json({text:''}),Response.json({text:'private fixture',error:'secret'},{status:429})]){
  let calls=0;const p=createScribe(env,async()=>{calls++;return response;});await assert.rejects(p.transcribe(input,new AbortController().signal),e=>e instanceof Error&&!e.message.includes('private')&&!e.message.includes('secret'));assert.equal(calls,1);
 }
});
const expansion={id:'fictional-context:1',text:'belly hurts weak today',context:'healthcare',clarification:'',synthetic:true} as const;
test('reviewed transcript remains optional relevance data; no keywords means no invented first-person message',()=>{
 assert.equal(validateExpansionRequest(expansion).transcript,undefined);
 assert.equal(knownAmbiguity({...expansion,text:'',transcript:'How are you feeling?'})?.status,'insufficient_input');
 assert.equal(knownAmbiguity({...expansion,transcript:'How are you feeling today?'}),null);
 const r=validateExpansion({status:'candidate',candidate:'My belly hurts because I have an infection.',unresolvedCues:[],clarificationQuestion:'',clarificationChoices:[]},{...expansion,transcript:'You have an infection.'});assert.equal(r.status,'insufficient_input');
});
test('incorrect context negation/direction withholds while preserving the exact authored keywords',async()=>{
 let calls=0;const p=createGemini({GEMINI_API_KEY:'synthetic-test-key',SMV_CLOUD_MODE:'local-synthetic-demo',SMV_GEMINI_FREE_TIER_CONFIRMED:'true'},async()=>{calls++;throw Error('must not infer conflicting context');});
 for(const [text,transcript] of [['not want reposition','You want reposition.'],['move left arm','Move your right arm.']]){
  const request={...expansion,text,transcript};assert.equal(knownAmbiguity(request)?.status,'insufficient_input');assert.equal(request.text,text);
 }
 const result=await p.expand({...expansion,text:'move left arm',transcript:'Move your right arm.'},new AbortController().signal);
 assert.equal(result.status,'insufficient_input');assert.equal(calls,0);
});
test('correct reviewed context is submitted only with an explicit expansion request',async()=>{
 let calls=0;const p=createGemini({GEMINI_API_KEY:'synthetic-test-key',SMV_CLOUD_MODE:'local-synthetic-demo',SMV_GEMINI_FREE_TIER_CONFIRMED:'true'},async payload=>{calls++;
  assert.equal(JSON.parse(payload.contents).reviewedTranscript,'How are you feeling today?');return JSON.stringify({status:'candidate',candidate:'My belly hurts, and I feel weak today.',unresolvedCues:[],clarificationQuestion:'',clarificationChoices:[]});});
 assert.equal(calls,0);const result=await p.expand({...expansion,transcript:'How are you feeling today?'},new AbortController().signal);assert.equal(result.status,'candidate');assert.equal(calls,1);
});
