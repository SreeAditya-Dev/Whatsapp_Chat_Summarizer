export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ActionItem {
  task: string;
  assignee?: string;
  dueDate?: string;
  [key: string]: unknown;
}

export type SummaryItem = string | Record<string, unknown>;

export interface ChatSummary {
  chatId: string;
  chatName: string;
  isGroup: boolean;
  totalMessagesAnalyzed: number;
  unreadCount: number;
  timeRange: { start?: string; end?: string };
  unreadTimeRange?: { start?: string; end?: string };
  previousContextCount?: number;
  tldr: string;
  keyTopics: SummaryItem[];
  actionItems: (ActionItem | string)[];
  decisions: SummaryItem[];
  importantLinksAndDates: SummaryItem[];
  urgencyLevel: UrgencyLevel;
  rawSummaryMarkdown: string;
  generatedAt: string;
}

export interface ChatInfo {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessageTimestamp?: number;
  participantCount?: number;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderNumber?: string;
  timestamp: string;
  body: string;
  isQuoted: boolean;
  quotedMessage?: { senderName: string; body: string };
  hasMedia: boolean;
  mediaType?: string;
  isUnread?: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  pagination?: PaginationMeta;
  error?: { code: string; message: string; details?: unknown };
  timestamp: string;
}

export type WhatsAppState = 'DISCONNECTED' | 'QR_READY' | 'READY' | 'AUTHENTICATED' | 'INITIALIZING' | string;

export interface WhatsAppStatus {
  state: WhatsAppState;
  pushname?: string | null;
  phoneNumber?: string | null;
  qrCodeRaw?: string | null;
  qrCodeDataUrl?: string | null;
  connectedAt?: string | null;
}

export interface HealthData {
  status: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  services: {
    whatsapp: { state: string; connected: boolean; account: string | null };
    ai: { provider: string; model: string };
  };
  memoryUsageMb: number;
}

export type ChatFilter = 'all' | 'groups' | 'direct' | 'unread';
