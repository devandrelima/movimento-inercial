import {expect,it} from 'vitest'
import {readModelResponse} from './model-download'
it('acompanha bytes recebidos e conclui somente após o fluxo terminar',async()=>{
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1,2]));controller.enqueue(new Uint8Array([3,4]));controller.close()}})
 const values:number[]=[];const buffer=await readModelResponse(new Response(stream,{headers:{'content-length':'4'}}),n=>values.push(n))
 expect([...new Uint8Array(buffer)]).toEqual([1,2,3,4]);expect(values).toEqual([45,84,85])
})
it('não inventa progresso intermediário sem tamanho conhecido',async()=>{
 const values:number[]=[];await readModelResponse(new Response(new Uint8Array([1,2,3])),n=>values.push(n));expect(values).toEqual([85])
})
