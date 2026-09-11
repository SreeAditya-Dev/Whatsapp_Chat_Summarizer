import { IChatMessage, IChatSummary } from '../types/summary.types';

export interface SummarizeOptions {
  chatId: string;
  chatName: string;
  isGroup: boolean;
  unreadCount?: number;
  mode?: 'compact' | 'brief' | 'detailed';
  model?: string;
  maxTokens?: number;
}

export interface GenerateReplyOptions {
  chatId: string;
  chatName: string;
  isGroup: boolean;
  messages: IChatMessage[];
  instruction?: string;
  tone?: 'casual' | 'friendly' | 'professional' | 'concise';
  senderPersona?: string;
  model?: string;
}

export interface ISummarizer {
  summarize(messages: IChatMessage[], options: SummarizeOptions): Promise<IChatSummary>;
  generateReply?(options: GenerateReplyOptions): Promise<{ reply: string; suggestions: string[] }>;
}
