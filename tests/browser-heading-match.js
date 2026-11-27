// A direção da seta escolhida no editor (ângulo livre) tem que ser a direção em que o traço sai da origem.
// Modelo real e sensores sintéticos (relógio simulado).
async page => {
 const results={}
 const mk=angle=>({version:1,width:12,height:12,start:{x:6,y:6},heading:'up',angle,obstacles:[]})
 for(const angle of [135,300]){
  await page.evaluate(room=>{localStorage.clear();localStorage.setItem('norte-room-v1',JSON.stringify(room))},mk(angle));await page.reload()
  await page.getByRole('button',{name:'Testar sensores'}).click()
  await page.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)})
  await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await page.evaluate(()=>clearInterval(window.checkFeed))
  await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:60000})
  await page.waitForFunction(()=>document.querySelector('.play')?.getAttribute('aria-disabled')!=='true',null,{timeout:60000}).catch(()=>{})
  await page.getByRole('button',{name:'Iniciar coleta'}).click();await page.getByRole('button',{name:'Pausar coleta'}).waitFor({timeout:5000})
  await page.evaluate(()=>{let clock=1000,i=0;Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});window.testFire=async count=>{for(let n=0;n<count;n++,i++){clock+=1000/60;const t=i/60;if(i%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}));window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:4+4*Math.sin(t*8),y:3+4*Math.cos(t*8),z:9.81+Math.sin(t*8)},rotationRate:{alpha:20*Math.sin(t*8),beta:10*Math.cos(t*8),gamma:0},interval:16.67}));if(n%20===0)await new Promise(resolve=>setTimeout(resolve,12))}}})
  // o traço enquanto a direção é provisória (mais claro) e depois de confirmada
  let sawProvisional=false,final=false
  for(let step=0;step<60&&!final;step++){
   await page.evaluate(()=>window.testFire(30));await page.waitForTimeout(40)
   const g=await page.evaluate(()=>{const gg=document.querySelector('.trajectory-layer polyline')?.parentElement;return gg?{prov:gg.hasAttribute('data-provisional'),op:gg.getAttribute('opacity')}:null})
   if(g){if(g.prov){sawProvisional=true;if(Number(g.op)>=1)throw Error('Trecho provisório deveria ser mais claro: '+g.op)}else final=true}
  }
  if(!final)throw Error('A direção nunca foi confirmada (1 m) nos '+angle+'°')
  const info=await page.evaluate(()=>{const scale=parseFloat(document.querySelector('.field').dataset.pxPerM),pts=document.querySelector('.trajectory-layer polyline').getAttribute('points').split(' ').map(v=>v.split(',').map(Number)).map(([x,y])=>({x:x/scale,y:-y/scale}))
   const k=pts.findIndex(p=>Math.hypot(p.x,p.y)>=1),a=pts[k];return {n:pts.length,k,deg:Math.atan2(a.x,a.y)*180/Math.PI,dist:Math.hypot(a.x,a.y)}})
  const want=angle,got=((info.deg%360)+360)%360,diff=Math.abs(((got-want+540)%360)-180)
  if(diff>1.5)throw Error('Direção do traço '+got.toFixed(1)+'° ≠ seta '+want+'° (diferença '+diff.toFixed(1)+'°)')
  results['seta '+angle+'°']='traço sai a '+got.toFixed(1)+'° (1º ponto a ≥1 m, '+info.n+' pontos); provisório visto: '+sawProvisional
  await page.getByRole('button',{name:'Pausar coleta'}).click().catch(()=>{})
 }
 return results
}
