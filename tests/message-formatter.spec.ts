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
      unreadCount: 0,
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
    expect(md).toContain('All messages read');
    expect(md).toContain('TL;DR:');
    expect(md).toContain('Dave');
    expect(md).toContain('PostgreSQL 16 upgrade');
    expect(md).toContain('High');
  });

  it('should clearly separate unread messages from previous read context', () => {
    const rawMessages: IChatMessage[] = [
      {
        id: 'msg-1',
        senderName: 'Alice',
        timestamp: new Date('2026-09-10T10:00:00Z'),
        body: 'Morning everyone.',
        isQuoted: false,
        hasMedia: false,
      },
      {
        id: 'msg-2',
        senderName: 'Bob',
        timestamp: new Date('2026-09-10T14:00:00Z'),
        body: 'Here is the new urgent bug.',
        isQuoted: false,
        hasMedia: false,
      },
      {
        id: 'msg-3',
        senderName: 'Charlie',
        timestamp: new Date('2026-09-10T14:05:00Z'),
        body: 'I will investigate right now.',
        isQuoted: false,
        hasMedia: false,
      },
    ];

    // Suppose there are 2 unread messages (msg-2 and msg-3), and 1 previous read message (msg-1)
    const result = MessageFormatterService.formatForLLM(rawMessages, 60000, 2);

    expect(result.unreadCount).toBe(2);
    expect(result.previousContextCount).toBe(1);
    expect(result.unreadTimeRange?.start).toBe(MessageFormatterService.formatTimestamp(rawMessages[1].timestamp));
    expect(result.unreadTimeRange?.end).toBe(MessageFormatterService.formatTimestamp(rawMessages[2].timestamp));
    expect(result.transcript).toContain('PREVIOUS READ CONTEXT');
    expect(result.transcript).toContain('NEW UNREAD MESSAGES');
    expect(result.transcript).toContain('[PREVIOUS CONTEXT]');
    expect(result.transcript).toContain('[NEW]');
  });

  it('should safely format LLM output with Markdown characters and raw HTML injections into HTML', () => {
    const maliciousSummary: IChatSummary = {
      chatId: 'test-group@g.us',
      chatName: 'Dev & Design <Community>',
      isGroup: true,
      totalMessagesAnalyzed: 10,
      unreadCount: 5,
      timeRange: { start: '10:00', end: '11:00' },
      unreadTimeRange: { start: '10:30', end: '11:00' },
      tldr: 'Use *bold* _italic_ [link](http://x) <script>alert("xss")</script> & more symbols!',
      keyTopics: ['Topic with <b>HTML</b> & *markdown*', 'Clean topic'],
      actionItems: [
        { task: 'Run <cmd> --force & check "logs"', assignee: 'Bob <Admin>', dueDate: 'ASAP' },
      ],
      decisions: ['Decision: switch to <Postgres> & use port "5432"'],
      importantLinksAndDates: ['Link: https://example.com?a=1&b=2'],
      urgencyLevel: 'HIGH',
      rawSummaryMarkdown: '',
      generatedAt: '2026-09-10T12:00:00Z',
    };

    const html = MessageFormatterService.formatSummaryToHtml(maliciousSummary);

    // Assert that raw script tags and angle brackets are strictly escaped
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).toContain('Dev &amp; Design &lt;Community&gt;');
    expect(html).toContain('Bob &lt;Admin&gt;');
    expect(html).toContain('&lt;Postgres&gt;');

    // Assert valid HTML tags are used for formatting
    expect(html).toContain('<b>Chat Summary:');
    expect(html).toContain('<b>Urgency:</b> 🟠 High');
    expect(html).toContain('📌 <b>TL;DR:</b>');
    expect(html).toContain('🔑 <b>Key Topics &amp; Discussions:</b>');
  });

  it('should format IChatSummary to plain text without HTML tags', () => {
    const summary: IChatSummary = {
      chatId: 'test-group@g.us',
      chatName: 'Dev Group',
      isGroup: true,
      totalMessagesAnalyzed: 5,
      unreadCount: 0,
      timeRange: { start: '10:00', end: '10:30' },
      tldr: 'All bugs resolved.',
      keyTopics: ['Bug fixes'],
      actionItems: [{ task: 'Deploy' }],
      decisions: ['Approved'],
      importantLinksAndDates: [],
      urgencyLevel: 'LOW',
      rawSummaryMarkdown: '',
      generatedAt: '2026-09-10T12:00:00Z',
    };

    const plain = MessageFormatterService.formatSummaryToPlainText(summary);

    expect(plain).not.toContain('<b>');
    expect(plain).not.toContain('<i>');
    expect(plain).not.toContain('<code>');
    expect(plain).toContain('Chat Summary: Dev Group');
    expect(plain).toContain('TL;DR:');
    expect(plain).toContain('All bugs resolved.');
  });
});

