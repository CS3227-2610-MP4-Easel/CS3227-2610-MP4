// @ts-nocheck
// Generated from the design canvas page BoardView.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { useDb } from '../../lib/api';
import TaskCard from './TaskCard';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

cardsDef() {
const out = { todo: [], prog: [], rev: [], done: [] };
for (const t of this.props.tasks) out[t.status].push({ id: t.id, epic: t.epic, title: t.title, points: t.points == null ? '' : String(t.points), who: t.assignee || '', blocked: t.blockedReason });
return out;
}
renderVals() {
const all = [['todo', 'To do', '#i-circle'], ['prog', 'In progress', '#i-half'], ['rev', 'In review', '#i-eye'], ['done', 'Done', '#i-check']];
const show = (this.props.show || 'todo,prog,rev,done').split(',');
const openId = this.props.openId === undefined ? 't3' : this.props.openId;
const data = this.cardsDef();
const role = this.props.role || 'lead';
const archived = !!this.props.archived;
const canEdit = (c) => !archived && (role === 'lead' || (role === 'dev' && c.who === 'pn'));
const notes = { lead: 'Dev Lead view: any card can be dragged or changed from its more menu. A Developer can move only their own tasks. With fewer statuses shown, the remaining columns widen and their cards flow into several columns.', pm: 'Project Manager view: status is read-only, so cards have no more menu and cannot be dragged. Add task stays.', dev: 'Developer view: only your own tasks (Priya N.) have the more menu and can be moved. Other cards are read-only.' };
const sum = (k) => data[k].reduce((a, c) => a + (parseInt(c.points, 10) || 0), 0);
const key = show.join(',');
const hrefFor = (id) => {
if (key === 'todo,prog,rev,done') return id === 'prog' ? 'BoardInProgress.dc.html' : '';
if (key === 'prog') return id === 'rev' ? 'BoardProgressReview.dc.html' : id === 'prog' ? 'Board.dc.html' : '';
if (key === 'prog,rev') return id === 'rev' ? 'BoardInProgress.dc.html' : '';
return '';
};
const filters = all.map((a) => { const on = show.indexOf(a[0]) >= 0; return { label: a[1], icon: a[2], count: data[a[0]].length, on: on, off: !on, cls: on ? 'on' : '', href: hrefFor(a[0]) }; });
const cols = all.filter((a) => show.indexOf(a[0]) >= 0).map((a) => ({
label: a[1], icon: a[2], count: data[a[0]].length, pts: sum(a[0]),
cards: data[a[0]].map((c) => ({ id: c.id, epic: c.epic, title: c.title, points: c.points, who: c.who, status: a[0], blocked: c.blocked || '', menu: c.id === openId && canEdit(c) ? 'true' : '', editable: canEdit(c) ? 'yes' : 'no' }))
}));
return { archived: archived, canAdd: role !== 'dev', addCls: archived ? 'dis' : '', addTip: archived ? 'Archived projects are read-only' : '', meCls: role === 'dev' ? 'on' : '', note: archived ? 'Archived projects are read-only: no drag, no status menu, no new tasks.' : notes[role], filters: filters, cols: cols, partial: cols.length < 4, colsStyle: 'grid-template-columns: repeat(' + Math.max(cols.length, 1) + ', minmax(0, 1fr))' };
}
}

export default function BoardView(props: any = {}) {
  const db = useDb();
  const v = new Logic({ ...props, tasks: db.tasks, archived: props.archived || db.project.status === 'ARCHIVED' ? 'yes' : '' }).renderVals();
  return (<><div className="stack" style={{gap: "16px"}}>{v.archived ? (<><div className="banner b-warn"><svg className="ic" aria-hidden="true"><use href="#i-lock" /></svg><span>This project is archived and read-only.</span></div></>) : null}{" "}<div className="row wrap between"><div className="row wrap"><span className="sel">Sprint: All tasks<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span>{" "}<span className="sel">Epic: Any<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span>{" "}<span className="sel">Assignee: Anyone<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span>{" "}<span className="sel"><span className="check" style={{width: "14px", height: "14px"}}></span>Blocked only</span>{" "}<span className={`sel ${v.meCls}`}><span className="check" style={{width: "14px", height: "14px"}}></span>Assigned to me</span></div>{" "}{v.canAdd ? (<><A className={`btn p ${v.addCls}`} href={r("BacklogAddTask.dc.html")} title={v.addTip}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>Add task</A></>) : null}</div>{" "}<div className="row wrap" role="group" aria-label="Status filter"><span className="small b muted" style={{marginRight: "4px"}}>Status</span>{" "}{(v.filters || []).map((L_f: any, i_f: number) => (<Fragment key={i_f}>{L_f.href ? <A href={r(L_f.href)} className={`sel ${L_f.cls}`} role="checkbox" aria-checked={L_f.on}>{L_f.on ? (<><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg></>) : null}{" "}{L_f.off ? (<><span className="check" style={{width: "14px", height: "14px"}}></span></>) : null}{" "}<svg className="ic" aria-hidden="true"><use href={L_f.icon} /></svg>{L_f.label}<span className="num" style={{opacity: ".8"}}>{L_f.count}</span></A> : <span className={`sel ${L_f.cls}`} role="checkbox" aria-checked={L_f.on}>{L_f.on ? (<><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg></>) : null}{" "}{L_f.off ? (<><span className="check" style={{width: "14px", height: "14px"}}></span></>) : null}{" "}<svg className="ic" aria-hidden="true"><use href={L_f.icon} /></svg>{L_f.label}<span className="num" style={{opacity: ".8"}}>{L_f.count}</span></span>}</Fragment>))}{" "}{v.partial ? (<><A className="btn g sm" href={r("Board.dc.html")}>Show all statuses</A></>) : null}</div>{" "}<div className="cols" style={css(v.colsStyle)}>{(v.cols || []).map((L_col: any, i_col: number) => (<Fragment key={i_col}><section className="col" aria-label={L_col.label}><div className="col-h"><svg className="ic" aria-hidden="true"><use href={L_col.icon} /></svg><span className="b">{L_col.label}</span><span className="chip c-line">{L_col.count}</span><span className="sp"></span><span className="small muted num">{L_col.pts} pts</span></div>{" "}<div className="cards">{(L_col.cards || []).map((L_c: any, i_c: number) => (<Fragment key={i_c}><TaskCard id={L_c.id} epic={L_c.epic} title={L_c.title} points={L_c.points} who={L_c.who} status={L_c.status} blocked={L_c.blocked} menu={L_c.menu} editable={L_c.editable} /></Fragment>))}</div></section></Fragment>))}</div>{" "}<div className="banner b-info"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><span>{v.note}</span></div></div></>);
}
