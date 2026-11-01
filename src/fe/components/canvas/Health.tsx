// @ts-nocheck
// Generated from the design canvas page Health.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { Act } from '../live/act';
import { refreshDigest_44, dismissSuggestions_48, applySuggestions_47 } from '../../lib/api';
import Top from './Top';
import HealthNumbers from '../live/health';
import ProjectHead from './ProjectHead';
import RiskBadge from './RiskBadge';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function Health(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"health"} />{" "}<div className="wide stack" style={{gap: "16px"}}><HealthNumbers />{" "}<section className="card"><div className="row wrap between" style={{marginBottom: "8px"}}><div className="row"><svg className="ic lg" style={{color: "var(--accent-t)"}} aria-hidden="true"><use href="#i-spark" /></svg><h3 style={{margin: "0"}}>Digest</h3><span className="small muted">Generated 1 Nov, 09:05</span></div><Act className="btn sm" run={refreshDigest_44} ok={(x) => x.cached ? 'Nothing changed since the last digest, so the same one is shown.' : 'Digest refreshed.'} busyText="Working…"><svg className="ic" aria-hidden="true"><use href="#i-refresh" /></svg>Refresh digest</Act></div>{" "}<p>Progress is steady and all three checkpoints are on track at the current pace. The payment task is blocked on outside keys and holds 8 of the open points, so it is the main risk to Beta release. Wei Ling carries the largest open load across projects.</p>{" "}<div className="row" style={{marginTop: "8px"}}><span className="flagm"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>Flagged for review</span></div>{" "}<div className="banner b-info" style={{marginTop: "12px"}}><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><span>States: no digest yet shows <b>No digest yet.</b> with Generate digest. Nothing changed: <b>Nothing has changed since the last digest.</b> Model down: the facts stay and <b>The AI part is unavailable right now.</b> with Try again.</span></div></section>{" "}<section className="card pad0"><div className="ch"><div className="stack8" style={{gap: "2px"}}><h3 style={{margin: "0"}}>Suggested changes (3)</h3><span className="small muted">Each one is your decision. Nothing is applied without this step.</span></div><span className="chip c-line">Tier 2</span></div>{" "}<div className="trow" style={{alignItems: "flex-start"}}><span className="check on"><svg className="ic" style={{width: "12px", height: "12px", strokeWidth: "3"}} aria-hidden="true"><use href="#i-check" /></svg></span><div className="t"><div>Move task <b>Order status notifications</b> to Sprint 3</div><div className="small muted">Sprint 2 already carries 26 points against an average of 13.</div></div></div>{" "}<div className="trow" style={{alignItems: "flex-start"}}><span className="check on"><svg className="ic" style={{width: "12px", height: "12px", strokeWidth: "3"}} aria-hidden="true"><use href="#i-check" /></svg></span><div className="t"><div>Reassign task <b>QR pickup code</b> from Wei Ling Ong to Priya Nair</div><div className="small muted">Wei Ling has 11 open points across projects; Priya has 5.</div></div></div>{" "}<div className="trow" style={{alignItems: "flex-start", background: "var(--head)"}}><span className="check" style={{opacity: ".5"}}></span><div className="t" style={{opacity: ".7"}}><div>Move epic <b>Pickup</b> from Beta release to Launch</div><div className="chip c-bad" style={{marginTop: "4px"}}>Out of date: the epic's checkpoint changed</div></div></div>{" "}<div className="trow" style={{justifyContent: "flex-end"}}><Act className="btn" run={dismissSuggestions_48} ok={() => 'Suggestions dismissed.'} busyText="Working…">Dismiss all</Act><Act className="btn p" run={() => applySuggestions_47(['g1', 'g2'])} ok={(n) => `${n} suggestions applied to the plan.`} busyText="Working…">Apply selected (2)</Act></div></section></div></main></div></div></>);
}
