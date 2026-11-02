// @ts-nocheck
// Generated from the design canvas page Styleguide.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import TaskCard from './TaskCard';
import StatusChip from './StatusChip';
import RoleBadge from './RoleBadge';
import RiskBadge from './RiskBadge';
import Banner from './Banner';
import ProgressBar from './ProgressBar';
import EmptyState from './EmptyState';
import ConfirmDialog from './ConfirmDialog';
import Top from './Top';
import ProjectHead from './ProjectHead';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

groupsDef() {
return [
{ name: 'Surfaces', tokens: [['--bg','Page background'],['--surface','Card and panel'],['--sunk','Recessed (board columns)'],['--head','Table header'],['--fill','Hover and neutral fill'],['--line','Borders'],['--line2','Dividers']] },
{ name: 'Text', tokens: [['--ink','Primary text'],['--muted','Secondary text'],['--chip-t','Neutral chip text']] },
{ name: 'Brand', tokens: [['--accent','Brand: buttons, bars'],['--accent-h','Brand hover'],['--accent-t','Brand text, links, active tab'],['--accent-s','Brand tint']] },
{ name: 'Status', tokens: [['--ok','Success text'],['--ok-s','Success tint'],['--warn','Warning text'],['--warn-s','Warning tint'],['--danger','Danger text'],['--danger-s','Danger tint'],['--danger-btn','Danger button'],['--info','Info text'],['--info-s','Info tint']] },
{ name: 'Project header', tokens: [['--phead-bg','Header background'],['--phead-ink','Project title'],['--phead-t','Tab text'],['--phead-on','Active tab'],['--phead-line','Header border']] },
{ name: 'Banners', tokens: [['--b-info-line','Info border'],['--b-info-t','Info text'],['--b-ok-line','Success border'],['--b-ok-t','Success text'],['--b-warn-line','Warning border'],['--b-warn-t','Warning text'],['--b-bad-line','Error border'],['--b-bad-t','Error text']] },
{ name: 'Controls', tokens: [['--input-line','Input border'],['--check-line','Checkbox border']] },
{ name: 'Avatars', tokens: [['--av1','Avatar 1'],['--av2','Avatar 2'],['--av3','Avatar 3'],['--av4','Avatar 4'],['--av5','Avatar 5']] }
];
}
lensDef() { return [['--rb','Button and input corner radius'],['--rc','Card corner radius']]; }
allKeys() {
const k = [];
this.groupsDef().forEach((g) => g.tokens.forEach((t) => k.push(t[0])));
this.lensDef().forEach((l) => k.push(l[0]));
return k;
}
componentDidMount() {
let mode = 'light';
try { mode = localStorage.getItem('easel-mode') || 'light'; } catch (e) {}
this.loadMode(mode);
}
loadMode(mode) {
const root = document.documentElement;
const keys = this.allKeys();
let saved = {};
try { saved = JSON.parse(localStorage.getItem('easel-theme-' + mode) || '{}'); } catch (e) {}
keys.forEach((k) => root.style.removeProperty(k));
root.setAttribute('data-theme', mode);
const cs = getComputedStyle(root);
const defaults = {};
keys.forEach((k) => { defaults[k] = cs.getPropertyValue(k).trim(); });
Object.keys(saved).forEach((k) => root.style.setProperty(k, saved[k]));
this.setState({ mode: mode, defaults: defaults, vals: Object.assign({}, defaults, saved) });
}
setMode(m) {
try { localStorage.setItem('easel-mode', m); } catch (e) {}
this.loadMode(m);
}
persist(vals) {
const d = this.state.defaults || {};
const ov = {};
Object.keys(vals).forEach((k) => { if (vals[k] !== d[k]) ov[k] = vals[k]; });
try { localStorage.setItem('easel-theme-' + (this.state.mode || 'light'), JSON.stringify(ov)); } catch (e) {}
return ov;
}
setToken(k, v) {
const vals = Object.assign({}, this.state.vals, { [k]: v });
document.documentElement.style.setProperty(k, v);
this.setState({ vals: vals });
this.persist(vals);
}
resetAll() {
const root = document.documentElement;
this.allKeys().forEach((k) => root.style.removeProperty(k));
try { localStorage.removeItem('easel-theme-' + (this.state.mode || 'light')); } catch (e) {}
this.setState({ vals: Object.assign({}, this.state.defaults) });
}
lum(h) {
const c = [1, 3, 5].map((i) => { const v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
ratio(a, b) {
if (!/^#[0-9a-fA-F]{6}$/.test(a) || !/^#[0-9a-fA-F]{6}$/.test(b)) return 0;
const x = this.lum(a), y = this.lum(b);
return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
renderVals() {
const vals = this.state && this.state.vals ? this.state.vals : {};
const groups = this.groupsDef().map((g) => ({
name: g.name,
tokens: g.tokens.map((t) => ({ key: t[0], label: t[1], value: vals[t[0]] || '#000000', hex: (vals[t[0]] || '').toUpperCase(), onChange: (e) => this.setToken(t[0], e.target.value) }))
}));
const lens = this.lensDef().map((l) => ({ key: l[0], label: l[1], value: parseInt(vals[l[0]] || '8', 10) || 0, onChange: (e) => this.setToken(l[0], e.target.value + 'px') }));
const v = (x) => (x.charAt(0) === '#' ? x : vals[x] || '#000000');
const pairs = [['Primary text on card', '--ink', '--surface'], ['Secondary text on card', '--muted', '--surface'], ['Secondary text on page', '--muted', '--bg'], ['Button label on brand', '#FFFFFF', '--accent'], ['Brand text on card', '--accent-t', '--surface'], ['Done chip', '--ok', '--ok-s'], ['Warning chip', '--warn', '--warn-s'], ['Danger chip', '--danger', '--danger-s'], ['Info chip', '--info', '--info-s'], ['Danger button label', '#FFFFFF', '--danger-btn']];
const checks = pairs.map((p) => { const r = this.ratio(v(p[1]), v(p[2])); const ok = r >= 4.5; return { label: p[0], text: r.toFixed(1) + ':1 ' + (ok ? 'pass' : 'fail'), cls: ok ? 'c-ok' : 'c-bad', icon: ok ? '#i-check' : '#i-alert' }; });
const d = this.state && this.state.defaults ? this.state.defaults : {};
const changed = Object.keys(vals).filter((k) => vals[k] !== d[k]);
const mode = this.state && this.state.mode ? this.state.mode : 'light';
const sel = mode === 'dark' ? ':root[data-theme="dark"]' : ':root';
const exportText = changed.length ? sel + '{\n' + changed.map((k) => '  ' + k + ': ' + vals[k] + ';').join('\n') + '\n}' : 'No changes to the ' + mode + ' palette yet. These are the values already in ui.css.';
return { groups: groups, lens: lens, checks: checks, exportText: exportText, reset: () => this.resetAll(), isDark: mode === 'dark', isLight: mode === 'light', darkCls: mode === 'dark' ? 'p' : 'g', lightCls: mode === 'light' ? 'p' : 'g', setDark: () => this.setMode('dark'), setLight: () => this.setMode('light') };
}
}

export default function Styleguide(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app" style={{padding: "40px 48px 64px", gap: "28px"}}><header className="stack8"><h1 style={{fontSize: "32px", lineHeight: "40px"}}>Design system</h1>{" "}<p className="muted" style={{maxWidth: "760px"}}>Every colour and reusable component in one place. Change a colour below and every board that is open updates at once; the same classes and tokens in <b>ui.css</b> drive every board. Changes are saved in this browser only, so use the export box to make them permanent.</p></header>{" "}<section className="card stack" aria-labelledby="th"><div className="row wrap between"><div className="stack8" style={{gap: "2px"}}><h2 id="th">Theme controls</h2><span className="small muted">Pick a colour with the swatch or the picker. Dark and light each keep their own adjustments. Other open boards follow when the browser shares storage between them; reload a board if it does not.</span></div>{" "}<div className="row wrap"><div className="seg" role="group" aria-label="Colour mode"><button type="button" className={`btn sm ${v.darkCls}`} aria-pressed={v.isDark} onclick={v.setDark} style={{border: "0"}}>Dark</button><button type="button" className={`btn sm ${v.lightCls}`} aria-pressed={v.isLight} onclick={v.setLight} style={{border: "0"}}>Light</button></div>{" "}<span className="btn" onclick={v.reset}><svg className="ic" aria-hidden="true"><use href="#i-refresh" /></svg>Reset this mode</span></div></div>{" "}<div className="g2" style={{alignItems: "start"}}><div className="stack">{(v.groups || []).map((L_grp: any, i_grp: number) => (<Fragment key={i_grp}><div><h3 style={{marginBottom: "8px"}}>{L_grp.name}</h3>{" "}<div className="g2" style={{gap: "8px 16px"}}>{(L_grp.tokens || []).map((L_t: any, i_t: number) => (<Fragment key={i_t}><label className="row" style={{gap: "10px", padding: "6px 8px", border: "1px solid var(--line2)", borderRadius: "8px", cursor: "pointer"}}><input type="color" defaultValue={L_t.value} onchange={L_t.onChange} aria-label={L_t.label} style={{width: "36px", height: "28px", padding: "0", border: "1px solid var(--line)", borderRadius: "6px", background: "none", cursor: "pointer"}} />{" "}<span style={{flex: "1", minWidth: "0", lineHeight: "1.25"}}><span className="small b" style={{display: "block"}}>{L_t.label}</span><span className="small muted num">{L_t.key} · {L_t.hex}</span></span></label></Fragment>))}</div></div></Fragment>))}{" "}<div><h3 style={{marginBottom: "8px"}}>Shape</h3>{" "}{(v.lens || []).map((L_l: any, i_l: number) => (<Fragment key={i_l}><label className="row" style={{gap: "12px", padding: "6px 8px"}}><input type="range" min="0" max="24" defaultValue={L_l.value} onchange={L_l.onChange} aria-label={L_l.label} style={{flex: "1"}} />{" "}<span className="small" style={{width: "220px"}}><b>{L_l.label}</b>{" "}<span className="muted num">{L_l.value}px</span></span></label></Fragment>))}</div></div>{" "}<div className="stack"><div className="card flat stack8"><h3>Contrast checks</h3>{" "}<p className="small muted">Text needs 4.5:1. These update as you change colours.</p>{" "}{(v.checks || []).map((L_c: any, i_c: number) => (<Fragment key={i_c}><div className="row between" style={{padding: "4px 0", borderBottom: "1px solid var(--line2)"}}><span>{L_c.label}</span><span className={`chip ${L_c.cls}`}><svg className="ic" aria-hidden="true"><use href={L_c.icon} /></svg>{L_c.text}</span></div></Fragment>))}</div>{" "}<div className="card flat stack8"><h3>Export</h3>{" "}<p className="small muted">Copy this block and send it back, and it becomes the permanent default in ui.css.</p>{" "}<textarea className="in num" rows={7} readOnly aria-label="Theme export" style={{fontSize: "12px", fontFamily: "ui-monospace, Menlo, monospace"}} defaultValue={"{v.exportText}"} /></div></div></div></section>{" "}<section className="card stack" aria-labelledby="ty"><h2 id="ty">Type</h2>{" "}<div className="g3" style={{alignItems: "start"}}><div className="stack8"><h1>Heading 1, 24 / 32</h1><h2>Heading 2, 18 / 26</h2><h3>Heading 3, 15 / 22</h3></div>{" "}<div className="stack8"><p>Body, 14 / 21. The quick brown fox jumps over the lazy dog.</p><p className="small">Small, 12 / 18, for captions and meta.</p><p className="muted">Muted body for secondary text.</p></div>{" "}<div className="stack8"><p className="num b" style={{fontSize: "28px"}}>1,234.50</p><p className="small muted">Tabular figures for tables and counts</p></div></div></section>{" "}<section className="card stack" aria-labelledby="bt"><h2 id="bt">Buttons</h2>{" "}<div className="row wrap"><span className="btn p"><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>Primary</span>{" "}<span className="btn">Default</span>{" "}<span className="btn g">Ghost</span>{" "}<span className="btn d"><svg className="ic" aria-hidden="true"><use href="#i-trash" /></svg>Danger</span>{" "}<span className="btn p sm">Small</span>{" "}<span className="btn ib" aria-label="Icon button"><svg className="ic" aria-hidden="true"><use href="#i-edit" /></svg></span>{" "}<span className="btn p dis">Disabled</span>{" "}<span className="btn p"><svg className="ic" aria-hidden="true"><use href="#i-spark" /></svg>AI action</span>{" "}<span className="btn p dis"><svg className="ic" aria-hidden="true"><use href="#i-refresh" /></svg>Busy, retry in 12 s</span></div></section>{" "}<section className="card stack" aria-labelledby="fm"><h2 id="fm">Forms</h2>{" "}<div className="g3" style={{alignItems: "start"}}><div className="field"><label htmlFor="sg1">Label</label><input id="sg1" className="in" defaultValue="Field value" /><span className="hint">Helper text</span></div>{" "}<div className="field"><label htmlFor="sg2">With error</label><input id="sg2" className="in err" defaultValue="Bad value" /><span className="err-t"><svg className="ic" style={{width: "14px", height: "14px"}} aria-hidden="true"><use href="#i-alert" /></svg>Message near the field</span></div>{" "}<div className="stack8"><span className="sel">Select<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span>{" "}<div className="row"><span className="check on"><svg className="ic" style={{width: "12px", height: "12px", strokeWidth: "3", color: "#fff"}} aria-hidden="true"><use href="#i-check" /></svg></span>Checked<span className="check" style={{marginLeft: "12px"}}></span>Unchecked</div>{" "}<div className="seg" style={{alignSelf: "flex-start"}}><span className="on">Selected</span><span>Option</span><span>Option</span></div></div></div></section>{" "}<section className="card stack" aria-labelledby="ch"><h2 id="ch">Chips, badges and avatars</h2>{" "}<div className="row wrap"><span className="chip c-todo"><svg className="ic" aria-hidden="true"><use href="#i-circle" /></svg>To do</span>{" "}<span className="chip c-prog"><svg className="ic" aria-hidden="true"><use href="#i-half" /></svg>In progress</span>{" "}<span className="chip c-rev"><svg className="ic" aria-hidden="true"><use href="#i-eye" /></svg>In review</span>{" "}<span className="chip c-done"><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Done</span>{" "}<span className="chip c-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Blocked</span>{" "}<span className="chip c-ok"><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>On track</span>{" "}<span className="chip c-warn"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>At risk</span>{" "}<span className="chip c-info"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg>Info</span>{" "}<span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>Checkpoint</span>{" "}<span className="chip c-line"><svg className="ic" aria-hidden="true"><use href="#i-lock" /></svg>Archived</span>{" "}<span className="flagm"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>Flagged for review</span></div>{" "}<div className="row wrap"><span className="role r-pm">Project Manager</span><span className="role r-lead">Dev Lead</span><span className="role r-dev">Developer</span>{" "}<span className="pts">5</span><span className="pts none">Unestimated</span>{" "}<span className="av a1">AR</span><span className="av a2">DT</span><span className="av a3">PN</span><span className="av a4">WO</span><span className="av a5">ML</span></div>{" "}<div className="g2"><div className="stack8"><div className="row between small"><span className="muted">Progress bar</span><b className="num">30%</b></div><div className="bar big"><i style={{width: "30%"}}></i></div></div>{" "}<div className="stack8"><span className="small muted">Skeleton</span><div className="sk" style={{width: "60%"}}></div><div className="sk"></div></div></div></section>{" "}<section className="card stack" aria-labelledby="cd"><h2 id="cd">Cards, tasks and tables</h2>{" "}<div className="g3" style={{alignItems: "start"}}><div className="card flat"><h3>Card</h3><p className="muted">Surface, border, radius and shadow.</p></div>{" "}<div className="col"><div className="col-h"><b>Task card</b><span className="small muted">default, blocked, unassigned, menu open</span></div>{" "}<div className="cards" style={{gridTemplateColumns: "1fr", paddingBottom: "150px"}}><TaskCard epic={"Pickup"} title={"QR pickup code"} points={"3"} who={"wo"} status={"todo"} />{" "}<TaskCard epic={"Order and pay"} title={"Student ID payment"} points={"8"} who={"wo"} status={"prog"} blocked={"Blocked: waiting for sandbox keys"} />{" "}<TaskCard epic={"Order and pay"} title={"Order confirmation email"} points={""} who={""} status={"todo"} />{" "}<TaskCard epic={"Browse stalls and menus"} title={"Search and filter by cuisine"} points={"5"} who={"ml"} status={"todo"} menu={"true"} /></div></div>{" "}<div className="card pad0"><div className="ch"><b>Task rows</b></div><div className="trow"><span className="t">Task row</span><span className="chip c-done"><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Done</span><span className="pts">3</span></div><div className="trow"><span className="t">Another row</span><span className="chip c-todo"><svg className="ic" aria-hidden="true"><use href="#i-circle" /></svg>To do</span><span className="pts">5</span></div></div></div>{" "}<div className="card pad0"><table className="tbl"><thead><tr><th>Name</th><th>Role</th><th className="r">Points</th></tr></thead><tbody><tr><td className="b">Table row</td><td><span className="role r-dev">Developer</span></td><td className="r num">8</td></tr><tr><td className="b">Another row</td><td><span className="role r-lead">Dev Lead</span></td><td className="r num">13</td></tr></tbody></table></div></section>{" "}<section className="card stack" aria-labelledby="fb"><h2 id="fb">Feedback</h2>{" "}<div className="g2" style={{alignItems: "start"}}><div className="stack8"><div className="banner b-info"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><span>Info banner</span></div>{" "}<div className="banner b-ok"><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg><span>Success banner</span></div>{" "}<div className="banner b-warn"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>Warning banner</span></div>{" "}<div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>Error banner</span></div>{" "}<div className="toast" style={{alignSelf: "flex-start"}}><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Toast message</div></div>{" "}<div className="stack"><div className="dialog" style={{width: "100%"}}><h3>Dialog</h3><p className="muted">Confirmation text names the thing and its consequences.</p><div className="dfoot"><span className="btn">Cancel</span><span className="btn d">Delete</span></div></div>{" "}<div className="empty card flat" style={{padding: "24px"}}><span className="ico"><svg className="ic lg" aria-hidden="true"><use href="#i-list" /></svg></span><b style={{color: "var(--ink)"}}>Empty state</b><span className="btn p sm">Primary action</span></div></div></div></section>{" "}<section className="card stack" aria-labelledby="sc"><h2 id="sc">Shared components</h2>{" "}<p className="small muted">Each is its own board in the components column at the left of the canvas. Change a component there and every screen that uses it updates.</p>{" "}<div className="g3" style={{alignItems: "start"}}><div className="stack8"><span className="small b muted">Status chip</span><div className="row wrap"><StatusChip status={"todo"} /><StatusChip status={"prog"} /><StatusChip status={"rev"} /><StatusChip status={"done"} /></div></div>{" "}<div className="stack8"><span className="small b muted">Role badge</span><div className="row wrap"><RoleBadge role={"pm"} /><RoleBadge role={"lead"} /><RoleBadge role={"dev"} /></div></div>{" "}<div className="stack8"><span className="small b muted">Risk badge</span><div className="row wrap"><RiskBadge risk={"ok"} /><RiskBadge risk={"warn"} /><RiskBadge risk={"unknown"} /></div></div></div>{" "}<div className="g2" style={{alignItems: "start"}}><div className="stack8"><span className="small b muted">Banner</span><Banner kind={"info"} text={"Info banner"} /><Banner kind={"ok"} text={"Success banner"} /><Banner kind={"warn"} text={"Warning banner"} /><Banner kind={"bad"} text={"Error banner"} /><span className="small b muted" style={{marginTop: "8px"}}>Progress bar</span><ProgressBar pct={"30"} label={"Points done"} /></div>{" "}<div className="stack8"><span className="small b muted">Empty state</span><EmptyState icon={"list"} title={"The backlog is empty."} text={"Add the first epic."} action={"Add epic"} /></div></div>{" "}<span className="small b muted">Confirm dialog</span>{" "}<ConfirmDialog title={"Delete epic Pickup?"} body={"This also deletes its 2 tasks."} confirm={"Delete epic"} danger={"true"} /></section>{" "}<section className="card stack" aria-labelledby="nv"><h2 id="nv">Navigation components</h2>{" "}<p className="small muted">These are the real shared components that every screen imports; edits to their files change all boards.</p>{" "}<div style={{border: "1px solid var(--line)", borderRadius: "10px", overflow: "hidden"}}><Top role={"pm"} project={"1"} /></div>{" "}<p className="small muted">The project switcher in the top bar replaces the old left navigation. <b>All projects</b> opens the Projects list for a PM, the Overview for a Dev Lead and My work for a Developer. See the open menu on the Project switcher board.</p>{" "}<div className="row wrap" style={{alignItems: "flex-start", gap: "24px"}}><div style={{flex: "1", minWidth: "480px", border: "1px solid var(--line)", borderRadius: "10px", overflow: "hidden"}}><ProjectHead role={"pm"} active={"board"} /></div></div></section></div></>);
}
