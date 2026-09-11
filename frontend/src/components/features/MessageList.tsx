import { PaperclipIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Empty } from '@/components/ui/empty';
import { avatarTone, formatClock, initials } from '@/lib/format';
import type { ChatMessage } from '@/lib/types';

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) {
    return (
      <Empty
        title="No messages to show"
        description="This chat has no readable text messages in the requested range."
      />
    );
  }
  return (
    <ol className="nice-scroll flex max-h-[520px] flex-col gap-3 overflow-y-auto pr-1">
      {messages.map((m) => (
        <li key={m.id} className="flex items-start gap-2.5">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className={avatarTone(m.senderName)}>{initials(m.senderName)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-2xl rounded-tl-md border border-border bg-stone-50 px-3.5 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[13px] font-semibold">{m.senderName}</p>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatClock(m.timestamp)}
              </span>
            </div>
            {m.isQuoted && m.quotedMessage ? (
              <div className="rounded-lg border-l-2 border-stone-300 bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
                <p className="font-semibold">{m.quotedMessage.senderName}</p>
                <p className="line-clamp-2">{m.quotedMessage.body}</p>
              </div>
            ) : null}
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
            {m.hasMedia ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <PaperclipIcon className="size-3.5" />
                {m.mediaType ?? 'Media'} attached
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
