/* Oplen demo projects: browser-local prototype; no production API or ClickUp connection. */
(() => {
  'use strict';
  const KEY = 'oplen-demo-projects-v1';
  const STATUS = {todo:'Por hacer', doing:'En curso', review:'En revisión', done:'Completada'};
  const PRIORITY = {urgent:'Urgente', high:'Alta', normal:'Normal', low:'Baja'};
  const REQUEST_KIND={request:'Solicitud',bug:'Error',improvement:'Mejora'};
  const REQUEST_STATUS={new:'Nueva',review:'En revisión',accepted:'Aceptada',resolved:'Resuelta',declined:'Cerrada sin tarea'};
  const COLORS = ['green','blue','purple','orange'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const day = (offset=0) => {const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const validDate = d => !d || /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d+'T12:00:00').getTime()) && new Date(d+'T12:00:00').toISOString().slice(0,10)===d;
  const dateLabel = d => d ? new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short'}).format(new Date(d+'T12:00:00')) : 'Sin fecha';
  const initials = name => (name||'Sin asignar').split(/\s+/).slice(0,2).map(n=>n[0]).join('');
  let host, context, snapshot, state, filter={project:'portfolio',search:'',status:'',person:'',priority:'',department:'',due:'',work:'all',requestType:'',attention:'',view:'summary'}, dialog, returnFocus;
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
  const HEALTH={danger:'Requiere atención',warning:'En riesgo',good:'En orden',complete:'Completado',empty:'Sin evaluar'};
  const activeOwner=id=>Boolean(person(id)?.is_active);
  function taskRisks(t){
    if(t.archived||t.status==='done')return [];
    const reasons=[];
    const add=(level,text)=>reasons.push({level,text});
    if(t.blockedReason?.trim())add('danger','Bloqueada: '+t.blockedReason.trim());
    if(t.due&&t.due<day())add('danger','Entrega vencida · '+dateLabel(t.due));
    else if(t.due&&t.due<=day(3))add('warning','Entrega próxima · '+dateLabel(t.due));
    if(!activeOwner(t.owner))add('warning',t.owner?'Responsable no disponible':'Sin responsable');
    for(const c of t.checklist.filter(c=>!c.done)){
      if(c.due&&c.due<day())add('danger','Subtarea vencida: '+c.title+' · '+dateLabel(c.due));
      else if(c.due&&c.due<=day(3))add('warning','Subtarea próxima: '+c.title+' · '+dateLabel(c.due));
      if(!activeOwner(c.owner||t.owner))add('warning','Subtarea sin responsable disponible: '+c.title);
    }
    return reasons.sort((a,b)=>Number(b.level==='danger')-Number(a.level==='danger'));
  }
  function projectHealth(scope){
    const rows=scopeTasks(scope),issues=[];
    for(const t of rows){const reasons=taskRisks(t);if(reasons.length)issues.push({type:'task',id:t.id,title:t.title,projectId:t.project,owner:t.owner,due:t.due,level:reasons[0].level,reasons});}
    const projects=state.projects.filter(p=>scope==='all'||(scope.startsWith('initiative:')?initiativeFor(p)?.id===scope.slice(11):p.id===scope||p.parentId===scope));
    const targets=projects.map(p=>({type:'project',entity:p,rows:scopeTasks(p.id)}));
    const initiatives=scope==='all'?state.initiatives:scope.startsWith('initiative:')?[initiative(scope.slice(11))].filter(Boolean):[];
    for(const i of initiatives)targets.push({type:'initiative',entity:i,rows:scopeTasks('initiative:'+i.id)});
    for(const {type,entity,rows:work} of targets){
      if(!work.length||!entity.due||entity.due>day(3)||work.every(t=>t.status==='done'))continue;
      const level=entity.due<day()?'danger':'warning';
      issues.push({type,id:entity.id,title:entity.name,projectId:type==='project'?entity.id:null,owner:entity.owner,due:entity.due,level,reasons:[{level,text:(level==='danger'?'Fecha objetivo vencida':'Fecha objetivo próxima')+' · '+dateLabel(entity.due)+(work.length?' · trabajo pendiente':' · sin tareas definidas')}]});
    }
    issues.sort((a,b)=>Number(b.level==='danger')-Number(a.level==='danger')||(a.due||'9999').localeCompare(b.due||'9999')||a.title.localeCompare(b.title));
    const key=issues.some(i=>i.level==='danger')?'danger':issues.length?'warning':!rows.length?'empty':rows.every(t=>t.status==='done')?'complete':'good';
    const affectedTasks=issues.filter(i=>i.type==='task').length,affectedDates=issues.length-affectedTasks;
    const text=issues.length?[affectedTasks?affectedTasks+(affectedTasks===1?' tarea necesita atención':' tareas necesitan atención'):'',affectedDates?affectedDates+(affectedDates===1?' fecha objetivo por revisar':' fechas objetivo por revisar'):''].filter(Boolean).join(' · '):key==='empty'?'Añade tareas para evaluar el avance.':key==='complete'?'Todas las tareas activas están completadas.':'Sin alertas detectadas en las tareas activas.';
    return {key,text,issues,affectedTasks,affectedDates};
  }
  function healthBadge(h){return `<span class="pw-health-badge pw-health-${h.key}" title="${esc(h.text)}"><i aria-hidden="true"></i>${HEALTH[h.key]}</span>`;}
  function healthPanel(scope){
    const h=projectHealth(scope);
    return `<section class="pw-health-panel" aria-label="Semáforo de proyectos" data-pw-health-state="${h.key}"><div class="pw-health-overview"><div><span class="pw-overline">SEMÁFORO AUTOMÁTICO</span><h3>${healthBadge(h)}</h3><p>${esc(h.text)}</p></div>${h.issues.length?button('view-health',`Ver ${h.issues.length===1?'motivo':h.issues.length+' motivos'} →`,`data-pw-target="${esc(scope)}"`,'pw-text'):''}</div><details class="pw-health-rules"><summary>Cómo se calcula</summary><p>Rojo: tareas o subtareas vencidas, bloqueos y fechas objetivo vencidas con trabajo pendiente. Amarillo: entregas en los próximos 3 días o trabajo sin responsable disponible. Las subtareas sin asignación heredan al responsable de su tarea.</p><p>Incluye los subproyectos y cuenta cada tarea una vez. Excluye tareas completadas y archivadas. Sin tareas, el estado queda sin evaluar. Se recalcula al guardar o volver a abrir Proyectos.</p></details></section>`;
  }
  function taskRiskBadge(t){const reasons=taskRisks(t);return reasons.length?`<span class="pw-task-risk pw-risk-${reasons[0].level}" title="${esc(reasons.map(r=>r.text).join(' · '))}">${esc(t.blockedReason?.trim()?'Bloqueada':reasons[0].text)}</span>`:'';}
  function openHealth(scope){
    const h=projectHealth(scope),p=project(scope),i=scope.startsWith('initiative:')?initiative(scope.slice(11)):null;
    const d=modal('Atención del proyecto',`<section class="pw-health-detail"><p class="pw-health-scope">${esc(p?.name||i?.name||'Vista general')}</p>${healthBadge(h)}<p class="pw-muted">${esc(h.text)}</p><div class="pw-health-issues">${h.issues.map(issue=>`<article data-pw-health-issue="${esc(issue.type+':'+issue.id)}"><span class="pw-overline">${issue.type==='task'?'TAREA':issue.type==='project'?'PROYECTO':'INICIATIVA'} · ${HEALTH[issue.level]}</span><h3>${esc(issue.title)}</h3><p class="pw-muted">${esc(issue.projectId?projectPath(issue.projectId):'Iniciativa')} · ${esc(ownerLabel(issue.owner))}</p><ul>${issue.reasons.map(r=>`<li class="pw-risk-${r.level}">${esc(r.text)}</li>`).join('')}</ul>${button('health-open',issue.type==='task'?'Abrir tarea →':'Ver '+(issue.type==='project'?'proyecto':'iniciativa')+' →',`data-pw-kind="${issue.type}" data-pw-id="${esc(issue.id)}"`,'pw-text')}</article>`).join('')||'<p class="pw-muted">No hay alertas en este alcance.</p>'}</div><footer class="pw-dialog-actions">${button('cancel','Cerrar')}</footer></section>`,true);
    d.querySelector('[data-pw-action="cancel"]').onclick=closeDialog;
    d.querySelectorAll('[data-pw-action="health-open"]').forEach(b=>b.onclick=()=>{const {pwKind:kind,pwId:id}=b.dataset;if(kind==='task'){openTask(id);return;}closeDialog();filter.project=kind==='initiative'?'initiative:'+id:id;filter.view='summary';clearFilters();render();});
  }
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
    return {version:3,revision:0,initiatives,projects,requests:seedRequests(),tasks:specs.map((s,i)=>({id:'task-'+(i+1),project:i===11?'help-center':s[0],title:s[1],status:s[2],owner:s[3],due:day(s[4]),priority:s[5],activity:s[6],description:'Ejemplo de Horizonte. Define el resultado esperado, reúne el contexto y confirma la entrega con las áreas involucradas.',checklist:[{id:uid(),title:'Confirmar alcance y responsable',done:s[2]!=='todo',status:s[2]!=='todo'?'done':'todo',owner:s[3],due:''},{id:uid(),title:'Documentar el resultado',done:s[2]==='done',status:s[2]==='done'?'done':'todo',owner:null,due:''}],comments:i===1?[{id:uid(),author:'Ana Torres',body:'Revisemos las piezas antes de publicarlas.',at:now()}]:[],history:[{body:'Tarea de ejemplo creada',at:now()}],archived:false,createdAt:now(),updatedAt:now()}))};
  }
  function seedRequests(){
    return [
      ['request-registration','launch','bug','El formulario pierde datos al volver atrás','Al regresar al paso anterior se borran los datos de contacto. Se espera conservar la información durante el registro.',82,21,'high',25,'new'],
      ['request-guide','help-center','improvement','Añadir ejemplos a la guía de respuestas','Incluir ejemplos de respuestas y cuándo escalar una solicitud para que el equipo aplique el mismo criterio.',32,31,'normal',10,'new'],
      ['request-welcome','onboarding','request','Preparar una sesión de bienvenida','Organizar una sesión breve para presentar responsables, documentación y el plan de la primera semana.',62,61,'normal',20,'review']
    ].map(([id,project,kind,title,description,requester,reviewer,priority,activity,status])=>({id,project,kind,title,description,requester,requesterName:ownerLabel(requester),reviewer,priority,activity,status,due:'',taskId:null,decision:'',comments:[],history:[{body:'Solicitud de ejemplo recibida',at:now(),author:'Horizonte'}],createdAt:now(),updatedAt:now()}));
  }
  function read(){
    const raw=localStorage.getItem(KEY);
    if(!raw)return null;
    const result=JSON.parse(raw);
    if(![1,2,3].includes(result.version)||!Array.isArray(result.projects)||!Array.isArray(result.tasks)||!Number.isInteger(result.revision))throw new Error('No pudimos leer los proyectos guardados. No se han reemplazado tus datos.');
    // Upgrade the shape in memory. Existing projects, task ownership and comments stay intact.
    if(result.version===1){result.version=2;result.initiatives=[];result.projects.forEach(p=>{p.parentId=null;p.initiativeId=null;});}
    if(result.version===2){result.version=3;result.requests=[];}
    if(!Array.isArray(result.requests))throw new Error('No pudimos leer las solicitudes guardadas. Tus datos se conservan.');
    for(const r of result.requests){if(!r||!REQUEST_KIND[r.kind]||!['new','review','accepted','declined'].includes(r.status)||!Array.isArray(r.comments)||!Array.isArray(r.history)||!result.projects.some(p=>p.id===r.project))throw new Error('Hay una solicitud que no se pudo leer. Tus datos se conservan.');if(r.status==='accepted'&&(!r.taskId||!result.tasks.some(t=>t.id===r.taskId&&t.sourceRequestId===r.id)))throw new Error('No se pudo verificar la tarea vinculada a una solicitud. Tus datos se conservan.');}
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
    if(filter.work==='requests'||filter.requestType||filter.status.startsWith('request:'))return [];
    const query=filter.search.trim().toLocaleLowerCase();
    return state.tasks.filter(t=>Boolean(t.archived)===(filter.project==='archive'))
      .filter(t=>inScope(t))
      .filter(t=>!filter.attention||(filter.attention==='blocked'?t.status!=='done'&&Boolean(t.blockedReason?.trim()):(filter.attention==='all'?taskRisks(t).length:taskRisks(t)[0]?.level===filter.attention)))
      .filter(t=>(!filter.status||t.status===filter.status)&&(!filter.person||(filter.person==='none'?!t.owner:String(t.owner)===filter.person))&&(!filter.priority||t.priority===filter.priority))
      .filter(t=>!filter.department||departmentFor(t)===filter.department)
      .filter(t=>!filter.due||(filter.due==='late'?overdue(t):filter.due==='none'?!t.due:t.status!=='done'&&t.due>=day()&&t.due<=day(7)))
      .filter(t=>!query||[t.title,t.description,projectPath(t.project),ownerLabel(t.owner),activity(t.activity)?.title,...t.checklist.map(c=>c.title)].join(' ').toLocaleLowerCase().includes(query))
      .sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.title.localeCompare(b.title));
  }
  function mySubtaskNote(t){const items=filter.project==='mine'?t.checklist.filter(c=>!c.done&&String(c.owner)===String(context.user.id)):[];return items.length?`<span class="pw-my-subtasks">Tu${items.length===1?' subtarea':'s subtareas'}: ${items.map(c=>esc(c.title)+' · '+esc(STATUS[c.status])).join(' / ')}</span>`:'';}
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
  const INITIATIVE_STATUS={active:'En marcha',paused:'En pausa',completed:'Completada',archived:'Archivada'};
  const portfolio={search:'',status:'all',view:'compact'};
  const initiativeStatus=i=>INITIATIVE_STATUS[i.status]?i.status:'active';
  const safeLogo=value=>typeof value==='string'&&/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value)&&value.length<=280000?value:'';
  function identity(i,small=false){const logo=safeLogo(i.logo);return `<span class="pw-identity pw-identity-${COLORS.includes(i.color)?i.color:'green'} ${small?'pw-identity-small':''}" aria-hidden="true">${logo?`<img src="${esc(logo)}" alt="">`:esc(i.icon||initials(i.name))}</span>`;}
  const initiativeProjects=id=>state.projects.filter(p=>!p.parentId&&p.initiativeId===id);
  function renderPortfolio(){
    const visible=state.initiatives.filter(i=>initiativeStatus(i)!=='archived'),visibleIds=new Set(visible.map(i=>i.id));
    const projects=state.projects.filter(p=>!initiativeFor(p)||visibleIds.has(initiativeFor(p).id));
    const projectIds=new Set(projects.map(p=>p.id)),open=activeTasks().filter(t=>projectIds.has(t.project)&&t.status!=='done').length;
    host.innerHTML=`<div class="pw-app pw-portfolio-home"><header class="pw-portfolio-head"><div><p class="eyebrow">${esc(snapshot.company?.name||'HORIZONTE')} / PORTAFOLIO</p><h1>Tus iniciativas<span>.</span></h1><p>Todo lo que construyes, en un solo lugar.</p></div>${context.readOnly?'<span class="pw-demo">Vista de consulta</span>':`<div class="pw-portfolio-head-actions">${button('project-templates','Proyectos de ejemplo')}${button('new-initiative','+ Nueva iniciativa','','primary')}</div>`}</header><section class="pw-portfolio-overview" aria-label="Panorama de tu portafolio"><span>PANORAMA DE TU PORTAFOLIO</span><dl><div><dt>Iniciativas</dt><dd data-pw-portfolio-count="initiatives">${visible.length}</dd></div><div><dt>Proyectos</dt><dd data-pw-portfolio-count="projects">${projects.length}</dd></div><div><dt>Tareas abiertas</dt><dd data-pw-portfolio-count="tasks">${open}</dd></div></dl></section><nav class="pw-portfolio-nav" aria-label="Trabajo del espacio"><span>Explorar iniciativas</span><button class="button pw-text" data-pw-project="all">Todo el trabajo →</button><button class="button pw-text" data-pw-project="mine">Mi trabajo →</button></nav><div class="pw-portfolio-controls"><div class="pw-portfolio-tabs" role="group" aria-label="Estado de iniciativas">${[['all','Todas'],['active','En marcha'],['paused','En pausa'],['completed','Completadas'],['archived','Archivadas']].map(([key,label])=>`<button data-pw-portfolio-status="${key}" aria-pressed="${portfolio.status===key}" class="${portfolio.status===key?'selected':''}">${label}</button>`).join('')}</div><div class="pw-portfolio-search"><label><span class="pw-sr">Buscar iniciativas</span><input id="pw-portfolio-search" type="search" value="${esc(portfolio.search)}" placeholder="Buscar iniciativas…"></label><div class="pw-view-switch" role="group" aria-label="Vista del portafolio">${[['compact','Compacta'],['list','Lista']].map(([key,label])=>`<button data-pw-portfolio-view="${key}" aria-pressed="${portfolio.view===key}" class="${portfolio.view===key?'selected':''}">${label}</button>`).join('')}</div></div></div><div id="pw-portfolio-results" aria-live="polite"></div><p class="pw-footnote">Datos ficticios de Horizonte · Guardado local en este navegador. Cada iniciativa reúne sus proyectos; los proyectos independientes conservan su espacio.</p></div>`;
    renderPortfolioResults();
  }
  function renderPortfolioResults(){
    const root=host.querySelector('#pw-portfolio-results');if(!root)return;
    const query=portfolio.search.trim().toLocaleLowerCase(),matches=i=>!query||[i.name,i.description,ownerLabel(i.owner),...initiativeProjects(i.id).map(p=>p.name)].join(' ').toLocaleLowerCase().includes(query);
    const candidates=state.initiatives.filter(i=>portfolio.status==='all'?initiativeStatus(i)!=='archived':initiativeStatus(i)===portfolio.status),items=candidates.filter(matches);
    const independent=state.projects.filter(p=>!p.parentId&&!p.initiativeId&&(!query||[p.name,p.description,ownerLabel(p.owner)].join(' ').toLocaleLowerCase().includes(query)));
    root.innerHTML=`<p class="pw-portfolio-result-count">${items.length} de ${candidates.length} iniciativas${portfolio.status==='all'?' · archivadas aparte':''}</p><section class="pw-initiative-grid ${portfolio.view==='list'?'pw-initiative-list':''}" aria-label="Iniciativas">${items.map(i=>{const projects=initiativeProjects(i.id),subprojects=projects.flatMap(p=>children(p.id)),n=statistics(scopeTasks('initiative:'+i.id));return `<article class="pw-initiative-card" data-pw-initiative-card="${esc(i.id)}"><div class="pw-initiative-card-main"><div class="pw-initiative-card-top">${identity(i)}<span class="pw-initiative-state pw-initiative-${initiativeStatus(i)}"><i aria-hidden="true"></i>${INITIATIVE_STATUS[initiativeStatus(i)]}</span></div><div class="pw-initiative-card-copy"><button class="pw-initiative-name" data-pw-project="initiative:${esc(i.id)}">${esc(i.name)}</button><span class="pw-initiative-card-type">INICIATIVA · ${projects.length} ${projects.length===1?'PROYECTO':'PROYECTOS'}${subprojects.length?' · '+subprojects.length+' SUBPROYECTO'+(subprojects.length===1?'':'S'):''}</span>${i.description?`<p>${esc(i.description)}</p>`:''}</div><div class="pw-initiative-card-context"><span>${esc(ownerLabel(i.owner))}</span>${n.total?healthBadge(projectHealth('initiative:'+i.id)):'<span class="pw-muted">Por organizar</span>'}</div></div><footer><div class="pw-initiative-projects">${projects.length?`<span class="pw-project-avatars" aria-hidden="true">${projects.slice(0,4).map(p=>`<span title="${esc(p.name)}">${esc(initials(p.name))}</span>`).join('')}</span><span>${n.done}/${n.total} tareas</span>`:'<span>Sin proyectos todavía</span>'}</div><button class="pw-initiative-explore" data-pw-project="initiative:${esc(i.id)}" aria-label="Explorar ${esc(i.name)}">Explorar ↗</button></footer></article>`;}).join('')}</section>${items.length?'':`<div class="pw-empty"><h3>${query?'No encontramos iniciativas':portfolio.status==='archived'?'No hay iniciativas archivadas':portfolio.status==='all'?'Empieza por una iniciativa':'No hay iniciativas en este estado'}</h3><p>${query?'Prueba con otro nombre, responsable o proyecto.':'Agrupa un objetivo, negocio o área de trabajo y organiza sus proyectos dentro.'}</p>${!context.readOnly&&!query&&portfolio.status==='all'?button('new-initiative','Crear primera iniciativa','','primary'):''}</div>`}${portfolio.status==='all'&&(independent.length||!query)?`<section class="pw-independent"><header><div><h2>Proyectos independientes</h2><p>Pueden funcionar solos o incorporarse a una iniciativa.</p></div>${!context.readOnly?button('new-project','+ Proyecto independiente'):''}</header><div class="pw-independent-grid">${independent.map(p=>`<article><div>${identity(p,true)}<div><button data-pw-project="${esc(p.id)}">${esc(p.name)}</button><span>${esc(ownerLabel(p.owner))} · ${scopeTasks(p.id).length} tareas</span></div></div>${healthBadge(projectHealth(p.id))}</article>`).join('')||'<p class="pw-muted">Los proyectos que no tengan iniciativa aparecerán aquí.</p>'}</div></section>`:''}`;
  }
  function render(){
    if(!host?.isConnected)return;
    snapshot=window.OplenDemo.snapshot();
    if(!['portfolio','all','mine','archive'].includes(filter.project)&&!project(filter.project)&&!initiative(filter.project.slice(11)))filter.project='all';
    if(filter.project==='portfolio'){renderPortfolio();bind();return;}
    const p=project(filter.project),i=filter.project.startsWith('initiative:')?initiative(filter.project.slice(11)):null;
    const title=p?.name||i?.name||({all:'Todo el trabajo',mine:'Mi trabajo',archive:'Archivo'}[filter.project]);
    const canSummary=!['mine','archive'].includes(filter.project);
    if(!canSummary&&filter.view==='summary')filter.view='list';
    const isSummary=filter.view==='summary';
    host.innerHTML=`<div class="pw-app">
      <header class="pw-head"><div><p class="eyebrow">${esc(snapshot.company?.name||'HORIZONTE')} · ESPACIO DE TRABAJO</p><h1>Proyectos</h1><p>Personas, responsabilidades y trabajo en un mismo lugar.</p></div><span class="pw-demo">${context.readOnly?'Vista de consulta':'Demo · Guardado en este navegador'}</span></header>
      <div class="pw-layout"><aside class="pw-sidebar" aria-label="Proyectos"><div class="pw-side-label">MI ESPACIO</div>${[['portfolio','Portafolio',state.initiatives.filter(i=>initiativeStatus(i)!=='archived').length],['all','Todo el trabajo',state.projects.filter(p=>!p.parentId).length],['mine','Mi trabajo',scopeTasks('mine').filter(t=>t.status!=='done'||t.checklist.some(c=>!c.done&&String(c.owner)===String(context.user.id))).length+state.requests.filter(r=>requestInScope(r,'mine')&&requestPending(r)).length]].map(([id,label,count])=>`<button class="pw-side-item ${filter.project===id?'selected':''}" data-pw-project="${id}" aria-pressed="${filter.project===id}"><span>${label}</span><small>${count}</small></button>`).join('')}<div class="pw-side-label pw-side-heading"><span>PROYECTOS</span>${context.readOnly?'':button('new-project','+','aria-label="Nuevo proyecto"','pw-icon')}</div><div class="pw-tree">${tree()}</div>${context.readOnly?'':button('new-initiative','+ Nueva iniciativa','','pw-text')}<button class="pw-side-item pw-archive-link ${filter.project==='archive'?'selected':''}" data-pw-project="archive" aria-pressed="${filter.project==='archive'}"><span>Archivo</span><small>${state.tasks.filter(t=>t.archived).length}</small></button></aside>
      <section class="pw-work"><header class="pw-work-head"><div>${p?`<p class="pw-breadcrumb">${esc([initiativeFor(p)?.name,parentProject(p)?.name,p.parentId?'Subproyecto':'Proyecto'].filter(Boolean).join(' / '))}</p>`:i?`<p class="pw-breadcrumb">Iniciativa · ${INITIATIVE_STATUS[initiativeStatus(i)]}</p>`:''}<h2>${esc(title)}</h2><p>${esc(p?.description||i?.description||(filter.project==='mine'?'Trabajo asignado y solicitudes de '+context.user.name+'.':filter.project==='archive'?'Las tareas archivadas se pueden restaurar.':'Sigue los proyectos y encuentra el trabajo que necesita atención.'))}</p></div><div class="pw-actions">${p&&!context.readOnly?button('edit-project','Editar proyecto'):''}${i&&!context.readOnly?button('edit-initiative','Editar iniciativa'):''}${!context.readOnly&&isSummary&&(i||filter.project==='all')?button('new-project','+ Proyecto'):''}${!context.readOnly&&filter.project!=='archive'?button('project-templates','Plantillas'):''}${!context.readOnly&&p&&!p.parentId?button('new-subproject','+ Subproyecto'):''}${!context.readOnly&&filter.project!=='archive'?button('new-request','+ Solicitud'):''}${!context.readOnly&&filter.project!=='archive'?button('new-task','+ Nueva tarea','','primary'):''}</div></header>
      <div class="pw-toolbar"><div class="pw-view-switch" role="group" aria-label="Vista de tareas">${[...(canSummary?[['summary','Resumen']]:[]),['list','Lista'],['board','Tablero']].map(([v,l])=>`<button data-pw-view="${v}" aria-pressed="${filter.view===v}" class="${filter.view===v?'selected':''}">${l}</button>`).join('')}</div>${isSummary?'<span class="pw-view-caption">El avance incluye los subproyectos</span>':`<label class="pw-search"><span class="pw-sr">Buscar tareas</span><input type="search" id="pw-search" placeholder="Buscar trabajo o solicitudes…" value="${esc(filter.search)}"></label>`}</div>
      ${isSummary?'':`<div class="pw-filters">${filter.project==='archive'?'':`<label><span>Mostrar</span><select data-pw-filter="work">${options([['all','Tareas y solicitudes'],['tasks','Solo tareas'],['requests','Solo solicitudes']],filter.work)}</select></label>`}<label><span>Estado</span><select data-pw-filter="status">${options([['','Todos los estados'],...(filter.work==='requests'?[]:Object.entries(STATUS)),...(filter.project==='archive'||filter.work==='tasks'?[]:Object.entries(REQUEST_STATUS).map(([v,l])=>['request:'+v,'Solicitud · '+l]))],filter.status)}</select></label><label><span>Responsable / revisor</span><select data-pw-filter="person">${options([['','Todo el equipo'],['none','Sin asignar'],...snapshot.people.filter(p=>p.is_active).map(p=>[String(p.id),p.name])],filter.person)}</select></label><label><span>Departamento</span><select data-pw-filter="department">${options([['','Todos'],...[...new Set([...activeTasks().map(departmentFor),...state.requests.map(r=>departmentFor({...r,owner:r.reviewer}))].filter(Boolean))].sort().map(n=>[n,n])],filter.department)}</select></label><label><span>Prioridad</span><select data-pw-filter="priority">${options([['','Todas'],...Object.entries(PRIORITY)],filter.priority)}</select></label><label><span>Fecha</span><select data-pw-filter="due">${options([['','Todas'],['late','Vencidas'],['week','Próximos 7 días'],['none','Sin fecha']],filter.due)}</select></label>${filter.work==='requests'?`<label><span>Tipo</span><select data-pw-filter="requestType">${options([['','Todos los tipos'],...Object.entries(REQUEST_KIND)],filter.requestType)}</select></label>`:''}${filter.work!=='requests'&&filter.project!=='archive'?`<label><span>Atención</span><select data-pw-filter="attention">${options([['','Todo el trabajo'],['all','Con alertas'],['danger','Requiere atención'],['warning','En riesgo'],['blocked','Bloqueadas']],filter.attention)}</select></label>`:''}<span id="pw-count"></span>${button('clear-filters','Limpiar filtros','','pw-text')}</div>`}
      <div id="pw-results"></div></section></div><p class="pw-footnote">Datos ficticios de Horizonte. Los cambios se guardan en este navegador.</p></div>`;
    bind();renderResults();
  }
  function projectCard(p){
    const n=progress(p),depts=[...new Set(scopeTasks(p.id).map(departmentFor).filter(Boolean))];
    return `<article class="pw-project-card"><div class="pw-card-top"><span class="pw-overline">${esc(p.parentId?'SUBPROYECTO':initiativeFor(p)?.name||'PROYECTO INDEPENDIENTE')}</span>${healthBadge(projectHealth(p.id))}</div><button class="pw-card-heading" data-pw-project="${esc(p.id)}"><i class="pw-dot pw-color-${esc(p.color)}"></i>${esc(p.name)}</button><p>${esc(p.description||'Agrega un objetivo para dar contexto al equipo.')}</p><div class="pw-card-person">${avatar(p.owner)}<span class="pw-muted">${dateLabel(p.due)}</span></div><div class="pw-project-meta"><span>${n.done} de ${n.total} tareas</span><b>${n.percent}%</b></div><span class="pw-progress"><i style="width:${n.percent}%"></i></span>${projectHealth(p.id).issues.length?`<button class="pw-card-alert" data-pw-action="view-health" data-pw-target="${esc(p.id)}">${esc(projectHealth(p.id).text)} · Ver motivos →</button>`:''}<div class="pw-project-card-foot"><span>${esc(depts.join(' · ')||'Equipo por asignar')}</span>${button('view-project-work','Ver trabajo →',`data-pw-target="${esc(p.id)}"`,'pw-text')}</div></article>`;
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
    const parts=[],paragraph=[];let list='';
    const inline=value=>esc(value).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
    const flush=()=>{if(paragraph.length){parts.push('<p>'+paragraph.splice(0).map(inline).join('\n')+'</p>');}};
    const closeList=()=>{if(list){parts.push('</'+list+'>');list='';}};
    for(const line of String(d.body).split(/\r?\n/)){
      const heading=line.match(/^#{1,6}\s+(.+)$/),item=line.match(/^(?:(\d+)\.|[-*])\s+(.+)$/);
      if(heading){flush();closeList();parts.push('<h4>'+inline(heading[1])+'</h4>');}
      else if(item){flush();const kind=item[1]?'ol':'ul';if(list!==kind){closeList();list=kind;parts.push('<'+kind+'>');}parts.push('<li>'+inline(item[2])+'</li>');}
      else if(!line.trim()){flush();closeList();}
      else{closeList();paragraph.push(line);}
    }
    flush();closeList();return parts.join('');
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
    host.querySelector('#pw-results').innerHTML=`${healthPanel(filter.project)}${metrics(rows)}${requestQueue(state.requests.filter(r=>requestInScope(r)&&requestPending(r)),true)}${projects.length?`<section class="pw-portfolio"><h3>${p?'Subproyectos':'Proyectos del espacio'}</h3><div class="pw-portfolio-grid">${projects.map(projectCard).join('')}</div></section>`:''}<div class="pw-summary-grid"><section class="pw-summary-panel"><header><div><span class="pw-overline">PRÓXIMOS PASOS</span><h3>Trabajo por atender</h3></div><button data-pw-view="list" class="button pw-text">Ver todas las tareas →</button></header>${pending.map(t=>`<div class="pw-next-task"><div><button class="pw-task-title" data-pw-open="${esc(t.id)}">${esc(t.title)}</button><span class="pw-task-subtitle">${esc(projectPath(t.project))} · ${esc(ownerLabel(t.owner))}</span></div><span class="pw-due ${overdue(t)?'pw-late':''}">${dateLabel(t.due)}${overdue(t)?'<small>Vencida</small>':''}</span></div>`).join('')||'<p class="pw-muted">No hay tareas pendientes. Puedes añadir la siguiente entrega.</p>'}</section><section class="pw-summary-panel"><span class="pw-overline">PERSONAS Y CONTEXTO</span><h3>${p||i?'Responsable':'Equipo involucrado'}</h3>${p||i?personContext((p||i).owner):`<strong class="pw-team-count">${members.length} ${members.length===1?'persona':'personas'}</strong>`}${(p||i)?.due?`<p class="pw-muted">Fecha objetivo: ${dateLabel((p||i).due)}</p>`:''}<p class="pw-muted">${esc(depts.join(' · ')||'Los departamentos aparecerán al asignar trabajo.')}</p>${members.length?`<details class="pw-team-list"><summary>${members.length} ${members.length===1?'persona participa':'personas participan'}</summary>${members.map(id=>`<p>${esc(ownerLabel(id))}<small>${esc(person(id)?.job_title||'')}</small></p>`).join('')}</details>`:''}</section></div>${p||i?`<section class="pw-summary-panel pw-project-context"><span class="pw-overline">CONECTADO CON OPLEN</span><h3>Actividades y documentación</h3><p class="pw-muted">Las tareas se vinculan a responsabilidades del equipo. Aquí encuentras sus criterios y guías.</p>${operations.map(a=>`<details class="pw-activity-detail"><summary>${esc(a.title)}<span>${esc(a.department_name)}</span></summary>${operationContext(a.id)}</details>`).join('')||'<p class="pw-muted">Vincula una actividad desde el detalle de una tarea para ver su contexto aquí.</p>'}</section>`:''}`;
  }
  function renderResults(){
    const root=host.querySelector('#pw-results');if(!root)return;
    if(filter.view==='summary'){renderSummary();return;}
    const rows=filtered(),requests=filteredRequests();host.querySelector('#pw-count').textContent=`${rows.length} tareas · ${requests.length} solicitudes`;
    root.innerHTML=['archive','mine'].includes(filter.project)?'':`<div class="pw-health-strip">${healthBadge(projectHealth(filter.project))}${button('view-health','Ver motivos',`data-pw-target="${esc(filter.project)}"`,'pw-text')}</div>`;
    root.innerHTML+=filter.project==='archive'?'':requestQueue(requests,false);
    if(filter.work==='requests'||filter.requestType||filter.status.startsWith('request:'))return;
    if(!rows.length && (filter.view==='list'||filter.search||filter.status||filter.person||filter.priority||filter.department||filter.due||filter.attention||filter.project==='archive')){
      if(requests.length)return;
      root.innerHTML+=`<div class="pw-empty"><span class="pw-empty-icon" aria-hidden="true">✓</span><h3>${filter.project==='mine'?'No tienes tareas en esta vista':'No hay tareas en esta vista'}</h3><p>Cambia los filtros${filter.project==='archive'?' o archiva una tarea para verla aquí.':' o crea una tarea para empezar.'}</p>${button('clear-filters','Limpiar filtros')}${!context.readOnly&&filter.project!=='archive'?button('new-task','Nueva tarea','','primary'):''}</div>`;return;
    }
    if(filter.view==='board'){
      root.innerHTML+=`<div class="pw-board" aria-label="Tablero de tareas">${Object.entries(STATUS).map(([status,label])=>{const items=rows.filter(t=>t.status===status);return `<section class="pw-column" data-pw-drop="${status}" aria-label="${label}"><header><span><i class="pw-status-dot pw-${status}"></i>${label}</span><small>${items.length}</small></header><div class="pw-column-tasks">${items.map(t=>`<article class="pw-task-card" data-pw-drag="${t.id}" draggable="${!context.readOnly&&!t.archived}"><div class="pw-card-top"><span class="pw-project-tag">${esc(projectPath(t.project))}</span>${pill(t.priority)}</div><button class="pw-task-title" data-pw-open="${t.id}">${esc(t.title)}</button>${sourceBadge(t)}${taskRiskBadge(t)}${mySubtaskNote(t)}<div class="pw-card-person">${avatar(t.owner)}</div><div class="pw-card-meta"><span class="${overdue(t)?'pw-late':''}">${dateLabel(t.due)}${overdue(t)?' · Vencida':''}</span><span>${t.checklist.filter(i=>i.done).length}/${t.checklist.length} subtareas</span></div>${taskStatus(t)}</article>`).join('')||'<p class="pw-column-empty">Sin tareas</p>'}</div>${!context.readOnly&&filter.project!=='archive'?button('new-task','+ Añadir tarea',`data-pw-new-status="${status}"`,'pw-text'):''}</section>`}).join('')}</div><p class="pw-board-hint">Arrastra una tarjeta para cambiar su estado o usa su selector.</p>`;
    }else{
      root.innerHTML+=`<div class="pw-table-wrap"><table class="pw-table"><thead><tr><th>Tarea</th><th>Estado</th><th>Responsable</th><th>Prioridad</th><th>Fecha límite</th><th><span class="pw-sr">Acciones</span></th></tr></thead><tbody>${rows.map(t=>`<tr><td><button class="pw-task-title" data-pw-open="${t.id}">${esc(t.title)}</button><span class="pw-task-subtitle">${esc(projectPath(t.project))} · ${t.checklist.filter(i=>i.done).length}/${t.checklist.length} subtareas${activity(t.activity)?' · '+esc(activity(t.activity).title):''}</span>${sourceBadge(t)}${taskRiskBadge(t)}${mySubtaskNote(t)}</td><td>${taskStatus(t)}</td><td>${avatar(t.owner)}</td><td>${pill(t.priority)}</td><td><span class="pw-due ${overdue(t)?'pw-late':''}">${dateLabel(t.due)}${overdue(t)?'<small>Vencida</small>':''}</span></td><td>${t.archived&&!context.readOnly?button('restore','Restaurar',`data-pw-id="${t.id}"`,'pw-text'):`<button class="pw-open-icon" data-pw-open="${t.id}" aria-label="Abrir ${esc(t.title)}">↗</button>`}</td></tr>`).join('')}</tbody></table></div>`;
    }
  }
  function changeStatus(id,status){
    try{if(!STATUS[status])throw new Error('Selecciona un estado válido.');commit(next=>{const t=next.tasks.find(t=>t.id===id);if(!t||t.archived)throw new Error('Esta tarea ya no está activa.');if(t.status!==status){t.status=status;if(status==='done'&&t.blockedReason){t.blockedReason='';log(t,'Bloqueo resuelto al completar la tarea');}log(t,'Estado cambiado a '+STATUS[status]);}});render();notify('Estado actualizado.');}catch(e){notify(e.message,true);renderResults();}
  }
  function clearFilters(){Object.assign(filter,{search:'',status:'',person:'',priority:'',department:'',due:'',work:'all',requestType:'',attention:''});}
  function bind(){
    host.onclick=e=>{
      const el=e.target.closest('button');if(!el||!host.contains(el))return;
      if(el.dataset.pwPortfolioStatus!==undefined){portfolio.status=el.dataset.pwPortfolioStatus;render();return;}
      if(el.dataset.pwPortfolioView){portfolio.view=el.dataset.pwPortfolioView;render();return;}
      if(el.dataset.pwToggle){const key=el.dataset.pwToggle;collapsed.has(key)?collapsed.delete(key):collapsed.add(key);render();host.querySelector('[data-pw-toggle=\"'+CSS.escape(key)+'\"]')?.focus();return;}
      if(el.dataset.pwProject){filter.project=el.dataset.pwProject;filter.view=['mine','archive'].includes(filter.project)?'list':'summary';clearFilters();render();return;}
      if(el.dataset.pwView){filter.view=el.dataset.pwView;render();return;}
      if(el.dataset.pwRequest){openRequest(el.dataset.pwRequest);return;}
      if(el.dataset.pwOpen){openTask(el.dataset.pwOpen);return;}
      switch(el.dataset.pwAction){
        case 'view-health':openHealth(el.dataset.pwTarget||filter.project);break;
        case 'project-templates':openTemplates();break;
        case 'new-project':openProject();break;
        case 'new-subproject':openProject(null,filter.project);break;
        case 'new-initiative':openInitiative();break;
        case 'edit-initiative':openInitiative(filter.project.slice(11));break;
        case 'view-project-work':filter.project=el.dataset.pwTarget;filter.view='list';clearFilters();render();break;
        case 'edit-project':openProject(filter.project);break;
        case 'new-request':openRequest();break;
        case 'view-requests':clearFilters();filter.work='requests';filter.view='list';render();break;
        case 'new-task':openTask(null,el.dataset.pwNewStatus);break;
        case 'clear-filters':clearFilters();render();break;
        case 'restore':try{commit(next=>{const t=next.tasks.find(t=>t.id===el.dataset.pwId);t.archived=false;log(t,'Tarea restaurada');});render();notify('Tarea restaurada.');}catch(e){notify(e.message,true);}break;
      }
    };
    host.oninput=e=>{if(e.target.id==='pw-portfolio-search'){portfolio.search=e.target.value;renderPortfolioResults();return;}if(e.target.id==='pw-search'){filter.search=e.target.value;renderResults();}};
    host.onchange=e=>{if(e.target.dataset.pwFilter){const key=e.target.dataset.pwFilter;filter[key]=e.target.value;if(key==='work'){filter.status='';filter.requestType='';filter.attention='';render();}else if(key==='attention'){if(filter.attention){filter.work='tasks';filter.requestType='';if(filter.status.startsWith('request:'))filter.status='';}render();}else renderResults();}if(e.target.dataset.pwStatus)changeStatus(e.target.dataset.pwStatus,e.target.value);};
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
  const requestPending = r => ['new','review'].includes(r.status);
  const linkedTask = r => state.tasks.find(t=>t.id===r.taskId);
  const requestState = r => r.status==='accepted'&&linkedTask(r)?.status==='done'?'resolved':r.status;
  const requestAuthor = r => person(r.requester)?.name||r.requesterName||'Colaborador';
  const requestDefaultReviewer = projectId => {const p=project(projectId);return p?.owner||parentProject(p)?.owner||initiativeFor(p)?.owner||null;};
  function canReviewRequest(r){
    const p=project(r.project),id=String(context.user.id);
    return !context.readOnly&&(context.user.role==='admin'||[r.reviewer,p?.owner,parentProject(p)?.owner,initiativeFor(p)?.owner].filter(Boolean).some(value=>String(value)===id));
  }
  function requestInScope(r,scope=filter.project){
    if(scope==='archive')return false;
    if(scope==='mine')return [r.requester,r.reviewer].some(id=>String(id)===String(context.user.id));
    return inScope({project:r.project,owner:r.reviewer,checklist:[]},scope);
  }
  function filteredRequests(){
    if(filter.project==='archive'||filter.work==='tasks')return [];
    const query=filter.search.trim().toLocaleLowerCase();
    return state.requests.filter(r=>requestInScope(r))
      .filter(r=>filter.status?filter.status==='request:'+requestState(r):filter.work==='requests'||requestPending(r))
      .filter(r=>(!filter.requestType||r.kind===filter.requestType)&&(!filter.priority||r.priority===filter.priority))
      .filter(r=>!filter.person||(filter.person==='none'?!r.reviewer:String(r.reviewer)===filter.person))
      .filter(r=>!filter.department||departmentFor({...r,owner:r.reviewer})===filter.department)
      .filter(r=>!filter.due||(filter.due==='none'?!r.due:requestPending(r)&&r.due&&(filter.due==='late'?r.due<day():r.due>=day()&&r.due<=day(7))))
      .filter(r=>!query||[r.title,r.description,requestAuthor(r),ownerLabel(r.reviewer),projectPath(r.project)].join(' ').toLocaleLowerCase().includes(query))
      .sort((a,b)=>Number(requestPending(b))-Number(requestPending(a))||b.createdAt.localeCompare(a.createdAt));
  }
  function requestChip(r){return `<span class="pw-request-state pw-request-${requestState(r)}">${esc(REQUEST_STATUS[requestState(r)])}</span>`;}
  function requestQueue(rows,summary){
    if(!summary&&!rows.length&&filter.work!=='requests'&&!filter.requestType&&!filter.status.startsWith('request:'))return '';
    return `<section class="pw-requests" aria-label="Solicitudes y feedback"><header><div><span class="pw-overline">SOLICITUDES Y FEEDBACK</span><h3>${summary?'Por revisar':filter.work==='requests'?'Seguimiento de solicitudes':'Por revisar'} <span>${rows.length}</span></h3></div>${summary?button('view-requests','Ver solicitudes →','','pw-text'):''}</header>${(summary?rows.slice(0,3):rows).map(r=>{const t=linkedTask(r);return `<article class="pw-request-row" data-pw-request-row="${esc(r.id)}"><div><div class="pw-request-meta"><span class="pw-request-kind">${esc(REQUEST_KIND[r.kind])}</span>${requestChip(r)}${pill(r.priority)}</div><button type="button" class="pw-task-title" data-pw-request="${esc(r.id)}">${esc(r.title)}</button><span class="pw-task-subtitle">${esc(projectPath(r.project))} · De ${esc(requestAuthor(r))}</span></div><div class="pw-request-reviewer"><span>Revisa ${esc(ownerLabel(r.reviewer))}</span>${r.due?`<small>Fecha solicitada: ${dateLabel(r.due)}</small>`:''}${t?`<button type="button" class="button pw-text" data-pw-open="${esc(t.id)}">Ver tarea · ${esc(STATUS[t.status])}${t.archived?' · Archivada':''} →</button>`:`<button type="button" class="button pw-text" data-pw-request="${esc(r.id)}">${canReviewRequest(r)&&requestPending(r)?'Revisar':'Ver detalle'} →</button>`}</div></article>`;}).join('')||`<p class="pw-muted">${summary?'Las peticiones, errores y mejoras del proyecto se revisan aquí antes de convertirse en tareas.':'No hay solicitudes con estos filtros.'}</p>`}${!context.readOnly&&!rows.length?button('new-request','+ Registrar solicitud','','secondary'):''}</section>`;
  }
  function sourceBadge(t){const r=state.requests.find(r=>r.id===t.sourceRequestId);return r?`<span class="pw-source-badge">Origen: ${esc(REQUEST_KIND[r.kind])}</span>`:'';}
  function requestComments(r){return r.comments.map(c=>`<article><header><b>${esc(c.author)}</b><time>${dateLabel(c.at.slice(0,10))}</time></header><p>${esc(c.body)}</p></article>`).join('')||'<p class="pw-muted">Todavía no hay comentarios.</p>';}
  function sourceRequestPanel(t){
    const r=t&&state.requests.find(r=>r.id===t.sourceRequestId);if(!r)return '';
    return `<details class="pw-source-panel"><summary>Origen: ${esc(REQUEST_KIND[r.kind])} · ${esc(r.title)}</summary><p class="pw-muted">${esc(requestAuthor(r))} · ${dateLabel(r.createdAt.slice(0,10))} · ${esc(projectPath(r.project))}</p><p class="pw-request-description">${esc(r.description)}</p>${r.decision?`<p><b>Decisión:</b> ${esc(r.decision)}</p>`:''}<h3>Conversación original</h3><div class="pw-comment-list">${requestComments(r)}</div></details>`;
  }
  function logRequest(r,body){r.updatedAt=now();r.history.unshift({body,author:context.user.name,at:now()});r.history=r.history.slice(0,60);}
  function openRequest(id){
    const existing=state.requests.find(r=>r.id===id);if(id&&!existing){notify('Esta solicitud ya no está disponible.',true);return;}
    if(!existing&&context.readOnly)return;
    const target=project(filter.project)||state.projects.find(p=>!p.parentId&&(!filter.project.startsWith('initiative:')||p.initiativeId===filter.project.slice(11)));
    if(!existing&&!target){openProject();notify('Crea primero un proyecto para recibir solicitudes.');return;}
    const r=structuredClone(existing||{id:uid(),project:target.id,kind:'request',title:'',description:'',requester:context.user.id,requesterName:context.user.name,reviewer:requestDefaultReviewer(target.id),priority:'normal',due:'',activity:null,status:'new',taskId:null,decision:'',comments:[],history:[],createdAt:now(),updatedAt:now()});
    const pending=requestPending(r),reviewer=canReviewRequest(r),editable=!context.readOnly&&pending&&(!existing||reviewer||String(r.requester)===String(context.user.id));
    const t=existing&&linkedTask(existing);
    const d=modal(existing?'Detalle de solicitud':'Nueva solicitud',`<form id="pw-request-form" class="pw-form"><div class="pw-request-intro"><p>Una petición, error o mejora que el equipo revisará antes de asignar su ejecución.</p>${existing?`${requestChip(r)}<p class="pw-muted">De ${esc(requestAuthor(r))} · ${dateLabel(r.createdAt.slice(0,10))}</p>`:`<p class="pw-muted">Solicita: ${esc(context.user.name)}</p>`}</div>${t?`<section class="pw-linked-task"><span class="pw-overline">TAREA VINCULADA</span><h3>${esc(t.title)}</h3><p>${esc(STATUS[t.status])}${t.archived?' · Archivada':''} · ${esc(ownerLabel(t.owner))} · ${dateLabel(t.due)}</p><p class="pw-muted">${esc(projectPath(t.project))}</p>${button('open-linked-task','Abrir tarea →')}</section>`:''}<fieldset ${editable?'':'disabled'}><label class="field"><span>Asunto</span><input name="title" required maxlength="180" value="${esc(r.title)}" placeholder="¿Qué necesitas o qué podemos mejorar?"></label><div class="pw-form-grid"><label class="field"><span>Tipo de solicitud</span><select name="kind">${options(Object.entries(REQUEST_KIND),r.kind)}</select></label><label class="field"><span>Proyecto</span><select name="project" required>${options(state.projects.map(p=>[p.id,projectPath(p.id)]),r.project)}</select></label></div><label class="field"><span>Contexto y resultado esperado</span><textarea name="description" required maxlength="5000" rows="4" placeholder="Describe la necesidad, el resultado esperado o los pasos para reproducir el error.">${esc(r.description)}</textarea></label><div class="pw-form-grid"><label class="field"><span>Prioridad</span><select name="priority">${options(Object.entries(PRIORITY),r.priority)}</select></label><label class="field"><span>Fecha solicitada</span><input type="date" name="due" value="${esc(r.due)}"></label><label class="field"><span>Responsable de revisión</span><select name="reviewer" ${reviewer?'':'disabled'}>${peopleOptions(r.reviewer)}</select></label><label class="field"><span>Actividad operativa relacionada</span><select name="activity" ${allowed('departments')?'':'disabled'}>${options([['','Sin vincular'],...activities().map(a=>[String(a.id),a.title+' · '+a.department_name]),...(r.activity&&!activity(r.activity)?[[String(r.activity),'Actividad no disponible']]:[])],r.activity)}</select></label></div></fieldset>${existing&&reviewer&&pending?`<section class="pw-request-decision"><h3>Revisión y siguiente paso</h3><p class="pw-muted">Aceptar crea una tarea y conserva aquí la petición original y su conversación.</p><div class="pw-form-grid"><label class="field"><span>Responsable de la tarea</span><select name="assignee">${peopleOptions('')}</select></label><label class="field"><span>Fecha de entrega</span><input type="date" name="delivery" value="${esc(r.due)}"></label></div><label class="field"><span>Decisión o motivo de cierre</span><textarea name="decision" maxlength="2000" rows="2" placeholder="Explica qué se hará o por qué se cierra sin tarea."></textarea></label><div class="pw-decision-actions">${r.status==='new'?'<button type="submit" class="button secondary" data-pw-decision="review">Empezar revisión</button>':''}<button type="submit" class="button secondary" data-pw-decision="decline">Cerrar sin tarea</button><button type="submit" class="button primary" data-pw-decision="accept">Aceptar y crear tarea</button></div></section>`:''}${r.decision?`<section class="pw-request-decision"><h3>Decisión registrada</h3><p class="pw-request-description">${esc(r.decision)}</p></section>`:''}${existing?`<section class="pw-comments"><h3>Conversación <span>${r.comments.length}</span></h3><div class="pw-comment-list">${requestComments(r)}</div>${context.readOnly?'':'<label class="field"><span>Nuevo comentario</span><textarea name="comment" maxlength="2000" rows="2" placeholder="Añade contexto o responde a la revisión…"></textarea></label>'}</section><details class="pw-history"><summary>Historial de la solicitud</summary>${r.history.map(h=>`<p><span>${esc(h.body)}${h.author?' · '+esc(h.author):''}</span><time>${dateLabel(h.at.slice(0,10))}</time></p>`).join('')}</details>`:''}<p data-pw-error class="pw-form-error" role="alert" hidden></p><footer class="pw-dialog-actions">${existing&&reviewer&&r.status==='declined'?'<button type="submit" class="button secondary" data-pw-decision="reopen">Reabrir solicitud</button>':''}${button('cancel',context.readOnly?'Cerrar':'Cancelar')}${context.readOnly?'':`<button type="submit" class="button primary" data-pw-decision="save">${existing?'Guardar cambios':'Registrar solicitud'}</button>`}</footer></form>`,true);
    const form=d.querySelector('form');
    d.querySelector('[data-pw-action="cancel"]').onclick=closeDialog;
    d.querySelector('[data-pw-action="open-linked-task"]')?.addEventListener('click',()=>{closeDialog();openTask(t.id);});
    form.elements.project.addEventListener('change',()=>{form.elements.reviewer.value=requestDefaultReviewer(form.elements.project.value)||'';});
    form.onsubmit=e=>{
      e.preventDefault();if(context.readOnly)return;
      const action=e.submitter?.dataset.pwDecision||'save',v=Object.fromEntries(new FormData(form));
      try{
        if(!['save','review','accept','decline','reopen'].includes(action))throw new Error('Acción de revisión no válida.');
        if(action!=='save'&&(!existing||!canReviewRequest(existing)))throw new Error('Solo el responsable del proyecto o de la revisión puede tomar esta decisión.');
        if(['review','accept','decline'].includes(action)&&!pending)throw new Error('Esta solicitud ya tiene una decisión.');
        if(action==='reopen'&&r.status!=='declined')throw new Error('Esta solicitud no se puede reabrir.');
        const fields=editable?{title:(v.title||'').trim(),description:(v.description||'').trim(),kind:v.kind,project:v.project,priority:v.priority,due:v.due||'',activity:allowed('departments')?(v.activity?Number(v.activity):null):r.activity,reviewer:reviewer?(v.reviewer?Number(v.reviewer):null):(v.project===r.project?r.reviewer:requestDefaultReviewer(v.project))}:{title:r.title,description:r.description,kind:r.kind,project:r.project,priority:r.priority,due:r.due,activity:r.activity,reviewer:r.reviewer};
        if(!fields.title||fields.title.length>180||!fields.description||fields.description.length>5000)throw new Error('Completa el asunto y el contexto de la solicitud.');
        if(!REQUEST_KIND[fields.kind]||!PRIORITY[fields.priority]||!project(fields.project)||!validDate(fields.due)||fields.reviewer&&!person(fields.reviewer))throw new Error('Revisa el proyecto, tipo, prioridad, fecha y responsable.');
        if(fields.activity!==r.activity&&fields.activity&&!activity(fields.activity))throw new Error('Selecciona una actividad publicada.');
        const decision=(v.decision||'').trim(),comment=(v.comment||'').trim();
        if(action==='decline'&&decision.length<3)throw new Error('Escribe el motivo para cerrar la solicitud sin tarea.');
        if(decision.length>2000||comment.length>2000)throw new Error('La decisión y los comentarios admiten hasta 2,000 caracteres.');
        if(action==='accept'&&(!v.assignee||!person(v.assignee)||!person(v.assignee).is_active||!validDate(v.delivery)))throw new Error('Asigna una persona activa y revisa la fecha de entrega.');
        let createdTaskId=null;
        commit(next=>{
          let current=next.requests.find(item=>item.id===r.id);
          if(existing&&!current)throw new Error('La solicitud cambió. Recarga antes de guardar.');
          if(!current){current={...r,comments:[],history:[]};next.requests.push(current);logRequest(current,'Solicitud recibida');}
          if(action==='accept'&&(current.taskId||next.tasks.some(task=>task.sourceRequestId===current.id)))throw new Error('Esta solicitud ya tiene una tarea vinculada.');
          if(['review','accept','decline'].includes(action)&&!requestPending(current))throw new Error('Esta solicitud ya tiene una decisión.');
          if(action==='reopen'&&current.status!=='declined')throw new Error('Esta solicitud ya no está cerrada.');
          Object.assign(current,fields);
          if(comment){if(current.comments.length>=200)throw new Error('Esta conversación alcanzó el límite de comentarios de la demo.');current.comments.push({id:uid(),author:context.user.name,authorId:context.user.id,body:comment,at:now()});logRequest(current,'Comentario añadido');}
          if(action==='review'){current.status='review';logRequest(current,'Revisión iniciada');}
          else if(action==='decline'){current.status='declined';current.decision=decision;logRequest(current,'Cerrada sin tarea: '+decision);}
          else if(action==='reopen'){current.status='new';current.decision='';logRequest(current,'Solicitud reabierta');}
          else if(action==='accept'){
            createdTaskId=uid();const task={id:createdTaskId,title:current.title,description:current.description,project:current.project,owner:Number(v.assignee),due:v.delivery||'',priority:current.priority,activity:current.activity,status:'todo',checklist:[],comments:[],history:[],archived:false,sourceRequestId:current.id,createdAt:now(),updatedAt:now()};
            log(task,'Creada desde '+REQUEST_KIND[current.kind].toLowerCase()+' de '+requestAuthor(current));if(decision)log(task,'Decisión: '+decision);next.tasks.push(task);current.taskId=createdTaskId;current.status='accepted';current.decision=decision;logRequest(current,'Aceptada y convertida en tarea · '+ownerLabel(task.owner));
          }else if(existing)logRequest(current,'Solicitud actualizada');
        });
        closeDialog();filter.project=fields.project;clearFilters();filter.view='list';filter.work=createdTaskId?'all':'requests';render();
        if(createdTaskId){openTask(createdTaskId);notify('Solicitud aceptada. La tarea conserva su origen.');}
        else if(action!=='save'){openRequest(r.id);notify(action==='review'?'Revisión iniciada.':action==='decline'?'Solicitud cerrada con motivo.':'Solicitud reabierta.');}
        else notify(existing?'Solicitud actualizada.':'Solicitud registrada para revisión.');
      }catch(err){errorForm(form,err.message);}
    };
  }

  function openInitiative(id){
    if(context.readOnly)return;
    const existing=initiative(id),item=existing||{name:'',description:'',owner:'',due:'',color:'green',icon:'',status:'active'};
    let logo=safeLogo(item.logo),loading=false;
    const d=modal(existing?'Editar iniciativa':'Nueva iniciativa',`<form id="pw-initiative-form" class="pw-form"><p class="pw-muted">Un objetivo, negocio o área de trabajo con identidad propia. Organiza sus proyectos dentro.</p><div class="pw-identity-editor"><div id="pw-identity-preview">${identity(item)}</div><div><label class="field"><span>Logo de la iniciativa</span><input type="file" name="logoUpload" accept="image/png,image/jpeg,image/webp" aria-label="Logo de la iniciativa"></label><p class="pw-muted">PNG, JPG o WebP · máximo 200 KB.</p>${button('remove-logo','Quitar logo','','pw-text')}</div></div><label class="field"><span>Nombre de la iniciativa</span><input name="name" maxlength="100" required value="${esc(item.name)}" placeholder="Ej. Experiencia del cliente"></label><label class="field"><span>Objetivo compartido</span><textarea name="description" maxlength="2000" rows="3">${esc(item.description)}</textarea></label><div class="pw-form-grid"><label class="field"><span>Iniciales o símbolo</span><input name="icon" maxlength="8" value="${esc(item.icon||'')}" placeholder="Se usan las iniciales del nombre"></label><label class="field"><span>Color</span><select name="color">${options([['green','Verde'],['blue','Azul'],['purple','Violeta'],['orange','Naranja']],item.color||'green')}</select></label><label class="field"><span>Estado de la iniciativa</span><select name="status">${options(Object.entries(INITIATIVE_STATUS),initiativeStatus(item))}</select></label><label class="field"><span>Responsable</span><select name="owner">${peopleOptions(item.owner)}</select></label><label class="field"><span>Fecha objetivo</span><input name="due" type="date" value="${esc(item.due)}"></label></div><p class="pw-muted">Pausar o archivar conserva los proyectos, tareas y conversaciones. Para completar la iniciativa, termina antes sus tareas activas.</p><p data-pw-error class="pw-form-error" role="alert" hidden></p><footer class="pw-dialog-actions">${button('cancel','Cancelar')}<button type="submit" class="button primary">${existing?'Guardar iniciativa':'Crear iniciativa'}</button></footer></form>`);
    const form=d.querySelector('form');
    const preview=()=>{if(d.isConnected)d.querySelector('#pw-identity-preview').innerHTML=identity({name:form.elements.name.value,icon:form.elements.icon.value,color:form.elements.color.value,logo});};
    for(const name of ['name','icon','color'])form.elements[name].addEventListener('input',preview);
    d.querySelector('[data-pw-action="remove-logo"]').onclick=()=>{logo='';form.elements.logoUpload.value='';preview();};
    form.elements.logoUpload.onchange=()=>{
      const file=form.elements.logoUpload.files[0];if(!file)return;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>200*1024){errorForm(form,'Usa un logo PNG, JPG o WebP de hasta 200 KB.');return;}
      loading=true;const reader=new FileReader();
      reader.onload=()=>{loading=false;if(!d.isConnected)return;const candidate=safeLogo(reader.result);if(!candidate){errorForm(form,'No pudimos leer ese logo. Prueba con otra imagen.');return;}logo=candidate;form.querySelector('[data-pw-error]').hidden=true;preview();};
      reader.onerror=()=>{loading=false;if(d.isConnected)errorForm(form,'No pudimos leer ese logo. Prueba con otra imagen.');};reader.readAsDataURL(file);
    };
    d.querySelector('[data-pw-action="cancel"]').onclick=closeDialog;
    form.onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(form));try{
      if(loading)throw new Error('Espera a que termine de cargar el logo.');
      v.name=v.name.trim();v.icon=v.icon.trim();if(!v.name||v.name.length>100)throw new Error('Escribe un nombre de hasta 100 caracteres.');if(!validDate(v.due)||v.owner&&!person(v.owner))throw new Error('Revisa la fecha y el responsable.');if(!INITIATIVE_STATUS[v.status]||!COLORS.includes(v.color)||Array.from(v.icon).length>4)throw new Error('Revisa el estado, color y símbolo (máximo 4 caracteres).');
      if(v.status==='completed'&&existing&&scopeTasks('initiative:'+id).some(t=>t.status!=='done'))throw new Error('Todavía hay tareas activas pendientes. Complétalas antes de cerrar la iniciativa.');
      const target=id||uid();commit(next=>{if(next.initiatives.some(i=>i.id!==id&&i.name.toLocaleLowerCase()===v.name.toLocaleLowerCase()))throw new Error('Ya existe una iniciativa con ese nombre.');const row={id:target,name:v.name,description:v.description.trim(),owner:v.owner?Number(v.owner):null,due:v.due,color:v.color,icon:v.icon,logo,status:v.status};if(existing)Object.assign(next.initiatives.find(i=>i.id===id),row);else next.initiatives.push(row);});
      filter.project=v.status==='archived'?'portfolio':'initiative:'+target;filter.view='summary';if(v.status==='archived'){portfolio.status='archived';portfolio.search='';}clearFilters();closeDialog();render();notify(existing?'Iniciativa actualizada.':'Iniciativa creada. Ahora puedes añadir sus proyectos.');
    }catch(err){errorForm(form,err.message);}};
  }
  const PROJECT_TEMPLATES=[
    {id:'launch',name:'Lanzamiento de producto',category:'Producto',icon:'LP',color:'green',initiative:'Producto y crecimiento',owner:21,description:'Coordina producto, comunicación y soporte para llevar una nueva experiencia al público.',tasks:[
      ['Definir la propuesta y el alcance','Acordar a quién va dirigido, qué se entrega y cómo se medirá el lanzamiento.',0,71,23,'high',['Definir público y resultado esperado','Acordar criterios de aceptación']],
      ['Preparar la campaña','Reunir textos, piezas y calendario de comunicación.',4,22,7,'normal',['Redactar mensajes principales','Revisar piezas y canales']],
      ['Validar la experiencia de registro','Recorrer el flujo principal y resolver los errores antes de publicar.',8,85,26,'high',['Probar el recorrido completo','Registrar y resolver incidencias']],
      ['Preparar al equipo de soporte','Documentar preguntas frecuentes y criterios de escalamiento.',11,32,10,'normal',['Crear respuestas de referencia','Compartir el procedimiento con el equipo']],
      ['Publicar y revisar resultados','Confirmar la salida, observar las primeras señales y registrar aprendizajes.',14,21,7,'high',['Comprobar enlaces y publicación','Revisar resultados y próximos ajustes']]
    ]},
    {id:'onboarding',name:'Onboarding de una persona',category:'Equipo',icon:'ON',color:'purple',initiative:'Desarrollo del equipo',owner:61,description:'Prepara accesos, contexto, acompañamiento y una primera entrega para una nueva incorporación.',tasks:[
      ['Preparar accesos y herramientas','Confirmar que la persona tenga los recursos necesarios para comenzar.',0,88,0,'high',['Validar cuentas y permisos','Comprobar herramientas de trabajo']],
      ['Compartir la guía de bienvenida','Presentar al equipo, los acuerdos y la documentación clave.',1,65,20,'normal',['Revisar la guía con la persona','Presentar responsables y canales']],
      ['Tener la primera conversación','Acordar expectativas, apoyos y objetivos de la primera semana.',2,61,20,'high',['Aclarar responsabilidades iniciales','Agendar el seguimiento']],
      ['Acompañar la primera entrega','Practicar una responsabilidad con criterios claros y retroalimentación.',5,65,20,'normal',['Explicar el procedimiento','Revisar el resultado juntos']],
      ['Cerrar la primera etapa','Revisar avances, dudas y el plan del siguiente mes.',10,61,21,'normal',['Recoger comentarios de la persona','Acordar el siguiente objetivo']]
    ]},
    {id:'content',name:'Calendario de contenido',category:'Marketing',icon:'CC',color:'orange',initiative:'Marketing y contenido',owner:21,description:'Organiza una campaña de contenido desde las ideas hasta la publicación y el aprendizaje.',tasks:[
      ['Definir temas y calendario','Elegir público, objetivo, canales y fechas para la campaña.',0,22,8,'high',['Definir temas y formatos','Distribuir las publicaciones']],
      ['Escribir guiones y textos','Preparar mensajes con un objetivo y llamada a la acción claros.',3,23,8,'normal',['Redactar las primeras versiones','Revisar claridad y tono']],
      ['Producir las piezas','Diseñar o grabar el material listo para cada canal.',6,28,8,'normal',['Producir formatos principales','Revisar adaptaciones']],
      ['Programar y publicar','Verificar enlaces, copys y archivos antes de publicar.',9,22,8,'high',['Comprobar enlaces y formatos','Confirmar la publicación']],
      ['Revisar qué funcionó','Comparar resultados y convertir los aprendizajes en nuevas ideas.',14,25,9,'normal',['Reunir resultados por pieza','Acordar cambios para el siguiente ciclo']]
    ]},
    {id:'help-center',name:'Crear un centro de ayuda',category:'Soporte',icon:'CA',color:'blue',initiative:'Experiencia del cliente',owner:31,description:'Convierte las consultas repetidas en guías claras y criterios que el equipo pueda aplicar.',tasks:[
      ['Identificar las preguntas más frecuentes','Revisar casos y elegir los temas que más fricción generan.',0,32,10,'high',['Agrupar consultas recurrentes','Priorizar los primeros artículos']],
      ['Acordar criterios de respuesta','Definir qué resolver, qué escalar y quién decide cada caso.',3,31,11,'high',['Acordar responsables por caso','Documentar límites y excepciones']],
      ['Redactar las primeras guías','Escribir pasos, ejemplos y resultados esperados.',7,35,10,'normal',['Redactar instrucciones accionables','Añadir ejemplos de respuesta']],
      ['Validar con el equipo','Probar las guías con casos y corregir los puntos confusos.',10,32,10,'normal',['Resolver casos con las guías','Recoger y aplicar comentarios']],
      ['Publicar y mantener','Compartir el centro de ayuda y definir quién lo actualizará.',14,31,10,'normal',['Publicar los artículos aprobados','Asignar una revisión periódica']]
    ]},
    {id:'process',name:'Mejorar un proceso',category:'Operación',icon:'MP',color:'green',initiative:'Eficiencia operativa',owner:11,description:'Diagnostica un proceso, prueba una mejora y deja documentada una forma de trabajo sostenible.',tasks:[
      ['Mapear el proceso actual','Documentar entradas, pasos, responsables y resultado esperado.',0,12,6,'normal',['Dibujar el flujo actual','Identificar decisiones y responsables']],
      ['Medir el problema','Reunir ejemplos y una referencia para comparar la mejora.',3,15,5,'high',['Reunir datos de referencia','Identificar el principal cuello de botella']],
      ['Diseñar la mejora','Elegir un cambio concreto y definir cómo se validará.',6,11,6,'high',['Proponer el nuevo flujo','Acordar el criterio de éxito']],
      ['Probar con un piloto','Aplicar el cambio a un conjunto de casos y observar el resultado.',10,18,6,'normal',['Ejecutar el piloto','Recoger resultados y ajustes']],
      ['Documentar y extender','Actualizar el procedimiento y compartir los acuerdos con el equipo.',14,12,6,'normal',['Publicar el procedimiento actualizado','Confirmar responsables y seguimiento']]
    ]},
    {id:'event',name:'Organizar un evento',category:'Coordinación',icon:'EV',color:'purple',initiative:'Eventos y comunidad',owner:11,description:'Coordina objetivos, logística, comunicación y revisión final para un evento de equipo o comunidad.',tasks:[
      ['Definir el evento','Acordar objetivo, asistentes, fecha y alcance.',0,11,4,'high',['Definir objetivo y formato','Confirmar responsables y alcance']],
      ['Coordinar la logística','Preparar espacio, proveedores, agenda y recursos.',5,18,4,'high',['Revisar recursos necesarios','Confirmar agenda y responsables']],
      ['Preparar la comunicación','Crear la invitación y la información que necesitan los asistentes.',9,22,7,'normal',['Redactar invitación y agenda','Revisar la información de acceso']],
      ['Hacer una revisión técnica','Probar herramientas, accesos y elementos necesarios para el evento.',13,88,0,'high',['Probar equipos y conexiones','Preparar alternativas']],
      ['Realizar el evento','Seguir la agenda y registrar incidencias y acuerdos.',14,11,4,'high',['Confirmar que cada área esté lista','Registrar acuerdos y pendientes']],
      ['Cerrar y recoger aprendizajes','Revisar resultados y documentar mejoras para el siguiente evento.',16,13,6,'normal',['Recoger comentarios','Cerrar pendientes y aprendizajes']]
    ]}
  ].map(t=>({...t,tasks:t.tasks.map(([title,description,offset,owner,activity,priority,checklist])=>({title,description,offset,owner,activity,priority,checklist}))}));
  const templateDate=(start,offset)=>{const d=new Date(start+'T12:00:00');d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const uniqueName=(name,items)=>{let n=name,i=2;while(items.some(p=>p.name.toLocaleLowerCase()===n.toLocaleLowerCase()))n=name+' ('+(i++)+')';return n;};
  const availableInitiative=i=>i&&['active','paused'].includes(initiativeStatus(i));
  const templateParents=()=>state.projects.filter(p=>!p.parentId&&(!initiativeFor(p)||availableInitiative(initiativeFor(p))));
  function templateDestination(t){
    const current=project(filter.project),parent=current&&(parentProject(current)||current);
    if(parent&&templateParents().some(p=>p.id===parent.id))return 'project:'+parent.id;
    const i=filter.project.startsWith('initiative:')?initiative(filter.project.slice(11)):state.initiatives.find(i=>i.name.toLocaleLowerCase()===t.initiative.toLocaleLowerCase());
    return availableInitiative(i)?'initiative:'+i.id:'new-initiative';
  }
  function openTemplates(){
    if(context.readOnly)return;
    const d=modal('Plantillas de proyecto',`<section class="pw-template-library"><p class="pw-template-intro">Elige un ejemplo para explorar Oplen. Cada plantilla crea un proyecto editable con tareas, subtareas y fechas a partir del día que elijas.</p><div class="pw-template-grid">${PROJECT_TEMPLATES.map(t=>`<article><div class="pw-template-card-top">${identity(t)}<span class="pw-overline">${esc(t.category)}</span></div><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p><div class="pw-template-meta"><span>${t.tasks.length} tareas · ${t.tasks.reduce((n,s)=>n+s.checklist.length,0)} subtareas</span><span>Plazo sugerido: ${Math.max(...t.tasks.map(s=>s.offset))} días</span></div>${button('preview-template','Ver plantilla →',`data-pw-template="${t.id}" aria-label="Ver plantilla: ${esc(t.name)}"`,'secondary')}</article>`).join('')}</div><footer class="pw-dialog-actions">${button('cancel','Cerrar')}</footer></section>`,true);
    d.querySelector('[data-pw-action="cancel"]').onclick=closeDialog;d.querySelectorAll('[data-pw-template]').forEach(b=>b.onclick=()=>openTemplate(b.dataset.pwTemplate));
  }
  function openTemplate(id){
    if(context.readOnly)return;const t=PROJECT_TEMPLATES.find(t=>t.id===id);if(!t)return;
    const target=uid(),destination=templateDestination(t),initName=uniqueName(t.initiative,state.initiatives);let committed=false;
    const d=modal('Crear desde plantilla',`<form id="pw-template-form" class="pw-form"><div class="pw-template-selected">${identity(t)}<div><span class="pw-overline">${esc(t.category)} · PLANTILLA</span><h3>${esc(t.name)}</h3><p>${t.tasks.length} tareas con subtareas · todas comienzan por hacer</p></div></div><label class="field"><span>Nombre del proyecto</span><input name="name" maxlength="100" required value="${esc(uniqueName(t.name,state.projects))}"></label><label class="field"><span>Objetivo</span><textarea name="description" rows="2" maxlength="2000">${esc(t.description)}</textarea></label><div class="pw-form-grid"><label class="field"><span>Fecha de inicio</span><input type="date" name="start" required value="${day()}"></label><label class="field"><span>Responsable del proyecto</span><select name="owner">${peopleOptions(activeOwner(t.owner)?t.owner:'')}</select></label></div><label class="field"><span>Ubicación del proyecto</span><select name="destination">${options([['new-initiative','Crear una nueva iniciativa'],['independent','Proyecto independiente'],...state.initiatives.filter(availableInitiative).map(i=>['initiative:'+i.id,'Iniciativa · '+i.name]),...templateParents().map(p=>['project:'+p.id,'Subproyecto de · '+projectPath(p.id)])],destination)}</select></label><label class="field" data-pw-new-template-initiative><span>Nombre de la nueva iniciativa</span><input name="initiativeName" maxlength="100" value="${esc(initName)}"></label><label class="field"><span>Asignación de tareas</span><select name="assignment">${options([['suggested','Responsables sugeridos de Horizonte'],['owner','Usar responsable del proyecto'],['none','Dejar sin asignar']],'suggested')}</select></label><section class="pw-template-preview" aria-label="Tareas de la plantilla"><h3>Lo que incluye</h3><p class="pw-muted">Las fechas se ajustan al inicio elegido. Después podrás editar cada tarea y su contexto de Oplen.</p><div id="pw-template-preview-items"></div></section><p data-pw-error class="pw-form-error" role="alert" hidden></p><footer class="pw-dialog-actions">${button('back-templates','← Plantillas')}${button('cancel','Cancelar')}<button type="submit" class="button primary">Crear proyecto de ejemplo</button></footer></form>`,true);
    const form=d.querySelector('form');
    const ownerFor=(spec,v)=>v.assignment==='none'?null:v.assignment==='owner'?(v.owner?Number(v.owner):null):activeOwner(spec.owner)?spec.owner:null;
    const preview=()=>{const v=Object.fromEntries(new FormData(form));form.querySelector('[data-pw-new-template-initiative]').hidden=v.destination!=='new-initiative';const dates=Boolean(v.start)&&validDate(v.start);d.querySelector('#pw-template-preview-items').innerHTML=t.tasks.map((s,index)=>{const date=dates?templateDate(v.start,s.offset):'';return `<article><span class="pw-template-step">${index+1}</span><div><h4>${esc(s.title)}</h4><p>${esc(s.description)}</p><div class="pw-template-task-meta"><span>${esc(ownerLabel(ownerFor(s,v)))}</span><time data-pw-template-date>${date&&validDate(date)?dateLabel(date):'Elige una fecha válida'}</time>${activity(s.activity)?`<span>${esc(activity(s.activity).title)}</span>`:''}</div><details><summary>${s.checklist.length} subtareas</summary><ul>${s.checklist.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details></div></article>`;}).join('');};
    for(const field of ['start','owner','destination','assignment'])form.elements[field].addEventListener('change',preview);preview();
    d.querySelector('[data-pw-action="cancel"]').onclick=closeDialog;d.querySelector('[data-pw-action="back-templates"]').onclick=openTemplates;
    form.onsubmit=e=>{e.preventDefault();if(committed||context.readOnly)return;const v=Object.fromEntries(new FormData(form));try{
      v.name=v.name.trim();v.initiativeName=v.initiativeName.trim();if(!v.name||v.name.length>100)throw new Error('Escribe un nombre de hasta 100 caracteres.');if(!v.start||!validDate(v.start)||t.tasks.some(s=>!validDate(templateDate(v.start,s.offset))))throw new Error('Elige una fecha de inicio válida para todas las entregas.');if(v.owner&&!activeOwner(v.owner))throw new Error('Selecciona un responsable disponible.');if(!['suggested','owner','none'].includes(v.assignment)||v.assignment==='owner'&&!v.owner)throw new Error('Selecciona un responsable del proyecto para asignar sus tareas.');
      let parentId=null,initiativeId=null,newInitiative=null;
      if(v.destination==='new-initiative'){if(!v.initiativeName||v.initiativeName.length>100)throw new Error('Escribe un nombre para la nueva iniciativa.');if(state.initiatives.some(i=>i.name.toLocaleLowerCase()===v.initiativeName.toLocaleLowerCase()))throw new Error('Esa iniciativa ya existe. Selecciónala en Ubicación del proyecto o cambia el nombre.');initiativeId=uid();newInitiative={id:initiativeId,name:v.initiativeName,description:t.description,owner:v.owner?Number(v.owner):null,due:templateDate(v.start,Math.max(...t.tasks.map(s=>s.offset))),color:t.color,icon:t.icon,status:'active'};}
      else if(v.destination.startsWith('initiative:')){initiativeId=v.destination.slice(11);if(!availableInitiative(initiative(initiativeId)))throw new Error('Elige una iniciativa en marcha o en pausa.');}
      else if(v.destination.startsWith('project:')){parentId=v.destination.slice(8);if(!templateParents().some(p=>p.id===parentId))throw new Error('Elige un proyecto principal disponible.');}
      else if(v.destination!=='independent')throw new Error('Selecciona dónde crear el proyecto.');
      commit(next=>{
        if(next.projects.some(p=>p.name.toLocaleLowerCase()===v.name.toLocaleLowerCase()))throw new Error('Ya existe un proyecto con ese nombre. Cambia el nombre para crear otra copia.');
        if(newInitiative)next.initiatives.push(newInitiative);
        next.projects.push({id:target,name:v.name,description:v.description.trim(),owner:v.owner?Number(v.owner):null,due:templateDate(v.start,Math.max(...t.tasks.map(s=>s.offset))),startDate:v.start,color:t.color,parentId,initiativeId,templateId:t.id});
        next.tasks.push(...t.tasks.map(s=>({id:uid(),project:target,title:s.title,description:s.description,status:'todo',owner:ownerFor(s,v),due:templateDate(v.start,s.offset),priority:s.priority,activity:activity(s.activity)?.id||null,checklist:s.checklist.map(title=>({id:uid(),title,status:'todo',done:false,owner:null,due:''})),comments:[],history:[{body:'Creada desde la plantilla «'+t.name+'»',at:now()}],archived:false,createdAt:now(),updatedAt:now(),sourceTemplateId:t.id})));
      });
      committed=true;filter.project=target;filter.view='summary';clearFilters();if(parentId)collapsed.delete(parentId);if(initiativeId)collapsed.delete('initiative:'+initiativeId);closeDialog();render();notify('Proyecto de ejemplo creado con '+t.tasks.length+' tareas.');
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
    const d=modal(existing?'Detalle de tarea':'Nueva tarea',`<form id="pw-task-form" class="pw-form">${sourceRequestPanel(existing)}<fieldset ${locked?'disabled':''}><label class="field"><span>Nombre de la tarea</span><input name="title" required maxlength="180" value="${esc(task.title)}" placeholder="¿Qué hay que hacer?"></label><label class="field"><span>Descripción y resultado esperado</span><textarea name="description" rows="3" maxlength="5000" placeholder="Agrega contexto, criterios y entregable…">${esc(task.description)}</textarea></label><div class="pw-form-grid"><label class="field"><span>Proyecto</span><select name="project" required>${options(state.projects.map(p=>[p.id,projectPath(p.id)]),task.project)}</select></label><label class="field"><span>Responsable</span><select name="owner">${peopleOptions(task.owner)}</select></label><label class="field"><span>Estado</span><select name="status">${options(Object.entries(STATUS),task.status)}</select></label><label class="field"><span>Prioridad</span><select name="priority">${options(Object.entries(PRIORITY),task.priority)}</select></label><label class="field"><span>Fecha límite</span><input name="due" type="date" value="${esc(task.due)}"></label><label class="field"><span>Actividad operativa relacionada</span><select name="activity" ${!allowed('departments')?'disabled':''}>${options([['','Sin vincular'],...activities().map(p=>[String(p.id),p.title+' · '+p.department_name]),...(task.activity&&!activity(task.activity)?[[String(task.activity),'Actividad no disponible']]:[])],task.activity)}</select></label></div><details class="pw-blocker" ${task.blockedReason?'open':''}><summary>Bloqueo${task.blockedReason?' · requiere atención':''}</summary><label class="pw-block-toggle"><input type="checkbox" name="blocked" ${task.blockedReason?'checked':''}> Esta tarea está bloqueada</label><div data-pw-block-fields><label class="field"><span>¿Qué impide avanzar?</span><textarea name="blockedReason" maxlength="1000" rows="2" placeholder="Describe el impedimento y qué hace falta para resolverlo.">${esc(task.blockedReason||'')}</textarea></label></div><p class="pw-muted">El bloqueo se resuelve al desmarcarlo o completar la tarea.</p></details></fieldset><section id="pw-task-context" class="pw-task-context" aria-label="Contexto de Oplen"></section><fieldset ${locked?'disabled':''}><section class="pw-subtasks"><h3>Subtareas <span id="pw-check-count"></span></h3><div id="pw-checklist"></div><div class="pw-add-line"><input id="pw-new-check" aria-label="Nueva subtarea" maxlength="200" placeholder="Añadir una subtarea…">${button('add-check','Añadir')}</div></section></fieldset>${existing?`<section class="pw-comments"><h3>Comentarios <span>${task.comments.length}</span></h3><div class="pw-comment-list">${task.comments.map(c=>`<article><header><b>${esc(c.author)}</b><time>${dateLabel(c.at.slice(0,10))}</time></header><p>${esc(c.body)}</p></article>`).join('')||'<p class="pw-muted">Todavía no hay comentarios.</p>'}</div>${!locked?'<label class="field"><span>Nuevo comentario</span><textarea name="comment" rows="2" maxlength="2000" placeholder="Comparte un avance o una duda…"></textarea></label>':''}</section><details class="pw-history"><summary>Historial de la tarea</summary>${task.history.slice(0,12).map(h=>`<p><span>${esc(h.body)}</span><time>${dateLabel(h.at.slice(0,10))}</time></p>`).join('')}</details>`:''}<p data-pw-error class="pw-form-error" role="alert" hidden></p><footer class="pw-dialog-actions">${existing&&!locked?button('archive-task','Archivar','','pw-danger'):''}${button('cancel',locked?'Cerrar':'Cancelar')}${!locked?`<button class="button primary" type="submit">${existing?'Guardar cambios':'Crear tarea'}</button>`:''}</footer></form>`,true);
    const form=d.querySelector('form');
    const blocked=form.elements.blocked;
    function renderBlocker(){if(form.elements.status.value==='done')blocked.checked=false;blocked.disabled=locked||form.elements.status.value==='done';form.querySelector('[data-pw-block-fields]').hidden=!blocked.checked;}
    blocked.addEventListener('change',renderBlocker);form.elements.status.addEventListener('change',renderBlocker);renderBlocker();
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
    form.onsubmit=e=>{e.preventDefault();if(locked)return;const v=Object.fromEntries(new FormData(form));try{v.title=v.title.trim();if(!v.title)throw new Error('Escribe un nombre para la tarea.');if(!STATUS[v.status]||!PRIORITY[v.priority]||!project(v.project))throw new Error('Revisa el estado, prioridad y proyecto.');if(!validDate(v.due))throw new Error('La fecha no es válida.');if(v.blocked&&v.status!=='done'&&(v.blockedReason||'').trim().length<3)throw new Error('Describe qué impide avanzar antes de guardar el bloqueo.');if(v.owner&&!person(v.owner))throw new Error('Selecciona un responsable del equipo.');if(!allowed('departments'))v.activity=task.activity?String(task.activity):'';if(v.activity&&v.activity!==String(task.activity||'')&&!activity(v.activity))throw new Error('Selecciona una actividad publicada.');if(task.checklist.some(c=>!STATUS[c.status]||!validDate(c.due)||c.owner&&!person(c.owner)))throw new Error('Revisa responsables, estados y fechas de las subtareas.');commit(next=>{const item={title:v.title,description:v.description.trim(),project:v.project,owner:v.owner?Number(v.owner):null,status:v.status,priority:v.priority,due:v.due,activity:v.activity?Number(v.activity):null,blockedReason:v.blocked&&v.status!=='done'?v.blockedReason.trim():'',checklist:task.checklist};let t=next.tasks.find(t=>t.id===id);if(!t){t={id:uid(),comments:[],history:[],createdAt:now(),archived:false};next.tasks.push(t);}const oldStatus=t.status,oldBlock=t.blockedReason||'';Object.assign(t,item);if(oldBlock!==t.blockedReason)log(t,t.blockedReason?'Bloqueo registrado: '+t.blockedReason:'Bloqueo resuelto');log(t,existing?'Tarea actualizada':'Tarea creada');if(oldStatus&&oldStatus!==t.status)log(t,'Estado cambiado a '+STATUS[t.status]);if(v.comment?.trim()){t.comments.push({id:uid(),author:context.user.name,body:v.comment.trim(),at:now()});log(t,'Comentario de '+context.user.name);}});if(filter.view==='summary')filter.view='list';closeDialog();render();notify(existing?'Cambios guardados.':'Tarea creada.');}catch(err){errorForm(form,err.message);}};
  }
  window.addEventListener('storage',e=>{if(e.key!==KEY)return;if(dialog){notify('Hay cambios en otra pestaña. Tu formulario sigue abierto; recarga antes de guardar.',true);return;}try{if(host?.isConnected){state=read();if(state)render();else host.innerHTML='<p role="status">La demo se restableció en otra pestaña. Recarga para continuar.</p>';}}catch(err){notify(err.message,true);}});
  window.addEventListener('hashchange',closeDialog);
  window.OplenProjects={mount(root,opts){closeDialog();host=root;context=opts;snapshot=window.OplenDemo.snapshot();try{load();render();}catch(err){host.innerHTML=`<section class="pw-app pw-empty"><h1>No pudimos abrir los proyectos</h1><p role="alert">${esc(err.message)}</p><p>Comprueba que tu navegador permita guardar datos y vuelve a cargar la página.</p></section>`;}},version:'0.6.1'};
})();
