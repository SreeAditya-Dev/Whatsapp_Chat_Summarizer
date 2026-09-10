import { describe, it, expect } from 'vitest';
import { MessageFormatterService } from '../src/services/message-formatter.service';
import { IChatMessage, IChatSummary } from '../src/core/types/summary.types';

describe('MessageFormatterService', () => {
  it('should format messages chronologically with senders and reply context', () => {
    const rawMessages: IChatMessage[] = [
      {
        id: 'msg-2',
        senderName: 'Bob',
        timestamp: new Date('2026-09-10T10:05:00Z'),
        body: 'I will handle the API refactoring.',
        isQuoted: true,
        quotedMessage: {
          senderName: 'Alice',
          body: 'Who can take the API refactoring?',
        },
        hasMedia: false,
      },
      {
        id: 'msg-1',
        senderName: 'Alice',
        timestamp: new Date('2026-09-10T10:00:00Z'),
        body: 'Who can take the API refactoring?',
        isQuoted: false,
        hasMedia: false,
      },
    ];

    const result = MessageFormatterService.formatForLLM(rawMessages);

    expect(result.messageCount).toBe(2);
    expect(result.participants).toContain('Alice');
    expect(result.participants).toContain('Bob');

    // Alice should be first because it was at 10:00
    const lines = result.transcript.split('\n');
    expect(lines[0]).toContain('Alice: Who can take the API refactoring?');
    expect(lines[1]).toContain('Bob (in reply to Alice: "Who can take the API refactoring?"): I will handle the API refactoring.');
  });

  it('should filter out empty or whitespace-only messages', () => {
    const rawMessages: IChatMessage[] = [
      {
        id: 'msg-1',
        senderName: 'Alice',
        timestamp: new Date(),
        body: '   ',
        isQuoted: false,
        hasMedia: false,
      },
      {
        id: 'msg-2',
        senderName: 'Charlie',
        timestamp: new Date(),
        body: 'Meeting at 3pm',
        isQuoted: false,
        hasMedia: false,
      },
    ];

    const result = MessageFormatterService.formatForLLM(rawMessages);
    expect(result.messageCount).toBe(1);
    expect(result.transcript).toContain('Meeting at 3pm');
  });

  it('should correctly format IChatSummary into human-readable Markdown', () => {
    const mockSummary: IChatSummary = {
      chatId: '123@g.us',
      chatName: 'Engineering Core',
      isGroup: true,
      totalMessagesAnalyzed: 45,
      timeRange: {
        start: '2026-09-10 09:00',
        end: '2026-09-10 11:30',
      },
      tldr: 'The team discussed the upcoming v2 release and assigned frontend and backend leads.',
      keyTopics: ['Backend database migration', 'Frontend design overhaul'],
      actionItems: [
        { task: 'Prepare migration script', assignee: 'Dave', dueDate: 'Tomorrow 2 PM' },
      ],
      decisions: ['Approved PostgreSQL 16 upgrade'],
      importantLinksAndDates: ['Staging deployment: Friday 4 PM'],
      urgencyLevel: 'HIGH',
      rawSummaryMarkdown: '',
      generatedAt: '2026-09-10T12:00:00Z',
    };

    const md = MessageFormatterService.formatSummaryToMarkdown(mockSummary);
    expect(md).toContain('Engineering Core');
    expect(md).toContain('45 messages');
    expect(md).toContain('TL;DR:');
    expect(md).toContain('Dave');
    expect(md).toContain('PostgreSQL 16 upgrade');
    expect(md).toContain('High');
  });
});
