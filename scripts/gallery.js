import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { isWalkable, movePlayer } from './navigation.js';

export async function createGallery(data, onRead) {
  const $ = id => document.getElementById(id);
  const coarse = matchMedia('(pointer:coarse)').matches;
  // The standard mode is intentionally light. High quality is an explicit opt-in.
  const highQuality = !coarse && new URLSearchParams(location.search).get('quality')==='high';
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e4e4d9');
  scene.fog = new THREE.Fog('#e4e4d9', 33, 75);
  const camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, .08, 110);
  camera.position.set(11.6, 7.9, 12.8); camera.lookAt(-1, .5, -3.2);
  const renderer = new THREE.WebGLRenderer({antialias:highQuality, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, highQuality ? 1.5 : 1));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = highQuality; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  $('world').append(renderer.domElement);
  const canvas = renderer.domElement;
  const mat = (color, roughness = .85, metalness = 0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
  const m = {wall:mat('#e9e5dc'),floor:mat('#bfc2b8'),white:mat('#eeeae0',.58),dark:mat('#293c36',.6),green:mat('#557c70'),metal:mat('#a8b2a7',.38,.6),soil:mat('#777d61'),leaf:mat('#66816a'),ink:mat('#333f38')};
  const obstacles = [];
  const animators = [], mixers = [], pending = [];
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const loaded = new Map();
  function mesh(geometry, material, x=0,y=0,z=0,parent=scene) { const o = new THREE.Mesh(geometry, material); o.position.set(x,y,z); o.castShadow = !coarse; o.receiveShadow = true; parent.add(o); return o; }
  function box(w,h,d,x,y,z,material=m.wall,collide=false,parent=scene) { const o=mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z,parent); if(collide) obstacles.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2}); return o; }
  function round(w,h,d,r,x,y,z,material,parent=scene) { return mesh(new RoundedBoxGeometry(w,h,d,2,r),material,x,y,z,parent); }
  function cylinder(rt,rb,h,x,y,z,material,parent=scene) {return mesh(new THREE.CylinderGeometry(rt,rb,h,24),material,x,y,z,parent);}
  function label(text,w,h,x,y,z,rotation=0,opts={}) {
    const c=document.createElement('canvas');c.width=Math.round(w*180);c.height=Math.round(h*180);
    const ctx=c.getContext('2d');ctx.fillStyle=opts.bg||'#eeeae0';ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle=opts.color||'#344b40';ctx.font=`${opts.weight||400} ${opts.size||Math.round(h*85)}px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.textBaseline='middle';ctx.textAlign=opts.align||'left';
    const lines=text.split('\n');lines.forEach((line,i)=>ctx.fillText(line,opts.align==='center'?c.width/2:24,c.height/2+(i-(lines.length-1)/2)*(opts.lineHeight||h*55),c.width-48));
    const texture=new THREE.CanvasTexture(c); texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    const o=mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture}),x,y,z);o.rotation.y=rotation;o.castShadow=false;
    o.userData.setText=next=>{ctx.fillStyle=opts.bg||'#eeeae0';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=opts.color||'#344b40';const lines=next.split('\n');lines.forEach((line,i)=>ctx.fillText(line,opts.align==='center'?c.width/2:24,c.height/2+(i-(lines.length-1)/2)*(opts.lineHeight||h*55),c.width-48));texture.needsUpdate=true;};return o;
  }
  scene.add(new THREE.HemisphereLight('#fff9ec','#899b80',2.2));
  const sun=new THREE.DirectionalLight('#fff7e1',2.6);sun.position.set(-9,18,7);sun.castShadow=highQuality;
  sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:.5,far:60});sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;scene.add(sun);
  const fill=new THREE.DirectionalLight('#dce7e1',1.1);fill.position.set(8,8,-8);scene.add(fill);
  // A single open gallery; a central planted court makes four connected rooms.
  box(28,.3,26,0,-.18,0,m.floor);
  box(26,4.7,.25,0,2.35,-12,m.wall,true);
  box(.25,4.7,24,-13,2.35,0,m.wall,true);
  box(.25,1.05,24,13,.525,0,m.wall,true);
  box(26,1.05,.25,0,.525,12,m.wall,true);
  // Fine architectural edges, no heavy roof or screen effects.
  for(const x of [-13,0,13]) {box(.11,4.8,.11,x,2.4,-12,m.dark);box(.11,4.8,.11,x,2.4,12,m.dark);}
  for(const z of [-12,0,12]) {box(.11,4.8,.11,-13,2.4,z,m.dark);box(.11,4.8,.11,13,2.4,z,m.dark);}
  for(const z of [-12,12]) box(26,.1,.1,0,4.8,z,m.dark);
  for(const x of [-13,13]) box(.1,.1,24,x,4.8,0,m.dark);
  // Window mullions and glass on the light-filled courtyard side.
  const glass=new THREE.MeshPhysicalMaterial({color:'#c8d9ca',transparent:true,opacity:.09,roughness:.2,depthWrite:false});
  for(const z of [-9,-3,3,9]) {box(.08,3.65,.08,13,2.85,z,m.dark);box(.025,3.5,5.85,13,2.85,z,glass);}
  box(.08,.08,24,13,2.9,0,m.dark);
  const jointMaterial=mat('#aeb5a8');
  for(let x=-12;x<=12;x+=3) box(.015,.004,24,x,.002,0,jointMaterial);
  for(let z=-12;z<=12;z+=3) box(26,.004,.015,0,.003,z,jointMaterial);
  // Central garden has a raised, collidable perimeter with clear 3 m passages.
  box(5.4,.42,5.8,0,.21,0,m.white,true);box(5.05,.04,5.45,0,.44,0,m.soil);
  box(5.65,.09,.45,0,.48,3,m.white,true);box(.45,.09,5.65,-2.9,.48,0,m.white,true);
  const grass=new THREE.MeshStandardMaterial({color:'#7b8b68',roughness:1});
  for(let i=0;i<35;i++){const x=Math.sin(i*13.13)*2.1,z=Math.cos(i*7.57)*2.2;mesh(new THREE.IcosahedronGeometry(.12+(i%4)*.035,0),grass,x,.5,z);}
  function loadOnce(url){if(!loaded.has(url)) loaded.set(url,loader.loadAsync(url));return loaded.get(url);}
  function queueAsset(url,position,height,rotation=0,recolor=false,replace=null) {
    pending.push({url,position:new THREE.Vector3(...position),status:'waiting',load:async()=>{
      const gltf=await loadOnce(url);const root=cloneSkeleton(gltf.scene);
      // Use the manufacturer's existing pivots to give the static arm a calm working pose.
      if(url.endsWith('/robot-arm.glb')){root.getObjectByName('element-b').rotation.z=-.45;root.getObjectByName('element-d').rotation.z=1.05;root.getObjectByName('element-f').rotation.z=.35;root.updateMatrixWorld(true);}
      const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());const scale=height/Math.max(size.y,.01);
      root.scale.setScalar(scale);const center=bounds.getCenter(new THREE.Vector3());root.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
      const group=new THREE.Group();group.add(root);group.position.set(...position);group.rotation.y=rotation;
      root.traverse(o=>{if(o.isMesh){o.castShadow=!coarse;o.receiveShadow=true;if(url.includes('/exhibits/')){
        o.material=o.material.clone();o.material.roughness=.7;o.material.metalness=.12;
        o.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          float galleryLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          vec3 galleryPalette = mix(vec3(0.10, 0.17, 0.14), vec3(0.88, 0.87, 0.80), smoothstep(0.04, 0.92, galleryLuma));
          diffuseColor.rgb = mix(galleryPalette, diffuseColor.rgb, 0.12);`);};
        o.material.customProgramCacheKey=()=> 'gallery-palette-v1';
      }else if(recolor){o.material=o.material.clone();const c=o.material.color;if(c.g>c.r*1.08)c.set('#68846c');}}});
      scene.add(group);if(replace)scene.remove(replace);needsRender=true;
      if(gltf.animations.length){const mixer=new THREE.AnimationMixer(root);mixer.clipAction(gltf.animations.find(a=>/idle/i.test(a.name))||gltf.animations[0]).play();mixer.update(0);mixers.push(mixer);}
      if(url.includes('/companion.glb'))animators.push(t=>{if(!reduced){group.position.y=position[1]+Math.sin(t*1.2)*.08;group.rotation.y=rotation+Math.sin(t*.35)*.12;}});
      return group;
    }});
  }
  queueAsset('models/nature/tree_oak.glb',[.45,.47,-.5],4.5,.4,true);
  queueAsset('models/nature/rock_small.glb',[-1.3,.47,1.3],.45,.5);
  queueAsset('models/nature/rock_small.glb',[1.5,.47,1.6],.35,2);
  for(const [x,z,h] of [[17,-8,6],[18,3,4.5],[16,10,5.5],[-17,-5,5.5],[-17,7,5]]) queueAsset('models/nature/tree_oak.glb',[x,0,z],h,x,true);
  box(80,.2,80,0,-.42,0,mat('#c3c8b3'));
  // Garden pots are original code-native geometry and share the room palette.
  function plant(x,z,h=1.2) {
    const g=new THREE.Group();scene.add(g);g.position.set(x,0,z);
    cylinder(.34,.27,.65,0,.325,0,m.white,g);cylinder(.31,.31,.025,0,.66,0,m.soil,g);
    const leaf=new THREE.SphereGeometry(1,10,8);
    for(let i=0;i<7;i++){const a=i*2.4;const o=mesh(leaf,m.leaf,Math.cos(a)*.2,.85+h*.3,Math.sin(a)*.2,g);o.scale.set(.13,h*.55,.055);o.rotation.set(Math.sin(a)*.45,a,Math.cos(a)*.45);}
    obstacles.push({minX:x-.4,maxX:x+.4,minZ:z-.4,maxZ:z+.4});
  }
  plant(-11,-.8,1.5);plant(10,-10,1.5);plant(-10.8,10.4,.9);plant(11,10.3,1.4);
  // Staged plinths. These are explicitly spatial exhibits, never portfolio claims.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
  const shadowContext=shadowCanvas.getContext('2d'),gradient=shadowContext.createRadialGradient(32,32,6,32,32,32);gradient.addColorStop(0,'rgba(30,43,31,.22)');gradient.addColorStop(1,'rgba(30,43,31,0)');shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,64,64);
  const contactShadow=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false});
  function plinth(x,z,w=2,d=2,h=.48) {box(w,h,d,x,h/2,z,m.white,true);box(w+.04,.045,d+.04,x,h+.023,z,m.white);box(w-.15,.04,d-.15,x,.04,z,m.dark);const shadow=mesh(new THREE.PlaneGeometry(w+1.4,d+1.4),contactShadow,x,-.024,z);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;}
  plinth(-5.6,-8.3,2.4,2.4,.52);plinth(10,-8.1,2.4,2.3,.7);plinth(9.5,8,1.7,1.7,.65);
  plinth(-9,5.7,1.7,1.7,.75);
  // The original entrance robot shares the gallery's materials; other prototypes are failure fallbacks.
  function robot(x,z,y) {
    const g=new THREE.Group();g.userData.dynamic=true;scene.add(g);g.position.set(x,y,z);
    const body=round(.78,.95,.46,.12,0,1.18,0,m.white,g);
    round(.71,.59,.5,.13,0,1.98,0,m.white,g);
    round(.59,.32,.045,.08,0,1.99,.257,m.dark,g);
    for(const eye of [-.15,.15]) round(.07,.07,.014,.025,eye,2.02,.287,m.green,g);
    cylinder(.11,.11,.12,0,1.63,0,m.metal,g);
    for(const side of [-1,1]) {
      round(.19,.62,.22,.065,side*.52,1.13,0,m.white,g);cylinder(.1,.1,.18,side*.48,1.45,0,m.metal,g);
      round(.24,.55,.27,.07,side*.23,.42,0,m.white,g);round(.28,.15,.46,.05,side*.23,.08,.08,m.dark,g);
      mesh(new THREE.SphereGeometry(.12,12,10),m.metal,side*.23,.72,0,g);
    }
    round(.36,.035,.025,.01,0,1.36,.24,m.green,g);
    animators.push(t=>{if(!reduced){g.rotation.y=Math.sin(t*.35)*.15;body.position.y=1.18+Math.sin(t*1.3)*.008;}});
    return g;
  }
  function arm(x,z,y) {
    const g=new THREE.Group();g.userData.dynamic=true;g.position.set(x,y,z);scene.add(g);cylinder(.44,.5,.18,0,.09,0,m.dark,g);
    cylinder(.26,.3,.4,0,.35,0,m.white,g);
    const p=new THREE.Group();p.position.y=.55;g.add(p);mesh(new THREE.SphereGeometry(.25,16,12),m.metal,0,0,0,p);
    round(.26,1.1,.3,.07,0,.55,0,m.white,p);
    const q=new THREE.Group();q.position.y=1.08;p.add(q);mesh(new THREE.SphereGeometry(.22,16,12),m.dark,0,0,0,q);round(.2,.95,.24,.06,0,.48,0,m.white,q);
    cylinder(.14,.14,.23,0,1,0,m.metal,q);for(const s of [-1,1])box(.07,.24,.14,s*.13,1.2,0,m.dark,false,q);
    p.rotation.z=.4;q.rotation.z=-1.1;
    animators.push(t=>{p.rotation.z=.4+(reduced?0:Math.sin(t*.5)*.12);q.rotation.z=-1.1+(reduced?0:Math.sin(t*.5+.5)*.15);});return g;
  }
  function drone(x,z,y,small=false) {
    const g=new THREE.Group();g.userData.dynamic=true;g.position.set(x,y,z);scene.add(g);
    const body=mesh(new THREE.SphereGeometry(.35,24,16),m.white,0,0,0,g);body.scale.set(1,.65,.85);
    round(.3,.13,.05,.04,0,0,.28,m.dark,g);mesh(new THREE.SphereGeometry(.055,12,10),m.green,0,0,.31,g);
    for(const s of [-1,1]){box(.5,.04,.05,s*.39,0,0,m.metal,false,g);const ring=mesh(new THREE.TorusGeometry(.23,.025,6,24),m.dark,s*.64,.02,0,g);ring.rotation.x=Math.PI/2;}
    animators.push(t=>{if(!reduced){g.position.y=y+Math.sin(t*1.2)*.1;g.rotation.y=Math.sin(t*.4)*.35;}});if(small)g.scale.setScalar(.75);return g;
  }
  const prototypes={robot:robot(-5.6,-8.3,.56),arm:arm(10,-8.1,.75),drone:drone(9.5,8,1.75),mech:drone(-9,5.7,1.5,true)};
  prototypes.arm.scale.setScalar(.7);
  // The heavy mech is a small study in the reading alcove, not the entrance's focal point.
  for(const e of data.exhibits.items){if(!e.available)continue;const placement={mech:[[-9,.8,5.7],.72,Math.PI/2],arm:[[10,.75,-8.1],1.55,0],drone:[[9.5,1.4,8],.68,-Math.PI/2]}[e.id];if(placement)queueAsset(e.file,placement[0],placement[1],placement[2],false,prototypes[e.id]);}
  // Exhibition walls use high-contrast canvas text; all complete text is also accessible in HTML.
  const zones={
    about:{name:'关于我',number:'01',point:new THREE.Vector3(-8.5,0,-9.4),spawn:[-7.5,1.65,-4.5],yaw:0},
    work:{name:'现在在做的事',number:'02',point:new THREE.Vector3(7,0,-9.3),spawn:[8,1.65,-4.1],yaw:0},
    notes:{name:'学习笔记',number:'03',point:new THREE.Vector3(-11.5,0,6),spawn:[-7,1.65,6],yaw:Math.PI/2},
    contact:{name:'联系方式',number:'04',point:new THREE.Vector3(11.5,0,6.5),spawn:[6,1.65,6.5],yaw:-Math.PI/2}
  };
  const panelPainters=[];
  function panel(x,z,rotation,number,title,subtitle,lines) {
    const g=new THREE.Group();g.position.set(x,2.15,z);g.rotation.y=rotation;scene.add(g);
    const frame=box(4.8,3.35,.08,0,0,0,m.white,false,g);
    // Local panel collision works for both orientations.
    const horizontal=Math.abs(Math.sin(rotation))<.5;
    obstacles.push({minX:x-(horizontal?2.4:.12),maxX:x+(horizontal?2.4:.12),minZ:z-(horizontal?.12:2.4),maxZ:z+(horizontal?.12:2.4)});
    const c=document.createElement('canvas');c.width=1200;c.height=840;const ctx=c.getContext('2d');
    function paint(title,lines){ctx.fillStyle='#edeae1';ctx.fillRect(0,0,1200,840);
    ctx.fillStyle='#527c76';ctx.font='22px monospace';ctx.fillText(number+' / '+subtitle,75,100);
    ctx.fillStyle='#293e34';ctx.font='64px "PingFang SC","Microsoft YaHei",sans-serif';ctx.fillText(title,75,245);
    ctx.strokeStyle='#cbd0c3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(75,300);ctx.lineTo(1125,300);ctx.stroke();
    ctx.font='31px "PingFang SC","Microsoft YaHei",sans-serif';ctx.fillStyle='#5a6c5c';lines.forEach((line,i)=>ctx.fillText(line,75,415+i*90,1050));
    ctx.font='17px monospace';ctx.fillStyle='#6e7f70';ctx.fillText('SPACE NOTES                                      WALK CLOSER TO READ',75,785);}
    paint(title,lines);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    panelPainters.push((title,lines)=>{paint(title,lines);tex.needsUpdate=true;});
    const face=mesh(new THREE.PlaneGeometry(4.65,3.25),new THREE.MeshBasicMaterial({map:tex}),0,0,.049,g);face.castShadow=false;
    box(.6,.025,.15,0,1.8,.15,m.dark,false,g);
    return frame;
  }
  panel(-8.5,-11.75,0,'01','关于我','ABOUT THE EXPLORER',[data.profile.name+' / '+data.profile.nameEn,'香港科技大学（广州） · 2026','机器人 / AI','具身智能 · 物理 AI · 空间智能']);
  panel(6.5,-11.75,0,'02','现在在做的事','IDEAS IN PROGRESS',data.projects.items.slice(0,4).map(e=>e.title));
  panel(-12.75,6,Math.PI/2,'03','学习笔记','NOTES FROM THE FIELD',[data.notes.items.length?`${data.notes.items.length} 篇学习记录`:'学习笔记 · 待补充','C++ / ROBOTICS / AI','论文与阅读 · '+(data.papers.items.length||'待补充'),'走近展板，展开阅读']);
  panel(12.75,6.5,-Math.PI/2,'04','保持联系','LET’S CONNECT',data.profile.contacts.map(c=>c.text));
  const nameSign=label('涂盛皓 / SHENGHAO TU',5.4,.5,0,3.35,-11.8,0,{size:25,align:'center'});
  label('EXPLORING THE PHYSICAL WORLD',5.4,.3,0,2.9,-11.79,0,{size:15,align:'center'});
  const exhibitSigns=[label('空间装置 / SPATIAL STUDIES',2.2,.2,-5.6,.8,-7.08,0,{size:12,align:'center'}),label('空间装置 / SPATIAL STUDIES',2.2,.2,10,1,-6.93,0,{size:12,align:'center'})];
  box(.7,1.15,.16,-2,.575,8,m.white,true);
  label('中 / EN\n语言 / LANGUAGE',1.3,.65,-2,1.32,8.1,0,{size:25,lineHeight:50,align:'center'});
  // Warm, restrained guide strips beside the four approaches.
  for(const [id,z] of Object.entries(zones)){
    const [x,,zz]=z.spawn;const strip=box(.035,.006,1.1,x,.012,zz,m.green);strip.rotation.y=z.yaw;
    const mark=label(z.number, .65,.3,x,.017,zz+.85,0,{size:22,align:'center',bg:'#bfc2b8',color:'#527c76'});mark.rotation.x=-Math.PI/2;
  }
  // Batch static architecture by material; moving exhibits and transparent glass stay separate.
  scene.updateMatrixWorld(true);
  const batches=new Map();
  scene.traverse(o=>{
    if(!o.isMesh||Array.isArray(o.material)||o.material.transparent)return;
    for(let p=o;p;p=p.parent)if(p.userData.dynamic)return;
    if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(o);
  });
  for(const [material,objects]of batches){
    if(objects.length<2)continue;
    const geometries=objects.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);return g;});
    const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    if(merged){const o=new THREE.Mesh(merged,material);o.castShadow=!coarse&&!material.isMeshBasicMaterial;o.receiveShadow=true;scene.add(o);objects.forEach(o=>o.removeFromParent());}
  }
  const keys=new Set();let active=false,started=false,yaw=0,pitch=0,near=null,previous=performance.now(),raf;
  let needsRender=true,lastRender=0;
  let touchLook=null,joyPointer=null,joy={x:0,y:0};let firstFrame=true,assetClock=0,assetBusy=false;
  const position=new THREE.Vector3(0,1.65,9);
  const radius=.3;
  function valid(x,z){return isWalkable(x,z,obstacles,radius);}
  function move(dx,dz){movePlayer(position,dx,dz,obstacles,radius);}
  function updatePose(){camera.position.copy(position);camera.rotation.set(pitch,yaw,0,'YXZ');needsRender=true;}
  function setActive(value){active=value;needsRender=true;previous=performance.now();keys.clear();joy={x:0,y:0};$('stick').style.transform='';$('resume').hidden=value||!started||document.body.classList.contains('reading')||$('reader').open;}
  function pause(){if(document.pointerLockElement===canvas)document.exitPointerLock();setActive(false);}
  function showResume(){if(started){$('resume').hidden=document.body.classList.contains('reading')||$('reader').open;}}
  async function resume(){
    if($('reader').open||document.body.classList.contains('reading'))return;
    if(coarse){setActive(true);return;}
    try{await canvas.requestPointerLock();}catch(e){$('loading-status').textContent='鼠标锁定受限，可拖动画面环顾，WASD 移动。';setActive(true);}
  }
  function enter(){started=true;position.set(0,1.65,9);yaw=0;pitch=0;document.body.classList.add('roaming');$('roam-hud').hidden=false;$('minimap').hidden=false;updatePose();resume();}
  function goTo(id){if(!zones[id])return;if(!started){started=true;document.body.classList.add('roaming');$('roam-hud').hidden=false;$('minimap').hidden=false;}const z=zones[id];position.set(...z.spawn);yaw=z.yaw;pitch=0;updatePose();pause();showResume();updateNearby();}
  function readNearby(){if(near){if(near!=='language')pause();onRead(near);}}
  function updateNearby(){
    let closest=null,best=5.6;
    for(const [id,z]of Object.entries(zones)){const dist=Math.hypot(position.x-z.point.x,position.z-z.point.z);if(dist<best){best=dist;closest=id;}}
    if(Math.hypot(position.x+2,position.z-8)<2.25)closest='language';
    near=closest;$('nearby').hidden=!near||!started;$('nearby-label').textContent=near==='language'?'中 / EN · '+(data.language==='en'?'Language':'切换语言'):near?data.ui.readPanel+' · '+zones[near].name:'';
    $('location-name').textContent=near&&near!=='language'?`${zones[near].number} · ${zones[near].name}`:data.ui.location;
    document.querySelectorAll('[data-zone]').forEach(b=>b.classList.toggle('active',b.dataset.zone===near));
    const mx=6+(position.x+13)/26*128,mz=6+(position.z+12)/24*108;$('map-player').setAttribute('transform',`translate(${mx} ${mz}) rotate(${-yaw*180/Math.PI})`);
  }
  function setLanguage(next){
    data=next;const u=data.ui;for(const [id,z]of Object.entries(zones))z.name=u[id];
    panelPainters[0](u.about,[data.profile.name,u.panelSchool,u.panelDirection,u.panelFocus]);
    panelPainters[1](u.work,data.projects.items.slice(0,4).map(e=>e.title||u.emptyTitle));
    panelPainters[2](u.notes,[data.notes.items.length?data.notes.items.length+' '+u.panelNotes:u.notes+' · '+u.empty,'C++ / ROBOTICS / AI',u.papers+' · '+(data.papers.items.length||u.empty),u.panelRead]);
    panelPainters[3](u.connect,data.profile.contacts.map(c=>c.text));
    nameSign.userData.setText(data.language==='en'?'SHENGHAO TU':'涂盛皓 / SHENGHAO TU');exhibitSigns.forEach(s=>s.userData.setText(u.spatial));needsRender=true;updateNearby();
  }
  setLanguage(data);
  document.addEventListener('pointerlockchange',()=>setActive(document.pointerLockElement===canvas));
  document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select')||$('reader').open||document.body.classList.contains('reading'))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space'].includes(e.code)&&active){e.preventDefault();keys.add(e.code);}if(e.code==='KeyE'&&active)readNearby();if(e.code==='Escape'&&active)pause();});
  document.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();previous=performance.now();});
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&active){yaw-=e.movementX*.002;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.002,-1.25,1.25);}});
  canvas.addEventListener('wheel',e=>{if(!started||!active)return;e.preventDefault();camera.fov=THREE.MathUtils.clamp(camera.fov+e.deltaY*.018,43,66);camera.updateProjectionMatrix();},{passive:false});
  canvas.addEventListener('pointerdown',e=>{if(!active)return;if(coarse||document.pointerLockElement!==canvas){touchLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointermove',e=>{if(!active||touchLook?.id!==e.pointerId)return;yaw-=(e.clientX-touchLook.x)*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-touchLook.y)*.004,-1.25,1.25);touchLook.x=e.clientX;touchLook.y=e.clientY;});
  const endLook=e=>{if(touchLook?.id===e.pointerId)touchLook=null;};canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);
  const joystick=$('joystick');
  function joyUpdate(e){const r=joystick.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/36,y=(e.clientY-r.top-r.height/2)/36;const len=Math.max(1,Math.hypot(x,y));joy={x:x/len,y:y/len};$('stick').style.transform=`translate(${joy.x*30}px,${joy.y*30}px)`;}
  joystick.addEventListener('pointerdown',e=>{if(!active)return;e.preventDefault();joyPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);joyUpdate(e);});
  joystick.addEventListener('pointermove',e=>{if(active&&e.pointerId===joyPointer)joyUpdate(e);});
  const endJoy=e=>{if(e.pointerId===joyPointer){joyPointer=null;joy={x:0,y:0};$('stick').style.transform='';}};joystick.addEventListener('pointerup',endJoy);joystick.addEventListener('pointercancel',endJoy);
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);needsRender=true;});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();document.body.classList.add('reading');$('loading-status').textContent='三维画面已暂停，仍可在文字版阅读全部内容。';});
  async function nearbyAssets(){if(assetBusy)return;const p=started?position:new THREE.Vector3(0,0,0);const task=pending.filter(t=>t.status==='waiting'&&t.position.distanceTo(p)<(started?10:6)).sort((a,b)=>a.position.distanceTo(p)-b.position.distanceTo(p))[0];if(!task)return;assetBusy=true;task.status='loading';try{await task.load();task.status='loaded';}catch(e){task.status='error';console.warn('Exhibit unavailable:',e.message);}finally{assetBusy=false;}}
  function frame(now){raf=requestAnimationFrame(frame);if(document.hidden)return;
    if(now-lastRender<(highQuality?1000/30:1000/24))return;
    const dt=Math.min((now-previous)/1000,.1);previous=now;lastRender=now;
    if(document.body.classList.contains('reading'))return;
    const t=now/1000;
    if(started&&active){let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joy.x;let z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+joy.y;const len=Math.max(1,Math.hypot(x,z));x/=len;z/=len;const speed=2.8*dt;move((x*Math.cos(yaw)+z*Math.sin(yaw))*speed,(-x*Math.sin(yaw)+z*Math.cos(yaw))*speed);updatePose();updateNearby();}
    if(active&&!reduced){animators.forEach(fn=>fn(t));mixers.forEach(m=>m.update(dt));}
    if(needsRender){renderer.render(scene,camera);needsRender=false;}
    if(firstFrame){firstFrame=false;setTimeout(nearbyAssets,350);}assetClock+=dt;if(assetClock>.4){assetClock=0;nearbyAssets();}
  }
  renderer.render(scene,camera);raf=requestAnimationFrame(frame);
  // Read-only diagnostics are opt-in and never enabled on the public site by default.
  if(new URLSearchParams(location.search).has('debug'))window.galleryDebug={get state(){return{position:position.toArray(),yaw,pitch,active,started,near,valid:valid(position.x,position.z),fov:camera.fov,assets:pending.map(p=>({url:p.url,status:p.status,position:p.position.toArray()})),calls:renderer.info.render.calls,frames:renderer.info.render.frame,triangles:renderer.info.render.triangles,quality:highQuality?'high':'standard'};},valid,obstacles,zones:Object.fromEntries(Object.entries(zones).map(([id,z])=>[id,{spawn:z.spawn,yaw:z.yaw}])),goTo,pause};
  return{enter,resume,pause,showResume,goTo,readNearby,setLanguage};
}
