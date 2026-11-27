// Destino escolhido tocando no mapa: só um por vez, toque ≠ arraste, bloqueado durante a coleta.
// Usa um worker de modelo falso e sensores sintéticos; não envolve sensores nem modelo reais.
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
 await page.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)})
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000})
 await page.evaluate(()=>clearInterval(window.checkFeed));await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:10000})

 const field=page.locator('.field'),box=await field.boundingBox()
 // metros (referencial da sala) -> pixels da tela: origem = ponto inicial da sala, no centro do mapa
 const scale=await field.evaluate(e=>parseFloat(getComputedStyle(e).backgroundSize))
 const at=(x,y)=>({x:box.x+box.width/2+(x-2.5)*scale,y:box.y+box.height/2-(y-4)*scale})
 const goals=()=>page.getByLabel('Destino',{exact:true})
 const summary=()=>page.locator('.route-settings summary').innerText()
 const near=(a,b,what)=>{if(Math.abs(a-b)>2)throw Error(what+': '+a+' vs '+b)}

 // 1) Tocar escolhe o destino e desenha a rota; o marcador fica sob o ponto tocado.
 const p1=at(8,8);await page.mouse.click(p1.x,p1.y)
 await goals().waitFor();await page.getByLabel('Rota sugerida').waitFor()
 let c=await goals().boundingBox();near(c.x+c.width/2,p1.x,'marcador x');near(c.y+c.height/2,p1.y,'marcador y')
 if(!(await summary()).includes('8.00, 8.00'))throw Error('Destino não refletido no painel: '+await summary())

 // 2) Só um destino por vez: tocar de novo move o destino.
 const p2=at(1,9);await page.mouse.click(p2.x,p2.y);await page.waitForFunction(()=>document.querySelector('.route-settings summary').innerText.includes('1.00, 9.00'))
 if(await goals().count()!==1)throw Error('Deveria existir um único destino, há '+await goals().count())
 c=await goals().boundingBox();near(c.x+c.width/2,p2.x,'novo marcador x');near(c.y+c.height/2,p2.y,'novo marcador y')

 // 3) Ponto inválido (dentro do obstáculo, 3..5 x 3..5) é recusado e o destino anterior permanece.
 const bad=at(4,4);await page.mouse.click(bad.x,bad.y);await page.getByText('fora da sala ou dentro de um obstáculo',{exact:false}).waitFor({timeout:3000})
 if(!(await summary()).includes('1.00, 9.00')||await goals().count()!==1)throw Error('Destino anterior deveria permanecer')
 const outside=at(12,4);await page.mouse.click(outside.x,outside.y);await page.getByText('fora da sala ou dentro de um obstáculo',{exact:false}).waitFor()
 if(!(await summary()).includes('1.00, 9.00'))throw Error('Destino fora da sala não deveria ser aceito')

 // 4) Arrastar o mapa (pan) não escolhe destino.
 const s=at(6,2);await page.mouse.move(s.x,s.y);await page.mouse.down();await page.mouse.move(s.x+60,s.y+40,{steps:6});await page.mouse.up()
 if(!(await summary()).includes('1.00, 9.00'))throw Error('Arraste mudou o destino')

 // 5) Depois do pan, o toque continua preciso (considera o deslocamento do mapa).
 const panned=await field.evaluate(e=>[parseFloat(e.style.getPropertyValue('--pan-x')),parseFloat(e.style.getPropertyValue('--pan-y'))])
 const p3={x:at(7,7).x+panned[0],y:at(7,7).y+panned[1]};await page.mouse.click(p3.x,p3.y);await page.waitForFunction(()=>document.querySelector('.route-settings summary').innerText.includes('7.00, 7.00'))

 // 6) Durante a coleta o destino não pode mudar (o painel some; confere o marcador no mapa).
 const before=await goals().boundingBox()
 await page.getByRole('button',{name:'Iniciar coleta'}).click();await page.getByRole('button',{name:'Pausar coleta'}).waitFor()
 const p4={x:at(2,8).x+panned[0],y:at(2,8).y+panned[1]};await page.mouse.click(p4.x,p4.y);await page.waitForTimeout(300)
 const after=await goals().boundingBox();near(after.x,before.x,'marcador x na coleta');near(after.y,before.y,'marcador y na coleta')
 if(await goals().count()!==1)throw Error('Deveria continuar havendo um único destino')
 return {toque:'define o destino sob o ponteiro',unico:'novo toque substitui o anterior',invalidos:'obstáculo e fora da sala recusados',arraste:'não define destino',coleta:'bloqueado'}
}
