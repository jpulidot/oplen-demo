const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const KEY='oplen-demo-projects-v1';
const previous=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/projects-before-examples.json'),'utf8'));
function setup(initial,readOnly=false){
  const dom=new JSDOM('<div id="app"><main id="content"></main></div>',{url:'https://demo.oplen.io/demo/#/proyectos',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;w.structuredClone=structuredClone;w.Response=Response;w.fetch=()=>{throw Error('No network');};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const RealDate=w.Date;w.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-12-28T12:00:00']));}};
  if(initial!==undefined)w.localStorage.setItem(KEY,JSON.stringify(initial));
  for(const f of ['demo/backend.js','demo/projects.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
  const root=w.document.querySelector('#content'),context={user:{id:1,name:'Ana Torres',role:'admin',permissions:['departments','knowledge']},readOnly};
  const mount=()=>w.OplenProjects.mount(root,context),data=()=>JSON.parse(w.localStorage.getItem(KEY)),click=selector=>{const e=w.document.querySelector(selector);assert(e,selector);e.click();};
  return {dom,w,root,context,mount,data,click,close:()=>dom.window.close()};
}
function legacy(version){
  const d=structuredClone(previous);d.version=version;d.revision=9;d.initiatives=[];d.projects=d.projects.filter(p=>!p.parentId);d.projects.forEach(p=>{p.parentId=null;p.initiativeId=null;});d.tasks.find(t=>t.project==='help-center').project='service';d.requests.forEach(r=>{if(r.project==='help-center')r.project='service';});
  d.projects[0].name='Proyecto que ya edité';d.tasks[0].comments.push({id:'kept-comment',author:'Persona demo',body:'Conservar este acuerdo',at:'2026-10-01T12:00:00Z'});
  if(version<3)delete d.requests;if(version===1){delete d.initiatives;d.projects.forEach(p=>{delete p.parentId;delete p.initiativeId;});}
  return d;
}
// A first visit has six populated cards, with all template tasks and unique identities.
let app=setup();app.mount();let first=app.data();
assert.equal(app.root.querySelectorAll('[data-pw-initiative-card]').length,6);assert.equal(first.demoExamplesVersion,2);assert.equal(first.projects.filter(p=>p.templateId).length,6);assert.equal(first.tasks.filter(t=>t.demoScenarioId).length,49);
assert(first.initiatives.every(i=>first.projects.some(p=>p.initiativeId===i.id)));
for(const p of first.projects.filter(p=>p.demoScenarioId)){const tasks=first.tasks.filter(t=>t.project===p.id);assert.equal(p.startDate,'2026-12-14');assert(tasks.every(t=>t.checklist.length===2));assert.equal(tasks.at(-1).due,p.due);}assert.equal(first.projects.filter(p=>p.demoScenarioId).length,12);assert(first.tasks.some(t=>t.blockedReason));assert(first.tasks.some(t=>t.demoScenarioId&&t.status==='done'));
const ids=[...first.initiatives,...first.projects,...first.tasks,...first.tasks.flatMap(t=>t.checklist)].map(x=>x.id);assert.equal(ids.length,new Set(ids).size);
let before=app.w.localStorage.getItem(KEY);app.mount();assert.equal(app.w.localStorage.getItem(KEY),before);app.close();
// The screenshot's zero-initiative state upgrades exactly once, retaining all prior work.
for(const version of [1,2,3]){
  const old=legacy(version);app=setup(old);app.mount();const d=app.data();assert.equal(d.version,3);assert.equal(d.revision,10);assert.equal(d.initiatives.length,6);assert.equal(d.projects.length,15);assert.equal(d.tasks.length,61);assert.deepEqual(d.tasks.slice(0,old.tasks.length),old.tasks);assert.deepEqual(d.requests,old.requests||[]);
  for(const p of old.projects)assert.deepEqual(d.projects.find(x=>x.id===p.id),{...p,parentId:null,initiativeId:null});
  assert.equal(app.root.querySelectorAll('.pw-independent-grid article').length,3);before=app.w.localStorage.getItem(KEY);app.mount();assert.equal(app.w.localStorage.getItem(KEY),before);
  // Persisted edits and archived examples are never reset or copied again.
  d.initiatives[0].status='archived';d.tasks.at(-1).status='done';app.w.localStorage.setItem(KEY,JSON.stringify(d));app.mount();assert.deepEqual(app.data(),d);
  app.close();
}
// An intentionally emptied workspace keeps its marker and is not filled again on mount.
app=setup({version:3,revision:7,initiatives:[],projects:[],tasks:[],requests:[],demoExamplesVersion:1});app.mount();assert.equal(app.data().projects.length,0);app.close();
// Existing organized work stays byte-for-byte unchanged until the visitor loads the examples.
app=setup(previous);before=app.w.localStorage.getItem(KEY);app.mount();assert.equal(app.w.localStorage.getItem(KEY),before);
app.click('[data-pw-action="project-templates"]');app.click('[data-pw-template="content"]');app.click('#pw-template-form [type="submit"]');
const partial=app.data(),copy=partial.projects.at(-1);copy.description='Descripción que ya personalicé';app.w.localStorage.setItem(KEY,JSON.stringify(partial));app.mount();assert.equal(copy.templateId,'content');app.click('[data-pw-project="portfolio"]');app.click('[data-pw-action="project-templates"]');const load=app.w.document.querySelector('[data-pw-action="load-demo-examples"]');load.click();let complete=app.data();assert.equal(complete.revision,partial.revision+1);assert.equal(complete.projects.filter(p=>p.templateId).length,6);assert.deepEqual(complete.tasks.slice(0,partial.tasks.length),partial.tasks);assert.deepEqual(complete.projects.find(p=>p.id===copy.id),copy);assert.equal(complete.initiatives.length,7);before=app.w.localStorage.getItem(KEY);load.click();assert.equal(app.w.localStorage.getItem(KEY),before);app.close();
// Read-only views never backfill existing records or persist a brand-new example workspace.
app=setup(legacy(3),true);before=app.w.localStorage.getItem(KEY);app.mount();assert.equal(app.w.localStorage.getItem(KEY),before);assert(!app.root.querySelector('[data-pw-action="project-templates"]'));app.context.readOnly=false;app.mount();assert.equal(app.data().initiatives.length,6);app.close();
app=setup(undefined,true);app.mount();assert.equal(app.w.localStorage.getItem(KEY),null);assert.equal(app.root.querySelectorAll('[data-pw-initiative-card]').length,6);app.close();
// Quota failure leaves the old portfolio usable; a later retry creates the entire pack.
app=setup(legacy(3));before=app.w.localStorage.getItem(KEY);const set=app.w.Storage.prototype.setItem;app.w.Storage.prototype.setItem=()=>{throw Error('Storage full');};app.mount();assert.equal(app.w.localStorage.getItem(KEY),before);assert(app.root.querySelector('.pw-portfolio-home'));assert.match(app.w.document.querySelector('[role="alert"]').textContent,/Tus proyectos se conservan/);app.w.Storage.prototype.setItem=set;app.mount();assert.equal(app.data().projects.length,15);app.close();
// A second tab's write during the automatic upgrade is preserved by the revision lease.
app=setup(legacy(3));const get=app.w.Storage.prototype.getItem;let reads=0,other;
app.w.Storage.prototype.getItem=function(key){if(key===KEY&&++reads===2){other=JSON.parse(get.call(this,key));other.revision++;other.tasks[0].title='Cambio de otra pestaña';set.call(this,key,JSON.stringify(other));}return get.call(this,key);};
app.mount();assert.deepEqual(app.data(),other);assert.match(app.w.document.querySelector('[role="alert"]').textContent,/otra pestaña/);app.w.Storage.prototype.getItem=get;app.mount();assert.equal(app.data().tasks[0].title,'Cambio de otra pestaña');assert.equal(app.data().initiatives.length,6);app.close();
// The already-deployed generic pack becomes concrete projects, retaining task/subtask identities.
const generic=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/projects-generic-examples.json'),'utf8'));
app=setup(generic);app.mount();let realistic=app.data();
assert.equal(realistic.demoExamplesVersion,2);assert.equal(realistic.revision,generic.revision+1);assert.equal(realistic.initiatives.length,6);assert.equal(realistic.projects.length,12);assert.equal(realistic.tasks.length,49);
assert.deepEqual(realistic.initiatives.map(i=>i.name),['Luma · App de reservas','Café Bruma','Plano Abierto · Temporada 1','Nómada · Tienda en línea','Casa Olivo · Remodelación','Festival Río Abierto']);
for(const t of generic.tasks){const converted=realistic.tasks.find(x=>x.id===t.id);assert(converted);assert.deepEqual(converted.checklist.map(c=>c.id),t.checklist.map(c=>c.id));}
assert.equal(realistic.tasks.filter(t=>t.status==='done').length,20);assert.equal(realistic.tasks.filter(t=>t.blockedReason).length,2);assert(realistic.tasks.every(t=>t.checklist.every(c=>typeof c.title==='string'&&c.done===(c.status==='done'))));
assert(realistic.projects.every(p=>realistic.initiatives.some(i=>i.id===p.initiativeId)));assert(realistic.tasks.every(t=>realistic.projects.some(p=>p.id===t.project)));
before=app.w.localStorage.getItem(KEY);app.mount();assert.equal(app.w.localStorage.getItem(KEY),before);app.close();
// Edited tasks, custom project descriptions and paused/archived initiatives are preserved.
for(const edit of [d=>{d.tasks[0].comments.push({id:'note',body:'Ya estoy usando esta tarea',author:'Demo',at:'2026-10-01T12:00:00Z'});},d=>{d.projects[0].description='Mi alcance personalizado';},d=>{d.initiatives[0].status='paused';},d=>{d.initiatives[0].status='archived';}]){
  const modified=structuredClone(generic);edit(modified);app=setup(modified);app.mount();const after=app.data();assert.deepEqual(after.projects.find(p=>p.id===modified.projects[0].id),modified.projects[0]);assert.deepEqual(after.tasks.filter(t=>t.project===modified.projects[0].id),modified.tasks.filter(t=>t.project===modified.projects[0].id));assert.deepEqual(after.initiatives.find(i=>i.id===modified.initiatives[0].id),modified.initiatives[0]);app.close();
}
// Branding customized on an initiative survives; the untouched example gets its own case.
const branded=structuredClone(generic);branded.initiatives[0].name='Iniciativa personalizada';app=setup(branded);app.mount();assert.deepEqual(app.data().initiatives.find(i=>i.id===branded.initiatives[0].id),branded.initiatives[0]);assert.equal(app.data().initiatives.length,7);app.close();
app=setup(generic,true);before=app.w.localStorage.getItem(KEY);app.mount();assert.equal(app.w.localStorage.getItem(KEY),before);app.close();
app=setup(generic);before=app.w.localStorage.getItem(KEY);const updateSet=app.w.Storage.prototype.setItem;app.w.Storage.prototype.setItem=()=>{throw Error('Storage full');};app.mount();assert.equal(app.w.localStorage.getItem(KEY),before);assert(app.root.querySelector('.pw-portfolio-home'));app.w.Storage.prototype.setItem=updateSet;app.mount();assert.equal(app.data().demoExamplesVersion,2);app.close();
console.log('PASS: realistic six-case portfolio, 12 projects/49 tasks, preserved IDs and edits, one-time v1 pack update, first visit/legacy migration, partial manual pack, readonly, date rollover, quota retry and conflicts');
