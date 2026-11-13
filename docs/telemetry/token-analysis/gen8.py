import json,collections,re
SP=r"C:\Users\danie\AppData\Local\Temp\claude\1ad2cc26966c77c9\fd91efe1-deb5-461e-b33c-21b66ff7fbea\scratchpad"
X=json.load(open(SP+r"\codex.json"));byid={o['id']:o for o in X}
def K(n): return f"{n/1000:,.0f}K" if n<1e6 else f"{n/1e6:,.2f}M"
def md(head,rows): return '| '+' | '.join(head)+' |\n|'+'|'.join('---' for _ in head)+'|\n'+'\n'.join('| '+' | '.join(str(x) for x in r)+' |' for r in rows)
def root(o):
    n=0
    while o['thread_source']!='user' and o['parent'] in byid and n<10: o=byid[o['parent']];n+=1
    return o['id']
def cat(n):
    if re.match(r'^t\d+(_run|_repair)?$',n): return 'Task implementation (T-n)'
    if n.startswith('review') or 'review' in n or n.startswith('branch_review'): return 'Review of a task / diff / amendment'
    if n.startswith('spec_'): return 'Spec review lenses (impl/test/attack/maint)'
    if n.startswith('gate_'): return 'Gate / readiness lenses'
    if n.startswith('security'): return 'Security spec / analysis / fix'
    if n.startswith('amend'): return 'Amendment (impl/test/attack)'
    if any(n.startswith(p) for p in('investigate','diagnose','check')): return 'Debug / diagnosis'
    return 'Other'
R={'W7b (Codex orchestrator 8 Nov 19:07Z)':'01a1bc8d-5dd9-7c51-a61b-540795eb8186','W7c (Codex orchestrator 10 Nov 14:42Z)':'01a1c5e8-70cd-70d2-90ac-2144e7552d26'}
rows=[]
for nm,rid in R.items():
    g=collections.defaultdict(lambda:[0,0,0,0])
    for o in X:
        if o['thread_source']=='subagent' and root(o)==rid:
            ap=o['source']['subagent']['thread_spawn']['agent_path'].split('/')[-1]; c=cat(ap)
            g[c][0]+=1;g[c][1]+=o['usage'].get('input_tokens',0);g[c][2]+=o['usage'].get('output_tokens',0);g[c][3]=max(g[c][3],o['max_ctx'])
    for c,v in sorted(g.items(),key=lambda x:-x[1][1]): rows.append((nm,c,v[0],K(v[1]),K(v[1]/v[0]),K(v[2]),K(v[3])))
TB=json.load(open(SP+r"\tb6.json"))
TB['codex_roles']=md(['Orchestration','Sub-agent activity','Agents','Total input','Avg input / agent','Output','Peak ctx'],rows)
print(TB['codex_roles'])
json.dump(TB,open(SP+r"\tb6.json",'w'))
