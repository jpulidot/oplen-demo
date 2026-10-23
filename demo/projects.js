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
  let host, context, snapshot, state, filter={project:'all',search:'',status:'',person:'',priority:'',department:'',due:'',view:'summary'}, dialog, returnFocus;
  const collapsed=new Set();
  const activeTasks = () => state.tasks.filter(t=>!t.archived);
  const person = id => snapshot.people.find(p=>String(p.id)===String(id));
  const project = id => state.projects.find(p=>p.id===id);
  const initiative = id => state.initiatives.find(p=>p.id===id);
  const allowed = permission => context.user.role==='admin'||(context.user.permissions||[]).includes(permission);
  const activity = id => allowed('departments')?(snapshot.processes||[]).find(p=>String(p.id)===String(id)&&p.status==='published'):null;
  const activities = () => allowed('departments')?(snapshot.processes||[]).filter(p=>p.status==='published'):[];
  const parentProject = p => p?.parentId?project(p.parentId):null;
  const initiativeFor = p => initiative((parentProject(p)||p)?.initiativeId);
  const children = id => state.projects.filter(p=>p.parentId===id);
  const projectPath = id => {const p=project(id);return p?[initiativeFor(p)?.name,parentProject(p)?.name,p.name].filter(Boolean).join(' / '):'Proyecto no disponible';};
  const departmentFor = t => person(t.owner)?.department||activity(t.activity)?.department_name||'';
  function inScope(t,scope=filter.project){
    if(['all','archive'].includes(scope))return true;
    if(scope==='mine')return String(t.owner)===String(context.user.id)||t.checklist.some(c=>!c.done&&String(c.owner)===String(context.user.id));
    if(scope.startsWith('initiative:'))return initiativeFor(project(t.project))?.id===scope.slice(11);
    return t.project===scope||parentProject(project(t.project))?.id===scope;
  }
  const scopeTasks = scope => activeTasks().filter(t=>inScope(t,scope));
  const statistics = rows => {const done=rows.filter(t=>t.status==='done').length;return {total:rows.length,done,open:rows.length-done,late:rows.filter(overdue).length,percent:rows.length?Math.round(done/rows.length*100):0};};
  function documentsFor(p){
    if(!allowed('knowledge'))return [];
    return (snapshot.docs||[]).filter(d=>(p?.documents||[]).some(id=>String(typeof id==='object'?id.id:id)===String(d.id))&&d.status==='published'&&(d.visibility==='company'||Number(d.author_id)===Number(context.user.id)||context.user.role==='admin'));
  }
  const overdue = t => t.status!=='done' && t.due && t.due<day();
  const ownerLabel = id => person(id)?.name || 'Sin asignar';
  const options = (items,selected) => items.map(([value,label])=>`<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`).join('');
  const peopleOptions = selected => options([['','Sin asignar'],...snapshot.people.filter(p=>p.is_active||String(p.id)===String(selected)).map(p=>[String(p.id),p.name+' · '+p.department])], selected);
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
    const initiatives=[{id:'customer-experience',name:'Experiencia del cliente',description:'Conectar el lanzamiento con una atención clara y consistente.',owner:1,due:day(30),color:'green'}];
    projects.forEach(p=>Object.assign(p,{parentId:null,initiativeId:p.id==='onboarding'?null:'customer-experience'}));
    projects.push({id:'help-center',name:'Centro de ayuda',description:'Publicar respuestas claras y conectar al equipo con sus procedimientos.',color:'blue',owner:31,due:day(8),parentId:'service',initiativeId:null});
    return {version:2,revision:0,initiatives,projects,tasks:specs.map((s,i)=>({id:'task-'+(i+1),project:i===11?'help-center':s[0],title:s[1],status:s[2],owner:s[3],due:day(s[4]),priority:s[5],activity:s[6],description:'Ejemplo de Horizonte. Define el resultado esperado, reúne el contexto y confirma la entrega con las áreas involucradas.',checklist:[{id:uid(),title:'Confirmar alcance y responsable',done:s[2]!=='todo',status:s[2]!=='todo'?'done':'todo',owner:s[3],due:''},{id:uid(),title:'Documentar el resultado',done:s[2]==='done',status:s[2]==='done'?'done':'todo',owner:null,due:''}],comments:i===1?[{id:uid(),author:'Ana Torres',body:'Revisemos las piezas antes de publicarlas.',at:now()}]:[],history:[{body:'Tarea de ejemplo creada',at:now()}],archived:false,createdAt:now(),updatedAt:now()}))};
  }
  function read(){
    const raw=localStorage.getItem(KEY);
    if(!raw)return null;
    const result=JSON.parse(raw);
    if(![1,2].includes(result.version)||!Array.isArray(result.projects)||!Array.isArray(result.tasks)||!Number.isInteger(result.revision))throw new Error('No pudimos leer los proyectos guardados. No se han reemplazado tus datos.');
    // Upgrade the shape in memory. Existing projects, task ownership and comments stay intact.
    if(result.version===1){result.version=2;result.initiatives=[];result.projects.forEach(p=>{p.parentId=null;p.initiativeId=null;});}
    if(!Array.isArray(result.initiatives))throw new Error('La estructura guardada no es válida. Tus datos se conservan.');
    for(const t of result.tasks){
      if(!Array.isArray(t.checklist)||!Array.isArray(t.comments)||!Array.isArray(t.history))throw new Error('Hay una tarea que no se pudo leer. Tus datos se conservan.');
      for(const c of t.checklist){c.status=STATUS[c.status]?c.status:c.done?'done':'todo';c.done=c.status==='done';c.owner??=null;c.due??='';}
    }
    for(const p of result.projects){
      const parent=result.projects.find(x=>x.id===p.parentId);
      if(p.parentId&&(!parent||parent.id===p.id||parent.parentId)||p.initiativeId&&!result.initiatives.some(i=>i.id===p.initiativeId))throw new Error('La jerarquía guardada necesita revisión. Tus datos se conservan.');
    }
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
      .filter(t=>inScope(t))
      .filter(t=>(!filter.status||t.status===filter.status)&&(!filter.person||(filter.person==='none'?!t.owner:String(t.owner)===filter.person))&&(!filter.priority||t.priority===filter.priority))
      .filter(t=>!filter.department||departmentFor(t)===filter.department)
      .filter(t=>!filter.due||(filter.due==='late'?overdue(t):filter.due==='none'?!t.due:t.status!=='done'&&t.due>=day()&&t.due<=day(7)))
      .filter(t=>!query||[t.title,t.description,projectPath(t.project),ownerLabel(t.owner),activity(t.activity)?.title,...t.checklist.map(c=>c.title)].join(' ').toLocaleLowerCase().includes(query))
      .sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.title.localeCompare(b.title));
  }
  function avatar(id){return `<span class="pw-person" title="${esc(ownerLabel(id))}"><span class="pw-avatar" aria-hidden="true">${esc(id?initials(ownerLabel(id)):'—')}</span><span>${esc(ownerLabel(id))}</span></span>`;}
  function pill(priority){return `<span class="pw-priority pw-${esc(priority)}"><i aria-hidden="true"></i>${esc(PRIORITY[priority])}</span>`;}
  function taskStatus(task){return `<select class="pw-status-select pw-${task.status}" data-pw-status="${task.id}" aria-label="Estado de ${esc(task.title)}" ${context.readOnly||task.archived?'disabled':''}>${options(Object.entries(STATUS),task.status)}</select>`;}
  function progress(p){return statistics(scopeTasks(p.id));}
  function treeRow(p,depth=0){
    const items=children(p.id),n=progress(p),expanded=!collapsed.has(p.id);
    return `<div class="pw-tree-node" style="--pw-depth:${depth}"><div class="pw-tree-row">${items.length?`<button class="pw-tree-toggle" data-pw-toggle="${esc(p.id)}" aria-expanded="${expanded}" aria-label="${expanded?'Contraer':'Expandir'} ${esc(p.name)}">${expanded?'⌄':'›'}</button>`:'<span class="pw-tree-spacer"></span>'}<button class="pw-project-item ${filter.project===p.id?'selected':''}" data-pw-project="${esc(p.id)}" aria-pressed="${filter.project===p.id}"><span class="pw-project-title"><i class="pw-dot pw-color-${esc(p.color)}"></i><span>${esc(p.name)}</span></span><span class="pw-project-meta">${depth?'Subproyecto · ':''}${n.done}/${n.total} tareas <b>${n.percent}%</b></span><span class="pw-progress"><i style="width:${n.percent}%"></i></span></button></div>${expanded?items.map(c=>treeRow(c,depth+1)).join(''):''}</div>`;
  }
  function tree(){
    return state.initiatives.map(i=>{const expanded=!collapsed.has('initiative:'+i.id),rows=state.projects.filter(p=>!p.parentId&&p.initiativeId===i.id),n=statistics(scopeTasks('initiative:'+i.id));return `<div class="pw-initiative"><div class="pw-tree-row"><button class="pw-tree-toggle" data-pw-toggle="initiative:${esc(i.id)}" aria-expanded="${expanded}" aria-label="${expanded?'Contraer':'Expandir'} ${esc(i.name)}">${expanded?'⌄':'›'}</button><button class="pw-initiative-title ${filter.project==='initiative:'+i.id?'selected':''}" data-pw-project="initiative:${esc(i.id)}" aria-pressed="${filter.project==='initiative:'+i.id}"><small>INICIATIVA</small><span>${esc(i.name)}</span><small>${n.percent}% · ${rows.length} proyectos</small></button></div>${expanded?rows.map(p=>treeRow(p)).join('')||'<p class="pw-tree-empty">Añade un proyecto a esta iniciativa.</p>':''}</div>`;}).join('')+state.projects.filter(p=>!p.parentId&&!p.initiativeId).map(p=>treeRow(p)).join('');
  }
  function metrics(rows){const n=statistics(rows);return `<section class="pw-metrics" aria-label="Resumen de trabajo"><div><span>Avance por tareas</span><strong>${n.percent}<small>%</small></strong></div><div><span>Tareas abiertas</span><strong>${n.open}</strong></div><div><span>Completadas</span><strong>${n.done}<small> / ${n.total}</small></strong></div><div class="${n.late?'pw-late':''}"><span>Vencidas</span><strong>${n.late}</strong></div></section>`;}
  function render(){
    if(!host?.isConnected)return;
    snapshot=window.OplenDemo.snapshot();
    if(!['all','mine','archive'].includes(filter.project)&&!project(filter.project)&&!initiative(filter.project.slice(11)))filter.project='all';
    const p=project(filter.project),i=filter.project.startsWith('initiative:')?initiative(filter.project.slice(11)):null;
    const title=p?.name||i?.name||({all:'Vista general',mine:'Mi trabajo',archive:'Archivo'}[filter.project]);
    const canSummary=!['mine','archive'].includes(filter.project);
    if(!canSummary&&filter.view==='summary')filter.view='list';
    const isSummary=filter.view==='summary';
    host.innerHTML=`<div class="pw-app">
      <header class="pw-head"><div><p class="eyebrow">${esc(snapshot.company?.name||'HORIZONTE')} · ESPACIO DE TRABAJO</p><h1>Proyectos</h1><p>Personas, responsabilidades y trabajo en un mismo lugar.</p></div><span class="pw-demo">${context.readOnly?'Vista de consulta':'Demo · Guardado en este navegador'}</span></header>
      <div class="pw-layout"><aside class="pw-sidebar" aria-label="Proyectos"><div class="pw-side-label">MI ESPACIO</div>${[['all','Vista general',state.projects.filter(p=>!p.parentId).length],['mine','Mi trabajo',scopeTasks('mine').filter(t=>t.status!=='done'||t.checklist.some(c=>!c.done&&String(c.owner)===String(context.user.id))).length]].map(([id,label,count])=>`<button class="pw-side-item ${filter.project===id?'selected':''}" data-pw-project="${id}" aria-pressed="${filter.project===id}"><span>${label}</span><small>${count}</small></button>`).join('')}<div class="pw-side-label pw-side-heading"><span>PROYECTOS</span>${context.readOnly?'':button('new-project','+','aria-label="Nuevo proyecto"','pw-icon')}</div><div class="pw-tree">${tree()}</div>${context.readOnly?'':button('new-initiative','+ Nueva iniciativa','','pw-text')}<button class="pw-side-item pw-archive-link ${filter.project==='archive'?'selected':''}" data-pw-project="archive" aria-pressed="${filter.project==='archive'}"><span>Archivo</span><small>${state.tasks.filter(t=>t.archived).length}</small></button></aside>
      <section class="pw-work"><header class="pw-work-head"><div>${p?`<p class="pw-breadcrumb">${esc([initiativeFor(p)?.name,parentProject(p)?.name,p.parentId?'Subproyecto':'Proyecto'].filter(Boolean).join(' / '))}</p>`:i?'<p class="pw-breadcrumb">Iniciativa</p>':''}<h2>${esc(title)}</h2><p>${esc(p?.description||i?.description||(filter.project==='mine'?'Tareas y subtareas asignadas a '+context.user.name+'.':filter.project==='archive'?'Las tareas archivadas se pueden restaurar.':'Sigue los proyectos y encuentra el trabajo que necesita atención.'))}</p></div><div class="pw-actions">${p&&!context.readOnly?button('edit-project','Editar proyecto'):''}${i&&!context.readOnly?button('edit-initiative','Editar iniciativa'):''}${!context.readOnly&&isSummary&&(i||filter.project==='all')?button('new-project','+ Proyecto'):''}${!context.readOnly&&p&&!p.parentId?button('new-subproject','+ Subproyecto'):''}${!context.readOnly&&filter.project!=='archive'?button('new-task','+ Nueva tarea','','primary'):''}</div></header>
      <div class="pw-toolbar"><div class="pw-view-switch" role="group" aria-label="Vista de tareas">${[...(canSummary?[['summary','Resumen']]:[]),['list','Lista'],['board','Tablero']].map(([v,l])=>`<button data-pw-view="${v}" aria-pressed="${filter.view===v}" class="${filter.view===v?'selected':''}">${l}</button>`).join('')}</div>${isSummary?'<span class="pw-view-caption">El avance incluye los subproyectos</span>':`<label class="pw-search"><span class="pw-sr">Buscar tareas</span><input type="search" id="pw-search" placeholder="Buscar tareas, proyectos o actividades…" value="${esc(filter.search)}"></label>`}</div>
      ${isSummary?'':`<div class="pw-filters"><label><span>Estado</span><select data-pw-filter="status">${options([['','Todos los estados'],...Object.entries(STATUS)],filter.status)}</select></label><label><span>Responsable de tarea</span><select data-pw-filter="person">${options([['','Todo el equipo'],['none','Sin asignar'],...snapshot.people.filter(p=>p.is_active).map(p=>[String(p.id),p.name])],filter.person)}</select></label><label><span>Departamento</span><select data-pw-filter="department">${options([['','Todos'],...[...new Set(activeTasks().map(departmentFor).filter(Boolean))].sort().map(n=>[n,n])],filter.department)}</select></label><label><span>Prioridad</span><select data-pw-filter="priority">${options([['','Todas'],...Object.entries(PRIORITY)],filter.priority)}</select></label><label><span>Fecha</span><select data-pw-filter="due">${options([['','Todas'],['late','Vencidas'],['week','Próximos 7 días'],['none','Sin fecha']],filter.due)}</select></label><span id="pw-count"></span>${button('clear-filters','Limpiar filtros','','pw-text')}</div>`}
      <div id="pw-results"></div></section></div><p class="pw-footnote">Datos ficticios de Horizonte. Los cambios se guardan en este navegador.</p></div>`;
    bind();renderResults();
  }
  function projectCard(p){
    const n=progress(p),depts=[...new Set(scopeTasks(p.id).map(departmentFor).filter(Boolean))];
    return `<article class="pw-project-card"><div class="pw-card-top"><span class="pw-overline">${esc(p.parentId?'SUBPROYECTO':initiativeFor(p)?.name||'PROYECTO INDEPENDIENTE')}</span><span class="pw-health ${n.late?'pw-late':''}">${n.late?n.late+' vencidas':n.total&&n.done===n.total?'Completado':n.total?'En marcha':'Sin tareas'}</span></div><button class="pw-card-heading" data-pw-project="${esc(p.id)}"><i class="pw-dot pw-color-${esc(p.color)}"></i>${esc(p.name)}</button><p>${esc(p.description||'Agrega un objetivo para dar contexto al equipo.')}</p><div class="pw-card-person">${avatar(p.owner)}<span class="pw-muted">${dateLabel(p.due)}</span></div><div class="pw-project-meta"><span>${n.done} de ${n.total} tareas</span><b>${n.percent}%</b></div><span class="pw-progress"><i style="width:${n.percent}%"></i></span><div class="pw-project-card-foot"><span>${esc(depts.join(' · ')||'Equipo por asignar')}</span>${button('view-project-work','Ver trabajo →',`data-pw-target="${esc(p.id)}"`,'pw-text')}</div></article>`;
  }
  function personContext(id){
    const p=person(id);
    return p?`<div class="pw-owner-context">${avatar(id)}<p>${esc(p.job_title)} · ${esc(p.department)}</p>${p.manager_name?`<small>Líder: ${esc(p.manager_name)}</small>`:''}</div>`:'<p class="pw-muted">Asigna una persona para conectar el trabajo con su puesto y departamento.</p>';
  }
  function documentCards(a){
    if(!allowed('knowledge'))return '<p class="pw-muted">Documentación no disponible con tus permisos actuales.</p>';
    const docs=documentsFor(a);
    return docs.map(d=>`<details class="pw-document" data-pw-document="${Number(d.id)}"><summary>${esc(d.title)}<span>Leer guía</span></summary><div class="pw-document-body">${documentBody(d)}</div></details>`).join('')||'<p class="pw-muted">Esta actividad todavía no tiene documentos publicados disponibles.</p>';
  }
  function documentBody(d){
    // Render published text as escaped text; rich block documents open in the existing reader.
    const route=location.hash.startsWith('#/administracion/')?'#/administracion/documentacion':'#/documentacion';
    if(!d.body||d.blocks_json)return `<p>${esc(d.excerpt||'Consulta este documento en Documentación.')}</p><a class="pw-doc-link" href="${route}?pagina=${Number(d.id)}" target="_blank" rel="noopener">Abrir documento ↗</a>`;
    return d.body.split(/\n\s*\n/).map(block=>{const heading=block.match(/^(#{1,3}) (.+)$/);return heading?`<h4>${esc(heading[2])}</h4>`:`<p>${esc(block)}</p>`;}).join('');
  }
  function operationContext(id,full=false){
    const a=activity(id);
    if(!allowed('departments'))return '<p class="pw-muted">Operación no disponible con tus permisos actuales.</p>';
    if(!a)return '<p class="pw-muted">Vincula una actividad para consultar su alcance, criterios y documentación.</p>';
    return `<div class="pw-operation-context" data-pw-operation="${Number(a.id)}"><span class="pw-overline">${esc(a.department_name)} · RESPONSABILIDAD CONTINUA</span><h4>${esc(a.title)}</h4><p>${esc(a.purpose)}</p><p class="pw-muted">${esc(a.responsible_position_name)} · ${esc(a.responsible_user_name)}</p><details ${full?'open':''}><summary>Alcance y criterios</summary><dl>${[['Incluye',a.scope_in],['Fuera de alcance',a.scope_out],['Autoridad',a.authority],['Cuándo escalar',a.escalation],['Escalar a',a.escalation_position_name]].filter(([,v])=>v).map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details><div class="pw-linked-documents"><h4>Documentación relacionada</h4>${documentCards(a)}</div></div>`;
  }
  function renderSummary(){
    const rows=scopeTasks(filter.project),p=project(filter.project),i=filter.project.startsWith('initiative:')?initiative(filter.project.slice(11)):null;
    const projects=p?children(p.id):state.projects.filter(pr=>!pr.parentId&&(!i||pr.initiativeId===i.id));
    const pending=rows.filter(t=>t.status!=='done').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,5);
    const members=[...new Set([p?.owner||i?.owner,...rows.flatMap(t=>[t.owner,...t.checklist.map(c=>c.owner)])].filter(Boolean).map(String))];
    const depts=[...new Set(members.map(id=>person(id)?.department).filter(Boolean))];
    const operations=[...new Set(rows.map(t=>t.activity).filter(Boolean))].map(activity).filter(Boolean);
    host.querySelector('#pw-results').innerHTML=`${metrics(rows)}${projects.length?`<section class="pw-portfolio"><h3>${p?'Subproyectos':'Proyectos del espacio'}</h3><div class="pw-portfolio-grid">${projects.map(projectCard).join('')}</div></section>`:''}<div class="pw-summary-grid"><section class="pw-summary-panel"><header><div><span class="pw-overline">PRÓXIMOS PASOS</span><h3>Trabajo por atender</h3></div><button data-pw-view="list" class="button pw-text">Ver todas las tareas →</button></header>${pending.map(t=>`<div class="pw-next-task"><div><button class="pw-task-title" data-pw-open="${esc(t.id)}">${esc(t.title)}</button><span class="pw-task-subtitle">${esc(projectPath(t.project))} · ${esc(ownerLabel(t.owner))}</span></div><span class="pw-due ${overdue(t)?'pw-late':''}">${dateLabel(t.due)}${overdue(t)?'<small>Vencida</small>':''}</span></div>`).join('')||'<p class="pw-muted">No hay tareas pendientes. Puedes añadir la siguiente entrega.</p>'}</section><section class="pw-summary-panel"><span class="pw-overline">PERSONAS Y CONTEXTO</span><h3>${p||i?'Responsable':'Equipo involucrado'}</h3>${p||i?personContext((p||i).owner):`<strong class="pw-team-count">${members.length} personas</strong>`}${(p||i)?.due?`<p class="pw-muted">Fecha objetivo: ${dateLabel((p||i).due)}</p>`:''}<p class="pw-muted">${esc(depts.join(' · ')||'Los departamentos aparecerán al asignar trabajo.')}</p>${members.length?`<details class="pw-team-list"><summary>${members.length} personas participan</summary>${members.map(id=>`<p>${esc(ownerLabel(id))}<small>${esc(person(id)?.job_title||'')}</small></p>`).join('')}</details>`:''}</section></div>${p||i?`<section class="pw-summary-panel pw-project-context"><span class="pw-overline">CONECTADO CON OPLEN</span><h3>Actividades y documentación</h3><p class="pw-muted">Las tareas se vinculan a responsabilidades del equipo. Aquí encuentras sus criterios y guías.</p>${operations.map(a=>`<details class="pw-activity-detail"><summary>${esc(a.title)}<span>${esc(a.department_name)}</span></summary>${operationContext(a.id)}</details>`).join('')||'<p class="pw-muted">Vincula una actividad desde el detalle de una tarea para ver su contexto aquí.</p>'}</section>`:''}`;
  }
  function renderResults(){
    const root=host.querySelector('#pw-results');if(!root)return;
    if(filter.view==='summary'){renderSummary();return;}
    const rows=filtered();host.querySelector('#pw-count').textContent=`${rows.length} ${rows.length===1?'tarea':'tareas'}`;
    if(!rows.length && (filter.view==='list'||filter.search||filter.status||filter.person||filter.priority||filter.department||filter.due||filter.project==='archive')){
      root.innerHTML=`<div class="pw-empty"><span class="pw-empty-icon" aria-hidden="true">✓</span><h3>${filter.project==='mine'?'No tienes tareas en esta vista':'No hay tareas en esta vista'}</h3><p>Cambia los filtros${filter.project==='archive'?' o archiva una tarea para verla aquí.':' o crea una tarea para empezar.'}</p>${button('clear-filters','Limpiar filtros')}${!context.readOnly&&filter.project!=='archive'?button('new-task','Nueva tarea','','primary'):''}</div>`;return;
    }
    if(filter.view==='board'){
      root.innerHTML=`<div class="pw-board" aria-label="Tablero de tareas">${Object.entries(STATUS).map(([status,label])=>{const items=rows.filter(t=>t.status===status);return `<section class="pw-column" data-pw-drop="${status}" aria-label="${label}"><header><span><i class="pw-status-dot pw-${status}"></i>${label}</span><small>${items.length}</small></header><div class="pw-column-tasks">${items.map(t=>`<article class="pw-task-card" data-pw-drag="${t.id}" draggable="${!context.readOnly&&!t.archived}"><div class="pw-card-top"><span class="pw-project-tag">${esc(projectPath(t.project))}</span>${pill(t.priority)}</div><button class="pw-task-title" data-pw-open="${t.id}">${esc(t.title)}</button><div class="pw-card-person">${avatar(t.owner)}</div><div class="pw-card-meta"><span class="${overdue(t)?'pw-late':''}">${dateLabel(t.due)}${overdue(t)?' · Vencida':''}</span><span>${t.checklist.filter(i=>i.done).length}/${t.checklist.length} subtareas</span></div>${taskStatus(t)}</article>`).join('')||'<p class="pw-column-empty">Sin tareas</p>'}</div>${!context.readOnly&&filter.project!=='archive'?button('new-task','+ Añadir tarea',`data-pw-new-status="${status}"`,'pw-text'):''}</section>`}).join('')}</div><p class="pw-board-hint">Arrastra una tarjeta para cambiar su estado o usa su selector.</p>`;
    }else{
      root.innerHTML=`<div class="pw-table-wrap"><table class="pw-table"><thead><tr><th>Tarea</th><th>Estado</th><th>Responsable</th><th>Prioridad</th><th>Fecha límite</th><th><span class="pw-sr">Acciones</span></th></tr></thead><tbody>${rows.map(t=>`<tr><td><button class="pw-task-title" data-pw-open="${t.id}">${esc(t.title)}</button><span class="pw-task-subtitle">${esc(projectPath(t.project))} · ${t.checklist.filter(i=>i.done).length}/${t.checklist.length} subtareas${activity(t.activity)?' · '+esc(activity(t.activity).title):''}</span></td><td>${taskStatus(t)}</td><td>${avatar(t.owner)}</td><td>${pill(t.priority)}</td><td><span class="pw-due ${overdue(t)?'pw-late':''}">${dateLabel(t.due)}${overdue(t)?'<small>Vencida</small>':''}</span></td><td>${t.archived&&!context.readOnly?button('restore','Restaurar',`data-pw-id="${t.id}"`,'pw-text'):`<button class="pw-open-icon" data-pw-open="${t.id}" aria-label="Abrir ${esc(t.title)}">↗</button>`}</td></tr>`).join('')}</tbody></table></div>`;
    }
  }
  function changeStatus(id,status){
    try{if(!STATUS[status])throw new Error('Selecciona un estado válido.');commit(next=>{const t=next.tasks.find(t=>t.id===id);if(!t||t.archived)throw new Error('Esta tarea ya no está activa.');if(t.status!==status){t.status=status;log(t,'Estado cambiado a '+STATUS[status]);}});render();notify('Estado actualizado.');}catch(e){notify(e.message,true);renderResults();}
  }
  function clearFilters(){Object.assign(filter,{search:'',status:'',person:'',priority:'',department:'',due:''});}
  function bind(){
    host.onclick=e=>{
      const el=e.target.closest('button');if(!el||!host.contains(el))return;
      if(el.dataset.pwToggle){const key=el.dataset.pwToggle;collapsed.has(key)?collapsed.delete(key):collapsed.add(key);render();host.querySelector('[data-pw-toggle=\"'+CSS.escape(key)+'\"]')?.focus();return;}
      if(el.dataset.pwProject){filter.project=el.dataset.pwProject;filter.view=['mine','archive'].includes(filter.project)?'list':'summary';clearFilters();render();return;}
      if(el.dataset.pwView){filter.view=el.dataset.pwView;render();return;}
      if(el.dataset.pwOpen){openTask(el.dataset.pwOpen);return;}
      switch(el.dataset.pwAction){
        case 'new-project':openProject();break;
        case 'new-subproject':openProject(null,filter.project);break;
        case 'new-initiative':openInitiative();break;
        case 'edit-initiative':openInitiative(filter.project.slice(11));break;
        case 'view-project-work':filter.project=el.dataset.pwTarget;filter.view='list';clearFilters();render();break;
        case 'edit-project':openProject(filter.project);break;
        case 'new-task':openTask(null,el.dataset.pwNewStatus);break;
        case 'clear-filters':clearFilters();render();break;
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
    dialog.innerHTML=`<header class="pw-dialog-head"><div><p class="eyebrow">${esc(snapshot.company?.name||'HORIZONTE')} · PROYECTOS</p><h2 id="pw-dialog-title">${esc(title)}</h2></div>${button('close','×','aria-label="Cerrar formulario"','pw-icon')}</header>${body}`;
    document.body.append(dialog);dialog.querySelector('[data-pw-action="close"]').onclick=closeDialog;
    dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
    dialog.showModal();return dialog;
  }
  function errorForm(form,message){const node=form.querySelector('[data-pw-error]');node.textContent=message;node.hidden=false;}
  function openInitiative(id){
    if(context.readOnly)return;
    const existing=initiative(id),item=existing||{name:'',description:'',owner:'',due:'',color:'green'};
    const d=modal(existing?'Editar iniciativa':'Nueva iniciativa',`<form id="pw-initiative-form" class="pw-form"><p class="pw-muted">Agrupa proyectos que persiguen un mismo objetivo. Cada proyecto también puede funcionar por separado.</p><label class="field"><span>Nombre de la iniciativa</span><input name="name" maxlength="100" required value="${esc(item.name)}" placeholder="Ej. Experiencia del cliente"></label><label class="field"><span>Objetivo compartido</span><textarea name="description" maxlength="2000" rows="3">${esc(item.description)}</textarea></label><div class="pw-form-grid"><label class="field"><span>Responsable</span><select name="owner">${peopleOptions(item.owner)}</select></label><label class="field"><span>Fecha objetivo</span><input name="due" type="date" value="${esc(item.due)}"></label></div><p data-pw-error class="pw-form-error" role="alert" hidden></p><footer class="pw-dialog-actions">${button('cancel','Cancelar')}<button type="submit" class="button primary">${existing?'Guardar iniciativa':'Crear iniciativa'}</button></footer></form>`);
    d.querySelector('[data-pw-action="cancel"]').onclick=closeDialog;
    d.querySelector('form').onsubmit=e=>{e.preventDefault();const form=e.currentTarget,v=Object.fromEntries(new FormData(form));try{
      v.name=v.name.trim();if(!v.name||v.name.length>100)throw new Error('Escribe un nombre de hasta 100 caracteres.');if(!validDate(v.due)||v.owner&&!person(v.owner))throw new Error('Revisa la fecha y el responsable.');
      const target=id||uid();commit(next=>{if(next.initiatives.some(i=>i.id!==id&&i.name.toLocaleLowerCase()===v.name.toLocaleLowerCase()))throw new Error('Ya existe una iniciativa con ese nombre.');const row={...v,id:target,owner:v.owner?Number(v.owner):null,color:item.color};if(existing)Object.assign(next.initiatives.find(i=>i.id===id),row);else next.initiatives.push(row);});
      filter.project='initiative:'+target;filter.view='summary';clearFilters();closeDialog();render();notify(existing?'Iniciativa actualizada.':'Iniciativa creada. Ahora puedes añadir sus proyectos.');
    }catch(err){errorForm(form,err.message);}};
  }
  function openProject(id,newParent){
    if(context.readOnly)return;
    const existing=project(id),p=existing||{name:'',description:'',owner:'',due:'',color:'green',parentId:newParent||'',initiativeId:filter.project.startsWith('initiative:')?filter.project.slice(11):initiativeFor(project(filter.project))?.id||''};
    const parents=state.projects.filter(pr=>!pr.parentId&&pr.id!==id&&(!existing||!children(id).length));
    const d=modal(existing?'Editar proyecto':newParent?'Nuevo subproyecto':'Nuevo proyecto',`<form id="pw-project-form" class="pw-form"><label class="field"><span>Nombre del proyecto</span><input name="name" required maxlength="100" value="${esc(p.name)}" placeholder="Ej. Renovar el centro de ayuda"></label><label class="field"><span>Objetivo</span><textarea name="description" maxlength="2000" rows="3" placeholder="¿Qué queremos lograr?">${esc(p.description)}</textarea></label><div class="pw-form-grid"><label class="field"><span>Responsable del proyecto</span><select name="owner">${peopleOptions(p.owner)}</select></label><label class="field"><span>Fecha objetivo</span><input name="due" type="date" value="${esc(p.due)}"></label></div><details class="pw-project-organization" ${p.parentId||p.initiativeId?'open':''}><summary>Organización opcional</summary><div class="pw-form-grid"><label class="field"><span>Proyecto principal</span><select name="parentId">${options([['','Proyecto independiente'],...parents.map(pr=>[pr.id,pr.name])],p.parentId||'')}</select></label><label class="field"><span>Iniciativa</span><select name="initiativeId">${options([['','Sin iniciativa'],...state.initiatives.map(i=>[i.id,i.name])],p.initiativeId||'')}</select></label></div><p id="pw-parent-note" class="pw-muted"></p></details><label class="field"><span>Color</span><select name="color">${options([['green','Verde'],['blue','Azul'],['purple','Violeta'],['orange','Naranja']],p.color)}</select></label><p data-pw-error class="pw-form-error" role="alert" hidden></p><footer class="pw-dialog-actions">${button('cancel','Cancelar')}<button class="button primary" type="submit">${existing?'Guardar proyecto':'Crear proyecto'}</button></footer></form>`);
    const parentField=d.querySelector('[name="parentId"]'),initiativeField=d.querySelector('[name="initiativeId"]');
    const syncParent=()=>{initiativeField.disabled=!!parentField.value;d.querySelector('#pw-parent-note').textContent=parentField.value?'Comparte la iniciativa del proyecto principal. Su avance también se verá en ese proyecto.':'Puedes comenzar con un proyecto independiente y organizarlo después.';if(parentField.value)initiativeField.value=initiativeFor(project(parentField.value))?.id||'';};parentField.onchange=syncParent;syncParent();
    d.querySelector('[data-pw-action="cancel"]').onclick=closeDialog;
    d.querySelector('form').onsubmit=e=>{e.preventDefault();const form=e.currentTarget,v=Object.fromEntries(new FormData(form));try{
      v.name=v.name.trim();if(!v.name||v.name.length>100)throw new Error('Escribe un nombre de hasta 100 caracteres.');if(!validDate(v.due))throw new Error('La fecha no es válida.');if(!COLORS.includes(v.color)||v.owner&&!person(v.owner))throw new Error('Revisa el color y responsable.');
      if(v.parentId&&(!project(v.parentId)||project(v.parentId).parentId||v.parentId===id||(id&&children(id).length)))throw new Error('Selecciona un proyecto principal válido. Un subproyecto no puede contener otros proyectos.');
      if(!v.parentId&&v.initiativeId&&!initiative(v.initiativeId))throw new Error('Selecciona una iniciativa válida.');
      const target=id||uid();commit(next=>{if(next.projects.some(p=>p.id!==id&&p.name.toLocaleLowerCase()===v.name.toLocaleLowerCase()))throw new Error('Ya existe un proyecto con ese nombre.');const item={...v,id:target,owner:v.owner?Number(v.owner):null,parentId:v.parentId||null,initiativeId:v.parentId?null:v.initiativeId||null};if(existing)Object.assign(next.projects.find(p=>p.id===id),item);else next.projects.push(item);});
      filter.project=target;filter.view='summary';clearFilters();if(v.parentId)collapsed.delete(v.parentId);if(v.initiativeId)collapsed.delete('initiative:'+v.initiativeId);closeDialog();render();notify(existing?'Proyecto actualizado.':'Proyecto creado.');
    }catch(err){errorForm(form,err.message);}};
  }
  function openTask(id,status='todo'){
    const existing=state.tasks.find(t=>t.id===id);
    if(!existing&&context.readOnly)return;
    if(!existing&&filter.project.startsWith('initiative:')&&!state.projects.some(p=>!p.parentId&&p.initiativeId===filter.project.slice(11))){openProject();notify('Crea primero un proyecto para esta iniciativa.');return;}
    const task=structuredClone(existing||{title:'',description:'',project:project(filter.project)?.id||state.projects.find(p=>!p.parentId&&(!filter.project.startsWith('initiative:')||p.initiativeId===filter.project.slice(11)))?.id||state.projects[0]?.id,owner:filter.project==='mine'?context.user.id:'',due:'',priority:'normal',status:STATUS[status]?status:'todo',activity:'',checklist:[],comments:[],history:[]});
    const locked=context.readOnly||task.archived;
    const d=modal(existing?'Detalle de tarea':'Nueva tarea',`<form id="pw-task-form" class="pw-form"><fieldset ${locked?'disabled':''}><label class="field"><span>Nombre de la tarea</span><input name="title" required maxlength="180" value="${esc(task.title)}" placeholder="¿Qué hay que hacer?"></label><label class="field"><span>Descripción y resultado esperado</span><textarea name="description" rows="3" maxlength="5000" placeholder="Agrega contexto, criterios y entregable…">${esc(task.description)}</textarea></label><div class="pw-form-grid"><label class="field"><span>Proyecto</span><select name="project" required>${options(state.projects.map(p=>[p.id,projectPath(p.id)]),task.project)}</select></label><label class="field"><span>Responsable</span><select name="owner">${peopleOptions(task.owner)}</select></label><label class="field"><span>Estado</span><select name="status">${options(Object.entries(STATUS),task.status)}</select></label><label class="field"><span>Prioridad</span><select name="priority">${options(Object.entries(PRIORITY),task.priority)}</select></label><label class="field"><span>Fecha límite</span><input name="due" type="date" value="${esc(task.due)}"></label><label class="field"><span>Actividad operativa relacionada</span><select name="activity" ${!allowed('departments')?'disabled':''}>${options([['','Sin vincular'],...activities().map(p=>[String(p.id),p.title+' · '+p.department_name]),...(task.activity&&!activity(task.activity)?[[String(task.activity),'Actividad no disponible']]:[])],task.activity)}</select></label></div></fieldset><section id="pw-task-context" class="pw-task-context" aria-label="Contexto de Oplen"></section><fieldset ${locked?'disabled':''}><section class="pw-subtasks"><h3>Subtareas <span id="pw-check-count"></span></h3><div id="pw-checklist"></div><div class="pw-add-line"><input id="pw-new-check" aria-label="Nueva subtarea" maxlength="200" placeholder="Añadir una subtarea…">${button('add-check','Añadir')}</div></section></fieldset>${existing?`<section class="pw-comments"><h3>Comentarios <span>${task.comments.length}</span></h3><div class="pw-comment-list">${task.comments.map(c=>`<article><header><b>${esc(c.author)}</b><time>${dateLabel(c.at.slice(0,10))}</time></header><p>${esc(c.body)}</p></article>`).join('')||'<p class="pw-muted">Todavía no hay comentarios.</p>'}</div>${!locked?'<label class="field"><span>Nuevo comentario</span><textarea name="comment" rows="2" maxlength="2000" placeholder="Comparte un avance o una duda…"></textarea></label>':''}</section><details class="pw-history"><summary>Historial de la tarea</summary>${task.history.slice(0,12).map(h=>`<p><span>${esc(h.body)}</span><time>${dateLabel(h.at.slice(0,10))}</time></p>`).join('')}</details>`:''}<p data-pw-error class="pw-form-error" role="alert" hidden></p><footer class="pw-dialog-actions">${existing&&!locked?button('archive-task','Archivar','','pw-danger'):''}${button('cancel',locked?'Cerrar':'Cancelar')}${!locked?`<button class="button primary" type="submit">${existing?'Guardar cambios':'Crear tarea'}</button>`:''}</footer></form>`,true);
    const form=d.querySelector('form');
    function renderContext(){d.querySelector('#pw-task-context').innerHTML=`<span class="pw-overline">CONTEXTO DE OPLEN</span><h3>Quién lo hace y cómo</h3>${personContext(form.elements.owner.value)}${operationContext(form.elements.activity.value)}`;}
    form.elements.owner.addEventListener('change',renderContext);form.elements.activity.addEventListener('change',renderContext);renderContext();
    function checks(){
      d.querySelector('#pw-check-count').textContent=`${task.checklist.filter(i=>i.done).length}/${task.checklist.length}`;
      d.querySelector('#pw-checklist').innerHTML=task.checklist.map(c=>`<div class="pw-check-row"><div class="pw-check-title"><label><input type="checkbox" data-pw-check="${esc(c.id)}" ${c.done?'checked':''}><span class="${c.done?'completed':''}">${esc(c.title)}</span></label>${!locked?`<button type="button" class="pw-remove-check" data-pw-remove="${esc(c.id)}" aria-label="Quitar subtarea ${esc(c.title)}">×</button>`:''}</div><div class="pw-check-fields"><select data-pw-sub-owner="${esc(c.id)}" aria-label="Responsable de ${esc(c.title)}">${peopleOptions(c.owner)}</select><select data-pw-sub-status="${esc(c.id)}" aria-label="Estado de subtarea ${esc(c.title)}">${options(Object.entries(STATUS),c.status||'todo')}</select><input type="date" value="${esc(c.due)}" data-pw-sub-due="${esc(c.id)}" aria-label="Fecha de ${esc(c.title)}"></div></div>`).join('')||'<p class="pw-muted">Divide el trabajo en pasos con responsable y estado propios.</p>';
    }
    checks();
    const addCheck=()=>{if(locked)return;const input=d.querySelector('#pw-new-check'),title=input.value.trim();if(title){task.checklist.push({id:uid(),title,done:false,status:'todo',owner:null,due:''});input.value='';checks();input.focus();}};
    d.querySelector('[data-pw-action="add-check"]').onclick=addCheck;
    d.querySelector('#pw-new-check').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addCheck();}};
    d.querySelector('#pw-checklist').onchange=e=>{if(locked)return;const field=e.target,key=field.dataset.pwCheck||field.dataset.pwSubOwner||field.dataset.pwSubStatus||field.dataset.pwSubDue,item=task.checklist.find(c=>c.id===key);if(!item)return;if(field.dataset.pwCheck){item.done=field.checked;item.status=item.done?'done':'todo';checks();}else if(field.dataset.pwSubOwner)item.owner=field.value?Number(field.value):null;else if(field.dataset.pwSubStatus){item.status=field.value;item.done=field.value==='done';checks();}else item.due=field.value;};
    d.querySelector('#pw-checklist').onclick=e=>{const b=e.target.closest('[data-pw-remove]');if(b&&!locked){task.checklist=task.checklist.filter(c=>c.id!==b.dataset.pwRemove);checks();}};
    d.querySelector('[data-pw-action="cancel"]').onclick=closeDialog;
    d.querySelector('[data-pw-action="archive-task"]')?.addEventListener('click',()=>{try{commit(next=>{const t=next.tasks.find(t=>t.id===id);t.archived=true;log(t,'Tarea archivada');});closeDialog();render();notify('Tarea archivada. Puedes restaurarla desde Archivo.');}catch(err){errorForm(form,err.message);}});
    form.onsubmit=e=>{e.preventDefault();if(locked)return;const v=Object.fromEntries(new FormData(form));try{v.title=v.title.trim();if(!v.title)throw new Error('Escribe un nombre para la tarea.');if(!STATUS[v.status]||!PRIORITY[v.priority]||!project(v.project))throw new Error('Revisa el estado, prioridad y proyecto.');if(!validDate(v.due))throw new Error('La fecha no es válida.');if(v.owner&&!person(v.owner))throw new Error('Selecciona un responsable del equipo.');if(!allowed('departments'))v.activity=task.activity?String(task.activity):'';if(v.activity&&v.activity!==String(task.activity||'')&&!activity(v.activity))throw new Error('Selecciona una actividad publicada.');if(task.checklist.some(c=>!STATUS[c.status]||!validDate(c.due)||c.owner&&!person(c.owner)))throw new Error('Revisa responsables, estados y fechas de las subtareas.');commit(next=>{const item={title:v.title,description:v.description.trim(),project:v.project,owner:v.owner?Number(v.owner):null,status:v.status,priority:v.priority,due:v.due,activity:v.activity?Number(v.activity):null,checklist:task.checklist};let t=next.tasks.find(t=>t.id===id);if(!t){t={id:uid(),comments:[],history:[],createdAt:now(),archived:false};next.tasks.push(t);}const oldStatus=t.status;Object.assign(t,item);log(t,existing?'Tarea actualizada':'Tarea creada');if(oldStatus&&oldStatus!==t.status)log(t,'Estado cambiado a '+STATUS[t.status]);if(v.comment?.trim()){t.comments.push({id:uid(),author:context.user.name,body:v.comment.trim(),at:now()});log(t,'Comentario de '+context.user.name);}});if(filter.view==='summary')filter.view='list';closeDialog();render();notify(existing?'Cambios guardados.':'Tarea creada.');}catch(err){errorForm(form,err.message);}};
  }
  window.addEventListener('storage',e=>{if(e.key!==KEY)return;if(dialog){notify('Hay cambios en otra pestaña. Tu formulario sigue abierto; recarga antes de guardar.',true);return;}try{if(host?.isConnected){state=read();if(state)render();else host.innerHTML='<p role="status">La demo se restableció en otra pestaña. Recarga para continuar.</p>';}}catch(err){notify(err.message,true);}});
  window.addEventListener('hashchange',closeDialog);
  window.OplenProjects={mount(root,opts){closeDialog();host=root;context=opts;snapshot=window.OplenDemo.snapshot();try{load();render();}catch(err){host.innerHTML=`<section class="pw-app pw-empty"><h1>No pudimos abrir los proyectos</h1><p role="alert">${esc(err.message)}</p><p>Comprueba que tu navegador permita guardar datos y vuelve a cargar la página.</p></section>`;}},version:'0.2.0'};
})();
