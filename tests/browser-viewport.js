async page => {
 const sizes=[{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:768,height:1024},{width:568,height:320},{width:844,height:390}];
 const results=[];
 async function check(stage,selectors) {
  for(const size of sizes){
   await page.setViewportSize(size);await page.waitForTimeout(50);
   const data=await page.evaluate(selectors=>{
    const root=document.documentElement,issues=[];
    if(root.scrollHeight>innerHeight+1||root.scrollWidth>innerWidth+1)issues.push(`documento ${root.scrollWidth}x${root.scrollHeight} excede ${innerWidth}x${innerHeight}`);
    for(const selector of selectors){const e=document.querySelector(selector);if(!e){issues.push(`ausente: ${selector}`);continue}const r=e.getBoundingClientRect();if(r.width===0||r.height===0||r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1)issues.push(`${selector} fora da tela: ${JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height})}`)}
    return {issues,width:innerWidth,height:innerHeight};
   },selectors);
   if(data.issues.length)throw Error(stage+': '+JSON.stringify(data));results.push({stage,size:`${size.width}x${size.height}`});
  }
 }
 await check('entrada',['.compat-copy h1','.compat-description','.compat-primary','.phone-art img']);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Testar sensores'}).click();
 await page.getByRole('alert').waitFor({timeout:9000});
 await check('sensores indisponíveis',['.compat-copy h1','.compat-error','.compat-primary','.phone-art img']);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Tentar novamente'}).click();
 await page.evaluate(()=>{let i=0;window.sensorFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}));},16)});
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await page.evaluate(()=>clearInterval(window.sensorFeed));
 await check('aprovado',['.compat-copy h1','.compat-result','.compat-primary','.phone-art img']);
 await page.route('**/models/ronin-v2-float.tflite',async route=>{await new Promise(resolve=>setTimeout(resolve,5000));await route.continue()});
 await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByText('Preparando o modelo').waitFor();
 await check('carregamento',['.loading-content h1','.model-loading-progress','.loading-symbol']);
 await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:60000});
 await check('mapa',['.field','.instrument-head','.reading:nth-child(1)','.reading:nth-child(2)','.reading:nth-child(3)','.reset','.download','.play']);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Iniciar coleta'}).click();
 await page.getByText('Nenhuma leitura de movimento').waitFor({timeout:7000});
 await check('aviso de sensores',['.field','.orientation-status','.sensor-status','.reset','.download','.play']);
 await page.getByRole('button',{name:'Resetar dados'}).click();
 await check('confirmação',['dialog h2','.dialog-actions .confirm','.dialog-actions .secondary']);
 return {verificacoes:results.length,resultados:results};
}
