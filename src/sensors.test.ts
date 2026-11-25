import {describe,it,expect,vi,afterEach} from 'vitest'
import {readMotion,readPartialMotion,samplingHz,motionPermission,readOrientation,sensorPermissions} from './sensors'
const motion = (acc: unknown, rot: unknown) => ({accelerationIncludingGravity:acc,rotationRate:rot}) as DeviceMotionEvent
describe('sensores',()=>{
 it('converte graus/s em rad/s e mantém aceleração',()=>{const s=readMotion(motion({x:1,y:2,z:3},{alpha:180,beta:90,gamma:0}),100);expect(s?.rotation.x).toBeCloseTo(Math.PI);expect(s?.rotation.y).toBeCloseTo(Math.PI/2);expect(s?.rotation.z).toBeCloseTo(0);expect(s?.acceleration.z).toBe(3)})
 it('rejeita valores ausentes ou não finitos',()=>{expect(readMotion(motion({x:null,y:2,z:3},{alpha:1,beta:2,gamma:3}))).toBeNull();expect(readMotion(motion({x:NaN,y:2,z:3},{alpha:1,beta:2,gamma:3}))).toBeNull()})
 it('preserva valores disponíveis quando o giroscópio está ausente',()=>{const s=readPartialMotion(motion({x:1,y:2,z:3},null),20);expect(s.acceleration).toEqual({x:1,y:2,z:3});expect(s.rotation).toEqual({x:null,y:null,z:null})})
 it('mede frequência com intervalos reais',()=>{const s=readMotion(motion({x:1,y:2,z:3},{alpha:1,beta:2,gamma:3}),0)!;expect(samplingHz([s,{...s,time:20},{...s,time:40}])).toBe(50);expect(samplingHz([s])).toBeNull()})
 afterEach(()=>vi.unstubAllGlobals())
 it('identifica contexto inseguro',async()=>{vi.stubGlobal('window',{isSecureContext:false});expect(await motionPermission()).toBe('unavailable')})
 it('identifica permissão negada',async()=>{vi.stubGlobal('window',{isSecureContext:true});vi.stubGlobal('DeviceMotionEvent',{requestPermission:async()=> 'denied'});expect(await motionPermission()).toBe('denied')})
})

it('preserva orientação relativa e campos ausentes',()=>{const value=readOrientation({alpha:40,beta:null,gamma:-12,absolute:false} as DeviceOrientationEvent,123);expect(value).toEqual({time:123,alpha:40,beta:null,gamma:-12,absolute:false})})
it('solicita as duas permissões antes de esperar qualquer resposta',async()=>{
 const order:string[]=[];let resolveMotion:(x:string)=>void=()=>{}
 vi.stubGlobal('window',{isSecureContext:true})
 vi.stubGlobal('DeviceMotionEvent',{requestPermission:()=>{order.push('motion');return new Promise<string>(resolve=>{resolveMotion=resolve})}})
 vi.stubGlobal('DeviceOrientationEvent',{requestPermission:()=>{order.push('orientation');return Promise.resolve('denied')}})
 const result=sensorPermissions();expect(order).toEqual(['motion','orientation']);resolveMotion('granted')
 expect(await result).toEqual({motion:'granted',orientation:'denied'});vi.unstubAllGlobals()
})
