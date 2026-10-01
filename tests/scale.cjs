const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('demo/backend.js','utf8');
function boot(stored={}){
 const storage=new Map(Object.entries(stored));
 const context={crypto:require('node:crypto').webcrypto,TextEncoder,structuredClone,URL,URLSearchParams,Response,FormData,File:class File{},Event:class Event{},console,confirm:()=>true,location:{href:'https://demo.oplen.io/',origin:'https://demo.oplen.io',search:'',reload(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},sessionStorage:{clear(){}},MutationObserver:class {observe(){}},document:{querySelector:()=>null},XMLHttpRequest:class {open(){}send(){}},window:{fetch:()=>{throw Error('Unexpected network request');}}};
 vm.runInNewContext(source,context);return {context,storage,fetch:async path=>{const response=await context.window.fetch('https://demo.oplen.io/api/'+path);assert.equal(response.status,200);return response.json();}};
}
(async()=>{
 const old={company:{name:'Saved old demo'},people:[{id:1,name:'Old'}]};const env=boot({'oplen-mirror-v1':JSON.stringify(old)}),s=env.context.window.OplenDemo.snapshot();
 assert.equal(s.people.length,100);assert.equal(s.departments.length,10);assert.equal(s.positions.length,40);assert.equal(s.processes.length,30);assert.equal(s.docs.length,30);assert.equal(s.careers.length,10);
 assert.equal(new Set(s.people.map(p=>p.id)).size,100);assert.equal(new Set(s.people.map(p=>p.email)).size,100);assert.equal(new Set(s.people.map(p=>p.name)).size,100);
 for(const p of s.people){assert(s.positions.some(pos=>pos.name===p.job_title&&pos.department_name===p.department));assert(s.departments.some(d=>d.name===p.department));if(p.manager_id){assert(s.people.some(m=>m.id===p.manager_id));let current=p,visited=new Set();while(current.manager_id){assert(!visited.has(current.id));visited.add(current.id);current=s.people.find(m=>m.id===current.manager_id);}}}
 for(const d of s.departments){assert.equal(s.people.filter(p=>p.department===d.name).length,d.member_count);assert(s.people.some(p=>p.id===d.manager_user_id&&p.department===d.name));}
 for(const p of s.positions)assert.equal(p.member_count,s.people.filter(u=>u.job_title===p.name&&u.department===p.department_name).length);
 for(const p of s.processes){assert(s.positions.some(pos=>pos.id===p.responsible_position_id));assert(s.people.some(u=>u.id===p.responsible_user_id));p.documents.forEach(id=>assert(s.docs.some(d=>d.id===id)));}
 const dashboard=(await env.fetch('evaluation-runs.php?dashboard=1')).dashboard;
 assert.equal(dashboard.counts.total,99);assert.equal(dashboard.counts.published,40);assert.equal(dashboard.counts.inReview,10);assert.equal(dashboard.counts.draft,10);assert.equal(dashboard.counts.missing,39);assert.equal(dashboard.average,null);
 const filtered=(await env.fetch('evaluation-runs.php?dashboard=1&department=2')).dashboard;assert.equal(filtered.counts.total,10);
 const company=(await env.fetch('company.php')).company;assert.equal(company.activeUsers,100);assert.equal(company.departments,10);
 assert.deepEqual(JSON.parse(env.storage.get('oplen-mirror-v1')),old);
 const changed=structuredClone(s);changed.company.name='My saved demo';const persisted=boot({'oplen-mirror-scale-v2':JSON.stringify(changed)});assert.equal(persisted.context.window.OplenDemo.snapshot().company.name,'My saved demo');
 const bootstrap=await env.fetch('index.php?action=bootstrap');assert.equal(bootstrap.directory.length,100);
 const csv='nombre,correo,departamento,puesto,responsable_correo,nivel,permisos\nNueva Persona,new@horizonte.example,Dirección,Directora general,boss@horizonte.example,colaborador,directory\nNuevo Manager,boss@horizonte.example,Dirección,Directora general,persona1@horizonte.example,manager,knowledge\n';
 const request=async body=>{const response=await env.context.window.fetch('https://demo.oplen.io/api/team-import.php',{method:'POST',body:JSON.stringify({csrf:'demo-local',...body})});return response.json()};
 const preview=await request({action:'preview',csv});assert(preview.preview.valid);assert.equal(env.context.window.OplenDemo.snapshot().people.length,100);
 const cycle=await request({action:'preview',csv:csv.replace('persona1@horizonte.example,manager','new@horizonte.example,manager')});assert(!cycle.preview.valid);
 const valid=await request({action:'preview',csv});const forged=await request({action:'commit',csv:csv+' ',token:valid.token});assert.equal(forged.ok,false);
 const created=await request({action:'commit',csv,token:valid.token});assert.equal(created.count,2);const imported=env.context.window.OplenDemo.snapshot().people.slice(-2);assert.equal(imported[0].manager_id,imported[1].id);assert(!env.storage.get('oplen-mirror-scale-v2').includes(created.credentials[0].password));
 const duplicate=await request({action:'preview',csv});assert(!duplicate.preview.valid);assert.equal(env.context.window.OplenDemo.snapshot().people.length,102);
 env.context.location.search='?previewUser='+imported[1].id;assert.deepEqual((await env.fetch('index.php?action=bootstrap')).user.permissions,['knowledge']);env.context.location.search='?previewUser=2';assert.equal((await request({action:'preview',csv})).ok,false);
 console.log('CSV preview, hierarchy, cycles, commit token, duplicate protection and credential privacy verified.');
 console.log('100 people, 10 departments, hierarchy, references, dashboard, isolation and persistence verified.');
})().catch(e=>{console.error(e);process.exit(1)});
