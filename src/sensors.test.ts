import {describe,it,expect,vi,afterEach} from 'vitest'
import {readMotion,samplingHz,motionPermission} from './sensors'
const motion = (acc: unknown, rot: unknown) => ({accelerationIncludingGravity:acc,rotationRate:rot}) as DeviceMotionEvent
describe('sensores',()=>{
 it('converte graus/s em rad/s e mantém aceleração',()=>{const s=readMotion(motion({x:1,y:2,z:3},{alpha:180,beta:90,gamma:0}),100);expect(s?.rotation.x).toBeCloseTo(Math.PI/2);expect(s?.rotation.z).toBeCloseTo(Math.PI);expect(s?.acceleration.z).toBe(3)})
 it('rejeita valores ausentes ou não finitos',()=>{expect(readMotion(motion({x:null,y:2,z:3},{alpha:1,beta:2,gamma:3}))).toBeNull();expect(readMotion(motion({x:NaN,y:2,z:3},{alpha:1,beta:2,gamma:3}))).toBeNull()})
 it('mede frequência com intervalos reais',()=>{const s=readMotion(motion({x:1,y:2,z:3},{alpha:1,beta:2,gamma:3}),0)!;expect(samplingHz([s,{...s,time:20},{...s,time:40}])).toBe(50);expect(samplingHz([s])).toBeNull()})
 afterEach(()=>vi.unstubAllGlobals())
 it('identifica contexto inseguro',async()=>{vi.stubGlobal('window',{isSecureContext:false});expect(await motionPermission()).toBe('unavailable')})
 it('identifica permissão negada',async()=>{vi.stubGlobal('window',{isSecureContext:true});vi.stubGlobal('DeviceMotionEvent',{requestPermission:async()=> 'denied'});expect(await motionPermission()).toBe('denied')})
})
