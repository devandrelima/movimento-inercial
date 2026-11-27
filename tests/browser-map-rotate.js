// Girar o mapa/grade com dois dedos (toque real via CDP), mais Shift+roda e teclado. Modelo falso e sensores sintéticos.
async page => {
 const ctx=await page.context().browser().newContext({viewport:{width:900,height:700},hasTouch:true})
 const p=await ctx.newPage()
 await p.addInitScript(()=>{
  class FakeWorker {
   onmessage=null;onerror=null;onmessageerror=null;
   postMessage(message){queueMicrotask(()=>this.onmessage?.({data:message.type==='init'?{id:message.id,ok:true}:{id:message.id,ok:true,values:[0,.8]}}))}
   terminate(){}
  }
  window.Worker=FakeWorker
  localStorage.setItem('norte-room-v1',JSON.stringify({version:1,width:12,height:10,start:{x:2.5,y:4},heading:'right',obstacles:[{id:'mesa',x:3,y:3,width:2,height:2}]}))
 })
 await p.goto(page.url())
 await p.getByRole('button',{name:'Testar sensores'}).click()
 await p.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)})
 await p.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await p.evaluate(()=>clearInterval(window.checkFeed))
 await p.getByRole('button',{name:'Iniciar',exact:true}).click();await p.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:10000})

 const cdp=await ctx.newCDPSession(p),results={}
 const field=await p.locator('.field').boundingBox(),C={x:field.x+field.width/2,y:field.y+field.height/2}
 const rotDeg=sel=>p.evaluate(s=>{const m=new DOMMatrix(getComputedStyle(document.querySelector(s)).transform);return Math.atan2(m.b,m.a)*180/Math.PI},sel)
 const scale=()=>p.locator('.field').evaluate(e=>parseFloat(e.dataset.pxPerM))
 const originPos=()=>p.locator('.origin').boundingBox().then(b=>({x:b.x+b.width/2,y:b.y+b.height/2}))
 const near=(a,b,what,tol=3)=>{if(Math.abs(a-b)>tol)throw Error(what+': esperado '+b.toFixed(1)+', obtido '+a.toFixed(1))}
 const angleDiff=(a,b)=>Math.abs(((a-b+540)%360)-180)
 // dois dedos: pose inicial (centro c, meia-distância r, ângulo a) → final (c2, r2, a2), interpolada
 async function twoFingers(c,r,a,c2,r2,a2,steps=12){
  const pts=k=>{const cx=c.x+(c2.x-c.x)*k,cy=c.y+(c2.y-c.y)*k,rr=r+(r2-r)*k,aa=a+(a2-a)*k;return [{x:cx-rr*Math.cos(aa),y:cy-rr*Math.sin(aa),id:1},{x:cx+rr*Math.cos(aa),y:cy+rr*Math.sin(aa),id:2}]}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pts(0)})
  for(let i=1;i<=steps;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pts(i/steps)})
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(80)
 }
 const rad=d=>d*Math.PI/180

 // 1) Girar 50° com dois dedos: o mapa (sala) e a grade giram juntos, e o ponto sob os dedos fica parado.
 const o0=await originPos(),s0=await scale(),pivot={x:C.x+90,y:C.y-40}
 await twoFingers(pivot,80,0,pivot,80,rad(50))
 near(await rotDeg('.map-world'),50,'rotação da sala/trajetória',2);near(await rotDeg('.field-grid'),50,'rotação da grade',2)
 const rel={x:o0.x-pivot.x,y:o0.y-pivot.y},c=Math.cos(rad(50)),s=Math.sin(rad(50)),want={x:pivot.x+c*rel.x-s*rel.y,y:pivot.y+s*rel.x+c*rel.y},o1=await originPos()
 near(o1.x,want.x,'origem gira em torno dos dedos (x)');near(o1.y,want.y,'origem gira em torno dos dedos (y)');near(await scale(),s0,'giro não muda o zoom',0.5)
 results.giro='50° com dois dedos, sala e grade juntas, em torno do ponto dos dedos'

 // 2) Aparece o botão de norte; os rótulos de eixo (X →, Y ↑) somem; a grade continua cobrindo toda a área.
 await p.getByRole('button',{name:'Restaurar o norte para cima'}).waitFor({timeout:2000})
 if(await p.locator('.field-foot').isVisible())throw Error('Rótulos X/Y deveriam sumir com o mapa girado')
 const cover=await p.evaluate(()=>{const f=document.querySelector('.field').getBoundingClientRect(),g=document.querySelector('.field-grid'),m=new DOMMatrix(getComputedStyle(g).transform),w=g.offsetWidth,h=g.offsetHeight,cx=f.left+f.width/2,cy=f.top+f.height/2
  return [[f.left,f.top],[f.right,f.top],[f.left,f.bottom],[f.right,f.bottom]].every(([x,y])=>{const dx=x-cx,dy=y-cy,u=m.d*dx-m.c*dy,v=-m.b*dx+m.a*dy,det=m.a*m.d-m.b*m.c;const lx=(m.d*dx-m.c*dy)/det,ly=(-m.b*dx+m.a*dy)/det;return Math.abs(lx)<=w/2&&Math.abs(ly)<=h/2})})
 if(!cover)throw Error('A grade girada deixou cantos da área sem grade')
 results.indicadores='botão de norte visível, eixos ocultos, grade cobre toda a área'

 // 3) Dois dedos também fazem zoom (pinça) ao mesmo tempo que giram.
 const s1=await scale();await twoFingers(C,60,0,C,120,rad(20));{const k=(await scale())/s1;near(k,2,'pinça junto com giro',0.12)}
 near(angleDiff(await rotDeg('.map-world'),70),0,'giro acumulado (50° + 20°)',2.5)
 results.pinca='zoom ×'+(((await scale())/s1)).toFixed(2)+' junto com o giro'

 // 4) Tocar para escolher o destino com o mapa girado: o marcador cai sob o dedo.
 const tap=async(x,y)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(150)}
 const target={x:C.x-120,y:C.y+110};await tap(target.x,target.y)
 const goal=await p.getByLabel('Destino',{exact:true}).boundingBox();near(goal.x+goal.width/2,target.x,'destino sob o toque com mapa girado (x)');near(goal.y+goal.height/2,target.y,'destino sob o toque com mapa girado (y)')
 results.destino='toque com o mapa girado cai sob o dedo'

 // 5) O botão de norte volta tudo a 0° (animado) e some.
 await p.getByRole('button',{name:'Restaurar o norte para cima'}).click();await p.waitForTimeout(400)
 near(angleDiff(await rotDeg('.map-world'),0),0,'volta ao norte',0.3);near(angleDiff(await rotDeg('.field-grid'),0),0,'grade volta ao norte',0.3)
 if(await p.getByRole('button',{name:'Restaurar o norte para cima'}).count())throw Error('Botão deveria sumir em 0°')
 results.norte='restaurado pelo botão'

 // 6) Encaixe: um giro pequeno (2°) gruda em 0°.
 await twoFingers(C,80,0,C,80,rad(2));near(angleDiff(await rotDeg('.map-world'),0),0,'gruda em 0°',0.01)

 // 7) Mouse e teclado: Shift+roda gira; ] e [ giram 15°; 0 restaura.
 await p.mouse.move(C.x,C.y);await p.keyboard.down('Shift');await p.mouse.wheel(0,200);await p.keyboard.up('Shift');await p.waitForTimeout(80)
 const afterWheel=await rotDeg('.map-world');if(angleDiff(afterWheel,0)<5)throw Error('Shift+roda deveria girar: '+afterWheel)
 await p.locator('.field').focus();await p.keyboard.press('0');await p.waitForTimeout(400);near(angleDiff(await rotDeg('.map-world'),0),0,'tecla 0 restaura',0.3)
 await p.keyboard.press(']');await p.waitForTimeout(60);near(angleDiff(await rotDeg('.map-world'),15),0,'tecla ] gira 15°',0.5)
 results.mouseTeclado='Shift+roda, ] e 0'
 await ctx.close()
 return results
}
