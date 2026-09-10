import { IChatMessage, IChatSummary } from '../types/summary.types';

export interface SummarizeOptions {
  chatId: string;
  chatName: string;
  isGroup: boolean;
  model?: string;
  maxTokens?: number;
}

export interface ISummarizer {
  summarize(messages: IChatMessage[], options: SummarizeOptions): Promise<IChatSummary>;
}
