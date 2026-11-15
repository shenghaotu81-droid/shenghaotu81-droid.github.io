import assert from 'node:assert/strict';
import { bindKeyboard } from '../scripts/keyboard.js';
import { isSoftwareRenderer } from '../scripts/render-policy.js';

const target=new EventTarget(),keys=new Set();let active=true,reading=false,jumps=0,homes=0,reads=0;
const dispose=bindKeyboard({target,keys,isActive:()=>active,isReading:()=>reading,jump:()=>jumps++,home:()=>homes++,read:()=>reads++,pause:()=>{active=false;keys.clear();}});
function key(type,code,repeat=false){const e=new Event(type,{cancelable:true});Object.defineProperties(e,{code:{value:code},repeat:{value:repeat}});target.dispatchEvent(e);return e;}
key('keydown','ShiftLeft');key('keydown','KeyW');assert(keys.has('ShiftLeft')&&keys.has('KeyW'));
assert(key('keydown','Space').defaultPrevented);assert.equal(jumps,1);
key('keydown','Space',true);assert.equal(jumps,1,'Holding Space must not queue repeated jumps');
key('keyup','ShiftLeft');assert(!keys.has('ShiftLeft'));
key('keydown','KeyR');key('keydown','KeyE');assert.equal(homes,1);assert.equal(reads,1);
reading=true;key('keydown','Space');assert.equal(jumps,1);reading=false;
key('keydown','Escape');assert(!active&&keys.size===0);key('keydown','Space');assert.equal(jumps,1);
dispose();
for(const name of ['ANGLE SwiftShader Device','Mesa llvmpipe','softpipe','Microsoft Basic Render Driver'])assert(isSoftwareRenderer(name));
for(const name of ['Intel Iris Xe','NVIDIA GeForce RTX','Apple M2','Adreno 740',''])assert(!isSoftwareRenderer(name));
console.log('Input and software-renderer policy passed without browser or GPU.');
