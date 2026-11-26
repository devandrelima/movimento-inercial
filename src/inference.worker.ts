import { Tensor, loadAndCompile, loadLiteRt, type CompiledModel } from '@litertjs/core'
import fixture from './fixtures/model-v2-reference.json'
import {readModelResponse} from './model-download'

const ctx = self as unknown as {onmessage: ((event: MessageEvent) => void) | null; postMessage: (message: unknown) => void}
const MODEL_HASH='91756152ee1babada0ea8837c0116f580c4481632f70944b982a566becf04ea1'
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
      ctx.postMessage({id,progress:5})
      const response=await fetch('/models/ronin-v2-float.tflite',{cache:'no-cache'})
      if (!response.ok) throw new Error(`Modelo indisponível (HTTP ${response.status})`)
      const buffer=await readModelResponse(response,progress=>ctx.postMessage({id,progress})),bytes=new Uint8Array(buffer)
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(x=>x.toString(16).padStart(2,'0')).join('')
      if (hash!==MODEL_HASH) throw new Error('Verificação do modelo falhou')
      ctx.postMessage({id,progress:90})
      model=await loadAndCompile(bytes,{accelerator:'wasm'})
      ctx.postMessage({id,progress:95})
      const actual=await predict(new Float32Array(fixture.x.flat(2)))
      const expected=fixture.float[0]
      if (actual.some((value,index)=>Math.abs(value-expected[index])>1e-5)) throw new Error('Teste de compatibilidade do modelo falhou')
      ctx.postMessage({id,progress:100})
      ctx.postMessage({id,ok:true})
    } else if (type==='predict' && values) {
      ctx.postMessage({id,ok:true,values:await predict(values)})
    } else throw new Error('Operação desconhecida')
  } catch(error) { ctx.postMessage({id,ok:false,error:error instanceof Error ? error.message : 'Erro na IA'}) }
}
