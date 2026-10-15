export type NavigationBox={x:number;width:number};
const finite=(n:number)=>Number.isFinite(n)?Math.max(0,n):0;
export function clampNavigationOffset(offset:number,viewport:number,content:number){return Math.min(Math.max(0,finite(content)-finite(viewport)),finite(offset));}
/** Keep the complete measured tab and its focus outline inside the scroll viewport. */
export function revealNavigationOffset(offset:number,viewport:number,content:number,item:NavigationBox,inset=8){
 const current=clampNavigationOffset(offset,viewport,content);if(viewport<=0)return current;
 const left=Math.max(0,item.x-inset),right=item.x+item.width+inset;
 return clampNavigationOffset(left<current?left:right>current+viewport?right-viewport:current,viewport,content);
}
export function pageNavigationOffset(offset:number,direction:-1|1,viewport:number,content:number){return clampNavigationOffset(offset+direction*Math.max(44,viewport*.8),viewport,content);}

/** A complete current-tab extent supersedes native content-container width. */
export function navigationContentExtent(ids:readonly string[],boxes:ReadonlyMap<string,NavigationBox>,trailingPadding=8):number|null{
 if(!ids.length)return 0;
 if(new Set(ids).size!==ids.length)return null;
 let right=0;
 for(const id of ids){const box=boxes.get(id);if(!box||!Number.isFinite(box.x)||box.x<0||!Number.isFinite(box.width)||box.width<=0)return null;right=Math.max(right,box.x+box.width);}
 return right+finite(trailingPadding);
}
