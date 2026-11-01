// @ts-nocheck
// Generated from the design canvas page StatusChip.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() {
const solo = this.props.status === undefined;
const m = { todo: ['c-todo', '#i-circle', 'To do'], prog: ['c-prog', '#i-half', 'In progress'], rev: ['c-rev', '#i-eye', 'In review'], done: ['c-done', '#i-check', 'Done'], blocked: ['c-bad', '#i-alert', 'Blocked'] };
const x = m[solo ? 'prog' : this.props.status] || m.todo;
return { cls: x[0], icon: x[1], label: x[2], wrap: solo ? 'padding: 12px; background: var(--bg)' : 'display: inline-flex' };
}
}

export default function StatusChip(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div style={css(v.wrap)}><span className={`chip ${v.cls}`}><svg className="ic" aria-hidden="true"><use href={v.icon} /></svg>{v.label}</span></div></>);
}
