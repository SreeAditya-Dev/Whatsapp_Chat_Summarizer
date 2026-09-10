import { IChatMessage, IChatSummary } from '../core/types/summary.types';
import { escapeHtml } from '../utils/html-escape';

export interface FormattedTranscriptResult {
  transcript: string;
  messageCount: number;
  totalOriginalCount: number;
  unreadCount: number;
  timeRange: {
    start?: string;
    end?: string;
  };
  unreadTimeRange?: {
    start?: string;
    end?: string;
  };
  previousContextCount: number;
  participants: string[];
}

export class MessageFormatterService {
  /**
   * Format an array of chat messages into a clean, chronological transcript for LLM summarization.
   * Clearly distinguishes unread messages from previous read context.
   */
  static formatForLLM(
    messages: IChatMessage[],
    maxCharacters = 60000,
    unreadCount = 0
  ): FormattedTranscriptResult {
    // 1. Filter out empty messages
    const validMessages = messages.filter((m) => m.body && m.body.trim().length > 0);

    // 2. Sort chronologically (oldest to newest)
    validMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const totalOriginalCount = validMessages.length;
    if (totalOriginalCount === 0) {
      return {
        transcript: 'No readable text messages found.',
        messageCount: 0,
        totalOriginalCount: 0,
        unreadCount: 0,
        previousContextCount: 0,
        timeRange: {},
        participants: [],
      };
    }

    // 3. Extract participants
    const participantsSet = new Set<string>();
    validMessages.forEach((m) => {
      if (m.senderName) participantsSet.add(m.senderName);
    });

    // 4. Calculate unread boundary
    const actualUnreadCount = Math.min(Math.max(0, unreadCount), totalOriginalCount);
    const unreadStartIndex = totalOriginalCount - actualUnreadCount;
    const previousContextCount = actualUnreadCount > 0 ? unreadStartIndex : 0;

    let unreadTimeRange: { start?: string; end?: string } | undefined;
    if (actualUnreadCount > 0) {
      const firstUnread = validMessages[unreadStartIndex];
      const lastUnread = validMessages[totalOriginalCount - 1];
      unreadTimeRange = {
        start: this.formatTimestamp(firstUnread.timestamp),
        end: this.formatTimestamp(lastUnread.timestamp),
      };
    }

    // 5. Build message lines with unread distinction
    const lines: string[] = [];
    let addedUnreadDivider = false;

    for (let i = 0; i < validMessages.length; i++) {
      const msg = validMessages[i];
      const isUnread = actualUnreadCount > 0 && i >= unreadStartIndex;

      if (actualUnreadCount > 0 && i === unreadStartIndex && !addedUnreadDivider) {
        if (i > 0) {
          lines.push(`\n=== NEW UNREAD MESSAGES (${actualUnreadCount} UNREAD BELOW) ===`);
        } else {
          lines.push(`=== ALL MESSAGES BELOW ARE UNREAD (${actualUnreadCount} UNREAD) ===`);
        }
        addedUnreadDivider = true;
      } else if (actualUnreadCount > 0 && i === 0 && unreadStartIndex > 0) {
        lines.push(`=== PREVIOUS READ CONTEXT (${previousContextCount} MESSAGES FOR CONTEXT ONLY) ===`);
      }

      const timeStr = this.formatTimestamp(msg.timestamp);
      const sender = msg.senderName || msg.senderNumber || 'Unknown';

      let replyContext = '';
      if (msg.isQuoted && msg.quotedMessage) {
        const quotedSender = msg.quotedMessage.senderName || 'someone';
        const cleanSnippet = msg.quotedMessage.body
          .replace(/\n+/g, ' ')
          .slice(0, 60);
        replyContext = ` (in reply to ${quotedSender}: "${cleanSnippet}")`;
      }

      const cleanBody = msg.body.replace(/\r\n/g, '\n').trim();
      const statusTag = isUnread ? '[NEW]' : '[PREVIOUS CONTEXT]';
      lines.push(`${statusTag} [${timeStr}] ${sender}${replyContext}: ${cleanBody}`);
    }

    // 6. Check if total text exceeds maxCharacters; if so, keep the most recent messages
    let selectedLines = lines;
    if (lines.join('\n').length > maxCharacters) {
      const reverseSelected: string[] = [];
      let currentLength = 0;

      for (let i = lines.length - 1; i >= 0; i--) {
        const lineLen = lines[i].length + 1;
        if (currentLength + lineLen > maxCharacters) break;
        reverseSelected.push(lines[i]);
        currentLength += lineLen;
      }

      selectedLines = reverseSelected.reverse();
    }

    const firstMsg = validMessages[0];
    const lastMsg = validMessages[totalOriginalCount - 1];

    const timeRange = {
      start: this.formatTimestamp(firstMsg.timestamp),
      end: this.formatTimestamp(lastMsg.timestamp),
    };

    let transcript = selectedLines.join('\n');
    if (selectedLines.length < lines.length) {
      transcript = `[NOTE: Showing latest messages due to length limits]\n\n` + transcript;
    }

    return {
      transcript,
      messageCount: totalOriginalCount,
      totalOriginalCount,
      unreadCount: actualUnreadCount,
      unreadTimeRange,
      previousContextCount,
      timeRange,
      participants: Array.from(participantsSet),
    };
  }

  /**
   * Format a Date object into human-readable YYYY-MM-DD HH:mm format
   */
  static formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  /**
   * Format an IChatSummary into beautiful Markdown for Telegram and REST API
   */
  static formatSummaryToMarkdown(summary: IChatSummary): string {
    const urgencyEmojiMap = {
      LOW: '🟢 Low',
      MEDIUM: '🟡 Medium',
      HIGH: '🟠 High',
      CRITICAL: '🔴 Urgent / Critical',
    };

    const isUnreadFlow = summary.unreadCount > 0;

    const headerLines = [
      `📊 *Chat Summary: ${this.escapeMarkdown(summary.chatName)}*`,
      isUnreadFlow
        ? `🔴 *Unread Messages:* ${summary.unreadCount} new unread messages`
        : `✅ *Status:* All messages read (showing last ${summary.totalMessagesAnalyzed} messages)`,
      isUnreadFlow && summary.unreadTimeRange?.start && summary.unreadTimeRange?.end
        ? `🕒 *Unread Period:* ${summary.unreadTimeRange.start} → ${summary.unreadTimeRange.end}`
        : summary.timeRange.start && summary.timeRange.end
        ? `🕒 *Period:* ${summary.timeRange.start} → ${summary.timeRange.end}`
        : null,
      isUnreadFlow && summary.previousContextCount && summary.previousContextCount > 0
        ? `📖 *Preceding Context:* ${summary.previousContextCount} read messages included for reference`
        : null,
      `🚨 *Urgency:* ${urgencyEmojiMap[summary.urgencyLevel] || summary.urgencyLevel}`,
      `━━━━━━━━━━━━━━━━━━━━`,
    ].filter(Boolean);

    const header = headerLines.join('\n');

    const tldr = `📌 *TL;DR:*\n${summary.tldr}`;

    const stringifyItem = (item: any): string => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        const parts = Object.entries(item)
          .map(([k, v]) => (v ? `${k}: ${v}` : ''))
          .filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : JSON.stringify(item);
      }
      return String(item);
    };

    let topics = '';
    if (summary.keyTopics.length > 0) {
      topics = `\n\n🔑 *Key Topics & Discussions:*\n` +
        summary.keyTopics.map((topic) => `• ${stringifyItem(topic)}`).join('\n');
    }

    let actions = '';
    if (summary.actionItems.length > 0) {
      actions = `\n\n✅ *Action Items & Tasks:*\n` +
        summary.actionItems
          .map((item) => {
            const taskStr = typeof item.task === 'object' ? stringifyItem(item.task) : (item.task || 'Task');
            const assignee = item.assignee ? ` [${item.assignee}]` : '';
            const due = item.dueDate ? ` (Due: ${item.dueDate})` : '';
            return `•${assignee} ${taskStr}${due}`;
          })
          .join('\n');
    }

    let decisions = '';
    if (summary.decisions.length > 0) {
      decisions = `\n\n🎯 *Decisions Made:*\n` +
        summary.decisions.map((d) => `• ${stringifyItem(d)}`).join('\n');
    }

    let linksAndDates = '';
    if (summary.importantLinksAndDates.length > 0) {
      linksAndDates = `\n\n📅 *Important Dates & Links:*\n` +
        summary.importantLinksAndDates.map((item) => `• ${stringifyItem(item)}`).join('\n');
    }

    const footer = `\n━━━━━━━━━━━━━━━━━━━━\n_Generated with Mistral AI at ${new Date(summary.generatedAt).toLocaleTimeString()}_`;

    return `${header}\n\n${tldr}${topics}${actions}${decisions}${linksAndDates}${footer}`;
  }

  /**
   * Format an IChatSummary into robust, parse-safe HTML for Telegram Bot
   * Completely eliminates entity parse errors caused by LLM output containing *, _, [, ], etc.
   */
  static formatSummaryToHtml(summary: IChatSummary): string {
    const urgencyEmojiMap = {
      LOW: '🟢 Low',
      MEDIUM: '🟡 Medium',
      HIGH: '🟠 High',
      CRITICAL: '🔴 Urgent / Critical',
    };

    const isUnreadFlow = summary.unreadCount > 0;

    const headerLines = [
      `📊 <b>Chat Summary: ${escapeHtml(summary.chatName)}</b>`,
      isUnreadFlow
        ? `🔴 <b>Unread Messages:</b> ${summary.unreadCount} new unread messages`
        : `✅ <b>Status:</b> All messages read (showing last ${summary.totalMessagesAnalyzed} messages)`,
      isUnreadFlow && summary.unreadTimeRange?.start && summary.unreadTimeRange?.end
        ? `🕒 <b>Unread Period:</b> ${escapeHtml(summary.unreadTimeRange.start)} → ${escapeHtml(summary.unreadTimeRange.end)}`
        : summary.timeRange.start && summary.timeRange.end
        ? `🕒 <b>Period:</b> ${escapeHtml(summary.timeRange.start)} → ${escapeHtml(summary.timeRange.end)}`
        : null,
      isUnreadFlow && summary.previousContextCount && summary.previousContextCount > 0
        ? `📖 <b>Preceding Context:</b> ${summary.previousContextCount} read messages included for reference`
        : null,
      `🚨 <b>Urgency:</b> ${urgencyEmojiMap[summary.urgencyLevel] || summary.urgencyLevel}`,
      `━━━━━━━━━━━━━━━━━━━━`,
    ].filter(Boolean);

    const header = headerLines.join('\n');
    const tldr = `📌 <b>TL;DR:</b>\n${escapeHtml(summary.tldr)}`;

    const stringifyItem = (item: any): string => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        const parts = Object.entries(item)
          .map(([k, v]) => (v ? `${k}: ${v}` : ''))
          .filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : JSON.stringify(item);
      }
      return String(item);
    };

    let topics = '';
    if (summary.keyTopics.length > 0) {
      topics = `\n\n🔑 <b>Key Topics &amp; Discussions:</b>\n` +
        summary.keyTopics.map((topic) => `• ${escapeHtml(stringifyItem(topic))}`).join('\n');
    }

    let actions = '';
    if (summary.actionItems.length > 0) {
      actions = `\n\n✅ <b>Action Items &amp; Tasks:</b>\n` +
        summary.actionItems
          .map((item) => {
            const taskStr = typeof item.task === 'object' ? stringifyItem(item.task) : (item.task || 'Task');
            const assignee = item.assignee ? ` [<b>${escapeHtml(item.assignee)}</b>]` : '';
            const due = item.dueDate ? ` (Due: ${escapeHtml(item.dueDate)})` : '';
            return `•${assignee} ${escapeHtml(taskStr)}${due}`;
          })
          .join('\n');
    }

    let decisions = '';
    if (summary.decisions.length > 0) {
      decisions = `\n\n🎯 <b>Decisions Made:</b>\n` +
        summary.decisions.map((d) => `• ${escapeHtml(stringifyItem(d))}`).join('\n');
    }

    let linksAndDates = '';
    if (summary.importantLinksAndDates.length > 0) {
      linksAndDates = `\n\n📅 <b>Important Dates &amp; Links:</b>\n` +
        summary.importantLinksAndDates.map((item) => `• ${escapeHtml(stringifyItem(item))}`).join('\n');
    }

    const footer = `\n━━━━━━━━━━━━━━━━━━━━\n<i>Generated with Mistral AI at ${new Date(summary.generatedAt).toLocaleTimeString()}</i>`;

    return `${header}\n\n${tldr}${topics}${actions}${decisions}${linksAndDates}${footer}`;
  }

  /**
   * Format an IChatSummary into plain text without formatting tags (safe fallback)
   */
  static formatSummaryToPlainText(summary: IChatSummary): string {
    const isUnreadFlow = summary.unreadCount > 0;
    const headerLines = [
      `[Chat Summary: ${summary.chatName}]`,
      isUnreadFlow
        ? `Unread Messages: ${summary.unreadCount} new unread messages`
        : `Status: All messages read (${summary.totalMessagesAnalyzed} messages)`,
      isUnreadFlow && summary.unreadTimeRange?.start && summary.unreadTimeRange?.end
        ? `Unread Period: ${summary.unreadTimeRange.start} -> ${summary.unreadTimeRange.end}`
        : summary.timeRange.start && summary.timeRange.end
        ? `Period: ${summary.timeRange.start} -> ${summary.timeRange.end}`
        : null,
      `Urgency: ${summary.urgencyLevel}`,
      `------------------------------------`,
    ].filter(Boolean);

    const stringifyItem = (item: any): string => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(', ');
      }
      return String(item);
    };

    const tldr = `TL;DR:\n${summary.tldr}`;
    const topics = summary.keyTopics.length > 0
      ? `\n\nKey Topics:\n` + summary.keyTopics.map((t) => `- ${stringifyItem(t)}`).join('\n')
      : '';
    const actions = summary.actionItems.length > 0
      ? `\n\nAction Items:\n` + summary.actionItems.map((a) => `- ${a.assignee ? `[${a.assignee}] ` : ''}${stringifyItem(a.task)}`).join('\n')
      : '';
    const decisions = summary.decisions.length > 0
      ? `\n\nDecisions:\n` + summary.decisions.map((d) => `- ${stringifyItem(d)}`).join('\n')
      : '';
    const links = summary.importantLinksAndDates.length > 0
      ? `\n\nDates & Links:\n` + summary.importantLinksAndDates.map((l) => `- ${stringifyItem(l)}`).join('\n')
      : '';

    return `${headerLines.join('\n')}\n\n${tldr}${topics}${actions}${decisions}${links}`;
  }

  /**
   * Escape special characters for Telegram Markdown v1/v2 if needed
   */
  static escapeMarkdown(text: string): string {
    return text.replace(/([_*`\\[\]])/g, '\\$1');
  }
}
