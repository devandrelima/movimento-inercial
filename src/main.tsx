import { StrictMode, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Compatibility, {ModelLoading} from './Compatibility.tsx'

function Root() {
  const [stage,setStage]=useState<'check'|'loading'|'app'>('check')
  const [error,setError]=useState<string|null>(null)
  const [attempt,setAttempt]=useState(0)
  const ready=useCallback(()=>setStage('app'),[])
  const failed=useCallback((message:string)=>setError(message),[])
  if(stage==='check') return <Compatibility onStart={()=>{setError(null);setStage('loading')}}/>
  return <>{stage==='loading' && <ModelLoading error={error} onRetry={()=>{setError(null);setAttempt(n=>n+1)}}/>}<div hidden={stage!=='app'}><App key={attempt} onModelReady={ready} onModelError={failed}/></div></>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
