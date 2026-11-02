// @ts-nocheck
// Generated from the design canvas page ProgressBar.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() {
const p = this.props;
const solo = p.pct === undefined;
return { pct: solo ? 30 : p.pct, label: solo ? 'Points done' : (p.label || ''), wrap: solo ? 'padding: 16px; background: var(--bg); width: 320px; box-sizing: border-box' : '' };
}
}

export default function ProgressBar(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div style={css(v.wrap)}><div className="row between small" style={{marginBottom: "4px"}}><span className="muted">{v.label}</span><b className="num">{v.pct}%</b></div><div className="bar big"><i style={css(`width: ${v.pct}%`)}></i></div></div></>);
}
