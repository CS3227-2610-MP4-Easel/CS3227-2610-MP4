// @ts-nocheck
// Generated from the design canvas page HealthPM.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';
import RiskBadge from './RiskBadge';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function HealthPM(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"pm"} active={"health"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="banner b-info"><svg className="ic" aria-hidden="true"><use href="#i-eye" /></svg><span><b>Read only.</b> The Dev Lead generates the digest and applies re-plan changes.</span></div>{" "}<div className="g3"><section className="card"><div className="small muted">Progress</div><div style={{fontSize: "30px", fontWeight: "700"}} className="num">30%</div><div className="bar" style={{margin: "6px 0"}}><i style={{width: "30%"}}></i></div><div className="small muted num">13 of 44 pts · 31 remaining · 1 task without estimate</div></section>{" "}<section className="card"><div className="small muted">Velocity</div><div style={{fontSize: "30px", fontWeight: "700"}} className="num">13 pts</div><div className="small muted">Average of last 3 sprints (1 closed)</div><div className="small" style={{marginTop: "6px"}}>Projected completion <b className="num">Wed 20 Jan 2027</b></div></section>{" "}<section className="card"><div className="small muted">Checkpoints</div><div style={{fontSize: "30px", fontWeight: "700"}} className="num">1 at risk</div><div className="small muted">of 3 checkpoints</div></section></div>{" "}<section className="card pad0"><div className="ch"><h3 style={{margin: "0"}}>Checkpoint risk</h3></div>{" "}<table className="tbl"><thead><tr><th>Checkpoint</th><th>Target</th><th className="r">Remaining</th><th>Projected</th><th>Risk</th></tr></thead><tbody><tr><td className="b">Alpha demo</td><td className="num">Fri 20 Nov</td><td className="r num">5 pts</td><td className="num">Thu 19 Nov</td><td><RiskBadge risk={"ok"} /></td></tr><tr><td className="b">Beta release</td><td className="num">Fri 18 Dec</td><td className="r num">21 pts</td><td className="num" style={{color: "var(--warn)", fontWeight: "650"}}>Fri 8 Jan</td><td><RiskBadge risk={"warn"} /></td></tr><tr><td className="b">Launch</td><td className="num">Fri 15 Jan</td><td className="r num">5 pts</td><td className="num">Fri 15 Jan</td><td><RiskBadge risk={"ok"} /></td></tr></tbody></table></section>{" "}<section className="card pad0"><div className="ch"><h3 style={{margin: "0"}}>Overload</h3><span className="small muted">Across your own projects only</span></div>{" "}<div className="empty" style={{padding: "24px"}}><span>No one is overloaded across your projects.</span></div></section>{" "}<p className="small muted">No digest panel, no suggestions, and no AI action can be started from this view.</p></div></main></div></div></>);
}
