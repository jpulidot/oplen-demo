const {boot}=require('./plans.cjs'),assert=require('node:assert/strict');
(async()=>{
 const env=boot(),req=(body,extra='')=>env.request(body,'evaluation-runs.php?manage=1'+extra),roster=(await env.request(null,'evaluation-plans.php?manage=1')).data.people.slice(0,3),ids=[];
 const criteria=['performance','competencies','development'].map(block=>({key:block,block,title:'Criterio '+block,definition:'Resultado observable',methodology:'Rúbrica conductual',goal:'Resultado verificable del bimestre',evidence:'Muestra de casos revisados',rubric:'1 requiere apoyo; 3 cumple; 4 supera; 5 excepcional',target:4,weight:100}));
 for(const [i,p] of roster.entries()){
  assert((await env.request({kind:'person',targetId:p.id,revision:0,title:'Plan del piloto',frequency:'bimonthly',weights:{performance:50,competencies:30,development:20},criteria},'evaluation-plans.php?manage=1')).ok);
  const run=await req({action:'create',userId:p.id,period:'2029-B1'});assert(run.ok);ids.push(run.id);
  env.context.location.search='?previewUser='+p.id;
  const personal=await req(null);assert(!personal.canManage);assert(personal.people.length===0);assert(personal.rows.every(r=>r.userId===p.id&&r.state!=='draft'&&!('review' in r)&&!('snapshot' in r)));assert(!(await req(null,'&id='+run.id)).ok);
  assert(!(await req(null,'&dashboard=1&period=2029-B1')).ok);assert(!(await req({action:'create',userId:p.id,period:'2029-B2'})).ok);
  assert(!(await req({action:'complete',id:run.id,revision:1})).ok);
  env.context.location.search='';
  assert((await req({action:'complete',id:run.id,revision:1,answers:Object.fromEntries(criteria.map(c=>[c.key,{level:4-i,note:'Muestra revisada del check-in'}])),progress:'adequate',recommendations:'Practicar con acompañamiento del responsable',feedback:'Resultados revisados con evidencia del bimestre'})).ok);
  const detail=(await req(null,'&id='+run.id)).detail;assert(detail.completed_at);assert.equal(detail.reviewerName,'Ana Torres');
 }
 const board=(await req(null,'&dashboard=1&period=2029-B1&department=1')).dashboard;assert.equal(board.counts.scored,3);assert.equal(board.counts.supportPeople,2);assert.equal(board.average,60);assert.equal(board.blocks.length,3);assert(board.blocks.every(b=>b.average===3));assert.equal(board.rows.find(r=>r.userId===roster[2].id).support.length,3);
 assert(!(await req(null,'&dashboard=1&period=2029-B7')).ok);assert(!(await req(null,'&dashboard=1&period=2029-B1&department=9999')).ok);
 env.context.location.search='?previewUser='+roster[0].id;
 assert((await req(null,'&id='+ids[0])).detail);assert(!(await req(null,'&id='+ids[1])).ok);
 const legacy=env.context.window.OplenDemo.snapshot().evaluations.find(r=>!r.snapshot.plan&&r.userId!==roster[0].id);assert(!(await req(null,'&id='+legacy.id)).ok);
 const restored=boot(JSON.parse(env.storage.get('oplen-mirror-scale-v2')));assert.equal((await restored.request(null,'evaluation-runs.php?manage=1&id='+ids[0])).detail.completed_at,(await env.request(null,'evaluation-runs.php?id='+ids[0])).detail.completed_at);
 console.log('PASS demo evaluation pilot: three published plans, weighted dashboard, support needs, timestamps, private drafts/foreign results, readonly preview and persistence');
})().catch(e=>{console.error(e);process.exit(1)});
