import { UsersIcon, UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { avatarTone, initials, timeAgo } from '@/lib/format';
import type { ChatInfo } from '@/lib/types';

interface Props {
  chat: ChatInfo;
  selected?: boolean;
  onSelect: (chat: ChatInfo) => void;
}

export function ChatListItem({ chat, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(chat)}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-colors duration-200',
        selected
          ? 'border-stone-900 bg-stone-900/[0.04] shadow-soft'
          : 'border-border bg-card hover:border-stone-300 hover:bg-stone-50',
      )}
    >
      <Avatar className="size-11 shrink-0">
        <AvatarFallback className={avatarTone(chat.name)}>{initials(chat.name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{chat.name}</p>
          {chat.unreadCount > 0 ? (
            <Badge variant="unread" className="shrink-0 px-2">
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </Badge>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">
              {timeAgo(chat.lastMessageTimestamp)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {chat.isGroup ? <UsersIcon className="size-3.5" /> : <UserIcon className="size-3.5" />}
            {chat.isGroup ? (
              <>
                Group
                {typeof chat.participantCount === 'number' ? ` · ${chat.participantCount}` : ''}
              </>
            ) : (
              'Direct'
            )}
          </span>
          {chat.unreadCount > 0 ? (
            <span className="text-xs text-muted-foreground">{timeAgo(chat.lastMessageTimestamp)}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
