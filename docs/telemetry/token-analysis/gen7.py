import json,collections,re,csv,statistics as st,datetime as dt
SP=r"C:\Users\danie\AppData\Local\Temp\claude\1ad2cc26966c77c9\fd91efe1-deb5-461e-b33c-21b66ff7fbea\scratchpad"
ALL=json.load(open(SP+r"\all_calls.json"));D=json.load(open(SP+r"\data2.json"));FAM=json.load(open(SP+r"\fam.json"))
P=(2,10,.1,2.5,4)
def cost(c): return (c['i']*P[0]+c['o']*P[1]+c['cr']*P[2]+c['c5']*P[3]+c['c1']*P[4])/1e6
def K(n): return f"{n/1000:,.0f}K" if n<1e6 else f"{n/1e6:,.2f}M"
def md(head,rows): return '| '+' | '.join(head)+' |\n|'+'|'.join('---' for _ in head)+'|\n'+'\n'.join('| '+' | '.join(str(x) for x in r)+' |' for r in rows)
def T(s): return dt.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
TB={}
# naive vs dedupe
naive=sum(cost(c) for d in D for c in d['calls']); naive_cl=sum(cost(c) for d in D if not d['root'].startswith('S--CS3227-exp') for c in d['calls'])
dd=sum(cost(c) for c in ALL); print('naive all',naive,'dedup',dd,'naive claude',naive_cl)
rawcalls=sum(len(d['calls']) for d in D)
# per-line duplicates in raw jsonl (streamed blocks)
print('raw per-file calls',rawcalls,'unique',len(ALL))
CL=[c for c in ALL if not c['exp'] and c['model']!='<synthetic>']
# first-call ctx of main files (all)
byfile=collections.defaultdict(list)
for c in CL: byfile[(c['root'],c['sid'],c['aid'])].append(c)
fm=[]
for k,v in byfile.items():
    v.sort(key=lambda c:c['ts'])
    if k[2] is None: fm.append(v[0]['i']+v[0]['cr']+v[0]['c5']+v[0]['c1'])
print('main first-call ctx: median',st.median(fm),'min',min(fm),'max',max(fm),len(fm))
# rebuild events
ev=[]
LAB={f['key'][0]:f['key'] for f in FAM if f['key']}
famlab={}
for c in CL: pass
for k,v in byfile.items():
    if k[2] is not None: continue
    v.sort(key=lambda c:c['ts'])
    for a,b in zip(v,v[1:]):
        gap=T(b['ts'])-T(a['ts']); ctx=b['i']+b['cr']+b['c5']+b['c1']
        if gap>3600 and (b['c5']+b['c1'])>=0.5*ctx:
            ev.append((b['ts'][5:16],k[1][:6],gap/3600,ctx,b['c1'],b['c1']*4/1e6))
ev.sort(key=lambda e:-e[5])
TB['rebuild_top']=md(['UTC','Session','Idle gap (h)','Context re-written','1h-cache write cost'],[(e[0],e[1],f"{e[2]:.1f}",K(e[4]),f"${e[5]:.2f}") for e in ev[:12]])
print(len(ev),sum(e[5] for e in ev),sum(e[4] for e in ev))
# also how many returns after >1h gaps WITHOUT mostly-rewrite (i.e. small ctx)?
allgaps=0
for k,v in byfile.items():
    if k[2] is None:
        for a,b in zip(v,v[1:]):
            if T(b['ts'])-T(a['ts'])>3600: allgaps+=1
print('main >1h gaps total',allgaps)
# daily spend UTC
day=collections.defaultdict(lambda:[0.0,0.0,0,0])
for c in ALL:
    d=c['ts'][:10]; k=0 if c['exp'] else 1
    day[d][0 if c['exp'] else 1]+=cost(c); day[d][2]+=1
    day[d][3]+=c['o']
rows=[]
for d,v in sorted(day.items()): rows.append((d,f"${v[1]:.2f}",f"${v[0]:.2f}",f"${v[0]+v[1]:.2f}",v[2],K(v[3])))
TB['daily']=md(['Date (UTC)','Interactive sessions','Experiment runs','Total','API calls','Output tokens'],rows)
print(TB['daily'])
# context distribution by era and kind
def pct(l,p): l=sorted(l);return l[int(len(l)*p)-1 if p<1 else -1]
rows=[]
for nm,flt in [('Interactive main v1 (<=5 Nov)',lambda c:c['kind']=='main' and c['ts']<'2026-11-06T21:00'),('Interactive main v2 (>=7 Nov)',lambda c:c['kind']=='main' and c['ts']>='2026-11-06T21:00'),('Interactive subagents v1',lambda c:c['kind']=='sub' and c['ts']<'2026-11-06T21:00'),('Interactive subagents v2',lambda c:c['kind']=='sub' and c['ts']>='2026-11-06T21:00')]:
    l=[c for c in CL if flt(c)];x=[c['i']+c['cr']+c['c5']+c['c1'] for c in l]
    rows.append((nm,len(l),K(st.median(x)),K(pct(x,.9)),K(max(x)),f"${sum(cost(c) for c in l)/len(l):.3f}",f"{st.median([c['o'] for c in l]):.0f}",f"{sum(c['o'] for c in l)/len(l):.0f}"))
E=[c for c in ALL if c['exp']]
for nm,flt in [('Experiment main',lambda c:c['kind']=='main'),('Experiment subagents',lambda c:c['kind']=='sub')]:
    l=[c for c in E if flt(c) and c['model']!='<synthetic>'];x=[c['i']+c['cr']+c['c5']+c['c1'] for c in l]
    rows.append((nm,len(l),K(st.median(x)),K(pct(x,.9)),K(max(x)),f"${sum(cost(c) for c in l)/len(l):.3f}",f"{st.median([c['o'] for c in l]):.0f}",f"{sum(c['o'] for c in l)/len(l):.0f}"))
TB['ctxdist']=md(['Group','API calls','Median ctx/call','P90','Max','Avg $/call','Median output/call','Mean output/call'],rows); print(TB['ctxdist'])
# ctx bucket cost table main
bk=collections.defaultdict(lambda:[0,0.0])
for c in CL:
    if c['kind']!='main': continue
    x=c['i']+c['cr']+c['c5']+c['c1'];b=min(x//100000,6);bk[b][0]+=1;bk[b][1]+=cost(c)
tot=sum(v[1] for v in bk.values())
TB['ctxbuckets']=md(['Context per call','Calls','Cost','Share of main cost','Avg $/call'],[(f"{b*100}K-{(b+1)*100}K" if b<6 else '600K+',v[0],f"${v[1]:.2f}",f"{v[1]/tot*100:.0f}%",f"${v[1]/v[0]:.3f}") for b,v in sorted(bk.items())])
print(TB['ctxbuckets'])
# token type shares overall (claude interactive + exp)
def tt(l):
    r=collections.Counter()
    for c in l:
        r['in']+=c['i'];r['cr']+=c['cr'];r['c5']+=c['c5'];r['c1']+=c['c1'];r['o']+=c['o'];r['th']+=c['th']
        r['$in']+=c['i']*2/1e6;r['$cr']+=c['cr']*.1/1e6;r['$c5']+=c['c5']*2.5/1e6;r['$c1']+=c['c1']*4/1e6;r['$o']+=c['o']*10/1e6
    return r
rows=[]
for nm,l in [('Interactive - main',[c for c in CL if c['kind']=='main']),('Interactive - subagents',[c for c in CL if c['kind']=='sub']),('Experiment runs - main',[c for c in E if c['kind']=='main']),('Experiment runs - subagents',[c for c in E if c['kind']=='sub']),('**All Claude Code**',[c for c in ALL])]:
    r=tt(l);tot_t=r['in']+r['cr']+r['c5']+r['c1']+r['o'];tc=r['$in']+r['$cr']+r['$c5']+r['$c1']+r['$o']
    rows.append((nm,len(l),f"{r['in']:,}",K(r['cr']),K(r['c5']),K(r['c1']),K(r['o']),K(r['th']),f"{r['cr']/(r['in']+r['cr']+r['c5']+r['c1'])*100:.1f}%",f"${r['$cr']:.2f}",f"${r['$c5']+r['$c1']:.2f}",f"${r['$o']:.2f}",f"${tc:.2f}"))
TB['tokentypes']=md(['Bucket','API calls','Fresh input','Cache read','Cache write 5m','Cache write 1h','Output','(of which thinking)','Cache-read share of input','$ cache read','$ cache write','$ output','Total $'],rows); print(TB['tokentypes'])
# per-date? family table
rows=[]
for f in FAM:
    k=f['key']
    rows.append((k[0],k[1],k[2],f['d0'],f"{f['span']:.1f}",f['files'],f['nsub'],f['n'],K(f['cr']),K(f['cc']),f"{f['o']:,}",f"{f['hit']*100:.1f}%",K(f['peak']),f"${f['main']:.2f}",f"${f['sub']:.2f}",f"${f['cost']:.2f}"))
TB['families']=md(['ID','Context type','What the session(s) did','Start (UTC)','Span (h)','Log files','Subagents','API calls','Cache read','Cache write','Output','Hit rate','Peak ctx','Main $','Sub $','Total $'],rows)
# claude-sonnet-5 legacy
# csv tables
def rd(p): return list(csv.DictReader(open(p,encoding='utf8')))
base=r"S:\CS3227\CS3227-2610-MP4\docs\telemetry\experiments"
runs=rd(base+r"\runs.csv")
rows=[]
for r in runs:
    rows.append((r['arm_id'],r['rep'],r['status']+(f" ({r['abort_reason']})" if r['abort_reason'] else ''),r['wall_s'],r['in_tok'],K(int(r['out_tok'] or 0)),K(int(r['cache_read_tok'] or 0)),K(int(r['cache_write_tok'] or 0)),K(int(r['peak_prompt_tok'] or 0)),f"{float(r['cache_read_share'] or 0)*100:.1f}%",f"${float(r['arm_cost_usd'] or 0):.2f}",r['questions'],r['issues_found'],r['rubric_total']))
TB['exp_plan']=md(['Arm','Rep','Status','Wall (s)','Fresh in','Output','Cache read','Cache write','Peak prompt','Cache-read share','Arm cost','Questions','Issues found','Rubric /40'],rows); print(TB['exp_plan'])
imp=rd(base+r"\impl-runs.csv")
rows=[]
for r in imp:
    rows.append((r['plan_arm_id'],r['sample'],r['status']+(f" ({r['abort_reason']})" if r['abort_reason'] else ''),r['attempts_used'],r['green_attempt'] or '-',r['wall_s'],K(int(r['out_tok'] or 0)),K(int(r['cache_read_tok'] or 0)),K(int(r['cache_write_tok'] or 0)),f"${float(r['impl_cost_usd'] or 0):.2f}",f"${float(r['fix_cost_usd'] or 0):.2f}",f"${float(r['review_cost_usd'] or 0):.2f}",f"${float(r['plan_cost_usd'] or 0):.2f}",r['review_blockers'],r['review_majors'],r['files_off_plan']))
TB['exp_impl']=md(['Plan arm','Sample','Status','Attempts','Green at','Wall (s)','Output','Cache read','Cache write','Attempt-1 cost','Fix (attempt 2) cost','Review cost','Plan cost','Blockers','Majors','Files off plan'],rows); print(TB['exp_impl'])
json.dump(TB,open(SP+r"\tb7.json",'w'))
