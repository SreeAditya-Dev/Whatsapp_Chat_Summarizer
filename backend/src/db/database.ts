import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';
import { DEFAULT_BUSINESS_KB } from '../core/types/business-kb.types';

export class DatabaseManager {
  private static instance: DatabaseSync | null = null;
  private static dbPath: string | null = null;

  static getInstance(): DatabaseSync {
    if (!this.instance) {
      this.init();
    }
    return this.instance!;
  }

  static getDbPath(): string {
    return this.dbPath || 'data.db';
  }

  static init(customPath?: string): DatabaseSync {
    if (this.instance) {
      return this.instance;
    }

    let filePath = customPath || process.env.DATABASE_PATH;
    if (!filePath) {
      if (process.env.NODE_ENV === 'test') {
        filePath = ':memory:';
      } else {
        const cwdDb = path.resolve(process.cwd(), 'data.db');
        const parentDb = path.resolve(process.cwd(), '..', 'data.db');
        if (fs.existsSync(cwdDb)) {
          filePath = cwdDb;
        } else if (fs.existsSync(parentDb)) {
          filePath = parentDb;
        } else {
          filePath = cwdDb;
        }
      }
    }

    this.dbPath = filePath;

    if (filePath !== ':memory:') {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.instance = new DatabaseSync(filePath);
    logger.info({ dbPath: filePath }, 'SQLite database connected successfully');

    this.runMigrations();
    return this.instance;
  }

  static runMigrations(): void {
    if (!this.instance) return;

    // 1. App settings table
    this.instance.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        summary_depth TEXT NOT NULL DEFAULT 'brief',
        summary_message_limit INTEGER NOT NULL DEFAULT 100,
        ai_reply_enabled INTEGER NOT NULL DEFAULT 1,
        ai_auto_reply INTEGER NOT NULL DEFAULT 1,
        ai_require_review INTEGER NOT NULL DEFAULT 0,
        ai_default_tone TEXT NOT NULL DEFAULT 'casual',
        ai_custom_persona TEXT NOT NULL DEFAULT '',
        ai_whitelist_mode TEXT NOT NULL DEFAULT 'all',
        ai_allowed_chat_ids TEXT NOT NULL DEFAULT '[]'
      );
    `);

    // 2. Business profile table
    this.instance.exec(`
      CREATE TABLE IF NOT EXISTS business_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled INTEGER NOT NULL DEFAULT 0,
        business_name TEXT NOT NULL DEFAULT '',
        industry TEXT NOT NULL DEFAULT '',
        tagline TEXT NOT NULL DEFAULT '',
        operating_hours TEXT NOT NULL DEFAULT '',
        location_or_address TEXT NOT NULL DEFAULT '',
        contact_email TEXT NOT NULL DEFAULT '',
        payment_or_booking_link TEXT NOT NULL DEFAULT '',
        custom_guidelines TEXT NOT NULL DEFAULT '',
        fallback_message TEXT NOT NULL DEFAULT '',
        additional_notes TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );
    `);

    // 3. Business FAQs table
    this.instance.exec(`
      CREATE TABLE IF NOT EXISTS business_faqs (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'General',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );
    `);

    // Check if initial row exists
    const row = this.instance.prepare('SELECT id FROM app_settings WHERE id = 1').get();
    if (!row) {
      this.seedOrMigrate();
    }
  }

  private static seedOrMigrate(): void {
    if (!this.instance) return;

    // Check if legacy .settings.json exists to migrate
    const cwdSettings = path.resolve(process.cwd(), '.settings.json');
    const parentSettings = path.resolve(process.cwd(), '..', '.settings.json');
    const settingsFile = fs.existsSync(cwdSettings)
      ? cwdSettings
      : fs.existsSync(parentSettings)
        ? parentSettings
        : null;

    if (settingsFile) {
      try {
        const raw = fs.readFileSync(settingsFile, 'utf-8');
        const parsed = JSON.parse(raw);
        logger.info({ settingsFile }, 'Migrating legacy .settings.json to SQLite database');

        const summary = parsed.summary || {};
        const aiReply = parsed.aiReply || {};
        const autoReply =
          typeof aiReply.autoReply === 'boolean'
            ? aiReply.autoReply
            : typeof aiReply.requireReview === 'boolean'
              ? !aiReply.requireReview
              : true;

        const requireReview =
          typeof aiReply.requireReview === 'boolean'
            ? aiReply.requireReview
            : !autoReply;

        const allowedChatIdsJson = JSON.stringify(
          Array.isArray(aiReply.allowedChatIds) ? aiReply.allowedChatIds : []
        );

        this.instance
          .prepare(
            `
          INSERT OR REPLACE INTO app_settings (
            id, summary_depth, summary_message_limit,
            ai_reply_enabled, ai_auto_reply, ai_require_review,
            ai_default_tone, ai_custom_persona, ai_whitelist_mode,
            ai_allowed_chat_ids
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            summary.defaultDepth || 'brief',
            summary.defaultMessageLimit || 100,
            aiReply.enabled !== false ? 1 : 0,
            autoReply ? 1 : 0,
            requireReview ? 1 : 0,
            aiReply.defaultTone || 'casual',
            aiReply.customPersona || '',
            aiReply.whitelistMode || 'all',
            allowedChatIdsJson
          );

        const kb = parsed.businessKB || {};
        const profile = kb.profile || {};
        const updatedAt = kb.updatedAt || new Date().toISOString();

        this.instance
          .prepare(
            `
          INSERT OR REPLACE INTO business_profile (
            id, enabled, business_name, industry, tagline,
            operating_hours, location_or_address, contact_email,
            payment_or_booking_link, custom_guidelines,
            fallback_message, additional_notes, updated_at
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            kb.enabled ? 1 : 0,
            profile.businessName || '',
            profile.industry || '',
            profile.tagline || '',
            profile.operatingHours || '',
            profile.locationOrAddress || '',
            profile.contactEmail || '',
            profile.paymentOrBookingLink || '',
            kb.customGuidelines || '',
            kb.fallbackMessage || '',
            kb.additionalNotes || '',
            updatedAt
          );

        const faqs = Array.isArray(kb.faqs) ? kb.faqs : [];
        const insertFaq = this.instance.prepare(`
          INSERT OR REPLACE INTO business_faqs (
            id, question, answer, category, enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const faq of faqs) {
          insertFaq.run(
            faq.id,
            faq.question,
            faq.answer,
            faq.category || 'General',
            faq.enabled !== false ? 1 : 0,
            faq.createdAt || new Date().toISOString(),
            faq.updatedAt || null
          );
        }

        // Delete migrated .settings.json so data solely resides in SQLite .db
        try {
          fs.unlinkSync(settingsFile);
          logger.info({ settingsFile }, 'Removed legacy .settings.json after successful SQLite migration');
        } catch (unlinkErr: any) {
          logger.warn({ error: unlinkErr.message }, 'Could not remove .settings.json after migration');
        }
        return;
      } catch (err: any) {
        logger.warn({ error: err.message }, 'Failed reading .settings.json, populating default settings in SQLite');
      }
    }

    // Default seed
    this.instance
      .prepare(
        `
      INSERT OR IGNORE INTO app_settings (
        id, summary_depth, summary_message_limit,
        ai_reply_enabled, ai_auto_reply, ai_require_review,
        ai_default_tone, ai_custom_persona, ai_whitelist_mode,
        ai_allowed_chat_ids
      ) VALUES (1, 'brief', 100, 1, 1, 0, 'casual', '', 'all', '[]')
    `
      )
      .run();

    this.instance
      .prepare(
        `
      INSERT OR IGNORE INTO business_profile (
        id, enabled, business_name, industry, tagline,
        operating_hours, location_or_address, contact_email,
        payment_or_booking_link, custom_guidelines,
        fallback_message, additional_notes, updated_at
      ) VALUES (1, 0, '', '', '', '', '', '', '', '', '', '', ?)
    `
      )
      .run(new Date().toISOString());

    const insertFaq = this.instance.prepare(`
      INSERT OR IGNORE INTO business_faqs (
        id, question, answer, category, enabled, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const faq of DEFAULT_BUSINESS_KB.faqs) {
      insertFaq.run(
        faq.id,
        faq.question,
        faq.answer,
        faq.category,
        faq.enabled ? 1 : 0,
        faq.createdAt
      );
    }
  }

  static close(): void {
    if (this.instance) {
      try {
        this.instance.close();
      } catch (err) {
        // ignore
      }
      this.instance = null;
      this.dbPath = null;
    }
  }
}
