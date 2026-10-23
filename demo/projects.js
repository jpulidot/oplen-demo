/* Oplen demo projects: browser-local prototype; no production API or ClickUp connection. */
(() => {
  'use strict';
  const KEY = 'oplen-demo-projects-v1';
  const STATUS = {todo:'Por hacer', doing:'En curso', review:'En revisión', done:'Completada'};
  const PRIORITY = {urgent:'Urgente', high:'Alta', normal:'Normal', low:'Baja'};
  const COLORS = ['green','blue','purple','orange'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const day = (offset=0) => {const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const validDate = d => !d || /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d+'T12:00:00').getTime()) && new Date(d+'T12:00:00').toISOString().slice(0,10)===d;
  const dateLabel = d => d ? new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short'}).format(new Date(d+'T12:00:00')) : 'Sin fecha';
  const initials = name => (name||'Sin asignar').split(/\s+/).slice(0,2).map(n=>n[0]).join('');
  let host, context, snapshot, state, filter={project:'all',search:'',status:'',person:'',priority:'',view:'list'}, dialog, returnFocus;
  const activeTasks = () => state.tasks.filter(t=>!t.archived);
  const person = id => snapshot.people.find(p=>String(p.id)===String(id));
  const project = id => state.projects.find(p=>p.id===id);
  const overdue = t => t.status!=='done' && t.due && t.due<day();
  const ownerLabel = id => person(id)?.name || 'Sin asignar';
  const options = (items,selected) => items.map(([value,label])=>`<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`).join('');
  const peopleOptions = selected => options([['','Sin asignar'],...snapshot.people.filter(p=>p.is_active).map(p=>[String(p.id),p.name+' · '+p.department])], selected);
  const button = (action,label,extra='',kind='secondary') => `<button type="button" class="button ${kind}" data-pw-action="${action}" ${extra}>${label}</button>`;
  function seed(){
    const projects=[
      {id:'launch',name:'Lanzamiento de nueva experiencia',description:'Coordinar producto, comunicación y soporte para una entrega compartida.',color:'green',owner:21,due:day(14)},
      {id:'onboarding',name:'Onboarding del equipo',description:'Que cada persona tenga sus accesos, contexto y primer acompañamiento.',color:'purple',owner:61,due:day(21)},
      {id:'service',name:'Mejora de atención',description:'Reducir los pendientes y documentar los criterios de respuesta.',color:'blue',owner:31,due:day(10)}
    ];
    const specs=[
      ['launch','Definir el alcance del lanzamiento','done',71,-3,'high',22],
      ['launch','Preparar piezas de comunicación','doing',22,2,'high',7],
      ['launch','Validar el flujo de registro','review',82,1,'urgent',25],
      ['launch','Documentar las preguntas frecuentes','doing',32,-1,'high',10],
      ['launch','Coordinar la publicación','todo',21,7,'normal',7],
      ['onboarding','Preparar accesos de nuevos ingresos','done',81,-2,'high',25],
      ['onboarding','Actualizar la guía de bienvenida','doing',62,3,'normal',19],
      ['onboarding','Agendar la primera conversación','todo',61,5,'normal',20],
      ['onboarding','Revisar el plan de la primera semana','review',12,4,'low',1],
      ['service','Revisar solicitudes pendientes','doing',32,-2,'urgent',10],
      ['service','Acordar criterios de escalamiento','todo',31,4,'high',11],
      ['service','Publicar guía de respuestas','todo',35,8,'normal',12]
    ];
    return {version:1,revision:0,projects,tasks:specs.map((s,i)=>({id:'task-'+(i+1),project:s[0],title:s[1],status:s[2],owner:s[3],due:day(s[4]),priority:s[5],activity:s[6],description:'Ejemplo de Horizonte. Define el resultado esperado, reúne el contexto y confirma la entrega con las áreas involucradas.',checklist:[{id:uid(),title:'Confirmar alcance y responsable',done:s[2]!=='todo'},{id:uid(),title:'Documentar el resultado',done:s[2]==='done'}],comments:i===1?[{id:uid(),author:'Ana Torres',body:'Revisemos las piezas antes de publicarlas.',at:now()}]:[],history:[{body:'Tarea de ejemplo creada',at:now()}],archived:false,createdAt:now(),updatedAt:now()}))};
  }
  function read(){
    const raw=localStorage.getItem(KEY);
    if(!raw)return null;
    const result=JSON.parse(raw);
    if(result.version!==1||!Array.isArray(result.projects)||!Array.isArray(result.tasks)||!Number.isInteger(result.revision))throw new Error('No pudimos leer los proyectos guardados. No se han reemplazado tus datos.');
    return result;
  }
  function load(){state=read();if(!state){state=seed();localStorage.setItem(KEY,JSON.stringify(state));}}
  function notify(message,error=false){
    document.querySelector('.pw-toast')?.remove();
    const node=document.createElement('div');node.className='pw-toast'+(error?' pw-error':'');node.setAttribute('role',error?'alert':'status');node.textContent=message;document.body.append(node);setTimeout(()=>node.remove(),5500);
  }
  function commit(change){
    if(context.readOnly)throw new Error('Esta vista es de consulta. Vuelve a tu espacio para hacer cambios.');
    const latest=read();
    if(!latest || latest.revision!==state.revision)throw new Error('Los datos cambiaron en otra pestaña. Cierra este formulario y recarga para usar la versión actual.');
    const next=structuredClone(state);change(next);next.revision++;localStorage.setItem(KEY,JSON.stringify(next));state=next;
  }
  function log(task,body){task.updatedAt=now();task.history.unshift({body,at:now()});task.history=task.history.slice(0,30);}
  function filtered(){
    const query=filter.search.trim().toLocaleLowerCase();
    return state.tasks.filter(t=>Boolean(t.archived)===(filter.project==='archive'))
      .filter(t=>['all','archive'].includes(filter.project)||(filter.project==='mine'?String(t.owner)===String(context.user.id):t.project===filter.project))
      .filter(t=>(!filter.status||t.status===filter.status)&&(!filter.person||(filter.person==='none'?!t.owner:String(t.owner)===filter.person))&&(!filter.priority||t.priority===filter.priority))
      .filter(t=>!query||[t.title,t.description,project(t.project)?.name,ownerLabel(t.owner)].join(' ').toLocaleLowerCase().includes(query))
      .sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.title.localeCompare(b.title));
  }
  function avatar(id){return `<span class="pw-person" title="${esc(ownerLabel(id))}"><span class="pw-avatar" aria-hidden="true">${esc(id?initials(ownerLabel(id)):'—')}</span><span>${esc(ownerLabel(id))}</span></span>`;}
  function pill(priority){return `<span class="pw-priority pw-${esc(priority)}"><i aria-hidden="true"></i>${esc(PRIORITY[priority])}</span>`;}
  function taskStatus(task){return `<select class="pw-status-select pw-${task.status}" data-pw-status="${task.id}" aria-label="Estado de ${esc(task.title)}" ${context.readOnly||task.archived?'disabled':''}>${options(Object.entries(STATUS),task.status)}</select>`;}
  function progress(p){const tasks=activeTasks().filter(t=>t.project===p.id),done=tasks.filter(t=>t.status==='done').length;return {total:tasks.length,done,percent:tasks.length?Math.round(done/tasks.length*100):0};}
  function render(){
    if(!host?.isConnected)return;
    const tasks=activeTasks(),open=tasks.filter(t=>t.status!=='done'),done=tasks.length-open.length;
    const p=project(filter.project),title=p?.name||({all:'Todas las tareas',mine:'Mis tareas',archive:'Archivo'}[filter.project]);
    host.innerHTML=`<div class="pw-app">
      <header class="pw-head"><div><p class="eyebrow">DEL PLAN A LA ACCIÓN</p><h1>Proyectos y tareas</h1><p>El trabajo del equipo, conectado con quienes lo hacen.</p></div><span class="pw-demo">${context.readOnly?'Vista de consulta':'Demo · Guardado en este navegador'}</span></header>
      <section class="pw-metrics" aria-label="Resumen de trabajo"><div><span>Proyectos</span><strong>${state.projects.length}</strong></div><div><span>Tareas abiertas</span><strong>${open.length}</strong></div><div><span>Completadas</span><strong>${done}<small> / ${tasks.length}</small></strong></div><div class="${open.some(overdue)?'pw-late':''}"><span>Vencidas</span><strong>${open.filter(overdue).length}</strong></div></section>
      <div class="pw-layout"><aside class="pw-sidebar" aria-label="Proyectos"><div class="pw-side-label">ESPACIO DE TRABAJO</div>${[['all','Todas las tareas',tasks.length],['mine','Mis tareas',tasks.filter(t=>String(t.owner)===String(context.user.id)).length]].map(([id,label,count])=>`<button class="pw-side-item ${filter.project===id?'selected':''}" data-pw-project="${id}" aria-pressed="${filter.project===id}"><span>${label}</span><small>${count}</small></button>`).join('')}<div class="pw-side-label pw-side-heading"><span>PROYECTOS</span>${context.readOnly?'':button('new-project','+','aria-label="Nuevo proyecto"','pw-icon')}</div>${state.projects.map(pr=>{const n=progress(pr);return `<button class="pw-project-item ${filter.project===pr.id?'selected':''}" data-pw-project="${pr.id}" aria-pressed="${filter.project===pr.id}"><span class="pw-project-title"><i class="pw-dot pw-color-${pr.color}"></i>${esc(pr.name)}</span><span class="pw-project-meta">${n.done} de ${n.total} tareas <b>${n.percent}%</b></span><span class="pw-progress"><i style="width:${n.percent}%"></i></span></button>`}).join('')}<button class="pw-side-item pw-archive-link ${filter.project==='archive'?'selected':''}" data-pw-project="archive"><span>Archivo</span><small>${state.tasks.filter(t=>t.archived).length}</small></button></aside>
      <section class="pw-work"><header class="pw-work-head"><div><h2>${esc(title)}</h2><p>${esc(p?.description||(filter.project==='mine'?'Tareas asignadas a '+context.user.name+'.':filter.project==='archive'?'Las tareas archivadas se pueden restaurar.':'Prioriza, asigna y da seguimiento desde un solo lugar.'))}</p>${p?`<span class="pw-project-caption">Responsable: ${esc(ownerLabel(p.owner))} · Fecha objetivo: ${dateLabel(p.due)}</span>`:''}</div><div class="pw-actions">${p&&!context.readOnly?button('edit-project','Editar proyecto'):''}${!context.readOnly&&filter.project!=='archive'?button('new-task','+ Nueva tarea','','primary'):''}</div></header>
      <div class="pw-toolbar"><div class="pw-view-switch" role="group" aria-label="Vista de tareas">${[['list','Lista'],['board','Tablero']].map(([v,l])=>`<button data-pw-view="${v}" aria-pressed="${filter.view===v}" class="${filter.view===v?'selected':''}">${l}</button>`).join('')}</div><label class="pw-search"><span class="pw-sr">Buscar tareas</span><input type="search" id="pw-search" placeholder="Buscar tareas…" value="${esc(filter.search)}"></label></div>
      <div class="pw-filters"><label><span>Estado</span><select data-pw-filter="status">${options([['','Todos los estados'],...Object.entries(STATUS)],filter.status)}</select></label><label><span>Responsable</span><select data-pw-filter="person">${options([['','Todo el equipo'],['none','Sin asignar'],...snapshot.people.filter(p=>p.is_active).map(p=>[String(p.id),p.name])],filter.person)}</select></label><label><span>Prioridad</span><select data-pw-filter="priority">${options([['','Todas las prioridades'],...Object.entries(PRIORITY)],filter.priority)}</select></label><span id="pw-count"></span>${button('clear-filters','Limpiar filtros','','pw-text')}</div>
      <div id="pw-results"></div></section></div><p class="pw-footnote">Datos ficticios de Horizonte. Los cambios no se comparten con otros usuarios ni dispositivos.</p></div>`;
    bind();renderResults();
  }
  function renderResults(){
    const root=host.querySelector('#pw-results');if(!root)return;
    const rows=filtered();host.querySelector('#pw-count').textContent=`${rows.length} ${rows.length===1?'tarea':'tareas'}`;
    if(!rows.length && (filter.view==='list'||filter.search||filter.status||filter.person||filter.priority||filter.project==='archive')){
      root.innerHTML=`<div class="pw-empty"><span class="pw-empty-icon" aria-hidden="true">✓</span><h3>${filter.project==='mine'?'No tienes tareas en esta vista':'No hay tareas en esta vista'}</h3><p>Cambia los filtros${filter.project==='archive'?' o archiva una tarea para verla aquí.':' o crea una tarea para empezar.'}</p>${button('clear-filters','Limpiar filtros')}${!context.readOnly&&filter.project!=='archive'?button('new-task','Nueva tarea','','primary'):''}</div>`;return;
    }
    if(filter.view==='board'){
      root.innerHTML=`<div class="pw-board" aria-label="Tablero de tareas">${Object.entries(STATUS).map(([status,label])=>{const items=rows.filter(t=>t.status===status);return `<section class="pw-column" data-pw-drop="${status}" aria-label="${label}"><header><span><i class="pw-status-dot pw-${status}"></i>${label}</span><small>${items.length}</small></header><div class="pw-column-tasks">${items.map(t=>`<article class="pw-task-card" data-pw-drag="${t.id}" draggable="${!context.readOnly&&!t.archived}"><div class="pw-card-top"><span class="pw-project-tag">${esc(project(t.project)?.name)}</span>${pill(t.priority)}</div><button class="pw-task-title" data-pw-open="${t.id}">${esc(t.title)}</button><div class="pw-card-person">${avatar(t.owner)}</div><div class="pw-card-meta"><span class="${overdue(t)?'pw-late':''}">${dateLabel(t.due)}${overdue(t)?' · Vencida':''}</span><span>${t.checklist.filter(i=>i.done).length}/${t.checklist.length} subtareas</span></div>${taskStatus(t)}</article>`).join('')||'<p class="pw-column-empty">Sin tareas</p>'}</div>${!context.readOnly&&filter.project!=='archive'?button('new-task','+ Añadir tarea',`data-pw-new-status="${status}"`,'pw-text'):''}</section>`}).join('')}</div><p class="pw-board-hint">Arrastra una tarjeta para cambiar su estado o usa su selector.</p>`;
    }else{
      root.innerHTML=`<div class="pw-table-wrap"><table class="pw-table"><thead><tr><th>Tarea</th><th>Estado</th><th>Responsable</th><th>Prioridad</th><th>Fecha límite</th><th><span class="pw-sr">Acciones</span></th></tr></thead><tbody>${rows.map(t=>`<tr><td><button class="pw-task-title" data-pw-open="${t.id}">${esc(t.title)}</button><span class="pw-task-subtitle">${esc(project(t.project)?.name)} · ${t.checklist.filter(i=>i.done).length}/${t.checklist.length} subtareas</span></td><td>${taskStatus(t)}</td><td>${avatar(t.owner)}</td><td>${pill(t.priority)}</td><td><span class="pw-due ${overdue(t)?'pw-late':''}">${dateLabel(t.due)}${overdue(t)?'<small>Vencida</small>':''}</span></td><td>${t.archived&&!context.readOnly?button('restore','Restaurar',`data-pw-id="${t.id}"`,'pw-text'):`<button class="pw-open-icon" data-pw-open="${t.id}" aria-label="Abrir ${esc(t.title)}">↗</button>`}</td></tr>`).join('')}</tbody></table></div>`;
    }
  }
  function changeStatus(id,status){
    try{if(!STATUS[status])throw new Error('Selecciona un estado válido.');commit(next=>{const t=next.tasks.find(t=>t.id===id);if(!t||t.archived)throw new Error('Esta tarea ya no está activa.');if(t.status!==status){t.status=status;log(t,'Estado cambiado a '+STATUS[status]);}});render();notify('Estado actualizado.');}catch(e){notify(e.message,true);renderResults();}
  }
  function bind(){
    host.onclick=e=>{
      const el=e.target.closest('button');if(!el||!host.contains(el))return;
      if(el.dataset.pwProject){filter.project=el.dataset.pwProject;render();return;}
      if(el.dataset.pwView){filter.view=el.dataset.pwView;render();return;}
      if(el.dataset.pwOpen){openTask(el.dataset.pwOpen);return;}
      switch(el.dataset.pwAction){
        case 'new-project':openProject();break;
        case 'edit-project':openProject(filter.project);break;
        case 'new-task':openTask(null,el.dataset.pwNewStatus);break;
        case 'clear-filters':Object.assign(filter,{search:'',status:'',person:'',priority:''});render();break;
        case 'restore':try{commit(next=>{const t=next.tasks.find(t=>t.id===el.dataset.pwId);t.archived=false;log(t,'Tarea restaurada');});render();notify('Tarea restaurada.');}catch(e){notify(e.message,true);}break;
      }
    };
    host.oninput=e=>{if(e.target.id==='pw-search'){filter.search=e.target.value;renderResults();}};
    host.onchange=e=>{if(e.target.dataset.pwFilter){filter[e.target.dataset.pwFilter]=e.target.value;renderResults();}if(e.target.dataset.pwStatus)changeStatus(e.target.dataset.pwStatus,e.target.value);};
    host.ondragstart=e=>{const card=e.target.closest('[data-pw-drag]');if(!card||context.readOnly)return;e.dataTransfer.setData('text/plain',card.dataset.pwDrag);e.dataTransfer.effectAllowed='move';};
    host.ondragover=e=>{const column=e.target.closest('[data-pw-drop]');if(column&&!context.readOnly&&filter.project!=='archive'){e.preventDefault();e.dataTransfer.dropEffect='move';column.classList.add('pw-drag-over');}};
    host.ondragleave=e=>{const c=e.target.closest('[data-pw-drop]');if(c&&!c.contains(e.relatedTarget))c.classList.remove('pw-drag-over');};
    host.ondrop=e=>{const c=e.target.closest('[data-pw-drop]');if(!c)return;e.preventDefault();c.classList.remove('pw-drag-over');const id=e.dataTransfer.getData('text/plain');if(state.tasks.some(t=>t.id===id))changeStatus(id,c.dataset.pwDrop);};
  }
  function closeDialog(){if(dialog){dialog.close();dialog.remove();dialog=null;}returnFocus?.isConnected&&returnFocus.focus();}
  function modal(title,body,wide=false){
    closeDialog();returnFocus=document.activeElement;
    dialog=document.createElement('dialog');dialog.className='pw-dialog'+(wide?' pw-task-dialog':'');dialog.setAttribute('aria-labelledby','pw-dialog-title');
    dialog.innerHTML=`<header class="pw-dialog-head"><div><p class="eyebrow">HORIZONTE · PROYECTOS</p><h2 id="pw-dialog-title">${esc(title)}</h2></div>${button('close','×','aria-label="Cerrar formulario"','pw-icon')}</header>${body}`;
    document.body.append(dialog);dialog.querySelector('[data-pw-action="close"]').onclick=closeDialog;
    dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
    dialog.showModal();return dialog;
  }
  function errorForm(form,message){const node=form.querySelector('[data-pw-error]');node.textContent=message;node.hidden=false;}
  function openProject(id){
    if(context.readOnly)return;
    const existing=project(id),p=existing||{name:'',description:'',owner:'',due:'',color:'green'};
    const d=modal(existing?'Editar proyecto':'Nuevo proyecto',`<form id="pw-project-form" class="pw-form"><label class="field"><span>Nombre del proyecto</span><input name="name" required maxlength="100" value="${esc(p.name)}" placeholder="Ej. Lanzamiento de nueva experiencia"></label><label class="field"><span>Objetivo</span><textarea name="description" maxlength="2000" rows="3" placeholder="¿Qué queremos lograr?">${esc(p.description)}</textarea></label><div class="pw-form-grid"><label class="field"><span>Responsable del proyecto</span><select name="owner">${peopleOptions(p.owner)}</select></label><label class="field"><span>Fecha objetivo</span><input name="due" type="date" value="${esc(p.due)}"></label></div><label class="field"><span>Color</span><select name="color">${options([['green','Verde'],['blue','Azul'],['purple','Violeta'],['orange','Naranja']],p.color)}</select></label><p data-pw-error class="pw-form-error" role="alert" hidden></p><footer class="pw-dialog-actions">${button('cancel','Cancelar')}<button class="button primary" type="submit">${existing?'Guardar proyecto':'Crear proyecto'}</button></footer></form>`);
    d.querySelector('[data-pw-action="cancel"]').onclick=closeDialog;
    d.querySelector('form').onsubmit=e=>{e.preventDefault();const form=e.currentTarget,v=Object.fromEntries(new FormData(form));try{v.name=v.name.trim();if(!v.name)throw new Error('Escribe un nombre para el proyecto.');if(!validDate(v.due))throw new Error('La fecha no es válida.');if(!COLORS.includes(v.color)||v.owner&&!person(v.owner))throw new Error('Revisa el color y responsable.');const target=id||uid();commit(next=>{if(next.projects.some(p=>p.id!==id&&p.name.toLocaleLowerCase()===v.name.toLocaleLowerCase()))throw new Error('Ya existe un proyecto con ese nombre.');const item={...v,id:target,owner:v.owner?Number(v.owner):null};if(existing)Object.assign(next.projects.find(p=>p.id===id),item);else next.projects.push(item);});filter.project=target;closeDialog();render();notify(existing?'Proyecto actualizado.':'Proyecto creado.');}catch(err){errorForm(form,err.message);}};
  }
  function openTask(id,status='todo'){
    const existing=state.tasks.find(t=>t.id===id);
    if(!existing&&context.readOnly)return;
    const task=structuredClone(existing||{title:'',description:'',project:project(filter.project)?.id||state.projects[0]?.id,owner:filter.project==='mine'?context.user.id:'',due:'',priority:'normal',status:STATUS[status]?status:'todo',activity:'',checklist:[],comments:[],history:[]});
    const locked=context.readOnly||task.archived;
    const d=modal(existing?'Detalle de tarea':'Nueva tarea',`<form id="pw-task-form" class="pw-form"><fieldset ${locked?'disabled':''}><label class="field"><span>Nombre de la tarea</span><input name="title" required maxlength="180" value="${esc(task.title)}" placeholder="¿Qué hay que hacer?"></label><label class="field"><span>Descripción y resultado esperado</span><textarea name="description" rows="3" maxlength="5000" placeholder="Agrega contexto, criterios y entregable…">${esc(task.description)}</textarea></label><div class="pw-form-grid"><label class="field"><span>Proyecto</span><select name="project" required>${options(state.projects.map(p=>[p.id,p.name]),task.project)}</select></label><label class="field"><span>Responsable</span><select name="owner">${peopleOptions(task.owner)}</select></label><label class="field"><span>Estado</span><select name="status">${options(Object.entries(STATUS),task.status)}</select></label><label class="field"><span>Prioridad</span><select name="priority">${options(Object.entries(PRIORITY),task.priority)}</select></label><label class="field"><span>Fecha límite</span><input name="due" type="date" value="${esc(task.due)}"></label><label class="field"><span>Actividad relacionada</span><select name="activity">${options([['','Sin vincular'],...(snapshot.processes||[]).map(p=>[String(p.id),p.title+' · '+p.department_name])],task.activity)}</select></label></div><section class="pw-subtasks"><h3>Subtareas <span id="pw-check-count"></span></h3><div id="pw-checklist"></div><div class="pw-add-line"><input id="pw-new-check" aria-label="Nueva subtarea" maxlength="200" placeholder="Añadir una subtarea…">${button('add-check','Añadir')}</div></section></fieldset>${existing?`<section class="pw-comments"><h3>Comentarios <span>${task.comments.length}</span></h3><div class="pw-comment-list">${task.comments.map(c=>`<article><header><b>${esc(c.author)}</b><time>${dateLabel(c.at.slice(0,10))}</time></header><p>${esc(c.body)}</p></article>`).join('')||'<p class="pw-muted">Todavía no hay comentarios.</p>'}</div>${!locked?'<label class="field"><span>Nuevo comentario</span><textarea name="comment" rows="2" maxlength="2000" placeholder="Comparte un avance o una duda…"></textarea></label>':''}</section><details class="pw-history"><summary>Historial de la tarea</summary>${task.history.slice(0,12).map(h=>`<p><span>${esc(h.body)}</span><time>${dateLabel(h.at.slice(0,10))}</time></p>`).join('')}</details>`:''}<p data-pw-error class="pw-form-error" role="alert" hidden></p><footer class="pw-dialog-actions">${existing&&!locked?button('archive-task','Archivar','','pw-danger'):''}${button('cancel',locked?'Cerrar':'Cancelar')}${!locked?`<button class="button primary" type="submit">${existing?'Guardar cambios':'Crear tarea'}</button>`:''}</footer></form>`,true);
    const form=d.querySelector('form');
    function checks(){d.querySelector('#pw-check-count').textContent=`${task.checklist.filter(i=>i.done).length}/${task.checklist.length}`;d.querySelector('#pw-checklist').innerHTML=task.checklist.map(c=>`<div class="pw-check-row"><label><input type="checkbox" data-pw-check="${c.id}" ${c.done?'checked':''}><span class="${c.done?'completed':''}">${esc(c.title)}</span></label>${!locked?`<button type="button" class="pw-remove-check" data-pw-remove="${c.id}" aria-label="Quitar subtarea ${esc(c.title)}">×</button>`:''}</div>`).join('')||'<p class="pw-muted">Divide el trabajo en pasos pequeños.</p>';}
    checks();
    const addCheck=()=>{if(locked)return;const input=d.querySelector('#pw-new-check'),title=input.value.trim();if(title){task.checklist.push({id:uid(),title,done:false});input.value='';checks();input.focus();}};
    d.querySelector('[data-pw-action="add-check"]').onclick=addCheck;
    d.querySelector('#pw-new-check').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addCheck();}};
    d.querySelector('#pw-checklist').onchange=e=>{const item=task.checklist.find(c=>c.id===e.target.dataset.pwCheck);if(item&&!locked){item.done=e.target.checked;checks();}};
    d.querySelector('#pw-checklist').onclick=e=>{const b=e.target.closest('[data-pw-remove]');if(b&&!locked){task.checklist=task.checklist.filter(c=>c.id!==b.dataset.pwRemove);checks();}};
    d.querySelector('[data-pw-action="cancel"]').onclick=closeDialog;
    d.querySelector('[data-pw-action="archive-task"]')?.addEventListener('click',()=>{try{commit(next=>{const t=next.tasks.find(t=>t.id===id);t.archived=true;log(t,'Tarea archivada');});closeDialog();render();notify('Tarea archivada. Puedes restaurarla desde Archivo.');}catch(err){errorForm(form,err.message);}});
    form.onsubmit=e=>{e.preventDefault();if(locked)return;const v=Object.fromEntries(new FormData(form));try{v.title=v.title.trim();if(!v.title)throw new Error('Escribe un nombre para la tarea.');if(!STATUS[v.status]||!PRIORITY[v.priority]||!project(v.project))throw new Error('Revisa el estado, prioridad y proyecto.');if(!validDate(v.due))throw new Error('La fecha no es válida.');if(v.owner&&!person(v.owner))throw new Error('Selecciona un responsable del equipo.');if(v.activity&&!snapshot.processes.some(p=>String(p.id)===v.activity))throw new Error('Selecciona una actividad válida.');commit(next=>{const item={title:v.title,description:v.description.trim(),project:v.project,owner:v.owner?Number(v.owner):null,status:v.status,priority:v.priority,due:v.due,activity:v.activity?Number(v.activity):null,checklist:task.checklist};let t=next.tasks.find(t=>t.id===id);if(!t){t={id:uid(),comments:[],history:[],createdAt:now(),archived:false};next.tasks.push(t);}const oldStatus=t.status;Object.assign(t,item);log(t,existing?'Tarea actualizada':'Tarea creada');if(oldStatus&&oldStatus!==t.status)log(t,'Estado cambiado a '+STATUS[t.status]);if(v.comment?.trim()){t.comments.push({id:uid(),author:context.user.name,body:v.comment.trim(),at:now()});log(t,'Comentario de '+context.user.name);}});closeDialog();render();notify(existing?'Cambios guardados.':'Tarea creada.');}catch(err){errorForm(form,err.message);}};
  }
  window.addEventListener('storage',e=>{if(e.key!==KEY)return;if(dialog){notify('Hay cambios en otra pestaña. Tu formulario sigue abierto; recarga antes de guardar.',true);return;}try{if(host?.isConnected){state=read();if(state)render();else host.innerHTML='<p role="status">La demo se restableció en otra pestaña. Recarga para continuar.</p>';}}catch(err){notify(err.message,true);}});
  window.addEventListener('hashchange',closeDialog);
  window.OplenProjects={mount(root,opts){closeDialog();host=root;context=opts;snapshot=window.OplenDemo.snapshot();try{load();render();}catch(err){host.innerHTML=`<section class="pw-app pw-empty"><h1>No pudimos abrir los proyectos</h1><p role="alert">${esc(err.message)}</p><p>Comprueba que tu navegador permita guardar datos y vuelve a cargar la página.</p></section>`;}},version:'0.1.0'};
})();
