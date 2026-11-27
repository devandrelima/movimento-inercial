import {describe,it,expect} from 'vitest'
import {readFileSync,writeFileSync} from 'node:fs'
import {MapMatcher} from '../src/map-match'
import {traversable,type Room} from '../src/room'
import type {Point} from '../src/tracker'
import {LegacyMapMatcher} from './helpers/legacy-map-matcher'

type Scenario={id:string;room:Room;truth:number[][];deltas:number[][]}
type Matcher={step(delta:Point):Point|null}
type Trace={error:number[];rawError:number[]}
type Results={scenarios:number;lost:number;covered:number;total:number;sumError:number;sumRawPaired:number;complete:number;sumFinal:number;sumRawFinal:number;crossings:number;traces:Record<string,Trace>}
const empty=():Results=>({scenarios:0,lost:0,covered:0,total:0,sumError:0,sumRawPaired:0,complete:0,sumFinal:0,sumRawFinal:0,crossings:0,traces:{}})
function replay(data:Scenario[],create:(room:Room)=>Matcher):Results {
 const result=empty()
 for(const s of data){
  const matcher=create(s.room);let raw={...s.room.start},corrected={...s.room.start};let lost=false;result.scenarios++;const trace:Trace={error:[],rawError:[]};result.traces[s.id]=trace
  for(let i=0;i<s.deltas.length;i++){
   const [dx,dy]=s.deltas[i],oldRaw=raw;raw={x:raw.x+dx,y:raw.y+dy};const actual={x:s.truth[i+1][0],y:s.truth[i+1][1]};result.total++
   if(!traversable(s.room,oldRaw,raw))result.crossings++
   if(lost)continue
   const next=matcher.step({x:dx,y:dy})
   if(!next){lost=true;result.lost++;continue}
   expect(traversable(s.room,corrected,next)).toBe(true)
   corrected=next;result.covered++;const e=Math.hypot(next.x-actual.x,next.y-actual.y),rawError=Math.hypot(raw.x-actual.x,raw.y-actual.y);result.sumError+=e;result.sumRawPaired+=rawError;trace.error.push(e);trace.rawError.push(rawError)
  }
  if(!lost){const end=s.truth.at(-1)!;result.complete++;result.sumFinal+=Math.hypot(corrected.x-end[0],corrected.y-end[1]);result.sumRawFinal+=Math.hypot(raw.x-end[0],raw.y-end[1])}
 }
 return result
}
describe.skipIf(!process.env.RONIN_MAP_FIXTURE)('replay local: previsões RoNIN e mapas sintéticos',()=>{
 it('verifica segmentos válidos e registra erros e perdas sem misturar coberturas',()=>{
  const path=process.env.RONIN_MAP_FIXTURE!
  const fixture=JSON.parse(readFileSync(path,'utf8')) as {scenarios:Scenario[]}
  expect(fixture.scenarios.length).toBeGreaterThan(0)
  const previous=replay(fixture.scenarios,r=>new LegacyMapMatcher(r)),updated=replay(fixture.scenarios,r=>new MapMatcher(r))
  const summarize=(r:Results)=>{const {traces,...rest}=r;void traces;return {...rest,coverage:r.covered/r.total,lossRate:r.lost/r.scenarios,meanPositionErrorPaired:r.sumError/r.covered,meanRawErrorPaired:r.sumRawPaired/r.covered,meanFinalCompleted:r.complete?r.sumFinal/r.complete:null,meanRawFinalCompleted:r.complete?r.sumRawFinal/r.complete:null}}
  let count=0,sumOld=0,sumNew=0,sumRaw=0,better=0,worse=0
  for(const s of fixture.scenarios){const a=previous.traces[s.id],b=updated.traces[s.id],n=Math.min(a.error.length,b.error.length);let oldTotal=0,newTotal=0;for(let i=0;i<n;i++){oldTotal+=a.error[i];newTotal+=b.error[i];sumRaw+=a.rawError[i]}count+=n;sumOld+=oldTotal;sumNew+=newTotal;if(n&&newTotal<oldTotal)better++;else if(n&&newTotal>oldTotal)worse++}
  const common={windows:count,oldMean:sumOld/count,newMean:sumNew/count,rawMean:sumRaw/count,scenariosBetter:better,scenariosWorse:worse}
  const result={note:'Mapas sintéticos colocados de modo a não cruzar a referência; não são mapas reais do RoNIN. Erros calculados somente enquanto cada filtro manteve saída; comparações usam as mesmas janelas dentro de cada filtro.',previous:summarize(previous),updated:summarize(updated),common}
  if(process.env.RONIN_MAP_RESULT)writeFileSync(process.env.RONIN_MAP_RESULT,JSON.stringify(result,null,2))
  console.log(JSON.stringify(result))
 },120000)
})
