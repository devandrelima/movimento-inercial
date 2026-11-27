import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Compatibility, {ModelLoading} from './Compatibility.tsx'

function Root() {
  const [stage,setStage]=useState<'check'|'loading'|'app'|'limited'>('check')
  const [error,setError]=useState<string|null>(null)
  const [attempt,setAttempt]=useState(0)
  const [progress,setProgress]=useState(0)
  const readyTimer=useRef<number|undefined>(undefined)
  useEffect(()=>()=>window.clearTimeout(readyTimer.current),[])
  const ready=useCallback(()=>{setProgress(100);readyTimer.current=window.setTimeout(()=>setStage('app'),500)},[])
  const failed=useCallback((message:string)=>setError(message),[])
  const updated=useCallback((value:number)=>setProgress(previous=>Math.max(previous,Math.min(100,Math.floor(value)))),[])
  if(stage==='check') return <Compatibility onStart={()=>{setError(null);setStage('loading')}} onSkip={()=>setStage('limited')}/>
  return <>{stage==='loading' && <ModelLoading error={error} progress={progress} onRetry={()=>{setError(null);setProgress(0);setAttempt(n=>n+1)}}/>}<div hidden={stage!=='app'&&stage!=='limited'}><App key={attempt} limited={stage==='limited'} onModelReady={ready} onModelError={failed} onModelProgress={updated}/></div></>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
