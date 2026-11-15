// Input can be tested with EventTarget in Node, without a browser or WebGL.
export function bindKeyboard({target,keys,isActive,isReading,jump,home,read,pause}) {
  const movement=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space','ShiftLeft','ShiftRight']);
  const down=e=>{
    if(e.target?.closest?.('input,textarea,select,[contenteditable="true"]')||isReading()||!isActive())return;
    if(movement.has(e.code)){e.preventDefault();keys.add(e.code);}
    if(e.code==='Space'&&!e.repeat)jump();
    if(e.code==='KeyR'&&!e.repeat)home();
    if(e.code==='KeyE'&&!e.repeat)read();
    if(e.code==='Escape')pause();
  };
  const up=e=>keys.delete(e.code);
  target.addEventListener('keydown',down);target.addEventListener('keyup',up);
  return()=>{target.removeEventListener('keydown',down);target.removeEventListener('keyup',up);keys.clear();};
}
