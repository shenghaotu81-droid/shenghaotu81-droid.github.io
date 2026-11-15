import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const root=process.env.THREE_CPU_ROOT||join(tmpdir(),'coast-three');
registerHooks({resolve(specifier,context,next){
  if(specifier==='three')return{url:pathToFileURL(join(root,'build/three.module.js')).href,shortCircuit:true};
  if(specifier.startsWith('three/addons/'))return{url:pathToFileURL(join(root,'examples/jsm',specifier.slice(13))).href,shortCircuit:true};
  return next(specifier,context);
}});
