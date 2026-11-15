/** Intent-first demonstration data only; no input, navigation or speech authority. */
export const contextOptions = [
  { id: 'home', name: 'Home', description: 'Family, caregivers, everyday needs' },
  { id: 'healthcare', name: 'Healthcare', description: 'Appointments and care-related conversations' },
  { id: 'community', name: 'Community', description: 'Relationships and social participation' },
  { id: 'education_work', name: 'Education & Work', description: 'Learning, meetings and self-expression' },
  { id: 'general', name: 'General', description: 'No specific context' },
] as const;
export type CommunicationContext = typeof contextOptions[number]['id'];
export type ExpansionRequest = Readonly<{ id: string; text: string; context: CommunicationContext; clarification: string; transcript?: string; synthetic: true }>;
export type ExpansionResult = Readonly<{
  status: 'candidate' | 'clarify' | 'insufficient_input';
  candidate: string; unresolvedCues: string[]; clarificationQuestion: string; clarificationChoices: string[];
}>;
