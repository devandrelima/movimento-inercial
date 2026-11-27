import { Tensor, loadAndCompile, loadLiteRt, type CompiledModel } from '@litertjs/core'
import fixture from './fixtures/model-v2-reference.json'
import {readModelResponse} from './model-download'
import {MODEL_CACHE,MODEL_HASH,MODEL_URL} from './model-info'

const ctx = self as unknown as {onmessage: ((event: MessageEvent) => void) | null; postMessage: (message: unknown) => void}
let model: CompiledModel | null = null
async function predict(values:Float32Array):Promise<number[]> {
  if (!model || values.length!==600 || !values.every(Number.isFinite)) throw new Error('Entrada inválida para o modelo')
  const input=new Tensor(values,[1,100,6]);let output:Tensor[]=[]
  try {
    output=await model.run(input)
    if (output.length!==1) throw new Error('Saída inesperada do modelo')
    const data=Array.from(await output[0].data(),Number)
    if (data.length!==2 || !data.every(Number.isFinite)) throw new Error('Predição inválida')
    return data
  } finally {input.delete();output.forEach(tensor=>tensor.delete())}
}
const sha256=async(buffer:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(x=>x.toString(16).padStart(2,'0')).join('')
const openCache=async()=>{try {return self.caches?await self.caches.open(MODEL_CACHE):null} catch {return null}}
/** Modelo instalado e íntegro (hash confere) no Cache Storage, ou null. Uma cópia que não confere é descartada. */
async function installedModel(cache:Cache|null):Promise<ArrayBuffer|null> {
  if (!cache) return null
  try {
    const hit=await cache.match(MODEL_URL)
    if (!hit) return null
    const buffer=await hit.arrayBuffer()
    if (await sha256(buffer)===MODEL_HASH) return buffer
    await cache.delete(MODEL_URL)
  } catch {/* cache ilegível: baixa de novo */}
  return null
}
/** Guarda o modelo já verificado; mantém só a versão atual no cache. Devolve se a instalação deu certo. */
async function installModel(cache:Cache|null,buffer:ArrayBuffer):Promise<boolean> {
  if (!cache) return false
  try {
    await cache.put(MODEL_URL,new Response(buffer.slice(0),{headers:{'Content-Type':'application/octet-stream'}}))
    for (const request of await cache.keys()) if (new URL(request.url).pathname!==MODEL_URL) await cache.delete(request)
    return true
  } catch {return false}
}
ctx.onmessage=async event=>{
  const {id,type,values,refresh}=event.data as {id:number;type:string;values?:Float32Array;refresh?:boolean}
  try {
    if (type==='init') {
      await loadLiteRt('/wasm/')
      ctx.postMessage({id,progress:5})
      const cache=await openCache()
      let buffer=refresh?null:await installedModel(cache),cached=buffer!==null
      if (buffer) ctx.postMessage({id,progress:85})
      else {
        const response=await fetch(MODEL_URL,{cache:'no-cache'})
        if (!response.ok) throw new Error(`Modelo indisponível (HTTP ${response.status})`)
        buffer=await readModelResponse(response,progress=>ctx.postMessage({id,progress}))
        if (await sha256(buffer)!==MODEL_HASH) throw new Error('Verificação do modelo falhou')
        cached=await installModel(cache,buffer)
      }
      const bytes=new Uint8Array(buffer)
      ctx.postMessage({id,progress:90})
      model=await loadAndCompile(bytes,{accelerator:'wasm'})
      ctx.postMessage({id,progress:95})
      const actual=await predict(new Float32Array(fixture.x.flat(2)))
      const expected=fixture.float[0]
      if (actual.some((value,index)=>Math.abs(value-expected[index])>1e-5)) throw new Error('Teste de compatibilidade do modelo falhou')
      ctx.postMessage({id,progress:100})
      ctx.postMessage({id,ok:true,cached})
    } else if (type==='predict' && values) {
      ctx.postMessage({id,ok:true,values:await predict(values)})
    } else throw new Error('Operação desconhecida')
  } catch(error) { ctx.postMessage({id,ok:false,error:error instanceof Error ? error.message : 'Erro na IA'}) }
}
