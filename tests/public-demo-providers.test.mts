import test from 'node:test';
import assert from 'node:assert/strict';
import { createGemini } from '../server/gemini.mts';
import { createElevenLabs } from '../server/elevenlabs.mts';
import { createScribe } from '../server/scribe.mts';
import { registerPublicReservation, type PublicProviderPermit } from '../server/public-demo-permit.mts';
import { approvedVoices, PREMIUM_MODEL } from '../src/communication/cloud-contract.mts';
const env={VERCEL:'1',NODE_ENV:'production',SMV_CLOUD_MODE:'public-demo',GEMINI_API_KEY:'synthetic-gemini-key',ELEVENLABS_API_KEY:'synthetic-eleven-key',SMV_GEMINI_FREE_TIER_CONFIRMED:'true',SMV_ELEVENLABS_CREDITS_CONFIRMED:'true'};
const signal=new AbortController().signal;
const wording={id:'public-wording:1',text:'Please stop.',context:'',kind:'wording_alternative',synthetic:true} as const;
const speech={id:'public-speech:1',text:'Please stop.',revision:1,voice:approvedVoices[0].id,rate:1,provider:'elevenlabs',preview:false};
const recording={id:'public-recording:1',audioBase64:Buffer.from('ID3fictional-unit-fixture').toString('base64'),mimeType:'audio/mpeg',durationMs:1000,synthetic:true,recordingConsent:true};
const permit=(provider:PublicProviderPermit['provider'],requestId:string,units:number)=>registerPublicReservation(Object.freeze({provider,requestId,units,deadlineAt:Date.now()+15_000}));
test('public-mode environment flags alone cannot make Gemini, ElevenLabs metadata, speech or Scribe calls',async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;throw Error('No provider operation authorized');};
 await assert.rejects(createGemini(env,async()=>{calls++;return'';}).suggest(wording,signal),/PUBLIC_RESERVATION_REQUIRED/);
 await assert.rejects(createElevenLabs(env,fetcher).listVoices(signal),/PUBLIC_RESERVATION_REQUIRED/);
 await assert.rejects(createElevenLabs(env,fetcher).synthesize(speech,signal));
 await assert.rejects(createScribe(env,fetcher).transcribe(recording,signal),/PUBLIC_RESERVATION_REQUIRED/);
 assert.equal(calls,0);
});
test('Gemini requires an issued matching receipt and cannot reuse it across provider instances',async()=>{
 let calls=0;const generate=async()=>{calls++;return JSON.stringify({suggestions:[{text:wording.text,kind:wording.kind}]});};
 const grant=permit('gemini',wording.id,1);
 await assert.rejects(createGemini(env,generate,{...grant}).suggest(wording,signal),/PUBLIC_RESERVATION_REQUIRED/);
 await assert.rejects(createGemini(env,generate,grant).suggest({...wording,id:'different-public:1'},signal),/PUBLIC_RESERVATION_REQUIRED/);
 assert.deepEqual(await createGemini(env,generate,grant).suggest(wording,signal),[{text:wording.text,kind:wording.kind}]);
 await assert.rejects(createGemini(env,generate,grant).suggest(wording,signal),/PUBLIC_RESERVATION_REQUIRED/);assert.equal(calls,1);
});
test('account protections and actual Vercel runtime remain mandatory even with a genuine reservation',async()=>{
 for(const override of [{VERCEL:'0'},{SMV_GEMINI_FREE_TIER_CONFIRMED:'false'},{GOOGLE_GENAI_USE_VERTEXAI:'true'},{GEMINI_API_KEY:''}]){
  let calls=0;await assert.rejects(createGemini({...env,...override},async()=>{calls++;return'';},permit('gemini',wording.id,1)).suggest(wording,signal),/GEMINI_DISABLED/);assert.equal(calls,0);
 }
});
function voiceFetcher(sent:{url:string;body?:string}[]):typeof fetch{return async(url,init)=>{sent.push({url:String(url),body:typeof init?.body==='string'?init.body:undefined});if(String(url).includes('/v2/voices'))return Response.json({voices:approvedVoices.map(v=>({voice_id:v.id,name:v.apiName,fine_tuning:{state:{[PREMIUM_MODEL]:'fine_tuned',eleven_flash_v2:'fine_tuned'}},sharing:{rate:1}}))});return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'audio/mpeg'}});};}
test('ElevenLabs receipt allows one voice verification plus exactly its reserved utterance length',async()=>{
 const sent:{url:string;body?:string}[]=[],grant=permit('speech',speech.id,speech.text.length),provider=createElevenLabs(env,voiceFetcher(sent),grant);
 await provider.listVoices(signal);
 await assert.rejects(provider.synthesize({...speech,text:'A longer unreserved sentence.'},signal),/PUBLIC_RESERVATION_REQUIRED/);
 await provider.synthesize(speech,signal);assert.equal(sent.filter(r=>r.body).length,1);assert.equal(JSON.parse(sent.at(-1)!.body!).text,speech.text);
 await assert.rejects(createElevenLabs(env,voiceFetcher(sent),grant).listVoices(signal),/PUBLIC_RESERVATION_REQUIRED/);
 assert.equal(sent.filter(r=>r.body).length,1);
});
test('metadata-only receipt cannot synthesize speech',async()=>{
 const sent:{url:string;body?:string}[]=[],provider=createElevenLabs(env,voiceFetcher(sent),permit('metadata',speech.id,1));await provider.listVoices(signal);
 await assert.rejects(provider.synthesize(speech,signal),/PUBLIC_RESERVATION_REQUIRED/);assert.equal(sent.filter(r=>r.body).length,0);
});
test('Scribe requires the full reserved duration and cannot repeat a grant in a new instance',async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;return Response.json({text:'Fictional transcription.'});};
 await assert.rejects(createScribe(env,fetcher,permit('scribe',recording.id,1)).transcribe(recording,signal),/PUBLIC_RESERVATION_REQUIRED/);
 const grant=permit('scribe',recording.id,20_000);assert.deepEqual(await createScribe(env,fetcher,grant).transcribe(recording,signal),{text:'Fictional transcription.'});
 await assert.rejects(createScribe(env,fetcher,grant).transcribe(recording,signal),/PUBLIC_RESERVATION_REQUIRED/);assert.equal(calls,1);
});
