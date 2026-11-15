import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createApiHandler } from '../server/http.mts';
import { createElevenLabs } from '../server/elevenlabs.mts';
import { createGemini } from '../server/gemini.mts';
test('expansion HTTP route applies origin checks and returns bounded data without speech work',async()=>{
  let generation=0,speech=0;
  const eleven=createElevenLabs({},async()=>{speech++;throw Error('no speech');});
  const gemini=createGemini({GEMINI_API_KEY:'synthetic-key-value',SMV_GEMINI_FREE_TIER_CONFIRMED:'true',SMV_CLOUD_MODE:'local-synthetic-demo'},async()=>{generation++;throw Error('audited ambiguity needs no generation');});
  const server=createServer(createApiHandler(eleven,gemini));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const payload=JSON.stringify({id:'fictional-http:1',text:'belly weak daily hurt',context:'healthcare',clarification:'',synthetic:true});
  const call=(origin:string)=>new Promise<{status:number;data:unknown}>((resolve,reject)=>{
    const req=httpRequest({host:'127.0.0.1',port:address.port,path:'/api/expansion',method:'POST',headers:{host:'127.0.0.1:5174',origin,'content-type':'application/json'}},res=>{
      let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode!,data:JSON.parse(body)}));res.on('error',reject);
    });req.on('error',reject);req.end(payload);
  });
  try{
    assert.equal((await call('https://untrusted.example')).status,403);
    const result=await call('http://127.0.0.1:5173');assert.equal(result.status,200);
    assert.deepEqual(result.data,{status:'clarify',candidate:'',unresolvedCues:['daily'],clarificationQuestion:'Which happens daily?',clarificationChoices:['Belly pain','Weakness','Both','Keep my words']});
    assert.equal(generation,0);assert.equal(speech,0);assert.equal(gemini.status().requests,1);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
