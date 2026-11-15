import test from 'node:test';import assert from 'node:assert/strict';import{createServer,request as httpRequest}from'node:http';
import{createApiHandler}from'../server/http.mts';import{createElevenLabs}from'../server/elevenlabs.mts';import{createGemini}from'../server/gemini.mts';import{createScribe}from'../server/scribe.mts';
test('only transcription accepts bounded audio-sized JSON and retains localhost consent boundaries',async()=>{
 let calls=0;const env={ELEVENLABS_API_KEY:'synthetic-recording-key',SMV_CLOUD_MODE:'local-synthetic-demo',SMV_ELEVENLABS_CREDITS_CONFIRMED:'true'};
 const server=createServer(createApiHandler(createElevenLabs({}),createGemini({},async()=>''),createScribe(env,async()=>{calls++;return Response.json({text:'Fictional question.'});})));
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const addr=server.address();assert.ok(addr&&typeof addr!=='string');
 const call=(path:string,body:string,origin='http://127.0.0.1:5173')=>new Promise<number>((resolve,reject)=>{
  const req=httpRequest({host:'127.0.0.1',port:addr.port,path,method:'POST',headers:{host:'127.0.0.1:5174',origin,'content-type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode!));});req.on('error',reject);req.end(body);
 });
 const body=JSON.stringify({id:'fictional-http-audio:1',audioBase64:Buffer.concat([Buffer.from('ID3'),Buffer.alloc(40000)]).toString('base64'),mimeType:'audio/mpeg',durationMs:1000,synthetic:true,recordingConsent:true});
 try{assert.equal(await call('/api/transcription',body,'https://untrusted.example'),403);assert.equal(await call('/api/suggestions',body),413);
  assert.equal(await call('/api/transcription',body),200);assert.equal(calls,1);assert.equal(await call('/api/transcription',JSON.stringify({audio:'x'.repeat(1500000)})),413);assert.equal(calls,1);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
