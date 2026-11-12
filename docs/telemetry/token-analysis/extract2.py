import json,os,glob,re,collections
R=r"C:\Users\danie\.claude\projects\S--CS3227-CS3227-2610-MP4"
OUT=r"C:\Users\danie\AppData\Local\Temp\claude\1ad2cc26966c77c9\fd91efe1-deb5-461e-b33c-21b66ff7fbea\scratchpad\data2.json"
def parse(path):
    calls={}; titles=[]; cost=None; ts=[]; tools=collections.Counter(); skills=collections.Counter()
    agents=[]; branches=collections.Counter(); human=0; attr=collections.Counter(); first_user=None
    versions=set(); efforts=collections.Counter(); advisors=set(); errs=0; compactions=0
    for l in open(path,encoding='utf8'):
        try:o=json.loads(l)
        except: continue
        t=o.get('type')
        if o.get('timestamp'): ts.append(o['timestamp'])
        if t=='custom-title': titles.append(o.get('customTitle'))
        elif t=='cost-state': cost=o
        elif t=='system':
            if o.get('subtype')=='api_error': errs+=1
            if o.get('subtype') in('compact_boundary',): compactions+=1
        elif t=='user':
            if o.get('gitBranch'): branches[o['gitBranch']]+=1
            if (o.get('origin') or {}).get('kind')=='human' and not o.get('isSidechain'): human+=1
            if first_user is None:
                c=o.get('message',{}).get('content')
                if isinstance(c,list): c=' '.join(x.get('text','') for x in c if isinstance(x,dict))
                first_user=(c or '')[:1500]
        elif t=='assistant':
            m=o['message']; u=m.get('usage') or {}
            if o.get('gitBranch'): branches[o['gitBranch']]+=1
            if o.get('attributionSkill'): attr['skill:'+o['attributionSkill']]+=1
            if o.get('attributionAgent'): attr['agent:'+o['attributionAgent']]+=1
            versions.add(o.get('version')); efforts[o.get('effort')]+=1
            if o.get('advisorModel'): advisors.add(o['advisorModel'])
            k=m['id']
            if k in calls: continue
            cc=u.get('cache_creation') or {}
            calls[k]=dict(id=k,ts=o.get('timestamp'),model=m.get('model'),i=u.get('input_tokens',0),cr=u.get('cache_read_input_tokens',0),
              c5=cc.get('ephemeral_5m_input_tokens',0),c1=cc.get('ephemeral_1h_input_tokens',0),cct=u.get('cache_creation_input_tokens',0),
              o=u.get('output_tokens',0),th=(u.get('output_tokens_details') or {}).get('thinking_tokens',0),
              sk=o.get('attributionSkill'),ag=o.get('attributionAgent'),eff=o.get('effort'),
              ws=(u.get('server_tool_use') or {}).get('web_search_requests',0))
            for b in m.get('content') or []:
                if isinstance(b,dict) and b.get('type')=='tool_use':
                    tools[b['name']]+=1
                    inp=b.get('input') or {}
                    if b['name']=='Skill': skills[inp.get('skill')]+=1
                    if b['name'] in('Agent','Task'):
                        agents.append(dict(id=b['id'],type=inp.get('subagent_type'),desc=inp.get('description'),prompt_len=len(inp.get('prompt') or ''),bg=inp.get('run_in_background'),model=inp.get('model')))
    return dict(calls=list(calls.values()),titles=titles,cost=cost,ts=(min(ts) if ts else None,max(ts) if ts else None),
        tools=dict(tools),skills=dict(skills),agents=agents,branches=dict(branches),human=human,attr=dict(attr),first_user=first_user,
        versions=sorted(v for v in versions if v),efforts=dict(efforts),advisors=sorted(advisors),errs=errs,compactions=compactions,size=os.path.getsize(path))
data=[]
PR=r"C:\Users\danie\.claude\projects"
roots=[d for d in os.listdir(PR) if d.startswith('S--CS3227-CS3227-2610-MP4') or d.startswith('S--CS3227-exp-runs')]
for r in roots:
    base=os.path.join(PR,r)
    for p in glob.glob(base+'\\*.jsonl'):
        sid=os.path.basename(p)[:-6]
        d=parse(p); d.update(sid=sid,kind='main',agentId=None,meta=None,root=r); data.append(d)
    for p in glob.glob(base+'\\*\\subagents\\*.jsonl'):
        sid=os.path.basename(os.path.dirname(os.path.dirname(p)))
        aid=os.path.basename(p)[6:-6]
        d=parse(p); d.update(sid=sid,kind='sub',agentId=aid,root=r)
        mp=p[:-6]+'.meta.json'
        d['meta']=json.load(open(mp,encoding='utf8')) if os.path.exists(mp) else None
        data.append(d)
json.dump(data,open(OUT,'w'))
print(len(data), sum(len(d['calls']) for d in data))
