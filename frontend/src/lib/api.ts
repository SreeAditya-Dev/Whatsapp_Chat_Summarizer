const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok) {
    const err = json as unknown as { error?: { message?: string; code?: string } };
    throw new Error(err?.error?.message ?? `Request failed (${res.status})`);
  }
  if (!json) throw new Error('Empty response from server');
  return json;
}

export const api = {
  health: () => request<import('./types').ApiEnvelope<import('./types').HealthData>>('/api/v1/health'),
  waStatus: () =>
    request<import('./types').ApiEnvelope<import('./types').WhatsAppStatus>>('/api/v1/whatsapp/status'),
  waQr: () =>
    request<
      import('./types').ApiEnvelope<{
        ready: boolean;
        message?: string;
        state?: string;
        qrCodeRaw?: string;
        qrCodeDataUrl?: string;
      }>
    >('/api/v1/whatsapp/qr'),

  chats: (params: { page?: number; limit?: number; filter?: 'all' | 'groups' | 'direct' }) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.filter) q.set('filter', params.filter);
    return request<import('./types').ApiEnvelope<import('./types').ChatInfo[]>>(
      `/api/v1/chats?${q.toString()}`,
    );
  },

  unreadChats: (params: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    return request<import('./types').ApiEnvelope<import('./types').ChatInfo[]>>(
      `/api/v1/chats/unread?${q.toString()}`,
    );
  },

  chatById: (chatId: string) =>
    request<import('./types').ApiEnvelope<import('./types').ChatInfo>>(
      `/api/v1/chats/${encodeURIComponent(chatId)}`,
    ),

  searchChats: (query: string, limit = 20) =>
    request<import('./types').ApiEnvelope<import('./types').ChatInfo[]>>(
      `/api/v1/chats/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),

  messages: (chatId: string, limit = 50) =>
    request<import('./types').ApiEnvelope<import('./types').ChatMessage[]>>(
      `/api/v1/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}`,
    ),

  summarize: (body: { chatId: string; messageLimit?: number; mode?: import('./types').SummaryMode; model?: string }) =>
    request<import('./types').ApiEnvelope<import('./types').ChatSummary>>('/api/v1/summarize', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  settings: {
    get: () => request<import('./types').ApiEnvelope<import('./types').AppSettings>>('/api/v1/settings'),
    update: (data: Partial<import('./types').AppSettings>) =>
      request<import('./types').ApiEnvelope<import('./types').AppSettings>>('/api/v1/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  reply: {
    draft: (body: { chatId: string; instruction?: string; tone?: import('./types').ReplyTone; messageLimit?: number }) =>
      request<import('./types').ApiEnvelope<import('./types').ReplyDraftResponse>>('/api/v1/reply/draft', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    send: (body: { chatId: string; message: string }) =>
      request<import('./types').ApiEnvelope<import('./types').ReplySendResponse>>('/api/v1/reply/send', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    autoHistory: () =>
      request<import('./types').ApiEnvelope<import('./types').AutoReplyLog[]>>('/api/v1/reply/auto-history'),
  },
};
