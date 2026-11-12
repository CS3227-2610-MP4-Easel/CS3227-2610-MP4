import json,collections,re
SP=r"C:\Users\danie\AppData\Local\Temp\claude\1ad2cc26966c77c9\fd91efe1-deb5-461e-b33c-21b66ff7fbea\scratchpad"
ALL=json.load(open(SP+r"\all_calls.json"));D=json.load(open(SP+r"\data2.json"))
P=(2,10,.1,2.5,4)
def cost(c): return (c['i']*P[0]+c['o']*P[1]+c['cr']*P[2]+c['c5']*P[3]+c['c1']*P[4])/1e6
def K(n): return f"{n/1000:,.0f}K" if n<1e6 else f"{n/1e6:,.2f}M"
def md(head,rows): return '| '+' | '.join(head)+' |\n|'+'|'.join('---' for _ in head)+'|\n'+'\n'.join('| '+' | '.join(str(x) for x in r)+' |' for r in rows)
E=[c for c in ALL if c['exp'] and c['model']!='<synthetic>']
def parse(root):
    m=re.match(r'S--CS3227-exp-runs-(\d{8})-(\d{6})-pilot-pinned-note(-impl)?-(superpowers|lite|full)-r(\d)(?:-s(\d))?$',root)
    if m: return dict(batch=m.group(1)[4:]+'-'+m.group(2),stage='impl' if m.group(3) else 'plan',arm=m.group(4),rep=int(m.group(5)),sample=m.group(6))
    return dict(batch='spike',stage='spike',arm='-',rep=0,sample=None)
# examine tiny files
ex=[d for d in D if d['root'].startswith('S--CS3227-exp-runs') and len(d['calls'])==1 and d['kind']=='main'][:2]
for d in ex: print('TINY',d['root'][-40:],d['first_user'][:300].replace('\n',' '),d['calls'][0]['i'],d['calls'][0]['cr'],d['calls'][0]['c1']+d['calls'][0]['c5'],d['calls'][0]['o'])
# group by stage,arm
g=collections.defaultdict(list)
for c in E:
    p=parse(c['root']); g[(p['stage'],p['arm'])].append(c)
rows=[]
for k,v in sorted(g.items()):
    mn=[c for c in v if c['kind']=='main'];sb=[c for c in v if c['kind']=='sub']
    cr=sum(c['cr'] for c in v);cw=sum(c['c5']+c['c1'] for c in v);ii=sum(c['i'] for c in v)
    rows.append((k[0],k[1],len(set(c['root'] for c in v)),len(v),f"${sum(cost(c) for c in mn):.2f}",f"${sum(cost(c) for c in sb):.2f}",f"${sum(cost(c) for c in v):.2f}",K(cr),K(cw),K(sum(c['o'] for c in v)),f"{cr/(cr+cw+ii)*100:.1f}%"))
TB={}
TB['exp_logs']=md(['Stage','Arm','Run dirs','API calls','Main $','Subagent $','Total $','Cache read','Cache write','Output','Cache-read share'],rows)
print(TB['exp_logs']); print('exp total',sum(cost(c) for c in E))
# exp subagent types per arm
rows=[]
sg=collections.defaultdict(lambda:[set(),0,0.0,0])
for c in E:
    if c['kind']=='sub':
        p=parse(c['root']);k=(p['stage'],p['arm'],c['agentType'] or '?'); sg[k][0].add((c['root'],c['aid']));sg[k][1]+=1;sg[k][2]+=cost(c);sg[k][3]+=c['o']
for k,v in sorted(sg.items()): rows.append((k[0],k[1],k[2],len(v[0]),v[1],f"${v[2]:.2f}",K(v[3])))
TB['exp_subs']=md(['Stage','Arm','Subagent type','Agents','Calls','Cost','Output'],rows); print(TB['exp_subs'])
# per batch totals
bb=collections.defaultdict(lambda:[0,0.0,set()])
for c in E:
    p=parse(c['root']);b=bb[(p['stage'],p['batch'])];b[0]+=1;b[1]+=cost(c);b[2].add(c['root'])
for k,v in sorted(bb.items()): print(k,v[0],round(v[1],2),len(v[2]))
# plan-stage spec: per run, cache per run for non-aborted
json.dump(TB,open(SP+r"\tb5.json",'w'))
