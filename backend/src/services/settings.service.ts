import { logger } from '../utils/logger';
import { BusinessKnowledgeBase, BusinessProfile, DEFAULT_BUSINESS_KB, FAQItem } from '../core/types/business-kb.types';
import { DatabaseManager } from '../db/database';

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
  businessKB: BusinessKnowledgeBase;
}

export const DEFAULT_SETTINGS: AppSettings = {
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
  businessKB: { ...DEFAULT_BUSINESS_KB },
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
  businessKB?: Partial<BusinessKnowledgeBase>;
}

export class SettingsService {
  static getSettings(): AppSettings {
    const db = DatabaseManager.getInstance();

    const appRow = db.prepare('SELECT * FROM app_settings WHERE id = 1').get() as any;
    const profileRow = db.prepare('SELECT * FROM business_profile WHERE id = 1').get() as any;
    const faqRows = (db.prepare('SELECT * FROM business_faqs ORDER BY created_at ASC').all() || []) as any[];

    let allowedChatIds: string[] = [];
    if (appRow?.ai_allowed_chat_ids) {
      try {
        allowedChatIds = JSON.parse(appRow.ai_allowed_chat_ids);
      } catch {
        allowedChatIds = [];
      }
    }

    const summary = {
      defaultDepth: (appRow?.summary_depth || DEFAULT_SETTINGS.summary.defaultDepth) as 'compact' | 'brief' | 'detailed',
      defaultMessageLimit: appRow?.summary_message_limit ?? DEFAULT_SETTINGS.summary.defaultMessageLimit,
    };

    const autoReply = Boolean(appRow?.ai_auto_reply ?? 1);
    const requireReview = Boolean(appRow?.ai_require_review ?? 0);

    const aiReply = {
      enabled: Boolean(appRow?.ai_reply_enabled ?? 1),
      autoReply,
      requireReview,
      defaultTone: (appRow?.ai_default_tone || DEFAULT_SETTINGS.aiReply.defaultTone) as 'casual' | 'friendly' | 'professional' | 'concise',
      customPersona: appRow?.ai_custom_persona || '',
      whitelistMode: (appRow?.ai_whitelist_mode || 'all') as 'all' | 'selected',
      allowedChatIds,
    };

    const profile: BusinessProfile = {
      businessName: profileRow?.business_name || '',
      industry: profileRow?.industry || '',
      tagline: profileRow?.tagline || '',
      operatingHours: profileRow?.operating_hours || '',
      locationOrAddress: profileRow?.location_or_address || '',
      contactEmail: profileRow?.contact_email || '',
      paymentOrBookingLink: profileRow?.payment_or_booking_link || '',
    };

    const faqs: FAQItem[] = faqRows.map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      category: f.category || 'General',
      enabled: Boolean(f.enabled),
      createdAt: f.created_at,
    }));

    const businessKB: BusinessKnowledgeBase = {
      enabled: Boolean(profileRow?.enabled ?? 0),
      profile,
      faqs,
      customGuidelines: profileRow?.custom_guidelines || '',
      fallbackMessage: profileRow?.fallback_message || '',
      additionalNotes: profileRow?.additional_notes || '',
      updatedAt: profileRow?.updated_at || new Date().toISOString(),
    };

    return {
      summary,
      aiReply,
      businessKB,
    };
  }

  static updateSettings(partial: UpdateAppSettingsDto): AppSettings {
    const db = DatabaseManager.getInstance();
    const current = this.getSettings();

    // 1. Update summary & aiReply in app_settings
    const partialSummary = partial.summary || {};
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

    const newSummary = {
      defaultDepth: partialSummary.defaultDepth || current.summary.defaultDepth,
      defaultMessageLimit: partialSummary.defaultMessageLimit ?? current.summary.defaultMessageLimit,
    };

    const newAi = {
      enabled: partialAi.enabled !== undefined ? partialAi.enabled : current.aiReply.enabled,
      autoReply: autoReply ?? true,
      requireReview: requireReview ?? false,
      defaultTone: partialAi.defaultTone || current.aiReply.defaultTone,
      customPersona: partialAi.customPersona !== undefined ? partialAi.customPersona : current.aiReply.customPersona,
      whitelistMode: partialAi.whitelistMode || current.aiReply.whitelistMode,
      allowedChatIds: partialAi.allowedChatIds || current.aiReply.allowedChatIds,
    };

    db.prepare(`
      INSERT OR REPLACE INTO app_settings (
        id, summary_depth, summary_message_limit,
        ai_reply_enabled, ai_auto_reply, ai_require_review,
        ai_default_tone, ai_custom_persona, ai_whitelist_mode,
        ai_allowed_chat_ids
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newSummary.defaultDepth,
      newSummary.defaultMessageLimit,
      newAi.enabled ? 1 : 0,
      newAi.autoReply ? 1 : 0,
      newAi.requireReview ? 1 : 0,
      newAi.defaultTone,
      newAi.customPersona,
      newAi.whitelistMode,
      JSON.stringify(newAi.allowedChatIds)
    );

    // 2. Update business KB if provided
    if (partial.businessKB) {
      const partialKB = partial.businessKB;
      const partialProfile = partialKB.profile || {};
      const newProfile: BusinessProfile = {
        ...current.businessKB.profile,
        ...partialProfile,
      };

      const newKbEnabled = partialKB.enabled !== undefined ? partialKB.enabled : current.businessKB.enabled;
      const newGuidelines = partialKB.customGuidelines !== undefined ? partialKB.customGuidelines : current.businessKB.customGuidelines;
      const newFallback = partialKB.fallbackMessage !== undefined ? partialKB.fallbackMessage : current.businessKB.fallbackMessage;
      const newNotes = partialKB.additionalNotes !== undefined ? partialKB.additionalNotes : current.businessKB.additionalNotes;
      const updatedAt = new Date().toISOString();

      db.prepare(`
        INSERT OR REPLACE INTO business_profile (
          id, enabled, business_name, industry, tagline,
          operating_hours, location_or_address, contact_email,
          payment_or_booking_link, custom_guidelines,
          fallback_message, additional_notes, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newKbEnabled ? 1 : 0,
        newProfile.businessName,
        newProfile.industry,
        newProfile.tagline,
        newProfile.operatingHours,
        newProfile.locationOrAddress,
        newProfile.contactEmail,
        newProfile.paymentOrBookingLink || '',
        newGuidelines,
        newFallback,
        newNotes,
        updatedAt
      );

      // If faqs array was explicitly passed, replace the faqs table
      if (Array.isArray(partialKB.faqs)) {
        db.exec('DELETE FROM business_faqs');
        const insertFaq = db.prepare(`
          INSERT INTO business_faqs (
            id, question, answer, category, enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const faq of partialKB.faqs) {
          insertFaq.run(
            faq.id,
            faq.question,
            faq.answer,
            faq.category || 'General',
            faq.enabled !== false ? 1 : 0,
            faq.createdAt || new Date().toISOString(),
            null
          );
        }
      }
    }

    logger.info('App settings successfully updated and saved to SQLite database');
    return this.getSettings();
  }

  static getBusinessKB(): BusinessKnowledgeBase {
    return this.getSettings().businessKB;
  }

  static updateBusinessKB(partial: Partial<BusinessKnowledgeBase>): BusinessKnowledgeBase {
    const updated = this.updateSettings({ businessKB: partial });
    return updated.businessKB;
  }

  static addFAQ(faq: Omit<FAQItem, 'id' | 'createdAt'>): FAQItem {
    const db = DatabaseManager.getInstance();
    const id = `faq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO business_faqs (id, question, answer, category, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, faq.question, faq.answer, faq.category || 'General', faq.enabled !== false ? 1 : 0, createdAt);

    db.prepare(`UPDATE business_profile SET updated_at = ? WHERE id = 1`).run(createdAt);

    return {
      ...faq,
      id,
      category: faq.category || 'General',
      enabled: faq.enabled !== false,
      createdAt,
    };
  }

  static updateFAQ(id: string, partial: Partial<FAQItem>): FAQItem | null {
    const db = DatabaseManager.getInstance();
    const existing = db.prepare('SELECT * FROM business_faqs WHERE id = ?').get(id) as any;
    if (!existing) return null;

    const updatedAt = new Date().toISOString();
    const question = partial.question !== undefined ? partial.question : existing.question;
    const answer = partial.answer !== undefined ? partial.answer : existing.answer;
    const category = partial.category !== undefined ? partial.category : existing.category;
    const enabled = partial.enabled !== undefined ? (partial.enabled ? 1 : 0) : existing.enabled;

    db.prepare(`
      UPDATE business_faqs
      SET question = ?, answer = ?, category = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(question, answer, category, enabled, updatedAt, id);

    db.prepare(`UPDATE business_profile SET updated_at = ? WHERE id = 1`).run(updatedAt);

    return {
      id,
      question,
      answer,
      category,
      enabled: Boolean(enabled),
      createdAt: existing.created_at,
    };
  }

  static deleteFAQ(id: string): boolean {
    const db = DatabaseManager.getInstance();
    const result = db.prepare('DELETE FROM business_faqs WHERE id = ?').run(id);
    if (Number(result.changes) > 0) {
      db.prepare(`UPDATE business_profile SET updated_at = ? WHERE id = 1`).run(new Date().toISOString());
      return true;
    }
    return false;
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
