// @ts-nocheck
// Generated from the design canvas page TaskCard.dc.html. Source of truth from here on is this file.
import { Fragment, useState } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { setTaskStatus_24 } from '../../lib/api';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() {
const p = this.props;
const solo = p.title === undefined;
const whoMap = { pn: ['a3', 'PN', 'Priya N.'], ml: ['a2', 'ML', 'Marcus L.'], wo: ['a4', 'WO', 'Wei Ling O.'] };
const demoOpen = solo;
const who = solo ? whoMap.ml : whoMap[p.who];
const st = (solo ? 'todo' : p.status) || 'todo';
const rows = [['todo', 'To do', '#i-circle'], ['prog', 'In progress', '#i-half'], ['rev', 'In review', '#i-eye'], ['done', 'Done', '#i-check']].map((r) => ({ key: r[0], label: r[1], icon: r[2], cur: r[0] === st }));
const pts = solo ? '5' : p.points;
const hasPts = !!pts;
const menu = demoOpen || !!p.menu;
const blocked = solo ? '' : (p.blocked || '');
return {
wrapStyle: solo ? 'padding: 24px 24px 150px; background: var(--bg); width: 360px; box-sizing: border-box' : '',
cardStyle: 'margin-top: 0; position: relative;' + (menu ? ' outline: 2px solid var(--accent); outline-offset: 1px; z-index: 6' : ''),
cls: blocked ? 'blocked' : '',
epic: solo ? 'Browse stalls and menus' : (p.epic || ''),
title: solo ? 'Search and filter by cuisine' : (p.title || ''),
hasBlocked: !!blocked, blocked: blocked,
hasPts: hasPts, noPts: !hasPts, pts: pts,
hasWho: !!who, noWho: !who, avCls: who ? who[0] : '', ini: who ? who[1] : '', nm: who ? who[2] : '',
menu: menu, rows: rows, editable: solo || p.editable !== 'no'
};
}
}

export default function TaskCard(props: any = {}) {
  const [open, setOpen] = useState(false);
  const v = new Logic({ ...props, menu: props.title === undefined || open ? 'open' : '' }).renderVals();
  return (<><div style={css(v.wrapStyle)}><article className={`tcard ${v.cls}`} style={css(v.cardStyle)}><div className="row between" style={{alignItems: "flex-start"}}><div className="small muted">{v.epic}</div>{" "}{v.editable ? (<><span className="btn g sm ib" role="button" aria-label="Change status" aria-haspopup="menu" aria-expanded={!!v.menu} tabIndex={0} onClick={() => setOpen(!open)} style={{width: "26px", height: "26px", margin: "-4px -6px 0 0"}}><svg className="ic" aria-hidden="true"><use href="#i-more" /></svg></span></>) : null}</div>{" "}<A href={r("TaskDetail.dc.html")} className="t" style={{display: "block"}}>{v.title}</A>{" "}{v.hasBlocked ? (<><div className="chip c-bad wrapt" style={{alignSelf: "flex-start"}}><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>{v.blocked}</div></>) : null}{" "}<div className="row between">{v.hasPts ? (<><span className="pts">{v.pts}</span></>) : null}{" "}{v.noPts ? (<><span className="pts none">Unestimated</span></>) : null}{" "}{v.hasWho ? (<><span className="who"><span className={`av ${v.avCls}`} aria-hidden="true">{v.ini}</span>{v.nm}</span></>) : null}{" "}{v.noWho ? (<><span className="chip c-line">Unassigned</span></>) : null}</div>{" "}{v.menu ? (<><div className="card" role="menu" style={{position: "absolute", right: "8px", top: "40px", zIndex: "8", width: "190px", padding: "6px", boxShadow: "0 8px 24px rgba(0,0,0,.25)"}}>{(v.rows || []).map((L_r: any, i_r: number) => (<Fragment key={i_r}><div className="row" role="menuitem" tabIndex={0} style={{padding: "6px 8px", cursor: "pointer"}} onClick={() => { if (props.id) setTaskStatus_24(props.id, L_r.key); setOpen(false); }}><svg className="ic" aria-hidden="true"><use href={L_r.icon} /></svg>{L_r.label}<span className="sp"></span>{L_r.cur ? (<><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg></>) : null}</div></Fragment>))}{" "}<hr className="hr" style={{margin: "4px 0"}} />{" "}{v.hasBlocked ? (<div className="row" role="menuitem" tabIndex={0} style={{padding: "6px 8px", cursor: "pointer"}} onClick={() => { if (props.id) setTaskStatus_24(props.id, props.status, ""); setOpen(false); }}><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Unblock</div>) : (<A href={r("BoardBlocked.dc.html")} className="row" role="menuitem" style={{padding: "6px 8px", color: "var(--danger)"}}><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Mark blocked</A>)}</div></>) : null}</article></div></>);
}
