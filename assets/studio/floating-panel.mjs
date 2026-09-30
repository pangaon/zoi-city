// Moves the live view rather than cloning it, preserving cooking/media state.
export function boundedPosition(x,y,width,height,viewportWidth,viewportHeight){
  const margin=12,maxX=Math.max(margin,viewportWidth-width-margin),maxY=Math.max(margin,viewportHeight-height-margin);
  return {x:Math.min(maxX,Math.max(margin,Number.isFinite(x)?x:margin)),y:Math.min(maxY,Math.max(margin,Number.isFinite(y)?y:margin))};
}
export function mountFloatingPanel({content,trigger,title='Your workspace'}){
  if(!content?.parentNode||!trigger)throw Error('A connected view and trigger are required.');
  const doc=content.ownerDocument,win=doc.defaultView,anchor=doc.createComment('zoi-floating-origin'),panel=doc.createElement('section');
  panel.className='zoi-floating-panel';panel.hidden=true;panel.setAttribute('aria-label',title);panel.setAttribute('role','region');
  const bar=doc.createElement('header'),move=doc.createElement('button'),min=doc.createElement('button'),closeButton=doc.createElement('button'),body=doc.createElement('div');
  bar.className='zoi-floating-bar';body.className='zoi-floating-content';move.type=min.type=closeButton.type='button';
  move.className='zoi-floating-move';move.textContent=title;move.setAttribute('aria-label','Move '+title+'. Use arrow keys to reposition.');
  min.textContent='−';min.setAttribute('aria-label','Minimize floating view');min.setAttribute('aria-expanded','true');
  closeButton.textContent='×';closeButton.setAttribute('aria-label','Return view to page');bar.append(move,min,closeButton);panel.append(bar,body);doc.body.append(panel);
  let opened=false,disposed=false,drag=null,position={x:12,y:12};
  function place(x,y){const rect=panel.getBoundingClientRect(),v=win.visualViewport;position=boundedPosition(x,y,rect.width,rect.height,v?.width||win.innerWidth,v?.height||win.innerHeight);panel.style.left=position.x+'px';panel.style.top=position.y+'px';}
  function resize(){if(opened)place(position.x,position.y);}
  function open(){if(opened||disposed)return;content.before(anchor);body.append(content);panel.hidden=false;body.hidden=false;min.textContent='−';min.setAttribute('aria-expanded','true');min.setAttribute('aria-label','Minimize floating view');opened=true;trigger.setAttribute('aria-expanded','true');const r=panel.getBoundingClientRect();place(win.innerWidth-r.width-20,Math.max(84,win.innerHeight-r.height-88));move.focus({preventScroll:true});}
  function close(){if(!opened)return;drag=null;if(anchor.parentNode){anchor.replaceWith(content);}else{content.remove();}opened=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(trigger.isConnected)trigger.focus({preventScroll:true});}
  function toggle(){if(opened)close();else open();}
  function minimize(){body.hidden=!body.hidden;min.textContent=body.hidden?'+':'−';min.setAttribute('aria-expanded',String(!body.hidden));min.setAttribute('aria-label',body.hidden?'Expand floating view':'Minimize floating view');resize();}
  function key(e){if(e.key==='Escape'){e.preventDefault();close();return;}const step=e.shiftKey?40:12,delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];if(e.target===move&&delta){e.preventDefault();place(position.x+delta[0],position.y+delta[1]);}}
  function down(e){if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX-position.x,y:e.clientY-position.y};move.setPointerCapture?.(e.pointerId);}
  function motion(e){if(drag?.id!==e.pointerId)return;place(e.clientX-drag.x,e.clientY-drag.y);}
  function up(e){if(drag?.id===e.pointerId)drag=null;}
  trigger.setAttribute('aria-expanded','false');trigger.addEventListener('click',toggle);closeButton.addEventListener('click',close);min.addEventListener('click',minimize);panel.addEventListener('keydown',key);move.addEventListener('pointerdown',down);move.addEventListener('pointermove',motion);move.addEventListener('pointerup',up);move.addEventListener('pointercancel',up);win.addEventListener('resize',resize);win.visualViewport?.addEventListener('resize',resize);
  function destroy(){if(disposed)return;close();disposed=true;trigger.removeEventListener('click',toggle);win.removeEventListener('resize',resize);win.visualViewport?.removeEventListener('resize',resize);panel.remove();anchor.remove();}
  return {open,close,destroy,isOpen:()=>opened};
}
