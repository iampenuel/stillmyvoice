import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeProviderPermit, consumePublicReservation, registerPublicReservation, retirePublicReservation } from '../server/public-demo-permit.mts';
const usage={id:'fixture-request:1',units:1};
const env={SMV_CLOUD_MODE:'public-demo',VERCEL:'1',NODE_ENV:'production'};
test('public configuration and forged serialized receipt cannot authorize provider execution',()=>{
 assert.equal(consumeProviderPermit(env,undefined,'gemini',usage),false);
 assert.equal(consumeProviderPermit(env,{provider:'gemini',deadlineAt:Date.now()+15_000,requestId:usage.id,units:usage.units},'gemini',usage),false);
});
test('only the issued object grants one bounded matching provider operation',()=>{
 const permit=registerPublicReservation(Object.freeze({provider:'gemini' as const,deadlineAt:Date.now()+15_000,requestId:usage.id,units:usage.units}));
 assert.equal(consumeProviderPermit(env,{...permit},'gemini',usage),false);
 assert.equal(consumeProviderPermit(env,permit,'speech',usage),false);
 assert.equal(consumeProviderPermit(env,permit,'gemini',{...usage,units:2}),false);
 assert.equal(consumeProviderPermit(env,permit,'gemini',{...usage,id:'different-request:1'}),false);
 assert.equal(consumeProviderPermit(env,permit,'gemini',usage),true);
 assert.equal(consumeProviderPermit(env,permit,'gemini',usage),false);
});
test('speech reservation permits one verified metadata discovery and one synthesis, never another provider',()=>{
 const permit=registerPublicReservation(Object.freeze({provider:'speech' as const,deadlineAt:Date.now()+15_000,requestId:usage.id,units:usage.units}));
 assert.equal(consumePublicReservation(permit,'metadata',usage),true);assert.equal(consumePublicReservation(permit,'metadata',usage),false);
 assert.equal(consumePublicReservation(permit,'speech',usage),true);assert.equal(consumePublicReservation(permit,'scribe',usage),false);
});
test('release retires the local permit, and local non-production calls preserve their original mode gate',()=>{
 const permit=registerPublicReservation(Object.freeze({provider:'scribe' as const,deadlineAt:Date.now()+15_000,requestId:usage.id,units:usage.units}));retirePublicReservation(permit);assert.equal(consumePublicReservation(permit,'scribe',usage),false);
 assert.equal(consumeProviderPermit({SMV_CLOUD_MODE:'local-synthetic-demo'},undefined,'gemini',usage),true);
 assert.equal(consumeProviderPermit({SMV_CLOUD_MODE:'local-synthetic-demo',NODE_ENV:'production'},undefined,'gemini',usage),false);
 assert.equal(consumeProviderPermit({SMV_CLOUD_MODE:'public-demo'},undefined,'gemini',usage),false);
});
