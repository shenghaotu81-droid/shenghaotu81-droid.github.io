// Run with Node and --import ./tests/register-three.mjs. Never creates a renderer/context.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createWalker } from '../scripts/physics.js';

const start=performance.now();let gpuContexts=0;
const context2d={createRadialGradient:()=>({addColorStop(){}}),fillRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
class Element extends EventTarget{
  style={};hidden=false;open=false;children=[];
  constructor(){super();const names=new Set();this.classList={add:x=>names.add(x),remove:x=>names.delete(x),contains:x=>names.has(x),toggle:(x,on)=>on?names.add(x):names.delete(x)};}
  append(...values){this.children.push(...values);}setAttribute(name,value){this[name]=value;}
  getContext(type){if(type!=='2d'){gpuContexts++;throw new Error('GPU contexts are forbidden in CPU tests');}return context2d;}
  async requestPointerLock(){document.pointerLockElement=this;document.dispatchEvent(new Event('pointerlockchange'));}
}
const elements=new Map();
const doc=new EventTarget();doc.body=new Element();doc.hidden=false;doc.pointerLockElement=null;
doc.createElement=()=>new Element();doc.getElementById=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
doc.querySelectorAll=()=>[];doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
Object.assign(globalThis,{document:doc,window:new EventTarget(),location:{search:'?debug'},innerWidth:800,innerHeight:600,devicePixelRatio:1,matchMedia:()=>({matches:false}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},fetch:()=>{throw new Error('No network requests in CPU tests');}});

const fakeRenderer={domElement:new Element(),shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},info:{render:{calls:0,frame:0,triangles:0}},getContext:()=>({getExtension:()=>null}),setPixelRatio(){},setSize(){},render(){this.info.render.frame++;},dispose(){}};
const data={};for(const name of ['profile','projects','notes','papers','exhibits','ui'])data[name]=JSON.parse(await readFile(new URL('../content/'+name+'.json',import.meta.url)));
data.ui=data.ui.zh;data.language='zh';
const {createGallery}=await import('../scripts/gallery.js');
const read=[];const gallery=await createGallery(data,id=>read.push(id),{makeRenderer:()=>fakeRenderer});
const d=window.galleryDebug,w=d.walker;
function event(type,code,repeat=false){const e=new Event(type,{cancelable:true});Object.defineProperties(e,{code:{value:code},repeat:{value:repeat}});document.dispatchEvent(e);}
const settle=()=>{for(let i=0;i<45;i++)w.step(1/60);};
const place=(x=0,z=19)=>{w.teleport([x,d.terrainHeight(x,z),z]);settle();};
const move=(n,input)=>{for(let i=0;i<n;i++)w.step(1/60,input);return w.foot.toArray();};
function follow(points){let count=0;for(const point of points){let reached=false;for(let i=0;i<600;i++){const p=w.foot,dx=point[0]-p.x,dz=point[2]-p.z,len=Math.hypot(dx,dz);if(len<.35){reached=true;break;}w.step(1/60,{x:dx/len,z:dz/len});count++;}assert(reached,'Unreachable waypoint '+JSON.stringify({point,foot:w.foot.toArray()}));}return count;}

place();const z=w.foot.z;const walk=move(120,{z:1})[2]-z;
place();const run=move(120,{z:1,run:true})[2]-z;assert(run/walk>1.45&&run/walk<1.75);
place();const ground=w.foot.y;w.jump();let peak=ground;
for(let i=0;i<100;i++){if(i===12)w.jump();w.step(1/60);peak=Math.max(peak,w.foot.y);}
assert(peak-ground>.45&&peak-ground<.85&&w.state.grounded);
place();const entered=move(240,{z:-1});assert(entered[2]<12&&entered[2]>3.3);
const exited=move(240,{z:1});assert(exited[2]>17);
place(8,15.8);w.jump();assert(move(180,{z:-1,run:true})[2]>12.2);
d.goTo('deck');settle();assert(Math.abs(w.foot.y-.04)<.03);assert(move(100,{x:1})[0]>51);
place(0,18);const loopSteps=follow(d.trailRoute);

// Physical indoor circuit uses the actual scene's collisions, not a duplicated layout.
place();follow([[0,0,8],[-7.5,0,8],[-7.5,0,-4.5],[8,0,-4.1],[6,0,6.5],[-7,0,6]]);
for(const id of ['about','work','notes','contact']){d.goTo(id);assert.equal(d.state.near,id);gallery.readNearby();assert.equal(read.at(-1),id);}

// Actual keyboard handlers drive the same readInput() consumed by production physics.
gallery.enter();await Promise.resolve();d.simulate(45,{});
event('keydown','ShiftLeft');event('keydown','KeyS');assert(d.state.input.run&&d.state.input.z===1);
d.simulate(20);assert(Math.hypot(...w.state.velocity.filter((_,i)=>i!==1))>3.2);
event('keydown','Space');assert(w.state.jumpBuffered,'Space must reach the live controller');
let keyPeak=w.foot.y;for(let i=0;i<60;i++){d.simulate(1);keyPeak=Math.max(keyPeak,w.foot.y);}
assert(keyPeak>.4&&w.state.grounded);event('keyup','ShiftLeft');event('keyup','KeyS');
event('keydown','Space',true);assert(!w.state.jumpBuffered,'Key repeat must not create another jump');
event('keydown','KeyR');assert(Math.abs(w.foot.z-19)<.01);
event('keydown','Escape');assert(!d.state.active&&!document.pointerLockElement);

// A compact fixture proves roof and thin-wall response without a GPU.
const fixture=new THREE.Group(),material=new THREE.MeshBasicMaterial();
for(const [width,height,depth,x,y,z]of [[12,.2,12,0,-.1,0],[12,.15,12,0,2.075,0],[.04,2,12,2,1,0]]){const m=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);m.position.set(x,y,z);fixture.add(m);}
const probe=createWalker(fixture,[0,0,0]);for(let i=0;i<30;i++)probe.step(1/60);probe.jump();let ceilingPeak=0;
for(let i=0;i<120;i++){probe.step(1/60,{x:1,run:true});ceilingPeak=Math.max(ceilingPeak,probe.foot.y);}
assert(ceilingPeak<.37&&probe.foot.x<1.7&&probe.state.grounded);
let softwareDisposed=false;
await assert.rejects(()=>createGallery(data,()=>{},{makeRenderer:()=>({getContext:()=>({getExtension:()=>({UNMASKED_RENDERER_WEBGL:1}),getParameter:()=> 'ANGLE SwiftShader Device'}),dispose(){softwareDisposed=true;}})}),/Software rendering is disabled/);
assert(softwareDisposed,'Known software contexts must be released before building a world');
assert.equal(gpuContexts,0);
console.log(JSON.stringify({passed:true,gpuContexts,loopSteps,walkRunRatio:run/walk,jumpHeight:peak-ground,ceilingPeak,elapsedMs:Math.round(performance.now()-start),maxRSSMiB:Math.round(process.resourceUsage().maxRSS/1024)}));
