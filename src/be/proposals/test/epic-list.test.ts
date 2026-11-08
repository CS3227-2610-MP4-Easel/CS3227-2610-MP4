import assert from "node:assert/strict";
import test from "node:test";
import { addEpic, deleteEpic, editEpic, replaceCheckpoints, claimEpic, storeEpic, failEpic, EXPAND_LEASE_MS, ProposalError } from "../src/index.js";
import { integrationUrl, withIntegrationDb } from "./fakes.js";
import { seed, holdProposalLock } from "./edit-helpers.js";
const opts = { skip: !integrationUrl };
const code = (p: Promise<unknown>) => p.then(() => "OK", (e: unknown) => e instanceof ProposalError ? e.code : Promise.reject(e));
const input = (proposalId:string, actorId:string, version:number) => ({proposalId,actorId,version,title:"new",description:"description",checkpointName:null});

test("W7b E31 E32 add validates limits and checkpoint", opts, async () => {
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm}=await seed(base,f,10);
 assert.equal(await code(addEpic(db,input(proposalId,pm,1))),"VALIDATION_FAILED");
 });
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm}=await seed(base,f);
 assert.equal(await code(addEpic(db,{...input(proposalId,pm,1),checkpointName:"missing"})),"VALIDATION_FAILED");
 const result=await addEpic(db,input(proposalId,pm,1)); assert.equal(result.epics.length,3); assert.equal(result.epics[2].index,2); assert.equal(result.epics[2].expansion.status,"PENDING"); assert.equal(result.epics[2].expansion.tasks,null);
 });
});

test("W7b E31 E33 E34 rekeys and preserves shifted rows across delete and add", opts, async () => {
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm}=await seed(base,f,10); const task={title:"task",description:"",acceptanceCriteria:[],storyPoints:1 as const};
 await editEpic(db,{proposalId,actorId:pm,version:1,index:3,tasks:[task]});
 const before=await base.proposalEpic.findMany({where:{proposalId},orderBy:{index:"asc"}});
 let result=await deleteEpic(db,{proposalId,actorId:pm,version:2,index:0}); assert.equal(result.version,3);
 let after=await base.proposalEpic.findMany({where:{proposalId},orderBy:{index:"asc"}});
 assert.deepEqual(after.map(r=>r.index),[0,1,2,3,4,5,6,7,8]);
 const allocated=Math.max(...before.map(r=>r.version))+1;
 for(let n=0;n<after.length;n++) { assert.equal(after[n].contentHash,before[n+1].contentHash); assert.equal(after[n].version,allocated); assert.equal(after[n].expansionStatus,before[n+1].expansionStatus); assert.deepEqual(after[n].tasks,before[n+1].tasks); assert.equal(after[n].error,before[n+1].error); }
 assert.equal(await code(deleteEpic(db,{proposalId,actorId:pm,version:2,index:0})),"CONFLICT_VERSION");
 let version=3; while(result.epics.length>1) result=await deleteEpic(db,{proposalId,actorId:pm,version:version++,index:0});
 assert.equal(await code(deleteEpic(db,{proposalId,actorId:pm,version,index:0})),"VALIDATION_FAILED");
 while(result.epics.length<10) result=await addEpic(db,{...input(proposalId,pm,version++),title:`new ${version}`});
 assert.equal(await code(addEpic(db,input(proposalId,pm,version))),"VALIDATION_FAILED");
 });
 await withIntegrationDb(async(base,f)=>{ const {db,proposalId,pm}=await seed(base,f,4); const before=await base.proposalEpic.findMany({where:{proposalId},orderBy:{index:"asc"}}); await deleteEpic(db,{proposalId,actorId:pm,version:1,index:1}); const after=await base.proposalEpic.findMany({where:{proposalId},orderBy:{index:"asc"}}); assert.deepEqual(after.map(r=>r.contentHash),[before[0].contentHash,before[2].contentHash,before[3].contentHash]); });
});

test("W7b E37 stale claims cannot target shifted or replacement epics", opts, async()=>{
 const now=new Date("2026-11-09T00:00:00Z"); const expired=new Date(now.getTime()+EXPAND_LEASE_MS+1);
 const task={title:"t",description:"",acceptanceCriteria:[],storyPoints:1 as const};
 await withIntegrationDb(async(base,f)=>{ const {db,proposalId,pm}=await seed(base,f,4);
  await base.proposalEpic.update({where:{proposalId_index:{proposalId,index:1}},data:{version:3,expansionStatus:"IN_PROGRESS",leaseExpiresAt:now}});
  await base.proposalEpic.update({where:{proposalId_index:{proposalId,index:2}},data:{version:2,expansionStatus:"IN_PROGRESS",leaseExpiresAt:now}});
  await deleteEpic(db,{proposalId,actorId:pm,version:1,index:0,now:expired});
  assert.equal(await code(storeEpic(db,{proposalId,index:1,claimedVersion:3,tasks:[task],flagged:false})),"CONFLICT_STATE");
  assert.equal(await failEpic(db,{proposalId,index:1,claimedVersion:3,error:"stale"}),false);
 });
 await withIntegrationDb(async(base,f)=>{const {db,proposalId,pm}=await seed(base,f,2);
  const old=await claimEpic(db,{proposalId,actorId:pm,index:1,now}); if(old.kind!=="CLAIMED") throw Error("claim");
  await deleteEpic(db,{proposalId,actorId:pm,version:1,index:1,now:expired});
  await addEpic(db,input(proposalId,pm,2));
  const replacement=await claimEpic(db,{proposalId,actorId:pm,index:1,now:expired}); if(replacement.kind!=="CLAIMED") throw Error("claim");
  assert.ok(replacement.claimedVersion>old.claimedVersion);
  assert.equal(await code(storeEpic(db,{proposalId,index:1,claimedVersion:old.claimedVersion,tasks:[task],flagged:false})),"CONFLICT_STATE");
  assert.equal(await failEpic(db,{proposalId,index:1,claimedVersion:old.claimedVersion,error:"stale"}),false);
 });
});

test("W7b E37 delete watermark reserves completion headroom", opts, async()=>{
 await withIntegrationDb(async(base,f)=>{ const {db,proposalId,pm}=await seed(base,f,2);
  await base.proposalEpic.update({where:{proposalId_index:{proposalId,index:0}},data:{version:2_147_483_645}});
  await deleteEpic(db,{proposalId,actorId:pm,version:1,index:1});
  const proposal=await base.aiProposal.findUniqueOrThrow({where:{id:proposalId}});
  assert.equal((proposal.payload as {epicVersionWatermark:number}).epicVersionWatermark,2_147_483_646);
  await addEpic(db,input(proposalId,pm,2));
  assert.equal(await code(deleteEpic(db,{proposalId,actorId:pm,version:3,index:0})),"CONFLICT_STATE");
  const after=await base.aiProposal.findUniqueOrThrow({where:{id:proposalId}}); assert.equal(after.version,3);
  assert.equal(await base.proposalEpic.count({where:{proposalId}}),2);
 });
});

test("W7b E35 E37 live lease blocks delete and expired shifted claim cannot store", opts, async()=>{
 await withIntegrationDb(async(base,f)=>{ const {db,proposalId,pm}=await seed(base,f,4); const now=new Date("2026-11-09T00:00:00Z"); const claim=await claimEpic(db,{proposalId,actorId:pm,index:2,now}); if(claim.kind!=="CLAIMED") throw Error("claim");
 assert.equal(await code(deleteEpic(db,{proposalId,actorId:pm,version:1,index:0,now:new Date(now.getTime()+EXPAND_LEASE_MS)})),"CONFLICT_STATE");
 await deleteEpic(db,{proposalId,actorId:pm,version:1,index:0,now:new Date(now.getTime()+EXPAND_LEASE_MS+1)});
 assert.equal(await code(storeEpic(db,{proposalId,index:2,claimedVersion:claim.claimedVersion,tasks:[{title:"t",description:"",acceptanceCriteria:[],storyPoints:1}],flagged:false})),"CONFLICT_STATE");
 });
});

test("W7b E1 E3 E4 E60 guards and unknown index", opts, async()=>{
 await withIntegrationDb(async(base,f)=>{ const {db,proposalId,pm,project}=await seed(base,f); const other=await f.user(); await f.member(project,other);
 assert.equal(await code(addEpic(db,input(proposalId,other,1))),"NOT_FOUND"); assert.equal(await code(deleteEpic(db,{proposalId,actorId:other,version:1,index:0})),"NOT_FOUND");
 assert.equal(await code(addEpic(db,input(proposalId,pm,2))),"CONFLICT_VERSION"); assert.equal(await code(deleteEpic(db,{proposalId,actorId:pm,version:2,index:99})),"CONFLICT_VERSION");
 assert.equal(await code(deleteEpic(db,{proposalId,actorId:pm,version:1,index:99})),"NOT_FOUND");
 await base.aiProposal.update({where:{id:proposalId},data:{status:"REJECTED"}}); assert.equal(await code(addEpic(db,input(proposalId,pm,1))),"CONFLICT_STATE"); assert.equal(await code(deleteEpic(db,{proposalId,actorId:pm,version:1,index:0})),"CONFLICT_STATE");
 await base.aiProposal.update({where:{id:proposalId},data:{status:"PENDING"}}); await base.project.update({where:{id:project},data:{status:"ARCHIVED"}}); assert.equal(await code(addEpic(db,input(proposalId,pm,1))),"NOT_FOUND"); assert.equal(await code(deleteEpic(db,{proposalId,actorId:pm,version:1,index:0})),"NOT_FOUND");
 });
});

test("W7b E58 delete and edit serialize without deadlock", opts, async()=>{
 await withIntegrationDb(async(base,f)=>{const {db,proposalId,pm}=await seed(base,f,4); const hold=holdProposalLock(base,proposalId); await hold.locked;
 const a=code(deleteEpic(db,{proposalId,actorId:pm,version:1,index:0})); const b=code(editEpic(db,{proposalId,actorId:pm,version:1,index:3,title:"edited"}));
 try { let blocked=false; for(let n=0;n<100;n++){const rows=await base.$queryRaw<{n:bigint}[]>`with recursive blocked(pid) as (select ${hold.holder.pid}::int union select a.pid from pg_stat_activity a join blocked b on b.pid = any(pg_blocking_pids(a.pid))) select (count(*) - 1)::bigint as n from blocked`; if(Number(rows[0].n)>=2){blocked=true;break;} await new Promise(r=>setTimeout(r,50));} assert.ok(blocked); } finally {hold.release();}
 await hold.done; assert.deepEqual((await Promise.all([a,b])).sort(),["CONFLICT_VERSION","OK"]);
 });
});
