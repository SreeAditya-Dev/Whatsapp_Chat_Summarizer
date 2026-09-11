import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface AppSettings {
  summary: {
    defaultDepth: 'compact' | 'brief' | 'detailed';
    defaultMessageLimit: number;
  };
  aiReply: {
    enabled: boolean;
    autoReply: boolean;
    requireReview: boolean;
    defaultTone: 'casual' | 'friendly' | 'professional' | 'concise';
    customPersona: string;
    whitelistMode: 'all' | 'selected';
    allowedChatIds: string[];
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  summary: {
    defaultDepth: 'brief',
    defaultMessageLimit: 100,
  },
  aiReply: {
    enabled: true,
    autoReply: true,
    requireReview: false,
    defaultTone: 'casual',
    customPersona: '',
    whitelistMode: 'all',
    allowedChatIds: [],
  },
};

export interface UpdateAppSettingsDto {
  summary?: {
    defaultDepth?: 'compact' | 'brief' | 'detailed';
    defaultMessageLimit?: number;
  };
  aiReply?: {
    enabled?: boolean;
    autoReply?: boolean;
    requireReview?: boolean;
    defaultTone?: 'casual' | 'friendly' | 'professional' | 'concise';
    customPersona?: string;
    whitelistMode?: 'all' | 'selected';
    allowedChatIds?: string[];
  };
}

export class SettingsService {
  private static filePath = path.resolve(process.cwd(), '.settings.json');
  private static cachedSettings: AppSettings | null = null;

  static getSettings(): AppSettings {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const aiReplyParsed = parsed.aiReply || {};
        const autoReply =
          typeof aiReplyParsed.autoReply === 'boolean'
            ? aiReplyParsed.autoReply
            : typeof aiReplyParsed.requireReview === 'boolean'
              ? !aiReplyParsed.requireReview
              : DEFAULT_SETTINGS.aiReply.autoReply;

        this.cachedSettings = {
          summary: {
            ...DEFAULT_SETTINGS.summary,
            ...(parsed.summary || {}),
          },
          aiReply: {
            ...DEFAULT_SETTINGS.aiReply,
            ...aiReplyParsed,
            autoReply,
            requireReview: !autoReply,
          },
        };
        return this.cachedSettings!;
      }
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Failed to read .settings.json, falling back to defaults');
    }

    this.cachedSettings = { ...DEFAULT_SETTINGS };
    return this.cachedSettings;
  }

  static updateSettings(partial: UpdateAppSettingsDto): AppSettings {
    const current = this.getSettings();
    const partialAi = partial.aiReply || {};
    let autoReply = partialAi.autoReply;
    let requireReview = partialAi.requireReview;

    if (autoReply !== undefined && requireReview === undefined) {
      requireReview = !autoReply;
    } else if (requireReview !== undefined && autoReply === undefined) {
      autoReply = !requireReview;
    } else if (autoReply === undefined && requireReview === undefined) {
      autoReply = current.aiReply.autoReply;
      requireReview = current.aiReply.requireReview;
    }

    const updated: AppSettings = {
      summary: {
        ...current.summary,
        ...(partial.summary || {}),
      },
      aiReply: {
        ...current.aiReply,
        ...partialAi,
        autoReply: autoReply ?? true,
        requireReview: requireReview ?? false,
      },
    };

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(updated, null, 2), 'utf-8');
      this.cachedSettings = updated;
      logger.info('App settings successfully updated and saved to .settings.json');
    } catch (err: any) {
      logger.error({ error: err.message }, 'Failed to save .settings.json');
      throw new Error(`Failed to save settings: ${err.message}`);
    }

    return updated;
  }

  static isChatAllowedForReply(chatId: string, additionalIdentifiers: string[] = []): boolean {
    const settings = this.getSettings();
    if (!settings.aiReply.enabled) return false;
    if (settings.aiReply.whitelistMode === 'all') return true;

    const candidates = [chatId, ...additionalIdentifiers].filter(Boolean);

    // 1. Direct match on any candidate identifier
    for (const c of candidates) {
      if (settings.aiReply.allowedChatIds.includes(c)) return true;
    }

    // 2. Normalized digit matching for phone numbers (ignores spaces, dashes, +, @c.us)
    for (const c of candidates) {
      const cDigits = c.replace(/\D/g, '');
      if (cDigits.length >= 6) {
        for (const allowed of settings.aiReply.allowedChatIds) {
          const allowedDigits = allowed.replace(/\D/g, '');
          if (allowedDigits.length >= 6) {
            if (
              allowedDigits === cDigits ||
              cDigits.endsWith(allowedDigits) ||
              allowedDigits.endsWith(cDigits)
            ) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }
}
