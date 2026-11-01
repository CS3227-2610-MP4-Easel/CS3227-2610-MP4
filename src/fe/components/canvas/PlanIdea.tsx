// @ts-nocheck
// Generated from the design canvas page PlanIdea.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function PlanIdea(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"pm"} active={"plan"} />{" "}<div className="stack" style={{width: "100%", gap: "20px"}}><div className="stack8"><div className="row"><span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-spark" /></svg>Phase 1 of 3</span></div><h1>Plan with AI</h1>{" "}<p className="muted">The assistant drafts an approach, checkpoints, epics and tasks. You review everything before anything is created.</p></div>{" "}<div className="banner b-info"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><div>You have a plan in progress. A new plan replaces it. <A href={r("Plan.dc.html")} className="b" style={{textDecoration: "underline"}}>Continue plan</A></div></div>{" "}<section className="card"><div className="small muted">Project</div><div className="b">Campus Eats Mobile App</div>{" "}<p className="muted" style={{margin: "4px 0 8px"}}>A food-ordering app for campus canteens: browse stalls, order ahead, pay with a student ID and collect with a pickup code.</p>{" "}<span className="hint">The assistant also looks at similar epics and tasks in your other projects.</span></section>{" "}<section className="card stack"><div className="field"><label htmlFor="idea">Describe the idea</label>{" "}<textarea id="idea" className="in" rows={7} defaultValue={"Students should be able to see which canteen stalls are open, browse menus, order ahead during a lecture break and pay with their student ID. Stall owners need a simple screen to see incoming orders. Pickup should use a code or QR so there is no queue at the counter."} />{" "}<div className="row between"><span className="hint">20 to 6000 characters. Example: "A booking app for library desks with QR check-in."</span><span className="hint num">318 / 6000</span></div></div>{" "}<div className="row wrap between"><div className="row"><A href={r("Backlog.dc.html")} className="b muted" style={{textDecoration: "underline"}}>Create manually</A><A href={r("PlanHistory.dc.html")} className="b muted" style={{textDecoration: "underline", marginLeft: "12px"}}>Plan history</A></div><A className="btn p" href={r("Plan.dc.html")} style={{height: "40px", padding: "0 20px"}}><svg className="ic" aria-hidden="true"><use href="#i-spark" /></svg>Generate plan</A></div></section>{" "}<section className="card flat" style={{borderStyle: "dashed"}}><h3>If it does not work</h3>{" "}<div className="stack8"><div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><div>LLM unreachable. Please try again later.<div className="row" style={{marginTop: "8px"}}><span className="btn sm">Try again</span><A className="btn sm" href={r("Backlog.dc.html")}>Create manually</A></div></div></div>{" "}<div className="banner b-info"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><span>AI features are switched off in this environment. <b>Create manually</b> still works.</span></div></div></section></div></main></div></div></>);
}
