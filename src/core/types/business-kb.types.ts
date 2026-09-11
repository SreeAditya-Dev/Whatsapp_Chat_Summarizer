export type FAQCategory = 'General' | 'Pricing' | 'Services' | 'Timelines' | 'Policy';

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
  category: FAQCategory;
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

export const DEFAULT_BUSINESS_KB: BusinessKnowledgeBase = {
  enabled: false,
  profile: {
    businessName: '',
    industry: '',
    tagline: '',
    operatingHours: 'Mon-Sat: 9:00 AM - 7:00 PM',
    locationOrAddress: '',
    contactEmail: '',
    paymentOrBookingLink: '',
  },
  faqs: [
    {
      id: 'faq-1',
      question: 'What are your working hours?',
      answer: 'We are open Monday to Saturday from 9:00 AM to 7:00 PM. We are closed on Sundays.',
      category: 'Timelines',
      enabled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'faq-2',
      question: 'How do I book or get started?',
      answer: 'You can reach out directly here with your requirements, and we will send a tailored estimate and timeline.',
      category: 'General',
      enabled: true,
      createdAt: new Date().toISOString(),
    },
  ],
  customGuidelines: 'Always be professional, polite, and welcoming. Do not offer unauthorized discounts or promise unverified delivery deadlines.',
  fallbackMessage: "I'll notify the owner about your specific request so they can follow up with you directly shortly!",
  additionalNotes: '',
};
