import json,os,re,glob
base=r"C:\Users\danie\.codex"
files=glob.glob(base+r"\sessions\**\*.jsonl",recursive=True)+glob.glob(base+r"\archived_sessions\**\*.jsonl",recursive=True)
out=[]
for p in files:
    txt=open(p,encoding='utf8').read()
    if 'CS3227-2610-MP4' not in txt: continue
    meta=None;last=None;models=set();first=None;ts=[];maxlast=0;rl=0;n=0;tools=0;efforts=set()
    for l in txt.splitlines():
        try:o=json.loads(l)
        except: continue
        if o.get('timestamp'): ts.append(o['timestamp'])
        t=o.get('type');pl=o.get('payload') or {}
        if t=='session_meta' and meta is None:
            meta=dict(pl); meta.pop('base_instructions',None)
        elif t=='turn_context':
            if pl.get('model'): models.add(pl['model'])
            if pl.get('effort'): efforts.add(pl['effort'])
        elif t=='event_msg' and pl.get('type')=='token_count' and pl.get('info'):
            last=pl['info']; n+=1
            lt=last.get('last_token_usage') or {}
            maxlast=max(maxlast,lt.get('input_tokens',0))
            pr=(pl.get('rate_limits') or {}).get('primary') or {}
            rl=max(rl,pr.get('used_percent') or 0)
        elif t=='response_item' and pl.get('type') in('function_call','custom_tool_call'): tools+=1
        elif t=='response_item' and pl.get('type')=='message' and pl.get('role')=='user' and first is None:
            tx=' '.join(c.get('text','') for c in pl.get('content',[]) if isinstance(c,dict))
            if not tx.startswith('# AGENTS.md') and not tx.startswith('The following is') and '<environment_context>' not in tx[:40]:
                first=tx[:600]
    u=(last or {}).get('total_token_usage') or {}
    out.append(dict(path=p,id=(meta or {}).get('id'),parent=(meta or {}).get('parent_thread_id'),source=(meta or {}).get('source'),thread_source=(meta or {}).get('thread_source'),
       cwd=(meta or {}).get('cwd'),branch=((meta or {}).get('git') or {}).get('branch'),ts=(min(ts) if ts else None,max(ts) if ts else None),models=sorted(models),efforts=sorted(efforts),
       usage=u,n_tc=n,max_ctx=maxlast,tools=tools,first=first,rl=rl,ctxwin=((last or {}).get('model_context_window')),size=os.path.getsize(p)))
json.dump(out,open(r"C:\Users\danie\AppData\Local\Temp\claude\1ad2cc26966c77c9\fd91efe1-deb5-461e-b33c-21b66ff7fbea\scratchpad\codex.json",'w'))
print(len(out))
import collections
c=collections.Counter((o['thread_source'],json.dumps(o['source'])[:60]) for o in out); print(c)
print(collections.Counter(tuple(o['models']) for o in out)); print(collections.Counter(o['cwd'] for o in out))
print(sum(o['usage'].get('input_tokens',0) for o in out),sum(o['usage'].get('cached_input_tokens',0) for o in out),sum(o['usage'].get('output_tokens',0) for o in out))
