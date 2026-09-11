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
    requireReview: true,
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
        this.cachedSettings = {
          summary: {
            ...DEFAULT_SETTINGS.summary,
            ...(parsed.summary || {}),
          },
          aiReply: {
            ...DEFAULT_SETTINGS.aiReply,
            ...(parsed.aiReply || {}),
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
    const updated: AppSettings = {
      summary: {
        ...current.summary,
        ...(partial.summary || {}),
      },
      aiReply: {
        ...current.aiReply,
        ...(partial.aiReply || {}),
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

  static isChatAllowedForReply(chatId: string): boolean {
    const settings = this.getSettings();
    if (!settings.aiReply.enabled) return false;
    if (settings.aiReply.whitelistMode === 'all') return true;
    return settings.aiReply.allowedChatIds.includes(chatId);
  }
}
