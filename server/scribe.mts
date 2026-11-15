import { providerModeConfigured, consumeProviderPermit, type PublicProviderPermit } from './public-demo-permit.mts';
/** Server-only, bounded fictional recording transcription. Audio stays in memory. */
import { boundedBody, ProviderError } from './elevenlabs.mts';
export const SCRIBE_MODEL='scribe_v3';
export const MAX_AUDIO_BYTES=1_048_576;
export type TranscriptionRequest={id:string;audioBase64:string;mimeType:string;durationMs:number;synthetic:true;recordingConsent:true};
const extensions:Record<string,string>={'audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'m4a','audio/wav':'wav','audio/mpeg':'mp3'};
export function validateRecording(value:unknown):{request:TranscriptionRequest;audio:Uint8Array;mime:string;extension:string}{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ProviderError('INVALID_RECORDING',422);
  const r=value as Record<string,unknown>;
  if(Object.keys(r).sort().join(',')!=='audioBase64,durationMs,id,mimeType,recordingConsent,synthetic'||r.synthetic!==true||r.recordingConsent!==true
    ||typeof r.id!=='string'||!/^[A-Za-z0-9:-]{8,160}$/.test(r.id)||typeof r.mimeType!=='string'||r.mimeType.length>100
    ||!Number.isInteger(r.durationMs)||Number(r.durationMs)<1||Number(r.durationMs)>20_000
    ||typeof r.audioBase64!=='string'||!r.audioBase64.length||r.audioBase64.length>1_398_104||r.audioBase64.length%4!==0
    ||!/^[A-Za-z0-9+/]+={0,2}$/.test(r.audioBase64))throw new ProviderError('INVALID_RECORDING',422);
  const mime=r.mimeType.split(';',1)[0].trim().toLowerCase();if(!extensions[mime])throw new ProviderError('UNSUPPORTED_AUDIO',415);
  const audio=Buffer.from(r.audioBase64,'base64');if(!audio.length||audio.length>MAX_AUDIO_BYTES||audio.toString('base64')!==r.audioBase64)throw new ProviderError('INVALID_RECORDING',422);
  const tag=(start:number,end:number)=>audio.subarray(start,end).toString('ascii');
  const valid=mime==='audio/webm'?audio.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))
    :mime==='audio/ogg'?tag(0,4)==='OggS':mime==='audio/mp4'?tag(4,8)==='ftyp'
    :mime==='audio/wav'?tag(0,4)==='RIFF'&&tag(8,12)==='WAVE'
    :tag(0,3)==='ID3'||(audio[0]===0xff&&(audio[1]&0xe0)===0xe0);
  if(!valid)throw new ProviderError('AUDIO_FORMAT_MISMATCH',422);
  return{request:r as TranscriptionRequest,audio:new Uint8Array(audio),mime,extension:extensions[mime]};
}
export function createScribe(env:Record<string,string|undefined>,fetcher:typeof fetch=fetch,publicPermit?:PublicProviderPermit){
  const key=env.ELEVENLABS_API_KEY;
  const enabled=Boolean(providerModeConfigured(env)&&env.SMV_ELEVENLABS_CREDITS_CONFIRMED==='true'&&key&&key.length>=12&&!/\s/.test(key));
  let busy=false,recordedMs=0;const consumed=new Set<string>();
  return{
    status:()=>({available:enabled,model:SCRIBE_MODEL,requests:consumed.size,recordedMs,sessionDurationLimitMs:120_000,sessionRequestLimit:10}),
    async transcribe(value:unknown,signal:AbortSignal):Promise<{text:string}>{
      if(!enabled)throw new ProviderError('SCRIBE_DISABLED',403);
      const{request,audio,mime,extension}=validateRecording(value);signal.throwIfAborted();
      if(busy)throw new ProviderError('TRANSCRIPTION_BUSY',409);
      if(consumed.has(request.id))throw new ProviderError('RECORDING_ALREADY_SUBMITTED',409);
      if(consumed.size>=10||recordedMs+request.durationMs>120_000)throw new ProviderError('TRANSCRIPTION_LIMIT',429);
      if(!consumeProviderPermit(env,publicPermit,'scribe',{id:request.id,units:20_000}))throw new ProviderError('PUBLIC_RESERVATION_REQUIRED',403);
      consumed.add(request.id);recordedMs+=request.durationMs;busy=true;
      const bounded=AbortSignal.any([signal,AbortSignal.timeout(12_000)]);
      try{
        const body=new FormData();body.set('model_id',SCRIBE_MODEL);body.set('diarize','false');body.set('tag_audio_events','false');
        body.set('file',new Blob([new Uint8Array(audio)],{type:mime}),`fictional-recording.${extension}`);
        const response=await fetcher('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':key!},body,signal:bounded,redirect:'error'});
        if(!response.ok){await response.body?.cancel();throw new ProviderError(response.status===429?'SCRIBE_QUOTA':'SCRIBE_UNAVAILABLE',response.status===429?429:503);}
        const bytes=await boundedBody(response,65_536,bounded);bounded.throwIfAborted();
        const result=JSON.parse(new TextDecoder().decode(bytes));
        if(!result||typeof result.text!=='string'||!result.text.trim()||result.text.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result.text))throw new ProviderError('INVALID_TRANSCRIPT',502);
        return{text:result.text};
      }catch(error){if(error instanceof ProviderError)throw error;throw new ProviderError(bounded.aborted?'SCRIBE_CANCELLED_OR_TIMEOUT':'SCRIBE_UNAVAILABLE');}
      finally{busy=false;}
    },
  };
}
