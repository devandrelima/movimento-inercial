import {expect,it} from 'vitest'
import {Tracker,type Segment} from './tracker'
const flush=()=>new Promise(resolve=>setTimeout(resolve,0))
it('acumula deltas no mesmo traço após pausa e falha de coleta',async()=>{
 let segments:Segment[]=[];const tracker=new Tracker(async()=>[1,2],value=>{segments=value},()=>{})
 tracker.start();tracker.enqueue(new Float32Array(600));tracker.enqueue(new Float32Array(600));await flush()
 expect(segments[0].points).toEqual([{x:0,y:0},{x:1,y:2},{x:2,y:4}])
 tracker.pause();tracker.start();tracker.enqueue(new Float32Array(600));await flush()
 expect(segments).toHaveLength(1);expect(segments[0].points).toEqual([{x:0,y:0},{x:1,y:2},{x:2,y:4},{x:3,y:6}])
 tracker.interrupt();tracker.enqueue(new Float32Array(600));await flush()
 expect(segments[0].points.at(-1)).toEqual({x:4,y:8});tracker.clear();expect(segments).toEqual([])
})
it('descarta resultado atrasado de uma sessão pausada',async()=>{
 let resolve:(value:[number,number])=>void=()=>{};let segments:Segment[]=[]
 const tracker=new Tracker(()=>new Promise(r=>{resolve=r}),value=>{segments=value},()=>{})
 tracker.start();tracker.enqueue(new Float32Array(600));tracker.pause();resolve([5,4]);await flush();expect(segments).toEqual([])
})
it('não acumula saída inválida',async()=>{
 let message='';let segments:Segment[]=[];const tracker=new Tracker(async()=>[NaN,1],value=>{segments=value},value=>{message=value})
 tracker.start();tracker.enqueue(new Float32Array(600));await flush();expect(segments).toEqual([]);expect(message).toBe('Predição inválida')
})
