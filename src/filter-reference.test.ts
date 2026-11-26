import {expect,it} from 'vitest'
import fixture from './fixtures/filter-reference.json'
import {MotionPreprocessor} from './preprocess'

it('reproduz o filtro e a interpolação de referência da entrega',()=>{
 const filter=new MotionPreprocessor()
 const actual=fixture.events.flatMap(([seconds,values])=>{
   const v=values as number[]
   return filter.push({time:Number(seconds)*1000,acceleration:{x:v[0],y:v[1],z:v[2]},rotation:{x:v[3],y:v[4],z:v[5]}}).samples
 })
 expect(actual).toHaveLength(fixture.expected.length)
 actual.forEach((sample,index)=>{
   const [seconds,values]=fixture.expected[index]
   expect(sample.time/1000).toBeCloseTo(Number(seconds),9)
   const v=values as number[]
   ;[sample.acceleration.x,sample.acceleration.y,sample.acceleration.z,sample.rotation.x,sample.rotation.y,sample.rotation.z].forEach((value,i)=>expect(value).toBeCloseTo(v[i],9))
 })
})
