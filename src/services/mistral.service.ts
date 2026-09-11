import { Mistral } from '@mistralai/mistralai';
import { env } from '../config/env';
import { ISummarizer, SummarizeOptions } from '../core/interfaces/summarizer.interface';
import { IChatMessage, IChatSummary, UrgencyLevel } from '../core/types/summary.types';
import { logger } from '../utils/logger';
import { MessageFormatterService } from './message-formatter.service';

interface MistralJsonOutput {
  tldr: string;
  keyTopics: string[];
  actionItems: Array<{ task: string; assignee?: string; dueDate?: string }>;
  decisions: string[];
  importantLinksAndDates: string[];
  urgencyLevel: UrgencyLevel;
}

export class MistralSummarizerService implements ISummarizer {
  private client: Mistral;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel?: string) {
    const key = apiKey || env.MISTRAL_API_KEY;
    this.defaultModel = defaultModel || env.MISTRAL_MODEL || 'mistral-small-latest';
    this.client = new Mistral({ apiKey: key });
  }

  async summarize(messages: IChatMessage[], options: SummarizeOptions): Promise<IChatSummary> {
    if (!messages || messages.length === 0) {
      throw new Error('No messages provided to summarize.');
    }

    const {
      transcript,
      messageCount,
      timeRange,
      unreadTimeRange,
      unreadCount,
      previousContextCount,
    } = MessageFormatterService.formatForLLM(messages, 60000, options.unreadCount);

    const modelToUse = options.model || this.defaultModel;
    logger.info(
      { chatId: options.chatId, messageCount, unreadCount, model: modelToUse },
      'Sending chat transcript to Mistral AI for summarization'
    );

    const systemPrompt = `You are an expert executive communication assistant. Your task is to analyze WhatsApp chat transcripts (from a group or personal chat) and generate an accurate, comprehensive, context-aware summary.

CRITICAL GUIDELINES:
1. Maintain Context: Keep track of who is talking to whom, especially with replies and discussions.
2. Focus on Unread / New Messages: If unread messages are indicated, prioritize summarizing what happened in the new unread segment, using previous read messages only as background context.
3. Filter Noise: Ignore casual banter, greetings, memes, or trivial chatter unless it impacts decisions.
4. Identify Actions & Tasks: Specifically look for commitments, promises, questions directed at individuals, and assigned tasks.
5. Detect Decisions: Note what consensus was reached or what was agreed upon.
6. Extract Dates & Links: Extract any deadlines, calendar dates, meetings, Zoom links, or URLs mentioned.
7. Urgency Assessment:
   - "LOW": Casual chit-chat, no action needed.
   - "MEDIUM": Informative updates, minor discussion.
   - "HIGH": Pending questions, action items for team members.
   - "CRITICAL": Urgent blocker, immediate response requested, or approaching emergency/deadline.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "tldr": "A 2 to 3 sentence executive summary capturing the core essence of the conversation.",
  "keyTopics": ["Key topic 1 with context", "Key topic 2 with context"],
  "actionItems": [
    {
      "task": "Description of the task or commitment",
      "assignee": "Person responsible if mentioned, or null",
      "dueDate": "Deadline/timeframe if mentioned, or null"
    }
  ],
  "decisions": ["Decision 1 made by the group", "Decision 2"],
  "importantLinksAndDates": ["Date/time/link with brief context"],
  "urgencyLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}

IMPORTANT: "keyTopics", "decisions", and "importantLinksAndDates" MUST be arrays of plain strings (e.g. ["Topic: Context"]), NOT nested objects.`;

    const userPrompt = `Here is the chat transcript from "${options.chatName}" (${options.isGroup ? 'Group Chat' : 'Personal Chat'}):

--- TRANSCRIPT START ---
${transcript}
--- TRANSCRIPT END ---

Please analyze the above conversation and provide the structured summary in the requested JSON format.`;

    try {
      const response = await this.client.chat.complete({
        model: modelToUse,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        responseFormat: { type: 'json_object' },
        temperature: 0.2,
      });

      const rawContent = response.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error('Received empty response from Mistral AI.');
      }

      const contentString = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
      const parsedData = this.parseMistralResponse(contentString);

      const summary: IChatSummary = {
        chatId: options.chatId,
        chatName: options.chatName,
        isGroup: options.isGroup,
        totalMessagesAnalyzed: messageCount,
        unreadCount,
        timeRange,
        unreadTimeRange,
        previousContextCount,
        tldr: parsedData.tldr || 'No summary available.',
        keyTopics: parsedData.keyTopics || [],
        actionItems: parsedData.actionItems || [],
        decisions: parsedData.decisions || [],
        importantLinksAndDates: parsedData.importantLinksAndDates || [],
        urgencyLevel: parsedData.urgencyLevel || 'MEDIUM',
        rawSummaryMarkdown: '',
        generatedAt: new Date().toISOString(),
      };

      summary.rawSummaryMarkdown = MessageFormatterService.formatSummaryToMarkdown(summary);
      return summary;
    } catch (error: any) {
      logger.error({ error: error.message, chatId: options.chatId }, 'Mistral AI summarization failed');
      throw new Error(`Mistral summarization failed: ${error.message}`);
    }
  }

  private parseMistralResponse(content: string): MistralJsonOutput {
    try {
      // Remove any possible markdown block wrappers like ```json ... ```
      const cleaned = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      const validUrgency: UrgencyLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const urgency = validUrgency.includes(parsed.urgencyLevel)
        ? parsed.urgencyLevel
        : 'MEDIUM';

      const normalizeString = (item: unknown): string => {
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'number' || typeof item === 'boolean') return String(item);
        if (item === null || item === undefined) return '';
        if (typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          if (obj.topic && obj.context) return `${obj.topic}: ${obj.context}`;
          if (obj.topic) return String(obj.topic);
          if (obj.decision && obj.context) return `${obj.decision}: ${obj.context}`;
          if (obj.decision) return String(obj.decision);
          if (obj.task) return obj.assignee ? `${obj.task} (${obj.assignee})` : String(obj.task);
          const entries = Object.entries(obj)
            .filter(([_, v]) => v !== null && v !== undefined && typeof v !== 'object')
            .map(([k, v]) => `${k}: ${v}`);
          if (entries.length > 0) return entries.join(', ');
          return JSON.stringify(item);
        }
        return String(item);
      };

      const normalizeActionItems = (items: unknown[]): IActionItem[] => {
        return items
          .map((a) => {
            if (typeof a === 'string') {
              return { task: a, assignee: undefined, dueDate: undefined };
            }
            if (a && typeof a === 'object') {
              const obj = a as Record<string, unknown>;
              const task =
                typeof obj.task === 'string'
                  ? obj.task
                  : obj.task
                    ? normalizeString(obj.task)
                    : obj.action || obj.description || normalizeString(obj);
              const assignee =
                typeof obj.assignee === 'string'
                  ? obj.assignee
                  : obj.owner
                    ? String(obj.owner)
                    : undefined;
              const dueDate =
                typeof obj.dueDate === 'string'
                  ? obj.dueDate
                  : obj.deadline || obj.due || obj.date
                    ? String(obj.deadline || obj.due || obj.date)
                    : undefined;
              return {
                task: task ? String(task) : 'Unspecified task',
                assignee: assignee || undefined,
                dueDate: dueDate || undefined,
              };
            }
            return null;
          })
          .filter((a): a is IActionItem => a !== null && Boolean(a.task));
      };

      return {
        tldr: typeof parsed.tldr === 'string' ? parsed.tldr : normalizeString(parsed.tldr),
        keyTopics: Array.isArray(parsed.keyTopics)
          ? parsed.keyTopics.map(normalizeString).filter(Boolean)
          : [],
        actionItems: Array.isArray(parsed.actionItems)
          ? normalizeActionItems(parsed.actionItems)
          : [],
        decisions: Array.isArray(parsed.decisions)
          ? parsed.decisions.map(normalizeString).filter(Boolean)
          : [],
        importantLinksAndDates: Array.isArray(parsed.importantLinksAndDates)
          ? parsed.importantLinksAndDates.map(normalizeString).filter(Boolean)
          : [],
        urgencyLevel: urgency,
      };
    } catch (err) {
      logger.warn({ rawContent: content }, 'Failed to parse Mistral JSON output directly, applying fallback');
      return {
        tldr: content.slice(0, 300),
        keyTopics: ['Conversation summarized via fallback parsing.'],
        actionItems: [],
        decisions: [],
        importantLinksAndDates: [],
        urgencyLevel: 'MEDIUM',
      };
    }
  }
}
