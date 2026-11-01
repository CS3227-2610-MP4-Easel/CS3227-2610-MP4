// @ts-nocheck
// Generated from the design canvas page Usage.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import UsageTable from '../live/usage-table';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function Usage(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} />{" "}<div className="body"><main className="main"><div className="wide stack" style={{gap: "16px"}}><div className="stack8"><h1>Usage</h1><p className="muted">What the assistant has done, and what it cost. Costs are estimates from the provider's rate settings, not an invoice.</p></div>{" "}<div className="row wrap between"><div className="seg" role="tablist"><span className="on" role="tab" aria-selected="true">My AI sessions</span><A href={r("Usage.dc.html")} role="tab">Platform</A></div>{" "}<div className="row wrap"><span className="sel"><svg className="ic" aria-hidden="true"><use href="#i-cal" /></svg>Last 30 days<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span><span className="sel">Feature: All<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span></div></div>{" "}<UsageTable />{" "}<div className="card flat" style={{borderStyle: "dashed"}}><div className="small muted"><b style={{color: "var(--ink)"}}>Platform tab.</b> Feature, model, calls, tokens, estimated cost, cache hits, average latency, schema failures and estimate error percent, with a date filter. Note shown: <b>Totals for all users. No individual content is shown.</b> Empty: <b>No AI sessions in this period.</b></div></div></div></main></div></div></>);
}
