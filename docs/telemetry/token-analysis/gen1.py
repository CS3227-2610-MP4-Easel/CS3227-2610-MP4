import json,collections,re,datetime as dt
SP=r"C:\Users\danie\AppData\Local\Temp\claude\1ad2cc26966c77c9\fd91efe1-deb5-461e-b33c-21b66ff7fbea\scratchpad"
D=json.load(open(SP+r"\data2.json"))
P=(2,10,.1,2.5,4)
def cost(c): return (c['i']*P[0]+c['o']*P[1]+c['cr']*P[2]+c['c5']*P[3]+c['c1']*P[4])/1e6
def parts(c): return dict(inp=c['i']*P[0]/1e6,out=c['o']*P[1]/1e6,cr=c['cr']*P[2]/1e6,c5=c['c5']*P[3]/1e6,c1=c['c1']*P[4]/1e6)
for i,d in enumerate(D): d['fid']=i
par=list(range(len(D)))
def f(x):
    while par[x]!=x: par[x]=par[par[x]]; x=par[x]
    return x
def u(a,b): par[f(a)]=f(b)
mainidx={(d['root'],d['sid']):d['fid'] for d in D if d['kind']=='main'}
for d in D:
    if d['kind']=='sub' and (d['root'],d['sid']) in mainidx: u(d['fid'],mainidx[(d['root'],d['sid'])])
holder=collections.defaultdict(list)
for d in D:
    for c in d['calls']: holder[c['id']].append(d['fid'])
for v in holder.values():
    for x in v[1:]: u(v[0],x)
own={k:min(v,key=lambda x:(D[x]['ts'][0] or '',D[x]['ts'][1] or '',x)) for k,v in holder.items()}
for d in D:
    d['own']=[dict(c,fid=d['fid']) for c in d['calls'] if own[c['id']]==d['fid']]
    d['fam']=f(d['fid'])
def era(ts): return 'v1' if ts<'2026-11-06T21:00' else 'v2'
def isexp(d): return d['root'].startswith('S--CS3227-exp-runs')
def grp(d):
    if isexp(d): return 'exp'
    return 'claude'
# ---- unit classification of every unique call
ALL=[]
for d in D:
    for c in d['own']:
        m=d['meta'] or {}
        c=dict(c); c['kind']=d['kind']; c['root']=d['root']; c['sid']=d['sid']; c['agentType']=m.get('agentType'); c['desc']=m.get('description'); c['fam']=d['fam']; c['exp']=isexp(d); c['aid']=d['agentId']
        ALL.append(c)
print('unique calls',len(ALL),'total $',round(sum(cost(c) for c in ALL),2))
def agg(cs):
    r=collections.Counter()
    for c in cs:
        for k in('i','o','cr','c5','c1','th'): r[k]+=c[k]
        r['n']+=1; r['cost']+=cost(c)
        for k,v in parts(c).items(): r['$'+k]+=v
    r['ctx']=r['i']+r['cr']+r['c5']+r['c1']
    r['hit']=r['cr']/r['ctx'] if r['ctx'] else 0
    return r
def show(name,cs):
    a=agg(cs); print(f"{name:40s} n={a['n']:5d} $={a['cost']:8.2f} in={a['i']:>8,} cr={a['cr']:>12,} c5={a['c5']:>10,} c1={a['c1']:>10,} out={a['o']:>9,} th={a['th']:>8,} hit={a['hit']*100:5.1f}% | $in {a['$inp']:.2f} out {a['$out']:.2f} cr {a['$cr']:.2f} c5 {a['$c5']:.2f} c1 {a['$c1']:.2f}")
for nm,flt in [('ALL',lambda c:True),('claude main',lambda c:not c['exp'] and c['kind']=='main'),('claude sub',lambda c:not c['exp'] and c['kind']=='sub'),('exp main',lambda c:c['exp'] and c['kind']=='main'),('exp sub',lambda c:c['exp'] and c['kind']=='sub')]:
    show(nm,[c for c in ALL if flt(c)])
for e in ('v1','v2'):
    show('claude interactive '+e+' main',[c for c in ALL if not c['exp'] and c['kind']=='main' and era(c['ts'])==e])
    show('claude interactive '+e+' sub',[c for c in ALL if not c['exp'] and c['kind']=='sub' and era(c['ts'])==e])
# model breakdown
for m in set(c['model'] for c in ALL): show('model '+m,[c for c in ALL if c['model']==m])
json.dump(ALL,open(SP+r"\all_calls.json",'w'))

