export function documentClient(C,{active=()=>false}={}){return async function(action,body){
 const check=()=>{if(!active())throw Error('document_scope_changed');};check();
 if(!await C.auth.ensureFresh()){const e=Error('Please sign in.');e.status=401;throw e;}check();
 const form=body instanceof FormData;
 let response;try{response=await fetch('https://csebihpaychdkanjjsmz.supabase.co/functions/v1/ops-documents?action='+encodeURIComponent(action),{method:'POST',headers:{apikey:'sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j',Authorization:'Bearer '+C.auth.token(),...(form?{}:{'Content-Type':'application/json'})},body:form?body:JSON.stringify(body),signal:AbortSignal.timeout(60000),cache:'no-store'});}catch{check();throw Error('The request could not be confirmed. Keep your selected file and retry the same upload, or refresh its history.');}check();
 if(action==='file'&&response.ok){const blob=await response.blob();check();if(blob.size>10*1024*1024)throw Error('Document exceeds the download limit.');return {ok:true,blob};}
 const data=await response.json().catch(()=>null);check();if(!response.ok||data?.ok!==true){const e=Error(data?.error||'document_request_unconfirmed');e.status=response.status;throw e;}return data;
};}
