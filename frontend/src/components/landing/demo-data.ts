export interface DemoMsg {
  from: string;
  text: string;
  time: string;
  out?: boolean;
  replyTo?: string;
}

export const FLOOD: DemoMsg[] = [
  { from: 'Meera', text: 'Morning all — staging deploy is green, finally', time: '09:12' },
  { from: 'Arjun', text: 'Can someone confirm the migration ran on prod replica too?', time: '09:14' },
  { from: 'Sara', text: 'Replica is still on 15. Checking logs now, one sec', time: '09:15' },
  { from: 'Dev', text: '+1 shipment update: courier delayed by a day, FYI', time: '09:16' },
  { from: 'Meera', text: 'Standup moved to 11? Client call preponed', time: '09:19', replyTo: 'Morning all — staging deploy is green…' },
  { from: 'Kabir', text: 'Dropping the new onboarding screens in Figma, link below', time: '09:21' },
  { from: 'Sara', text: 'Found it — replica lag, not a failed migration. Rerunning', time: '09:24' },
  { from: 'Arjun', text: 'Invoice thread: finance needs the GST line fixed today', time: '09:26' },
  { from: 'Meera', text: 'Friday 5pm deploy — are we all agreed? React with yes', time: '09:31' },
  { from: 'Dev', text: 'yes from me, load test passed at 2k rps', time: '09:33', replyTo: 'Friday 5pm deploy…' },
  { from: 'Sara', text: 'yes, replica caught up. Migration verified', time: '09:34', replyTo: 'Friday 5pm deploy…' },
  { from: 'Kabir', text: 'yes — mobile polish lands by Thursday EOD', time: '09:36', replyTo: 'Friday 5pm deploy…' },
];

export const BRIEF = {
  tldr: 'Staging is green, the replica scare was just lag, and the team agreed to ship Friday at 5pm.',
  topics: [
    'PostgreSQL 16 migration verified on staging + replica',
    'Mobile onboarding polish lands Thursday EOD',
    'Standup moved to 11:00 for the client call',
  ],
  actions: [
    { task: 'Run final load tests at 2k rps', who: 'Dev', when: 'Thu 2pm' },
    { task: 'Fix GST line on the invoice', who: 'Arjun', when: 'Today' },
    { task: 'Merge onboarding screens', who: 'Kabir', when: 'Thu EOD' },
  ],
  decisions: ['Production deploy locked for Friday, 5:00pm'],
  links: ['staging.example.com', 'figma.com/onboarding-v3'],
  urgency: 'HIGH' as const,
  analyzed: 214,
};

export const MARQUEE_QUOTES = [
  '“sorry, 300+ unread — what did I miss?”',
  '“can someone summarise the group pls”',
  '“buried decision at message #187”',
  '“who was supposed to send the invoice?”',
  '“scrolled 20 mins, still lost”',
  '“muted the group, missed the deadline”',
];

export const TELEGRAM_COMMANDS = [
  { cmd: '/unread', desc: 'Chats that need you, with one-tap summarize buttons' },
  { cmd: '/summarize <name>', desc: 'Brief any group or chat by name' },
  { cmd: '/qr', desc: 'Pairing code delivered right in Telegram' },
  { cmd: '/status', desc: 'Health, uptime, connection state' },
];
