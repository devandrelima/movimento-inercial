import {useEffect,useRef,useState} from 'react'
import {sensorPermissions} from './sensors'
import {SensorCheck} from './sensor-check'
import './Compatibility.css'

type State='idle'|'permission'|'testing'|'success'|'failure'
function PhoneIllustration({moving}:{moving:boolean}) {
 return <div className={`phone-art${moving?' is-moving':''}`} aria-hidden="true">
  <img className="phone-art-device" src="/bussola.png" alt="" width="512" height="512"/>
 </div>
}
export default function Compatibility({onStart}:{onStart:()=>void}) {
 const [state,setState]=useState<State>('idle'),[remaining,setRemaining]=useState(5),[failure,setFailure]=useState('')
 const cleanup=useRef<()=>void>(()=>{}),token=useRef(0)
 useEffect(()=>()=>{token.current++;cleanup.current()},[])
 async function startTest() {
  cleanup.current();const run=++token.current;setState('permission');setFailure('');setRemaining(5)
  const permission=await sensorPermissions()
  if(run!==token.current)return
  if(permission.motion!=='granted' || permission.orientation!=='granted') {
   const denied=permission.motion==='denied'||permission.orientation==='denied'
   setFailure(denied?'Permissão de movimento ou orientação negada. Verifique as permissões do navegador e tente novamente.':'Sensores de movimento ou orientação indisponíveis neste navegador. Acesse pelo celular usando HTTPS.')
   setState('failure');return
  }
  const check=new SensorCheck(),start=performance.now()
  const motion=(event:DeviceMotionEvent)=>check.motion(event,performance.now())
  const orientation=(event:DeviceOrientationEvent)=>check.orientationEvent(event,performance.now())
  window.addEventListener('devicemotion',motion);window.addEventListener('deviceorientation',orientation)
  const timer=window.setInterval(()=>{
   const left=Math.max(0,Math.ceil((5000-(performance.now()-start))/1000));setRemaining(left)
   if(left>0)return
   cleanup.current();const result=check.result()
   if(result.compatible)setState('success')
   else {setFailure(`Não recebemos leituras suficientes: ${result.missing.join(', ')}. Confira as permissões e tente novamente.`);setState('failure')}
  },100)
  cleanup.current=()=>{window.clearInterval(timer);window.removeEventListener('devicemotion',motion);window.removeEventListener('deviceorientation',orientation)}
  setState('testing')
 }
 return <main className="compat-page"><div className="compat-container">
  <div className="compat-content"><PhoneIllustration moving={state==='testing'}/>
   <div className="compat-copy">
    <h1>Teste se seu dispositivo é compatível</h1>
    {state==='idle' && <p className="compat-description">Toque para começar e balance seu celular por 5 segundos.</p>}
    {state==='permission' && <p className="compat-description" role="status">Verificando as permissões do navegador…</p>}
    {state==='testing' && <><p className="compat-description">Balance seu celular por 5 segundos.</p><div className="compat-progress" role="progressbar" aria-label="Tempo restante do teste" aria-valuemin={0} aria-valuemax={5} aria-valuenow={5-remaining}><div style={{width:`${(5-remaining)*20}%`}}/></div><p className="compat-timer" aria-live="off">{remaining}<span> s</span></p></>}
    {state==='success' && <p className="compat-result" role="status"><span aria-hidden="true">✓</span> Sensores disponíveis</p>}
    {state==='failure' && <p className="compat-error" role="alert">{failure}</p>}
    {(state==='idle'||state==='failure') && <button className="compat-primary" onClick={startTest}>{state==='idle'?'Testar sensores':'Tentar novamente'}<span aria-hidden="true">→</span></button>}
    {state==='success' && <button className="compat-primary" onClick={onStart}>Iniciar <span aria-hidden="true">→</span></button>}
   </div>
  </div>
 </div></main>
}
export function ModelLoading({error,onRetry}:{error:string|null;onRetry:()=>void}) {
 return <main className="compat-page"><div className="loading-content" role="status" aria-live="polite">
  <div className={error?'loading-symbol error':'loading-symbol'} aria-hidden="true">{error?'!':<span/>}</div>
  <h1>{error?'Não foi possível carregar o modelo':'Preparando o modelo'}</h1>
  <p className="compat-description">{error||'Aguarde enquanto a inteligência é carregada no seu dispositivo.'}</p>
  {error&&<button className="compat-primary" onClick={onRetry}>Tentar novamente <span aria-hidden="true">→</span></button>}
 </div></main>
}
