import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath=path.join(root,'demo/frontend-source.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const commit=process.argv[2]||manifest.sourceCommit;
if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Usa el SHA completo de un commit.');
const downloads=await Promise.all(manifest.assets.map(async name=>{const r=await fetch('https://raw.githubusercontent.com/'+manifest.sourceRepository+'/'+commit+'/'+name);if(!r.ok)throw Error(name+': '+r.status);return [name,await r.text()]}));
for(const [name,content] of downloads){await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),content);}
manifest.sourceCommit=commit;await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const index=path.join(root,'index.html');await fs.writeFile(index,(await fs.readFile(index,'utf8')).replace(/v=[a-z0-9-]+/g,'v=mirror-'+commit.slice(0,12)));
console.log('Frontend sincronizado: '+commit+'. Revisa el backend simulado y ejecuta las pruebas.');

