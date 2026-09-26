import { newItem, uid } from './actions';
import type { Item } from './types';

/**
 * A realistic sample day, planned from `start`. The fixed standup sits 30 minutes in.
 * Everything is 'Once' so a sample never plants repeating items into later days.
 */
export function sampleItems(start: number): Item[] {
  const st = (t: string, d: boolean) => ({ id: uid(), t, d });
  return [
    newItem({ title: 'Plan the day', min: 15 }),
    newItem({ title: 'Standup', min: 15, kind: 'fixed', fixedAt: start + 30, hue: 'indigo' }),
    newItem({
      title: 'Email & Slack',
      min: 45,
      hue: 'yellow',
      subtasks: [
        st('Inbox to zero', true),
        st('Reply to Ana about the contract', true),
        st('Catch up on Slack threads', false),
        st('Flag follow-ups for Monday', false),
      ],
    }),
    newItem({ title: "Review Ana's pull request", min: 30 }),
    newItem({ title: 'Buffer', min: 15, kind: 'buffer' }),
    newItem({
      title: 'Write the Q4 proposal draft',
      min: 90,
      hue: 'orange',
      note: "Start from last quarter's outline.",
    }),
    newItem({ title: 'Lunch & walk', min: 60, hue: 'lime' }),
    newItem({ title: 'Prep for client call', min: 45 }),
    newItem({ title: 'Buffer', min: 30, kind: 'buffer' }),
    newItem({ title: 'Invoices & admin', min: 45, hue: 'yellow' }),
    // Things with no duration: ticked off on the checklist.
    newItem({ title: 'Take vitamins', min: 0, kind: 'check', hue: 'lime' }),
    newItem({ title: 'Check the mailbox', min: 0, kind: 'check', hue: 'indigo' }),
  ];
}
