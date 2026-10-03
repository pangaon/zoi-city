import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {ACTION_PLANS,actionPlanContext} from '../../assets/operations/company-action-plan-model.mjs';
import {createCompanyActionPlan} from '../../assets/operations/company-action-plan-controller.mjs';
import {createOperationsRecovery,operationsDenied} from '../../assets/operations/recovery.mjs';
import {nativeActionPlanDraft,nativeActionPlanPayload,type PlanDraft,type PlanAction} from './companyActionPlan';

type Props={workspace:string;companyId:string;companyTitle:string;current:()=>boolean;read:()=>Promise<any>;recovery:ReturnType<typeof createOperationsRecovery>;onExit:()=>void;onOpen:(id:string)=>Promise<void>;onRefused:()=>void};
type Context={contacts:{id:string;title:string}[];members:{profile_id:string;display_name?:string}[]};
function Action({label,run,disabled=false,selected=false,primary=false}:{label:string;run:()=>void;disabled?:boolean;selected?:boolean;primary?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled,selected}} disabled={disabled} onPress={run} style={[s.action,(selected||primary)&&s.primary,disabled&&s.disabled]}><Text style={[s.actionText,(selected||primary)&&s.primaryText]}>{label}</Text></Pressable>;
}
function Field({label,value,onChange,multiline=false,disabled=false,maxLength=200,placeholder}:{label:string;value:string;onChange:(v:string)=>void;multiline?:boolean;disabled?:boolean;maxLength?:number;placeholder?:string}) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} multiline={multiline} maxLength={maxLength} placeholder={placeholder} placeholderTextColor="#667A89" autoCorrect={false} style={[s.input,multiline&&s.notes]} /></View>;
}
export function CompanyActionPlans({workspace,companyId,companyTitle,current,read,recovery,onExit,onOpen,onRefused}:Props) {
  const [stage,setStage]=useState<'choose'|'edit'|'review'>('choose'),[draft,setDraft]=useState<PlanDraft|null>(null),[context,setContext]=useState<Context|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[working,setWorking]=useState(false),[leave,setLeave]=useState<'back'|string|null>(null),[,redraw]=useState(0);
  const alive=useRef(true),busy=useRef(false),props=useRef({current,read,onRefused});props.current={current,read,onRefused};
  const active=()=>alive.current&&props.current.current();
  const runnerRef=useRef<ReturnType<typeof createCompanyActionPlan>|null>(null);
  function makeRunner(){return createCompanyActionPlan({workspace,companyId,current:active,read:()=>props.current.read(),recovery,changed:()=>{if(active())redraw(n=>n+1);},refused:()=>{if(active()){setDraft(null);setContext(null);setLeave(null);props.current.onRefused();}}});}
  if(!runnerRef.current)runnerRef.current=makeRunner();
  const runner=runnerRef.current;
  async function load(){
    if(busy.current||!active())return;
    busy.current=true;setLoading(true);setError('');
    try {const result=await props.current.read();if(!active())return;setContext(actionPlanContext(result,workspace,companyId));}
    catch(e){if(active()){setError(e instanceof Error?e.message:'Company plan access could not be checked.');if(operationsDenied(e)){setDraft(null);setContext(null);props.current.onRefused();}}}
    finally{busy.current=false;if(active())setLoading(false);}
  }
  useEffect(()=>{alive.current=true;if(runnerRef.current?.state().dead){runnerRef.current=makeRunner();redraw(n=>n+1);}void load();return()=>{alive.current=false;runnerRef.current?.dispose();};},[]);
  // Dispose the native listener independently from the private plan lifetime.
  useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state==='active')void load();});return()=>listener.remove();},[]);
  async function work(fn:()=>Promise<unknown>){
    if(busy.current||!active())return;
    busy.current=true;setWorking(true);setError('');
    try{await fn();}catch(e){if(active())setError(e instanceof Error?e.message:'The plan step could not be confirmed.');}
    finally{busy.current=false;if(active())setWorking(false);}
  }
  function updateAction(index:number,values:Partial<PlanAction>){setDraft(d=>d?{...d,tasks:d.tasks.map((task,i)=>i===index?{...task,...values}:task)}:d);}
  async function review(){if(!draft)return;await runner.prepare(nativeActionPlanPayload(draft));if(active())setStage('review');}
  async function recover(mode:'check'|'retry'|'cancel'){
    const receipt=await recovery.recover(mode);
    if(runner.state().plan)await runner.acceptRecovery(receipt);
    else if(receipt.state==='missing')throw Error('No saved receipt yet. Check or cancel this request before starting another plan.');
  }
  function exit(target:'back'|string){
    if(!active()||busy.current||recovery.state().blocked)return;
    if(draft&&!runner.state().complete){setLeave(target);return;}
    if(target==='back')onExit();else void work(()=>onOpen(target));
  }
  function confirmLeave(){const target=leave;if(!target||busy.current||recovery.state().blocked)return;setLeave(null);if(target==='back')onExit();else void work(()=>onOpen(target));}
  const state=runner.state(),pending=recovery.state().marker,locked=working||loading||state.busy||!!pending||!context,canExit=!working&&!loading&&!recovery.state().blocked;
  return <View style={s.panel}>
    <View style={s.hero}><Text style={s.kicker}>COMPANY ACTION PLANS</Text><Text style={s.title}>{state.complete?'Your plan is saved.':stage==='choose'?'Turn an outcome into assigned work.':stage==='edit'?'Make this plan yours.':'Review, then put the plan to work.'}</Text><Text style={s.heroText}>{companyTitle}</Text></View>
    <Action label="Back to company" disabled={!canExit} run={()=>exit('back')}/>
    <View accessibilityLabel="Action plan progress" style={s.steps}>{[['choose','1 · Choose'],['edit','2 · Shape'],['review','3 · Review & save']].map(([key,label])=><Text key={key} style={[s.step,stage===key&&s.activeStep]}>{label}</Text>)}</View>
    {loading?<ActivityIndicator color="#116CBA" accessibilityLabel="Checking company plan access"/>:null}
    {error||state.error?<Text accessibilityRole="alert" style={s.error}>{error||state.error}</Text>:null}
    {!context&&!loading?<Action label="Retry company plan setup" disabled={working} run={()=>{void load();}}/>:null}
    {!recovery.state().ready?<Action label="Load pending-save reference" disabled={working||loading} run={()=>{void work(()=>recovery.load());}}/>:null}
    {pending?<View style={s.card}><Text style={s.heading}>Check your interrupted save</Text><Text style={s.body}>Confirm this request before saving another. Saved records stay saved. Private plan content is kept in memory, not in the recovery reference.</Text><Action label="Check pending save" disabled={working||loading} run={()=>{void work(()=>recover('check'));}}/>{recovery.state().payload?<Action label="Retry exact plan step" disabled={working||loading} run={()=>{void work(()=>recover('retry'));}}/>:null}<Action label="Cancel plan step if unsaved" disabled={working||loading} run={()=>{void work(()=>recover('cancel'));}}/></View>:null}
    {leave?<View style={s.confirm} accessibilityLabel="Confirm leaving unfinished plan"><Text style={s.heading}>Leave this unfinished plan?</Text><Text style={s.body}>Confirmed records remain saved. Unsaved actions in this draft will be discarded.</Text><Action label="Keep working on this plan" run={()=>setLeave(null)}/><Action label="Discard unsaved draft and continue" disabled={!canExit} run={confirmLeave}/></View>:null}
    {stage==='choose'&&context?<><Text style={s.body}>Choose a practical starting point. Edit the actions, assign your team and set your own deadlines.</Text>{ACTION_PLANS.map((template:any)=><Pressable key={template.id} accessibilityRole="button" accessibilityLabel={template.title} accessibilityState={{disabled:locked||recovery.state().blocked}} disabled={locked||recovery.state().blocked} onPress={()=>{setDraft(nativeActionPlanDraft(template.id));setStage('edit');setError('');}} style={s.template}><Text style={s.heading}>{template.title}</Text><Text style={s.body}>{template.description}</Text><Text style={s.link}>{template.tasks.length} actions · Make it yours →</Text></Pressable>)}</>:null}
    {stage==='edit'&&draft&&context?<>
      <Field label="Plan title" value={draft.title} disabled={locked} onChange={title=>setDraft(d=>d?{...d,title}:d)}/>
      <Field label="Outcome / notes" value={draft.notes} disabled={locked} maxLength={2000} multiline onChange={notes=>setDraft(d=>d?{...d,notes}:d)}/>
      <Text style={s.label}>Company contact (optional)</Text><View style={s.row}><Action label="No linked contact" disabled={locked} selected={!draft.contact_id} run={()=>setDraft(d=>d?{...d,contact_id:null}:d)}/>{context.contacts.map(contact=><Action key={contact.id} label={contact.title} disabled={locked} selected={draft.contact_id===contact.id} run={()=>setDraft(d=>d?{...d,contact_id:contact.id}:d)}/>)}</View>
      <Text style={s.heading}>Actions · {draft.tasks.length} of 12</Text>
      {draft.tasks.map((task,index)=><View key={index} style={s.card}><View style={s.row}><Text style={s.heading}>Action {index+1}</Text><Action label={'Remove action '+(index+1)} disabled={locked||draft.tasks.length===1} run={()=>setDraft(d=>d?{...d,tasks:d.tasks.filter((_,i)=>i!==index)}:d)}/></View>
        <Field label={'Action '+(index+1)+' title'} value={task.title} disabled={locked} onChange={title=>updateAction(index,{title})}/>
        <Text style={s.label}>Assigned to</Text><View style={s.row}><Action label={'Action '+(index+1)+' · Unassigned'} disabled={locked} selected={!task.assignee_profile_id} run={()=>updateAction(index,{assignee_profile_id:null})}/>{context.members.map(member=><Action key={member.profile_id} label={'Action '+(index+1)+' · '+(member.display_name||'Team member')} disabled={locked} selected={task.assignee_profile_id===member.profile_id} run={()=>updateAction(index,{assignee_profile_id:member.profile_id})}/>)}</View>
        <View style={s.deadline}><View style={s.dateField}><Field label={'Action '+(index+1)+' date'} value={task.localDate||''} placeholder="YYYY-MM-DD" maxLength={10} disabled={locked} onChange={localDate=>updateAction(index,{localDate})}/></View><View style={s.timeField}><Field label={'Action '+(index+1)+' time'} value={task.localTime||''} placeholder="HH:mm" maxLength={5} disabled={locked} onChange={localTime=>updateAction(index,{localTime})}/></View></View>
        <Field label={'Action '+(index+1)+' notes'} value={task.notes} multiline maxLength={2000} disabled={locked} onChange={notes=>updateAction(index,{notes})}/>
      </View>)}
      <Text style={s.small}>Deadlines use your device timezone. Leave both date and time empty when no deadline is agreed.</Text>
      {draft.tasks.length<12?<Action label="Add an action" disabled={locked} run={()=>setDraft(d=>d?{...d,tasks:[...d.tasks,{title:'',notes:'',assignee_profile_id:null,due_at:null}]}:d)}/>:null}
      <Action label="Review this plan" primary disabled={locked||recovery.state().blocked} run={()=>{void work(review);}}/>
    </>:null}
    {stage==='review'&&state.plan&&context?<>
      <View style={s.summary}><Text style={s.heading}>{state.plan.title}</Text><Text style={s.body}>{state.plan.tasks.length} actions · {state.plan.tasks.filter((t:any)=>t.assignee_profile_id).length} assigned · {state.plan.tasks.filter((t:any)=>t.due_at).length} with deadlines</Text>{state.plan.notes?<Text style={s.body}>{state.plan.notes}</Text>:null}</View>
      {state.plan.tasks.map((task:any,index:number)=><View key={index} style={s.card}><Text style={s.heading}>{index+1} · {task.title}</Text><Text style={s.body}>{task.assignee_profile_id?context.members.find(m=>m.profile_id===task.assignee_profile_id)?.display_name||'Assigned member unavailable':'Unassigned'} · {task.due_at?new Date(task.due_at).toLocaleString():'No deadline'}</Text>{task.notes?<Text style={s.body}>{task.notes}</Text>:null}{index+1<state.index?<Text style={s.link}>Saved</Text>:null}</View>)}
      <View style={s.summary} accessibilityLiveRegion="polite"><Text style={s.heading}>{state.complete?'Project and all actions confirmed saved':state.index?'Project saved · '+Math.max(0,state.index-1)+' of '+state.plan.tasks.length+' actions saved':'Nothing has been saved yet'}</Text><Text style={s.body}>Each record saves separately. Check an interrupted request before continuing.</Text></View>
      {!state.index&&!pending?<Action label="Edit the plan" disabled={locked} run={()=>{runner.dispose();runnerRef.current=makeRunner();setStage('edit');setError('');}}/>:null}
      {!state.complete&&!pending?<Action label={working?'Saving the next action…':state.index?'Continue saving remaining actions':'Save project & actions'} primary disabled={locked||recovery.state().blocked} run={()=>{void work(()=>runner.advance());}}/>:null}
      {state.projectId?<Action label={state.complete?'Open your saved project':'Open saved work'} primary={state.complete} disabled={!canExit} run={()=>exit(state.projectId)}/>:null}
    </>:null}
    <Text style={s.small}>Editable team plans. Zoi does not submit filings, obtain signatures or confirm external services here.</Text>
  </View>;
}
const s=StyleSheet.create({panel:{padding:16,gap:16,backgroundColor:'#fff',borderRadius:18,borderWidth:1,borderColor:'#DFE6EB'},hero:{padding:20,gap:10,backgroundColor:'#132F46',borderRadius:18},kicker:{fontSize:10,fontWeight:'700',letterSpacing:1.5,color:'#9BDDEA'},title:{fontSize:26,fontWeight:'700',lineHeight:32,color:'#fff'},heroText:{fontSize:14,color:'#D1E4EE'},body:{fontSize:14,lineHeight:22,color:'#4E6372'},small:{fontSize:12,lineHeight:19,color:'#4E6372'},heading:{fontSize:17,lineHeight:23,fontWeight:'700',color:'#132F46'},label:{fontSize:13,fontWeight:'700',color:'#132F46'},row:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'},steps:{flexDirection:'row',flexWrap:'wrap',gap:8},step:{padding:10,borderRadius:10,backgroundColor:'#F1F7FB',color:'#4E6372',fontSize:12},activeStep:{backgroundColor:'#132F46',color:'#fff',fontWeight:'700'},action:{maxWidth:'100%',minHeight:44,padding:12,borderRadius:10,borderWidth:1,borderColor:'#CAD7E0',justifyContent:'center'},actionText:{fontSize:13,fontWeight:'700',color:'#116CBA'},primary:{backgroundColor:'#116CBA',borderColor:'#116CBA'},primaryText:{color:'#fff'},disabled:{opacity:.5},template:{padding:18,gap:10,borderRadius:16,borderWidth:1,borderColor:'#CAD7E0',backgroundColor:'#F7FBFE'},link:{fontSize:13,fontWeight:'700',color:'#116CBA'},card:{padding:16,gap:12,borderRadius:16,borderWidth:1,borderColor:'#CAD7E0'},summary:{padding:16,gap:10,backgroundColor:'#F1F7FB',borderRadius:16},confirm:{padding:16,gap:12,backgroundColor:'#FFF7E5',borderWidth:1,borderColor:'#B88524',borderRadius:16},field:{gap:8},input:{minHeight:46,borderWidth:1,borderColor:'#CAD7E0',borderRadius:10,padding:12,fontSize:15,color:'#132F46',backgroundColor:'#fff'},notes:{minHeight:80,textAlignVertical:'top'},deadline:{flexDirection:'row',flexWrap:'wrap',gap:12},dateField:{flexGrow:2,flexBasis:160},timeField:{flexGrow:1,flexBasis:100},error:{fontSize:14,lineHeight:22,color:'#963624'}});
