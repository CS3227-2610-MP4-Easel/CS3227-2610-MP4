import json,collections,re,statistics as st
SP=r"C:\Users\danie\AppData\Local\Temp\claude\1ad2cc26966c77c9\fd91efe1-deb5-461e-b33c-21b66ff7fbea\scratchpad"
ALL=json.load(open(SP+r"\all_calls.json"))
D=json.load(open(SP+r"\data2.json"))
P=(2,10,.1,2.5,4)
def cost(c): return (c['i']*P[0]+c['o']*P[1]+c['cr']*P[2]+c['c5']*P[3]+c['c1']*P[4])/1e6
def K(n): return f"{n/1000:,.0f}K" if n<1e6 else f"{n/1e6:,.2f}M"
def md(head,rows): return '| '+' | '.join(head)+' |\n|'+'|'.join('---' for _ in head)+'|\n'+'\n'.join('| '+' | '.join(str(x) for x in r)+' |' for r in rows)
TB={}
CL=[c for c in ALL if not c['exp'] and c['model']!='<synthetic>']
# ---- subagent role classification
def role(c):
    t=c['agentType'];d=(c['desc'] or '').lower()
    if t=='reviewer':
        if 'round 2' in d: return 'Reviewer - spec review (lens)'
        if 'plan' in d and 'review the experiment plan' in d or d.startswith('review plan') or 'plan review' in d or 'plan folder' in d: return 'Reviewer - plan review'
        if 'spec' in d: return 'Reviewer - spec review (lens)'
        if re.search(r't\d',d) or 'light review' in d: return 'Reviewer - per-task review'
        if 'diff' in d: return 'Reviewer - branch/diff review'
        if 'lens review' in d: return 'Reviewer - spec review (lens)'
        return 'Reviewer - other'
    if t=='implementer':
        if 'fix' in d: return 'Implementer - review-fix round'
        if 'retry' in d or 'continue' in d: return 'Implementer - retry/continue'
        return 'Implementer - task implementation'
    if t=='general-purpose':
        if 'adapter' in d: return 'General-purpose - adapter writing'
        if 'test' in d: return 'General-purpose - skill fixture test'
        if 'continue' in d: return 'General-purpose - run continuation'
        return 'General-purpose - other'
    if t=='web-fetch': return 'Web-fetch'
    return str(t)
subs=collections.defaultdict(list)
for c in CL:
    if c['kind']=='sub': subs[(c['root'],c['sid'],c['aid'])].append(c)
def era(ts): return 'v1' if ts<'2026-11-06T21:00' else 'v2'
rolestats=collections.defaultdict(lambda:collections.Counter())
unit=[]
for k,v in subs.items():
    v.sort(key=lambda c:c['ts']); r=role(v[0]); e=era(v[0]['ts'])
    ctxs=[c['i']+c['cr']+c['c5']+c['c1'] for c in v]
    m=dict(role=r,era=e,desc=v[0]['desc'],at=v[0]['agentType'],n=len(v),cost=sum(cost(c) for c in v),cr=sum(c['cr'] for c in v),cc=sum(c['c5'] for c in v),o=sum(c['o'] for c in v),peak=max(ctxs),sid=k[1][:6],ts=v[0]['ts'][5:16],first=ctxs[0])
    unit.append(m)
    for (key) in ((r,e),(r,'all')):
        a=rolestats[key];a['agents']+=1;a['calls']+=len(v);a['cost']+=m['cost'];a['cr']+=m['cr'];a['cc']+=m['cc'];a['o']+=m['o'];a['peak']=max(a['peak'],m['peak']);a['first']+=m['first']
rows=[]
for (r,e),a in sorted(rolestats.items(),key=lambda x:(x[0][1]!='all',x[0][1],-x[1]['cost'])):
    rows.append((r,e,a['agents'],a['calls'],K(a['cr']),K(a['cc']),K(a['o']),f"${a['cost']:.2f}",f"${a['cost']/a['agents']:.2f}",K(a['peak'])))
TB['subroles']=md(['Role','Era','Agents','API calls','Cache read','Cache write (5m)','Output','Cost','Cost / agent','Peak ctx'],rows)
# lens split for reviewers
lens=collections.defaultdict(lambda:[0,0.0,0])
for m in unit:
    if m['at']=='reviewer':
        d=(m['desc'] or '').lower()
        l='plan review (whole folder)' if ('plan' in d and 'review' in d and not re.search(r't\\d',d)) else next((x for x in('implementer','tester','attacker','maintainer','all lenses','combined','logic') if x in d),'other')
        lens[(m['era'],l)][0]+=1;lens[(m['era'],l)][1]+=m['cost'];lens[(m['era'],l)][2]+=m['o']
TB['lens']=md(['Era','Lens / scope','Reviews','Total cost','Avg cost','Avg output tokens'],[(e,l,v[0],f"${v[1]:.2f}",f"${v[1]/v[0]:.2f}",f"{v[2]//v[0]:,}") for (e,l),v in sorted(lens.items())])
# full subagent list
rows=[]
for m in sorted(unit,key=lambda m:m['ts']):
    rows.append((m['ts'],m['sid'],m['at'],(m['desc'] or '')[:48],m['role'].split(' - ')[-1] if ' - ' in m['role'] else '',m['era'],m['n'],K(m['first']),K(m['peak']),K(m['cr']),K(m['cc']),K(m['o']),f"${m['cost']:.2f}"))
TB['sublist']=md(['UTC start','Parent','Type','Description','Activity','Era','Calls','1st-call ctx','Peak ctx','Cache read','Cache write','Output','Cost'],rows)
tot_sub=sum(m['cost'] for m in unit); print('sub total',tot_sub,len(unit))
# ---- phase windows
def win(fam_sid_prefixes,t0,t1,kinds=('main','sub')):
    return [c for c in CL if any(c['sid'].startswith(p) for p in fam_sid_prefixes) and t0<=c['ts']<t1 and c['kind'] in kinds]
def agg(cs):
    return dict(n=len(cs),cost=sum(cost(c) for c in cs),cr=sum(c['cr'] for c in cs),cc=sum(c['c5']+c['c1'] for c in cs),o=sum(c['o'] for c in cs),peak=max([c['i']+c['cr']+c['c5']+c['c1'] for c in cs] or [0]))
def phrow(name,cs,note=''):
    m=agg([c for c in cs if c['kind']=='main']);s=agg([c for c in cs if c['kind']=='sub']);t=agg(cs)
    return (name,t['n'],f"${m['cost']:.2f}",f"${s['cost']:.2f}",f"${t['cost']:.2f}",K(t['cr']),K(t['cc']),K(t['o']),K(m['peak']),note)
W7=['15f1dd','5eb330','e60e88','b59463']
ph=[('A. W7 spec: draft + 4-lens review (+1 retry) + fixes','2026-11-07T10:16','2026-11-07T11:26'),
('B. W7 plan: write plan folder + 1 plan reviewer','2026-11-07T11:26','2026-11-07T13:55'),
('C1. Build T1-T4 (+fix rounds), 3-lens review per task','2026-11-07T13:55','2026-11-07T15:39'),
('C2. Build T5-T11 (+fix rounds), light/combined review','2026-11-07T15:39','2026-11-08T03:03'),
('D. Post-build: fix review findings, summary, PR text','2026-11-08T03:03','2026-11-08T03:31'),
('E. Live-LLM test, scope Q&A, gap discussion','2026-11-08T03:31','2026-11-08T17:25'),
('F. W7b spec + 3-lens review','2026-11-08T17:25','2026-11-08T18:13'),
('G. W7b plan + plan reviewer + approval','2026-11-08T18:13','2026-11-08T23:59')]
rows=[phrow(n,win(W7,a,b)) for n,a,b in ph]
TB['w7phases']=md(['Phase (UTC 7-8 Nov)','Calls','Main $','Subagent $','Total $','Cache read','Cache write','Output','Peak main ctx'],[r[:9] for r in rows])
print(TB['w7phases'])
# C split by subagent type
cs=win(W7,'2026-11-07T13:55','2026-11-08T03:03')
byrole=collections.defaultdict(list)
for c in cs:
    byrole['Orchestrator (main)' if c['kind']=='main' else role(dict(c))].append(c)
TB['w7c_roles']=md(['Who','Calls','Cost','Share'],[(k,len(v),f"${sum(cost(c) for c in v):.2f}",f"{sum(cost(c) for c in v)/sum(cost(c) for c in cs)*100:.0f}%") for k,v in sorted(byrole.items(),key=lambda x:-sum(cost(c) for c in x[1]))])
print(TB['w7c_roles'])
# before/after review-policy change: per-task cost
def taskcost(descs_pat,t0,t1):
    return [c for c in CL if c['kind']=='sub' and re.search(descs_pat,(c['desc'] or ''))]
# v1 S16 phases
V1=['441ac5','9a229a','f4514b','15ed62','04a073','3d2ad2','53f8a8','63b291']
ph1=[('P1. Build experiment framework T1-T10 (executing-plans-lite v1)','2026-11-03T06:25','2026-11-03T11:32'),
('P2. Pilot orchestration, crash debugging, analysis, report','2026-11-03T11:32','2026-11-04T17:20'),
('P3. Impl-stage spec (writing-specs-lite v1) + 2 review rounds','2026-11-04T17:20','2026-11-04T18:13'),
('P4. Impl-stage plan (writing-plans-lite v1) + plan review + hand-off','2026-11-04T18:13','2026-11-05T00:23')]
rows=[phrow(n,win(V1,a,b)) for n,a,b in ph1]
TB['v1phases']=md(['Phase (UTC)','Calls','Main $','Subagent $','Total $','Cache read','Cache write','Output','Peak main ctx'],[r[:9] for r in rows]); print(TB['v1phases'])
S12=['be3c73','66288f','34b852']
ph2=[('Design discussion, worktree/experiment strategy','2026-11-02T17:58','2026-11-03T01:30'),
('Spec (writing-specs-lite v1) + review rounds 1-2 + approval','2026-11-03T01:30','2026-11-03T05:56'),
('Plan (writing-plans-lite v1) + plan review + approval','2026-11-03T05:56','2026-11-03T06:13')]
rows=[phrow(n,win(S12,a,b)) for n,a,b in ph2]
TB['s12phases']=md(['Phase (UTC)','Calls','Main $','Subagent $','Total $','Cache read','Cache write','Output','Peak main ctx'],[r[:9] for r in rows]); print(TB['s12phases'])
S23=['4cb0b5','d461b0']
ph3=[('Worktree setup, LLM_MODE wiring, manual UI tests, W7c requirements','2026-11-08T11:33','2026-11-10T11:52'),
('W7c spec (writing-specs-lite-v2) + 3-lens review','2026-11-10T11:52','2026-11-10T13:42'),
('W7c plan + plan-folder review + hand-off to Codex','2026-11-10T13:42','2026-11-10T23:59')]
rows=[phrow(n,win(S23,a,b)) for n,a,b in ph3]
TB['s23phases']=md(['Phase (UTC)','Calls','Main $','Subagent $','Total $','Cache read','Cache write','Output','Peak main ctx'],[r[:9] for r in rows]); print(TB['s23phases'])
json.dump(TB,open(SP+r"\tb4.json",'w'))
# print review unit table: spec/plan authoring+review comparisons raw
for m in sorted(unit,key=lambda m:m['ts']):
    if m['at']=='reviewer': print(m['ts'],m['era'],m['role'],(m['desc'] or '')[:40],m['n'],'$%.2f'%m['cost'],'peak',m['peak'])

