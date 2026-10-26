const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;
w.OplenProjects={assistantContext:()=>({user:{id:1},projects:[{id:'p',name:'Luma'}],tasks:[{id:'t',project:'p',title:'Validar pago',owner:1,status:'todo',due:'2026-10-27',blockedReason:'Falta aprobación',checklist:[]}]})};
w.eval(fs.readFileSync('demo/assistant.js','utf8'));const $=s=>w.document.querySelector(s);
assert($('.oa-panel').hidden);$('.oa-launch').click();assert(!$('.oa-panel').hidden);assert.equal(w.document.activeElement,$('#oa-input'));
function ask(t){$('#oa-input').value=t;$('.oa-form').dispatchEvent(new w.Event('submit',{cancelable:true}));return $('.oa-log').lastElementChild.textContent;}
assert(ask('Mis pendientes').includes('Validar pago'));assert(ask('bloqueos').includes('Falta aprobación'));assert(ask('Luma').includes('0 de 1'));ask('<img src=x onerror=alert(1)>');assert.equal($('.oa-log img'),null);
w.document.querySelector('.oa-root').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert($('.oa-panel').hidden);assert.equal(w.document.activeElement,$('.oa-launch'));
w.OplenProjects.assistantContext=()=>null;assert(ask('hola').includes('Abre Inicio'));dom.window.close();console.log('PASS: assistant queries, safe text, open/close, focus and unavailable data');
