const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const KEY='oplen-demo-projects-v1';
const dom=new JSDOM('<div id="app"><main id="content"></main></div>',{url:'https://demo.oplen.io/demo/#/proyectos',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.structuredClone=structuredClone;w.Response=Response;w.fetch=async()=>{throw new Error('No network expected');};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
for(const file of ['demo/backend.js','demo/projects.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
let context={user:{id:1,name:'Ana Torres',role:'admin',permissions:['departments','knowledge','directory']},readOnly:false};
const root=w.document.querySelector('#content');
const mount=()=>{w.OplenProjects.mount(root,context);if(root.querySelector('.pw-portfolio-home'))root.querySelector('[data-pw-project="all"]').click();};
const $=selector=>{const el=w.document.querySelector(selector);assert(el,'Missing '+selector);return el;};
const click=selector=>$(selector).click();
const fill=(selector,value)=>{$(selector).value=value;};
const submit=selector=>$(selector).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
const change=(selector,value)=>{fill(selector,value);$(selector).dispatchEvent(new w.Event('change',{bubbles:true}));};
const data=()=>JSON.parse(w.localStorage.getItem(KEY));
const saved=()=>data().tasks.at(-1);
const list=scope=>{click('[data-pw-project="'+scope+'"]');click('[data-pw-view="list"]');};
w.localStorage.setItem(KEY,JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/projects-before-examples.json'),'utf8'))));
mount();const factory=data();assert.equal(factory.version,3);
assert.equal(root.querySelectorAll('.pw-project-card').length,3);
click('[data-pw-toggle="service"]');assert(!root.querySelector('.pw-sidebar [data-pw-project="help-center"]'));assert.equal($('[data-pw-toggle="service"]').getAttribute('aria-expanded'),'false');click('[data-pw-toggle="service"]');
list('service');assert.equal(root.querySelectorAll('tbody tr').length,3);assert.match(root.textContent,/Centro de ayuda/);
list('initiative:customer-experience');assert.equal(root.querySelectorAll('tbody tr').length,8);assert.equal(new Set([...root.querySelectorAll('tbody [data-pw-open]')].map(e=>e.dataset.pwOpen)).size,8);
// Create a complete initiative > project > subproject > task and retain one task identity at every level.
click('[data-pw-action="new-initiative"]');fill('#pw-initiative-form [name="name"]','Calidad de servicio');submit('#pw-initiative-form');const ini=data().initiatives.at(-1);
click('.pw-work [data-pw-action="new-project"]');fill('#pw-project-form [name="name"]','Documentación de soporte');fill('#pw-project-form [name="owner"]','31');submit('#pw-project-form');const parent=data().projects.at(-1);assert.equal(parent.initiativeId,ini.id);
click('[data-pw-action="new-subproject"]');fill('#pw-project-form [name="name"]','Guías de atención');assert($('#pw-project-form [name="initiativeId"]').disabled);submit('#pw-project-form');assert(!w.document.querySelector('dialog'));const child=data().projects.at(-1);assert.equal(child.parentId,parent.id);assert.equal(child.initiativeId,null);
click('[data-pw-action="new-task"]');fill('#pw-task-form [name="title"]','Publicar política de atención');change('#pw-task-form [name="owner"]','32');change('#pw-task-form [name="activity"]','10');
assert.match($('#pw-task-context').textContent,/Atención de solicitudes/);assert.match($('#pw-task-context').textContent,/Agente de soporte/);assert.match($('#pw-task-context').textContent,/Cuándo escalar/);assert($('#pw-task-context [data-pw-document="10"]'));
click('#pw-task-context [data-pw-document="10"] summary');assert.match($('#pw-task-context .pw-document-body').textContent,/Procedimiento/);assert($('#pw-task-context [data-pw-document="10"]').open);assert.equal($('#pw-task-context .pw-document-body ol').children.length,5);assert(!$('#pw-task-context .pw-document-body').textContent.includes('## '));
fill('#pw-new-check','Revisar criterio');click('[data-pw-action="add-check"]');change('[data-pw-sub-owner]','1');change('[data-pw-sub-status]','review');change('[data-pw-sub-due]','2026-11-04');submit('#pw-task-form');const task=saved();assert.equal(task.project,child.id);assert.equal(task.activity,10);assert.equal(task.checklist[0].owner,1);assert.equal(task.checklist[0].status,'review');assert.equal(task.checklist[0].due,'2026-11-04');
for(const scope of [child.id,parent.id,'initiative:'+ini.id]){list(scope);assert.equal(root.querySelectorAll('tbody tr').length,1);assert($('[data-pw-open="'+task.id+'"]'));}
list('mine');assert($('[data-pw-open="'+task.id+'"]'));assert.match($('.pw-my-subtasks').textContent,/Revisar criterio/); // A subtask assigned to me is discoverable.
list(parent.id);change('[data-pw-filter="department"]','Soporte');assert.equal(root.querySelectorAll('tbody tr').length,1);change('[data-pw-filter="person"]','1');assert.equal(root.querySelectorAll('tbody tr').length,0);click('[data-pw-action="clear-filters"]');
click('[data-pw-open="'+task.id+'"]');change('[data-pw-sub-status]','done');submit('#pw-task-form');assert.equal(saved().checklist[0].done,true);list('mine');assert(!root.querySelector('[data-pw-open="'+task.id+'"]'));
// Closing a parent task does not manufacture completion of its subtasks.
list(child.id);change('[data-pw-status="'+task.id+'"]','done');click('[data-pw-project="'+parent.id+'"]');assert.match($('.pw-metrics').textContent,/100/);assert.match($('.pw-project-context').textContent,/Atención de solicitudes/);
// Reparenting a whole project changes rollups without changing task IDs.
click('[data-pw-action="edit-project"]');fill('#pw-project-form [name="initiativeId"]','');submit('#pw-project-form');assert.equal(data().projects.find(p=>p.id===parent.id).initiativeId,null);list('initiative:'+ini.id);assert.equal(root.querySelectorAll('tbody tr').length,0);list(parent.id);assert.equal(root.querySelectorAll('tbody tr').length,1);
// Reject a cycle even if a crafted form submits an unavailable option.
click('[data-pw-action="edit-project"]');const cycle=w.document.createElement('option');cycle.value=child.id;cycle.textContent='Invalid parent';$('#pw-project-form [name="parentId"]').append(cycle);fill('#pw-project-form [name="parentId"]',child.id);submit('#pw-project-form');assert.match($('[data-pw-error]').textContent,/principal válido/);assert.equal(data().projects.find(p=>p.id===parent.id).parentId,null);click('[data-pw-action="cancel"]');
// Department and deadline filters act on the same underlying tasks in list and board.
list('all');change('[data-pw-filter="due"]','late');const count=root.querySelectorAll('tbody tr').length;assert(count>0);click('[data-pw-view="board"]');assert.equal(root.querySelectorAll('.pw-task-card').length,count);click('[data-pw-action="clear-filters"]');
// Documents use the existing published Oplen data, escape HTML, and exclude unavailable records.
const getSnapshot=w.OplenDemo.snapshot;
w.OplenDemo.snapshot=()=>{const s=getSnapshot();s.docs.find(d=>d.id===10).body='<img src=x onerror=alert(1)>\n\n## Texto seguro';s.docs.find(d=>d.id===11).status='draft';s.docs.find(d=>d.id===12).visibility='private';return s;};
mount();list('all');click('[data-pw-open="'+task.id+'"]');assert(!w.document.querySelector('.pw-task-context img'));assert.match($('.pw-document-body').textContent,/<img/);click('[data-pw-action="cancel"]');
context={user:{id:32,name:'Paula Ortega',role:'collaborator',permissions:['departments','knowledge']},readOnly:true};mount();list('all');click('[data-pw-open="task-11"]');assert(!w.document.querySelector('[data-pw-document="11"]'));assert([...w.document.querySelectorAll('#pw-task-form fieldset')].every(f=>f.disabled));click('[data-pw-action="cancel"]');click('[data-pw-open="task-12"]');assert(!w.document.querySelector('[data-pw-document="12"]'));click('[data-pw-action="cancel"]');
context={user:{id:32,name:'Paula Ortega',role:'collaborator',permissions:[]},readOnly:true};mount();list('all');click('[data-pw-open="'+task.id+'"]');assert(!w.document.querySelector('[data-pw-operation]'));assert(!w.document.querySelector('[data-pw-document]'));click('[data-pw-action="cancel"]');
// Migration never replaces a user's v1 data or silently groups their projects.
context={user:{id:1,name:'Ana Torres',role:'admin',permissions:[]},readOnly:false};
const legacy=structuredClone(factory);legacy.version=1;delete legacy.initiatives;legacy.projects=legacy.projects.filter(p=>p.id!=='help-center');for(const p of legacy.projects){delete p.parentId;delete p.initiativeId;}legacy.tasks.find(t=>t.id==='task-12').project='service';for(const t of legacy.tasks)for(const c of t.checklist){delete c.status;delete c.owner;delete c.due;}
legacy.projects[0].name='Mi proyecto editado';legacy.tasks[0].comments.push({id:'legacy-note',author:'Julio',body:'Conservar esta nota',at:new Date().toISOString()});legacy.revision=7;
w.localStorage.setItem(KEY,JSON.stringify(legacy));mount();assert.equal(data().version,3);assert.equal(data().revision,8);assert(root.textContent.includes('Mi proyecto editado'));
list('all');change('[data-pw-status="task-2"]','done');assert.equal(data().version,3);assert.equal(data().revision,9);assert.equal(data().initiatives.length,6);assert.equal(data().projects.length,9);assert.equal(data().tasks.length,43);assert.equal(data().tasks[0].comments.at(-1).body,'Conservar esta nota');assert.equal(data().tasks[0].checklist[0].status,'done');assert(data().projects.slice(0,3).every(p=>!p.parentId&&!p.initiativeId));
dom.window.close();
console.log('PASS: hierarchy, creation, optional grouping, cycle prevention, aggregate progress, project origin, Oplen people/activities/docs, document permissions + escaping, subtask assignment/status/dates, filters, readonly, v1 data-preserving migration');
