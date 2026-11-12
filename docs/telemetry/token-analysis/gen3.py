import json,collections,datetime as dt,statistics as st
SP=r"C:\Users\danie\AppData\Local\Temp\claude\1ad2cc26966c77c9\fd91efe1-deb5-461e-b33c-21b66ff7fbea\scratchpad"
ALL=json.load(open(SP+r"\all_calls.json"))
P=(2,10,.1,2.5,4)
def cost(c): return (c['i']*P[0]+c['o']*P[1]+c['cr']*P[2]+c['c5']*P[3]+c['c1']*P[4])/1e6
def T(s): return dt.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
LAB={ '4ab6b3':('S01','Architecture & requirements','Brief ingestion (aborted first try)'),
 '51b4c1':('S02','Architecture & requirements','AI-infused web app: architecture design (decision-round Q&A)'),
 'cfecf2':('S03','Architecture & requirements','Attacker-lens threat review of architecture D25-28'),
 '2aacc4':('S04','Workflow/skill engineering','Skill ecosystem design: context-management improvements'),
 '630e0a':('S05','Workflow/skill engineering','Skill ecosystem design review (2 calls)'),
 '1f3803':('S06','Workflow/skill engineering','Apply approved skill-ecosystem revisions (starter)'),
 '254801':('S07','Workflow/skill engineering','Build v1 skills (project-state, branch-state...) + 3 fixture-test subagents'),
 '8c44db':('S08','UI design (W10)','W10 page-flow & interactions document'),
 '2f22c4':('S09','UI design (W10)','W10 UI prototypes (Artifacts, shadcn/ui-ux-pro-max)'),
 '23608b':('S10','Misc','Local-command session (fold-w10-state)'),
 'f78c2e':('S11','Misc','PM slice readiness question'),
 '34b852':('S12','Experiment framework (v1 era)','Experiment framework: worktree strategy, v1 spec, 2 review rounds, plan'),
 'a35f3d':('S13','Review of teammates\' PRs','W1 PR review (initial)'),
 'dea65a':('S14','Review of teammates\' PRs','W1 PR review (robustness check)'),
 '8bdd31':('S15','Misc','/ponytail band (token-band import)'),
 '04a073':('S16','Experiment framework (v1 era)','Experiment framework build (v1 executing-plans), pilot orchestration, impl-stage v1 spec+plan'),
 '9b5d74':('S17','Experiment framework (v1 era)','Impl-stage execution T1-T5 (3 adapter subagents)'),
 'a99788':('S18','Experiment framework (v1 era)','Impl-stage execution T6-T8 driver + 2 reviewers'),
 '13ed76':('S19','Workflow/skill engineering','v2 skills redesign (spec/plan/exec lite v2) - 8 forked sessions'),
 '95b3bb':('S20','W7 product (v2 era)','W7 branch kickoff'),
 '0bc95c':('S21','Misc','Fold W2 into project state (sync-project-state skill)'),
 '15f1dd':('S22','W7 product (v2 era)','W7 spec -> plan -> orchestrated build -> review fixes -> live LLM test -> W7b spec+plan'),
 '4cb0b5':('S23','W7 product (v2 era)','W7c link-UI: worktree setup, W7c spec + 3-lens review + plan review'),
 'cc0da3':('S24','Misc','/ponytail band (v5.3 check, web-fetch subagent)'),
 'fd91ef':('S25','Misc','This analysis (partial)')}
fam=collections.defaultdict(list)
for c in ALL:
    if not c['exp'] and c['model']!='<synthetic>': fam[c['fam']].append(c)
rows=[]
for k,v in fam.items():
    key=None
    for c in v:
        for p,l in LAB.items():
            if c['sid'].startswith(p): key=l;break
        if key: break
    # prefer label by earliest main file
    ms=[c for c in v if c['kind']=='main']
    sids=set(c['sid'][:6] for c in v)
    key=None
    for p,l in LAB.items():
        if p in sids: key=l;break
    rows.append((min(c['ts'] for c in v),key,v))
rows.sort(key=lambda r:r[0])
def line(l,v):
    n=len(v);a=lambda f:sum(c[f] for c in v)
    ctx=[c['i']+c['cr']+c['c5']+c['c1'] for c in v]
    cr=a('cr');cc=a('c5')+a('c1');tot=a('i')+cr+cc
    ms=sum(cost(c) for c in v if c['kind']=='main'); sb=sum(cost(c) for c in v if c['kind']=='sub')
    t0=min(T(c['ts']) for c in v);t1=max(T(c['ts']) for c in v)
    return dict(n=n,i=a('i'),cr=cr,cc=cc,o=a('o'),th=a('th'),cost=ms+sb,main=ms,sub=sb,hit=cr/tot,peak=max(ctx),med=st.median(ctx),span=(t1-t0)/3600,d0=min(c['ts'] for c in v)[5:16],nsub=len(set(c['aid'] for c in v if c['aid'])),files=len(set((c['sid'],c['aid']) for c in v)))
out=[]
for t0,key,v in rows:
    r=line(key,v); r['key']=key; out.append(r)
    print(key[0] if key else '??',(key[1][:28] if key else ''),r['d0'],'calls',r['n'],'files',r['files'],'subs',r['nsub'],'$%.2f'%r['cost'],'(sub %.2f)'%r['sub'],'cr',f"{r['cr']:,}",'cc',f"{r['cc']:,}",'out',f"{r['o']:,}",'hit%.1f'%(r['hit']*100),'peak',r['peak'],'med',int(r['med']),'span_h %.1f'%r['span'])
json.dump(out,open(SP+r"\fam.json",'w'))
bycat=collections.defaultdict(lambda:[0,0.0,0,0,0])
for r in out:
    k=r['key'][1] if r['key'] else '??'; b=bycat[k];b[0]+=1;b[1]+=r['cost'];b[2]+=r['cr'];b[3]+=r['cc'];b[4]+=r['o']
for k,b in sorted(bycat.items(),key=lambda x:-x[1][1]): print(k,b)
