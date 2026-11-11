import { defineConfig } from 'vite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { elementList } from './src/data/elements.js';
import { molecules } from './src/data/molecules.js';
import { extraMolecules } from './src/data/extraMolecules.js';

const root=process.cwd();
const slug=value=>String(value).replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const pageRoutes=['register','login','forgot-password','account','account/settings','elements','academy','quantum-lab','molecules','discover','glossary'];
const courseRoutes=['atomic-architecture','quantum-states','molecular-bonds','fields-forces','particle-zoo','cosmic-elements'];
const articleRoutes=['inside-the-electron-cloud','water-is-a-strange-liquid','how-starlight-reveals-elements','the-quantum-vacuum','a-map-of-the-standard-model','why-iron-matters-to-stars','magnetic-fields-in-motion','molecules-have-shapes'];
const routeIndexes=[...pageRoutes,...courseRoutes.map(id=>`academy/${id}`),...courseRoutes.flatMap(course=>[1,2,3].map(n=>`academy/${course}/${course}-${String(n).padStart(2,'0')}`)),...articleRoutes.map(id=>`discover/${id}`),...elementList.map(item=>`elements/${item.symbol}`),...Object.keys(molecules).map(id=>`molecules/${slug(id)}`),...Object.keys(extraMolecules).map(id=>`molecules/${slug(id)}`)];

function wasmMiddleware(){
  return {name:'atomix-wasm-static',configureServer(server){server.middlewares.use((req,res,next)=>{
    const pathname=(req.url||'').split('?')[0];
    if(!pathname.startsWith('/wasm/'))return next();
    const file=resolve(root,'wasm',basename(decodeURIComponent(pathname)));
    if(!file.startsWith(resolve(root,'wasm'))||!existsSync(file))return next();
    res.setHeader('Content-Type',extname(file)==='.wasm'?'application/wasm':'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control','no-cache');
    res.end(readFileSync(file));
  });},writeBundle(){
    const out=resolve(root,'dist'),entry=resolve(out,'index.html');
    if(!existsSync(entry))return;
    const html=readFileSync(entry,'utf8');
    for(const route of routeIndexes){const directory=resolve(out,route);mkdirSync(directory,{recursive:true});writeFileSync(resolve(directory,'index.html'),html);}
    const wasmDir=resolve(root,'wasm'),target=resolve(out,'wasm');
    if(existsSync(resolve(wasmDir,'atomix-core.js'))&&existsSync(resolve(wasmDir,'atomix-core.wasm'))){mkdirSync(target,{recursive:true});for(const file of ['atomix-core.js','atomix-core.wasm'])writeFileSync(resolve(target,file),readFileSync(resolve(wasmDir,file)));}
  }};
}

export default defineConfig({
  base:'/',
  plugins:[wasmMiddleware()],
  server:{host:'0.0.0.0',proxy:{'/api':{target:'http://127.0.0.1:3000',changeOrigin:true}}},
  build:{target:'es2022',sourcemap:false},
});
