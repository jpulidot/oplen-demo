const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),memory=new Map();
const element=s=>{if(!elements.has(s))elements.set(s,{innerHTML:'',textContent:'',className:'',dataset:{},classList:{toggle(){}},querySelector:s=>element(s),showModal(){},close(){},remove(){},focus(){},setSelectionRange(){}});return elements.get(s)};
const context={structuredClone,console,setTimeout(){},location:{hash:''},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},document:{querySelector:s=>element(s),querySelectorAll:()=>[],createElement:()=>({remove(){}}),body:{append(){},classList:{toggle(){},contains(){return false}}}},window:{addEventListener(){}},FormData:class{constructor(v){this.v=v}get(k){return this.v[k]}}};
let source=fs.readFileSync(require('node:path').join(__dirname,'../demo-assets/demo.js'),'utf8');source=source.replace('window.addEventListener(\'hashchange\',()=>{query=\'\';render()});render();})();',"window.addEventListener('hashchange',render);render();globalThis.demo={render,team,knowledge,showResponsibility,docForm,lesson,evaluate,getState:()=>state,setRole:r=>role=r,setTab:t=>teamTab=t,setQuery:q=>query=q};})();");vm.createContext(context);vm.runInContext(source,context);const d=context.demo;
for(const route of ['inicio','equipo','responsabilidades','documentacion','career-path','evaluaciones']){context.location.hash='#/'+route;d.render();assert(element('#app').innerHTML.includes('Oplen Demo'));assert(!element('#app').innerHTML.includes('undefined'))}
d.setTab('mapa');assert(d.team().includes('Ana Torres'));assert(d.team().includes('Lucía Vega'));
d.setRole('Colaborador');assert(!d.knowledge().includes('data-add-doc'));d.setRole('Dirección');assert(d.knowledge().includes('data-add-doc'));
d.docForm();element('#doc-form').onsubmit({preventDefault(){},target:{title:'<script>bad</script>',category:'Operaciones',content:'Texto seguro'}});assert(d.knowledge().includes('&lt;script&gt;'));assert(!d.knowledge().includes('<script>bad'));
d.lesson(0);element('#lesson-form').onsubmit({preventDefault(){},target:{answer:'0'}});assert.equal(d.getState().completed.length,0);element('#lesson-form').onsubmit({preventDefault(){},target:{answer:'1'}});assert.equal(d.getState().completed.length,1);
d.evaluate();element('#evaluation-form').onsubmit({preventDefault(){},target:{q0:'1',q1:'2',q2:'0'}});assert.equal(d.getState().results.at(-1).score,100);assert(memory.has('oplen-demo-v1'));
d.setQuery('no existe este documento');assert(d.knowledge().includes('No hay documentos'));
console.log('PASS: 6 routes, company map, perspective UI, document editing and escaping, lesson scoring, evaluation and persistence');

