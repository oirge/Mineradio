const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./GeometricBackground-Bmfdad4M.js","./main-DlaAdrC2.css"])))=>i.map(i=>d[i]);
import{a as e}from"./lucide-runtime-CZo6iGLR.js";import{Ei as t,Ot as n,cr as r,fr as i,gr as a,jt as o,mo as s,ur as c,va as l,wi as u,ya as d}from"./localPlayerData-DYFG8ofg.js";import{Z as f,h as p,ht as m,l as h,s as g,tt as _}from"./lucide-icons-C6X-VOVd.js";import{c as v,t as y}from"./main-Bamo5Rsd.js";var b=v(e(),1),x=s(),S=e=>e,C=({onClick:e,label:t,title:n,isDaylight:r})=>(0,x.jsx)(`button`,{type:`button`,onClick:e,className:`h-6 rounded-md px-1.5 text-[10px] font-bold transition-all ${r?`bg-white shadow-sm hover:bg-white/90`:`bg-white/20 shadow-sm hover:bg-white/30`}`,title:n,"aria-label":n,children:t}),w=({active:e,onToggle:t,label:n,theme:r,children:i})=>(0,x.jsx)(`button`,{type:`button`,onClick:t,className:`flex h-6 w-6 items-center justify-center rounded-md transition-all ${e?``:`opacity-40 hover:opacity-100`}`,style:e?{color:r?.accentColor??`var(--local-accent)`}:void 0,title:n,"aria-label":n,"aria-pressed":e,children:i}),T=(e,t)=>e[(e.indexOf(t)+1)%e.length],E=({label:e,description:t,checked:n,onChange:r,theme:i})=>(0,x.jsxs)(`div`,{className:`flex items-center justify-between gap-4`,children:[(0,x.jsxs)(`div`,{className:`space-y-1`,children:[(0,x.jsx)(`div`,{className:`text-sm font-medium`,style:{color:i.primaryColor},children:e}),t&&(0,x.jsx)(`div`,{className:`max-w-[320px] text-xs opacity-70`,style:{color:i.secondaryColor},children:t})]}),(0,x.jsx)(`button`,{type:`button`,"aria-pressed":n,disabled:!r,onClick:()=>r?.(!n),className:`h-6 w-12 shrink-0 rounded-full p-1 transition-colors disabled:opacity-45`,style:{backgroundColor:n?i.secondaryColor:u(i.secondaryColor,.18)},children:(0,x.jsx)(`div`,{className:`h-4 w-4 rounded-full shadow-sm transition-transform ${n?`translate-x-6`:`translate-x-0`}`,style:{backgroundColor:i.backgroundColor}})})]}),D=({config:e,actions:t,t:n,theme:r,controlCardBg:i,rangeInputClass:a,onSliderPointerDown:o,onSliderCommit:s})=>{let c=e?.common,l=t?.common,d=u(r.secondaryColor,.16),f=c?.opacity??.75;return(0,x.jsxs)(x.Fragment,{children:[(0,x.jsxs)(`div`,{className:`rounded-[24px] border p-4 space-y-4`,style:{backgroundColor:i,borderColor:d},children:[(0,x.jsx)(E,{label:n(`options.disableVisualizerVignette`),description:n(`options.disableVisualizerVignetteDesc`),checked:c?.disableVignette??!1,onChange:l?.onDisableVignetteChange,theme:r}),(0,x.jsx)(E,{label:n(`options.disableVisualizerGeometricBackground`),description:n(`options.disableVisualizerGeometricBackgroundDesc`),checked:c?.disableGeometricBackground??!1,onChange:l?.onDisableGeometricChange,theme:r})]}),(0,x.jsx)(`div`,{className:`rounded-[24px] border p-4 space-y-4`,style:{backgroundColor:i,borderColor:d},children:(0,x.jsxs)(`div`,{className:`space-y-2`,children:[(0,x.jsx)(`div`,{className:`text-sm font-medium`,style:{color:r.primaryColor},children:n(`options.previewCoverBackgroundSettings`)}),(0,x.jsx)(`div`,{className:`text-xs opacity-70`,style:{color:r.secondaryColor},children:n(`options.previewCoverBackgroundSettingsDesc`)}),(0,x.jsx)(E,{label:n(`theme.addCoverColor`),description:n(`options.coverColorBackgroundDesc`),checked:c?.useCoverColorBg??!1,onChange:l?.onCoverColorChange,theme:r}),(0,x.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:r.primaryColor},children:[(0,x.jsx)(`span`,{children:n(`options.previewCoverBackgroundOpacity`)}),(0,x.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:r.secondaryColor},children:[Math.round(f*100),`%`]})]}),(0,x.jsx)(`input`,{type:`range`,min:`0`,max:`1`,step:`0.05`,value:f,onChange:e=>l?.onOpacityChange?.(Number(e.target.value)),onPointerDown:o,onPointerUp:s,className:a})]})})]})},O=24,k=96,ee=()=>{if(typeof navigator>`u`)return!1;let e=navigator.userAgent,t=/iPad|iPhone|iPod/i.test(e)||navigator.platform===`MacIntel`&&navigator.maxTouchPoints>1,n=/WebKit/i.test(e),r=/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser|GSA/i.test(e);return t&&n&&!r},te=e=>new Promise(t=>{if(typeof document>`u`){t(null);return}let n=new Image;n.crossOrigin=`anonymous`,n.decoding=`async`,n.onload=()=>{try{let e=document.createElement(`canvas`),r=document.createElement(`canvas`);e.width=O,e.height=O,r.width=k,r.height=k;let i=e.getContext(`2d`),a=r.getContext(`2d`);if(!i||!a){t(null);return}let o=n.naturalWidth||n.width,s=n.naturalHeight||n.height,c=Math.min(o,s),l=Math.max(0,(o-c)/2),u=Math.max(0,(s-c)/2);i.imageSmoothingEnabled=!0,i.imageSmoothingQuality=`high`,i.drawImage(n,l,u,c,c,0,0,O,O),a.imageSmoothingEnabled=!0,a.imageSmoothingQuality=`high`,a.globalAlpha=1,a.drawImage(e,0,0,O,O,0,0,k,k),[{x:-8,y:-8,size:112,alpha:.22},{x:6,y:0,size:k,alpha:.14},{x:0,y:6,size:k,alpha:.14}].forEach(({x:t,y:n,size:r,alpha:i})=>{a.globalAlpha=i,a.drawImage(e,0,0,O,O,t,n,r,r)}),a.globalAlpha=1,t(r.toDataURL(`image/jpeg`,.72))}catch(e){console.warn(`[FluidBackground] Failed to build soft focus cover`,e),t(null)}},n.onerror=()=>t(null),n.src=e}),ne=384,re=(e,t)=>new Promise(n=>{if(typeof document>`u`){n(null);return}let r=new Image;r.crossOrigin=`anonymous`,r.decoding=`async`,r.onload=()=>{try{let e=r.naturalWidth||r.width,i=r.naturalHeight||r.height;if(!e||!i){n(null);return}let a=Math.min(1,t/Math.max(e,i)),o=Math.max(1,Math.round(e*a)),s=Math.max(1,Math.round(i*a)),c=document.createElement(`canvas`);c.width=o,c.height=s;let l=c.getContext(`2d`);if(!l){n(null);return}l.imageSmoothingEnabled=!0,l.imageSmoothingQuality=`high`,l.drawImage(r,0,0,o,s),n(c.toDataURL(`image/jpeg`,.82))}catch(e){console.warn(`[FluidBackground] Failed to downscale cover`,e),n(null)}},r.onerror=()=>n(null),r.src=e}),ie=(0,b.memo)(({coverUrl:e,theme:t})=>{let n=(0,b.useMemo)(ee,[]),[r,i]=(0,b.useState)(null);(0,b.useEffect)(()=>{let t=!1;return!n||!e?(i(null),()=>{t=!0}):(i(null),te(e).then(e=>{t||i(e)}),()=>{t=!0})},[e,n]);let a=(0,b.useRef)(0),[o,s]=(0,b.useState)([]),[c,u]=(0,b.useState)(()=>new Set);(0,b.useEffect)(()=>{if(n)return;if(!e){s([]);return}let t=!1;return re(e,ne).then(n=>{if(t)return;let r=n??e;s(t=>{let n=t[t.length-1];return n&&n.sourceCover===e?t:(a.current+=1,[...n?[n]:[],{url:r,sourceCover:e,key:a.current}])})}),()=>{t=!0}},[e,n]);let d=(0,b.useCallback)(e=>{u(t=>t.has(e)?t:new Set(t).add(e))},[]),f=n?r??e??null:null,p=n&&!!r,m=(0,b.useMemo)(()=>n?{transform:`scale(${p?1.28:1.2}) translateZ(0)`,opacity:p?.94:.3,willChange:`transform, opacity`,backfaceVisibility:`hidden`,WebkitBackfaceVisibility:`hidden`}:{filter:`blur(40px)`,transform:`scale(1.5) translateZ(0)`,opacity:1,willChange:`transform, opacity, filter`,backfaceVisibility:`hidden`,WebkitBackfaceVisibility:`hidden`},[n,p]);return(0,x.jsxs)(`div`,{className:`absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0`,style:{isolation:`isolate`,contain:`paint`,transform:`translateZ(0)`},children:[e?(0,x.jsxs)(x.Fragment,{children:[n?(0,x.jsx)(`img`,{src:f??e,alt:``,"aria-hidden":`true`,draggable:!1,decoding:`async`,className:`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out`,style:m}):o.map((e,t)=>{let n=t===o.length-1,r=c.has(e.key);return(0,x.jsx)(l.div,{className:`absolute inset-0 w-full h-full`,style:{willChange:`opacity`},initial:{opacity:+!n},animate:{opacity:n&&!r?0:1},transition:{duration:1.5,ease:`easeInOut`},onAnimationComplete:()=>{n&&r&&(s(t=>t.filter(t=>t.key===e.key)),u(t=>t.has(e.key)?new Set([e.key]):t))},children:(0,x.jsx)(`img`,{src:e.url,alt:``,"aria-hidden":`true`,draggable:!1,decoding:`async`,className:`absolute inset-0 w-full h-full object-cover`,style:m,ref:t=>{t&&!c.has(e.key)&&t.decode().then(()=>requestAnimationFrame(()=>d(e.key))).catch(()=>d(e.key))},onError:()=>{s(t=>t.length>1?t.filter(t=>t.key!==e.key):t)}})},e.key)}),n&&(0,x.jsxs)(x.Fragment,{children:[!p&&(0,x.jsx)(`img`,{src:e,alt:``,"aria-hidden":`true`,draggable:!1,decoding:`async`,className:`absolute inset-0 w-full h-full object-cover`,style:{transform:`scale(1.36) translateZ(0)`,opacity:.12,willChange:`transform, opacity`,backfaceVisibility:`hidden`,WebkitBackfaceVisibility:`hidden`}}),(0,x.jsx)(`div`,{className:`absolute inset-0 w-full h-full`,style:{backgroundColor:t.backgroundColor,opacity:.28}}),(0,x.jsx)(`div`,{className:`absolute inset-0 w-full h-full`,style:{background:`radial-gradient(circle at 20% 20%, ${t.accentColor}55 0%, transparent 42%), radial-gradient(circle at 80% 28%, ${t.secondaryColor}50 0%, transparent 44%), radial-gradient(circle at 50% 78%, ${t.primaryColor}28 0%, transparent 52%)`,opacity:p?.52:.7}})]})]}):(0,x.jsx)(`div`,{className:`absolute inset-0 w-full h-full transition-colors duration-1000`,style:{backgroundColor:t.backgroundColor,opacity:.8}}),(0,x.jsx)(`div`,{className:`absolute inset-0 w-full h-full`,style:{background:`linear-gradient(to bottom right, ${t.primaryColor}, transparent, ${t.secondaryColor})`,opacity:n?.2:.4,mixBlendMode:n?`normal`:`overlay`}})]})},(e,t)=>{if(e.coverUrl!==t.coverUrl)return!1;let n=e.theme,r=t.theme;return n.backgroundColor===r.backgroundColor&&n.primaryColor===r.primaryColor&&n.secondaryColor===r.secondaryColor}),ae=b.lazy(()=>y(()=>import(`./GeometricBackground-Bmfdad4M.js`),__vite__mapDeps([0,1]),import.meta.url)),oe=S({mode:`common`,order:10,labelKey:`options.visualizerBackgroundModeCommon`,labelFallback:`Common`,render:({config:e,theme:t,coverUrl:n,audioPower:r,audioBands:i,seed:a,staticMode:o,paused:s})=>{let c=e?.common,u=c?.useCoverColorBg??!1;return(0,x.jsxs)(x.Fragment,{children:[u&&(0,x.jsx)(l.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:1},className:`absolute inset-0 z-0`,children:(0,x.jsx)(ie,{coverUrl:n,theme:t})},`fluid-bg`),(0,x.jsx)(`div`,{className:`absolute inset-0 z-0 transition-all duration-1000`,style:{backgroundColor:t.backgroundColor,opacity:u?c?.opacity??.75:1}}),!o&&(0,x.jsx)(`div`,{className:`absolute inset-0 z-0`,children:(0,x.jsx)(b.Suspense,{fallback:null,children:(0,x.jsx)(ae,{theme:t,audioPower:r,audioBands:i,seed:a,hideShapes:c?.disableGeometricBackground??!1,disableVignette:c?.disableVignette??!1,paused:s})})})]})},renderSettingsPanel:e=>(0,x.jsx)(D,{...e}),renderQuickControls:({config:e,actions:t,t:n,theme:r})=>{let i=e?.common?.useCoverColorBg??!1;return(0,x.jsx)(w,{active:i,theme:r,label:n(i?`theme.addCoverColor`:`theme.useDefaultColor`),onToggle:()=>t?.common?.onCoverColorChange?.(!i),children:(0,x.jsx)(m,{size:14})})},resetSettings:e=>{e?.common?.onOpacityChange?.(.75),e?.common?.onCoverColorChange?.(!1),e?.common?.onDisableVignetteChange?.(!1),e?.common?.onDisableGeometricChange?.(!1)}}),se=`#version 300 es
precision mediump float;

layout(location = 0) in vec4 a_position;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_imageAspectRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

out vec2 v_objectUV;
out vec2 v_objectBoxSize;
out vec2 v_responsiveUV;
out vec2 v_responsiveBoxGivenSize;
out vec2 v_patternUV;
out vec2 v_patternBoxSize;
out vec2 v_imageUV;

vec3 getBoxSize(float boxRatio, vec2 givenBoxSize) {
  vec2 box = vec2(0.);
  // fit = none
  box.x = boxRatio * min(givenBoxSize.x / boxRatio, givenBoxSize.y);
  float noFitBoxWidth = box.x;
  if (u_fit == 1.) { // fit = contain
    box.x = boxRatio * min(u_resolution.x / boxRatio, u_resolution.y);
  } else if (u_fit == 2.) { // fit = cover
    box.x = boxRatio * max(u_resolution.x / boxRatio, u_resolution.y);
  }
  box.y = box.x / boxRatio;
  return vec3(box, noFitBoxWidth);
}

void main() {
  gl_Position = a_position;

  vec2 uv = gl_Position.xy * .5;
  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * 3.14159265358979323846 / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);


  // ===================================================

  float fixedRatio = 1.;
  vec2 fixedRatioBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );

  v_objectBoxSize = getBoxSize(fixedRatio, fixedRatioBoxGivenSize).xy;
  vec2 objectWorldScale = u_resolution.xy / v_objectBoxSize;

  v_objectUV = uv;
  v_objectUV *= objectWorldScale;
  v_objectUV += boxOrigin * (objectWorldScale - 1.);
  v_objectUV += graphicOffset;
  v_objectUV /= u_scale;
  v_objectUV = graphicRotation * v_objectUV;

  // ===================================================

  v_responsiveBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  float responsiveRatio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
  vec2 responsiveBoxSize = getBoxSize(responsiveRatio, v_responsiveBoxGivenSize).xy;
  vec2 responsiveBoxScale = u_resolution.xy / responsiveBoxSize;

  #ifdef ADD_HELPERS
  v_responsiveHelperBox = uv;
  v_responsiveHelperBox *= responsiveBoxScale;
  v_responsiveHelperBox += boxOrigin * (responsiveBoxScale - 1.);
  #endif

  v_responsiveUV = uv;
  v_responsiveUV *= responsiveBoxScale;
  v_responsiveUV += boxOrigin * (responsiveBoxScale - 1.);
  v_responsiveUV += graphicOffset;
  v_responsiveUV /= u_scale;
  v_responsiveUV.x *= responsiveRatio;
  v_responsiveUV = graphicRotation * v_responsiveUV;
  v_responsiveUV.x /= responsiveRatio;

  // ===================================================

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 patternBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  patternBoxRatio = patternBoxGivenSize.x / patternBoxGivenSize.y;

  vec3 boxSizeData = getBoxSize(patternBoxRatio, patternBoxGivenSize);
  v_patternBoxSize = boxSizeData.xy;
  float patternBoxNoFitBoxWidth = boxSizeData.z;
  vec2 patternBoxScale = u_resolution.xy / v_patternBoxSize;

  v_patternUV = uv;
  v_patternUV += graphicOffset / patternBoxScale;
  v_patternUV += boxOrigin;
  v_patternUV -= boxOrigin / patternBoxScale;
  v_patternUV *= u_resolution.xy;
  v_patternUV /= u_pixelRatio;
  if (u_fit > 0.) {
    v_patternUV *= (patternBoxNoFitBoxWidth / v_patternBoxSize.x);
  }
  v_patternUV /= u_scale;
  v_patternUV = graphicRotation * v_patternUV;
  v_patternUV += boxOrigin / patternBoxScale;
  v_patternUV -= boxOrigin;
  // x100 is a default multiplier between vertex and fragmant shaders
  // we use it to avoid UV presision issues
  v_patternUV *= .01;

  // ===================================================

  vec2 imageBoxSize;
  if (u_fit == 1.) { // contain
    imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else if (u_fit == 2.) { // cover
    imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else {
    imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
  }
  imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
  vec2 imageBoxScale = u_resolution.xy / imageBoxSize;

  v_imageUV = uv;
  v_imageUV *= imageBoxScale;
  v_imageUV += boxOrigin * (imageBoxScale - 1.);
  v_imageUV += graphicOffset;
  v_imageUV /= u_scale;
  v_imageUV.x *= u_imageAspectRatio;
  v_imageUV = graphicRotation * v_imageUV;
  v_imageUV.x /= u_imageAspectRatio;

  v_imageUV += .5;
  v_imageUV.y = 1. - v_imageUV.y;
}`,ce=8294400,le=class{parentElement;canvasElement;gl;program=null;uniformLocations={};fragmentShader;rafId=null;lastRenderTime=0;currentFrame=0;speed=0;currentSpeed=0;providedUniforms;mipmaps=[];hasBeenDisposed=!1;resolutionChanged=!0;textures=new Map;minPixelRatio;maxPixelCount;isSafari=pe();uniformCache={};textureUnitMap=new Map;ownerDocument;constructor(e,t,n,r,i=0,a=0,o=2,s=ce,c=[]){if(e?.nodeType===1)this.parentElement=e;else throw Error(`Paper Shaders: parent element must be an HTMLElement`);if(this.ownerDocument=e.ownerDocument,!this.ownerDocument.querySelector(`style[data-paper-shader]`)){let e=this.ownerDocument.createElement(`style`);e.innerHTML=fe,e.setAttribute(`data-paper-shader`,``),this.ownerDocument.head.prepend(e)}let l=this.ownerDocument.createElement(`canvas`);this.canvasElement=l,this.parentElement.prepend(l),this.fragmentShader=t,this.providedUniforms=n,this.mipmaps=c,this.currentFrame=a,this.minPixelRatio=o,this.maxPixelCount=s;let u=l.getContext(`webgl2`,r);if(!u)throw Error(`Paper Shaders: WebGL is not supported in this browser`);this.gl=u,this.initProgram(),this.setupPositionAttribute(),this.setupUniforms(),this.setUniformValues(this.providedUniforms),this.setupResizeObserver(),visualViewport?.addEventListener(`resize`,this.handleVisualViewportChange),this.setupIntersectionObserver(),this.setSpeed(i),this.parentElement.setAttribute(`data-paper-shader`,``),this.parentElement.paperShaderMount=this,this.ownerDocument.addEventListener(`visibilitychange`,this.handleDocumentVisibilityChange)}initProgram=()=>{let e=de(this.gl,se,this.fragmentShader);e&&(this.program=e)};setupPositionAttribute=()=>{let e=this.gl.getAttribLocation(this.program,`a_position`),t=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,t),this.gl.bufferData(this.gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),this.gl.STATIC_DRAW),this.gl.enableVertexAttribArray(e),this.gl.vertexAttribPointer(e,2,this.gl.FLOAT,!1,0,0)};setupUniforms=()=>{let e={u_time:this.gl.getUniformLocation(this.program,`u_time`),u_pixelRatio:this.gl.getUniformLocation(this.program,`u_pixelRatio`),u_resolution:this.gl.getUniformLocation(this.program,`u_resolution`)};Object.entries(this.providedUniforms).forEach(([t,n])=>{if(e[t]=this.gl.getUniformLocation(this.program,t),n instanceof HTMLImageElement){let n=`${t}AspectRatio`;e[n]=this.gl.getUniformLocation(this.program,n)}}),this.uniformLocations=e};renderScale=1;parentWidth=0;parentHeight=0;parentDevicePixelWidth=0;parentDevicePixelHeight=0;devicePixelsSupported=!1;intersectionObserver=null;isInViewport=!0;resizeObserver=null;setupResizeObserver=()=>{this.resizeObserver=new ResizeObserver(([e])=>{if(e?.borderBoxSize[0]){let t=e.devicePixelContentBoxSize?.[0];t!==void 0&&(this.devicePixelsSupported=!0,this.parentDevicePixelWidth=t.inlineSize,this.parentDevicePixelHeight=t.blockSize),this.parentWidth=e.borderBoxSize[0].inlineSize,this.parentHeight=e.borderBoxSize[0].blockSize}this.handleResize()}),this.resizeObserver.observe(this.parentElement)};setupIntersectionObserver=()=>{let e=this.ownerDocument.defaultView;e?.IntersectionObserver&&(this.intersectionObserver=new e.IntersectionObserver(([e])=>{this.isInViewport=e?.isIntersecting??!0,this.updateCurrentSpeed()}),this.intersectionObserver.observe(this.parentElement))};handleVisualViewportChange=()=>{this.resizeObserver?.disconnect(),this.setupResizeObserver()};handleResize=()=>{let e=0,t=0,n=Math.max(1,window.devicePixelRatio),r=visualViewport?.scale??1;if(this.devicePixelsSupported){let i=Math.max(1,this.minPixelRatio/n);e=this.parentDevicePixelWidth*i*r,t=this.parentDevicePixelHeight*i*r}else{let i=Math.max(n,this.minPixelRatio)*r;if(this.isSafari){let e=me(this.ownerDocument);i*=Math.max(1,e)}e=Math.round(this.parentWidth)*i,t=Math.round(this.parentHeight)*i}let i=Math.sqrt(this.maxPixelCount)/Math.sqrt(e*t),a=Math.min(1,i),o=Math.round(e*a),s=Math.round(t*a),c=o/Math.round(this.parentWidth);(this.canvasElement.width!==o||this.canvasElement.height!==s||this.renderScale!==c)&&(this.renderScale=c,this.canvasElement.width=o,this.canvasElement.height=s,this.resolutionChanged=!0,this.gl.viewport(0,0,this.gl.canvas.width,this.gl.canvas.height),this.render(performance.now()))};render=e=>{if(this.hasBeenDisposed)return;if(this.program===null){console.warn(`Tried to render before program or gl was initialized`);return}let t=e-this.lastRenderTime;this.lastRenderTime=e,this.currentSpeed!==0&&(this.currentFrame+=t*this.currentSpeed),this.gl.clear(this.gl.COLOR_BUFFER_BIT),this.gl.useProgram(this.program),this.gl.uniform1f(this.uniformLocations.u_time,this.currentFrame*.001),this.resolutionChanged&&=(this.gl.uniform2f(this.uniformLocations.u_resolution,this.gl.canvas.width,this.gl.canvas.height),this.gl.uniform1f(this.uniformLocations.u_pixelRatio,this.renderScale),!1),this.gl.drawArrays(this.gl.TRIANGLES,0,6),this.currentSpeed===0?this.rafId=null:this.requestRender()};requestRender=()=>{this.rafId!==null&&cancelAnimationFrame(this.rafId),this.rafId=requestAnimationFrame(this.render)};setTextureUniform=(e,t)=>{if(!t.complete||t.naturalWidth===0)throw Error(`Paper Shaders: image for uniform ${e} must be fully loaded`);let n=this.textures.get(e);n&&this.gl.deleteTexture(n),this.textureUnitMap.has(e)||this.textureUnitMap.set(e,this.textureUnitMap.size);let r=this.textureUnitMap.get(e);this.gl.activeTexture(this.gl.TEXTURE0+r);let i=this.gl.createTexture();this.gl.bindTexture(this.gl.TEXTURE_2D,i),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_S,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_T,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MAG_FILTER,this.gl.LINEAR),this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,t),this.mipmaps.includes(e)&&(this.gl.generateMipmap(this.gl.TEXTURE_2D),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR_MIPMAP_LINEAR));let a=this.gl.getError();if(a!==this.gl.NO_ERROR||i===null){console.error(`Paper Shaders: WebGL error when uploading texture:`,a);return}this.textures.set(e,i);let o=this.uniformLocations[e];if(o){this.gl.uniform1i(o,r);let n=`${e}AspectRatio`,i=this.uniformLocations[n];if(i){let e=t.naturalWidth/t.naturalHeight;this.gl.uniform1f(i,e)}}};areUniformValuesEqual=(e,t)=>e===t?!0:Array.isArray(e)&&Array.isArray(t)&&e.length===t.length?e.every((e,n)=>this.areUniformValuesEqual(e,t[n])):!1;setUniformValues=e=>{this.gl.useProgram(this.program),Object.entries(e).forEach(([e,t])=>{let n=t;if(t instanceof HTMLImageElement&&(n=`${t.src.slice(0,200)}|${t.naturalWidth}x${t.naturalHeight}`),this.areUniformValuesEqual(this.uniformCache[e],n))return;this.uniformCache[e]=n;let r=this.uniformLocations[e];if(!r)console.warn(`Uniform location for ${e} not found`);else if(t instanceof HTMLImageElement)this.setTextureUniform(e,t);else if(Array.isArray(t)){let n=null,i=null;if(t[0]!==void 0&&Array.isArray(t[0])){let r=t[0].length;if(t.every(e=>e.length===r))n=t.flat(),i=r;else{console.warn(`All child arrays must be the same length for ${e}`);return}}else n=t,i=n.length;switch(i){case 2:this.gl.uniform2fv(r,n);break;case 3:this.gl.uniform3fv(r,n);break;case 4:this.gl.uniform4fv(r,n);break;case 9:this.gl.uniformMatrix3fv(r,!1,n);break;case 16:this.gl.uniformMatrix4fv(r,!1,n);break;default:console.warn(`Unsupported uniform array length: ${i}`)}}else typeof t==`number`?this.gl.uniform1f(r,t):typeof t==`boolean`?this.gl.uniform1i(r,+!!t):console.warn(`Unsupported uniform type for ${e}: ${typeof t}`)})};getCurrentFrame=()=>this.currentFrame;setFrame=e=>{this.currentFrame=e,this.lastRenderTime=performance.now(),this.render(performance.now())};setSpeed=(e=1)=>{this.speed=e,this.updateCurrentSpeed()};updateCurrentSpeed=()=>{this.setCurrentSpeed(this.ownerDocument.hidden||!this.isInViewport?0:this.speed)};setCurrentSpeed=e=>{this.currentSpeed=e,this.rafId===null&&e!==0&&(this.lastRenderTime=performance.now(),this.rafId=requestAnimationFrame(this.render)),this.rafId!==null&&e===0&&(cancelAnimationFrame(this.rafId),this.rafId=null)};setMaxPixelCount=(e=ce)=>{this.maxPixelCount=e,this.handleResize()};setMinPixelRatio=(e=2)=>{this.minPixelRatio=e,this.handleResize()};setUniforms=e=>{this.setUniformValues(e),this.providedUniforms={...this.providedUniforms,...e},this.render(performance.now())};handleDocumentVisibilityChange=()=>{this.updateCurrentSpeed()};dispose=()=>{this.hasBeenDisposed=!0,this.rafId!==null&&(cancelAnimationFrame(this.rafId),this.rafId=null),this.gl&&this.program&&(this.textures.forEach(e=>{this.gl.deleteTexture(e)}),this.textures.clear(),this.gl.deleteProgram(this.program),this.program=null,this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null),this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,null),this.gl.bindRenderbuffer(this.gl.RENDERBUFFER,null),this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null),this.gl.getError()),this.resizeObserver&&=(this.resizeObserver.disconnect(),null),this.intersectionObserver&&=(this.intersectionObserver.disconnect(),null),visualViewport?.removeEventListener(`resize`,this.handleVisualViewportChange),this.ownerDocument.removeEventListener(`visibilitychange`,this.handleDocumentVisibilityChange),this.uniformLocations={},this.canvasElement.remove(),delete this.parentElement.paperShaderMount}};function ue(e,t,n){let r=e.createShader(t);return r?(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(console.error(`An error occurred compiling the shaders: `+e.getShaderInfoLog(r)),e.deleteShader(r),null)):null}function de(e,t,n){let r=e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT),i=r?r.precision:null;i&&i<23&&(t=t.replace(/precision\s+(lowp|mediump)\s+float;/g,`precision highp float;`),n=n.replace(/precision\s+(lowp|mediump)\s+float/g,`precision highp float`).replace(/\b(uniform|varying|attribute)\s+(lowp|mediump)\s+(\w+)/g,`$1 highp $3`));let a=ue(e,e.VERTEX_SHADER,t),o=ue(e,e.FRAGMENT_SHADER,n);if(!a||!o)return null;let s=e.createProgram();return s?(e.attachShader(s,a),e.attachShader(s,o),e.linkProgram(s),e.getProgramParameter(s,e.LINK_STATUS)?(e.detachShader(s,a),e.detachShader(s,o),e.deleteShader(a),e.deleteShader(o),s):(console.error(`Unable to initialize the shader program: `+e.getProgramInfoLog(s)),e.deleteProgram(s),e.deleteShader(a),e.deleteShader(o),null)):null}var fe=`@layer paper-shaders {
  :where([data-paper-shader]) {
    isolation: isolate;
    position: relative;

    & canvas {
      contain: strict;
      display: block;
      position: absolute;
      inset: 0;
      z-index: -1;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      corner-shape: inherit;
    }
  }
}`;function pe(){let e=navigator.userAgent.toLowerCase();return e.includes(`safari`)&&!e.includes(`chrome`)&&!e.includes(`android`)}function me(e){let t=visualViewport?.scale??1,n=visualViewport?.width??window.innerWidth,r=window.innerWidth-e.documentElement.clientWidth,i=t*n+r,a=outerWidth/i,o=Math.round(100*a);return o%5==0?o/100:o===33?1/3:o===67?2/3:o===133?4/3:a}var A={fit:`contain`,scale:1,rotation:0,offsetX:0,offsetY:0,originX:.5,originY:.5,worldWidth:0,worldHeight:0},he={fit:`none`,scale:1,rotation:0,offsetX:0,offsetY:0,originX:.5,originY:.5,worldWidth:0,worldHeight:0},ge={none:0,contain:1,cover:2},_e=`
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846
`,ve=`
vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}
`,ye=`
  float hash11(float p) {
    p = fract(p * 0.3183099) + 0.1;
    p *= p + 19.19;
    return fract(p * p);
  }
`,be=`
  float hash21(vec2 p) {
    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }
`,xe=`
  float randomR(vec2 p) {
    vec2 uv = floor(p) / 100. + .5;
    return texture(u_noiseTexture, fract(uv)).r;
  }
`,Se=`
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`,Ce=`
float fiberRandom(vec2 p) {
  vec2 uv = floor(p) / 100.;
  return texture(u_noiseTexture, fract(uv)).b;
}

float fiberValueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = fiberRandom(i);
  float b = fiberRandom(i + vec2(1.0, 0.0));
  float c = fiberRandom(i + vec2(0.0, 1.0));
  float d = fiberRandom(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float fiberNoiseFbm(in vec2 n, vec2 seedOffset) {
  float total = 0.0, amplitude = 1.;
  for (int i = 0; i < 4; i++) {
    n = rotate(n, .7);
    total += fiberValueNoise(n + seedOffset) * amplitude;
    n *= 2.;
    amplitude *= 0.6;
  }
  return total;
}

float fiberNoise(vec2 uv, vec2 seedOffset) {
  float epsilon = 0.001;
  float n1 = fiberNoiseFbm(uv + vec2(epsilon, 0.0), seedOffset);
  float n2 = fiberNoiseFbm(uv - vec2(epsilon, 0.0), seedOffset);
  float n3 = fiberNoiseFbm(uv + vec2(0.0, epsilon), seedOffset);
  float n4 = fiberNoiseFbm(uv - vec2(0.0, epsilon), seedOffset);
  return length(vec2(n1 - n2, n3 - n4)) / (2.0 * epsilon);
}
`,we={maxColorCount:10},Te=`#version 300 es
precision mediump float;

uniform float u_time;

uniform vec4 u_colors[${we.maxColorCount}];
uniform float u_colorsCount;

uniform float u_distortion;
uniform float u_swirl;
uniform float u_grainMixer;
uniform float u_grainOverlay;

in vec2 v_objectUV;
out vec4 fragColor;

${_e}
${ve}
${be}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float noise(vec2 n, vec2 seedOffset) {
  return valueNoise(n + seedOffset);
}

vec2 getPosition(int i, float t) {
  float a = float(i) * .37;
  float b = .6 + fract(float(i) / 3.) * .9;
  float c = .8 + fract(float(i + 1) / 4.);

  float x = sin(t * b + a);
  float y = cos(t * c + a * 1.5);

  return .5 + .5 * vec2(x, y);
}

void main() {
  vec2 uv = v_objectUV;
  uv += .5;
  vec2 grainUV = uv * 1000.;

  float grain = noise(grainUV, vec2(0.));
  float mixerGrain = .4 * u_grainMixer * (grain - .5);

  const float firstFrameOffset = 41.5;
  float t = .5 * (u_time + firstFrameOffset);

  float radius = smoothstep(0., 1., length(uv - .5));
  float center = 1. - radius;
  for (float i = 1.; i <= 2.; i++) {
    uv.x += u_distortion * center / i * sin(t + i * .4 * smoothstep(.0, 1., uv.y)) * cos(.2 * t + i * 2.4 * smoothstep(.0, 1., uv.y));
    uv.y += u_distortion * center / i * cos(t + i * 2. * smoothstep(.0, 1., uv.x));
  }

  vec2 uvRotated = uv;
  uvRotated -= vec2(.5);
  float angle = 3. * u_swirl * radius;
  uvRotated = rotate(uvRotated, -angle);
  uvRotated += vec2(.5);

  vec3 color = vec3(0.);
  float opacity = 0.;
  float totalWeight = 0.;

  for (int i = 0; i < ${we.maxColorCount}; i++) {
    if (i >= int(u_colorsCount)) break;

    vec2 pos = getPosition(i, t) + mixerGrain;
    vec3 colorFraction = u_colors[i].rgb * u_colors[i].a;
    float opacityFraction = u_colors[i].a;

    float dist = length(uvRotated - pos);

    dist = pow(dist, 3.5);
    float weight = 1. / (dist + 1e-3);
    color += colorFraction * weight;
    opacity += opacityFraction * weight;
    totalWeight += weight;
  }

  color /= max(1e-4, totalWeight);
  opacity /= max(1e-4, totalWeight);

  float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2. - 1.;
  vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
  float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, .8);
  color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);

  opacity += .5 * grainOverlayStrength;
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`,Ee=`#version 300 es
precision mediump float;

uniform float u_time;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

uniform float u_pxSize;
uniform vec4 u_colorBack;
uniform vec4 u_colorFront;
uniform float u_shape;
uniform float u_type;

out vec4 fragColor;

${Se}
${_e}
${ye}
${be}

float getSimplexNoise(vec2 uv, float t) {
  float noise = .5 * snoise(uv - vec2(0., .3 * t));
  noise += .5 * snoise(2. * uv + vec2(0., .32 * t));

  return noise;
}

const int bayer2x2[4] = int[4](0, 2, 3, 1);
const int bayer4x4[16] = int[16](
0, 8, 2, 10,
12, 4, 14, 6,
3, 11, 1, 9,
15, 7, 13, 5
);

const int bayer8x8[64] = int[64](
0, 32, 8, 40, 2, 34, 10, 42,
48, 16, 56, 24, 50, 18, 58, 26,
12, 44, 4, 36, 14, 46, 6, 38,
60, 28, 52, 20, 62, 30, 54, 22,
3, 35, 11, 43, 1, 33, 9, 41,
51, 19, 59, 27, 49, 17, 57, 25,
15, 47, 7, 39, 13, 45, 5, 37,
63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
  int index = pos.y * size + pos.x;

  if (size == 2) {
    return float(bayer2x2[index]) / 4.0;
  } else if (size == 4) {
    return float(bayer4x4[index]) / 16.0;
  } else if (size == 8) {
    return float(bayer8x8[index]) / 64.0;
  }
  return 0.0;
}


void main() {
  float t = .5 * u_time;

  float pxSize = u_pxSize * u_pixelRatio;
  vec2 pxSizeUV = gl_FragCoord.xy - .5 * u_resolution;
  pxSizeUV /= pxSize;
  vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
  vec2 normalizedUV = canvasPixelizedUV / u_resolution;

  vec2 ditheringNoiseUV = canvasPixelizedUV;
  vec2 shapeUV = normalizedUV;

  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * PI / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 boxSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  
  if (u_shape > 3.5) {
    vec2 objectBoxSize = vec2(0.);
    // fit = none
    objectBoxSize.x = min(boxSize.x, boxSize.y);
    if (u_fit == 1.) { // fit = contain
      objectBoxSize.x = min(u_resolution.x, u_resolution.y);
    } else if (u_fit == 2.) { // fit = cover
      objectBoxSize.x = max(u_resolution.x, u_resolution.y);
    }
    objectBoxSize.y = objectBoxSize.x;
    vec2 objectWorldScale = u_resolution.xy / objectBoxSize;

    shapeUV *= objectWorldScale;
    shapeUV += boxOrigin * (objectWorldScale - 1.);
    shapeUV += vec2(-u_offsetX, u_offsetY);
    shapeUV /= u_scale;
    shapeUV = graphicRotation * shapeUV;
  } else {
    vec2 patternBoxSize = vec2(0.);
    // fit = none
    patternBoxSize.x = patternBoxRatio * min(boxSize.x / patternBoxRatio, boxSize.y);
    float patternWorldNoFitBoxWidth = patternBoxSize.x;
    if (u_fit == 1.) { // fit = contain
      patternBoxSize.x = patternBoxRatio * min(u_resolution.x / patternBoxRatio, u_resolution.y);
    } else if (u_fit == 2.) { // fit = cover
      patternBoxSize.x = patternBoxRatio * max(u_resolution.x / patternBoxRatio, u_resolution.y);
    }
    patternBoxSize.y = patternBoxSize.x / patternBoxRatio;
    vec2 patternWorldScale = u_resolution.xy / patternBoxSize;

    shapeUV += vec2(-u_offsetX, u_offsetY) / patternWorldScale;
    shapeUV += boxOrigin;
    shapeUV -= boxOrigin / patternWorldScale;
    shapeUV *= u_resolution.xy;
    shapeUV /= u_pixelRatio;
    if (u_fit > 0.) {
      shapeUV *= (patternWorldNoFitBoxWidth / patternBoxSize.x);
    }
    shapeUV /= u_scale;
    shapeUV = graphicRotation * shapeUV;
    shapeUV += boxOrigin / patternWorldScale;
    shapeUV -= boxOrigin;
    shapeUV += .5;
  }

  float shape = 0.;
  if (u_shape < 1.5) {
    // Simplex noise
    shapeUV *= .001;

    shape = 0.5 + 0.5 * getSimplexNoise(shapeUV, t);
    shape = smoothstep(0.3, 0.9, shape);

  } else if (u_shape < 2.5) {
    // Warp
    shapeUV *= .003;

    for (float i = 1.0; i < 6.0; i++) {
      shapeUV.x += 0.6 / i * cos(i * 2.5 * shapeUV.y + t);
      shapeUV.y += 0.6 / i * cos(i * 1.5 * shapeUV.x + t);
    }

    shape = .15 / max(0.001, abs(sin(t - shapeUV.y - shapeUV.x)));
    shape = smoothstep(0.02, 1., shape);

  } else if (u_shape < 3.5) {
    // Dots
    shapeUV *= .05;

    float stripeIdx = floor(2. * shapeUV.x / TWO_PI);
    float rand = hash11(stripeIdx * 10.);
    rand = sign(rand - .5) * pow(.1 + abs(rand), .4);
    shape = sin(shapeUV.x) * cos(shapeUV.y - 5. * rand * t);
    shape = pow(abs(shape), 6.);

  } else if (u_shape < 4.5) {
    // Sine wave
    shapeUV *= 4.;

    float wave = cos(.5 * shapeUV.x - 2. * t) * sin(1.5 * shapeUV.x + t) * (.75 + .25 * cos(3. * t));
    shape = 1. - smoothstep(-1., 1., shapeUV.y + wave);

  } else if (u_shape < 5.5) {
    // Ripple

    float dist = length(shapeUV);
    float waves = sin(pow(dist, 1.7) * 7. - 3. * t) * .5 + .5;
    shape = waves;

  } else if (u_shape < 6.5) {
    // Swirl

    float l = length(shapeUV);
    float angle = 6. * atan(shapeUV.y, shapeUV.x) + 4. * t;
    float twist = 1.2;
    float offset = 1. / pow(max(l, 1e-6), twist) + angle / TWO_PI;
    float mid = smoothstep(0., 1., pow(l, twist));
    shape = mix(0., fract(offset), mid);

  } else {
    // Sphere
    shapeUV *= 2.;

    float d = 1. - pow(length(shapeUV), 2.);
    vec3 pos = vec3(shapeUV, sqrt(max(0., d)));
    vec3 lightPos = normalize(vec3(cos(1.5 * t), .8, sin(1.25 * t)));
    shape = .5 + .5 * dot(lightPos, pos);
    shape *= step(0., d);
  }


  int type = int(floor(u_type));
  float dithering = 0.0;

  switch (type) {
    case 1: {
      dithering = step(hash21(ditheringNoiseUV), shape);
    } break;
    case 2:
    dithering = getBayerValue(pxSizeUV, 2);
    break;
    case 3:
    dithering = getBayerValue(pxSizeUV, 4);
    break;
    default :
    dithering = getBayerValue(pxSizeUV, 8);
    break;
  }

  dithering -= .5;
  float res = step(.5, shape + dithering);

  vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
  float fgOpacity = u_colorFront.a;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  float bgOpacity = u_colorBack.a;

  vec3 color = fgColor * res;
  float opacity = fgOpacity * res;

  color += bgColor * (1. - opacity);
  opacity += bgOpacity * (1. - opacity);

  fragColor = vec4(color, opacity);
}
`,De={simplex:1,warp:2,dots:3,wave:4,ripple:5,swirl:6,sphere:7},Oe={random:1,"2x2":2,"4x4":3,"8x8":4},ke=`#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;

uniform vec4 u_colorFront;
uniform vec4 u_colorBack;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform float u_contrast;
uniform float u_roughness;
uniform float u_fiber;
uniform float u_fiberSize;
uniform float u_crumples;
uniform float u_crumpleSize;
uniform float u_folds;
uniform float u_foldCount;
uniform float u_drops;
uniform float u_seed;
uniform float u_fade;

uniform sampler2D u_noiseTexture;

in vec2 v_imageUV;

out vec4 fragColor;

float getUvFrame(vec2 uv) {
  float aax = 2. * fwidth(uv.x);
  float aay = 2. * fwidth(uv.y);

  float left   = smoothstep(0., aax, uv.x);
  float right = 1. - smoothstep(1. - aax, 1., uv.x);
  float bottom = smoothstep(0., aay, uv.y);
  float top = 1. - smoothstep(1. - aay, 1., uv.y);

  return left * right * bottom * top;
}

${_e}
${ve}
${xe}
float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = randomR(i);
  float b = randomR(i + vec2(1.0, 0.0));
  float c = randomR(i + vec2(0.0, 1.0));
  float d = randomR(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}
float fbm(vec2 n) {
  float total = 0.0, amplitude = .4;
  for (int i = 0; i < 3; i++) {
    total += valueNoise(n) * amplitude;
    n *= 1.99;
    amplitude *= 0.65;
  }
  return total;
}


float randomG(vec2 p) {
  vec2 uv = floor(p) / 50. + .5;
  return texture(u_noiseTexture, fract(uv)).g;
}
float roughness(vec2 p) {
  p *= .1;
  float o = 0.;
  for (float i = 0.; ++i < 4.; p *= 2.1) {
    vec4 w = vec4(floor(p), ceil(p));
    vec2 f = fract(p);
    o += mix(
    mix(randomG(w.xy), randomG(w.xw), f.y),
    mix(randomG(w.zy), randomG(w.zw), f.y),
    f.x);
    o += .2 / exp(2. * abs(sin(.2 * p.x + .5 * p.y)));
  }
  return o / 3.;
}

${Ce}

vec2 randomGB(vec2 p) {
  vec2 uv = floor(p) / 50. + .5;
  return texture(u_noiseTexture, fract(uv)).gb;
}
float crumpledNoise(vec2 t, float pw) {
  vec2 p = floor(t);
  float wsum = 0.;
  float cl = 0.;
  for (int y = -1; y < 2; y += 1) {
    for (int x = -1; x < 2; x += 1) {
      vec2 b = vec2(float(x), float(y));
      vec2 q = b + p;
      vec2 q2 = q - floor(q / 8.) * 8.;
      vec2 c = q + randomGB(q2);
      vec2 r = c - t;
      float w = pow(smoothstep(0., 1., 1. - abs(r.x)), pw) * pow(smoothstep(0., 1., 1. - abs(r.y)), pw);
      cl += (.5 + .5 * sin((q2.x + q2.y * 5.) * 8.)) * w;
      wsum += w;
    }
  }
  return pow(wsum != 0.0 ? cl / wsum : 0.0, .5) * 2.;
}
float crumplesShape(vec2 uv) {
  return crumpledNoise(uv * .25, 16.) * crumpledNoise(uv * .5, 2.);
}


vec2 folds(vec2 uv) {
  vec3 pp = vec3(0.);
  float l = 9.;
  for (float i = 0.; i < 15.; i++) {
    if (i >= u_foldCount) break;
    vec2 rand = randomGB(vec2(i, i * u_seed));
    float an = rand.x * TWO_PI;
    vec2 p = vec2(cos(an), sin(an)) * rand.y;
    float dist = distance(uv, p);
    l = min(l, dist);

    if (l == dist) {
      pp.xy = (uv - p.xy);
      pp.z = dist;
    }
  }
  return mix(pp.xy, vec2(0.), pow(pp.z, .25));
}

float drops(vec2 uv) {
  vec2 iDropsUV = floor(uv);
  vec2 fDropsUV = fract(uv);
  float dropsMinDist = 1.;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 neighbor = vec2(float(i), float(j));
      vec2 offset = randomGB(iDropsUV + neighbor);
      offset = .5 + .5 * sin(10. * u_seed + TWO_PI * offset);
      vec2 pos = neighbor + offset - fDropsUV;
      float dist = length(pos);
      dropsMinDist = min(dropsMinDist, dropsMinDist*dist);
    }
  }
  return 1. - smoothstep(.05, .09, pow(dropsMinDist, .5));
}

float lst(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

void main() {

  vec2 imageUV = v_imageUV;
  vec2 patternUV = v_imageUV - .5;
  patternUV = 5. * (patternUV * vec2(u_imageAspectRatio, 1.));

  vec2 roughnessUv = 1.5 * (gl_FragCoord.xy - .5 * u_resolution) / u_pixelRatio;
  float roughness = roughness(roughnessUv + vec2(1., 0.)) - roughness(roughnessUv - vec2(1., 0.));

  vec2 crumplesUV = fract(patternUV * .02 / u_crumpleSize - u_seed) * 32.;
  float crumples = u_crumples * (crumplesShape(crumplesUV + vec2(.05, 0.)) - crumplesShape(crumplesUV));

  vec2 fiberUV = 2. / u_fiberSize * patternUV;
  float fiber = fiberNoise(fiberUV, vec2(0.));
  fiber = .5 * u_fiber * (fiber - 1.);

  vec2 normal = vec2(0.);
  vec2 normalImage = vec2(0.);

  vec2 foldsUV = patternUV * .12;
  foldsUV = rotate(foldsUV, 4. * u_seed);
  vec2 w = folds(foldsUV);
  foldsUV = rotate(foldsUV + .007 * cos(u_seed), .01 * sin(u_seed));
  vec2 w2 = folds(foldsUV);

  float drops = u_drops * drops(patternUV * 2.);

  float fade = u_fade * fbm(.17 * patternUV + 10. * u_seed);
  fade = clamp(8. * fade * fade * fade, 0., 1.);

  w = mix(w, vec2(0.), fade);
  w2 = mix(w2, vec2(0.), fade);
  crumples = mix(crumples, 0., fade);
  drops = mix(drops, 0., fade);
  fiber *= mix(1., .5, fade);
  roughness *= mix(1., .5, fade);

  normal.xy += u_folds * min(5. * u_contrast, 1.) * 4. * max(vec2(0.), w + w2);
  normalImage.xy += u_folds * 2. * w;

  normal.xy += crumples;
  normalImage.xy += 1.5 * crumples;

  normal.xy += 3. * drops;
  normalImage.xy += .2 * drops;

  normal.xy += u_roughness * 1.5 * roughness;
  normal.xy += fiber;

  normalImage += u_roughness * .75 * roughness;
  normalImage += .2 * fiber;

  vec3 lightPos = vec3(1., 2., 1.);
  float res = dot(normalize(vec3(normal, 9.5 - 9. * pow(u_contrast, .1))), normalize(lightPos));

  vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
  float fgOpacity = u_colorFront.a;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  float bgOpacity = u_colorBack.a;

  imageUV += .02 * normalImage;
  float frame = getUvFrame(imageUV);
  vec4 image = texture(u_image, imageUV);
  image.rgb += .6 * pow(u_contrast, .4) * (res - .7);

  frame *= image.a;

  vec3 color = fgColor * res;
  float opacity = fgOpacity * res;

  color += bgColor * (1. - opacity);
  opacity += bgOpacity * (1. - opacity);
  opacity = mix(opacity, 1., frame);

  color -= .007 * drops;

  color.rgb = mix(color, image.rgb, frame);

  fragColor = vec4(color, opacity);
}
`,Ae=`#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_rotation;

uniform vec4 u_colorBack;
uniform vec4 u_colorShadow;
uniform vec4 u_colorHighlight;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform float u_size;
uniform float u_shadows;
uniform float u_angle;
uniform float u_stretch;
uniform float u_shape;
uniform float u_distortion;
uniform float u_highlights;
uniform float u_distortionShape;
uniform float u_shift;
uniform float u_blur;
uniform float u_edges;
uniform float u_marginLeft;
uniform float u_marginRight;
uniform float u_marginTop;
uniform float u_marginBottom;
uniform float u_grainMixer;
uniform float u_grainOverlay;

in vec2 v_imageUV;

out vec4 fragColor;

${_e}
${ve}
${be}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float getUvFrame(vec2 uv, float softness) {
  float aax = 2. * fwidth(uv.x);
  float aay = 2. * fwidth(uv.y);
  float left   = smoothstep(0., aax + softness, uv.x);
  float right  = 1. - smoothstep(1. - softness - aax, 1., uv.x);
  float bottom = smoothstep(0., aay + softness, uv.y);
  float top    = 1. - smoothstep(1. - softness - aay, 1., uv.y);
  return left * right * bottom * top;
}

const int MAX_RADIUS = 50;
vec4 samplePremultiplied(sampler2D tex, vec2 uv) {
  vec4 c = texture(tex, uv);
  c.rgb *= c.a;
  return c;
}
vec4 getBlur(sampler2D tex, vec2 uv, vec2 texelSize, vec2 dir, float sigma) {
  if (sigma <= .5) return texture(tex, uv);
  int radius = int(min(float(MAX_RADIUS), ceil(3.0 * sigma)));

  float twoSigma2 = 2.0 * sigma * sigma;
  float gaussianNorm = 1.0 / sqrt(TWO_PI * sigma * sigma);

  vec4 sum = samplePremultiplied(tex, uv) * gaussianNorm;
  float weightSum = gaussianNorm;

  for (int i = 1; i <= MAX_RADIUS; i++) {
    if (i > radius) break;

    float x = float(i);
    float w = exp(-(x * x) / twoSigma2) * gaussianNorm;

    vec2 offset = dir * texelSize * x;
    vec4 s1 = samplePremultiplied(tex, uv + offset);
    vec4 s2 = samplePremultiplied(tex, uv - offset);

    sum += (s1 + s2) * w;
    weightSum += 2.0 * w;
  }

  vec4 result = sum / weightSum;
  if (result.a > 0.) {
    result.rgb /= result.a;
  }

  return result;
}

vec2 rotateAspect(vec2 p, float a, float aspect) {
  p.x *= aspect;
  p = rotate(p, a);
  p.x /= aspect;
  return p;
}

float smoothFract(float x) {
  float f = fract(x);
  float w = fwidth(x);

  float edge = abs(f - 0.5) - 0.5;
  float band = smoothstep(-w, w, edge);

  return mix(f, 1.0 - f, band);
}

void main() {

  float patternRotation = -u_angle * PI / 180.;
  float patternSize = mix(200., 5., u_size);

  vec2 uv = v_imageUV;

  vec2 uvMask = gl_FragCoord.xy / u_resolution.xy;
  vec2 sw = vec2(.005);
  vec4 margins = vec4(u_marginLeft, u_marginTop, u_marginRight, u_marginBottom);
  float mask =
  smoothstep(margins[0], margins[0] + sw.x, uvMask.x + sw.x) *
  smoothstep(margins[2], margins[2] + sw.x, 1.0 - uvMask.x + sw.x) *
  smoothstep(margins[1], margins[1] + sw.y, uvMask.y + sw.y) *
  smoothstep(margins[3], margins[3] + sw.y, 1.0 - uvMask.y + sw.y);
  float maskOuter =
  smoothstep(margins[0] - sw.x, margins[0], uvMask.x + sw.x) *
  smoothstep(margins[2] - sw.x, margins[2], 1.0 - uvMask.x + sw.x) *
  smoothstep(margins[1] - sw.y, margins[1], uvMask.y + sw.y) *
  smoothstep(margins[3] - sw.y, margins[3], 1.0 - uvMask.y + sw.y);
  float maskStroke = maskOuter - mask;
  float maskInner =
  smoothstep(margins[0] - 2. * sw.x, margins[0], uvMask.x) *
  smoothstep(margins[2] - 2. * sw.x, margins[2], 1.0 - uvMask.x) *
  smoothstep(margins[1] - 2. * sw.y, margins[1], uvMask.y) *
  smoothstep(margins[3] - 2. * sw.y, margins[3], 1.0 - uvMask.y);
  float maskStrokeInner = maskInner - mask;

  uv -= .5;
  uv *= patternSize;
  uv = rotateAspect(uv, patternRotation, u_imageAspectRatio);

  float curve = 0.;
  float patternY = uv.y / u_imageAspectRatio;
  if (u_shape > 4.5) {
    // pattern
    curve = .5 + .5 * sin(.5 * PI * uv.x) * cos(.5 * PI * patternY);
  } else if (u_shape > 3.5) {
    // zigzag
    curve = 10. * abs(fract(.1 * patternY) - .5);
  } else if (u_shape > 2.5) {
    // wave
    curve = 4. * sin(.23 * patternY);
  } else if (u_shape > 1.5) {
    // lines irregular
    curve = .5 + .5 * sin(.5 * uv.x) * sin(1.7 * uv.x);
  } else {
    // lines
  }

  vec2 UvToFract = uv + curve;
  vec2 fractOrigUV = fract(uv);
  vec2 floorOrigUV = floor(uv);

  float x = smoothFract(UvToFract.x);
  float xNonSmooth = fract(UvToFract.x) + .0001;

  float highlightsWidth = 2. * max(.001, fwidth(UvToFract.x));
  highlightsWidth += 2. * maskStrokeInner;
  float highlights = smoothstep(0., highlightsWidth, xNonSmooth);
  highlights *= smoothstep(1., 1. - highlightsWidth, xNonSmooth);
  highlights = 1. - highlights;
  highlights *= u_highlights;
  highlights = clamp(highlights, 0., 1.);
  highlights *= mask;

  float shadows = pow(x, 1.3);
  float distortion = 0.;
  float fadeX = 1.;
  float frameFade = 0.;

  float aa = fwidth(xNonSmooth);
  aa = max(aa, fwidth(uv.x));
  aa = max(aa, fwidth(UvToFract.x));
  aa = max(aa, .0001);

  if (u_distortionShape == 1.) {
    distortion = -pow(1.5 * x, 3.);
    distortion += (.5 - u_shift);

    frameFade = pow(1.5 * x, 3.);
    aa = max(.2, aa);
    aa += mix(.2, 0., u_size);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    distortion = mix(.5, distortion, fadeX);
  } else if (u_distortionShape == 2.) {
    distortion = 2. * pow(x, 2.);
    distortion -= (.5 + u_shift);

    frameFade = pow(abs(x - .5), 4.);
    aa = max(.2, aa);
    aa += mix(.2, 0., u_size);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    distortion = mix(.5, distortion, fadeX);
    frameFade = mix(1., frameFade, .5 * fadeX);
  } else if (u_distortionShape == 3.) {
    distortion = pow(2. * (xNonSmooth - .5), 6.);
    distortion -= .25;
    distortion -= u_shift;

    frameFade = 1. - 2. * pow(abs(x - .4), 2.);
    aa = .15;
    aa += mix(.1, 0., u_size);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    frameFade = mix(1., frameFade, fadeX);

  } else if (u_distortionShape == 4.) {
    x = xNonSmooth;
    distortion = sin((x + .25) * TWO_PI);
    shadows = .5 + .5 * asin(distortion) / (.5 * PI);
    distortion *= .5;
    distortion -= u_shift;
    frameFade = .5 + .5 * sin(x * TWO_PI);
  } else if (u_distortionShape == 5.) {
    distortion -= pow(abs(x), .2) * x;
    distortion += .33;
    distortion -= 3. * u_shift;
    distortion *= .33;

    frameFade = .3 * (smoothstep(.0, 1., x));
    shadows = pow(x, 2.5);

    aa = max(.1, aa);
    aa += mix(.1, 0., u_size);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    distortion *= fadeX;
  }

  vec2 dudx = dFdx(v_imageUV);
  vec2 dudy = dFdy(v_imageUV);
  vec2 grainUV = v_imageUV - .5;
  grainUV *= (.8 / vec2(length(dudx), length(dudy)));
  grainUV += .5;
  float grain = valueNoise(grainUV);
  grain = smoothstep(.4, .7, grain);
  grain *= u_grainMixer;
  distortion = mix(distortion, 0., grain);

  shadows = min(shadows, 1.);
  shadows += maskStrokeInner;
  shadows *= mask;
  shadows = min(shadows, 1.);
  shadows *= pow(u_shadows, 2.);
  shadows = clamp(shadows, 0., 1.);

  distortion *= 3. * u_distortion;
  frameFade *= u_distortion;

  fractOrigUV.x += distortion;
  floorOrigUV = rotateAspect(floorOrigUV, -patternRotation, u_imageAspectRatio);
  fractOrigUV = rotateAspect(fractOrigUV, -patternRotation, u_imageAspectRatio);

  uv = (floorOrigUV + fractOrigUV) / patternSize;
  uv += pow(maskStroke, 4.);

  uv += vec2(.5);

  uv = mix(v_imageUV, uv, smoothstep(0., .7, mask));
  float blur = mix(0., 50., u_blur);
  blur = mix(0., blur, smoothstep(.5, 1., mask));

  float edgeDistortion = mix(.0, .04, u_edges);
  edgeDistortion += .06 * frameFade * u_edges;
  edgeDistortion *= mask;
  float frame = getUvFrame(uv, edgeDistortion);

  float stretch = 1. - smoothstep(0., .5, xNonSmooth) * smoothstep(1., 1. - .5, xNonSmooth);
  stretch = pow(stretch, 2.);
  stretch *= mask;
  stretch *= getUvFrame(uv, .1 + .05 * mask * frameFade);
  uv.y = mix(uv.y, .5, u_stretch * stretch);

  vec4 image = getBlur(u_image, uv, 1. / u_resolution / u_pixelRatio, vec2(0., 1.), blur);
  image.rgb *= image.a;
  vec4 backColor = u_colorBack;
  backColor.rgb *= backColor.a;
  vec4 highlightColor = u_colorHighlight;
  highlightColor.rgb *= highlightColor.a;
  vec4 shadowColor = u_colorShadow;

  vec3 color = highlightColor.rgb * highlights;
  float opacity = highlightColor.a * highlights;

  shadows = mix(shadows * shadowColor.a, 0., highlights);
  color = mix(color, shadowColor.rgb * shadowColor.a, .5 * shadows);
  color += .5 * pow(shadows, .5) * shadowColor.rgb;
  opacity += shadows;
  color = clamp(color, vec3(0.), vec3(1.));
  opacity = clamp(opacity, 0., 1.);

  color += image.rgb * (1. - opacity) * frame;
  opacity += image.a * (1. - opacity) * frame;

  color += backColor.rgb * (1. - opacity);
  opacity += backColor.a * (1. - opacity);

  float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2. - 1.;
  vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
  float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, .8);
  grainOverlayStrength *= mask;
  color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);

  opacity += .5 * grainOverlayStrength;
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`,je={lines:1,linesIrregular:2,wave:3,zigzag:4,pattern:5},Me={prism:1,lens:2,contour:3,cascade:4,flat:5},Ne=`#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;

uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

uniform vec4 u_colorFront;
uniform vec4 u_colorBack;
uniform vec4 u_colorHighlight;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform float u_type;
uniform float u_pxSize;
uniform bool u_originalColors;
uniform bool u_inverted;
uniform float u_colorSteps;

out vec4 fragColor;


${be}
${_e}

float getUvFrame(vec2 uv, vec2 pad) {
  float aa = 0.0001;

  float left   = smoothstep(-pad.x, -pad.x + aa, uv.x);
  float right  = smoothstep(1.0 + pad.x, 1.0 + pad.x - aa, uv.x);
  float bottom = smoothstep(-pad.y, -pad.y + aa, uv.y);
  float top    = smoothstep(1.0 + pad.y, 1.0 + pad.y - aa, uv.y);

  return left * right * bottom * top;
}

vec2 getImageUV(vec2 uv) {
  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  float r = u_rotation * PI / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);

  vec2 imageBoxSize;
  if (u_fit == 1.) { // contain
    imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else if (u_fit == 2.) { // cover
    imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else {
    imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
  }
  imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
  vec2 imageBoxScale = u_resolution.xy / imageBoxSize;

  vec2 imageUV = uv;
  imageUV *= imageBoxScale;
  imageUV += boxOrigin * (imageBoxScale - 1.);
  imageUV += graphicOffset;
  imageUV /= u_scale;
  imageUV.x *= u_imageAspectRatio;
  imageUV = graphicRotation * imageUV;
  imageUV.x /= u_imageAspectRatio;

  imageUV += .5;
  imageUV.y = 1. - imageUV.y;

  return imageUV;
}

const int bayer2x2[4] = int[4](0, 2, 3, 1);
const int bayer4x4[16] = int[16](
0, 8, 2, 10,
12, 4, 14, 6,
3, 11, 1, 9,
15, 7, 13, 5
);

const int bayer8x8[64] = int[64](
0, 32, 8, 40, 2, 34, 10, 42,
48, 16, 56, 24, 50, 18, 58, 26,
12, 44, 4, 36, 14, 46, 6, 38,
60, 28, 52, 20, 62, 30, 54, 22,
3, 35, 11, 43, 1, 33, 9, 41,
51, 19, 59, 27, 49, 17, 57, 25,
15, 47, 7, 39, 13, 45, 5, 37,
63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
  int index = pos.y * size + pos.x;

  if (size == 2) {
    return float(bayer2x2[index]) / 4.0;
  } else if (size == 4) {
    return float(bayer4x4[index]) / 16.0;
  } else if (size == 8) {
    return float(bayer8x8[index]) / 64.0;
  }
  return 0.0;
}


void main() {

  float pxSize = u_pxSize * u_pixelRatio;
  vec2 pxSizeUV = gl_FragCoord.xy - .5 * u_resolution;
  pxSizeUV /= pxSize;
  vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
  vec2 normalizedUV = canvasPixelizedUV / u_resolution;

  vec2 imageUV = getImageUV(normalizedUV);
  vec2 ditheringNoiseUV = canvasPixelizedUV;
  vec4 image = texture(u_image, imageUV);
  float frame = getUvFrame(imageUV, pxSize / u_resolution);

  int type = int(floor(u_type));
  float dithering = 0.0;

  float lum = dot(vec3(.2126, .7152, .0722), image.rgb);
  lum = u_inverted ? (1. - lum) : lum;

  switch (type) {
    case 1: {
      dithering = step(hash21(ditheringNoiseUV), lum);
    } break;
    case 2:
    dithering = getBayerValue(pxSizeUV, 2);
    break;
    case 3:
    dithering = getBayerValue(pxSizeUV, 4);
    break;
    default :
    dithering = getBayerValue(pxSizeUV, 8);
    break;
  }

  float colorSteps = max(floor(u_colorSteps), 1.);
  vec3 color = vec3(0.0);
  float opacity = 1.;

  dithering -= .5;
  float brightness = clamp(lum + dithering / colorSteps, 0.0, 1.0);
  brightness = mix(0.0, brightness, frame);
  brightness = mix(0.0, brightness, image.a);
  float quantLum = floor(brightness * colorSteps + 0.5) / colorSteps;
  quantLum = mix(0.0, quantLum, frame);

  if (u_originalColors == true) {
    vec3 normColor = image.rgb / max(lum, 0.001);
    color = normColor * quantLum;

    float quantAlpha = floor(image.a * colorSteps + 0.5) / colorSteps;
    opacity = mix(quantLum, 1., quantAlpha);
  } else {
    vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
    float fgOpacity = u_colorFront.a;
    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    float bgOpacity = u_colorBack.a;
    vec3 hlColor = u_colorHighlight.rgb * u_colorHighlight.a;
    float hlOpacity = u_colorHighlight.a;

    fgColor = mix(fgColor, hlColor, step(1.02 - .02 * u_colorSteps, brightness));
    fgOpacity = mix(fgOpacity, hlOpacity, step(1.02 - .02 * u_colorSteps, brightness));

    color = fgColor * quantLum;
    opacity = fgOpacity * quantLum;
    color += bgColor * (1.0 - opacity);
    opacity += bgOpacity * (1.0 - opacity);
  }

  fragColor = vec4(color, opacity);
}
`,Pe=`#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_spread;
uniform float u_bias;
uniform float u_angle;
uniform float u_perspective;
uniform float u_count;
uniform float u_dispersion;
uniform float u_dispersionShift;
uniform float u_dispersionColor;
uniform float u_focusCenter;
uniform float u_focusEdges;
uniform float u_swirl;
uniform float u_noise;
uniform float u_noiseFrequency;
uniform float u_noiseOffset;
uniform float u_lensBulge;
uniform float u_lensCircle;
uniform float u_grainMixer;
uniform float u_grainOverlay;
uniform float u_imageX;
uniform float u_imageY;

in vec2 v_imageUV;

out vec4 fragColor;

${_e}
${be}
${ve}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1., 0.));
  float c = hash21(i + vec2(0., 1.));
  float d = hash21(i + vec2(1., 1.));
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float getUvFrame(vec2 uv) {
  vec2 invAA = 1. / clamp(fwidth(uv), 1e-5, .02);
  vec2 lo = clamp(uv * invAA + .5, 0., 1.);
  vec2 hi = clamp((1. - uv) * invAA + .5, 0., 1.);
  return lo.x * hi.x * lo.y * hi.y;
}

vec4 sampleOverWhite(vec2 uv) {
  vec4 img = texture(u_image, uv);
  float cover = img.a * getUvFrame(uv);
  vec3 colorOverWhite = mix(vec3(1.), img.rgb, cover);
  return vec4(colorOverWhite, cover);
}

vec3 hueColor(float hue) {
  vec3 rgb = clamp(abs(mod(hue * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.);
  rgb = rgb * rgb * (3. - 2. * rgb);
  return rgb;
}
                                            
float boxInradius() {
  return .5 * min(u_imageAspectRatio, 1.);
}

float boxOutradius() {
  return .5 * length(vec2(u_imageAspectRatio, 1.));
}

float spreadReach() {
  return .7 * pow(u_spread, 1.3 + 2.7 * u_spread);
}

float innerCircleMask(float radius, float inradius) {
  return 1. - smoothstep(.5 * inradius, 1.1 * inradius, radius);
}

float dispersionCurve(float t, float biasPow) {
  float mirroredT = u_bias < 0. ? 1. - t : t;
  float curved = pow(mirroredT, biasPow);
  return u_bias < 0. ? 1. - curved : curved;
}

vec2 getSpread(vec2 fromCenter, float radius, vec2 warpedUV, float edgeAA, float inradius, float outradius, float reach, out float outStrength) {
  float angleRad = radians(u_angle);
  vec2 uniformDir = vec2(cos(angleRad), sin(angleRad));

  float invInradius = 1. / inradius;
  vec2 radialDir = fromCenter * invInradius;
  float maxLen = (outradius + reach) * invInradius;
  float radialLen = radius * invInradius;
  if (radialLen > maxLen) radialDir *= maxLen / radialLen;
  vec2 spreadDir = mix(uniformDir, radialDir, u_perspective);

  float bandProximity = smoothstep(inradius * .8, inradius, radius);
  float lensCircleMaxing = bandProximity * u_lensCircle * u_lensCircle * u_lensCircle;
  spreadDir = mix(spreadDir, radialDir, lensCircleMaxing);

  vec2 warpedAbs = abs(warpedUV - .5);
  float inner = mix(1., smoothstep(0., mix(inradius, outradius, u_focusCenter), radius), u_focusCenter);
  float boxDist = max(warpedAbs.x, warpedAbs.y) * 2.;
  float outer = mix(1., 1. - min(boxDist, 1.), u_focusEdges);
  float strength = inner * outer;

  strength *= mix(1., mix(.15, .03, max(-u_lensBulge, 0.)), lensCircleMaxing);

  vec2 outside = max(warpedAbs - .5, 0.);
  float margin = max(reach * length(spreadDir) * (1. - u_lensCircle), edgeAA);
  strength *= 1. - smoothstep(0., margin, length(outside));

  outStrength = strength;
  vec2 axis = spreadDir * (reach * strength);

  if (u_noise > 0.) {
    float turn = (valueNoise(fromCenter * u_noiseFrequency * 18. + u_noiseOffset * 30.) - .5) * 2. * u_noise;
    float cs = cos(turn), sn = sin(turn);
    axis = mat2(cs, -sn, sn, cs) * axis;
  }

  axis.x /= u_imageAspectRatio;
  return axis;
}

vec2 lensWarp(vec2 fromCenter, float radius, float inradius, out float bulgeFade) {
  bulgeFade = 1.;
  if (u_lensBulge == 0. && u_lensCircle <= 0.) return fromCenter;
  if (radius < 1e-5) return fromCenter;
  
  float r = radius;

  if (u_lensBulge != 0.) {
    float rn = radius / inradius;
    float bulge = abs(u_lensBulge) * (u_lensBulge > 0. ? 1.4 : 1.2);
    if (u_lensBulge > 0.) bulgeFade = 1. - smoothstep(1.45, 1.53, rn * bulge);
    float map = u_lensBulge > 0.
      ? tan(min(rn * bulge, 1.53)) / tan(bulge)
      : atan(rn * tan(bulge)) / bulge;
    float bulgeScale = map / rn;
    fromCenter *= bulgeScale;
    r *= bulgeScale;
  }

  if (u_lensCircle > 0.) {
    vec2 dir = fromCenter / max(r, 1e-5);
    vec2 halfBox = vec2(u_imageAspectRatio, 1.) * .5;
    float rBox = min(halfBox.x / max(abs(dir.x), 1e-4), halfBox.y / max(abs(dir.y), 1e-4));
    float band = inradius * mix(.03, .2, .5 * (u_lensBulge + 1.));
    float innerEdge = inradius - band;
    float over = smoothstep(0., 1., (r - innerEdge) / band);
    float g = r + (rBox - inradius) * pow(over, 14.);
    fromCenter = dir * mix(r, g, u_lensCircle);
  }

  return fromCenter;
}

void main() {
  vec2 uv = v_imageUV;

  float invAspect = 1. / u_imageAspectRatio;
  float inradius = boxInradius();
  float outradius = boxOutradius();
  float reach = spreadReach();

  vec2 fromCenter = uv - .5;
  fromCenter.x *= u_imageAspectRatio;
  float radius = length(fromCenter);

  float bulgeFade;
  vec2 warpedFromCenter = lensWarp(fromCenter, radius, inradius, bulgeFade);
  vec2 baseUV = vec2(warpedFromCenter.x * invAspect, warpedFromCenter.y) + .5;

  vec2 baseDerivative = fwidth(baseUV);
  float edgeAA = clamp(2. * max(baseDerivative.x, baseDerivative.y), .001, .02);

  float spreadStrength;
  vec2 spreadAxis = getSpread(fromCenter, radius, baseUV, edgeAA, inradius, outradius, reach, spreadStrength);

  vec2 grainUV = vec2(0.);
  if (u_grainMixer > 0. || u_grainOverlay > 0.) {
    vec2 dudx = dFdx(v_imageUV);
    vec2 dudy = dFdy(v_imageUV);
    grainUV = (v_imageUV - .5) * (.8 / vec2(length(dudx), length(dudy))) + .5;
  }

  if (u_grainMixer > 0.) {
    float grainSeed = valueNoise(grainUV);
    vec2 jit = fract(grainSeed * vec2(157.31, 113.57)) * 2. - 1.;
    spreadAxis += jit * .3 * u_grainMixer * length(spreadAxis);
  }

  float count = floor(u_count);
  int countInteger = int(count);

  float invCount = 1. / count;
  float invSpan = 1. / max(count - 1., 1.);
  float hueBase = u_dispersionColor + .5;
  float biasPower = 1. + 2. * abs(u_bias);
  vec2 tapBias = .5 - vec2(u_imageX, u_imageY);

  float centerAmount = clamp(1. - u_dispersionShift, 0., 1.);
  float edgesAmount = clamp(1. + u_dispersionShift, 0., 1.);
  float dispersion = u_dispersion * mix(edgesAmount, centerAmount, innerCircleMask(radius, inradius));
  float dispersionPower = pow(dispersion, .8);

  float warpedRadius = length(warpedFromCenter);
  float swirlAngle = u_swirl * .4 * PI * spreadStrength * u_spread * min(1., inradius / max(warpedRadius, 1e-4));

  vec3 colorSum = vec3(0.);
  vec3 weightSum = vec3(0.);
  float coverSum = 0.;

  for (int i = 0; i < ${{maxSamples:50}.maxSamples}; i++) {
    if (i >= countInteger) break;

    float layer = float(i);
    float hue = hueBase + layer * invCount;

    float spread = layer * invSpan;
    if (u_bias != 0.) spread = dispersionCurve(spread, biasPower);

    // mix(axis, -axis, spread) is axis scaled by the signed position along the fan
    float fanPos = 1. - 2. * spread;
    vec2 tapUV = baseUV + spreadAxis * fanPos - .5;

    if (u_swirl != 0.) {
      tapUV.x *= u_imageAspectRatio;
      tapUV = rotate(tapUV, swirlAngle * fanPos);
      tapUV.x *= invAspect;
    }

    vec4 tap = sampleOverWhite(tapUV + tapBias);
    vec3 weight = 1. - dispersionPower * hueColor(hue);

    colorSum += tap.rgb * weight;
    weightSum += weight;
    coverSum += tap.a;
  }

  vec3 color = colorSum / max(weightSum, 1e-4);
  float coverAvg = coverSum * invCount;

  float ground = min(color.r, min(color.g, color.b));
  float alpha = max(coverAvg, 1. - ground);
  vec3 premult = max(color - (1. - alpha), 0.);
  fragColor = vec4(premult, alpha) * bulgeFade;

  if (u_grainOverlay > 0.) {
    float grain = valueNoise(rotate(grainUV, 1.) + vec2(3.));
    grain = mix(grain, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
    grain = pow(grain, 1.3);
    float grainV = grain * 2. - 1.;
    float grainStrength = pow(u_grainOverlay * abs(grainV), .8) * fragColor.a;
    fragColor.rgb = mix(fragColor.rgb, vec3(step(0., grainV)) * fragColor.a, .35 * grainStrength);
  }
}
`,Fe=`#version 300 es
precision mediump float;

uniform float u_rotation;

uniform float u_time;

uniform vec4 u_colorFront;
uniform vec4 u_colorBack;
uniform float u_radius;
uniform float u_contrast;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform float u_size;
uniform float u_grainMixer;
uniform float u_grainOverlay;
uniform float u_grainSize;
uniform float u_grid;
uniform bool u_originalColors;
uniform bool u_inverted;
uniform float u_type;

in vec2 v_imageUV;

out vec4 fragColor;

${_e}
${ve}
${be}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float lst(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

float sst(float edge0, float edge1, float x) {
  return smoothstep(edge0, edge1, x);
}

float getCircle(vec2 uv, float r, float baseR) {
  r = mix(.25 * baseR, 0., r);
  float d = length(uv - .5);
  float aa = fwidth(d);
  return 1. - smoothstep(r - aa, r + aa, d);
}

float getCell(vec2 uv) {
  float insideX = step(0.0, uv.x) * (1.0 - step(1.0, uv.x));
  float insideY = step(0.0, uv.y) * (1.0 - step(1.0, uv.y));
  return insideX * insideY;
}

float getCircleWithHole(vec2 uv, float r, float baseR) {
  float cell = getCell(uv);

  r = mix(.75 * baseR, 0., r);
  float rMod = mod(r, .5);

  float d = length(uv - .5);
  float aa = fwidth(d);
  float circle = 1. - smoothstep(rMod - aa, rMod + aa, d);
  if (r < .5) {
    return circle;
  } else {
    return cell - circle;
  }
}

float getGooeyBall(vec2 uv, float r, float baseR) {
  float d = length(uv - .5);
  float sizeRadius = .3;
  if (u_grid == 1.) {
    sizeRadius = .42;
  }
  sizeRadius = mix(sizeRadius * baseR, 0., r);
  d = 1. - sst(0., sizeRadius, d);

  d = pow(d, 2. + baseR);
  return d;
}

float getSoftBall(vec2 uv, float r, float baseR) {
  float d = length(uv - .5);
  float sizeRadius = clamp(baseR, 0., 1.);
  sizeRadius = mix(.5 * sizeRadius, 0., r);
  d = 1. - lst(0., sizeRadius, d);
  float powRadius = 1. - lst(0., 2., baseR);
  d = pow(d, 4. + 3. * powRadius);
  return d;
}

float getUvFrame(vec2 uv, vec2 pad) {
  float aa = 0.0001;

  float left   = smoothstep(-pad.x, -pad.x + aa, uv.x);
  float right  = smoothstep(1.0 + pad.x, 1.0 + pad.x - aa, uv.x);
  float bottom = smoothstep(-pad.y, -pad.y + aa, uv.y);
  float top    = smoothstep(1.0 + pad.y, 1.0 + pad.y - aa, uv.y);

  return left * right * bottom * top;
}

float sigmoid(float x, float k) {
  return 1.0 / (1.0 + exp(-k * (x - 0.5)));
}

float getLumAtPx(vec2 uv, float contrast) {
  vec4 tex = texture(u_image, uv);
  vec3 color = vec3(
  sigmoid(tex.r, contrast),
  sigmoid(tex.g, contrast),
  sigmoid(tex.b, contrast)
  );
  float lum = dot(vec3(0.2126, 0.7152, 0.0722), color);
  lum = mix(1., lum, tex.a);
  lum = u_inverted ? (1. - lum) : lum;
  return lum;
}

float getLumBall(vec2 p, vec2 pad, vec2 inCellOffset, float contrast, float baseR, float stepSize, out vec4 ballColor) {
  p += inCellOffset;
  vec2 uv_i = floor(p);
  vec2 uv_f = fract(p);
  vec2 samplingUV = (uv_i + .5 - inCellOffset) * pad + vec2(.5);
  float outOfFrame = getUvFrame(samplingUV, pad * stepSize);

  float lum = getLumAtPx(samplingUV, contrast);
  ballColor = texture(u_image, samplingUV);
  ballColor.rgb *= ballColor.a;
  ballColor *= outOfFrame;

  float ball = 0.;
  if (u_type == 0.) {
    // classic
    ball = getCircle(uv_f, lum, baseR);
  } else if (u_type == 1.) {
    // gooey
    ball = getGooeyBall(uv_f, lum, baseR);
  } else if (u_type == 2.) {
    // holes
    ball = getCircleWithHole(uv_f, lum, baseR);
  } else if (u_type == 3.) {
    // soft
    ball = getSoftBall(uv_f, lum, baseR);
  }

  return ball * outOfFrame;
}


void main() {

  float stepMultiplier = 1.;
  if (u_type == 0.) {
    // classic
    stepMultiplier = 2.;
  } else if (u_type == 1. || u_type == 3.) {
    // gooey & soft
    stepMultiplier = 6.;
  }

  float cellsPerSide = mix(300., 7., pow(u_size, .7));
  cellsPerSide /= stepMultiplier;
  float cellSizeY = 1. / cellsPerSide;
  vec2 pad = cellSizeY * vec2(1. / u_imageAspectRatio, 1.);
  if (u_type == 1. && u_grid == 1.) {
    // gooey diagonal grid works differently
    pad *= .7;
  }

  vec2 uv = v_imageUV;
  uv -= vec2(.5);
  uv /= pad;

  float contrast = mix(0., 15., pow(u_contrast, 1.5));
  float baseRadius = u_radius;
  if (u_originalColors == true) {
    contrast = mix(.1, 4., pow(u_contrast, 2.));
    baseRadius = 2. * pow(.5 * u_radius, .3);
  }

  float totalShape = 0.;
  vec3 totalColor = vec3(0.);
  float totalOpacity = 0.;

  vec4 ballColor;
  float shape;
  float stepSize = 1. / stepMultiplier;
  for (float x = -0.5; x < 0.5; x += stepSize) {
    for (float y = -0.5; y < 0.5; y += stepSize) {
      vec2 offset = vec2(x, y);

      if (u_grid == 1.) {
        float rowIndex = floor((y + .5) / stepSize);
        float colIndex = floor((x + .5) / stepSize);
        if (stepSize == 1.) {
          rowIndex = floor(uv.y + y + 1.);
          if (u_type == 1.) {
            colIndex = floor(uv.x + x + 1.);
          }
        }
        if (u_type == 1.) {
          if (mod(rowIndex + colIndex, 2.) == 1.) {
            continue;
          }
        } else {
          if (mod(rowIndex, 2.) == 1.) {
            offset.x += .5 * stepSize;
          }
        }
      }

      shape = getLumBall(uv, pad, offset, contrast, baseRadius, stepSize, ballColor);
      totalColor   += ballColor.rgb * shape;
      totalShape   += shape;
      totalOpacity += shape;
    }
  }

  const float eps = 1e-4;

  totalColor /= max(totalShape, eps);
  totalOpacity /= max(totalShape, eps);

  float finalShape = 0.;
  if (u_type == 0.) {
    finalShape = min(1., totalShape);
  } else if (u_type == 1.) {
    float aa = fwidth(totalShape);
    float th = .5;
    finalShape = smoothstep(th - aa, th + aa, totalShape);
  } else if (u_type == 2.) {
    finalShape = min(1., totalShape);
  } else if (u_type == 3.) {
    finalShape = totalShape;
  }

  vec2 grainSize = mix(2000., 200., u_grainSize) * vec2(1., 1. / u_imageAspectRatio);
  vec2 grainUV = v_imageUV - .5;
  grainUV *= grainSize;
  grainUV += .5;
  float grain = valueNoise(grainUV);
  grain = smoothstep(.55, .7 + .2 * u_grainMixer, grain);
  grain *= u_grainMixer;
  finalShape = mix(finalShape, 0., grain);

  vec3 color = vec3(0.);
  float opacity = 0.;

  if (u_originalColors == true) {
    color = totalColor * finalShape;
    opacity = totalOpacity * finalShape;

    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    color = color + bgColor * (1. - opacity);
    opacity = opacity + u_colorBack.a * (1. - opacity);
  } else {
    vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
    float fgOpacity = u_colorFront.a;
    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    float bgOpacity = u_colorBack.a;

    color = fgColor * finalShape;
    opacity = fgOpacity * finalShape;
    color += bgColor * (1. - opacity);
    opacity += bgOpacity * (1. - opacity);
  }

  float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2. - 1.;
  vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
  float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, .8);
  color = mix(color, grainOverlayColor, .5 * grainOverlayStrength);

  opacity += .5 * grainOverlayStrength;
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`,Ie={classic:0,gooey:1,holes:2,soft:3},Le={square:0,hex:1};function j(e){if(Array.isArray(e))return e.length===4?e:e.length===3?[...e,1]:Ue;if(typeof e!=`string`)return Ue;let t,n,r,i=1;if(e.startsWith(`#`))[t,n,r,i]=Re(e);else if(e.startsWith(`rgb`)){let a=ze(e);if(a===null)return Ue;[t,n,r,i]=a}else if(e.startsWith(`hsl`)){let a=Be(e);if(a===null)return Ue;[t,n,r,i]=Ve(a)}else return console.error(`Unsupported color format`,e),Ue;return[He(t,0,1),He(n,0,1),He(r,0,1),He(i,0,1)]}function Re(e){return e=e.replace(/^#/,``),(e.length===3||e.length===4)&&(e=e.split(``).map(e=>e+e).join(``)),e.length===6&&(e+=`ff`),/^[0-9a-f]{8}$/i.test(e)?[parseInt(e.slice(0,2),16)/255,parseInt(e.slice(2,4),16)/255,parseInt(e.slice(4,6),16)/255,parseInt(e.slice(6,8),16)/255]:(console.warn(`Invalid hex color`),Ue)}function ze(e){let t=e.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+))?\s*\)$/i);return t?[parseInt(t[1]??`0`)/255,parseInt(t[2]??`0`)/255,parseInt(t[3]??`0`)/255,t[4]===void 0?1:parseFloat(t[4])]:null}function Be(e){let t=e.match(/^hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([0-9.]+))?\s*\)$/i);return t?[parseInt(t[1]??`0`),parseInt(t[2]??`0`),parseInt(t[3]??`0`),t[4]===void 0?1:parseFloat(t[4])]:null}function Ve(e){let[t,n,r,i]=e,a=t/360,o=n/100,s=r/100,c,l,u;if(n===0)c=l=u=s;else{let e=(e,t,n)=>(n<0&&(n+=1),n>1&&--n,n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*(2/3-n)*6:e),t=s<.5?s*(1+o):s+o-s*o,n=2*s-t;c=e(n,t,a+1/3),l=e(n,t,a),u=e(n,t,a-1/3)}return[c,l,u,i]}var He=(e,t,n)=>Math.min(Math.max(e,t),n),Ue=[.5,.5,.5,1];function We(){if(typeof window>`u`)return;let e=new Image;return e.src=Ge,e}var Ge=`data:image/png;base64,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`;function Ke(e){let t=b.useRef(void 0),n=b.useCallback(t=>{let n=e.map(e=>{if(e!=null){if(typeof e==`function`){let n=e,r=n(t);return typeof r==`function`?r:()=>{n(null)}}return e.current=t,()=>{e.current=null}}});return()=>{n.forEach(e=>e?.())}},e);return b.useMemo(()=>e.every(e=>e==null)?null:e=>{t.current&&=(t.current(),void 0),e!=null&&(t.current=n(e))},e)}function qe(e){if(e.naturalWidth<1024&&e.naturalHeight<1024){if(e.naturalWidth<1||e.naturalHeight<1)return;let t=e.naturalWidth/e.naturalHeight;e.width=Math.round(t>1?1024*t:1024),e.height=Math.round(t>1?1024:1024/t)}}async function Je(e){let t={},n=[],r=e=>{try{return e.startsWith(`/`)||new URL(e),!0}catch{return!1}},i=e=>{try{return!e.startsWith(`/`)&&new URL(e,window.location.origin).origin!==window.location.origin}catch{return!1}};return Object.entries(e).forEach(([e,a])=>{if(typeof a==`string`){let o=a||`data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==`;if(!r(o)){console.warn(`Uniform "${e}" has invalid URL "${o}". Skipping image loading.`);return}let s=new Promise((n,r)=>{let a=new Image;i(o)&&(a.crossOrigin=`anonymous`),a.onload=()=>{qe(a),t[e]=a,n()},a.onerror=()=>{console.error(`Could not set uniforms. Failed to load image at ${o}`),r()},a.src=o});n.push(s)}else if(a instanceof HTMLImageElement){let r=a.decode().then(()=>{qe(a),t[e]=a});n.push(r)}else t[e]=a}),await Promise.all(n),t}var M=(0,b.forwardRef)(function({fragmentShader:e,uniforms:t,webGlContextAttributes:n,speed:r=0,frame:i=0,width:a,height:o,minPixelRatio:s,maxPixelCount:c,mipmaps:l,style:u,...d},f){let[p,m]=(0,b.useState)(!1),h=(0,b.useRef)(null),g=(0,b.useRef)(null),_=(0,b.useRef)(n);(0,b.useEffect)(()=>((async()=>{let n=await Je(t);h.current&&!g.current&&(g.current=new le(h.current,e,n,_.current,r,i,s,c,l),m(!0))})(),()=>{g.current?.dispose(),g.current=null}),[e]),(0,b.useEffect)(()=>{let e=!1;return(async()=>{let n=await Je(t);e||g.current?.setUniforms(n)})(),()=>{e=!0}},[t,p]),(0,b.useEffect)(()=>{g.current?.setSpeed(r)},[r,p]),(0,b.useEffect)(()=>{g.current?.setMaxPixelCount(c)},[c,p]),(0,b.useEffect)(()=>{g.current?.setMinPixelRatio(s)},[s,p]),(0,b.useEffect)(()=>{g.current?.setFrame(i)},[i,p]);let v=Ke([h,f]);return(0,x.jsx)(`div`,{ref:v,style:a!==void 0||o!==void 0?{width:typeof a==`string`&&isNaN(+a)===!1?+a:a,height:typeof o==`string`&&isNaN(+o)===!1?+o:o,...u}:u,...d})});M.displayName=`ShaderMount`;function Ye(e,t){if(Object.keys(e).length!==Object.keys(t).length)return!1;for(let n in e)if(n===`colors`){let n=Array.isArray(e.colors),r=Array.isArray(t.colors);if(!n||!r){if(Object.is(e.colors,t.colors)===!1)return!1;continue}if(e.colors?.length!==t.colors?.length||!e.colors?.every((e,n)=>e===t.colors?.[n]))return!1}else if(Object.is(e[n],t[n])===!1)return!1;return!0}var N={name:`Default`,params:{...A,speed:1,frame:0,colors:[`#e0eaff`,`#241d9a`,`#f75092`,`#9f50d3`],distortion:.8,swirl:.1,grainMixer:0,grainOverlay:0}};({...A}),{...A},{...A};var Xe=(0,b.memo)(function({speed:e=N.params.speed,frame:t=N.params.frame,colors:n=N.params.colors,distortion:r=N.params.distortion,swirl:i=N.params.swirl,grainMixer:a=N.params.grainMixer,grainOverlay:o=N.params.grainOverlay,fit:s=N.params.fit,rotation:c=N.params.rotation,scale:l=N.params.scale,originX:u=N.params.originX,originY:d=N.params.originY,offsetX:f=N.params.offsetX,offsetY:p=N.params.offsetY,worldWidth:m=N.params.worldWidth,worldHeight:h=N.params.worldHeight,...g}){let _={u_colors:n.map(j),u_colorsCount:n.length,u_distortion:r,u_swirl:i,u_grainMixer:a,u_grainOverlay:o,u_fit:ge[s],u_rotation:c,u_scale:l,u_offsetX:f,u_offsetY:p,u_originX:u,u_originY:d,u_worldWidth:m,u_worldHeight:h};return(0,x.jsx)(M,{...g,speed:e,frame:t,fragmentShader:Te,uniforms:_})},Ye),P={name:`Default`,params:{...he,speed:1,frame:0,scale:.6,colorBack:`#000000`,colorFront:`#00b2ff`,shape:`sphere`,type:`4x4`,size:2}};({...he}),{...he},{...A},{...A},{...A};var Ze=(0,b.memo)(function({speed:e=P.params.speed,frame:t=P.params.frame,colorBack:n=P.params.colorBack,colorFront:r=P.params.colorFront,shape:i=P.params.shape,type:a=P.params.type,pxSize:o,size:s=o===void 0?P.params.size:o,fit:c=P.params.fit,scale:l=P.params.scale,rotation:u=P.params.rotation,originX:d=P.params.originX,originY:f=P.params.originY,offsetX:p=P.params.offsetX,offsetY:m=P.params.offsetY,worldWidth:h=P.params.worldWidth,worldHeight:g=P.params.worldHeight,..._}){let v={u_colorBack:j(n),u_colorFront:j(r),u_shape:De[i],u_type:Oe[a],u_pxSize:s,u_fit:ge[c],u_scale:l,u_rotation:u,u_offsetX:p,u_offsetY:m,u_originX:d,u_originY:f,u_worldWidth:h,u_worldHeight:g};return(0,x.jsx)(M,{..._,speed:e,frame:t,fragmentShader:Ee,uniforms:v})}),F={name:`Default`,params:{...A,fit:`cover`,scale:.6,speed:0,frame:0,colorFront:`#9fadbc`,colorBack:`#ffffff`,contrast:.3,roughness:.4,fiber:.3,fiberSize:.2,crumples:.3,crumpleSize:.35,folds:.65,foldCount:5,fade:0,drops:.2,seed:5.8}};({...A}),{...A},{...A};var Qe=(0,b.memo)(function({speed:e=F.params.speed,frame:t=F.params.frame,colorFront:n=F.params.colorFront,colorBack:r=F.params.colorBack,image:i=``,contrast:a=F.params.contrast,roughness:o=F.params.roughness,fiber:s=F.params.fiber,crumples:c=F.params.crumples,folds:l=F.params.folds,drops:u=F.params.drops,seed:d=F.params.seed,fiberScale:f,fiberSize:p=f===void 0?F.params.fiberSize:.2/f,crumplesScale:m,crumpleSize:h=m===void 0?F.params.crumpleSize:.2/m,blur:g,fade:_=g===void 0?F.params.fade:g,foldsNumber:v,foldCount:y=v===void 0?F.params.foldCount:v,fit:b=F.params.fit,scale:S=F.params.scale,rotation:C=F.params.rotation,originX:w=F.params.originX,originY:T=F.params.originY,offsetX:E=F.params.offsetX,offsetY:D=F.params.offsetY,worldWidth:O=F.params.worldWidth,worldHeight:k=F.params.worldHeight,...ee}){let te=typeof window<`u`&&{u_noiseTexture:We()},ne={u_image:i,u_colorFront:j(n),u_colorBack:j(r),u_contrast:a,u_roughness:o,u_fiber:s,u_fiberSize:p,u_crumples:c,u_crumpleSize:h,u_foldCount:y,u_folds:l,u_fade:_,u_drops:u,u_seed:d,...te,u_fit:ge[b],u_scale:S,u_rotation:C,u_offsetX:E,u_offsetY:D,u_originX:w,u_originY:T,u_worldWidth:O,u_worldHeight:k};return(0,x.jsx)(M,{...ee,speed:e,frame:t,fragmentShader:ke,mipmaps:[`u_image`],uniforms:ne})},Ye),I={name:`Default`,params:{...A,fit:`cover`,speed:0,frame:0,colorBack:`#00000000`,colorShadow:`#000000`,colorHighlight:`#ffffff`,shadows:.25,size:.5,angle:0,distortionShape:`prism`,highlights:.1,shape:`lines`,distortion:.5,shift:0,blur:0,edges:.25,stretch:0,margin:0,marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,grainMixer:0,grainOverlay:0}};({...A}),{...A},{...A};var $e=(0,b.memo)(function({speed:e=I.params.speed,frame:t=I.params.frame,colorBack:n=I.params.colorBack,colorShadow:r=I.params.colorShadow,colorHighlight:i=I.params.colorHighlight,image:a=``,shadows:o=I.params.shadows,angle:s=I.params.angle,distortion:c=I.params.distortion,distortionShape:l=I.params.distortionShape,highlights:u=I.params.highlights,shape:d=I.params.shape,shift:f=I.params.shift,blur:p=I.params.blur,edges:m=I.params.edges,margin:h,marginLeft:g=h??I.params.marginLeft,marginRight:_=h??I.params.marginRight,marginTop:v=h??I.params.marginTop,marginBottom:y=h??I.params.marginBottom,grainMixer:b=I.params.grainMixer,grainOverlay:S=I.params.grainOverlay,stretch:C=I.params.stretch,count:w,size:T=w===void 0?I.params.size:(1/(w*1.6))**(1/6)/.7-.5,fit:E=I.params.fit,scale:D=I.params.scale,rotation:O=I.params.rotation,originX:k=I.params.originX,originY:ee=I.params.originY,offsetX:te=I.params.offsetX,offsetY:ne=I.params.offsetY,worldWidth:re=I.params.worldWidth,worldHeight:ie=I.params.worldHeight,...ae}){let oe={u_image:a,u_colorBack:j(n),u_colorShadow:j(r),u_colorHighlight:j(i),u_shadows:o,u_size:T,u_angle:s,u_distortion:c,u_shift:f,u_blur:p,u_edges:m,u_stretch:C,u_distortionShape:Me[l],u_highlights:u,u_shape:je[d],u_marginLeft:g,u_marginRight:_,u_marginTop:v,u_marginBottom:y,u_grainMixer:b,u_grainOverlay:S,u_fit:ge[E],u_scale:D,u_rotation:O,u_offsetX:te,u_offsetY:ne,u_originX:k,u_originY:ee,u_worldWidth:re,u_worldHeight:ie};return(0,x.jsx)(M,{...ae,speed:e,frame:t,fragmentShader:Ae,mipmaps:[`u_image`],uniforms:oe})}),L={name:`Default`,params:{...A,fit:`cover`,speed:0,frame:0,colorFront:`#94ffaf`,colorBack:`#000c38`,colorHighlight:`#eaff94`,type:`8x8`,size:2,colorSteps:2,originalColors:!1,inverted:!1}};({...A}),{...A},{...A};var et=(0,b.memo)(function({speed:e=L.params.speed,frame:t=L.params.frame,colorFront:n=L.params.colorFront,colorBack:r=L.params.colorBack,colorHighlight:i=L.params.colorHighlight,image:a=``,type:o=L.params.type,colorSteps:s=L.params.colorSteps,originalColors:c=L.params.originalColors,inverted:l=L.params.inverted,pxSize:u,size:d=u===void 0?L.params.size:u,fit:f=L.params.fit,scale:p=L.params.scale,rotation:m=L.params.rotation,originX:h=L.params.originX,originY:g=L.params.originY,offsetX:_=L.params.offsetX,offsetY:v=L.params.offsetY,worldWidth:y=L.params.worldWidth,worldHeight:b=L.params.worldHeight,...S}){let C={u_image:a,u_colorFront:j(n),u_colorBack:j(r),u_colorHighlight:j(i),u_type:Oe[o],u_pxSize:d,u_colorSteps:s,u_originalColors:c,u_inverted:l,u_fit:ge[f],u_rotation:m,u_scale:p,u_offsetX:_,u_offsetY:v,u_originX:h,u_originY:g,u_worldWidth:y,u_worldHeight:b};return(0,x.jsx)(M,{...S,speed:e,frame:t,fragmentShader:Ne,uniforms:C})},Ye),R={name:`Default`,params:{...A,scale:1,fit:`contain`,speed:0,frame:0,spread:.6,bias:1,angle:0,perspective:.1,count:35,dispersion:1,dispersionShift:0,dispersionColor:.6,focusCenter:.8,focusEdges:1,swirl:.35,noise:0,noiseFrequency:.25,noiseOffset:0,lensBulge:0,lensCircle:0,grainMixer:0,grainOverlay:0,imageX:0,imageY:0}};({...A}),{...A},{...A};var tt=(0,b.memo)(function({speed:e=R.params.speed,frame:t=R.params.frame,image:n=``,spread:r=R.params.spread,bias:i=R.params.bias,angle:a=R.params.angle,perspective:o=R.params.perspective,count:s=R.params.count,dispersion:c=R.params.dispersion,dispersionShift:l=R.params.dispersionShift,dispersionColor:u=R.params.dispersionColor,focusCenter:d=R.params.focusCenter,focusEdges:f=R.params.focusEdges,swirl:p=R.params.swirl,noise:m=R.params.noise,noiseFrequency:h=R.params.noiseFrequency,noiseOffset:g=R.params.noiseOffset,lensBulge:_=R.params.lensBulge,lensCircle:v=R.params.lensCircle,grainMixer:y=R.params.grainMixer,grainOverlay:b=R.params.grainOverlay,imageX:S=R.params.imageX,imageY:C=R.params.imageY,fit:w=R.params.fit,scale:T=R.params.scale,rotation:E=R.params.rotation,originX:D=R.params.originX,originY:O=R.params.originY,offsetX:k=R.params.offsetX,offsetY:ee=R.params.offsetY,worldWidth:te=R.params.worldWidth,worldHeight:ne=R.params.worldHeight,...re}){let ie={u_image:n,u_spread:r,u_bias:i,u_angle:a,u_perspective:o,u_count:s,u_dispersion:c,u_dispersionShift:l,u_dispersionColor:u,u_focusCenter:d,u_focusEdges:f,u_swirl:p,u_noise:m,u_noiseFrequency:h,u_noiseOffset:g,u_lensBulge:_,u_lensCircle:v,u_grainMixer:y,u_grainOverlay:b,u_imageX:S,u_imageY:C,u_fit:ge[w],u_rotation:E,u_scale:T,u_offsetX:k,u_offsetY:ee,u_originX:D,u_originY:O,u_worldWidth:te,u_worldHeight:ne};return(0,x.jsx)(M,{...re,speed:e,frame:t,fragmentShader:Pe,mipmaps:[`u_image`],uniforms:ie})},Ye),z={name:`Default`,params:{...A,fit:`cover`,speed:0,frame:0,colorBack:`#f2f1e8`,colorFront:`#2b2b2b`,size:.5,radius:1.25,contrast:.4,originalColors:!1,inverted:!1,grainMixer:.2,grainOverlay:.2,grainSize:.5,grid:`hex`,type:`gooey`}};({...A}),{...A},{...A};var nt=(0,b.memo)(function({speed:e=z.params.speed,frame:t=z.params.frame,colorFront:n=z.params.colorFront,colorBack:r=z.params.colorBack,image:i=``,size:a=z.params.size,radius:o=z.params.radius,contrast:s=z.params.contrast,originalColors:c=z.params.originalColors,inverted:l=z.params.inverted,grainMixer:u=z.params.grainMixer,grainOverlay:d=z.params.grainOverlay,grainSize:f=z.params.grainSize,grid:p=z.params.grid,type:m=z.params.type,fit:h=z.params.fit,scale:g=z.params.scale,rotation:_=z.params.rotation,originX:v=z.params.originX,originY:y=z.params.originY,offsetX:b=z.params.offsetX,offsetY:S=z.params.offsetY,worldWidth:C=z.params.worldWidth,worldHeight:w=z.params.worldHeight,...T}){let E={u_image:i,u_colorFront:j(n),u_colorBack:j(r),u_size:a,u_radius:o,u_contrast:s,u_originalColors:c,u_inverted:l,u_grainMixer:u,u_grainOverlay:d,u_grainSize:f,u_grid:Le[p],u_type:Ie[m],u_fit:ge[h],u_rotation:_,u_scale:g,u_offsetX:b,u_offsetY:S,u_originX:v,u_originY:y,u_worldWidth:C,u_worldHeight:w};return(0,x.jsx)(M,{...T,speed:e,frame:t,fragmentShader:Fe,uniforms:E})},Ye),rt=921600,it=.12,B=e=>Math.min(1,Math.max(0,e/255)),at=e=>Math.min(2,Math.max(0,e)),ot=e=>Math.min(1,Math.max(0,e)),st=(e,t,n)=>e+(t-e)*n,ct=(e,t,n,r,i)=>(B(e)*.22+B(t)*.18+B(n)*.22+B(r)*.28+B(i)*.1)**.55,lt=(e,t,n)=>Math.max(n*.84,ot((e-t)*7)),ut=(e,t)=>ot(e*.42+t*.85),dt=(e,t,n)=>n?ut(e,t):ot(e),ft=(e,t,n,r)=>at(r?e*it:st(e,t,n)),pt=(e,t,n)=>{let r=e[0]??t.secondaryColor;if(n===`cover-only`){let t=e[1]??r,n=e[2]??t;return{ditheringBack:n,ditheringFront:r,mesh:[r,t,n,e[3]??r,e[4]??t,e[5]??n]}}let i=e[1]??t.primaryColor,a=e[2]??r,o=e[3]??i;return{ditheringBack:t.backgroundColor,ditheringFront:r,mesh:[r,i,a,o,t.backgroundColor,t.accentColor]}},mt=b.memo(({theme:e,coverUrl:t,audioPower:n,audioBands:i,staticMode:a,paused:s,tuning:c})=>{let l=(0,b.useRef)(null),u=(0,b.useRef)(null),d=(0,b.useRef)(null),f=(0,b.useRef)(null),p=(0,b.useRef)(s),[m,h]=(0,b.useState)([]),g=c??r,_=g.displayMode!==`mesh`,v=g.displayMode!==`dithering`;p.current=s,(0,b.useEffect)(()=>{let e=!0;return t?(o(t,6).then(t=>{e&&h(t)}),()=>{e=!1}):(h([]),()=>{e=!1})},[t]);let y=(0,b.useMemo)(()=>pt(m,e,g.colorSource),[m,e,g.colorSource]);return(0,b.useEffect)(()=>{let e=l.current?.paperShaderMount,t=u.current?.paperShaderMount;if(a){e?.setSpeed(0),t?.setSpeed(0);return}let r=0,o=0,s=0,c=0,m=0,h=0,_=0,y=()=>{let e=p.current,t=e?0:B(n.get()),a=e?0:B(i.bass.get()),b=e?0:ct(i.bass.get(),i.lowMid.get(),i.mid.get(),i.vocal.get(),i.treble.get()),x=e?0:B(Math.max(i.mid.get(),i.vocal.get()));o=st(o,t,.12),s=st(s,a,.16),c=st(c,x,.13),_=g.enhancedBeatResponse?lt(b,h,_):0,h=b;let S=dt(b,_,g.enhancedBeatResponse);m=st(m,S,S>m?.42:.14);let C=l.current?.paperShaderMount,w=u.current?.paperShaderMount;C?.setSpeed(ft(g.ditheringSpeed,g.ditheringAudioSpeed,m,e)),C?.setUniforms({u_pxSize:Math.max(.5,g.ditheringSize-s*g.ditheringSize*.34)}),w?.setSpeed(ft(g.meshSpeed,g.meshAudioSpeed,m,e)),w?.setUniforms({u_distortion:g.meshDistortion+o*.62,u_swirl:g.meshSwirl+c*.38}),d.current&&(d.current.style.opacity=v?`${Math.min(1,g.ditheringOpacity+s*.25)}`:`1`,d.current.style.transform=`scale(${1.015+s*.025})`),f.current&&(f.current.style.filter=`saturate(${1.04+c*.34}) brightness(${.94+o*.16})`,f.current.style.transform=`scale(${1.025+o*.018})`),r=requestAnimationFrame(y)};return r=requestAnimationFrame(y),()=>cancelAnimationFrame(r)},[i,n,v,a,g]),(0,x.jsxs)(`div`,{className:`absolute inset-0 z-0 overflow-hidden`,style:{backgroundColor:e.backgroundColor,pointerEvents:`none`},children:[v&&(0,x.jsx)(`div`,{ref:f,className:`absolute inset-0`,style:{transform:`scale(1.025)`,transformOrigin:`center`},children:(0,x.jsx)(Xe,{ref:u,width:`100%`,height:`100%`,colors:y.mesh,distortion:g.meshDistortion,swirl:g.meshSwirl,grainMixer:0,grainOverlay:.01,speed:a?0:ft(g.meshSpeed,g.meshAudioSpeed,0,s),minPixelRatio:1,maxPixelCount:rt,style:{width:`100%`,height:`100%`}})}),_&&(0,x.jsx)(`div`,{ref:d,className:`absolute inset-0`,style:{mixBlendMode:v?`soft-light`:`normal`,opacity:v?g.ditheringOpacity:1,transform:`scale(1.015)`,transformOrigin:`center`},children:(0,x.jsx)(Ze,{ref:l,width:`100%`,height:`100%`,colorBack:y.ditheringBack,colorFront:y.ditheringFront,shape:`warp`,type:`4x4`,size:g.ditheringSize,speed:a?0:ft(g.ditheringSpeed,g.ditheringAudioSpeed,0,s),minPixelRatio:1,maxPixelCount:rt,style:{width:`100%`,height:`100%`}})}),g.overlayEnabled&&g.overlayOpacity>0&&(0,x.jsx)(`div`,{className:`absolute inset-0`,style:{backgroundColor:e.backgroundColor,opacity:g.overlayOpacity}})]})}),V=({label:e,value:t,min:n,max:r,step:i,format:a=e=>e.toFixed(1),rangeInputClass:o,theme:s,onChange:c,onPointerDown:l,onPointerUp:u,disabled:d=!1})=>(0,x.jsxs)(`label`,{className:`block space-y-2`,children:[(0,x.jsxs)(`span`,{className:`flex justify-between gap-3 text-sm`,style:{color:s.primaryColor},children:[(0,x.jsx)(`span`,{children:e}),(0,x.jsx)(`span`,{className:`font-mono opacity-70`,children:a(t)})]}),(0,x.jsx)(`input`,{type:`range`,min:n,max:r,step:i,value:t,disabled:d,onChange:e=>c(Number(e.target.value)),onPointerDown:l,onPointerUp:u,className:o})]}),ht=({t:e,isDaylight:t,theme:n,controlCardBg:r,rangeInputClass:i,tuning:a,onTuningChange:o,onSliderPointerDown:s,onSliderCommit:c})=>{let l=u(n.secondaryColor,t?.18:.16),d=u(n.accentColor,t?.1:.16),f=[[`dithering`,e(`options.latentDisplayDithering`)],[`mesh`,e(`options.latentDisplayMesh`)],[`both`,e(`options.latentDisplayBoth`)]],p=[[`cover-theme`,e(`options.latentColorSourceCoverTheme`)],[`cover-only`,e(`options.latentColorSourceCoverOnly`)]],m={rangeInputClass:i,theme:n,onPointerDown:s,onPointerUp:c};return(0,x.jsxs)(`div`,{className:`rounded-[24px] border p-4 space-y-5`,style:{backgroundColor:r,borderColor:l},children:[(0,x.jsxs)(`div`,{className:`space-y-1`,children:[(0,x.jsx)(`div`,{className:`text-sm font-medium`,style:{color:n.primaryColor},children:e(`options.latentBackgroundSettings`)}),(0,x.jsx)(`div`,{className:`text-xs opacity-70`,style:{color:n.secondaryColor},children:e(`options.latentBackgroundSettingsDesc`)})]}),(0,x.jsxs)(`div`,{className:`space-y-2`,children:[(0,x.jsx)(`div`,{className:`text-sm`,style:{color:n.primaryColor},children:e(`options.latentDisplayMode`)}),(0,x.jsx)(`div`,{className:`grid grid-cols-3 gap-2`,children:f.map(([e,t])=>(0,x.jsx)(`button`,{type:`button`,onClick:()=>o?.({displayMode:e}),className:`rounded-xl border px-2 py-2 text-xs`,style:{borderColor:a.displayMode===e?n.accentColor:l,backgroundColor:a.displayMode===e?d:`transparent`,color:n.primaryColor},children:t},e))})]}),(0,x.jsxs)(`div`,{className:`space-y-2`,children:[(0,x.jsx)(`div`,{className:`text-sm`,style:{color:n.primaryColor},children:e(`options.latentColorSource`)}),(0,x.jsx)(`div`,{className:`grid grid-cols-2 gap-2`,children:p.map(([e,t])=>(0,x.jsx)(`button`,{type:`button`,onClick:()=>o?.({colorSource:e}),className:`rounded-xl border px-2 py-2 text-xs`,style:{borderColor:a.colorSource===e?n.accentColor:l,backgroundColor:a.colorSource===e?d:`transparent`,color:n.primaryColor},children:t},e))})]}),(0,x.jsx)(E,{label:e(`options.latentDynamicOnlyInPlayer`),description:e(`options.latentDynamicOnlyInPlayerDesc`),checked:a.dynamicOnlyInPlayer,onChange:e=>o?.({dynamicOnlyInPlayer:e}),theme:n}),(0,x.jsx)(E,{label:e(`options.latentEnhancedBeatResponse`),description:e(`options.latentEnhancedBeatResponseDesc`),checked:a.enhancedBeatResponse,onChange:e=>o?.({enhancedBeatResponse:e}),theme:n}),(0,x.jsxs)(`div`,{className:`space-y-3 rounded-2xl border p-3`,style:{borderColor:l},children:[(0,x.jsx)(E,{label:e(`options.nomandBackgroundOverlay`),description:e(`options.nomandBackgroundOverlayDesc`),checked:a.overlayEnabled,onChange:e=>o?.({overlayEnabled:e}),theme:n}),(0,x.jsx)(`div`,{className:a.overlayEnabled?``:`opacity-45`,children:(0,x.jsx)(V,{...m,label:e(`options.nomandBackgroundOverlayOpacity`),value:a.overlayOpacity,disabled:!a.overlayEnabled,min:0,max:1,step:.05,format:e=>`${Math.round(e*100)}%`,onChange:e=>o?.({overlayOpacity:e})})})]}),(0,x.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:l},children:[(0,x.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.latentDitheringGroup`)}),(0,x.jsx)(V,{...m,label:e(`options.latentBaseSpeed`),value:a.ditheringSpeed,min:0,max:2,step:.1,onChange:e=>o?.({ditheringSpeed:e})}),(0,x.jsx)(V,{...m,label:e(`options.latentAudioSpeed`),value:a.ditheringAudioSpeed,min:0,max:2,step:.1,onChange:e=>o?.({ditheringAudioSpeed:e})}),(0,x.jsx)(V,{...m,label:e(`options.latentDitheringSize`),value:a.ditheringSize,min:.5,max:8,step:.25,onChange:e=>o?.({ditheringSize:e})}),(0,x.jsx)(V,{...m,label:e(`options.latentDitheringOpacity`),value:a.ditheringOpacity,min:0,max:1,step:.05,format:e=>`${Math.round(e*100)}%`,onChange:e=>o?.({ditheringOpacity:e})})]}),(0,x.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:l},children:[(0,x.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.latentMeshGroup`)}),(0,x.jsx)(V,{...m,label:e(`options.latentBaseSpeed`),value:a.meshSpeed,min:0,max:2,step:.1,onChange:e=>o?.({meshSpeed:e})}),(0,x.jsx)(V,{...m,label:e(`options.latentAudioSpeed`),value:a.meshAudioSpeed,min:0,max:2,step:.1,onChange:e=>o?.({meshAudioSpeed:e})}),(0,x.jsx)(V,{...m,label:e(`options.latentMeshDistortion`),value:a.meshDistortion,min:0,max:2,step:.05,onChange:e=>o?.({meshDistortion:e})}),(0,x.jsx)(V,{...m,label:e(`options.latentMeshSwirl`),value:a.meshSwirl,min:0,max:1,step:.05,onChange:e=>o?.({meshSwirl:e})})]})]})},gt=[`dithering`,`mesh`,`both`],_t={dithering:`options.latentDisplayDithering`,mesh:`options.latentDisplayMesh`,both:`options.latentDisplayBoth`},vt=S({mode:`latent`,order:35,labelKey:`options.visualizerBackgroundModeLatent`,labelFallback:`Latent`,render:({config:e,theme:t,coverUrl:n,audioPower:r,audioBands:i,staticMode:a,paused:o})=>(0,x.jsx)(mt,{theme:t,coverUrl:n,audioPower:r,audioBands:i,staticMode:a,paused:o,tuning:e?.latent?.tuning}),renderSettingsPanel:({config:e,actions:t,...n})=>(0,x.jsx)(ht,{...n,tuning:e?.latent?.tuning??r,onTuningChange:t?.latent?.onTuningChange}),renderQuickControls:({config:e,actions:t,t:n,isDaylight:i,theme:a})=>{let o=e?.latent?.tuning??r,s=n(_t[o.displayMode]);return(0,x.jsxs)(x.Fragment,{children:[(0,x.jsx)(C,{isDaylight:i,label:s,title:`${n(`options.latentDisplayMode`)}: ${s}`,onClick:()=>{let e=gt.indexOf(o.displayMode);t?.latent?.onTuningChange?.({displayMode:gt[(e+1)%gt.length]})}}),(0,x.jsx)(w,{active:o.overlayEnabled,theme:a,label:n(`options.nomandBackgroundOverlay`),onToggle:()=>t?.latent?.onTuningChange?.({overlayEnabled:!o.overlayEnabled}),children:(0,x.jsx)(f,{size:14})})]})},resetSettings:e=>e?.latent?.onResetTuning?.()});function yt(){return(yt=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e}).apply(this,arguments)}function bt(e,t){if(e==null)return{};var n,r,i={},a=Object.keys(e);for(r=0;r<a.length;r++)t.indexOf(n=a[r])>=0||(i[n]=e[n]);return i}function xt(e){var t=(0,b.useRef)(e),n=(0,b.useRef)(function(e){t.current&&t.current(e)});return t.current=e,n.current}var St=function(e,t,n){return t===void 0&&(t=0),n===void 0&&(n=1),e>n?n:e<t?t:e},Ct=function(e){return`touches`in e},wt=function(e){return e&&e.ownerDocument.defaultView||self},Tt=function(e,t,n){var r=e.getBoundingClientRect(),i=Ct(t)?function(e,t){for(var n=0;n<e.length;n++)if(e[n].identifier===t)return e[n];return e[0]}(t.touches,n):t;return{left:St((i.pageX-(r.left+wt(e).pageXOffset))/r.width),top:St((i.pageY-(r.top+wt(e).pageYOffset))/r.height)}},Et=function(e){!Ct(e)&&e.preventDefault()},Dt=b.memo(function(e){var t=e.onMove,n=e.onKey,r=e.onEnd,i=bt(e,[`onMove`,`onKey`,`onEnd`]),a=(0,b.useRef)(null),o=xt(t),s=xt(n),c=xt(r),l=(0,b.useRef)(null),u=(0,b.useRef)(!1),d=(0,b.useMemo)(function(){var e=function(e){Et(e),(Ct(e)?e.touches.length>0:e.buttons>0)&&a.current?o(Tt(a.current,e,l.current)):(n(!1),c())},t=function(){n(!1),c()};function n(n){var r=u.current,i=wt(a.current),o=n?i.addEventListener:i.removeEventListener;o(r?`touchmove`:`mousemove`,e),o(r?`touchend`:`mouseup`,t)}return[function(e){var t=e.nativeEvent,r=a.current;if(r&&(Et(t),!function(e,t){return t&&!Ct(e)}(t,u.current)&&r)){if(Ct(t)){u.current=!0;var i=t.changedTouches||[];i.length&&(l.current=i[0].identifier)}r.focus(),o(Tt(r,t,l.current)),n(!0)}},function(e){var t=e.which||e.keyCode;t<37||t>40||(e.preventDefault(),s({left:t===39?.05:t===37?-.05:0,top:t===40?.05:t===38?-.05:0}))},function(e){var t=e.which||e.keyCode;t>=37&&t<=40&&c()},n]},[s,o,c]),f=d[0],p=d[1],m=d[2],h=d[3];return(0,b.useEffect)(function(){return h},[h]),b.createElement(`div`,yt({},i,{onTouchStart:f,onMouseDown:f,className:`react-colorful__interactive`,ref:a,onKeyDown:p,onKeyUp:m,tabIndex:0,role:`slider`}))}),Ot=function(e){return e.filter(Boolean).join(` `)},kt=function(e){var t=e.color,n=e.left,r=e.top,i=r===void 0?.5:r,a=Ot([`react-colorful__pointer`,e.className]);return b.createElement(`div`,{className:a,style:{top:100*i+`%`,left:100*n+`%`}},b.createElement(`div`,{className:`react-colorful__pointer-fill`,style:{backgroundColor:t}}))},H=function(e,t,n){return t===void 0&&(t=0),n===void 0&&(n=10**t),Math.round(n*e)/n},At=function(e){return Rt(jt(e))},jt=function(e){return e[0]===`#`&&(e=e.substring(1)),e.length<6?{r:parseInt(e[0]+e[0],16),g:parseInt(e[1]+e[1],16),b:parseInt(e[2]+e[2],16),a:e.length===4?H(parseInt(e[3]+e[3],16)/255,2):1}:{r:parseInt(e.substring(0,2),16),g:parseInt(e.substring(2,4),16),b:parseInt(e.substring(4,6),16),a:e.length===8?H(parseInt(e.substring(6,8),16)/255,2):1}},Mt=function(e){return Lt(Ft(e))},Nt=function(e){var t=e.s,n=e.v,r=e.a,i=(200-t)*n/100;return{h:H(e.h),s:H(i>0&&i<200?t*n/100/(i<=100?i:200-i)*100:0),l:H(i/2),a:H(r,2)}},Pt=function(e){var t=Nt(e);return`hsl(`+t.h+`, `+t.s+`%, `+t.l+`%)`},Ft=function(e){var t=e.h,n=e.s,r=e.v,i=e.a;t=t/360*6,n/=100,r/=100;var a=Math.floor(t),o=r*(1-n),s=r*(1-(t-a)*n),c=r*(1-(1-t+a)*n),l=a%6;return{r:H(255*[r,s,o,o,c,r][l]),g:H(255*[c,r,r,s,o,o][l]),b:H(255*[o,o,c,r,r,s][l]),a:H(i,2)}},It=function(e){var t=e.toString(16);return t.length<2?`0`+t:t},Lt=function(e){var t=e.r,n=e.g,r=e.b,i=e.a,a=i<1?It(H(255*i)):``;return`#`+It(t)+It(n)+It(r)+a},Rt=function(e){var t=e.r,n=e.g,r=e.b,i=e.a,a=Math.max(t,n,r),o=a-Math.min(t,n,r),s=o?a===t?(n-r)/o:a===n?2+(r-t)/o:4+(t-n)/o:0;return{h:60*(s<0?s+6:s),s:a?o/a*100:0,v:a/255*100,a:i}},zt=b.memo(function(e){var t=e.hue,n=e.onChange,r=e.onChangeEnd,i=Ot([`react-colorful__hue`,e.className]);return b.createElement(`div`,{className:i},b.createElement(Dt,{onMove:function(e){n({h:360*e.left})},onKey:function(e){n({h:St(t+360*e.left,0,360)})},onEnd:r,"aria-label":`Hue`,"aria-valuenow":H(t),"aria-valuemax":`360`,"aria-valuemin":`0`},b.createElement(kt,{className:`react-colorful__hue-pointer`,left:t/360,color:Pt({h:t,s:100,v:100,a:1})})))}),Bt=b.memo(function(e){var t=e.hsva,n=e.onChange,r=e.onChangeEnd,i={backgroundColor:Pt({h:t.h,s:100,v:100,a:1})};return b.createElement(`div`,{className:`react-colorful__saturation`,style:i},b.createElement(Dt,{onMove:function(e){n({s:100*e.left,v:100-100*e.top})},onKey:function(e){n({s:St(t.s+100*e.left,0,100),v:St(t.v-100*e.top,0,100)})},onEnd:r,"aria-label":`Color`,"aria-valuetext":`Saturation `+H(t.s)+`%, Brightness `+H(t.v)+`%`},b.createElement(kt,{className:`react-colorful__saturation-pointer`,top:1-t.v/100,left:t.s/100,color:Pt(t)})))}),Vt=function(e,t){if(e===t)return!0;for(var n in e)if(e[n]!==t[n])return!1;return!0},Ht=function(e,t){return e.toLowerCase()===t.toLowerCase()||Vt(jt(e),jt(t))};function Ut(e,t,n,r){var i=xt(n),a=xt(r),o=(0,b.useState)(function(){return e.toHsva(t)}),s=o[0],c=o[1],l=(0,b.useRef)({color:t,hsva:s}),u=(0,b.useRef)(!1);return(0,b.useEffect)(function(){if(!e.equal(t,l.current.color)){var n=e.toHsva(t);l.current={hsva:n,color:t},c(n),u.current=!1}},[t,e]),(0,b.useEffect)(function(){var t;Vt(s,l.current.hsva)||e.equal(t=e.fromHsva(s),l.current.color)||(l.current={hsva:s,color:t},i(t),u.current=!0)},[s,e,i]),[s,(0,b.useCallback)(function(e){c(function(t){return Object.assign({},t,e)})},[]),(0,b.useCallback)(function(){u.current&&(u.current=!1,a(l.current.color))},[a])]}var Wt=typeof window<`u`?b.useLayoutEffect:b.useEffect,Gt=function(){return typeof __webpack_nonce__<`u`?__webpack_nonce__:void 0},Kt=new WeakMap,qt=function(e){Wt(function(){var t=e.current;if(typeof document<`u`&&t){var n=t.getRootNode?t.getRootNode():t.ownerDocument,r=n&&(`head`in n||`host`in n)?n:t.ownerDocument;if(!Kt.has(r)){var i=`head`in r?r.head:r,a=(i.ownerDocument||document).createElement(`style`);a.innerHTML=`.react-colorful{position:relative;display:flex;flex-direction:column;width:200px;height:200px;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;cursor:default}.react-colorful__saturation{position:relative;flex-grow:1;border-color:transparent;border-bottom:12px solid #000;border-radius:8px 8px 0 0;background-image:linear-gradient(0deg,#000,transparent),linear-gradient(90deg,#fff,hsla(0,0%,100%,0))}.react-colorful__alpha-gradient,.react-colorful__pointer-fill{content:"";position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;border-radius:inherit}.react-colorful__alpha-gradient,.react-colorful__saturation{box-shadow:inset 0 0 0 1px rgba(0,0,0,.05)}.react-colorful__alpha,.react-colorful__hue{position:relative;height:24px}.react-colorful__hue{background:linear-gradient(90deg,red 0,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,red)}.react-colorful__last-control{border-radius:0 0 8px 8px}.react-colorful__interactive{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;outline:none;touch-action:none}.react-colorful__pointer{position:absolute;z-index:1;box-sizing:border-box;width:28px;height:28px;transform:translate(-50%,-50%);background-color:#fff;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.2)}.react-colorful__interactive:focus .react-colorful__pointer{transform:translate(-50%,-50%) scale(1.1)}.react-colorful__alpha,.react-colorful__alpha-pointer{background-color:#fff;background-image:url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill-opacity=".05"><path d="M8 0h8v8H8zM0 8h8v8H0z"/></svg>')}.react-colorful__saturation-pointer{z-index:3}.react-colorful__hue-pointer{z-index:2}`;var o=Gt();o&&a.setAttribute(`nonce`,o),Kt.set(r,a),i.appendChild(a)}}},[])},Jt=function(e){var t=e.className,n=e.colorModel,r=e.color,i=r===void 0?n.defaultColor:r,a=e.onChange,o=e.onChangeEnd,s=bt(e,[`className`,`colorModel`,`color`,`onChange`,`onChangeEnd`]),c=(0,b.useRef)(null);qt(c);var l=Ut(n,i,a,o),u=l[0],d=l[1],f=l[2],p=Ot([`react-colorful`,t]);return b.createElement(`div`,yt({},s,{ref:c,className:p}),b.createElement(Bt,{hsva:u,onChange:d,onChangeEnd:f}),b.createElement(zt,{hue:u.h,onChange:d,onChangeEnd:f,className:`react-colorful__last-control`}))},Yt={defaultColor:`000`,toHsva:At,fromHsva:function(e){return Mt({h:e.h,s:e.s,v:e.v,a:1})},equal:Ht},Xt=function(e){return b.createElement(Jt,yt({},e,{colorModel:Yt}))},Zt=({children:e,theme:t})=>(0,x.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.24em] opacity-45`,style:{color:t.secondaryColor},children:e}),Qt=({label:e,value:t,options:n,onChange:r,isDaylight:i,theme:a})=>(0,x.jsxs)(`div`,{className:`space-y-2.5`,children:[(0,x.jsx)(Zt,{theme:a,children:e}),(0,x.jsx)(`div`,{className:`flex flex-wrap gap-2`,children:n.map(e=>{let n=e.value===t;return(0,x.jsx)(`button`,{type:`button`,onClick:()=>{e.disabled||r(e.value)},disabled:e.disabled,className:`rounded-full border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45`,style:{color:e.disabled?u(a.secondaryColor,.72):a.primaryColor,borderColor:n?a.accentColor:u(a.secondaryColor,i?.18:.14),backgroundColor:n?u(a.accentColor,i?.1:.16):u(a.backgroundColor,i?.24:.34),boxShadow:n?`inset 0 0 0 1px ${a.accentColor}`:`none`},children:e.label},String(e.value))})})]}),$t=({label:e,valueLabel:t,value:n,min:r,max:i,step:a,onChange:o,rangeInputClass:s,onSliderPointerDown:c,onSliderCommit:l})=>(0,x.jsxs)(`div`,{className:`space-y-2`,children:[(0,x.jsxs)(`div`,{className:`flex items-center justify-between gap-3 text-sm`,style:{color:`var(--text-primary)`},children:[(0,x.jsx)(`span`,{children:e}),(0,x.jsx)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:t})]}),(0,x.jsx)(`input`,{type:`range`,min:r,max:i,step:a,value:n,onChange:e=>o(parseFloat(e.target.value)),onPointerDown:c,onPointerUp:l,onPointerCancel:l,onBlur:l,className:s})]}),U=(e,t,n,r)=>Number.isFinite(e)?Math.min(n,Math.max(t,e)):r,en=e=>{let t=e.trim().replace(/^#/,``);return/^[0-9a-fA-F]{6}$/.test(t)?`#${t.toLowerCase()}`:null},tn=({t:e,isDaylight:t,theme:n,controlCardBg:r,rangeInputClass:i,tuning:a=c,onTuningChange:o,monetBackgroundImage:s,onUploadMonetBackgroundImage:l,onClearMonetBackgroundImage:d,isLoadingMonetBackgroundImage:f=!1,onSliderPointerDown:p,onSliderCommit:m})=>{let g=(0,b.useRef)(null),[v,y]=(0,b.useState)(null),S={backgroundSource:a.backgroundSource??c.backgroundSource,backgroundLayout:a.backgroundLayout??c.backgroundLayout,backgroundBlurPx:U(a.backgroundBlurPx??c.backgroundBlurPx,0,60,c.backgroundBlurPx),backgroundOverlayOpacity:U(a.backgroundOverlayOpacity??c.backgroundOverlayOpacity,0,1,c.backgroundOverlayOpacity),backgroundGrayscale:U(a.backgroundGrayscale??c.backgroundGrayscale,0,1,c.backgroundGrayscale),backgroundSaturation:U(a.backgroundSaturation??c.backgroundSaturation,0,2,c.backgroundSaturation),backgroundWash:U(a.backgroundWash??c.backgroundWash,0,1,c.backgroundWash),backgroundHalfPaneOffsetX:U(a.backgroundHalfPaneOffsetX??c.backgroundHalfPaneOffsetX,-40,40,c.backgroundHalfPaneOffsetX),backgroundWashColorMode:a.backgroundWashColorMode??c.backgroundWashColorMode,backgroundWashCustomColor:en(a.backgroundWashCustomColor)??c.backgroundWashCustomColor,backgroundDriftEnabled:a.backgroundDriftEnabled??c.backgroundDriftEnabled,backgroundDriftStrength:U(a.backgroundDriftStrength??c.backgroundDriftStrength,0,1,c.backgroundDriftStrength),backgroundStreaksEnabled:a.backgroundStreaksEnabled??c.backgroundStreaksEnabled},C=(0,b.useMemo)(()=>[{value:`cover-derived`,label:e(`options.monetBackgroundSourceCover`)},{value:`uploaded-global`,label:e(`options.monetBackgroundSourceUploaded`),disabled:!s&&!f}],[f,s,e]),w=(0,b.useMemo)(()=>[{value:`half-pane-gradient`,label:e(`options.monetLayoutHalfPane`)},{value:`full-overlay`,label:e(`options.monetLayoutFullOverlay`)}],[e]),T=(0,b.useMemo)(()=>[{value:`theme`,label:e(`options.monetBackgroundWashTheme`)},{value:`custom`,label:e(`options.monetBackgroundWashCustom`)}],[e]),D=async t=>{let n=Array.from(t.target.files??[]);if(t.target.value=``,y(null),!n.length||!l)return;let r=await l(n);r.ok?(o?.({backgroundSource:`uploaded-global`}),y(n[0].name)):y(r.error||e(`options.monetUploadBackground`))};return(0,x.jsxs)(`div`,{className:`rounded-[24px] border p-4 space-y-4`,style:{backgroundColor:r,borderColor:u(n.secondaryColor,.16)},children:[(0,x.jsxs)(`div`,{className:`space-y-1`,children:[(0,x.jsx)(`div`,{className:`text-sm font-medium`,style:{color:n.primaryColor},children:e(`options.monetBackgroundSettings`)}),(0,x.jsx)(`div`,{className:`text-xs opacity-70`,style:{color:n.secondaryColor},children:e(`options.monetBackgroundSettingsDesc`)})]}),(0,x.jsxs)(`div`,{className:`space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5`,children:[(0,x.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wider opacity-65`,style:{color:n.accentColor},children:e(`options.monetGroupBackgroundSource`)}),(0,x.jsx)(Qt,{label:e(`options.monetBackgroundSource`),value:S.backgroundSource,options:C,onChange:e=>o?.({backgroundSource:e}),isDaylight:t,theme:n}),(0,x.jsxs)(`div`,{className:`space-y-2.5`,children:[(0,x.jsx)(Zt,{theme:n,children:e(`options.monetUploadBackground`)}),(0,x.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2`,children:[(0,x.jsxs)(`button`,{type:`button`,onClick:()=>g.current?.click(),disabled:f||!l,className:`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45`,style:{color:n.primaryColor,borderColor:u(n.secondaryColor,t?.18:.14),backgroundColor:u(n.backgroundColor,t?.24:.34)},children:[(0,x.jsx)(_,{size:15}),(0,x.jsx)(`span`,{children:e(`options.monetUploadBackground`)})]}),(0,x.jsxs)(`button`,{type:`button`,onClick:()=>void d?.(),disabled:!s||!d,className:`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45`,style:{color:n.primaryColor,borderColor:u(n.secondaryColor,t?.18:.14),backgroundColor:u(n.backgroundColor,t?.24:.34)},children:[(0,x.jsx)(h,{size:15}),(0,x.jsx)(`span`,{children:e(`options.monetClearBackground`)})]})]}),(0,x.jsx)(`div`,{className:`text-xs opacity-60`,style:{color:`var(--text-secondary)`},children:v||s?.name||`-`}),(0,x.jsx)(`input`,{ref:g,type:`file`,accept:`.png,.jpg,.jpeg,.gif,.webp,.svg,image/*`,className:`hidden`,onChange:e=>void D(e)})]})]}),(0,x.jsxs)(`div`,{className:`space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5`,children:[(0,x.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wider opacity-65`,style:{color:n.accentColor},children:e(`options.monetGroupLayoutPosition`)}),(0,x.jsx)(Qt,{label:e(`options.monetBackgroundLayout`),value:S.backgroundLayout,options:w,onChange:e=>o?.({backgroundLayout:e}),isDaylight:t,theme:n}),S.backgroundLayout===`half-pane-gradient`&&(0,x.jsx)($t,{label:e(`options.monetHalfPaneOffsetX`),valueLabel:`${Math.round(S.backgroundHalfPaneOffsetX)}%`,min:-40,max:40,step:2,value:S.backgroundHalfPaneOffsetX,onChange:e=>o?.({backgroundHalfPaneOffsetX:e}),rangeInputClass:i,onSliderPointerDown:p,onSliderCommit:m}),(0,x.jsx)(E,{label:e(`options.monetBackgroundDriftEnabled`),description:e(`options.monetBackgroundDriftEnabledDesc`),checked:S.backgroundDriftEnabled,onChange:e=>o?.({backgroundDriftEnabled:e}),theme:n}),S.backgroundDriftEnabled&&(0,x.jsx)($t,{label:e(`options.monetBackgroundDriftStrength`),valueLabel:`${Math.round(S.backgroundDriftStrength*100)}%`,min:0,max:1,step:.05,value:S.backgroundDriftStrength,onChange:e=>o?.({backgroundDriftStrength:e}),rangeInputClass:i,onSliderPointerDown:p,onSliderCommit:m})]}),(0,x.jsxs)(`div`,{className:`space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5`,children:[(0,x.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wider opacity-65`,style:{color:n.accentColor},children:e(`options.monetGroupFiltersPostProcessing`)}),(0,x.jsx)($t,{label:e(`options.monetBackgroundBlur`),valueLabel:`${Math.round(S.backgroundBlurPx)}px`,min:0,max:60,step:2,value:S.backgroundBlurPx,onChange:e=>o?.({backgroundBlurPx:e}),rangeInputClass:i,onSliderPointerDown:p,onSliderCommit:m}),(0,x.jsx)($t,{label:e(`options.monetBackgroundSaturation`),valueLabel:`${Math.round(S.backgroundSaturation*100)}%`,min:0,max:2,step:.05,value:S.backgroundSaturation,onChange:e=>o?.({backgroundSaturation:e}),rangeInputClass:i,onSliderPointerDown:p,onSliderCommit:m}),(0,x.jsx)($t,{label:e(`options.monetBackgroundGrayscale`),valueLabel:`${Math.round(S.backgroundGrayscale*100)}%`,min:0,max:1,step:.02,value:S.backgroundGrayscale,onChange:e=>o?.({backgroundGrayscale:e}),rangeInputClass:i,onSliderPointerDown:p,onSliderCommit:m})]}),(0,x.jsxs)(`div`,{className:`space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5`,children:[(0,x.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wider opacity-65`,style:{color:n.accentColor},children:e(`options.monetGroupColorTintWash`)}),(0,x.jsx)($t,{label:e(`options.monetBackgroundOverlayOpacity`),valueLabel:`${Math.round(S.backgroundOverlayOpacity*100)}%`,min:0,max:1,step:.02,value:S.backgroundOverlayOpacity,onChange:e=>o?.({backgroundOverlayOpacity:e}),rangeInputClass:i,onSliderPointerDown:p,onSliderCommit:m}),(0,x.jsx)($t,{label:e(`options.monetBackgroundWash`),valueLabel:`${Math.round(S.backgroundWash*100)}%`,min:0,max:1,step:.02,value:S.backgroundWash,onChange:e=>o?.({backgroundWash:e}),rangeInputClass:i,onSliderPointerDown:p,onSliderCommit:m}),(0,x.jsx)(E,{label:e(`options.monetBackgroundStreaksEnabled`),description:e(`options.monetBackgroundStreaksEnabledDesc`),checked:S.backgroundStreaksEnabled,onChange:e=>o?.({backgroundStreaksEnabled:e}),theme:n}),(0,x.jsx)(Qt,{label:e(`options.monetBackgroundWashColorMode`),value:S.backgroundWashColorMode,options:T,onChange:e=>o?.({backgroundWashColorMode:e}),isDaylight:t,theme:n}),S.backgroundWashColorMode===`custom`&&(0,x.jsxs)(`div`,{className:`space-y-3 rounded-[20px] border p-3`,style:{borderColor:u(n.secondaryColor,.14),backgroundColor:u(n.backgroundColor,.2)},children:[(0,x.jsxs)(`div`,{className:`flex items-center justify-between gap-3`,children:[(0,x.jsx)(`div`,{className:`text-sm`,style:{color:n.primaryColor},children:e(`options.monetBackgroundWashCustomColor`)}),(0,x.jsx)(`div`,{className:`rounded-full px-3 py-1 text-xs font-mono`,style:{color:n.backgroundColor,backgroundColor:S.backgroundWashCustomColor},children:S.backgroundWashCustomColor.toUpperCase()})]}),(0,x.jsx)(Xt,{color:S.backgroundWashCustomColor,onChange:e=>o?.({backgroundWashCustomColor:e}),style:{width:`100%`,height:180}})]})]})]})},nn=1920,rn=1080,an=new Map,on={r:10,g:10,b:12},sn={r:245,g:245,b:245},W=(e,t,n)=>Math.min(n,Math.max(t,e)),G=(e,t,n)=>e+(t-e)*n,cn=(e,t,n)=>.2126*e+.7152*t+.0722*n,ln=(e,t)=>cn(e.r,e.g,e.b)<=cn(t.r,t.g,t.b)?{shadow:e,highlight:t}:{shadow:t,highlight:e},un=({coverUrl:e,monetBackgroundImage:t,tuning:n})=>n.backgroundSource===`uploaded-global`?t?.url??e??null:e??t?.url??null,dn=async e=>{let t=new Image;(e.startsWith(`http://`)||e.startsWith(`https://`))&&(t.crossOrigin=`anonymous`),t.decoding=`async`;let n=new Promise((n,r)=>{t.onload=()=>n(),t.onerror=()=>r(Error(`Failed to load image: ${e}`))});t.src=e;try{await t.decode()}catch{await n}return t},fn=(e,t,n)=>{let r=e[t];return typeof r==`number`&&Number.isFinite(r)?r:n},pn=(e,t,n,r)=>{let i=fn(t,`width`,n),a=fn(t,`height`,r);if(!i||!a)return;let o=Math.max(n/i,r/a),s=i*o,c=a*o,l=(n-s)/2,u=(r-c)/2;e.drawImage(t,l,u,s,c)},mn=(e,n)=>{let r=t(e);return r?{r:W(r.r,0,255),g:W(r.g,0,255),b:W(r.b,0,255)}:n},hn=(e,t,n,r)=>{let{shadow:i,highlight:a}=ln(t,r);if(e<=.55){let t=e/.55;return{r:G(i.r,n.r,t),g:G(i.g,n.g,t),b:G(i.b,n.b,t)}}let o=(e-.55)/.45;return{r:G(n.r,a.r,o),g:G(n.g,a.g,o),b:G(n.b,a.b,o)}},gn=(e,t,n,r,i)=>{let a=W(i.backgroundGrayscale,0,1),o=W(i.backgroundSaturation,0,2),s=W(i.backgroundWash,0,1);if(a<=0&&Math.abs(o-1)<.001&&s<=0)return;let c=e.getImageData(0,0,t,n),l=c.data,u=mn(r.backgroundColor,on),d=mn(r.accentColor,u),f=mn(r.primaryColor,sn),p=mn(i.backgroundWashCustomColor,d),m=i.backgroundWashColorMode===`custom`?p:d;for(let e=0;e<l.length;e+=4){let t=l[e],n=l[e+1],r=l[e+2];if(l[e+3]===0)continue;let i=cn(t,n,r);if(a>0&&(t=G(t,i,a),n=G(n,i,a),r=G(r,i,a)),Math.abs(o-1)>=.001){let e=cn(t,n,r);t=e+(t-e)*o,n=e+(n-e)*o,r=e+(r-e)*o}if(s>0){let e=hn(W(i/255,0,1),u,m,f);t=G(t,e.r,s),n=G(n,e.g,s),r=G(r,e.b,s)}l[e]=Math.round(W(t,0,255)),l[e+1]=Math.round(W(n,0,255)),l[e+2]=Math.round(W(r,0,255))}e.putImageData(c,0,0)},_n=(e,t,n,r,i)=>{let a=W(i.backgroundOverlayOpacity,0,1),o=e.createLinearGradient(0,0,t,n);o.addColorStop(0,u(r.accentColor,.08+a*.62)),o.addColorStop(.44,u(r.backgroundColor,.16+a*.58)),o.addColorStop(1,u(r.primaryColor,.06+a*.36)),e.fillStyle=o,e.fillRect(0,0,t,n);let s=e.createRadialGradient(t*.18,n*.34,0,t*.18,n*.34,t*.55);s.addColorStop(0,u(r.accentColor,a*.42)),s.addColorStop(1,u(r.backgroundColor,0)),e.fillStyle=s,e.fillRect(0,0,t,n);let c=e.createLinearGradient(t*.45,0,t,0);if(c.addColorStop(0,u(r.backgroundColor,0)),c.addColorStop(1,u(r.backgroundColor,.18+a*.38)),e.fillStyle=c,e.fillRect(0,0,t,n),i.backgroundStreaksEnabled!==!1){e.fillStyle=u(r.backgroundColor,.1+a*.08);for(let r=0;r<18;r+=1){let i=r*127%t,a=r*211%n-40;e.fillRect(i,a,1,n*.28)}}},vn=({coverUrl:e,monetBackgroundImage:t,theme:n,tuning:r})=>JSON.stringify({sourceUrl:un({coverUrl:e,monetBackgroundImage:t,tuning:r}),uploadedId:r.backgroundSource===`uploaded-global`?t?.id??null:null,theme:{backgroundColor:n.backgroundColor,primaryColor:n.primaryColor,accentColor:n.accentColor},tuning:{backgroundSource:r.backgroundSource,backgroundBlurPx:r.backgroundBlurPx,backgroundOverlayOpacity:r.backgroundOverlayOpacity,backgroundGrayscale:r.backgroundGrayscale,backgroundSaturation:r.backgroundSaturation,backgroundWash:r.backgroundWash,backgroundWashColorMode:r.backgroundWashColorMode,backgroundWashCustomColor:r.backgroundWashCustomColor,backgroundStreaksEnabled:r.backgroundStreaksEnabled}}),yn=null,bn=()=>{if(yn!==null)return yn;if(typeof document>`u`)return!1;try{let e=document.createElement(`canvas`);e.width=2,e.height=2;let t=e.getContext(`2d`);return!t||typeof t.filter!=`string`?(yn=!1,!1):(t.fillStyle=`#000000`,t.fillRect(0,0,2,2),t.filter=`blur(1px)`,t.fillStyle=`#ffffff`,t.fillRect(0,0,1,1),yn=t.getImageData(1,1,1,1).data[0]>0,yn)}catch{return yn=!1,!1}},xn=async({coverUrl:e,monetBackgroundImage:t,theme:n,tuning:r})=>{let i=un({coverUrl:e,monetBackgroundImage:t,tuning:r});if(!i)return null;let a=await dn(i),o=document.createElement(`canvas`);o.width=nn,o.height=rn;let s=o.getContext(`2d`);return s?(s.fillStyle=n.backgroundColor,s.fillRect(0,0,o.width,o.height),s.save(),bn()&&(s.filter=`blur(${W(r.backgroundBlurPx,0,60)}px)`),pn(s,a,o.width,o.height),s.restore(),gn(s,o.width,o.height,n,r),_n(s,o.width,o.height,n,r),o.toDataURL(`image/jpeg`,.92)):null},Sn=e=>{let t=vn(e),n=an.get(t);if(n)return n;let r=xn(e).catch(()=>null);return an.set(t,r),r},Cn=240,wn=76,Tn=156,En=3.4,Dn=.035,On=.01,kn=12.9898,An=78.233,jn=39.425,Mn=(e,t)=>(e%t+t)%t,Nn=(e,t)=>{let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)},Pn=e=>e*e*(3-2*e),Fn=(e,t,n)=>{let r=Math.floor(e),i=Nn(Mn(r,t),n);return i+(Nn(Mn(r+1,t),n)-i)*Pn(e-r)},In=(e,t)=>{let n=Fn(e,wn,t),r=Fn(e*2,152,t+17.31);return(n*.68+r*.32)*2-1},Ln=e=>{let t=e.reduce((e,t)=>Math.max(e,Math.abs(t)),0);return t>0?e.map(e=>e/t):e},Rn=e=>{let t=Math.min(1,Math.max(0,e)),n=En*t,r=1+n/100*2+On,i=Dn*t,a=[],o=[],s=[];for(let e=0;e<=Tn;e+=1){let t=wn*e/Tn;a.push(In(t,kn)),o.push(In(t,An)),s.push(In(t,jn))}let c=Ln(a),l=Ln(o),u=Ln(s);return{keyframes:c.map((e,t)=>({transform:`translate3d(${(e*n).toFixed(4)}%, ${(l[t]*n).toFixed(4)}%, 0) scale(${(r+i*((u[t]+1)/2)).toFixed(5)})`})),durationMs:Cn*1e3,maxTravelPercent:n,minScale:r}},zn=180,Bn=(e,t,n)=>Math.min(n,Math.max(t,e)),Vn=(e,t,n,r)=>{(0,b.useEffect)(()=>{let i=e.current;if(!i||!t||n<=0||typeof i.animate!=`function`||r)return;let a=Rn(n),o=i.animate(a.keyframes,{duration:a.durationMs,iterations:1/0,easing:`linear`});return()=>o.cancel()},[t,e,n,r])},Hn=(e,t,n)=>n.backgroundSource===`uploaded-global`?t?.url??e??null:e??t?.url??null,Un=({coverUrl:e,monetBackgroundImage:t,theme:r,isDaylight:i=!1,tuning:a=c,transparentBackground:o=!1,staticMode:s=!1})=>{let[f,p]=(0,b.useState)(null),m=Hn(e,t,a),h=(0,b.useMemo)(()=>`linear-gradient(135deg, ${u(r.accentColor,.22)}, ${u(r.backgroundColor,.96)} 50%, ${u(r.primaryColor,.18)})`,[r]),g=(0,b.useMemo)(()=>`linear-gradient(90deg, ${u(r.backgroundColor,.18)} 0%, ${u(r.backgroundColor,.32)} 34%, ${u(r.backgroundColor,.66)} 70%, ${u(r.backgroundColor,.82)} 100%)`,[r]),_=(0,b.useMemo)(()=>vn({coverUrl:e,monetBackgroundImage:t,theme:r,tuning:a}),[e,t,r,a]);(0,b.useEffect)(()=>{let n=!1,i;return!m||o?(p(null),()=>{n=!0}):(i=window.setTimeout(()=>{Sn({coverUrl:e,monetBackgroundImage:t,theme:r,tuning:a}).then(e=>{n||p(t=>t===e?t:e)})},zn),()=>{n=!0,i!==void 0&&window.clearTimeout(i)})},[_,m,o]);let v=(0,b.useRef)(null),y=Bn(a.backgroundDriftStrength??0,0,1),S=!!a.backgroundDriftEnabled&&!s&&y>0;Vn(v,S,y,n(`monetBackground`));let C=(0,b.useMemo)(()=>S?{willChange:`transform`}:void 0,[S]),w=(0,b.useMemo)(()=>bn(),[])?0:a.backgroundBlurPx,T=(0,b.useMemo)(()=>w<=0?{}:{filter:`blur(${w}px)`,WebkitFilter:`blur(${w}px)`,transform:`scale(1.1) translateZ(0)`},[w]);if(o)return null;let E=f?`url(${f})`:m?`linear-gradient(135deg, ${u(r.accentColor,.2)}, ${u(r.backgroundColor,.78)}), url(${m})`:h;if(a.backgroundLayout===`full-overlay`)return(0,x.jsxs)(`div`,{className:`absolute inset-0 z-0 overflow-hidden`,children:[(0,x.jsx)(`div`,{ref:v,className:`absolute inset-0`,style:C,children:(0,x.jsx)(d,{initial:!1,children:(0,x.jsx)(l.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.8,ease:`easeInOut`},className:`absolute inset-0`,style:{backgroundColor:r.backgroundColor,backgroundImage:E,backgroundSize:`cover`,backgroundPosition:`center`,...T}},f||m||`fallback`)})}),(0,x.jsx)(`div`,{className:`absolute inset-0`,style:{background:g}})]});let D=(i?.7:.3)+Bn(a.backgroundOverlayOpacity,0,1)*.16,O=Bn(50+a.backgroundHalfPaneOffsetX,10,90);return(0,x.jsxs)(`div`,{className:`absolute inset-0 z-0 overflow-hidden`,children:[(0,x.jsx)(`div`,{className:`absolute inset-0`,style:{backgroundColor:r.backgroundColor,backgroundImage:h}}),(0,x.jsx)(d,{initial:!1,children:f||m?(0,x.jsx)(`div`,{className:`absolute inset-y-0 left-0 w-[72%] sm:w-[68%] lg:w-[60%] overflow-hidden`,style:{WebkitMaskImage:`linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 48%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0) 100%)`,maskImage:`linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 48%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0) 100%)`},children:(0,x.jsx)(`div`,{ref:v,className:`absolute inset-0`,style:C,children:(0,x.jsx)(l.div,{initial:{opacity:0},animate:{opacity:D},exit:{opacity:0},transition:{duration:.8,ease:`easeInOut`},className:`absolute inset-0`,style:{backgroundImage:E,backgroundRepeat:`no-repeat`,backgroundSize:`cover`,backgroundPosition:`${O}% center`,...T}},f||m||`fallback`)})}):null}),(0,x.jsx)(`div`,{className:`absolute inset-0`,style:{background:`linear-gradient(90deg, ${u(r.backgroundColor,.14)} 0%, ${u(r.backgroundColor,.28)} 28%, ${u(r.backgroundColor,.62)} 64%, ${u(r.backgroundColor,.86)} 100%)`}}),(0,x.jsx)(`div`,{className:`absolute inset-0`,style:{backgroundImage:`radial-gradient(circle at 18% 34%, ${u(r.accentColor,.18)}, transparent 36%)`,backgroundSize:`cover`,backgroundPosition:`center`}}),(0,x.jsx)(`div`,{className:`absolute inset-0`,style:{background:g}})]})},Wn=S({mode:`monet`,order:20,labelKey:`options.visualizerBackgroundModeMonet`,labelFallback:`Monet`,render:({config:e,coverUrl:t,theme:n,isDaylight:r,staticMode:i})=>(0,x.jsx)(Un,{coverUrl:t,monetBackgroundImage:e?.customImage,theme:n,isDaylight:r,tuning:e?.monet?.tuning,transparentBackground:e?.transparent,staticMode:i}),renderSettingsPanel:({config:e,actions:t,t:n,isDaylight:r,theme:i,controlCardBg:a,rangeInputClass:o,onSliderPointerDown:s,onSliderCommit:l})=>(0,x.jsx)(tn,{t:n,isDaylight:r,theme:i,controlCardBg:a,rangeInputClass:o,tuning:e?.monet?.tuning??c,onTuningChange:t?.monet?.onTuningChange,monetBackgroundImage:e?.customImage,onUploadMonetBackgroundImage:t?.customImage?.onUpload,onClearMonetBackgroundImage:t?.customImage?.onClear,isLoadingMonetBackgroundImage:t?.customImage?.isLoading,onSliderPointerDown:s,onSliderCommit:l}),renderQuickControls:({config:e,actions:t,t:n,isDaylight:r})=>{let i=(e?.monet?.tuning??c).backgroundLayout===`full-overlay`,a=n(i?`options.monetLayoutFullOverlay`:`options.monetLayoutHalfPane`);return(0,x.jsx)(C,{isDaylight:r,label:a,title:`${n(`options.monetBackgroundLayout`)}: ${a}`,onClick:()=>t?.monet?.onTuningChange?.({backgroundLayout:i?`half-pane-gradient`:`full-overlay`})})},resetSettings:e=>e?.monet?.onResetTuning?.()}),Gn=1.8,Kn=.01,qn=16/9,Jn={fiberSize:.2,crumples:.35,crumpleSize:.35,folds:.65,foldCount:5,drops:.2,seed:5.8},Yn={perspective:.4,count:20,focusCenter:.55,focusEdges:.8,swirl:.08,lensCircle:.1},Xn=e=>Math.min(1,Math.max(0,e)),Zn=e=>Math.min(Gn,Math.max(1,e)),Qn=e=>e<=1?1:Zn(e+Kn),$n=e=>Qn(1/(1-2*Math.min(Math.max(e,0),.45))),er=(e,t,n)=>n&&!t?!e:e,tr=(e,t,n)=>er(!e,t,n),nr=(e,t)=>{let{folds:n,crumples:r,drops:i}=Jn;return $n(.02*(2*n+1.5*r+.2*i+.75*Xn(e)+.1*Xn(t)))},rr=(e,t)=>{let n=.5*Math.hypot(qn,1),r=Xn(t),i=.7*r**(1.3+2.7*r)*(1-Yn.focusEdges),a=Math.max(.35,1-i/n);if(e<=0)return Qn(1/a);let o=Math.min(e,1)*1.4,s=e=>{let t=2*n/e;return Math.tan(t*o)/Math.tan(o)/t},c=Math.max(1,2*n*o/1.45);if(c>=Gn||s(Gn)>Gn*a)return Gn;if(c===1&&s(1)<=a)return Qn(1/a);let l=Gn;for(let e=0;e<32;e+=1){let e=(c+l)/2;s(e)>e*a?c=e:l=e}return Qn(l)},ir=b.memo(({coverUrl:e,monetBackgroundImage:t,tuning:n,theme:r,isDaylight:a})=>{let o={...i,...n},s=o.imageSource===`uploaded-global`?t?.url??e:e??t?.url;return s?(0,x.jsxs)(`div`,{className:`absolute inset-0 z-0 overflow-hidden`,style:{backgroundColor:r.backgroundColor,pointerEvents:`none`},children:[(()=>{let e={width:`100%`,height:`100%`,image:s,fit:`cover`,minPixelRatio:1,maxPixelCount:2073600,style:{width:`100%`,height:`100%`}};switch(o.effect){case`fluted-glass`:return(0,x.jsx)($e,{...e,colorBack:r.backgroundColor,colorShadow:r.secondaryColor,colorHighlight:r.primaryColor,shadows:.25,size:o.flutedGlassSize,distortion:o.flutedGlassDistortion,blur:o.flutedGlassBlur,shape:`lines`,distortionShape:`prism`,highlights:.1,edges:.25},`${s}:fluted-glass`);case`paper-texture`:return(0,x.jsx)(Qe,{...e,...Jn,colorFront:r.accentColor,colorBack:r.backgroundColor,contrast:o.paperTextureContrast,roughness:o.paperTextureRoughness,fiber:o.paperTextureFiber,scale:nr(o.paperTextureRoughness,o.paperTextureFiber)},`${s}:paper-texture`);case`halftone-dots`:return(0,x.jsx)(nt,{...e,colorBack:r.backgroundColor,colorFront:r.accentColor,size:o.halftoneDotsSize,radius:o.halftoneDotsRadius,contrast:o.halftoneDotsContrast,originalColors:o.halftoneDotsOriginalColors,inverted:tr(o.halftoneDotsInverted,o.halftoneDotsOriginalColors,a),grid:`hex`,type:`gooey`,grainMixer:.12,grainOverlay:.06,grainSize:.5},`${s}:halftone-dots`);case`lens-distortion`:return(0,x.jsx)(tt,{...e,...Yn,spread:o.lensDistortionSpread,dispersion:o.lensDistortionDispersion,lensBulge:o.lensDistortionBulge,scale:rr(o.lensDistortionBulge,o.lensDistortionSpread)},`${s}:lens-distortion`);default:return(0,x.jsx)(et,{...e,colorBack:r.backgroundColor,colorFront:r.accentColor,colorHighlight:r.primaryColor,originalColors:o.originalColors,inverted:er(o.inverted,o.originalColors,a),type:o.ditheringType,size:o.size,colorSteps:o.colorSteps},`${s}:dithering`)}})(),o.overlayEnabled&&o.overlayOpacity>0&&(0,x.jsx)(`div`,{className:`absolute inset-0`,style:{backgroundColor:r.backgroundColor,opacity:o.overlayOpacity}})]}):(0,x.jsx)(`div`,{className:`absolute inset-0 z-0`,style:{backgroundColor:r.backgroundColor}})}),ar=e=>e.toFixed(2),K=e=>`${Math.round(e*100)}%`,or=(e,t)=>({borderColor:u(e.secondaryColor,t?.18:.16),selectedBg:u(e.accentColor,t?.1:.16)}),q=({label:e,value:t,min:n,max:r,step:i,rangeInputClass:a,theme:o,onChange:s,onPointerDown:c,onPointerUp:l,format:u=ar})=>(0,x.jsxs)(`label`,{className:`block space-y-2`,children:[(0,x.jsxs)(`span`,{className:`flex justify-between gap-3 text-sm`,style:{color:o.primaryColor},children:[(0,x.jsx)(`span`,{children:e}),(0,x.jsx)(`span`,{className:`font-mono opacity-70`,children:u(t)})]}),(0,x.jsx)(`input`,{type:`range`,min:n,max:r,step:i,value:t,onChange:e=>s(Number(e.target.value)),onPointerDown:c,onPointerUp:l,onPointerCancel:l,className:a})]}),sr=[`2x2`,`4x4`,`8x8`],cr=({t:e,isDaylight:t,theme:n,rangeInputClass:r,tuning:i,onTuningChange:a,onSliderPointerDown:o,onSliderCommit:s})=>{let{borderColor:c,selectedBg:l}=or(n,t),u={rangeInputClass:r,theme:n,onPointerDown:o,onPointerUp:s};return(0,x.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:c},children:[(0,x.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.nomandBackgroundEffectDithering`)}),(0,x.jsxs)(`div`,{className:`space-y-2`,children:[(0,x.jsx)(`div`,{className:`text-sm`,style:{color:n.primaryColor},children:e(`options.nomandBackgroundDitheringType`)}),(0,x.jsx)(`div`,{className:`grid grid-cols-3 gap-2`,children:sr.map(e=>(0,x.jsx)(`button`,{type:`button`,onClick:()=>a?.({ditheringType:e}),className:`rounded-xl border px-2 py-2 text-xs`,style:{borderColor:i.ditheringType===e?n.accentColor:c,backgroundColor:i.ditheringType===e?l:`transparent`,color:n.primaryColor},children:e},e))})]}),(0,x.jsx)(q,{...u,label:e(`options.nomandBackgroundSize`),value:i.size,min:.5,max:20,step:.5,format:e=>e.toFixed(1),onChange:e=>a?.({size:e})}),(0,x.jsx)(q,{...u,label:e(`options.nomandBackgroundColorSteps`),value:i.colorSteps,min:1,max:7,step:1,format:e=>String(Math.round(e)),onChange:e=>a?.({colorSteps:e})}),(0,x.jsx)(E,{label:e(`options.nomandBackgroundOriginalColors`),checked:i.originalColors,onChange:e=>a?.({originalColors:e}),theme:n}),(0,x.jsx)(E,{label:e(`options.nomandBackgroundInverted`),checked:i.inverted,onChange:e=>a?.({inverted:e}),theme:n})]})},lr=({t:e,isDaylight:t,theme:n,rangeInputClass:r,tuning:i,onTuningChange:a,onSliderPointerDown:o,onSliderCommit:s})=>{let{borderColor:c}=or(n,t),l={rangeInputClass:r,theme:n,onPointerDown:o,onPointerUp:s};return(0,x.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:c},children:[(0,x.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.nomandBackgroundEffectFlutedGlass`)}),(0,x.jsx)(q,{...l,label:e(`options.nomandBackgroundFlutedGlassSize`),value:i.flutedGlassSize,min:.1,max:1,step:.05,onChange:e=>a?.({flutedGlassSize:e})}),(0,x.jsx)(q,{...l,label:e(`options.nomandBackgroundFlutedGlassDistortion`),value:i.flutedGlassDistortion,min:0,max:1,step:.05,format:K,onChange:e=>a?.({flutedGlassDistortion:e})}),(0,x.jsx)(q,{...l,label:e(`options.nomandBackgroundFlutedGlassBlur`),value:i.flutedGlassBlur,min:0,max:1,step:.05,format:K,onChange:e=>a?.({flutedGlassBlur:e})})]})},ur=({t:e,isDaylight:t,theme:n,rangeInputClass:r,tuning:i,onTuningChange:a,onSliderPointerDown:o,onSliderCommit:s})=>{let{borderColor:c}=or(n,t),l={rangeInputClass:r,theme:n,onPointerDown:o,onPointerUp:s};return(0,x.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:c},children:[(0,x.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.nomandBackgroundEffectHalftoneDots`)}),(0,x.jsx)(q,{...l,label:e(`options.nomandBackgroundHalftoneDotsSize`),value:i.halftoneDotsSize,min:.1,max:1,step:.05,onChange:e=>a?.({halftoneDotsSize:e})}),(0,x.jsx)(q,{...l,label:e(`options.nomandBackgroundHalftoneDotsRadius`),value:i.halftoneDotsRadius,min:.1,max:2,step:.05,onChange:e=>a?.({halftoneDotsRadius:e})}),(0,x.jsx)(q,{...l,label:e(`options.nomandBackgroundHalftoneDotsContrast`),value:i.halftoneDotsContrast,min:0,max:1,step:.05,format:K,onChange:e=>a?.({halftoneDotsContrast:e})}),(0,x.jsx)(E,{label:e(`options.nomandBackgroundOriginalColors`),checked:i.halftoneDotsOriginalColors,onChange:e=>a?.({halftoneDotsOriginalColors:e}),theme:n}),(0,x.jsx)(E,{label:e(`options.nomandBackgroundInverted`),checked:i.halftoneDotsInverted,onChange:e=>a?.({halftoneDotsInverted:e}),theme:n})]})},dr=({t:e,isDaylight:t,theme:n,rangeInputClass:r,tuning:i,onTuningChange:a,onSliderPointerDown:o,onSliderCommit:s})=>{let{borderColor:c}=or(n,t),l={rangeInputClass:r,theme:n,onPointerDown:o,onPointerUp:s};return(0,x.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:c},children:[(0,x.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.nomandBackgroundEffectLensDistortion`)}),(0,x.jsx)(q,{...l,label:e(`options.nomandBackgroundLensDistortionSpread`),value:i.lensDistortionSpread,min:0,max:1,step:.05,format:K,onChange:e=>a?.({lensDistortionSpread:e})}),(0,x.jsx)(q,{...l,label:e(`options.nomandBackgroundLensDistortionBulge`),value:i.lensDistortionBulge,min:-1,max:1,step:.05,onChange:e=>a?.({lensDistortionBulge:e})}),(0,x.jsx)(q,{...l,label:e(`options.nomandBackgroundLensDistortionDispersion`),value:i.lensDistortionDispersion,min:0,max:1,step:.05,format:K,onChange:e=>a?.({lensDistortionDispersion:e})})]})},fr=({t:e,isDaylight:t,theme:n,rangeInputClass:r,tuning:i,onTuningChange:a,onSliderPointerDown:o,onSliderCommit:s})=>{let{borderColor:c}=or(n,t),l={rangeInputClass:r,theme:n,onPointerDown:o,onPointerUp:s};return(0,x.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:c},children:[(0,x.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.nomandBackgroundEffectPaperTexture`)}),(0,x.jsx)(q,{...l,label:e(`options.nomandBackgroundPaperTextureContrast`),value:i.paperTextureContrast,min:0,max:1,step:.05,format:K,onChange:e=>a?.({paperTextureContrast:e})}),(0,x.jsx)(q,{...l,label:e(`options.nomandBackgroundPaperTextureRoughness`),value:i.paperTextureRoughness,min:0,max:1,step:.05,format:K,onChange:e=>a?.({paperTextureRoughness:e})}),(0,x.jsx)(q,{...l,label:e(`options.nomandBackgroundPaperTextureFiber`),value:i.paperTextureFiber,min:0,max:1,step:.05,format:K,onChange:e=>a?.({paperTextureFiber:e})})]})},pr=[`dithering`,`fluted-glass`,`paper-texture`,`halftone-dots`,`lens-distortion`],mr={dithering:`options.nomandBackgroundEffectDithering`,"fluted-glass":`options.nomandBackgroundEffectFlutedGlass`,"paper-texture":`options.nomandBackgroundEffectPaperTexture`,"halftone-dots":`options.nomandBackgroundEffectHalftoneDots`,"lens-distortion":`options.nomandBackgroundEffectLensDistortion`},hr=e=>{let{t,isDaylight:n,theme:r,tuning:i}=e,{borderColor:a,selectedBg:o}=or(r,n);return(0,x.jsxs)(`div`,{className:`space-y-4`,children:[(0,x.jsxs)(`div`,{className:`space-y-2`,children:[(0,x.jsx)(`div`,{className:`text-sm`,style:{color:r.primaryColor},children:t(`options.nomandBackgroundEffect`)}),(0,x.jsx)(`div`,{className:`grid grid-cols-2 gap-2 sm:grid-cols-3`,children:pr.map(n=>(0,x.jsx)(`button`,{type:`button`,onClick:()=>e.onTuningChange?.({effect:n}),className:`rounded-xl border px-2 py-2 text-xs`,style:{borderColor:i.effect===n?r.accentColor:a,backgroundColor:i.effect===n?o:`transparent`,color:r.primaryColor},children:t(mr[n])},n))})]}),i.effect===`dithering`&&(0,x.jsx)(cr,{...e}),i.effect===`fluted-glass`&&(0,x.jsx)(lr,{...e}),i.effect===`paper-texture`&&(0,x.jsx)(fr,{...e}),i.effect===`halftone-dots`&&(0,x.jsx)(ur,{...e}),i.effect===`lens-distortion`&&(0,x.jsx)(dr,{...e})]})},gr=({t:e,isDaylight:t,theme:n,controlCardBg:r,rangeInputClass:a,tuning:o,onTuningChange:s,monetBackgroundImage:c,onUploadMonetBackgroundImage:l,onClearMonetBackgroundImage:d,isLoadingMonetBackgroundImage:f=!1,onSliderPointerDown:p,onSliderCommit:m})=>{let _={...i,...o},v=(0,b.useRef)(null),[y,S]=(0,b.useState)(``),C=u(n.secondaryColor,t?.18:.16),w=u(n.accentColor,t?.1:.16),T=e=>{s?.({imageSource:e})},D=async t=>{if(!t.length||!l)return;let n=await l(t);S(n.ok?e(`options.nomandBackgroundUploadSuccess`):n.error??e(`options.nomandBackgroundUploadFailed`)),n.ok&&T(`uploaded-global`)};return(0,x.jsxs)(`div`,{className:`rounded-[24px] border p-4 space-y-4`,style:{backgroundColor:r,borderColor:C},children:[(0,x.jsxs)(`div`,{className:`space-y-1`,children:[(0,x.jsx)(`div`,{className:`text-sm font-medium`,style:{color:n.primaryColor},children:e(`options.nomandBackgroundSettings`)}),(0,x.jsx)(`div`,{className:`text-xs opacity-70`,style:{color:n.secondaryColor},children:e(`options.nomandBackgroundSettingsDesc`)})]}),(0,x.jsxs)(`div`,{className:`space-y-2`,children:[(0,x.jsx)(`div`,{className:`text-sm`,style:{color:n.primaryColor},children:e(`options.nomandBackgroundSource`)}),(0,x.jsx)(`div`,{className:`grid grid-cols-2 gap-2`,children:[[`cover-derived`,e(`options.monetBackgroundSourceCover`)],[`uploaded-global`,e(`options.monetBackgroundSourceUploaded`)]].map(([e,t])=>(0,x.jsx)(`button`,{type:`button`,disabled:e===`uploaded-global`&&!c&&!f,onClick:()=>T(e),className:`rounded-2xl border px-3 py-2 text-sm disabled:opacity-40`,style:{borderColor:_.imageSource===e?n.accentColor:C,backgroundColor:_.imageSource===e?w:`transparent`,color:n.primaryColor},children:t},e))}),(0,x.jsxs)(`div`,{className:`flex flex-wrap gap-2`,children:[(0,x.jsx)(`input`,{ref:v,type:`file`,accept:`image/png,image/jpeg,image/webp,image/gif`,className:`hidden`,onChange:e=>{D(Array.from(e.target.files??[])),e.target.value=``}}),(0,x.jsxs)(`button`,{type:`button`,disabled:f||!l,onClick:()=>v.current?.click(),className:`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs disabled:opacity-40`,style:{borderColor:C,color:n.primaryColor},children:[(0,x.jsx)(g,{size:14}),e(`options.monetUploadBackground`)]}),(0,x.jsxs)(`button`,{type:`button`,disabled:!c||!d,onClick:()=>void d?.(),className:`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs disabled:opacity-40`,style:{borderColor:C,color:n.secondaryColor},children:[(0,x.jsx)(h,{size:14}),e(`options.monetClearBackground`)]})]}),(0,x.jsx)(`div`,{className:`truncate text-xs opacity-60`,style:{color:n.secondaryColor},children:y||c?.name||`-`})]}),(0,x.jsx)(hr,{t:e,isDaylight:t,theme:n,rangeInputClass:a,tuning:_,onTuningChange:s,onSliderPointerDown:p,onSliderCommit:m}),(0,x.jsxs)(`div`,{className:`space-y-3 rounded-2xl border p-3`,style:{borderColor:C},children:[(0,x.jsx)(E,{label:e(`options.nomandBackgroundOverlay`),description:e(`options.nomandBackgroundOverlayDesc`),checked:_.overlayEnabled,onChange:e=>s?.({overlayEnabled:e}),theme:n}),(0,x.jsxs)(`label`,{className:`block space-y-2 ${_.overlayEnabled?``:`opacity-45`}`,children:[(0,x.jsxs)(`span`,{className:`flex justify-between text-sm`,style:{color:n.primaryColor},children:[(0,x.jsx)(`span`,{children:e(`options.nomandBackgroundOverlayOpacity`)}),(0,x.jsxs)(`span`,{className:`font-mono opacity-70`,children:[Math.round(_.overlayOpacity*100),`%`]})]}),(0,x.jsx)(`input`,{type:`range`,min:`0`,max:`1`,step:`0.05`,value:_.overlayOpacity,disabled:!_.overlayEnabled,onChange:e=>s?.({overlayOpacity:Number(e.target.value)}),onPointerDown:p,onPointerUp:m,className:a})]})]})]})},_r=S({mode:`nomand`,order:30,labelKey:`options.visualizerBackgroundModeNomand`,labelFallback:`Nomand`,render:({config:e,coverUrl:t,theme:n,isDaylight:r})=>(0,x.jsx)(ir,{coverUrl:t,monetBackgroundImage:e?.customImage,tuning:e?.nomand?.tuning,theme:n,isDaylight:r}),renderSettingsPanel:({config:e,actions:t,...n})=>(0,x.jsx)(gr,{...n,tuning:e?.nomand?.tuning??i,onTuningChange:t?.nomand?.onTuningChange,monetBackgroundImage:e?.customImage,onUploadMonetBackgroundImage:t?.customImage?.onUpload,onClearMonetBackgroundImage:t?.customImage?.onClear,isLoadingMonetBackgroundImage:t?.customImage?.isLoading}),renderQuickControls:({config:e,actions:t,t:n,theme:r})=>{let a=e?.nomand?.tuning??i;return(0,x.jsx)(w,{active:a.overlayEnabled,theme:r,label:n(`options.nomandBackgroundOverlay`),onToggle:()=>t?.nomand?.onTuningChange?.({overlayEnabled:!a.overlayEnabled}),children:(0,x.jsx)(f,{size:14})})},resetSettings:e=>e?.nomand?.onResetTuning?.()}),vr=5120,yr=5121,br=5122,xr=5123,Sr=5124,Cr=5125,wr=5126,Tr=32819,Er=32820,Dr=33635,Or=5131,kr=33640,Ar=35899,jr=35902,Mr=36269,Nr=34042,Pr={};{let e=Pr;e[vr]=Int8Array,e[yr]=Uint8Array,e[br]=Int16Array,e[xr]=Uint16Array,e[Sr]=Int32Array,e[Cr]=Uint32Array,e[wr]=Float32Array,e[Tr]=Uint16Array,e[Er]=Uint16Array,e[Dr]=Uint16Array,e[Or]=Uint16Array,e[kr]=Uint32Array,e[Ar]=Uint32Array,e[jr]=Uint32Array,e[Mr]=Uint32Array,e[Nr]=Uint32Array}function Fr(e){if(e instanceof Int8Array)return vr;if(e instanceof Uint8Array||e instanceof Uint8ClampedArray)return yr;if(e instanceof Int16Array)return br;if(e instanceof Uint16Array)return xr;if(e instanceof Int32Array)return Sr;if(e instanceof Uint32Array)return Cr;if(e instanceof Float32Array)return wr;throw Error(`unsupported typed array type`)}function Ir(e){if(e===Int8Array)return vr;if(e===Uint8Array||e===Uint8ClampedArray)return yr;if(e===Int16Array)return br;if(e===Uint16Array)return xr;if(e===Int32Array)return Sr;if(e===Uint32Array)return Cr;if(e===Float32Array)return wr;throw Error(`unsupported typed array type`)}function Lr(e){let t=Pr[e];if(!t)throw Error(`unknown gl type`);return t}var Rr=typeof SharedArrayBuffer<`u`?function(e){return e&&e.buffer&&(e.buffer instanceof ArrayBuffer||e.buffer instanceof SharedArrayBuffer)}:function(e){return e&&e.buffer&&e.buffer instanceof ArrayBuffer};function zr(...e){console.error(...e)}function Br(...e){console.warn(...e)}var Vr=new Map;function Hr(e,t){if(!e||typeof e!=`object`)return!1;let n=Vr.get(t);n||(n=new WeakMap,Vr.set(t,n));let r=n.get(e);if(r===void 0){let i=Object.prototype.toString.call(e);r=i.substring(8,i.length-1)===t,n.set(e,r)}return r}function Ur(e,t){return typeof WebGLBuffer<`u`&&Hr(t,`WebGLBuffer`)}function Wr(e,t){return typeof WebGLTexture<`u`&&Hr(t,`WebGLTexture`)}var Gr=35044,Kr=34962,qr=34963,Jr=34660,Yr=5120,Xr=5121,Zr=5122,Qr=5123,$r=5124,ei=5125,ti=5126,ni={attribPrefix:``};function ri(e,t,n,r,i){e.bindBuffer(t,n),e.bufferData(t,r,i||Gr)}function ii(e,t,n,r){if(Ur(e,t))return t;n||=Kr;let i=e.createBuffer();return ri(e,n,i,t,r),i}function ai(e){return e===`indices`}function oi(e){return e===Int8Array||e===Uint8Array}function si(e){return e.length?e:e.data}var ci=/coord|texture/i,li=/color|colour/i;function ui(e,t){let n;if(n=ci.test(e)?2:li.test(e)?4:3,t%n>0)throw Error(`Can not guess numComponents for attribute '${e}'. Tried ${n} but ${t} values is not evenly divisible by ${n}. You should specify it.`);return n}function di(e,t,n){return e.numComponents||e.size||ui(t,n||si(e).length)}function fi(e,t){if(Rr(e))return e;if(Rr(e.data))return e.data;Array.isArray(e)&&(e={data:e});let n=e.type?mi(e.type):void 0;return n||=ai(t)?Uint16Array:Float32Array,new n(e.data)}function pi(e){return typeof e==`number`?e:e?Ir(e):ti}function mi(e){return typeof e==`number`?Lr(e):e||Float32Array}function hi(e,t){return{buffer:t.buffer,numValues:24,type:pi(t.type),arrayType:mi(t.type)}}function gi(e,t){let n=t.data||t,r=mi(t.type),i=n*r.BYTES_PER_ELEMENT,a=e.createBuffer();return e.bindBuffer(Kr,a),e.bufferData(Kr,i,t.drawType||Gr),{buffer:a,numValues:n,type:Ir(r),arrayType:r}}function _i(e,t,n){let r=fi(t,n);return{arrayType:r.constructor,buffer:ii(e,r,void 0,t.drawType),type:Fr(r),numValues:0}}function vi(e,t){let n={};return Object.keys(t).forEach(function(r){if(!ai(r)){let i=t[r],a=i.attrib||i.name||i.attribName||ni.attribPrefix+r;if(i.value){if(!Array.isArray(i.value)&&!Rr(i.value))throw Error(`array.value is not array or typedarray`);n[a]={value:i.value}}else{let t;t=i.buffer&&i.buffer instanceof WebGLBuffer?hi:typeof i==`number`||typeof i.data==`number`?gi:_i;let{buffer:o,type:s,numValues:c,arrayType:l}=t(e,i,r),u=i.normalize===void 0?oi(l):i.normalize,d=di(i,r,c);n[a]={buffer:o,numComponents:d,type:s,normalize:u,stride:i.stride||0,offset:i.offset||0,divisor:i.divisor===void 0?void 0:i.divisor,drawType:i.drawType}}}}),e.bindBuffer(Kr,null),n}function yi(e,t){return t===Yr||t===Xr?1:t===Zr||t===Qr?2:t===$r||t===ei||t===ti?4:0}var bi=[`position`,`positions`,`a_position`];function xi(e,t){let n,r=0;for(;r<bi.length&&(n=bi[r],!(n in t||(n=ni.attribPrefix+n,n in t)));++r);r===bi.length&&(n=Object.keys(t)[0]);let i=t[n];if(!i.buffer)return 1;e.bindBuffer(Kr,i.buffer);let a=e.getBufferParameter(Kr,Jr);e.bindBuffer(Kr,null);let o=a/yi(e,i.type),s=i.numComponents||i.size,c=o/s;if(c%1!=0)throw Error(`numComponents ${s} not correct for length ${length}`);return c}function Si(e,t,n){let r=vi(e,t),i=Object.assign({},n||{});i.attribs=Object.assign({},n?n.attribs:{},r);let a=t.indices;if(a){let t=fi(a,`indices`);i.indices=ii(e,t,qr),i.numElements=t.length,i.elementType=Fr(t)}else i.numElements||=xi(e,i.attribs);return i}function Ci(e){return!!e.texStorage2D}var wi=function(){let e={},t={};function n(n){let r=n.constructor.name;if(!e[r]){for(let e in n)if(typeof n[e]==`number`){let r=t[n[e]];t[n[e]]=r?`${r} | ${e}`:e}e[r]=!0}}return function(e,r){return n(e),t[r]||(typeof r==`number`?`0x${r.toString(16)}`:r)}}();new Uint8Array([128,192,255,255]);var Ti=6406,Ei=6407,Di=6408,Oi=6409,ki=6410,Ai=6402,ji=34041,Mi=33319,Ni=33320,Pi=6403,Fi=36244,Ii=36248,Li=36249,Ri={};{let e=Ri;e[Ti]={numColorComponents:1},e[Oi]={numColorComponents:1},e[ki]={numColorComponents:2},e[Ei]={numColorComponents:3},e[Di]={numColorComponents:4},e[Pi]={numColorComponents:1},e[Fi]={numColorComponents:1},e[Mi]={numColorComponents:2},e[Ni]={numColorComponents:2},e[Ei]={numColorComponents:3},e[Ii]={numColorComponents:3},e[Di]={numColorComponents:4},e[Li]={numColorComponents:4},e[Ai]={numColorComponents:1},e[ji]={numColorComponents:2}}var zi=zr;function Bi(e){return typeof document<`u`&&document.getElementById?document.getElementById(e):null}var Vi=33984,Hi=34962,Ui=34963,Wi=35713,Gi=35714,Ki=35632,qi=35633,Ji=35981,Yi=35718,Xi=35721,Zi=35971,Qi=35382,$i=35396,ea=35398,ta=35392,na=35395,ra=5126,ia=35664,aa=35665,oa=35666,sa=5124,ca=35667,la=35668,ua=35669,da=35670,fa=35671,pa=35672,ma=35673,ha=35674,ga=35675,_a=35676,va=35678,ya=35680,ba=35679,xa=35682,Sa=35685,Ca=35686,wa=35687,Ta=35688,Ea=35689,Da=35690,Oa=36289,ka=36292,Aa=36293,ja=5125,Ma=36294,Na=36295,Pa=36296,Fa=36298,Ia=36299,La=36300,Ra=36303,za=36306,Ba=36307,Va=36308,Ha=36311,Ua=3553,Wa=34067,Ga=32879,Ka=35866,J={};function qa(e,t){return J[t].bindPoint}function Ja(e,t){return function(n){e.uniform1f(t,n)}}function Ya(e,t){return function(n){e.uniform1fv(t,n)}}function Xa(e,t){return function(n){e.uniform2fv(t,n)}}function Za(e,t){return function(n){e.uniform3fv(t,n)}}function Qa(e,t){return function(n){e.uniform4fv(t,n)}}function $a(e,t){return function(n){e.uniform1i(t,n)}}function eo(e,t){return function(n){e.uniform1iv(t,n)}}function to(e,t){return function(n){e.uniform2iv(t,n)}}function no(e,t){return function(n){e.uniform3iv(t,n)}}function ro(e,t){return function(n){e.uniform4iv(t,n)}}function io(e,t){return function(n){e.uniform1ui(t,n)}}function ao(e,t){return function(n){e.uniform1uiv(t,n)}}function oo(e,t){return function(n){e.uniform2uiv(t,n)}}function so(e,t){return function(n){e.uniform3uiv(t,n)}}function co(e,t){return function(n){e.uniform4uiv(t,n)}}function lo(e,t){return function(n){e.uniformMatrix2fv(t,!1,n)}}function uo(e,t){return function(n){e.uniformMatrix3fv(t,!1,n)}}function fo(e,t){return function(n){e.uniformMatrix4fv(t,!1,n)}}function po(e,t){return function(n){e.uniformMatrix2x3fv(t,!1,n)}}function mo(e,t){return function(n){e.uniformMatrix3x2fv(t,!1,n)}}function ho(e,t){return function(n){e.uniformMatrix2x4fv(t,!1,n)}}function go(e,t){return function(n){e.uniformMatrix4x2fv(t,!1,n)}}function _o(e,t){return function(n){e.uniformMatrix3x4fv(t,!1,n)}}function vo(e,t){return function(n){e.uniformMatrix4x3fv(t,!1,n)}}function Y(e,t,n,r){let i=qa(e,t);return Ci(e)?function(t){let a,o;!t||Wr(e,t)?(a=t,o=null):(a=t.texture,o=t.sampler),e.uniform1i(r,n),e.activeTexture(Vi+n),e.bindTexture(i,a),e.bindSampler(n,o)}:function(t){e.uniform1i(r,n),e.activeTexture(Vi+n),e.bindTexture(i,t)}}function X(e,t,n,r,i){let a=qa(e,t),o=new Int32Array(i);for(let e=0;e<i;++e)o[e]=n+e;return Ci(e)?function(t){e.uniform1iv(r,o),t.forEach(function(t,r){e.activeTexture(Vi+o[r]);let i,s;!t||Wr(e,t)?(i=t,s=null):(i=t.texture,s=t.sampler),e.bindSampler(n,s),e.bindTexture(a,i)})}:function(t){e.uniform1iv(r,o),t.forEach(function(t,n){e.activeTexture(Vi+o[n]),e.bindTexture(a,t)})}}J[ra]={Type:Float32Array,size:4,setter:Ja,arraySetter:Ya},J[ia]={Type:Float32Array,size:8,setter:Xa,cols:2},J[aa]={Type:Float32Array,size:12,setter:Za,cols:3},J[oa]={Type:Float32Array,size:16,setter:Qa,cols:4},J[sa]={Type:Int32Array,size:4,setter:$a,arraySetter:eo},J[ca]={Type:Int32Array,size:8,setter:to,cols:2},J[la]={Type:Int32Array,size:12,setter:no,cols:3},J[ua]={Type:Int32Array,size:16,setter:ro,cols:4},J[ja]={Type:Uint32Array,size:4,setter:io,arraySetter:ao},J[Ma]={Type:Uint32Array,size:8,setter:oo,cols:2},J[Na]={Type:Uint32Array,size:12,setter:so,cols:3},J[Pa]={Type:Uint32Array,size:16,setter:co,cols:4},J[da]={Type:Uint32Array,size:4,setter:$a,arraySetter:eo},J[fa]={Type:Uint32Array,size:8,setter:to,cols:2},J[pa]={Type:Uint32Array,size:12,setter:no,cols:3},J[ma]={Type:Uint32Array,size:16,setter:ro,cols:4},J[ha]={Type:Float32Array,size:32,setter:lo,rows:2,cols:2},J[ga]={Type:Float32Array,size:48,setter:uo,rows:3,cols:3},J[_a]={Type:Float32Array,size:64,setter:fo,rows:4,cols:4},J[Sa]={Type:Float32Array,size:32,setter:po,rows:2,cols:3},J[Ca]={Type:Float32Array,size:32,setter:ho,rows:2,cols:4},J[wa]={Type:Float32Array,size:48,setter:mo,rows:3,cols:2},J[Ta]={Type:Float32Array,size:48,setter:_o,rows:3,cols:4},J[Ea]={Type:Float32Array,size:64,setter:go,rows:4,cols:2},J[Da]={Type:Float32Array,size:64,setter:vo,rows:4,cols:3},J[va]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Ua},J[ya]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Wa},J[ba]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Ga},J[xa]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Ua},J[Oa]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Ka},J[ka]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Ka},J[Aa]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Wa},J[Fa]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Ua},J[Ia]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Ga},J[La]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Wa},J[Ra]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Ka},J[za]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Ua},J[Ba]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Ga},J[Va]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Wa},J[Ha]={Type:null,size:0,setter:Y,arraySetter:X,bindPoint:Ka};function yo(e,t){return function(n){if(n.value)switch(e.disableVertexAttribArray(t),n.value.length){case 4:e.vertexAttrib4fv(t,n.value);break;case 3:e.vertexAttrib3fv(t,n.value);break;case 2:e.vertexAttrib2fv(t,n.value);break;case 1:e.vertexAttrib1fv(t,n.value);break;default:throw Error(`the length of a float constant value must be between 1 and 4!`)}else e.bindBuffer(Hi,n.buffer),e.enableVertexAttribArray(t),e.vertexAttribPointer(t,n.numComponents||n.size,n.type||ra,n.normalize||!1,n.stride||0,n.offset||0),e.vertexAttribDivisor&&e.vertexAttribDivisor(t,n.divisor||0)}}function Z(e,t){return function(n){if(n.value){if(e.disableVertexAttribArray(t),n.value.length===4)e.vertexAttrib4iv(t,n.value);else throw Error(`The length of an integer constant value must be 4!`)}else e.bindBuffer(Hi,n.buffer),e.enableVertexAttribArray(t),e.vertexAttribIPointer(t,n.numComponents||n.size,n.type||sa,n.stride||0,n.offset||0),e.vertexAttribDivisor&&e.vertexAttribDivisor(t,n.divisor||0)}}function bo(e,t){return function(n){if(n.value){if(e.disableVertexAttribArray(t),n.value.length===4)e.vertexAttrib4uiv(t,n.value);else throw Error(`The length of an unsigned integer constant value must be 4!`)}else e.bindBuffer(Hi,n.buffer),e.enableVertexAttribArray(t),e.vertexAttribIPointer(t,n.numComponents||n.size,n.type||ja,n.stride||0,n.offset||0),e.vertexAttribDivisor&&e.vertexAttribDivisor(t,n.divisor||0)}}function xo(e,t,n){let r=n.size,i=n.count;return function(n){e.bindBuffer(Hi,n.buffer);let a=n.size||n.numComponents||r,o=a/i,s=n.type||ra,c=J[s].size*a,l=n.normalize||!1,u=n.offset||0,d=c/i;for(let r=0;r<i;++r)e.enableVertexAttribArray(t+r),e.vertexAttribPointer(t+r,o,s,l,c,u+d*r),e.vertexAttribDivisor&&e.vertexAttribDivisor(t+r,n.divisor||0)}}var Q={};Q[ra]={size:4,setter:yo},Q[ia]={size:8,setter:yo},Q[aa]={size:12,setter:yo},Q[oa]={size:16,setter:yo},Q[sa]={size:4,setter:Z},Q[ca]={size:8,setter:Z},Q[la]={size:12,setter:Z},Q[ua]={size:16,setter:Z},Q[ja]={size:4,setter:bo},Q[Ma]={size:8,setter:bo},Q[Na]={size:12,setter:bo},Q[Pa]={size:16,setter:bo},Q[da]={size:4,setter:Z},Q[fa]={size:8,setter:Z},Q[pa]={size:12,setter:Z},Q[ma]={size:16,setter:Z},Q[ha]={size:4,setter:xo,count:2},Q[ga]={size:9,setter:xo,count:3},Q[_a]={size:16,setter:xo,count:4};var So=/ERROR:\s*\d+:(\d+)/gi;function Co(e,t=``,n=0){let r=[...t.matchAll(So)],i=new Map(r.map((e,n)=>{let i=parseInt(e[1]),a=r[n+1],o=a?a.index:t.length,s=t.substring(e.index,o);return[i-1,s]}));return e.split(`
`).map((e,t)=>{let r=i.get(t);return`${t+1+n}: ${e}${r?`\n\n^^^ ${r}`:``}`}).join(`
`)}var wo=/^[ \t]*\n/;function To(e){let t=0;return wo.test(e)&&(t=1,e=e.replace(wo,``)),{lineOffset:t,shaderSource:e}}function Eo(e,t){return e.errorCallback(t),e.callback&&setTimeout(()=>{e.callback(`${t}\n${e.errors.join(`
`)}`)}),null}function Do(e,t,n,r){if(r||=zi,!e.getShaderParameter(n,Wi)){let i=e.getShaderInfoLog(n),{lineOffset:a,shaderSource:o}=To(e.getShaderSource(n)),s=`${Co(o,i,a)}\nError compiling ${wi(e,t)}: ${i}`;return r(s),s}return``}function Oo(e,t,n){let r,i,a;if(typeof t==`function`&&(n=t,t=void 0),typeof e==`function`)n=e,e=void 0;else if(e&&!Array.isArray(e)){let t=e;n=t.errorCallback,e=t.attribLocations,r=t.transformFeedbackVaryings,i=t.transformFeedbackMode,a=t.callback}let o=n||zi,s=[],c={errorCallback(e,...t){s.push(e),o(e,...t)},transformFeedbackVaryings:r,transformFeedbackMode:i,callback:a,errors:s};{let n={};Array.isArray(e)?e.forEach(function(e,r){n[e]=t?t[r]:r}):n=e||{},c.attribLocations=n}return c}var ko=[`VERTEX_SHADER`,`FRAGMENT_SHADER`];function Ao(e,t){if(t.indexOf(`frag`)>=0)return Ki;if(t.indexOf(`vert`)>=0)return qi}function jo(e,t,n){let r=e.getAttachedShaders(t);for(let t of r)n.has(t)||e.deleteShader(t);e.deleteProgram(t)}var Mo=(e=0)=>new Promise(t=>setTimeout(t,e));function No(e,t,n){let r=e.createProgram(),{attribLocations:i,transformFeedbackVaryings:a,transformFeedbackMode:o}=Oo(n);for(let n=0;n<t.length;++n){let i=t[n];if(typeof i==`string`){let t=Bi(i),r=t?t.text:i,a=e[ko[n]];t&&t.type&&(a=Ao(e,t.type)||a),i=e.createShader(a),e.shaderSource(i,To(r).shaderSource),e.compileShader(i)}e.attachShader(r,i)}Object.entries(i).forEach(([t,n])=>e.bindAttribLocation(r,n,t));{let t=a;t&&(t.attribs&&(t=t.attribs),Array.isArray(t)||(t=Object.keys(t)),e.transformFeedbackVaryings(r,t,o||Ji))}return e.linkProgram(r),r}function Po(e,t,n,r,i){let a=Oo(n,r,i),o=new Set(t),s=No(e,t,a);function c(e,t){let n=Io(e,t,a.errorCallback);return n&&jo(e,t,o),n}if(a.callback)Fo(e,s).then(()=>{let t=c(e,s);a.callback(t,t?void 0:s)});else return c(e,s)?void 0:s}async function Fo(e,t){let n=e.getExtension(`KHR_parallel_shader_compile`),r=n?(e,t)=>e.getProgramParameter(t,n.COMPLETION_STATUS_KHR):()=>!0,i=0;do await Mo(i),i=1e3/60;while(!r(e,t))}function Io(e,t,n){if(n||=zi,!e.getProgramParameter(t,Gi)){let r=e.getProgramInfoLog(t);return n(`Error in program linking: ${r}`),`${r}\n${e.getAttachedShaders(t).map(t=>Do(e,e.getShaderParameter(t,e.SHADER_TYPE),t,n)).filter(e=>e).join(`
`)}`}}function Lo(e,t,n,r,i){return Po(e,t,n,r,i)}function Ro(e){let t=e.name;return t.startsWith(`gl_`)||t.startsWith(`webgl_`)}var zo=/(\.|\[|]|\w+)/g,Bo=e=>e>=`0`&&e<=`9`;function Vo(e,t,n,r){let i=e.split(zo).filter(e=>e!==``),a=0,o=``;for(;;){let e=i[a++];o+=e;let s=Bo(e[0]),c=s?parseInt(e):e;if(s&&(o+=i[a++]),a===i.length){n[c]=t;break}{let e=i[a++],t=e===`[`,s=n[c]||(t?[]:{});n[c]=s,n=s,r[o]=r[o]||function(e){return function(t){Go(e,t)}}(s),o+=e}}}function Ho(e,t){let n=0;function r(t,r,i){let a=r.name.endsWith(`[0]`),o=r.type,s=J[o];if(!s)throw Error(`unknown type: 0x${o.toString(16)}`);let c;if(s.bindPoint){let t=n;n+=r.size,c=a?s.arraySetter(e,o,t,i,r.size):s.setter(e,o,t,i,r.size)}else c=s.arraySetter&&a?s.arraySetter(e,i):s.setter(e,i);return c.location=i,c}let i={},a={},o=e.getProgramParameter(t,Yi);for(let n=0;n<o;++n){let o=e.getActiveUniform(t,n);if(Ro(o))continue;let s=o.name;s.endsWith(`[0]`)&&(s=s.substr(0,s.length-3));let c=e.getUniformLocation(t,o.name);if(c){let e=r(t,o,c);i[s]=e,Vo(s,e,a,i)}}return i}function Uo(e,t){let n={},r=e.getProgramParameter(t,Zi);for(let i=0;i<r;++i){let r=e.getTransformFeedbackVarying(t,i);n[r.name]={index:i,type:r.type,size:r.size}}return n}function Wo(e,t){let n=e.getProgramParameter(t,Yi),r=[],i=[];for(let a=0;a<n;++a){i.push(a),r.push({});let n=e.getActiveUniform(t,a);r[a].name=n.name}[[`UNIFORM_TYPE`,`type`],[`UNIFORM_SIZE`,`size`],[`UNIFORM_BLOCK_INDEX`,`blockNdx`],[`UNIFORM_OFFSET`,`offset`]].forEach(function(n){let a=n[0],o=n[1];e.getActiveUniforms(t,i,e[a]).forEach(function(e,t){r[t][o]=e})});let a={},o=e.getProgramParameter(t,Qi);for(let n=0;n<o;++n){let r=e.getActiveUniformBlockName(t,n),i={index:e.getUniformBlockIndex(t,r),usedByVertexShader:e.getActiveUniformBlockParameter(t,n,$i),usedByFragmentShader:e.getActiveUniformBlockParameter(t,n,ea),size:e.getActiveUniformBlockParameter(t,n,ta),uniformIndices:e.getActiveUniformBlockParameter(t,n,na)};i.used=i.usedByVertexShader||i.usedByFragmentShader,a[r]=i}return{blockSpecs:a,uniformData:r}}function Go(e,t){for(let n in t){let r=e[n];typeof r==`function`?r(t[n]):Go(e[n],t[n])}}function Ko(e,...t){let n=e.uniformSetters||e,r=t.length;for(let e=0;e<r;++e){let r=t[e];if(Array.isArray(r)){let e=r.length;for(let t=0;t<e;++t)Ko(n,r[t])}else for(let e in r){let t=n[e];t&&t(r[e])}}}function qo(e,t){let n={},r=e.getProgramParameter(t,Xi);for(let i=0;i<r;++i){let r=e.getActiveAttrib(t,i);if(Ro(r))continue;let a=e.getAttribLocation(t,r.name),o=Q[r.type],s=o.setter(e,a,o);s.location=a,n[r.name]=s}return n}function Jo(e,t){for(let n in t){let r=e[n];r&&r(t[n])}}function Yo(e,t,n){n.vertexArrayObject?e.bindVertexArray(n.vertexArrayObject):(Jo(t.attribSetters||t,n.attribs),n.indices&&e.bindBuffer(Ui,n.indices))}function Xo(e,t){let n=Ho(e,t),r=qo(e,t),i={program:t,uniformSetters:n,attribSetters:r,uniformLocations:Object.fromEntries(Object.entries(n).map(([e,t])=>[e,t.location])),attribLocations:Object.fromEntries(Object.entries(r).map(([e,t])=>[e,t.location]))};return Ci(e)&&(i.uniformBlockSpec=Wo(e,t),i.transformFeedbackInfo=Uo(e,t)),i}var Zo=/\s|{|}|;/;function Qo(e,t,n,r,i){let a=Oo(n,r,i),o=[];if(t=t.map(function(e){if(!Zo.test(e)){let t=Bi(e);if(t)e=t.text;else{let t=`no element with id: ${e}`;a.errorCallback(t),o.push(t)}}return e}),o.length)return Eo(a,``);let s=a.callback;s&&(a.callback=(t,n)=>{s(t,t?void 0:Xo(e,n))});let c=Lo(e,t,a);return c?Xo(e,c):null}var $o=4,es=5123;function ts(e,t,n,r,i,a){n=n===void 0?$o:n;let o=t.indices,s=t.elementType,c=r===void 0?t.numElements:r;i=i===void 0?0:i,s||o?a===void 0?e.drawElements(n,c,s===void 0?es:t.elementType,i):e.drawElementsInstanced(n,c,s===void 0?es:t.elementType,i,a):a===void 0?e.drawArrays(n,i,c):e.drawArraysInstanced(n,i,c,a)}var ns=6402,rs=33190,is=36012,as=35056,os=36013,ss=32854,cs=32855,ls=36194,us=33189,ds=6401,fs=36168,ps=34041,ms=36096,hs=36128,gs=33306,$={};$[ps]=gs,$[ds]=hs,$[fs]=hs,$[ns]=ms,$[us]=ms,$[rs]=ms,$[is]=ms,$[as]=gs,$[os]=gs;var _s={};_s[ss]=!0,_s[cs]=!0,_s[ls]=!0,_s[ps]=!0,_s[us]=!0,_s[ds]=!0,_s[fs]=!0;var vs={addExtensionsToContext:!0},ys=/^(.*?)_/;function bs(e,t){wi(e,0);let n=e.getExtension(t);if(n){let r={},i=ys.exec(t)[1],a=`_`+i;for(let t in n){let o=n[t],s=typeof o==`function`,c=s?i:a,l=t;t.endsWith(c)&&(l=t.substring(0,t.length-c.length)),e[l]===void 0?s?e[l]=function(e){return function(){return e.apply(n,arguments)}}(o):(e[l]=o,r[l]=o):!s&&e[l]!==o&&Br(l,e[l],o,t)}r.constructor={name:n.constructor.name},wi(r,0)}return n}var xs=`ANGLE_instanced_arrays.EXT_blend_minmax.EXT_color_buffer_float.EXT_color_buffer_half_float.EXT_disjoint_timer_query.EXT_disjoint_timer_query_webgl2.EXT_frag_depth.EXT_sRGB.EXT_shader_texture_lod.EXT_texture_compression_bptc.EXT_texture_compression_rgtc.EXT_texture_filter_anisotropic.OES_element_index_uint.OES_standard_derivatives.OES_texture_float.OES_texture_float_linear.OES_texture_half_float.OES_texture_half_float_linear.OES_vertex_array_object.WEBGL_color_buffer_float.WEBGL_compressed_texture_atc.WEBGL_compressed_texture_etc1.WEBGL_compressed_texture_etc.WEBGL_compressed_texture_pvrtc.WEBGL_compressed_texture_s3tc.WEBGL_compressed_texture_s3tc_srgb.WEBGL_depth_texture.WEBGL_draw_buffers`.split(`.`);function Ss(e){for(let t=0;t<xs.length;++t)bs(e,xs[t])}function Cs(e,t){let n=[`webgl2`,`webgl`,`experimental-webgl`],r=null;for(let i=0;i<n.length;++i)if(r=e.getContext(n[i],t),r){vs.addExtensionsToContext&&Ss(r);break}return r}function ws(e,t){return Cs(e,t)}function Ts(e,t){t||=1,t=Math.max(0,t);let n=e.clientWidth*t|0,r=e.clientHeight*t|0;return e.width!==n||e.height!==r?(e.width=n,e.height=r,!0):!1}var Es=150,Ds=`
attribute float a_index;
uniform vec2 u_resolution;
uniform float u_time;
varying float v_color_type;
varying float v_intensity_base;

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  float seed = a_index * 123.456;
  
  float speed_rand = hash2(vec2(seed, 1.1));
  float size_rand = hash2(vec2(seed, 2.2));
  float y_rand = hash2(vec2(seed, 3.3));
  float x_rand = hash2(vec2(seed, 4.4));
  float blink_rand = hash2(vec2(seed, 5.5));
  float color_type_rand = hash2(vec2(seed, 6.6));

  float aspect = u_resolution.x / u_resolution.y;
  float speed = 0.008 + speed_rand * 0.024;
  float size = 0.0006 + 0.0032 * pow(size_rand, 3.8);
  
  float y = -0.45 + y_rand * 0.9;
  
  float margin = 0.05;
  float width = aspect + margin * 2.0;
  float x = fract(x_rand + u_time * speed);
  x = x * width - (aspect * 0.5 + margin);
  
  float wave = sin(u_time * 0.3 + y_rand * 6.283) * 0.005;
  
  float ndc_x = x / (aspect * 0.5);
  float ndc_y = (y + wave) / 0.5;
  
  gl_Position = vec4(ndc_x, ndc_y, 0.0, 1.0);
  
  // Point size in pixels. 
  float pointSize = size * u_resolution.y * 3.5;
  gl_PointSize = max(2.0, pointSize);
  
  float blink = 0.3 + 0.7 * sin(u_time * (1.0 + blink_rand * 2.5) + x_rand * 6.283);
  v_intensity_base = blink;
  v_color_type = color_type_rand;
}
`,Os=`
precision mediump float;
uniform vec3 u_particle_color;
uniform vec3 u_particle_accent_color;

varying float v_color_type;
varying float v_intensity_base;

void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float dist = length(pc);
  
  float alpha = smoothstep(0.5, 0.1, dist) * v_intensity_base;
  if (alpha < 0.01) discard;
  
  vec3 baseColor = v_color_type > 0.90 ? u_particle_accent_color : u_particle_color;
  
  // Pre-multiplied alpha blending
  gl_FragColor = vec4(baseColor * alpha, alpha);
}
`,ks=({theme:e,isDaylight:n,paused:r=!1})=>{let i=(0,b.useRef)(null),a=(0,b.useRef)(null),o=(0,b.useRef)(0),s=t(e.primaryColor)||(n?{r:0,g:0,b:0}:{r:255,g:255,b:255}),c=[s.r/255,s.g/255,s.b/255],l=t(e.accentColor)||s,u=[l.r/255,l.g/255,l.b/255],d=n?[1,1,1]:[0,0,0],f=(0,b.useRef)(r),p=(0,b.useRef)(c),m=(0,b.useRef)(u),h=(0,b.useRef)(d);return f.current=r,p.current=c,m.current=u,h.current=d,(0,b.useEffect)(()=>{let e=i.current;if(!e)return;let t=ws(e,{alpha:!1,depth:!1,antialias:!1});if(!t)return;let n=Qo(t,[Ds,Os],e=>{console.error(`SoraBackground twgl program error:`,e)});if(!n)return;let r=new Float32Array(Es);for(let e=0;e<Es;e++)r[e]=e;let s=Si(t,{a_index:{numComponents:1,data:r}}),c=performance.now(),l=r=>{if(!f.current){let e=(r-c)/1e3;o.current+=e}c=r,Ts(e),t.viewport(0,0,t.canvas.width,t.canvas.height);let i=h.current;t.clearColor(i[0],i[1],i[2],1),t.clear(t.COLOR_BUFFER_BIT),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA);let u={u_resolution:[t.canvas.width,t.canvas.height],u_time:o.current,u_particle_color:p.current,u_particle_accent_color:m.current};t.useProgram(n.program),Yo(t,n,s),Ko(n,u),ts(t,s,t.POINTS),a.current=requestAnimationFrame(l)};return a.current=requestAnimationFrame(l),()=>{a.current&&cancelAnimationFrame(a.current),t.deleteProgram(n.program),s.attribs&&s.attribs.a_index&&s.attribs.a_index.buffer&&t.deleteBuffer(s.attribs.a_index.buffer)}},[]),(0,x.jsx)(`canvas`,{ref:i,className:`absolute inset-0 w-full h-full block pointer-events-none`,style:{width:`100%`,height:`100%`,willChange:`transform`,transform:`translateZ(0)`}})},As=({t:e,isDaylight:t,theme:n,controlCardBg:r,tuning:i,onTuningChange:a})=>{let o=u(n.secondaryColor,t?.18:.16);return(0,x.jsxs)(`div`,{className:`rounded-[24px] border p-4 space-y-5`,style:{backgroundColor:r,borderColor:o},children:[(0,x.jsx)(`div`,{className:`space-y-1`,children:(0,x.jsx)(`div`,{className:`text-sm font-medium`,style:{color:n.primaryColor},children:e(`options.soraBackgroundSettings`)})}),(0,x.jsx)(E,{label:e(`options.soraBlank`),description:e(`options.soraBlankDesc`),checked:i.blank,onChange:e=>a?.({blank:e}),theme:n})]})},js=S({mode:`sora`,order:50,labelKey:`options.visualizerBackgroundModeSora`,labelFallback:`Sora`,render:({config:e,theme:t,isDaylight:n,paused:r})=>(0,x.jsx)(`div`,{className:`absolute inset-0 z-0`,style:{backgroundColor:n?`#ffffff`:`#000000`},children:!e?.sora?.tuning?.blank&&(0,x.jsx)(ks,{theme:t,isDaylight:n,paused:r})}),renderSettingsPanel:({config:e,actions:t,t:n,isDaylight:r,theme:i,controlCardBg:o})=>(0,x.jsx)(As,{t:n,isDaylight:r,theme:i,controlCardBg:o,tuning:e?.sora?.tuning??a,onTuningChange:t?.sora?.onTuningChange}),renderQuickControls:({config:e,actions:t,t:n,theme:r})=>{let i=e?.sora?.tuning??a;return(0,x.jsx)(w,{active:i.blank,theme:r,label:n(`options.soraBlank`),onToggle:()=>t?.sora?.onTuningChange?.({blank:!i.blank}),children:(0,x.jsx)(p,{size:14})})},resetSettings:e=>e?.sora?.onResetTuning?.()}),Ms=`latent`,Ns=[oe,vt,Wn,_r,js].sort((e,t)=>e.order-t.order),Ps=new Map(Ns.map(e=>[e.mode,e])),Fs=e=>Ps.get(e)??vt,Is=(e,t)=>{let n=Fs(e),r=t(n.labelKey);return!r||r===n.labelKey?n.labelFallback:r};export{C as a,Fs as i,Ns as n,w as o,Is as r,T as s,Ms as t};