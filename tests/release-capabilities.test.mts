// SPDX-License-Identifier: AGPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { releaseCapabilities, FRONTEND_CLOUD_UNAVAILABLE, requireCloudServices } from '../src/release-capabilities.mts';
import { initialCloud } from '../src/communication/cloud-contract.mts';
import { initialModel, choose, choices, presented, listeningEvent, type Model } from '../src/communication/model.mts';
import { browserRecording } from '../src/communication/recording.mts';
import { premiumSpeechEngine } from '../src/communication/premium-speech.mts';
const step=(model:Model,id:string)=>choose(model,id,model.uiRevision);
function frontend() {
 const model=step(initialModel('frontend-fixture',false),'context-set:general');
 model.draft='Please stop.';
 // Retained service/consent values cannot override the release capability.
 model.cloud.consent=true;model.cloud.gemini=true;model.cloud.elevenlabs=true;
 model.cloud.voices=model.cloud.voices.map(voice=>({...voice,available:true}));
 return model;
}
test('only the explicit frontend-demo mode disables cloud services; local defaults remain unchanged',()=>{
 assert.deepEqual(releaseCapabilities('frontend-demo'),{frontendDemo:true,cloudServices:false});
 for(const mode of [undefined,'','development','production']) assert.equal(releaseCapabilities(mode).cloudServices,true);
 assert.equal(initialCloud().backendEnabled,true);assert.equal(initialCloud().consent,false);
 assert.equal(initialCloud(false).elevenReason,FRONTEND_CLOUD_UNAVAILABLE);
 assert.throws(()=>requireCloudServices(false),/Unavailable in this frontend demo/);
});
test('frontend capability blocks Listening, expansion and suggestions despite retained ready/consent state',()=>{
 let model=frontend();
 for(const action of ['listen','expand']) {assert.equal(choices(model).find(choice=>choice.id===action)?.disabled,true);assert.equal(step(model,action),model);}
 model=step(model,'more');assert.equal(choices(model).find(choice=>choice.id==='assist')?.disabled,true);
 model.screen={name:'listening'};model.listen.phase='ready';assert.equal(step(model,'listen-start'),model);assert.equal(model.listen.session,null);
 model.screen={name:'assist'};assert.equal(step(model,'assist-spelling'),model);assert.equal(model.assistance.request,null);
});
test('retained ElevenLabs selection cannot authorize speech; browser speech still needs exact visible review',()=>{
 let model=frontend();model.settings.provider='elevenlabs';model.settings.voice=model.cloud.voices[0].id;
 model.voices=[{id:'browser-fixture',name:'Browser fixture',lang:'en-US',local:false}];
 model=step(model,'review');model=presented(model,model.revision,0);
 assert.equal(step(model,'speak'),model);assert.equal(model.authorization,null);
 model=step(model,'fallback');assert.equal(model.settings.provider,'browser');assert.equal(model.authorization,null);
 assert.equal(step(model,'speak'),model);model=presented(model,model.revision,0);model=step(model,'speak');
 assert.equal(model.authorization?.provider,'browser');assert.equal(model.authorization?.text,'Please stop.');
});
test('disabled premium engine never requests audio, creates a player or silently falls back',async()=>{
 let requests=0,players=0;const events:string[]=[];
 const engine=premiumSpeechEngine({request:async()=>{requests++;return new Blob(['unused']);},player:()=>{players++;throw Error('Must not construct');},url:()=>'',revoke:()=>{}},false);
 engine.speak({id:'retained:1',text:'Please stop.',revision:1,voice:'retained-voice',rate:1,provider:'elevenlabs',preview:false},event=>events.push(event));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests,0);assert.equal(players,0);assert.deepEqual(events,['error']);
});
test('disabled browser recording rejects before microphone acquisition',async()=>{
 const recorder=browserRecording(()=>assert.fail('No recorder event should occur'),false);
 await assert.rejects(recorder.start(),/Unavailable in this frontend demo/);recorder.cancel();
});
/** Run actual effect bodies with injected browser/React boundaries; no browser, mic or provider. */
function runtime(name:'CloudRuntime'|'ListeningRuntime',model:Model) {
 const cleanups:(()=>void)[]=[];let fetches=0,recorders=0;
 const current={current:model};
 const context={
  useEffect:(effect:()=>void|(()=>void))=>{const cleanup=effect();if(cleanup)cleanups.push(cleanup);},
  document:{hasFocus:()=>true,visibilityState:'visible'},AbortController,AbortSignal,
  cloudServicesEnabled:()=>false,requireCloudServices:()=>requireCloudServices(false),initialCloud,FRONTEND_CLOUD_UNAVAILABLE,
  listeningEvent,browserRecording:()=>{recorders++;throw Error('Must not construct recorder');},
  setInterval:()=>0,clearInterval:()=>{},fetch:async()=>{fetches++;throw Error('Must not fetch');},
  props:{model,current,commit:(next:Model)=>{current.current=next;},canUpdate:()=>true},
 };
 const source=readFileSync(new URL('../src/communication/'+name+'.tsx',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/^export /gm,'');
 runInNewContext(stripTypeScriptTypes(source,{mode:'strip'})+'\n'+name+'(props);',context);
 return {current,counts:()=>({fetches,recorders}),cleanup:()=>cleanups.forEach(cleanup=>cleanup())};
}
test('frontend CloudRuntime skips status, voices and retained suggestion/expansion requests',async()=>{
 const model=frontend();model.cloud.backendEnabled=true; // Simulate stale local build state; immutable runtime gate still wins.
 model.assistance.request={id:'retained-assist',text:model.draft,context:'',kind:'spelling_correction',synthetic:true};
 model.expansion.request={id:'retained-expansion',text:model.draft,context:'general',clarification:'',transcript:'',synthetic:true};
 const instance=runtime('CloudRuntime',model);await Promise.resolve();
 assert.deepEqual(instance.counts(),{fetches:0,recorders:0});
 assert.equal(instance.current.current.cloud.elevenlabs,false);assert.equal(instance.current.current.cloud.gemini,false);
 assert.equal(instance.current.current.cloud.consent,false);assert.equal(instance.current.current.cloud.geminiReason,FRONTEND_CLOUD_UNAVAILABLE);
 instance.cleanup();
});
test('frontend ListeningRuntime retires a retained recording request before constructing a recorder',()=>{
 const model=frontend();model.screen={name:'listening'};model.listen.phase='requesting';model.listen.session='retained-recording';
 const instance=runtime('ListeningRuntime',model);
 assert.deepEqual(instance.counts(),{fetches:0,recorders:0});assert.equal(instance.current.current.listen.phase,'error');
 assert.equal(instance.current.current.listen.session,null);assert.equal(instance.current.current.listen.error,FRONTEND_CLOUD_UNAVAILABLE);
 instance.cleanup();
});
