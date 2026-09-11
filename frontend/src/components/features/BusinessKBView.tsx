import { useEffect, useState } from 'react';
import {
  BriefcaseIcon,
  CheckCircle2Icon,
  HelpCircleIcon,
  Loader2Icon,
  PlusIcon,
  SaveIcon,
  SendIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { BusinessKnowledgeBase, FAQCategory, FAQItem } from '@/lib/types';
import { cn } from '@/lib/utils';

const CATEGORIES: FAQCategory[] = ['General', 'Pricing', 'Services', 'Timelines', 'Policy'];

export function BusinessKBView() {
  const [kb, setKb] = useState<BusinessKnowledgeBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FAQ Management state
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [showAddFaq, setShowAddFaq] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState<FAQCategory>('General');

  // Interactive Sandbox state
  const [testQuestion, setTestQuestion] = useState('');
  const [testTone, setTestTone] = useState<'casual' | 'friendly' | 'professional' | 'concise'>('professional');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ question: string; answer: string; businessName: string } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        setLoading(true);
        const res = await api.businessKB.get();
        if (mounted && res.data) {
          setKb(res.data);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load Business Knowledge Base');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async (updatedData?: Partial<BusinessKnowledgeBase>) => {
    if (!kb) return;
    try {
      setSaving(true);
      setError(null);
      const payload = updatedData ? { ...kb, ...updatedData } : kb;
      const res = await api.businessKB.update(payload);
      if (res.data) {
        setKb(res.data);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to save Business Knowledge Base');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFaq = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    try {
      setSaving(true);
      const res = await api.businessKB.addFaq({
        question: newQuestion.trim(),
        answer: newAnswer.trim(),
        category: newCategory,
        enabled: true,
      });
      if (res.data && kb) {
        setKb({
          ...kb,
          faqs: [...kb.faqs, res.data],
        });
        setNewQuestion('');
        setNewAnswer('');
        setShowAddFaq(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add FAQ');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFaq = async (faqId: string) => {
    if (!kb) return;
    const target = kb.faqs.find((f) => f.id === faqId);
    if (!target) return;
    const nextState = !target.enabled;

    // Optimistic UI update
    const updatedFaqs = kb.faqs.map((f) => (f.id === faqId ? { ...f, enabled: nextState } : f));
    setKb({ ...kb, faqs: updatedFaqs });

    try {
      await api.businessKB.updateFaq(faqId, { enabled: nextState });
    } catch {
      // Revert on error
      setKb(kb);
    }
  };

  const handleDeleteFaq = async (faqId: string) => {
    if (!kb) return;
    const previous = kb.faqs;
    setKb({ ...kb, faqs: kb.faqs.filter((f) => f.id !== faqId) });

    try {
      await api.businessKB.deleteFaq(faqId);
    } catch {
      setKb({ ...kb, faqs: previous });
    }
  };

  const handleRunTest = async () => {
    if (!testQuestion.trim()) return;
    try {
      setTestLoading(true);
      setTestError(null);
      const res = await api.businessKB.testAnswer({
        question: testQuestion.trim(),
        tone: testTone,
      });
      if (res.data) {
        setTestResult(res.data);
      }
    } catch (err: any) {
      setTestError(err.message || 'Failed to test response');
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!kb) return null;

  const filteredFaqs = kb.faqs.filter((f) => {
    if (categoryFilter === 'All') return true;
    return f.category === categoryFilter;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Notifications */}
      {error && (
        <Alert variant="danger">
          <AlertTitle>Knowledge Base Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saveSuccess && (
        <Alert variant="success">
          <CheckCircle2Icon className="size-4" />
          <AlertTitle>Saved successfully</AlertTitle>
          <AlertDescription>Your Business Knowledge Base and AI guardrails are active.</AlertDescription>
        </Alert>
      )}

      {/* Master Toggle Card */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <BriefcaseIcon className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Business Assistant Mode</CardTitle>
                <CardDescription className="text-xs">
                  Equip your AI with verified business pricing, working hours, and FAQs.
                </CardDescription>
              </div>
            </div>

            {/* Toggle Switch */}
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={kb.enabled}
                onChange={(e) => {
                  const nextVal = e.target.checked;
                  setKb({ ...kb, enabled: nextVal });
                  void handleSave({ enabled: nextVal });
                }}
              />
              <div className="peer h-6 w-11 rounded-full bg-zinc-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:bg-zinc-700 dark:peer-checked:bg-blue-500 dark:peer-checked:after:border-zinc-800" />
            </label>
          </div>
        </CardHeader>

        <CardContent>
          {!kb.enabled ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-stone-50/70 p-6 text-center dark:bg-zinc-900/40">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Business Assistant Mode is currently OFF
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Turn on the toggle above to configure your business profile, service rates, and automated FAQ responses.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Business Assistant is <strong className="font-semibold text-blue-600 dark:text-blue-400">Active</strong>. 
              The AI will answer incoming inquiries strictly using your verified business knowledge base.
            </p>
          )}
        </CardContent>
      </Card>

      {/* UNLOCKED BUSINESS FEATURES WHEN ENABLED */}
      {kb.enabled && (
        <>
          {/* Section 1: Business Profile */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">1. Business Profile & Contact Info</CardTitle>
              <CardDescription className="text-xs">
                Essential information the AI uses to represent your brand accurately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Business / Brand Name</label>
                  <Input
                    placeholder="e.g. Apex Design Studio"
                    value={kb.profile.businessName}
                    onChange={(e) =>
                      setKb({
                        ...kb,
                        profile: { ...kb.profile, businessName: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Industry / Specialty</label>
                  <Input
                    placeholder="e.g. UI/UX Design & Web Development"
                    value={kb.profile.industry}
                    onChange={(e) =>
                      setKb({
                        ...kb,
                        profile: { ...kb.profile, industry: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Tagline / Mission</label>
                  <Input
                    placeholder="e.g. Crafting high-converting landing pages for startups"
                    value={kb.profile.tagline}
                    onChange={(e) =>
                      setKb({
                        ...kb,
                        profile: { ...kb.profile, tagline: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Operating Hours</label>
                  <Input
                    placeholder="e.g. Mon-Sat: 9:00 AM - 7:00 PM (Closed Sundays)"
                    value={kb.profile.operatingHours}
                    onChange={(e) =>
                      setKb({
                        ...kb,
                        profile: { ...kb.profile, operatingHours: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Location / Office Address</label>
                  <Input
                    placeholder="e.g. Bangalore, India (Remote worldwide)"
                    value={kb.profile.locationOrAddress}
                    onChange={(e) =>
                      setKb({
                        ...kb,
                        profile: { ...kb.profile, locationOrAddress: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Contact Email / Website</label>
                  <Input
                    placeholder="e.g. hello@apexstudio.dev"
                    value={kb.profile.contactEmail}
                    onChange={(e) =>
                      setKb({
                        ...kb,
                        profile: { ...kb.profile, contactEmail: e.target.value },
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Booking / Payment Link (Optional)</label>
                <Input
                  placeholder="e.g. https://calendly.com/apex-design or UPI ID"
                  value={kb.profile.paymentOrBookingLink || ''}
                  onChange={(e) =>
                    setKb({
                      ...kb,
                      profile: { ...kb.profile, paymentOrBookingLink: e.target.value },
                    })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  The AI can share this link when customers ask how to schedule a call or pay a deposit.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Interactive FAQ Manager */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-bold">2. Verified Frequently Asked Questions (FAQs)</CardTitle>
                  <CardDescription className="text-xs">
                    Specific questions the AI can answer immediately with 100% confidence.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddFaq(!showAddFaq)}
                  className="gap-1.5 text-xs self-start sm:self-auto"
                >
                  <PlusIcon className="size-3.5" />
                  {showAddFaq ? 'Cancel' : 'Add FAQ'}
                </Button>
              </div>

              {/* Category Filter Chips */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['All', ...CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all',
                      categoryFilter === cat
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                        : 'bg-secondary/60 text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Add New FAQ Form */}
              {showAddFaq && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3 dark:bg-blue-950/20">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-950 dark:text-blue-200">New FAQ Entry</p>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as FAQCategory)}
                      className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground focus:outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    placeholder="Question (e.g. What is the turnaround time for a website?)"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    className="text-xs"
                  />
                  <textarea
                    rows={2}
                    placeholder="Answer (e.g. Standard websites are delivered in 7 to 10 business days.)"
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    className="w-full rounded-md border border-border bg-card p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setShowAddFaq(false)} className="text-xs">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleAddFaq()}
                      disabled={!newQuestion.trim() || !newAnswer.trim() || saving}
                      className="gap-1.5 text-xs"
                    >
                      {saving && <Loader2Icon className="size-3.5 animate-spin" />}
                      Save FAQ
                    </Button>
                  </div>
                </div>
              )}

              {/* FAQ Cards List */}
              {filteredFaqs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 p-6 text-center">
                  <HelpCircleIcon className="mx-auto size-6 text-muted-foreground/60" />
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    No FAQs found in this category. Click "Add FAQ" to create one.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2.5">
                  {filteredFaqs.map((faq) => (
                    <div
                      key={faq.id}
                      className={cn(
                        'flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border p-3 transition-colors',
                        faq.enabled
                          ? 'border-border/80 bg-card'
                          : 'border-border/40 bg-muted/30 opacity-60'
                      )}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-semibold">
                            {faq.category}
                          </Badge>
                          <p className="text-xs font-bold text-foreground">{faq.question}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed pl-1">{faq.answer}</p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {/* Enable/Disable switch */}
                        <button
                          type="button"
                          onClick={() => void handleToggleFaq(faq.id)}
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all',
                            faq.enabled
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          )}
                        >
                          {faq.enabled ? 'Active' : 'Paused'}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDeleteFaq(faq.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Delete FAQ"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Catalog & Policy Notes */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">3. Product Catalog, Menus & Policy Notes</CardTitle>
              <CardDescription className="text-xs">
                Paste your detailed price chart, package tiers, terms of service, or brochure excerpts here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <textarea
                rows={5}
                placeholder="Example:&#10;• Starter Package: ₹15,000 (Includes 3 pages, contact form, responsive design)&#10;• Business Package: ₹35,000 (Includes e-commerce, payment gateway, SEO)&#10;• 50% advance deposit required before project kickoff&#10;• Maintenance retainer: ₹4,000/month"
                value={kb.additionalNotes}
                onChange={(e) => setKb({ ...kb, additionalNotes: e.target.value })}
                className="w-full rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                The AI reads these raw notes to answer complex pricing and service comparisons.
              </p>
            </CardContent>
          </Card>

          {/* Section 4: Safety & Fallback Rules */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">4. Safety Guardrails & Out-of-Scope Fallback</CardTitle>
              <CardDescription className="text-xs">
                Control what the AI says when a customer asks for something not in your knowledge base.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Unknown Question Fallback Message (Escalation)
                </label>
                <Input
                  value={kb.fallbackMessage}
                  onChange={(e) => setKb({ ...kb, fallbackMessage: e.target.value })}
                  placeholder="e.g. I will pass your specific request to the owner so they can follow up with you directly shortly!"
                />
                <p className="text-[11px] text-muted-foreground">
                  When a customer asks for custom discounts, unlisted services, or unverified promises, the AI politely defers with this message.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Custom Brand Guidelines & Instructions
                </label>
                <textarea
                  rows={2}
                  value={kb.customGuidelines}
                  onChange={(e) => setKb({ ...kb, customGuidelines: e.target.value })}
                  placeholder="e.g. Always be welcoming and warm. Remind clients that GST is included in all package quotes."
                  className="w-full rounded-md border border-border bg-card p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Interactive Sandbox Simulator */}
          <Card className="border-blue-500/30 bg-blue-500/5 shadow-xs dark:bg-blue-950/15">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <SparklesIcon className="size-4 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-sm font-bold text-blue-950 dark:text-blue-200">
                  5. Interactive Test Sandbox (Try Before Replying)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-blue-900/70 dark:text-blue-300/70">
                Type any customer question to preview exactly how the AI will answer using your knowledge base.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="e.g. How much does a starter website cost, and when can you start?"
                  value={testQuestion}
                  onChange={(e) => setTestQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleRunTest();
                  }}
                  className="text-xs bg-white dark:bg-zinc-900"
                />
                <select
                  value={testTone}
                  onChange={(e) => setTestTone(e.target.value as any)}
                  className="rounded-md border border-border bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none shrink-0"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="concise">Concise</option>
                </select>
                <Button
                  size="sm"
                  onClick={() => void handleRunTest()}
                  disabled={!testQuestion.trim() || testLoading}
                  className="gap-1.5 text-xs shrink-0"
                >
                  {testLoading ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <SendIcon className="size-3.5" />
                  )}
                  Test Answer
                </Button>
              </div>

              {testError && (
                <p className="text-xs text-destructive font-medium">{testError}</p>
              )}

              {testResult && (
                <div className="mt-3 rounded-xl border border-blue-500/25 bg-white p-3.5 shadow-xs dark:bg-zinc-900 dark:border-blue-500/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                      Simulated AI Response
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0">
                      {testTone}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {testResult.answer}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sticky Save Bar */}
          <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl border border-border bg-card/90 p-3 shadow-lg backdrop-blur-md">
            {saveSuccess && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2Icon className="size-4" /> Changes saved!
              </span>
            )}
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
              className="gap-2 shadow-sm"
            >
              {saving ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}
              Save All Business Settings
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
