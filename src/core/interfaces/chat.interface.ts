import { PaginationParams, PaginatedResult } from '../types/api.types';
import { IChatInfo, IChatMessage } from '../types/summary.types';

export type ChatFilterType = 'all' | 'groups' | 'direct';

export interface ChatProviderStatus {
  state: 'DISCONNECTED' | 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATED' | 'READY' | 'AUTH_FAILURE';
  pushname?: string;
  phoneNumber?: string;
  qrCodeDataUrl?: string;
  qrCodeRaw?: string;
  lastConnectedAt?: string;
}

export interface IChatProvider {
  initialize(): Promise<void>;
  getStatus(): ChatProviderStatus;
  getUnreadChats(pagination?: PaginationParams): Promise<PaginatedResult<IChatInfo>>;
  getRecentChats(pagination?: PaginationParams, filter?: ChatFilterType): Promise<PaginatedResult<IChatInfo>>;
  getChatById(chatId: string): Promise<IChatInfo | null>;
  getChatMessages(chatId: string, limit?: number): Promise<IChatMessage[]>;
  sendMessage(chatId: string, message: string): Promise<{ messageId: string; timestamp: Date }>;
  disconnect(): Promise<void>;
}
