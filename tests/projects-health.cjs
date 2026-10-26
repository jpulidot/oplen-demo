const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const KEY='oplen-demo-projects-v1',cssErrors=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>cssErrors.push(e.message));
const dom=new JSDOM('<style>'+fs.readFileSync(path.join(__dirname,'../demo/projects.css'),'utf8')+'</style><div id="app"><main id="content"></main></div>',{url:'https://demo.oplen.io/demo/#/proyectos',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;w.structuredClone=structuredClone;w.Response=Response;w.fetch=async()=>{throw Error('Unexpected network');};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
// Fixed local calendar for deterministic deadline boundaries, including a month change.
const RealDate=w.Date;let clock='2026-10-30T12:00:00';w.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return new RealDate(clock).getTime();}};
for(const file of ['demo/backend.js','demo/projects.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
let context={user:{id:1,name:'Ana Torres',role:'admin',permissions:['departments','knowledge']},readOnly:false};
const root=w.document.querySelector('#content'),mount=()=>{w.OplenProjects.mount(root,context);if(root.querySelector('.pw-portfolio-home'))root.querySelector('[data-pw-project="all"]').click();};
const $=s=>{const e=w.document.querySelector(s);assert(e,'Missing '+s);return e;};
const click=s=>$(s).click(),fill=(s,v)=>{$(s).value=v;},change=(s,v)=>{fill(s,v);$(s).dispatchEvent(new w.Event('change',{bubbles:true}));};
const submit=()=>$('#pw-task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
const data=()=>JSON.parse(w.localStorage.getItem(KEY));
const stateIs=k=>assert.equal($('.pw-health-panel').dataset.pwHealthState,k);
const scope=id=>click('[data-pw-project="'+id+'"]');
const why=()=>click('[data-pw-action="view-health"]');
w.localStorage.setItem(KEY,JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/projects-before-examples.json'),'utf8'))));
mount();const fixture=data();assert.equal(fixture.version,3);assert.equal(cssErrors.length,0);assert(w.document.styleSheets[0].cssRules.length>100);
const base=()=>{const d=structuredClone(fixture);d.requests=[];d.tasks=[{...d.tasks[0],id:'health-task',project:'help-center',title:'Entrega verificable',status:'todo',owner:32,due:'2026-11-10',checklist:[],blockedReason:'',archived:false}];d.projects.forEach(p=>p.due='2026-11-20');d.initiatives.forEach(i=>i.due='2026-11-25');return d;};
const put=(edit=()=>{})=>{const d=base();edit(d);w.localStorage.setItem(KEY,JSON.stringify(d));mount();scope('help-center');};
// Calendar boundaries: due today is upcoming, yesterday is overdue; +3 inclusive, +4 excluded.
put();stateIs('good');
for(const [due,key] of [['2026-10-29','danger'],['2026-10-30','warning'],['2026-11-02','warning'],['2026-11-03','good']]){put(d=>d.tasks[0].due=due);stateIs(key);}
put(d=>{d.tasks[0].owner=null;d.tasks[0].due='';});stateIs('warning');why();assert.match($('.pw-health-issues').textContent,/Sin responsable/);click('[data-pw-action="cancel"]');
put(d=>d.tasks[0].owner=9999);stateIs('warning');
// Subtask dates and owners roll up once per parent task, even across project and initiative.
put(d=>{d.tasks[0].checklist=[{id:'step',title:'Validación <img src=x>',status:'todo',done:false,owner:null,due:'2026-10-29'}];d.tasks[0].blockedReason='Esperando acceso <svg onload=x>';});
for(const id of ['help-center','service','initiative:customer-experience','all']){scope(id);stateIs('danger');why();assert.equal(w.document.querySelectorAll('[data-pw-health-issue="task:health-task"]').length,1);assert.match($('.pw-health-issues').textContent,/Subtarea vencida/);assert(!$('.pw-health-issues').querySelector('img,svg'));click('[data-pw-action="cancel"]');}
put(d=>d.tasks[0].checklist=[{id:'step',title:'Revisión',status:'todo',done:false,owner:null,due:'2026-11-10'}]);stateIs('good'); // Inherit parent owner.
put(d=>{d.tasks[0].status='done';d.tasks[0].due='2026-10-01';d.tasks[0].blockedReason='Histórico';d.tasks[0].checklist=[{id:'step',title:'Pendiente anterior',done:false,status:'todo',due:'2026-10-01'}];});stateIs('complete');
put(d=>d.tasks[0].archived=true);stateIs('empty');
put(d=>d.tasks=[]);stateIs('empty');
// Target date alerts apply to unfinished scopes and navigate to the exact project.
put(d=>d.projects.find(p=>p.id==='service').due='2026-10-29');scope('service');stateIs('danger');why();assert.equal(w.document.querySelectorAll('[data-pw-health-issue]').length,1);click('[data-pw-kind="project"]');assert.equal($('.pw-work h2').textContent,'Mejora de atención');
put(d=>d.initiatives[0].due='2026-10-30');scope('initiative:customer-experience');stateIs('warning');why();assert($('[data-pw-kind="initiative"]'));click('[data-pw-action="cancel"]');
put(d=>{d.tasks[0].status='done';d.projects.forEach(p=>p.due='2026-10-01');d.initiatives[0].due='2026-10-01';});scope('all');stateIs('complete');
// Blocking requires a reason and preserves task status, notes, history and request lineage.
put();click('[data-pw-view="list"]');click('[data-pw-open="health-task"]');$('#pw-task-form [name="blocked"]').checked=true;$('#pw-task-form [name="blocked"]').dispatchEvent(new w.Event('change',{bubbles:true}));submit();assert.match($('[data-pw-error]').textContent,/Describe qué impide/);assert.equal(data().tasks[0].blockedReason,'');
fill('#pw-task-form [name="blockedReason"]','Falta confirmar criterios');submit();assert.equal(data().tasks[0].status,'todo');assert.equal(data().tasks[0].blockedReason,'Falta confirmar criterios');assert(data().tasks[0].history.some(h=>h.body.includes('Bloqueo registrado')));
scope('help-center');stateIs('danger');why();click('[data-pw-kind="task"]');assert.equal($('#pw-task-form [name="title"]').value,'Entrega verificable');assert($('#pw-task-form [name="blocked"]').checked);click('[data-pw-action="cancel"]');
click('[data-pw-view="list"]');change('[data-pw-filter="attention"]','blocked');assert.equal(root.querySelectorAll('tbody tr').length,1);click('[data-pw-view="board"]');assert.equal(root.querySelectorAll('.pw-task-card').length,1);
change('[data-pw-filter="attention"]','warning');assert.equal(root.querySelectorAll('.pw-task-card').length,0);change('[data-pw-filter="attention"]','danger');assert.equal(root.querySelectorAll('.pw-task-card').length,1);
change('[data-pw-status="health-task"]','done');assert.equal(data().tasks[0].blockedReason,'');scope('help-center');stateIs('complete');click('[data-pw-view="list"]');change('[data-pw-status="health-task"]','doing');scope('help-center');stateIs('good');
// Completing via the drawer also resolves the blocker; reopening won't resurrect it.
put(d=>d.tasks[0].blockedReason='Acceso pendiente');click('[data-pw-view="list"]');click('[data-pw-open="health-task"]');change('#pw-task-form [name="status"]','done');assert(!$('#pw-task-form [name="blocked"]').checked);submit();assert.equal(data().tasks[0].blockedReason,'');
// Updating a due date or owner immediately clears their warnings.
put(d=>{d.tasks[0].due='2026-10-29';d.tasks[0].owner=null;});why();click('[data-pw-kind="task"]');fill('#pw-task-form [name="due"]','2026-11-10');change('#pw-task-form [name="owner"]','32');submit();scope('help-center');stateIs('good');
// Nothing derived is persisted; existing v3 data needs no rewrite just to calculate health.
const before=w.localStorage.getItem(KEY);mount();assert.equal(w.localStorage.getItem(KEY),before);
clock='2026-11-11T12:00:00';mount();scope('help-center');stateIs('danger');clock='2026-10-30T12:00:00';
// Read-only consumers can inspect each cause but cannot modify its task.
put(d=>d.tasks[0].blockedReason='Permiso pendiente');context={...context,readOnly:true};mount();scope('help-center');why();click('[data-pw-kind="task"]');assert($('#pw-task-form [name="blocked"]').disabled);assert(!w.document.querySelector('#pw-task-form [type="submit"]'));const readonly=w.localStorage.getItem(KEY);submit();assert.equal(w.localStorage.getItem(KEY),readonly);click('[data-pw-action="cancel"]');context={...context,readOnly:false};
// Existing transaction protections apply to blocker edits too.
put();click('[data-pw-view="list"]');click('[data-pw-open="health-task"]');$('#pw-task-form [name="blocked"]').checked=true;fill('#pw-task-form [name="blockedReason"]','No debe guardarse');const current=data();current.revision++;w.localStorage.setItem(KEY,JSON.stringify(current));submit();assert.match($('[data-pw-error]').textContent,/otra pestaña/);assert.equal(data().tasks[0].blockedReason,'');click('[data-pw-action="cancel"]');
put();click('[data-pw-view="list"]');click('[data-pw-open="health-task"]');$('#pw-task-form [name="blocked"]').checked=true;fill('#pw-task-form [name="blockedReason"]','No debe guardarse');const oldSet=w.Storage.prototype.setItem;w.Storage.prototype.setItem=()=>{throw Error('Storage full');};submit();assert.match($('[data-pw-error]').textContent,/Storage full/);assert.equal(data().tasks[0].blockedReason,'');w.Storage.prototype.setItem=oldSet;
dom.window.close();console.log('PASS: explainable health, date boundaries, hierarchy rollup, subtask risk/inherited owners, target dates, empty/completed/archive exclusions, blocker lifecycle, task/board filters, escaping, read-only, no read migrations, clock refresh, stale/quota protection and CSS parsing');
