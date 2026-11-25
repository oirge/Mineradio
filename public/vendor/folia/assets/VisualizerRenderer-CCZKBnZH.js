const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./VisualizerCadenza-mCq8pIQo.js","./main-CZFQ8OkZ.css","./VisualizerCappella-DYnCcu-F.js","./VisualizerCladdagh-DPkd1rC3.js","./Visualizer-CLkw9kha.js","./VisualizerDiorama-COkxGXQY.js","./VisualizerFume-CQ5mU1hk.js","./VisualizerHanabi-DgsbY5xE.js","./VisualizerLumiere-D0Z4Bf5Y.js","./VisualizerMachi-BI6R5ck3.js","./Tooltip-QTgsb78Q.css","./VisualizerMetaphor-DLu5ncmE.js","./MetaphorSettingsPanel-D9sIY32_.js","./VisualizerMonet-ClN9oudy.js","./VisualizerNebbia-Dq0NqqLZ.js","./nebbiaShaderWarmup-B8_tPUK4.js","./VisualizerPartita-B4dbhicC.js","./VisualizerPendolo-CVBVX0fM.js","./VisualizerSonnet-Cp-lpxiL.js","./VisualizerStill-BtBTjO77.js","./VisualizerTempera-BdhzyQb9.js","./VisualizerTilt-CAvIcMuD.js"])))=>i.map(i=>d[i]);
import{n as e,r as t}from"./rolldown-runtime-XKyaHtl9.js";import{F as n,Ft as r,Ta as i,a,lc as o}from"./lucide-icons-0-DpRcqwsJ.js";import{t as s}from"./react-dom-DAyNttBr.js";import{t as c}from"./useTranslation-CuRieylw.js";import{t as l}from"./jsx-runtime-0Jl1Ys1r.js";import{t as u}from"./main-DZNVIn5q.js";import{AL as d,Hm as f,Iu as p,Iw as m,MA as h,ML as g,Pg as _,QT as v,Sy as y,cU as b,cc as x,fD as S,fp as C,wV as w}from"./lucide-icons-2-C37JOawj.js";import{z as T}from"./lucide-icons-1-C_CQ83c_.js";import{n as E,t as D}from"./proxy-CfMKLTOR.js";import{t as O}from"./use-transform-yiMkIhXQ.js";import{t as k}from"./use-spring-D_AOwvgb.js";import{t as A}from"./use-motion-value-event-UBhoXhVK.js";import{i as j,s as ee}from"./subtitleTrackStyle-Bbv5vyKc.js";import{t as M}from"./graphemeTiming-BhIjEJVM.js";import{t as te}from"./estimatedLineTiming--tt1-mYt.js";import{a as ne}from"./wordColoring-BBDjeB1Z.js";import{c as re,o as ie}from"./monetLyricsModel-CKh6akK_.js";import{i as ae,n as oe,r as se}from"./fontStacks-HCkMxckC.js";import{r as N,t as P}from"./colorMix-BL-g7xhv.js";import{a as ce,i as le,r as ue,t as de}from"./lyricRenderQuality-0_6JoYsp.js";import{$ as fe,B as pe,C as me,D as he,G as ge,H as _e,J as ve,K as ye,L as be,O as xe,Q as Se,R as Ce,V as we,X as Te,Y as Ee,Z as De,_t as Oe,at as ke,ct as Ae,dt as je,et as Me,f as Ne,ft as Pe,gt as Fe,ht as Ie,i as Le,it as Re,k as ze,l as Be,lt as Ve,mt as He,nt as Ue,ot as We,pt as Ge,q as Ke,rt as qe,s as Je,st as Ye,tt as Xe,u as Ze,ut as Qe,v as $e,vt as et,y as tt,z as nt}from"./useVisualSettings-qF9G7eoB.js";import{C as rt,E as it,T as at,_ as ot,a as F,b as st,c as ct,d as lt,f as ut,g as dt,h as ft,i as pt,l as I,m as mt,n as ht,o as gt,p as _t,r as vt,s as yt,t as bt,u as xt,v as St,w as Ct,x as wt,y as Tt}from"./types-BocLzH95.js";import{t as Et}from"./react-BS6G6YPf.js";import{t as Dt}from"./lucide-react-CK52t9lo.js";import{t as Ot}from"./useReducedMotionFor-B3AcIWWJ.js";import{x as kt}from"./localAnalysisBoundary-CtGdB7dA.js";import{a as At,d as jt,f as Mt,h as L,i as R,m as Nt,n as Pt,p as z,r as Ft,t as B}from"./panelRows-DP3kYRc3.js";import{i as It,n as Lt}from"./temperaRandom-Cj3v-sKs.js";var V=t(o(),1),Rt=s(),H=l(),zt=e=>e?e.backgroundVocals?.length?e.backgroundVocals:e.backgroundVocal?[e.backgroundVocal]:[]:[],Bt=e=>e.flatMap(e=>zt(e)).sort((e,t)=>e.startTime-t.startTime||e.endTime-t.endTime),Vt=(e,t,n=!0)=>j(e,ee(t,n)),Ht=(e,t)=>t<e.startTime?`waiting`:t<=e.endTime?`active`:`passed`,Ut=(e,t)=>{if(e.words.length===0)return[{key:`full`,text:e.text,status:`active`}];let n=[],r=0;return e.words.forEach((i,a)=>{let o=e.text.indexOf(i.text,r);o<0||(o>r&&n.push({key:`static-${r}`,text:e.text.slice(r,o),status:`static`}),n.push({key:`word-${a}-${i.startTime}`,text:i.text,status:Ht(i,t)}),r=o+i.text.length)}),r<e.text.length&&n.push({key:`static-${r}`,text:e.text.slice(r),status:`static`}),n.length>0?n:[{key:`full`,text:e.text,status:`active`}]},Wt=(e,t)=>{let n=e.filter(e=>e.text.trim()&&t>=e.startTime&&t<=e.endTime).sort((e,t)=>e.startTime-t.startTime||e.endTime-t.endTime).map((e,n)=>({key:`${e.startTime}-${e.endTime}-${e.text}-${n}`,vocal:e,tokens:Ut(e,t)}));return{signature:n.map(e=>`${e.key}:${e.tokens.map(e=>e.status).join(`,`)}`).join(`|`),lines:n}};function Gt(e){let t=new Set,n=e=>{let n=Number(e);Number.isFinite(n)&&t.add(n)};for(let t of e)if(t.text.trim()){n(t.startTime),n(t.endTime);for(let e of t.words)n(e.startTime),n(e.endTime)}let r=Array.from(t).sort((e,t)=>e-t);t.clear();let i=-1,a;return t=>{if(!Number.isFinite(t))return Wt(e,t);let n=0,o=r.length;for(;n<o;){let e=Math.floor((n+o)/2);r[e]<=t?n=e+1:o=e}let s=n*2+(n>0&&r[n-1]===t?0:1);return s===i&&a||(i=s,a=Wt(e,t)),a}}var Kt=(0,V.createContext)(76),qt={signature:``,lines:[]},Jt=e=>{let t=[],n=0;return e.words.forEach((r,i)=>{let a=e.text.indexOf(r.text,n);a<0||(a>n&&t.push({key:`static-${n}`,text:e.text.slice(n,a)}),t.push({key:`word-${i}-${r.startTime}`,text:r.text,word:r}),n=a+r.text.length)}),n<e.text.length&&t.push({key:`static-${n}`,text:e.text.slice(n)}),t.length>0?t:[{key:`full`,text:e.text}]},Yt=e=>({fullText:e.text,startTime:e.startTime,endTime:e.endTime,words:e.words}),Xt=({vocal:e,currentTime:t,theme:n,subtitleFontScale:r})=>{let i=re(.95,1.8,1.3)*r,a=se(n,500),o=oe(n),s=`${a} ${i}px ${o}`,c=(0,V.useMemo)(()=>Jt(e),[e]),l=(0,V.useMemo)(()=>M(Yt(e)),[e]),u=(0,V.useMemo)(()=>ie(e.text,i,s),[i,s,e.text]),d=O(t,t=>{let n=u[u.length-1]??0;if(t<=e.startTime)return 0;if(t>=e.endTime)return n;let r=Math.min(l.length,u.length-1);for(let n=0;n<r;n+=1){let r=l[n],i=Math.max(e.startTime,r.startTime),a=Math.max(i,r.endTime),o=u[n]??0,s=u[n+1]??o;if(t<i)return o;if(t<=a)return o+(s-o)*((t-i)/Math.max(.001,a-i))}return n}),f=Math.round(Math.max(i*.85,16)),p=O(d,e=>{let t=Math.max(Math.min(i*1.35,36),18),n=e+f,r=Math.max(n-t,0);return`linear-gradient(90deg, #000 0px, #000 ${r}px, rgba(0,0,0,0.86) ${Math.max(r,n-t*.5)}px, transparent ${n}px, transparent 100%)`}),m=e=>c.map(t=>{let r=t.word?ne(t.word.text,n.wordColors,n.accentColor,{cjkMatchMode:`exact`}):n.secondaryColor;return(0,H.jsx)(`span`,{style:e?{color:r,WebkitTextFillColor:r}:{color:P(r,.56)},children:t.text},t.key)});return(0,H.jsxs)(`span`,{className:`relative inline-block overflow-visible whitespace-pre-wrap break-words`,style:{fontFamily:o,fontSize:`clamp(${(.95*r).toFixed(3)}rem, ${(1.8*r).toFixed(3)}vw, ${(1.3*r).toFixed(3)}rem)`,fontWeight:a,lineHeight:1.3},children:[m(!1),(0,H.jsx)(D.span,{"aria-hidden":!0,className:`pointer-events-none absolute block whitespace-pre-wrap`,style:{left:-f,right:-f,top:-f,padding:f,WebkitMaskImage:p,maskImage:p,WebkitMaskSize:`100% 100%`,maskSize:`100% 100%`,WebkitMaskRepeat:`no-repeat`,maskRepeat:`no-repeat`},children:(0,H.jsx)(`span`,{className:`block whitespace-pre-wrap break-words`,children:m(!0)})})]})},Zt=({currentTime:e,lines:t,showText:n,theme:r,subtitleTheme:i,isPlayerChromeHidden:a=!1,hideTranslationSubtitle:o=!1,showSubtitleTranslation:s=!0,subtitleContentMode:c,showHarmonySubtitle:l=!0,harmonySubtitleBackground:u=!0,subtitleFontScale:d=1})=>{let f=(0,V.useMemo)(()=>Bt(t),[t]),p=(0,V.useMemo)(()=>Gt(f),[f]),m=(0,V.useCallback)(e=>n&&l?p(e):qt,[p,l,n]),h=m(e.get()),[g,_]=(0,V.useState)(h),v=(0,V.useRef)(h.signature),y=(0,V.useCallback)(e=>{let t=m(e);v.current!==t.signature&&(v.current=t.signature,_(t))},[m]);(0,V.useEffect)(()=>{y(e.get())},[e,y]),A(e,`change`,y);let b=(0,V.useContext)(Kt);return(0,H.jsx)(E,{children:g.lines.length>0&&(0,H.jsx)(D.div,{initial:{opacity:0,y:-12},animate:{opacity:1,y:0},exit:{opacity:0,y:-12},transition:{opacity:{duration:.2,ease:`easeOut`},y:{duration:.2,ease:`easeOut`}},className:`pointer-events-none absolute left-0 right-0 z-30 flex flex-col items-center gap-1.5 px-5 text-center`,style:{top:b},children:(0,H.jsxs)(`div`,{className:`relative isolate flex max-w-full flex-col items-center gap-1.5 ${u?`px-4 py-2`:``}`,children:[u&&(0,H.jsx)(`div`,{"aria-hidden":`true`,className:`pointer-events-none absolute -inset-x-10 -inset-y-6 z-0 blur-2xl`,style:{background:`radial-gradient(ellipse at center, ${P(r.backgroundColor,.7)} 0%, ${P(r.backgroundColor,.42)} 48%, transparent 78%)`,transform:`translateZ(0)`,WebkitTransform:`translateZ(0)`,WebkitBackfaceVisibility:`hidden`}}),g.lines.map(t=>{let n=o?null:Vt(t.vocal,c,s);return(0,H.jsxs)(D.div,{initial:{opacity:0,scale:.97},animate:{opacity:1,scale:1},exit:{opacity:0,scale:.97},className:`relative z-10 max-w-4xl overflow-visible whitespace-pre-wrap break-words`,children:[(0,H.jsx)(Xt,{vocal:t.vocal,currentTime:e,theme:i??r,subtitleFontScale:d}),n&&(0,H.jsx)(D.div,{initial:{opacity:0,y:-4},animate:{opacity:.82,y:0},className:`mt-0.5`,style:{color:(i??r).secondaryColor,fontFamily:ae(i??r),fontSize:`clamp(${(.72*d).toFixed(3)}rem, ${(1.2*d).toFixed(3)}vw, ${(.9*d).toFixed(3)}rem)`,fontWeight:se(i??r,400),lineHeight:1.3},children:n})]},t.key)})]})},`visualizer-harmony-overlay`)})},Qt=.5,$t=.32,en=5.2,tn=.5,nn=.92,rn=.4,an=.4,on=.5,sn=1.8,cn=1.2,ln=.2,un=.16,dn=1.1,fn=1.2,pn=Math.PI/180,mn=e=>Math.min(1,Math.max(0,e)),hn=(e,t,n)=>Math.min(n,Math.max(t,e)),gn=(e,t)=>({x:e.x-t.x,y:e.y-t.y,z:e.z-t.z}),_n=(e,t)=>({x:e.y*t.z-e.z*t.y,y:e.z*t.x-e.x*t.z,z:e.x*t.y-e.y*t.x}),vn=e=>{let t=Math.hypot(e.x,e.y,e.z)||1;return{x:e.x/t,y:e.y/t,z:e.z/t}},yn=(e,t)=>({x:e.x+t.x,y:e.y+t.y,z:e.z+t.z}),bn=e=>{let t=Math.sin(e*12.9898)*43758.5453;return t-Math.floor(t)},xn=e=>{if(typeof e==`number`)return e;if(!e)return 1;let t=0;for(let n=0;n<e.length;n+=1)t=(t*31+e.charCodeAt(n))%1e5;return t||1},Sn=(e,t,n,r,i)=>{let a=2/Math.max(1e-4,r),o=a*i,s=1/(1+o+.48*o*o+.235*o*o*o),c=e-t,l=(n+a*c)*i,u=(n-a*l)*s;return{value:t+(c+l)*s,velocity:u}},Cn=(e,t,n)=>e*Math.tan(t*pn/2)*n,wn={normal:{move:1,drift:.62,smooth:.42,audio:1,weave:1},calm:{move:.6,drift:.4,smooth:.56,audio:.5,weave:.5},chaotic:{move:1.35,drift:.85,smooth:.33,audio:1.35,weave:1.35}},Tn=(e,t)=>{let n=e??F,r=t===`calm`?`calm`:t===`chaotic`?`chaotic`:`normal`,i=wn[r],a=hn(n.motionAmount,.4,1.6),o=hn(n.cameraSpeed,.55,1.85),s=hn(n.audioReactivity,0,1.5);return{moveScale:i.move*a,driftScale:i.drift*a,smoothTime:i.smooth/o,audioLevel:i.audio*s,weaveScale:i.weave*a,subMode:r}},En={x:0,y:1,z:0},Dn={position:{x:0,y:0,z:0},forward:{x:0,y:0,z:-1},right:{x:1,y:0,z:0},up:{x:0,y:1,z:0}},On=(e,t)=>{let n=xn(t),r=Math.max(e,1),i=[],a={x:0,y:0,z:0};for(let e=0;e<=r;e+=1){i.push({...a});let t=Qt*(Math.sin(e*.23+n*.017)*.62+Math.sin(e*.11+n*.041+1.3)*.38),r=$t*Math.sin(e*.17+n*.029+.7),o=Math.cos(r),s={x:Math.sin(t)*o,y:Math.sin(r),z:-Math.cos(t)*o};a={x:a.x+s.x*8,y:a.y+s.y*8,z:a.z+s.z*8}}let o=[];for(let e=0;e<r;e+=1){let t=vn(gn(i[e+1],i[e])),n=vn(_n(t,En)),r=vn(_n(n,t));o.push({position:i[e],forward:t,right:n,up:r})}return o},kn=(e,t)=>e.length===0?Dn:e[Math.min(Math.max(t,0),e.length-1)]??Dn,An=(e,t)=>e.map(e=>({position:yn(e.position,t),forward:e.forward,right:e.right,up:e.up})),jn=(e,t,n,r)=>({x:e.position.x+e.right.x*t+e.up.x*n+e.forward.x*r,y:e.position.y+e.right.y*t+e.up.y*n+e.forward.y*r,z:e.position.z+e.right.z*t+e.up.z*n+e.forward.z*r}),Mn=(e,t,n)=>{if(t<=0)return 0;let r=(mn(e)-.5)*t,i=Math.max(Math.abs(n-t/2),.001);return i*Math.tanh(r/i)},Nn=(e,t,n=1)=>{let r=xn(t),i=Math.max(e,0),a=(bn(r+i*11+2)-.5)*.6,o=(bn(r+i*11+4)-.5)*.6,s=Math.sin(i*.47+r*.019)*.7+a,c=Math.sin(i*.29+r*.027+.9)*.7+o;return{offsetR:s*sn*n,offsetU:c*cn*n,scale:.82+bn(r+i*11+5)*.46,roll:(bn(r+i*11+6)-.5)*2*ln*n,yaw:(bn(r+i*11+7)-.5)*2*un*n,lookR:(bn(r+i*11+8)-.5)*2*dn*n}},Pn=[`pushIn`,`pullBack`,`orbit`,`track`,`crane`,`hold`,`swell`,`spiral`,`pendulum`,`flyby`,`arc`,`float`,`glide`],Fn=e=>{let t=mn(e);return t*t*(3-2*t)},In=/chorus|hook|refrain|drop/i,Ln=(e,t)=>bn(xn(t)+e*7+3)<.5?-1:1,Rn=e=>{let t=0,n=0,r=0;for(let i of e?.words??[]){let e=i.endTime-i.startTime;e>0&&(t=Math.max(t,e),n+=e,r+=1)}return{maxNote:t,avgNote:r>0?n/r:0,noteCount:r}},zn=(e,t,n=`normal`)=>{let r=t[e],i=e>0?t[e-1]:void 0,a=r?.words?.length??0,o=!!r?.isChorus||In.test(r?.songPart??``),s=!!r&&!!i&&(r.blockIndex!==i.blockIndex||(r.songPart??``)!==(i.songPart??``)),{maxNote:c,avgNote:l,noteCount:u}=Rn(r),d=c>=1.3,f=u>=4&&l>0&&l<=.34,p={pushIn:1,pullBack:1,orbit:1,track:1,crane:1,hold:1,swell:.85,spiral:.9,pendulum:1,flyby:.9,arc:1,float:.9,glide:1};return o?(p.orbit+=2.4,p.pushIn+=1.8,p.spiral+=1.2,p.crane+=.8,p.flyby+=.6,p.arc+=1,p.glide+=.6,p.hold-=.6,p.track-=.2):(p.track+=1.1,p.crane+=.9,p.hold+=.9,p.pendulum+=.8,p.float+=.8,p.glide+=.6,p.arc+=.4),a>=8?(p.track+=1.6,p.pullBack+=1,p.orbit-=.4,p.pushIn-=.3):a<=3&&(p.pushIn+=1.4,p.orbit+=.9,p.hold+=.5,p.track-=.8),s&&(p.pullBack+=2.2,p.crane+=1.4,p.glide+=1,p.pushIn-=.4),d&&(p.swell+=2.4,p.spiral+=1,p.float+=1.2,p.pendulum+=.6,p.orbit+=.8,p.arc+=.6,p.hold+=.3,p.track-=.5),f&&(p.track+=1.4,p.flyby+=1.5,p.pushIn+=.8,p.swell-=1.6,p.hold-=.8,p.crane-=.4),n===`calm`?(p.hold+=1.4,p.float+=1.3,p.swell+=.9,p.glide+=.8,p.arc+=.5,p.crane+=.4,p.orbit*=.4,p.spiral*=.35,p.flyby*=.3,p.pendulum*=.5,p.pushIn*=.7):n===`chaotic`&&(p.orbit+=1.3,p.spiral+=1.3,p.flyby+=1.2,p.pendulum+=1,p.pushIn+=.8,p.arc+=.6,p.crane+=.4,p.hold*=.35,p.float*=.55,p.swell*=.7),Pn.forEach(e=>{p[e]=Math.max(.05,p[e])}),p},Bn=(e,t)=>{let n=Pn.reduce((t,n)=>t+e[n],0),r=mn(t)*n;for(let t of Pn)if(r-=e[t],r<=0)return t;return`hold`},Vn=(e,t,n,r=`normal`)=>{if(!t[e])return`hold`;let i=bn(xn(n)+e*101+7);return Bn(zn(e,t,r),i)},Hn=(e,t,n,r=`normal`)=>{let i=Vn(e,t,n,r),a=e>0?Vn(e-1,t,n,r):null,o=e>1?Vn(e-2,t,n,r):null;if(i===a||i===o){let t=Pn.filter(e=>e!==i&&e!==a&&e!==o),r=t.length>0?t:Pn.filter(e=>e!==i),s=bn(xn(n)+e*53+19);return r[Math.floor(mn(s)*r.length)%r.length]}return i},Un=(e,t)=>{let{hero:n,lift:r,seed:i,lineIndex:a}=t,o=Fn(t.progress),s=Ln(a,i),c=0,l=r,u=n;switch(e){case`pushIn`:u=n*(1.5-.8*o),l=r*(1.2-.5*o)+.15;break;case`pullBack`:u=n*(.85+1.15*o),l=r+1.7*o;break;case`orbit`:{let e=s*.55*(2*o-1);c=n*Math.sin(e),u=n*Math.cos(e),l=r+.4;break}case`track`:c=s*n*.34*Math.sin(Math.PI*mn(t.wordProgress)),u=n*1.06,l=r+.12;break;case`crane`:{let e=s>0?-1.5:2.4;l=e+((s>0?2.4:-1.4)-e)*o,u=n*1.05;break}case`swell`:{let e=s*.4*o;c=n*Math.sin(e)*1.1,u=n*(1+.35*o),l=r+1.2*o+.3;break}case`spiral`:{let e=s*.7*(2*o-1);c=n*Math.sin(e)*.85,u=n*(1.05-.1*o),l=r-.8+2.4*o;break}case`pendulum`:c=s*n*.45*(2*o-1),l=r+.9-.9*Math.sin(Math.PI*o),u=n*1.02;break;case`flyby`:c=s*n*(.7-1.4*o),u=n*(.78+.12*Math.sin(Math.PI*o)),l=r+.05;break;case`arc`:{let e=s*.5*Math.sin(Math.PI*o);c=n*Math.sin(e)*1.3,u=n*(1.05+.12*(1-Math.cos(e))),l=r+.5*Math.sin(Math.PI*o);break}case`float`:c=s*n*.16*Math.sin(o*Math.PI*2),l=r+.6+.5*Math.sin(o*Math.PI*2+1),u=n*(1.05+.06*Math.sin(o*Math.PI));break;case`glide`:c=s*n*.22*o,l=r+1.4*o,u=n*(1.15-.25*o);break;default:l=r+.3*Math.sin(t.progress*Math.PI),u=n}let d=t.moveScale;return{right:c*d,up:r+(l-r)*d,back:n+(u-n)*d}},Wn=3,Gn=5,Kn=e=>{let t=mn((e-Wn)/Gn);return 1-t*t*(3-2*t)},qn=(e,t,n)=>{let r=xn(t)*.017;return{swayX:(Math.sin(e*.11+r)*.6+Math.sin(e*.047+r*1.7)*.4)*rn*n,swayY:Math.sin(e*.09+r*.7)*rn*.5*n,lift:(Math.sin(e*.13+r*1.3)*.6+Math.sin(e*.061+r*2.1)*.4)*an*n,dist:Math.sin(e*.05+r*1.1)*on*n}},Jn=1.44,Yn=e=>{let t=e.kind===`box`?.5:e.kind===`sphere`?.74:e.kind===`cone`?.68:.9;return e.scale*Math.max(t,e.stretchY*.55)},Xn=e=>{for(let t=0;t<6;t+=1)for(let t=0;t<e.length;t+=1)for(let n=t+1;n<e.length;n+=1){let r=e[t],i=e[n],a=(Yn(r)+Yn(i))*1.3,o=i.r-r.r,s=i.u-r.u,c=i.d-r.d,l=Math.hypot(o,s,c);if(l>=a)continue;l<.001&&(o=1,s=.5,c=.25,l=Math.hypot(o,s,c));let u=(a-l)/2/l;r.r-=o*u,r.u-=s*u,r.d-=c*u,i.r+=o*u,i.u+=s*u,i.d+=c*u}e.forEach(e=>{e.d=Math.max(e.d,1)})},Zn=5.2,Qn=1.4,$n=e=>{e.forEach((e,t)=>{let n=Yn(e)*Jn;Math.abs(e.u)-n<Qn&&Math.abs(e.r)-n<Zn&&(e.r=(e.r===0?t%2==0?1:-1:Math.sign(e.r))*(Zn+n+.35))})},er=e=>{e.forEach((e,t)=>{let n=2.8+Yn(e)*Jn,r=Math.hypot(e.r,e.u);if(r>=n)return;let i=(t%2==0?1:-1)*Math.PI*.16,a=r>.001?e.r/r:Math.cos(i),o=r>.001?e.u/r:Math.sin(i);e.r=a*n,e.u=o*n})},tr=(e,t,n,r,i,a=1)=>{let o=xn(t)+e*97,s=e=>bn(o+e),c=Ln(e,t),l=[],u=Math.min(1.6,Math.max(.65,a)),d=(e,t,n,r,i,a=1,o)=>{l.push({kind:e,r:t,u:n,d:r,scale:i*u,stretchY:a,upright:a>1.2,colorSlot:o})},f=(e,t,n,r,i,a=1,o=0)=>{d(e,-Math.abs(t),n,r,i,a,o),d(e,Math.abs(t),n,r,i,a,o)};switch(n){case`orbit`:{let e=4.4+s(1)*.6;for(let t=0;t<6;t+=1){let n=t/6*Math.PI*2+s(2)*.6;d(t===0?`torus`:`sphere`,Math.cos(n)*e,Math.sin(n)*e,.6+s(10+t)*1.4,.42+s(20+t)*.32)}break}case`pushIn`:{let e=4.3+s(1)*.5;[-1,1].forEach((t,n)=>{d(`box`,t*e,-.6,.5+s(n)*.5,.55+s(2+n)*.2,2.8+s(6+n)*.8),d(`box`,t*(e+1.6),.6,4.5+s(3+n)*2,.7+s(4+n)*.3,3.4)});break}case`track`:for(let e=0;e<2;e+=1){let t=e===0?-1:1;for(let n=0;n<3;n+=1)d(`box`,t*(4.2+s(e*5+n)*.4),-.4+(s(e*7+n)-.5)*.6,.5+n*2.4,.5+s(e*3+n)*.15,2.6+s(e+n)*.6)}break;case`crane`:{let e=3.6+s(1)*.5;for(let t=0;t<5;t+=1){let n=Math.PI*(.15+t/4*.7);d(`box`,Math.cos(n)*e,Math.abs(Math.sin(n))*e+1.2,.6+s(30+t)*.8,.45+s(40+t)*.25,1.4)}break}case`swell`:{let e=4.2+s(2)*.5;for(let t=0;t<2;t+=1)f(`box`,e,-1.5+t*2.1,1+t*1.2,.48-t*.06,1.45,t%2);f(`sphere`,e,2.65,3.4,.5,1,0);break}case`spiral`:for(let e=0;e<7;e+=1){let t=e/6,n=c*t*Math.PI*2.2+s(1)*.5;d(`sphere`,Math.cos(n)*4.3,-2.2+t*5.2,.5+t*2.2,.32+s(20+e)*.2)}break;case`pendulum`:for(let e=0;e<4;e+=1)d(`box`,-3.9+e*2.6+(s(e)-.5)*.5,3+s(e*2)*1.2,.5+s(e*3)*1.2,.3+s(e*4)*.12,2.2+s(e*5)*.8);break;case`flyby`:for(let e=0;e<3;e+=1)f(`box`,4.25+s(e)*.25,-.45+e*.45,1+e*2.1,.42+s(e*3)*.1,2.2,e%2);break;case`pullBack`:f(`sphere`,5.8+s(9)*.5,1.25,6.8+s(11),1.25+s(12)*.25,1,0);for(let e=0;e<2;e+=1)f(e===0?`box`:`cone`,4.4+e*1.15,-1.4+e*2.2,2.2+e*2.1,.58+s(e*4)*.18,e===0?1.5:1,1);break;case`arc`:{let e=5.2+s(1)*.6;for(let t=0;t<5;t+=1){let n=(-.5+t/4)*1.5*c;d(t===2?`torus`:`sphere`,Math.sin(n)*e,.3+Math.cos(n)*.7,1+s(20+t)*1.6,.45+s(30+t)*.32)}break}case`float`:for(let e=0;e<3;e+=1)f(`sphere`,4.1+e*.85,-1.2+e*1.35,1.2+e*1.55,.42+s(e*4)*.22,1,e%2);break;case`glide`:for(let e=0;e<3;e+=1)f(`box`,4.25+s(e)*.3,-1.5+e*1.7,1+e*1.7,.46+s(e*2)*.12,1.85,e%2);break;default:f(`torus`,5.6,1.55,7.2+s(1),1.05+s(2)*.2,1,0),f(`sphere`,4.45,-1.1,2.1+s(4),.58+s(5)*.16,1,1)}return er(l),$n(l),Xn(l),er(l),$n(l),l.map((e,t)=>({kind:e.kind,position:jn(r,i.offsetR+e.r,i.offsetU+e.u,e.d),scale:e.scale,stretchY:e.stretchY,upright:e.upright,spinSpeed:.04+s(t*13+5)*.1,colorSlot:e.colorSlot??t%2,layer:e.d>3.5?`far`:`near`}))},nr=e=>Math.round(Math.min(48,Math.max(4,Number.isFinite(e)?e:F.backgroundParticleCircumference))),rr=e=>Math.round(Math.min(4,Math.max(1,Number.isFinite(e)?e:F.backgroundParticleRadial))),ir=e=>(e%8+8)%8,ar=2.4,or=5.2,sr=.64,cr=(e,t)=>{let n=0,r=1/t,i=e;for(;i>0;)n+=i%t*r,i=Math.floor(i/t),r/=t;return n},lr=(e,t)=>t===0?e:{position:{x:e.position.x+e.forward.x*8*t,y:e.position.y+e.forward.y*8*t,z:e.position.z+e.forward.z*8*t},forward:e.forward,right:e.right,up:e.up},ur=(e,t,n,r,i,a)=>{let o=xn(a),s=Math.PI*(3-Math.sqrt(5)),c=Math.PI*2,l=bn(o+991)*c,u=r*i,d=ir(n)*u*3;for(let a=0;a<i;a+=1)for(let f=0;f<r;f+=1){let p=a*r+f,m=o+n*131+p*17,h=(a+.35+bn(m+4)*.3)/i,g=ar+Math.sqrt(h)*or,_=l+(n+a)*s+f/r*c+(bn(m+3)-.5)*(c/r),v=(cr(p+1,2)+(bn(m+2)-.5)/u-.5)*8,y=jn(t,Math.cos(_)*g,Math.sin(_)*g*sr,v);e[d]=y.x,e[d+1]=y.y,e[d+2]=y.z,d+=3}},dr=(0,V.createContext)(null),fr=()=>(0,V.useContext)(dr),pr=()=>{let e=fr(),t=Le(e=>e.lyricRenderQuality);return e??t},mr=e=>e,hr=({onClick:e,label:t,title:n,isDaylight:r})=>(0,H.jsx)(`button`,{type:`button`,onClick:e,className:`h-6 rounded-md px-1.5 text-[10px] font-bold transition-all ${r?`bg-white shadow-sm hover:bg-white/90`:`bg-white/20 shadow-sm hover:bg-white/30`}`,title:n,"aria-label":n,children:t}),gr=({active:e,onToggle:t,label:n,theme:r,children:i})=>(0,H.jsx)(`button`,{type:`button`,onClick:t,className:`flex h-6 w-6 items-center justify-center rounded-md transition-all ${e?``:`opacity-40 hover:opacity-100`}`,style:e?{color:r?.accentColor??`var(--local-accent)`}:void 0,title:n,"aria-label":n,"aria-pressed":e,children:i}),_r=(e,t)=>e[(e.indexOf(t)+1)%e.length],vr=({label:e,description:t,checked:n,onChange:r,theme:i})=>(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-4`,children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:i.primaryColor},children:e}),t&&(0,H.jsx)(`div`,{className:`max-w-[320px] text-xs opacity-70`,style:{color:i.secondaryColor},children:t})]}),(0,H.jsx)(`button`,{type:`button`,"aria-pressed":n,disabled:!r,onClick:()=>r?.(!n),className:`h-6 w-12 shrink-0 rounded-full p-1 transition-colors disabled:opacity-45`,style:{backgroundColor:n?i.secondaryColor:P(i.secondaryColor,.18)},children:(0,H.jsx)(`div`,{className:`h-4 w-4 rounded-full shadow-sm transition-transform ${n?`translate-x-6`:`translate-x-0`}`,style:{backgroundColor:i.backgroundColor}})})]}),yr=({config:e,actions:t,t:n,theme:r,controlCardBg:i,rangeInputClass:a,onSliderPointerDown:o,onSliderCommit:s})=>{let c=e?.common,l=t?.common,u=P(r.secondaryColor,.16),d=c?.opacity??.75;return(0,H.jsxs)(H.Fragment,{children:[(0,H.jsxs)(`div`,{className:`rounded-[24px] border p-4 space-y-4`,style:{backgroundColor:i,borderColor:u},children:[(0,H.jsx)(vr,{label:n(`options.disableVisualizerVignette`),description:n(`options.disableVisualizerVignetteDesc`),checked:c?.disableVignette??!1,onChange:l?.onDisableVignetteChange,theme:r}),(0,H.jsx)(vr,{label:n(`options.disableVisualizerGeometricBackground`),description:n(`options.disableVisualizerGeometricBackgroundDesc`),checked:c?.disableGeometricBackground??!1,onChange:l?.onDisableGeometricChange,theme:r})]}),(0,H.jsx)(`div`,{className:`rounded-[24px] border p-4 space-y-4`,style:{backgroundColor:i,borderColor:u},children:(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:r.primaryColor},children:n(`options.previewCoverBackgroundSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-70`,style:{color:r.secondaryColor},children:n(`options.previewCoverBackgroundSettingsDesc`)}),(0,H.jsx)(vr,{label:n(`theme.addCoverColor`),description:n(`options.coverColorBackgroundDesc`),checked:c?.useCoverColorBg??!1,onChange:l?.onCoverColorChange,theme:r}),(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:r.primaryColor},children:[(0,H.jsx)(`span`,{children:n(`options.previewCoverBackgroundOpacity`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:r.secondaryColor},children:[Math.round(d*100),`%`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`1`,step:`0.05`,value:d,onChange:e=>l?.onOpacityChange?.(Number(e.target.value)),onPointerDown:o,onPointerUp:s,className:a})]})})]})},br=24,xr=96,Sr=()=>{if(typeof navigator>`u`)return!1;let e=navigator.userAgent,t=/iPad|iPhone|iPod/i.test(e)||navigator.platform===`MacIntel`&&navigator.maxTouchPoints>1,n=/WebKit/i.test(e),r=/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser|GSA/i.test(e);return t&&n&&!r},Cr=e=>new Promise(t=>{if(typeof document>`u`){t(null);return}let n=new Image;n.crossOrigin=`anonymous`,n.decoding=`async`,n.onload=()=>{try{let e=document.createElement(`canvas`),r=document.createElement(`canvas`);e.width=br,e.height=br,r.width=xr,r.height=xr;let i=e.getContext(`2d`),a=r.getContext(`2d`);if(!i||!a){t(null);return}let o=n.naturalWidth||n.width,s=n.naturalHeight||n.height,c=Math.min(o,s),l=Math.max(0,(o-c)/2),u=Math.max(0,(s-c)/2);i.imageSmoothingEnabled=!0,i.imageSmoothingQuality=`high`,i.drawImage(n,l,u,c,c,0,0,br,br),a.imageSmoothingEnabled=!0,a.imageSmoothingQuality=`high`,a.globalAlpha=1,a.drawImage(e,0,0,br,br,0,0,xr,xr),[{x:-8,y:-8,size:112,alpha:.22},{x:6,y:0,size:xr,alpha:.14},{x:0,y:6,size:xr,alpha:.14}].forEach(({x:t,y:n,size:r,alpha:i})=>{a.globalAlpha=i,a.drawImage(e,0,0,br,br,t,n,r,r)}),a.globalAlpha=1,t(r.toDataURL(`image/jpeg`,.72))}catch(e){console.warn(`[FluidBackground] Failed to build soft focus cover`,e),t(null)}},n.onerror=()=>t(null),n.src=e}),wr=384,Tr=(e,t)=>new Promise(n=>{if(typeof document>`u`){n(null);return}let r=new Image;r.crossOrigin=`anonymous`,r.decoding=`async`,r.onload=()=>{try{let e=r.naturalWidth||r.width,i=r.naturalHeight||r.height;if(!e||!i){n(null);return}let a=Math.min(1,t/Math.max(e,i)),o=Math.max(1,Math.round(e*a)),s=Math.max(1,Math.round(i*a)),c=document.createElement(`canvas`);c.width=o,c.height=s;let l=c.getContext(`2d`);if(!l){n(null);return}l.imageSmoothingEnabled=!0,l.imageSmoothingQuality=`high`,l.drawImage(r,0,0,o,s),n(c.toDataURL(`image/jpeg`,.82))}catch(e){console.warn(`[FluidBackground] Failed to downscale cover`,e),n(null)}},r.onerror=()=>n(null),r.src=e}),Er=(0,V.memo)(({coverUrl:e,theme:t})=>{let n=(0,V.useMemo)(Sr,[]),[r,i]=(0,V.useState)(null);(0,V.useEffect)(()=>{let t=!1;return!n||!e?(i(null),()=>{t=!0}):(i(null),Cr(e).then(e=>{t||i(e)}),()=>{t=!0})},[e,n]);let a=(0,V.useRef)(0),[o,s]=(0,V.useState)([]),[c,l]=(0,V.useState)(()=>new Set);(0,V.useEffect)(()=>{if(n)return;if(!e){s([]);return}let t=!1;return Tr(e,wr).then(n=>{if(t)return;let r=n??e;s(t=>{let n=t[t.length-1];return n&&n.sourceCover===e?t:(a.current+=1,[...n?[n]:[],{url:r,sourceCover:e,key:a.current}])})}),()=>{t=!0}},[e,n]);let u=(0,V.useCallback)(e=>{l(t=>t.has(e)?t:new Set(t).add(e))},[]),d=n?r??e??null:null,f=n&&!!r,p=(0,V.useMemo)(()=>n?{transform:`scale(${f?1.28:1.2}) translateZ(0)`,opacity:f?.94:.3,willChange:`transform, opacity`,backfaceVisibility:`hidden`,WebkitBackfaceVisibility:`hidden`}:{filter:`blur(40px)`,transform:`scale(1.5) translateZ(0)`,opacity:1,willChange:`transform, opacity, filter`,backfaceVisibility:`hidden`,WebkitBackfaceVisibility:`hidden`},[n,f]);return(0,H.jsxs)(`div`,{className:`absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0`,style:{isolation:`isolate`,contain:`paint`,transform:`translateZ(0)`},children:[e?(0,H.jsxs)(H.Fragment,{children:[n?(0,H.jsx)(`img`,{src:d??e,alt:``,"aria-hidden":`true`,draggable:!1,decoding:`async`,className:`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out`,style:p}):o.map((e,t)=>{let n=t===o.length-1,r=c.has(e.key);return(0,H.jsx)(D.div,{className:`absolute inset-0 w-full h-full`,style:{willChange:`opacity`},initial:{opacity:+!n},animate:{opacity:n&&!r?0:1},transition:{duration:1.5,ease:`easeInOut`},onAnimationComplete:()=>{n&&r&&(s(t=>t.filter(t=>t.key===e.key)),l(t=>t.has(e.key)?new Set([e.key]):t))},children:(0,H.jsx)(`img`,{src:e.url,alt:``,"aria-hidden":`true`,draggable:!1,decoding:`async`,className:`absolute inset-0 w-full h-full object-cover`,style:p,ref:t=>{t&&!c.has(e.key)&&t.decode().then(()=>requestAnimationFrame(()=>u(e.key))).catch(()=>u(e.key))},onError:()=>{s(t=>t.length>1?t.filter(t=>t.key!==e.key):t)}})},e.key)}),n&&(0,H.jsxs)(H.Fragment,{children:[!f&&(0,H.jsx)(`img`,{src:e,alt:``,"aria-hidden":`true`,draggable:!1,decoding:`async`,className:`absolute inset-0 w-full h-full object-cover`,style:{transform:`scale(1.36) translateZ(0)`,opacity:.12,willChange:`transform, opacity`,backfaceVisibility:`hidden`,WebkitBackfaceVisibility:`hidden`}}),(0,H.jsx)(`div`,{className:`absolute inset-0 w-full h-full`,style:{backgroundColor:t.backgroundColor,opacity:.28}}),(0,H.jsx)(`div`,{className:`absolute inset-0 w-full h-full`,style:{background:`radial-gradient(circle at 20% 20%, ${t.accentColor}55 0%, transparent 42%), radial-gradient(circle at 80% 28%, ${t.secondaryColor}50 0%, transparent 44%), radial-gradient(circle at 50% 78%, ${t.primaryColor}28 0%, transparent 52%)`,opacity:f?.52:.7}})]})]}):(0,H.jsx)(`div`,{className:`absolute inset-0 w-full h-full transition-colors duration-1000`,style:{backgroundColor:t.backgroundColor,opacity:.8}}),(0,H.jsx)(`div`,{className:`absolute inset-0 w-full h-full`,style:{background:`linear-gradient(to bottom right, ${t.primaryColor}, transparent, ${t.secondaryColor})`,opacity:n?.2:.4,mixBlendMode:n?`normal`:`overlay`}})]})},(e,t)=>{if(e.coverUrl!==t.coverUrl)return!1;let n=e.theme,r=t.theme;return n.backgroundColor===r.backgroundColor&&n.primaryColor===r.primaryColor&&n.secondaryColor===r.secondaryColor}),Dr=e=>{switch(e.type){case`circle`:return`bass`;case`square`:return`lowMid`;case`triangle`:return`mid`;case`cross`:return`treble`;case`icon`:return`vocal`;default:return`default`}},Or=e=>e===`triangle`?`polygon(50% 0%, 0% 100%, 100% 100%)`:e===`cross`?`polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)`:`none`,kr=(e,t)=>{let n=(e.type===`circle`||e.type===`square`)&&!e.filled;return{left:`${e.initialX}%`,top:`${e.initialY}%`,width:e.size,height:e.size,border:n?`1px solid ${t.secondaryColor}`:`none`,backgroundColor:n?`transparent`:t.secondaryColor,borderRadius:e.type===`circle`?`50%`:`0%`,opacity:e.opacity,clipPath:Or(e.type)}},Ar=({disabled:e=!1})=>e?null:(0,H.jsx)(`div`,{className:`absolute inset-0 pointer-events-none`,style:{background:`radial-gradient(circle, transparent 40%, rgba(0,0,0,0.6) 100%)`}}),jr=({theme:e,shapes:t,particles:n,hideShapes:r,disableVignette:i})=>(0,H.jsxs)(`div`,{className:`absolute inset-0`,children:[!r&&(0,H.jsxs)(H.Fragment,{children:[t.map(t=>{if(t.type===`icon`&&t.iconName){let n=Dt[t.iconName];if(n)return(0,H.jsx)(`div`,{className:`absolute flex items-center justify-center`,style:{left:`${t.initialX}%`,top:`${t.initialY}%`,width:t.size,height:t.size,color:e.secondaryColor,opacity:t.opacity,transform:`rotate(${t.initialRotation}deg)`},children:(0,H.jsx)(n,{size:t.size,strokeWidth:1,absoluteStrokeWidth:!0})},t.id)}return(0,H.jsx)(`div`,{className:`absolute`,style:{...kr(t,e),transform:`rotate(${t.initialRotation}deg)`}},t.id)}),n.map(t=>(0,H.jsx)(`div`,{className:`absolute rounded-full`,style:{backgroundColor:e.accentColor,width:t.size,height:t.size,left:`${t.left}%`,top:`${t.top}%`,opacity:t.opacity}},`p-${t.id}`))]}),(0,H.jsx)(Ar,{disabled:i})]}),Mr=({theme:e,audioPower:t,audioBands:n,shapes:r,particles:i,hideShapes:a,disableVignette:o})=>{let s=e=>{let n=k(e||t,{stiffness:300,damping:30});return O(n,[10,200],[.95,1.45])},c={bass:s(n?.bass),lowMid:s(n?.lowMid),mid:s(n?.mid),vocal:s(n?.vocal),treble:s(n?.treble),default:s(t)};return(0,H.jsxs)(`div`,{className:`absolute inset-0`,children:[!a&&(0,H.jsxs)(H.Fragment,{children:[r.map(t=>{if(t.type===`icon`&&t.iconName){let n=Dt[t.iconName];if(n)return(0,H.jsx)(D.div,{className:`absolute flex items-center justify-center`,style:{left:`${t.initialX}%`,top:`${t.initialY}%`,width:t.size,height:t.size,color:e.secondaryColor,scale:c.vocal},animate:{y:t.reverse?[-30,30,-30]:[30,-30,30],x:t.reverse?[15,-15,15]:[-15,15,-15],rotate:[t.initialRotation,t.initialRotation+360],opacity:[0,t.opacity*3,0]},transition:{duration:t.duration,repeat:1/0,ease:`linear`,delay:t.delay,opacity:{duration:t.duration*.5,repeat:1/0,ease:`easeInOut`,delay:t.delay}},children:(0,H.jsx)(n,{size:t.size,strokeWidth:1,absoluteStrokeWidth:!0})},t.id)}return(0,H.jsx)(D.div,{className:`absolute`,style:{...kr(t,e),scale:c[Dr(t)]},animate:{y:t.reverse?[-30,30,-30]:[30,-30,30],x:t.reverse?[15,-15,15]:[-15,15,-15],rotate:[t.initialRotation,t.initialRotation+360]},transition:{duration:t.duration,repeat:1/0,ease:`linear`,delay:t.delay}},t.id)}),i.map(t=>(0,H.jsx)(D.div,{className:`absolute rounded-full`,style:{backgroundColor:e.accentColor,width:t.size,height:t.size,left:`${t.left}%`,top:`${t.top}%`,opacity:t.opacity},animate:{y:[0,-100],opacity:[0,t.opacity,0]},transition:{duration:t.duration,repeat:1/0,ease:`linear`,delay:t.delay}},`p-${t.id}`))]}),(0,H.jsx)(Ar,{disabled:o})]})},Nr=({theme:e,audioPower:t,audioBands:n,seed:r,hideShapes:i=!1,disableVignette:a=!1,paused:o=!1})=>{let s=(0,V.useMemo)(()=>{let t=[`circle`,`square`,`triangle`,`cross`],n=e.lyricsIcons||[],r=0;return Array.from({length:15}).map((e,i)=>{let a=n.length>0&&Math.random()>.7&&r<6;a&&(r+=1);let o=a?n[Math.floor(Math.random()*n.length)]:null;return{id:i,type:a?`icon`:t[Math.floor(Math.random()*t.length)],iconName:o,initialX:Math.random()*100,initialY:Math.random()*100,size:40+Math.random()*100,duration:a?20+Math.random()*20:30+Math.random()*30,delay:Math.random()*5,opacity:.11+Math.random()*.08,reverse:Math.random()>.5,filled:Math.random()<.3,initialRotation:Math.random()*360}})},[e.lyricsIcons,r]),c=(0,V.useMemo)(()=>Array.from({length:20}).map((e,t)=>({id:t,size:Math.random()*4+1,left:Math.random()*100,top:Math.random()*100,opacity:Math.random()*.3,duration:15+Math.random()*20,delay:Math.random()*10})),[r]);return(0,H.jsx)(D.div,{className:`absolute inset-0`,initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.6,ease:`easeInOut`},children:o?(0,H.jsx)(jr,{theme:e,shapes:s,particles:c,hideShapes:i,disableVignette:a}):(0,H.jsx)(Mr,{theme:e,audioPower:t,audioBands:n,shapes:s,particles:c,hideShapes:i,disableVignette:a})})},Pr=V.memo(e=>{let t=String(e.seed??`default`);return(0,H.jsx)(`div`,{className:`absolute inset-0 overflow-hidden pointer-events-none`,children:(0,H.jsx)(E,{mode:`sync`,children:(0,H.jsx)(Nr,{...e},t)})})},(e,t)=>{if(e.seed!==t.seed||e.audioPower!==t.audioPower||e.hideShapes!==t.hideShapes||e.disableVignette!==t.disableVignette||e.paused!==t.paused)return!1;let n=e.audioBands,r=t.audioBands;if(!n!=!r)return!1;let i=!0;if(n&&r&&(i=n.bass===r.bass&&n.lowMid===r.lowMid&&n.mid===r.mid&&n.vocal===r.vocal&&n.treble===r.treble),!i)return!1;let a=e.theme,o=t.theme,s=a.backgroundColor===o.backgroundColor&&a.primaryColor===o.primaryColor&&a.secondaryColor===o.secondaryColor&&a.accentColor===o.accentColor,c=!!(a.lyricsIcons===o.lyricsIcons||a.lyricsIcons?.length===o.lyricsIcons?.length&&a.lyricsIcons?.every((e,t)=>e===o.lyricsIcons?.[t]));return s&&c}),Fr=mr({mode:`common`,order:10,labelKey:`options.visualizerBackgroundModeCommon`,labelFallback:`Common`,render:({config:e,theme:t,coverUrl:n,audioPower:r,audioBands:i,seed:a,staticMode:o,paused:s})=>{let c=e?.common,l=c?.useCoverColorBg??!1;return(0,H.jsxs)(H.Fragment,{children:[l&&(0,H.jsx)(D.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:1},className:`absolute inset-0 z-0`,children:(0,H.jsx)(Er,{coverUrl:n,theme:t})},`fluid-bg`),(0,H.jsx)(`div`,{className:`absolute inset-0 z-0 transition-all duration-1000`,style:{backgroundColor:t.backgroundColor,opacity:l?c?.opacity??.75:1}}),!o&&(0,H.jsx)(`div`,{className:`absolute inset-0 z-0`,children:(0,H.jsx)(Pr,{theme:t,audioPower:r,audioBands:i,seed:a,hideShapes:c?.disableGeometricBackground??!1,disableVignette:c?.disableVignette??!1,paused:s})})]})},renderSettingsPanel:e=>(0,H.jsx)(yr,{...e}),renderQuickControls:({config:e,actions:t,t:n,theme:r})=>{let i=e?.common?.useCoverColorBg??!1;return(0,H.jsx)(gr,{active:i,theme:r,label:n(i?`theme.addCoverColor`:`theme.useDefaultColor`),onToggle:()=>t?.common?.onCoverColorChange?.(!i),children:(0,H.jsx)(g,{size:14})})},resetSettings:e=>{e?.common?.onOpacityChange?.(.75),e?.common?.onCoverColorChange?.(!1),e?.common?.onDisableVignetteChange?.(!1),e?.common?.onDisableGeometricChange?.(!1)}}),Ir=`#version 300 es
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
}`,Lr=8294400,Rr=class{parentElement;canvasElement;gl;program=null;uniformLocations={};fragmentShader;rafId=null;lastRenderTime=0;currentFrame=0;speed=0;currentSpeed=0;providedUniforms;mipmaps=[];hasBeenDisposed=!1;resolutionChanged=!0;textures=new Map;minPixelRatio;maxPixelCount;isSafari=Hr();uniformCache={};textureUnitMap=new Map;ownerDocument;constructor(e,t,n,r,i=0,a=0,o=2,s=Lr,c=[]){if(e?.nodeType===1)this.parentElement=e;else throw Error(`Paper Shaders: parent element must be an HTMLElement`);if(this.ownerDocument=e.ownerDocument,!this.ownerDocument.querySelector(`style[data-paper-shader]`)){let e=this.ownerDocument.createElement(`style`);e.innerHTML=Vr,e.setAttribute(`data-paper-shader`,``),this.ownerDocument.head.prepend(e)}let l=this.ownerDocument.createElement(`canvas`);this.canvasElement=l,this.parentElement.prepend(l),this.fragmentShader=t,this.providedUniforms=n,this.mipmaps=c,this.currentFrame=a,this.minPixelRatio=o,this.maxPixelCount=s;let u=l.getContext(`webgl2`,r);if(!u)throw Error(`Paper Shaders: WebGL is not supported in this browser`);this.gl=u,this.initProgram(),this.setupPositionAttribute(),this.setupUniforms(),this.setUniformValues(this.providedUniforms),this.setupResizeObserver(),visualViewport?.addEventListener(`resize`,this.handleVisualViewportChange),this.setupIntersectionObserver(),this.setSpeed(i),this.parentElement.setAttribute(`data-paper-shader`,``),this.parentElement.paperShaderMount=this,this.ownerDocument.addEventListener(`visibilitychange`,this.handleDocumentVisibilityChange)}initProgram=()=>{let e=Br(this.gl,Ir,this.fragmentShader);e&&(this.program=e)};setupPositionAttribute=()=>{let e=this.gl.getAttribLocation(this.program,`a_position`),t=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,t),this.gl.bufferData(this.gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),this.gl.STATIC_DRAW),this.gl.enableVertexAttribArray(e),this.gl.vertexAttribPointer(e,2,this.gl.FLOAT,!1,0,0)};setupUniforms=()=>{let e={u_time:this.gl.getUniformLocation(this.program,`u_time`),u_pixelRatio:this.gl.getUniformLocation(this.program,`u_pixelRatio`),u_resolution:this.gl.getUniformLocation(this.program,`u_resolution`)};Object.entries(this.providedUniforms).forEach(([t,n])=>{if(e[t]=this.gl.getUniformLocation(this.program,t),n instanceof HTMLImageElement){let n=`${t}AspectRatio`;e[n]=this.gl.getUniformLocation(this.program,n)}}),this.uniformLocations=e};renderScale=1;parentWidth=0;parentHeight=0;parentDevicePixelWidth=0;parentDevicePixelHeight=0;devicePixelsSupported=!1;intersectionObserver=null;isInViewport=!0;resizeObserver=null;setupResizeObserver=()=>{this.resizeObserver=new ResizeObserver(([e])=>{if(e?.borderBoxSize[0]){let t=e.devicePixelContentBoxSize?.[0];t!==void 0&&(this.devicePixelsSupported=!0,this.parentDevicePixelWidth=t.inlineSize,this.parentDevicePixelHeight=t.blockSize),this.parentWidth=e.borderBoxSize[0].inlineSize,this.parentHeight=e.borderBoxSize[0].blockSize}this.handleResize()}),this.resizeObserver.observe(this.parentElement)};setupIntersectionObserver=()=>{let e=this.ownerDocument.defaultView;e?.IntersectionObserver&&(this.intersectionObserver=new e.IntersectionObserver(([e])=>{this.isInViewport=e?.isIntersecting??!0,this.updateCurrentSpeed()}),this.intersectionObserver.observe(this.parentElement))};handleVisualViewportChange=()=>{this.resizeObserver?.disconnect(),this.setupResizeObserver()};handleResize=()=>{let e=0,t=0,n=Math.max(1,window.devicePixelRatio),r=visualViewport?.scale??1;if(this.devicePixelsSupported){let i=Math.max(1,this.minPixelRatio/n);e=this.parentDevicePixelWidth*i*r,t=this.parentDevicePixelHeight*i*r}else{let i=Math.max(n,this.minPixelRatio)*r;if(this.isSafari){let e=Ur(this.ownerDocument);i*=Math.max(1,e)}e=Math.round(this.parentWidth)*i,t=Math.round(this.parentHeight)*i}let i=Math.sqrt(this.maxPixelCount)/Math.sqrt(e*t),a=Math.min(1,i),o=Math.round(e*a),s=Math.round(t*a),c=o/Math.round(this.parentWidth);(this.canvasElement.width!==o||this.canvasElement.height!==s||this.renderScale!==c)&&(this.renderScale=c,this.canvasElement.width=o,this.canvasElement.height=s,this.resolutionChanged=!0,this.gl.viewport(0,0,this.gl.canvas.width,this.gl.canvas.height),this.render(performance.now()))};render=e=>{if(this.hasBeenDisposed)return;if(this.program===null){console.warn(`Tried to render before program or gl was initialized`);return}let t=e-this.lastRenderTime;this.lastRenderTime=e,this.currentSpeed!==0&&(this.currentFrame+=t*this.currentSpeed),this.gl.clear(this.gl.COLOR_BUFFER_BIT),this.gl.useProgram(this.program),this.gl.uniform1f(this.uniformLocations.u_time,this.currentFrame*.001),this.resolutionChanged&&=(this.gl.uniform2f(this.uniformLocations.u_resolution,this.gl.canvas.width,this.gl.canvas.height),this.gl.uniform1f(this.uniformLocations.u_pixelRatio,this.renderScale),!1),this.gl.drawArrays(this.gl.TRIANGLES,0,6),this.currentSpeed===0?this.rafId=null:this.requestRender()};requestRender=()=>{this.rafId!==null&&cancelAnimationFrame(this.rafId),this.rafId=requestAnimationFrame(this.render)};setTextureUniform=(e,t)=>{if(!t.complete||t.naturalWidth===0)throw Error(`Paper Shaders: image for uniform ${e} must be fully loaded`);let n=this.textures.get(e);n&&this.gl.deleteTexture(n),this.textureUnitMap.has(e)||this.textureUnitMap.set(e,this.textureUnitMap.size);let r=this.textureUnitMap.get(e);this.gl.activeTexture(this.gl.TEXTURE0+r);let i=this.gl.createTexture();this.gl.bindTexture(this.gl.TEXTURE_2D,i),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_S,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_T,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MAG_FILTER,this.gl.LINEAR),this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,t),this.mipmaps.includes(e)&&(this.gl.generateMipmap(this.gl.TEXTURE_2D),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR_MIPMAP_LINEAR));let a=this.gl.getError();if(a!==this.gl.NO_ERROR||i===null){console.error(`Paper Shaders: WebGL error when uploading texture:`,a);return}this.textures.set(e,i);let o=this.uniformLocations[e];if(o){this.gl.uniform1i(o,r);let n=`${e}AspectRatio`,i=this.uniformLocations[n];if(i){let e=t.naturalWidth/t.naturalHeight;this.gl.uniform1f(i,e)}}};areUniformValuesEqual=(e,t)=>e===t?!0:Array.isArray(e)&&Array.isArray(t)&&e.length===t.length?e.every((e,n)=>this.areUniformValuesEqual(e,t[n])):!1;setUniformValues=e=>{this.gl.useProgram(this.program),Object.entries(e).forEach(([e,t])=>{let n=t;if(t instanceof HTMLImageElement&&(n=`${t.src.slice(0,200)}|${t.naturalWidth}x${t.naturalHeight}`),this.areUniformValuesEqual(this.uniformCache[e],n))return;this.uniformCache[e]=n;let r=this.uniformLocations[e];if(!r)console.warn(`Uniform location for ${e} not found`);else if(t instanceof HTMLImageElement)this.setTextureUniform(e,t);else if(Array.isArray(t)){let n=null,i=null;if(t[0]!==void 0&&Array.isArray(t[0])){let r=t[0].length;if(t.every(e=>e.length===r))n=t.flat(),i=r;else{console.warn(`All child arrays must be the same length for ${e}`);return}}else n=t,i=n.length;switch(i){case 2:this.gl.uniform2fv(r,n);break;case 3:this.gl.uniform3fv(r,n);break;case 4:this.gl.uniform4fv(r,n);break;case 9:this.gl.uniformMatrix3fv(r,!1,n);break;case 16:this.gl.uniformMatrix4fv(r,!1,n);break;default:console.warn(`Unsupported uniform array length: ${i}`)}}else typeof t==`number`?this.gl.uniform1f(r,t):typeof t==`boolean`?this.gl.uniform1i(r,+!!t):console.warn(`Unsupported uniform type for ${e}: ${typeof t}`)})};getCurrentFrame=()=>this.currentFrame;setFrame=e=>{this.currentFrame=e,this.lastRenderTime=performance.now(),this.render(performance.now())};setSpeed=(e=1)=>{this.speed=e,this.updateCurrentSpeed()};updateCurrentSpeed=()=>{this.setCurrentSpeed(this.ownerDocument.hidden||!this.isInViewport?0:this.speed)};setCurrentSpeed=e=>{this.currentSpeed=e,this.rafId===null&&e!==0&&(this.lastRenderTime=performance.now(),this.rafId=requestAnimationFrame(this.render)),this.rafId!==null&&e===0&&(cancelAnimationFrame(this.rafId),this.rafId=null)};setMaxPixelCount=(e=Lr)=>{this.maxPixelCount=e,this.handleResize()};setMinPixelRatio=(e=2)=>{this.minPixelRatio=e,this.handleResize()};setUniforms=e=>{this.setUniformValues(e),this.providedUniforms={...this.providedUniforms,...e},this.render(performance.now())};handleDocumentVisibilityChange=()=>{this.updateCurrentSpeed()};dispose=()=>{this.hasBeenDisposed=!0,this.rafId!==null&&(cancelAnimationFrame(this.rafId),this.rafId=null),this.gl&&this.program&&(this.textures.forEach(e=>{this.gl.deleteTexture(e)}),this.textures.clear(),this.gl.deleteProgram(this.program),this.program=null,this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null),this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,null),this.gl.bindRenderbuffer(this.gl.RENDERBUFFER,null),this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null),this.gl.getError()),this.resizeObserver&&=(this.resizeObserver.disconnect(),null),this.intersectionObserver&&=(this.intersectionObserver.disconnect(),null),visualViewport?.removeEventListener(`resize`,this.handleVisualViewportChange),this.ownerDocument.removeEventListener(`visibilitychange`,this.handleDocumentVisibilityChange),this.uniformLocations={},this.canvasElement.remove(),delete this.parentElement.paperShaderMount}};function zr(e,t,n){let r=e.createShader(t);return r?(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(console.error(`An error occurred compiling the shaders: `+e.getShaderInfoLog(r)),e.deleteShader(r),null)):null}function Br(e,t,n){let r=e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT),i=r?r.precision:null;i&&i<23&&(t=t.replace(/precision\s+(lowp|mediump)\s+float;/g,`precision highp float;`),n=n.replace(/precision\s+(lowp|mediump)\s+float/g,`precision highp float`).replace(/\b(uniform|varying|attribute)\s+(lowp|mediump)\s+(\w+)/g,`$1 highp $3`));let a=zr(e,e.VERTEX_SHADER,t),o=zr(e,e.FRAGMENT_SHADER,n);if(!a||!o)return null;let s=e.createProgram();return s?(e.attachShader(s,a),e.attachShader(s,o),e.linkProgram(s),e.getProgramParameter(s,e.LINK_STATUS)?(e.detachShader(s,a),e.detachShader(s,o),e.deleteShader(a),e.deleteShader(o),s):(console.error(`Unable to initialize the shader program: `+e.getProgramInfoLog(s)),e.deleteProgram(s),e.deleteShader(a),e.deleteShader(o),null)):null}var Vr=`@layer paper-shaders {
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
}`;function Hr(){let e=navigator.userAgent.toLowerCase();return e.includes(`safari`)&&!e.includes(`chrome`)&&!e.includes(`android`)}function Ur(e){let t=visualViewport?.scale??1,n=visualViewport?.width??window.innerWidth,r=window.innerWidth-e.documentElement.clientWidth,i=t*n+r,a=outerWidth/i,o=Math.round(100*a);return o%5==0?o/100:o===33?1/3:o===67?2/3:o===133?4/3:a}var U={fit:`contain`,scale:1,rotation:0,offsetX:0,offsetY:0,originX:.5,originY:.5,worldWidth:0,worldHeight:0},Wr={fit:`none`,scale:1,rotation:0,offsetX:0,offsetY:0,originX:.5,originY:.5,worldWidth:0,worldHeight:0},Gr={none:0,contain:1,cover:2},Kr=`
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846
`,qr=`
vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}
`,Jr=`
  float hash11(float p) {
    p = fract(p * 0.3183099) + 0.1;
    p *= p + 19.19;
    return fract(p * p);
  }
`,Yr=`
  float hash21(vec2 p) {
    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }
`,Xr=`
  float randomR(vec2 p) {
    vec2 uv = floor(p) / 100. + .5;
    return texture(u_noiseTexture, fract(uv)).r;
  }
`,Zr=`
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
`,Qr=`
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
`,$r={maxColorCount:10},ei=`#version 300 es
precision mediump float;

uniform float u_time;

uniform vec4 u_colors[${$r.maxColorCount}];
uniform float u_colorsCount;

uniform float u_distortion;
uniform float u_swirl;
uniform float u_grainMixer;
uniform float u_grainOverlay;

in vec2 v_objectUV;
out vec4 fragColor;

${Kr}
${qr}
${Yr}

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

  for (int i = 0; i < ${$r.maxColorCount}; i++) {
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
`,ti=`#version 300 es
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

${Zr}
${Kr}
${Jr}
${Yr}

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
`,ni={simplex:1,warp:2,dots:3,wave:4,ripple:5,swirl:6,sphere:7},ri={random:1,"2x2":2,"4x4":3,"8x8":4},ii=`#version 300 es
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

${Kr}
${qr}
${Xr}
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

${Qr}

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
`,ai=`#version 300 es
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

${Kr}
${qr}
${Yr}

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
`,oi={lines:1,linesIrregular:2,wave:3,zigzag:4,pattern:5},si={prism:1,lens:2,contour:3,cascade:4,flat:5},ci=`#version 300 es
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


${Yr}
${Kr}

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
`,li=`#version 300 es
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

${Kr}
${Yr}
${qr}

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
`,ui=`#version 300 es
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

${Kr}
${qr}
${Yr}

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
`,di={classic:0,gooey:1,holes:2,soft:3},fi={square:0,hex:1};function pi(e){if(Array.isArray(e))return e.length===4?e:e.length===3?[...e,1]:yi;if(typeof e!=`string`)return yi;let t,n,r,i=1;if(e.startsWith(`#`))[t,n,r,i]=mi(e);else if(e.startsWith(`rgb`)){let a=hi(e);if(a===null)return yi;[t,n,r,i]=a}else if(e.startsWith(`hsl`)){let a=gi(e);if(a===null)return yi;[t,n,r,i]=_i(a)}else return console.error(`Unsupported color format`,e),yi;return[vi(t,0,1),vi(n,0,1),vi(r,0,1),vi(i,0,1)]}function mi(e){return e=e.replace(/^#/,``),(e.length===3||e.length===4)&&(e=e.split(``).map(e=>e+e).join(``)),e.length===6&&(e+=`ff`),/^[0-9a-f]{8}$/i.test(e)?[parseInt(e.slice(0,2),16)/255,parseInt(e.slice(2,4),16)/255,parseInt(e.slice(4,6),16)/255,parseInt(e.slice(6,8),16)/255]:(console.warn(`Invalid hex color`),yi)}function hi(e){let t=e.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+))?\s*\)$/i);return t?[parseInt(t[1]??`0`)/255,parseInt(t[2]??`0`)/255,parseInt(t[3]??`0`)/255,t[4]===void 0?1:parseFloat(t[4])]:null}function gi(e){let t=e.match(/^hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([0-9.]+))?\s*\)$/i);return t?[parseInt(t[1]??`0`),parseInt(t[2]??`0`),parseInt(t[3]??`0`),t[4]===void 0?1:parseFloat(t[4])]:null}function _i(e){let[t,n,r,i]=e,a=t/360,o=n/100,s=r/100,c,l,u;if(n===0)c=l=u=s;else{let e=(e,t,n)=>(n<0&&(n+=1),n>1&&--n,n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*(2/3-n)*6:e),t=s<.5?s*(1+o):s+o-s*o,n=2*s-t;c=e(n,t,a+1/3),l=e(n,t,a),u=e(n,t,a-1/3)}return[c,l,u,i]}var vi=(e,t,n)=>Math.min(Math.max(e,t),n),yi=[.5,.5,.5,1];function bi(){if(typeof window>`u`)return;let e=new Image;return e.src=xi,e}var xi=`data:image/png;base64,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`;function Si(e){let t=V.useRef(void 0),n=V.useCallback(t=>{let n=e.map(e=>{if(e!=null){if(typeof e==`function`){let n=e,r=n(t);return typeof r==`function`?r:()=>{n(null)}}return e.current=t,()=>{e.current=null}}});return()=>{n.forEach(e=>e?.())}},e);return V.useMemo(()=>e.every(e=>e==null)?null:e=>{t.current&&=(t.current(),void 0),e!=null&&(t.current=n(e))},e)}function Ci(e){if(e.naturalWidth<1024&&e.naturalHeight<1024){if(e.naturalWidth<1||e.naturalHeight<1)return;let t=e.naturalWidth/e.naturalHeight;e.width=Math.round(t>1?1024*t:1024),e.height=Math.round(t>1?1024:1024/t)}}async function wi(e){let t={},n=[],r=e=>{try{return e.startsWith(`/`)||new URL(e),!0}catch{return!1}},i=e=>{try{return!e.startsWith(`/`)&&new URL(e,window.location.origin).origin!==window.location.origin}catch{return!1}};return Object.entries(e).forEach(([e,a])=>{if(typeof a==`string`){let o=a||`data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==`;if(!r(o)){console.warn(`Uniform "${e}" has invalid URL "${o}". Skipping image loading.`);return}let s=new Promise((n,r)=>{let a=new Image;i(o)&&(a.crossOrigin=`anonymous`),a.onload=()=>{Ci(a),t[e]=a,n()},a.onerror=()=>{console.error(`Could not set uniforms. Failed to load image at ${o}`),r()},a.src=o});n.push(s)}else if(a instanceof HTMLImageElement){let r=a.decode().then(()=>{Ci(a),t[e]=a});n.push(r)}else t[e]=a}),await Promise.all(n),t}var Ti=(0,V.forwardRef)(function({fragmentShader:e,uniforms:t,webGlContextAttributes:n,speed:r=0,frame:i=0,width:a,height:o,minPixelRatio:s,maxPixelCount:c,mipmaps:l,style:u,...d},f){let[p,m]=(0,V.useState)(!1),h=(0,V.useRef)(null),g=(0,V.useRef)(null),_=(0,V.useRef)(n);(0,V.useEffect)(()=>((async()=>{let n=await wi(t);h.current&&!g.current&&(g.current=new Rr(h.current,e,n,_.current,r,i,s,c,l),m(!0))})(),()=>{g.current?.dispose(),g.current=null}),[e]),(0,V.useEffect)(()=>{let e=!1;return(async()=>{let n=await wi(t);e||g.current?.setUniforms(n)})(),()=>{e=!0}},[t,p]),(0,V.useEffect)(()=>{g.current?.setSpeed(r)},[r,p]),(0,V.useEffect)(()=>{g.current?.setMaxPixelCount(c)},[c,p]),(0,V.useEffect)(()=>{g.current?.setMinPixelRatio(s)},[s,p]),(0,V.useEffect)(()=>{g.current?.setFrame(i)},[i,p]);let v=Si([h,f]);return(0,H.jsx)(`div`,{ref:v,style:a!==void 0||o!==void 0?{width:typeof a==`string`&&isNaN(+a)===!1?+a:a,height:typeof o==`string`&&isNaN(+o)===!1?+o:o,...u}:u,...d})});Ti.displayName=`ShaderMount`;function Ei(e,t){if(Object.keys(e).length!==Object.keys(t).length)return!1;for(let n in e)if(n===`colors`){let n=Array.isArray(e.colors),r=Array.isArray(t.colors);if(!n||!r){if(Object.is(e.colors,t.colors)===!1)return!1;continue}if(e.colors?.length!==t.colors?.length||!e.colors?.every((e,n)=>e===t.colors?.[n]))return!1}else if(Object.is(e[n],t[n])===!1)return!1;return!0}var Di={name:`Default`,params:{...U,speed:1,frame:0,colors:[`#e0eaff`,`#241d9a`,`#f75092`,`#9f50d3`],distortion:.8,swirl:.1,grainMixer:0,grainOverlay:0}};({...U}),{...U},{...U};var Oi=(0,V.memo)(function({speed:e=Di.params.speed,frame:t=Di.params.frame,colors:n=Di.params.colors,distortion:r=Di.params.distortion,swirl:i=Di.params.swirl,grainMixer:a=Di.params.grainMixer,grainOverlay:o=Di.params.grainOverlay,fit:s=Di.params.fit,rotation:c=Di.params.rotation,scale:l=Di.params.scale,originX:u=Di.params.originX,originY:d=Di.params.originY,offsetX:f=Di.params.offsetX,offsetY:p=Di.params.offsetY,worldWidth:m=Di.params.worldWidth,worldHeight:h=Di.params.worldHeight,...g}){let _={u_colors:n.map(pi),u_colorsCount:n.length,u_distortion:r,u_swirl:i,u_grainMixer:a,u_grainOverlay:o,u_fit:Gr[s],u_rotation:c,u_scale:l,u_offsetX:f,u_offsetY:p,u_originX:u,u_originY:d,u_worldWidth:m,u_worldHeight:h};return(0,H.jsx)(Ti,{...g,speed:e,frame:t,fragmentShader:ei,uniforms:_})},Ei),ki={name:`Default`,params:{...Wr,speed:1,frame:0,scale:.6,colorBack:`#000000`,colorFront:`#00b2ff`,shape:`sphere`,type:`4x4`,size:2}};({...Wr}),{...Wr},{...U},{...U},{...U};var Ai=(0,V.memo)(function({speed:e=ki.params.speed,frame:t=ki.params.frame,colorBack:n=ki.params.colorBack,colorFront:r=ki.params.colorFront,shape:i=ki.params.shape,type:a=ki.params.type,pxSize:o,size:s=o===void 0?ki.params.size:o,fit:c=ki.params.fit,scale:l=ki.params.scale,rotation:u=ki.params.rotation,originX:d=ki.params.originX,originY:f=ki.params.originY,offsetX:p=ki.params.offsetX,offsetY:m=ki.params.offsetY,worldWidth:h=ki.params.worldWidth,worldHeight:g=ki.params.worldHeight,..._}){let v={u_colorBack:pi(n),u_colorFront:pi(r),u_shape:ni[i],u_type:ri[a],u_pxSize:s,u_fit:Gr[c],u_scale:l,u_rotation:u,u_offsetX:p,u_offsetY:m,u_originX:d,u_originY:f,u_worldWidth:h,u_worldHeight:g};return(0,H.jsx)(Ti,{..._,speed:e,frame:t,fragmentShader:ti,uniforms:v})}),W={name:`Default`,params:{...U,fit:`cover`,scale:.6,speed:0,frame:0,colorFront:`#9fadbc`,colorBack:`#ffffff`,contrast:.3,roughness:.4,fiber:.3,fiberSize:.2,crumples:.3,crumpleSize:.35,folds:.65,foldCount:5,fade:0,drops:.2,seed:5.8}};({...U}),{...U},{...U};var ji=(0,V.memo)(function({speed:e=W.params.speed,frame:t=W.params.frame,colorFront:n=W.params.colorFront,colorBack:r=W.params.colorBack,image:i=``,contrast:a=W.params.contrast,roughness:o=W.params.roughness,fiber:s=W.params.fiber,crumples:c=W.params.crumples,folds:l=W.params.folds,drops:u=W.params.drops,seed:d=W.params.seed,fiberScale:f,fiberSize:p=f===void 0?W.params.fiberSize:.2/f,crumplesScale:m,crumpleSize:h=m===void 0?W.params.crumpleSize:.2/m,blur:g,fade:_=g===void 0?W.params.fade:g,foldsNumber:v,foldCount:y=v===void 0?W.params.foldCount:v,fit:b=W.params.fit,scale:x=W.params.scale,rotation:S=W.params.rotation,originX:C=W.params.originX,originY:w=W.params.originY,offsetX:T=W.params.offsetX,offsetY:E=W.params.offsetY,worldWidth:D=W.params.worldWidth,worldHeight:O=W.params.worldHeight,...k}){let A=typeof window<`u`&&{u_noiseTexture:bi()},j={u_image:i,u_colorFront:pi(n),u_colorBack:pi(r),u_contrast:a,u_roughness:o,u_fiber:s,u_fiberSize:p,u_crumples:c,u_crumpleSize:h,u_foldCount:y,u_folds:l,u_fade:_,u_drops:u,u_seed:d,...A,u_fit:Gr[b],u_scale:x,u_rotation:S,u_offsetX:T,u_offsetY:E,u_originX:C,u_originY:w,u_worldWidth:D,u_worldHeight:O};return(0,H.jsx)(Ti,{...k,speed:e,frame:t,fragmentShader:ii,mipmaps:[`u_image`],uniforms:j})},Ei),G={name:`Default`,params:{...U,fit:`cover`,speed:0,frame:0,colorBack:`#00000000`,colorShadow:`#000000`,colorHighlight:`#ffffff`,shadows:.25,size:.5,angle:0,distortionShape:`prism`,highlights:.1,shape:`lines`,distortion:.5,shift:0,blur:0,edges:.25,stretch:0,margin:0,marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,grainMixer:0,grainOverlay:0}};({...U}),{...U},{...U};var Mi=(0,V.memo)(function({speed:e=G.params.speed,frame:t=G.params.frame,colorBack:n=G.params.colorBack,colorShadow:r=G.params.colorShadow,colorHighlight:i=G.params.colorHighlight,image:a=``,shadows:o=G.params.shadows,angle:s=G.params.angle,distortion:c=G.params.distortion,distortionShape:l=G.params.distortionShape,highlights:u=G.params.highlights,shape:d=G.params.shape,shift:f=G.params.shift,blur:p=G.params.blur,edges:m=G.params.edges,margin:h,marginLeft:g=h??G.params.marginLeft,marginRight:_=h??G.params.marginRight,marginTop:v=h??G.params.marginTop,marginBottom:y=h??G.params.marginBottom,grainMixer:b=G.params.grainMixer,grainOverlay:x=G.params.grainOverlay,stretch:S=G.params.stretch,count:C,size:w=C===void 0?G.params.size:(1/(C*1.6))**(1/6)/.7-.5,fit:T=G.params.fit,scale:E=G.params.scale,rotation:D=G.params.rotation,originX:O=G.params.originX,originY:k=G.params.originY,offsetX:A=G.params.offsetX,offsetY:j=G.params.offsetY,worldWidth:ee=G.params.worldWidth,worldHeight:M=G.params.worldHeight,...te}){let ne={u_image:a,u_colorBack:pi(n),u_colorShadow:pi(r),u_colorHighlight:pi(i),u_shadows:o,u_size:w,u_angle:s,u_distortion:c,u_shift:f,u_blur:p,u_edges:m,u_stretch:S,u_distortionShape:si[l],u_highlights:u,u_shape:oi[d],u_marginLeft:g,u_marginRight:_,u_marginTop:v,u_marginBottom:y,u_grainMixer:b,u_grainOverlay:x,u_fit:Gr[T],u_scale:E,u_rotation:D,u_offsetX:A,u_offsetY:j,u_originX:O,u_originY:k,u_worldWidth:ee,u_worldHeight:M};return(0,H.jsx)(Ti,{...te,speed:e,frame:t,fragmentShader:ai,mipmaps:[`u_image`],uniforms:ne})}),K={name:`Default`,params:{...U,fit:`cover`,speed:0,frame:0,colorFront:`#94ffaf`,colorBack:`#000c38`,colorHighlight:`#eaff94`,type:`8x8`,size:2,colorSteps:2,originalColors:!1,inverted:!1}};({...U}),{...U},{...U};var Ni=(0,V.memo)(function({speed:e=K.params.speed,frame:t=K.params.frame,colorFront:n=K.params.colorFront,colorBack:r=K.params.colorBack,colorHighlight:i=K.params.colorHighlight,image:a=``,type:o=K.params.type,colorSteps:s=K.params.colorSteps,originalColors:c=K.params.originalColors,inverted:l=K.params.inverted,pxSize:u,size:d=u===void 0?K.params.size:u,fit:f=K.params.fit,scale:p=K.params.scale,rotation:m=K.params.rotation,originX:h=K.params.originX,originY:g=K.params.originY,offsetX:_=K.params.offsetX,offsetY:v=K.params.offsetY,worldWidth:y=K.params.worldWidth,worldHeight:b=K.params.worldHeight,...x}){let S={u_image:a,u_colorFront:pi(n),u_colorBack:pi(r),u_colorHighlight:pi(i),u_type:ri[o],u_pxSize:d,u_colorSteps:s,u_originalColors:c,u_inverted:l,u_fit:Gr[f],u_rotation:m,u_scale:p,u_offsetX:_,u_offsetY:v,u_originX:h,u_originY:g,u_worldWidth:y,u_worldHeight:b};return(0,H.jsx)(Ti,{...x,speed:e,frame:t,fragmentShader:ci,uniforms:S})},Ei),q={name:`Default`,params:{...U,scale:1,fit:`contain`,speed:0,frame:0,spread:.6,bias:1,angle:0,perspective:.1,count:35,dispersion:1,dispersionShift:0,dispersionColor:.6,focusCenter:.8,focusEdges:1,swirl:.35,noise:0,noiseFrequency:.25,noiseOffset:0,lensBulge:0,lensCircle:0,grainMixer:0,grainOverlay:0,imageX:0,imageY:0}};({...U}),{...U},{...U};var Pi=(0,V.memo)(function({speed:e=q.params.speed,frame:t=q.params.frame,image:n=``,spread:r=q.params.spread,bias:i=q.params.bias,angle:a=q.params.angle,perspective:o=q.params.perspective,count:s=q.params.count,dispersion:c=q.params.dispersion,dispersionShift:l=q.params.dispersionShift,dispersionColor:u=q.params.dispersionColor,focusCenter:d=q.params.focusCenter,focusEdges:f=q.params.focusEdges,swirl:p=q.params.swirl,noise:m=q.params.noise,noiseFrequency:h=q.params.noiseFrequency,noiseOffset:g=q.params.noiseOffset,lensBulge:_=q.params.lensBulge,lensCircle:v=q.params.lensCircle,grainMixer:y=q.params.grainMixer,grainOverlay:b=q.params.grainOverlay,imageX:x=q.params.imageX,imageY:S=q.params.imageY,fit:C=q.params.fit,scale:w=q.params.scale,rotation:T=q.params.rotation,originX:E=q.params.originX,originY:D=q.params.originY,offsetX:O=q.params.offsetX,offsetY:k=q.params.offsetY,worldWidth:A=q.params.worldWidth,worldHeight:j=q.params.worldHeight,...ee}){let M={u_image:n,u_spread:r,u_bias:i,u_angle:a,u_perspective:o,u_count:s,u_dispersion:c,u_dispersionShift:l,u_dispersionColor:u,u_focusCenter:d,u_focusEdges:f,u_swirl:p,u_noise:m,u_noiseFrequency:h,u_noiseOffset:g,u_lensBulge:_,u_lensCircle:v,u_grainMixer:y,u_grainOverlay:b,u_imageX:x,u_imageY:S,u_fit:Gr[C],u_rotation:T,u_scale:w,u_offsetX:O,u_offsetY:k,u_originX:E,u_originY:D,u_worldWidth:A,u_worldHeight:j};return(0,H.jsx)(Ti,{...ee,speed:e,frame:t,fragmentShader:li,mipmaps:[`u_image`],uniforms:M})},Ei),J={name:`Default`,params:{...U,fit:`cover`,speed:0,frame:0,colorBack:`#f2f1e8`,colorFront:`#2b2b2b`,size:.5,radius:1.25,contrast:.4,originalColors:!1,inverted:!1,grainMixer:.2,grainOverlay:.2,grainSize:.5,grid:`hex`,type:`gooey`}};({...U}),{...U},{...U};var Fi=(0,V.memo)(function({speed:e=J.params.speed,frame:t=J.params.frame,colorFront:n=J.params.colorFront,colorBack:r=J.params.colorBack,image:i=``,size:a=J.params.size,radius:o=J.params.radius,contrast:s=J.params.contrast,originalColors:c=J.params.originalColors,inverted:l=J.params.inverted,grainMixer:u=J.params.grainMixer,grainOverlay:d=J.params.grainOverlay,grainSize:f=J.params.grainSize,grid:p=J.params.grid,type:m=J.params.type,fit:h=J.params.fit,scale:g=J.params.scale,rotation:_=J.params.rotation,originX:v=J.params.originX,originY:y=J.params.originY,offsetX:b=J.params.offsetX,offsetY:x=J.params.offsetY,worldWidth:S=J.params.worldWidth,worldHeight:C=J.params.worldHeight,...w}){let T={u_image:i,u_colorFront:pi(n),u_colorBack:pi(r),u_size:a,u_radius:o,u_contrast:s,u_originalColors:c,u_inverted:l,u_grainMixer:u,u_grainOverlay:d,u_grainSize:f,u_grid:fi[p],u_type:di[m],u_fit:Gr[h],u_rotation:_,u_scale:g,u_offsetX:b,u_offsetY:x,u_originX:v,u_originY:y,u_worldWidth:S,u_worldHeight:C};return(0,H.jsx)(Ti,{...w,speed:e,frame:t,fragmentShader:ui,uniforms:T})},Ei),Ii=4,Li=128,Ri=(e,t)=>{let n=255,r=0;for(let i of e)n=Math.min(n,i[t]),r=Math.max(r,i[t]);return r-n},zi=e=>{if(e.colors.length<2)return null;let t={r:Ri(e.colors,`r`),g:Ri(e.colors,`g`),b:Ri(e.colors,`b`)},n=Object.keys(t).reduce((e,n)=>t[n]>t[e]?n:e,`r`),r=[...e.colors].sort((e,t)=>e[n]-t[n]),i=e.weight/2,a=0,o=1;for(let e=0;e<r.length-1&&(a+=r[e].weight,o=e+1,!(a>=i));e+=1);let s=r.slice(0,o),c=r.slice(o);return[{colors:s,weight:s.reduce((e,t)=>e+t.weight,0)},{colors:c,weight:c.reduce((e,t)=>e+t.weight,0)}]},Bi=e=>{let t=e.colors.reduce((e,t)=>({r:e.r+t.r*t.weight,g:e.g+t.g*t.weight,b:e.b+t.b*t.weight}),{r:0,g:0,b:0});return{r:Math.round(t.r/e.weight),g:Math.round(t.g/e.weight),b:Math.round(t.b/e.weight),weight:e.weight}},Vi=({r:e,g:t,b:n})=>`#${e.toString(16).padStart(2,`0`)}${t.toString(16).padStart(2,`0`)}${n.toString(16).padStart(2,`0`)}`,Hi=(e,t=5)=>{if(t<=0)return[];let n=new Map;for(let t=0;t<e.length;t+=4){if(e[t+3]<Li)continue;let r=e[t],i=e[t+1],a=e[t+2],o=r>>Ii<<8|i>>Ii<<4|a>>Ii,s=n.get(o);s?(s.r+=r,s.g+=i,s.b+=a,s.weight+=1):n.set(o,{r,g:i,b:a,weight:1})}let r=[...n.values()].map(e=>({r:Math.round(e.r/e.weight),g:Math.round(e.g/e.weight),b:Math.round(e.b/e.weight),weight:e.weight}));if(r.length===0)return[];let i=[{colors:r,weight:r.reduce((e,t)=>e+t.weight,0)}];for(;i.length<Math.min(t,r.length);){let e=-1,t=-1;for(let n=0;n<i.length;n+=1){let r=i[n];if(r.colors.length<2)continue;let a=Math.max(Ri(r.colors,`r`),Ri(r.colors,`g`),Ri(r.colors,`b`))*Math.sqrt(r.weight);a>t&&(t=a,e=n)}if(e<0)break;let n=zi(i[e]);if(!n)break;i.splice(e,1,...n)}return i.map(Bi).sort((e,t)=>t.weight-e.weight).map(Vi)},Ui=(e,{silent:t=!1}={})=>new Promise(n=>{let r=new Image;r.crossOrigin=`Anonymous`,r.onload=()=>{let e=document.createElement(`canvas`),t=e.getContext(`2d`);if(!t)n(null);else{e.width=50,e.height=50;try{t.drawImage(r,0,0,50,50),n(t.getImageData(0,0,50,50).data)}catch{n(null)}}},r.onerror=e=>{t||console.warn(`Failed to load image for color extraction`,e),n(null)},r.src=e}),Wi=async(e,t=5)=>{let n=await Ui(e);return n?Hi(n,t):[]},Gi=921600,Ki=.12,qi=e=>Math.min(1,Math.max(0,e/255)),Ji=e=>Math.min(2,Math.max(0,e)),Yi=e=>Math.min(1,Math.max(0,e)),Xi=(e,t,n)=>e+(t-e)*n,Zi=(e,t,n,r,i)=>(qi(e)*.22+qi(t)*.18+qi(n)*.22+qi(r)*.28+qi(i)*.1)**.55,Qi=(e,t,n)=>Math.max(n*.84,Yi((e-t)*7)),$i=(e,t)=>Yi(e*.42+t*.85),ea=(e,t,n)=>n?$i(e,t):Yi(e),ta=(e,t,n,r)=>Ji(r?e*Ki:Xi(e,t,n)),na=(e,t,n)=>{let r=e[0]??t.secondaryColor;if(n===`cover-only`){let t=e[1]??r,n=e[2]??t;return{ditheringBack:n,ditheringFront:r,mesh:[r,t,n,e[3]??r,e[4]??t,e[5]??n]}}let i=e[1]??t.primaryColor,a=e[2]??r,o=e[3]??i;return{ditheringBack:t.backgroundColor,ditheringFront:r,mesh:[r,i,a,o,t.backgroundColor,t.accentColor]}},ra=V.memo(({theme:e,coverUrl:t,audioPower:n,audioBands:r,staticMode:i,paused:a,tuning:o})=>{let s=(0,V.useRef)(null),c=(0,V.useRef)(null),l=(0,V.useRef)(null),u=(0,V.useRef)(null),d=(0,V.useRef)(a),[f,p]=(0,V.useState)([]),m=o??yt,h=m.displayMode!==`mesh`,g=m.displayMode!==`dithering`;d.current=a,(0,V.useEffect)(()=>{let e=!0;return t?(Wi(t,6).then(t=>{e&&p(t)}),()=>{e=!1}):(p([]),()=>{e=!1})},[t]);let _=(0,V.useMemo)(()=>na(f,e,m.colorSource),[f,e,m.colorSource]);return(0,V.useEffect)(()=>{let e=s.current?.paperShaderMount,t=c.current?.paperShaderMount;if(i){e?.setSpeed(0),t?.setSpeed(0);return}let a=0,o=0,f=0,p=0,h=0,_=0,v=0,y=()=>{let e=d.current,t=e?0:qi(n.get()),i=e?0:qi(r.bass.get()),b=e?0:Zi(r.bass.get(),r.lowMid.get(),r.mid.get(),r.vocal.get(),r.treble.get()),x=e?0:qi(Math.max(r.mid.get(),r.vocal.get()));o=Xi(o,t,.12),f=Xi(f,i,.16),p=Xi(p,x,.13),v=m.enhancedBeatResponse?Qi(b,_,v):0,_=b;let S=ea(b,v,m.enhancedBeatResponse);h=Xi(h,S,S>h?.42:.14);let C=s.current?.paperShaderMount,w=c.current?.paperShaderMount;C?.setSpeed(ta(m.ditheringSpeed,m.ditheringAudioSpeed,h,e)),C?.setUniforms({u_pxSize:Math.max(.5,m.ditheringSize-f*m.ditheringSize*.34)}),w?.setSpeed(ta(m.meshSpeed,m.meshAudioSpeed,h,e)),w?.setUniforms({u_distortion:m.meshDistortion+o*.62,u_swirl:m.meshSwirl+p*.38}),l.current&&(l.current.style.opacity=g?`${Math.min(1,m.ditheringOpacity+f*.25)}`:`1`,l.current.style.transform=`scale(${1.015+f*.025})`),u.current&&(u.current.style.filter=`saturate(${1.04+p*.34}) brightness(${.94+o*.16})`,u.current.style.transform=`scale(${1.025+o*.018})`),a=requestAnimationFrame(y)};return a=requestAnimationFrame(y),()=>cancelAnimationFrame(a)},[r,n,g,i,m]),(0,H.jsxs)(`div`,{className:`absolute inset-0 z-0 overflow-hidden`,style:{backgroundColor:e.backgroundColor,pointerEvents:`none`},children:[g&&(0,H.jsx)(`div`,{ref:u,className:`absolute inset-0`,style:{transform:`scale(1.025)`,transformOrigin:`center`},children:(0,H.jsx)(Oi,{ref:c,width:`100%`,height:`100%`,colors:_.mesh,distortion:m.meshDistortion,swirl:m.meshSwirl,grainMixer:0,grainOverlay:.01,speed:i?0:ta(m.meshSpeed,m.meshAudioSpeed,0,a),minPixelRatio:1,maxPixelCount:Gi,style:{width:`100%`,height:`100%`}})}),h&&(0,H.jsx)(`div`,{ref:l,className:`absolute inset-0`,style:{mixBlendMode:g?`soft-light`:`normal`,opacity:g?m.ditheringOpacity:1,transform:`scale(1.015)`,transformOrigin:`center`},children:(0,H.jsx)(Ai,{ref:s,width:`100%`,height:`100%`,colorBack:_.ditheringBack,colorFront:_.ditheringFront,shape:`warp`,type:`4x4`,size:m.ditheringSize,speed:i?0:ta(m.ditheringSpeed,m.ditheringAudioSpeed,0,a),minPixelRatio:1,maxPixelCount:Gi,style:{width:`100%`,height:`100%`}})}),m.overlayEnabled&&m.overlayOpacity>0&&(0,H.jsx)(`div`,{className:`absolute inset-0`,style:{backgroundColor:e.backgroundColor,opacity:m.overlayOpacity}})]})}),ia=({label:e,value:t,min:n,max:r,step:i,format:a=e=>e.toFixed(1),rangeInputClass:o,theme:s,onChange:c,onPointerDown:l,onPointerUp:u,disabled:d=!1})=>(0,H.jsxs)(`label`,{className:`block space-y-2`,children:[(0,H.jsxs)(`span`,{className:`flex justify-between gap-3 text-sm`,style:{color:s.primaryColor},children:[(0,H.jsx)(`span`,{children:e}),(0,H.jsx)(`span`,{className:`font-mono opacity-70`,children:a(t)})]}),(0,H.jsx)(`input`,{type:`range`,min:n,max:r,step:i,value:t,disabled:d,onChange:e=>c(Number(e.target.value)),onPointerDown:l,onPointerUp:u,className:o})]}),aa=({t:e,isDaylight:t,theme:n,controlCardBg:r,rangeInputClass:i,tuning:a,onTuningChange:o,onSliderPointerDown:s,onSliderCommit:c})=>{let l=P(n.secondaryColor,t?.18:.16),u=P(n.accentColor,t?.1:.16),d=[[`dithering`,e(`options.latentDisplayDithering`)],[`mesh`,e(`options.latentDisplayMesh`)],[`both`,e(`options.latentDisplayBoth`)]],f=[[`cover-theme`,e(`options.latentColorSourceCoverTheme`)],[`cover-only`,e(`options.latentColorSourceCoverOnly`)]],p={rangeInputClass:i,theme:n,onPointerDown:s,onPointerUp:c};return(0,H.jsxs)(`div`,{className:`rounded-[24px] border p-4 space-y-5`,style:{backgroundColor:r,borderColor:l},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:n.primaryColor},children:e(`options.latentBackgroundSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-70`,style:{color:n.secondaryColor},children:e(`options.latentBackgroundSettingsDesc`)})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsx)(`div`,{className:`text-sm`,style:{color:n.primaryColor},children:e(`options.latentDisplayMode`)}),(0,H.jsx)(`div`,{className:`grid grid-cols-3 gap-2`,children:d.map(([e,t])=>(0,H.jsx)(`button`,{type:`button`,onClick:()=>o?.({displayMode:e}),className:`rounded-xl border px-2 py-2 text-xs`,style:{borderColor:a.displayMode===e?n.accentColor:l,backgroundColor:a.displayMode===e?u:`transparent`,color:n.primaryColor},children:t},e))})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsx)(`div`,{className:`text-sm`,style:{color:n.primaryColor},children:e(`options.latentColorSource`)}),(0,H.jsx)(`div`,{className:`grid grid-cols-2 gap-2`,children:f.map(([e,t])=>(0,H.jsx)(`button`,{type:`button`,onClick:()=>o?.({colorSource:e}),className:`rounded-xl border px-2 py-2 text-xs`,style:{borderColor:a.colorSource===e?n.accentColor:l,backgroundColor:a.colorSource===e?u:`transparent`,color:n.primaryColor},children:t},e))})]}),(0,H.jsx)(vr,{label:e(`options.latentDynamicOnlyInPlayer`),description:e(`options.latentDynamicOnlyInPlayerDesc`),checked:a.dynamicOnlyInPlayer,onChange:e=>o?.({dynamicOnlyInPlayer:e}),theme:n}),(0,H.jsx)(vr,{label:e(`options.latentEnhancedBeatResponse`),description:e(`options.latentEnhancedBeatResponseDesc`),checked:a.enhancedBeatResponse,onChange:e=>o?.({enhancedBeatResponse:e}),theme:n}),(0,H.jsxs)(`div`,{className:`space-y-3 rounded-2xl border p-3`,style:{borderColor:l},children:[(0,H.jsx)(vr,{label:e(`options.nomandBackgroundOverlay`),description:e(`options.nomandBackgroundOverlayDesc`),checked:a.overlayEnabled,onChange:e=>o?.({overlayEnabled:e}),theme:n}),(0,H.jsx)(`div`,{className:a.overlayEnabled?``:`opacity-45`,children:(0,H.jsx)(ia,{...p,label:e(`options.nomandBackgroundOverlayOpacity`),value:a.overlayOpacity,disabled:!a.overlayEnabled,min:0,max:1,step:.05,format:e=>`${Math.round(e*100)}%`,onChange:e=>o?.({overlayOpacity:e})})})]}),(0,H.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:l},children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.latentDitheringGroup`)}),(0,H.jsx)(ia,{...p,label:e(`options.latentBaseSpeed`),value:a.ditheringSpeed,min:0,max:2,step:.1,onChange:e=>o?.({ditheringSpeed:e})}),(0,H.jsx)(ia,{...p,label:e(`options.latentAudioSpeed`),value:a.ditheringAudioSpeed,min:0,max:2,step:.1,onChange:e=>o?.({ditheringAudioSpeed:e})}),(0,H.jsx)(ia,{...p,label:e(`options.latentDitheringSize`),value:a.ditheringSize,min:.5,max:8,step:.25,onChange:e=>o?.({ditheringSize:e})}),(0,H.jsx)(ia,{...p,label:e(`options.latentDitheringOpacity`),value:a.ditheringOpacity,min:0,max:1,step:.05,format:e=>`${Math.round(e*100)}%`,onChange:e=>o?.({ditheringOpacity:e})})]}),(0,H.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:l},children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.latentMeshGroup`)}),(0,H.jsx)(ia,{...p,label:e(`options.latentBaseSpeed`),value:a.meshSpeed,min:0,max:2,step:.1,onChange:e=>o?.({meshSpeed:e})}),(0,H.jsx)(ia,{...p,label:e(`options.latentAudioSpeed`),value:a.meshAudioSpeed,min:0,max:2,step:.1,onChange:e=>o?.({meshAudioSpeed:e})}),(0,H.jsx)(ia,{...p,label:e(`options.latentMeshDistortion`),value:a.meshDistortion,min:0,max:2,step:.05,onChange:e=>o?.({meshDistortion:e})}),(0,H.jsx)(ia,{...p,label:e(`options.latentMeshSwirl`),value:a.meshSwirl,min:0,max:1,step:.05,onChange:e=>o?.({meshSwirl:e})})]})]})},oa=[`dithering`,`mesh`,`both`],sa={dithering:`options.latentDisplayDithering`,mesh:`options.latentDisplayMesh`,both:`options.latentDisplayBoth`},ca=mr({mode:`latent`,order:35,labelKey:`options.visualizerBackgroundModeLatent`,labelFallback:`Latent`,render:({config:e,theme:t,coverUrl:n,audioPower:r,audioBands:i,staticMode:a,paused:o})=>(0,H.jsx)(ra,{theme:t,coverUrl:n,audioPower:r,audioBands:i,staticMode:a,paused:o,tuning:e?.latent?.tuning}),renderSettingsPanel:({config:e,actions:t,...n})=>(0,H.jsx)(aa,{...n,tuning:e?.latent?.tuning??yt,onTuningChange:t?.latent?.onTuningChange}),renderQuickControls:({config:e,actions:t,t:n,isDaylight:r,theme:i})=>{let a=e?.latent?.tuning??yt,o=n(sa[a.displayMode]);return(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(hr,{isDaylight:r,label:o,title:`${n(`options.latentDisplayMode`)}: ${o}`,onClick:()=>{let e=oa.indexOf(a.displayMode);t?.latent?.onTuningChange?.({displayMode:oa[(e+1)%oa.length]})}}),(0,H.jsx)(gr,{active:a.overlayEnabled,theme:i,label:n(`options.nomandBackgroundOverlay`),onToggle:()=>t?.latent?.onTuningChange?.({overlayEnabled:!a.overlayEnabled}),children:(0,H.jsx)(v,{size:14})})]})},resetSettings:e=>e?.latent?.onResetTuning?.()});function la(){return(la=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e}).apply(this,arguments)}function ua(e,t){if(e==null)return{};var n,r,i={},a=Object.keys(e);for(r=0;r<a.length;r++)t.indexOf(n=a[r])>=0||(i[n]=e[n]);return i}function da(e){var t=(0,V.useRef)(e),n=(0,V.useRef)(function(e){t.current&&t.current(e)});return t.current=e,n.current}var fa=function(e,t,n){return t===void 0&&(t=0),n===void 0&&(n=1),e>n?n:e<t?t:e},pa=function(e){return`touches`in e},ma=function(e){return e&&e.ownerDocument.defaultView||self},ha=function(e,t,n){var r=e.getBoundingClientRect(),i=pa(t)?function(e,t){for(var n=0;n<e.length;n++)if(e[n].identifier===t)return e[n];return e[0]}(t.touches,n):t;return{left:fa((i.pageX-(r.left+ma(e).pageXOffset))/r.width),top:fa((i.pageY-(r.top+ma(e).pageYOffset))/r.height)}},ga=function(e){!pa(e)&&e.preventDefault()},_a=V.memo(function(e){var t=e.onMove,n=e.onKey,r=e.onEnd,i=ua(e,[`onMove`,`onKey`,`onEnd`]),a=(0,V.useRef)(null),o=da(t),s=da(n),c=da(r),l=(0,V.useRef)(null),u=(0,V.useRef)(!1),d=(0,V.useMemo)(function(){var e=function(e){ga(e),(pa(e)?e.touches.length>0:e.buttons>0)&&a.current?o(ha(a.current,e,l.current)):(n(!1),c())},t=function(){n(!1),c()};function n(n){var r=u.current,i=ma(a.current),o=n?i.addEventListener:i.removeEventListener;o(r?`touchmove`:`mousemove`,e),o(r?`touchend`:`mouseup`,t)}return[function(e){var t=e.nativeEvent,r=a.current;if(r&&(ga(t),!function(e,t){return t&&!pa(e)}(t,u.current)&&r)){if(pa(t)){u.current=!0;var i=t.changedTouches||[];i.length&&(l.current=i[0].identifier)}r.focus(),o(ha(r,t,l.current)),n(!0)}},function(e){var t=e.which||e.keyCode;t<37||t>40||(e.preventDefault(),s({left:t===39?.05:t===37?-.05:0,top:t===40?.05:t===38?-.05:0}))},function(e){var t=e.which||e.keyCode;t>=37&&t<=40&&c()},n]},[s,o,c]),f=d[0],p=d[1],m=d[2],h=d[3];return(0,V.useEffect)(function(){return h},[h]),V.createElement(`div`,la({},i,{onTouchStart:f,onMouseDown:f,className:`react-colorful__interactive`,ref:a,onKeyDown:p,onKeyUp:m,tabIndex:0,role:`slider`}))}),va=function(e){return e.filter(Boolean).join(` `)},ya=function(e){var t=e.color,n=e.left,r=e.top,i=r===void 0?.5:r,a=va([`react-colorful__pointer`,e.className]);return V.createElement(`div`,{className:a,style:{top:100*i+`%`,left:100*n+`%`}},V.createElement(`div`,{className:`react-colorful__pointer-fill`,style:{backgroundColor:t}}))},ba=function(e,t,n){return t===void 0&&(t=0),n===void 0&&(n=10**t),Math.round(n*e)/n},xa=function(e){return ka(Sa(e))},Sa=function(e){return e[0]===`#`&&(e=e.substring(1)),e.length<6?{r:parseInt(e[0]+e[0],16),g:parseInt(e[1]+e[1],16),b:parseInt(e[2]+e[2],16),a:e.length===4?ba(parseInt(e[3]+e[3],16)/255,2):1}:{r:parseInt(e.substring(0,2),16),g:parseInt(e.substring(2,4),16),b:parseInt(e.substring(4,6),16),a:e.length===8?ba(parseInt(e.substring(6,8),16)/255,2):1}},Ca=function(e){return Oa(Ea(e))},wa=function(e){var t=e.s,n=e.v,r=e.a,i=(200-t)*n/100;return{h:ba(e.h),s:ba(i>0&&i<200?t*n/100/(i<=100?i:200-i)*100:0),l:ba(i/2),a:ba(r,2)}},Ta=function(e){var t=wa(e);return`hsl(`+t.h+`, `+t.s+`%, `+t.l+`%)`},Ea=function(e){var t=e.h,n=e.s,r=e.v,i=e.a;t=t/360*6,n/=100,r/=100;var a=Math.floor(t),o=r*(1-n),s=r*(1-(t-a)*n),c=r*(1-(1-t+a)*n),l=a%6;return{r:ba(255*[r,s,o,o,c,r][l]),g:ba(255*[c,r,r,s,o,o][l]),b:ba(255*[o,o,c,r,r,s][l]),a:ba(i,2)}},Da=function(e){var t=e.toString(16);return t.length<2?`0`+t:t},Oa=function(e){var t=e.r,n=e.g,r=e.b,i=e.a,a=i<1?Da(ba(255*i)):``;return`#`+Da(t)+Da(n)+Da(r)+a},ka=function(e){var t=e.r,n=e.g,r=e.b,i=e.a,a=Math.max(t,n,r),o=a-Math.min(t,n,r),s=o?a===t?(n-r)/o:a===n?2+(r-t)/o:4+(t-n)/o:0;return{h:60*(s<0?s+6:s),s:a?o/a*100:0,v:a/255*100,a:i}},Aa=V.memo(function(e){var t=e.hue,n=e.onChange,r=e.onChangeEnd,i=va([`react-colorful__hue`,e.className]);return V.createElement(`div`,{className:i},V.createElement(_a,{onMove:function(e){n({h:360*e.left})},onKey:function(e){n({h:fa(t+360*e.left,0,360)})},onEnd:r,"aria-label":`Hue`,"aria-valuenow":ba(t),"aria-valuemax":`360`,"aria-valuemin":`0`},V.createElement(ya,{className:`react-colorful__hue-pointer`,left:t/360,color:Ta({h:t,s:100,v:100,a:1})})))}),ja=V.memo(function(e){var t=e.hsva,n=e.onChange,r=e.onChangeEnd,i={backgroundColor:Ta({h:t.h,s:100,v:100,a:1})};return V.createElement(`div`,{className:`react-colorful__saturation`,style:i},V.createElement(_a,{onMove:function(e){n({s:100*e.left,v:100-100*e.top})},onKey:function(e){n({s:fa(t.s+100*e.left,0,100),v:fa(t.v-100*e.top,0,100)})},onEnd:r,"aria-label":`Color`,"aria-valuetext":`Saturation `+ba(t.s)+`%, Brightness `+ba(t.v)+`%`},V.createElement(ya,{className:`react-colorful__saturation-pointer`,top:1-t.v/100,left:t.s/100,color:Ta(t)})))}),Ma=function(e,t){if(e===t)return!0;for(var n in e)if(e[n]!==t[n])return!1;return!0},Na=function(e,t){return e.toLowerCase()===t.toLowerCase()||Ma(Sa(e),Sa(t))};function Pa(e,t,n,r){var i=da(n),a=da(r),o=(0,V.useState)(function(){return e.toHsva(t)}),s=o[0],c=o[1],l=(0,V.useRef)({color:t,hsva:s}),u=(0,V.useRef)(!1);return(0,V.useEffect)(function(){if(!e.equal(t,l.current.color)){var n=e.toHsva(t);l.current={hsva:n,color:t},c(n),u.current=!1}},[t,e]),(0,V.useEffect)(function(){var t;Ma(s,l.current.hsva)||e.equal(t=e.fromHsva(s),l.current.color)||(l.current={hsva:s,color:t},i(t),u.current=!0)},[s,e,i]),[s,(0,V.useCallback)(function(e){c(function(t){return Object.assign({},t,e)})},[]),(0,V.useCallback)(function(){u.current&&(u.current=!1,a(l.current.color))},[a])]}var Fa=typeof window<`u`?V.useLayoutEffect:V.useEffect,Ia=function(){return typeof __webpack_nonce__<`u`?__webpack_nonce__:void 0},La=new WeakMap,Ra=function(e){Fa(function(){var t=e.current;if(typeof document<`u`&&t){var n=t.getRootNode?t.getRootNode():t.ownerDocument,r=n&&(`head`in n||`host`in n)?n:t.ownerDocument;if(!La.has(r)){var i=`head`in r?r.head:r,a=(i.ownerDocument||document).createElement(`style`);a.innerHTML=`.react-colorful{position:relative;display:flex;flex-direction:column;width:200px;height:200px;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;cursor:default}.react-colorful__saturation{position:relative;flex-grow:1;border-color:transparent;border-bottom:12px solid #000;border-radius:8px 8px 0 0;background-image:linear-gradient(0deg,#000,transparent),linear-gradient(90deg,#fff,hsla(0,0%,100%,0))}.react-colorful__alpha-gradient,.react-colorful__pointer-fill{content:"";position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;border-radius:inherit}.react-colorful__alpha-gradient,.react-colorful__saturation{box-shadow:inset 0 0 0 1px rgba(0,0,0,.05)}.react-colorful__alpha,.react-colorful__hue{position:relative;height:24px}.react-colorful__hue{background:linear-gradient(90deg,red 0,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,red)}.react-colorful__last-control{border-radius:0 0 8px 8px}.react-colorful__interactive{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;outline:none;touch-action:none}.react-colorful__pointer{position:absolute;z-index:1;box-sizing:border-box;width:28px;height:28px;transform:translate(-50%,-50%);background-color:#fff;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.2)}.react-colorful__interactive:focus .react-colorful__pointer{transform:translate(-50%,-50%) scale(1.1)}.react-colorful__alpha,.react-colorful__alpha-pointer{background-color:#fff;background-image:url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill-opacity=".05"><path d="M8 0h8v8H8zM0 8h8v8H0z"/></svg>')}.react-colorful__saturation-pointer{z-index:3}.react-colorful__hue-pointer{z-index:2}`;var o=Ia();o&&a.setAttribute(`nonce`,o),La.set(r,a),i.appendChild(a)}}},[])},za=function(e){var t=e.className,n=e.colorModel,r=e.color,i=r===void 0?n.defaultColor:r,a=e.onChange,o=e.onChangeEnd,s=ua(e,[`className`,`colorModel`,`color`,`onChange`,`onChangeEnd`]),c=(0,V.useRef)(null);Ra(c);var l=Pa(n,i,a,o),u=l[0],d=l[1],f=l[2],p=va([`react-colorful`,t]);return V.createElement(`div`,la({},s,{ref:c,className:p}),V.createElement(ja,{hsva:u,onChange:d,onChangeEnd:f}),V.createElement(Aa,{hue:u.h,onChange:d,onChangeEnd:f,className:`react-colorful__last-control`}))},Ba={defaultColor:`000`,toHsva:xa,fromHsva:function(e){return Ca({h:e.h,s:e.s,v:e.v,a:1})},equal:Na},Va=function(e){return V.createElement(za,la({},e,{colorModel:Ba}))},Ha=({children:e,theme:t})=>(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.24em] opacity-45`,style:{color:t.secondaryColor},children:e}),Ua=({label:e,value:t,options:n,onChange:r,isDaylight:i,theme:a})=>(0,H.jsxs)(`div`,{className:`space-y-2.5`,children:[(0,H.jsx)(Ha,{theme:a,children:e}),(0,H.jsx)(`div`,{className:`flex flex-wrap gap-2`,children:n.map(e=>{let n=e.value===t;return(0,H.jsx)(`button`,{type:`button`,onClick:()=>{e.disabled||r(e.value)},disabled:e.disabled,className:`rounded-full border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45`,style:{color:e.disabled?P(a.secondaryColor,.72):a.primaryColor,borderColor:n?a.accentColor:P(a.secondaryColor,i?.18:.14),backgroundColor:n?P(a.accentColor,i?.1:.16):P(a.backgroundColor,i?.24:.34),boxShadow:n?`inset 0 0 0 1px ${a.accentColor}`:`none`},children:e.label},String(e.value))})})]}),Wa=({label:e,valueLabel:t,value:n,min:r,max:i,step:a,onChange:o,rangeInputClass:s,onSliderPointerDown:c,onSliderCommit:l})=>(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3 text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e}),(0,H.jsx)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:t})]}),(0,H.jsx)(`input`,{type:`range`,min:r,max:i,step:a,value:n,onChange:e=>o(parseFloat(e.target.value)),onPointerDown:c,onPointerUp:l,onPointerCancel:l,onBlur:l,className:s})]}),Ga=(e,t,n,r)=>Number.isFinite(e)?Math.min(n,Math.max(t,e)):r,Ka=e=>{let t=e.trim().replace(/^#/,``);return/^[0-9a-fA-F]{6}$/.test(t)?`#${t.toLowerCase()}`:null},qa=({t:e,isDaylight:t,theme:r,controlCardBg:i,rangeInputClass:a,tuning:o=I,onTuningChange:s,monetBackgroundImage:c,onUploadMonetBackgroundImage:l,onClearMonetBackgroundImage:u,isLoadingMonetBackgroundImage:d=!1,onSliderPointerDown:f,onSliderCommit:p})=>{let m=(0,V.useRef)(null),[h,g]=(0,V.useState)(null),_={backgroundSource:o.backgroundSource??I.backgroundSource,backgroundLayout:o.backgroundLayout??I.backgroundLayout,backgroundBlurPx:Ga(o.backgroundBlurPx??I.backgroundBlurPx,0,60,I.backgroundBlurPx),backgroundOverlayOpacity:Ga(o.backgroundOverlayOpacity??I.backgroundOverlayOpacity,0,1,I.backgroundOverlayOpacity),backgroundGrayscale:Ga(o.backgroundGrayscale??I.backgroundGrayscale,0,1,I.backgroundGrayscale),backgroundSaturation:Ga(o.backgroundSaturation??I.backgroundSaturation,0,2,I.backgroundSaturation),backgroundWash:Ga(o.backgroundWash??I.backgroundWash,0,1,I.backgroundWash),backgroundHalfPaneOffsetX:Ga(o.backgroundHalfPaneOffsetX??I.backgroundHalfPaneOffsetX,-40,40,I.backgroundHalfPaneOffsetX),backgroundWashColorMode:o.backgroundWashColorMode??I.backgroundWashColorMode,backgroundWashCustomColor:Ka(o.backgroundWashCustomColor)??I.backgroundWashCustomColor,backgroundDriftEnabled:o.backgroundDriftEnabled??I.backgroundDriftEnabled,backgroundDriftStrength:Ga(o.backgroundDriftStrength??I.backgroundDriftStrength,0,1,I.backgroundDriftStrength),backgroundStreaksEnabled:o.backgroundStreaksEnabled??I.backgroundStreaksEnabled},v=(0,V.useMemo)(()=>[{value:`cover-derived`,label:e(`options.monetBackgroundSourceCover`)},{value:`uploaded-global`,label:e(`options.monetBackgroundSourceUploaded`),disabled:!c&&!d}],[d,c,e]),y=(0,V.useMemo)(()=>[{value:`half-pane-gradient`,label:e(`options.monetLayoutHalfPane`)},{value:`full-overlay`,label:e(`options.monetLayoutFullOverlay`)}],[e]),b=(0,V.useMemo)(()=>[{value:`theme`,label:e(`options.monetBackgroundWashTheme`)},{value:`custom`,label:e(`options.monetBackgroundWashCustom`)}],[e]),x=async t=>{let n=Array.from(t.target.files??[]);if(t.target.value=``,g(null),!n.length||!l)return;let r=await l(n);r.ok?(s?.({backgroundSource:`uploaded-global`}),g(n[0].name)):g(r.error||e(`options.monetUploadBackground`))};return(0,H.jsxs)(`div`,{className:`rounded-[24px] border p-4 space-y-4`,style:{backgroundColor:i,borderColor:P(r.secondaryColor,.16)},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:r.primaryColor},children:e(`options.monetBackgroundSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-70`,style:{color:r.secondaryColor},children:e(`options.monetBackgroundSettingsDesc`)})]}),(0,H.jsxs)(`div`,{className:`space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5`,children:[(0,H.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wider opacity-65`,style:{color:r.accentColor},children:e(`options.monetGroupBackgroundSource`)}),(0,H.jsx)(Ua,{label:e(`options.monetBackgroundSource`),value:_.backgroundSource,options:v,onChange:e=>s?.({backgroundSource:e}),isDaylight:t,theme:r}),(0,H.jsxs)(`div`,{className:`space-y-2.5`,children:[(0,H.jsx)(Ha,{theme:r,children:e(`options.monetUploadBackground`)}),(0,H.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2`,children:[(0,H.jsxs)(`button`,{type:`button`,onClick:()=>m.current?.click(),disabled:d||!l,className:`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45`,style:{color:r.primaryColor,borderColor:P(r.secondaryColor,t?.18:.14),backgroundColor:P(r.backgroundColor,t?.24:.34)},children:[(0,H.jsx)(S,{size:15}),(0,H.jsx)(`span`,{children:e(`options.monetUploadBackground`)})]}),(0,H.jsxs)(`button`,{type:`button`,onClick:()=>void u?.(),disabled:!c||!u,className:`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45`,style:{color:r.primaryColor,borderColor:P(r.secondaryColor,t?.18:.14),backgroundColor:P(r.backgroundColor,t?.24:.34)},children:[(0,H.jsx)(n,{size:15}),(0,H.jsx)(`span`,{children:e(`options.monetClearBackground`)})]})]}),(0,H.jsx)(`div`,{className:`text-xs opacity-60`,style:{color:`var(--text-secondary)`},children:h||c?.name||`-`}),(0,H.jsx)(`input`,{ref:m,type:`file`,accept:`.png,.jpg,.jpeg,.gif,.webp,.svg,image/*`,className:`hidden`,onChange:e=>void x(e)})]})]}),(0,H.jsxs)(`div`,{className:`space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5`,children:[(0,H.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wider opacity-65`,style:{color:r.accentColor},children:e(`options.monetGroupLayoutPosition`)}),(0,H.jsx)(Ua,{label:e(`options.monetBackgroundLayout`),value:_.backgroundLayout,options:y,onChange:e=>s?.({backgroundLayout:e}),isDaylight:t,theme:r}),_.backgroundLayout===`half-pane-gradient`&&(0,H.jsx)(Wa,{label:e(`options.monetHalfPaneOffsetX`),valueLabel:`${Math.round(_.backgroundHalfPaneOffsetX)}%`,min:-40,max:40,step:2,value:_.backgroundHalfPaneOffsetX,onChange:e=>s?.({backgroundHalfPaneOffsetX:e}),rangeInputClass:a,onSliderPointerDown:f,onSliderCommit:p}),(0,H.jsx)(vr,{label:e(`options.monetBackgroundDriftEnabled`),description:e(`options.monetBackgroundDriftEnabledDesc`),checked:_.backgroundDriftEnabled,onChange:e=>s?.({backgroundDriftEnabled:e}),theme:r}),_.backgroundDriftEnabled&&(0,H.jsx)(Wa,{label:e(`options.monetBackgroundDriftStrength`),valueLabel:`${Math.round(_.backgroundDriftStrength*100)}%`,min:0,max:1,step:.05,value:_.backgroundDriftStrength,onChange:e=>s?.({backgroundDriftStrength:e}),rangeInputClass:a,onSliderPointerDown:f,onSliderCommit:p})]}),(0,H.jsxs)(`div`,{className:`space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5`,children:[(0,H.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wider opacity-65`,style:{color:r.accentColor},children:e(`options.monetGroupFiltersPostProcessing`)}),(0,H.jsx)(Wa,{label:e(`options.monetBackgroundBlur`),valueLabel:`${Math.round(_.backgroundBlurPx)}px`,min:0,max:60,step:2,value:_.backgroundBlurPx,onChange:e=>s?.({backgroundBlurPx:e}),rangeInputClass:a,onSliderPointerDown:f,onSliderCommit:p}),(0,H.jsx)(Wa,{label:e(`options.monetBackgroundSaturation`),valueLabel:`${Math.round(_.backgroundSaturation*100)}%`,min:0,max:2,step:.05,value:_.backgroundSaturation,onChange:e=>s?.({backgroundSaturation:e}),rangeInputClass:a,onSliderPointerDown:f,onSliderCommit:p}),(0,H.jsx)(Wa,{label:e(`options.monetBackgroundGrayscale`),valueLabel:`${Math.round(_.backgroundGrayscale*100)}%`,min:0,max:1,step:.02,value:_.backgroundGrayscale,onChange:e=>s?.({backgroundGrayscale:e}),rangeInputClass:a,onSliderPointerDown:f,onSliderCommit:p})]}),(0,H.jsxs)(`div`,{className:`space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5`,children:[(0,H.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wider opacity-65`,style:{color:r.accentColor},children:e(`options.monetGroupColorTintWash`)}),(0,H.jsx)(Wa,{label:e(`options.monetBackgroundOverlayOpacity`),valueLabel:`${Math.round(_.backgroundOverlayOpacity*100)}%`,min:0,max:1,step:.02,value:_.backgroundOverlayOpacity,onChange:e=>s?.({backgroundOverlayOpacity:e}),rangeInputClass:a,onSliderPointerDown:f,onSliderCommit:p}),(0,H.jsx)(Wa,{label:e(`options.monetBackgroundWash`),valueLabel:`${Math.round(_.backgroundWash*100)}%`,min:0,max:1,step:.02,value:_.backgroundWash,onChange:e=>s?.({backgroundWash:e}),rangeInputClass:a,onSliderPointerDown:f,onSliderCommit:p}),(0,H.jsx)(vr,{label:e(`options.monetBackgroundStreaksEnabled`),description:e(`options.monetBackgroundStreaksEnabledDesc`),checked:_.backgroundStreaksEnabled,onChange:e=>s?.({backgroundStreaksEnabled:e}),theme:r}),(0,H.jsx)(Ua,{label:e(`options.monetBackgroundWashColorMode`),value:_.backgroundWashColorMode,options:b,onChange:e=>s?.({backgroundWashColorMode:e}),isDaylight:t,theme:r}),_.backgroundWashColorMode===`custom`&&(0,H.jsxs)(`div`,{className:`space-y-3 rounded-[20px] border p-3`,style:{borderColor:P(r.secondaryColor,.14),backgroundColor:P(r.backgroundColor,.2)},children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3`,children:[(0,H.jsx)(`div`,{className:`text-sm`,style:{color:r.primaryColor},children:e(`options.monetBackgroundWashCustomColor`)}),(0,H.jsx)(`div`,{className:`rounded-full px-3 py-1 text-xs font-mono`,style:{color:r.backgroundColor,backgroundColor:_.backgroundWashCustomColor},children:_.backgroundWashCustomColor.toUpperCase()})]}),(0,H.jsx)(Va,{color:_.backgroundWashCustomColor,onChange:e=>s?.({backgroundWashCustomColor:e}),style:{width:`100%`,height:180}})]})]})]})},Ja=1920,Ya=1080,Xa=new Map,Za={r:10,g:10,b:12},Qa={r:245,g:245,b:245},$a=(e,t,n)=>Math.min(n,Math.max(t,e)),eo=(e,t,n)=>e+(t-e)*n,to=(e,t,n)=>.2126*e+.7152*t+.0722*n,no=(e,t)=>to(e.r,e.g,e.b)<=to(t.r,t.g,t.b)?{shadow:e,highlight:t}:{shadow:t,highlight:e},ro=({coverUrl:e,monetBackgroundImage:t,tuning:n})=>n.backgroundSource===`uploaded-global`?t?.url??e??null:e??t?.url??null,io=async e=>{let t=new Image;(e.startsWith(`http://`)||e.startsWith(`https://`))&&(t.crossOrigin=`anonymous`),t.decoding=`async`;let n=new Promise((n,r)=>{t.onload=()=>n(),t.onerror=()=>r(Error(`Failed to load image: ${e}`))});t.src=e;try{await t.decode()}catch{await n}return t},ao=(e,t,n)=>{let r=e[t];return typeof r==`number`&&Number.isFinite(r)?r:n},oo=(e,t,n,r)=>{let i=ao(t,`width`,n),a=ao(t,`height`,r);if(!i||!a)return;let o=Math.max(n/i,r/a),s=i*o,c=a*o,l=(n-s)/2,u=(r-c)/2;e.drawImage(t,l,u,s,c)},so=(e,t)=>{let n=N(e);return n?{r:$a(n.r,0,255),g:$a(n.g,0,255),b:$a(n.b,0,255)}:t},co=(e,t,n,r)=>{let{shadow:i,highlight:a}=no(t,r);if(e<=.55){let t=e/.55;return{r:eo(i.r,n.r,t),g:eo(i.g,n.g,t),b:eo(i.b,n.b,t)}}let o=(e-.55)/.45;return{r:eo(n.r,a.r,o),g:eo(n.g,a.g,o),b:eo(n.b,a.b,o)}},lo=(e,t,n,r,i)=>{let a=$a(i.backgroundGrayscale,0,1),o=$a(i.backgroundSaturation,0,2),s=$a(i.backgroundWash,0,1);if(a<=0&&Math.abs(o-1)<.001&&s<=0)return;let c=e.getImageData(0,0,t,n),l=c.data,u=so(r.backgroundColor,Za),d=so(r.accentColor,u),f=so(r.primaryColor,Qa),p=so(i.backgroundWashCustomColor,d),m=i.backgroundWashColorMode===`custom`?p:d;for(let e=0;e<l.length;e+=4){let t=l[e],n=l[e+1],r=l[e+2];if(l[e+3]===0)continue;let i=to(t,n,r);if(a>0&&(t=eo(t,i,a),n=eo(n,i,a),r=eo(r,i,a)),Math.abs(o-1)>=.001){let e=to(t,n,r);t=e+(t-e)*o,n=e+(n-e)*o,r=e+(r-e)*o}if(s>0){let e=co($a(i/255,0,1),u,m,f);t=eo(t,e.r,s),n=eo(n,e.g,s),r=eo(r,e.b,s)}l[e]=Math.round($a(t,0,255)),l[e+1]=Math.round($a(n,0,255)),l[e+2]=Math.round($a(r,0,255))}e.putImageData(c,0,0)},uo=(e,t,n,r,i)=>{let a=$a(i.backgroundOverlayOpacity,0,1),o=e.createLinearGradient(0,0,t,n);o.addColorStop(0,P(r.accentColor,.08+a*.62)),o.addColorStop(.44,P(r.backgroundColor,.16+a*.58)),o.addColorStop(1,P(r.primaryColor,.06+a*.36)),e.fillStyle=o,e.fillRect(0,0,t,n);let s=e.createRadialGradient(t*.18,n*.34,0,t*.18,n*.34,t*.55);s.addColorStop(0,P(r.accentColor,a*.42)),s.addColorStop(1,P(r.backgroundColor,0)),e.fillStyle=s,e.fillRect(0,0,t,n);let c=e.createLinearGradient(t*.45,0,t,0);if(c.addColorStop(0,P(r.backgroundColor,0)),c.addColorStop(1,P(r.backgroundColor,.18+a*.38)),e.fillStyle=c,e.fillRect(0,0,t,n),i.backgroundStreaksEnabled!==!1){e.fillStyle=P(r.backgroundColor,.1+a*.08);for(let r=0;r<18;r+=1){let i=r*127%t,a=r*211%n-40;e.fillRect(i,a,1,n*.28)}}},fo=({coverUrl:e,monetBackgroundImage:t,theme:n,tuning:r})=>JSON.stringify({sourceUrl:ro({coverUrl:e,monetBackgroundImage:t,tuning:r}),uploadedId:r.backgroundSource===`uploaded-global`?t?.id??null:null,theme:{backgroundColor:n.backgroundColor,primaryColor:n.primaryColor,accentColor:n.accentColor},tuning:{backgroundSource:r.backgroundSource,backgroundBlurPx:r.backgroundBlurPx,backgroundOverlayOpacity:r.backgroundOverlayOpacity,backgroundGrayscale:r.backgroundGrayscale,backgroundSaturation:r.backgroundSaturation,backgroundWash:r.backgroundWash,backgroundWashColorMode:r.backgroundWashColorMode,backgroundWashCustomColor:r.backgroundWashCustomColor,backgroundStreaksEnabled:r.backgroundStreaksEnabled}}),po=null,mo=()=>{if(po!==null)return po;if(typeof document>`u`)return!1;try{let e=document.createElement(`canvas`);e.width=2,e.height=2;let t=e.getContext(`2d`);return!t||typeof t.filter!=`string`?(po=!1,!1):(t.fillStyle=`#000000`,t.fillRect(0,0,2,2),t.filter=`blur(1px)`,t.fillStyle=`#ffffff`,t.fillRect(0,0,1,1),po=t.getImageData(1,1,1,1).data[0]>0,po)}catch{return po=!1,!1}},ho=async({coverUrl:e,monetBackgroundImage:t,theme:n,tuning:r})=>{let i=ro({coverUrl:e,monetBackgroundImage:t,tuning:r});if(!i)return null;let a=await io(i),o=document.createElement(`canvas`);o.width=Ja,o.height=Ya;let s=o.getContext(`2d`);return s?(s.fillStyle=n.backgroundColor,s.fillRect(0,0,o.width,o.height),s.save(),mo()&&(s.filter=`blur(${$a(r.backgroundBlurPx,0,60)}px)`),oo(s,a,o.width,o.height),s.restore(),lo(s,o.width,o.height,n,r),uo(s,o.width,o.height,n,r),o.toDataURL(`image/jpeg`,.92)):null},go=e=>{let t=fo(e),n=Xa.get(t);if(n)return n;let r=ho(e).catch(()=>null);return Xa.set(t,r),r},_o=240,vo=76,yo=156,bo=3.4,xo=.035,So=.01,Co=12.9898,wo=78.233,To=39.425,Eo=(e,t)=>(e%t+t)%t,Do=(e,t)=>{let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)},Oo=e=>e*e*(3-2*e),ko=(e,t,n)=>{let r=Math.floor(e),i=Do(Eo(r,t),n);return i+(Do(Eo(r+1,t),n)-i)*Oo(e-r)},Ao=(e,t)=>{let n=ko(e,vo,t),r=ko(e*2,152,t+17.31);return(n*.68+r*.32)*2-1},jo=e=>{let t=e.reduce((e,t)=>Math.max(e,Math.abs(t)),0);return t>0?e.map(e=>e/t):e},Mo=e=>{let t=Math.min(1,Math.max(0,e)),n=bo*t,r=1+n/100*2+So,i=xo*t,a=[],o=[],s=[];for(let e=0;e<=yo;e+=1){let t=vo*e/yo;a.push(Ao(t,Co)),o.push(Ao(t,wo)),s.push(Ao(t,To))}let c=jo(a),l=jo(o),u=jo(s);return{keyframes:c.map((e,t)=>({transform:`translate3d(${(e*n).toFixed(4)}%, ${(l[t]*n).toFixed(4)}%, 0) scale(${(r+i*((u[t]+1)/2)).toFixed(5)})`})),durationMs:_o*1e3,maxTravelPercent:n,minScale:r}},No=180,Po=(e,t,n)=>Math.min(n,Math.max(t,e)),Fo=(e,t,n,r)=>{(0,V.useEffect)(()=>{let i=e.current;if(!i||!t||n<=0||typeof i.animate!=`function`||r)return;let a=Mo(n),o=i.animate(a.keyframes,{duration:a.durationMs,iterations:1/0,easing:`linear`});return()=>o.cancel()},[t,e,n,r])},Io=(e,t,n)=>n.backgroundSource===`uploaded-global`?t?.url??e??null:e??t?.url??null,Lo=({coverUrl:e,monetBackgroundImage:t,theme:n,isDaylight:r=!1,tuning:i=I,transparentBackground:a=!1,staticMode:o=!1})=>{let[s,c]=(0,V.useState)(null),l=Io(e,t,i),u=(0,V.useMemo)(()=>`linear-gradient(135deg, ${P(n.accentColor,.22)}, ${P(n.backgroundColor,.96)} 50%, ${P(n.primaryColor,.18)})`,[n]),d=(0,V.useMemo)(()=>`linear-gradient(90deg, ${P(n.backgroundColor,.18)} 0%, ${P(n.backgroundColor,.32)} 34%, ${P(n.backgroundColor,.66)} 70%, ${P(n.backgroundColor,.82)} 100%)`,[n]),f=(0,V.useMemo)(()=>fo({coverUrl:e,monetBackgroundImage:t,theme:n,tuning:i}),[e,t,n,i]);(0,V.useEffect)(()=>{let r=!1,o;return!l||a?(c(null),()=>{r=!0}):(o=window.setTimeout(()=>{go({coverUrl:e,monetBackgroundImage:t,theme:n,tuning:i}).then(e=>{r||c(t=>t===e?t:e)})},No),()=>{r=!0,o!==void 0&&window.clearTimeout(o)})},[f,l,a]);let p=(0,V.useRef)(null),m=Po(i.backgroundDriftStrength??0,0,1),h=!!i.backgroundDriftEnabled&&!o&&m>0;Fo(p,h,m,Ot(`monetBackground`));let g=(0,V.useMemo)(()=>h?{willChange:`transform`}:void 0,[h]),_=(0,V.useMemo)(()=>mo(),[])?0:i.backgroundBlurPx,v=(0,V.useMemo)(()=>_<=0?{}:{filter:`blur(${_}px)`,WebkitFilter:`blur(${_}px)`,transform:`scale(1.1) translateZ(0)`},[_]);if(a)return null;let y=s?`url(${s})`:l?`linear-gradient(135deg, ${P(n.accentColor,.2)}, ${P(n.backgroundColor,.78)}), url(${l})`:u;if(i.backgroundLayout===`full-overlay`)return(0,H.jsxs)(`div`,{className:`absolute inset-0 z-0 overflow-hidden`,children:[(0,H.jsx)(`div`,{ref:p,className:`absolute inset-0`,style:g,children:(0,H.jsx)(E,{initial:!1,children:(0,H.jsx)(D.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.8,ease:`easeInOut`},className:`absolute inset-0`,style:{backgroundColor:n.backgroundColor,backgroundImage:y,backgroundSize:`cover`,backgroundPosition:`center`,...v}},s||l||`fallback`)})}),(0,H.jsx)(`div`,{className:`absolute inset-0`,style:{background:d}})]});let b=(r?.7:.3)+Po(i.backgroundOverlayOpacity,0,1)*.16,x=Po(50+i.backgroundHalfPaneOffsetX,10,90);return(0,H.jsxs)(`div`,{className:`absolute inset-0 z-0 overflow-hidden`,children:[(0,H.jsx)(`div`,{className:`absolute inset-0`,style:{backgroundColor:n.backgroundColor,backgroundImage:u}}),(0,H.jsx)(E,{initial:!1,children:s||l?(0,H.jsx)(`div`,{className:`absolute inset-y-0 left-0 w-[72%] sm:w-[68%] lg:w-[60%] overflow-hidden`,style:{WebkitMaskImage:`linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 48%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0) 100%)`,maskImage:`linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 48%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0) 100%)`},children:(0,H.jsx)(`div`,{ref:p,className:`absolute inset-0`,style:g,children:(0,H.jsx)(D.div,{initial:{opacity:0},animate:{opacity:b},exit:{opacity:0},transition:{duration:.8,ease:`easeInOut`},className:`absolute inset-0`,style:{backgroundImage:y,backgroundRepeat:`no-repeat`,backgroundSize:`cover`,backgroundPosition:`${x}% center`,...v}},s||l||`fallback`)})}):null}),(0,H.jsx)(`div`,{className:`absolute inset-0`,style:{background:`linear-gradient(90deg, ${P(n.backgroundColor,.14)} 0%, ${P(n.backgroundColor,.28)} 28%, ${P(n.backgroundColor,.62)} 64%, ${P(n.backgroundColor,.86)} 100%)`}}),(0,H.jsx)(`div`,{className:`absolute inset-0`,style:{backgroundImage:`radial-gradient(circle at 18% 34%, ${P(n.accentColor,.18)}, transparent 36%)`,backgroundSize:`cover`,backgroundPosition:`center`}}),(0,H.jsx)(`div`,{className:`absolute inset-0`,style:{background:d}})]})},Ro=mr({mode:`monet`,order:20,labelKey:`options.visualizerBackgroundModeMonet`,labelFallback:`Monet`,render:({config:e,coverUrl:t,theme:n,isDaylight:r,staticMode:i})=>(0,H.jsx)(Lo,{coverUrl:t,monetBackgroundImage:e?.customImage,theme:n,isDaylight:r,tuning:e?.monet?.tuning,transparentBackground:e?.transparent,staticMode:i}),renderSettingsPanel:({config:e,actions:t,t:n,isDaylight:r,theme:i,controlCardBg:a,rangeInputClass:o,onSliderPointerDown:s,onSliderCommit:c})=>(0,H.jsx)(qa,{t:n,isDaylight:r,theme:i,controlCardBg:a,rangeInputClass:o,tuning:e?.monet?.tuning??I,onTuningChange:t?.monet?.onTuningChange,monetBackgroundImage:e?.customImage,onUploadMonetBackgroundImage:t?.customImage?.onUpload,onClearMonetBackgroundImage:t?.customImage?.onClear,isLoadingMonetBackgroundImage:t?.customImage?.isLoading,onSliderPointerDown:s,onSliderCommit:c}),renderQuickControls:({config:e,actions:t,t:n,isDaylight:r})=>{let i=(e?.monet?.tuning??I).backgroundLayout===`full-overlay`,a=n(i?`options.monetLayoutFullOverlay`:`options.monetLayoutHalfPane`);return(0,H.jsx)(hr,{isDaylight:r,label:a,title:`${n(`options.monetBackgroundLayout`)}: ${a}`,onClick:()=>t?.monet?.onTuningChange?.({backgroundLayout:i?`half-pane-gradient`:`full-overlay`})})},resetSettings:e=>e?.monet?.onResetTuning?.()}),zo=1.8,Bo=.01,Vo=16/9,Ho={fiberSize:.2,crumples:.35,crumpleSize:.35,folds:.65,foldCount:5,drops:.2,seed:5.8},Uo={perspective:.4,count:20,focusCenter:.55,focusEdges:.8,swirl:.08,lensCircle:.1},Wo=e=>Math.min(1,Math.max(0,e)),Go=e=>Math.min(zo,Math.max(1,e)),Ko=e=>e<=1?1:Go(e+Bo),qo=e=>Ko(1/(1-2*Math.min(Math.max(e,0),.45))),Jo=(e,t,n)=>n&&!t?!e:e,Yo=(e,t,n)=>Jo(!e,t,n),Xo=(e,t)=>{let{folds:n,crumples:r,drops:i}=Ho;return qo(.02*(2*n+1.5*r+.2*i+.75*Wo(e)+.1*Wo(t)))},Zo=(e,t)=>{let n=.5*Math.hypot(Vo,1),r=Wo(t),i=.7*r**(1.3+2.7*r)*(1-Uo.focusEdges),a=Math.max(.35,1-i/n);if(e<=0)return Ko(1/a);let o=Math.min(e,1)*1.4,s=e=>{let t=2*n/e;return Math.tan(t*o)/Math.tan(o)/t},c=Math.max(1,2*n*o/1.45);if(c>=zo||s(zo)>zo*a)return zo;if(c===1&&s(1)<=a)return Ko(1/a);let l=zo;for(let e=0;e<32;e+=1){let e=(c+l)/2;s(e)>e*a?c=e:l=e}return Ko(l)},Qo=V.memo(({coverUrl:e,monetBackgroundImage:t,tuning:n,theme:r,isDaylight:i})=>{let a={...lt,...n},o=a.imageSource===`uploaded-global`?t?.url??e:e??t?.url;return o?(0,H.jsxs)(`div`,{className:`absolute inset-0 z-0 overflow-hidden`,style:{backgroundColor:r.backgroundColor,pointerEvents:`none`},children:[(()=>{let e={width:`100%`,height:`100%`,image:o,fit:`cover`,minPixelRatio:1,maxPixelCount:2073600,style:{width:`100%`,height:`100%`}};switch(a.effect){case`fluted-glass`:return(0,H.jsx)(Mi,{...e,colorBack:r.backgroundColor,colorShadow:r.secondaryColor,colorHighlight:r.primaryColor,shadows:.25,size:a.flutedGlassSize,distortion:a.flutedGlassDistortion,blur:a.flutedGlassBlur,shape:`lines`,distortionShape:`prism`,highlights:.1,edges:.25},`${o}:fluted-glass`);case`paper-texture`:return(0,H.jsx)(ji,{...e,...Ho,colorFront:r.accentColor,colorBack:r.backgroundColor,contrast:a.paperTextureContrast,roughness:a.paperTextureRoughness,fiber:a.paperTextureFiber,scale:Xo(a.paperTextureRoughness,a.paperTextureFiber)},`${o}:paper-texture`);case`halftone-dots`:return(0,H.jsx)(Fi,{...e,colorBack:r.backgroundColor,colorFront:r.accentColor,size:a.halftoneDotsSize,radius:a.halftoneDotsRadius,contrast:a.halftoneDotsContrast,originalColors:a.halftoneDotsOriginalColors,inverted:Yo(a.halftoneDotsInverted,a.halftoneDotsOriginalColors,i),grid:`hex`,type:`gooey`,grainMixer:.12,grainOverlay:.06,grainSize:.5},`${o}:halftone-dots`);case`lens-distortion`:return(0,H.jsx)(Pi,{...e,...Uo,spread:a.lensDistortionSpread,dispersion:a.lensDistortionDispersion,lensBulge:a.lensDistortionBulge,scale:Zo(a.lensDistortionBulge,a.lensDistortionSpread)},`${o}:lens-distortion`);default:return(0,H.jsx)(Ni,{...e,colorBack:r.backgroundColor,colorFront:r.accentColor,colorHighlight:r.primaryColor,originalColors:a.originalColors,inverted:Jo(a.inverted,a.originalColors,i),type:a.ditheringType,size:a.size,colorSteps:a.colorSteps},`${o}:dithering`)}})(),a.overlayEnabled&&a.overlayOpacity>0&&(0,H.jsx)(`div`,{className:`absolute inset-0`,style:{backgroundColor:r.backgroundColor,opacity:a.overlayOpacity}})]}):(0,H.jsx)(`div`,{className:`absolute inset-0 z-0`,style:{backgroundColor:r.backgroundColor}})}),$o=e=>e.toFixed(2),es=e=>`${Math.round(e*100)}%`,ts=(e,t)=>({borderColor:P(e.secondaryColor,t?.18:.16),selectedBg:P(e.accentColor,t?.1:.16)}),ns=({label:e,value:t,min:n,max:r,step:i,rangeInputClass:a,theme:o,onChange:s,onPointerDown:c,onPointerUp:l,format:u=$o})=>(0,H.jsxs)(`label`,{className:`block space-y-2`,children:[(0,H.jsxs)(`span`,{className:`flex justify-between gap-3 text-sm`,style:{color:o.primaryColor},children:[(0,H.jsx)(`span`,{children:e}),(0,H.jsx)(`span`,{className:`font-mono opacity-70`,children:u(t)})]}),(0,H.jsx)(`input`,{type:`range`,min:n,max:r,step:i,value:t,onChange:e=>s(Number(e.target.value)),onPointerDown:c,onPointerUp:l,onPointerCancel:l,className:a})]}),rs=[`2x2`,`4x4`,`8x8`],is=({t:e,isDaylight:t,theme:n,rangeInputClass:r,tuning:i,onTuningChange:a,onSliderPointerDown:o,onSliderCommit:s})=>{let{borderColor:c,selectedBg:l}=ts(n,t),u={rangeInputClass:r,theme:n,onPointerDown:o,onPointerUp:s};return(0,H.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:c},children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.nomandBackgroundEffectDithering`)}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsx)(`div`,{className:`text-sm`,style:{color:n.primaryColor},children:e(`options.nomandBackgroundDitheringType`)}),(0,H.jsx)(`div`,{className:`grid grid-cols-3 gap-2`,children:rs.map(e=>(0,H.jsx)(`button`,{type:`button`,onClick:()=>a?.({ditheringType:e}),className:`rounded-xl border px-2 py-2 text-xs`,style:{borderColor:i.ditheringType===e?n.accentColor:c,backgroundColor:i.ditheringType===e?l:`transparent`,color:n.primaryColor},children:e},e))})]}),(0,H.jsx)(ns,{...u,label:e(`options.nomandBackgroundSize`),value:i.size,min:.5,max:20,step:.5,format:e=>e.toFixed(1),onChange:e=>a?.({size:e})}),(0,H.jsx)(ns,{...u,label:e(`options.nomandBackgroundColorSteps`),value:i.colorSteps,min:1,max:7,step:1,format:e=>String(Math.round(e)),onChange:e=>a?.({colorSteps:e})}),(0,H.jsx)(vr,{label:e(`options.nomandBackgroundOriginalColors`),checked:i.originalColors,onChange:e=>a?.({originalColors:e}),theme:n}),(0,H.jsx)(vr,{label:e(`options.nomandBackgroundInverted`),checked:i.inverted,onChange:e=>a?.({inverted:e}),theme:n})]})},as=({t:e,isDaylight:t,theme:n,rangeInputClass:r,tuning:i,onTuningChange:a,onSliderPointerDown:o,onSliderCommit:s})=>{let{borderColor:c}=ts(n,t),l={rangeInputClass:r,theme:n,onPointerDown:o,onPointerUp:s};return(0,H.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:c},children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.nomandBackgroundEffectFlutedGlass`)}),(0,H.jsx)(ns,{...l,label:e(`options.nomandBackgroundFlutedGlassSize`),value:i.flutedGlassSize,min:.1,max:1,step:.05,onChange:e=>a?.({flutedGlassSize:e})}),(0,H.jsx)(ns,{...l,label:e(`options.nomandBackgroundFlutedGlassDistortion`),value:i.flutedGlassDistortion,min:0,max:1,step:.05,format:es,onChange:e=>a?.({flutedGlassDistortion:e})}),(0,H.jsx)(ns,{...l,label:e(`options.nomandBackgroundFlutedGlassBlur`),value:i.flutedGlassBlur,min:0,max:1,step:.05,format:es,onChange:e=>a?.({flutedGlassBlur:e})})]})},os=({t:e,isDaylight:t,theme:n,rangeInputClass:r,tuning:i,onTuningChange:a,onSliderPointerDown:o,onSliderCommit:s})=>{let{borderColor:c}=ts(n,t),l={rangeInputClass:r,theme:n,onPointerDown:o,onPointerUp:s};return(0,H.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:c},children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.nomandBackgroundEffectHalftoneDots`)}),(0,H.jsx)(ns,{...l,label:e(`options.nomandBackgroundHalftoneDotsSize`),value:i.halftoneDotsSize,min:.1,max:1,step:.05,onChange:e=>a?.({halftoneDotsSize:e})}),(0,H.jsx)(ns,{...l,label:e(`options.nomandBackgroundHalftoneDotsRadius`),value:i.halftoneDotsRadius,min:.1,max:2,step:.05,onChange:e=>a?.({halftoneDotsRadius:e})}),(0,H.jsx)(ns,{...l,label:e(`options.nomandBackgroundHalftoneDotsContrast`),value:i.halftoneDotsContrast,min:0,max:1,step:.05,format:es,onChange:e=>a?.({halftoneDotsContrast:e})}),(0,H.jsx)(vr,{label:e(`options.nomandBackgroundOriginalColors`),checked:i.halftoneDotsOriginalColors,onChange:e=>a?.({halftoneDotsOriginalColors:e}),theme:n}),(0,H.jsx)(vr,{label:e(`options.nomandBackgroundInverted`),checked:i.halftoneDotsInverted,onChange:e=>a?.({halftoneDotsInverted:e}),theme:n})]})},ss=({t:e,isDaylight:t,theme:n,rangeInputClass:r,tuning:i,onTuningChange:a,onSliderPointerDown:o,onSliderCommit:s})=>{let{borderColor:c}=ts(n,t),l={rangeInputClass:r,theme:n,onPointerDown:o,onPointerUp:s};return(0,H.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:c},children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.nomandBackgroundEffectLensDistortion`)}),(0,H.jsx)(ns,{...l,label:e(`options.nomandBackgroundLensDistortionSpread`),value:i.lensDistortionSpread,min:0,max:1,step:.05,format:es,onChange:e=>a?.({lensDistortionSpread:e})}),(0,H.jsx)(ns,{...l,label:e(`options.nomandBackgroundLensDistortionBulge`),value:i.lensDistortionBulge,min:-1,max:1,step:.05,onChange:e=>a?.({lensDistortionBulge:e})}),(0,H.jsx)(ns,{...l,label:e(`options.nomandBackgroundLensDistortionDispersion`),value:i.lensDistortionDispersion,min:0,max:1,step:.05,format:es,onChange:e=>a?.({lensDistortionDispersion:e})})]})},cs=({t:e,isDaylight:t,theme:n,rangeInputClass:r,tuning:i,onTuningChange:a,onSliderPointerDown:o,onSliderCommit:s})=>{let{borderColor:c}=ts(n,t),l={rangeInputClass:r,theme:n,onPointerDown:o,onPointerUp:s};return(0,H.jsxs)(`div`,{className:`space-y-4 rounded-2xl border p-3`,style:{borderColor:c},children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.2em]`,style:{color:n.secondaryColor},children:e(`options.nomandBackgroundEffectPaperTexture`)}),(0,H.jsx)(ns,{...l,label:e(`options.nomandBackgroundPaperTextureContrast`),value:i.paperTextureContrast,min:0,max:1,step:.05,format:es,onChange:e=>a?.({paperTextureContrast:e})}),(0,H.jsx)(ns,{...l,label:e(`options.nomandBackgroundPaperTextureRoughness`),value:i.paperTextureRoughness,min:0,max:1,step:.05,format:es,onChange:e=>a?.({paperTextureRoughness:e})}),(0,H.jsx)(ns,{...l,label:e(`options.nomandBackgroundPaperTextureFiber`),value:i.paperTextureFiber,min:0,max:1,step:.05,format:es,onChange:e=>a?.({paperTextureFiber:e})})]})},ls=[`dithering`,`fluted-glass`,`paper-texture`,`halftone-dots`,`lens-distortion`],us={dithering:`options.nomandBackgroundEffectDithering`,"fluted-glass":`options.nomandBackgroundEffectFlutedGlass`,"paper-texture":`options.nomandBackgroundEffectPaperTexture`,"halftone-dots":`options.nomandBackgroundEffectHalftoneDots`,"lens-distortion":`options.nomandBackgroundEffectLensDistortion`},ds=e=>{let{t,isDaylight:n,theme:r,tuning:i}=e,{borderColor:a,selectedBg:o}=ts(r,n);return(0,H.jsxs)(`div`,{className:`space-y-4`,children:[(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsx)(`div`,{className:`text-sm`,style:{color:r.primaryColor},children:t(`options.nomandBackgroundEffect`)}),(0,H.jsx)(`div`,{className:`grid grid-cols-2 gap-2 sm:grid-cols-3`,children:ls.map(n=>(0,H.jsx)(`button`,{type:`button`,onClick:()=>e.onTuningChange?.({effect:n}),className:`rounded-xl border px-2 py-2 text-xs`,style:{borderColor:i.effect===n?r.accentColor:a,backgroundColor:i.effect===n?o:`transparent`,color:r.primaryColor},children:t(us[n])},n))})]}),i.effect===`dithering`&&(0,H.jsx)(is,{...e}),i.effect===`fluted-glass`&&(0,H.jsx)(as,{...e}),i.effect===`paper-texture`&&(0,H.jsx)(cs,{...e}),i.effect===`halftone-dots`&&(0,H.jsx)(os,{...e}),i.effect===`lens-distortion`&&(0,H.jsx)(ss,{...e})]})},fs=({t:e,isDaylight:t,theme:r,controlCardBg:i,rangeInputClass:a,tuning:o,onTuningChange:s,monetBackgroundImage:c,onUploadMonetBackgroundImage:l,onClearMonetBackgroundImage:u,isLoadingMonetBackgroundImage:d=!1,onSliderPointerDown:f,onSliderCommit:p})=>{let m={...lt,...o},h=(0,V.useRef)(null),[g,_]=(0,V.useState)(``),v=P(r.secondaryColor,t?.18:.16),y=P(r.accentColor,t?.1:.16),b=e=>{s?.({imageSource:e})},x=async t=>{if(!t.length||!l)return;let n=await l(t);_(n.ok?e(`options.nomandBackgroundUploadSuccess`):n.error??e(`options.nomandBackgroundUploadFailed`)),n.ok&&b(`uploaded-global`)};return(0,H.jsxs)(`div`,{className:`rounded-[24px] border p-4 space-y-4`,style:{backgroundColor:i,borderColor:v},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:r.primaryColor},children:e(`options.nomandBackgroundSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-70`,style:{color:r.secondaryColor},children:e(`options.nomandBackgroundSettingsDesc`)})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsx)(`div`,{className:`text-sm`,style:{color:r.primaryColor},children:e(`options.nomandBackgroundSource`)}),(0,H.jsx)(`div`,{className:`grid grid-cols-2 gap-2`,children:[[`cover-derived`,e(`options.monetBackgroundSourceCover`)],[`uploaded-global`,e(`options.monetBackgroundSourceUploaded`)]].map(([e,t])=>(0,H.jsx)(`button`,{type:`button`,disabled:e===`uploaded-global`&&!c&&!d,onClick:()=>b(e),className:`rounded-2xl border px-3 py-2 text-sm disabled:opacity-40`,style:{borderColor:m.imageSource===e?r.accentColor:v,backgroundColor:m.imageSource===e?y:`transparent`,color:r.primaryColor},children:t},e))}),(0,H.jsxs)(`div`,{className:`flex flex-wrap gap-2`,children:[(0,H.jsx)(`input`,{ref:h,type:`file`,accept:`image/png,image/jpeg,image/webp,image/gif`,className:`hidden`,onChange:e=>{x(Array.from(e.target.files??[])),e.target.value=``}}),(0,H.jsxs)(`button`,{type:`button`,disabled:d||!l,onClick:()=>h.current?.click(),className:`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs disabled:opacity-40`,style:{borderColor:v,color:r.primaryColor},children:[(0,H.jsx)(T,{size:14}),e(`options.monetUploadBackground`)]}),(0,H.jsxs)(`button`,{type:`button`,disabled:!c||!u,onClick:()=>void u?.(),className:`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs disabled:opacity-40`,style:{borderColor:v,color:r.secondaryColor},children:[(0,H.jsx)(n,{size:14}),e(`options.monetClearBackground`)]})]}),(0,H.jsx)(`div`,{className:`truncate text-xs opacity-60`,style:{color:r.secondaryColor},children:g||c?.name||`-`})]}),(0,H.jsx)(ds,{t:e,isDaylight:t,theme:r,rangeInputClass:a,tuning:m,onTuningChange:s,onSliderPointerDown:f,onSliderCommit:p}),(0,H.jsxs)(`div`,{className:`space-y-3 rounded-2xl border p-3`,style:{borderColor:v},children:[(0,H.jsx)(vr,{label:e(`options.nomandBackgroundOverlay`),description:e(`options.nomandBackgroundOverlayDesc`),checked:m.overlayEnabled,onChange:e=>s?.({overlayEnabled:e}),theme:r}),(0,H.jsxs)(`label`,{className:`block space-y-2 ${m.overlayEnabled?``:`opacity-45`}`,children:[(0,H.jsxs)(`span`,{className:`flex justify-between text-sm`,style:{color:r.primaryColor},children:[(0,H.jsx)(`span`,{children:e(`options.nomandBackgroundOverlayOpacity`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,children:[Math.round(m.overlayOpacity*100),`%`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`1`,step:`0.05`,value:m.overlayOpacity,disabled:!m.overlayEnabled,onChange:e=>s?.({overlayOpacity:Number(e.target.value)}),onPointerDown:f,onPointerUp:p,className:a})]})]})]})},ps=mr({mode:`nomand`,order:30,labelKey:`options.visualizerBackgroundModeNomand`,labelFallback:`Nomand`,render:({config:e,coverUrl:t,theme:n,isDaylight:r})=>(0,H.jsx)(Qo,{coverUrl:t,monetBackgroundImage:e?.customImage,tuning:e?.nomand?.tuning,theme:n,isDaylight:r}),renderSettingsPanel:({config:e,actions:t,...n})=>(0,H.jsx)(fs,{...n,tuning:e?.nomand?.tuning??lt,onTuningChange:t?.nomand?.onTuningChange,monetBackgroundImage:e?.customImage,onUploadMonetBackgroundImage:t?.customImage?.onUpload,onClearMonetBackgroundImage:t?.customImage?.onClear,isLoadingMonetBackgroundImage:t?.customImage?.isLoading}),renderQuickControls:({config:e,actions:t,t:n,theme:r})=>{let i=e?.nomand?.tuning??lt;return(0,H.jsx)(gr,{active:i.overlayEnabled,theme:r,label:n(`options.nomandBackgroundOverlay`),onToggle:()=>t?.nomand?.onTuningChange?.({overlayEnabled:!i.overlayEnabled}),children:(0,H.jsx)(v,{size:14})})},resetSettings:e=>e?.nomand?.onResetTuning?.()}),ms=5120,hs=5121,gs=5122,_s=5123,vs=5124,ys=5125,bs=5126,xs=32819,Ss=32820,Cs=33635,ws=5131,Ts=33640,Es=35899,Ds=35902,Os=36269,ks=34042,As={};{let e=As;e[ms]=Int8Array,e[hs]=Uint8Array,e[gs]=Int16Array,e[_s]=Uint16Array,e[vs]=Int32Array,e[ys]=Uint32Array,e[bs]=Float32Array,e[xs]=Uint16Array,e[Ss]=Uint16Array,e[Cs]=Uint16Array,e[ws]=Uint16Array,e[Ts]=Uint32Array,e[Es]=Uint32Array,e[Ds]=Uint32Array,e[Os]=Uint32Array,e[ks]=Uint32Array}function js(e){if(e instanceof Int8Array)return ms;if(e instanceof Uint8Array||e instanceof Uint8ClampedArray)return hs;if(e instanceof Int16Array)return gs;if(e instanceof Uint16Array)return _s;if(e instanceof Int32Array)return vs;if(e instanceof Uint32Array)return ys;if(e instanceof Float32Array)return bs;throw Error(`unsupported typed array type`)}function Ms(e){if(e===Int8Array)return ms;if(e===Uint8Array||e===Uint8ClampedArray)return hs;if(e===Int16Array)return gs;if(e===Uint16Array)return _s;if(e===Int32Array)return vs;if(e===Uint32Array)return ys;if(e===Float32Array)return bs;throw Error(`unsupported typed array type`)}function Ns(e){let t=As[e];if(!t)throw Error(`unknown gl type`);return t}var Ps=typeof SharedArrayBuffer<`u`?function(e){return e&&e.buffer&&(e.buffer instanceof ArrayBuffer||e.buffer instanceof SharedArrayBuffer)}:function(e){return e&&e.buffer&&e.buffer instanceof ArrayBuffer};function Fs(...e){console.error(...e)}function Is(...e){console.warn(...e)}var Ls=new Map;function Rs(e,t){if(!e||typeof e!=`object`)return!1;let n=Ls.get(t);n||(n=new WeakMap,Ls.set(t,n));let r=n.get(e);if(r===void 0){let i=Object.prototype.toString.call(e);r=i.substring(8,i.length-1)===t,n.set(e,r)}return r}function zs(e,t){return typeof WebGLBuffer<`u`&&Rs(t,`WebGLBuffer`)}function Bs(e,t){return typeof WebGLTexture<`u`&&Rs(t,`WebGLTexture`)}var Vs=35044,Hs=34962,Us=34963,Ws=34660,Gs=5120,Ks=5121,qs=5122,Js=5123,Ys=5124,Xs=5125,Zs=5126,Qs={attribPrefix:``};function $s(e,t,n,r,i){e.bindBuffer(t,n),e.bufferData(t,r,i||Vs)}function ec(e,t,n,r){if(zs(e,t))return t;n||=Hs;let i=e.createBuffer();return $s(e,n,i,t,r),i}function tc(e){return e===`indices`}function nc(e){return e===Int8Array||e===Uint8Array}function rc(e){return e.length?e:e.data}var ic=/coord|texture/i,ac=/color|colour/i;function oc(e,t){let n;if(n=ic.test(e)?2:ac.test(e)?4:3,t%n>0)throw Error(`Can not guess numComponents for attribute '${e}'. Tried ${n} but ${t} values is not evenly divisible by ${n}. You should specify it.`);return n}function sc(e,t,n){return e.numComponents||e.size||oc(t,n||rc(e).length)}function cc(e,t){if(Ps(e))return e;if(Ps(e.data))return e.data;Array.isArray(e)&&(e={data:e});let n=e.type?uc(e.type):void 0;return n||=tc(t)?Uint16Array:Float32Array,new n(e.data)}function lc(e){return typeof e==`number`?e:e?Ms(e):Zs}function uc(e){return typeof e==`number`?Ns(e):e||Float32Array}function dc(e,t){return{buffer:t.buffer,numValues:24,type:lc(t.type),arrayType:uc(t.type)}}function fc(e,t){let n=t.data||t,r=uc(t.type),i=n*r.BYTES_PER_ELEMENT,a=e.createBuffer();return e.bindBuffer(Hs,a),e.bufferData(Hs,i,t.drawType||Vs),{buffer:a,numValues:n,type:Ms(r),arrayType:r}}function pc(e,t,n){let r=cc(t,n);return{arrayType:r.constructor,buffer:ec(e,r,void 0,t.drawType),type:js(r),numValues:0}}function mc(e,t){let n={};return Object.keys(t).forEach(function(r){if(!tc(r)){let i=t[r],a=i.attrib||i.name||i.attribName||Qs.attribPrefix+r;if(i.value){if(!Array.isArray(i.value)&&!Ps(i.value))throw Error(`array.value is not array or typedarray`);n[a]={value:i.value}}else{let t;t=i.buffer&&i.buffer instanceof WebGLBuffer?dc:typeof i==`number`||typeof i.data==`number`?fc:pc;let{buffer:o,type:s,numValues:c,arrayType:l}=t(e,i,r),u=i.normalize===void 0?nc(l):i.normalize,d=sc(i,r,c);n[a]={buffer:o,numComponents:d,type:s,normalize:u,stride:i.stride||0,offset:i.offset||0,divisor:i.divisor===void 0?void 0:i.divisor,drawType:i.drawType}}}}),e.bindBuffer(Hs,null),n}function hc(e,t){return t===Gs||t===Ks?1:t===qs||t===Js?2:t===Ys||t===Xs||t===Zs?4:0}var gc=[`position`,`positions`,`a_position`];function _c(e,t){let n,r=0;for(;r<gc.length&&(n=gc[r],!(n in t||(n=Qs.attribPrefix+n,n in t)));++r);r===gc.length&&(n=Object.keys(t)[0]);let i=t[n];if(!i.buffer)return 1;e.bindBuffer(Hs,i.buffer);let a=e.getBufferParameter(Hs,Ws);e.bindBuffer(Hs,null);let o=a/hc(e,i.type),s=i.numComponents||i.size,c=o/s;if(c%1!=0)throw Error(`numComponents ${s} not correct for length ${length}`);return c}function vc(e,t,n){let r=mc(e,t),i=Object.assign({},n||{});i.attribs=Object.assign({},n?n.attribs:{},r);let a=t.indices;if(a){let t=cc(a,`indices`);i.indices=ec(e,t,Us),i.numElements=t.length,i.elementType=js(t)}else i.numElements||=_c(e,i.attribs);return i}function yc(e){return!!e.texStorage2D}var bc=function(){let e={},t={};function n(n){let r=n.constructor.name;if(!e[r]){for(let e in n)if(typeof n[e]==`number`){let r=t[n[e]];t[n[e]]=r?`${r} | ${e}`:e}e[r]=!0}}return function(e,r){return n(e),t[r]||(typeof r==`number`?`0x${r.toString(16)}`:r)}}();new Uint8Array([128,192,255,255]);var xc=6406,Sc=6407,Cc=6408,wc=6409,Tc=6410,Ec=6402,Dc=34041,Oc=33319,kc=33320,Ac=6403,jc=36244,Mc=36248,Nc=36249,Pc={};{let e=Pc;e[xc]={numColorComponents:1},e[wc]={numColorComponents:1},e[Tc]={numColorComponents:2},e[Sc]={numColorComponents:3},e[Cc]={numColorComponents:4},e[Ac]={numColorComponents:1},e[jc]={numColorComponents:1},e[Oc]={numColorComponents:2},e[kc]={numColorComponents:2},e[Sc]={numColorComponents:3},e[Mc]={numColorComponents:3},e[Cc]={numColorComponents:4},e[Nc]={numColorComponents:4},e[Ec]={numColorComponents:1},e[Dc]={numColorComponents:2}}var Fc=Fs;function Ic(e){return typeof document<`u`&&document.getElementById?document.getElementById(e):null}var Lc=33984,Rc=34962,zc=34963,Bc=35713,Vc=35714,Hc=35632,Uc=35633,Wc=35981,Gc=35718,Kc=35721,qc=35971,Jc=35382,Yc=35396,Xc=35398,Zc=35392,Qc=35395,$c=5126,el=35664,tl=35665,nl=35666,rl=5124,il=35667,al=35668,ol=35669,sl=35670,cl=35671,ll=35672,ul=35673,dl=35674,fl=35675,pl=35676,ml=35678,hl=35680,gl=35679,_l=35682,vl=35685,yl=35686,bl=35687,xl=35688,Sl=35689,Cl=35690,wl=36289,Tl=36292,El=36293,Dl=5125,Ol=36294,kl=36295,Al=36296,jl=36298,Ml=36299,Nl=36300,Pl=36303,Fl=36306,Il=36307,Ll=36308,Rl=36311,zl=3553,Bl=34067,Vl=32879,Hl=35866,Y={};function Ul(e,t){return Y[t].bindPoint}function Wl(e,t){return function(n){e.uniform1f(t,n)}}function Gl(e,t){return function(n){e.uniform1fv(t,n)}}function Kl(e,t){return function(n){e.uniform2fv(t,n)}}function ql(e,t){return function(n){e.uniform3fv(t,n)}}function Jl(e,t){return function(n){e.uniform4fv(t,n)}}function Yl(e,t){return function(n){e.uniform1i(t,n)}}function Xl(e,t){return function(n){e.uniform1iv(t,n)}}function Zl(e,t){return function(n){e.uniform2iv(t,n)}}function Ql(e,t){return function(n){e.uniform3iv(t,n)}}function $l(e,t){return function(n){e.uniform4iv(t,n)}}function eu(e,t){return function(n){e.uniform1ui(t,n)}}function tu(e,t){return function(n){e.uniform1uiv(t,n)}}function nu(e,t){return function(n){e.uniform2uiv(t,n)}}function ru(e,t){return function(n){e.uniform3uiv(t,n)}}function iu(e,t){return function(n){e.uniform4uiv(t,n)}}function au(e,t){return function(n){e.uniformMatrix2fv(t,!1,n)}}function ou(e,t){return function(n){e.uniformMatrix3fv(t,!1,n)}}function su(e,t){return function(n){e.uniformMatrix4fv(t,!1,n)}}function cu(e,t){return function(n){e.uniformMatrix2x3fv(t,!1,n)}}function lu(e,t){return function(n){e.uniformMatrix3x2fv(t,!1,n)}}function uu(e,t){return function(n){e.uniformMatrix2x4fv(t,!1,n)}}function du(e,t){return function(n){e.uniformMatrix4x2fv(t,!1,n)}}function fu(e,t){return function(n){e.uniformMatrix3x4fv(t,!1,n)}}function pu(e,t){return function(n){e.uniformMatrix4x3fv(t,!1,n)}}function mu(e,t,n,r){let i=Ul(e,t);return yc(e)?function(t){let a,o;!t||Bs(e,t)?(a=t,o=null):(a=t.texture,o=t.sampler),e.uniform1i(r,n),e.activeTexture(Lc+n),e.bindTexture(i,a),e.bindSampler(n,o)}:function(t){e.uniform1i(r,n),e.activeTexture(Lc+n),e.bindTexture(i,t)}}function hu(e,t,n,r,i){let a=Ul(e,t),o=new Int32Array(i);for(let e=0;e<i;++e)o[e]=n+e;return yc(e)?function(t){e.uniform1iv(r,o),t.forEach(function(t,r){e.activeTexture(Lc+o[r]);let i,s;!t||Bs(e,t)?(i=t,s=null):(i=t.texture,s=t.sampler),e.bindSampler(n,s),e.bindTexture(a,i)})}:function(t){e.uniform1iv(r,o),t.forEach(function(t,n){e.activeTexture(Lc+o[n]),e.bindTexture(a,t)})}}Y[$c]={Type:Float32Array,size:4,setter:Wl,arraySetter:Gl},Y[el]={Type:Float32Array,size:8,setter:Kl,cols:2},Y[tl]={Type:Float32Array,size:12,setter:ql,cols:3},Y[nl]={Type:Float32Array,size:16,setter:Jl,cols:4},Y[rl]={Type:Int32Array,size:4,setter:Yl,arraySetter:Xl},Y[il]={Type:Int32Array,size:8,setter:Zl,cols:2},Y[al]={Type:Int32Array,size:12,setter:Ql,cols:3},Y[ol]={Type:Int32Array,size:16,setter:$l,cols:4},Y[Dl]={Type:Uint32Array,size:4,setter:eu,arraySetter:tu},Y[Ol]={Type:Uint32Array,size:8,setter:nu,cols:2},Y[kl]={Type:Uint32Array,size:12,setter:ru,cols:3},Y[Al]={Type:Uint32Array,size:16,setter:iu,cols:4},Y[sl]={Type:Uint32Array,size:4,setter:Yl,arraySetter:Xl},Y[cl]={Type:Uint32Array,size:8,setter:Zl,cols:2},Y[ll]={Type:Uint32Array,size:12,setter:Ql,cols:3},Y[ul]={Type:Uint32Array,size:16,setter:$l,cols:4},Y[dl]={Type:Float32Array,size:32,setter:au,rows:2,cols:2},Y[fl]={Type:Float32Array,size:48,setter:ou,rows:3,cols:3},Y[pl]={Type:Float32Array,size:64,setter:su,rows:4,cols:4},Y[vl]={Type:Float32Array,size:32,setter:cu,rows:2,cols:3},Y[yl]={Type:Float32Array,size:32,setter:uu,rows:2,cols:4},Y[bl]={Type:Float32Array,size:48,setter:lu,rows:3,cols:2},Y[xl]={Type:Float32Array,size:48,setter:fu,rows:3,cols:4},Y[Sl]={Type:Float32Array,size:64,setter:du,rows:4,cols:2},Y[Cl]={Type:Float32Array,size:64,setter:pu,rows:4,cols:3},Y[ml]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:zl},Y[hl]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:Bl},Y[gl]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:Vl},Y[_l]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:zl},Y[wl]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:Hl},Y[Tl]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:Hl},Y[El]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:Bl},Y[jl]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:zl},Y[Ml]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:Vl},Y[Nl]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:Bl},Y[Pl]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:Hl},Y[Fl]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:zl},Y[Il]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:Vl},Y[Ll]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:Bl},Y[Rl]={Type:null,size:0,setter:mu,arraySetter:hu,bindPoint:Hl};function gu(e,t){return function(n){if(n.value)switch(e.disableVertexAttribArray(t),n.value.length){case 4:e.vertexAttrib4fv(t,n.value);break;case 3:e.vertexAttrib3fv(t,n.value);break;case 2:e.vertexAttrib2fv(t,n.value);break;case 1:e.vertexAttrib1fv(t,n.value);break;default:throw Error(`the length of a float constant value must be between 1 and 4!`)}else e.bindBuffer(Rc,n.buffer),e.enableVertexAttribArray(t),e.vertexAttribPointer(t,n.numComponents||n.size,n.type||$c,n.normalize||!1,n.stride||0,n.offset||0),e.vertexAttribDivisor&&e.vertexAttribDivisor(t,n.divisor||0)}}function _u(e,t){return function(n){if(n.value){if(e.disableVertexAttribArray(t),n.value.length===4)e.vertexAttrib4iv(t,n.value);else throw Error(`The length of an integer constant value must be 4!`)}else e.bindBuffer(Rc,n.buffer),e.enableVertexAttribArray(t),e.vertexAttribIPointer(t,n.numComponents||n.size,n.type||rl,n.stride||0,n.offset||0),e.vertexAttribDivisor&&e.vertexAttribDivisor(t,n.divisor||0)}}function vu(e,t){return function(n){if(n.value){if(e.disableVertexAttribArray(t),n.value.length===4)e.vertexAttrib4uiv(t,n.value);else throw Error(`The length of an unsigned integer constant value must be 4!`)}else e.bindBuffer(Rc,n.buffer),e.enableVertexAttribArray(t),e.vertexAttribIPointer(t,n.numComponents||n.size,n.type||Dl,n.stride||0,n.offset||0),e.vertexAttribDivisor&&e.vertexAttribDivisor(t,n.divisor||0)}}function yu(e,t,n){let r=n.size,i=n.count;return function(n){e.bindBuffer(Rc,n.buffer);let a=n.size||n.numComponents||r,o=a/i,s=n.type||$c,c=Y[s].size*a,l=n.normalize||!1,u=n.offset||0,d=c/i;for(let r=0;r<i;++r)e.enableVertexAttribArray(t+r),e.vertexAttribPointer(t+r,o,s,l,c,u+d*r),e.vertexAttribDivisor&&e.vertexAttribDivisor(t+r,n.divisor||0)}}var X={};X[$c]={size:4,setter:gu},X[el]={size:8,setter:gu},X[tl]={size:12,setter:gu},X[nl]={size:16,setter:gu},X[rl]={size:4,setter:_u},X[il]={size:8,setter:_u},X[al]={size:12,setter:_u},X[ol]={size:16,setter:_u},X[Dl]={size:4,setter:vu},X[Ol]={size:8,setter:vu},X[kl]={size:12,setter:vu},X[Al]={size:16,setter:vu},X[sl]={size:4,setter:_u},X[cl]={size:8,setter:_u},X[ll]={size:12,setter:_u},X[ul]={size:16,setter:_u},X[dl]={size:4,setter:yu,count:2},X[fl]={size:9,setter:yu,count:3},X[pl]={size:16,setter:yu,count:4};var bu=/ERROR:\s*\d+:(\d+)/gi;function xu(e,t=``,n=0){let r=[...t.matchAll(bu)],i=new Map(r.map((e,n)=>{let i=parseInt(e[1]),a=r[n+1],o=a?a.index:t.length,s=t.substring(e.index,o);return[i-1,s]}));return e.split(`
`).map((e,t)=>{let r=i.get(t);return`${t+1+n}: ${e}${r?`\n\n^^^ ${r}`:``}`}).join(`
`)}var Su=/^[ \t]*\n/;function Cu(e){let t=0;return Su.test(e)&&(t=1,e=e.replace(Su,``)),{lineOffset:t,shaderSource:e}}function wu(e,t){return e.errorCallback(t),e.callback&&setTimeout(()=>{e.callback(`${t}\n${e.errors.join(`
`)}`)}),null}function Tu(e,t,n,r){if(r||=Fc,!e.getShaderParameter(n,Bc)){let i=e.getShaderInfoLog(n),{lineOffset:a,shaderSource:o}=Cu(e.getShaderSource(n)),s=`${xu(o,i,a)}\nError compiling ${bc(e,t)}: ${i}`;return r(s),s}return``}function Eu(e,t,n){let r,i,a;if(typeof t==`function`&&(n=t,t=void 0),typeof e==`function`)n=e,e=void 0;else if(e&&!Array.isArray(e)){let t=e;n=t.errorCallback,e=t.attribLocations,r=t.transformFeedbackVaryings,i=t.transformFeedbackMode,a=t.callback}let o=n||Fc,s=[],c={errorCallback(e,...t){s.push(e),o(e,...t)},transformFeedbackVaryings:r,transformFeedbackMode:i,callback:a,errors:s};{let n={};Array.isArray(e)?e.forEach(function(e,r){n[e]=t?t[r]:r}):n=e||{},c.attribLocations=n}return c}var Du=[`VERTEX_SHADER`,`FRAGMENT_SHADER`];function Ou(e,t){if(t.indexOf(`frag`)>=0)return Hc;if(t.indexOf(`vert`)>=0)return Uc}function ku(e,t,n){let r=e.getAttachedShaders(t);for(let t of r)n.has(t)||e.deleteShader(t);e.deleteProgram(t)}var Au=(e=0)=>new Promise(t=>setTimeout(t,e));function ju(e,t,n){let r=e.createProgram(),{attribLocations:i,transformFeedbackVaryings:a,transformFeedbackMode:o}=Eu(n);for(let n=0;n<t.length;++n){let i=t[n];if(typeof i==`string`){let t=Ic(i),r=t?t.text:i,a=e[Du[n]];t&&t.type&&(a=Ou(e,t.type)||a),i=e.createShader(a),e.shaderSource(i,Cu(r).shaderSource),e.compileShader(i)}e.attachShader(r,i)}Object.entries(i).forEach(([t,n])=>e.bindAttribLocation(r,n,t));{let t=a;t&&(t.attribs&&(t=t.attribs),Array.isArray(t)||(t=Object.keys(t)),e.transformFeedbackVaryings(r,t,o||Wc))}return e.linkProgram(r),r}function Mu(e,t,n,r,i){let a=Eu(n,r,i),o=new Set(t),s=ju(e,t,a);function c(e,t){let n=Pu(e,t,a.errorCallback);return n&&ku(e,t,o),n}if(a.callback)Nu(e,s).then(()=>{let t=c(e,s);a.callback(t,t?void 0:s)});else return c(e,s)?void 0:s}async function Nu(e,t){let n=e.getExtension(`KHR_parallel_shader_compile`),r=n?(e,t)=>e.getProgramParameter(t,n.COMPLETION_STATUS_KHR):()=>!0,i=0;do await Au(i),i=1e3/60;while(!r(e,t))}function Pu(e,t,n){if(n||=Fc,!e.getProgramParameter(t,Vc)){let r=e.getProgramInfoLog(t);return n(`Error in program linking: ${r}`),`${r}\n${e.getAttachedShaders(t).map(t=>Tu(e,e.getShaderParameter(t,e.SHADER_TYPE),t,n)).filter(e=>e).join(`
`)}`}}function Fu(e,t,n,r,i){return Mu(e,t,n,r,i)}function Iu(e){let t=e.name;return t.startsWith(`gl_`)||t.startsWith(`webgl_`)}var Lu=/(\.|\[|]|\w+)/g,Ru=e=>e>=`0`&&e<=`9`;function zu(e,t,n,r){let i=e.split(Lu).filter(e=>e!==``),a=0,o=``;for(;;){let e=i[a++];o+=e;let s=Ru(e[0]),c=s?parseInt(e):e;if(s&&(o+=i[a++]),a===i.length){n[c]=t;break}{let e=i[a++],t=e===`[`,s=n[c]||(t?[]:{});n[c]=s,n=s,r[o]=r[o]||function(e){return function(t){Uu(e,t)}}(s),o+=e}}}function Bu(e,t){let n=0;function r(t,r,i){let a=r.name.endsWith(`[0]`),o=r.type,s=Y[o];if(!s)throw Error(`unknown type: 0x${o.toString(16)}`);let c;if(s.bindPoint){let t=n;n+=r.size,c=a?s.arraySetter(e,o,t,i,r.size):s.setter(e,o,t,i,r.size)}else c=s.arraySetter&&a?s.arraySetter(e,i):s.setter(e,i);return c.location=i,c}let i={},a={},o=e.getProgramParameter(t,Gc);for(let n=0;n<o;++n){let o=e.getActiveUniform(t,n);if(Iu(o))continue;let s=o.name;s.endsWith(`[0]`)&&(s=s.substr(0,s.length-3));let c=e.getUniformLocation(t,o.name);if(c){let e=r(t,o,c);i[s]=e,zu(s,e,a,i)}}return i}function Vu(e,t){let n={},r=e.getProgramParameter(t,qc);for(let i=0;i<r;++i){let r=e.getTransformFeedbackVarying(t,i);n[r.name]={index:i,type:r.type,size:r.size}}return n}function Hu(e,t){let n=e.getProgramParameter(t,Gc),r=[],i=[];for(let a=0;a<n;++a){i.push(a),r.push({});let n=e.getActiveUniform(t,a);r[a].name=n.name}[[`UNIFORM_TYPE`,`type`],[`UNIFORM_SIZE`,`size`],[`UNIFORM_BLOCK_INDEX`,`blockNdx`],[`UNIFORM_OFFSET`,`offset`]].forEach(function(n){let a=n[0],o=n[1];e.getActiveUniforms(t,i,e[a]).forEach(function(e,t){r[t][o]=e})});let a={},o=e.getProgramParameter(t,Jc);for(let n=0;n<o;++n){let r=e.getActiveUniformBlockName(t,n),i={index:e.getUniformBlockIndex(t,r),usedByVertexShader:e.getActiveUniformBlockParameter(t,n,Yc),usedByFragmentShader:e.getActiveUniformBlockParameter(t,n,Xc),size:e.getActiveUniformBlockParameter(t,n,Zc),uniformIndices:e.getActiveUniformBlockParameter(t,n,Qc)};i.used=i.usedByVertexShader||i.usedByFragmentShader,a[r]=i}return{blockSpecs:a,uniformData:r}}function Uu(e,t){for(let n in t){let r=e[n];typeof r==`function`?r(t[n]):Uu(e[n],t[n])}}function Wu(e,...t){let n=e.uniformSetters||e,r=t.length;for(let e=0;e<r;++e){let r=t[e];if(Array.isArray(r)){let e=r.length;for(let t=0;t<e;++t)Wu(n,r[t])}else for(let e in r){let t=n[e];t&&t(r[e])}}}function Gu(e,t){let n={},r=e.getProgramParameter(t,Kc);for(let i=0;i<r;++i){let r=e.getActiveAttrib(t,i);if(Iu(r))continue;let a=e.getAttribLocation(t,r.name),o=X[r.type],s=o.setter(e,a,o);s.location=a,n[r.name]=s}return n}function Ku(e,t){for(let n in t){let r=e[n];r&&r(t[n])}}function qu(e,t,n){n.vertexArrayObject?e.bindVertexArray(n.vertexArrayObject):(Ku(t.attribSetters||t,n.attribs),n.indices&&e.bindBuffer(zc,n.indices))}function Ju(e,t){let n=Bu(e,t),r=Gu(e,t),i={program:t,uniformSetters:n,attribSetters:r,uniformLocations:Object.fromEntries(Object.entries(n).map(([e,t])=>[e,t.location])),attribLocations:Object.fromEntries(Object.entries(r).map(([e,t])=>[e,t.location]))};return yc(e)&&(i.uniformBlockSpec=Hu(e,t),i.transformFeedbackInfo=Vu(e,t)),i}var Yu=/\s|{|}|;/;function Xu(e,t,n,r,i){let a=Eu(n,r,i),o=[];if(t=t.map(function(e){if(!Yu.test(e)){let t=Ic(e);if(t)e=t.text;else{let t=`no element with id: ${e}`;a.errorCallback(t),o.push(t)}}return e}),o.length)return wu(a,``);let s=a.callback;s&&(a.callback=(t,n)=>{s(t,t?void 0:Ju(e,n))});let c=Fu(e,t,a);return c?Ju(e,c):null}var Zu=4,Qu=5123;function $u(e,t,n,r,i,a){n=n===void 0?Zu:n;let o=t.indices,s=t.elementType,c=r===void 0?t.numElements:r;i=i===void 0?0:i,s||o?a===void 0?e.drawElements(n,c,s===void 0?Qu:t.elementType,i):e.drawElementsInstanced(n,c,s===void 0?Qu:t.elementType,i,a):a===void 0?e.drawArrays(n,i,c):e.drawArraysInstanced(n,i,c,a)}var ed=6402,td=33190,nd=36012,rd=35056,id=36013,ad=32854,od=32855,sd=36194,cd=33189,ld=6401,ud=36168,dd=34041,fd=36096,pd=36128,md=33306,hd={};hd[dd]=md,hd[ld]=pd,hd[ud]=pd,hd[ed]=fd,hd[cd]=fd,hd[td]=fd,hd[nd]=fd,hd[rd]=md,hd[id]=md;var gd={};gd[ad]=!0,gd[od]=!0,gd[sd]=!0,gd[dd]=!0,gd[cd]=!0,gd[ld]=!0,gd[ud]=!0;var _d={addExtensionsToContext:!0},vd=/^(.*?)_/;function yd(e,t){bc(e,0);let n=e.getExtension(t);if(n){let r={},i=vd.exec(t)[1],a=`_`+i;for(let t in n){let o=n[t],s=typeof o==`function`,c=s?i:a,l=t;t.endsWith(c)&&(l=t.substring(0,t.length-c.length)),e[l]===void 0?s?e[l]=function(e){return function(){return e.apply(n,arguments)}}(o):(e[l]=o,r[l]=o):!s&&e[l]!==o&&Is(l,e[l],o,t)}r.constructor={name:n.constructor.name},bc(r,0)}return n}var bd=`ANGLE_instanced_arrays.EXT_blend_minmax.EXT_color_buffer_float.EXT_color_buffer_half_float.EXT_disjoint_timer_query.EXT_disjoint_timer_query_webgl2.EXT_frag_depth.EXT_sRGB.EXT_shader_texture_lod.EXT_texture_compression_bptc.EXT_texture_compression_rgtc.EXT_texture_filter_anisotropic.OES_element_index_uint.OES_standard_derivatives.OES_texture_float.OES_texture_float_linear.OES_texture_half_float.OES_texture_half_float_linear.OES_vertex_array_object.WEBGL_color_buffer_float.WEBGL_compressed_texture_atc.WEBGL_compressed_texture_etc1.WEBGL_compressed_texture_etc.WEBGL_compressed_texture_pvrtc.WEBGL_compressed_texture_s3tc.WEBGL_compressed_texture_s3tc_srgb.WEBGL_depth_texture.WEBGL_draw_buffers`.split(`.`);function xd(e){for(let t=0;t<bd.length;++t)yd(e,bd[t])}function Sd(e,t){let n=[`webgl2`,`webgl`,`experimental-webgl`],r=null;for(let i=0;i<n.length;++i)if(r=e.getContext(n[i],t),r){_d.addExtensionsToContext&&xd(r);break}return r}function Cd(e,t){return Sd(e,t)}function wd(e,t){t||=1,t=Math.max(0,t);let n=e.clientWidth*t|0,r=e.clientHeight*t|0;return e.width!==n||e.height!==r?(e.width=n,e.height=r,!0):!1}var Td=150,Ed=`
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
`,Dd=`
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
`,Od=({theme:e,isDaylight:t,paused:n=!1})=>{let r=(0,V.useRef)(null),i=(0,V.useRef)(null),a=(0,V.useRef)(0),o=N(e.primaryColor)||(t?{r:0,g:0,b:0}:{r:255,g:255,b:255}),s=[o.r/255,o.g/255,o.b/255],c=N(e.accentColor)||o,l=[c.r/255,c.g/255,c.b/255],u=t?[1,1,1]:[0,0,0],d=(0,V.useRef)(n),f=(0,V.useRef)(s),p=(0,V.useRef)(l),m=(0,V.useRef)(u);return d.current=n,f.current=s,p.current=l,m.current=u,(0,V.useEffect)(()=>{let e=r.current;if(!e)return;let t=Cd(e,{alpha:!1,depth:!1,antialias:!1});if(!t)return;let n=Xu(t,[Ed,Dd],e=>{console.error(`SoraBackground twgl program error:`,e)});if(!n)return;let o=new Float32Array(Td);for(let e=0;e<Td;e++)o[e]=e;let s=vc(t,{a_index:{numComponents:1,data:o}}),c=performance.now(),l=r=>{if(!d.current){let e=(r-c)/1e3;a.current+=e}c=r,wd(e),t.viewport(0,0,t.canvas.width,t.canvas.height);let o=m.current;t.clearColor(o[0],o[1],o[2],1),t.clear(t.COLOR_BUFFER_BIT),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA);let u={u_resolution:[t.canvas.width,t.canvas.height],u_time:a.current,u_particle_color:f.current,u_particle_accent_color:p.current};t.useProgram(n.program),qu(t,n,s),Wu(n,u),$u(t,s,t.POINTS),i.current=requestAnimationFrame(l)};return i.current=requestAnimationFrame(l),()=>{i.current&&cancelAnimationFrame(i.current),t.deleteProgram(n.program),s.attribs&&s.attribs.a_index&&s.attribs.a_index.buffer&&t.deleteBuffer(s.attribs.a_index.buffer)}},[]),(0,H.jsx)(`canvas`,{ref:r,className:`absolute inset-0 w-full h-full block pointer-events-none`,style:{width:`100%`,height:`100%`,willChange:`transform`,transform:`translateZ(0)`}})},kd=({t:e,isDaylight:t,theme:n,controlCardBg:r,tuning:i,onTuningChange:a})=>{let o=P(n.secondaryColor,t?.18:.16);return(0,H.jsxs)(`div`,{className:`rounded-[24px] border p-4 space-y-5`,style:{backgroundColor:r,borderColor:o},children:[(0,H.jsx)(`div`,{className:`space-y-1`,children:(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:n.primaryColor},children:e(`options.soraBackgroundSettings`)})}),(0,H.jsx)(vr,{label:e(`options.soraBlank`),description:e(`options.soraBlankDesc`),checked:i.blank,onChange:e=>a?.({blank:e}),theme:n})]})},Ad=mr({mode:`sora`,order:50,labelKey:`options.visualizerBackgroundModeSora`,labelFallback:`Sora`,render:({config:e,theme:t,isDaylight:n,paused:r})=>(0,H.jsx)(`div`,{className:`absolute inset-0 z-0`,style:{backgroundColor:n?`#ffffff`:`#000000`},children:!e?.sora?.tuning?.blank&&(0,H.jsx)(Od,{theme:t,isDaylight:n,paused:r})}),renderSettingsPanel:({config:e,actions:t,t:n,isDaylight:r,theme:i,controlCardBg:a})=>(0,H.jsx)(kd,{t:n,isDaylight:r,theme:i,controlCardBg:a,tuning:e?.sora?.tuning??ft,onTuningChange:t?.sora?.onTuningChange}),renderQuickControls:({config:e,actions:t,t:n,theme:r})=>{let i=e?.sora?.tuning??ft;return(0,H.jsx)(gr,{active:i.blank,theme:r,label:n(`options.soraBlank`),onToggle:()=>t?.sora?.onTuningChange?.({blank:!i.blank}),children:(0,H.jsx)(x,{size:14})})},resetSettings:e=>e?.sora?.onResetTuning?.()}),jd=`latent`,Md=[Fr,ca,Ro,ps,Ad].sort((e,t)=>e.order-t.order),Nd=new Map(Md.map(e=>[e.mode,e])),Pd=e=>Nd.get(e)??ca,Fd=(e,t)=>{let n=Pd(e),r=t(n.labelKey);return!r||r===n.labelKey?n.labelFallback:r},Id=Et(e=>({message:null,setMessage:t=>e(e=>({message:typeof t==`function`?t(e.message):t}))})),Ld=e=>{Id.getState().setMessage(e)},Rd=!1,zd=new Set,Bd=e=>{Rd!==e&&(Rd=e,zd.forEach(e=>e()))},Vd=()=>Bd(!1),Hd=()=>Bd(!Rd),Ud=()=>Rd,Wd=e=>(zd.add(e),()=>{zd.delete(e)}),Gd={default:`options.machiCameraDefault`,custom:`options.machiCameraCustom`},Kd={center:`options.machiFocusCenter`,lyrics:`options.machiFocusLyrics`,manual:`options.machiFocusManual`},qd=(e,t=0)=>n=>{let r=Math.abs(n).toFixed(t);return`${Number(r)===0?``:n>0?`+`:`−`}${r}${e}`},Jd=[{key:`azimuth`,labelKey:`options.machiViewAzimuth`,step:1,format:qd(`°`)},{key:`elevation`,labelKey:`options.machiViewElevation`,step:1,format:qd(`°`)},{key:`zoom`,labelKey:`options.machiViewZoom`,step:.05,format:R},{key:`panX`,labelKey:`options.machiViewPanX`,step:.1,format:qd(` m`,1)},{key:`panZ`,labelKey:`options.machiViewPanZ`,step:.1,format:qd(` m`,1)}],Yd=[...ve].reverse(),Xd=Yd.length-1,Zd=e=>Yd.reduce((t,n,r)=>Math.abs(Math.log(n/e))<Math.abs(Math.log(Yd[t]/e))?r:t,0),Qd=e=>Yd[Math.min(Xd,Math.max(0,Math.round(e)))],$d=e=>`f/${e}`,ef=new Map,tf=new Set,nf=()=>tf.forEach(e=>e()),rf=(e,t)=>{ef.get(e)!==t&&(ef.set(e,t),nf())},af=e=>{ef.delete(e)&&nf()},of=e=>(tf.add(e),()=>{tf.delete(e)}),sf=()=>{let e=0;return ef.forEach(t=>{e=Math.max(e,t)}),e},cf=new Map,lf=new Set,uf=()=>lf.forEach(e=>e()),df=(e,t)=>{cf.get(e)!==t&&(cf.set(e,t),uf())},ff=e=>{cf.delete(e)&&uf()},pf=e=>(lf.add(e),()=>{lf.delete(e)}),mf=()=>{let e=null;return cf.forEach(t=>{e=t}),e},hf={auto:`options.lyricAntialiasAuto`,on:`options.lyricAntialiasOn`,off:`options.lyricAntialiasOff`},gf=()=>le.map(e=>({value:String(e),label:ce(e)})),_f=({value:e,onChange:t,antialias:n=!0})=>{let{t:r}=c(),i=Le(e=>e.lyricRenderQuality),a=r(`options.lyricRenderFollowGlobal`);return(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(L,{label:r(`options.lyricRenderScale`),note:r(`options.lyricRenderScaleStyleHint`,{value:ce(i.scale)}),children:(0,H.jsx)(At,{value:String(e.scale),options:[{value:`global`,label:a},...gf()],onChange:e=>t({scale:e===`global`?`global`:le.find(t=>String(t)===e)??`global`})})}),n&&(0,H.jsx)(L,{label:r(`options.lyricAntialias`),note:r(`options.lyricAntialiasStyleHint`,{value:r(hf[i.antialias])}),children:(0,H.jsx)(Mt,{value:e.antialias,options:ue.map(e=>({value:e,label:e===`global`?a:r(hf[e])})),onChange:e=>t({antialias:e})})})]})},vf=(e,t,n=!1)=>e.behind===`backdrop`||!n&&!!t?.transparent,yf=e=>vf($e.read(e.visualizerTunings),e.background,e.isPreviewMode)?e.background:{...e.background,transparent:!0},bf=e=>vf($e.read(e),void 0),xf=(e,t,n)=>{let r=$e.read(t),i=r.behind===`aquarium`&&!n;return e===kt.nebbiaAquaBeat?i:e!==kt.nebbiaDrizzleRide||!i||r.glass===`rain`},Sf=`mineradio-folia-visual-assets-v1`,Cf=`assets`,wf=new Set([`cappella_custom_avatar`,`cappella_custom_emoji_pack`,`monet_background_image`,`monet_portrait_image`,`lyrics_uploaded_font`]);function Tf(e){if(!wf.has(e)&&!e.startsWith(`tempera_layer_image_`))throw Error(`Unsupported local visual asset`)}function Ef(e,t){return new Promise((n,r)=>{if(typeof indexedDB>`u`){r(Error(`Local visual asset storage is unavailable`));return}let i=!1,a=indexedDB.open(Sf,1),o=e=>{i||(i=!0,r(e))};a.onupgradeneeded=()=>{a.result.objectStoreNames.contains(Cf)||a.result.createObjectStore(Cf)},a.onerror=()=>o(a.error||Error(`Unable to open local visual asset storage`)),a.onblocked=()=>o(Error(`Local visual asset storage is busy`)),a.onsuccess=()=>{let r=a.result;if(i)r.close();else{r.onversionchange=()=>r.close();try{let a=r.transaction(Cf,e),s;try{s=t(a.objectStore(Cf))}catch(e){throw a.abort(),e}a.oncomplete=()=>{r.close(),i||(i=!0,n(s.result))},a.onabort=()=>{r.close(),o(a.error||s.error||Error(`Local visual asset transaction aborted`))},a.onerror=()=>{r.close(),o(a.error||s.error||Error(`Local visual asset transaction failed`))}}catch(e){r.close(),o(e)}}}})}async function Df(e){return Tf(e),await Ef(`readonly`,t=>t.get(e))??null}async function Of(e,t){Tf(e),await Ef(`readwrite`,n=>n.put(t,e))}async function kf(e){Tf(e),await Ef(`readwrite`,t=>t.delete(e))}var Af=[`.png`,`.jpg`,`.jpeg`,`.gif`,`.webp`,`.svg`],jf=async e=>{let t=await Df(e);return!t?.blob||!(t.blob instanceof Blob)||typeof t.name!=`string`?null:t},Mf=async(e,t)=>{await Of(e,t)},Nf=async e=>{await kf(e)},Pf=e=>{let t=e.name.toLowerCase(),n=Af.some(e=>t.endsWith(e));return e.type.startsWith(`image/`)||n},Ff=e=>({id:`${Date.now()}-${e.name}`,name:e.name,mimeType:e.type||`application/octet-stream`,blob:e}),If=256,Lf=e=>`tempera_layer_image_${e}`,Rf=Pf,zf=async e=>jf(Lf(e)),Bf=async e=>{await Mf(Lf(e.id),e)},Vf=async e=>{await Nf(Lf(e))},Hf=e=>Ff(e),Uf=async e=>{if(typeof createImageBitmap!=`function`||typeof document>`u`)return null;let t=null;try{t=await createImageBitmap(e);let n=If/Math.max(t.width,t.height);if(n>=1)return null;let r=document.createElement(`canvas`);r.width=Math.max(1,Math.round(t.width*n)),r.height=Math.max(1,Math.round(t.height*n));let i=r.getContext(`2d`);return i?(i.drawImage(t,0,0,r.width,r.height),await new Promise(e=>r.toBlob(e,`image/webp`,.82))):null}catch{return null}finally{t?.close()}},Wf=async e=>{let t=Hf(e),n=await Uf(e);return n?{...t,thumbnail:n}:t},Gf=async e=>{let t=new Map;return await Promise.all(e.map(async e=>{let n=await zf(e.id).catch(()=>null),r=n?.thumbnail??n?.blob;r&&t.set(e.id,r)})),t},Kf=async e=>{let t=new Map;return await Promise.all(e.map(async e=>{let n=await zf(e.id).catch(()=>null);n?.blob&&t.set(e.id,n.blob)})),t},qf=e=>Math.min(1,Math.max(0,e)),Jf=(e,t,n)=>{let r=1-n;return 3*r*r*n*e+3*r*n*n*t+n*n*n},Yf=(e,t,n,r,i)=>{let a=qf(i);if(a===0||a===1)return a;let o=0,s=1,c=a;for(let t=0;t<12;t+=1)Jf(e,n,c)<a?o=c:s=c,c=(o+s)/2;return Jf(t,r,c)},Xf=e=>Yf(.22,1,.36,1,e),Zf=e=>Yf(.62,0,.32,1,e),Qf=e=>{let t=qf(e);return 1+2.42*(t-1)**3+1.42*(t-1)**2},$f={left:{from:.14,to:.32},center:{from:.4,to:.6},right:{from:.68,to:.86},free:{from:.12,to:.88}},ep={top:{from:.14,to:.32},center:{from:.4,to:.6},bottom:{from:.68,to:.86},free:{from:.12,to:.88}},tp=(e,t)=>{let n=$f[e.align]??$f.free,r=ep[e.verticalAlign]??ep.bottom;return{x:n.from+(n.to-n.from)*It(t,1,251),y:r.from+(r.to-r.from)*It(t,2,257),scale:e.scale*(.9+It(t,3,263)*.2),rotation:(It(t,4,269)-.5)*.08,opacity:e.opacity,flip:It(t,5,271)>.5}},np=(e,t,n,r)=>{if(e.length===0||It(n,6,277)>=qf(t))return null;let i=Math.floor(It(n,7,281)*e.length)%e.length;for(let t=0;t<e.length;t+=1){let n=e[(i+t)%e.length];if(n.id!==r)return n}return e[i]},rp=(e,t)=>{let n=new e.Container,r=new e.Container,i=Math.cos(t.flowAngle),a=Math.sin(t.flowAngle),o=Math.max(t.width,t.height)*.09,s=np(t.pool,t.frequency,t.seed,t.previousId),c=s?t.textures.get(s.id):void 0;if(!s||!c)return{back:n,front:r,updateTime:()=>void 0,applyPool:()=>void 0,chosenId:s?.id??null};let l=new e.Sprite(c);l.anchor.set(.5),(t.depth===`front`?r:n).addChild(l);let u=.6+It(t.seed,8,283)*.8,d=0,f=0,p=1,m=e=>{let n=tp(e,t.seed),r=c.height>0?t.height*n.scale/c.height:1;l.scale.set(r*(n.flip?-1:1),r),l.rotation=n.rotation,d=n.x*t.width,f=n.y*t.height,p=n.opacity};return m(s),l.position.set(d,f),{back:n,front:r,updateTime:(e,t,n,r)=>{let s=Math.max(n-t,.2),c=Math.max((r??n)-t,.2),m=Zf(qf((e-t)/s))*o*.35*u,h=Xf((e-t-c*.1)/(c*.5));l.alpha=p*h,l.visible=h>.001,l.position.set(d+i*m,f+a*m)},applyPool:e=>{let t=e.find(e=>e.id===s.id);t&&m(t)},chosenId:s.id}},ip={name:`Midnight Default`,backgroundColor:`#09090b`,primaryColor:`#f4f4f5`,accentColor:`#f4f4f5`,secondaryColor:`#71717a`,fontStyle:`sans`,animationIntensity:`normal`},ap={name:`Daylight Default`,backgroundColor:`#f5f5f4`,primaryColor:`#1c1917`,accentColor:`#ea580c`,secondaryColor:`#44403c`,fontStyle:`sans`,animationIntensity:`normal`},op=(e,t=0)=>Number.isFinite(e)?e:t;function sp(e,t){return e.lines.map((n,r)=>{let i=Math.max(0,op(n.time)),a=n.words?.map(e=>{let t=Math.max(0,op(e.time,i));return{text:e.text,startTime:t,endTime:t+Math.max(0,op(e.duration))}})??[],o=op(e.lines[r+1]?.time,op(t,i)),s=Math.max(i,op(n.endTime,o),...a.map(e=>e.endTime));return{id:`${e.trackId}:${r}`,startTime:i,endTime:s,fullText:n.text,translation:n.translation,romanization:n.romanization,backgroundVocals:n.backgroundVocals,words:a.length?a:n.lineTimedTtml&&s>i?te(n.text,i,s):[{text:n.text,startTime:i,endTime:s}]}})}function cp(e,t){for(let n=e.length-1;n>=0;n--){let r=e[n];if(t>=r.startTime&&t<=(r.renderHints?.renderEndTime??r.endTime))return n}return-1}function lp(e){let t=-1/0;for(let n of e){if(!Number.isFinite(n.startTime)||n.startTime<t)return t=>cp(e,t);t=n.startTime}let n=1;for(;n<e.length;)n*=2;let r=new Float64Array(n*2).fill(-1/0);for(let t=0;t<e.length;t++){let i=Number(e[t].renderHints?.renderEndTime??e[t].endTime);r[n+t]=Number.isNaN(i)?-1/0:i}for(let e=n-1;e>0;e--)r[e]=Math.max(r[e*2],r[e*2+1]);let i=(e,t,a=1,o=0,s=n-1)=>{if(o>e||r[a]<t)return-1;if(o===s)return o;let c=Math.floor((o+s)/2),l=i(e,t,a*2+1,c+1,s);return l>=0?l:i(e,t,a*2,o,c)},a=-1,o=-1/0;return t=>{if(!Number.isFinite(t))return cp(e,t);if(a<0||t<o||t-o>.5){let n=0,r=e.length;for(;n<r;){let i=Math.floor((n+r)/2);e[i].startTime<=t?n=i+1:r=i}a=n-1}else for(;a+1<e.length&&e[a+1].startTime<=t;)a++;return o=t,a<0?-1:t<=r[n+a]?a:i(a,t)}}function up(e,t){let n=e.playing?Math.min(.5,Math.max(0,op(t))):0,r=Math.max(0,op(e.position))+n*Math.max(0,op(e.playbackRate,1));return e.duration>0?Math.min(r,e.duration):r}function dp(e){return JSON.stringify([e.currentTrack,e.currentIndex,e.duration,e.playing,e.playbackRate,e.volume,e.muted,e.playMode,e.queueRevision,e.libraryRevision,e.lyricsRevision,e.interface,e.playbackPlaylistId,e.playbackPlaylistName,e.uiLanguage,e.sleepTimer,e.replayGain,e.gapless,e.audioChain,e.outputDevice])}function fp(e,t,n){let r=e.frequency instanceof Uint8Array?e.frequency:Uint8Array.from(e.frequency),i=e.sampleRate/e.fftSize,a=(e,t)=>{if(!r.length||!Number.isFinite(i)||i<=0)return 0;let n=Math.min(r.length-1,Math.max(0,Math.floor(e/i))),a=Math.min(r.length-1,Math.max(n,Math.floor(t/i))),o=0;for(let e=n;e<=a;e++)o+=r[e];return o/(a-n+1)},o=(e,t)=>(e/255)**t*255,s=a(20,150),c=a(150,400);t.spectrum?.set(r),n.set(o((s+c)/2,3)),t.bass.set(o(s,1.8)),t.lowMid.set(o(c,2)),t.mid.set(o(a(400,1200),2)),t.vocal.set(o(a(1e3,3500),1.5)),t.treble.set(o(a(3500,12e3),2))}function pp(e,t){t.set(0);for(let t of[e.bass,e.lowMid,e.mid,e.vocal,e.treble])t.set(0);e.spectrum?.set(new Uint8Array)}var mp=e=>e,hp={id:`vis-cadenza-render`,titleKey:`options.lyricRenderSection`},gp=({tuning:e=bt,onTuningChange:t})=>{let n=e.render??de;return(0,H.jsx)(z,{def:hp,children:(0,H.jsx)(_f,{value:n,onChange:e=>t?.({render:{...n,...e}}),antialias:!1})})},_p=e({default:()=>yp}),vp=V.lazy(()=>u(()=>import(`./VisualizerCadenza-mCq8pIQo.js`),__vite__mapDeps([0,1]),import.meta.url)),yp=mp({mode:`cadenza`,order:40,labelKey:`ui.visualizerCadenze`,labelFallback:`Mindscape`,previewSeed:`cadenza`,previewStartOffset:0,glyph:(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(`circle`,{cx:`9.5`,cy:`12.5`,r:`3.5`}),(0,H.jsx)(`path`,{d:`M4 6.5h3.5`,opacity:`0.45`}),(0,H.jsx)(`path`,{d:`M16 8h4`,opacity:`0.45`}),(0,H.jsx)(`path`,{d:`M15 17h4.5`,opacity:`0.45`})]}),command:{title:`Visualizer: Mindscape`,description:`Switch to cadenza visualizer`,keywords:[`visualizer cadenza`,`cadenza`,`mindscape`,`心象`]},render:({cadenzaTuning:e=bt,lyricsFontScale:t=1,...n})=>(0,H.jsx)(vp,{...n,lyricsFontScale:t,cadenzaTuning:{...e,fontScale:e.fontScale*t}}),renderSettingsPanel:e=>(0,H.jsx)(gp,{...e})});function bp({tuning:e,change:t,t:n}){let r=e.showTranslation===!0;return(0,H.jsxs)(`section`,{"data-testid":`claddagh-layout-settings`,children:[(0,H.jsx)(B,{label:n(`options.claddaghPositionX`),value:e.positionX??0,min:-40,max:40,step:1,format:e=>`${e}%`,onChange:e=>t({positionX:e})}),(0,H.jsx)(B,{label:n(`options.claddaghPositionY`),value:e.positionY??0,min:-40,max:40,step:1,format:e=>`${e}%`,onChange:e=>t({positionY:e})}),(0,H.jsx)(Pt,{label:n(`options.claddaghShowTranslation`),checked:r,onChange:e=>t({showTranslation:e})}),r&&(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(B,{label:n(`options.claddaghTranslationScale`),value:e.translationScale??1,min:.5,max:2,step:.05,format:R,onChange:e=>t({translationScale:e})}),(0,H.jsx)(B,{label:n(`options.claddaghTranslationLetterSpacingOffset`),value:e.translationLetterSpacingOffset??0,min:-5,max:20,step:.5,format:e=>`${e}px`,onChange:e=>t({translationLetterSpacingOffset:e})})]})]})}var xp=({checked:e,disabled:t,label:n,onChange:r,theme:i,isDaylight:a})=>(0,H.jsx)(`button`,{type:`button`,role:`switch`,"aria-checked":e,"aria-label":n,disabled:t,onClick:()=>r(!e),className:`relative h-7 w-12 shrink-0 rounded-full border transition-all disabled:cursor-not-allowed disabled:opacity-35`,style:{borderColor:e?i.accentColor:P(i.secondaryColor,a?.24:.2),backgroundColor:e?P(i.accentColor,a?.2:.28):P(i.backgroundColor,a?.34:.48)},children:(0,H.jsx)(`span`,{className:`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all`,style:{left:e?`24px`:`3px`,backgroundColor:e?i.accentColor:i.secondaryColor,boxShadow:`0 2px 8px ${P(i.backgroundColor,.35)}`}})}),Sp=({label:e,displayValue:t,value:n,min:r,max:i,step:a,disabled:o,rangeInputClass:s,onChange:c,onSliderPointerDown:l,onSliderCommit:u})=>(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3 text-sm`,children:[(0,H.jsx)(`div`,{className:`min-w-0`,style:{color:`var(--text-primary)`},children:e}),(0,H.jsx)(`span`,{className:`shrink-0 font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:t})]}),(0,H.jsx)(`input`,{type:`range`,min:r,max:i,step:a,value:n,disabled:o,"aria-label":e,onChange:e=>c(parseFloat(e.target.value)),onPointerDown:l,onPointerUp:u,className:`${s} disabled:cursor-not-allowed disabled:opacity-35`})]}),Cp=e=>{let t={opacity:e.enabled?1:.52,backgroundColor:P(e.theme.backgroundColor,e.isDaylight?.16:.26)},n={disabled:!e.enabled,rangeInputClass:e.rangeInputClass,onSliderPointerDown:e.onSliderPointerDown,onSliderCommit:e.onSliderCommit};return(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(`div`,{className:`rounded-xl px-3 py-2.5 transition-opacity`,style:t,children:(0,H.jsx)(Sp,{...n,label:e.t(`options.dioramaParticleDensity`),displayValue:String(Math.round(e.density)),value:e.density,min:96,max:Tt,step:24,onChange:e.onDensityChange})}),(0,H.jsx)(`div`,{className:`rounded-xl px-3 py-2.5 transition-opacity`,style:t,children:(0,H.jsx)(Sp,{...n,label:e.t(`options.dioramaParticleScale`),displayValue:`${e.particleScale.toFixed(2)}x`,value:e.particleScale,min:Ct,max:rt,step:at,onChange:e.onParticleScaleChange})}),(0,H.jsxs)(`div`,{className:`space-y-2.5 rounded-xl px-3 py-2.5 transition-opacity`,style:t,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3`,children:[(0,H.jsx)(`div`,{className:`min-w-0`,children:(0,H.jsx)(`div`,{className:`text-sm`,style:{color:`var(--text-primary)`},children:e.t(`options.dioramaParticleGlow`)})}),(0,H.jsx)(xp,{checked:e.glowEnabled,disabled:!e.enabled,label:e.t(`options.dioramaParticleGlow`),onChange:e.onGlowEnabledChange,theme:e.theme,isDaylight:e.isDaylight})]}),e.glowEnabled&&(0,H.jsx)(Sp,{...n,label:e.t(`options.dioramaParticleGlowIntensity`),displayValue:`${Math.round(e.glowIntensity*100)}%`,value:e.glowIntensity,min:.1,max:1.5,step:.05,onChange:e.onGlowIntensityChange})]})]})},wp=[{key:`strands`,labelKey:`options.dioramaGeometryStrands`},{key:`blobs`,labelKey:`options.dioramaGeometryBlobs`},{key:`ribbons`,labelKey:`options.dioramaGeometryRibbons`},{key:`rings`,labelKey:`options.dioramaGeometryRings`}],Tp=[{key:`clouds`,labelKey:`options.dioramaGeometryModeClouds`},{key:`corridor`,labelKey:`options.dioramaGeometryModeCorridor`}],Ep=({t:e,theme:t,isDaylight:n,value:r,onChange:i,density:a,onDensityChange:o,particleScale:s,onParticleScaleChange:c,glowEnabled:l,onGlowEnabledChange:u,glowIntensity:d,onGlowIntensityChange:f,rangeInputClass:p,onSliderPointerDown:m,onSliderCommit:h})=>{let[g,_]=(0,V.useState)(!1),v=(0,V.useId)();return(0,H.jsxs)(`fieldset`,{className:`space-y-2.5`,children:[(0,H.jsx)(`legend`,{className:`sr-only`,children:e(`options.dioramaGeometry`)}),(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3`,style:{borderColor:P(t.secondaryColor,n?.17:.14),backgroundColor:P(t.backgroundColor,n?.24:.34)},children:[(0,H.jsxs)(`button`,{type:`button`,"aria-expanded":g,"aria-controls":v,onClick:()=>_(e=>!e),className:`flex min-w-0 flex-1 items-center gap-2 text-left`,children:[(0,H.jsx)(w,{size:16,"aria-hidden":`true`,className:`shrink-0 transition-transform ${g?`rotate-180`:``}`,style:{color:`var(--text-secondary)`}}),(0,H.jsx)(`span`,{className:`min-w-0`,children:(0,H.jsx)(`span`,{className:`block text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.dioramaGeometry`)})})]}),(0,H.jsx)(xp,{checked:r.enabled,label:e(`options.dioramaGeometry`),onChange:e=>i({...r,enabled:e}),theme:t,isDaylight:n})]}),g&&(0,H.jsxs)(`div`,{id:v,className:`ml-3 space-y-1.5 border-l pl-3`,style:{borderColor:P(t.accentColor,r.enabled?.3:.12)},children:[(0,H.jsx)(`div`,{className:`flex gap-2 transition-opacity`,role:`group`,"aria-label":e(`options.dioramaGeometryMode`),style:{opacity:r.enabled?1:.52},children:Tp.map(a=>{let o=r.mode===a.key;return(0,H.jsx)(`button`,{type:`button`,"aria-pressed":o,disabled:!r.enabled,onClick:()=>i({...r,mode:a.key}),className:`flex-1 rounded-xl px-3 py-2 text-sm transition-all border disabled:cursor-not-allowed`,style:{color:`var(--text-primary)`,borderColor:o?t.accentColor:P(t.secondaryColor,n?.18:.14),backgroundColor:o?P(t.accentColor,n?.1:.16):P(t.backgroundColor,n?.24:.34),boxShadow:o?`inset 0 0 0 1px ${t.accentColor}`:`none`},children:e(a.labelKey)},a.key)})}),r.mode===`clouds`&&wp.map(a=>(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition-opacity`,style:{opacity:r.enabled?1:.52,backgroundColor:P(t.backgroundColor,n?.16:.26)},children:[(0,H.jsx)(`div`,{className:`min-w-0`,children:(0,H.jsx)(`div`,{className:`text-sm`,style:{color:`var(--text-primary)`},children:e(a.labelKey)})}),(0,H.jsx)(xp,{checked:r[a.key],disabled:!r.enabled,label:e(a.labelKey),onChange:e=>i({...r,[a.key]:e}),theme:t,isDaylight:n})]},a.key)),(0,H.jsx)(Cp,{t:e,theme:t,isDaylight:n,enabled:r.enabled,density:a,onDensityChange:o,particleScale:s,onParticleScaleChange:c,glowEnabled:l,onGlowEnabledChange:u,glowIntensity:d,onGlowIntensityChange:f,rangeInputClass:p,onSliderPointerDown:m,onSliderCommit:h})]})]})},Dp=({label:e,enabled:t,circumference:n,radial:r,onEnabledChange:i,onCircumferenceChange:a,onRadialChange:o,t:s,isDaylight:c,theme:l,rangeInputClass:u,onSliderPointerDown:d,onSliderCommit:f})=>{let[p,m]=(0,V.useState)(!1),h=(0,V.useId)(),g=(n,r,i,a,o,s)=>(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3 text-sm`,children:[(0,H.jsx)(`div`,{className:`min-w-0`,style:{color:`var(--text-primary)`},children:n}),(0,H.jsx)(`span`,{className:`shrink-0 font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:Math.round(r)})]}),(0,H.jsx)(`input`,{type:`range`,min:i,max:a,step:o,value:r,disabled:!t,"aria-label":`${e} ${n}`,onChange:e=>s(parseFloat(e.target.value)),onPointerDown:d,onPointerUp:f,className:`${u} disabled:cursor-not-allowed disabled:opacity-35`})]});return(0,H.jsxs)(`fieldset`,{className:`space-y-2.5`,children:[(0,H.jsx)(`legend`,{className:`sr-only`,children:e}),(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3`,style:{borderColor:P(l.secondaryColor,c?.17:.14),backgroundColor:P(l.backgroundColor,c?.24:.34)},children:[(0,H.jsxs)(`button`,{type:`button`,"aria-expanded":p,"aria-controls":h,onClick:()=>m(e=>!e),className:`flex min-w-0 flex-1 items-center gap-2 text-left`,children:[(0,H.jsx)(w,{size:16,"aria-hidden":`true`,className:`shrink-0 transition-transform ${p?`rotate-180`:``}`,style:{color:`var(--text-secondary)`}}),(0,H.jsx)(`span`,{className:`min-w-0`,children:(0,H.jsx)(`span`,{className:`block text-sm font-medium`,style:{color:`var(--text-primary)`},children:e})})]}),(0,H.jsx)(xp,{checked:t,label:e,onChange:i,theme:l,isDaylight:c})]}),p&&(0,H.jsxs)(`div`,{id:h,className:`ml-3 space-y-3 border-l pl-3`,style:{borderColor:P(l.accentColor,t?.3:.12)},children:[g(s(`options.dioramaMoteCircumference`),n,4,48,2,a),g(s(`options.dioramaMoteRadial`),r,1,4,1,o)]})]})},Op=[{key:`low`,value:.5},{key:`mid`,value:1},{key:`high`,value:1.5}],kp=({label:e,intensity:t,enabled:n,onIntensityChange:r,t:i,isDaylight:a,theme:o,rangeInputClass:s,onSliderPointerDown:c,onSliderCommit:l})=>{let u=Op.find(e=>Math.abs(e.value-t)<.001)?.key,[d,f]=(0,V.useState)(u==null),p=d?`custom`:u??`custom`,m=[{key:`low`,label:i(`options.dioramaStrengthLow`)},{key:`mid`,label:i(`options.dioramaStrengthMid`)},{key:`high`,label:i(`options.dioramaStrengthHigh`)},{key:`custom`,label:i(`options.dioramaStrengthCustom`)}];return(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.24em] opacity-45`,style:{color:o.secondaryColor},children:i(`options.dioramaEffectStrength`)}),(0,H.jsx)(`div`,{className:`flex flex-wrap gap-2`,children:m.map(e=>{let t=e.key===p;return(0,H.jsx)(`button`,{type:`button`,disabled:!n,onClick:()=>{if(e.key===`custom`){f(!0);return}f(!1);let t=Op.find(t=>t.key===e.key);t&&r(t.value)},className:`rounded-full border px-3 py-2 text-sm transition-all disabled:opacity-35`,style:{color:o.primaryColor,borderColor:t?o.accentColor:P(o.secondaryColor,a?.18:.14),backgroundColor:t?P(o.accentColor,a?.1:.16):P(o.backgroundColor,a?.24:.34),boxShadow:t?`inset 0 0 0 1px ${o.accentColor}`:`none`},children:e.label},e.key)})}),n&&p===`custom`&&(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,children:[(0,H.jsx)(`span`,{style:{color:`var(--text-primary)`},children:i(`options.dioramaCustomStrength`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[Math.round(t*100),`%`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0.1`,max:`1.5`,step:`0.05`,value:t,"aria-label":`${e} ${i(`options.dioramaCustomStrength`)}`,onChange:e=>r(parseFloat(e.target.value)),onPointerDown:c,onPointerUp:l,className:s})]})]})},Ap=({label:e,enabled:t,intensity:n,onEnabledChange:r,onIntensityChange:i,subEffect:a,t:o,isDaylight:s,theme:c,rangeInputClass:l,onSliderPointerDown:u,onSliderCommit:d})=>{let[f,p]=(0,V.useState)(!1),m=(0,V.useId)();return(0,H.jsxs)(`fieldset`,{className:`space-y-2.5`,children:[(0,H.jsx)(`legend`,{className:`sr-only`,children:e}),(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3`,style:{borderColor:P(c.secondaryColor,s?.17:.14),backgroundColor:P(c.backgroundColor,s?.24:.34)},children:[(0,H.jsxs)(`button`,{type:`button`,"aria-expanded":f,"aria-controls":m,onClick:()=>p(e=>!e),className:`flex min-w-0 flex-1 items-center gap-2 text-left`,children:[(0,H.jsx)(w,{size:16,"aria-hidden":`true`,className:`shrink-0 transition-transform ${f?`rotate-180`:``}`,style:{color:`var(--text-secondary)`}}),(0,H.jsx)(`span`,{className:`min-w-0`,children:(0,H.jsx)(`span`,{className:`block text-sm font-medium`,style:{color:`var(--text-primary)`},children:e})})]}),(0,H.jsx)(xp,{checked:t,label:e,onChange:r,theme:c,isDaylight:s})]}),f&&(0,H.jsxs)(`div`,{id:m,className:`ml-3 space-y-3 border-l pl-3`,style:{borderColor:P(c.accentColor,t?.3:.12)},children:[(0,H.jsx)(kp,{label:e,intensity:n,enabled:t,onIntensityChange:i,t:o,isDaylight:s,theme:c,rangeInputClass:l,onSliderPointerDown:u,onSliderCommit:d}),a&&(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3 border-t pt-3`,style:{borderColor:P(c.secondaryColor,s?.18:.14)},children:[(0,H.jsx)(`span`,{className:`min-w-0 text-sm font-medium`,style:{color:`var(--text-primary)`},children:a.label}),(0,H.jsx)(xp,{checked:a.enabled,label:a.label,onChange:a.onEnabledChange,theme:c,isDaylight:s})]})]})]})},jp=({label:e,value:t,options:n,onChange:r,isDaylight:i,theme:a})=>(0,H.jsxs)(`div`,{className:`space-y-2.5`,children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.24em] opacity-45`,style:{color:a.secondaryColor},children:e}),(0,H.jsx)(`div`,{className:`flex flex-wrap gap-2`,children:n.map(e=>{let n=e.value===t;return(0,H.jsx)(`button`,{type:`button`,onClick:()=>r(e.value),className:`px-3 py-2 rounded-full text-sm transition-all border`,style:{color:a.primaryColor,borderColor:n?a.accentColor:P(a.secondaryColor,i?.18:.14),backgroundColor:n?P(a.accentColor,i?.1:.16):P(a.backgroundColor,i?.24:.34),boxShadow:n?`inset 0 0 0 1px ${a.accentColor}`:`none`},children:e.label},String(e.value))})})]}),Mp=jp,Np=e=>Math.min(180,Math.max(0,e)),Pp=e=>Math.min(2,Math.max(0,e)),Fp=e=>Math.min(2,Math.max(0,e)),Ip=e=>Math.min(1.5,Math.max(0,e)),Lp=e=>Math.min(1.5,Math.max(.5,e)),Rp=e=>Math.min(60,Math.max(0,e)),zp=({t:e,isDaylight:t,theme:n,controlCardBg:r,rangeInputClass:i,onSliderPointerDown:a,onSliderCommit:o,classicTuning:s=pt,onClassicTuningChange:c})=>{let l={avoidOverlap:s.avoidOverlap===!0,enableWordRotation:s.enableWordRotation??pt.enableWordRotation,breathingFloatMultiplier:Pp(s.breathingFloatMultiplier??pt.breathingFloatMultiplier),useLegacyLayout:s.useLegacyLayout??pt.useLegacyLayout??!1,wordSpacing:Fp(s.wordSpacing??pt.wordSpacing??.7)},u=(0,V.useMemo)(()=>[{value:!0,label:e(`options.classicWordRotationOn`)},{value:!1,label:e(`options.classicWordRotationOff`)}],[e]),d=(0,V.useMemo)(()=>[{value:!1,label:e(`options.classicLegacyLayoutOff`)},{value:!0,label:e(`options.classicLegacyLayoutOn`)}],[e]);return(0,H.jsxs)(`div`,{className:`rounded-[24px] border border-white/10 p-4 space-y-4`,style:{backgroundColor:r},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.classicSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-50`,style:{color:`var(--text-secondary)`},children:e(`options.classicSettingsDesc`)})]}),(0,H.jsx)(Mp,{label:e(`options.classicWordRotation`),value:l.enableWordRotation,options:u,onChange:e=>c?.({enableWordRotation:e}),isDaylight:t,theme:n}),!l.useLegacyLayout&&(0,H.jsxs)(`label`,{className:`flex items-center justify-between gap-4 text-sm`,title:e(`options.avoidOverlapHint`),children:[(0,H.jsx)(`span`,{children:e(`options.avoidOverlap`)}),(0,H.jsx)(`input`,{type:`checkbox`,checked:!!l.avoidOverlap,"data-testid":`local-classic-avoid-overlap`,onChange:e=>c?.({avoidOverlap:e.target.checked})})]}),(0,H.jsx)(Mp,{label:e(`options.classicLegacyLayout`),value:l.useLegacyLayout||!1,options:d,onChange:e=>c?.({useLegacyLayout:e}),isDaylight:t,theme:n}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.classicBreathingFloatMultiplier`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[l.breathingFloatMultiplier.toFixed(2),`x`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`2`,step:`0.05`,value:l.breathingFloatMultiplier,onChange:e=>c?.({breathingFloatMultiplier:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]}),!l.useLegacyLayout&&(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.classicWordSpacing`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[l.wordSpacing.toFixed(2),`x`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`2`,step:`0.05`,value:l.wordSpacing,onChange:e=>c?.({wordSpacing:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]})]})},Bp=({t:e,isDaylight:t,theme:n,controlCardBg:r,rangeInputClass:i,onSliderPointerDown:a,onSliderCommit:o,partitaTuning:s=ut,onPartitaTuningChange:c})=>{let l=Np(s.staggerMin??ut.staggerMin),u=Np(s.staggerMax??ut.staggerMax),d={avoidOverlap:s.avoidOverlap===!0,showGuideLines:s.showGuideLines??ut.showGuideLines,useSemanticLayout:s.useSemanticLayout??ut.useSemanticLayout,staggerMin:Math.min(l,u),staggerMax:Math.max(l,u)},f=(0,V.useMemo)(()=>[{value:!0,label:e(`options.partitaGuideLinesOn`)},{value:!1,label:e(`options.partitaGuideLinesOff`)}],[e]),p=(0,V.useMemo)(()=>[{value:!0,label:e(`options.partitaSemanticLayoutOn`)},{value:!1,label:e(`options.partitaSemanticLayoutOff`)}],[e]),m=e=>{let t=Np(e);c?.({staggerMin:t,staggerMax:Math.max(t,d.staggerMax)})},h=e=>{let t=Np(e);c?.({staggerMin:Math.min(d.staggerMin,t),staggerMax:t})};return(0,H.jsxs)(`div`,{className:`rounded-[24px] border border-white/10 p-4 space-y-4`,style:{backgroundColor:r},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.partitaSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-50`,style:{color:`var(--text-secondary)`},children:e(`options.partitaSettingsDesc`)})]}),(0,H.jsx)(Mp,{label:e(`options.partitaGuideLines`),value:d.showGuideLines,options:f,onChange:e=>c?.({showGuideLines:e}),isDaylight:t,theme:n}),(0,H.jsxs)(`label`,{className:`flex items-center justify-between gap-4 text-sm`,title:e(`options.avoidOverlapHint`),children:[(0,H.jsx)(`span`,{children:e(`options.avoidOverlap`)}),(0,H.jsx)(`input`,{type:`checkbox`,checked:!!d.avoidOverlap,"data-testid":`local-partita-avoid-overlap`,onChange:e=>c?.({avoidOverlap:e.target.checked})})]}),(0,H.jsx)(Mp,{label:e(`options.partitaSemanticLayout`),value:d.useSemanticLayout,options:p,onChange:e=>c?.({useSemanticLayout:e}),isDaylight:t,theme:n}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.partitaStaggerMin`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[d.staggerMin,`px`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`180`,step:`5`,value:d.staggerMin,onChange:e=>m(parseFloat(e.target.value)),onPointerDown:a,onPointerUp:o,className:i})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.partitaStaggerMax`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[d.staggerMax,`px`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`180`,step:`5`,value:d.staggerMax,onChange:e=>h(parseFloat(e.target.value)),onPointerDown:a,onPointerUp:o,className:i})]})]})},Vp=e=>e===`stepped`||e===`smooth`?e:gt.cameraTrackingMode,Hp=({t:e,isDaylight:t,theme:n,controlCardBg:r,rangeInputClass:i,onSliderPointerDown:a,onSliderCommit:o,fumeTuning:s=gt,onFumeTuningChange:c})=>{let l={hidePrintSymbols:s.hidePrintSymbols,disableGeometricBackground:s.disableGeometricBackground,backgroundObjectOpacity:Math.min(1,Math.max(0,s.backgroundObjectOpacity??gt.backgroundObjectOpacity)),textHoldRatio:Math.min(1,Math.max(0,s.textHoldRatio??gt.textHoldRatio)),cameraTrackingMode:Vp(s.cameraTrackingMode),cameraSpeed:Math.min(1.85,Math.max(.55,s.cameraSpeed)),glowIntensity:Math.min(1.8,Math.max(0,s.glowIntensity)),heroScale:Math.min(1.32,Math.max(.82,s.heroScale))},u=(0,V.useMemo)(()=>[{value:!1,label:e(`options.partitaGuideLinesOn`)},{value:!0,label:e(`options.partitaGuideLinesOff`)}],[e]),d=(0,V.useMemo)(()=>[{value:`stepped`,label:e(`options.fumeCameraTrackingStepped`)},{value:`smooth`,label:e(`options.fumeCameraTrackingSmooth`)}],[e]),f=e=>{c?.(e)};return(0,H.jsxs)(`div`,{className:`rounded-[24px] border border-white/10 p-4 space-y-4`,style:{backgroundColor:r},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.fumeSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-50`,style:{color:`var(--text-secondary)`},children:e(`options.fumeSettingsDesc`)})]}),(0,H.jsx)(Mp,{label:e(`options.fumeHidePrintSymbols`),value:l.hidePrintSymbols,options:u,onChange:e=>f({hidePrintSymbols:e}),isDaylight:t,theme:n}),(0,H.jsx)(Mp,{label:e(`options.fumeGeometricBackground`),value:l.disableGeometricBackground,options:u,onChange:e=>f({disableGeometricBackground:e}),isDaylight:t,theme:n}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.fumeBackgroundObjectOpacity`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[Math.round(l.backgroundObjectOpacity*100),`%`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`1`,step:`0.05`,value:l.backgroundObjectOpacity,onChange:e=>f({backgroundObjectOpacity:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.fumeTextHoldRatio`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[Math.round(l.textHoldRatio*100),`%`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`1`,step:`0.05`,value:l.textHoldRatio,onChange:e=>f({textHoldRatio:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.fumeCameraSpeed`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[l.cameraSpeed.toFixed(2),`x`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0.55`,max:`1.85`,step:`0.05`,value:l.cameraSpeed,onChange:e=>f({cameraSpeed:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]}),(0,H.jsx)(Mp,{label:e(`options.fumeCameraTrackingMode`),value:l.cameraTrackingMode,options:d,onChange:e=>f({cameraTrackingMode:e}),isDaylight:t,theme:n}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.fumeGlowIntensity`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[l.glowIntensity.toFixed(2),`x`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`1.8`,step:`0.05`,value:l.glowIntensity,onChange:e=>f({glowIntensity:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.fumeHeroScale`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[l.heroScale.toFixed(2),`x`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0.82`,max:`1.32`,step:`0.02`,value:l.heroScale,onChange:e=>f({heroScale:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]})]})},Up=(e,t)=>({showEmoMessages:e?.showEmoMessages??ht.showEmoMessages,emojiPackSource:e?.emojiPackSource===`custom`&&t?`custom`:`builtin`,avatarSource:e?.avatarSource===`builtin`||e?.avatarSource===`color`||e?.avatarSource===`cover`||e?.avatarSource===`custom`?e.avatarSource:ht.avatarSource}),Wp=({t:e,isDaylight:t,theme:n,controlCardBg:r,cappellaTuning:i,cappellaCustomEmojiImages:a=[],onCappellaTuningChange:o,cappellaCustomEmojiCount:s=0,hasCappellaCustomEmojiPack:c=!1,isCappellaCustomEmojiPackLoading:l=!1,onImportCappellaCustomEmojiPack:u,onClearCappellaCustomEmojiPack:d,cappellaCustomAvatarImages:f=[],onImportCappellaCustomAvatar:p,onClearCappellaCustomAvatar:m,hasCappellaCustomAvatar:h=!1,isCappellaCustomAvatarLoading:g=!1})=>{let _=(0,V.useRef)(null),v=(0,V.useRef)(null),[y,b]=(0,V.useState)(null),[x,S]=(0,V.useState)(!1),[C,w]=(0,V.useState)(!1),T=Up(i,c),E=(0,V.useMemo)(()=>[{value:`builtin`,label:e(`options.cappellaEmojiSourceBuiltin`)},{value:`custom`,label:e(`options.cappellaEmojiSourceCustom`)}],[e]),D=(0,V.useMemo)(()=>[{value:`cover`,label:e(`options.cappellaAvatarSourceCover`)},{value:`builtin`,label:e(`options.cappellaAvatarSourceBuiltin`)},{value:`color`,label:e(`options.cappellaAvatarSourceColor`)},{value:`custom`,label:e(`options.cappellaAvatarSourceCustom`)}],[e]),O=()=>{b(null),_.current?.click()},k=async t=>{let n=Array.from(t.target.files??[]);if(t.target.value=``,n.length!==0&&u){S(!0),b(null);try{let t=await u(n);t.ok?b(e(`options.cappellaEmojiImportSuccess`)):b(t.error||e(`options.cappellaEmojiImportFailed`))}finally{S(!1)}}},A=async()=>{d&&(b(null),await d(),b(e(`options.cappellaEmojiCleared`)))},j=()=>{b(null),v.current?.click()},ee=async t=>{let n=Array.from(t.target.files??[]);if(t.target.value=``,n.length!==0&&p){w(!0),b(null);try{let t=await p(n);t.ok?b(e(`options.cappellaAvatarImportSuccess`)):b(t.error||e(`options.cappellaAvatarImportFailed`))}finally{w(!1)}}},M=async()=>{m&&(b(null),await m(),b(e(`options.cappellaAvatarCleared`)))},te=f.length>0?f:Array.from({length:5},(e,t)=>f[t]??null),ne=a.length>0?a:Array.from({length:5},(e,t)=>a[t]??null);return(0,H.jsxs)(`div`,{className:`rounded-[24px] border border-white/10 p-4 space-y-4`,style:{backgroundColor:r},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.cappellaSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-50`,style:{color:`var(--text-secondary)`},children:e(`options.cappellaSettingsDesc`)})]}),(0,H.jsx)(Mp,{label:e(`options.cappellaShowEmoMessages`),value:T.showEmoMessages,options:[{value:!0,label:e(`options.partitaGuideLinesOn`)},{value:!1,label:e(`options.partitaGuideLinesOff`)}],onChange:e=>o?.({showEmoMessages:e}),isDaylight:t,theme:n}),(0,H.jsxs)(`div`,{className:`space-y-2.5`,children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.24em] opacity-45`,style:{color:n.secondaryColor},children:e(`options.cappellaAvatarSource`)}),(0,H.jsx)(`div`,{className:`flex flex-wrap gap-2`,children:D.map(e=>{let r=e.value===T.avatarSource,i=e.value===`custom`&&!h;return(0,H.jsx)(`button`,{type:`button`,disabled:i,onClick:()=>o?.({avatarSource:e.value}),className:`px-3 py-2 rounded-full text-sm transition-all border disabled:cursor-not-allowed disabled:opacity-45`,style:{color:n.primaryColor,borderColor:r?n.accentColor:P(n.secondaryColor,t?.18:.14),backgroundColor:r?P(n.accentColor,t?.1:.16):P(n.backgroundColor,t?.24:.34),boxShadow:r?`inset 0 0 0 1px ${n.accentColor}`:`none`},children:e.label},e.value)})})]}),(0,H.jsxs)(`div`,{className:`space-y-2.5`,children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.24em] opacity-45`,style:{color:`var(--text-secondary)`},children:e(`options.cappellaAvatarPreview`)}),(0,H.jsx)(`div`,{className:`grid grid-cols-5 gap-2`,children:te.map((n,r)=>(0,H.jsx)(`div`,{className:`aspect-square rounded-full border overflow-hidden flex items-center justify-center text-[11px] text-center`,style:{borderColor:t?`rgba(24,24,27,0.08)`:`rgba(255,255,255,0.08)`,backgroundColor:t?`rgba(255,255,255,0.42)`:`rgba(255,255,255,0.04)`,color:`var(--text-secondary)`},title:n?.name??e(`options.cappellaEmojiEmptySlot`),children:n?(0,H.jsx)(`img`,{src:n.url,alt:n.name,className:`h-full w-full rounded-full object-cover`}):(0,H.jsx)(`span`,{className:`opacity-45`,children:r+1})},n?.id??`empty-${r}`))}),(0,H.jsx)(`div`,{className:`text-xs opacity-60`,style:{color:`var(--text-secondary)`},children:h?`${e(`options.cappellaEmojiCount`)} ${f.length}`:e(`options.cappellaAvatarUploadHint`)}),(0,H.jsxs)(`div`,{className:`flex flex-wrap gap-2`,children:[(0,H.jsx)(`button`,{type:`button`,onClick:j,disabled:C||g,className:`px-3 py-2 rounded-full text-sm transition-all border disabled:cursor-not-allowed disabled:opacity-50`,style:{color:`var(--text-primary)`,borderColor:t?`rgba(24,24,27,0.08)`:`rgba(255,255,255,0.08)`,backgroundColor:t?`rgba(255,255,255,0.56)`:`rgba(255,255,255,0.04)`},children:e(C?`options.cappellaAvatarUploading`:`options.cappellaAvatarUpload`)}),(0,H.jsx)(`button`,{type:`button`,onClick:()=>void M(),disabled:!h||C||g,className:`px-3 py-2 rounded-full text-sm transition-all border disabled:cursor-not-allowed disabled:opacity-50`,style:{color:`var(--text-primary)`,borderColor:t?`rgba(24,24,27,0.08)`:`rgba(255,255,255,0.08)`,backgroundColor:t?`rgba(255,255,255,0.56)`:`rgba(255,255,255,0.04)`},children:e(`options.cappellaAvatarClear`)})]}),(0,H.jsx)(`input`,{ref:v,type:`file`,accept:`.png,.jpg,.jpeg,.gif,.webp,.svg,image/*`,multiple:!0,className:`hidden`,onChange:e=>void ee(e)})]}),(0,H.jsxs)(`div`,{className:`space-y-2.5`,children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.24em] opacity-45`,style:{color:`var(--text-secondary)`},children:e(`options.cappellaEmojiSource`)}),(0,H.jsx)(`div`,{className:`flex flex-wrap gap-2`,children:E.map(e=>{let r=e.value===T.emojiPackSource,i=e.value===`custom`&&!c;return(0,H.jsx)(`button`,{type:`button`,disabled:i,onClick:()=>o?.({emojiPackSource:e.value}),className:`px-3 py-2 rounded-full text-sm transition-all border disabled:cursor-not-allowed disabled:opacity-45`,style:{color:`var(--text-primary)`,borderColor:r?n.accentColor:P(n.secondaryColor,t?.18:.14),backgroundColor:r?P(n.accentColor,t?.1:.16):P(n.backgroundColor,t?.24:.34),boxShadow:r?`inset 0 0 0 1px ${n.accentColor}`:`none`},children:e.label},e.value)})})]}),(0,H.jsxs)(`div`,{className:`space-y-2.5`,children:[(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.24em] opacity-45`,style:{color:`var(--text-secondary)`},children:e(`options.cappellaEmojiPreview`)}),(0,H.jsx)(`div`,{className:`grid grid-cols-5 gap-2`,children:ne.map((n,r)=>(0,H.jsx)(`div`,{className:`aspect-square rounded-2xl border overflow-hidden flex items-center justify-center text-[11px] text-center px-1`,style:{borderColor:t?`rgba(24,24,27,0.08)`:`rgba(255,255,255,0.08)`,backgroundColor:t?`rgba(255,255,255,0.42)`:`rgba(255,255,255,0.04)`,color:`var(--text-secondary)`},title:n?.name??e(`options.cappellaEmojiEmptySlot`),children:n?(0,H.jsx)(`img`,{src:n.url,alt:n.name,className:`h-full w-full object-contain`}):(0,H.jsx)(`span`,{className:`opacity-45`,children:r+1})},n?.id??`empty-${r}`))}),(0,H.jsx)(`div`,{className:`text-xs opacity-60`,style:{color:`var(--text-secondary)`},children:c?`${e(`options.cappellaEmojiCount`)} ${s}`:e(`options.cappellaEmojiUploadHint`)})]}),(0,H.jsxs)(`div`,{className:`flex flex-wrap gap-2`,children:[(0,H.jsx)(`button`,{type:`button`,onClick:O,disabled:x||l,className:`px-3 py-2 rounded-full text-sm transition-all border disabled:cursor-not-allowed disabled:opacity-50`,style:{color:`var(--text-primary)`,borderColor:t?`rgba(24,24,27,0.08)`:`rgba(255,255,255,0.08)`,backgroundColor:t?`rgba(255,255,255,0.56)`:`rgba(255,255,255,0.04)`},children:e(x?`options.cappellaEmojiUploading`:`options.cappellaEmojiUpload`)}),(0,H.jsx)(`button`,{type:`button`,onClick:()=>void A(),disabled:!c||x||l,className:`px-3 py-2 rounded-full text-sm transition-all border disabled:cursor-not-allowed disabled:opacity-50`,style:{color:`var(--text-primary)`,borderColor:t?`rgba(24,24,27,0.08)`:`rgba(255,255,255,0.08)`,backgroundColor:t?`rgba(255,255,255,0.56)`:`rgba(255,255,255,0.04)`},children:e(`options.cappellaEmojiClear`)})]}),(0,H.jsx)(`input`,{ref:_,type:`file`,accept:`.png,.jpg,.jpeg,.gif,.webp,.svg,image/*`,multiple:!0,className:`hidden`,onChange:e=>void k(e)}),y&&(0,H.jsx)(`div`,{className:`text-xs leading-5 opacity-70`,style:{color:`var(--text-secondary)`},children:y})]})},Gp=({t:e,isDaylight:t,theme:n,controlCardBg:r,rangeInputClass:i,onSliderPointerDown:a,onSliderCommit:o,tiltTuning:s=St,onTiltTuningChange:c})=>{let l={splitProbability:Math.min(1,Math.max(0,s.splitProbability??St.splitProbability)),tiltStyleProbability:Math.min(1,Math.max(0,s.tiltStyleProbability??St.tiltStyleProbability)),colorScheme:s?.colorScheme??St.colorScheme??`default`},u=(0,V.useMemo)(()=>[{label:e(`options.tiltColorSchemeDefault`),value:`default`},{label:e(`options.tiltColorSchemeSwap`),value:`swap`},{label:e(`options.tiltColorSchemeAccentAll`),value:`accentAll`},{label:e(`options.tiltColorSchemePrimaryAll`),value:`primaryAll`}],[e]),d=e=>{c?.(e)};return(0,H.jsxs)(`div`,{className:`rounded-[24px] border border-white/10 p-4 space-y-4`,style:{backgroundColor:r},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.tiltSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-50`,style:{color:`var(--text-secondary)`},children:e(`options.tiltSettingsDesc`)})]}),(0,H.jsx)(Mp,{label:e(`options.tiltColorScheme`),value:l.colorScheme,options:u,onChange:e=>d({colorScheme:e}),isDaylight:t,theme:n}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.tiltSplitProbability`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[Math.round(l.splitProbability*100),`%`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`1`,step:`0.05`,value:l.splitProbability,onChange:e=>d({splitProbability:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.tiltStyleProbability`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[Math.round(l.tiltStyleProbability*100),`%`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`1`,step:`0.05`,value:l.tiltStyleProbability,onChange:e=>d({tiltStyleProbability:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]})]})},Kp=e=>Math.min(1.85,Math.max(.55,e)),qp=e=>Math.min(1.6,Math.max(.4,e)),Jp=e=>Math.min(1.5,Math.max(0,e)),Yp=({t:e,isDaylight:t,theme:n,controlCardBg:r,rangeInputClass:i,onSliderPointerDown:a,onSliderCommit:o,dioramaTuning:s=F,onDioramaTuningChange:c})=>{let l={cameraSpeed:Kp(s.cameraSpeed??F.cameraSpeed),motionAmount:qp(s.motionAmount??F.motionAmount),audioReactivity:Jp(s.audioReactivity??F.audioReactivity),geometryVisibility:{...F.geometryVisibility,...s.geometryVisibility},particleDensity:Math.round(Math.min(Tt,Math.max(96,s.particleDensity??F.particleDensity))),particleScale:Math.min(rt,Math.max(Ct,s.particleScale??F.particleScale)),particleGlowEnabled:s.particleGlowEnabled??F.particleGlowEnabled,particleGlowIntensity:Math.min(st,Math.max(wt,s.particleGlowIntensity??F.particleGlowIntensity)),showParticles:s.showParticles??F.showParticles,backgroundParticleCircumference:nr(s.backgroundParticleCircumference??F.backgroundParticleCircumference),backgroundParticleRadial:rr(s.backgroundParticleRadial??F.backgroundParticleRadial),glowEnabled:s.glowEnabled??F.glowEnabled,glowIntensity:Math.min(1.5,Math.max(.1,s.glowIntensity??F.glowIntensity)),soulEnabled:s.soulEnabled??F.soulEnabled,soulIntensity:Math.min(1.5,Math.max(.1,s.soulIntensity??F.soulIntensity)),soulActiveEnabled:s.soulActiveEnabled??F.soulActiveEnabled,gradientEnabled:s.gradientEnabled??F.gradientEnabled,gradientIntensity:Math.min(1.5,Math.max(.1,s.gradientIntensity??F.gradientIntensity)),keywordColoringEnabled:s.keywordColoringEnabled??F.keywordColoringEnabled},u=e=>{c?.(e)};return(0,H.jsxs)(`div`,{className:`rounded-[24px] border border-white/10 p-4 space-y-4`,style:{backgroundColor:r},children:[(0,H.jsx)(`div`,{children:(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.dioramaSettings`)})}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.dioramaCameraSpeed`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[l.cameraSpeed.toFixed(2),`x`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0.55`,max:`1.85`,step:`0.05`,value:l.cameraSpeed,onChange:e=>u({cameraSpeed:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.dioramaMotionAmount`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[l.motionAmount.toFixed(2),`x`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0.4`,max:`1.6`,step:`0.05`,value:l.motionAmount,onChange:e=>u({motionAmount:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.dioramaAudioReactivity`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[Math.round(l.audioReactivity*100),`%`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`1.5`,step:`0.05`,value:l.audioReactivity,onChange:e=>u({audioReactivity:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]}),(0,H.jsx)(Ap,{label:e(`options.dioramaGlowEffect`),enabled:l.glowEnabled,intensity:l.glowIntensity,onEnabledChange:e=>u({glowEnabled:e}),onIntensityChange:e=>u({glowIntensity:e}),t:e,isDaylight:t,theme:n,rangeInputClass:i,onSliderPointerDown:a,onSliderCommit:o}),(0,H.jsx)(Ap,{label:e(`options.dioramaSoulEffect`),enabled:l.soulEnabled,intensity:l.soulIntensity,onEnabledChange:e=>u({soulEnabled:e}),onIntensityChange:e=>u({soulIntensity:e}),subEffect:{label:e(`options.dioramaSoulActiveEffect`),enabled:l.soulActiveEnabled,onEnabledChange:e=>u({soulActiveEnabled:e})},t:e,isDaylight:t,theme:n,rangeInputClass:i,onSliderPointerDown:a,onSliderCommit:o}),(0,H.jsx)(Ap,{label:e(`options.dioramaGradientEffect`),enabled:l.gradientEnabled,intensity:l.gradientIntensity,onEnabledChange:e=>u({gradientEnabled:e}),onIntensityChange:e=>u({gradientIntensity:e}),t:e,isDaylight:t,theme:n,rangeInputClass:i,onSliderPointerDown:a,onSliderCommit:o}),(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3`,style:{borderColor:P(n.secondaryColor,t?.17:.14),backgroundColor:P(n.backgroundColor,t?.24:.34)},children:[(0,H.jsx)(`span`,{className:`min-w-0 text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.dioramaKeywordColoring`)}),(0,H.jsx)(xp,{checked:l.keywordColoringEnabled,label:e(`options.dioramaKeywordColoring`),onChange:e=>u({keywordColoringEnabled:e}),theme:n,isDaylight:t})]}),(0,H.jsx)(Ep,{t:e,theme:n,isDaylight:t,value:l.geometryVisibility,onChange:e=>u({geometryVisibility:e}),density:l.particleDensity,onDensityChange:e=>u({particleDensity:e}),particleScale:l.particleScale,onParticleScaleChange:e=>u({particleScale:e}),glowEnabled:l.particleGlowEnabled,onGlowEnabledChange:e=>u({particleGlowEnabled:e}),glowIntensity:l.particleGlowIntensity,onGlowIntensityChange:e=>u({particleGlowIntensity:e}),rangeInputClass:i,onSliderPointerDown:a,onSliderCommit:o}),(0,H.jsx)(Dp,{label:e(`options.dioramaShowParticles`),enabled:l.showParticles,circumference:l.backgroundParticleCircumference,radial:l.backgroundParticleRadial,onEnabledChange:e=>u({showParticles:e}),onCircumferenceChange:e=>u({backgroundParticleCircumference:e}),onRadialChange:e=>u({backgroundParticleRadial:e}),t:e,isDaylight:t,theme:n,rangeInputClass:i,onSliderPointerDown:a,onSliderCommit:o})]})},Xp=e=>Math.min(20,Math.max(-5,e)),Zp=({t:e,isDaylight:t,theme:n,controlCardBg:r,rangeInputClass:i,onSliderPointerDown:a,onSliderCommit:o,claddaghTuning:s=vt,onCladdaghTuningChange:c})=>{let l={focusScaleRatio:Ip(s.focusScaleRatio??vt.focusScaleRatio),radiusScale:Lp(s.radiusScale??vt.radiusScale),ellipseTiltDeg:Rp(s.ellipseTiltDeg??vt.ellipseTiltDeg),showAxisLine:s.showAxisLine??vt.showAxisLine,letterSpacingOffset:Xp(s.letterSpacingOffset??vt.letterSpacingOffset)},u=(0,V.useMemo)(()=>[{value:!0,label:e(`options.partitaGuideLinesOn`)},{value:!1,label:e(`options.partitaGuideLinesOff`)}],[e]);return(0,H.jsxs)(`div`,{className:`rounded-[24px] border border-white/10 p-4 space-y-4`,style:{backgroundColor:r},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.claddaghSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-50`,style:{color:`var(--text-secondary)`},children:e(`options.claddaghSettingsDesc`)})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.claddaghFocusScaleRatio`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[(l.focusScaleRatio+1).toFixed(2),`x`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0.0`,max:`1.5`,step:`0.05`,value:l.focusScaleRatio,onChange:e=>c?.({focusScaleRatio:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.claddaghRadiusScale`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[l.radiusScale.toFixed(2),`x`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0.5`,max:`1.5`,step:`0.05`,value:l.radiusScale,onChange:e=>c?.({radiusScale:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.claddaghEllipseTiltDeg`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[l.ellipseTiltDeg,`°`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`0`,max:`60`,step:`1`,value:l.ellipseTiltDeg,onChange:e=>c?.({ellipseTiltDeg:parseInt(e.target.value,10)}),onPointerDown:a,onPointerUp:o,className:i})]}),(0,H.jsx)(Mp,{label:e(`options.claddaghShowAxisLine`),value:l.showAxisLine,options:u,onChange:e=>c?.({showAxisLine:e}),isDaylight:t,theme:n}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e(`options.claddaghLetterSpacingOffset`)}),(0,H.jsxs)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[l.letterSpacingOffset>0?`+`:``,l.letterSpacingOffset.toFixed(1),`px`]})]}),(0,H.jsx)(`input`,{type:`range`,min:`-5`,max:`20`,step:`0.5`,value:l.letterSpacingOffset,onChange:e=>c?.({letterSpacingOffset:parseFloat(e.target.value)}),onPointerDown:a,onPointerUp:o,className:i})]}),c&&(0,H.jsx)(bp,{tuning:s,change:c,t:e})]})},Qp=e({default:()=>em}),$p=V.lazy(()=>u(()=>import(`./VisualizerCappella-DYnCcu-F.js`),__vite__mapDeps([2,1]),import.meta.url)),em=mp({mode:`cappella`,order:110,labelKey:`ui.visualizerCappella`,labelFallback:`Cappella`,previewSeed:`cappella`,previewStartOffset:0,tuningKind:`cappella`,render:e=>(0,H.jsx)($p,{...e}),renderSettingsPanel:e=>(0,H.jsx)(Wp,{...e}),resetSettings:e=>{e.resetCappellaTuning?.()}}),tm=e({default:()=>rm}),nm=V.lazy(()=>u(()=>import(`./VisualizerCladdagh-DPkd1rC3.js`),__vite__mapDeps([3,1]),import.meta.url)),rm=mp({mode:`claddagh`,order:80,labelKey:`ui.visualizerCladdagh`,labelFallback:`Claddagh`,previewSeed:`claddagh`,previewStartOffset:0,tuningKind:`claddagh`,render:e=>(0,H.jsx)(nm,{...e}),renderSettingsPanel:e=>(0,H.jsx)(Zp,{...e}),resetSettings:({resetCladdaghTuning:e,setDraftCladdaghTuning:t})=>{t?.(vt),e?.()}}),im=e({default:()=>om}),am=V.lazy(()=>u(()=>import(`./Visualizer-CLkw9kha.js`),__vite__mapDeps([4,1]),import.meta.url)),om=mp({mode:`classic`,order:30,labelKey:`ui.visualizerClassic`,labelFallback:`Luminous`,previewSeed:`classic`,previewStartOffset:0,tuningKind:`classic`,usesWordSegmentation:!0,render:e=>(0,H.jsx)(am,{...e}),renderSettingsPanel:e=>(0,H.jsx)(zp,{...e}),resetSettings:({resetClassicTuning:e})=>{e?.()}}),sm=e({default:()=>lm}),cm=V.lazy(()=>u(()=>import(`./VisualizerDiorama-COkxGXQY.js`),__vite__mapDeps([5,1]),import.meta.url)),lm=mp({mode:`diorama`,order:120,labelKey:`ui.visualizerDiorama`,labelFallback:`镜台`,previewSeed:`diorama`,previewStartOffset:0,tuningKind:`diorama`,render:e=>(0,H.jsx)(cm,{...e}),renderSettingsPanel:e=>(0,H.jsx)(Yp,{...e}),resetSettings:({resetDioramaTuning:e})=>{e?.()}}),um=e({default:()=>fm}),dm=V.lazy(()=>u(()=>import(`./VisualizerFume-CQ5mU1hk.js`),__vite__mapDeps([6,1]),import.meta.url)),fm=mp({mode:`fume`,order:60,labelKey:`ui.visualizerFume`,labelFallback:`Fume`,previewSeed:`fume`,previewStartOffset:18.4,tuningKind:`fume`,render:e=>(0,H.jsx)(dm,{...e}),renderSettingsPanel:e=>(0,H.jsx)(Hp,{...e}),resetSettings:({resetFumeTuning:e,setDraftFumeTuning:t})=>{t?.(gt),e?.()}}),pm=(e,t,n,r,i={})=>({kind:`slider`,key:e,labelKey:t,min:n,max:r,...i}),mm=(e,t,n)=>({kind:`toggle`,key:e,labelKey:t,noteKey:n}),hm={id:`vis-hanabi-fireworks`,titleKey:`options.hanabiFireworksSection`},gm={id:`vis-hanabi-stage`,titleKey:`options.hanabiStageSection`},_m={id:`vis-hanabi-text`,titleKey:`options.hanabiTextSection`},vm={id:`vis-hanabi-decor`,titleKey:`options.hanabiDecorSection`},ym={id:`vis-hanabi-color`,titleKey:`options.hanabiColorSection`},bm={id:`vis-hanabi-performance`,titleKey:`options.hanabiPerformanceSection`},xm={id:`vis-hanabi-render`,titleKey:`options.lyricRenderSection`},Sm=[pm(`sparkAmount`,`options.hanabiSparkAmount`,0,2),pm(`glow`,`options.hanabiGlow`,0,2),pm(`chorusBloom`,`options.hanabiChorusBloom`,0,2,{noteKey:`options.hanabiChorusBloomHint`}),pm(`bloom`,`options.hanabiBloom`,0,2,{noteKey:`options.hanabiBloomHint`}),mm(`launches`,`options.hanabiLaunches`,`options.hanabiLaunchesHint`)],Cm=[pm(`sky`,`options.hanabiSky`,0,1,{step:.01,noteKey:`options.hanabiSkyHint`}),pm(`riseSpeed`,`options.hanabiRiseSpeed`,0,2,{noteKey:`options.hanabiRiseSpeedHint`}),pm(`spin`,`options.hanabiSpin`,0,2,{noteKey:`options.hanabiSpinHint`}),pm(`ambient`,`options.hanabiAmbient`,0,2),mm(`overlayFrame`,`options.hanabiOverlayFrame`)],wm=[mm(`textOnly`,`options.hanabiTextOnly`,`options.hanabiTextOnlyHint`),pm(`textMotion`,`options.hanabiTextMotion`,0,2),pm(`blockOpacity`,`options.hanabiBlockOpacity`,0,1,{step:.01})],Tm=[pm(`collage`,`options.hanabiCollage`,0,2,{noteKey:`options.hanabiCollageHint`}),pm(`ornamentAmount`,`options.hanabiOrnamentAmount`,0,2)],Em=e=>e.toFixed(2),Dm=({t:e,tuning:t=et,onTuningChange:n,onSliderPointerDown:r,onSliderCommit:i})=>{let a=a=>a.kind===`slider`?(0,H.jsx)(B,{label:e(a.labelKey),note:a.noteKey&&e(a.noteKey),value:t[a.key],min:a.min,max:a.max,step:a.step??.05,format:Em,onChange:e=>n?.({[a.key]:e}),onDragStart:r,onDragEnd:i},a.key):(0,H.jsx)(Pt,{label:e(a.labelKey),note:a.noteKey&&e(a.noteKey),checked:t[a.key],onChange:e=>n?.({[a.key]:e})},a.key);return(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(z,{def:hm,children:Sm.map(a)}),(0,H.jsx)(z,{def:gm,children:Cm.map(a)}),(0,H.jsx)(z,{def:_m,children:wm.map(a)}),(0,H.jsx)(z,{def:vm,children:Tm.map(a)}),(0,H.jsx)(z,{def:ym,children:(0,H.jsx)(L,{label:e(`options.hanabiColorMode`),note:e(`options.hanabiColorModeHint`),children:(0,H.jsx)(Mt,{value:t.colorMode,options:[{value:`mixed`,label:e(`options.hanabiColorModeMixed`)},{value:`vivid`,label:e(`options.hanabiColorModeVivid`)},{value:`theme`,label:e(`options.hanabiColorModeTheme`)}],onChange:e=>n?.({colorMode:e})})})}),(0,H.jsx)(z,{def:bm,children:(0,H.jsx)(L,{label:e(`options.hanabiRenderQuality`),note:e(`options.hanabiRenderQualityHint`),children:(0,H.jsx)(Mt,{value:t.renderQuality,options:[{value:`full`,label:e(`options.hanabiRenderQualityFull`)},{value:`balanced`,label:e(`options.hanabiRenderQualityBalanced`)},{value:`low`,label:e(`options.hanabiRenderQualityLow`)}],onChange:e=>n?.({renderQuality:e})})})}),(0,H.jsx)(z,{def:xm,children:(0,H.jsx)(_f,{value:t.render,onChange:e=>n?.({render:{...t.render,...e}})})})]})},Om=e({default:()=>km}),km=pe({mode:`hanabi`,defaults:et,modKeys:{colorMode:we([`theme`,`vivid`,`mixed`]),sparkAmount:_e(0,2),ornamentAmount:_e(0,2),textMotion:_e(0,2),blockOpacity:_e(0,1),riseSpeed:_e(0,2),spin:_e(0,2),ambient:_e(0,2),glow:_e(0,2),bloom:_e(0,2),chorusBloom:_e(0,2),launches:nt,overlayFrame:nt,textOnly:nt,sky:_e(0,1),collage:_e(0,2)},settingsKey:`hanabiTuning`,settingsSetterKey:`handleSetHanabiTuning`,settingsResetterKey:`handleResetHanabiTuning`,storage:{key:`hanabi_tuning`,read:me,merge:(e,t)=>me({...e,...t}),resetNotice:`notifications.hanabiReset`}}),Am=e({default:()=>Mm}),jm=V.lazy(()=>u(()=>import(`./VisualizerHanabi-DgsbY5xE.js`).then(e=>e.t),__vite__mapDeps([7,1]),import.meta.url)),Mm=mp({mode:`hanabi`,order:26,labelKey:`ui.visualizerHanabi`,labelFallback:`花火`,previewSeed:`hanabi`,previewStartOffset:0,glyph:(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(`path`,{d:`M12 21v-8`,opacity:`0.5`}),(0,H.jsx)(`path`,{d:`M12 9V4M12 9l3.5-3.5M12 9l-3.5-3.5M12 9h5M12 9H7M12 9l3.5 3.5M12 9l-3.5 3.5`})]}),command:{title:`Visualizer: Hanabi`,description:`Switch to Hanabi visualizer`,keywords:[`hanabi`,`花火`,`烟花`,`fireworks`,`lyric pv`,`anime pv`]},beatEffects:[{id:kt.hanabiBeatBursts,nameKey:`options.beatEffect_hanabiBeatBursts`,descKey:`options.beatEffect_hanabiBeatBurstsDesc`,source:`beats`},{id:kt.hanabiBeatPulse,nameKey:`options.beatEffect_hanabiBeatPulse`,descKey:`options.beatEffect_hanabiBeatPulseDesc`,source:`beats`}],render:e=>(0,H.jsx)(jm,{...e,hanabiTuning:km.read(e.visualizerTunings)}),renderSettingsPanel:e=>(0,H.jsx)(Dm,{...e}),renderQuickControls:({tuning:e,onTuningChange:t,t:n})=>(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(gr,{active:e.overlayFrame,label:n(`options.hanabiOverlayFrame`),onToggle:()=>t({overlayFrame:!e.overlayFrame}),children:(0,H.jsx)(h,{size:14})}),(0,H.jsx)(gr,{active:e.collage>0,label:n(`options.hanabiCollage`),onToggle:()=>t({collage:e.collage>0?0:1}),children:(0,H.jsx)(p,{size:14})})]}),ownFontSizeNoticeKey:`options.hanabiFontSizeAutoNotice`}),Nm=({title:e,children:t})=>(0,H.jsxs)(`section`,{className:`space-y-4 border-t border-white/10 pt-4`,children:[(0,H.jsx)(`h3`,{className:`text-xs font-medium uppercase tracking-[0.24em] opacity-45`,style:{color:`var(--text-secondary)`},children:e}),t]}),Pm=e=>`${e.toFixed(2)}x`,Fm=({label:e,value:t,rangeInputClass:n,onChange:r,onPointerDown:i,onPointerUp:a,onPointerCancel:o,min:s=0,max:c=2,step:l=.05,formatValue:u=Pm})=>(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3 text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e}),(0,H.jsx)(`span`,{className:`shrink-0 font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:u(t)})]}),(0,H.jsx)(`input`,{type:`range`,min:s,max:c,step:l,value:t,onChange:e=>r(Number(e.target.value)),onPointerDown:i,onPointerUp:a,onPointerCancel:o??a,className:n})]}),Im=(e,t,n,r,i={})=>({kind:`slider`,key:e,labelKey:t,min:n,max:r,...i}),Lm=(e,t)=>({kind:`toggle`,key:e,labelKey:t}),Rm=[Im(`lightIntensity`,`options.lumiereLightIntensity`,.3,2),Im(`audioResponse`,`options.lumiereAudioResponse`,0,2),Im(`bloom`,`options.lumiereBloom`,0,2),Im(`textBloom`,`options.lumiereTextBloom`,0,2)],zm=[Im(`darkField`,`options.lumiereDarkField`,0,1,{step:.01}),Im(`fogDensity`,`options.lumiereFogDensity`,0,2),Im(`fogOctaves`,`options.lumiereFogOctaves`,2,6,{step:1,integer:!0}),Im(`moteAmount`,`options.lumiereMoteAmount`,0,2),Lm(`frontBokeh`,`options.lumiereFrontBokeh`),Lm(`lineArt`,`options.lumiereLineArt`),Lm(`overlayFrame`,`options.lumiereOverlayFrame`)],Bm=[Lm(`textOnly`,`options.lumiereTextOnly`),Im(`unlitOpacity`,`options.lumiereUnlitOpacity`,.05,.6,{step:.01})],Vm=[Im(`decay`,`options.lumiereDecay`,0,2),Im(`echo`,`options.lumiereEcho`,0,2),Lm(`trails`,`options.lumiereTrails`),Lm(`hideTrails`,`options.lumiereHideTrails`),Lm(`seamlessTransitions`,`options.lumiereSeamlessTransitions`)],Hm=[Im(`themeColorMix`,`options.lumiereThemeColorMix`,0,1,{step:.01}),Lm(`keywordColors`,`options.lumiereKeywordColors`),Lm(`themeIcons`,`options.lumiereThemeIcons`)],Um=e=>e.toFixed(2),Wm=e=>String(Math.round(e)),Gm=({t:e,isDaylight:t,theme:n,rangeInputClass:r,controlCardBg:i,lumiereTuning:a=ct,onLumiereTuningChange:o,onSliderPointerDown:s,onSliderCommit:c})=>{let l=(0,V.useMemo)(()=>[{value:!0,label:e(`options.lumiereToggleOn`)},{value:!1,label:e(`options.lumiereToggleOff`)}],[e]),u=(0,V.useMemo)(()=>[{value:1,label:e(`options.lumiereWindowNeighborsPrev`)},{value:2,label:e(`options.lumiereWindowNeighborsBoth`)}],[e]),d=(0,V.useMemo)(()=>[{value:`full`,label:e(`options.lumiereRenderQualityFull`)},{value:`balanced`,label:e(`options.lumiereRenderQualityBalanced`)},{value:`low`,label:e(`options.lumiereRenderQualityLow`)}],[e]),f=i=>i.kind===`slider`?(0,H.jsx)(Fm,{label:e(i.labelKey),value:a[i.key],min:i.min,max:i.max,step:i.step??.05,formatValue:i.integer?Wm:Um,rangeInputClass:r,onChange:e=>o?.({[i.key]:e}),onPointerDown:s,onPointerUp:c},i.key):(0,H.jsx)(jp,{label:e(i.labelKey),value:a[i.key],options:l,onChange:e=>o?.({[i.key]:e}),isDaylight:t,theme:n},i.key),p=t=>(0,H.jsx)(`p`,{className:`text-xs leading-relaxed opacity-55`,style:{color:`var(--text-secondary)`},children:e(t)});return(0,H.jsxs)(`div`,{className:`rounded-[24px] border border-white/10 p-4 space-y-4`,style:{backgroundColor:i},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.lumiereSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-50`,style:{color:`var(--text-secondary)`},children:e(`options.lumiereSettingsDesc`)})]}),(0,H.jsxs)(Nm,{title:e(`options.lumiereLightSection`),children:[Rm.map(f),p(`options.lumiereAudioResponseHint`)]}),(0,H.jsxs)(Nm,{title:e(`options.lumiereAtmosphereSection`),children:[zm.map(f),p(`options.lumiereDarkFieldHint`)]}),(0,H.jsxs)(Nm,{title:e(`options.lumiereTextSection`),children:[Bm.map(f),(0,H.jsx)(jp,{label:e(`options.lumiereWindowNeighbors`),value:a.windowNeighbors,options:u,onChange:e=>o?.({windowNeighbors:e}),isDaylight:t,theme:n}),Vm.map(f),p(`options.lumiereTextOnlyHint`),p(`options.lumiereEchoHint`),p(`options.lumiereHideTrailsHint`),p(`options.lumiereSeamlessTransitionsHint`)]}),(0,H.jsxs)(Nm,{title:e(`options.lumiereThemeSection`),children:[Hm.map(f),p(`options.lumiereThemeColorMixHint`)]}),(0,H.jsxs)(Nm,{title:e(`options.lumierePerformanceSection`),children:[(0,H.jsx)(jp,{label:e(`options.lumiereRenderQuality`),value:a.renderQuality,options:d,onChange:e=>o?.({renderQuality:e}),isDaylight:t,theme:n}),p(`options.lumiereRenderQualityHint`)]})]})},Km=e({default:()=>Jm}),qm=V.lazy(()=>u(()=>import(`./VisualizerLumiere-D0Z4Bf5Y.js`).then(e=>e.t),__vite__mapDeps([8,1]),import.meta.url)),Jm=mp({mode:`lumiere`,order:25,labelKey:`ui.visualizerLumiere`,labelFallback:`绘光`,previewSeed:`lumiere`,previewStartOffset:0,tuningKind:`lumiere`,usesWordSegmentation:!0,render:e=>(0,H.jsx)(qm,{...e}),renderSettingsPanel:e=>(0,H.jsx)(Gm,{...e}),resetSettings:({resetLumiereTuning:e,setDraftLumiereTuning:t})=>{t?.(ct),e?.()}}),Ym={id:`vis-machi-scene`,titleKey:`options.machiSceneSection`},Xm={id:`vis-machi-sky`,titleKey:`options.machiSkySection`},Zm={id:`vis-machi-camera`,titleKey:`options.machiCameraSection`},Qm={id:`vis-machi-dof`,titleKey:`options.machiDofSection`},$m={id:`vis-machi-quality`,titleKey:`options.machiQualitySection`},eh={high:`options.machiQualityHigh`,balanced:`options.machiQualityBalanced`,low:`options.machiQualityLow`},th={off:`options.machiAntialiasOff`,fxaa:`options.machiAntialiasFxaa`,smaa:`options.machiAntialiasSmaa`,ssaa:`options.machiAntialiasSsaa`},nh={off:`options.machiLevelOff`,low:`options.machiLevelLow`,high:`options.machiLevelHigh`},rh=[`auto`,...Re],ih={auto:`options.machiSceneAuto`,konbini:`options.machiSceneKonbini`,station:`options.machiSceneStation`,kowloon:`options.machiSceneKowloon`},ah={auto:`options.machiTimeAuto`,day:`options.machiTimeDay`,dusk:`options.machiTimeDusk`,night:`options.machiTimeNight`},oh={auto:`options.machiWeatherAuto`,clear:`options.machiWeatherClear`,rain:`options.machiWeatherRain`,snow:`options.machiWeatherSnow`,fog:`options.machiWeatherFog`},sh={auto:(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(`path`,{d:`M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22`}),(0,H.jsx)(`path`,{d:`m18 2 4 4-4 4`}),(0,H.jsx)(`path`,{d:`M2 6h1.9c1.5 0 2.9.9 3.6 2.2`,opacity:`0.6`}),(0,H.jsx)(`path`,{d:`M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8`,opacity:`0.6`}),(0,H.jsx)(`path`,{d:`m18 14 4 4-4 4`})]}),konbini:(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(`path`,{d:`M4 20V11h13v9`}),(0,H.jsx)(`path`,{d:`M7 11V7.5h7V11`,opacity:`0.6`}),(0,H.jsx)(`path`,{d:`M9.5 20v-4.5h3V20`,opacity:`0.6`}),(0,H.jsx)(`path`,{d:`M3 20h18`})]}),station:(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(`path`,{d:`M3 8h13`}),(0,H.jsx)(`path`,{d:`M5 8v12M14 8v12`,opacity:`0.6`}),(0,H.jsx)(`path`,{d:`M8 20v-6h3v6`}),(0,H.jsx)(`path`,{d:`M15 20v-3.5l1.5-2h4.5v5.5`,opacity:`0.7`}),(0,H.jsx)(`path`,{d:`M3 20h19`})]}),kowloon:(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(`path`,{d:`M3 20V9h5v11M8 20V5h6v15M14 20v-8h6v8`}),(0,H.jsx)(`path`,{d:`M11 5V2.5M9.5 3.5h3`,opacity:`0.6`}),(0,H.jsx)(`path`,{d:`M14 7h1M15 6h2.5v4.5H15z`,opacity:`0.7`}),(0,H.jsx)(`path`,{d:`M3 20h18`})]})},ch=e=>(0,H.jsx)(`span`,{className:`absolute inset-0 flex items-center justify-center text-[color:var(--st-t2)]`,children:(0,H.jsx)(`svg`,{viewBox:`0 0 24 24`,width:`44`,height:`44`,fill:`none`,stroke:`currentColor`,strokeWidth:`1.6`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:sh[e]})}),lh=({t:e,tuning:t=ge,onTuningChange:n,onSliderPointerDown:r,onSliderCommit:i})=>{let a=t.camera===`custom`,o=V.useSyncExternalStore(pf,mf,mf),[s,l]=V.useState(null),u=t.scene===`auto`?s??o??Re[0]:t.scene,d=t.views[u],f=e=>n?.({views:{...t.views,[u]:e}}),p=t.quality,m=Ne(p),h=e=>n?.({quality:{...p,...e}}),g=Te.map(t=>({value:t,label:e(nh[t])})),_=Le(e=>e.lyricRenderQuality),v=V.useSyncExternalStore(of,sf,sf),y=e(`options.lyricRenderFollowGlobal`),{t:b}=c();return(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(z,{def:Ym,children:(0,H.jsx)(L,{note:e(`options.machiSceneHint`),below:(0,H.jsx)(jt,{className:`-mx-4`,columns:3,label:e(`options.machiScene`),value:t.scene,options:rh.map(t=>({value:t,label:e(ih[t])})),picture:ch,onChange:e=>n?.({scene:e})})})}),(0,H.jsxs)(z,{def:Xm,children:[(0,H.jsx)(L,{label:e(`options.machiTimeOfDay`),note:e(`options.machiTimeOfDayHint`),children:(0,H.jsx)(Mt,{value:t.timeOfDay,options:ke.map(t=>({value:t,label:e(ah[t])})),onChange:e=>n?.({timeOfDay:e})})}),(0,H.jsx)(L,{label:e(`options.machiWeather`),note:e(`options.machiWeatherHint`),children:(0,H.jsx)(Mt,{value:t.weather,options:Ye.map(t=>({value:t,label:e(oh[t])})),onChange:e=>n?.({weather:e})})})]}),(0,H.jsxs)(z,{def:Zm,action:a?(0,H.jsx)(Nt,{variant:`quiet`,onClick:()=>f(ye),children:e(`options.machiViewReset`)}):void 0,children:[(0,H.jsx)(L,{label:e(`options.machiCameraMode`),note:e(`options.machiCameraModeHint`),children:(0,H.jsx)(Mt,{value:t.camera,options:Ee.map(t=>({value:t,label:e(Gd[t])})),onChange:e=>n?.({camera:e})})}),a&&t.scene===`auto`&&(0,H.jsx)(L,{label:e(`options.machiViewScene`),note:e(`options.machiViewSceneHint`),children:(0,H.jsx)(Mt,{value:u,options:Re.map(t=>({value:t,label:e(ih[t])})),onChange:l})}),a&&Jd.map(t=>(0,H.jsx)(B,{label:e(t.labelKey),value:d[t.key],min:We[t.key].min,max:We[t.key].max,step:t.step,format:t.format,onChange:e=>f({...d,[t.key]:e}),onDragStart:r,onDragEnd:i},t.key)),(0,H.jsx)(Pt,{label:e(`options.machiCameraMotion`),note:e(`options.machiCameraMotionHint`),checked:t.motion,onChange:e=>n?.({motion:e})}),(0,H.jsx)(B,{label:e(`options.machiCameraMotionSpeed`),value:t.motionSpeed,min:Me.min,max:Me.max,step:.05,format:R,disabled:!t.motion,onChange:e=>n?.({motionSpeed:e}),onDragStart:r,onDragEnd:i})]}),(0,H.jsxs)(z,{def:Qm,children:[(0,H.jsx)(B,{label:e(`options.machiAperture`),note:e(`options.machiApertureHint`),value:Zd(t.aperture),min:0,max:Xd,step:1,format:e=>$d(Qd(e)),disabled:t.dof===0,onChange:e=>n?.({aperture:Qd(e)}),onDragStart:r,onDragEnd:i}),(0,H.jsx)(B,{label:e(`options.machiDof`),note:e(`options.machiDofHint`),value:t.dof,min:De.dof.min,max:De.dof.max,step:.05,format:Ft,onChange:e=>n?.({dof:e}),onDragStart:r,onDragEnd:i}),(0,H.jsx)(B,{label:e(`options.machiDofRange`),value:t.dofRange,min:De.dofRange.min,max:De.dofRange.max,step:.05,format:R,disabled:t.dof===0,onChange:e=>n?.({dofRange:e}),onDragStart:r,onDragEnd:i}),(0,H.jsx)(B,{label:e(`options.machiTiltShift`),note:e(`options.machiTiltShiftHint`),value:t.tiltShift,min:De.tiltShift.min,max:De.tiltShift.max,step:.05,format:Ft,onChange:e=>n?.({tiltShift:e}),onDragStart:r,onDragEnd:i}),(0,H.jsx)(L,{label:e(`options.machiFocus`),note:e(`options.machiFocusHint`),children:(0,H.jsx)(Mt,{value:t.focus,options:Se.map(t=>({value:t,label:e(Kd[t])})),onChange:e=>n?.({focus:e})})}),t.focus===`manual`&&(0,H.jsx)(B,{label:e(`options.machiFocusOffset`),value:t.focusOffset,min:De.focusOffset.min,max:De.focusOffset.max,step:.1,format:qd(` m`,1),onChange:e=>n?.({focusOffset:e}),onDragStart:r,onDragEnd:i})]}),(0,H.jsxs)(z,{def:$m,children:[(0,H.jsx)(L,{label:e(`options.machiQuality`),note:e(`options.machiQualityHint`),children:(0,H.jsx)(Mt,{value:m,options:[...Ue.map(t=>({value:t,label:e(eh[t])})),...m===`custom`?[{value:`custom`,label:e(`options.machiQualityCustom`)}]:[]],onChange:e=>{e!==`custom`&&h(Xe[e])}})}),(0,H.jsx)(L,{label:e(`options.machiRenderScale`),note:b(`options.machiRenderScaleHint`,{value:ce(_.scale)}),children:(0,H.jsx)(At,{value:String(p.renderScale),options:[{value:fe,label:y},...qe.map(e=>({value:String(e),label:`${Math.round(e*100)}%`}))],onChange:e=>h({renderScale:e===`global`?fe:qe.find(t=>String(t)===e)??p.renderScale})})}),(0,H.jsx)(L,{label:e(`options.machiAntialias`),note:b(`options.machiAntialiasHint`,{value:e(hf[_.antialias])}),children:(0,H.jsx)(At,{value:p.antialias,options:[{value:fe,label:y},...Ke.map(t=>({value:t,label:e(th[t])}))],onChange:e=>h({antialias:e})})}),(0,H.jsx)(L,{label:e(`options.machiShadows`),note:e(`options.machiShadowsHint`),children:(0,H.jsx)(Mt,{value:p.shadows,options:g,onChange:e=>h({shadows:e})})}),(0,H.jsx)(L,{label:e(`options.machiReflections`),note:e(`options.machiReflectionsHint`),children:(0,H.jsx)(Mt,{value:p.reflections,options:g,onChange:e=>h({reflections:e})})}),(0,H.jsx)(Pt,{label:e(`options.machiGlow`),note:e(`options.machiGlowHint`),checked:p.glow,onChange:e=>h({glow:e})}),(0,H.jsx)(Pt,{label:e(`options.machiAdaptive`),note:p.adaptive&&v>0?`${e(`options.machiAdaptiveHint`)} ${b(`options.machiAdaptiveActive`,{count:v})}`:e(`options.machiAdaptiveHint`),checked:p.adaptive,onChange:e=>h({adaptive:e})})]})]})},uh=e({default:()=>dh}),dh=pe({mode:`machi`,defaults:ge,modKeys:{scene:we([`auto`,...Re]),timeOfDay:we(ke),weather:we(Ye),camera:we(Ee),motion:nt,motionSpeed:_e(Me.min,Me.max),aperture:_e(De.aperture.min,De.aperture.max),dof:_e(De.dof.min,De.dof.max),dofRange:_e(De.dofRange.min,De.dofRange.max),tiltShift:_e(De.tiltShift.min,De.tiltShift.max),focus:we(Se),focusOffset:_e(De.focusOffset.min,De.focusOffset.max)},settingsKey:`machiTuning`,settingsSetterKey:`handleSetMachiTuning`,settingsResetterKey:`handleResetMachiTuning`,storage:{key:`machi_tuning`,read:Ze,merge:(e,t)=>Ze({...e,...t}),resetNotice:`notifications.machiReset`}}),fh=e({default:()=>hh}),ph=V.lazy(()=>u(()=>import(`./VisualizerMachi-BI6R5ck3.js`),__vite__mapDeps([9,1,10]),import.meta.url)),mh=({label:e,onClosePanel:t})=>{let n=(0,V.useSyncExternalStore)(Wd,Ud,Ud);return(0,H.jsx)(gr,{active:n,label:e,onToggle:()=>{Hd(),n||t?.()},children:(0,H.jsx)(b,{size:14})})},hh=mp({mode:`machi`,order:27,labelKey:`ui.visualizerMachi`,labelFallback:`町景`,previewSeed:`machi`,previewStartOffset:0,glyph:(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(`path`,{d:`M4 20V11h11v9`}),(0,H.jsx)(`path`,{d:`M6.5 11V8.5h6V11`,opacity:`0.6`}),(0,H.jsx)(`path`,{d:`M9 20v-4.5h3V20`,opacity:`0.6`}),(0,H.jsx)(`path`,{d:`M18 4l-1.2 3M21 6l-1.2 3M18.5 11l-1.2 3`,opacity:`0.5`})]}),command:{title:`Visualizer: Machi`,description:`Switch to the Machi town dioramas`,keywords:[`machi`,`konbini`,`convenience store`,`town`,`street corner`,`diorama 3d`,`rain`,`町景`,`便利店`,`街角`,`雨夜`]},background:!1,beatEffects:[{id:kt.machiNeonPulse,nameKey:`options.beatEffect_machiNeonPulse`,descKey:`options.beatEffect_machiNeonPulseDesc`,source:`beats`},{id:kt.machiDrumRipple,nameKey:`options.beatEffect_machiDrumRipple`,descKey:`options.beatEffect_machiDrumRippleDesc`,source:`drums`},{id:kt.machiScreenFlash,nameKey:`options.beatEffect_machiScreenFlash`,descKey:`options.beatEffect_machiScreenFlashDesc`,source:`drums`}],render:e=>(0,H.jsx)(ph,{...e,machiTuning:dh.read(e.visualizerTunings)}),renderSettingsPanel:e=>(0,H.jsx)(lh,{...e}),renderQuickControls:({tuning:e,onTuningChange:t,onClosePanel:n,t:r})=>{let i=r(ih[e.scene]),a=r(ah[e.timeOfDay]),o=r(oh[e.weather]),s=r(Gd[e.camera]);return(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(hr,{label:i,title:`${r(`options.machiScene`)}: ${i}`,onClick:()=>t({scene:_r(rh,e.scene)})}),(0,H.jsx)(hr,{label:a,title:`${r(`options.machiTimeOfDay`)}: ${a}`,onClick:()=>t({timeOfDay:_r(ke,e.timeOfDay)})}),(0,H.jsx)(hr,{label:o,title:`${r(`options.machiWeather`)}: ${o}`,onClick:()=>t({weather:_r(Ye,e.weather)})}),(0,H.jsx)(hr,{label:s,title:`${r(`options.machiCameraMode`)}: ${s}`,onClick:()=>t({camera:_r(Ee,e.camera)})}),(0,H.jsx)(gr,{active:e.motion,label:r(`options.machiCameraMotion`),onToggle:()=>t({motion:!e.motion}),children:(0,H.jsx)(y,{size:14})}),(0,H.jsx)(mh,{label:r(`options.machiCameraBar`),onClosePanel:n})]})},ownFontSizeNoticeKey:`options.machiFontSizeAutoNotice`}),gh=e({default:()=>yh}),_h=V.lazy(()=>u(()=>import(`./VisualizerMetaphor-DLu5ncmE.js`),__vite__mapDeps([11,1]),import.meta.url)),vh=V.lazy(()=>u(()=>import(`./MetaphorSettingsPanel-D9sIY32_.js`),__vite__mapDeps([12,10]),import.meta.url)),yh=mp({mode:`metaphor`,order:29.5,labelKey:`ui.visualizerMetaphor`,labelFallback:`隐喻`,previewSeed:`metaphor`,previewStartOffset:0,glyph:(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(`path`,{d:`M4.5 10.5a4 4 0 0 1 7.2-2.4c.9 1.1 1.9 1.1 2.8.3a3 3 0 1 1 1.2 5c-1.6-.5-2.7.2-3.4 1.4A4 4 0 0 1 4.5 10.5z`}),(0,H.jsx)(`circle`,{cx:`19.5`,cy:`6`,r:`1`,opacity:`0.6`}),(0,H.jsx)(`path`,{d:`M5 20h.01M9 20h.01M13 20h.01M17 20h.01`,opacity:`0.5`})]}),command:{title:`Visualizer: Metaphor`,description:`Switch to the Metaphor ink, halftone and hard-cut visualizer`,keywords:[`metaphor`,`metaball`,`halftone`,`grain`,`fluid ink`,`experimental`,`hard cut`,`隐喻`,`融球`,`半调`,`颗粒`,`实验`,`硬切`]},background:!1,usesWordSegmentation:!0,beatEffects:[{id:kt.metaphorAnnihilation,nameKey:`options.beatEffect_metaphorAnnihilation`,descKey:`options.beatEffect_metaphorAnnihilationDesc`,source:`beats`}],render:e=>(0,H.jsx)(_h,{...e,metaphorTuning:be.read(e.visualizerTunings)}),renderSettingsPanel:e=>(0,H.jsx)(V.Suspense,{fallback:null,children:(0,H.jsx)(vh,{...e})}),renderQuickControls:({tuning:e,onTuningChange:t,t:n})=>(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(gr,{active:e.flip,label:n(`options.metaphorFlip`),onToggle:()=>t({flip:!e.flip}),children:(0,H.jsx)(d,{size:14})}),(0,H.jsx)(gr,{active:e.transitions,label:n(`options.metaphorTransitions`),onToggle:()=>t({transitions:!e.transitions}),children:(0,H.jsx)(C,{size:14})})]}),ownFontSizeNoticeKey:`options.metaphorFontSizeAutoNotice`}),bh=(e,t,n,r)=>Number.isFinite(e)?Math.min(n,Math.max(t,e)):r,xh=({children:e,theme:t})=>(0,H.jsx)(`div`,{className:`text-xs font-medium uppercase tracking-[0.24em] opacity-45`,style:{color:t.secondaryColor},children:e}),Sh=({label:e,value:t,options:n,onChange:r,isDaylight:i,theme:a})=>(0,H.jsxs)(`div`,{className:`space-y-2.5`,children:[(0,H.jsx)(xh,{theme:a,children:e}),(0,H.jsx)(`div`,{className:`flex flex-wrap gap-2`,children:n.map(e=>{let n=e.value===t;return(0,H.jsx)(`button`,{type:`button`,onClick:()=>{e.disabled||r(e.value)},disabled:e.disabled,className:`rounded-full border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45`,style:{color:e.disabled?P(a.secondaryColor,.72):a.primaryColor,borderColor:n?a.accentColor:P(a.secondaryColor,i?.18:.14),backgroundColor:n?P(a.accentColor,i?.1:.16):P(a.backgroundColor,i?.24:.34),boxShadow:n?`inset 0 0 0 1px ${a.accentColor}`:`none`},children:e.label},String(e.value))})})]}),Ch=({label:e,valueLabel:t,value:n,min:r,max:i,step:a,onChange:o,rangeInputClass:s,onSliderPointerDown:c,onSliderCommit:l})=>(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3 text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e}),(0,H.jsx)(`span`,{className:`font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:t})]}),(0,H.jsx)(`input`,{type:`range`,min:r,max:i,step:a,value:n,onChange:e=>o(parseFloat(e.target.value)),onPointerDown:c,onPointerUp:l,onPointerCancel:l,onBlur:l,className:s})]}),wh=({t:e,isDaylight:t,theme:r,controlCardBg:i,rangeInputClass:a,monetTuning:o=xt,onMonetTuningChange:s,monetPortraitImage:c,onUploadMonetPortraitImage:l,onClearMonetPortraitImage:u,isLoadingMonetPortraitImage:d=!1,onSliderPointerDown:f,onSliderCommit:p})=>{let m=(0,V.useRef)(null),[h,g]=(0,V.useState)(null),_={keywordColoringEnabled:o.keywordColoringEnabled??xt.keywordColoringEnabled,descriptionVisibility:he(o.descriptionVisibility,o.showDescription),showAudioVisualization:o.showAudioVisualization??xt.showAudioVisualization,audioStyle:o.audioStyle??xt.audioStyle,fontScale:bh(o.fontScale??xt.fontScale,.7,1.5,xt.fontScale),portraitSource:o.portraitSource??xt.portraitSource,portraitStyle:o.portraitStyle??xt.portraitStyle??`rectangular`,portraitHangerVisibility:he(o.portraitHangerVisibility,o.showPortraitDragHanger)},v=(0,V.useMemo)(()=>[{value:!0,label:e(`options.monetKeywordColoringOn`)},{value:!1,label:e(`options.monetKeywordColoringOff`)}],[e]),y=(0,V.useMemo)(()=>it.map(t=>({value:t,label:e(`options.monetVisibility_${t}`)})),[e]),b=(0,V.useMemo)(()=>[{value:`cover`,label:e(`options.monetPortraitSourceCover`)},{value:`custom`,label:e(`options.monetPortraitSourceCustom`),disabled:!c&&!d},{value:`none`,label:e(`options.monetPortraitSourceNone`)}],[d,c,e]),x=(0,V.useMemo)(()=>[{value:`bar`,label:e(`options.monetAudioStyleBar`)},{value:`line`,label:e(`options.monetAudioStyleLine`)}],[e]),C=(0,V.useMemo)(()=>[{value:!0,label:e(`options.monetAudioVisualizationShow`)},{value:!1,label:e(`options.monetAudioVisualizationHide`)}],[e]),w=(0,V.useMemo)(()=>[{value:`rectangular`,label:e(`options.monetPortraitStyleRectangular`)},{value:`square`,label:e(`options.monetPortraitStyleSquare`)}],[e]),T=async t=>{let n=Array.from(t.target.files??[]);if(t.target.value=``,g(null),!n.length||!l)return;let r=await l(n);r.ok?(s?.({portraitSource:`custom`}),g(n[0].name)):g(r.error||e(`options.monetUploadPortrait`))};return(0,H.jsxs)(`div`,{className:`space-y-4 rounded-[24px] border border-white/10 p-4`,style:{backgroundColor:i},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.monetSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-50`,style:{color:`var(--text-secondary)`},children:e(`options.monetSettingsDesc`)})]}),(0,H.jsxs)(`div`,{className:`space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5`,children:[(0,H.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wider opacity-65`,style:{color:r.accentColor},children:e(`options.lyricsStyleSettings`)}),(0,H.jsx)(Ch,{label:e(`options.monetFontScale`),valueLabel:`${_.fontScale.toFixed(2)}x`,min:.7,max:1.5,step:.05,value:_.fontScale,onChange:e=>s?.({fontScale:e}),rangeInputClass:a,onSliderPointerDown:f,onSliderCommit:p}),(0,H.jsx)(Sh,{label:e(`options.monetKeywordColoring`),value:_.keywordColoringEnabled,options:v,onChange:e=>s?.({keywordColoringEnabled:e}),isDaylight:t,theme:r}),(0,H.jsx)(Sh,{label:e(`options.monetShowDescription`),value:_.descriptionVisibility,options:y,onChange:e=>s?.({descriptionVisibility:e,showDescription:e!==`hidden`}),isDaylight:t,theme:r}),(0,H.jsxs)(`label`,{className:`local-setting`,children:[(0,H.jsx)(`span`,{children:e(`options.monetCustomDescription`)}),(0,H.jsx)(`input`,{type:`text`,"data-testid":`monet-custom-description`,maxLength:120,value:o.customDescription??``,onChange:e=>s?.({customDescription:e.target.value})})]}),(0,H.jsxs)(`label`,{className:`local-setting local-toggle-setting`,children:[(0,H.jsx)(`span`,{children:e(`options.monetMirrorLayout`)}),(0,H.jsx)(`input`,{type:`checkbox`,"data-testid":`monet-mirror-layout`,checked:o.mirrorLayout===!0,onChange:e=>s?.({mirrorLayout:e.target.checked})})]})]}),(0,H.jsxs)(`div`,{className:`space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5`,children:[(0,H.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wider opacity-65`,style:{color:r.accentColor},children:e(`options.cappellaAvatarSource`)}),(0,H.jsx)(Sh,{label:e(`options.monetPortraitSource`),value:_.portraitSource,options:b,onChange:e=>s?.({portraitSource:e}),isDaylight:t,theme:r}),(0,H.jsx)(Sh,{label:e(`options.monetPortraitStyle`),value:_.portraitStyle,options:w,onChange:e=>s?.({portraitStyle:e}),isDaylight:t,theme:r}),(0,H.jsx)(Sh,{label:e(`options.monetPortraitDragHanger`),value:_.portraitHangerVisibility,options:y,onChange:e=>s?.({portraitHangerVisibility:e,showPortraitDragHanger:e!==`hidden`}),isDaylight:t,theme:r}),(0,H.jsxs)(`div`,{className:`space-y-2.5`,children:[(0,H.jsx)(xh,{theme:r,children:e(`options.monetUploadPortrait`)}),(0,H.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2`,children:[(0,H.jsxs)(`button`,{type:`button`,onClick:()=>m.current?.click(),disabled:d||!l,className:`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45`,style:{color:r.primaryColor,borderColor:P(r.secondaryColor,t?.18:.14),backgroundColor:P(r.backgroundColor,t?.24:.34)},children:[(0,H.jsx)(S,{size:15}),(0,H.jsx)(`span`,{children:e(`options.monetUploadPortrait`)})]}),(0,H.jsxs)(`button`,{type:`button`,onClick:()=>void u?.(),disabled:!c||!u,className:`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45`,style:{color:r.primaryColor,borderColor:P(r.secondaryColor,t?.18:.14),backgroundColor:P(r.backgroundColor,t?.24:.34)},children:[(0,H.jsx)(n,{size:15}),(0,H.jsx)(`span`,{children:e(`options.monetClearPortrait`)})]})]}),(0,H.jsx)(`div`,{className:`text-xs opacity-60`,style:{color:`var(--text-secondary)`},children:h||c?.name||`-`})]}),(0,H.jsx)(`input`,{ref:m,type:`file`,accept:`.png,.jpg,.jpeg,.gif,.webp,.svg,image/*`,className:`hidden`,onChange:e=>void T(e)})]}),(0,H.jsxs)(`div`,{className:`space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5`,children:[(0,H.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wider opacity-65`,style:{color:r.accentColor},children:e(`options.monetAudioStyle`)}),(0,H.jsx)(Sh,{label:e(`options.monetShowAudioVisualization`),value:_.showAudioVisualization,options:C,onChange:e=>s?.({showAudioVisualization:e}),isDaylight:t,theme:r}),(0,H.jsx)(Sh,{label:e(`options.monetAudioStyle`),value:_.audioStyle,options:x,onChange:e=>s?.({audioStyle:e}),isDaylight:t,theme:r})]})]})},Th=e({default:()=>Dh}),Eh=V.lazy(()=>u(()=>import(`./VisualizerMonet-ClN9oudy.js`),__vite__mapDeps([13,10,1]),import.meta.url)),Dh=mp({mode:`monet`,order:90,labelKey:`ui.visualizerMonet`,labelFallback:`Monet`,previewSeed:`monet`,previewStartOffset:0,tuningKind:`monet`,render:e=>{let t=e.monetTuning??xt,n=e.lyricsFontScale??1;return(0,H.jsx)(Eh,{...e,monetTuning:{...t,fontScale:t.fontScale*n}})},renderSettingsPanel:e=>(0,H.jsx)(wh,{...e}),resetSettings:({resetMonetTuning:e})=>{e?.()}}),Oh={write:`options.nebbiaAppearWrite`,fade:`options.nebbiaAppearFade`,breath:`options.nebbiaAppearBreath`},kh={fog:`options.nebbiaFadeFog`,fingers:`options.nebbiaFadeFingers`},Ah=Object.fromEntries(He.map(e=>[e,`options.nebbiaLayout_${e}`])),jh=e=>`${e.toFixed(1)}s`,Mh=e=>String(Math.round(e)),Nh={id:`vis-nebbia-writing`,titleKey:`options.nebbiaWriting`},Ph=[[`strokeWidth`,`options.nebbiaStrokeWidth`,.005,Ft],[`writeSpeed`,`options.nebbiaWriteSpeed`,.05,R],[`jitter`,`options.nebbiaJitter`,.05,R],[`warp`,`options.nebbiaWarp`,.05,R],[`doodle`,`options.nebbiaDoodle`,.05,Ft],[`mist`,`options.nebbiaMist`,.01,Ft],[`hold`,`options.nebbiaHold`,.1,jh],[`refog`,`options.nebbiaRefog`,.5,jh]],Fh={id:`vis-nebbia-window`,titleKey:`options.nebbiaWindow`},Ih=[[`busSpeed`,`options.nebbiaBusSpeed`,.05,R],[`neon`,`options.nebbiaNeon`,.05,R],[`bump`,`options.nebbiaBump`,.05,R],[`spot`,`options.nebbiaSpot`,.05,R],[`spotX`,`options.nebbiaSpotX`,.01,Ft]],Lh={id:`vis-nebbia-render`,titleKey:`options.lyricRenderSection`},Rh=[`bump`],zh=Ih.filter(([e])=>!Rh.includes(e)),Bh=[[`jellies`,`options.nebbiaJellies`,1,Mh],[`jellySize`,`options.nebbiaJellySize`,.05,R],[`bubbles`,`options.nebbiaBubbles`,.05,Ft]],Vh={id:`vis-nebbia-glass`,titleKey:`options.nebbiaGlass`},Hh={rain:[[`rainHit`,`options.nebbiaRainHit`,.05,R],[`rainBig`,`options.nebbiaRainBig`,.05,R]],dew:[[`dew`,`options.nebbiaDew`,.05,R],[`dewSize`,`options.nebbiaDewSize`,.05,R],[`dewGlint`,`options.nebbiaDewGlint`,.05,R]]},Uh={id:`vis-nebbia-appear`,titleKey:`options.nebbiaAppear`},Wh={id:`vis-nebbia-fade`,titleKey:`options.nebbiaFade`},Gh={id:`vis-nebbia-layouts`,titleKey:`options.nebbiaLayouts`},Kh={id:`vis-nebbia-scenery`,titleKey:`options.nebbiaScenery`},qh=(e,t,n,r)=>{let i=e.filter(e=>e===n?r:t.includes(e));return i.length?i:null},Jh=({t:e,tuning:t,onTuningChange:n,onSliderPointerDown:r,onSliderCommit:i})=>{let a=t??Ae,o={onDragStart:r,onDragEnd:i},s=a.behind===`aquarium`,c=s?`options.nebbiaAquaScenery`:`options.nebbiaScenery`,l=s?`options.nebbiaAquaRain`:`options.nebbiaRain`,u=t=>t.map(([t,r,i,s])=>(0,H.jsx)(B,{...o,label:e(r),value:a[t],min:Ie[t].min,max:Ie[t].max,step:i,format:s,onChange:e=>n({[t]:e})},t)),d=(t,r,i,a)=>t.map(o=>(0,H.jsx)(Pt,{label:e(i[o]),checked:r.includes(o),disabled:r.length===1&&r[0]===o,onChange:e=>{let i=qh(t,r,o,e);i&&n(a(i))}},o));return(0,H.jsxs)(H.Fragment,{children:[(0,H.jsxs)(z,{def:Nh,children:[u(Ph),(0,H.jsx)(Pt,{label:e(`options.nebbiaCredits`),note:e(`options.nebbiaCreditsHint`),checked:a.credits,onChange:e=>n({credits:e})})]}),(0,H.jsx)(z,{def:Uh,foot:e(`options.nebbiaAppearHint`),children:d(Ve,a.appear,Oh,e=>({appear:e}))}),(0,H.jsx)(z,{def:Wh,foot:e(`options.nebbiaFadeHint`),children:d(je,a.fade,kh,e=>({fade:e}))}),(0,H.jsx)(z,{def:Gh,foot:e(`options.nebbiaLayoutsHint`),children:d(He,a.layouts,Ah,e=>({layouts:e}))}),(0,H.jsx)(z,{def:Fh,children:u(s?zh:Ih)}),(0,H.jsxs)(z,{def:Vh,children:[(0,H.jsx)(L,{label:e(`options.nebbiaGlassStyle`),note:e(`options.nebbiaGlassHint`),children:(0,H.jsx)(Mt,{value:a.glass,options:Pe.map(t=>({value:t,label:e(`options.nebbiaGlass_${t}`)})),onChange:e=>n({glass:e})})}),u(Hh[a.glass])]}),(0,H.jsxs)(z,{def:Kh,foot:e(`${c}Hint`),children:[(0,H.jsx)(L,{label:e(`options.nebbiaBehind`),note:e(`options.nebbiaBehindHint`),children:(0,H.jsx)(Mt,{value:a.behind,options:Qe.map(t=>({value:t,label:e(`options.nebbiaBehind_${t}`)})),onChange:e=>n({behind:e,glass:Ge[e]??a.glass})})}),s&&u(Bh),Oe.map(t=>(0,H.jsx)(Pt,{disabled:a.behind===`backdrop`&&t!==`spot`,label:e(`${c}_${t}`),checked:a.scenery.includes(t),onChange:e=>n({scenery:Oe.filter(n=>n===t?e:a.scenery.includes(n))})},t)),(0,H.jsx)(L,{label:e(l),note:e(`${l}Hint`),children:(0,H.jsx)(Mt,{disabled:a.behind===`backdrop`||!s&&(!a.scenery.includes(`spot`)||a.spot<=0),value:a.rain,options:Fe.map(t=>({value:t,label:e(`${l}_${t}`)})),onChange:e=>n({rain:e})})})]}),(0,H.jsx)(z,{def:Lh,children:(0,H.jsx)(_f,{value:a.render,onChange:e=>n({render:{...a.render,...e}}),antialias:!1})})]})},Yh=e({default:()=>eg}),Xh=V.lazy(()=>u(()=>import(`./VisualizerNebbia-Dq0NqqLZ.js`),__vite__mapDeps([14,1]),import.meta.url)),Zh=[{appear:[`write`,`fade`],labelKey:`options.nebbiaAppearAuto`},{appear:[`write`],labelKey:Oh.write},{appear:[`fade`],labelKey:Oh.fade},{appear:[`fade`,`breath`],labelKey:Oh.breath}],Qh=[{fade:[`fog`],labelKey:kh.fog},{fade:[`fingers`],labelKey:kh.fingers},{fade:[`fog`,`fingers`],labelKey:`options.nebbiaFadeMix`}],$h=(e,t,n)=>e.findIndex((e,r)=>t(r).join()===n.join()),eg=mp({mode:`nebbia`,order:29,labelKey:`ui.visualizerNebbia`,labelFallback:`雾笺`,previewSeed:`nebbia`,previewStartOffset:0,glyph:(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(`rect`,{x:`3.5`,y:`4.5`,width:`17`,height:`15`,rx:`1.5`}),(0,H.jsx)(`path`,{d:`M7 14c2-3.5 4-3.5 5 0s3 3 5-1`,opacity:`0.6`}),(0,H.jsx)(`path`,{d:`M8 8v1.5M15.5 7.5v2`,opacity:`0.5`})]}),command:{title:`Visualizer: Nebbia`,description:`Switch to the Nebbia fogged-window writing`,keywords:[`nebbia`,`rain window`,`fog`,`bus window`,`writing on glass`,`raindrops`,`雾笺`,`起雾`,`玻璃写字`,`公交车`,`雨夜`]},background:yf,showsBackground:bf,usesWordSegmentation:!0,beatEffects:[{id:kt.nebbiaDrizzleRide,nameKey:`options.beatEffect_nebbiaDrizzleRide`,descKey:`options.beatEffect_nebbiaDrizzleRideDesc`,source:`stems`,parts:[{key:`rain`,nameKey:`options.beatEffectPart_nebbiaRain`},{key:`bump`,nameKey:`options.beatEffectPart_nebbiaBump`}]},{id:kt.nebbiaAquaBeat,nameKey:`options.beatEffect_nebbiaAquaBeat`,descKey:`options.beatEffect_nebbiaAquaBeatDesc`,source:`beats`,parts:[{key:`jelly`,nameKey:`options.beatEffectPart_nebbiaJelly`},{key:`weed`,nameKey:`options.beatEffectPart_nebbiaWeed`},{key:`bubble`,nameKey:`options.beatEffectPart_nebbiaBubble`},{key:`spot`,nameKey:`options.beatEffectPart_nebbiaSpot`}]}],beatEffectOnScreen:xf,prewarmWhenIdle:!0,prewarm:()=>{u(()=>import(`./nebbiaShaderWarmup-B8_tPUK4.js`).then(e=>e.warmNebbiaShaders()),__vite__mapDeps([15]),import.meta.url).catch(e=>console.warn(`[Nebbia] shader warm-up did not load`,e))},render:e=>(0,H.jsx)(Xh,{...e,nebbiaTuning:$e.read(e.visualizerTunings)}),renderSettingsPanel:e=>(0,H.jsx)(Jh,{...e}),renderQuickControls:({tuning:e,onTuningChange:t,t:n})=>{let r=$h(Zh,e=>Zh[e].appear,e.appear),i=$h(Qh,e=>Qh[e].fade,e.fade),a=n(r>=0?Zh[r].labelKey:`options.nebbiaCustom`),o=n(i>=0?Qh[i].labelKey:`options.nebbiaCustom`);return(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(hr,{label:a,title:`${n(`options.nebbiaAppear`)}: ${a}`,onClick:()=>t({appear:Zh[(r+1)%Zh.length].appear})}),(0,H.jsx)(hr,{label:o,title:`${n(`options.nebbiaFade`)}: ${o}`,onClick:()=>t({fade:Qh[(i+1)%Qh.length].fade})})]})}}),tg=e({default:()=>rg}),ng=V.lazy(()=>u(()=>import(`./VisualizerPartita-B4dbhicC.js`),__vite__mapDeps([16,1]),import.meta.url)),rg=mp({mode:`partita`,order:50,labelKey:`ui.visualizerPartita`,labelFallback:`云阶`,previewSeed:`partita`,previewStartOffset:0,tuningKind:`partita`,usesWordSegmentation:!0,render:e=>(0,H.jsx)(ng,{...e}),renderSettingsPanel:e=>(0,H.jsx)(Bp,{...e}),resetSettings:({resetPartitaTuning:e})=>{e?.()}}),ig={id:`vis-pendolo`,titleKey:`options.pendoloSettings`},ag={id:`vis-pendolo-render`,titleKey:`options.lyricRenderSection`},og={arcRadius:.5,wheelCenterX:.3,tickSnappiness:1.8,tiltDeg:40,tiltAxisDeg:-10,parallaxDepth:2},sg={arcRadius:.5,wheelCenterX:.3,tiltDeg:-53,tiltAxisDeg:66,parallaxDepth:1.65},cg={hubView:!0,hubViewHeight:1.4,hubViewBack:1.2,parallaxDepth:1},lg=({t:e,tuning:t,onTuningChange:n,onSliderPointerDown:r,onSliderCommit:i})=>{let a=t??_t,o={onDragStart:r,onDragEnd:i},s=a.render??_t.render,c=a.mirrorLayout===!0,l=a.hubView===!0,u=Object.keys(_t).filter(e=>e!==`render`),d=Object.fromEntries(u.map(e=>[e,_t[e]])),f=e=>u.every(t=>{let n=a[t]??_t[t],r=e[t];return typeof n==`number`&&typeof r==`number`?Math.abs(n-r)<1e-6:n===r}),p={...d,mirrorLayout:c},m={...p,...og},h={...p,...sg},g={...p,...cg};return(0,H.jsxs)(H.Fragment,{children:[(0,H.jsxs)(z,{def:ig,action:(0,H.jsxs)(`span`,{className:`flex items-center gap-1.5`,children:[(0,H.jsx)(Nt,{variant:`quiet`,disabled:f(d),onClick:()=>n(d),children:e(`options.pendoloPresetDefault`)}),(0,H.jsx)(Nt,{variant:`quiet`,disabled:f(m),onClick:()=>n(m),children:e(`options.pendoloPreset1`)}),(0,H.jsx)(Nt,{variant:`quiet`,disabled:f(h),onClick:()=>n(h),children:e(`options.pendoloPreset2`)}),(0,H.jsx)(Nt,{variant:`quiet`,disabled:f(g),onClick:()=>n(g),children:e(`options.pendoloPreset3`)})]}),children:[(0,H.jsx)(Pt,{label:e(`options.pendoloMirrorLayout`),checked:c,onChange:e=>n({mirrorLayout:e})}),(0,H.jsx)(B,{...o,label:e(c?`options.pendoloWheelCenterXMirrored`:`options.pendoloWheelCenterX`),value:a.wheelCenterX,min:-.2,max:.4,step:.01,format:e=>`${e>0?`+`:``}${Ft(e)}`,onChange:e=>n?.({wheelCenterX:e})}),(0,H.jsx)(B,{...o,label:e(`options.pendoloArcRadius`),value:a.arcRadius,min:.25,max:.8,step:.01,format:Ft,onChange:e=>n?.({arcRadius:e})}),(0,H.jsx)(B,{...o,label:e(`options.pendoloArcAngleDeg`),value:a.arcAngleDeg,min:40,max:160,step:5,format:e=>`${Math.round(e)}°`,onChange:e=>n?.({arcAngleDeg:e})}),(0,H.jsx)(Pt,{label:e(`options.pendoloHubView`),checked:l,onChange:e=>n({hubView:e})}),l?(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(B,{...o,label:e(`options.pendoloHubViewHeight`),value:a.hubViewHeight??1.4,min:ze,max:3,step:.05,format:R,onChange:e=>n({hubViewHeight:e})}),(0,H.jsx)(B,{...o,label:e(`options.pendoloHubViewBack`),value:a.hubViewBack??1.2,min:xe,max:3,step:.05,format:R,onChange:e=>n({hubViewBack:e})})]}):(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(B,{...o,label:e(`options.pendoloTiltDeg`),value:a.tiltDeg??0,min:-70,max:70,step:1,format:e=>`${Math.round(e)}°`,onChange:e=>n({tiltDeg:e})}),(0,H.jsx)(B,{...o,label:e(`options.pendoloTiltAxisDeg`),value:a.tiltAxisDeg??0,min:-90,max:90,step:1,format:e=>`${Math.round(e)}°`,onChange:e=>n({tiltAxisDeg:e})})]}),(0,H.jsx)(B,{...o,label:e(`options.pendoloParallaxDepth`),value:a.parallaxDepth??1,min:0,max:2,step:.05,format:R,onChange:e=>n({parallaxDepth:e})}),(0,H.jsx)(B,{...o,label:e(`options.pendoloTickSnappiness`),value:a.tickSnappiness,min:.5,max:2,step:.1,format:e=>`${e.toFixed(1)}x`,onChange:e=>n?.({tickSnappiness:e})}),(0,H.jsx)(B,{...o,label:e(`options.pendoloActiveScale`),value:a.activeScale,min:1,max:1.6,step:.05,format:R,onChange:e=>n?.({activeScale:e})}),(0,H.jsx)(L,{label:e(`options.pendoloShowGearDecor`),children:(0,H.jsx)(Mt,{value:a.showGearDecor,options:[{value:`none`,label:e(`options.decorNone`)},{value:`subtle`,label:e(`options.decorSubtle`)},{value:`full`,label:e(`options.decorFull`)}],onChange:e=>n?.({showGearDecor:e})})}),(0,H.jsx)(Pt,{label:e(`options.pendoloShowCenterGradient`),checked:a.showCenterGradient??!0,onChange:e=>n?.({showCenterGradient:e})}),(0,H.jsx)(Pt,{label:e(`options.pendoloShowCoverOnWatchFace`),checked:a.showCoverOnWatchFace??!1,onChange:e=>n?.({showCoverOnWatchFace:e})}),(0,H.jsx)(Pt,{label:e(`options.pendoloEnableLineGlow`),checked:a.enableLineGlow??!1,onChange:e=>n?.({enableLineGlow:e})})]}),(0,H.jsx)(z,{def:ag,children:(0,H.jsx)(_f,{value:s??de,onChange:e=>n?.({render:{...s??de,...e}})})})]})},ug=e({default:()=>fg}),dg=V.lazy(()=>u(()=>import(`./VisualizerPendolo-CVBVX0fM.js`),__vite__mapDeps([17,1]),import.meta.url)),fg=mp({mode:`pendolo`,order:100,labelKey:`ui.visualizerPendolo`,labelFallback:`Pendolo`,previewSeed:`pendolo`,previewStartOffset:0,tuningKind:`pendolo`,render:e=>(0,H.jsx)(dg,{...e},e.seed),renderSettingsPanel:e=>(0,H.jsx)(lg,{...e}),resetSettings:({resetPendoloTuning:e,setDraftPendoloTuning:t})=>{t?.(_t),e?.()}}),pg=({title:e,children:t})=>(0,H.jsxs)(`section`,{className:`space-y-4 border-t border-white/10 pt-4`,children:[(0,H.jsx)(`h3`,{className:`text-xs font-medium uppercase tracking-[0.24em] opacity-45`,style:{color:`var(--text-secondary)`},children:e}),t]}),mg=({label:e,value:t,rangeInputClass:n,onChange:r,onPointerDown:i,onPointerUp:a,min:o=0,max:s=2,step:c=.05})=>(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3 text-sm`,style:{color:`var(--text-primary)`},children:[(0,H.jsx)(`span`,{children:e}),(0,H.jsxs)(`span`,{className:`shrink-0 font-mono opacity-70`,style:{color:`var(--text-secondary)`},children:[t.toFixed(2),`x`]})]}),(0,H.jsx)(`input`,{type:`range`,min:o,max:s,step:c,value:t,onChange:e=>r(Number(e.target.value)),onPointerDown:i,onPointerUp:a,className:n})]}),hg=({t:e,isDaylight:t,theme:n,rangeInputClass:r,controlCardBg:i,sonnetTuning:a=mt,onSonnetTuningChange:o,onSliderPointerDown:s,onSliderCommit:c})=>{let l=(0,V.useMemo)(()=>[{value:!0,label:e(`options.sonnetToggleOn`)},{value:!1,label:e(`options.sonnetToggleOff`)}],[e]),u=(0,V.useMemo)(()=>[{value:`none`,label:e(`options.sonnetOuterFrameNone`)},{value:`frame`,label:e(`options.sonnetOuterFrameFrame`)},{value:`full`,label:e(`options.sonnetOuterFrameFull`)}],[e]),d=[{key:`showOnlyText`,label:e(`options.sonnetShowOnlyText`)},{key:`showGuide`,label:e(`options.sonnetShowGuide`)},{key:`showBackgroundMg`,label:e(`options.sonnetShowBackgroundMg`)},{key:`showFixedGeo`,label:e(`options.sonnetShowFixedGeo`)},{key:`showGiantDecorativeText`,label:e(`options.sonnetShowGiantDecorativeText`)},{key:`showBackgroundDecor`,label:e(`options.sonnetShowBackgroundDecor`)},{key:`enableTransitions`,label:e(`options.sonnetEnableTransitions`)}],f=[{key:`cameraIntensity`,label:e(`options.sonnetCameraIntensity`)},{key:`typographyMotion`,label:e(`options.sonnetTypographyMotion`)},{key:`mgDensity`,label:e(`options.sonnetMgDensity`)}];return(0,H.jsxs)(`div`,{className:`rounded-[24px] border border-white/10 p-4 space-y-4`,style:{backgroundColor:i},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.sonnetSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-50`,style:{color:`var(--text-secondary)`},children:e(`options.sonnetSettingsDesc`)})]}),(0,H.jsx)(pg,{title:e(`options.sonnetQualitySection`),children:(0,H.jsxs)(`div`,{className:`rounded-2xl border p-3.5 space-y-2.5`,style:{borderColor:P(n.secondaryColor,t?.18:.14),backgroundColor:P(n.backgroundColor,t?.24:.34)},children:[(0,H.jsx)(mg,{label:e(`options.sonnetTextureResolution`),value:a.textureResolution,min:.5,max:4,step:.25,rangeInputClass:r,onChange:e=>o?.({textureResolution:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(`p`,{className:`text-xs leading-relaxed opacity-60`,style:{color:`var(--text-secondary)`},children:e(`options.sonnetTexturePerformanceWarning`)})]})}),(0,H.jsx)(pg,{title:e(`options.sonnetMotionSection`),children:f.map(e=>(0,H.jsx)(mg,{label:e.label,value:a[e.key],rangeInputClass:r,onChange:t=>o?.({[e.key]:t}),onPointerDown:s,onPointerUp:c},e.key))}),(0,H.jsxs)(pg,{title:e(`options.sonnetPostProcessSection`),children:[(0,H.jsx)(jp,{label:e(`options.sonnetPostProcessEnabled`),value:a.postProcessEnabled,options:l,onChange:e=>o?.({postProcessEnabled:e}),isDaylight:t,theme:n}),a.postProcessEnabled&&(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(mg,{label:e(`options.sonnetPostProcessGrain`),value:a.postProcessGrain,min:0,max:1,step:.05,rangeInputClass:r,onChange:e=>o?.({postProcessGrain:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(mg,{label:e(`options.sonnetPostProcessContrast`),value:a.postProcessContrast,min:0,max:1,step:.05,rangeInputClass:r,onChange:e=>o?.({postProcessContrast:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(mg,{label:e(`options.sonnetPostProcessRgbShift`)||`RGB 色差`,value:a.postProcessRgbShift,min:0,max:1,step:.05,rangeInputClass:r,onChange:e=>o?.({postProcessRgbShift:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(mg,{label:e(`options.sonnetPostProcessLensDistortion`),value:a.postProcessLensDistortion,min:0,max:2,step:.05,rangeInputClass:r,onChange:e=>o?.({postProcessLensDistortion:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(mg,{label:e(`options.sonnetPostProcessLensDispersion`),value:a.postProcessLensDispersion,min:0,max:1,step:.05,rangeInputClass:r,onChange:e=>o?.({postProcessLensDispersion:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(mg,{label:e(`options.sonnetPostProcessHalftone`),value:a.postProcessHalftone,min:0,max:1,step:.05,rangeInputClass:r,onChange:e=>o?.({postProcessHalftone:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(mg,{label:e(`options.sonnetPostProcessVignette`),value:a.postProcessVignette,min:0,max:2,step:.05,rangeInputClass:r,onChange:e=>o?.({postProcessVignette:e}),onPointerDown:s,onPointerUp:c})]})]}),(0,H.jsxs)(pg,{title:e(`options.sonnetDisplaySection`),children:[(0,H.jsx)(jp,{label:e(`options.sonnetOuterFrameMode`),value:a.outerFrameMode,options:u,onChange:e=>o?.({outerFrameMode:e}),isDaylight:t,theme:n}),(0,H.jsx)(`div`,{className:`grid gap-4 sm:grid-cols-2`,children:d.map(e=>(0,H.jsx)(jp,{label:e.label,value:a[e.key],options:l,onChange:t=>o?.({[e.key]:t}),isDaylight:t,theme:n},e.key))})]})]})},gg=e({default:()=>yg}),_g=V.lazy(()=>u(()=>import(`./VisualizerSonnet-Cp-lpxiL.js`).then(e=>e.t),__vite__mapDeps([18,1]),import.meta.url)),vg={min:0,max:3,identity:1},yg=mp({mode:`sonnet`,order:10,labelKey:`ui.visualizerSonnet`,labelFallback:`商籁`,previewSeed:`sonnet`,previewStartOffset:0,tuningKind:`sonnet`,usesWordSegmentation:!0,foliumTunables:{cameraScale:vg,motionScale:vg,breathScale:vg,parallaxScale:vg,mgSwimScale:vg,driftScale:vg,caScale:vg,ghostScale:vg,transitionMotionScale:vg,transitionBlurScale:vg,transitionGlitchScale:vg},render:e=>(0,H.jsx)(_g,{...e}),renderSettingsPanel:e=>(0,H.jsx)(hg,{...e}),resetSettings:({resetSonnetTuning:e,setDraftSonnetTuning:t})=>{t?.(mt),e?.()}}),bg=e({default:()=>Sg}),xg=V.lazy(()=>u(()=>import(`./VisualizerStill-BtBTjO77.js`),__vite__mapDeps([19]),import.meta.url)),Sg=mp({mode:`still`,order:130,labelKey:`ui.visualizerStill`,labelFallback:`Still`,previewSeed:`still`,previewStartOffset:0,tuningKind:`none`,render:e=>(0,H.jsx)(xg,{...e})}),Cg={},wg=(function(e,t,n,r,i){var a=new Worker(Cg[t]||(Cg[t]=URL.createObjectURL(new Blob([e+`;addEventListener("error",function(e){e=e.error;postMessage({$e$:[e.message,e.code,e.stack]})})`],{type:`text/javascript`}))));return a.onmessage=function(e){var t=e.data,n=t.$e$;if(n){var r=Error(n[0]);r.code=n[1],r.stack=n[2],i(r,null)}else i(null,t)},a.postMessage(n,r),a}),Z=Uint8Array,Tg=Uint16Array,Eg=Int32Array,Dg=new Z([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Og=new Z([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),kg=new Z([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),Ag=function(e,t){for(var n=new Tg(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var i=new Eg(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)i[a]=a-n[r]<<5|r;return{b:n,r:i}},jg=Ag(Dg,2),Mg=jg.b,Ng=jg.r;Mg[28]=258,Ng[258]=28;for(var Pg=Ag(Og,0),Fg=Pg.b,Ig=Pg.r,Lg=new Tg(32768),Q=0;Q<32768;++Q){var Rg=(Q&43690)>>1|(Q&21845)<<1;Rg=(Rg&52428)>>2|(Rg&13107)<<2,Rg=(Rg&61680)>>4|(Rg&3855)<<4,Lg[Q]=((Rg&65280)>>8|(Rg&255)<<8)>>1}for(var zg=(function(e,t,n){for(var r=e.length,i=0,a=new Tg(t);i<r;++i)e[i]&&++a[e[i]-1];var o=new Tg(t);for(i=1;i<t;++i)o[i]=o[i-1]+a[i-1]<<1;var s;if(n){s=new Tg(1<<t);var c=15-t;for(i=0;i<r;++i)if(e[i])for(var l=i<<4|e[i],u=t-e[i],d=o[e[i]-1]++<<u,f=d|(1<<u)-1;d<=f;++d)s[Lg[d]>>c]=l}else for(s=new Tg(r),i=0;i<r;++i)e[i]&&(s[i]=Lg[o[e[i]-1]++]>>15-e[i]);return s}),Bg=new Z(288),Q=0;Q<144;++Q)Bg[Q]=8;for(var Q=144;Q<256;++Q)Bg[Q]=9;for(var Q=256;Q<280;++Q)Bg[Q]=7;for(var Q=280;Q<288;++Q)Bg[Q]=8;for(var Vg=new Z(32),Q=0;Q<32;++Q)Vg[Q]=5;var Hg=zg(Bg,9,0),Ug=zg(Bg,9,1),Wg=zg(Vg,5,0),Gg=zg(Vg,5,1),Kg=function(e){for(var t=e[0],n=1;n<e.length;++n)e[n]>t&&(t=e[n]);return t},qg=function(e,t,n){var r=t/8|0;return(e[r]|e[r+1]<<8)>>(t&7)&n},Jg=function(e,t){var n=t/8|0;return(e[n]|e[n+1]<<8|e[n+2]<<16)>>(t&7)},Yg=function(e){return(e+7)/8|0},Xg=function(e,t,n){return(t==null||t<0)&&(t=0),(n==null||n>e.length)&&(n=e.length),new Z(e.subarray(t,n))},Zg=[`unexpected EOF`,`invalid block type`,`invalid length/literal`,`invalid distance`,`stream finished`,`no stream handler`,,`no callback`,`invalid UTF-8 data`,`extra field too long`,`date not in range 1980-2099`,`filename too long`,`stream finishing`,`invalid zip data`],$=function(e,t,n){var r=Error(t||Zg[e]);if(r.code=e,Error.captureStackTrace&&Error.captureStackTrace(r,$),!n)throw r;return r},Qg=function(e,t,n,r){var i=e.length,a=r?r.length:0;if(!i||t.f&&!t.l)return n||new Z(0);var o=!n,s=o||t.i!=2,c=t.i;o&&(n=new Z(i*3));var l=function(e){var t=n.length;if(e>t){var r=new Z(Math.max(t*2,e));r.set(n),n=r}},u=t.f||0,d=t.p||0,f=t.b||0,p=t.l,m=t.d,h=t.m,g=t.n,_=i*8;do{if(!p){u=qg(e,d,1);var v=qg(e,d+1,3);if(d+=3,!v){var y=Yg(d)+4,b=e[y-4]|e[y-3]<<8,x=y+b;if(x>i){c&&$(0);break}s&&l(f+b),n.set(e.subarray(y,x),f),t.b=f+=b,t.p=d=x*8,t.f=u;continue}if(v==1)p=Ug,m=Gg,h=9,g=5;else if(v==2){var S=qg(e,d,31)+257,C=qg(e,d+10,15)+4,w=S+qg(e,d+5,31)+1;d+=14;for(var T=new Z(w),E=new Z(19),D=0;D<C;++D)E[kg[D]]=qg(e,d+D*3,7);d+=C*3;for(var O=Kg(E),k=(1<<O)-1,A=zg(E,O,1),D=0;D<w;){var j=A[qg(e,d,k)];d+=j&15;var y=j>>4;if(y<16)T[D++]=y;else{var ee=0,M=0;for(y==16?(M=3+qg(e,d,3),d+=2,ee=T[D-1]):y==17?(M=3+qg(e,d,7),d+=3):y==18&&(M=11+qg(e,d,127),d+=7);M--;)T[D++]=ee}}var te=T.subarray(0,S),ne=T.subarray(S);h=Kg(te),g=Kg(ne),p=zg(te,h,1),m=zg(ne,g,1)}else $(1);if(d>_){c&&$(0);break}}s&&l(f+131072);for(var re=(1<<h)-1,ie=(1<<g)-1,ae=d;;ae=d){var ee=p[Jg(e,d)&re],oe=ee>>4;if(d+=ee&15,d>_){c&&$(0);break}if(ee||$(2),oe<256)n[f++]=oe;else if(oe==256){ae=d,p=null;break}else{var se=oe-254;if(oe>264){var D=oe-257,N=Dg[D];se=qg(e,d,(1<<N)-1)+Mg[D],d+=N}var P=m[Jg(e,d)&ie],ce=P>>4;P||$(3),d+=P&15;var ne=Fg[ce];if(ce>3){var N=Og[ce];ne+=Jg(e,d)&(1<<N)-1,d+=N}if(d>_){c&&$(0);break}s&&l(f+131072);var le=f+se;if(f<ne){var ue=a-ne,de=Math.min(ne,le);for(ue+f<0&&$(3);f<de;++f)n[f]=r[ue+f]}for(;f<le;++f)n[f]=n[f-ne]}}t.l=p,t.p=ae,t.b=f,t.f=u,p&&(u=1,t.m=h,t.d=m,t.n=g)}while(!u);return f!=n.length&&o?Xg(n,0,f):n.subarray(0,f)},$g=function(e,t,n){n<<=t&7;var r=t/8|0;e[r]|=n,e[r+1]|=n>>8},e_=function(e,t,n){n<<=t&7;var r=t/8|0;e[r]|=n,e[r+1]|=n>>8,e[r+2]|=n>>16},t_=function(e,t){for(var n=[],r=0;r<e.length;++r)e[r]&&n.push({s:r,f:e[r]});var i=n.length,a=n.slice();if(!i)return{t:c_,l:0};if(i==1){var o=new Z(n[0].s+1);return o[n[0].s]=1,{t:o,l:1}}n.sort(function(e,t){return e.f-t.f}),n.push({s:-1,f:25001});var s=n[0],c=n[1],l=0,u=1,d=2;for(n[0]={s:-1,f:s.f+c.f,l:s,r:c};u!=i-1;)s=n[n[l].f<n[d].f?l++:d++],c=n[l!=u&&n[l].f<n[d].f?l++:d++],n[u++]={s:-1,f:s.f+c.f,l:s,r:c};for(var f=a[0].s,r=1;r<i;++r)a[r].s>f&&(f=a[r].s);var p=new Tg(f+1),m=n_(n[u-1],p,0);if(m>t){var r=0,h=0,g=m-t,_=1<<g;for(a.sort(function(e,t){return p[t.s]-p[e.s]||e.f-t.f});r<i;++r){var v=a[r].s;if(p[v]>t)h+=_-(1<<m-p[v]),p[v]=t;else break}for(h>>=g;h>0;){var y=a[r].s;p[y]<t?h-=1<<t-p[y]++-1:++r}for(;r>=0&&h;--r){var b=a[r].s;p[b]==t&&(--p[b],++h)}m=t}return{t:new Z(p),l:m}},n_=function(e,t,n){return e.s==-1?Math.max(n_(e.l,t,n+1),n_(e.r,t,n+1)):t[e.s]=n},r_=function(e){for(var t=e.length;t&&!e[--t];);for(var n=new Tg(++t),r=0,i=e[0],a=1,o=function(e){n[r++]=e},s=1;s<=t;++s)if(e[s]==i&&s!=t)++a;else{if(!i&&a>2){for(;a>138;a-=138)o(32754);a>2&&(o(a>10?a-11<<5|28690:a-3<<5|12305),a=0)}else if(a>3){for(o(i),--a;a>6;a-=6)o(8304);a>2&&(o(a-3<<5|8208),a=0)}for(;a--;)o(i);a=1,i=e[s]}return{c:n.subarray(0,r),n:t}},i_=function(e,t){for(var n=0,r=0;r<t.length;++r)n+=e[r]*t[r];return n},a_=function(e,t,n){var r=n.length,i=Yg(t+2);e[i]=r&255,e[i+1]=r>>8,e[i+2]=e[i]^255,e[i+3]=e[i+1]^255;for(var a=0;a<r;++a)e[i+a+4]=n[a];return(i+4+r)*8},o_=function(e,t,n,r,i,a,o,s,c,l,u){$g(t,u++,n),++i[256];for(var d=t_(i,15),f=d.t,p=d.l,m=t_(a,15),h=m.t,g=m.l,_=r_(f),v=_.c,y=_.n,b=r_(h),x=b.c,S=b.n,C=new Tg(19),w=0;w<v.length;++w)++C[v[w]&31];for(var w=0;w<x.length;++w)++C[x[w]&31];for(var T=t_(C,7),E=T.t,D=T.l,O=19;O>4&&!E[kg[O-1]];--O);var k=l+5<<3,A=i_(i,Bg)+i_(a,Vg)+o,j=i_(i,f)+i_(a,h)+o+14+3*O+i_(C,E)+2*C[16]+3*C[17]+7*C[18];if(c>=0&&k<=A&&k<=j)return a_(t,u,e.subarray(c,c+l));var ee,M,te,ne;if($g(t,u,1+(j<A)),u+=2,j<A){ee=zg(f,p,0),M=f,te=zg(h,g,0),ne=h;var re=zg(E,D,0);$g(t,u,y-257),$g(t,u+5,S-1),$g(t,u+10,O-4),u+=14;for(var w=0;w<O;++w)$g(t,u+3*w,E[kg[w]]);u+=3*O;for(var ie=[v,x],ae=0;ae<2;++ae)for(var oe=ie[ae],w=0;w<oe.length;++w){var se=oe[w]&31;$g(t,u,re[se]),u+=E[se],se>15&&($g(t,u,oe[w]>>5&127),u+=oe[w]>>12)}}else ee=Hg,M=Bg,te=Wg,ne=Vg;for(var w=0;w<s;++w){var N=r[w];if(N>255){var se=N>>18&31;e_(t,u,ee[se+257]),u+=M[se+257],se>7&&($g(t,u,N>>23&31),u+=Dg[se]);var P=N&31;e_(t,u,te[P]),u+=ne[P],P>3&&(e_(t,u,N>>5&8191),u+=Og[P])}else e_(t,u,ee[N]),u+=M[N]}return e_(t,u,ee[256]),u+M[256]},s_=new Eg([65540,131080,131088,131104,262176,1048704,1048832,2114560,2117632]),c_=new Z(0),l_=function(e,t,n,r,i,a){var o=a.z||e.length,s=new Z(r+o+5*(1+Math.ceil(o/7e3))+i),c=s.subarray(r,s.length-i),l=a.l,u=(a.r||0)&7;if(t){u&&(c[0]=a.r>>3);for(var d=s_[t-1],f=d>>13,p=d&8191,m=(1<<n)-1,h=a.p||new Tg(32768),g=a.h||new Tg(m+1),_=Math.ceil(n/3),v=2*_,y=function(t){return(e[t]^e[t+1]<<_^e[t+2]<<v)&m},b=new Eg(25e3),x=new Tg(288),S=new Tg(32),C=0,w=0,T=a.i||0,E=0,D=a.w||0,O=0;T+2<o;++T){var k=y(T),A=T&32767,j=g[k];if(h[A]=j,g[k]=A,D<=T){var ee=o-T;if((C>7e3||E>24576)&&(ee>423||!l)){u=o_(e,c,0,b,x,S,w,E,O,T-O,u),E=C=w=0,O=T;for(var M=0;M<286;++M)x[M]=0;for(var M=0;M<30;++M)S[M]=0}var te=2,ne=0,re=p,ie=A-j&32767;if(ee>2&&k==y(T-ie))for(var ae=Math.min(f,ee)-1,oe=Math.min(32767,T),se=Math.min(258,ee);ie<=oe&&--re&&A!=j;){if(e[T+te]==e[T+te-ie]){for(var N=0;N<se&&e[T+N]==e[T+N-ie];++N);if(N>te){if(te=N,ne=ie,N>ae)break;for(var P=Math.min(ie,N-2),ce=0,M=0;M<P;++M){var le=T-ie+M&32767,ue=le-h[le]&32767;ue>ce&&(ce=ue,j=le)}}}A=j,j=h[A],ie+=A-j&32767}if(ne){b[E++]=268435456|Ng[te]<<18|Ig[ne];var de=Ng[te]&31,fe=Ig[ne]&31;w+=Dg[de]+Og[fe],++x[257+de],++S[fe],D=T+te,++C}else b[E++]=e[T],++x[e[T]]}}for(T=Math.max(T,D);T<o;++T)b[E++]=e[T],++x[e[T]];u=o_(e,c,l,b,x,S,w,E,O,T-O,u),l||(a.r=u&7|c[u/8|0]<<3,u-=7,a.h=g,a.p=h,a.i=T,a.w=D)}else{for(var T=a.w||0;T<o+l;T+=65535){var pe=T+65535;pe>=o&&(c[u/8|0]=l,pe=o),u=a_(c,u+1,e.subarray(T,pe))}a.i=o}return Xg(s,0,r+Yg(u)+i)},u_=(function(){for(var e=new Int32Array(256),t=0;t<256;++t){for(var n=t,r=9;--r;)n=(n&1&&-306674912)^n>>>1;e[t]=n}return e})(),d_=function(){var e=-1;return{p:function(t){for(var n=e,r=0;r<t.length;++r)n=u_[n&255^t[r]]^n>>>8;e=n},d:function(){return~e}}},f_=function(e,t,n,r,i){if(!i&&(i={l:1},t.dictionary)){var a=t.dictionary.subarray(-32768),o=new Z(a.length+e.length);o.set(a),o.set(e,a.length),e=o,i.w=a.length}return l_(e,t.level==null?6:t.level,t.mem==null?i.l?Math.ceil(Math.max(8,Math.min(13,Math.log(e.length)))*1.5):20:12+t.mem,n,r,i)},p_=function(e,t){var n={};for(var r in e)n[r]=e[r];for(var r in t)n[r]=t[r];return n},m_=function(e,t,n){for(var r=e(),i=e.toString(),a=i.slice(i.indexOf(`[`)+1,i.lastIndexOf(`]`)).replace(/\s+/g,``).split(`,`),o=0;o<r.length;++o){var s=r[o],c=a[o];if(typeof s==`function`){t+=`;`+c+`=`;var l=s.toString();if(s.prototype){if(l.indexOf(`[native code]`)!=-1){var u=l.indexOf(` `,8)+1;t+=l.slice(u,l.indexOf(`(`,u))}else for(var d in t+=l,s.prototype)t+=`;`+c+`.prototype.`+d+`=`+s.prototype[d].toString()}else t+=l}else n[c]=s}return t},h_=[],g_=function(e){var t=[];for(var n in e)e[n].buffer&&t.push((e[n]=new e[n].constructor(e[n])).buffer);return t},__=function(e,t,n,r){if(!h_[n]){for(var i=``,a={},o=e.length-1,s=0;s<o;++s)i=m_(e[s],i,a);h_[n]={c:m_(e[o],i,a),e:a}}var c=p_({},h_[n].e);return wg(h_[n].c+`;onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage=`+t.toString()+`}`,n,c,g_(c),r)},v_=function(){return[Z,Tg,Eg,Dg,Og,kg,Mg,Fg,Ug,Gg,Lg,Zg,zg,Kg,qg,Jg,Yg,Xg,$,Qg,A_,b_,x_]},y_=function(){return[Z,Tg,Eg,Dg,Og,kg,Ng,Ig,Hg,Bg,Wg,Vg,Lg,s_,c_,zg,$g,e_,t_,n_,r_,i_,a_,o_,Yg,Xg,l_,f_,O_,b_]},b_=function(e){return postMessage(e,[e.buffer])},x_=function(e){return e&&{out:e.size&&new Z(e.size),dictionary:e.dictionary}},S_=function(e,t,n,r,i,a){var o=__(n,r,i,function(e,t){o.terminate(),a(e,t)});return o.postMessage([e,t],t.consume?[e.buffer]:[]),function(){o.terminate()}},C_=function(e,t){return e[t]|e[t+1]<<8},w_=function(e,t){return(e[t]|e[t+1]<<8|e[t+2]<<16|e[t+3]<<24)>>>0},T_=function(e,t){return w_(e,t)+w_(e,t+4)*4294967296},E_=function(e,t,n){for(;n;++t)e[t]=n,n>>>=8};function D_(e,t,n){return n||(n=t,t={}),typeof n!=`function`&&$(7),S_(e,t,[y_],function(e){return b_(O_(e.data[0],e.data[1]))},0,n)}function O_(e,t){return f_(e,t||{},0,0)}function k_(e,t,n){return n||(n=t,t={}),typeof n!=`function`&&$(7),S_(e,t,[v_],function(e){return b_(A_(e.data[0],x_(e.data[1])))},1,n)}function A_(e,t){return Qg(e,{i:2},t&&t.out,t&&t.dictionary)}var j_=function(e,t,n,r){for(var i in e){var a=e[i],o=t+i,s=r;Array.isArray(a)&&(s=p_(r,a[1]),a=a[0]),ArrayBuffer.isView(a)?n[o]=[a,s]:(n[o+=`/`]=[new Z(0),s],j_(a,o,n,r))}},M_=typeof TextEncoder<`u`&&new TextEncoder,N_=typeof TextDecoder<`u`&&new TextDecoder;try{N_.decode(c_,{stream:!0})}catch{}var P_=function(e){for(var t=``,n=0;;){var r=e[n++],i=(r>127)+(r>223)+(r>239);if(n+i>e.length)return{s:t,r:Xg(e,n-1)};i?i==3?(r=((r&15)<<18|(e[n++]&63)<<12|(e[n++]&63)<<6|e[n++]&63)-65536,t+=String.fromCharCode(55296|r>>10,56320|r&1023)):i&1?t+=String.fromCharCode((r&31)<<6|e[n++]&63):t+=String.fromCharCode((r&15)<<12|(e[n++]&63)<<6|e[n++]&63):t+=String.fromCharCode(r)}};function F_(e,t){if(t){for(var n=new Z(e.length),r=0;r<e.length;++r)n[r]=e.charCodeAt(r);return n}if(M_)return M_.encode(e);for(var i=e.length,a=new Z(e.length+(e.length>>1)),o=0,s=function(e){a[o++]=e},r=0;r<i;++r){if(o+5>a.length){var c=new Z(o+8+(i-r<<1));c.set(a),a=c}var l=e.charCodeAt(r);l<128||t?s(l):l<2048?(s(192|l>>6),s(128|l&63)):l>55295&&l<57344?(l=65536+(l&1047552)|e.charCodeAt(++r)&1023,s(240|l>>18),s(128|l>>12&63),s(128|l>>6&63),s(128|l&63)):(s(224|l>>12),s(128|l>>6&63),s(128|l&63))}return Xg(a,0,o)}function I_(e,t){if(t){for(var n=``,r=0;r<e.length;r+=16384)n+=String.fromCharCode.apply(null,e.subarray(r,r+16384));return n}if(N_)return N_.decode(e);var i=P_(e),a=i.s,n=i.r;return n.length&&$(8),a}var L_=function(e,t){return t+30+C_(e,t+26)+C_(e,t+28)},R_=function(e,t,n){var r=C_(e,t+28),i=C_(e,t+30),a=I_(e.subarray(t+46,t+46+r),!(C_(e,t+8)&2048)),o=t+46+r,s=z_(e,o,i,n,w_(e,t+20),w_(e,t+24),w_(e,t+42)),c=s[0],l=s[1],u=s[2];return[C_(e,t+10),c,l,a,o+i+C_(e,t+32),u]},z_=function(e,t,n,r,i,a,o){var s=i==4294967295,c=a==4294967295,l=o==4294967295,u=t+n,d=s+c+l;if(r&&d){for(;t+4<u;t+=4+C_(e,t+2))if(C_(e,t)==1)return[s?T_(e,t+4+8*c):i,c?T_(e,t+4):a,l?T_(e,t+4+8*(c+s)):o,1];r<2&&$(13)}return[i,a,o,0]},B_=function(e){var t=0;if(e)for(var n in e){var r=e[n].length;r>65535&&$(9),t+=r+4}return t},V_=function(e,t,n,r,i,a,o,s){var c=r.length,l=n.extra,u=s&&s.length,d=B_(l);E_(e,t,o==null?67324752:33639248),t+=4,o!=null&&(e[t++]=20,e[t++]=n.os),e[t]=20,t+=2,e[t++]=n.flag<<1|(a<0&&8),e[t++]=i&&8,e[t++]=n.compression&255,e[t++]=n.compression>>8;var f=new Date(n.mtime==null?Date.now():n.mtime),p=f.getFullYear()-1980;if((p<0||p>119)&&$(10),E_(e,t,p<<25|f.getMonth()+1<<21|f.getDate()<<16|f.getHours()<<11|f.getMinutes()<<5|f.getSeconds()>>1),t+=4,a!=-1&&(E_(e,t,n.crc),E_(e,t+4,a<0?-a-2:a),E_(e,t+8,n.size)),E_(e,t+12,c),E_(e,t+14,d),t+=16,o!=null&&(E_(e,t,u),E_(e,t+6,n.attrs),E_(e,t+10,o),t+=14),e.set(r,t),t+=c,d)for(var m in l){var h=l[m],g=h.length;E_(e,t,+m),E_(e,t+2,g),e.set(h,t+4),t+=4+g}return u&&(e.set(s,t),t+=u),t},H_=function(e,t,n,r,i){E_(e,t,101010256),E_(e,t+8,n),E_(e,t+10,n),E_(e,t+12,r),E_(e,t+16,i)};function U_(e,t,n){n||(n=t,t={}),typeof n!=`function`&&$(7);var r={};j_(e,``,r,t);var i=Object.keys(r),a=i.length,o=0,s=0,c=a,l=Array(a),u=[],d=function(){for(var e=0;e<u.length;++e)u[e]()},f=function(e,t){W_(function(){n(e,t)})};W_(function(){f=n});var p=function(){var e=new Z(s+22),t=o,n=s-o;s=0;for(var r=0;r<c;++r){var i=l[r];try{var a=i.c.length;V_(e,s,i,i.f,i.u,a);var u=30+i.f.length+B_(i.extra),d=s+u;e.set(i.c,d),V_(e,o,i,i.f,i.u,a,s,i.m),o+=16+u+(i.m?i.m.length:0),s=d+a}catch(e){return f(e,null)}}H_(e,o,l.length,n,t),f(null,e)};a||p();for(var m=function(e){var t=i[e],n=r[t],c=n[0],m=n[1],h=d_(),g=c.length;h.p(c);var _=F_(t),v=_.length,y=m.comment,b=y&&F_(y),x=b&&b.length,S=B_(m.extra),C=m.level==0?0:8,w=function(n,r){if(n)d(),f(n,null);else{var i=r.length;l[e]=p_(m,{size:g,crc:h.d(),c:r,f:_,m:b,u:v!=t.length||b&&y.length!=x,compression:C}),o+=30+v+S+i,s+=76+2*(v+S)+(x||0)+i,--a||p()}};if(v>65535&&w($(11,0,1),null),!C)w(null,c);else if(g<16e4)try{w(null,O_(c,m))}catch(e){w(e,null)}else u.push(D_(c,m,w))},h=0;h<c;++h)m(h);return d}var W_=typeof queueMicrotask==`function`?queueMicrotask:typeof setTimeout==`function`?setTimeout:function(e){e()};function G_(e,t,n){n||(n=t,t={}),typeof n!=`function`&&$(7);var r=[],i=function(){for(var e=0;e<r.length;++e)r[e]()},a={},o=function(e,t){W_(function(){n(e,t)})};W_(function(){o=n});for(var s=e.length-22;w_(e,s)!=101010256;--s)if(!s||e.length-s>65558)return o($(13,0,1),null),i;var c=C_(e,s+8);if(c){var l=c,u=w_(e,s+16),d=w_(e,s-20)==117853008;if(d){var f=w_(e,s-12);d=w_(e,f)==101075792,d&&(l=c=w_(e,f+32),u=w_(e,f+48))}for(var p=t&&t.filter,m=function(t){var n=R_(e,u,d),s=n[0],l=n[1],f=n[2],m=n[3],h=n[4],g=n[5],_=L_(e,g);u=h;var v=function(e,t){e?(i(),o(e,null)):(t&&(a[m]=t),--c||o(null,a))};if(!p||p({name:m,size:l,originalSize:f,compression:s})){if(!s)v(null,Xg(e,_,_+l));else if(s==8){var y=e.subarray(_,_+l);if(f<524288||l>.8*f)try{v(null,A_(y,{out:new Z(f)}))}catch(e){v(e,null)}else r.push(k_(y,{size:f},v))}else v($(14,`unknown compression type `+s,1),null)}else v(null,null)},h=0;h<l;++h)m(h)}else o(null,{});return i}function K_(e,t){for(var n={},r=e.length-22;w_(e,r)!=101010256;--r)(!r||e.length-r>65558)&&$(13);var i=C_(e,r+8);if(!i)return{};var a=w_(e,r+16),o=w_(e,r-20)==117853008;if(o){var s=w_(e,r-12);o=w_(e,s)==101075792,o&&(i=w_(e,s+32),a=w_(e,s+48))}for(var c=t&&t.filter,l=0;l<i;++l){var u=R_(e,a,o),d=u[0],f=u[1],p=u[2],m=u[3],h=u[4],g=u[5],_=L_(e,g);a=h,(!c||c({name:m,size:f,originalSize:p,compression:d}))&&(d?d==8?n[m]=A_(e.subarray(_,_+f),{out:new Z(p)}):$(14,`unknown compression type `+d):n[m]=Xg(e,_,_+f))}return n}var q_={"image/png":`png`,"image/jpeg":`jpg`,"image/webp":`webp`,"image/gif":`gif`,"image/svg+xml":`svg`},J_={png:`image/png`,jpg:`image/jpeg`,jpeg:`image/jpeg`,webp:`image/webp`,gif:`image/gif`,svg:`image/svg+xml`},Y_=new Set([`left`,`center`,`right`,`free`]),X_=new Set([`top`,`center`,`bottom`,`free`]),Z_=e=>{let t=e.toLowerCase().match(/\.([a-z0-9]+)$/);return t?.[1]&&J_[t[1]]?t[1]:null},Q_=(e,t)=>{let n=q_[t]??Z_(e.name);if(!n)throw Error(`Unsupported Tempera image type: ${t||e.name}`);return`images/${e.id}.${n}`},$_=e=>typeof e==`object`&&!!e&&!Array.isArray(e),ev=(e,t,n,r)=>typeof e==`number`&&Number.isFinite(e)?Math.min(r,Math.max(n,e)):t,tv=e=>{if(!$_(e)||typeof e.id!=`string`)return null;let t=e.id.trim();return!t||t.length>512||/[\\/\u0000-\u001F]/.test(t)?null:{id:t,name:typeof e.name==`string`&&e.name.trim()?e.name.trim():`image`,align:Y_.has(e.align)?e.align:dt.align,verticalAlign:X_.has(e.verticalAlign)?e.verticalAlign:dt.verticalAlign,scale:ev(e.scale,dt.scale,.05,2),opacity:ev(e.opacity,dt.opacity,0,1)}},nv=(e,...t)=>{for(let e of t){let t=Z_(e);if(t)return J_[t]}if(e.length>=8&&e[0]===137&&e[1]===80&&e[2]===78&&e[3]===71)return`image/png`;if(e.length>=3&&e[0]===255&&e[1]===216&&e[2]===255)return`image/jpeg`;if(e.length>=6&&I_(e.subarray(0,6)).startsWith(`GIF8`))return`image/gif`;if(e.length>=12&&I_(e.subarray(0,4))===`RIFF`&&I_(e.subarray(8,12))===`WEBP`)return`image/webp`;let n=I_(e.subarray(0,Math.min(e.length,2048))).replace(/^\uFEFF/,``).trimStart();return/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(n)?`image/svg+xml`:null},rv=(e,t)=>{let n=Object.keys(e),r=[];return t.forEach(t=>{let i=tv(t);if(!i)return;let a=`images/${i.id}`,o=n.find(e=>e===a||e.startsWith(`${a}.`)&&!!Z_(e));if(!o)return;let s=e[o];if(!s)return;let c=nv(s,o,i.name);c&&r.push({image:i,bytes:s,mimeType:c})}),r},iv=`folia-tempera-pool`,av=1,ov=536870912,sv=class extends Error{constructor(){super(`Tempera pool backup is too large to import`),this.name=`TemperaArchiveTooLargeError`}},cv=e=>{let t=0;return K_(e,{filter:e=>(t+=e.originalSize,!1)}),t},lv=e=>F_(JSON.stringify(e,null,2)),uv=(e,t)=>{let n=e[t];if(!n)throw Error(`Tempera pool zip is missing ${t}`);return JSON.parse(I_(n))},dv=e=>new Promise((t,n)=>{U_(e,{level:6},(e,r)=>e?n(e):t(r))}),fv=e=>new Promise((t,n)=>{G_(e,(e,r)=>e?n(e):t(r))}),pv=async e=>{let t={},n=new Set;await Promise.all(e.layerImages.map(async e=>{let r=await zf(e.id).catch(()=>null);r?.blob&&(t[Q_(e,r.mimeType||r.blob.type)]=new Uint8Array(await r.blob.arrayBuffer()),n.add(e.id))}));let r=e.layerImages.filter(e=>n.has(e.id));return t[`pool.json`]=lv({layerImages:r}),t[`meta.json`]=lv({kind:iv,schemaVersion:av,imageCount:r.length}),{blob:new Blob([await dv(t)],{type:`application/zip`}),exported:r.length,skipped:e.layerImages.length-r.length}},mv=async(e,t)=>{let n=t.maxImages??16,r=new Uint8Array(await e.arrayBuffer());if(cv(r)>ov)throw new sv;let i=await fv(r),a=uv(i,`meta.json`);if(a.kind!==iv||a.schemaVersion!==av)throw Error(`Not a Folia canvas-image backup`);let o=uv(i,`pool.json`),s=Array.isArray(o.layerImages)?o.layerImages:[],c=rv(i,s),l=new Set(t.existing.map(e=>e.id)),u=s.length-c.length,d=0,f=[],p=[],m=()=>{if(!t.signal?.aborted)return;let e=Error(`Tempera pool import was cancelled`);throw e.name=`AbortError`,e};try{m();for(let e=0;e<c.length;e+=1){if(f.length+t.existing.length>=n){d=c.length-e;break}m();let r=c[e],i=await Wf(new File([new Uint8Array(r.bytes)],r.image.name,{type:r.mimeType}));m();let a=!l.has(i.id)&&!f.some(e=>e.id===i.id)?i.id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}-${i.name}`,o={...i,id:a};await Bf(o),p.push(a),m(),f.push({...r.image,id:a,name:o.name||r.image.name}),l.add(a)}}catch(e){throw await Promise.all(p.map(e=>Vf(e).catch(()=>void 0))),e}return{layerImages:f,skipped:u,truncated:d}},hv=e=>typeof Blob<`u`&&e instanceof Blob,gv=e=>hv(e)?URL.createObjectURL(e):null,_v=/[<>:"/\\|?*\u0000-\u001F]/g,vv=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i,yv=(e,t=`download`)=>{let n=e.replace(_v,`_`).replace(/\s+/g,` `).trim().replace(/[. ]+$/,``);return n?vv.test(n)?`_${n}`:n:t},bv=(e=new Date)=>{let t=`${e.getMonth()+1}`.padStart(2,`0`),n=`${e.getDate()}`.padStart(2,`0`);return`${e.getFullYear()}-${t}-${n}`},xv=({isOpen:e,onClose:t,isDaylight:n=!1,title:r,description:i,headerActions:o,children:s,footer:c,maxWidthClass:l=`max-w-md`,closeDisabled:u=!1,closeDisabledTitle:d})=>{let f=n?`bg-white/90 border-white/30`:`bg-zinc-900/95 border-white/10`,p=n?`text-zinc-900`:`text-white`,m=n?`text-zinc-500`:`text-zinc-400`,h=n?`hover:bg-zinc-200/60`:`hover:bg-white/10`,g=(0,V.useRef)(!1);return(0,H.jsx)(E,{children:e&&(0,H.jsx)(D.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},"data-folia-keyboard-window":`true`,className:`fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4`,onMouseDown:e=>{g.current=e.target===e.currentTarget},onClick:e=>{u||e.target===e.currentTarget&&g.current&&t()},children:(0,H.jsxs)(D.div,{initial:{scale:.94,opacity:0},animate:{scale:1,opacity:1},exit:{scale:.94,opacity:0},transition:{type:`spring`,stiffness:280,damping:24},onClick:e=>e.stopPropagation(),className:`relative w-full ${l} rounded-3xl border ${f} p-6 shadow-2xl backdrop-blur-sm`,children:[(0,H.jsx)(`button`,{type:`button`,onClick:t,disabled:u,title:u?d:void 0,className:`absolute right-4 top-4 rounded-full p-2 transition-colors ${u?`opacity-20`:`opacity-50 hover:opacity-100 ${h}`} ${p}`,children:(0,H.jsx)(a,{size:18})}),(0,H.jsxs)(`div`,{className:`mb-5 pr-10`,children:[(0,H.jsxs)(`div`,{className:`flex items-center justify-between gap-3`,children:[(0,H.jsx)(`h2`,{className:`min-w-0 text-xl font-bold ${p}`,children:r}),o&&(0,H.jsx)(`div`,{className:`shrink-0`,children:o})]}),i&&(0,H.jsx)(`p`,{className:`mt-2 whitespace-pre-line text-sm ${m}`,children:i})]}),(0,H.jsx)(`div`,{children:s}),c&&(0,H.jsx)(`div`,{className:`mt-5 flex items-center justify-end gap-3`,children:c})]})})})},Sv=({disabled:e,appendDisabled:t,isDaylight:n,tokens:r,t:i,onChoose:a})=>{let[o,s]=(0,V.useState)(!1),c=(0,V.useRef)(null);(0,V.useEffect)(()=>{e&&s(!1)},[e]),(0,V.useEffect)(()=>{if(!o)return;let e=e=>{c.current?.contains(e.target)||s(!1)},t=e=>{e.key===`Escape`&&(e.preventDefault(),e.stopPropagation(),s(!1))};return document.addEventListener(`mousedown`,e),document.addEventListener(`keydown`,t),()=>{document.removeEventListener(`mousedown`,e),document.removeEventListener(`keydown`,t)}},[o]);let l=e=>{s(!1),a(e)};return(0,H.jsxs)(`div`,{ref:c,className:`relative inline-flex`,children:[(0,H.jsxs)(`button`,{type:`button`,disabled:e,onClick:()=>s(e=>!e),"aria-haspopup":`menu`,"aria-expanded":o,className:`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-35 disabled:hover:bg-transparent ${r.hoverSurfaceClass}`,style:{color:r.textPrimary,borderColor:r.line},children:[(0,H.jsx)(T,{size:14}),i(`options.temperaImportImages`)||`导入备份`,(0,H.jsx)(w,{size:12,className:`transition-transform ${o?`rotate-180`:``}`})]}),o&&(0,H.jsxs)(`div`,{role:`menu`,className:`absolute bottom-full left-0 z-30 mb-2 w-52 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-xl`,style:{color:r.textPrimary,borderColor:r.line,backgroundColor:n?`rgba(255,255,255,0.98)`:`rgba(24,24,27,0.98)`},children:[(0,H.jsxs)(`button`,{type:`button`,role:`menuitem`,disabled:t,onClick:()=>l(`append`),className:`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors disabled:opacity-35 disabled:hover:bg-transparent ${r.hoverSurfaceClass}`,children:[(0,H.jsx)(_,{size:14,className:`shrink-0`}),i(`options.temperaImportAppendImages`)||`追加到当前图片池`]}),(0,H.jsxs)(`button`,{type:`button`,role:`menuitem`,onClick:()=>l(`replace`),className:`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors ${r.hoverSurfaceClass}`,children:[(0,H.jsx)(f,{size:14,className:`shrink-0`}),i(`options.temperaImportReplaceImages`)||`替换当前图片池`]})]})]})},Cv=e=>({backgroundImage:`linear-gradient(45deg, `+e+` 25%, transparent 25%),linear-gradient(-45deg, `+e+` 25%, transparent 25%),linear-gradient(45deg, transparent 75%, `+e+` 75%),linear-gradient(-45deg, transparent 75%, `+e+` 75%)`,backgroundSize:`14px 14px`,backgroundPosition:`0 0, 0 7px, 7px -7px, -7px 0`}),wv=[`left`,`center`,`right`],Tv=[`top`,`center`,`bottom`],Ev=({active:e,label:t,tokens:n,onClick:r})=>(0,H.jsx)(`button`,{type:`button`,onClick:r,"aria-pressed":e,className:`rounded-full border px-3 py-1.5 text-xs transition-colors`,style:{borderColor:e?n.textPrimary:n.line,color:n.textPrimary,opacity:e?1:.55},children:t}),Dv=V.memo(({image:e,thumbnail:t,t:r,tokens:i,rangeInputClass:a,onPatch:o,onRemove:s})=>{let c=(0,V.useMemo)(()=>tp(e,Lt(`settings:${e.id}`)),[e]),l={left:r(`options.temperaLayerAlignLeft`),center:r(`options.temperaLayerAlignCenter`),right:r(`options.temperaLayerAlignRight`)},u={top:r(`options.temperaLayerAlignTop`),center:r(`options.temperaLayerAlignMiddle`),bottom:r(`options.temperaLayerAlignBottom`)};return(0,H.jsxs)(`div`,{className:`space-y-3 rounded-2xl border p-3`,style:{borderColor:i.line},children:[(0,H.jsxs)(`div`,{className:`relative w-full overflow-hidden rounded-xl border`,style:{...Cv(i.checkerTint),borderColor:i.line,aspectRatio:`16 / 9`},children:[t?(0,H.jsx)(`img`,{src:t,alt:e.name,className:`pointer-events-none absolute w-auto max-w-none object-contain`,style:{height:`${c.scale*100}%`,left:`${c.x*100}%`,top:`${c.y*100}%`,transform:`translate(-50%, -50%) rotate(${c.rotation}rad) scaleX(${c.flip?-1:1})`,opacity:c.opacity}}):(0,H.jsx)(`div`,{className:`absolute inset-0 flex items-center justify-center`,children:(0,H.jsx)(S,{size:18,className:`opacity-30`,style:{color:i.textSecondary}})}),(0,H.jsx)(`div`,{className:`absolute inset-0 z-10 grid grid-cols-3 grid-rows-3`,children:Tv.flatMap(t=>wv.map(n=>{let a=e.align===n&&e.verticalAlign===t,s=r(`options.temperaLayerAlignPosition`,{vertical:u[t],horizontal:l[n]});return(0,H.jsx)(`button`,{type:`button`,onClick:()=>o(e.id,{align:n,verticalAlign:t}),"aria-label":s,"aria-pressed":a,title:s,className:`group flex items-center justify-center border transition-colors ${i.hoverSurfaceClass}`,style:{borderColor:i.gridLine},children:(0,H.jsx)(`span`,{className:`h-2.5 w-2.5 rounded-full border transition-all group-hover:scale-125`,style:{borderColor:a?i.accent:i.markerBorder,backgroundColor:a?i.accent:i.markerFill,boxShadow:a?i.markerHalo:void 0}})},`${t}-${n}`)}))}),(0,H.jsx)(`button`,{type:`button`,onClick:()=>s(e.id),className:`absolute right-2 top-2 z-20 rounded-full border p-1.5 backdrop-blur-sm transition-colors ${i.overlayButtonClass}`,"aria-label":r(`options.temperaRemoveLayerImage`),style:{color:i.textPrimary,borderColor:i.line},children:(0,H.jsx)(n,{size:13})})]}),(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsx)(`span`,{className:`block break-all text-xs leading-snug opacity-70`,style:{color:i.textPrimary},children:e.name}),(0,H.jsx)(`p`,{className:`text-xs opacity-50`,style:{color:i.textSecondary},children:r(`options.temperaLayerAlignGridHint`)}),(0,H.jsxs)(`div`,{className:`flex flex-wrap gap-1.5`,children:[(0,H.jsx)(Ev,{label:r(`options.temperaLayerAlignVerticalRandom`),tokens:i,active:e.verticalAlign===`free`&&e.align!==`free`,onClick:()=>o(e.id,{align:e.align===`free`?`center`:e.align,verticalAlign:`free`})}),(0,H.jsx)(Ev,{label:r(`options.temperaLayerAlignHorizontalRandom`),tokens:i,active:e.align===`free`&&e.verticalAlign!==`free`,onClick:()=>o(e.id,{align:`free`,verticalAlign:e.verticalAlign===`free`?`center`:e.verticalAlign})}),(0,H.jsx)(Ev,{label:r(`options.temperaLayerAlignFree`),tokens:i,active:e.align===`free`&&e.verticalAlign===`free`,onClick:()=>o(e.id,{align:`free`,verticalAlign:`free`})})]})]}),(0,H.jsx)(Fm,{label:r(`options.temperaLayerImageScale`),value:e.scale,min:.05,max:2,step:.01,rangeInputClass:a,onChange:t=>o(e.id,{scale:t})}),(0,H.jsx)(Fm,{label:r(`options.temperaLayerImageOpacity`),value:e.opacity,min:0,max:1,step:.01,rangeInputClass:a,onChange:t=>o(e.id,{opacity:t})})]})}),Ov={textPrimary:`#18181b`,textSecondary:`#52525b`,accent:`#18181b`,line:`rgba(0,0,0,0.12)`,lineStrong:`rgba(0,0,0,0.28)`,gridLine:`rgba(0,0,0,0.08)`,surface:`rgba(0,0,0,0.04)`,hoverSurfaceClass:`hover:bg-black/[0.06]`,markerBorder:`rgba(0,0,0,0.35)`,markerFill:`rgba(255,255,255,0.7)`,markerHalo:`0 0 0 3px rgba(255,255,255,0.85)`,checkerTint:`rgba(0,0,0,0.07)`,overlayButtonClass:`bg-white/75 hover:bg-white`},kv={textPrimary:`#fafafa`,textSecondary:`#a1a1aa`,accent:`#fafafa`,line:`rgba(255,255,255,0.12)`,lineStrong:`rgba(255,255,255,0.18)`,gridLine:`rgba(255,255,255,0.06)`,surface:`rgba(255,255,255,0.05)`,hoverSurfaceClass:`hover:bg-white/10`,markerBorder:`rgba(255,255,255,0.45)`,markerFill:`rgba(0,0,0,0.2)`,markerHalo:`0 0 0 3px rgba(0,0,0,0.35)`,checkerTint:`rgba(255,255,255,0.07)`,overlayButtonClass:`bg-black/50 hover:bg-black/70`},Av=e=>e?Ov:kv,jv=e=>({"--text-primary":e.textPrimary,"--text-secondary":e.textSecondary,"--text-accent":e.accent,color:e.textPrimary}),Mv={adding:{key:`options.temperaPoolBusyAdd`,fallback:`正在添加…`},exporting:{key:`options.temperaPoolBusyExport`,fallback:`正在导出…`},importing:{key:`options.temperaPoolBusyImport`,fallback:`正在导入…`}},Nv=e=>e===`adding`||e===`importing`,Pv=({label:e,active:t,tokens:n,onClick:r})=>(0,H.jsx)(`button`,{type:`button`,onClick:r,"aria-pressed":t,className:`rounded-full border px-3 py-1.5 text-xs transition-colors`,style:{borderColor:t?n.textPrimary:n.line,color:n.textPrimary,opacity:t?1:.55},children:e}),Fv=({label:e,icon:t,tokens:n,disabled:r,onClick:i})=>(0,H.jsxs)(`button`,{type:`button`,onClick:i,disabled:r,className:`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-35 disabled:hover:bg-transparent ${n.hoverSurfaceClass}`,style:{color:n.textPrimary,borderColor:n.line},children:[t,e]}),Iv=({isOpen:e,onClose:t,isDaylight:r,t:a,images:o,thumbnails:s,depth:c,frequency:l,maxImages:u,rangeInputClass:d,onAddFiles:f,onPatch:p,onRemove:h,onClearAll:g,onDepthChange:_,onFrequencyChange:v,onImportPool:y,onExportPool:b,busy:x})=>{let C=(0,V.useRef)(null),w=(0,V.useRef)(null),T=(0,V.useRef)(`append`),[E,D]=(0,V.useState)(!1),O=o.length>=u,k=Av(r),A=Nv(x),j=(0,V.useCallback)(()=>{A||t()},[A,t]),ee=(0,V.useCallback)(e=>{T.current=e,w.current?.click()},[]),M=(0,V.useCallback)(e=>{e.preventDefault(),D(!1);let t=Array.from(e.dataTransfer.files??[]),n=t.find(e=>e.name.toLowerCase().endsWith(`.zip`));n?y(n,`append`):f(t)},[f,y]);return typeof document>`u`?null:(0,Rt.createPortal)((0,H.jsxs)(xv,{isOpen:e,onClose:j,closeDisabled:A,closeDisabledTitle:A?a(`options.temperaPoolWaitToSave`)||`还有图片在处理，完成后才能保存`:void 0,isDaylight:r,title:a(`options.temperaImageSection`)||`画布图片`,description:`${a(`options.temperaLayerImageHint`)||`每个分镜会从图片池里随机取一张，位置由对齐倾向决定。`}\n${a(`options.temperaLayerImageSaveHint`)||`改动会在关闭本窗口时写入。`}`,maxWidthClass:`max-w-3xl`,headerActions:(0,H.jsxs)(`button`,{type:`button`,disabled:o.length===0||x!==`idle`,onClick:g,className:`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-35 disabled:hover:bg-transparent ${k.hoverSurfaceClass}`,style:{color:k.textPrimary,borderColor:k.line},children:[(0,H.jsx)(n,{size:13}),a(`options.temperaClearLayerImages`)]}),footer:(0,H.jsxs)(`div`,{className:`flex w-full flex-wrap items-center gap-2`,children:[(0,H.jsx)(Fv,{label:a(`options.temperaAddLayerImage`)||`添加图片`,icon:(0,H.jsx)(S,{size:14}),tokens:k,disabled:O||x!==`idle`,onClick:()=>C.current?.click()}),(0,H.jsx)(Sv,{disabled:x!==`idle`,appendDisabled:O,isDaylight:r,tokens:k,t:a,onChoose:ee}),(0,H.jsx)(Fv,{label:a(`options.temperaExportImages`)||`导出备份`,icon:(0,H.jsx)(i,{size:14}),tokens:k,disabled:o.length===0||x!==`idle`,onClick:b}),(0,H.jsxs)(`span`,{className:`ml-auto flex items-center gap-3`,children:[x===`idle`?(0,H.jsx)(`span`,{className:`text-xs opacity-60`,style:{color:k.textSecondary},children:a(`options.temperaImagePoolCount`,{defaultValue:`{{count}} / {{max}}`,count:o.length,max:u})}):(0,H.jsxs)(`span`,{className:`inline-flex items-center gap-1.5 text-xs`,style:{color:k.textPrimary},role:`status`,children:[(0,H.jsx)(m,{size:13,className:`animate-spin`}),a(Mv[x].key)||Mv[x].fallback]}),(0,H.jsx)(`button`,{type:`button`,onClick:j,disabled:A,title:A?a(`options.temperaPoolWaitToSave`)||`还有图片在处理，完成后才能保存`:void 0,className:`rounded-full border px-5 py-2 text-sm transition-colors disabled:opacity-35 disabled:hover:bg-transparent ${k.hoverSurfaceClass}`,style:{color:k.textPrimary,borderColor:k.line},children:a(`options.temperaLayerImageSave`)||`保存`})]})]}),children:[(0,H.jsxs)(`div`,{onDragOver:e=>{e.preventDefault(),D(!0)},onDragLeave:()=>D(!1),onDrop:M,className:`flex min-h-0 flex-col gap-4 rounded-2xl border border-dashed p-4`,style:{borderColor:E?k.textPrimary:`transparent`},children:[(0,H.jsxs)(`div`,{className:`max-h-[62vh] space-y-5 overflow-y-auto pr-1`,style:jv(k),children:[(0,H.jsxs)(`div`,{className:`space-y-3 rounded-2xl border p-4`,style:{borderColor:k.line,backgroundColor:k.surface},children:[(0,H.jsxs)(`div`,{className:`space-y-2`,children:[(0,H.jsx)(`span`,{className:`text-sm`,style:{color:k.textPrimary},children:a(`options.temperaLayerImageDepth`)||`图层位置`}),(0,H.jsx)(`div`,{className:`flex flex-wrap gap-2`,children:[[`back`,a(`options.temperaLayerImageBack`)||`歌词之后`],[`front`,a(`options.temperaLayerImageFront`)||`歌词之前`]].map(([e,t])=>(0,H.jsx)(Pv,{label:t,active:c===e,tokens:k,onClick:()=>_(e)},e))})]}),(0,H.jsx)(Fm,{label:a(`options.temperaLayerImageFrequency`)||`出现频率`,value:l,min:0,max:1,step:.05,rangeInputClass:d,onChange:v})]}),o.length===0?(0,H.jsx)(`p`,{className:`py-6 text-center text-xs opacity-50`,style:{color:k.textSecondary},children:a(`options.temperaLayerImageEmpty`)||`还没有图片。加入立绘、logo 或纹理后，每个分镜会随机取用。`}):(0,H.jsx)(`div`,{className:`grid gap-3 sm:grid-cols-2`,children:o.map(e=>(0,H.jsx)(Dv,{image:e,thumbnail:s.get(e.id),t:a,tokens:k,rangeInputClass:d,onPatch:p,onRemove:h},e.id))})]}),!O&&(0,H.jsx)(`p`,{className:`text-xs opacity-50`,style:{color:k.textSecondary},children:a(`options.temperaLayerImageDropHint`)||`也可以把文件拖到这里`})]}),(0,H.jsx)(`input`,{ref:C,type:`file`,accept:`image/png,image/jpeg,image/webp,image/gif,image/svg+xml`,multiple:!0,className:`hidden`,onChange:e=>{f(Array.from(e.target.files??[])),e.target.value=``}}),(0,H.jsx)(`input`,{ref:w,type:`file`,accept:`application/zip,.zip`,className:`hidden`,onChange:e=>{let t=e.target.files?.[0];t&&y(t,T.current),e.target.value=``}})]}),document.body)},Lv=e=>{let[t,n]=(0,V.useState)(()=>new Map),r=e.map(e=>e.id).join(`|`);return(0,V.useEffect)(()=>{let e=!1,t=[];return r.length===0?(n(new Map),()=>{e=!0}):(Gf(r.split(`|`).map(e=>({id:e}))).then(r=>{let i=new Map;r.forEach((e,n)=>{let r=URL.createObjectURL(e);t.push(r),i.set(n,r)}),e?t.forEach(e=>URL.revokeObjectURL(e)):n(i)}).catch(()=>void 0),()=>{e=!0,t.forEach(e=>URL.revokeObjectURL(e))})},[r]),t},Rv={add:{addedKey:`options.temperaLayerImagesAdded`,addedDefault:`已添加 {{count}} 张图片`,notAddedKey:`options.temperaLayerImagesNotAdded`,notAddedDefault:`未添加 {{count}} 张图片`},import:{addedKey:`options.temperaPoolImported`,addedDefault:`已导入 {{count}} 张图片`,notAddedKey:`options.temperaPoolImportNotAdded`,notAddedDefault:`未导入 {{count}} 张图片`}},zv=(e,t)=>e.length===t.length&&e.every((e,n)=>e.id===t[n].id&&e.align===t[n].align&&e.verticalAlign===t[n].verticalAlign&&e.scale===t[n].scale&&e.opacity===t[n].opacity),Bv=({images:e,depth:t,frequency:n,rangeInputClass:i,isDaylight:a,onCommit:o})=>{let{t:s}=c(),[l,u]=(0,V.useState)(!1),[d,f]=(0,V.useState)({layerImages:e,layerImageDepth:t,layerImageFrequency:n}),[p,m]=(0,V.useState)([]),[h,g]=(0,V.useState)(`idle`),_=(0,V.useRef)(null),v=Lv(l?d.layerImages:e),y=(0,V.useCallback)(()=>{f({layerImages:e,layerImageDepth:t,layerImageFrequency:n}),m([]),u(!0)},[t,n,e]),b=(0,V.useCallback)(()=>{Nv(h)||(u(!1),Promise.all(p.map(e=>Vf(e).catch(()=>void 0))),m([]),d.layerImageDepth===t&&d.layerImageFrequency===n&&zv(d.layerImages,e)||o(d))},[h,t,d,n,e,o,p]),x=(0,V.useRef)(b);x.current=b;let C=(0,V.useRef)(l);C.current=l;let w=(0,V.useRef)(!0);(0,V.useEffect)(()=>(w.current=!0,()=>{w.current=!1,_.current?.abort(),C.current&&x.current()}),[]);let T=(0,V.useCallback)((e,t,n,r)=>{if(!w.current)return;let i=Rv[e],a=[];t>0&&a.push(s(i.addedKey,{defaultValue:i.addedDefault,count:t})),n>0&&(a.push(s(i.notAddedKey,{defaultValue:i.notAddedDefault,count:n})),console.info(`[Tempera] canvas image pool left files out`,r)),Ld({type:t===0?`error`:`success`,text:a.join(` · `)})},[s]),E=(0,V.useCallback)(async e=>{if(e.length===0||h!==`idle`)return;let t=new AbortController;_.current=t,g(`adding`);let n=[];try{let r=Math.max(0,16-d.layerImages.length),i=e.filter(Rf),a=i.slice(0,r),o=i.length-a.length,s=e.length-i.length;if(a.length===0){T(`add`,0,e.length,{total:e.length,unsupported:s,overCap:o});return}let c=(await Promise.all(a.map(e=>Wf(e).catch(e=>(console.error(`[Tempera] canvas image could not be stored:`,e),null))))).filter(e=>e!==null);if(t.signal.aborted)return;if(n=(await Promise.all(c.map(e=>Bf(e).then(()=>e).catch(e=>(console.error(`[Tempera] canvas image could not be saved:`,e),null))))).filter(e=>e!==null),t.signal.aborted||!w.current){await Promise.all(n.map(e=>Vf(e.id).catch(()=>void 0)));return}f(e=>({...e,layerImages:[...e.layerImages,...n.map(e=>({...dt,id:e.id,name:e.name}))].slice(0,16)})),T(`add`,n.length,s+o+(a.length-n.length),{total:e.length,unsupported:s,overCap:o,unreadable:a.length-c.length,unsaved:c.length-n.length})}finally{_.current===t&&(_.current=null),w.current&&g(`idle`)}},[h,d.layerImages.length,T]),D=(0,V.useCallback)((e,t)=>{f(n=>({...n,layerImages:n.layerImages.map(n=>n.id===e?{...n,...t}:n)}))},[]),O=(0,V.useCallback)(e=>{f(t=>({...t,layerImages:t.layerImages.filter(t=>t.id!==e)})),m(t=>t.includes(e)?t:[...t,e])},[]),k=(0,V.useCallback)(()=>{f(e=>({...e,layerImages:[]})),m(e=>Array.from(new Set([...e,...d.layerImages.map(e=>e.id)])))},[d.layerImages]),A=(0,V.useCallback)(async()=>{if(h===`idle`){g(`exporting`);try{let e=await pv({layerImages:d.layerImages});if(e.exported===0)throw Error(`Tempera pool export held no image`);let t=gv(e.blob);if(!t)throw TypeError(`Tempera pool export must produce a Blob`);let n=document.createElement(`a`);n.href=t,n.download=`${yv(s(`options.temperaExportBaseName`)||`凝彩参数-画布图片备份`)}-${bv()}.zip`,document.body.appendChild(n),n.click(),n.remove(),window.setTimeout(()=>URL.revokeObjectURL(t),0);let r=[s(`options.temperaPoolExported`,{defaultValue:`已导出 {{count}} 张图片`,count:e.exported})];e.skipped>0&&r.push(s(`options.temperaPoolExportSkipped`,{defaultValue:`{{count}} 张的原文件已丢失，未写入备份`,count:e.skipped})),Ld({type:`success`,text:r.join(` · `)})}catch(e){console.error(`[Tempera] canvas image pool export failed:`,e),Ld({type:`error`,text:s(`options.temperaPoolExportFailed`)||`导出失败`})}finally{g(`idle`)}}},[h,d.layerImages,s]),j=(0,V.useCallback)(async(e,t)=>{if(h!==`idle`||t===`replace`&&d.layerImages.length>0&&!window.confirm(s(`options.temperaImportConfirmReplace`,{defaultValue:`替换导入会先清空当前 {{count}} 张图片，确定继续？`,count:d.layerImages.length})))return;let n=new AbortController;_.current=n,g(`importing`);try{let r=await mv(e,{existing:t===`append`?d.layerImages:[],signal:n.signal});if(n.signal.aborted||!w.current){await Promise.all(r.layerImages.map(e=>Vf(e.id).catch(()=>void 0)));return}if(r.layerImages.length===0){console.warn(`[Tempera] canvas image pool import added nothing`,{file:e.name,skipped:r.skipped,truncated:r.truncated});let t=r.skipped+r.truncated;Ld({type:`error`,text:r.truncated>0?s(`options.temperaPoolImportNotAdded`,{defaultValue:`未导入 {{count}} 张图片`,count:t}):s(`options.temperaPoolImportEmpty`)||`这份备份里没有可用的图片`});return}t===`replace`&&m(e=>Array.from(new Set([...e,...d.layerImages.map(e=>e.id)]))),f(e=>({...e,layerImages:(t===`append`?e.layerImages:[]).concat(r.layerImages)})),T(`import`,r.layerImages.length,r.skipped+r.truncated,{file:e.name,mode:t,skipped:r.skipped,truncated:r.truncated})}catch(e){if(e?.name===`AbortError`)return;console.error(`[Tempera] canvas image pool import failed:`,e),Ld({type:`error`,text:e instanceof sv?s(`options.temperaPoolImportTooLarge`)||`已取消导入：备份解压后预计超过 512 MB，疑似损坏或压缩炸弹`:s(`options.temperaPoolImportFailed`)||`导入失败`})}finally{_.current===n&&(_.current=null),w.current&&g(`idle`)}},[h,d.layerImages,T,s]);return(0,H.jsxs)(`div`,{className:`space-y-3`,children:[(0,H.jsx)(`p`,{className:`text-xs leading-relaxed opacity-55`,style:{color:`var(--text-secondary)`},children:s(`options.temperaLayerImageHint`)||`每个分镜会从图片池里随机取一张，位置由对齐倾向决定。`}),(0,H.jsxs)(`button`,{type:`button`,onClick:y,className:`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${a?`border-black/10 bg-black/[0.04] hover:bg-black/[0.07]`:`border-white/10 bg-white/5 hover:bg-white/10`}`,children:[e.length===0?(0,H.jsx)(`span`,{className:`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed ${a?`border-black/15`:`border-white/15`}`,style:{color:`var(--text-secondary)`},children:(0,H.jsx)(S,{size:16,className:`opacity-60`})}):(0,H.jsxs)(`span`,{className:`flex shrink-0 -space-x-2`,children:[e.slice(0,4).map(e=>(0,H.jsx)(`span`,{className:`h-12 w-12 overflow-hidden rounded-xl border ${a?`border-black/15 bg-black/10`:`border-white/15 bg-black/30`}`,children:v.get(e.id)&&(0,H.jsx)(`img`,{src:v.get(e.id),alt:e.name,className:`h-full w-full object-cover`})},e.id)),e.length>4&&(0,H.jsxs)(`span`,{className:`flex h-12 w-12 items-center justify-center rounded-xl border text-xs ${a?`border-black/15 bg-black/[0.06]`:`border-white/15 bg-black/50`}`,style:{color:`var(--text-secondary)`},children:[`+`,e.length-4]})]}),(0,H.jsx)(`span`,{className:`ml-auto shrink-0 text-sm`,style:{color:`var(--text-primary)`},children:e.length===0?s(`options.temperaAddLayerImage`)||`添加图片`:s(`options.temperaImagePoolCount`,{defaultValue:`{{count}} / {{max}}`,count:e.length,max:16})}),(0,H.jsx)(r,{size:16,className:`shrink-0 opacity-50`,style:{color:`var(--text-secondary)`}})]}),(0,H.jsx)(Iv,{isOpen:l,onClose:b,isDaylight:a,t:s,images:d.layerImages,thumbnails:v,depth:d.layerImageDepth,frequency:d.layerImageFrequency,maxImages:16,rangeInputClass:i,onAddFiles:e=>void E(e),onPatch:D,onRemove:O,onClearAll:k,onDepthChange:e=>f(t=>({...t,layerImageDepth:e})),onFrequencyChange:e=>f(t=>({...t,layerImageFrequency:e})),onImportPool:(e,t)=>void j(e,t),onExportPool:()=>void A(),busy:h})]})},Vv=({t:e,isDaylight:t,theme:n,rangeInputClass:r,controlCardBg:i,temperaTuning:a=ot,onTemperaTuningChange:o,onSliderPointerDown:s,onSliderCommit:c})=>{let l=(0,V.useMemo)(()=>[{value:!0,label:e(`options.temperaToggleOn`)||`开启`},{value:!1,label:e(`options.temperaToggleOff`)||`关闭`}],[e]),u=(0,V.useMemo)(()=>[{value:`duo`,label:e(`options.temperaColorModeDuo`)||`主题双色`},{value:`mono`,label:e(`options.temperaColorModeMono`)||`黑白灰`},{value:`gradient`,label:e(`options.temperaColorModeGradient`)||`封面渐变`}],[e]),d=[{key:`showBlocks`,label:e(`options.temperaShowBlocks`)||`色块场景`},{key:`showDecor`,label:e(`options.temperaShowDecor`)||`装饰元素`},{key:`showCornerMarks`,label:e(`options.temperaShowCornerMarks`)||`边角线框`},{key:`textInversion`,label:e(`options.temperaTextInversion`)||`文字动态反色`},{key:`enableTransitions`,label:e(`options.temperaEnableTransitions`)||`场景转场`}],f=[{key:`cameraIntensity`,label:e(`options.temperaCameraIntensity`)},{key:`glyphMotion`,label:e(`options.temperaGlyphMotion`)}];return(0,H.jsxs)(`div`,{className:`rounded-[24px] border border-white/10 p-4 space-y-4`,style:{backgroundColor:i},children:[(0,H.jsxs)(`div`,{className:`space-y-1`,children:[(0,H.jsx)(`div`,{className:`text-sm font-medium`,style:{color:`var(--text-primary)`},children:e(`options.temperaSettings`)}),(0,H.jsx)(`div`,{className:`text-xs opacity-50`,style:{color:`var(--text-secondary)`},children:e(`options.temperaSettingsDesc`)})]}),(0,H.jsx)(Nm,{title:e(`options.temperaImageSection`)||`画布图片`,children:(0,H.jsx)(Bv,{images:a.layerImages,depth:a.layerImageDepth,frequency:a.layerImageFrequency,rangeInputClass:r,isDaylight:t,onCommit:e=>o?.(e)})}),(0,H.jsx)(Nm,{title:e(`options.temperaQualitySection`),children:(0,H.jsxs)(`div`,{className:`rounded-2xl border p-3.5 space-y-2.5`,style:{borderColor:P(n.secondaryColor,t?.18:.14),backgroundColor:P(n.backgroundColor,t?.24:.34)},children:[(0,H.jsx)(Fm,{label:e(`options.temperaTextureResolution`),value:a.textureResolution,min:.5,max:4,step:.25,rangeInputClass:r,onChange:e=>o?.({textureResolution:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(`p`,{className:`text-xs leading-relaxed opacity-60`,style:{color:`var(--text-secondary)`},children:e(`options.temperaTexturePerformanceWarning`)})]})}),(0,H.jsxs)(Nm,{title:e(`options.temperaMotionSection`),children:[f.map(e=>(0,H.jsx)(Fm,{label:e.label,value:a[e.key],rangeInputClass:r,onChange:t=>o?.({[e.key]:t}),onPointerDown:s,onPointerUp:c},e.key)),(0,H.jsx)(Fm,{label:e(`options.temperaGlyphSettleStretch`)||`逐字入场时序`,value:a.glyphSettleStretch,min:0,max:1,step:.05,rangeInputClass:r,onChange:e=>o?.({glyphSettleStretch:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(`p`,{className:`text-xs leading-relaxed opacity-55`,style:{color:`var(--text-secondary)`},children:e(`options.temperaGlyphSettleStretchHint`)||`0 = 每字用同样的短窗口快速落位，切镜前画面已静止，适合快歌；1 = 整个分镜的字精确落在歌词结束那一刻，全程都在动，适合慢歌。`}),(0,H.jsx)(jp,{label:e(`options.temperaColorMode`),value:a.colorMode,options:u,onChange:e=>o?.({colorMode:e}),isDaylight:t,theme:n})]}),(0,H.jsxs)(Nm,{title:e(`options.temperaPostProcessSection`)||`后处理`,children:[(0,H.jsx)(jp,{label:e(`options.temperaPostProcessEnabled`)||`整体后处理滤镜`,value:a.postProcessEnabled,options:l,onChange:e=>o?.({postProcessEnabled:e}),isDaylight:t,theme:n}),a.postProcessEnabled&&(0,H.jsxs)(H.Fragment,{children:[(0,H.jsx)(jp,{label:e(`options.temperaPostProcessTextureCompression`)||`后处理纹理压缩`,value:a.postProcessTextureCompression,options:l,onChange:e=>o?.({postProcessTextureCompression:e}),isDaylight:t,theme:n}),(0,H.jsx)(`p`,{className:`text-xs leading-relaxed opacity-55`,style:{color:`var(--text-secondary)`},children:e(`options.temperaPostProcessTextureCompressionHint`)||`开启后后处理在 1x 纹理上运算再拉伸到画布，降低GPU和显存压力`}),(0,H.jsx)(Fm,{label:e(`options.temperaPostProcessGrain`)||`胶片颗粒`,value:a.postProcessGrain,min:0,max:1,step:.05,rangeInputClass:r,onChange:e=>o?.({postProcessGrain:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(Fm,{label:e(`options.temperaPostProcessContrast`)||`对比度增强`,value:a.postProcessContrast,min:0,max:1,step:.05,rangeInputClass:r,onChange:e=>o?.({postProcessContrast:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(Fm,{label:e(`options.temperaPostProcessRgbShift`)||`RGB 色差`,value:a.postProcessRgbShift,min:0,max:1,step:.05,rangeInputClass:r,onChange:e=>o?.({postProcessRgbShift:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(Fm,{label:e(`options.temperaPostProcessVignette`)||`暗角`,value:a.postProcessVignette,min:0,max:2,step:.05,rangeInputClass:r,onChange:e=>o?.({postProcessVignette:e}),onPointerDown:s,onPointerUp:c}),(0,H.jsx)(Fm,{label:e(`options.temperaPostProcessLensDistortion`)||`透镜扭曲`,value:a.postProcessLensDistortion,min:0,max:2,step:.05,rangeInputClass:r,onChange:e=>o?.({postProcessLensDistortion:e}),onPointerDown:s,onPointerUp:c})]})]}),(0,H.jsxs)(Nm,{title:e(`options.temperaLyricSection`)||`歌词分镜`,children:[(0,H.jsx)(jp,{label:e(`options.temperaWholeLineLyrics`)||`整句显示歌词`,value:a.wholeLineLyrics,options:l,onChange:e=>o?.({wholeLineLyrics:e}),isDaylight:t,theme:n}),(0,H.jsx)(`p`,{className:`text-xs leading-relaxed opacity-55`,style:{color:`var(--text-secondary)`},children:e(`options.temperaWholeLineLyricsHint`)||`关闭时一句歌词按 2~4 词切成多个分镜，字号可以放得很大；开启后整句留在同一个分镜里，长句会自动缩小字号。`})]}),(0,H.jsx)(Nm,{title:e(`options.temperaDisplaySection`),children:(0,H.jsx)(`div`,{className:`grid gap-4 sm:grid-cols-2`,children:d.map(e=>(0,H.jsx)(jp,{label:e.label,value:a[e.key],options:l,onChange:t=>o?.({[e.key]:t}),isDaylight:t,theme:n},e.key))})})]})},Hv=e({default:()=>Wv}),Uv=V.lazy(()=>u(()=>import(`./VisualizerTempera-BdhzyQb9.js`).then(e=>e.t),__vite__mapDeps([20,1]),import.meta.url)),Wv=mp({mode:`tempera`,order:20,labelKey:`ui.visualizerTempera`,labelFallback:`Tempera`,previewSeed:`tempera`,previewStartOffset:0,tuningKind:`tempera`,usesWordSegmentation:!0,render:e=>(0,H.jsx)(Uv,{...e}),renderSettingsPanel:e=>(0,H.jsx)(Vv,{...e}),resetSettings:({resetTemperaTuning:e,setDraftTemperaTuning:t})=>{t?.(ot),e?.()}}),Gv=e({default:()=>qv}),Kv=V.lazy(()=>u(()=>import(`./VisualizerTilt-CAvIcMuD.js`),__vite__mapDeps([21,1]),import.meta.url)),qv=mp({mode:`tilt`,order:70,labelKey:`ui.visualizerTilt`,labelFallback:`Tilt`,previewSeed:`tilt`,previewStartOffset:0,tuningKind:`tilt`,render:e=>(0,H.jsx)(Kv,{...e}),renderSettingsPanel:e=>(0,H.jsx)(Gp,{...e}),resetSettings:({resetTiltTuning:e})=>{e?.()}}),{entries:Jv,byMode:Yv}=(e=>{let t=Object.entries(e).map(([e,t])=>{if(!t.default)throw Error(`[VisualizerRegistry] Missing default export in ${e}`);return t.default}),n={};return t.forEach(e=>{if(n[e.mode])throw Error(`[VisualizerRegistry] Duplicate visualizer mode "${e.mode}"`);n[e.mode]=e}),{entries:[...t].sort((e,t)=>e.order-t.order),byMode:n}})(Object.assign({"./cadenza/entry.tsx":_p,"./cappella/entry.tsx":Qp,"./claddagh/entry.tsx":tm,"./classic/entry.tsx":im,"./diorama/entry.tsx":sm,"./fume/entry.tsx":um,"./hanabi/entry.tsx":Am,"./lumiere/entry.tsx":Km,"./machi/entry.tsx":fh,"./metaphor/entry.tsx":gh,"./monet/entry.tsx":Th,"./nebbia/entry.tsx":Yh,"./partita/entry.tsx":tg,"./pendolo/entry.tsx":ug,"./sonnet/entry.tsx":gg,"./still/entry.tsx":bg,"./tempera/entry.tsx":Hv,"./tilt/entry.tsx":Gv}));Be(`VisualizerRegistry`,Jv.map(e=>e.mode),Je);var Xv=e=>Yv[e]??Yv.classic,Zv=(e,t)=>{let n=Xv(e),r=t(n.labelKey);return!r||r===n.labelKey?n.labelFallback:r},Qv=`mineradio-folia-visual-assets-v1`,$v=`assets`,ey=new Set([`cappella_custom_avatar`,`cappella_custom_emoji_pack`,`monet_background_image`,`monet_portrait_image`,`lyrics_uploaded_font`]);function ty(e){if(!ey.has(e)&&!e.startsWith(`tempera_layer_image_`))throw Error(`Unsupported local visual asset`)}function ny(e,t){return new Promise((n,r)=>{if(typeof indexedDB>`u`){r(Error(`Local visual asset storage is unavailable`));return}let i=!1,a=indexedDB.open(Qv,1),o=e=>{i||(i=!0,r(e))};a.onupgradeneeded=()=>{a.result.objectStoreNames.contains($v)||a.result.createObjectStore($v)},a.onerror=()=>o(a.error||Error(`Unable to open local visual asset storage`)),a.onblocked=()=>o(Error(`Local visual asset storage is busy`)),a.onsuccess=()=>{let r=a.result;if(i)r.close();else{r.onversionchange=()=>r.close();try{let a=r.transaction($v,e),s;try{s=t(a.objectStore($v))}catch(e){throw a.abort(),e}a.oncomplete=()=>{r.close(),i||(i=!0,n(s.result))},a.onabort=()=>{r.close(),o(a.error||s.error||Error(`Local visual asset transaction aborted`))},a.onerror=()=>{r.close(),o(a.error||s.error||Error(`Local visual asset transaction failed`))}}catch(e){r.close(),o(e)}}}})}async function ry(e){return ty(e),await ny(`readonly`,t=>t.get(e))??null}async function iy(e,t){ty(e),await ny(`readwrite`,n=>n.put(t,e))}async function ay(e){ty(e),await ny(`readwrite`,t=>t.delete(e))}var oy=`mineradio-visual-assets-changed`;async function sy(e){let t=Object.keys(e);t.forEach(ty),t.length&&(await ny(`readwrite`,n=>{for(let r of t)n.put(e[r],r);return n.count()}),window.dispatchEvent(new Event(oy)))}var cy=e({default:()=>ly}),ly=Py({mode:`cadenza`,settingsKey:`cadenzaTuning`,settingsSetterKey:`handleSetCadenzaTuning`,apply:(e,t)=>({...e,cadenzaTuning:t})}),uy=e({default:()=>dy}),dy=Py({mode:`cappella`,settingsKey:`cappellaTuning`,settingsSetterKey:`handleSetCappellaTuning`,apply:(e,t)=>({...e,cappellaTuning:t})}),fy=e({default:()=>py}),py=Py({mode:`claddagh`,settingsKey:`claddaghTuning`,settingsSetterKey:`handleSetCladdaghTuning`,apply:(e,t)=>({...e,claddaghTuning:t})}),my=e({default:()=>hy}),hy=Py({mode:`classic`,settingsKey:`classicTuning`,settingsSetterKey:`handleSetClassicTuning`,apply:(e,t)=>({...e,classicTuning:t})}),gy=e({default:()=>_y}),_y=Py({mode:`diorama`,settingsKey:`dioramaTuning`,settingsSetterKey:`handleSetDioramaTuning`,apply:(e,t)=>({...e,dioramaTuning:t})}),vy=e({default:()=>yy}),yy=Py({mode:`fume`,settingsKey:`fumeTuning`,settingsSetterKey:`handleSetFumeTuning`,apply:(e,t)=>({...e,fumeTuning:t})}),by=e({default:()=>xy}),xy=Py({mode:`lumiere`,settingsKey:`lumiereTuning`,settingsSetterKey:`handleSetLumiereTuning`,apply:(e,t)=>({...e,lumiereTuning:t})}),Sy=e({default:()=>Cy}),Cy=Py({mode:`monet`,settingsKey:`monetTuning`,settingsSetterKey:`handleSetMonetTuning`,apply:(e,t)=>({...e,monetTuning:t})}),wy=e({default:()=>Ty}),Ty=Py({mode:`partita`,settingsKey:`partitaTuning`,settingsSetterKey:`handleSetPartitaTuning`,apply:(e,t)=>({...e,partitaTuning:t})}),Ey=e({default:()=>Dy}),Dy=Py({mode:`pendolo`,settingsKey:`pendoloTuning`,settingsSetterKey:`handleSetPendoloTuning`,apply:(e,t)=>({...e,pendoloTuning:t})}),Oy=e({default:()=>ky}),ky=Py({mode:`sonnet`,settingsKey:`sonnetTuning`,settingsSetterKey:`handleSetSonnetTuning`,apply:(e,t)=>({...e,sonnetTuning:t})}),Ay=e({default:()=>jy}),jy=Py({mode:`tempera`,settingsKey:`temperaTuning`,settingsSetterKey:`handleSetTemperaTuning`,apply:(e,t)=>({...e,temperaTuning:t})}),My=e({default:()=>Ny}),Ny=Py({mode:`tilt`,settingsKey:`tiltTuning`,settingsSetterKey:`handleSetTiltTuning`,apply:(e,t)=>({...e,tiltTuning:t})});function Py(e){return e}var Fy=Object.values(Object.assign({"./cadenza/tuning.ts":cy,"./cappella/tuning.ts":uy,"./claddagh/tuning.ts":fy,"./classic/tuning.ts":my,"./diorama/tuning.ts":gy,"./fume/tuning.ts":vy,"./hanabi/tuning.ts":Om,"./lumiere/tuning.ts":by,"./machi/tuning.ts":uh,"./metaphor/tuning.ts":Ce,"./monet/tuning.ts":Sy,"./nebbia/tuning.ts":tt,"./partita/tuning.ts":wy,"./pendolo/tuning.ts":Ey,"./sonnet/tuning.ts":Oy,"./tempera/tuning.ts":Ay,"./tilt/tuning.ts":My})).map(e=>e.default),Iy=new Map;Fy.forEach(e=>{if(Iy.has(e.mode))throw Error(`[VisualizerTuningRegistry] Duplicate adapter for "${e.mode}"`);Iy.set(e.mode,e)});var Ly=(e,t,n)=>{let r=Iy.get(e),i=n?.[e];return r?.apply&&i?r.apply(t,i):t};function Ry({onReady:e}){return(0,V.useEffect)(()=>{e()},[e]),null}var zy=({mode:e,onReady:t,...n})=>{let r=Ly(e,{...n,background:{...n.background,mode:n.background?.mode??`latent`}},n.visualizerTunings);return(0,H.jsxs)(H.Fragment,{children:[(0,H.jsxs)(V.Suspense,{fallback:null,children:[Xv(e).render(r),t&&(0,H.jsx)(Ry,{onReady:t})]}),(0,H.jsx)(Zt,{currentTime:r.currentTime,lines:r.lines,showText:r.showText??!0,theme:r.theme,subtitleTheme:r.subtitleTheme,isPlayerChromeHidden:r.isPlayerChromeHidden,hideTranslationSubtitle:r.hideTranslationSubtitle,showSubtitleTranslation:r.showSubtitleTranslation,subtitleContentMode:r.subtitleContentMode,showHarmonySubtitle:r.showHarmonySubtitle,harmonySubtitleBackground:r.harmonySubtitleBackground,subtitleFontScale:r.subtitleFontScale})]})};export{pr as $,rf as A,Vd as B,Kf as C,bn as Ct,_f as D,Zt as Dt,vf as E,Kt as Et,Jd as F,jd as G,Wd as H,$d as I,Pd as J,Md as K,Qd as L,Xd as M,Gd as N,df as O,Kd as P,dr as Q,Zd as R,Qf as S,Un as St,Df as T,An as Tt,Ld as U,Ud as V,Id as W,Ui as X,Wi as Y,Hi as Z,ip as _,xn as _t,iy as a,ur as at,Xf as b,Kn as bt,Zv as c,Jn as ct,pp as d,On as dt,fr as et,lp as f,tr as ft,ap as g,kn as gt,dp as h,Nn as ht,ay as i,rr as it,af as j,ff as k,Xv as l,nn as lt,sp as m,Hn as mt,oy as n,lr as nt,sy as o,tn as ot,up as p,Cn as pt,Fd as q,ry as r,nr as rt,Jv as s,en as st,zy as t,ir as tt,fp as u,fn as ut,rp as v,qn as vt,Pf as w,Sn as wt,Zf as x,Mn as xt,qf as y,Tn as yt,qd as z};