import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { CheckCheckIcon, RotateCcwIcon } from 'lucide-react';
import { BRIEF, FLOOD } from './demo-data';
import { cn } from '@/lib/utils';

type Phase = 'flood' | 'brief';

const STEP_MS = 420; // one message arrives
const REST_FLOOD_MS = 1700; // pause on full pile before compressing
const REST_BRIEF_MS = 5400; // pause on brief before replaying

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}

export function CompressionDemo({ liveUnread }: { liveUnread?: number }) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>('flood');
  const [shown, setShown] = useState(0);
  const [count, setCount] = useState(BRIEF.analyzed);
  const countRef = useRef({ v: BRIEF.analyzed });
  const timers = useRef<number[]>([]);
  const briefRef = useRef<HTMLDivElement>(null);

  const total = liveUnread && liveUnread > 0 ? liveUnread : BRIEF.analyzed;

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const later = useCallback(
    (fn: () => void, ms: number) => {
      timers.current.push(window.setTimeout(fn, ms));
    },
    [],
  );

  const toBrief = useCallback(() => {
    setPhase('brief');
    setShown(FLOOD.length);
    const obj = countRef.current;
    gsap.killTweensOf(obj);
    gsap.to(obj, {
      v: 0,
      duration: reduced ? 0.01 : 1.1,
      ease: 'power2.inOut',
      onUpdate: () => setCount(Math.round(obj.v)),
    });
  }, [reduced]);

  const startCycle = useCallback(() => {
    clearTimers();
    gsap.killTweensOf(countRef.current);
    countRef.current.v = total;
    setCount(total);
    setPhase('flood');
    setShown(0);
    if (reduced) {
      setShown(FLOOD.length);
      return;
    }
    // Messages arrive one by one…
    for (let i = 1; i <= FLOOD.length; i += 1) {
      later(() => setShown(i), i * STEP_MS);
    }
    // …then the pile shrinks into the brief.
    later(toBrief, FLOOD.length * STEP_MS + REST_FLOOD_MS);
    later(startCycle, FLOOD.length * STEP_MS + REST_FLOOD_MS + REST_BRIEF_MS);
  }, [clearTimers, later, reduced, toBrief, total]);

  useEffect(() => {
    if (reduced) {
      clearTimers();
      setPhase('brief');
      setShown(FLOOD.length);
      setCount(0);
      return;
    }
    startCycle();
    return () => {
      clearTimers();
      gsap.killTweensOf(countRef.current);
    };
  }, [reduced, startCycle, clearTimers]);

  // Live unread arriving late must not resize or restart anything visible.
  useEffect(() => {
    if (phase === 'flood' && shown === 0) {
      countRef.current.v = total;
      setCount(total);
    }
  }, [total, phase, shown]);

  const squeezing = phase === 'brief';

  return (
    <div className="rl-phone p-2.5 sm:p-3" role="img" aria-label="Demo: unread WhatsApp messages arrive, then shrink into one brief">
      {/* Fixed height: inner animation can never resize the hero */}
      <div className="rl-phone-screen rl-wallpaper flex h-[600px] flex-col sm:h-[620px]">
        {/* phone header */}
        <div className="flex shrink-0 items-center gap-3 bg-[#12291f] px-4 py-3 text-[#e9ede6]">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1f6b4a] text-sm font-bold">
            E
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13.5px] font-semibold">Engineering Core</span>
            <span className="font-mono-landing block text-[11px] text-[#9db3a6]">
              {squeezing ? 'Relay is reading…' : shown < FLOOD.length ? 'typing…' : '142 members · online'}
            </span>
          </span>
          <span
            className={cn(
              'font-mono-landing shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums',
              squeezing ? 'bg-[#e9ede6] text-[#0d1f18]' : 'bg-[#d99a26] text-[#0d1f18]',
            )}
            aria-live="polite"
          >
            {count} unread
          </span>
        </div>

        {/* messages — fixed viewport, clips instead of growing */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-4">
          <div className="mb-3 flex shrink-0 justify-center">
            <span className="font-mono-landing rounded-lg bg-white/90 px-2.5 py-1 text-[10.5px] font-medium text-[#5d6c63] shadow-sm">
              TODAY
            </span>
          </div>
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col justify-end gap-1.5 overflow-hidden pb-1 transition-all duration-500 ease-out',
              squeezing && 'pointer-events-none translate-y-6 opacity-0',
            )}
            aria-hidden={squeezing}
          >
            {FLOOD.slice(0, shown).map((m, i) => (
                <div
                  key={`${m.from}-${m.time}-${i}`}
                  className={cn(
                    'rl-bubble rl-pop max-w-[86%]',
                    m.out ? 'rl-bubble-out self-end' : 'rl-bubble-in self-start',
                  )}
                >
                  {!m.out && <p className="text-[11px] font-bold text-[#1f6b4a]">{m.from}</p>}
                  {m.replyTo && (
                    <p className="mb-1 truncate rounded-md border-l-2 border-[#2fa8de] bg-black/[0.04] px-1.5 py-0.5 text-[11px] text-[#5d6c63]">
                      {m.replyTo}
                    </p>
                  )}
                  <p className="text-[#0d1f18]">{m.text}</p>
                  <span className="rl-meta">
                    {m.time}
                    <CheckCheckIcon className="rl-ticks size-3.5" strokeWidth={2.5} />
                  </span>
                </div>
            ))}
          </div>

          {/* brief card floats above the pile — absolute, so zero layout shift */}
          <div
            ref={briefRef}
            aria-hidden={!squeezing}
            className={cn(
              'absolute inset-x-3 bottom-3 z-20 transition-all duration-500 ease-out',
              squeezing
                ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto'
                : 'pointer-events-none translate-y-5 opacity-0 scale-95',
            )}
          >
            <div className="rounded-2xl border border-[#d3dbcf] bg-white p-4 shadow-[0_16px_40px_-16px_rgba(13,31,24,0.35)]">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono-landing text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#1f6b4a]">
                  Relay brief · 09:41
                </p>
                <span className="font-mono-landing rounded-full bg-[#fdf0d7] px-2 py-0.5 text-[10.5px] font-semibold text-[#6f4507]">
                  {BRIEF.urgency}
                </span>
              </div>
              <p className="mt-1.5 text-[14px] font-semibold leading-snug text-[#0d1f18]">{BRIEF.tldr}</p>
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {BRIEF.actions.map((a) => (
                  <li key={a.task} className="flex items-center gap-2 text-[12.5px] text-[#3d4a43]">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#1f6b4a] text-[10px] font-bold text-white">
                      ✓
                    </span>
                    <span className="min-w-0 flex-1 truncate">{a.task}</span>
                    <span className="font-mono-landing shrink-0 text-[11px] text-[#5d6c63]">
                      {a.who} · {a.when}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="font-mono-landing mt-2.5 border-t border-dashed border-[#d3dbcf] pt-2 text-[11px] text-[#5d6c63]">
                {BRIEF.analyzed} msgs → 1 brief · decisions kept · links kept
              </p>
            </div>
          </div>
        </div>

        {/* phone footer */}
        <div className="flex shrink-0 items-center gap-2 px-3 pb-3">
          <div className="min-w-0 flex-1 truncate rounded-full bg-white px-4 py-2.5 text-[13px] text-[#8a978f] shadow-sm">
            {squeezing ? 'Brief ready — tap to open' : 'Message'}
          </div>
          <button
            type="button"
            onClick={() => (squeezing ? startCycle() : toBrief())}
            className="rl-lift font-mono-landing flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#1f6b4a] px-3.5 py-2.5 text-[12px] font-semibold text-white"
            aria-label={squeezing ? 'Replay the message flood' : 'Compress messages into a brief'}
          >
            <RotateCcwIcon className="size-3.5" />
            {squeezing ? 'Replay' : 'Condense'}
          </button>
        </div>
      </div>
    </div>
  );
}
