import { useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  FileTextIcon,
  Link2Icon,
  ListChecksIcon,
  LockIcon,
  QrCodeIcon,
  ScaleIcon,
  SendIcon,
  ServerIcon,
  SirenIcon,
  TerminalIcon,
} from 'lucide-react';
import { CompressionDemo } from './CompressionDemo';
import { BRIEF, MARQUEE_QUOTES, TELEGRAM_COMMANDS } from './demo-data';
import { useLandingMotion } from '@/hooks/useLandingMotion';
import { cn } from '@/lib/utils';
import './landing.css';

function DayDivider({ stamp, label }: { stamp: string; label: string }) {
  return (
    <div className="flex justify-center" data-reveal>
      <span className="rl-daypill font-mono-landing text-[11px] font-semibold uppercase tracking-[0.16em]">
        <span className="text-[#1f6b4a]">{stamp}</span>
        <span aria-hidden>·</span>
        <span>{label}</span>
      </span>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
      <p className="font-mono-landing text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1f6b4a]" data-reveal>
        {eyebrow}
      </p>
      <h2 className="font-display-landing text-balance text-3xl font-bold leading-[1.05] sm:text-[2.75rem]" data-reveal>
        {title}
      </h2>
      <p className="text-balance text-[15px] leading-relaxed text-[#5d6c63]" data-reveal>
        {sub}
      </p>
    </div>
  );
}

export function LandingView({
  model,
  totalUnread,
}: {
  model?: string;
  totalUnread?: number;
}) {
  const rootRef = useRef<HTMLElement>(null);
  useLandingMotion(rootRef, true);
  const unread = totalUnread && totalUnread > 0 ? totalUnread : BRIEF.analyzed;

  return (
    <div ref={rootRef as React.RefObject<HTMLDivElement>} className="relay-landing min-h-screen">
      {/* scroll progress */}
      <div className="rl-progress fixed inset-x-0 top-0 z-[60] h-[3px] bg-[#2fa8de]" aria-hidden />

      {/* nav */}
      <header data-hero="nav" className="sticky top-3 z-50 mx-auto w-full max-w-6xl px-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0d1f18]/90 py-2.5 pl-3 pr-2.5 text-[#e9ede6] shadow-[0_16px_40px_-20px_rgba(6,14,10,0.7)] backdrop-blur">
          <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="Relay home">
            <img src="/logo.jpg" alt="" className="size-8 shrink-0 rounded-lg object-cover" />
            <span className="leading-tight">
              <span className="font-display-landing block text-[15px] font-bold">Relay</span>
              <span className="font-mono-landing block text-[10.5px] text-[#9db3a6]">whatsapp briefs</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-[13.5px] font-medium text-[#c4d2c8] md:flex" aria-label="Page">
            <a href="#pile" className="transition-colors hover:text-white">The pile-up</a>
            <a href="#brief" className="transition-colors hover:text-white">The brief</a>
            <a href="#how" className="transition-colors hover:text-white">How it reads</a>
            <a href="#everywhere" className="transition-colors hover:text-white">Where it lives</a>
            <a href="#private" className="transition-colors hover:text-white">Privacy</a>
          </nav>
          <span className="flex shrink-0 items-center gap-2">
            <Link
              to="/connect"
              className="font-mono-landing hidden rounded-full px-3 py-2 text-[12px] text-[#9db3a6] transition-colors hover:text-white sm:inline"
            >
              Pair phone
            </Link>
            <Link
              to="/app"
              className="rl-lift inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#e9ede6] px-3.5 py-2 text-[12.5px] font-bold text-[#0d1f18] hover:bg-white sm:px-4 sm:text-[13px]"
            >
              Open dashboard
              <ArrowRightIcon className="size-4" />
            </Link>
          </span>
        </div>
      </header>

      {/* hero */}
      <section className="rl-wallpaper-dark mx-auto -mt-[68px] w-full px-4 pb-14 pt-[120px] text-[#e9ede6] sm:pb-20 sm:pt-[140px]">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <p data-hero="nav" className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11.5px] font-semibold text-[#c4d2c8] sm:gap-2 sm:text-[12px]">
              <span className="size-1.5 shrink-0 rounded-full bg-[#7df0b2]" aria-hidden />
              <span>For WhatsApp groups that never sleep</span>
              <span className="font-mono-landing text-[11px] font-medium text-[#9db3a6]">· {unread} unread right now</span>
            </p>
            <h1 className="font-display-landing mt-5 text-balance text-[2.2rem] font-extrabold leading-[0.98] sm:text-6xl lg:text-[4.2rem]">
              <span data-hero="line" className="block">You missed</span>
              <span data-hero="line" className="block">
                <span className="tabular-nums text-[#7df0b2]">{unread}</span> messages.
              </span>
              <span data-hero="line" className="block text-[#9db3a6]">You need one minute.</span>
            </h1>
            <p data-hero="sub" className="mt-5 max-w-xl text-balance text-[15.5px] leading-relaxed text-[#b8c7bd]">
              Relay reads your busy WhatsApp chats — who said what, what was decided, who owes
              what by when — and hands you a brief you can act on. Scan once, then catch up
              from the web or Telegram.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <Link
                data-hero="cta"
                to="/app"
                className="rl-lift inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#e9ede6] px-6 py-3 text-[14px] font-bold text-[#0d1f18] hover:bg-white"
              >
                Open dashboard
                <ArrowRightIcon className="size-4" />
              </Link>
              <a
                data-hero="cta"
                href="#pile"
                className="rl-lift inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 bg-transparent px-6 py-3 text-[14px] font-semibold text-[#e9ede6] hover:border-white/40 hover:bg-white/[0.06]"
              >
                See how it reads
              </a>
            </div>
            <p data-hero="proof" className="font-mono-landing mt-5 text-[11.5px] leading-relaxed text-[#7d9487]">
              Runs on your server · {model ?? 'mistral-small-latest'} · replies stay yours to send
            </p>
          </div>
          <div data-hero="phone" className="mx-auto w-full max-w-[400px]">
            <CompressionDemo liveUnread={totalUnread} />
            <p className="font-mono-landing mt-3 text-center text-[11px] text-[#7d9487]">
              Live sketch — Engineering Core, this morning
            </p>
          </div>
        </div>

        {/* marquee */}
        <div className="rl-marquee mx-auto mt-12 w-full max-w-6xl overflow-hidden" aria-label="Things people say about group overload">
          <div className="rl-marquee-track flex w-max gap-3 pr-3">
            {[...MARQUEE_QUOTES, ...MARQUEE_QUOTES].map((q, i) => (
              <span
                key={i}
                aria-hidden={i >= MARQUEE_QUOTES.length}
                className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[13px] text-[#b8c7bd]"
              >
                {q}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* pile-up */}
      <section id="pile" className="rl-wallpaper scroll-mt-24 px-4 py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl">
          <DayDivider stamp="Today" label="the pile-up" />
          <div className="mt-6">
            <SectionHead
              eyebrow="The problem"
              title="The decision is in there. Somewhere."
              sub="Busy groups mix releases, invoices, memes and deadlines in one stream. The longer you wait, the deeper the thing you needed gets buried."
            />
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3" data-reveal-group>
            {[
              {
                icon: ScaleIcon,
                stat: 'msg #187',
                title: 'Decisions get buried',
                body: '“Friday 5pm deploy — agreed?” sits 40 jokes below the fold. Relay lifts the yeses out and names the time.',
              },
              {
                icon: ListChecksIcon,
                stat: '3 owners',
                title: 'Tasks lose their names',
                body: '“Someone run load tests” becomes Dev, Thursday 2pm. Every action keeps its assignee and due date.',
              },
              {
                icon: SirenIcon,
                stat: 'muted → missed',
                title: 'Muting costs you',
                body: 'Mute the noise and you miss the invoice fix due today. Relay watches quietly and flags HIGH and CRITICAL only.',
              },
            ].map((c) => (
              <article
                key={c.title}
                data-reveal-item
                className="rl-lift rounded-3xl border border-[#d3dbcf] bg-white p-6 shadow-[0_10px_30px_-18px_rgba(13,31,24,0.4)]"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[#0d1f18] text-[#e9ede6]">
                  <c.icon className="size-5" />
                </span>
                <p className="font-mono-landing mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#1f6b4a]">
                  {c.stat}
                </p>
                <h3 className="font-display-landing mt-1 text-xl font-bold">{c.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#5d6c63]">{c.body}</p>
              </article>
            ))}
          </div>

          {/* scrub strip: 214 lines become 6 */}
          <div data-pile-track className="mt-12 grid items-center gap-8 rounded-3xl border border-[#d3dbcf] bg-[#0d1f18] p-6 text-[#e9ede6] sm:p-10 lg:grid-cols-2">
            <div data-reveal>
              <p className="font-mono-landing text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7df0b2]">
                Scroll compression
              </p>
              <h3 className="font-display-landing mt-2 text-balance text-2xl font-bold leading-tight sm:text-3xl">
                214 lines in. Six lines out. Nothing you owe gets dropped.
              </h3>
              <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-[#9db3a6]">
                Keep scrolling — the pile on the right drains into the brief. Senders, times and
                reply threads stay attached, so you can trust what you are reading.
              </p>
              <Link
                to="/app"
                className="rl-lift mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#e9ede6] px-5 py-2.5 text-[13.5px] font-bold text-[#0d1f18] hover:bg-white"
              >
                Try it on your chats
                <ArrowUpRightIcon className="size-4" />
              </Link>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-[#0a1712] p-4" aria-hidden>
              <div className="flex flex-col gap-1">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-2 rounded-full bg-white/10"
                    style={{ width: `${88 - ((i * 37) % 42)}%` }}
                  />
                ))}
              </div>
              <div data-pile-fill className="absolute inset-0 origin-top bg-[#1f6b4a]/90 p-4">
                <p className="font-mono-landing text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#e9ede6]/80">
                  Relay brief
                </p>
                <p className="font-display-landing mt-1 text-[15px] font-bold leading-snug">
                  {BRIEF.tldr}
                </p>
                <p className="font-mono-landing mt-2 text-[11px] text-[#e9ede6]/75">
                  3 topics · 3 owners · 1 decision · 2 links
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* brief anatomy */}
      <section id="brief" className="scroll-mt-24 bg-[#e9ede6] px-4 py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl">
          <DayDivider stamp="This morning" label="what you get" />
          <div className="mt-6">
            <SectionHead
              eyebrow="The brief"
              title="One card. Everything you owe."
              sub="Every summary keeps the same shape, so your eyes learn where to look: the point, the owners, the calls made, the links — and how urgent it is."
            />
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-reveal-group>
            {[
              {
                icon: FileTextIcon,
                mono: 'tldr · 09:41',
                title: 'The point, first',
                body: 'Two sentences, names kept. “Staging is green, the replica scare was lag, ship Friday 5pm.”',
              },
              {
                icon: ListChecksIcon,
                mono: 'owners · 3 open',
                title: 'Tasks with names on',
                body: 'Each action keeps its assignee and due date — Dev by Thu 2pm, Arjun today, Kabir Thu EOD.',
              },
              {
                icon: CheckCheckIcon,
                mono: 'decisions · 1 locked',
                title: 'Calls, not chatter',
                body: '“Deploy Friday 5pm” is pulled out of 40 yeses and pinned where you cannot miss it.',
              },
              {
                icon: Link2Icon,
                mono: 'links + dates · kept',
                title: 'Links survive',
                body: 'Staging dashboard, Figma file, deadlines — collected at the bottom, ready to open.',
              },
              {
                icon: SirenIcon,
                mono: 'urgency · HIGH',
                title: 'Knows when to shout',
                body: 'LOW to CRITICAL, set from content — not from volume. The invoice due today outranks 90 memes.',
              },
              {
                icon: CalendarClockIcon,
                mono: 'context · who → when',
                title: 'Who said what, when',
                body: 'Senders, timestamps and reply threads stay attached. Quote chains never flatten into soup.',
              },
            ].map((c) => (
              <article
                key={c.title}
                data-reveal-item
                className={cn(
                  'rl-lift rounded-3xl border bg-white p-6',
                  c.mono.startsWith('urgency')
                    ? 'border-[#e6c988] shadow-[0_10px_30px_-18px_rgba(217,154,38,0.6)]'
                    : 'border-[#d3dbcf] shadow-[0_10px_30px_-18px_rgba(13,31,24,0.4)]',
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[#eef3ec] text-[#1f6b4a]">
                    <c.icon className="size-5" />
                  </span>
                  <span className="font-mono-landing text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5d6c63]">
                    {c.mono}
                  </span>
                </span>
                <h3 className="font-display-landing mt-4 text-xl font-bold">{c.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#5d6c63]">{c.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* how it reads */}
      <section id="how" className="rl-wallpaper scroll-mt-24 border-y border-[#d3dbcf] px-4 py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl">
          <DayDivider stamp="09:41 → 09:43" label="how it reads" />
          <div className="mt-6">
            <SectionHead
              eyebrow="Three minutes, once"
              title="Pair your phone. Pick a chat. Get the brief."
              sub="No contacts imported, no messages stored. Your session lives on your machine and reconnects by itself."
            />
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-3" data-reveal-group>
            {[
              {
                time: '09:41',
                icon: QrCodeIcon,
                title: 'Scan the code once',
                body: 'Open the dashboard or send /qr to your Telegram bot, point WhatsApp → Linked devices at it. Done — the session stays saved.',
                cta: { to: '/connect', label: 'Pair WhatsApp' },
              },
              {
                time: '09:42',
                icon: SendIcon,
                title: 'Point at the noisy chat',
                body: 'Unread list with counts, groups and directs with pages, or /summarize <name> to jump straight to it. One tap either way.',
                cta: { to: '/app', label: 'Browse chats' },
              },
              {
                time: '09:43',
                icon: FileTextIcon,
                title: 'Read the brief, send the reply',
                body: 'TL;DR, topics, owners, decisions, links, urgency — plus a drafted reply in your tone that you review before anything sends.',
                cta: { to: '/app', label: 'Open dashboard' },
              },
            ].map((s) => (
              <article
                key={s.time}
                data-reveal-item
                className="rl-lift flex flex-col gap-4 rounded-3xl border border-[#d3dbcf] bg-white p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
              >
                <span className="font-mono-landing shrink-0 rounded-full bg-[#0d1f18] px-3.5 py-1.5 text-[12px] font-semibold tabular-nums text-[#7df0b2]">
                  {s.time}
                </span>
                <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef3ec] text-[#1f6b4a] sm:inline-flex">
                  <s.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-display-landing block text-lg font-bold">{s.title}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-[#5d6c63]">{s.body}</span>
                </span>
                <Link
                  to={s.cta.to}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[#0d1f18]/15 px-4 py-2 text-[13px] font-bold text-[#0d1f18] transition-colors hover:bg-[#0d1f18] hover:text-white"
                >
                  {s.cta.label}
                  <ArrowRightIcon className="size-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* everywhere */}
      <section id="everywhere" className="scroll-mt-24 bg-[#0d1f18] px-4 py-16 text-[#e9ede6] sm:py-24">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
            <p className="font-mono-landing text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7df0b2]" data-reveal>
              Where it lives
            </p>
            <h2 className="font-display-landing text-balance text-3xl font-bold leading-[1.05] sm:text-[2.75rem]" data-reveal>
              Web, Telegram, and an API that behaves.
            </h2>
            <p className="text-balance text-[15px] leading-relaxed text-[#9db3a6]" data-reveal>
              Skim from your laptop, condense from the train, or pipe briefs into your own tools.
              Same shape everywhere.
            </p>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3" data-reveal-group>
            <article data-reveal-item className="rl-lift rounded-3xl border border-white/10 bg-[#12291f] p-6">
              <ServerIcon className="size-6 text-[#7df0b2]" />
              <h3 className="font-display-landing mt-3 text-xl font-bold">Web dashboard</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#9db3a6]">
                Unread first, highest counts on top. Trends, recent briefs, and one-click condense
                on every row.
              </p>
              <Link to="/app" className="mt-4 inline-flex cursor-pointer items-center gap-1.5 text-[13.5px] font-bold text-[#7df0b2] hover:text-white">
                Open the workspace <ArrowRightIcon className="size-4" />
              </Link>
            </article>
            <article data-reveal-item className="rl-lift rounded-3xl border border-white/10 bg-[#12291f] p-6">
              <SendIcon className="size-6 text-[#7df0b2]" />
              <h3 className="font-display-landing mt-3 text-xl font-bold">Telegram bot</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {TELEGRAM_COMMANDS.map((t) => (
                  <li key={t.cmd} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                    <p className="font-mono-landing text-[12.5px] font-semibold text-white">{t.cmd}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#9db3a6]">{t.desc}</p>
                  </li>
                ))}
              </ul>
              <p className="font-mono-landing mt-3 text-[11px] text-[#7d9487]">One-tap buttons · only your user id answers</p>
            </article>
            <article data-reveal-item className="rl-lift rounded-3xl border border-white/10 bg-[#0a1712] p-6">
              <TerminalIcon className="size-6 text-[#7df0b2]" />
              <h3 className="font-display-landing mt-3 text-xl font-bold">REST API v1</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#9db3a6]">
                Versioned, paged, one envelope everywhere.
              </p>
              <pre className="rl-code mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-[#c4d2c8]">
{`POST /api/v1/summarize
{ "chatId": "…@g.us",
  "messageLimit": 100 }

→ { "success": true,
    "data": { "tldr": "…",
      "urgencyLevel": "HIGH" } }`}
              </pre>
              <Link to="/system" className="mt-4 inline-flex cursor-pointer items-center gap-1.5 text-[13.5px] font-bold text-[#7df0b2] hover:text-white">
                Inspect system health <ArrowRightIcon className="size-4" />
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* privacy */}
      <section id="private" className="rl-wallpaper scroll-mt-24 px-4 py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl">
          <DayDivider stamp="Always" label="stays yours" />
          <div className="mt-6">
            <SectionHead
              eyebrow="Privacy"
              title="Your chats never leave your hands."
              sub="Relay is built for people who would never forward a group export to a strange website. So it doesn't ask you to."
            />
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3" data-reveal-group>
            {[
              {
                icon: LockIcon,
                title: 'Only you get answers',
                body: 'The Telegram bot ignores every user id except yours. Strangers get silence, not summaries.',
              },
              {
                icon: ServerIcon,
                title: 'Session stays local',
                body: 'WhatsApp credentials live in a folder on your machine. Scan once — restarts reconnect on their own.',
              },
              {
                icon: FileTextIcon,
                title: 'Text in, nothing kept',
                body: 'Only the words needed for the brief are read. Photos, voice notes and noise are skipped, nothing is stored.',
              },
            ].map((c) => (
              <article key={c.title} data-reveal-item className="rl-lift rounded-3xl border border-[#d3dbcf] bg-white p-6">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[#0d1f18] text-[#7df0b2]">
                  <c.icon className="size-5" />
                </span>
                <h3 className="font-display-landing mt-4 text-xl font-bold">{c.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#5d6c63]">{c.body}</p>
              </article>
            ))}
          </div>

          {/* closing */}
          <div className="mt-12 overflow-hidden rounded-[2rem] bg-[#1f6b4a] p-8 text-center text-white sm:p-14" data-reveal>
            <p className="font-mono-landing text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
              {unread} unread · 1 minute
            </p>
            <h2 className="font-display-landing mx-auto mt-3 max-w-2xl text-balance text-3xl font-extrabold leading-[1.02] sm:text-5xl">
              Read the group without reading the group.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-[15px] leading-relaxed text-white/80">
              Pair your phone, open the dashboard, and let the next 200 messages arrive
              pre-read.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
              <Link
                to="/app"
                className="rl-lift inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-[14px] font-bold text-[#0d1f18] hover:bg-[#e9ede6]"
              >
                Open dashboard
                <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                to="/connect"
                className="rl-lift inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/40 px-7 py-3 text-[14px] font-semibold text-white hover:bg-white/10"
              >
                <QrCodeIcon className="size-4" />
                Pair WhatsApp
              </Link>
            </div>
            <p className="font-mono-landing mt-5 text-[11px] text-white/60">
              Free while it runs on your machine · no account · no export
            </p>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="rl-wallpaper-dark px-4 pb-10 pt-12 text-[#9db3a6]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
            <div className="flex items-center gap-2.5">
              <img src="/logo.jpg" alt="" className="size-9 rounded-xl object-cover" />
              <span className="leading-tight">
                <span className="font-display-landing block text-[15px] font-bold text-white">Relay</span>
                <span className="block text-[12px]">Calm WhatsApp briefs, on your server.</span>
              </span>
            </div>
            <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-[13.5px] sm:flex sm:gap-8" aria-label="Footer">
              <Link to="/app" className="transition-colors hover:text-white">Dashboard</Link>
              <Link to="/connect" className="transition-colors hover:text-white">Pair phone</Link>
              <a href="#how" className="transition-colors hover:text-white">How it reads</a>
              <a href="#private" className="transition-colors hover:text-white">Privacy</a>
              <Link to="/system" className="transition-colors hover:text-white">System</Link>
            </nav>
          </div>
          <div className="font-mono-landing flex flex-col gap-1 border-t border-white/10 pt-5 text-[11.5px] sm:flex-row sm:items-center sm:justify-between">
            <p>Relay · your data stays on your server{model ? ` · ${model}` : ''}</p>
            <p className="flex items-center gap-1.5">
              <CheckCheckIcon className="size-3.5 text-[#2fa8de]" strokeWidth={2.5} />
              read, briefed, done
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
