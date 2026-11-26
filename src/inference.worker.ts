import { Tensor, loadAndCompile, loadLiteRt, type CompiledModel } from '@litertjs/core'
import fixture from './fixtures/model-reference.json'

const ctx = self as unknown as {onmessage: ((event: MessageEvent) => void) | null; postMessage: (message: unknown) => void}
const MODEL_HASH='de6c0c5cad257db988c14d39b30d8aac39758f092429c8328faab88cb958e438'
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
ctx.onmessage=async event=>{
  const {id,type,values}=event.data as {id:number;type:string;values?:Float32Array}
  try {
    if (type==='init') {
      await loadLiteRt('/wasm/')
      const response=await fetch('/models/ronin-float.tflite',{cache:'no-cache'})
      if (!response.ok) throw new Error(`Modelo indisponível (HTTP ${response.status})`)
      const buffer=await response.arrayBuffer(),bytes=new Uint8Array(buffer)
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(x=>x.toString(16).padStart(2,'0')).join('')
      if (hash!==MODEL_HASH) throw new Error('Verificação do modelo falhou')
      model=await loadAndCompile(bytes,{accelerator:'wasm'})
      const actual=await predict(new Float32Array(fixture.input.flat(2)))
      const expected=fixture.tflite_float[0]
      if (actual.some((value,index)=>Math.abs(value-expected[index])>1e-5)) throw new Error('Teste de compatibilidade do modelo falhou')
      ctx.postMessage({id,ok:true})
    } else if (type==='predict' && values) {
      ctx.postMessage({id,ok:true,values:await predict(values)})
    } else throw new Error('Operação desconhecida')
  } catch(error) { ctx.postMessage({id,ok:false,error:error instanceof Error ? error.message : 'Erro na IA'}) }
}
