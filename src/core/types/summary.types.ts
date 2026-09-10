export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IActionItem {
  task: string;
  assignee?: string;
  dueDate?: string;
}

export interface IChatSummary {
  chatId: string;
  chatName: string;
  isGroup: boolean;
  totalMessagesAnalyzed: number;
  unreadCount: number;
  timeRange: {
    start?: string;
    end?: string;
  };
  unreadTimeRange?: {
    start?: string;
    end?: string;
  };
  previousContextCount?: number;
  tldr: string;
  keyTopics: string[];
  actionItems: IActionItem[];
  decisions: string[];
  importantLinksAndDates: string[];
  urgencyLevel: UrgencyLevel;
  rawSummaryMarkdown: string;
  generatedAt: string;
}

export interface IChatInfo {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessageTimestamp?: number;
  participantCount?: number;
}

export interface IChatMessage {
  id: string;
  senderName: string;
  senderNumber?: string;
  timestamp: Date;
  body: string;
  isQuoted: boolean;
  quotedMessage?: {
    senderName: string;
    body: string;
  };
  hasMedia: boolean;
  mediaType?: string;
  isUnread?: boolean;
}
