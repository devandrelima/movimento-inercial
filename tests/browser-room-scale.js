async page => {
 await page.evaluate(()=>localStorage.removeItem('norte-room-v1'));await page.reload()
 await page.getByRole('button',{name:'Testar sensores'}).click();await page.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)});
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await page.evaluate(()=>clearInterval(window.checkFeed));await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:60000});
 await page.getByRole('button',{name:'Criar sala'}).click()
 const info=()=>page.locator('.room-canvas').evaluate(el=>{const m=el.getScreenCTM(),b=el.getBoundingClientRect();const r=el.querySelector('rect[fill="none"]').getBoundingClientRect();return {scale:+m.a.toFixed(2),roomRight:+r.right.toFixed(1),boxRight:+b.right.toFixed(1),roomLeft:+r.left.toFixed(1),boxLeft:+b.left.toFixed(1)}})
 const screen=(x,y)=>page.locator('.room-canvas').evaluate((el,[x,y])=>{const p=el.createSVGPoint();p.x=x;p.y=-y;const q=p.matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y}},[x,y])
 const log=[];log.push(['rest',await info()])
 const a=await screen(8,3),box=await page.locator('.room-canvas').boundingBox()
 await page.mouse.move(a.x,a.y);await page.mouse.down()
 // arrasta para além do limite lateral da grade e segura o ponteiro parado
 await page.mouse.move(box.x+box.width-4,a.y,{steps:10});log.push(['no limite',await info()])
 await page.waitForTimeout(500);log.push(['segurando 0,5s',await info(),await page.locator('.room-section').nth(0).getByLabel('Largura').inputValue()])
 await page.waitForTimeout(700);log.push(['segurando 1,2s',await info(),await page.locator('.room-section').nth(0).getByLabel('Largura').inputValue()])
 // volta o ponteiro para dentro: a sala encolhe sem mudar a escala
 await page.mouse.move(box.x+box.width/2,a.y,{steps:10});log.push(['voltou ao meio',await info(),await page.locator('.room-section').nth(0).getByLabel('Largura').inputValue()])
 await page.mouse.up();await page.waitForTimeout(100);log.push(['soltou +0,1s',await info()]);await page.waitForTimeout(400);log.push(['soltou +0,5s',await info()])
 const get=name=>log.find(l=>l[0]===name)[1]
 const rest=get('rest'),hold=get('segurando 1,2s'),back=get('voltou ao meio'),done=get('soltou +0,5s')
 if(!(get('segurando 0,5s').scale<rest.scale*0.95))throw Error('A escala não mudou ao chegar ao limite da grade: '+JSON.stringify(log))
 if(!(hold.scale<get('segurando 0,5s').scale))throw Error('A escala parou de se ajustar com o ponteiro no limite')
 for(const [name,v] of log)if(v.roomRight>v.boxRight+1||v.roomLeft<v.boxLeft-1)throw Error('Sala saiu da área visível em "'+name+'"')
 if(!(back.roomRight<hold.roomRight-100))throw Error('A sala não encolheu ao recuar o ponteiro')
 if(Math.abs(done.scale-rest.scale)>rest.scale*.12&&done.scale<rest.scale*.7)throw Error('Escala final não foi reajustada à sala: '+done.scale)
 return {escala:{repouso:rest.scale,noLimite:get('no limite').scale,segurando:hold.scale,final:done.scale},larguraSegurando:log.find(l=>l[0]==='segurando 1,2s')[2]}
}
