/* Grainient — vanilla WebGL2 port of the Debatly background shader.
   Same fragment shader as Debate/src/components/Grainient.tsx, no dependencies.
   Perf: capped DPR, downscaled render buffer, and rendering pauses offscreen. */
(function () {
  const VERT = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed,uColorBalance,uWarpStrength,uWarpFrequency,uWarpSpeed,uWarpAmplitude;
uniform float uBlendAngle,uBlendSoftness,uRotationAmount,uNoiseScale,uGrainAmount,uGrainScale;
uniform float uGrainAnimated,uContrast,uGamma,uSaturation,uZoom;
uniform vec2 uCenterOffset;
uniform vec3 uColor1,uColor2,uColor3;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void main(){
  float t=iTime*uTimeSpeed;
  vec2 uv=gl_FragCoord.xy/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);
  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*uWarpFrequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(uWarpFrequency*1.5)+warpTime)/(amplitude*0.5);
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s, edge1=0.2-b+s, v0=0.5-b+s, v1=-0.3-b-s;
  vec3 layer1=mix(uColor3,uColor2,S(edge0,edge1,blendX));
  vec3 layer2=mix(uColor2,uColor1,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));
  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);}
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;
  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  fragColor=vec4(clamp(col,0.0,1.0),1.0);
}`;

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
  }

  window.initGrainient = function (container, opts) {
    /* Defaults = Debatly's exact AppBackdrop params (App.tsx), light theme. */
    const o = Object.assign({
      timeSpeed: 0.62, colorBalance: 0.26, warpStrength: 1.15, warpFrequency: 4.1,
      warpSpeed: 0.82, warpAmplitude: 46, blendAngle: 18, blendSoftness: 0.24,
      rotationAmount: 520, noiseScale: 2.35, grainAmount: 0.16, grainScale: 2.4,
      grainAnimated: false, contrast: 1.38, gamma: 1, saturation: 0.72,
      centerX: -0.12, centerY: 0.08, zoom: 0.74,
      color1: "#fbf8ef", color2: "#ddd8ce", color3: "#c9cdc8"
    }, opts || {});

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block;opacity:0;transition:opacity .6s ease";
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) return; // graceful: static bg remains
    container.appendChild(canvas);

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = (n) => gl.getUniformLocation(prog, n);
    const set1 = (n, v) => gl.uniform1f(U(n), v);
    set1("uTimeSpeed", o.timeSpeed); set1("uColorBalance", o.colorBalance);
    set1("uWarpStrength", o.warpStrength); set1("uWarpFrequency", o.warpFrequency);
    set1("uWarpSpeed", o.warpSpeed); set1("uWarpAmplitude", o.warpAmplitude);
    set1("uBlendAngle", o.blendAngle); set1("uBlendSoftness", o.blendSoftness);
    set1("uRotationAmount", o.rotationAmount); set1("uNoiseScale", o.noiseScale);
    set1("uGrainAmount", o.grainAmount); set1("uGrainScale", o.grainScale);
    set1("uGrainAnimated", o.grainAnimated ? 1 : 0); set1("uContrast", o.contrast);
    set1("uGamma", o.gamma); set1("uSaturation", o.saturation); set1("uZoom", o.zoom);
    gl.uniform2f(U("uCenterOffset"), o.centerX, o.centerY);
    gl.uniform3fv(U("uColor1"), hexToRgb(o.color1));
    gl.uniform3fv(U("uColor2"), hexToRgb(o.color2));
    gl.uniform3fv(U("uColor3"), hexToRgb(o.color3));
    const uTime = U("iTime"), uRes = U("iResolution");

    /* Perf: cap DPR and render the buffer at 70% — the grain conceals the upscale. */
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.7;
    function size() {
      const r = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    new ResizeObserver(size).observe(container);
    size();

    requestAnimationFrame(() => requestAnimationFrame(() => { canvas.style.opacity = "1"; }));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let running = false, raf = 0;
    function loop(t) {
      if (!running) return;
      gl.uniform1f(uTime, (t - t0) * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(loop);
    }
    function start() { if (running || reduced) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    /* Render only while the container is actually on screen. */
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }, { rootMargin: "80px" }).observe(container);
  };
})();
