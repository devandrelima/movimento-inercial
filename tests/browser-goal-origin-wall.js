// Destino por clique com a ORIGEM ENCOSTADA na parede/canto (dentro dos 20 cm de margem): deve funcionar.
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
 await page.evaluate(()=>localStorage.setItem('norte-room-v1',JSON.stringify({version:1,width:10,height:10,start:{x:0,y:0},heading:'up',obstacles:[{id:'mesa',x:3,y:3,width:2,height:2}]})))
 await page.reload()
 await page.getByRole('button',{name:'Testar sensores'}).click()
 await page.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)})
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000})
 await page.evaluate(()=>clearInterval(window.checkFeed));await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:10000})

 const field=page.locator('.field'),box=await field.boundingBox()
 const scale=await field.evaluate(e=>parseFloat(getComputedStyle(e).backgroundSize))
 const at=(x,y)=>({x:box.x+box.width/2+x*scale,y:box.y+box.height/2-y*scale}) // origem da sala (0,0) no centro do mapa
 const goals=()=>page.getByLabel('Destino',{exact:true})
 const near=(a,b,what)=>{if(Math.abs(a-b)>2)throw Error(what+': '+a+' vs '+b)}

 // 1) Clique em área livre da sala gera destino e rota, mesmo com a origem no canto.
 const p1=at(7,6);await page.mouse.click(p1.x,p1.y)
 await goals().waitFor({timeout:4000});await page.getByLabel('Rota sugerida').waitFor({timeout:4000})
 let c=await goals().boundingBox();near(c.x+c.width/2,p1.x,'marcador x');near(c.y+c.height/2,p1.y,'marcador y')
 if(await page.getByText('Não dá para marcar',{exact:false}).count()||await page.getByText('Não encontrei',{exact:false}).count())throw Error('Não deveria haver aviso de recusa')

 // 2) Outro clique colado ao obstáculo (a 10 cm, dentro da margem) também funciona e substitui o destino.
 const p2=at(5.1,4);await page.mouse.click(p2.x,p2.y);await page.waitForTimeout(300)
 if(await goals().count()!==1)throw Error('Deveria haver um único destino')
 c=await goals().boundingBox();near(c.x+c.width/2,p2.x,'destino colado ao obstáculo (x)')

 // 3) Dentro do obstáculo continua recusado, com o motivo certo, e o destino anterior permanece.
 const bad=at(4,4);await page.mouse.click(bad.x,bad.y)
 await page.getByText('fora da sala ou dentro de um obstáculo',{exact:false}).waitFor({timeout:3000})
 c=await goals().boundingBox();near(c.x+c.width/2,p2.x,'destino anterior permanece')
 return {origemNaParede:'cliques em área livre geram destino e rota',coladoAoObstaculo:'aceito',obstaculo:'recusado com o motivo correto'}
}
