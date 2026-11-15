import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicDemoHandler, boundedPublicJson, type PublicProviders } from '../server/public-demo-http.mts';
import { createPublicDemoSecurity, type PublicBudgetStatus } from '../server/public-demo-security.mts';
import { ProviderError, createElevenLabs } from '../server/elevenlabs.mts';
import { createGemini } from '../server/gemini.mts';
import { createScribe } from '../server/scribe.mts';
import { approvedVoices } from '../src/communication/cloud-contract.mts';
const origin='https://stillmyvoice.vercel.app';
const env={SMV_CLOUD_MODE:'public-demo',VERCEL:'1',NODE_ENV:'production'};
const auth={id:'speech-fixture:1',text:'Please stop.',revision:2,voice:approvedVoices[0].id,rate:1,provider:'elevenlabs',preview:false};
const expansion={id:'expansion-fixture:1',text:'belly hurts today',context:'general',clarification:'',transcript:'',synthetic:true};
const session={id:'a'.repeat(32),clientKey:'b'.repeat(64),expiresAt:Date.now()+60_000};
const request=(path:string,body?:unknown,options:{cookie?:boolean;method?:string;origin?:string;signal?:AbortSignal}={})=>new Request(origin+path,{method:options.method??(body===undefined?'GET':'POST'),headers:{origin:options.origin??origin,'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.10',...(options.cookie===false?{}:{cookie:'fixture-cookie'})},body:body===undefined?undefined:JSON.stringify(body),signal:options.signal});
const budget:PublicBudgetStatus={namespace:'test-budget',scope:'shared-public-demo',gemini:{requests:17,requestLimit:300,units:17,unitLimit:300},speech:{requests:3,requestLimit:100,units:41,unitLimit:10_000},scribe:{requests:1,requestLimit:6,units:20_000,unitLimit:120_000},metadata:{requests:2,requestLimit:100,units:2,unitLimit:100}};
function fixture(options:{configured?:boolean;reserveError?:Error;providerError?:Error;active?:boolean}={}) {
 const calls:string[]=[],reservations:unknown[]=[],received:unknown[]=[],used=new Set<string>();
 let factories=0;
 const security:ReturnType<typeof createPublicDemoSecurity>={
  configured:options.configured??true,clientKey:()=>session.clientKey,authenticateCookie:(cookie)=>cookie==='fixture-cookie'?session:null,
  authorize:async(code)=>{calls.push('authorize');if(code!=='fictional-access')throw new ProviderError('DEMO_ACCESS_DENIED',401);return{session,cookie:'__Host-smv-demo=fixture; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=7200'};},
  sessionActive:async()=>{calls.push('sessionActive');return options.active??true;},revoke:async()=>{calls.push('revoke');},
  reserve:async(input)=>{calls.push('reserve:'+input.provider);if(options.reserveError)throw options.reserveError;if(used.has(input.id))throw new ProviderError('DEMO_REQUEST_ALREADY_CONSUMED',409);used.add(input.id);reservations.push(input);return{token:'c'.repeat(32),provider:input.provider,sessionId:session.id,deadlineAt:Date.now()+15_000,requestId:input.id,units:input.units??1};},
  release:async()=>{calls.push('release');},status:async()=>{calls.push('budgetStatus');return budget;},clearCookie:()=> '__Host-smv-demo=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
 };
 const providers=()=>{factories++;return{
  eleven:{status:()=>({available:true,metadataAvailable:true,reason:'Ready',model:'fixture',charactersSubmitted:999,sessionCharacterLimit:999,voicesVerified:6,modelVerified:true}),listVoices:async()=>{calls.push('voices');return[];},synthesize:async(value:unknown)=>{calls.push('speech');received.push(value);if(options.providerError)throw options.providerError;return new Uint8Array([1,2,3]);}},
  gemini:{status:()=>({available:true,reason:'Ready',model:'fixture',requests:999,sessionLimit:999}),expand:async(value:unknown)=>{calls.push('expansion');received.push(value);if(options.providerError)throw options.providerError;return{status:'candidate',candidate:'My belly hurts today.'};},suggest:async(value:unknown)=>{calls.push('suggestions');received.push(value);return[];}},
  scribe:{status:()=>({available:true,model:'fixture',requests:999,recordedMs:999,sessionDurationLimitMs:999,sessionRequestLimit:999}),transcribe:async(value:unknown)=>{calls.push('scribe');received.push(value);return{text:'How are you feeling today?'};}},
 } as unknown as PublicProviders;};
 return{handler:createPublicDemoHandler(env,{security,providers}),security,providers,calls,reservations,received,factories:()=>factories};
}
test('unconfigured demo reports locked status without requiring storage or making provider requests',async()=>{
 const handler=createPublicDemoHandler({});
 assert.deepEqual(await(await handler(request('/api/demo-access',undefined,{cookie:false}))).json(),{configured:false,authorized:false});
 const status=await(await handler(request('/api/status',undefined,{cookie:false}))).json();assert.equal(status.gemini.available,false);assert.equal(status.elevenlabs.metadataAvailable,false);
 assert.equal((await handler(request('/api/expansion',expansion,{cookie:false}))).status,503);
});
test('every provider route requires authorization before factories, body processing or provider work',async()=>{
 const f=fixture();for(const path of ['voices','speech','transcription','expansion','suggestions'])assert.equal((await f.handler(request('/api/'+path,{}, {cookie:false}))).status,401);
 const status=await(await f.handler(request('/api/status',undefined,{cookie:false}))).json();assert.equal(status.access.authorized,false);assert.equal(status.gemini.available,false);
 assert.equal(f.factories(),0);assert.deepEqual(f.calls,[]);
});
test('only the two production hosts and matching origin pass; no CORS permission is returned',async()=>{
 const f=fixture();for(const url of ['https://evil.invalid/api/expansion','http://stillmyvoice.club/api/expansion','https://unapproved-preview.vercel.app/api/expansion'])assert.equal((await f.handler(new Request(url,{method:'POST'}))).status,403);
 const response=await f.handler(request('/api/expansion',expansion,{origin:'https://evil.invalid'}));assert.equal(response.status,403);assert.equal(response.headers.get('access-control-allow-origin'),null);
 assert.equal((await f.handler(new Request(origin+'/api/expansion',{method:'POST',body:'{}'}))).status,403);
 assert.equal((await f.handler(request('/api/status?text=fictional'))).status,400);assert.equal(f.factories(),0);
});
test('access codes stay server-side and logout revokes the session before clearing the secure cookie',async()=>{
 const f=fixture();const denied=await f.handler(request('/api/demo-access',{code:'incorrect'},{cookie:false}));assert.equal(denied.status,401);
 const allowed=await f.handler(request('/api/demo-access',{code:'fictional-access'},{cookie:false}));assert.equal(allowed.status,200);assert.match(allowed.headers.get('set-cookie')!,/HttpOnly; Secure; SameSite=Strict/);assert.deepEqual(await allowed.json(),{configured:true,authorized:true,expiresAt:session.expiresAt});
 assert.equal(f.factories(),0);assert.ok(!f.calls.some(x=>x.startsWith('reserve')));
 const out=await f.handler(request('/api/demo-access',undefined,{method:'DELETE'}));assert.equal(out.status,200);assert.ok(f.calls.includes('revoke'));assert.match(out.headers.get('set-cookie')!,/Max-Age=0/);
});
test('public status reports shared counts rather than process-local allowances and fails closed on revoked access',async()=>{
 const f=fixture();const status=await(await f.handler(request('/api/status'))).json();assert.equal(status.gemini.requests,17);assert.equal(status.gemini.requestLimit,300);assert.equal(status.gemini.sessionLimit,undefined);assert.equal(status.elevenlabs.charactersSubmitted,41);assert.equal(status.scribe.reservedMs,20_000);assert.equal(status.providerQuotaRemainingKnown,false);assert.deepEqual(f.calls,['sessionActive','budgetStatus']);
 const revoked=fixture({active:false});assert.equal((await(await revoked.handler(request('/api/status'))).json()).gemini.available,false);assert.equal(revoked.factories(),0);
});
test('shared quota failure prevents every provider operation and never falls back to a process budget',async()=>{
 const f=fixture({reserveError:new ProviderError('DEMO_QUOTA_UNAVAILABLE',503)});
 const r=await f.handler(request('/api/expansion',expansion));assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'DEMO_QUOTA_UNAVAILABLE'});assert.deepEqual(f.calls,['reserve:gemini']);
});
test('one durable reservation precedes Gemini; repeated authorization cannot cross a fresh handler',async()=>{
 const f=fixture();assert.equal((await f.handler(request('/api/expansion',expansion))).status,200);
 const next=createPublicDemoHandler(env,{security:f.security,providers:f.providers});assert.equal((await next(request('/api/expansion',expansion))).status,409);
 assert.deepEqual(f.calls,['reserve:gemini','expansion','release','reserve:gemini']);assert.deepEqual(f.received,[expansion]);
});
test('voice metadata requires explicit consent; synthesis verifies voice availability after reservation and sends exact text once',async()=>{
 const f=fixture();assert.equal((await f.handler(request('/api/voices',{}))).status,422);assert.deepEqual(f.calls,[]);
 assert.equal((await f.handler(request('/api/voices',{cloudConsent:true}))).status,200);assert.deepEqual(f.calls,['reserve:metadata','voices','release']);
 f.calls.length=0;const response=await f.handler(request('/api/speech',{cloudConsent:true,authorization:auth}));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'audio/mpeg');assert.deepEqual(f.calls,['reserve:speech','voices','speech','release']);assert.deepEqual(f.received,[auth]);assert.equal((f.reservations.at(-1) as {units:number}).units,auth.text.length);
});
test('malformed speech approval never reserves credit and provider failures do not retry or replay',async()=>{
 const f=fixture({providerError:new ProviderError('ELEVENLABS_QUOTA',429)});
 for(const authorization of [{...auth,voice:'unapproved-voice'},{...auth,preview:true},{...auth,text:'x'.repeat(4097)},{...auth,extra:true}])assert.equal((await f.handler(request('/api/speech',{cloudConsent:true,authorization}))).status,422);
 assert.deepEqual(f.calls,[]);assert.equal((await f.handler(request('/api/speech',{cloudConsent:true,authorization:auth}))).status,429);assert.deepEqual(f.calls,['reserve:speech','voices','speech']);assert.equal((await f.handler(request('/api/speech',{cloudConsent:true,authorization:auth}))).status,409);
});
function wav(){const data=Buffer.alloc(44+3200);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(16000,24);data.writeUInt32LE(32000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(3200,40);return data.toString('base64');}
test('public Listening requires consent and proven PCM duration before reserving its conservative audio ceiling',async()=>{
 const f=fixture();const recording={id:'recording-fixture:1',audioBase64:wav(),mimeType:'audio/wav',durationMs:1,synthetic:true,recordingConsent:true};
 assert.equal((await f.handler(request('/api/transcription',{...recording,recordingConsent:false}))).status,422);assert.deepEqual(f.calls,[]);
 assert.equal((await f.handler(request('/api/transcription',recording))).status,200);assert.deepEqual(f.calls,['reserve:scribe','scribe','release']);assert.equal((f.reservations[0] as {units:number}).units,20000);assert.equal((f.received[0] as {durationMs:number}).durationMs,100);
});
test('streamed JSON bounds ignore false lengths, reject compressed/non-JSON bodies, and stop on cancellation',async()=>{
 const signal=new AbortController().signal;
 await assert.rejects(boundedPublicJson(new Request(origin,{method:'POST',headers:{'content-type':'application/json','content-length':'1'},body:JSON.stringify({text:'x'.repeat(100)})}),32,signal),/REQUEST_TOO_LARGE/);
 await assert.rejects(boundedPublicJson(new Request(origin,{method:'POST',body:'{}'}),32,signal),/JSON_REQUIRED/);
 await assert.rejects(boundedPublicJson(new Request(origin,{method:'POST',headers:{'content-type':'application/json','content-encoding':'gzip'},body:'{}'}),32,signal),/CONTENT_ENCODING_NOT_ALLOWED/);
 const f=fixture(),controller=new AbortController();controller.abort();assert.equal((await f.handler(request('/api/expansion',expansion,{signal:controller.signal}))).status,503);assert.deepEqual(f.calls,[]);
});
test('untyped failures never expose private provider error text',async()=>{
 const f=fixture({providerError:Error('fixture PRIVATE message or provider key')});const response=await f.handler(request('/api/expansion',expansion));assert.deepEqual(await response.json(),{error:'REQUEST_CANCELLED_OR_UNAVAILABLE'});assert.deepEqual(f.calls,['reserve:gemini','expansion']);
});

test('real cookie verification and issued quota receipts reach the existing provider adapters through HTTP',async()=>{
 const settings={...env,SMV_DEMO_ACCESS_CODE:'synthetic-access-code',SMV_DEMO_SESSION_SECRET:'synthetic-session-secret-of-at-least32characters',UPSTASH_REDIS_REST_URL:'https://synthetic-test.upstash.io',UPSTASH_REDIS_REST_TOKEN:'synthetic-redis-token',GEMINI_API_KEY:'synthetic-gemini-key',ELEVENLABS_API_KEY:'synthetic-eleven-key',SMV_GEMINI_FREE_TIER_CONFIRMED:'true',SMV_ELEVENLABS_CREDITS_CONFIRMED:'true'};
 let redisCalls=0,wordingCalls=0,speechCalls=0,recordingCalls=0;
 const security=createPublicDemoSecurity(settings,{fetcher:async()=>{redisCalls++;return Response.json({result:['OK']});}});
 const handler=createPublicDemoHandler(settings,{security,providers:permit=>({
  gemini:createGemini(settings,async()=>{wordingCalls++;return JSON.stringify({suggestions:[{text:'Please stop.',kind:'wording_alternative'}]});},permit),
  eleven:createElevenLabs(settings,async(url,init)=>{if(String(url).includes('/v2/voices'))return Response.json({voices:approvedVoices.map(v=>({voice_id:v.id,name:v.apiName,fine_tuning:{state:{eleven_flash_v2_5:'fine_tuned',eleven_flash_v2:'fine_tuned'}},sharing:{rate:1}}))});speechCalls++;assert.equal(JSON.parse(String(init?.body)).text,auth.text);return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'audio/mpeg'}});},permit),
  scribe:createScribe(settings,async()=>{recordingCalls++;return Response.json({text:'How are you feeling today?'});},permit),
 })});
 const login=await handler(request('/api/demo-access',{code:settings.SMV_DEMO_ACCESS_CODE},{cookie:false}));assert.equal(login.status,200);assert.equal(wordingCalls+speechCalls+recordingCalls,0);
 const cookie=login.headers.get('set-cookie')!.split(';',1)[0];
 const send=(path:string,body:unknown)=>handler(new Request(origin+path,{method:'POST',headers:{origin,'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.10',cookie},body:JSON.stringify(body)}));
 assert.equal((await send('/api/suggestions',{id:'through-http:1',text:'Please stop.',context:'',kind:'wording_alternative',synthetic:true})).status,200);
 assert.equal((await send('/api/speech',{cloudConsent:true,authorization:auth})).status,200);
 assert.equal((await send('/api/transcription',{id:'through-http:3',audioBase64:wav(),mimeType:'audio/wav',durationMs:1,synthetic:true,recordingConsent:true})).status,200);
 assert.equal(wordingCalls,1);assert.equal(speechCalls,1);assert.equal(recordingCalls,1);assert.equal(redisCalls,7);
});

test('Vercel catch-all routing accepts only its exact path-derived parameter', async () => {
 const handler=createPublicDemoHandler({});
 for (const suffix of ['','?route=demo-access']) assert.equal((await handler(new Request(origin+'/api/demo-access'+suffix))).status,200);
 for (const suffix of ['?route=speech','?route=demo-access&route=demo-access','?text=private','?route=demo-access&text=private']) assert.equal((await handler(new Request(origin+'/api/demo-access'+suffix))).status,400);
});
