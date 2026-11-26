async page => {
 await page.waitForFunction(()=>document.querySelector('.model-status')?.textContent?.includes('pronta'),{timeout:60000});
 await page.getByRole('button',{name:'Iniciar coleta'}).click();
 await page.evaluate(()=>{
  let clock=1000,i=0;Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
  window.testFire=async count=>{for(let n=0;n<count;n++,i++){
   clock+=1000/60;const t=i/60;
   if(i%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}));
   window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:4+4*Math.sin(t*8),y:3+4*Math.cos(t*8),z:9.81+Math.sin(t*8)},rotationRate:{alpha:20*Math.sin(t*8),beta:10*Math.cos(t*8),gamma:0},interval:16.67}));
   if(n%20===0)await new Promise(resolve=>setTimeout(resolve,12));
  }}
 });
 await page.evaluate(()=>window.testFire(3600));await page.waitForTimeout(1200);
 const line=page.locator('.trajectory-layer polyline');
 if(await line.count()!==1)throw Error('Não há um traço: '+await page.locator('.model-status').innerText());
 const read=async()=>{const scale=await page.locator('.field').evaluate(e=>parseFloat(getComputedStyle(e).backgroundSize));const p=await line.getAttribute('points');return p.split(' ').map(s=>s.split(',').map(Number).map(n=>n/scale))};
 const before=await read();
 await page.getByRole('button',{name:'Aumentar zoom'}).click();
 const zoomed=await read();if(before.length!==zoomed.length||before.some((p,i)=>p.some((v,j)=>Math.abs(v-zoomed[i][j])>1e-6)))throw Error('Zoom mudou a trajetória');
 const box=await page.locator('.field').boundingBox();await page.mouse.move(box.x+100,box.y+100);await page.mouse.down();await page.mouse.move(box.x+180,box.y+150);await page.mouse.up();
 const moved=await read();if(before.length!==moved.length||before.some((p,i)=>p.some((v,j)=>Math.abs(v-moved[i][j])>1e-6)))throw Error('Arrastar mudou a trajetória');
 await page.evaluate(()=>window.testFire(600));await page.waitForTimeout(700);
 const after=await read();if(after.length<=before.length||before.some((p,i)=>p.some((v,j)=>Math.abs(v-after[i][j])>1e-6)))throw Error('Não continuou após gestos');
 await page.getByRole('button',{name:'Pausar coleta'}).click();await page.getByRole('button',{name:'Retomar coleta'}).click();
 await page.evaluate(()=>window.testFire(600));await page.waitForTimeout(700);
 const resumed=await read();if(await line.count()!==1||resumed.length<=after.length||after.some((p,i)=>p.some((v,j)=>Math.abs(v-resumed[i][j])>1e-6)))throw Error('Não continuou após pausa');
 return {pontosAntes:before.length,pontosAposGestos:after.length,pontosAposPausa:resumed.length,tracos:await line.count(),aviso:await page.locator('.hint').first().innerText()};
}
