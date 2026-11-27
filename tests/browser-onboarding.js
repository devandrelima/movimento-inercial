async page => {
 const send=async gyro=>page.evaluate(g=>{let i=0;window.testFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0.3,y:0.5,z:9.8},rotationRate:g?{alpha:1,beta:2,gamma:3}:null,interval:16}));if((i++%3)===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:10,beta:20,gamma:30,absolute:false}));},16)},gyro);
 await page.getByRole('button',{name:'Testar sensores'}).click();await send(false);
 await page.getByRole('alert').waitFor({timeout:9000});const failure=await page.getByRole('alert').innerText();
 if(!failure.includes('giroscópio'))throw Error('Sensor ausente não identificado: '+failure);
 await page.evaluate(()=>clearInterval(window.testFeed));
 await page.getByRole('button',{name:'Tentar novamente'}).click();await send(true);
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await page.evaluate(()=>clearInterval(window.testFeed));
 let attempts=0;await page.route('**/models/ronin-v2-float.tflite',async route=>{attempts++;if(attempts===1){await route.abort();return}await new Promise(resolve=>setTimeout(resolve,2000));await route.continue()});
 await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByText('Não foi possível carregar o modelo').waitFor({timeout:10000});
 await page.getByRole('button',{name:'Tentar novamente'}).click();await page.getByRole('heading',{name:'Preparando o modelo'}).waitFor({timeout:5000});
 await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:60000});
 const status='modelo pronto; mapa aberto';
 return {ausencia:failure,teste:'sensores detectados',loading:'erro, nova tentativa e download verificados',modelo:status,aplicacao:'aberta'};
}
