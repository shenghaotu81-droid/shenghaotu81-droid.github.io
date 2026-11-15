import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

// Capsule + static-triangle Octree follows the approach of Three.js's MIT FPS example.
// Physics is independent of rendering, allowing CPU-only movement and reachability tests.
export function createWalker(collisionRoot, initialFoot, {walkSpeed=2.8,runFactor=1.6}={}) {
  collisionRoot.updateMatrixWorld(true);
  const octree=new Octree().fromGraphNode(collisionRoot);
  const radius=.3,eyeHeight=1.65;
  const capsule=new Capsule(new THREE.Vector3(),new THREE.Vector3(),radius);
  const supportProbe=new Capsule(new THREE.Vector3(),new THREE.Vector3(),radius);
  const velocity=new THREE.Vector3(),delta=new THREE.Vector3(),normalPush=new THREE.Vector3();
  let grounded=false,jumpBuffer=0,grace=0;
  function teleport(foot){capsule.start.set(foot[0],foot[1]+radius,foot[2]);capsule.end.set(foot[0],foot[1]+eyeHeight-radius,foot[2]);velocity.set(0,0,0);grounded=false;grace=0;jumpBuffer=0;}
  function step(dt,{x=0,z=0,run=false,yaw=0}={}){
    dt=Math.max(0,Math.min(dt,.1));const steps=Math.max(1,Math.ceil(dt/.0125)),h=dt/steps;
    const len=Math.max(1,Math.hypot(x,z)),speed=walkSpeed*(run?runFactor:1);
    const targetX=(x*Math.cos(yaw)+z*Math.sin(yaw))/len*speed;
    const targetZ=(-x*Math.sin(yaw)+z*Math.cos(yaw))/len*speed;
    for(let i=0;i<steps;i++){
      jumpBuffer=Math.max(0,jumpBuffer-h);grace=grounded?.085:Math.max(0,grace-h);
      const blend=1-Math.exp(-(grounded?14:5)*h);
      velocity.x+=(targetX-velocity.x)*blend;velocity.z+=(targetZ-velocity.z)*blend;
      if(jumpBuffer>0&&(grounded||grace>0)){velocity.y=4;grounded=false;grace=0;jumpBuffer=0;}
      velocity.y-=12*h;
      delta.copy(velocity).multiplyScalar(h);capsule.translate(delta);grounded=false;
      for(let n=0;n<3;n++){
        const hit=octree.capsuleIntersect(capsule);if(!hit)break;
        if(hit.normal.y>.55)grounded=true;
        const vn=velocity.dot(hit.normal);if(vn<0)velocity.addScaledVector(hit.normal,-vn);
        normalPush.copy(hit.normal).multiplyScalar(hit.depth+.00001);capsule.translate(normalPush);
      }
      // A shallow support probe keeps jump permission stable at floor/wall corners.
      if(!grounded&&velocity.y<=.2){
        supportProbe.start.copy(capsule.start);supportProbe.end.copy(capsule.end);
        supportProbe.translate(normalPush.set(0,-.02,0));
        const support=octree.capsuleIntersect(supportProbe);
        if(support&&support.normal.y>.55)grounded=true;
      }
      if(grounded&&velocity.y<.2)velocity.y=0;
    }
  }
  teleport(initialFoot);
  return{
    step,teleport,jump(){jumpBuffer=.14;},stop(){velocity.set(0,0,0);jumpBuffer=0;},
    get eye(){return new THREE.Vector3(capsule.end.x,capsule.end.y+radius,capsule.end.z);},
    get foot(){return new THREE.Vector3(capsule.start.x,capsule.start.y-radius,capsule.start.z);},
    get state(){return{foot:this.foot.toArray(),eye:this.eye.toArray(),grounded,velocity:velocity.toArray(),jumpBuffered:jumpBuffer>0};},
    get capsule(){return capsule;},octree,
  };
}
