/** Download progress covers 5–85%; remaining stages are verified separately. */
export async function readModelResponse(response:Response,onProgress:(value:number)=>void):Promise<ArrayBuffer> {
 const length=Number(response.headers.get('content-length'))
 const measurable=Number.isFinite(length)&&length>0&&!response.headers.has('content-encoding')
 if(!response.body) {const result=await response.arrayBuffer();onProgress(85);return result}
 const reader=response.body.getReader(),chunks:Uint8Array[]=[]
 let received=0
 while(true){
  const {value,done}=await reader.read()
  if(done)break
  chunks.push(value);received+=value.byteLength
  if(measurable)onProgress(Math.min(84,5+Math.floor(80*received/length)))
 }
 const buffer=new ArrayBuffer(received),bytes=new Uint8Array(buffer)
 let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 onProgress(85)
 return buffer
}
