import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const env=process.env;
const emsdk=env.EMSDK;
if(!emsdk){
  console.error('Emscripten is not configured. Install the Emscripten SDK, set EMSDK, then run npm run build:wasm again.');
  process.exit(1);
}
const toolchain=resolve(emsdk,'upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake');
if(!existsSync(toolchain)){
  console.error(`Emscripten CMake toolchain was not found at ${toolchain}. Check the EMSDK path.`);
  process.exit(1);
}
const emcc=spawnSync('emcc',['--version'],{cwd:root,stdio:'ignore',shell:process.platform==='win32'});
if(emcc.error||emcc.status!==0){
  console.error('emcc is not available on PATH. Activate the Emscripten SDK environment, then retry.');
  process.exit(1);
}
const args=['-S',resolve(root,'cpp'),'-B',resolve(root,'cpp/build')];
args.push(`-DCMAKE_TOOLCHAIN_FILE=${toolchain}`);
const configure=spawnSync('cmake',args,{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
if(configure.error||configure.status!==0){console.error('CMake was not found or could not configure the Emscripten target. Install Emscripten and CMake, then retry.');process.exit(configure.status||1);}
const build=spawnSync('cmake',['--build',resolve(root,'cpp/build'),'--config','Release'],{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
if(build.error||build.status!==0)process.exit(build.status||1);
console.info('Emscripten build finished. Re-run npm run build to include wasm/ in dist/.');
