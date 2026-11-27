// Latência até o primeiro traço depois do play, com o modelo real e sensores sintéticos (relógio simulado).
// Cenário "parado": o aparelho fica parado 0,5 s e começa a se mover. Cenário "andando": já começa em movimento.
async page => {
 page.on('dialog',d=>d.accept())
 await page.evaluate(()=>{localStorage.clear()});await page.reload()
 await page.getByRole('button',{name:'Testar sensores'}).click()
 await page.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)})
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await page.evaluate(()=>clearInterval(window.checkFeed))
 await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:60000})
 await page.waitForFunction(()=>document.querySelector('.play')?.getAttribute('aria-disabled')!=='true',null,{timeout:60000}).catch(()=>{})

 await page.evaluate(()=>{
  let clock=1000,frame=0
  Object.defineProperty(performance,'now',{configurable:true,value:()=>clock})
  const motion=(t,still)=>still
   ?{accelerationIncludingGravity:{x:0.05*Math.sin(t*3),y:0.04,z:9.81},rotationRate:{alpha:0.2,beta:0.1,gamma:0},interval:16.67}
   :{accelerationIncludingGravity:{x:4+4*Math.sin(t*8),y:3+4*Math.cos(t*8),z:9.81+Math.sin(t*8)},rotationRate:{alpha:20*Math.sin(t*8),beta:10*Math.cos(t*8),gamma:0},interval:16.67}
  // avança `frames` quadros de 60 Hz; `stillUntil` (s) = até quando o aparelho fica parado
  window.advance=(frames,stillUntil)=>{for(let n=0;n<frames;n++,frame++){clock+=1000/60;const t=frame/60;if(frame%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}));window.dispatchEvent(new DeviceMotionEvent('devicemotion',motion(t,t<stillUntil)))}}
  window.resetClock=()=>{frame=0}
  window.elapsed=()=>clock
 })
 const points=()=>page.evaluate(()=>{const l=document.querySelector('.trajectory-layer polyline');return l?l.getAttribute('points').split(' ').length:0})
 const scenario=async(name,stillUntil)=>{
  await page.getByRole('button',{name:'Iniciar coleta'}).click();await page.getByRole('button',{name:'Pausar coleta'}).waitFor({timeout:5000})
  const t0=await page.evaluate(()=>window.elapsed());let firstTrace=null
  for(let step=0;step<80&&firstTrace===null;step++){ // 80 × 100 ms = 8 s simulados
   await page.evaluate(([s,u])=>window.advance(6,u),[step,stillUntil]);await page.waitForTimeout(35)
   if(await points()>=2)firstTrace=(await page.evaluate(()=>window.elapsed())-t0)/1000
  }
  await page.getByRole('button',{name:'Pausar coleta'}).click()
  await page.getByRole('button',{name:'Resetar dados'}).click();await page.getByRole('button',{name:'Resetar',exact:true}).click().catch(()=>{})
  await page.waitForTimeout(300);await page.evaluate(()=>window.resetClock())
  return firstTrace
 }
 const parado=await scenario('parado',0.5)
 const andando=await scenario('andando',0)
 const results={primeiroTracoAposPlay_s:{aparelhoParado:parado,jaEmMovimento:andando}}
 if(parado===null||andando===null)throw Error('Nenhum traço apareceu em 8 s simulados: '+JSON.stringify(results))
 // Antes desta mudança: ~3,6 s nos dois cenários. Esperado agora: ~1,8 s parado e ~2,2 s já em movimento.
 if(parado>2.5)throw Error('Parado: primeiro traço em '+parado+' s (esperado <= 2,5 s; antes ~3,6 s)')
 if(andando>2.8)throw Error('Já em movimento: primeiro traço em '+andando+' s (esperado <= 2,8 s; antes ~3,5 s)')
 results.antes_s={aparelhoParado:3.6,jaEmMovimento:3.5}
 return results
}
