const SPOTIFY=/^\/(?:embed\/)?(artist|album|track|playlist|episode|show)\/([A-Za-z0-9]{22})$/;
const VIDEO=/^[A-Za-z0-9_-]{11}$/;
const PLAYLIST=/^[A-Za-z0-9_-]{10,100}$/;
function https(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u:null;}catch{return null;}}
export function mediaSelection(value){
 const embed=https(value?.embed),url=https(value?.url);if(!embed||!url)throw Error('unsupported_media_player');
 if(embed.hostname==='open.spotify.com'&&url.hostname==='open.spotify.com'){
  const a=SPOTIFY.exec(embed.pathname),b=SPOTIFY.exec(url.pathname);if(!embed.pathname.startsWith('/embed/')||!a||!b||a[1]!==b[1]||a[2]!==b[2])throw Error('unsupported_media_player');
  return{provider:'spotify',embed:'https://open.spotify.com/embed/'+a[1]+'/'+a[2],url:'https://open.spotify.com/'+a[1]+'/'+a[2]};
 }
 if(!['www.youtube.com','www.youtube-nocookie.com'].includes(embed.hostname)||!['www.youtube.com','youtube.com','youtu.be'].includes(url.hostname))throw Error('unsupported_media_player');
 const id=embed.pathname.slice('/embed/'.length),list=embed.searchParams.get('list');
 if(embed.pathname==='/embed/videoseries'&&PLAYLIST.test(list||'')&&url.pathname==='/playlist'&&url.searchParams.get('list')===list)return{provider:'youtube',embed:'https://www.youtube-nocookie.com/embed/videoseries?list='+encodeURIComponent(list),url:'https://www.youtube.com/playlist?list='+encodeURIComponent(list)};
 const sourceId=url.hostname==='youtu.be'?url.pathname.slice(1):url.pathname==='/watch'?url.searchParams.get('v'):null;
 if(!embed.pathname.startsWith('/embed/')||!VIDEO.test(id)||sourceId!==id)throw Error('unsupported_media_player');
 return{provider:'youtube',embed:'https://www.youtube-nocookie.com/embed/'+id,url:'https://www.youtube.com/watch?v='+id};
}
export function mediaHeight(provider,compact){return provider==='youtube'?(compact?200:270):(compact?152:352);}
let youtubeReady;
export function loadYouTubeAPI(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(youtubeReady)return youtubeReady;
 youtubeReady=new Promise((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;let finished=false;
  const done=()=>{if(finished)return;finished=true;clearTimeout(timeout);if(window.YT?.Player)resolve(window.YT);else reject(Error('video_player_unavailable'));};
  window.onYouTubeIframeAPIReady=()=>{try{previous?.();}finally{done();}};
  const timeout=setTimeout(()=>{if(!finished){finished=true;reject(Error('video_player_unavailable'));}},12000);
  let script=document.querySelector('script[data-zoi-youtube-api]');if(!script){script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.dataset.zoiYoutubeApi='';script.async=true;script.addEventListener('error',()=>{clearTimeout(timeout);finished=true;script.remove();reject(Error('video_player_unavailable'));},{once:true});document.head.append(script);}
 }).catch(error=>{youtubeReady=null;throw error;});
 return youtubeReady;
}
