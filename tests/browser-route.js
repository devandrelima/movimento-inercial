// Destination UI and synthetic movement; no real sensors or model involved.
async page => {
 await page.addInitScript(()=>{
  class FakeWorker {
   onmessage=null;onerror=null;onmessageerror=null;
   postMessage(message){queueMicrotask(()=>this.onmessage?.({data:message.type==='init'?{id:message.id,ok:true}:{id:message.id,ok:true,values:[0,.8]}}))}
   terminate(){}
  }
  window.Worker=FakeWorker
 })
 await page.evaluate(()=>localStorage.setItem('norte-room-v1',JSON.stringify({version:1,width:10,height:10,start:{x:2.5,y:4},heading:'right',obstacles:[{id:'mesa',x:3,y:3,width:2,height:2}]})))
 await page.reload()
 await page.getByRole('button',{name:'Testar sensores'}).click()
 await page.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},16)})
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000})
 await page.evaluate(()=>clearInterval(window.checkFeed));await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:10000});
 await page.getByText('Destino opcional',{exact:false}).click()
 await page.getByLabel('X (m)',{exact:true}).fill('8');await page.getByLabel('Y (m)',{exact:true}).fill('8')
 await page.getByRole('button',{name:'Traçar rota'}).click()
 await page.getByLabel('Rota sugerida').waitFor();await page.getByLabel('Destino',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Iniciar coleta'}).click()
 await page.getByRole('button',{name:'Pausar coleta'}).waitFor()
 if(await page.getByRole('button',{name:'Traçar rota'}).count())throw Error('Destino editável durante coleta')
 await page.evaluate(async()=>{let clock=1000;Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});for(let i=0;i<220;i++){clock+=1000/60;if(i%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}));window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16.67}));if(i%20===0)await new Promise(resolve=>setTimeout(resolve,10))}})
 await page.getByText('O mapa restringiu a trajetória estimada.',{exact:false}).waitFor({timeout:10000})
 const line=page.locator('.trajectory-layer polyline');if(await line.count()!==2)throw Error('Trajetória não exibida')
 for(const size of [{width:320,height:568},{width:568,height:320}]){
  await page.setViewportSize(size)
  const issue=await page.evaluate(()=>{const r=document.querySelector('.play').getBoundingClientRect();return document.documentElement.scrollHeight>innerHeight+1||r.bottom>innerHeight+1})
  if(issue)throw Error('Aviso de mapa ou controles fora da tela: '+JSON.stringify(size))
 }
 return {rota:'visível',aviso:'visível',tipo:'modelo e sensores sintéticos',layout:'verificado em dois tamanhos'}
}
