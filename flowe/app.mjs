import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = id => document.getElementById(id);
const palette = {
  blue: ['#245ccc','#57a9ed','#3985da','#344bb7','#47a2cd'],
  original: ['#191998','#1abadf','#f2d00f','#ff0119','#0bb30b'],
  ice: ['#b8d8ed','#cce9f4','#8abbd9','#acc5e6','#d4e7ed'],
};
const names = ['Синий · с логотипом','Голубой','Жёлтый','Красный','Зелёный'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {spread:0,layers:8,twist:0,light:100,material:'glass',palette:'blue',selected:0,view:'hero',spin:false,showLogo:true,petals:Array.from({length:5},()=>({turn:0,lift:0,color:null}))};
const groups=[],meshes=[],bases=[],layerTargets=[];
let logoMesh,blueWithLogoGeometry,bluePlainGeometry;
let renderer,scene,camera,orbit,root,ground,shadow,raf,dirty=true,ready=false,toastTimer,transition=null;
const v = (x,y,z)=>new THREE.Vector3(x,y,z);
const invalidate = ()=>{dirty=true;};
function toast(message){$('status').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('status').textContent='',4200);}
function pressed(attr,value){document.querySelectorAll(`[${attr}]`).forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute(attr)===String(value))));}
function controlsSync(){
  $('show-logo').checked=state.showLogo;
  names[0]=state.showLogo?'Синий · с логотипом':'Синий';
  document.querySelector('[data-petal="0"]').setAttribute('aria-label',state.showLogo?'Синий лепесток с логотипом':'Синий лепесток');
  document.querySelector('[data-view="macro"]').textContent=state.showLogo?'Логотип':'Крупно';
  $('model-description').textContent=state.showLogo?'5 лепестков · знак заподлицо':'5 лепестков · без логотипа';
  ['spread','layers','twist','light'].forEach(key=>{ $(key).value=state[key]; $(`${key}-value`).value=state[key]+(key==='twist'?'°':'%'); });
  pressed('data-material',state.material);pressed('data-palette',state.palette);pressed('data-petal',state.selected);
  const p=state.petals[state.selected];
  $('petal-turn').value=p.turn;$('petal-turn-value').value=p.turn+'°';
  $('petal-lift').value=p.lift;$('petal-lift-value').value=(p.lift/10).toFixed(1);
  $('petal-color').value=p.color||palette[state.palette][state.selected];
  $('selected-name').textContent=names[state.selected];
  $('look-name').textContent=(state.palette==='blue'?'Синее':state.palette==='ice'?'Ледяное':'Цветное')+' '+({glass:'стекло',frost:'матовое стекло',enamel:'покрытие'}[state.material]);
}
function updateShape(){
  groups.forEach((g,i)=>{
    const spread=1+state.spread/100*1.6;
    g.position.set(bases[i].x*spread,.24+(4-i)*(.44+state.layers*.0075)+state.petals[i].lift/10,bases[i].z*spread);
    g.rotation.y=THREE.MathUtils.degToRad(state.twist*(2-i)*.65+state.petals[i].turn);
  });
  dirty=true;
}
function updateLogo(){
  // Swap the entire surface: hiding the inlay alone would leave its cutout in the glass.
  meshes[0].geometry=state.showLogo?blueWithLogoGeometry:bluePlainGeometry;
  logoMesh.visible=state.showLogo;
  invalidate();
}
function updateMaterials(){
  meshes.forEach((mesh,i)=>{
    const m=mesh.material;m.color.set(state.petals[i].color||palette[state.palette][i]);
    m.transmission=state.material==='enamel'?0:state.material==='frost'?.88:.98;
    m.roughness=state.material==='enamel'?.24:state.material==='frost'?.36:.095;
    m.metalness=state.material==='enamel'?.08:0;
    m.thickness=.44;m.ior=1.46;m.attenuationColor.copy(m.color);m.attenuationDistance=state.palette==='ice'?5:2.5;
    m.clearcoat=state.material==='enamel'?.65:.14;m.clearcoatRoughness=.12;m.envMapIntensity=1.15;m.needsUpdate=true;
  });
  renderer.toneMappingExposure=state.light/100*1.1;dirty=true;
}
function stopSpin(){state.spin=false;orbit.autoRotate=false;$('spin').setAttribute('aria-pressed','false');}
function targetFor(view){
  const aspect=camera.aspect;
  if(view==='macro'){
    const target=groups[0].localToWorld(v(-bases[0].x,.22,-bases[0].z));
    const distance=9.5/Math.min(1,aspect*1.3);
    return {target,position:target.clone().add(v(.3,.65,1).normalize().multiplyScalar(distance))};
  }
  const box=new THREE.Box3().setFromObject(root),target=box.getCenter(new THREE.Vector3());
  const size=box.getSize(new THREE.Vector3());
  const r=Math.max(size.x,size.z,size.y)*.57;
  const distance=r/(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.min(aspect,1))*1.12;
  const direction=view==='top'?v(0,1,.001):v(.28,.80,1);
  return {target,position:target.clone().add(direction.normalize().multiplyScalar(distance))};
}
function setView(view,animate=true){
  stopSpin();state.view=view;pressed('data-view',view);
  const to=targetFor(view);
  if(!animate||reduced){camera.position.copy(to.position);orbit.target.copy(to.target);orbit.update();transition=null;}
  else transition={from:camera.position.clone(),fromTarget:orbit.target.clone(),...to,start:performance.now()};
  invalidate();
}
function reset(){
  Object.assign(state,{spread:0,layers:8,twist:0,light:100,material:'glass',palette:'blue',selected:0,showLogo:true});
  state.petals=Array.from({length:5},()=>({turn:0,lift:0,color:null}));root.rotation.y=0;
  updateShape();updateLogo();updateMaterials();controlsSync();pressed('data-preset','flower');setView('hero');toast('Исходный цветок восстановлен');
}
function initUI(){
  $('show-logo').addEventListener('change',()=>{state.showLogo=$('show-logo').checked;updateLogo();controlsSync();});
  ['spread','layers','twist','light'].forEach(key=>$(key).addEventListener('input',()=>{
    state[key]=+$(key).value;controlsSync();if(key==='light')updateMaterials();else{updateShape();pressed('data-preset','');}
  }));
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{
    const preset=b.dataset.preset;
    Object.assign(state,preset==='air'?{spread:15,layers:100,twist:0}:preset==='fan'?{spread:35,layers:30,twist:27}:{spread:0,layers:8,twist:0});
    state.petals.forEach(p=>{p.turn=0;p.lift=0;});
    pressed('data-preset',preset);controlsSync();updateShape();setView('hero');
  }));
  document.querySelectorAll('[data-material]').forEach(b=>b.addEventListener('click',()=>{state.material=b.dataset.material;updateMaterials();controlsSync();}));
  document.querySelectorAll('[data-palette]').forEach(b=>b.addEventListener('click',()=>{state.palette=b.dataset.palette;state.petals.forEach(p=>p.color=null);updateMaterials();controlsSync();}));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  document.querySelectorAll('[data-petal]').forEach(b=>b.addEventListener('click',()=>{state.selected=+b.dataset.petal;controlsSync();}));
  ['turn','lift'].forEach(key=>$(`petal-${key}`).addEventListener('input',()=>{state.petals[state.selected][key]=+$(`petal-${key}`).value;updateShape();controlsSync();pressed('data-preset','');}));
  $('petal-color').addEventListener('input',()=>{state.petals[state.selected].color=$('petal-color').value;updateMaterials();});
  $('reset-petal').addEventListener('click',()=>{state.petals[state.selected]={turn:0,lift:0,color:null};updateShape();updateMaterials();controlsSync();});
  $('spin').addEventListener('click',()=>{transition=null;state.spin=!state.spin;orbit.autoRotate=state.spin;$('spin').setAttribute('aria-pressed',String(state.spin));invalidate();});
  $('reset').addEventListener('click',reset);$('reset-mobile').addEventListener('click',reset);
  $('format').addEventListener('change',()=>{const jpeg=$('format').value==='jpeg';$('transparent').disabled=jpeg;if(jpeg)$('transparent').checked=false;});
  $('export').addEventListener('click',exportImage);
  const viewport=$('viewport');
  viewport.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','=','-','0'].includes(event.key))return;
    event.preventDefault();stopSpin();transition=null;
    if(event.key==='0'){setView('hero');return;}
    const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
    if(event.key==='ArrowLeft')spherical.theta-=.10;
    if(event.key==='ArrowRight')spherical.theta+=.10;
    if(event.key==='ArrowUp')spherical.phi-=.10;
    if(event.key==='ArrowDown')spherical.phi+=.10;
    if(event.key==='+'||event.key==='=')spherical.radius*=.92;
    if(event.key==='-')spherical.radius*=1.08;
    spherical.phi=THREE.MathUtils.clamp(spherical.phi,.01,Math.PI*.49);spherical.radius=THREE.MathUtils.clamp(spherical.radius,4,80);
    camera.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(spherical));orbit.update();pressed('data-view','');invalidate();
  });
  let down=null;
  viewport.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  viewport.addEventListener('pointerup',e=>{
    if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;
    const rect=viewport.getBoundingClientRect();const ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    const hit=ray.intersectObjects(meshes)[0];if(hit){state.selected=meshes.indexOf(hit.object);controlsSync();}
  });
}
function resize(){
  const {width,height}=$('viewport').getBoundingClientRect();if(!width||!height)return;
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  if(ready&&state.view)setView(state.view,false);invalidate();
}
async function exportImage(){
  const button=$('export');button.disabled=true;toast('Готовим изображение…');
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const oldSize=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio(),background=scene.background;
  const long=+$('size').value,aspect=camera.aspect,width=aspect>=1?long:Math.round(long*aspect),height=aspect>=1?Math.round(long/aspect):long;
  try{
    if(transition){camera.position.copy(transition.position);orbit.target.copy(transition.target);orbit.update();transition=null;}
    renderer.setPixelRatio(1);renderer.setSize(width,height,false);
    if($('transparent').checked&&$('format').value==='png'){scene.background=null;ground.visible=false;shadow.visible=false;}
    renderScene();
    const format=$('format').value;
    const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,`image/${format}`,.96));
    if(!blob)throw new Error('Image encoding failed');
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`flowe-${state.palette}-${state.material}${state.showLogo?'':'-no-logo'}.${format==='jpeg'?'jpg':'png'}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    toast(`Кадр сохранён · ${width} × ${height} px`);
  }catch(error){console.error(error);toast('Не удалось сохранить кадр. Попробуйте размер 1920 px.');}
  finally{scene.background=background;ground.visible=true;shadow.visible=true;renderer.setPixelRatio(ratio);renderer.setSize(oldSize.x,oldSize.y,false);button.disabled=false;invalidate();}
}
// Composite the visible lower petals into an individual refraction buffer for each
// upper petal. Stock screen-space transmission excludes other transmissive objects.
function renderScene(){
  if(state.material!=='enamel'&&groups.length===5){
    const size=renderer.getDrawingBufferSize(new THREE.Vector2());
    const scale=Math.min(1,1000/Math.max(size.x,size.y));
    const w=Math.max(1,Math.round(size.x*scale)),h=Math.max(1,Math.round(size.y*scale));
    // Camera stays above the flower; local height determines the overlap order.
    const order=[0,1,2,3,4].sort((a,b)=>groups[a].position.y-groups[b].position.y);
    groups.forEach(g=>g.visible=false);
    for(const i of order){
      const rt=layerTargets[i];if(rt.width!==w||rt.height!==h)rt.setSize(w,h);
      renderer.setRenderTarget(rt);renderer.render(scene,camera);
      meshes[i].material.userData.layerSize.value.set(w,h);
      groups[i].visible=true;
    }
    renderer.setRenderTarget(null);
  }
  renderer.render(scene,camera);
}
function makeGlassMaterial(){
  const rt=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  layerTargets.push(rt);
  const material=new THREE.MeshPhysicalMaterial();
  material.userData.layerMap={value:rt.texture};material.userData.layerSize={value:new THREE.Vector2(1,1)};
  material.onBeforeCompile=shader=>{
    shader.uniforms.layerTransmissionMap=material.userData.layerMap;
    shader.uniforms.layerTransmissionSize=material.userData.layerSize;
    const chunk=THREE.ShaderChunk.transmission_pars_fragment.replaceAll('transmissionSamplerMap','layerTransmissionMap').replaceAll('transmissionSamplerSize','layerTransmissionSize');
    shader.fragmentShader=shader.fragmentShader.replace('#include <transmission_pars_fragment>',chunk);
  };
  material.customProgramCacheKey=()=> 'flowe-layered-glass-v1';
  return material;
}
function loop(time){
  raf=requestAnimationFrame(loop);
  if(document.hidden)return;
  if(transition){const t=Math.min((time-transition.start)/650,1),e=1-Math.pow(1-t,4);camera.position.lerpVectors(transition.from,transition.position,e);orbit.target.lerpVectors(transition.fromTarget,transition.target,e);orbit.update();dirty=true;if(t===1)transition=null;}
  if(state.spin){orbit.update();dirty=true;}
  if(dirty){renderScene();dirty=false;}
}
async function main(){
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden','true');$('viewport').append(renderer.domElement);
    scene=new THREE.Scene();scene.background=new THREE.Color('#e5e9ef');
    camera=new THREE.PerspectiveCamera(35,1,.1,150);camera.position.set(7,16,20);
    orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=false;orbit.minDistance=4;orbit.maxDistance=80;orbit.maxPolarAngle=Math.PI*.49;orbit.autoRotateSpeed=.65;orbit.target.set(0,1,0);
    orbit.addEventListener('change',invalidate);orbit.addEventListener('start',()=>{transition=null;state.view=null;pressed('data-view','');});
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
    const env=pmrem.fromScene(room,.035);scene.environment=env.texture;scene.environmentRotation.set(.22,.4,.18);room.dispose();pmrem.dispose();
    const key=new THREE.DirectionalLight('#ffffff',3);key.position.set(-4,10,7);scene.add(key);
    const fill=new THREE.DirectionalLight('#c4dcff',1.8);fill.position.set(7,5,-4);scene.add(fill,new THREE.HemisphereLight('#ffffff','#6c789b',1));
    ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshBasicMaterial({color:'#e5e9ef'}));ground.rotation.x=-Math.PI/2;ground.position.y=-.08;scene.add(ground);
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const context=shadowCanvas.getContext('2d');const gradient=context.createRadialGradient(64,64,5,64,64,64);gradient.addColorStop(0,'rgba(34,52,80,.22)');gradient.addColorStop(.5,'rgba(34,52,80,.11)');gradient.addColorStop(1,'rgba(34,52,80,0)');context.fillStyle=gradient;context.fillRect(0,0,128,128);
    shadow=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.06;scene.add(shadow);
    const response=await fetch(new URL('assets/flower.json',import.meta.url));if(!response.ok)throw new Error('Model asset unavailable');const data=await response.json();
    root=new THREE.Group();scene.add(root);
    for(const part of data.parts){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.position,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.normal,3));geometry.setIndex(part.index);geometry.computeBoundingSphere();
      if(part.part==='petal'){
        const group=new THREE.Group(),base=new THREE.Vector3(...part.pivot);group.position.copy(base);root.add(group);groups.push(group);bases.push(base);
        const mesh=new THREE.Mesh(geometry,makeGlassMaterial());mesh.name=part.name;group.add(mesh);meshes.push(mesh);
      }else{
        logoMesh=new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.25,clearcoat:.4,metalness:0}));logoMesh.name='Original flush logo';groups[0].add(logoMesh);
      }
    }
    if(groups.length!==5||!logoMesh)throw new Error('Expected five petals and a logo');
    blueWithLogoGeometry=meshes[0].geometry;
    // All petals share the same ellipse and bevel. Align an intact petal to the blue
    // one's radial orientation, retaining the original normals and edge profile.
    const blueAngle=Math.atan2(-bases[0].x,-bases[0].z),cyanAngle=Math.atan2(-bases[1].x,-bases[1].z);
    bluePlainGeometry=meshes[1].geometry.clone().rotateY(blueAngle-cyanAngle);
    bluePlainGeometry.computeBoundingSphere();
    initUI();updateLogo();updateShape();updateMaterials();controlsSync();resize();setView('hero',false);ready=true;
    $('controls').disabled=false;document.querySelectorAll('button:disabled').forEach(b=>b.disabled=false);$('loading').hidden=true;
    new ResizeObserver(resize).observe($('viewport'));
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(raf);$('error').hidden=false;$('error-message').textContent='Графический контекст потерян. Обновите страницу, чтобы снова открыть цветок.';});
    // A small diagnostic API for reproducible browser verification, no external services.
    window.flowe={state,scene,camera,orbit,groups,meshes,reset,setView,renderer};
    loop(performance.now());
  }catch(error){console.error(error);$('loading').hidden=true;$('error').hidden=false;}
}
main();
