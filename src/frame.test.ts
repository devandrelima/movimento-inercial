import {describe,expect,it} from 'vitest'
import {initializeFrame,localChannels,modelInput,orientationMatrix} from './frame'
import type {OrientationSample} from './sensors'
const orientation=(alpha:number,beta=0,gamma=0):OrientationSample=>({time:1000,alpha,beta,gamma,absolute:false})
describe('referencial do modelo',()=>{
 it('remove o yaw inicial e mantém eixos de giroscópio já convertidos',()=>{
  const o=orientation(90),frame=initializeFrame(o)
  const channels=localChannels({time:1000,orientation:o,acceleration:{x:1,y:0,z:9.81},rotation:{x:Math.PI/2,y:0,z:Math.PI}},frame)
  ;[1,0,9.81,Math.PI/2,0,Math.PI].forEach((v,i)=>expect(channels[i]).toBeCloseTo(v,10))
 })
 it('inclina o vetor para o plano esperado',()=>{
  const o=orientation(0,90,0),m=orientationMatrix(o)
  expect(m[1][2]).toBeCloseTo(-1);expect(m[2][1]).toBeCloseTo(1)
 })
 it('rejeita orientação antiga, futura, ausente ou mudança de referência',()=>{
  const o=orientation(0),f=initializeFrame(o),s={time:1600,orientation:o,acceleration:{x:0,y:0,z:9.8},rotation:{x:0,y:0,z:0}}
  expect(()=>localChannels(s,f)).toThrow(); expect(()=>localChannels({...s,time:999},f)).toThrow();expect(()=>localChannels({...s,orientation:null},f)).toThrow();expect(()=>localChannels({...s,time:1000,orientation:{...o,absolute:true}},f)).toThrow()
 })
 it('recusa eixo inicial vertical e janela incompleta',()=>{
  expect(()=>initializeFrame(orientation(0,0,90))).toThrow();expect(()=>modelInput([],initializeFrame(orientation(0)))).toThrow()
 })
})
