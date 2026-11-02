// @ts-nocheck
// Generated from the design canvas page EmptyState.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() {
const solo = this.props.title === undefined;
const p = this.props;
return { icon: '#i-' + (p.icon || 'list'), title: solo ? 'Nothing here yet.' : p.title, text: solo ? 'One line says what to do next.' : (p.text || ''), action: solo ? 'Primary action' : (p.action || ''), wrap: solo ? 'padding: 16px; background: var(--bg); width: 420px; box-sizing: border-box' : '' };
}
}

export default function EmptyState(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div style={css(v.wrap)}><div className="empty card flat" style={{padding: "32px 24px"}}><span className="ico"><svg className="ic lg" aria-hidden="true"><use href={v.icon} /></svg></span><b style={{color: "var(--ink)"}}>{v.title}</b><span>{v.text}</span>{v.action ? (<>{props.href ? <A href={r(props.href)} className="btn p sm">{v.action}</A> : <span className="btn p sm">{v.action}</span>}</>) : null}</div></div></>);
}
