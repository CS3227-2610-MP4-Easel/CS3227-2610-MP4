// @ts-nocheck
import { Fragment, useState } from 'react';
import { A, css, r, useRoute } from '../../lib/nav';
import { ApiError, setTaskStatus_24, setTaskStatusLive_24 } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import { toast } from '../live/toast';

const ROWS = [['todo', 'To do', '#i-circle'], ['prog', 'In progress', '#i-half'], ['rev', 'In review', '#i-eye'], ['done', 'Done', '#i-check']];

export default function TaskCard(props: any = {}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const route = useProjectRoute();
  const routeFor = useRoute();
  const live = !!(props.live && route.mode === 'live' && route.projectId);
  const solo = props.title === undefined;
  const whoMap = { pn: ['a3', 'PN', 'Priya N.'], ml: ['a2', 'ML', 'Marcus L.'], wo: ['a4', 'WO', 'Wei Ling O.'] };
  const who = solo ? whoMap.ml : whoMap[props.who];
  const status = (solo ? 'todo' : props.status) || 'todo';
  const rows = ROWS.map(([key, label, icon]) => ({ key, label, icon, cur: key === status }));
  const blocked = solo ? '' : props.blocked || '';
  const editable = solo || props.editable !== 'no';
  const assignee = props.assigneeName || (who ? who[2] : '');
  const initials = assignee ? assignee.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase() : '';
  const changeStatus = async (next: string, options: { unblock?: boolean; blocked?: boolean; blockedReason?: string } = {}) => {
    if (!props.id || busy) return;
    setBusy(true);
    try {
      const updated = live
        ? await setTaskStatusLive_24(props.id, { status: ({ todo: 'TODO', prog: 'IN_PROGRESS', rev: 'IN_REVIEW', done: 'DONE' } as any)[next], blocked: options.unblock ? false : options.blocked ?? !!props.blocked, blockedReason: options.unblock ? null : options.blockedReason, version: props.version })
        : await setTaskStatus_24(props.id, next, options.unblock ? '' : options.blockedReason);
      props.onStatus?.(updated);
      setOpen(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad');
    } finally { setBusy(false); }
  };
  return <div style={css(solo ? 'padding: 24px 24px 150px; background: var(--bg); width: 360px; box-sizing: border-box' : '')}>
    <article className={`tcard ${blocked ? 'blocked' : ''}`} style={css(`margin-top: 0; position: relative;${open ? ' outline: 2px solid var(--accent); outline-offset: 1px; z-index: 6' : ''}`)}>
      <div className="row between" style={{ alignItems: 'flex-start' }}><div className="small muted">{solo ? 'Browse stalls and menus' : props.epic || ''}</div>{editable && <span className="btn g sm ib" role="button" aria-label="Change status" aria-haspopup="menu" aria-expanded={open} tabIndex={0} onClick={() => setOpen(!open)} style={{ width: 26, height: 26, margin: '-4px -6px 0 0' }}><svg className="ic" aria-hidden="true"><use href="#i-more" /></svg></span>}</div>
      <A href={props.id ? routeFor(`/projects/${route.projectId ?? 'p1'}/board?task=${props.id}`) : r('TaskDetail.dc.html')} className="t" style={{ display: 'block' }}>{solo ? 'Search and filter by cuisine' : props.title || ''}</A>
      {blocked && <div className="chip c-bad wrapt" style={{ alignSelf: 'flex-start' }}><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>{blocked}</div>}
      <div className="row between"><span className={`pts${props.points ? '' : ' none'}`}>{props.points || 'Unestimated'}</span>{assignee ? <span className="who"><span className={`av ${who?.[0] || 'a4'}`} aria-hidden="true">{who?.[1] || initials}</span>{assignee}</span> : <span className="chip c-line">Unassigned</span>}</div>
      {open && <div className="card" role="menu" style={{ position: 'absolute', right: 8, top: 40, zIndex: 8, width: 190, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
        {rows.map((row) => <Fragment key={row.key}><div className="row" role="menuitem" tabIndex={0} style={{ padding: '6px 8px', cursor: busy ? 'wait' : 'pointer' }} onClick={() => changeStatus(row.key)}><svg className="ic" aria-hidden="true"><use href={row.icon} /></svg>{row.label}<span className="sp" />{row.cur && <svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>}</div></Fragment>)}
        <hr className="hr" style={{ margin: '4px 0' }} />
        {blocked ? <div className="row" role="menuitem" tabIndex={0} style={{ padding: '6px 8px', cursor: busy ? 'wait' : 'pointer' }} onClick={() => changeStatus(status, { unblock: true })}><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Unblock</div> : live ? <div className="row" role="menuitem" tabIndex={0} style={{ padding: '6px 8px', cursor: busy ? 'wait' : 'pointer', color: 'var(--danger)' }} onClick={() => changeStatus(status, { blocked: true, blockedReason: 'Blocked' })}><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Mark blocked</div> : <A href={r('BoardBlocked.dc.html')} className="row" role="menuitem" style={{ padding: '6px 8px', color: 'var(--danger)' }}><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Mark blocked</A>}
      </div>}
    </article>
  </div>;
}
