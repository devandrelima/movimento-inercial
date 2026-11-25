import {useEffect, useRef, useState} from 'react'
import {motionPermission, readPartialMotion, samplingHz, type PartialSample, type PartialVector} from './sensors'
import './App.css'

type GyroSensor = EventTarget & { x: number | null; y: number | null; z: number | null; start(): void; stop(): void }
type GyroConstructor = new (options?: {frequency: number}) => GyroSensor

const display = (v: number | null | undefined) => v == null ? '—' : v.toFixed(2)
function Readings({label, unit, value}:{label:string;unit:string;value?:PartialVector}) {
  return <section className="reading"><div><h3>{label}</h3><span>{unit}</span></div><div className="axes">{(['x','y','z'] as const).map(axis=><div key={axis}><small>{axis.toUpperCase()}</small><strong>{display(value?.[axis])}</strong></div>)}</div></section>
}
function App() {
  const [status,setStatus] = useState('Não iniciado')
  const [sample,setSample] = useState<PartialSample>()
  const [hz,setHz] = useState<number|null>(null)
  const [invalid,setInvalid] = useState(0)
  const [gyro,setGyro] = useState<PartialVector>()
  const [gyroState,setGyroState] = useState('Não verificado')
  const gyroRef = useRef<GyroSensor | null>(null)
  const samples = useRef<PartialSample[]>([])
  const invalidCount = useRef(0)
  const lastRender = useRef(0)
  const active = useRef(false)
  useEffect(() => {
    const listener = (event: DeviceMotionEvent) => {
      if (!active.current) return
      const s=readPartialMotion(event)
      const missing = [...Object.values(s.acceleration),...Object.values(s.rotation)].some(v=>v === null)
      if (missing) invalidCount.current++
      samples.current.push(s)
      if (samples.current.length > 100) samples.current.shift()
      if (s.time-lastRender.current > 200) {setSample(s);setHz(samplingHz(samples.current));setInvalid(invalidCount.current);setStatus(missing ? 'Leituras parciais: confira os campos indisponíveis' : 'Recebendo leituras completas');lastRender.current=s.time}
    }
    window.addEventListener('devicemotion',listener)
    return () => { window.removeEventListener('devicemotion',listener); gyroRef.current?.stop() }
  },[])
  async function start() {
    const permission=await motionPermission()
    if (permission !== 'granted') {setStatus(permission === 'denied' ? 'Permissão negada' : 'Sensores indisponíveis ou conexão insegura');return}
    gyroRef.current?.stop(); gyroRef.current=null; setGyro(undefined)
    const Gyro = (window as unknown as {Gyroscope?: GyroConstructor}).Gyroscope
    if (!Gyro) setGyroState('API alternativa não disponível neste navegador')
    else {
      try {
        const sensor = new Gyro({frequency: 60}); gyroRef.current=sensor; setGyroState('Aguardando giroscópio alternativo')
        sensor.addEventListener('reading', () => {setGyro({x:sensor.x,y:sensor.y,z:sensor.z});setGyroState('API alternativa recebendo dados')})
        sensor.addEventListener('error', (e) => { const error = (e as Event & {error?: DOMException}).error; setGyroState(`API alternativa: ${error?.name || 'erro de leitura'}`) })
        sensor.start()
      } catch (e) { setGyroState(`API alternativa: ${e instanceof Error ? e.name : 'erro de inicialização'}`) }
    }
    samples.current=[]; invalidCount.current=0; setInvalid(0); setSample(undefined); setHz(null); active.current=true;setStatus('Aguardando leituras')
    window.setTimeout(()=>{if(active.current && samples.current.length===0)setStatus('Nenhuma leitura recebida. Confira os sensores e as permissões do navegador.')},5000)
  }
  function stop(){active.current=false;gyroRef.current?.stop();gyroRef.current=null;setGyroState('Coleta interrompida');setStatus('Coleta interrompida')}
  return <div className="shell"><header><div className="brand"><span className="mark">N</span><div><b>Norte</b><small>navegação inercial</small></div></div><span className="header-note">Laboratório de sistemas embarcados</span></header><main><div className="intro"><div><p className="kicker">Instrumento de pesquisa</p><h1>Diagnóstico dos sensores</h1><p>Verifique as leituras do aparelho antes de iniciar uma caminhada.</p></div><div className="status" role="status" aria-live="polite"><i/> {status}</div></div><div className="workspace"><section className="field"><div className="field-top"><span>Plano de trajetória</span><span>Referência local · metros</span></div><div className="crosshair"><div className="origin"/><span>Origem</span></div><div className="notice"><strong>Modelo ainda não disponível</strong><p>O rastreamento será habilitado após o treinamento e a validação com o RoNIN. Nenhuma trajetória é simulada.</p></div><div className="field-foot"><span>Oeste ← X → Leste</span><span>Y ↑</span></div></section><aside><div className="aside-head"><h2>Leituras ao vivo</h2><p>Unidades padronizadas pelo navegador.</p></div><Readings label="Aceleração com gravidade" unit="m/s²" value={sample?.acceleration}/><Readings label="Velocidade angular (evento)" unit="rad/s" value={sample?.rotation}/><Readings label="Giroscópio (API alternativa)" unit="rad/s" value={gyro}/><p className="hint">{gyroState}</p>{sample && <p className="hint" role="status">{[...Object.entries(sample.acceleration).filter(([,v])=>v === null).map(([k])=>`aceleração ${k.toUpperCase()}`),...Object.entries(sample.rotation).filter(([,v])=>v === null).map(([k])=>`giroscópio ${k.toUpperCase()}`)].length ? `Ausente no evento de movimento: ${[...Object.entries(sample.acceleration).filter(([,v])=>v === null).map(([k])=>`aceleração ${k.toUpperCase()}`),...Object.entries(sample.rotation).filter(([,v])=>v === null).map(([k])=>`giroscópio ${k.toUpperCase()}`)].join(', ')}.` : 'Todos os eixos estão disponíveis.'}</p>}<div className="meta"><span>Frequência dos eventos</span><strong>{hz === null ? '—' : `${hz.toFixed(1)} Hz`}</strong></div><div className="meta"><span>Eventos incompletos</span><strong>{invalid}</strong></div><div className="actions"><button onClick={start}>Ativar sensores</button><button className="secondary" onClick={stop}>Interromper</button></div><p className="hint">No iPhone, permita acesso a Movimento e Orientação. A coleta requer HTTPS e depende do navegador.</p></aside></div></main><footer><span>Norte · pesquisa em navegação inercial</span><span>Dados permanecem neste aparelho</span></footer></div>
}
export default App
