import {useEffect, useRef, useState} from 'react'
import {motionPermission, readMotion, samplingHz, type Sample, type Vector} from './sensors'
import './App.css'

const display = (v: number | undefined) => v === undefined ? '—' : v.toFixed(2)
function Readings({label, unit, value}:{label:string;unit:string;value?:Vector}) {
  return <section className="reading"><div><h3>{label}</h3><span>{unit}</span></div><div className="axes">{(['x','y','z'] as const).map(axis=><div key={axis}><small>{axis.toUpperCase()}</small><strong>{display(value?.[axis])}</strong></div>)}</div></section>
}
function App() {
  const [status,setStatus] = useState('Não iniciado')
  const [sample,setSample] = useState<Sample>()
  const [hz,setHz] = useState<number|null>(null)
  const [invalid,setInvalid] = useState(0)
  const samples = useRef<Sample[]>([])
  const lastRender = useRef(0)
  const active = useRef(false)
  useEffect(() => {
    const listener = (event: DeviceMotionEvent) => {
      if (!active.current) return
      const s=readMotion(event)
      if (!s) {setInvalid(n=>n+1);return}
      samples.current.push(s)
      if (samples.current.length > 100) samples.current.shift()
      if (s.time-lastRender.current > 200) {setSample(s);setHz(samplingHz(samples.current));setStatus('Recebendo leituras');lastRender.current=s.time}
    }
    window.addEventListener('devicemotion',listener)
    return () => window.removeEventListener('devicemotion',listener)
  },[])
  async function start() {
    const permission=await motionPermission()
    if (permission !== 'granted') {setStatus(permission === 'denied' ? 'Permissão negada' : 'Sensores indisponíveis ou conexão insegura');return}
    samples.current=[]; active.current=true;setStatus('Aguardando leituras')
    window.setTimeout(()=>{if(active.current && samples.current.length===0)setStatus('Nenhuma leitura recebida. Confira os sensores e as permissões do navegador.')},5000)
  }
  function stop(){active.current=false;setStatus('Coleta interrompida')}
  return <div className="shell"><header><div className="brand"><span className="mark">N</span><div><b>Norte</b><small>navegação inercial</small></div></div><span className="header-note">Laboratório de sistemas embarcados</span></header><main><div className="intro"><div><p className="kicker">Instrumento de pesquisa</p><h1>Diagnóstico dos sensores</h1><p>Verifique as leituras do aparelho antes de iniciar uma caminhada.</p></div><div className="status" role="status" aria-live="polite"><i/> {status}</div></div><div className="workspace"><section className="field"><div className="field-top"><span>Plano de trajetória</span><span>Referência local · metros</span></div><div className="crosshair"><div className="origin"/><span>Origem</span></div><div className="notice"><strong>Modelo ainda não disponível</strong><p>O rastreamento será habilitado após o treinamento e a validação com o RoNIN. Nenhuma trajetória é simulada.</p></div><div className="field-foot"><span>Oeste ← X → Leste</span><span>Y ↑</span></div></section><aside><div className="aside-head"><h2>Leituras ao vivo</h2><p>Unidades padronizadas pelo navegador.</p></div><Readings label="Aceleração com gravidade" unit="m/s²" value={sample?.acceleration}/><Readings label="Velocidade angular" unit="rad/s" value={sample?.rotation}/><div className="meta"><span>Frequência observada</span><strong>{hz === null ? '—' : `${hz.toFixed(1)} Hz`}</strong></div><div className="meta"><span>Leituras incompletas</span><strong>{invalid}</strong></div><div className="actions"><button onClick={start}>Ativar sensores</button><button className="secondary" onClick={stop}>Interromper</button></div><p className="hint">No iPhone, permita acesso a Movimento e Orientação. A coleta requer HTTPS e depende do navegador.</p></aside></div></main><footer><span>Norte · pesquisa em navegação inercial</span><span>Dados permanecem neste aparelho</span></footer></div>
}
export default App
