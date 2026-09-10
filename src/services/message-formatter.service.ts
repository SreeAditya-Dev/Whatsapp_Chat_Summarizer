import { IChatMessage, IChatSummary } from '../core/types/summary.types';

export interface FormattedTranscriptResult {
  transcript: string;
  messageCount: number;
  totalOriginalCount: number;
  timeRange: {
    start?: string;
    end?: string;
  };
  participants: string[];
}

export class MessageFormatterService {
  /**
   * Format an array of chat messages into a clean, chronological transcript for LLM summarization.
   */
  static formatForLLM(
    messages: IChatMessage[],
    maxCharacters = 60000
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
        timeRange: {},
        participants: [],
      };
    }

    // 3. Extract participants
    const participantsSet = new Set<string>();
    validMessages.forEach((m) => {
      if (m.senderName) participantsSet.add(m.senderName);
    });

    // 4. Build message lines
    const lines: string[] = [];
    for (const msg of validMessages) {
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
      lines.push(`[${timeStr}] ${sender}${replyContext}: ${cleanBody}`);
    }

    // 5. Check if total text exceeds maxCharacters; if so, keep the most recent messages
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

    const firstMsg = validMessages[validMessages.length - selectedLines.length] || validMessages[0];
    const lastMsg = validMessages[validMessages.length - 1];

    const timeRange = {
      start: this.formatTimestamp(firstMsg.timestamp),
      end: this.formatTimestamp(lastMsg.timestamp),
    };

    let transcript = selectedLines.join('\n');
    if (selectedLines.length < totalOriginalCount) {
      transcript = `[NOTE: Showing the latest ${selectedLines.length} messages out of ${totalOriginalCount} total messages due to length]\n\n` + transcript;
    }

    return {
      transcript,
      messageCount: selectedLines.length,
      totalOriginalCount,
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

    const header = [
      `📊 *Chat Summary: ${this.escapeMarkdown(summary.chatName)}*`,
      `💬 *Analyzed:* ${summary.totalMessagesAnalyzed} messages`,
      summary.timeRange.start && summary.timeRange.end
        ? `🕒 *Period:* ${summary.timeRange.start} → ${summary.timeRange.end}`
        : null,
      `🚨 *Urgency:* ${urgencyEmojiMap[summary.urgencyLevel] || summary.urgencyLevel}`,
      `━━━━━━━━━━━━━━━━━━━━`,
    ]
      .filter(Boolean)
      .join('\n');

    const tldr = `📌 *TL;DR:*\n${summary.tldr}`;

    let topics = '';
    if (summary.keyTopics.length > 0) {
      topics = `\n\n🔑 *Key Topics & Discussions:*\n` +
        summary.keyTopics.map((topic) => `• ${topic}`).join('\n');
    }

    let actions = '';
    if (summary.actionItems.length > 0) {
      actions = `\n\n✅ *Action Items & Tasks:*\n` +
        summary.actionItems
          .map((item) => {
            const assignee = item.assignee ? ` [${item.assignee}]` : '';
            const due = item.dueDate ? ` (Due: ${item.dueDate})` : '';
            return `•${assignee} ${item.task}${due}`;
          })
          .join('\n');
    }

    let decisions = '';
    if (summary.decisions.length > 0) {
      decisions = `\n\n🎯 *Decisions Made:*\n` +
        summary.decisions.map((d) => `• ${d}`).join('\n');
    }

    let linksAndDates = '';
    if (summary.importantLinksAndDates.length > 0) {
      linksAndDates = `\n\n📅 *Important Dates & Links:*\n` +
        summary.importantLinksAndDates.map((item) => `• ${item}`).join('\n');
    }

    const footer = `\n━━━━━━━━━━━━━━━━━━━━\n_Generated with Mistral AI at ${new Date(summary.generatedAt).toLocaleTimeString()}_`;

    return `${header}\n\n${tldr}${topics}${actions}${decisions}${linksAndDates}${footer}`;
  }

  /**
   * Escape special characters for Telegram Markdown v1/v2 if needed
   */
  static escapeMarkdown(text: string): string {
    return text.replace(/([_*`\\[\]])/g, '\\$1');
  }
}
