// @ts-nocheck
// Generated from the design canvas page Icons.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

componentDidMount() {
const root = document.documentElement;
this._applied = [];
const apply = () => {
this._applied.forEach((k) => root.style.removeProperty(k));
this._applied = [];
try {
const mode = localStorage.getItem('easel-mode') || 'light';
root.setAttribute('data-theme', mode);
const t = JSON.parse(localStorage.getItem('easel-theme-' + mode) || '{}');
Object.keys(t).forEach((k) => { root.style.setProperty(k, t[k]); this._applied.push(k); });
} catch (e) {}
};
apply();
this._onStorage = (e) => { if (!e.key || e.key.indexOf('easel-') === 0) apply(); };
window.addEventListener('storage', this._onStorage);
}
componentWillUnmount() { window.removeEventListener('storage', this._onStorage); }
renderVals() {
return {
gallery: !this.props.bare,
names: ['folder','board','list','flag','zap','users','sliders','spark','pulse','mic','chart','task','circle','half','eye','check','lock','alert','plus','right','down','more','x','upload','file','commit','pr','up','down2','edit','trash','grip','search','info','cal','copy','refresh','wifi','box']
};
}
}

export default function Icons(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><svg width="0" height="0" style={{position: "absolute"}} aria-hidden="true"><symbol id="i-folder" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></symbol>{" "}<symbol id="i-board" viewBox="0 0 24 24"><path d="M4 4h5v16H4zM10 4h4v9h-4zM15 4h5v12h-5z" /></symbol>{" "}<symbol id="i-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></symbol>{" "}<symbol id="i-flag" viewBox="0 0 24 24"><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></symbol>{" "}<symbol id="i-zap" viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></symbol>{" "}<symbol id="i-users" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></symbol>{" "}<symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4" /></symbol>{" "}<symbol id="i-spark" viewBox="0 0 24 24"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></symbol>{" "}<symbol id="i-pulse" viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4" /></symbol>{" "}<symbol id="i-mic" viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3" /></symbol>{" "}<symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20V11M10 20V4M16 20v-7M21 20H3" /></symbol>{" "}<symbol id="i-task" viewBox="0 0 24 24"><path d="m9 11 3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9" /></symbol>{" "}<symbol id="i-circle" viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z" /></symbol>{" "}<symbol id="i-half" viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 4v16" /></symbol>{" "}<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" /></symbol>{" "}<symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10" /></symbol>{" "}<symbol id="i-lock" viewBox="0 0 24 24"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></symbol>{" "}<symbol id="i-alert" viewBox="0 0 24 24"><path d="m12 3 10 18H2zM12 10v5M12 18h.01" /></symbol>{" "}<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>{" "}<symbol id="i-right" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></symbol>{" "}<symbol id="i-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></symbol>{" "}<symbol id="i-more" viewBox="0 0 24 24"><path d="M5 12h.01M12 12h.01M19 12h.01" /></symbol>{" "}<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></symbol>{" "}<symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></symbol>{" "}<symbol id="i-file" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" /></symbol>{" "}<symbol id="i-commit" viewBox="0 0 24 24"><path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 12h6M15 12h6" /></symbol>{" "}<symbol id="i-pr" viewBox="0 0 24 24"><path d="M6 3v12M6 18a2 2 0 1 0 0 .01M18 21V9a3 3 0 0 0-3-3h-4M13 3l-2 3 2 3M18 21a2 2 0 1 0 0 .01" /></symbol>{" "}<symbol id="i-up" viewBox="0 0 24 24"><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2l-1.5 7a2 2 0 0 1-2 1.6H7" /></symbol>{" "}<symbol id="i-down2" viewBox="0 0 24 24"><path d="M17 13V4h3v9zM17 13l-4 8a2 2 0 0 1-2-2v-4H5a2 2 0 0 1-2-2l1.5-7A2 2 0 0 1 6.5 4H17" /></symbol>{" "}<symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z" /></symbol>{" "}<symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></symbol>{" "}<symbol id="i-grip" viewBox="0 0 24 24"><path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" /></symbol>{" "}<symbol id="i-search" viewBox="0 0 24 24"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5" /></symbol>{" "}<symbol id="i-info" viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 11v5M12 8h.01" /></symbol>{" "}<symbol id="i-cal" viewBox="0 0 24 24"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /></symbol>{" "}<symbol id="i-copy" viewBox="0 0 24 24"><path d="M9 9h11v11H9zM5 15V4h11" /></symbol>{" "}<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5" /></symbol>{" "}<symbol id="i-wifi" viewBox="0 0 24 24"><path d="M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M9 17a5 5 0 0 1 6 0M12 20h.01M3 3l18 18" /></symbol>{" "}<symbol id="i-box" viewBox="0 0 24 24"><path d="M4 8h16v12H4zM3 4h18v4H3zM10 12h4" /></symbol></svg>{v.gallery ? (<><div style={{width: "1280px", height: "520px", padding: "40px 48px", background: "var(--bg)", fontFamily: "Inter, system-ui, sans-serif"}}><h1 style={{margin: "0 0 4px 0"}}>Icon set</h1>{" "}<p className="muted" style={{margin: "0 0 24px 0"}}>One stroke family, 24px grid, drawn at 16px (20px large) with 1.75 stroke. Used for navigation, status and actions; never emoji.</p>{" "}<div style={{display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: "12px"}}>{(v.names || []).map((L_n: any, i_n: number) => (<Fragment key={i_n}><div className="card flat" style={{padding: "12px", display: "flex", alignItems: "center", gap: "10px"}}><svg className="ic lg" aria-hidden="true"><use href={`#i-${L_n}`} /></svg><span className="small">{L_n}</span></div></Fragment>))}</div></div></>) : null}</>);
}
