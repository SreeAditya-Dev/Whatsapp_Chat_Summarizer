# Business & Freelancer FAQ Assistant — Design Specification

**Date:** 2026-09-11  
**Status:** Approved  
**Target:** WhatsApp Chat Summarizer & AI Reply Engine  

---

## 1. Problem Statement & Motivation
Small business owners, solo agency founders, clinics, and freelancers receive dozens of repetitive customer inquiries daily on WhatsApp (e.g. *"What are your pricing plans?"*, *"Where are you located?"*, *"Are you open on weekends?"*, *"What services do you provide?"*).

Manually typing the same replies is exhausting, while generic AI bots often hallucinate incorrect prices, false promises, or unoffered services. 

This feature introduces **Business Assistant Mode**:
1. **Configurable Business Knowledge Base (KB)**: Owners define verified business info, operating hours, service prices, FAQ items, and catalog text.
2. **Zero-Hallucination Guardrails**: The AI answers *strictly* from verified business data.
3. **Graceful Escalation**: If an inquiry is outside the knowledge base, the AI politely explains standard terms and defers to the owner.
4. **On-Demand Activation**: Tucked behind a master toggle so it does not clutter personal chat users.

---

## 2. Architecture & Data Model

### Data Schema (`src/core/types/business-kb.types.ts`)
```ts
export interface BusinessProfile {
  businessName: string;
  industry: string;
  tagline: string;
  operatingHours: string;
  locationOrAddress: string;
  contactEmail: string;
  paymentOrBookingLink?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'General' | 'Pricing' | 'Services' | 'Timelines' | 'Policy';
  enabled: boolean;
  createdAt: string;
}

export interface BusinessKnowledgeBase {
  enabled: boolean;
  profile: BusinessProfile;
  faqs: FAQItem[];
  customGuidelines: string;
  fallbackMessage: string;
  additionalNotes: string;
  updatedAt?: string;
}
```

### Storage
- Embedded directly in `.settings.json` under `businessKB` or managed via `SettingsService`.
- Zero external database required. Persists across server restarts.

---

## 3. Backend & AI Engine

### API Endpoints
* `GET /api/v1/business-kb`: Retrieve current knowledge base configuration.
* `PUT /api/v1/business-kb`: Update profile, custom guidelines, catalog notes, or fallback message.
* `POST /api/v1/business-kb/faqs`: Add a new FAQ item.
* `PUT /api/v1/business-kb/faqs/:id`: Update an existing FAQ item.
* `DELETE /api/v1/business-kb/faqs/:id`: Delete an FAQ item.
* `POST /api/v1/business-kb/test-answer`: Instant test sandbox endpoint (test how AI answers a customer question with current KB without sending to WhatsApp).

### AI Prompt Construction
When `businessKB.enabled === true`, `SummarizerService` and `AutoReplyService` inject the structured business context:
```text
You are the official WhatsApp assistant for "[Business Name]".
[Industry, Hours, Location, Links]

--- VERIFIED BUSINESS KNOWLEDGE & FAQS ---
[Enabled FAQ List]
[Catalog / Policy Notes]

--- STRICT GUARDRAILS ---
1. Answer customer queries strictly and accurately using the verified knowledge base above.
2. Never invent discounts, unlisted rates, or custom promises.
3. If an answer is unknown or not covered, use the fallback escalation:
   "[fallbackMessage]"
4. Keep answers polite, human, and concise (2-4 sentences).
```

---

## 4. Frontend UI & Experience

### Navigation
- Settings Page includes a **Business Assistant Mode** toggle card.
- When toggled **ON**, the comprehensive **Business Knowledge Base Manager** is revealed:
  1. **Profile Card**: Business Name, Industry, Hours, Location, Email, Booking/UPI Link.
  2. **FAQ Manager**: Interactive table/cards with Add/Edit/Delete, category badges, and quick active/inactive toggles.
  3. **Catalog & Notes**: Rich textarea with auto-save for pricing sheets, brochures, or menu items.
  4. **Escalation Settings**: Editable out-of-scope fallback text and custom response guidelines.
  5. **Interactive Sandbox**: In-browser chat test widget to type sample customer questions and preview AI answers in real-time.

---

## 5. Phased Rollout Plan

- **Phase 1: Core Types & Backend API**
  - Implement `business-kb.types.ts` and update `SettingsService`.
  - Add `/api/v1/business-kb` CRUD routes and unit tests.
  - *Git commit: `feat(api): add business knowledge base settings and api endpoints`*

- **Phase 2: AI Prompt Guardrails & Auto-Reply Integration**
  - Update `SummarizerService` to incorporate verified business KB into prompt templates.
  - Wire sandbox test endpoint `POST /api/v1/business-kb/test-answer`.
  - Verify strict non-hallucination and fallback escalation.
  - *Git commit: `feat(ai): integrate business knowledge base with strict guardrails`*

- **Phase 3: Frontend Business Knowledge Manager UI**
  - Add Business Mode toggle in Settings.
  - Build Business Profile form, FAQ CRUD manager, and Catalog editor.
  - Build Interactive Test Sandbox.
  - *Git commit: `feat(frontend): add business knowledge base manager and test sandbox`*

- **Phase 4: End-to-End Verification**
  - Run full test suite (`npm test`).
  - Run production build (`npm run build:all`).
  - Final review and verification.
  - *Git commit: `release: business and freelancer faq assistant feature complete`*
