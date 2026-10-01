(()=>{'use strict';
 const id=Number(new URLSearchParams(location.search).get('previewUser'));
 const active=Number.isInteger(id)&&id>0;
 const url=value=>{const u=new URL(value,location.href);if(active&&u.origin===location.origin&&u.pathname.includes('/api/'))u.searchParams.set('asUser',String(id));return u.href};
 window.IndiefyPreview={active,id,url,back(){const u=new URL(location.href);u.searchParams.delete('previewUser');u.hash='/administracion/inicio';location.assign(u.href)}};
 if(!active)return;
 const original=window.fetch.bind(window);
 window.fetch=(input,options={})=>{
  const u=new URL(input instanceof Request?input.url:input,location.href);
  if(u.origin!==location.origin||!u.pathname.includes('/api/'))return original(input,options);
  const method=(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  if(method!=='GET')return Promise.resolve(new Response(JSON.stringify({ok:false,error:'Vista de consulta: vuelve a Administración para realizar cambios.'}),{status:403,headers:{'Content-Type':'application/json'}}));
  return original(input instanceof Request?new Request(url(u.href),input):url(u.href),options);
 };
})();
