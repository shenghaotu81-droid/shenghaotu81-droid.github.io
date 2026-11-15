import * as THREE from 'three';

export const COAST = Object.freeze({
  entry: [0, -.04, 19],
  deck: [48, .045, 8],
  garden: [-23, 0, 3],
  trail: [0, 0, -22],
  seaLevel: -1.05,
});

const smooth = (a, b, v) => { const t = THREE.MathUtils.clamp((v-a)/(b-a),0,1); return t*t*(3-2*t); };
export function terrainHeight(x,z) {
  const r=(x/68)**2+(z/58)**2;
  const outside=smooth(14,22,Math.max(Math.abs(x),Math.abs(z)*1.05));
  const hill=(a,b,sx,sz,h)=>h*Math.exp(-(((x-a)/sx)**2+((z-b)/sz)**2));
  const hills=hill(-31,-22,13,12,2.7)+hill(28,-27,15,10,2.1)+hill(-37,23,10,12,1.6)+hill(23,30,13,10,.9);
  return -.04+outside*hills*(1-smooth(.6,1,r))-2.6*smooth(.71,1.06,r);
}

// Terrain, architecture and colliders share coordinates; no separate invisible map.
export function buildCoast({scene,box,mesh,cylinder,mat,materials,addCollider}) {
  const earth=mat('#ffffff');earth.vertexColors=true;
  const terrain=new THREE.PlaneGeometry(160,144,100,90);terrain.rotateX(-Math.PI/2);
  const p=terrain.getAttribute('position'),colors=[];
  const meadow=new THREE.Color('#a5ad88'),sand=new THREE.Color('#c9c0a8'),deep=new THREE.Color('#a9aaa0');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),y=terrainHeight(x,z),r=(x/68)**2+(z/58)**2;
    p.setY(i,y);
    const c=meadow.clone().lerp(sand,smooth(.56,.86,r)).lerp(deep,smooth(.9,1.2,r));
    c.multiplyScalar(.97+.04*Math.sin(x*.47+Math.sin(z*.31)));colors.push(c.r,c.g,c.b);
  }
  terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
  const land=mesh(terrain,earth);land.userData.terrain=true;addCollider(land);

  // A lightweight fixed-afternoon skydome: no HDR download, cubemap bake or post-processing.
  const skyMaterial=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,toneMapped:false,
    uniforms:{top:{value:new THREE.Color('#7fa9c3')},horizon:{value:new THREE.Color('#e5e9df')},sun:{value:new THREE.Vector3(-.62,.49,-.62).normalize()}},
    vertexShader:`varying vec3 vDirection;void main(){vDirection=position;vec4 clip=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.0);gl_Position=clip.xyww;}`,
    fragmentShader:`uniform vec3 top;uniform vec3 horizon;uniform vec3 sun;varying vec3 vDirection;
      void main(){vec3 d=normalize(vDirection);float h=clamp(d.y,0.,1.);vec3 col=mix(horizon,top,pow(h,.48));
      float glow=pow(max(dot(d,sun),0.),40.);col+=vec3(.13,.105,.055)*glow;
      float disk=smoothstep(.99948,.99972,dot(d,sun));col=mix(col,vec3(1.9,1.65,1.16),disk);
      float wisps=sin(d.x*12.+d.z*8.+sin(d.z*9.)*.7);
      float lowBand=(h-.24)/.045;float highBand=(h-.42)/.025;
      float cloudBand=exp(-lowBand*lowBand)+exp(-highBand*highBand)*.45;
      float cloud=smoothstep(-.2,.8,wisps)*cloudBand;
      col=mix(col,horizon,cloud*.23);gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const sky=mesh(new THREE.SphereGeometry(640,24,12),skyMaterial);sky.castShadow=false;sky.receiveShadow=false;sky.userData.unbatched=true;sky.renderOrder=1000;sky.frustumCulled=false;
  const seaMaterial=new THREE.ShaderMaterial({
    toneMapped:false,
    uniforms:{shallow:{value:new THREE.Color('#91aca4')},deep:{value:new THREE.Color('#668e94')}},
    vertexShader:`varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
    fragmentShader:`uniform vec3 shallow;uniform vec3 deep;varying vec3 vWorld;
      void main(){float dist=length(vWorld.xz);vec3 col=mix(shallow,deep,smoothstep(55.,200.,dist));
      float ripple=sin(vWorld.x*2.1+sin(vWorld.z*.8))*.5+sin(vWorld.z*3.7+vWorld.x*.4)*.3;
      col+=ripple*.012;float haze=smoothstep(130.,480.,dist);col=mix(col,vec3(.65,.73,.72),haze);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const sea=mesh(new THREE.PlaneGeometry(1250,1250),seaMaterial,0,COAST.seaLevel,0);sea.rotation.x=-Math.PI/2;sea.castShadow=false;sea.receiveShadow=false;sea.userData.unbatched=true;

  const gravel=mat('#d3cbb6',1),stone=mat('#9b9e8a',.97),wood=mat('#a69a7d',.92),woodEdge=mat('#817960',.95);
  // Shared 64px contact shadows anchor the planting without a real-time shadow pass.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
  const sc=shadowCanvas.getContext('2d'),sg=sc.createRadialGradient(32,32,2,32,32,32);
  sg.addColorStop(0,'rgba(39,48,33,.17)');sg.addColorStop(.55,'rgba(39,48,33,.08)');sg.addColorStop(1,'rgba(39,48,33,0)');sc.fillStyle=sg;sc.fillRect(0,0,64,64);
  const shadowMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false});
  function softShadow(x,z,w,d){
    const g=new THREE.PlaneGeometry(w,d);g.rotateX(-Math.PI/2);
    const o=mesh(g,shadowMat,x,terrainHeight(x,z)+.022,z);
    const dx=(terrainHeight(x+.1,z)-terrainHeight(x-.1,z))/.2,dz=(terrainHeight(x,z+.1)-terrainHeight(x,z-.1))/.2;
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-dx,1,-dz).normalize());o.castShadow=false;
  }
  function ribbon(points,width,closed=false){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),closed,'centripetal');
    const pos=[],indices=[],steps=closed?128:48;
    for(let i=0;i<=steps;i++){
      const t=i/steps,a=curve.getPoint(t),tangent=curve.getTangent(t),side=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
      for(const s of [-1,1]){const x=a.x+side.x*width/2*s,z=a.z+side.z*width/2*s;pos.push(x,terrainHeight(x,z)+.018,z);}
      if(i<steps){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();mesh(g,gravel);
    return curve;
  }
  const trailCurve=ribbon([[0,18],[20,18],[27,4],[23,-18],[4,-23],[-21,-19],[-28,-1],[-23,18]],2.2,true);
  ribbon([[0,11.7],[0,16],[0,21]],4);
  ribbon([[25,8],[31,8],[36,8]],2.6);
  ribbon([[-24,4],[-19,3],[-15,6]],1.5);
  // Floating-looking timber platform with a solid, flush approach and restrained railings.
  box(22,.2,4,47,-.06,8,woodEdge,true);
  for(let i=0;i<44;i++)box(.485,.035,4,36.25+i*.5,.0575,8,wood);
  for(const z of [6.1,9.9]){
    for(let x=39;x<=57;x+=3)box(.045,1.03,.045,x,.56,z,materials.dark);
    box(18,.045,.045,48,1.1,z,materials.dark,true);
  }
  for(const z of [6.1,8,9.9])box(.045,1.03,.045,57.8,.56,z,materials.dark);
  box(.045,.045,4,57.8,1.1,8,materials.dark,true);
  // Benches sit beside the path; their low seats can be reached by a small jump.
  for(const [x,z,rotation]of [[-22,3,.15],[17.5,15.5,-.3],[49,9.1,0]]){
    const g=new THREE.Group();g.position.set(x,terrainHeight(x,z),z);g.rotation.y=rotation;scene.add(g);
    const seat=box(2.8,.12,.65,0,.46,0,wood,false,g);addCollider(seat);
    for(const s of [-1,1])box(.12,.4,.5,s*1.05,.2,0,materials.dark,false,g);
  }

  // Sparse olive-like trees: shared matte materials and batched geometry.
  const leafMaterials=['#75856a','#839174','#6b7d63'].map(c=>mat(c));const trunk=mat('#7c7662');
  function branch(parent,a,b,r){const delta=b.clone().sub(a),o=new THREE.Mesh(new THREE.CylinderGeometry(r*.65,r,delta.length(),7),trunk);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());parent.add(o);o.castShadow=true;return o;}
  const treeSites=[[-18,15,4.8],[-25,11,5.3],[-31,-3,5.6],[-21,-11,4.6],[-33,-20,5.2],[-9,-26,5.5],[15,-24,4.6],[28,-14,5.8],[31,0,4.4],[24,22,5.4],[13,28,4.8],[-15,28,5],[-35,20,4.5]];
  for(let k=0;k<treeSites.length;k++){
    const[x,z,h]=treeSites[k],y=terrainHeight(x,z),g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=k*1.73;scene.add(g);
    softShadow(x+.65,z+.65,h*1.05,h*.83);
    const stem=branch(g,new THREE.Vector3(0,0,0),new THREE.Vector3(.13,h*.68,0),.13);addCollider(stem);
    for(let i=0;i<6;i++){
      const a=i*2.4,dx=Math.cos(a)*h*.19,dz=Math.sin(a)*h*.18,dy=h*(.63+(i%3)*.08);
      branch(g,new THREE.Vector3(.1,h*.43,0),new THREE.Vector3(dx,dy,dz),.055);
      const o=mesh(new THREE.IcosahedronGeometry(1,1),leafMaterials[(i+k)%3],dx,dy,dz,g);o.scale.set(h*.28,h*.17,h*.24);o.rotation.set(i*.2,a,i*.12);
    }
  }
  const grassMaterial=mat('#919c77');
  for(let i=0;i<190;i++){
    const a=i*2.39996,r=18+(i%29)*1.03,x=Math.cos(a)*r,z=Math.sin(a)*r*.85;
    if(Math.abs(x)<15&&Math.abs(z)<15||terrainHeight(x,z)<-.3)continue;
    const h=.15+(i%4)*.055,g=new THREE.ConeGeometry(.09,h,3);mesh(g,grassMaterial,x,terrainHeight(x,z)+h/2,z);
  }
  // A few authored rock groups establish the coast without a dense asset field.
  for(const[x,z,s]of [[-39,-9,2.1],[-42,21,1.3],[41,-24,2.4],[51,18,1.8],[54,-4,2.2],[-16,42,1.5],[19,41,2.1],[-50,-19,2.6]]){
    const rock=mesh(new THREE.IcosahedronGeometry(1,1),stone,x,terrainHeight(x,z)+s*.3,z);rock.scale.set(s,s*.7,s*.8);rock.rotation.y=x*.37;addCollider(rock);
    softShadow(x+.2,z+.15,s*2.5,s*2);
  }
  // Hazy distant islets give the horizon depth while remaining extremely cheap.
  const distant=mat('#9badab');
  for(const[x,z,w,h,d]of [[-140,-210,36,6,18],[90,-260,51,7,19],[220,-120,30,4,17],[-240,70,45,6,21]]){
    const o=mesh(new THREE.IcosahedronGeometry(1,1),distant,x,-2,z);o.scale.set(w,h,d);o.castShadow=false;
  }
  // A gently sloped stone step used to introduce jumping without blocking any route.
  box(1.7,.38,1.1,-18,terrainHeight(-18,18)+.19,18,stone,true);
  return{
    height:terrainHeight,
    trailRoute:Array.from({length:81},(_,i)=>{const p=trailCurve.getPointAt(i/80);return[p.x,terrainHeight(p.x,p.z),p.z];}),
    contains:(x,z)=>(x/68)**2+(z/58)**2<.91,
    location(x,z,u){if(x>34&&Math.abs(z-8)<5)return u.coastDeck;if(x<-16&&z>-10&&z<17)return u.coastGarden;if(z<-14)return u.coastTrail;return u.coastEntrance;},
  };
}
