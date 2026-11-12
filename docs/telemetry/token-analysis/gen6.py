import json,collections,re,csv
SP=r"C:\Users\danie\AppData\Local\Temp\claude\1ad2cc26966c77c9\fd91efe1-deb5-461e-b33c-21b66ff7fbea\scratchpad"
X=json.load(open(SP+r"\codex.json"))
byid={o['id']:o for o in X}
def root(o):
    seen=0
    while o['thread_source']!='user' and o['parent'] in byid and seen<10: o=byid[o['parent']];seen+=1
    return o['id'] if o['thread_source']=='user' else None
def K(n): return f"{n/1000:,.0f}K" if n<1e6 else f"{n/1e6:,.2f}M"
for o in X: o['root']=root(o)
orph=[o for o in X if o['root'] is None]; print('orphans',len(orph),[ (o['thread_source'],o['parent']) for o in orph][:5])
def tot(l,f): return sum(o['usage'].get(f,0) for o in l)
rows=[]
roots=sorted([o for o in X if o['thread_source']=='user'],key=lambda o:o['ts'][0])
NAME={}
for o in roots:
    kids=[k for k in X if k['root']==o['id'] and k is not o]
    sub=[k for k in kids if k['thread_source']=='subagent'];gd=[k for k in kids if k['thread_source']=='guardian_review']
    fam=[o]+kids
    i=tot(fam,'input_tokens');cch=tot(fam,'cached_input_tokens');out=tot(fam,'output_tokens')
    f=(o['first'] or '').replace('\n',' ')
    f=re.sub(r'<external_codex_apps_open_page>.*?</external_codex_apps_open_page>','',f)[:90]
    rows.append((o['ts'][0][5:16],o['ts'][1][5:16],(o['branch'] or '')[:24],f.strip() or '(see note)',len(sub),len(gd),K(i),f"{cch/i*100:.1f}%" if i else '-',K(out),K(tot(sub,'input_tokens')),K(tot(gd,'input_tokens')),K(o['usage'].get('input_tokens',0)),K(o['max_ctx'])))
TB={}
TB['codex']=md=None
def md(head,rows): return '| '+' | '.join(head)+' |\n|'+'|'.join('---' for _ in head)+'|\n'+'\n'.join('| '+' | '.join(str(x) for x in r)+' |' for r in rows)
TB['codex']=md(['Start (UTC)','End','Branch','First user message / purpose','Sub-agents','Guardian reviews','Total input (incl. cached)','Cached %','Output','Sub-agent input','Guardian input','Root-thread input','Root peak ctx'],rows)
print(TB['codex'])
# totals by thread type
for ts in('user','subagent','guardian_review'):
    l=[o for o in X if o['thread_source']==ts]
    print(ts,len(l),K(tot(l,'input_tokens')),K(tot(l,'cached_input_tokens')),K(tot(l,'output_tokens')),K(tot(l,'reasoning_output_tokens')))
# subagent agent_path roles
rp=collections.defaultdict(lambda:[0,0,0,0])
for o in X:
    if o['thread_source']=='subagent':
        ap=o['source']['subagent']['thread_spawn'].get('agent_path') or ''
        k=re.sub(r'[-_]?\d+$','',ap.split('/')[-1]); k=re.sub(r'(w7c?|t\d+).*','',k,flags=re.I) if False else k
        r=rp[ap.split('/')[-1]];r[0]+=1;r[1]+=o['usage'].get('input_tokens',0);r[2]+=o['usage'].get('output_tokens',0);r[3]=max(r[3],o['max_ctx'])
for k,v in sorted(rp.items(),key=lambda x:-x[1][1])[:60]: print(k,v[0],K(v[1]),K(v[2]),K(v[3]))
json.dump(TB,open(SP+r"\tb6.json",'w'))
