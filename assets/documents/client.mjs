export function documentClient(C){return async function(action,body){
 if(!await C.auth.ensureFresh())throw Error('Please sign in.');
 const form=body instanceof FormData;
 let response;try{response=await fetch('https://csebihpaychdkanjjsmz.supabase.co/functions/v1/ops-documents?action='+encodeURIComponent(action),{method:'POST',headers:{apikey:'sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j',Authorization:'Bearer '+C.auth.token(),...(form?{}:{'Content-Type':'application/json'})},body:form?body:JSON.stringify(body),signal:AbortSignal.timeout(60000),cache:'no-store'});}catch{throw Error('The request could not be confirmed. Keep your selected file and retry the same upload, or refresh its history.');}
 if(action==='file'&&response.ok){const blob=await response.blob();if(blob.size>10*1024*1024)throw Error('Document exceeds the download limit.');return {ok:true,blob};}
 const data=await response.json().catch(()=>null);if(!response.ok||data?.ok!==true)throw Error(data?.error||'document_request_unconfirmed');return data;
};}
