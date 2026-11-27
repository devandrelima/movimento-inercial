import { useEffect, useRef, useState } from 'react'
import { sensorPermissions, readOrientation, readPartialMotion, type OrientationSample, type PartialSample, type PartialVector } from './sensors'
import { encodeCsv, motionRow, orientationRow, preparedRow, sessionRow, type Row } from './csv'
import './App.css'
import { MotionPreprocessor, type PreparedWindow, type PreprocessState } from './preprocess'
import Map from './Map'
import {initializeFrame,modelInput,type LocalFrame} from './frame'
import {ModelClient} from './model-client'
import {Tracker,type Segment,type Point} from './tracker'
import {planRoute} from './route'
import {loadRoom,ROOM_STORAGE_KEY,type Room} from './room'
import {RoomPath,type MatchedPath} from './map-match'
import RoomEditor from './RoomEditor'
import PublicMaps from './PublicMaps'
import {loadLink,saveLink,type RoomLink} from './room-link'
import type {PublicMap} from './api'

const format = (n: number | null | undefined) => n == null ? '—' : n.toFixed(2)
function Readings({ label, unit, values, labels = ['X','Y','Z'] }: { label: string; unit: string; values?: PartialVector; labels?: string[] }) {
  return <section className="reading"><div className="reading-title"><h2>{label}</h2><span>{unit}</span></div><div className="axes">{(['x', 'y', 'z'] as const).map((axis, index) => <div key={axis}><small>{labels[index]}</small><strong>{format(values?.[axis])}</strong></div>)}</div></section>
}
const LIMIT = 36000
const LIMITED_MESSAGE='Este aparelho não consegue rodar o modelo de trajetória. Você ainda pode criar, editar e carregar mapas.'
function App({limited=false,onModelReady,onModelError,onModelProgress}:{limited?:boolean;onModelReady:()=>void;onModelError:(message:string)=>void;onModelProgress:(value:number)=>void}) {
  const [sample, setSample] = useState<PartialSample>()
  const [orientation, setOrientation] = useState<OrientationSample>()
  const [orientationStatus, setOrientationStatus] = useState('Aguardando início')
  const orientationLatest = useRef<number | null>(null)
  const orientationRendered = useRef(0)
  const permissionPending = useRef(false)
  const orientationPermission = useRef<'granted'|'denied'|'unavailable'>('unavailable')
  const runId = useRef(0)
  const [status, setStatus] = useState('Pronto para iniciar')
  const [running, setRunning] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [count, setCount] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)
  const [mapReset, setMapReset] = useState(0)
  const [limitReached, setLimitReached] = useState(false)
  const [preprocessState, setPreprocessState] = useState<PreprocessState>('warming')
  const [segments,setSegments] = useState<Segment[]>([])
  const [room,setRoom] = useState<Room|null>(loadRoom)
  const [goal,setGoal]=useState<Point|null>(null)
  const [goalX,setGoalX]=useState(''),[goalY,setGoalY]=useState('')
  const [goalError,setGoalError]=useState('')
  const [goalPanel,setGoalPanel]=useState(false)
  const [initialRoute,setInitialRoute]=useState<Point[]|null>(null)
  const goalRef=useRef<Point|null>(null)
  const roomRef=useRef(room)
  const roomPath=useRef<RoomPath|null>(null)
  const [matched,setMatched]=useState<MatchedPath|null>(null)
  const [editingRoom,setEditingRoom]=useState(false)
  const [showMaps,setShowMaps]=useState(false)
  const [link,setLink]=useState<RoomLink|null>(loadLink)
  const [roomStorageWarning,setRoomStorageWarning]=useState(false)
  const [limitedNotice,setLimitedNotice]=useState(false)
  const [positionGap,setPositionGap] = useState(false)
  const [modelStatus,setModelStatus] = useState('Carregando IA v2 experimental…')
  const modelReady = useRef(false)
  const model = useRef<ModelClient | null>(null)
  const frame = useRef<LocalFrame | null>(null)
  const preprocessor = useRef(new MotionPreprocessor())
  const latestWindow = useRef<PreparedWindow | null>(null)
  const active = useRef(false)
  const records = useRef<Row[]>([])
  const recent = useRef<PartialSample[]>([])
  const lastRender = useRef(0)
  const lastMotion = useRef<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const started = useRef(false)
  const tracker = useRef<Tracker | null>(null)
  if (!tracker.current) tracker.current=new Tracker(
    async input=>{if (!model.current || !modelReady.current) throw new Error('IA indisponível');return model.current.predict(input)},
    value=>{setSegments(value);if(!value.length){roomPath.current=null;setMatched(null)}else if(roomRef.current){roomPath.current??=new RoomPath(roomRef.current,goalRef.current);setMatched(roomPath.current.update(value[0].points))}setModelStatus('IA v2 experimental · estimando trajetória')},
    message=>{preprocessor.current.reset();latestWindow.current=null;setPositionGap(true);setModelStatus(`IA interrompida: ${message}`)},
  )
  useEffect(()=>{
    if(limited){setModelStatus('IA indisponível neste aparelho');return}
    let mounted=true
    let client:ModelClient
    try {client=new ModelClient();model.current=client}
    catch {setModelStatus('IA indisponível neste navegador');onModelError('Seu navegador não conseguiu iniciar o processamento do modelo.');return}
    client.initialize(value=>{if(mounted)onModelProgress(value)}).then(()=>{
      if (!mounted) return
      modelReady.current=true
      setModelStatus(active.current ? 'IA v2 experimental · aguardando orientação' : 'IA v2 experimental pronta')
      onModelReady()
    }).catch(error=>{if (mounted) {modelReady.current=false;const message=error instanceof Error ? error.message : 'Falha ao carregar o modelo';setModelStatus(`IA indisponível: ${message}`);onModelError(message)}})
    return ()=>{mounted=false;modelReady.current=false;tracker.current?.pause();client.dispose();if (model.current===client)model.current=null}
  },[limited,onModelReady,onModelError,onModelProgress])
  useEffect(() => {
    const onMotion = (event: DeviceMotionEvent) => {
      if (!active.current) return
      const now = performance.now()
      lastMotion.current=now
      if (records.current.length >= LIMIT) {
        active.current = false; tracker.current?.pause(); frame.current=null; latestWindow.current=null; setRunning(false); setLimitReached(true); setStatus('Limite de gravação atingido'); return
      }
      records.current.push(motionRow(event, now, Date.now()))
      const current = readPartialMotion(event, now)
      const prepared = preprocessor.current.push(current)
      const wallNow=Date.now()
      for (const filtered of prepared.samples) {
        if (records.current.length >= LIMIT) { active.current=false; tracker.current?.pause(); frame.current=null; latestWindow.current=null; setRunning(false); setLimitReached(true); setStatus('Limite de gravação atingido'); break }
        records.current.push(preparedRow(filtered,wallNow-(now-filtered.time)))
      }
      if (!active.current) { setCount(records.current.length); return }
      if (prepared.state === 'gap' || prepared.state === 'missing' || prepared.state === 'low-rate') {
        latestWindow.current=null
        if (frame.current) {tracker.current?.interrupt();setPositionGap(true);setModelStatus('IA pausada · aguardando leituras')}
      }
      if (prepared.samples.some(item=>!item.orientation || (frame.current && item.orientation.absolute!==frame.current.absolute))) {
        if (frame.current) {tracker.current?.interrupt();preprocessor.current.reset();latestWindow.current=null;setPositionGap(true);setModelStatus('IA pausada · orientação indisponível')}
      } else if (prepared.window && frame.current && modelReady.current) {
        try {
          const input=modelInput(prepared.window.samples,frame.current)
          if (tracker.current?.enqueue(input)) latestWindow.current=prepared.window
        } catch {tracker.current?.interrupt();preprocessor.current.reset();latestWindow.current=null;setPositionGap(true);setModelStatus('IA pausada · orientação incompleta')}
      }
      recent.current.push(current)
      if (recent.current.length > 100) recent.current.shift()
      if (now - lastRender.current >= 200) {
        const missingAccel = Object.values(current.acceleration).some(value => value === null)
        const missingGyro = Object.values(current.rotation).some(value => value === null)
        setSample(current); setCount(records.current.length); setPreprocessState(prepared.state)
        setStatus(missingAccel && missingGyro ? 'Sensores indisponíveis' : missingGyro ? 'Giroscópio indisponível' : missingAccel ? 'Acelerômetro indisponível' : 'Sensores ativos')
        lastRender.current = now
      }
    }
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (!active.current) return
      const now=performance.now()
      if (records.current.length >= LIMIT) { active.current=false; tracker.current?.pause(); frame.current=null; latestWindow.current=null; setRunning(false); setLimitReached(true); setStatus('Limite de gravação atingido'); return }
      records.current.push(orientationRow(event, now, Date.now()))
      const current=readOrientation(event,now)
      if ([current.alpha,current.beta,current.gamma].every(value=>value!==null)) {
        if (frame.current && frame.current.absolute!==current.absolute) {tracker.current?.interrupt();preprocessor.current.reset();latestWindow.current=null;setPositionGap(true);setOrientationStatus('Referência de orientação alterada');setModelStatus('IA pausada · referência de orientação alterada');return}
        if (!frame.current) {
          try {frame.current=initializeFrame(current);preprocessor.current.reset();if(modelReady.current)setModelStatus('IA v2 experimental · preparando trajetória')}
          catch {setModelStatus('IA pausada · ajuste a orientação do aparelho')}
        }
      }
      preprocessor.current.addOrientation(current)
      orientationLatest.current=now
      if ([current.alpha,current.beta,current.gamma].every(value => value === null)) { setOrientationStatus('Orientação sem valores'); return }
      if (now-orientationRendered.current >= 200) { setOrientation(current); setOrientationStatus(current.absolute ? 'Orientação absoluta' : 'Orientação relativa'); setCount(records.current.length); orientationRendered.current=now }
    }
    window.addEventListener('devicemotion', onMotion)
    window.addEventListener('deviceorientation', onOrientation)
    const watchdog=window.setInterval(()=>{
      if (active.current && lastMotion.current !== null && performance.now()-lastMotion.current>1000) {
        lastMotion.current=null; preprocessor.current.reset(); tracker.current?.interrupt(); setPositionGap(true); latestWindow.current=null; recent.current=[]; lastRender.current=0; if(modelReady.current)setModelStatus('IA pausada · leituras interrompidas')
        setPreprocessState('gap'); setStatus('Leituras de movimento interrompidas')
      }
    },500)
    return () => { active.current = false; window.clearInterval(watchdog); window.removeEventListener('devicemotion', onMotion); window.removeEventListener('deviceorientation', onOrientation) }
  }, [])
  useEffect(() => { if (confirmReset && dialog.current && !dialog.current.open) dialog.current.showModal() }, [confirmReset])
  async function toggle() {
    if (active.current) { active.current = false; tracker.current?.pause(); setPositionGap(true); if(modelReady.current)setModelStatus('IA v2 experimental · pausada'); lastMotion.current=null; preprocessor.current.reset(); latestWindow.current=null; setPreprocessState('warming'); runId.current++; if (records.current.length < LIMIT) records.current.push(sessionRow('pausa',performance.now(),Date.now())); setRunning(false); setCount(records.current.length); setStatus('Pausado'); setOrientationStatus('Pausado'); return }
    if (limitReached) { setStatus('Limite atingido. Exporte ou reinicie a coleta.'); return }
    if (permissionPending.current) return
    permissionPending.current=true; setRequesting(true); const token=++runId.current
    const permission = await sensorPermissions()
    permissionPending.current=false; setRequesting(false)
    if (token !== runId.current) return
    if (permission.motion !== 'granted') { setStatus(permission.motion === 'denied' ? 'Permissão negada' : 'Sensores indisponíveis ou conexão insegura'); return }
    orientationPermission.current=permission.orientation; orientationLatest.current=null; orientationRendered.current=0; setOrientation(undefined)
    setOrientationStatus(permission.orientation === 'denied' ? 'Permissão de orientação negada' : permission.orientation === 'unavailable' ? 'Orientação indisponível' : 'Aguardando orientação')
    records.current.push(sessionRow('inicio',performance.now(),Date.now())); const currentRun = token
    tracker.current?.start(); if(modelReady.current)setModelStatus('IA v2 experimental · aguardando orientação')
    preprocessor.current.reset(); lastMotion.current=null; latestWindow.current=null; setPreprocessState('warming'); recent.current = []; lastRender.current = 0; active.current = true; setRunning(true); started.current = true; setStatus('Aguardando sensores')
    window.setTimeout(() => { if (!active.current || runId.current !== currentRun) return; if (recent.current.length === 0) setStatus('Nenhuma leitura de movimento'); if (orientationPermission.current === 'granted' && orientationLatest.current === null) setOrientationStatus('Nenhuma orientação recebida') }, 5000)
  }
  function reset() {
    active.current = false; tracker.current?.clear(); frame.current=null; if(modelReady.current)setModelStatus('IA v2 experimental pronta'); lastMotion.current=null; preprocessor.current.reset(); latestWindow.current=null; setPreprocessState('warming'); runId.current++; orientationLatest.current=null; started.current = false; records.current = []; recent.current = []; lastRender.current = 0
    setMapReset(value=>value+1); setPositionGap(false); setRunning(false); setSample(undefined); setOrientation(undefined); setOrientationStatus('Aguardando início'); setCount(0); setLimitReached(false); setStatus('Pronto para iniciar'); setConfirmReset(false); dialog.current?.close()
  }
  function download() {
    const url = URL.createObjectURL(new Blob([encodeCsv(records.current)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'sensores.csv'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function saveRoom(next:Room|null) {
    goalRef.current=null;setGoal(null);setInitialRoute(null);setGoalError('');setGoalX('');setGoalY('')
    roomRef.current=next;setRoom(next);roomPath.current=null;setMatched(null);setEditingRoom(false)
    if(!next){setLink(null);saveLink(null)}
    try {if(next)localStorage.setItem(ROOM_STORAGE_KEY,JSON.stringify(next));else localStorage.removeItem(ROOM_STORAGE_KEY);setRoomStorageWarning(false)} catch {setRoomStorageWarning(true)}
  }
  function applyGoal() {
    if(!room || started.current)return
    const x=Number(goalX),y=Number(goalY)
    if(!goalX.trim()||!goalY.trim()||!Number.isFinite(x)||!Number.isFinite(y)){setGoalError('Informe coordenadas X e Y válidas.');return}
    const next={x,y},route=planRoute(room,room.start,next)
    if(!route){setGoalError('Não foi encontrada rota com margem de 20 cm. Confira o destino, a origem e os obstáculos.'+(goal?' O destino anterior permanece ativo.':''));return}
    goalRef.current=next;setGoal(next);setInitialRoute(route);setGoalError('');setGoalPanel(false)
  }
  function clearGoal(){if(started.current)return;goalRef.current=null;setGoal(null);setInitialRoute(null);setGoalError('')}
  function changeLink(next:RoomLink|null){setLink(next);saveLink(next)}
  function usePublicMap(map:PublicMap,edit:boolean) {
    saveRoom(map.room);changeLink({id:map.id,name:map.name});setShowMaps(false);if(edit)setEditingRoom(true)
  }
  if(editingRoom)return <RoomEditor initial={room} link={link} onSave={saveRoom} onPublished={(published,next)=>{saveRoom(published);changeLink(next)}} onUnlinked={()=>changeLink(null)} onCancel={()=>setEditingRoom(false)}/>
  if(showMaps)return <PublicMaps link={link} onUse={usePublicMap} onUnlink={id=>{if(link?.id===id)changeLink(null)}} onClose={()=>setShowMaps(false)}/>
  return <div className="shell"><main><Map resetKey={mapReset} segments={segments} room={room} matched={matched} goal={goal} route={matched ? matched.route : initialRoute} locked={started.current} limited={limited} onEditRoom={()=>setEditingRoom(true)} onOpenMaps={()=>setShowMaps(true)}/><section className="instrument" aria-label="Leituras dos sensores">{room && !started.current && <details className="route-settings" aria-label="Destino opcional" open={goalPanel} onToggle={e=>setGoalPanel(e.currentTarget.open)}><summary>Destino opcional{goal?` · ${goal.x.toFixed(2)}, ${goal.y.toFixed(2)} m`:null}</summary><p>Informe um destino em metros para sugerir uma rota. A pessoa pode seguir outro caminho.</p><div className="route-controls"><label>X (m)<input type="number" step="0.1" value={goalX} onChange={e=>setGoalX(e.target.value)} disabled={started.current}/></label><label>Y (m)<input type="number" step="0.1" value={goalY} onChange={e=>setGoalY(e.target.value)} disabled={started.current}/></label><button type="button" onClick={applyGoal} disabled={started.current}>Traçar rota</button>{goal&&<button type="button" onClick={clearGoal} disabled={started.current}>Remover destino</button>}</div>{goalError&&<p role="alert">{goalError}</p>}{goal&&<p role="status">Destino: {goal.x.toFixed(2)}, {goal.y.toFixed(2)} m. Rota sugerida; a posição estimada continua incerta.{started.current?' Para mudar o destino, reinicie a sessão.':''}</p>}{goal&&matched&&!matched.route&&!matched.lost&&<p role="status">Não foi possível recalcular a rota com a margem de 20 cm a partir da posição estimada.</p>}</details>}{goal&&started.current&&matched&&!matched.route&&!matched.lost&&<p className="hint" role="status">Não foi possível recalcular a rota com a margem de 20 cm a partir da posição estimada.</p>}<div className="instrument-head"><h2>Leituras ao vivo</h2></div><div className="readings"><Readings label="Aceleração com gravidade" unit="m/s²" values={sample?.acceleration}/><Readings label="Giroscópio" unit="rad/s" values={sample?.rotation}/><Readings label="Orientação" unit="graus" labels={['α','β','γ']} values={orientation ? {x:orientation.alpha,y:orientation.beta,z:orientation.gamma} : undefined}/></div><div role="status" aria-live="polite">{['Permissão de orientação negada','Orientação indisponível','Nenhuma orientação recebida','Orientação sem valores','Referência de orientação alterada'].includes(orientationStatus) && <p className="orientation-status">{orientationStatus}</p>}{['Permissão negada','Sensores indisponíveis ou conexão insegura','Sensores indisponíveis','Giroscópio indisponível','Acelerômetro indisponível','Nenhuma leitura de movimento','Leituras de movimento interrompidas','Limite de gravação atingido','Limite atingido. Exporte ou reinicie a coleta.'].includes(status) && <p className="sensor-status">{status}</p>}</div>{running && ['low-rate','gap','missing'].includes(preprocessState) && <p className="processing-status" role="status">{preprocessState === 'low-rate' ? 'Frequência insuficiente para o modelo' : preprocessState === 'gap' ? 'Leituras interrompidas; aguardando sensores' : 'Dados incompletos dos sensores'}</p>}{limitedNotice && <p className="hint limited-notice" role="alert">{LIMITED_MESSAGE}</p>}{(modelStatus.includes('estimando trajetória') || modelStatus.startsWith('IA interrompida') || modelStatus.startsWith('IA pausada') || modelStatus.startsWith('IA indisponível')) && <p className="model-status" role="status">{modelStatus.includes('estimando trajetória') ? 'Estimando trajetória' : modelStatus}</p>}{matched?.lost && <p className="hint" role="alert">Sem caminho compatível com a sala. A correção foi interrompida; o CSV de trajetórias traz o traço original.</p>}{matched?.constrained && !matched.lost && <p className="hint" role="status">O mapa restringiu a trajetória estimada. O caminho real continua incerto; compare com a trajetória original.</p>}{roomStorageWarning && <p className="hint">Não foi possível salvar a sala no dispositivo; ela ficará disponível apenas nesta página.</p>}{positionGap && <p className="hint">Movimentos durante pausas ou falhas não são estimados.</p>}<div className="controls"><button className="reset" aria-disabled={limited||undefined} onClick={() => limited ? setLimitedNotice(true) : setConfirmReset(true)} aria-label="Resetar dados">↺ <span>Resetar</span></button><button className="download" onClick={download} disabled={count === 0}>Baixar CSV</button><button className="play" aria-disabled={limited||undefined} onClick={limited ? () => setLimitedNotice(true) : toggle} disabled={!limited&&requesting} aria-label={running ? 'Pausar coleta' : started.current ? 'Retomar coleta' : 'Iniciar coleta'}>{running ? <span aria-hidden="true">Ⅱ</span> : <span aria-hidden="true">▶</span>}</button></div>{limitReached && <p className="hint">Limite de gravação atingido. Baixe o CSV antes de resetar.</p>}</section></main><dialog ref={dialog} onClose={() => setConfirmReset(false)} onCancel={() => setConfirmReset(false)}><h2>Resetar dados?</h2><p>Os dados coletados e a trajetória serão apagados. Esta ação não pode ser desfeita.</p><div className="dialog-actions"><button className="secondary" onClick={() => {dialog.current?.close(); setConfirmReset(false)}}>Cancelar</button><button className="confirm" onClick={reset}>Resetar</button></div></dialog></div>
}
export default App
