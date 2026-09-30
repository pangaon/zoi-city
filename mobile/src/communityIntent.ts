/** Navigation only: never stores drafts, credentials or instructions to mutate data. */
export type CommunityRoute={kind:'feed'|'profile'|'discussion'|'settings'|'notifications';id?:string;mode?:string};
export type CommunityIntent={route:CommunityRoute;compose?:'moment'|'question'};
export function communityIntentLabel(intent:CommunityIntent):string{
 if(intent.compose==='question')return 'ask the diaspora';
 if(intent.compose==='moment')return 'share a moment';
 if(intent.route.kind==='discussion')return 'return to the conversation';
 if(intent.route.kind==='profile')return 'return to this member';
 if(intent.route.kind==='settings')return 'edit your Community profile';
 if(intent.route.kind==='notifications')return 'view your notifications';
 return 'return to Community';
}
export function communityResume(intent:CommunityIntent,actor:string|null):CommunityIntent|null{
 return actor?{route:{...intent.route},...(intent.compose?{compose:intent.compose}:{})}:null;
}

export function communityActorChanged(previous:string,next:string):boolean{return !!previous&&previous!==next;}
