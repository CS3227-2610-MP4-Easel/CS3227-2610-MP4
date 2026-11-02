import type { Db } from './types';

// Typed fixtures standing in for the backend. Only this file and ./store.ts hold sample data.
export const initialDb = (): Db => ({
  project: { id: 'p1', name: 'Campus Eats Mobile App', status: 'ACTIVE', version: 1 },
  epics: [
    { id: 'e1', title: 'Browse stalls and menus', description: 'See which stalls are open and browse their menus.', checkpointId: 'c1' },
    { id: 'e2', title: 'Order and pay', description: 'Order ahead and pay with a student ID.', checkpointId: 'c2' },
    { id: 'e3', title: 'Pickup', description: 'Collect an order with a code or QR.', checkpointId: 'c2' },
    { id: 'e4', title: 'Foundations', description: 'Data model, API and sign-in.', checkpointId: null },
  ],
  tasks: [
    { id: 't3', epic: 'Browse stalls and menus', title: 'Search and filter by cuisine', points: 5, assignee: 'ml', status: 'todo', blockedReason: '', sprintId: 's2', description: '', criteria: [], version: 1 },
    { id: 't7', epic: 'Pickup', title: 'QR pickup code', points: 3, assignee: 'wo', status: 'todo', blockedReason: '', sprintId: 's2', description: '', criteria: [], version: 1 },
    { id: 't8', epic: 'Pickup', title: 'Order status notifications', points: 5, assignee: 'pn', status: 'todo', blockedReason: '', sprintId: 's3', description: '', criteria: [], version: 1 },
    { id: 't6', epic: 'Order and pay', title: 'Order confirmation email', points: null, assignee: null, status: 'todo', blockedReason: '', sprintId: null, description: '', criteria: [], version: 1 },
    { id: 't2', epic: 'Browse stalls and menus', title: 'Menu item detail page', points: 5, assignee: 'pn', status: 'prog', blockedReason: '', sprintId: 's2', description: '', criteria: [], version: 1 },
    { id: 't5', epic: 'Order and pay', title: 'Student ID payment', points: 8, assignee: 'wo', status: 'prog', blockedReason: 'Blocked: waiting for sandbox keys', sprintId: 's2', description: '', criteria: [], version: 1 },
    { id: 't4', epic: 'Order and pay', title: 'Cart and order summary', points: 5, assignee: 'ml', status: 'rev', blockedReason: '', sprintId: 's2', description: '', criteria: [], version: 1 },
    { id: 't1', epic: 'Browse stalls and menus', title: 'Stall list screen', points: 3, assignee: 'pn', status: 'done', blockedReason: '', sprintId: 's1', description: '', criteria: [], version: 1 },
    { id: 't9', epic: 'Foundations', title: 'Canteen data model and API', points: 5, assignee: 'ml', status: 'done', blockedReason: '', sprintId: 's1', description: '', criteria: [], version: 1 },
    { id: 't10', epic: 'Foundations', title: 'Sign-in with student ID', points: 5, assignee: 'wo', status: 'done', blockedReason: '', sprintId: 's1', description: '', criteria: [], version: 1 },
  ],
  sprints: [
    { id: 's1', name: 'Sprint 1', status: 'CLOSED', startDate: '2026-10-19', endDate: '2026-10-30', version: 1 },
    { id: 's2', name: 'Sprint 2', status: 'ACTIVE', startDate: '2026-11-02', endDate: '2026-11-13', version: 1 },
    { id: 's3', name: 'Sprint 3', status: 'PLANNED', startDate: '2026-11-16', endDate: '2026-11-27', version: 1 },
  ],
  members: [
    { id: 'u1', name: 'Aisha Rahman', email: 'aisha.rahman@example.edu', role: 'PM' },
    { id: 'u2', name: 'Daniel Tan', email: 'daniel.tan@example.edu', role: 'DEV_LEAD' },
    { id: 'u3', name: 'Priya Nair', email: 'priya.nair@example.edu', role: 'DEVELOPER' },
    { id: 'u4', name: 'Marcus Lim', email: 'marcus.lim@example.edu', role: 'DEVELOPER' },
    { id: 'u5', name: 'Wei Ling Ong', email: 'weiling.ong@example.edu', role: 'DEVELOPER' },
  ],
  checkpoints: [
    { id: 'c1', name: 'Alpha demo', targetDate: '2026-11-20' },
    { id: 'c2', name: 'Beta release', targetDate: '2026-12-18' },
    { id: 'c3', name: 'Launch', targetDate: '2027-01-15' },
  ],
  standup: {
    id: 'sd1',
    date: '2026-11-03',
    yesterday: ['Built the menu item detail layout', 'Fixed image sizing on small phones'],
    today: ['Wire the detail page to the menu API', 'Start the order status notification spike'],
    blockers: [],
    outcome: 'GENERATED',
  },
  digest: { generatedAt: '2026-11-02T09:00:00+08:00', cached: false },
  suggestions: [
    { id: 'g1', text: 'Move "Order status notifications" to Sprint 3', state: 'PENDING' },
    { id: 'g2', text: 'Split "Student ID payment" into two tasks', state: 'PENDING' },
    { id: 'g3', text: 'Ask the Dev Lead to reassign an overloaded developer', state: 'PENDING' },
  ],
  summariesMissing: 4,
  teamStandups: [
    { date: '2026-11-02', person: 'pn', yesterday: ['Built the menu item detail layout', 'Fixed image sizing on small phones'], today: ['Wire the detail page to the menu API', 'Start order status notification spike'], blockers: [], outcome: 'EDITED', activityOnly: false, flagged: false },
    { date: '2026-11-02', person: 'ml', yesterday: ['Moved Cart and order summary to In review'], today: ['Pick up the cuisine filter task'], blockers: [], outcome: 'GENERATED', activityOnly: true, flagged: false },
    { date: '2026-11-02', person: 'wo', yesterday: ['Drafted the student ID payment flow', "Asked the bursar's office for sandbox keys"], today: ['Design the QR pickup code'], blockers: ['Payment sandbox keys not received'], outcome: 'GENERATED', activityOnly: false, flagged: true },
    ...['2026-10-30', '2026-10-29', '2026-10-28', '2026-10-27', '2026-10-26'].flatMap((date) => [
      { date, person: 'pn' as const, yesterday: ['Finished the stall list screen'], today: ['Start the menu detail page'], blockers: [], outcome: 'ACCEPTED' as const, activityOnly: false, flagged: false },
      { date, person: 'ml' as const, yesterday: ['Data model review'], today: ['Cart and order summary'], blockers: [], outcome: 'ACCEPTED' as const, activityOnly: false, flagged: false },
      { date, person: 'wo' as const, yesterday: ['Sign-in with student ID'], today: ['Student ID payment'], blockers: [], outcome: 'ACCEPTED' as const, activityOnly: false, flagged: false },
    ]),
  ],
  aiSessions: [
    { id: 'a1', feature: 'Project plan', startedAt: '2026-10-30T14:02:00+08:00', outcome: 'Accepted', regens: 1, feedback: 'up', calls: 9, prompt: 31402, completion: 12330, cost: 0.193, elapsed: 58 },
    { id: 'a2', feature: 'Project plan', startedAt: '2026-10-28T10:15:00+08:00', outcome: 'Rejected', regens: 0, feedback: 'down', calls: 4, prompt: 9880, completion: 4102, cost: 0.061, elapsed: 31 },
    { id: 'a3', feature: 'Plan with AI', startedAt: '2026-10-27T16:40:00+08:00', outcome: 'Open', regens: 0, feedback: null, calls: 2, prompt: 6928, completion: 5472, cost: 0.0644, elapsed: 12 },
  ],
});
