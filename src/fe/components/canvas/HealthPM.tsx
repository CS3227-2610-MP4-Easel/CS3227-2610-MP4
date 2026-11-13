// @ts-nocheck
// Generated from the design canvas page HealthPM.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';
import RiskBadge from './RiskBadge';
import { useEffect, useState } from 'react';
import { ApiError, getFacts_42, type Facts } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import HealthNumbers from '../live/health';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function HealthPM(props: any = {}) {
  const route = useProjectRoute();
  if (route.mode === 'live' && route.projectId) return <LiveHealthPM projectId={route.projectId} />;
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"pm"} active={"health"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="g3"><section className="card"><div className="small muted">Progress</div><div style={{fontSize: "30px", fontWeight: "700"}} className="num">30%</div><div className="bar" style={{margin: "6px 0"}}><i style={{width: "30%"}}></i></div><div className="small muted num">13 of 44 pts · 31 remaining · 1 task without estimate</div></section>{" "}<section className="card"><div className="small muted">Velocity</div><div style={{fontSize: "30px", fontWeight: "700"}} className="num">13 pts</div><div className="small muted">Average of last 3 sprints (1 closed)</div><div className="small" style={{marginTop: "6px"}}>Projected completion <b className="num">Wed 20 Jan 2027</b></div></section>{" "}<section className="card"><div className="small muted">Checkpoints</div><div style={{fontSize: "30px", fontWeight: "700"}} className="num">1 at risk</div><div className="small muted">of 3 checkpoints</div></section></div>{" "}<section className="card pad0"><div className="ch"><h3 style={{margin: "0"}}>Checkpoint risk</h3></div>{" "}<table className="tbl"><thead><tr><th>Checkpoint</th><th>Target</th><th className="r">Remaining</th><th>Projected</th><th>Risk</th></tr></thead><tbody><tr><td className="b">Alpha demo</td><td className="num">Fri 20 Nov</td><td className="r num">5 pts</td><td className="num">Thu 19 Nov</td><td><RiskBadge risk={"ok"} /></td></tr><tr><td className="b">Beta release</td><td className="num">Fri 18 Dec</td><td className="r num">21 pts</td><td className="num" style={{color: "var(--warn)", fontWeight: "650"}}>Fri 8 Jan</td><td><RiskBadge risk={"warn"} /></td></tr><tr><td className="b">Launch</td><td className="num">Fri 15 Jan</td><td className="r num">5 pts</td><td className="num">Fri 15 Jan</td><td><RiskBadge risk={"ok"} /></td></tr></tbody></table></section>{" "}<section className="card pad0"><div className="ch"><h3 style={{margin: "0"}}>Overload</h3><span className="small muted">Across your own projects only</span></div>{" "}<div className="empty" style={{padding: "24px"}}><span>No one is overloaded across your projects.</span></div></section>{" "}<p className="small muted">No digest panel, no suggestions, and no AI action can be started from this view.</p></div></main></div></div></>);
}

function LiveHealthPM({ projectId }: { projectId: string }) {
  const [facts, setFacts] = useState<Facts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    getFacts_42(projectId).then((next) => { if (active) setFacts(next); }).catch((e: unknown) => { if (active) setError(e instanceof ApiError ? e.message : 'Something went wrong.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, retry]);
  return <><div className="app"><Top role="pm" project={projectId} /><div className="body"><main className="main"><ProjectHead role="pm" active="health" /><div className="wide stack" style={{ gap: 16 }}><HealthNumbers facts={facts ?? undefined} loading={loading} error={error} />{error && <button className="btn sm" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>}<section className="card"><h3 style={{ marginTop: 0 }}>Digest</h3><p className="muted">Digest details and re-plan actions are managed by the Dev Lead.</p></section></div></main></div></div></>;
}
