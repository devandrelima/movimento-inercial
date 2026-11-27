// Girar a vista do editor de sala (dois dedos via CDP, Shift+roda, teclado) sem quebrar a edição.
async page => {
 const ctx=await page.context().browser().newContext({viewport:{width:1000,height:760},hasTouch:true})
 const p=await ctx.newPage()
 await p.goto(page.url())
 await p.getByRole('button',{name:'Testar sensores'}).click()
 await p.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)})
 await p.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await p.evaluate(()=>clearInterval(window.checkFeed))
 await p.getByRole('button',{name:'Iniciar',exact:true}).click();await p.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:60000})
 await p.getByRole('button',{name:'Criar sala'}).click()

 const cdp=await ctx.newCDPSession(p),results={}
 const dims=p.locator('.room-section').nth(0),startBox=p.locator('.room-section').nth(1),obst=p.locator('.room-section').nth(2)
 await dims.getByLabel('Largura').fill('10');await dims.getByLabel('Altura').fill('8')
 await p.getByRole('button',{name:'Adicionar'}).click()
 await obst.getByLabel('X',{exact:true}).fill('6');await obst.getByLabel('Y',{exact:true}).fill('5');await obst.getByLabel('Largura').fill('1.5');await obst.getByLabel('Altura').fill('1')
 const empty=await p.locator('.room-canvas-rot').boundingBox();await p.mouse.click(empty.x+8,empty.y+8) // desmarca (canto vazio)

 const spinDeg=()=>p.evaluate(()=>{const t=getComputedStyle(document.querySelector('.room-canvas-rot')).transform;if(t==='none')return 0;const m=new DOMMatrix(t);return Math.atan2(m.b,m.a)*180/Math.PI})
 const screen=(x,y)=>p.locator('.room-canvas').evaluate((el,[x,y])=>{const q=el.createSVGPoint();q.x=x;q.y=-y;const r=q.matrixTransform(el.getScreenCTM());return{x:r.x,y:r.y}},[x,y])
 const field=(scope,l)=>scope.getByLabel(l,{exact:true}).inputValue().then(Number)
 const near=(a,b,what,tol=2)=>{if(Math.abs(a-b)>tol)throw Error(what+': esperado '+b.toFixed(2)+', obtido '+a.toFixed(2))}
 const angleDiff=(a,b)=>Math.abs(((a-b+540)%360)-180)
 const rad=d=>d*Math.PI/180
 const panel=await p.locator('.room-canvas-wrap').boundingBox(),C={x:panel.x+panel.width/2,y:panel.y+panel.height/2}
 async function twoFingers(r,a,a2,steps=10){
  const pts=k=>{const aa=a+(a2-a)*k;return [{x:C.x-r*Math.cos(aa),y:C.y-r*Math.sin(aa),id:1},{x:C.x+r*Math.cos(aa),y:C.y+r*Math.sin(aa),id:2}]}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pts(0)})
  for(let i=1;i<=steps;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pts(i/steps)})
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(80)
 }

 // 1) Girar 40° com dois dedos: a vista gira, encolhe para caber, e aparece o botão de norte.
 await twoFingers(120,0,rad(40))
 near(await spinDeg(),40,'giro da vista',2)
 await p.getByRole('button',{name:'Restaurar o norte para cima'}).waitFor({timeout:2000})
 const inside=await p.evaluate(()=>{const w=document.querySelector('.room-canvas-wrap').getBoundingClientRect(),r=document.querySelector('.room-canvas-rot').getBoundingClientRect(),cs=getComputedStyle(document.querySelector('.room-canvas-wrap')),pl=parseFloat(cs.paddingLeft),pt=parseFloat(cs.paddingTop),pr=parseFloat(cs.paddingRight),pb=parseFloat(cs.paddingBottom)
  return r.left>=w.left+pl-1.5&&r.right<=w.right-pr+1.5&&r.top>=w.top+pt-1.5&&r.bottom<=w.bottom-pb+1.5})
 if(!inside)throw Error('A vista girada não coube na área de desenho')
 results.giro='40° com dois dedos, vista encolhida para caber, botão de norte'

 // 2) A edição continua correta com a vista girada: selecionar e arrastar o obstáculo pelo centro.
 const o=await screen(6.75,5.5);await p.mouse.click(o.x,o.y);await p.waitForTimeout(60)
 if(Math.abs(await field(obst,'X')-6)>.01)throw Error('Não selecionou o obstáculo com a vista girada')
 const st=await screen(1,1),ob=await screen(6.75,5.5),ppu=Math.hypot(ob.x-st.x,ob.y-st.y)/Math.hypot(5.75,4.5)
 const d={x:60,y:-30},v={x:Math.cos(-rad(40))*d.x-Math.sin(-rad(40))*d.y,y:Math.sin(-rad(40))*d.x+Math.cos(-rad(40))*d.y} // R(-θ)·d
 await p.mouse.move(ob.x,ob.y);await p.mouse.down();await p.mouse.move(ob.x+d.x,ob.y+d.y,{steps:8});await p.mouse.up();await p.waitForTimeout(80)
 near(await field(obst,'X'),6+v.x/ppu,'X após arrastar com a vista girada',0.12);near(await field(obst,'Y'),5-v.y/ppu,'Y após arrastar com a vista girada',0.12)
 results.arrasto='obstáculo segue o ponteiro com a vista girada'

 // 3) Redimensionar pelas alças com a vista girada: aresta leste do obstáculo.
 const cur={x:await field(obst,'X'),y:await field(obst,'Y')},w0=await field(obst,'Largura')
 const east=await screen(cur.x+w0,cur.y+.5)
 const along={x:Math.cos(rad(40)),y:Math.sin(rad(40))} // direção +x da sala na tela
 await p.mouse.move(east.x,east.y);await p.mouse.down();await p.mouse.move(east.x+along.x*ppu*1,east.y+along.y*ppu*1,{steps:8});await p.mouse.up();await p.waitForTimeout(80)
 near(await field(obst,'Largura'),w0+1,'largura após arrastar a aresta com a vista girada',0.15)
 results.alcas='aresta redimensiona na direção certa com a vista girada'

 // 4) Anel de rotação da seta com a vista girada: arrastar para "cima da tela" = ângulo -40° na sala.
 const e2=await screen(1,1);await p.mouse.click(e2.x,e2.y+0) ;await p.waitForTimeout(60)
 const dot=Math.min(10,Math.max(7,0.19*ppu)),ringPx=dot+38
 const knobAng=await p.evaluate(()=>0);void knobAng
 const startAngle=await field(startBox,'Frente (°)')
 const from=await screen(1+Math.sin(rad(startAngle))*ringPx/ppu,1+Math.cos(rad(startAngle))*ringPx/ppu),to={x:e2.x,y:e2.y-ringPx*1.4}
 await p.mouse.move(from.x,from.y);await p.mouse.down();await p.mouse.move(to.x,to.y,{steps:10});await p.mouse.up();await p.waitForTimeout(80)
 near(angleDiff(await field(startBox,'Frente (°)'),320),0,'seta aponta para cima da tela (320° na sala)',3)
 results.seta='anel gira a seta corretamente com a vista girada'

 // 4b) Aresta da sala com a vista girada 40°: encolher 1 m e crescer dentro da folga (sem acionar o zoom automático).
 {const emptyPt=await screen(3,2);await p.mouse.click(emptyPt.x,emptyPt.y);await p.waitForTimeout(50)
  const along2={x:Math.cos(rad(40)),y:Math.sin(rad(40))},grab=async(dist)=>{const edge=await screen(await field(dims,'Largura'),4)
   await p.mouse.move(edge.x,edge.y);await p.mouse.down();await p.mouse.move(edge.x+along2.x*dist,edge.y+along2.y*dist,{steps:8});await p.mouse.up();await p.waitForTimeout(450)}
  const w0r=await field(dims,'Largura'),obstacleRight=cur.x+w0+1;await grab(-ppu*1)
  // a sala não encolhe além do obstáculo (regra do editor): o esperado é o maior entre 1 m a menos e a borda do obstáculo
  near(await field(dims,'Largura'),Math.max(w0r-1,obstacleRight),'largura após encolher com a vista girada',0.12)
  const w1r=await field(dims,'Largura');await grab(10) // para fora: o zoom automático da borda acompanha
  const w2r=await field(dims,'Largura');if(w2r<=w1r+0.01)throw Error('A sala deveria crescer ao arrastar a aresta para fora com a vista girada: '+w1r+' -> '+w2r)
  results.sala='aresta da sala com a vista girada: '+w0r+' → '+w1r+' (encolher, limitada pelo obstáculo) → '+w2r+' (crescer, com o zoom automático)'}
 // 5) O botão de norte restaura; Shift+roda e as teclas giram; clique no vazio ainda desmarca.
 await p.getByRole('button',{name:'Restaurar o norte para cima'}).click();await p.waitForTimeout(400)
 near(angleDiff(await spinDeg(),0),0,'volta ao norte',0.3)
 if(await p.getByRole('button',{name:'Restaurar o norte para cima'}).count())throw Error('Botão de norte deveria sumir em 0°')
 const wrapBox=await p.locator('.room-canvas-wrap').boundingBox();await p.mouse.move(wrapBox.x+wrapBox.width/2,wrapBox.y+wrapBox.height/2)
 await p.keyboard.down('Shift');await p.mouse.wheel(0,200);await p.keyboard.up('Shift');await p.waitForTimeout(80)
 if(angleDiff(await spinDeg(),0)<5)throw Error('Shift+roda deveria girar')
 await p.locator('.room-canvas-rot').focus();await p.keyboard.press('0');await p.waitForTimeout(400);near(angleDiff(await spinDeg(),0),0,'tecla 0 restaura',0.3)
 await p.keyboard.press(']');await p.waitForTimeout(80);near(angleDiff(await spinDeg(),15),0,'tecla ] gira 15°',0.6)
 results.controles='botão de norte, Shift+roda, [ ] e 0'

 // 6) O giro é só visual: a sala salva não muda.
 await p.keyboard.press('0');await p.waitForTimeout(400)
 await p.getByRole('button',{name:'Salvar sala'}).click();await p.getByRole('button',{name:'Editar sala'}).waitFor()
 const saved=JSON.parse(await p.evaluate(()=>localStorage.getItem('norte-room-v1')));const allowed=['version','width','height','start','heading','angle','obstacles'];const extra=Object.keys(saved).filter(k=>!allowed.includes(k));if(extra.length)throw Error('Sala salva com campos de vista: '+extra.join(','))
 results.salvo='giro não vai para a sala'
 await ctx.close()
 return results
}
