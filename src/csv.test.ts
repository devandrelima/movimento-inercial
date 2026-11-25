import {it,expect} from 'vitest'
import {encodeCsv,motionRow} from './csv'
it('exporta valores brutos, lacunas e erros escapados',()=>{
 const event={acceleration:{x:1,y:null,z:3},accelerationIncludingGravity:{x:4,y:5,z:6},rotationRate:null,interval:16} as unknown as DeviceMotionEvent
 const row=motionRow(event,12,123); expect(row.slice(4,13)).toEqual([1,null,3,4,5,6,undefined,undefined,undefined])
 expect(encodeCsv([row,['erro',123,12,null,null,null,null,null,null,null,null,null,null,null,null,null,'erro, "teste"']])).toContain('"erro, ""teste"""')
})
