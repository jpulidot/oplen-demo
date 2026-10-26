const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="app"><main id="content"></main></div>',{url:'https://demo.oplen.io/demo/#/inicio',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;w.structuredClone=structuredClone;w.Response=Response;w.fetch=()=>{throw Error('Unexpected network')};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
for(const file of ['demo/backend.js','demo/projects.js'])w.eval(fs.readFileSync(file,'utf8'));
const root=w.document.querySelector('#content'),context={personal:true,user:{id:1,name:'Ana Torres',role:'admin',permissions:['departments','knowledge']},readOnly:false};
const mount=screen=>w.OplenProjects.mount(root,{...context,screen}),key='oplen-demo-projects-v1';
mount('projects');const saved=w.localStorage.getItem(key);
mount('home');assert(root.querySelector('.pw-personal-home'));assert.equal(w.localStorage.getItem(key),saved);
mount('mywork');assert.equal(root.querySelector('.pw-work h2').textContent,'Mi trabajo');assert.equal(root.querySelector('[data-pw-filter="department"]'),null);
// Editing an existing legacy-linked task must preserve its activity and assignment.
const state=JSON.parse(saved),task=state.tasks[0];task.owner=1;task.activity=123;w.localStorage.setItem(key,JSON.stringify(state));mount('mywork');
root.querySelector(`[data-pw-open="${task.id}"]`).click();const form=w.document.querySelector('#pw-task-form');assert(form.elements.activity.disabled);assert(form.elements.activity.closest('label').hidden);assert(!form.elements.owner.textContent.includes(' · '));
form.elements.title.value='Entrega personal verificada';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
const updated=JSON.parse(w.localStorage.getItem(key)).tasks.find(t=>t.id===task.id);assert.equal(updated.title,'Entrega personal verificada');assert.equal(updated.activity,123);assert.equal(updated.owner,1);
mount('projects');assert(root.querySelector('.pw-portfolio-home'));assert.equal(root.querySelector('.eyebrow').textContent,'OPLEN · ESPACIO PERSONAL');
mount('home');assert(root.querySelector('.pw-personal-home'));dom.window.close();console.log('PASS: personal screens, corporate fields excluded, legacy links and assignments preserved');
