// @ts-nocheck
// Generated from the design canvas page RoleBadge.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() {
const solo = this.props.role === undefined;
const m = { pm: ['r-pm', 'Project Manager'], lead: ['r-lead', 'Dev Lead'], dev: ['r-dev', 'Developer'] };
const x = m[solo ? 'pm' : this.props.role] || m.dev;
return { cls: x[0], label: x[1], wrap: solo ? 'padding: 12px; background: var(--bg)' : 'display: inline-flex' };
}
}

export default function RoleBadge(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div style={css(v.wrap)}><span className={`role ${v.cls}`}>{v.label}</span></div></>);
}
