export async function readBoundedBody(request,limit,timeoutMs=30000){
 const stated=request.headers.get('content-length');if(stated&&(!/^\d+$/.test(stated)||Number(stated)>limit))throw Error('request_too_large');
 const reader=request.body?.getReader();if(!reader)throw Error('empty_request');
 let timer;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error('request_read_timeout'));reader.cancel().catch(()=>{});},timeoutMs);});
 let size=0;const parts=[];
 try{while(true){const {done,value}=await Promise.race([reader.read(),deadline]);if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('request_too_large');}parts.push(value);}}finally{clearTimeout(timer);reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
}
export function boundedStream(body,limit){
 const reader=body.getReader();let size=0,closed=false;
 function release(){if(!closed){closed=true;reader.releaseLock();}}
 return new ReadableStream({async pull(controller){try{const {done,value}=await reader.read();if(done){release();controller.close();return;}size+=value.byteLength;if(size>limit){await reader.cancel();release();controller.error(Error('document_size_limit'));return;}controller.enqueue(value);}catch{release();controller.error(Error('document_transfer_incomplete'));}},async cancel(reason){await reader.cancel(reason);release();}});
}
