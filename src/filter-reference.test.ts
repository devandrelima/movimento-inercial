import {expect,it} from 'vitest'
import fixture from './fixtures/filter-reference.json'
import {MotionPreprocessor} from './preprocess'

it('reproduz o filtro e a interpolação de referência da entrega',()=>{
 const filter=new MotionPreprocessor()
 filter.addOrientation({time:Number(fixture.events[0][0])*1000,alpha:0,beta:0,gamma:0,absolute:false})
 const all=fixture.events.flatMap(([seconds,values])=>{
   const v=values as number[]
   return filter.push({time:Number(seconds)*1000,acceleration:{x:v[0],y:v[1],z:v[2]},rotation:{x:v[3],y:v[4],z:v[5]}}).samples
 })
 // A referência da entrega descarta 1 s de estabilização; o app descarta só 200 ms (o filtro de 12 Hz já estabilizou).
 // O filtro e a interpolação são os mesmos: compara-se a partir do instante em que a referência começa a emitir.
 const firstReference=Number(fixture.expected[0][0])*1000
 expect(all[0].time).toBeLessThan(firstReference)
 const actual=all.filter(sample=>sample.time>=firstReference-1e-6)
 expect(actual).toHaveLength(fixture.expected.length)
 actual.forEach((sample,index)=>{
   const [seconds,values]=fixture.expected[index]
   expect(sample.time/1000).toBeCloseTo(Number(seconds),9)
   const v=values as number[]
   ;[sample.acceleration.x,sample.acceleration.y,sample.acceleration.z,sample.rotation.x,sample.rotation.y,sample.rotation.z].forEach((value,i)=>expect(value).toBeCloseTo(v[i],9))
 })
})
