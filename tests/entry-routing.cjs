const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('demo/backend.js','utf8').split('const KEY=')[0]+"throw new Error('ADAPTER_BOOTED');})();";
function boot(href,src){
 const location=new URL(href);let redirected=null,initialized=false;
 location.replace=url=>{redirected=url};
 const context={URL,URLSearchParams,location,document:{currentScript:src?{src}:null},localStorage:{getItem(){initialized=true;throw new Error('ADAPTER_BOOTED')}},structuredClone,window:{}};
 try{vm.runInNewContext(source,context)}catch(e){if(e.message!=='ADAPTER_BOOTED')throw e;initialized=true}
 return {redirected,initialized};
}
const script='https://demo.oplen.io/demo/demo/backend.js?v=old';
assert.deepEqual(boot('https://demo.oplen.io/#/proyectos',script),{redirected:'/demo/#/proyectos',initialized:false});
assert.deepEqual(boot('https://demo.oplen.io/index.php?previewUser=2#/equipo',script),{redirected:'/demo/?previewUser=2#/equipo',initialized:false});
assert.equal(boot('https://demo.oplen.io/',script).redirected,'/demo/#/inicio');
assert.deepEqual(boot('https://demo.oplen.io/demo/#/proyectos',script),{redirected:null,initialized:true});
assert.equal(boot('https://demo.oplen.io/','https://demo.oplen.io/demo/backend.js').redirected,null);
assert.equal(boot('https://demo.oplenteams.io/','https://demo.oplenteams.io/demo/demo/backend.js').redirected,null);
assert.equal(boot('https://demo.oplen.io/','https://other.example/demo/demo/backend.js').redirected,null);
assert.equal(boot('https://demo.oplen.io/',null).redirected,null);
console.log('PASS: legacy root to Git entry, deep links/query retained, no loops, root installs and other origins unchanged');
