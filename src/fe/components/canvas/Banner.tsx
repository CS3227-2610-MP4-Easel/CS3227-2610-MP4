// @ts-nocheck
// Generated from the design canvas page Banner.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() {
const solo = this.props.text === undefined;
const m = { info: ['b-info', '#i-info'], ok: ['b-ok', '#i-check'], warn: ['b-warn', '#i-alert'], bad: ['b-bad', '#i-alert'] };
const x = m[this.props.kind] || m.info;
return { cls: x[0], icon: this.props.icon ? '#i-' + this.props.icon : x[1], text: solo ? 'Banner message goes here.' : this.props.text, wrap: solo ? 'padding: 16px; background: var(--bg); width: 480px; box-sizing: border-box' : '' };
}
}

export default function Banner(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div style={css(v.wrap)}><div className={`banner ${v.cls}`}><svg className="ic" aria-hidden="true"><use href={v.icon} /></svg><span>{v.text}</span></div></div></>);
}
