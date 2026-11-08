import assert from "node:assert/strict";
import test from "node:test";
import { approveProposal, editEpic, replaceCheckpoints, claimEpic, storeEpic, failEpic, EXPAND_LEASE_MS, ProposalError } from "../src/index.js";
import { integrationUrl, withIntegrationDb } from "./fakes.js";
import { seed, holdProposalLock } from "./edit-helpers.js";
import { PlanInputSchema } from "@agile/core";
const opts = { skip: !integrationUrl };
const code = (p: Promise<unknown>) => p.then(() => "OK", (e: unknown) => e instanceof ProposalError ? e.code : Promise.reject(e));
test("W7b E1 E3 E4 E8 edit guards and equal edit", opts, async () => {
 await withIntegrationDb(async (base, f) => {
  const {db, proposalId, pm, project} = await seed(base, f); const other = await f.user(); await f.member(project, other);
  assert.equal(await code(editEpic(db, {proposalId, actorId: other, version: 1, index: 0})), "NOT_FOUND");
  assert.equal(await code(editEpic(db, {proposalId, actorId: pm, version: 2, index: 99})), "CONFLICT_VERSION");
  const v = await editEpic(db, {proposalId, actorId: pm, version: 1, index: 0, title: "Epic 0"}); assert.equal(v.version, 2);
  await base.aiProposal.update({where:{id: proposalId},data:{status:"REJECTED"}});
  assert.equal(await code(editEpic(db, {proposalId, actorId: pm, version: 2, index: 0})), "CONFLICT_STATE");
 });
});

test("W7b E2 concurrent versions serialize", opts, async () => {
 await withIntegrationDb(async (base, f) => { const {db,proposalId,pm}=await seed(base,f); const results=await Promise.all([0,1].map(index=>code(editEpic(db,{proposalId,actorId:pm,version:1,index,title:`new ${index}`})))); assert.deepEqual(results.sort(),["CONFLICT_VERSION","OK"]); });
});

test("W7b E10 E11 E12 E13 E14 E15 E16 E17 checkpoints map simultaneously and validate", opts, async () => {
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm}=await seed(base,f); const edit=(version:number, checkpoints: {name:string;targetDate:string;previousName?:string}[])=>replaceCheckpoints(db,{proposalId,actorId:pm,version,checkpoints});
 const date="2026-12-01"; await edit(1,[{name:"A",targetDate:date},{name:"B",targetDate:date}]); await editEpic(db,{proposalId,actorId:pm,version:2,index:0,checkpointName:"A"}); await editEpic(db,{proposalId,actorId:pm,version:3,index:1,checkpointName:"B"});
 let result=await edit(4,[{name:"B",targetDate:date,previousName:"A"},{name:"A",targetDate:date,previousName:"B"}]); assert.deepEqual(result.epics.map(e=>e.checkpointName),["B","A"]);
 for (const checkpoints of [[{name:"a",targetDate:date},{name:"A",targetDate:date}],[{name:"x",targetDate:date,previousName:"a"}],[{name:"x",targetDate:date,previousName:"A"},{name:"y",targetDate:date,previousName:"A"}],[{name:"x",targetDate:"2026-02-31"}]]) assert.equal(await code(edit(5,checkpoints)),"VALIDATION_FAILED");
 result=await edit(5,[{name:"a",targetDate:date}]); assert.deepEqual(result.epics.map(e=>e.checkpointName),[null,null]); result=await edit(6,[]); assert.deepEqual(result.checkpoints,[]);
 });
});

test("W7b E19 E20 E21 E22 E23 E26 E28 E29 E30 epic edits and leases", opts, async () => {
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm}=await seed(base,f); const task={title:"task",description:"",acceptanceCriteria:[],storyPoints:1 as const};
 await replaceCheckpoints(db,{proposalId,actorId:pm,version:1,checkpoints:[{name:"A",targetDate:"2026-12-01"}]});
 await editEpic(db,{proposalId,actorId:pm,version:2,index:0,tasks:[task]}); let before=await base.proposalEpic.findFirstOrThrow({where:{proposalId,index:0}}); assert.equal(before.expansionStatus,"DONE");
 await editEpic(db,{proposalId,actorId:pm,version:3,index:0,title:"changed"}); let after=await base.proposalEpic.findFirstOrThrow({where:{proposalId,index:0}}); assert.deepEqual(after.tasks,[task]); assert.equal(after.version,before.version+1); before=after;
 await editEpic(db,{proposalId,actorId:pm,version:4,index:0,checkpointName:"A"}); after=await base.proposalEpic.findFirstOrThrow({where:{proposalId,index:0}}); assert.equal(after.version,before.version);
 assert.equal(await code(editEpic(db,{proposalId,actorId:pm,version:5,index:0,checkpointName:"missing"})),"VALIDATION_FAILED");
 const now=new Date("2026-11-09T00:00:00Z"); const claim=await claimEpic(db,{proposalId,actorId:pm,index:1,now}); if(claim.kind!=="CLAIMED") throw Error("claim"); const expiry=new Date(now.getTime()+EXPAND_LEASE_MS);
 assert.equal(await code(editEpic(db,{proposalId,actorId:pm,version:5,index:1,title:"manual",now:expiry})),"CONFLICT_STATE");
 await editEpic(db,{proposalId,actorId:pm,version:5,index:1,title:"manual",now:new Date(expiry.getTime()+1)}); before=await base.proposalEpic.findFirstOrThrow({where:{proposalId,index:1}});
 assert.equal(await code(storeEpic(db,{proposalId,index:1,claimedVersion:claim.claimedVersion,tasks:[task],flagged:false})),"CONFLICT_STATE"); await failEpic(db,{proposalId,index:1,claimedVersion:claim.claimedVersion,error:"late"}); after=await base.proposalEpic.findFirstOrThrow({where:{proposalId,index:1}}); assert.equal(after.version,before.version); assert.equal(after.error,before.error);
 });
});

test("W7b E18 E30 checkpoint rename preserves a live claim", opts, async () => {
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm}=await seed(base,f); await replaceCheckpoints(db,{proposalId,actorId:pm,version:1,checkpoints:[{name:"A",targetDate:"2026-12-01"}]}); await editEpic(db,{proposalId,actorId:pm,version:2,index:0,checkpointName:"A"}); const claim=await claimEpic(db,{proposalId,actorId:pm,index:0}); if(claim.kind!=="CLAIMED") throw Error("claim"); await replaceCheckpoints(db,{proposalId,actorId:pm,version:3,checkpoints:[{name:"B",targetDate:"2026-12-01",previousName:"A"}]}); await storeEpic(db,{proposalId,index:0,claimedVersion:claim.claimedVersion,tasks:[{title:"t",description:"",acceptanceCriteria:[],storyPoints:1}],flagged:false}); const row=await base.proposalEpic.findFirstOrThrow({where:{proposalId,index:0}}); assert.equal(row.checkpointName,"B"); assert.equal(row.expansionStatus,"DONE"); });
});


test("W7b E57 E58 proposal lock serializes edit and approve", opts, async () => {
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm}=await seed(base,f); const task={title:"t",description:"",acceptanceCriteria:[],storyPoints:1 as const};
 await editEpic(db,{proposalId,actorId:pm,index:0,version:1,tasks:[task]}); await editEpic(db,{proposalId,actorId:pm,index:1,version:2,tasks:[task]});
 let release!:()=>void, entered!:()=>void; const gate=new Promise<void>(r=>release=r), locked=new Promise<void>(r=>entered=r);
 const deps={db,core:{applyPlan:async()=>{entered(); await gate;}},sessions:{close:async()=>{}}};
 const approval=approveProposal(deps,{proposalId,actorId:pm,version:3}); await locked; const edit=code(editEpic(db,{proposalId,actorId:pm,index:0,version:3,title:"late"})); release(); await approval; assert.equal(await edit,"CONFLICT_STATE");
 });
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm}=await seed(base,f); const task={title:"t",description:"",acceptanceCriteria:[],storyPoints:1 as const}; await editEpic(db,{proposalId,actorId:pm,index:0,version:1,tasks:[task]}); await editEpic(db,{proposalId,actorId:pm,index:1,version:2,tasks:[task]}); const hold=holdProposalLock(base,proposalId,async tx=>{await tx.aiProposal.update({where:{id:proposalId},data:{version:4}})}); await hold.locked; const approval=code(approveProposal({db,core:{applyPlan:async()=>{}},sessions:{close:async()=>{}}},{proposalId,actorId:pm,version:3})); hold.release(); await hold.done; assert.equal(await approval,"CONFLICT_VERSION"); });
});

test("W7b E58 edits to different epics complete without deadlock", opts, async () => {
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm}=await seed(base,f); const hold=holdProposalLock(base,proposalId); await hold.locked; const first=code(editEpic(db,{proposalId,actorId:pm,index:0,version:1,title:"first"})); const second=code(editEpic(db,{proposalId,actorId:pm,index:1,version:1,title:"second"})); hold.release(); await hold.done; assert.deepEqual((await Promise.all([first,second])).sort(),["CONFLICT_VERSION","OK"]); });
});

test("W7b E59 thirty edit sequences leave a valid completed plan", opts, async () => {
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm}=await seed(base,f); let version=1; let state=123456; const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0; return state;}; const task={title:"t",description:"",acceptanceCriteria:[],storyPoints:1 as const};
 for(let seq=0;seq<30;seq++) { for(let step=0;step<3;step++) { if(rand()%2) await editEpic(db,{proposalId,actorId:pm,index:rand()%2,version:version++,title:`title ${rand()%100}`}); else await replaceCheckpoints(db,{proposalId,actorId:pm,version:version++,checkpoints:[{name:`C${rand()%3}`,targetDate:"2026-12-01"}]}); } for(let index=0;index<2;index++) await editEpic(db,{proposalId,actorId:pm,index,version:version++,tasks:[task]}); const proposal=await base.aiProposal.findUniqueOrThrow({where:{id:proposalId}}); const rows=await base.proposalEpic.findMany({where:{proposalId},orderBy:{index:"asc"}}); const payload=proposal.payload as {checkpoints:unknown}; assert.equal(PlanInputSchema.safeParse({checkpoints:payload.checkpoints,epics:rows.map(r=>({title:r.title,description:r.description,checkpointName:r.checkpointName,tasks:r.tasks}))}).success,true); }
 });
});

test("W7b E60 archived project is hidden", opts, async () => {
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm,project}=await seed(base,f); await base.project.update({where:{id:project},data:{status:"ARCHIVED"}}); assert.equal(await code(editEpic(db,{proposalId,actorId:pm,version:1,index:0})),"NOT_FOUND"); });
});



test("W7b E20 E21 E23 failed and expired edits preserve expansion state", opts, async () => {
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm}=await seed(base,f); const now=new Date("2026-11-09T00:00:00Z"); const first=await claimEpic(db,{proposalId,actorId:pm,index:0,now}); if(first.kind!=="CLAIMED") throw Error("claim"); await failEpic(db,{proposalId,index:0,claimedVersion:first.claimedVersion,error:"failed"}); const before=await base.proposalEpic.findFirstOrThrow({where:{proposalId,index:0}}); await editEpic(db,{proposalId,actorId:pm,index:0,version:1,title:"failed edit"}); const changed=await base.proposalEpic.findFirstOrThrow({where:{proposalId,index:0}}); assert.equal(changed.expansionStatus,"FAILED"); assert.equal(changed.error,"failed"); assert.equal(changed.version,before.version+1); await editEpic(db,{proposalId,actorId:pm,index:0,version:2,title:"failed edit"}); const equal=await base.proposalEpic.findFirstOrThrow({where:{proposalId,index:0}}); assert.equal(equal.version,changed.version); });
});

test("W7b E58 store and edit different epics complete after lock release", opts, async () => {
 await withIntegrationDb(async (base,f) => { const {db,proposalId,pm}=await seed(base,f); const claim=await claimEpic(db,{proposalId,actorId:pm,index:0}); if(claim.kind!=="CLAIMED") throw Error("claim"); const hold=holdProposalLock(base,proposalId); await hold.locked; const store=storeEpic(db,{proposalId,index:0,claimedVersion:claim.claimedVersion,tasks:[{title:"t",description:"",acceptanceCriteria:[],storyPoints:1}],flagged:false}); const edit=editEpic(db,{proposalId,actorId:pm,index:1,version:1,title:"edited"}); hold.release(); await hold.done; await Promise.all([store,edit]); const rows=await base.proposalEpic.findMany({where:{proposalId},orderBy:{index:"asc"}}); assert.equal(rows[0].expansionStatus,"DONE"); assert.equal(rows[1].title,"edited"); });
});
