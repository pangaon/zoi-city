import {useEffect,useRef,useState} from 'react';
import {Linking,Pressable,Text,View} from 'react-native';
import {useAuth} from './Auth';
import {sponsorFulfillmentLink} from './sponsorFulfillment';
export function SponsorFulfillmentHandoff({workspace,application,event,offset=0,disabled=false}:{workspace:string;application:string;event:string;offset?:number;disabled?:boolean}){
 const {client,session,workspaceId}=useAuth(),actor=session?.user.id||'';
 const alive=useRef(true),busyRef=useRef(false),scope=useRef({actor,workspaceId});scope.current={actor,workspaceId};
 const [busy,setBusy]=useState(false),[error,setError]=useState('');useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const current=()=>alive.current&&scope.current.actor===actor&&scope.current.workspaceId===workspace&&client.session?.user.id===actor;
 async function open(){if(busyRef.current||disabled||!current())return;busyRef.current=true;setBusy(true);setError('');try{const url=await sponsorFulfillmentLink({client,actor,workspace,application,event,offset,current});if(!current())return;await Linking.openURL(url);}catch(e){if(current())setError(e instanceof Error?e.message:'Sponsorship could not open.');}finally{busyRef.current=false;if(current())setBusy(false);}}
 return <View style={{gap:8}}><Text style={{color:'#60717E',fontSize:12,lineHeight:19}}>Continue with this approved application in your browser. Your browser checks its own sign-in and workspace permissions.</Text><Pressable accessibilityRole="button" accessibilityState={{disabled:disabled||busy}} disabled={disabled||busy} onPress={open} style={{minHeight:44,padding:12,borderRadius:10,backgroundColor:'#EAF4FB',opacity:disabled||busy ? 0.5 : 1}}><Text style={{color:'#116CBA',fontWeight:'700'}}>{busy?'Checking sponsorship…':'Manage promised benefits on website'}</Text></Pressable>{error?<Text accessibilityRole="alert" style={{color:'#963624'}}>{error}</Text>:null}</View>;
}
