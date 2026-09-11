import { UsersIcon, UserIcon, CheckIcon, PhoneIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { avatarTone, initials, timeAgo, getChatDisplayNumber } from '@/lib/format';
import type { ChatInfo } from '@/lib/types';

interface Props {
  chat: ChatInfo;
  selected?: boolean;
  isWhitelisted?: boolean;
  isAutoReply?: boolean;
  onSelect: (chat: ChatInfo) => void;
}

export function ChatListItem({ chat, selected, isWhitelisted, isAutoReply, onSelect }: Props) {
  const displayNumber = getChatDisplayNumber(chat);

  return (
    <button
      type="button"
      onClick={() => onSelect(chat)}
      className={cn(
        'group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150',
        selected
          ? 'bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900'
          : 'hover:bg-accent/80 text-foreground',
      )}
    >
      <Avatar className="size-10 shrink-0 ring-1 ring-border/40">
        <AvatarFallback
          className={cn(
            avatarTone(chat.name),
            selected && 'ring-2 ring-white/30 dark:ring-zinc-900/30 font-bold',
          )}
        >
          {initials(chat.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <p
              className={cn(
                'truncate text-[13px] font-semibold tracking-tight',
                selected ? 'text-white dark:text-zinc-900' : 'text-foreground',
              )}
            >
              {chat.name}
            </p>
            {isWhitelisted && (
              <span
                title={isAutoReply ? 'AI Auto-Reply active for this chat' : 'AI replies allowed by admin whitelist'}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold shrink-0',
                  selected
                    ? 'bg-emerald-500/25 text-emerald-200 dark:bg-emerald-500/25 dark:text-emerald-800'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                )}
              >
                <span className={cn('size-1.5 rounded-full bg-emerald-500', isAutoReply && 'animate-pulse')} />
                {isAutoReply ? 'Auto' : 'AI'}
              </span>
            )}
          </div>

          <span
            className={cn(
              'shrink-0 text-[11px]',
              selected ? 'text-zinc-300 dark:text-zinc-600' : 'text-muted-foreground',
            )}
          >
            {timeAgo(chat.lastMessageTimestamp)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 text-[11px] truncate',
              selected ? 'text-zinc-300 dark:text-zinc-600' : 'text-muted-foreground',
            )}
          >
            {chat.isGroup ? (
              <>
                <UsersIcon className="size-3 shrink-0" />
                <span className="truncate">
                  Group{typeof chat.participantCount === 'number' ? ` · ${chat.participantCount}` : ''}
                </span>
              </>
            ) : (
              <>
                {displayNumber ? (
                  <PhoneIcon className="size-3 shrink-0 opacity-70" />
                ) : (
                  <UserIcon className="size-3 shrink-0" />
                )}
                <span className="truncate">
                  {displayNumber ? displayNumber : 'Direct'}
                </span>
              </>
            )}
          </span>

          {chat.unreadCount > 0 && (
            <Badge
              variant={selected ? 'secondary' : 'unread'}
              className={cn(
                'shrink-0 h-4 min-w-4 px-1.5 text-[10px] font-bold leading-none',
                selected && 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white',
              )}
            >
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
