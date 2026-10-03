import {useEffect,useRef,useState} from 'react';
import {AppState,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import {Directory,File,Paths} from 'expo-file-system';
import {randomUUID} from 'expo-crypto';
import * as Sharing from 'expo-sharing';
import {companyTemporaryCopy,confirmCompanyHandover,reviewCompanyHandover,shareCompanyHandover,type ReviewedCompanyHandover} from './companyHandover';

const count=(value:number,label:string)=>value+' '+label+(value===1?'':'s');
function Action({label,disabled,run}:{label:string;disabled:boolean;run:()=>void}){return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={run} style={[s.action,disabled&&{opacity:.5}]}><Text style={s.link}>{label}</Text></Pressable>;}
export function CompanyHandover({workspace,companyId,role,disabled,current,read}:{workspace:string;companyId:string;role:string;disabled:boolean;current:()=>boolean;read:(name:string,args:Record<string,unknown>)=>Promise<any>}){
 const [review,setReview]=useState<ReviewedCompanyHandover|null>(null),[includeDocuments,setIncludeDocuments]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const alive=useRef(true),working=useRef(false),copy=useRef(companyTemporaryCopy()),context=useRef({current,disabled});context.current={current,disabled};
 const active=()=>alive.current&&context.current.current()&&!context.current.disabled;
 const scope=()=>({workspace,companyId,current:active,read,includeDocuments});
 useEffect(()=>{alive.current=true;const listener=AppState.addEventListener('change',state=>{if(state==='active')copy.current.clear();});return()=>{alive.current=false;listener.remove();copy.current.clear();};},[]);
 useEffect(()=>{copy.current.clear();setReview(null);setNotice('');if(!['owner','admin','editor'].includes(role))setIncludeDocuments(false);},[role,disabled]);
 async function run(task:()=>Promise<void>){if(working.current||!active())return;working.current=true;setBusy(true);setError('');setNotice('');try{await task();}catch(e){copy.current.clear();if(active()){setReview(null);setError(e instanceof Error?e.message:'Company handover could not be prepared.');}}finally{working.current=false;if(alive.current)setBusy(false);}}
 const prepare=()=>run(async()=>{copy.current.clear();const value=await reviewCompanyHandover(scope());if(active())setReview(value);});
 const share=()=>run(async()=>{
  if(!review)return;
  if(Platform.OS==='web'){
   const packet=await confirmCompanyHandover(review,scope());if(!active())return;
   const text=JSON.stringify(packet,null,2),name='zoi-company-'+companyId+'.json';
   const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));copy.current.replace(()=>URL.revokeObjectURL(url));
   const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);try{if(active())link.click();}finally{link.remove();copy.current.clear();}
   if(active())setNotice('The current saved company records were sent to your browser downloads.');
  }else{
   await shareCompanyHandover(review,scope(),{available:Sharing.isAvailableAsync,create:(text,name)=>{const directory=new Directory(Paths.cache,'zoi-company-handover-'+randomUUID());directory.create();copy.current.replace(()=>directory.delete());try{const file=new File(directory,name);file.create();file.write(text);return {uri:file.uri,remove:()=>copy.current.clear()};}catch(e){copy.current.clear();throw e;}},share:uri=>Sharing.shareAsync(uri,{mimeType:'application/json',dialogTitle:'Company records'})});
   if(active())setNotice('The share sheet has closed. The app’s temporary copy has been removed.');
  }
  if(active())setReview(null);
 });
 return <View style={s.panel}><Text style={s.heading}>Company record handover</Text><Text style={s.body}>Review this company’s saved records, then choose where to export them. Document contents are never included.</Text>
 {['owner','admin','editor'].includes(role)?<Action label={includeDocuments?'Exclude private document records':'Include authorized document records'} disabled={disabled||busy} run={()=>{copy.current.clear();setReview(null);setNotice('');setIncludeDocuments(value=>!value);}}/>:null}
 <Text style={s.small}>{includeDocuments?'Includes recent authorized document titles and saved version numbers.':'Private document records excluded.'}</Text>
 <Action label={busy?'Checking company records…':'Review company handover'} disabled={disabled||busy} run={()=>void prepare()}/>
 {review?<View style={s.review}><Text style={s.heading}>{review.packet.company.title}</Text><Text style={s.body}>Company version {review.packet.company.version} · {count(review.packet.projects.length,'project')} · {count(review.packet.tasks.length,'task')} · {count(review.packet.contacts.length,'contact')}</Text><Text style={s.small}>{review.packet.document_records===null?'No private document records.':review.packet.document_records.length+' recent authorized document records.'}</Text><Text style={s.small}>Includes saved contact details and notes. Share only with the people you choose. A downloaded or shared copy remains with its recipient.</Text><Action label={Platform.OS==='web'?'Export reviewed company records':'Share reviewed company records'} disabled={disabled||busy} run={()=>void share()}/><Action label="Discard handover review" disabled={disabled||busy} run={()=>{copy.current.clear();setReview(null);}}/></View>:null}
 {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}{notice?<Text accessibilityLiveRegion="polite" style={s.body}>{notice}</Text>:null}<Text style={s.small}>Team-maintained records. This is not a government filing or a legal opinion.</Text></View>;
}
const s=StyleSheet.create({panel:{gap:12,padding:16,borderWidth:1,borderColor:'#DFE6EB',borderRadius:16,backgroundColor:'#F1F7FB'},heading:{fontSize:17,fontWeight:'700',color:'#132F46'},body:{fontSize:14,lineHeight:22,color:'#60717E'},small:{fontSize:12,lineHeight:19,color:'#60717E'},action:{minHeight:44,padding:12,borderWidth:1,borderColor:'#CAD7E0',borderRadius:10,justifyContent:'center',backgroundColor:'#fff'},link:{fontSize:12,fontWeight:'700',color:'#116CBA'},review:{gap:10,padding:14,backgroundColor:'#fff',borderRadius:12},error:{fontSize:14,color:'#963624'}});
