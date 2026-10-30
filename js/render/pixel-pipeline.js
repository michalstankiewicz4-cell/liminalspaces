// Pixel-art post-process: renders the scene at low resolution into a render target, then upscales it with
// palette quantisation, Bayer dithering, depth-based outlines and a vignette; optional ACES tone mapping and film grain. Works with orthographic and perspective cameras.
import * as THREE from '../../vendor/three.module.js';

const VERT = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;

const FRAG = `precision highp float;
uniform sampler2D tColor,tDepth;
uniform vec2 texel;
uniform float levels,dither,edge,edgeW,bright,persp,near,far,tone,grain,time,heat,glitch,fear;
varying vec2 vUv;
float bayer(vec2 p){
  p=floor(mod(p,4.));
  float v2=mod(2.*mod(p.x,2.)+3.*mod(p.y,2.),4.);
  float v1=mod(2.*floor(p.x/2.)+3.*floor(p.y/2.),4.);
  return (v2*4.+v1)/16.;
}
// Depth sample in view units (perspective depth is non-linear, orthographic is already linear).
float lin(vec2 uv){
  float d=texture2D(tDepth,uv).r;
  if(persp<.5)return d;
  float z=d*2.-1.;
  return 2.*near*far/(far+near-z*(far-near));
}
// Edge strength between two samples: absolute for ortho, relative to distance for perspective.
float diff(float a,float b){
  return persp<.5 ? abs(a-b) : abs(a-b)/max(min(a,b),.1);
}
void main(){
  vec2 p=vUv;
  if(heat>0.){                                   // sun exposure: the air shimmers
    p+=vec2(sin(p.y*38.+time*5.3),cos(p.x*31.+time*4.1))*.0025*heat;
  }
  if(glitch>0.){                                 // video glitch: torn rows and a rolling band
    float row=floor(p.y*90.);
    float r=fract(sin(row*12.9898+floor(time*30.)*7.13)*43758.5453);
    p.x+=(r-.5)*.06*glitch*step(.6,r);
    p.y+=step(.985,fract(p.y*2.+time*1.7))*.01*glitch;
  }
  vec2 uv=(floor(p/texel)+.5)*texel;
  vec3 c=texture2D(tColor,uv).rgb*bright;
  float d=lin(uv);
  float e=0.;
  for(int k=1;k<=2;k++){                        // outline thickness 0..2: neighbours 1 and 2 pixels away, the last one weighted
    float wk=clamp(edgeW-float(k-1),0.,1.);
    if(wk<=0.) break;
    vec2 o=texel*float(k);
    float ek=max(max(diff(d,lin(uv+vec2(o.x,0.))),diff(d,lin(uv-vec2(o.x,0.)))),max(diff(d,lin(uv+vec2(0.,o.y))),diff(d,lin(uv-vec2(0.,o.y)))));
    e=max(e,ek*wk);
  }
  float em=persp<.5 ? smoothstep(.004,.009,e) : smoothstep(.16,.32,e);
  if(tone>.5){                                   // ACES filmic tone mapping for HDR scenes (Great Path world)
    c*=.6;
    c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);
  }
  if(heat>0.){                                   // warm, bleached, then burning white
    c=mix(c,c*vec3(1.22,1.04,.82)+vec3(.12,.07,.0)*heat,heat);
    c=mix(c,vec3(1.,.97,.9),smoothstep(.65,1.,heat)*.85);
    float vg=length(vUv-.5);
    c=mix(c,vec3(1.,.55,.3),smoothstep(.35,.75,vg)*heat*.35);
  }
  if(glitch>0.){
    float l=fract(sin(floor(vUv.y/texel.y)*3.7+time*91.)*43758.5);
    c=mix(c,vec3(step(.5,l)),step(.97,l)*glitch*.6);
  }
  if(fear>0.){                                   // dread: the edges close in and colour drains
    float v=length(vUv-.5);
    c*=1.-smoothstep(.2,.75,v)*fear*.75;
    c=mix(c,vec3(dot(c,vec3(.3,.59,.11))),fear*.45);
  }
  if(grain>0.){                                  // film grain
    float n=fract(sin(dot(floor(vUv/texel)+time*vec2(17.3,9.1),vec2(12.9898,78.233)))*43758.5453);
    c+=(n-.5)*grain*(.35+.65*(1.-dot(c,vec3(.33))));
  }
  c=pow(clamp(c,0.,1.),vec3(1./2.2));
  float b=bayer(floor(vUv/texel));
  c=clamp(floor(c*levels+b*dither)/levels,0.,1.);
  c*=1.-em*edge*.6;
  float v=length(vUv-.5);
  c*=1.-smoothstep(.3,.85,v)*.55;
  gl_FragColor=vec4(c,1.);
}`;

export class PixelPipeline {
  constructor(renderer) {
    this.r = renderer;
    this.params = { pixelH: 200, levels: 7, dither: 0.8, edge: 0.8, edgeW: 1, bright: 1.4, tone: 0, grain: 0 };
    this.heat = 0;                     // sun exposure effect 0..1 (Great Path)
    this.glitch = 0; this.fear = 0;    // event effects 0..1 (Great Path)
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: null }, tDepth: { value: null },
        texel: { value: new THREE.Vector2(1, 1) },
        levels: { value: 7 }, dither: { value: 0.8 }, edge: { value: 0.8 }, edgeW: { value: 1 }, bright: { value: 1.4 },
        persp: { value: 0 }, near: { value: 0.1 }, far: { value: 100 }, tone: { value: 0 }, grain: { value: 0 }, time: { value: 0 }, heat: { value: 0 }, glitch: { value: 0 }, fear: { value: 0 },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(quad);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.rt = null;
    this.resize(innerWidth, innerHeight);
  }

  // Sets the filter parameters; changing pixelH re-allocates the render target.
  setParams(p) {
    const old = this.params.pixelH;
    Object.assign(this.params, p);
    if (this.params.pixelH !== old) this.resize(innerWidth, innerHeight);
  }

  resize(w, h) {
    const ph = Math.round(this.params.pixelH);
    const pw = Math.max(2, Math.round(ph * w / h));
    if (this.rt) { this.rt.dispose(); this.rt.depthTexture.dispose(); }
    const depth = new THREE.DepthTexture(pw, ph);
    depth.minFilter = depth.magFilter = THREE.NearestFilter;
    this.rt = new THREE.WebGLRenderTarget(pw, ph, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      depthBuffer: true, depthTexture: depth, type: THREE.HalfFloatType,
    });
    this.mat.uniforms.tColor.value = this.rt.texture;
    this.mat.uniforms.tDepth.value = depth;
    this.mat.uniforms.texel.value.set(1 / pw, 1 / ph);
  }

  render(scene, camera) {
    const u = this.mat.uniforms, p = this.params;
    u.levels.value = p.levels; u.dither.value = p.dither; u.edge.value = p.edge; u.edgeW.value = p.edgeW ?? 1; u.bright.value = p.bright;
    u.tone.value = p.tone; u.grain.value = p.grain; u.heat.value = this.heat; u.glitch.value = this.glitch; u.fear.value = this.fear; u.time.value = (performance.now() / 1000) % 100;
    u.persp.value = camera.isPerspectiveCamera ? 1 : 0;
    u.near.value = camera.near; u.far.value = camera.far;
    if (!camera.isPerspectiveCamera) { u.near.value = camera.near; u.far.value = camera.far; }
    this.r.setRenderTarget(this.rt);
    this.r.render(scene, camera);
    this.r.setRenderTarget(null);
    this.r.render(this.postScene, this.postCam);
  }
}
