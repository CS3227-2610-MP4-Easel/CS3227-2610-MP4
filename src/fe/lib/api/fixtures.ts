import type { Db } from './types';

// Typed fixtures standing in for the backend. Only this file and ./store.ts hold sample data.
export const initialDb = (): Db => ({
  project: { id: 'p1', name: 'Campus Eats Mobile App', status: 'ACTIVE', version: 1 },
  tasks: [
    { id: 't3', epic: 'Browse stalls and menus', title: 'Search and filter by cuisine', points: 5, assignee: 'ml', status: 'todo', blockedReason: '', sprintId: 's2', version: 1 },
    { id: 't7', epic: 'Pickup', title: 'QR pickup code', points: 3, assignee: 'wo', status: 'todo', blockedReason: '', sprintId: 's2', version: 1 },
    { id: 't8', epic: 'Pickup', title: 'Order status notifications', points: 5, assignee: 'pn', status: 'todo', blockedReason: '', sprintId: 's3', version: 1 },
    { id: 't6', epic: 'Order and pay', title: 'Order confirmation email', points: null, assignee: null, status: 'todo', blockedReason: '', sprintId: null, version: 1 },
    { id: 't2', epic: 'Browse stalls and menus', title: 'Menu item detail page', points: 5, assignee: 'pn', status: 'prog', blockedReason: '', sprintId: 's2', version: 1 },
    { id: 't5', epic: 'Order and pay', title: 'Student ID payment', points: 8, assignee: 'wo', status: 'prog', blockedReason: 'Blocked: waiting for sandbox keys', sprintId: 's2', version: 1 },
    { id: 't4', epic: 'Order and pay', title: 'Cart and order summary', points: 5, assignee: 'ml', status: 'rev', blockedReason: '', sprintId: 's2', version: 1 },
    { id: 't1', epic: 'Browse stalls and menus', title: 'Stall list screen', points: 3, assignee: 'pn', status: 'done', blockedReason: '', sprintId: 's1', version: 1 },
    { id: 't9', epic: 'Foundations', title: 'Canteen data model and API', points: 5, assignee: 'ml', status: 'done', blockedReason: '', sprintId: 's1', version: 1 },
    { id: 't10', epic: 'Foundations', title: 'Sign-in with student ID', points: 5, assignee: 'wo', status: 'done', blockedReason: '', sprintId: 's1', version: 1 },
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
    { id: 'c1', name: 'Prototype demo', targetDate: '2026-11-13' },
    { id: 'c2', name: 'Beta release', targetDate: '2026-11-27' },
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
});
