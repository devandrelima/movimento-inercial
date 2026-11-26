async page => {
 await page.getByRole('button',{name:'Testar sensores'}).click();
 await page.evaluate(()=>{let i=0;window.sensorFeed=setInterval(()=>{
  window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));
  if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}));
 },16)});
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await page.evaluate(()=>clearInterval(window.sensorFeed));
 await page.route('**/models/ronin-v2-float.tflite',async route=>{await new Promise(resolve=>setTimeout(resolve,2000));await route.continue()});
 await page.evaluate(()=>{window.progressValues=[];const observer=new MutationObserver(()=>{const bar=document.querySelector('[aria-label="Carregamento do modelo"]');if(bar)window.progressValues.push(Number(bar.getAttribute('aria-valuenow')))});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-valuenow']})});
 await page.getByRole('button',{name:'Iniciar',exact:true}).click();
 const bar=page.getByRole('progressbar',{name:'Carregamento do modelo'});await bar.waitFor();
 const first=Number(await bar.getAttribute('aria-valuenow'));if(first!==0)throw Error('Progresso inicial não é zero: '+first);
 await page.waitForTimeout(500);const delayed=Number(await bar.getAttribute('aria-valuenow'));if(delayed>=100)throw Error('Concluiu antes do download');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Carregamento do modelo"]')?.getAttribute('aria-valuenow')==='100',{timeout:60000});
 const values=await page.evaluate(()=>window.progressValues);if(values.some((v,i)=>i&&v<values[i-1]))throw Error('Progresso retrocedeu: '+values);
 await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:60000});
 return {inicial:first,duranteDownload:delayed,valores:values,modelo:await page.locator('.model-status').innerText()};
}
