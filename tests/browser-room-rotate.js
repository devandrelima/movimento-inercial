// Rotação livre da seta de início no editor: clicar na seta mostra o controle circular; arrastá-lo gira a seta.
async page => {
 await page.evaluate(()=>{localStorage.clear()});await page.reload()
 await page.getByRole('button',{name:'Testar sensores'}).click()
 await page.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)})
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await page.evaluate(()=>clearInterval(window.checkFeed))
 await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:60000})
 await page.getByRole('button',{name:'Criar sala'}).click()

 const startBox=page.locator('.room-section').nth(1)
 const screen=(x,y)=>page.locator('.room-canvas').evaluate((el,[x,y])=>{const p=el.createSVGPoint();p.x=x;p.y=-y;const q=p.matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y}},[x,y])
 const ppu=()=>page.locator('.room-canvas').evaluate(el=>el.getScreenCTM().a)
 const angleField=()=>startBox.getByLabel('Frente (°)').inputValue().then(Number)
 const arrowRotation=()=>page.locator('.room-canvas polygon').evaluateAll(els=>{const p=els.find(e=>/rotate/.test(e.parentElement.getAttribute('transform')||''));const m=p?.parentElement.getAttribute('transform').match(/rotate\(([-\d.e]+)\)/);return m?Number(m[1]):null})
 const near=(a,b,what,tol=1.5)=>{const d=Math.abs(((a-b+540)%360)-180);if(d>tol)throw Error(what+': esperado '+b+'°, obtido '+a+'°')}
 const results={}

 // 1) A seta aparece apontando para cima (0°) e sem o controle circular.
 near(await arrowRotation(),0,'seta inicial');if(await page.locator('.room-canvas circle[stroke-dasharray]').count())throw Error('Anel não deveria aparecer sem selecionar')
 // 2) Clicar na seta seleciona o ponto e mostra o controle circular externo.
 const k=await ppu(),start={x:1,y:1},geo=await page.evaluate(()=>0)
 const dot=Math.min(10,Math.max(7,0.19*k)),tipPx=dot+22,ringPx=dot+38
 const arrow=await screen(start.x,start.y+(tipPx-6)/k);await page.mouse.click(arrow.x,arrow.y)
 await page.locator('.room-canvas circle[stroke-dasharray]').waitFor({timeout:2000})
 results.controle='aparece ao clicar na seta'

 // 3) Arrastar a alça do anel gira a seta; o campo numérico acompanha.
 const ring=ringPx/k
 const drag=async(deg,steps=8)=>{ // posição no anel e arraste até o ângulo desejado (0° = cima, horário)
  const cur=await arrowRotation(),from=await screen(start.x+ring*Math.sin(cur*Math.PI/180),start.y+ring*Math.cos(cur*Math.PI/180))
  const to=await screen(start.x+ring*1.4*Math.sin(deg*Math.PI/180),start.y+ring*1.4*Math.cos(deg*Math.PI/180))
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps});await page.mouse.up();await page.waitForTimeout(60)
 }
 await drag(90);near(await arrowRotation(),90,'seta após arrastar para a direita');near(await angleField(),90,'campo (90°)')
 await drag(53);{const a=await arrowRotation();near(a,53,'ângulo livre (53°)',4);near(await angleField(),a,'campo acompanha a seta',0.6)}
 await drag(225);near(await arrowRotation(),225,'seta após arrastar para baixo-esquerda',4)
 await drag(358);near(await arrowRotation(),0,'gruda em 0° perto de 360°',0.01) // snap
 results.rotacao='arrasto gira a seta em qualquer ângulo, com campo sincronizado e encaixe a cada 15°'

 // 4) O ponto não saiu do lugar e a direção é salva (com a direção cardeal mais próxima, para compatibilidade).
 await drag(140);const saved0=await angleField()
 await page.getByRole('button',{name:'Salvar sala'}).click();await page.getByRole('button',{name:'Editar sala'}).waitFor()
 const room=JSON.parse(await page.evaluate(()=>localStorage.getItem('norte-room-v1')))
 if(Math.abs(room.start.x-1)>.02||Math.abs(room.start.y-1)>.02)throw Error('Girar não deveria mover o ponto: '+JSON.stringify(room.start))
 near(room.angle,saved0,'ângulo salvo',0.2);if(room.heading!=='right'&&room.heading!=='down')throw Error('Direção cardeal incompatível: '+room.heading)
 results.salvo='angle='+room.angle+' heading='+room.heading+', ponto inalterado'

 // 5) A seta do mapa aponta na direção escolhida.
 const mapArrow=await page.evaluate(()=>{const l=document.querySelector('.trajectory-layer line[marker-end]');return l?{x2:+l.getAttribute('x2'),y2:+l.getAttribute('y2')}:null})
 const expected=room.angle*Math.PI/180
 if(!mapArrow||Math.abs(mapArrow.x2/30-Math.sin(expected))>.02||Math.abs(-mapArrow.y2/30-Math.cos(expected))>.02)throw Error('Seta do mapa não segue o ângulo: '+JSON.stringify(mapArrow))
 results.mapa='seta do mapa aponta a '+room.angle+'°'

 // 6) Reabrir o editor mantém o ângulo; clicar em outro lugar esconde o controle; o campo numérico também gira.
 await page.getByRole('button',{name:'Editar sala'}).click();near(await angleField(),room.angle,'ângulo ao reabrir',0.2)
 await startBox.getByLabel('Frente (°)').fill('-90');near(await arrowRotation(),270,'campo aceita -90 (= 270°)')
 const arrow2=await screen(start.x+(tipPx-6)/k*Math.sin(270*Math.PI/180),start.y);await page.mouse.click(arrow2.x,arrow2.y);await page.locator('.room-canvas circle[stroke-dasharray]').waitFor({timeout:2000})
 const empty=await screen(6,5);await page.mouse.click(empty.x,empty.y);await page.waitForTimeout(80)
 if(await page.locator('.room-canvas circle[stroke-dasharray]').count())throw Error('Controle deveria sumir ao clicar no vazio')
 results.edicao='ângulo persiste; campo numérico gira; clique no vazio esconde o controle'
 return results
}
