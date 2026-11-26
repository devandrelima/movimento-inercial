import {useEffect,useRef,useState} from 'react'
import {sensorPermissions} from './sensors'
import {SensorCheck} from './sensor-check'
import './Compatibility.css'

type State='idle'|'permission'|'testing'|'success'|'failure'
function PhoneIllustration({moving}:{moving:boolean}) {
 return <div className={`phone-art${moving?' is-moving':''}`} aria-hidden="true">
  <svg viewBox="0 0 190 200" fill="none">
   <circle cx="95" cy="91" r="76" stroke="#dbe9e7" strokeWidth="1"/>
   <path d="M30 75c-7 12-8 24-6 35M160 60c8 11 12 23 12 36" stroke="#8eb8b4" strokeWidth="2" strokeLinecap="round"/>
   <g className="phone-art-device"><rect x="66" y="22" width="59" height="111" rx="10" fill="#f5faf9" stroke="#176b6e" strokeWidth="3"/><path d="M86 29h19M91 124h10" stroke="#176b6e" strokeWidth="2.5" strokeLinecap="round"/><path d="M52 96c-3-3-8-2-9 1-2 3-1 6 2 10l22 30c5 7 7 14 8 22l2 14h61l2-21c1-8 0-17-4-24l-8-16c-3-5-9-4-10 1l-4-8c-3-5-9-3-9 2l-4-8c-3-5-9-3-9 3l-8-19c-2-5-9-4-10 1-1 2 0 5 1 7l9 24-32-19Z" fill="#e6f1ef" stroke="#176b6e" strokeWidth="3" strokeLinejoin="round"/></g>
  </svg>
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
  <div className="compat-marker"><span className="compat-compass" aria-hidden="true">✦</span><span>Navegação inercial</span></div>
  <div className="compat-content"><PhoneIllustration moving={state==='testing'}/>
   <div className="compat-copy"><p className="compat-step">PREPARAÇÃO <span>01 / 02</span></p>
    <h1>Teste se seu dispositivo é compatível</h1>
    {state==='idle' && <p className="compat-description">Toque para começar e balance seu celular por 5 segundos.</p>}
    {state==='permission' && <p className="compat-description" role="status">Verificando as permissões do navegador…</p>}
    {state==='testing' && <><p className="compat-description">Balance seu celular por 5 segundos.</p><div className="compat-progress" role="progressbar" aria-label="Tempo restante do teste" aria-valuemin={0} aria-valuemax={5} aria-valuenow={5-remaining}><div style={{width:`${(5-remaining)*20}%`}}/></div><p className="compat-timer" aria-live="off">{remaining}<span> s</span></p></>}
    {state==='success' && <p className="compat-result" role="status"><span aria-hidden="true">✓</span> Sensores disponíveis</p>}
    {state==='failure' && <p className="compat-error" role="alert">{failure}</p>}
    {(state==='idle'||state==='failure') && <button className="compat-primary" onClick={startTest}>{state==='idle'?'Testar sensores':'Tentar novamente'}<span aria-hidden="true">→</span></button>}
    {state==='success' && <button className="compat-primary" onClick={onStart}>Iniciar <span aria-hidden="true">→</span></button>}
    <p className="compat-privacy">As leituras ficam neste dispositivo.</p>
   </div>
  </div>
 </div></main>
}
export function ModelLoading({error,onRetry}:{error:string|null;onRetry:()=>void}) {
 return <main className="compat-page"><div className="loading-content" role="status" aria-live="polite">
  <div className={error?'loading-symbol error':'loading-symbol'} aria-hidden="true">{error?'!':<span/>}</div>
  <p className="compat-step">PREPARAÇÃO <span>02 / 02</span></p>
  <h1>{error?'Não foi possível carregar o modelo':'Preparando o modelo'}</h1>
  <p className="compat-description">{error||'Aguarde enquanto a inteligência é carregada no seu dispositivo.'}</p>
  {error&&<button className="compat-primary" onClick={onRetry}>Tentar novamente <span aria-hidden="true">→</span></button>}
 </div></main>
}
