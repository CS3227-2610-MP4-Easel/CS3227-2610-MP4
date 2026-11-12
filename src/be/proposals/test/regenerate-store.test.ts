import assert from "node:assert/strict";
import test from "node:test";
import { claimEpic, storeEpic, failEpic, precheckRegenerate, ProposalError, EXPAND_LEASE_MS } from "../src/index.js";
import { integrationUrl, withIntegrationDb } from "./fakes.js";
import { seed } from "./edit-helpers.js";
const opts = { skip: !integrationUrl };
const code = (p: Promise<unknown>) => p.then(() => "OK", (e: unknown) => e instanceof ProposalError ? e.code : Promise.reject(e));
const tasks = [{title:"old",description:"",acceptanceCriteria:[],storyPoints:1 as const}];
const replacement = [{title:"new",description:"",acceptanceCriteria:[],storyPoints:2 as const}];

test("W7b E1 claim checks supplied proposal version in both modes", opts, async () => {
 await withIntegrationDb(async (base, f) => {
  const { db, proposalId, pm } = await seed(base, f);
  for (const mode of ["EXPAND", "REGENERATE"] as const) {
   assert.equal(await code(claimEpic(db, { proposalId, index: 0, actorId: pm, mode, expectedProposalVersion: 2 })), "CONFLICT_VERSION");
  }
  assert.equal((await claimEpic(db, { proposalId, index: 0, actorId: pm })).kind, "CLAIMED");
 });
});

test("W7b E38 E41 E42 E43 regenerate preserves tasks, stores and guards claims", opts, async () => {
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm,sessionId}=await seed(base,f);
 const initial=await claimEpic(db,{proposalId,index:0,actorId:pm}); if(initial.kind!=="CLAIMED") throw Error("claim");
 await storeEpic(db,{proposalId,index:0,claimedVersion:initial.claimedVersion,tasks,flagged:false});
 assert.equal((await claimEpic(db,{proposalId,index:0,actorId:pm})).kind,"DONE");
 assert.deepEqual(await precheckRegenerate(db,{proposalId,index:0,actorId:pm,version:1}),{sessionId,status:"DONE"});
 assert.equal(await code(precheckRegenerate(db,{proposalId,index:99,actorId:pm,version:2})),"CONFLICT_VERSION");
 const results=await Promise.all([0,1].map(()=>claimEpic(db,{proposalId,index:0,actorId:pm,mode:"REGENERATE",expectedProposalVersion:1}).then(r=>r,(e:unknown)=>e instanceof ProposalError?e.code:Promise.reject(e))));
 assert.equal(results.filter(x=>x==="CONFLICT_STATE").length,1); const claim=results.find(x=>typeof x!=="string"); if(!claim || claim.kind!=="CLAIMED") throw Error("claim");
 assert.equal(await code(precheckRegenerate(db,{proposalId,index:0,actorId:pm,version:1})),"CONFLICT_STATE");
 assert.deepEqual((await base.proposalEpic.findUniqueOrThrow({where:{proposalId_index:{proposalId,index:0}}})).tasks,tasks);
 await storeEpic(db,{proposalId,index:0,claimedVersion:claim.claimedVersion,tasks:replacement,flagged:true,bumpProposalVersion:true});
 const row=await base.proposalEpic.findUniqueOrThrow({where:{proposalId_index:{proposalId,index:0}}}); const p=await base.aiProposal.findUniqueOrThrow({where:{id:proposalId}});
 assert.equal(row.version,claim.claimedVersion+1); assert.deepEqual(row.tasks,replacement); assert.equal(p.version,2); assert.equal(p.flagged,true); assert.equal((p.payload as {edited?:boolean}).edited,undefined);
 assert.equal(await code(claimEpic(db,{proposalId,index:0,actorId:pm,mode:"REGENERATE",expectedProposalVersion:1})),"CONFLICT_VERSION");
 const failed=await claimEpic(db,{proposalId,index:0,actorId:pm,mode:"REGENERATE",expectedProposalVersion:2}); if(failed.kind!=="CLAIMED") throw Error("claim");
 assert.equal(await failEpic(db,{proposalId,index:0,claimedVersion:failed.claimedVersion,error:"FAILED"}),true);
 const after=await base.proposalEpic.findUniqueOrThrow({where:{proposalId_index:{proposalId,index:0}}}); assert.equal(after.expansionStatus,"FAILED"); assert.equal(after.error,"FAILED"); assert.deepEqual(after.tasks,replacement);
 assert.equal(await failEpic(db,{proposalId,index:0,claimedVersion:failed.claimedVersion,error:"LATE"}),false);
 });
});

test("W7b E3 E4 E29 E42 E43 E60 precheck guard order, expiry and stale fail",opts,async()=>{
 await withIntegrationDb(async(base,f)=>{const {db,proposalId,pm,project}=await seed(base,f); const other=await f.user(); await f.member(project,other);
 assert.equal(await code(precheckRegenerate(db,{proposalId,index:0,actorId:other,version:1})),"NOT_FOUND");
 for(const status of ["APPROVED","REJECTED","SUPERSEDED"] as const){ await base.aiProposal.update({where:{id:proposalId},data:{status}}); assert.equal(await code(precheckRegenerate(db,{proposalId,index:0,actorId:pm,version:1})),"CONFLICT_STATE"); }
 await base.aiProposal.update({where:{id:proposalId},data:{status:"PENDING"}}); assert.equal(await code(precheckRegenerate(db,{proposalId,index:99,actorId:pm,version:1})),"NOT_FOUND");
 const now=new Date("2026-11-09T00:00:00Z"); const claim=await claimEpic(db,{proposalId,index:0,actorId:pm,now}); if(claim.kind!=="CLAIMED") throw Error("claim");
 assert.equal((await precheckRegenerate(db,{proposalId,index:0,actorId:pm,version:1,now:new Date(now.getTime()+EXPAND_LEASE_MS+1)})).status,"PENDING");
 await base.proposalEpic.update({where:{proposalId_index:{proposalId,index:0}},data:{version:{increment:1}}}); assert.equal(await failEpic(db,{proposalId,index:0,claimedVersion:claim.claimedVersion,error:"late"}),false);
 await base.project.update({where:{id:project},data:{status:"ARCHIVED"}}); assert.equal(await code(precheckRegenerate(db,{proposalId,index:0,actorId:pm,version:1})),"NOT_FOUND");
 });
});

test("W7b E38 watermark allocates monotonically and reserves completion increment",opts,async()=>{
 await withIntegrationDb(async(base,f)=>{const {db,proposalId,pm}=await seed(base,f); const p=await base.aiProposal.findUniqueOrThrow({where:{id:proposalId}});
 await base.aiProposal.update({where:{id:proposalId},data:{payload:{...(p.payload as object),epicVersionWatermark:2147483645}}});
 const c=await claimEpic(db,{proposalId,index:0,actorId:pm}); if(c.kind!=="CLAIMED") throw Error("claim"); assert.equal(c.claimedVersion,2147483646);
 await storeEpic(db,{proposalId,index:0,claimedVersion:c.claimedVersion,tasks,flagged:false});
 const before=await base.aiProposal.findUniqueOrThrow({where:{id:proposalId}});
 assert.equal(await code(claimEpic(db,{proposalId,index:1,actorId:pm})),"CONFLICT_STATE");
 const after=await base.aiProposal.findUniqueOrThrow({where:{id:proposalId}}); assert.deepEqual(after.payload,before.payload);
 assert.equal((await base.proposalEpic.findUniqueOrThrow({where:{proposalId_index:{proposalId,index:1}}})).expansionStatus,"PENDING");
 });
});
