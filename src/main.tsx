import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Compatibility, {ModelLoading} from './Compatibility.tsx'
import {MODEL_HASH} from './model-info'
import {clearInstalledModel,saveInstalledModel,startStage} from './startup'

type Stage='boot'|'check'|'loading'|'app'|'limited'
function Root() {
  // 'boot' decide a tela pelos registros deste navegador: teste já aprovado? modelo atual já instalado?
  const [stage,setStageState]=useState<Stage>('boot')
  const stageRef=useRef<Stage>('boot')
  const setStage=useCallback((next:Stage)=>{stageRef.current=next;setStageState(next)},[])
  const [error,setError]=useState<string|null>(null)
  const [attempt,setAttempt]=useState(0)
  const [progress,setProgress]=useState(0)
  const [refresh,setRefresh]=useState(false)
  const readyTimer=useRef<number|undefined>(undefined)
  useEffect(()=>()=>window.clearTimeout(readyTimer.current),[])
  useEffect(()=>{let live=true;startStage().then(next=>{if(live)setStage(next)});return()=>{live=false}},[setStage])
  const ready=useCallback((cached:boolean)=>{
    // Só conta como instalado se o worker confirmou que guardou o arquivo verificado no cache local.
    if(cached)saveInstalledModel(MODEL_HASH)
    if(stageRef.current==='loading'){setProgress(100);readyTimer.current=window.setTimeout(()=>setStage('app'),500)}
  },[setStage])
  const failed=useCallback((message:string)=>{
    // Falhou (inclusive ao abrir direto na grade): esquece a instalação e mostra o download, sem usar o cache na nova tentativa.
    clearInstalledModel();setRefresh(true);setError(message)
    if(stageRef.current==='app'){setProgress(0);setStage('loading')}
  },[setStage])
  const updated=useCallback((value:number)=>setProgress(previous=>Math.max(previous,Math.min(100,Math.floor(value)))),[])
  if(stage==='boot') return <main className="compat-page" aria-busy="true"/>
  if(stage==='check') return <Compatibility onStart={()=>{setError(null);setStage('loading')}} onSkip={()=>setStage('limited')}/>
  return <>{stage==='loading' && <ModelLoading error={error} progress={progress} onRetry={()=>{setError(null);setProgress(0);setAttempt(n=>n+1)}}/>}<div hidden={stage!=='app'&&stage!=='limited'}><App key={attempt} limited={stage==='limited'} refresh={refresh} onModelReady={ready} onModelError={failed} onModelProgress={updated}/></div></>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
