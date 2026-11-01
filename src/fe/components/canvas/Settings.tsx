// @ts-nocheck
// Generated from the design canvas page Settings.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function Settings(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"pm"} active={"settings"} />{" "}<div className="stack" style={{width: "100%", gap: "20px"}}><section className="card"><h3>Details</h3>{" "}<div className="stack"><div className="field"><label htmlFor="sn">Name</label><input id="sn" className="in" defaultValue="Campus Eats Mobile App" /></div>{" "}<div className="field"><label htmlFor="sb">Brief</label><textarea id="sb" className="in" rows={4} defaultValue={"A food-ordering app for campus canteens: browse stalls, order ahead, pay with a student ID and collect with a pickup code."} /><span className="hint num" style={{alignSelf: "flex-end"}}>121 / 4000</span></div>{" "}<div className="banner b-warn"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><div>Someone else changed this. Reload to see their version. <b>Reload</b></div></div>{" "}<div className="dfoot"><A className="btn" href={r("Settings.dc.html")}>Discard</A><A className="btn p" href={r("Settings.dc.html")}>Save changes</A></div></div></section>{" "}<section className="card" style={{borderColor: "var(--b-bad-line)"}}><h3 style={{color: "var(--danger)"}}>Archive</h3>{" "}<p className="muted" style={{marginBottom: "12px"}}>Archiving makes the project read-only for everyone. It cannot be undone from the app.</p>{" "}<span className="btn d"><svg className="ic" aria-hidden="true"><use href="#i-box" /></svg>Archive project</span></section>{" "}<section className="card flat" style={{borderStyle: "dashed"}}><h3>Archive confirmation</h3>{" "}<div className="stack8"><p>Type <b>Campus Eats Mobile App</b> to confirm. Everyone will be able to read the project, and no one can change it.</p>{" "}<input className="in" aria-label="Type the project name" defaultValue="Campus Eats Mob" style={{maxWidth: "360px"}} />{" "}<div className="dfoot" style={{justifyContent: "flex-start"}}><A className="btn" href={r("Settings.dc.html")}>Cancel</A><A className="btn d dis" href={r("BoardArchived.dc.html")}>Archive project</A></div></div></section>{" "}<div className="banner b-warn"><svg className="ic" aria-hidden="true"><use href="#i-lock" /></svg><span>After archiving, every project screen shows <b>This project is archived and read-only.</b> and this page shows only the details, read-only.</span></div></div></main></div></div></>);
}
