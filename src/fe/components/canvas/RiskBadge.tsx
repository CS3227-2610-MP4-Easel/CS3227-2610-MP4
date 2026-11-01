// @ts-nocheck
// Generated from the design canvas page RiskBadge.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() {
const solo = this.props.risk === undefined;
const m = { ok: ['c-ok', '#i-check', 'On track'], warn: ['c-warn', '#i-alert', 'At risk'], unknown: ['c-line', '#i-info', 'Unknown'] };
const x = m[solo ? 'warn' : this.props.risk] || m.unknown;
return { cls: x[0], icon: x[1], label: x[2], wrap: solo ? 'padding: 12px; background: var(--bg)' : 'display: inline-flex' };
}
}

export default function RiskBadge(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div style={css(v.wrap)}><span className={`chip ${v.cls}`}><svg className="ic" aria-hidden="true"><use href={v.icon} /></svg>{v.label}</span></div></>);
}
