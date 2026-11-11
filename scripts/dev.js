import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const node=process.execPath;
const children=[];
const start=(label,args)=>{
  const child=spawn(node,args,{cwd:root,stdio:'inherit',env:process.env});
  children.push(child);
  child.on('error',error=>{console.error(`[${label}] ${error.message}`);shutdown(1);});
  child.on('exit',(code,signal)=>{if(signal||code!==0){console.error(`[${label}] exited (${signal||code})`);shutdown(code||1);}});
};
let stopping=false;
function shutdown(code=0){if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null)child.kill();setTimeout(()=>process.exit(code),250).unref();}
async function apiAlreadyRunning(){
  try{
    const response=await fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(900)});
    const health=await response.json();
    return response.ok&&health.ok===true&&health.database==='sqlite';
  }catch{return false;}
}
if(!await apiAlreadyRunning())start('api',[resolve(root,'server/index.js')]);
else console.info('[api] ATOMIX API is already running on port 3000.');
start('vite',[resolve(root,'node_modules/vite/bin/vite.js'),'--host','0.0.0.0']);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>shutdown(0));
