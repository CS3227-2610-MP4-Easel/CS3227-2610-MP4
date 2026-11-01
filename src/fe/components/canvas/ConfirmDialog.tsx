// @ts-nocheck
// Generated from the design canvas page ConfirmDialog.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() {
const p = this.props;
const solo = p.title === undefined;
return { title: solo ? 'Delete epic "Pickup"?' : p.title, body: solo ? 'This also deletes its 2 tasks.' : (p.body || ''), error: p.error || '', confirm: solo ? 'Delete epic' : (p.confirm || 'Confirm'), btn: (solo || p.danger) ? 'd' : 'p', wrap: solo ? 'padding: 24px; background: var(--bg); width: 560px; box-sizing: border-box' : '' };
}
}

export default function ConfirmDialog(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div style={css(v.wrap)}><div className="dialog" role="alertdialog" style={{width: "min(520px, 100%)"}}><h2>{v.title}</h2>{" "}<p>{v.body}</p>{" "}{v.error ? (<><div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>{v.error}</span></div></>) : null}{" "}<div className="dfoot">{props.cancelHref ? <A href={r(props.cancelHref)} className="btn" style={{outline: "2px solid var(--accent)", outlineOffset: "2px"}}>Cancel</A> : <span className="btn" style={{outline: "2px solid var(--accent)", outlineOffset: "2px"}}>Cancel</span>}{props.confirmHref ? <A href={r(props.confirmHref)} className={`btn ${v.btn}`}>{v.confirm}</A> : <span className={`btn ${v.btn}`}>{v.confirm}</span>}</div></div></div></>);
}
