import { useEffect, useRef, useState } from 'react'
import { sensorPermissions, readOrientation, readPartialMotion, samplingHz, type OrientationSample, type PartialSample, type PartialVector } from './sensors'
import { encodeCsv, motionRow, orientationRow, preparedRow, sessionRow, type Row } from './csv'
import './App.css'
import { MotionPreprocessor, type PreparedWindow, type PreprocessState } from './preprocess'

const format = (n: number | null | undefined) => n == null ? '—' : n.toFixed(2)
function Readings({ label, unit, values, labels = ['X','Y','Z'] }: { label: string; unit: string; values?: PartialVector; labels?: string[] }) {
  return <section className="reading"><div className="reading-title"><h2>{label}</h2><span>{unit}</span></div><div className="axes">{(['x', 'y', 'z'] as const).map((axis, index) => <div key={axis}><small>{labels[index]}</small><strong>{format(values?.[axis])}</strong></div>)}</div></section>
}
const LIMIT = 36000
function App() {
  const [sample, setSample] = useState<PartialSample>()
  const [orientation, setOrientation] = useState<OrientationSample>()
  const [orientationStatus, setOrientationStatus] = useState('Aguardando início')
  const orientationLatest = useRef<number | null>(null)
  const orientationRendered = useRef(0)
  const permissionPending = useRef(false)
  const orientationPermission = useRef<'granted'|'denied'|'unavailable'>('unavailable')
  const runId = useRef(0)
  const [hz, setHz] = useState<number | null>(null)
  const [status, setStatus] = useState('Pronto para iniciar')
  const [running, setRunning] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [count, setCount] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const [preprocessState, setPreprocessState] = useState<PreprocessState>('warming')
  const [windowCount, setWindowCount] = useState(0)
  const preprocessor = useRef(new MotionPreprocessor())
  const latestWindow = useRef<PreparedWindow | null>(null)
  const active = useRef(false)
  const records = useRef<Row[]>([])
  const recent = useRef<PartialSample[]>([])
  const lastRender = useRef(0)
  const lastMotion = useRef<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const onMotion = (event: DeviceMotionEvent) => {
      if (!active.current) return
      const now = performance.now()
      lastMotion.current=now
      if (records.current.length >= LIMIT) {
        active.current = false; setRunning(false); setLimitReached(true); setStatus('Limite de gravação atingido'); return
      }
      records.current.push(motionRow(event, now, Date.now()))
      const current = readPartialMotion(event, now)
      const prepared = preprocessor.current.push(current)
      const wallNow=Date.now()
      for (const filtered of prepared.samples) {
        if (records.current.length >= LIMIT) { active.current=false; setRunning(false); setLimitReached(true); setStatus('Limite de gravação atingido'); break }
        records.current.push(preparedRow(filtered,wallNow-(now-filtered.time)))
      }
      if (!active.current) { setCount(records.current.length); return }
      if (prepared.window) { latestWindow.current=prepared.window; setWindowCount(value=>value+1) }
      if (prepared.state === 'gap' || prepared.state === 'missing' || prepared.state === 'low-rate') latestWindow.current=null
      recent.current.push(current)
      if (recent.current.length > 100) recent.current.shift()
      if (now - lastRender.current >= 200) {
        const missingAccel = Object.values(current.acceleration).some(value => value === null)
        const missingGyro = Object.values(current.rotation).some(value => value === null)
        setSample(current); setCount(records.current.length); setHz(samplingHz(recent.current)); setPreprocessState(prepared.state)
        setStatus(missingAccel && missingGyro ? 'Sensores indisponíveis' : missingGyro ? 'Giroscópio indisponível' : missingAccel ? 'Acelerômetro indisponível' : 'Sensores ativos')
        lastRender.current = now
      }
    }
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (!active.current) return
      const now=performance.now()
      if (records.current.length >= LIMIT) { active.current=false; setRunning(false); setLimitReached(true); setStatus('Limite de gravação atingido'); return }
      records.current.push(orientationRow(event, now, Date.now()))
      const current=readOrientation(event,now)
      preprocessor.current.addOrientation(current)
      orientationLatest.current=now
      if ([current.alpha,current.beta,current.gamma].every(value => value === null)) { setOrientationStatus('Orientação sem valores'); return }
      if (now-orientationRendered.current >= 200) { setOrientation(current); setOrientationStatus(current.absolute ? 'Orientação absoluta' : 'Orientação relativa'); setCount(records.current.length); orientationRendered.current=now }
    }
    window.addEventListener('devicemotion', onMotion)
    window.addEventListener('deviceorientation', onOrientation)
    const watchdog=window.setInterval(()=>{
      if (active.current && lastMotion.current !== null && performance.now()-lastMotion.current>1000) {
        lastMotion.current=null; preprocessor.current.reset(); latestWindow.current=null; recent.current=[]; lastRender.current=0
        setHz(null); setPreprocessState('gap'); setStatus('Leituras de movimento interrompidas')
      }
    },500)
    return () => { active.current = false; window.clearInterval(watchdog); window.removeEventListener('devicemotion', onMotion); window.removeEventListener('deviceorientation', onOrientation) }
  }, [])
  useEffect(() => { if (confirmReset && dialog.current && !dialog.current.open) dialog.current.showModal() }, [confirmReset])
  async function toggle() {
    if (active.current) { active.current = false; lastMotion.current=null; preprocessor.current.reset(); latestWindow.current=null; setPreprocessState('warming'); runId.current++; if (records.current.length < LIMIT) records.current.push(sessionRow('pausa',performance.now(),Date.now())); setRunning(false); setCount(records.current.length); setStatus('Pausado'); setOrientationStatus('Pausado'); return }
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
    preprocessor.current.reset(); lastMotion.current=null; latestWindow.current=null; setPreprocessState('warming'); recent.current = []; lastRender.current = 0; active.current = true; setRunning(true); started.current = true; setStatus('Aguardando sensores')
    window.setTimeout(() => { if (!active.current || runId.current !== currentRun) return; if (recent.current.length === 0) setStatus('Nenhuma leitura de movimento'); if (orientationPermission.current === 'granted' && orientationLatest.current === null) setOrientationStatus('Nenhuma orientação recebida') }, 5000)
  }
  function reset() {
    active.current = false; lastMotion.current=null; preprocessor.current.reset(); latestWindow.current=null; setPreprocessState('warming'); setWindowCount(0); runId.current++; orientationLatest.current=null; started.current = false; records.current = []; recent.current = []; lastRender.current = 0
    setRunning(false); setSample(undefined); setOrientation(undefined); setOrientationStatus('Aguardando início'); setCount(0); setHz(null); setLimitReached(false); setStatus('Pronto para iniciar'); setConfirmReset(false); dialog.current?.close()
  }
  function download() {
    const url = URL.createObjectURL(new Blob([encodeCsv(records.current)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'sensores.csv'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="shell"><main><section className="field" aria-label="Plano de trajetória"><div className="field-top"><span>Plano de trajetória</span><span>Grade: 1 m × 1 m</span></div><div className="crosshair"><div className="origin"/><span>Origem</span></div><div className="field-foot"><span>X →</span><span>Y ↑</span></div><p className="model-note">Trajetória disponível após validação do modelo.</p></section><section className="instrument" aria-label="Leituras dos sensores"><div className="instrument-head"><h2>Leituras ao vivo</h2><span>{hz === null ? '— Hz' : `${hz.toFixed(1)} Hz`}</span></div><div className="readings"><Readings label="Aceleração com gravidade" unit="m/s²" values={sample?.acceleration}/><Readings label="Giroscópio" unit="rad/s" values={sample?.rotation}/><Readings label="Orientação" unit="graus" labels={['α','β','γ']} values={orientation ? {x:orientation.alpha,y:orientation.beta,z:orientation.gamma} : undefined}/></div><div role="status" aria-live="polite">{['Permissão de orientação negada','Orientação indisponível','Nenhuma orientação recebida','Orientação sem valores'].includes(orientationStatus) && <p className="orientation-status">{orientationStatus}</p>}{['Permissão negada','Sensores indisponíveis ou conexão insegura','Sensores indisponíveis','Giroscópio indisponível','Acelerômetro indisponível','Nenhuma leitura de movimento','Leituras de movimento interrompidas','Limite de gravação atingido','Limite atingido. Exporte ou reinicie a coleta.'].includes(status) && <p className="sensor-status">{status}</p>}</div>{running && <p className="processing-status" role="status">{preprocessState === 'ready' ? `50 Hz · ${windowCount} janelas preparadas` : preprocessState === 'low-rate' ? 'Frequência inferior a 50 Hz' : preprocessState === 'gap' ? 'Intervalo interrompido; reiniciando janela' : preprocessState === 'missing' ? 'Dados incompletos para a janela' : 'Preparando entrada a 50 Hz'}</p>}<div className="controls"><button className="reset" onClick={() => setConfirmReset(true)} aria-label="Resetar dados">↺ <span>Resetar</span></button><button className="download" onClick={download} disabled={count === 0}>Baixar CSV</button><button className="play" onClick={toggle} disabled={requesting} aria-label={running ? 'Pausar coleta' : started.current ? 'Retomar coleta' : 'Iniciar coleta'}>{running ? <span aria-hidden="true">Ⅱ</span> : <span aria-hidden="true">▶</span>}</button></div>{limitReached && <p className="hint">Limite de gravação atingido. Baixe o CSV antes de resetar.</p>}</section></main><dialog ref={dialog} onClose={() => setConfirmReset(false)} onCancel={() => setConfirmReset(false)}><h2>Resetar dados?</h2><p>Os dados coletados e a trajetória serão apagados. Esta ação não pode ser desfeita.</p><div className="dialog-actions"><button className="secondary" onClick={() => {dialog.current?.close(); setConfirmReset(false)}}>Cancelar</button><button className="confirm" onClick={reset}>Resetar</button></div></dialog></div>
}
export default App
