/** Intent-first demonstration data only; no input, navigation or speech authority. */
export const contextOptions = [
  { id: 'home', name: 'Home', description: 'Everyday needs and family' },
  { id: 'healthcare', name: 'Healthcare', description: 'Appointments and care' },
  { id: 'community', name: 'Community', description: 'Friends and social life' },
  { id: 'education_work', name: 'Education & Work', description: 'Learning and work' },
  { id: 'general', name: 'General', description: 'No specific context' },
] as const;
export type CommunicationContext = typeof contextOptions[number]['id'];
export type ExpansionRequest = Readonly<{ id: string; text: string; context: CommunicationContext; clarification: string; transcript?: string; synthetic: true }>;
export type ExpansionResult = Readonly<{
  status: 'candidate' | 'clarify' | 'insufficient_input' | 'validation_rejected';
  candidate: string; unresolvedCues: string[]; clarificationQuestion: string; clarificationChoices: string[];
}>;

/** Strict shared wire check, including status-specific client invariants. */
export function isExpansionResult(value: unknown): value is ExpansionResult {
  if(!value || typeof value!=='object' || Array.isArray(value))return false;
  const r=value as Record<string,unknown>;
  const clean=(x:unknown,max:number):x is string=>typeof x==='string'&&x.length<=max&&!/[\u0000-\u001f\u007f]/.test(x);
  if(Object.keys(r).sort().join(',')!=='candidate,clarificationChoices,clarificationQuestion,status,unresolvedCues'
    ||!['candidate','clarify','insufficient_input','validation_rejected'].includes(String(r.status))
    ||!clean(r.candidate,360)||!clean(r.clarificationQuestion,120)
    ||!Array.isArray(r.unresolvedCues)||r.unresolvedCues.length>4||!r.unresolvedCues.every(x=>clean(x,60)&&x.trim())
    ||!Array.isArray(r.clarificationChoices)||r.clarificationChoices.length>4||!r.clarificationChoices.every(x=>clean(x,360)&&x.trim()))return false;
  if(r.status==='candidate')return !!r.candidate.trim()&&!r.unresolvedCues.length&&!r.clarificationQuestion&&!r.clarificationChoices.length;
  if(r.candidate)return false;
  if(r.status==='clarify')return !!r.clarificationQuestion.trim()&&r.clarificationChoices.includes('Keep my words')&&r.clarificationChoices.length>=2&&new Set(r.clarificationChoices).size===r.clarificationChoices.length;
  return !r.clarificationQuestion&&!r.clarificationChoices.length;
}
