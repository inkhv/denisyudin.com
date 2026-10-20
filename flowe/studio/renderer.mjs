import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
const vertex=`out vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
function shader(fragment,uniforms={}){return new T.ShaderMaterial({glslVersion:T.GLSL3,vertexShader:vertex,fragmentShader:fragment,uniforms,depthTest:false,depthWrite:false,toneMapped:false});}
const samplers=Array.from({length:6},(_,i)=>`uniform sampler2D color${i};uniform sampler2D surface${i};`).join('\n');
// Six independent front surfaces are sorted at EACH pixel. No whole-object sorting,
// no alpha depth-write tricks, and deterministic ties for coincident ellipses.
const compose=`precision highp float;in vec2 vUv;layout(location=0) out vec4 result;layout(location=1) out vec4 info;
${samplers}
uniform vec4 properties[6]; // opacity, transmission, thickness, attenuation distance
uniform vec3 attenuation[6];uniform vec3 tint[6];uniform float rough[6];uniform float iors[6];uniform vec3 bg;
uniform int mode;uniform float strength;uniform float absorption;uniform bool transparentBg;
uniform float nearPlane;uniform float farPlane;uniform bool ortho;
float viewDepth(float d){return ortho?mix(nearPlane,farPlane,d):nearPlane*farPlane/(farPlane-d*(farPlane-nearPlane));}
vec3 blend(vec3 a,vec3 b){if(mode==2)return a+b;if(mode==3)return 1.-(1.-min(a,vec3(1.)))*(1.-min(b,vec3(1.)))+max(a-1.,0.)+max(b-1.,0.);if(mode==4)return a*b;if(mode==5)return mix(2.*a*b,1.-2.*(1.-a)*(1.-b),step(vec3(.5),a));return b;}
vec4 layerColor(int i,vec2 uv,float lod){
if(i==0)return textureLod(color0,uv,lod);if(i==1)return textureLod(color1,uv,lod);if(i==2)return textureLod(color2,uv,lod);if(i==3)return textureLod(color3,uv,lod);if(i==4)return textureLod(color4,uv,lod);if(i==5)return textureLod(color5,uv,lod);return vec4(0.);}
void main(){vec4 colors[6];vec4 surfaces[6];int ids[6];
${Array.from({length:6},(_,i)=>`colors[${i}]=texture(color${i},vUv);surfaces[${i}]=texture(surface${i},vUv);ids[${i}]=${i};`).join('\n')}
// A rough transmitting surface blurs and slightly displaces the radiance behind it.
// The source is the isolated lower object, never the already-composited foreground.
for(int i=0;i<6;i++){float blur=0.;vec2 shift=vec2(0.);for(int j=0;j<6;j++){if(colors[j].a>.01&&surfaces[j].w<surfaces[i].w-0.000002){float t=properties[j].x*properties[j].y;blur=max(blur,rough[j]*t);shift+=(surfaces[j].xy*2.-1.)*(iors[j]-1.)*properties[j].z*t*.004;}}
if(blur>.15||length(shift)>.0001){vec4 filtered=layerColor(i,clamp(vUv+shift,vec2(0.),vec2(1.)),max(0.,blur-.12)*5.);if(filtered.a>.05)colors[i].rgb=filtered.rgb/filtered.a;}}
for(int a=0;a<5;a++){for(int b=0;b<5-a;b++){int i=ids[b],j=ids[b+1];float di=colors[i].a>.01?surfaces[i].w:2.;float dj=colors[j].a>.01?surfaces[j].w:2.;if(di<dj-0.000002||(abs(di-dj)<0.000002&&i<j)){ids[b]=j;ids[b+1]=i;}}}
vec3 c=transparentBg?vec3(0.):bg;float alpha=transparentBg?0.:1.;float depth=farPlane;float coverage=0.;
for(int k=0;k<6;k++){int i=ids[k];if(colors[i].a<.01)continue;vec4 p=properties[i];float op=p.x;if(op<.0001)continue;vec3 n=normalize(surfaces[i].xyz*2.-1.);float fresnel=pow((iors[i]-1.)/(iors[i]+1.),2.);fresnel+= (1.-fresnel)*pow(1.-abs(n.z),5.);float tr=p.y*(1.-fresnel);vec3 attenuationFilter=pow(max(attenuation[i],vec3(.015)),vec3(absorption*p.z/max(p.w,.01)/max(.25,abs(n.z))));vec3 beer=pow(max(tint[i],vec3(.025)),vec3(.24*p.z/.44))*attenuationFilter;
vec3 surface=colors[i].rgb;
if(mode==0){c=mix(c,c*beer*tr+surface,op);}else{float weight=op*(1.-p.y*.55);vec3 transmitted=c*mix(vec3(1.),attenuationFilter,p.y);vec3 normal=mix(transmitted,surface,weight);vec3 artistic=mix(transmitted,blend(transmitted,surface),weight);c=mode==1?mix(transmitted,surface,weight*strength):mix(normal,artistic,strength);}
float visibleWeight=op*(1.-tr*.85);if(op>.05)depth=viewDepth(surfaces[i].w);coverage=visibleWeight+coverage*(1.-visibleWeight);alpha=visibleWeight+alpha*(1.-visibleWeight);
}
result=vec4(max(c,vec3(0.)),alpha);info=vec4(depth,coverage,0.,1.);
}`;
const dof=`precision highp float;in vec2 vUv;out vec4 result;uniform sampler2D colorMap;uniform sampler2D depthMap;uniform vec2 resolution;uniform float focus;uniform float focal;uniform float fstop;uniform float maxBlur;uniform bool enabled;
float coc(float z){float f=focal;float zm=max(z*100.,f+1.);float fm=max(focus*100.,f+1.);float sensorBlur=(f/fstop)*f*abs(zm-fm)/(zm*(fm-f));return min(maxBlur, sensorBlur/36.*resolution.x);}
void main(){vec4 center=texture(colorMap,vUv);if(!enabled||maxBlur<.01){result=center;return;}float z=texture(depthMap,vUv).r;float r=coc(z);vec4 sum=center;float weights=1.;for(int i=0;i<32;i++){float angle=float(i)*2.39996323;float ring=sqrt((float(i)+.5)/32.);vec2 uv=vUv+vec2(cos(angle),sin(angle))*ring*max(r,1.)/resolution;float other=texture(depthMap,uv).r;float otherR=coc(other);float w=other<z-.1?max(.08,smoothstep(r*ring-1.,r*ring+1.,otherR)):1.;if(z<other-.2&&r<2.)w*=.08;sum+=texture(colorMap,uv)*w;weights+=w;}result=sum/weights;}`;
const output=`precision highp float;in vec2 vUv;out vec4 result;uniform sampler2D colorMap;uniform sampler2D bloomMap;uniform float bloomStrength;uniform float exposure;uniform bool transparentBg;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}vec3 srgb(vec3 x){return mix(12.92*x,1.055*pow(x,vec3(1./2.4))-.055,step(vec3(.0031308),x));}
void main(){vec4 c=texture(colorMap,vUv);vec3 glow=texture(bloomMap,vUv).rgb*bloomStrength;float a=transparentBg?clamp(c.a+max(max(glow.r,glow.g),glow.b),0.,1.):1.;vec3 rgb=c.rgb+glow;if(transparentBg&&a>.0001)rgb/=a;result=vec4(srgb(aces(max(rgb,vec3(0.))*exposure)),a);}`;
export function physicalMaterial(){const m=new T.MeshPhysicalMaterial({side:T.DoubleSide,roughness:.1,depthWrite:true,toneMapped:false});
 m.userData.uniforms={floweTransmission:{value:0},floweSSS:{value:0},floweSSSColor:{value:new T.Color()},floweRadius:{value:1},floweThickness:{value:.44}};
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,m.userData.uniforms);s.fragmentShader='layout(location=1) out vec4 floweSurface;\nuniform float floweTransmission;uniform float floweSSS;uniform vec3 floweSSSColor;uniform float floweRadius;uniform float floweThickness;\n'+s.fragmentShader;
 const chunk=T.ShaderChunk.lights_physical_pars_fragment.replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',`reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
 float wrap=pow(clamp((dot(geometryNormal,directLight.direction)+1.)*.5,0.,1.),1./max(floweRadius,.1));
 reflectedLight.directDiffuse += directLight.color*floweSSSColor*floweSSS*wrap*exp(-floweThickness/max(floweRadius,.01))*.22;`);
 s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_pars_fragment>',chunk).replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;','vec3 outgoingLight = totalDiffuse*(1.-floweTransmission+floweSSS*floweTransmission*.5) + totalSpecular + totalEmissiveRadiance;').replace('#include <opaque_fragment>','#include <opaque_fragment>\nfloweSurface=vec4(normal*.5+.5,gl_FragCoord.z);');};m.customProgramCacheKey=()=> 'flowe-surface-v2';return m;}
export class StudioRenderer{
 constructor(renderer,scene,objects){this.renderer=renderer;this.scene=scene;this.objects=objects;this.width=0;this.height=0;
 this.layers=objects.map(()=>new T.WebGLRenderTarget(1,1,{count:2,type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter}));
 this.combined=new T.WebGLRenderTarget(1,1,{count:2,type:T.HalfFloatType,depthBuffer:false});
 this.focused=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
 this.quad=new FullScreenQuad();const uniforms={properties:{value:Array.from({length:6},()=>new T.Vector4())},attenuation:{value:Array.from({length:6},()=>new T.Color())},tint:{value:Array.from({length:6},()=>new T.Color())},rough:{value:Array(6).fill(0)},iors:{value:Array(6).fill(1.46)},bg:{value:new T.Color()},mode:{value:0},strength:{value:.65},absorption:{value:.6},transparentBg:{value:false},nearPlane:{value:.1},farPlane:{value:200},ortho:{value:false}};
 this.layers.forEach((rt,i)=>{uniforms['color'+i]={value:rt.textures[0]};uniforms['surface'+i]={value:rt.textures[1]};rt.textures[0].generateMipmaps=true;rt.textures[0].minFilter=T.LinearMipmapLinearFilter;rt.textures[1].type=T.FloatType;rt.textures[1].minFilter=T.NearestFilter;rt.textures[1].magFilter=T.NearestFilter;});
 this.composition=shader(compose,uniforms);
 this.dof=shader(dof,{colorMap:{value:this.combined.textures[0]},depthMap:{value:this.combined.textures[1]},resolution:{value:new T.Vector2()},focus:{value:24},focal:{value:50},fstop:{value:2.8},maxBlur:{value:16},enabled:{value:false}});
 this.bloom=new UnrealBloomPass(new T.Vector2(1,1),1,.4,1.1);
 // Read bloom's blurred mip result; don't add its copy pass (which would destroy alpha).
 this.final=shader(output,{colorMap:{value:this.focused.texture},bloomMap:{value:this.bloom.renderTargetsHorizontal[0].texture},bloomStrength:{value:0},exposure:{value:1.1},transparentBg:{value:false}});
 }
 size(w,h){if(w===this.width&&h===this.height)return;this.width=w;this.height=h;for(const rt of [...this.layers,this.combined,this.focused])rt.setSize(w,h);this.bloom.setSize(w,h);this.dof.uniforms.resolution.value.set(w,h);}
 draw(material,target){this.quad.material=material;this.renderer.setRenderTarget(target);this.renderer.clear();this.quad.render(this.renderer);}
 render(camera,state,params,{transparent=false,width,height}={}){
 const renderer=this.renderer;const size=renderer.getDrawingBufferSize(new T.Vector2());const cap=state.quality==='draft'?720:state.quality==='high'?1600:1100;const scale=width?1:Math.min(1,cap/Math.max(size.x,size.y));this.size(width||Math.round(size.x*scale),height||Math.round(size.y*scale));
 const visible=this.objects.map(o=>o.visible);const background=this.scene.background;this.scene.background=null;renderer.setClearColor(0,0);renderer.toneMapping=T.NoToneMapping;
 // Freeze shadow maps while isolating surfaces: maps retain all shadow casters.
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 renderer.setRenderTarget(this.layers[0]);renderer.render(this.scene,camera);
 this.objects.forEach(o=>o.visible=false);
 for(let i=0;i<6;i++){this.objects[i].visible=visible[i];renderer.setRenderTarget(this.layers[i]);renderer.clear();if(visible[i])renderer.render(this.scene,camera);this.objects[i].visible=false;}
 this.objects.forEach((o,i)=>o.visible=visible[i]);this.scene.background=background;
 const u=this.composition.uniforms;params.forEach((p,i)=>{u.properties.value[i].set(p.opacity,p.transmission,p.thickness,p.attenuationDistance);u.attenuation.value[i].set(p.attenuationColor);u.tint.value[i].set(p.baseColor);u.rough.value[i]=p.roughness;u.iors.value[i]=p.ior;});
 u.mode.value=['physical','normal','add','screen','multiply','overlay'].indexOf(state.blend);u.strength.value=state.blendStrength;u.absorption.value=state.absorption;u.bg.value.set(state.lighting.background);u.transparentBg.value=transparent;u.nearPlane.value=camera.near;u.farPlane.value=camera.far;u.ortho.value=camera.isOrthographicCamera===true;
 this.draw(this.composition,this.combined);
 const d=this.dof.uniforms;d.focus.value=state.camera.focus;d.focal.value=state.camera.focal;d.fstop.value=state.camera.fstop;d.maxBlur.value=state.camera.maxBlur*this.width/1000;d.enabled.value=state.camera.dof&&!camera.isOrthographicCamera;
 this.draw(this.dof,this.focused);
 if(state.bloom.enabled&&state.bloom.strength>0){this.bloom.radius=state.bloom.radius;this.bloom.threshold=state.bloom.threshold;this.bloom.strength=1;this.bloom.render(renderer,null,this.focused,0,false);}
 // UnrealBloom modifies its input in the final additive pass: restore the focused
 // image, then combine exactly once in linear HDR before a single tone transform.
 if(state.bloom.enabled&&state.bloom.strength>0)this.draw(this.dof,this.focused);
 this.final.uniforms.bloomStrength.value=state.bloom.enabled?state.bloom.strength:0;this.final.uniforms.exposure.value=state.light/100*1.1;this.final.uniforms.transparentBg.value=transparent;this.draw(this.final,null);
 }
}
