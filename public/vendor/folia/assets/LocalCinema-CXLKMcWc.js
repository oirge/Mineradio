import{u as e}from"./main-BnhFKVI6.js";import{a as t}from"./lucide-runtime-BjHQqonp.js";import{Ct as n}from"./lucide-icons-ki4h4-5_.js";import{T as r}from"./lucide-icons-BHi8PMzs.js";import{Di as i,Ot as a,go as o,wi as s}from"./localPlayerData-C0yChhmF.js";import{A as c,At as l,Ct as u,D as d,Et as f,H as p,K as m,L as ee,M as h,O as g,Ot as _,P as v,Q as y,X as te,Y as b,Z as x,_ as S,at as C,bt as w,ct as T,dt as E,f as ne,ft as D,gt as re,ht as ie,jt as ae,kt as O,n as k,nt as oe,pt as A,q as j,rt as se,st as ce,t as le,v as ue,w as M,y as N}from"./three-BlCQujZl.js";var P=e(t(),1);function de(e,t){let n=null,r=!1,i=e=>{e.isPrimary&&e.button===0&&!n&&(r=!1,e.target instanceof Element&&e.target.closest(`button, input, select, textarea, a, [data-scene-no-look]`)||(n={id:e.pointerId,x:e.clientX,y:e.clientY,dragging:!1}))},a=r=>{if(!n||n.id!==r.pointerId)return;let i=r.clientX-n.x,a=r.clientY-n.y;if(!n.dragging){if(Math.hypot(i,a)<5)return;n.dragging=!0,e.setPointerCapture(r.pointerId),e.dataset.looking=`true`}n.x=r.clientX,n.y=r.clientY,t(i*.005,a*.005)},o=t=>{n&&n.id===t.pointerId&&(r=n.dragging&&t.type===`pointerup`,n=null,delete e.dataset.looking)},s=e=>{r&&(r=!1,e.preventDefault(),e.stopPropagation())};return e.addEventListener(`pointerdown`,i,!0),e.addEventListener(`pointermove`,a),e.addEventListener(`pointerleave`,o),e.addEventListener(`pointerup`,o),e.addEventListener(`pointercancel`,o),e.addEventListener(`lostpointercapture`,o),e.addEventListener(`click`,s,!0),()=>{e.removeEventListener(`pointerdown`,i,!0),e.removeEventListener(`pointermove`,a),e.removeEventListener(`pointerleave`,o),e.removeEventListener(`pointerup`,o),e.removeEventListener(`pointercancel`,o),e.removeEventListener(`lostpointercapture`,o),e.removeEventListener(`click`,s,!0),delete e.dataset.looking}}var fe=.7,pe=(e,t)=>{let n=te.radToDeg(2*Math.atan(Math.min(t/e.aspect,.78)));Math.abs(n-e.fov)>1e-4&&(e.fov=n,e.updateProjectionMatrix())},F={halfWidth:9.5,ceiling:10.6,back:30},I={width:14,height:7.57,centerY:4.885},L={z:.4,halfWidth:8.2,top:9.7,pilasterInner:8.8,pilasterOuter:9.3},R={front:2,height:.95},z={first:5.6,pitch:1.05,count:14,flatRows:3,rise:.32,arcRadius:40,treadFront:.62},B={seatPitch:.56,centerSeats:7,aisleInner:3.92,aisleOuter:5.08,sideSeats:6},V={first:2.6,pitch:3.4,count:8,sconceY:4.6},H={z:3.4,width:1.3,height:2.4,signY:2.78},U={z0:1.15,z1:5.35,floorY:4.1,railY:5.15,endOut:.35,bowOut:.75,lampY:5.42,lampAt:[.26,.74]},me=e=>U.endOut+U.bowOut*Math.sin(Math.PI*e),he=e=>U.z0+(U.z1-U.z0)*U.lampAt[e],ge=()=>F.halfWidth-me(U.lampAt[0])+.08,_e={y:8.9,z:F.back+1},W={footY:1.02,footZ:1.92,footHalfWidth:L.halfWidth-.7},G=e=>z.arcRadius+e*z.pitch,ve=z.first-z.arcRadius,ye=(e,t)=>{let n=G(e);return ve+Math.sqrt(n*n-t*t)},be=(e,t)=>Math.asin(t/G(e)),xe=e=>Math.max(0,e-z.flatRows+1)*z.rise,Se=()=>{let e=[],t=B.seatPitch/2;for(let n=0;n<B.centerSeats;n+=1){let r=t+n*B.seatPitch;e.push(-r,r)}for(let n=0;n<B.sideSeats;n+=1){let r=B.aisleOuter+t+n*B.seatPitch;e.push(-r,r)}return e.sort((e,t)=>e-t)},Ce=e=>V.first+e*V.pitch,K=e=>e.toFixed(4),we=`
const float HALL_HALF_WIDTH = ${K(F.halfWidth)};
const float HALL_CEILING = ${K(F.ceiling)};
const float SCREEN_W = ${K(I.width)};
const float SCREEN_H = ${K(I.height)};
const float SCREEN_CY = ${K(I.centerY)};
const float PROSC_Z = ${K(L.z)};
const float PROSC_HALF_WIDTH = ${K(L.halfWidth)};
const float PILASTER_X = ${K((L.pilasterInner+L.pilasterOuter)/2)};
const float ROW_FIRST = ${K(z.first)};
const float ROW_PITCH = ${K(z.pitch)};
const float ROW_COUNT = ${K(z.count)};
const float ROW_FLAT = ${K(z.flatRows)};
const float ROW_RISE = ${K(z.rise)};
const float ROW_RADIUS = ${K(z.arcRadius)};
const float ROW_TREAD_FRONT = ${K(z.treadFront)};
const float AISLE_INNER = ${K(B.aisleInner)};
const float AISLE_OUTER = ${K(B.aisleOuter)};
const float SIDE_EDGE = ${K(B.aisleOuter+B.sideSeats*B.seatPitch)};
const float BAY_FIRST = ${K(V.first)};
const float BAY_PITCH = ${K(V.pitch)};
const float BAY_COUNT = ${K(V.count)};
const float SCONCE_Y = ${K(V.sconceY)};
const float EXIT_Z = ${K(H.z)};
const float EXIT_SIGN_Y = ${K(H.signY)};
const float FOOT_Y = ${K(W.footY)};
const float FOOT_Z = ${K(W.footZ)};
const float FOOT_HALF_WIDTH = ${K(W.footHalfWidth)};
const float PROJ_Y = ${K(_e.y)};
const float PROJ_Z = ${K(_e.z)};
const float BOX_LAMP_X = ${K(ge())};
const float BOX_LAMP_Y = ${K(U.lampY)};
const float BOX_LAMP_Z0 = ${K(he(0))};
const float BOX_LAMP_Z1 = ${K(he(1))};
`,Te=()=>[-1,1].flatMap(e=>[0,1].map(t=>[e*ge(),U.lampY,he(t)])),q={CARPET:0,WALL:1,PILASTER:2,PILASTER_FACE:3,CEILING:4,BEAM:5,COVE:6,PROSC_WALL:7,GOLD:8,MASKING:9,CURTAIN:10,FRINGE:11,STAGE_FRONT:12,STAGE_TOP:13,SEAT_FABRIC:14,SEAT_SHELL:15,SEAT_ARM:16,DOOR:17,EXIT_SIGN:18,EXIT_HOUSING:19,SCONCE_GLASS:20,BRASS:21,AUDIENCE:22,BOX_FRONT:23,BOX_LAMP:24},Ee=Object.entries(q).map(([e,t])=>`const int M_${e} = ${t};`).join(`
`),De=(e,t)=>[e[0]-t[0],e[1]-t[1],e[2]-t[2]],Oe=(e,t)=>[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]],ke=e=>{let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]},Ae=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2],je=class{constructor(){this.positions=[],this.normals=[],this.uvs=[],this.matShade=[],this.indices=[]}vertex(e,t,n,r,i,a){return this.positions.push(e[0],e[1],e[2]),this.normals.push(t[0],t[1],t[2]),this.uvs.push(n,r),this.matShade.push(i,a),this.positions.length/3-1}quad(e,t,n,r,i,a=1){let o=ke(Oe(De(t,e),De(r,e))),s=this.vertex(e,o,0,0,i,a);this.vertex(t,o,1,0,i,a),this.vertex(n,o,1,1,i,a),this.vertex(r,o,0,1,i,a),this.indices.push(s,s+1,s+2,s,s+2,s+3)}box(e,t,n,r={}){let[i,a,o]=e,[s,c,l]=t,u=r.faces??[`px`,`nx`,`py`,`ny`,`pz`,`nz`],d=r.shade??1,f={px:[[s,a,l],[s,a,o],[s,c,o],[s,c,l]],nx:[[i,a,o],[i,a,l],[i,c,l],[i,c,o]],py:[[i,c,l],[s,c,l],[s,c,o],[i,c,o]],ny:[[i,a,o],[s,a,o],[s,a,l],[i,a,l]],pz:[[i,a,l],[s,a,l],[s,c,l],[i,c,l]],nz:[[s,a,o],[i,a,o],[i,c,o],[s,c,o]]};u.forEach(e=>{let[t,i,a,o]=f[e];this.quad(t,i,a,o,r.faceMat?.[e]??n,d)})}grid(e,t,n,r,i,a){let o=.001,s=(e,t)=>ke(Oe(De(n(Math.min(1,e+o),t),n(Math.max(0,e-o),t)),De(n(e,Math.min(1,t+o)),n(e,Math.max(0,t-o))))),c=Ae(s(.5,.5),i)<0,l=this.positions.length/3;for(let i=0;i<=t;i+=1)for(let o=0;o<=e;o+=1){let l=o/e,u=i/t,d=s(l,u);this.vertex(n(l,u),c?[-d[0],-d[1],-d[2]]:d,l,u,r,a?a(l,u):1)}let u=e+1;for(let n=0;n<t;n+=1)for(let t=0;t<e;t+=1){let e=l+n*u+t,r=e+1,i=e+u+1,a=e+u;c?this.indices.push(e,i,r,e,a,i):this.indices.push(e,r,i,e,i,a)}}build(){let e=new ue;return e.setAttribute(`position`,new v(this.positions,3)),e.setAttribute(`normal`,new v(this.normals,3)),e.setAttribute(`uv`,new v(this.uvs,2)),e.setAttribute(`aMatShade`,new v(this.matShade,2)),e.setIndex(this.indices),e.computeBoundingSphere(),e}},J=F.halfWidth,Y=L.halfWidth,X=F.ceiling,Z=(e,t,n)=>e+(t-e)*n,Me=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},Ne=(e,t)=>t*(.62*Math.sin(e*2*Math.PI*7.3+1.3)+.28*Math.sin(e*2*Math.PI*15.7+.4)+.1*Math.sin(e*2*Math.PI*3.1+2.2)),Pe=I.width/2+.12,Fe=I.centerY+I.height/2+.245,Ie=Y+.2,Le=3.1,Re=.2,ze=[160,40],Be=(e,t,n,r)=>{let i=Z(R.height,L.top+.1,r),a=Math.min(1,t.top-(t.top-t.bottom)*(1-r)**1.5),o=Math.max(0,a),s=Math.exp(-(((i-Le)/1.9)**2))*(1-o),c=Z(Z(Pe+.62*s+.12*Me(Le,L.top,i),-.12,a),Ie,n),l=(.07+.07*s)*(1-.45*o),u=.05*o,d=Ne(n,l)+u*Math.sin(n*2*Math.PI*31+.9),f=Me(8.2,8.8,i),p=e<0?.1*o*(1-Me(.02,.05,n))*(1-.5*f):0,m=Z(Re,.1,f)+d*(1-.55*f)+p+.05*s;return[[e*c,i,m],.4+.6*Me(-l-u,l+u,d)]},Ve=(e,t)=>{let n=(I.centerY-R.height)/(L.top+.1-R.height);return Math.max(0,(Be(1,t,0,n)[0][0]-Be(-1,e,0,n)[0][0])/2)},He=(e,t,n)=>{e.grid(ze[0],ze[1],(e,r)=>Be(t,n,e,r)[0],q.CURTAIN,[0,0,1],(e,r)=>Be(t,n,e,r)[1])},Ue=(e,t)=>{let n=Pe+.62;e.box([t>0?n-.02:-Ie-.02,3.04,.25],[t>0?Ie+.02:-n+.02,3.16,.4],q.GOLD,{faces:[`pz`,`py`,`ny`]})},We=()=>{let e={top:0,bottom:0},t=new je;He(t,-1,e),He(t,1,e);let n=t.build(),r=n.getAttribute(`position`),i=n.getAttribute(`uv`),a=n.getAttribute(`aMatShade`);r.setUsage(h),a.setUsage(h);let o=r.count/2;return{geometry:n,set:(e,t)=>{for(let n=0;n<r.count;n+=1){let[s,c]=n<o?Be(-1,e,i.getX(n),i.getY(n)):Be(1,t,i.getX(n),i.getY(n));r.setXYZ(n,s[0],s[1],s[2]),a.setY(n,c)}r.needsUpdate=!0,a.needsUpdate=!0,n.computeVertexNormals()}}},Ge=e=>{let t=Y+.2,n=.26,r=L.top+.2,i=e=>{let n=(e+t)/(2*t)*6;return Fe-.34*Math.sin(Math.PI*(n-Math.floor(n)))},a=(e,n)=>{let r=(e+t)/(2*t)*6;return .12*Math.sin(Math.PI*(r-Math.floor(r)))*(1-n)**1.5};e.grid(340,12,(e,o)=>{let s=Z(-t,t,e);return[s,Z(i(s),r,o),n+a(s,o)+.04*Math.sin(e*2*Math.PI*34)]},q.CURTAIN,[0,0,1],(e,t)=>(.55+.45*(.5+.5*Math.sin(e*2*Math.PI*34)))*(.6+.4*Me(0,.5,1-t))*(.75+.25*t)),e.grid(340,1,(e,r)=>{let o=Z(-t,t,e);return[o,i(o)-.17+.18*r,n+a(o,0)+.02]},q.FRINGE,[0,0,1])},Ke=e=>{e.grid(64,4,(e,t)=>{let n=Z(-J,J,e);return[n,0,Z(R.front,ye(0,n)-z.treadFront,t)]},q.CARPET,[0,1,0]);let t=z.count+1;for(let n=0;n<=t;n+=1){let t=xe(n),r=n>0?xe(n-1):0,i=(e,t)=>ye(e,t)-z.treadFront;e.grid(64,2,(e,r)=>{let a=Z(-J,J,e);return[a,t,Z(i(n,a),i(n+1,a),r)]},q.CARPET,[0,1,0]),t>r&&e.grid(64,1,(e,a)=>{let o=Z(-J,J,e);return[o,Z(r,t,a),i(n,o)]},q.CARPET,[0,0,-1],()=>.55)}let n=xe(t);e.grid(64,2,(e,r)=>{let i=Z(-J,J,e);return[i,n,Z(ye(t+1,i)-z.treadFront,F.back,r)]},q.CARPET,[0,1,0])},qe=e=>{let t=F.back;for(let n of[-1,1]){let r=n*J;e.box(n>0?[r,-1,L.z]:[r-.1,-1,L.z],n>0?[r+.1,X,t]:[r,X,t],q.WALL,{faces:[n>0?`nx`:`px`]});let i=n>0?`nx`:`px`;e.box(n>0?[r-.05,7.3,L.z]:[r,7.3,L.z],n>0?[r,7.4,t]:[r+.05,7.4,t],q.GOLD,{faces:[i,`py`,`ny`]});for(let t=1;t<V.count;t+=1){let r=Ce(t),a=n>0?J-.3:-J+.3;e.box(n>0?[a,-1,r-.28]:[-J,-1,r-.28],n>0?[J,X,r+.28]:[a,X,r+.28],q.PILASTER,{faces:[i,`pz`,`nz`],faceMat:{[i]:q.PILASTER_FACE}}),Je(e,n,a,r)}Ye(e,n)}},Je=(e,t,n,r)=>{let i=V.sconceY,a=-t;e.box(t>0?[n-.03,i-.34,r-.2]:[n,i-.34,r-.2],t>0?[n,i+.06,r+.2]:[n+.03,i+.06,r+.2],q.BRASS,{faces:[t>0?`nx`:`px`,`py`,`ny`,`pz`,`nz`]}),e.grid(24,6,(e,t)=>{let o=e*Math.PI,s=.05+.27*t,c=.11*(1-t*t);return[n+a*(.035+c),i-.1+s*Math.sin(o),r+s*Math.cos(o)]},q.SCONCE_GLASS,[a,0,0])},Ye=(e,t)=>{let n=H.z,r=H.width/2,i=t>0?`nx`:`px`,a=t*J,o=e=>a-t*e;e.box(t>0?[o(.02),0,n-r]:[a,0,n-r],t>0?[a,H.height,n+r]:[o(.02),H.height,n+r],q.DOOR,{faces:[i]});let s=(n,r,s,c)=>e.box(t>0?[o(.07),s,n]:[a,s,n],t>0?[a,c,r]:[o(.07),c,r],q.GOLD,{faces:[i,`pz`,`nz`,`py`]});s(n-r-.12,n-r,0,H.height+.12),s(n+r,n+r+.12,0,H.height+.12),s(n-r-.12,n+r+.12,H.height,H.height+.12);let c=H.signY;e.box(t>0?[o(.16),c-.13,n-.3]:[a,c-.13,n-.3],t>0?[a,c+.13,n+.3]:[o(.16),c+.13,n+.3],q.EXIT_HOUSING,{faces:[i,`py`,`ny`,`pz`,`nz`],faceMat:{[i]:q.EXIT_SIGN}})},Xe=e=>{e.box([-J,X,L.z],[J,X+.1,F.back],q.CEILING,{faces:[`ny`]});for(let t=0;t<V.count;t+=1){let n=Ce(t);e.box([-J,X-.62,n-.3],[J,X,n+.3],q.BEAM,{faces:[`ny`,`pz`,`nz`]}),e.box([-J,X-.68,n+.26],[J,X-.6,n+.36],q.COVE,{faces:[`pz`,`ny`]})}},Ze=e=>{let t=L.z,n=L.top;e.quad([-J,-1,t],[-Y,-1,t],[-Y,X,t],[-J,X,t],q.PROSC_WALL),e.quad([Y,-1,t],[J,-1,t],[J,X,t],[Y,X,t],q.PROSC_WALL),e.quad([-Y,n,t],[Y,n,t],[Y,X,t],[-Y,X,t],q.PROSC_WALL),e.quad([-Y,R.height,0],[Y,R.height,0],[Y,n,0],[-Y,n,0],q.MASKING),[[0,.24],[.42,.5]].forEach(([r,i],a)=>{let o=t+(a===0?.16:.08);e.box([-Y-i,0,t],[-Y-r,n+i,o],q.GOLD,{faces:[`pz`,`px`,`nx`]}),e.box([Y+r,0,t],[Y+i,n+i,o],q.GOLD,{faces:[`pz`,`px`,`nx`]}),e.box([-Y-r,n+r,t],[Y+r,n+i,o],q.GOLD,{faces:[`pz`,`ny`,`py`]})});for(let r of[-1,1]){let i=r*L.pilasterInner,a=r*L.pilasterOuter,[o,s]=r>0?[i,a]:[a,i];e.box([o,-1,t],[s,n+.1,t+.34],q.PILASTER,{faces:[`pz`,`px`,`nx`],faceMat:{pz:q.PILASTER_FACE}}),e.box([o-.08,n+.1,t],[s+.08,n+.4,t+.42],q.GOLD,{faces:[`pz`,`px`,`nx`,`ny`]}),e.box([o-.04,0,t],[s+.04,.3,t+.4],q.BRASS,{faces:[`pz`,`px`,`nx`,`py`]})}},Qe=e=>{let t=R.height;e.box([-Y,-1,0],[Y,t,R.front],q.STAGE_TOP,{faces:[`py`,`pz`],faceMat:{pz:q.STAGE_FRONT}}),e.box([-Y,t-.06,R.front],[Y,t,R.front+.03],q.BRASS,{faces:[`pz`,`py`]});let n=W.footHalfWidth+.15;e.box([-n,t,W.footZ+.02],[n,t+.09,R.front],q.BRASS,{faces:[`pz`,`py`]})},$e=(e,t)=>{let{z0:n,z1:r,floorY:i,railY:a}=U,o=[-t,0,0],s=i-.3,c=(e,n=0)=>t*(J-me(e)-n),l=e=>Z(n,r,e);e.grid(48,6,(e,t)=>[c(e),Z(s+.1,a-.07,t),l(e)],q.BOX_FRONT,o),e.grid(48,1,(e,t)=>[c(e,.015),Z(s,s+.1,t),l(e)],q.GOLD,o),e.grid(48,1,(e,t)=>[c(e,.015),Z(a-.07,a,t),l(e)],q.GOLD,o),e.grid(48,6,(e,n)=>[t*(J-me(e)+.2-n*.24),a+.07*Math.sin(Math.PI*n),l(e)],q.CURTAIN,[0,1,0]),e.grid(24,2,(e,n)=>[t*(J-n*me(e)),s,l(e)],q.PROSC_WALL,[0,-1,0]);let u=J-U.endOut-.1;for(let i of[n,r])e.box(t>0?[u,a,i-.07]:[-J,a,i-.07],t>0?[J,7.25,i+.07]:[-u,7.25,i+.07],q.GOLD,{faces:[t>0?`nx`:`px`,`pz`,`nz`]});e.box(t>0?[u,7.05,n-.07]:[-J,7.05,n-.07],t>0?[J,7.3,r+.07]:[-u,7.3,r+.07],q.GOLD,{faces:[t>0?`nx`:`px`,`ny`]}),e.grid(60,6,(e,n)=>{let r=Z(6.45+.18*Math.sin(Math.PI*(e*2%1)),7.05,n);return[t*(u+.04-Ne(e*.6,.04)),r,l(e)]},q.CURTAIN,o,e=>.55+.45*Me(-.04,.04,Ne(e*.6,.04))),Te().filter(([e])=>Math.sign(e)===t).forEach(([t,n,r])=>{e.box([t-.06,n-.09,r-.06],[t+.06,n+.03,r+.06],q.BOX_LAMP,{faces:[`px`,`nx`,`pz`,`nz`,`py`]})})},et=()=>{let e=new je;return Ke(e),qe(e),$e(e,-1),$e(e,1),Xe(e),Ze(e),Qe(e),Ue(e,-1),Ue(e,1),Ge(e),e.build()},Q=(e,t,n)=>{e.applyMatrix4(t);let r=e.getAttribute(`position`),i=new Float32Array(r.count*2);for(let e=0;e<r.count;e+=1)i[e*2]=n,i[e*2+1]=.3+.7*Me(.05,1.05,r.getY(e));return e.setAttribute(`aMatShade`,new S(i,2)),e},tt=(e,t)=>{let n=le(e);if(e.forEach(e=>e.dispose()),!n)throw Error(`[Cinema] Could not merge the ${t} geometry`);return n},nt=()=>{let e=new x().makeRotationX(.17),t=(e,t,n)=>new x().makeTranslation(e,t,n),n=(n,r,i)=>t(0,.78,-.1).multiply(e).multiply(t(n,r,i));return tt([Q(new k(.5,.74,.13,3,.055),n(0,0,0),q.SEAT_FABRIC),Q(new k(.53,.66,.05,2,.022),n(0,-.06,.075),q.SEAT_SHELL),Q(new k(.48,.12,.46,3,.045),t(0,.44,-.38),q.SEAT_FABRIC),Q(new k(.075,.06,.5,2,.026),t(-.28,.67,-.32),q.SEAT_ARM),Q(new k(.05,.64,.4,1,.012),t(-.28,.32,-.32),q.SEAT_SHELL)],`seat`)},rt=()=>{let e=(e,t,n)=>new x().makeTranslation(e,t,n),t=(t,n,r)=>e(0,.78,-.1).multiply(new x().makeRotationX(.17)).multiply(e(t,n,r)),n=e=>{let t=e.toNonIndexed();return e.dispose(),t},r=n(new w(.105,14,10));r.applyMatrix4(new x().makeScale(.92,1.12,1));let i=n(new d(.05,.06,.16,10));return tt([Q(r,t(0,.46,-.18),q.AUDIENCE),Q(i,t(0,.35,-.18),q.AUDIENCE),Q(new k(.4,.56,.2,3,.08),t(0,.02,-.18),q.AUDIENCE),Q(new k(.36,.14,.44,3,.06),e(0,.57,-.4),q.AUDIENCE),Q(new k(.32,.5,.12,2,.05),e(0,.26,-.64),q.AUDIENCE)],`audience`)},it=(e,t)=>{let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)},at=(e,t)=>e<z.count-1&&e!==6&&e!==7&&it(e,t)<=.34,ot=()=>{let e=[],t=new O(0,1,0),n=new T;for(let r=0;r<z.count-1;r+=1)r!==6&&r!==7&&Se().forEach(i=>{if(!at(r,i))return;let a=(it(r+31,i)-.5)*.5;n.setFromAxisAngle(t,be(r,i)+a*.3);let o=.92+.16*it(r+7,i);e.push(new x().compose(new O(i+a*.06,xe(r)-(1-o)*.8,ye(r,i)),n,new O(o,o,o)))});for(let r of[-1,1])[.38,.62].forEach((i,a)=>{let o=r*(J-me(i)/2),s=Z(U.z0,U.z1,i);n.setFromAxisAngle(t,Math.atan2(o,s+9)*.6+(a-.5)*.2),e.push(new x().compose(new O(o,U.floorY+.15,s),n,new O(1,1,1)))});return e},st=()=>{let e=[],t=Se(),n=new T,r=new O(0,1,0),i=new O(1,1,1);for(let a=0;a<z.count;a+=1)t.forEach(t=>{n.setFromAxisAngle(r,be(a,t)),e.push(new x().compose(new O(t,xe(a),ye(a,t)),n,i))});return e},ct=[1,.5,.16],lt=[1,.62,.3],ut=(e,t)=>[e[0]*t,e[1]*t,e[2]*t],dt=()=>{let e=[],t=[B.aisleInner+.03,B.aisleOuter-.03,B.aisleOuter+B.sideSeats*B.seatPitch+.03];for(let n=0;n<=z.count;n+=1)for(let r of[-1,1])t.forEach(t=>{e.push({position:[r*t,xe(n)+.2,ye(n,t)-.3],color:ut(ct,.9),size:.16,kind:0})});for(let t=-W.footHalfWidth+.2;t<=W.footHalfWidth-.2+1e-6;t+=.5)e.push({position:[t,R.height+.1,W.footZ+.08],color:ut(lt,.55),size:.24,kind:0});for(let t=1;t<V.count;t+=1)for(let n of[-1,1]){let r=[n*(J-.45),V.sconceY+.02,Ce(t)];e.push({position:r,color:ut(lt,.22),size:1.5,kind:0}),e.push({position:r,color:ut(lt,.9),size:.34,kind:0})}Te().forEach(([t,n,r])=>{e.push({position:[t,n-.03,r],color:ut(lt,.25),size:1.2,kind:0}),e.push({position:[t,n-.03,r],color:ut(lt,1.1),size:.2,kind:0})});for(let t of[-1,1])e.push({position:[t*(J-.2),H.signY,H.z],color:[.05,.42,.16],size:1.1,kind:0}),e.push({position:[t*(L.pilasterInner+L.pilasterOuter)/2,.32,L.z+.45],color:ut(lt,.6),size:.5,kind:0});for(let t=0;t<V.count;t+=1)for(let n=-J+.4;n<J;n+=.75)e.push({position:[n,X-.66,Ce(t)+.37],color:[.16,.16,.16],size:.65,kind:2});let n=7,r=()=>(n=n*16807%2147483647,n/2147483647);for(let t=0;t<170;){let n=Z(L.z+1,Ce(V.count-1),r()),i=Math.round((n-V.first)/V.pitch);if(Math.abs(n-Ce(i))<.45)continue;let a=.5+1.5*r()**3;e.push({position:[Z(-J+.3,J-.3,r()),X-.02,n],color:[.9*a,.85*a,.75*a],size:.07+.07*r(),kind:1}),t+=1}return e},ft=24,pt=8,mt=(e,t,n)=>{let r=new M().setRGB(e/255,t/255,n/255,A),i=.2126*r.r+.7152*r.g+.0722*r.b,a=e=>Math.max(0,i+(e-i)*1.3);return r.setRGB(a(r.r),a(r.g),a(r.b)),i<.05&&r.multiplyScalar(Math.sqrt(.05/Math.max(i,.004))),r},ht=e=>{let t=document.createElement(`canvas`);t.width=ft,t.height=pt;let n=t.getContext(`2d`,{willReadFrequently:!0});if(!n)return null;n.drawImage(e,0,0,ft,pt);let r;try{r=n.getImageData(0,0,ft,pt).data}catch(e){return console.warn(`[Cinema] Cannot read the cover colours, lighting the hall in grey`,e),null}let i=ft/3,a=[[0,0,0],[0,0,0],[0,0,0]];for(let e=0;e<pt;e+=1)for(let t=0;t<ft;t+=1){let n=(e*ft+t)*4,o=a[Math.min(2,Math.floor(t/i))];o[0]+=r[n],o[1]+=r[n+1],o[2]+=r[n+2]}let[o,s,c]=a.map(([e,t,n])=>mt(e/64,t/64,n/64));return[o,s,c]},gt=()=>[mt(120,116,110),mt(128,124,118),mt(120,116,110)],_t=e=>(e.colorSpace=A,e.generateMipmaps=!0,e.minFilter=j,e.magFilter=m,e.anisotropy=4,e.needsUpdate=!0,e),vt=()=>{let e=document.createElement(`canvas`);e.width=64,e.height=64;let t=e.getContext(`2d`);if(t){let e=t.createRadialGradient(32,30,4,32,32,46);e.addColorStop(0,`#8a8478`),e.addColorStop(1,`#4a4640`),t.fillStyle=e,t.fillRect(0,0,64,64)}return{texture:_t(new N(e)),aspect:1,colors:gt()}},yt=e=>new Promise(t=>{let n=new Image;n.crossOrigin=`anonymous`,n.decoding=`async`,n.onload=()=>{let e=n.naturalWidth>0&&n.naturalHeight>0?n.naturalWidth/n.naturalHeight:1;t({texture:_t(new u(n)),aspect:e,colors:ht(n)??gt()})},n.onerror=()=>{console.warn(`[Cinema] Cover failed to load; the screen keeps its current reel`),t(null)},n.src=e}),bt=.85,xt=.5,St=.7,Ct=.25,wt=.9,Tt=4.5,Et=.17,Dt=.8,Ot=[1.6,1.72],kt=.12,At=1/120,jt=(e,t,n,r)=>e+(t-e)*(1-Math.exp(-n*r)),Mt=(e,t,n)=>Math.min(n,Math.max(t,e)),Nt=()=>{let e=0,t=!1,n=!0,r=0,i=0,a=Ot.map(e=>({omega:e,at:0,speed:0})),o={shutter:1,lights:0,left:{top:0,bottom:0},right:{top:0,bottom:0}};return{step:(s,c,l,u=!1,d=!0)=>{if(u)e=0,t=!1,r=0,i=0,a.forEach(e=>{e.at=0,e.speed=0}),o.shutter=1,o.lights=+!!l;else{e=c||!d?0:e+s,o.shutter=e>3?Math.max(0,o.shutter-s/St):Math.min(1,o.shutter+s/Ct);let u=+(e>3.8),f=Math.max(1,Math.ceil(s/At)),p=s/f;for(let e=0;e<f;e+=1){let e=Mt(Dt*(u-r),-.17,Et);i+=(e-i)*(1-Math.exp(-2.5*p)),r+=i*p,a.forEach(e=>{e.speed+=(e.omega*e.omega*(r-e.at)-2*kt*e.omega*e.speed)*p,e.at+=e.speed*p})}t=!c&&(t||r>bt);let m=Math.max(+!!l,t?xt:0);o.lights=n?m:jt(o.lights,m,m>o.lights?wt:Tt,s)}return n=!1,o.left.top=r,o.left.bottom=a[0].at,o.right.top=r,o.right.bottom=a[1].at,o}}},Pt=`
${we}
uniform float uTime;
uniform vec2 uResolution;
uniform float uExposure;

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 acesFilm(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 linearToSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// Tone map and a film grade: teal in the shadows, warm amber in the highlights, a lifted black.
// The vignette and the grain come last, after the lens (cinemaPost.ts).
vec3 finishColor(vec3 hdr) {
    vec3 c = acesFilm(hdr * uExposure);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c *= mix(vec3(0.86, 0.98, 1.12), vec3(1.06, 1.0, 0.9), smoothstep(0.0, 0.3, l));
    c = linearToSrgb(c);
    // Dither by half a step: the frame is stored in 8 bits before the lens passes.
    c += (hash12(gl_FragCoord.xy + fract(uTime * 3.7) * 311.0) - 0.5) / 255.0;
    return c * 0.992 + vec3(0.002, 0.003, 0.005);
}

// A sine whose ripples fade to their average once they are finer than a pixel, so they never shimmer.
float aaSin(float x) {
    return sin(x) * (1.0 - smoothstep(0.6, 1.6, fwidth(x)));
}

// Where the ray from the projector lens through p meets the screen, in screen uv.
vec2 projectorUv(vec3 p) {
    vec3 o = vec3(0.0, PROJ_Y, PROJ_Z);
    vec3 s = p - o;
    vec3 q = o + s * (-o.z / min(s.z, -1e-4));
    return vec2((q.x + SCREEN_W * 0.5) / SCREEN_W, (q.y - (SCREEN_CY - SCREEN_H * 0.5)) / SCREEN_H);
}
`,Ft=`
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uAspectA;
uniform float uAspectB;
uniform float uChange;

const float COVER_SCALE = 0.86;

float boxDistance(vec2 p, vec2 halfSize) {
    vec2 d = abs(p) - halfSize;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

vec3 projectedImage(sampler2D t, float aspect, vec2 uv, float lod, bool cheap) {
    vec2 b = vec2(uv.x, 0.5 + (uv.y - 0.5) * SCREEN_H * aspect / SCREEN_W);
    vec3 backdrop = textureLod(t, b, 6.0).rgb;
    if (!cheap) {
        // A ring of taps on a small mip: a soft blur with no blocks.
        backdrop *= 0.2;
        for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.785398 + 0.3;
            backdrop += textureLod(t, b + vec2(cos(a), sin(a)) * 0.045, 4.6).rgb * 0.1;
        }
    }
    float w = aspect * SCREEN_H / SCREEN_W * COVER_SCALE;
    vec2 c = vec2((uv.x - 0.5) / w, (uv.y - 0.5) / COVER_SCALE);
    float d = boxDistance(c, vec2(0.5));
    float edge = cheap ? 0.01 : max(fwidth(d), 0.0015);
    float inside = 1.0 - smoothstep(-edge, edge, d);
    float shadow = 0.5 + 0.5 * smoothstep(0.0, 0.12, d);
    vec3 sharp = textureLod(t, clamp(c + 0.5, 0.0, 1.0), lod).rgb;
    float grey = dot(backdrop, vec3(0.2126, 0.7152, 0.0722));
    return mix(mix(vec3(grey), backdrop, 0.7) * 0.26 * shadow, sharp, inside);
}

// The reel the beam carries: the old one (B) gives way to the new one (A) in the middle of a change.
vec3 reelImage(vec2 uv, float lod, bool cheap) {
    vec3 a = projectedImage(uTexA, uAspectA, uv, lod, cheap);
    if (uChange < 1.0) a = mix(projectedImage(uTexB, uAspectB, uv, lod, cheap), a, smoothstep(0.42, 0.58, uChange));
    return a;
}
`,It=`
attribute vec2 aMatShade;
varying vec3 vPos;
varying vec3 vNormal;
varying vec2 vUv;
varying float vMat;
varying float vShade;

void main() {
    mat4 m = modelMatrix;
#ifdef USE_INSTANCING
    m = m * instanceMatrix;
#endif
    vec4 world = m * vec4(position, 1.0);
    vPos = world.xyz;
    vNormal = normalize(mat3(m) * normal);
    vUv = uv;
    vMat = aMatShade.x;
    vShade = aMatShade.y;
    gl_Position = projectionMatrix * viewMatrix * world;
}
`,Lt=`
${Pt}
${Ee}
uniform vec3 uScreenL;
uniform vec3 uScreenC;
uniform vec3 uScreenR;
uniform vec3 uAmbient;
uniform vec3 uHaze;
uniform vec3 uCove;
uniform float uHouse;
uniform float uSconce;
uniform float uFoot;
uniform float uDay;
uniform float uBoxLamp;

varying vec3 vPos;
varying vec3 vNormal;
varying vec2 vUv;
varying float vMat;
varying float vShade;

const vec3 WARM = vec3(1.0, 0.62, 0.3);
const vec3 AMBER = vec3(1.0, 0.5, 0.16);
const vec3 EXIT_GREEN = vec3(0.12, 1.0, 0.38);
const vec3 GOLD = vec3(0.78, 0.55, 0.22);
const vec3 WALNUT = vec3(0.075, 0.042, 0.024);

float rowRadius(float r) { return ROW_RADIUS + r * ROW_PITCH; }
float rowZ(float r, float x) { float R = rowRadius(r); return ROW_FIRST - ROW_RADIUS + sqrt(R * R - x * x); }
float rowFloor(float r) { return max(0.0, r - ROW_FLAT + 1.0) * ROW_RISE; }
// The tread p stands on; -1 in front of the first row.
float rowAt(vec3 p) {
    float R = rowRadius(5.0);
    float off = R - sqrt(R * R - p.x * p.x);
    return floor((p.z + off - ROW_FIRST + ROW_TREAD_FRONT) / ROW_PITCH);
}

// ---- The screen as an area light: the exact diffuse form factor of a rectangle, per third. ----
float edgeTerm(vec3 a, vec3 b, vec3 n) {
    vec3 c = cross(a, b);
    return acos(clamp(dot(a, b), -0.9999, 0.9999)) * dot(c, n) / max(length(c), 1e-5);
}
float rectFormFactor(vec3 p, vec3 n, float x0, float x1) {
    float y0 = SCREEN_CY - SCREEN_H * 0.5;
    float y1 = SCREEN_CY + SCREEN_H * 0.5;
    vec3 a = normalize(vec3(x0, y0, 0.0) - p);
    vec3 b = normalize(vec3(x1, y0, 0.0) - p);
    vec3 c = normalize(vec3(x1, y1, 0.0) - p);
    vec3 d = normalize(vec3(x0, y1, 0.0) - p);
    return max(0.0, edgeTerm(a, b, n) + edgeTerm(b, c, n) + edgeTerm(c, d, n) + edgeTerm(d, a, n)) / 6.2831853;
}
vec3 screenLight(vec3 p, vec3 n) {
    if (p.z < 0.05) return vec3(0.0);
    float h = SCREEN_W / 6.0;
    return uScreenL * rectFormFactor(p, n, -SCREEN_W * 0.5, -h)
        + uScreenC * rectFormFactor(p, n, -h, h)
        + uScreenR * rectFormFactor(p, n, h, SCREEN_W * 0.5);
}

// ---- Small lights. Each returns irradiance and adds a highlight to spec. ----
vec3 pointLight(vec3 lp, vec3 color, vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    vec3 d = lp - p;
    float d2 = max(dot(d, d), 0.03);
    vec3 l = d * inversesqrt(d2);
    float ndl = max(dot(n, l), 0.0);
    vec3 e = color * ndl / d2;
    spec += e * pow(max(dot(n, normalize(l + v)), 0.0), gloss);
    return e;
}

// Art deco fan sconces: mostly up, a little down, washing the wall in a scallop.
vec3 sconceLight(vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    float side = p.x < 0.0 ? -1.0 : 1.0;
    float k0 = floor((p.z - BAY_FIRST) / BAY_PITCH + 0.5);
    vec3 e = vec3(0.0);
    for (int i = -1; i <= 1; i++) {
        float k = k0 + float(i);
        if (k < 1.0 || k > BAY_COUNT - 1.0) continue;
        vec3 lp = vec3(side * (HALL_HALF_WIDTH - 0.42), SCONCE_Y + 0.05, BAY_FIRST + k * BAY_PITCH);
        vec3 toP = normalize(p - lp);
        float lobe = 0.1 + 2.6 * smoothstep(-0.1, 0.9, toP.y);
        e += pointLight(lp, WARM * uSconce * lobe, p, n, v, gloss, spec);
    }
    return e;
}

// The amber lamps on the seat ends along the aisles and the side walkways.
vec3 stepLight(vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    float ax = abs(p.x);
    if (ax < AISLE_INNER - 0.8 || p.y > 6.0) return vec3(0.0);
    float side = p.x < 0.0 ? -1.0 : 1.0;
    float r0 = rowAt(p);
    vec3 e = vec3(0.0);
    for (int i = 0; i <= 1; i++) {
        float r = r0 + float(i);
        if (r < 0.0 || r > ROW_COUNT) continue;
        float y = rowFloor(r) + 0.2;
        float edges[3];
        edges[0] = AISLE_INNER + 0.03;
        edges[1] = AISLE_OUTER - 0.03;
        edges[2] = SIDE_EDGE + 0.03;
        for (int j = 0; j < 3; j++) {
            float x = edges[j];
            if (abs(ax - x) > 2.2) continue;
            vec3 lp = vec3(side * x, y, rowZ(r, x) - 0.3);
            e += pointLight(lp, AMBER * 0.05, p, n, v, gloss, spec);
        }
    }
    return e;
}

// Footlights: a hooded line of lamps along the stage lip, throwing light up and back onto the curtains.
vec3 footLight(vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    vec3 c = vec3(clamp(p.x, -FOOT_HALF_WIDTH, FOOT_HALF_WIDTH), FOOT_Y, FOOT_Z);
    vec3 d = c - p;
    float dist = max(length(d), 0.05);
    vec3 l = d / dist;
    float aim = smoothstep(-0.05, 0.35, -l.y) * smoothstep(0.25, -0.35, -l.z);
    vec3 e = vec3(1.0, 0.68, 0.38) * uFoot * aim * max(dot(n, l), 0.0) / (0.25 + dist * 0.55 + dist * dist * 0.12);
    spec += e * pow(max(dot(n, normalize(l + v)), 0.0), gloss);
    return e;
}

// The lamps at the foot of the proscenium pilasters: narrow cones up the fluting.
vec3 uplight(vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    vec3 lp = vec3(p.x < 0.0 ? -PILASTER_X : PILASTER_X, 0.32, PROSC_Z + 0.5);
    vec3 toP = normalize(p - lp);
    float cone = pow(max(toP.y, 0.0), 10.0);
    return pointLight(lp, WARM * uFoot * 1.6 * cone, p, n, v, gloss, spec);
}

// The cove strips under each beam's front edge wash the ceiling behind them.
vec3 coveLight(vec3 p, vec3 n) {
    if (p.y < HALL_CEILING - 3.0) return vec3(0.0);
    float k = floor((p.z - BAY_FIRST - 0.4) / BAY_PITCH);
    if (k < 0.0 || k > BAY_COUNT - 1.0) return vec3(0.0);
    vec3 c = vec3(p.x, HALL_CEILING - 0.66, BAY_FIRST + k * BAY_PITCH + 0.45);
    vec3 d = c - p;
    float dist = max(length(d), 0.05);
    vec3 l = d / dist;
    return uCove * max(dot(n, l), 0.0) * smoothstep(0.1, -0.2, l.y) / (0.15 + dist * dist * 0.5);
}

// The two small lamps on the front of each box, lighting its front, its people and the wall behind.
vec3 boxLight(vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    if (p.z > 8.0 || p.y < 2.5 || abs(p.x) < HALL_HALF_WIDTH - 2.8) return vec3(0.0);
    float side = p.x < 0.0 ? -1.0 : 1.0;
    vec3 e = vec3(0.0);
    for (int i = 0; i < 2; i++) {
        vec3 lp = vec3(side * BOX_LAMP_X, BOX_LAMP_Y, i == 0 ? BOX_LAMP_Z0 : BOX_LAMP_Z1);
        e += pointLight(lp, WARM * 0.2 * uBoxLamp, p, n, v, gloss, spec);
    }
    return e;
}

vec3 exitLight(vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    vec3 lp = vec3((p.x < 0.0 ? -1.0 : 1.0) * (HALL_HALF_WIDTH - 0.2), EXIT_SIGN_Y, EXIT_Z);
    return pointLight(lp, EXIT_GREEN * 0.05, p, n, v, gloss, spec);
}

// Day: the house lights, warm from above with a red bounce off the carpet and seats.
vec3 houseLight(vec3 p, vec3 n) {
    vec3 sky = vec3(1.0, 0.88, 0.72);
    vec3 ground = vec3(0.4, 0.17, 0.12);
    vec3 e = mix(ground, sky, 0.5 + 0.5 * n.y);
    // Lit from the ceiling: the upper hall bright, the rows darker.
    return e * uHouse * (0.42 + 0.58 * smoothstep(0.5, 10.0, p.y)) * (0.55 + 0.45 * smoothstep(22.0, 6.0, p.z));
}

// What a polished surface mirrors here, roughly: the screen ahead, the stage glow below, the hall.
vec3 mirrored(vec3 p, vec3 r) {
    vec3 e = uAmbient * 2.5 + houseLight(p, r) * 0.6;
    float toScreen = smoothstep(0.75, 0.98, dot(r, normalize(vec3(0.0, SCREEN_CY, 0.0) - p)));
    e += (uScreenL + uScreenC + uScreenR) * 0.04 * toScreen;
    e += vec3(1.0, 0.68, 0.38) * uFoot * 0.08 * smoothstep(0.1, -0.5, r.y);
    e += WARM * uSconce * 0.05 * smoothstep(0.3, 0.9, abs(r.x));
    return e;
}

// The scallop a fan sconce paints above itself on the pilaster and the wall beside it.
vec3 sconceScallop(vec3 p) {
    float k = floor((p.z - BAY_FIRST) / BAY_PITCH + 0.5);
    if (k < 1.0 || k > BAY_COUNT - 1.0) return vec3(0.0);
    vec2 d = vec2(p.z - (BAY_FIRST + k * BAY_PITCH), p.y - SCONCE_Y);
    float up = max(d.y, 0.0);
    float spread = 0.16 + 0.42 * up;
    float fan = exp(-(d.x * d.x) / (spread * spread)) * exp(-up / 1.8) * smoothstep(-0.45, 0.05, d.y);
    return WARM * fan * uSconce * 0.16;
}

float lineMask(float d, float width) {
    float w = fwidth(d) + 1e-4;
    return 1.0 - smoothstep(width, width + w, d);
}

void main() {
    int matId = int(vMat + 0.5);
    vec3 p = vPos;
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(cameraPosition - p);

    vec3 albedo = vec3(0.1);
    vec3 emissive = vec3(0.0);
    float ao = vShade;
    float specAmount = 0.04;
    float gloss = 12.0;
    float velvet = 0.0;
    float metal = 0.0;

    if (matId == M_CARPET) {
        float ax = abs(p.x);
        float row = rowAt(p);
        float open = max(
            smoothstep(AISLE_INNER - 0.04, AISLE_INNER + 0.04, ax) * (1.0 - smoothstep(AISLE_OUTER - 0.04, AISLE_OUTER + 0.04, ax)),
            smoothstep(SIDE_EDGE - 0.04, SIDE_EDGE + 0.04, ax)
        );
        if (row < 0.0) open = 1.0;
        vec2 cell = fract(vec2(p.x + p.z, p.x - p.z) * 1.1) - 0.5;
        float edge = 0.5 - max(abs(cell.x), abs(cell.y));
        float motif = lineMask(edge, 0.03) + 0.6 * lineMask(length(cell), 0.07);
        // Far away the motif melts into its average colour instead of crawling.
        motif = mix(clamp(motif, 0.0, 1.0), 0.18, smoothstep(0.08, 0.25, fwidth(p.x + p.z) * 1.1));
        albedo = mix(vec3(0.11, 0.016, 0.022), vec3(0.32, 0.19, 0.07), motif * 0.6);
        // Brass nosing on the front edge of each aisle step.
        float nose = p.z - (rowZ(max(row, 0.0), ax) - ROW_TREAD_FRONT);
        if (row >= 0.0 && open > 0.5 && nose < 0.045) {
            albedo = vec3(0.5, 0.33, 0.14);
            specAmount = 0.5;
            gloss = 40.0;
        }
        ao = 0.12 + 0.88 * open;
    } else if (matId == M_WALL) {
        float row = rowAt(vec3(p.x, 0.0, p.z));
        float floorY = row < 0.0 ? 0.0 : rowFloor(row);
        float h = p.y - floorY;
        if (p.y > 7.4) {
            // Frieze above the picture rail: dark plaster with deco reeding.
            albedo = vec3(0.07, 0.05, 0.04) * (0.85 + 0.15 * aaSin(p.z * 31.4));
        } else if (h < 1.25) {
            float rail = lineMask(abs(h - 1.2), 0.035);
            albedo = mix(WALNUT * (0.8 + 0.2 * aaSin(p.y * 60.0)), GOLD * 0.7, rail);
            specAmount = mix(0.15, 0.6, rail);
            gloss = 30.0;
        } else {
            // Quilted fabric with a small button at every crossing.
            vec2 cell = fract(vec2(p.z + p.y, p.z - p.y) * 1.25) - 0.5;
            float seam = 0.5 - max(abs(cell.x), abs(cell.y));
            float fine = smoothstep(0.06, 0.2, fwidth(p.z + p.y) * 1.25);
            float pillow = mix(smoothstep(0.0, 0.25, seam), 0.75, fine);
            albedo = vec3(0.2, 0.135, 0.085) * (0.6 + 0.4 * pillow);
            float button = lineMask(length(abs(cell) - vec2(0.5, 0.0)), 0.035) + lineMask(length(abs(cell) - vec2(0.0, 0.5)), 0.035);
            albedo = mix(albedo, GOLD * 0.6, mix(clamp(button, 0.0, 1.0), 0.03, fine));
            velvet = 0.5;
            emissive = sconceScallop(p) * albedo * 4.0;
        }
        ao *= 0.55 + 0.45 * smoothstep(0.0, 1.2, h);
    } else if (matId == M_PILASTER || matId == M_PILASTER_FACE) {
        albedo = WALNUT;
        specAmount = 0.2;
        gloss = 30.0;
        if (matId == M_PILASTER_FACE) {
            float s = fract(vUv.x * 5.0);
            // Far off, the thin gold fillets melt into their share of the face instead of breaking up.
            float fillet = mix(lineMask(min(s, 1.0 - s), 0.06), 0.14, smoothstep(0.04, 0.12, fwidth(vUv.x * 5.0)));
            albedo = mix(WALNUT * (0.55 + 0.45 * sin(s * 3.14159)), GOLD * 0.75, fillet);
            specAmount = mix(0.25, 0.8, fillet);
            gloss = mix(30.0, 60.0, fillet);
            emissive = sconceScallop(p) * albedo * 6.0;
        }
    } else if (matId == M_CEILING) {
        albedo = vec3(0.02, 0.03, 0.06);
    } else if (matId == M_BEAM) {
        albedo = vec3(0.42, 0.36, 0.29);
        float band = lineMask(abs(p.y - (HALL_CEILING - 0.5)), 0.02);
        albedo = mix(albedo, GOLD, band);
    } else if (matId == M_COVE) {
        albedo = vec3(0.0);
        emissive = uCove * 2.6;
    } else if (matId == M_PROSC_WALL) {
        albedo = vec3(0.1, 0.065, 0.05) * (0.82 + 0.18 * aaSin(p.x * 28.0));
    } else if (matId == M_GOLD) {
        albedo = GOLD;
        metal = 1.0;
        specAmount = 1.0;
        gloss = 24.0;
    } else if (matId == M_MASKING) {
        albedo = vec3(0.004);
    } else if (matId == M_CURTAIN) {
        albedo = vec3(0.36, 0.022, 0.03);
        velvet = 1.0;
    } else if (matId == M_FRINGE) {
        float strand = 0.5 + 0.5 * sin(vUv.x * 5800.0);
        float fade = 1.0 - smoothstep(0.3, 0.8, fwidth(vUv.x * 5800.0));
        albedo = GOLD * mix(1.0, 0.45 + 0.55 * strand, fade) * (0.5 + 0.5 * vUv.y);
        metal = 1.0;
        specAmount = 0.8;
        gloss = 18.0;
    } else if (matId == M_STAGE_FRONT) {
        float panel = lineMask(abs(fract(p.x / 1.27) - 0.5) * 1.27 - 0.6, 0.02);
        albedo = WALNUT * (0.75 + 0.25 * aaSin(p.x * 9.0 + p.y * 3.0)) * (1.0 - 0.5 * panel);
        specAmount = 0.15;
    } else if (matId == M_STAGE_TOP) {
        albedo = vec3(0.04, 0.032, 0.027) * (0.8 + 0.2 * (0.5 + 0.5 * aaSin(p.z * 37.7)));
        specAmount = 0.12;
        gloss = 20.0;
    } else if (matId == M_SEAT_FABRIC) {
        float variation = hash12(floor(p.xz * 1.6 + 0.5));
        // Piping along the edges of each cushion.
        float seam = lineMask(min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)), 0.035);
        albedo = vec3(0.19, 0.028, 0.038) * (0.9 + 0.2 * variation) * (1.0 - 0.45 * seam);
        velvet = 0.4;
    } else if (matId == M_SEAT_SHELL) {
        albedo = vec3(0.035, 0.024, 0.018);
        specAmount = 0.35;
        gloss = 40.0;
    } else if (matId == M_SEAT_ARM) {
        albedo = vec3(0.09, 0.05, 0.028);
        specAmount = 0.5;
        gloss = 60.0;
    } else if (matId == M_DOOR) {
        float panel = lineMask(abs(vUv.x - 0.5), 0.012);
        float bar = lineMask(abs(p.y - 1.05), 0.025);
        albedo = mix(vec3(0.035, 0.026, 0.02) * (1.0 - 0.6 * panel), vec3(0.5, 0.35, 0.15), bar);
        specAmount = mix(0.1, 0.6, bar);
    } else if (matId == M_EXIT_SIGN) {
        vec2 q = vUv;
        float arrowShaft = step(abs(q.y - 0.5), 0.07) * step(0.2, q.x) * step(q.x, 0.48);
        float arrowHead = step(abs(q.y - 0.5), 0.2 * (1.0 - (q.x - 0.44) / 0.14)) * step(0.44, q.x) * step(q.x, 0.58);
        float doorOutline = (step(0.64, q.x) * step(q.x, 0.84) * step(0.16, q.y) * step(q.y, 0.84))
            * (1.0 - step(0.68, q.x) * step(q.x, 0.8) * step(0.24, q.y) * step(q.y, 0.84));
        float glyph = clamp(arrowShaft + arrowHead + doorOutline, 0.0, 1.0);
        albedo = vec3(0.0);
        emissive = mix(EXIT_GREEN * 0.55, vec3(0.75, 1.0, 0.85), glyph) * 1.4;
    } else if (matId == M_EXIT_HOUSING) {
        albedo = vec3(0.02);
    } else if (matId == M_SCONCE_GLASS) {
        float rib = lineMask(abs(fract(vUv.x * 8.0) - 0.5), 0.06);
        albedo = vec3(0.0);
        emissive = WARM * (0.35 + 0.65 * vUv.y) * (1.0 - 0.55 * rib) * (1.2 * uSconce + 0.4 * uDay);
    } else if (matId == M_BRASS) {
        albedo = vec3(0.5, 0.33, 0.14);
        metal = 1.0;
        specAmount = 0.9;
        gloss = 36.0;
    } else if (matId == M_AUDIENCE) {
        // People in the dark: almost black, only their outline catches the screen's light.
        albedo = vec3(0.018, 0.014, 0.013);
        velvet = 1.6;
    } else if (matId == M_BOX_FRONT) {
        // The bowed fronts of the boxes: walnut panels in a gold frame, warm under their lamps.
        float panel = lineMask(abs(fract(vUv.x * 6.0) - 0.5) * 2.0 - 0.86, 0.02) + lineMask(abs(vUv.y - 0.5) * 2.0 - 0.8, 0.03);
        albedo = mix(WALNUT * (0.8 + 0.2 * aaSin(p.y * 40.0)), GOLD * 0.8, clamp(panel, 0.0, 1.0));
        specAmount = mix(0.2, 0.8, clamp(panel, 0.0, 1.0));
        gloss = 30.0;
    } else if (matId == M_BOX_LAMP) {
        albedo = vec3(0.0);
        emissive = WARM * (1.4 * uBoxLamp + 0.3 * uDay);
    }

    // Tight curves (seat edges far away) spread their highlight instead of sparkling.
    vec3 dn = fwidth(n);
    gloss = gloss / (1.0 + gloss * dot(dn, dn) * 2.0);

    vec3 spec = vec3(0.0);
    vec3 e = screenLight(p, n)
        + boxLight(p, n, v, gloss, spec)
        + sconceLight(p, n, v, gloss, spec)
        + stepLight(p, n, v, gloss, spec)
        + footLight(p, n, v, gloss, spec)
        + uplight(p, n, v, gloss, spec)
        + exitLight(p, n, v, gloss, spec)
        + coveLight(p, n)
        + houseLight(p, n)
        + uAmbient;

    float facing = max(dot(n, v), 0.0);
    vec3 color;
    if (metal > 0.5) {
        color = albedo * (e * 0.3 + mirrored(p, reflect(-v, n))) * ao + albedo * spec * specAmount;
    } else {
        color = albedo * e * ao * (1.0 - 0.15 * velvet);
        // Velvet: the pile catches light at grazing angles and gives it back nearly in the light's own colour.
        vec3 sheen = mix(albedo * 2.5, vec3(0.05), 0.5);
        color += velvet * e * ao * sheen * 1.6 * pow(1.0 - facing, 3.0);
        color += spec * specAmount * 0.25 * ao;
    }
    color += emissive;

    float dist = length(cameraPosition - p);
    // Air: the haze thickens with distance and glows in the screen's light toward the stage.
    vec3 air = uHaze + (uScreenL + uScreenC + uScreenR) * 0.0008 * smoothstep(14.0, 2.0, p.z) * (1.0 - uDay);
    color = mix(color, air, 1.0 - exp(-dist * 0.024));
    gl_FragColor = vec4(finishColor(color), 1.0);
}
`,Rt=`
varying vec2 vUv;
void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
}
`,zt=`
${Pt}
uniform float uDay;
uniform vec2 uMargin;
uniform float uShutter;
uniform vec3 uScreenL;
uniform vec3 uScreenC;
uniform vec3 uScreenR;

varying vec2 vUv;

const vec3 BARE_SCREEN = vec3(0.5, 0.48, 0.45);

void main() {
    // vUv spans the screen and a margin of masking round it; uv is the picture's own 0..1.
    vec2 uv = (vUv - 0.5) * (1.0 + 2.0 * uMargin) + 0.5;
    vec3 thrown = (uScreenL + uScreenC + uScreenR) * (1.0 - uDay);
    vec2 outside = max(abs(uv - 0.5) - 0.5, 0.0) * vec2(SCREEN_W, SCREEN_H);
    float out_ = length(outside);
    if (out_ > 0.0) {
        // The black masking, with a faint halation of the picture's light at its edge.
        gl_FragColor = vec4(finishColor(vec3(0.004) + thrown * 0.0035 * exp(-out_ * 16.0)), 1.0);
        return;
    }
    // The picture is the user's, in a box under the canvas (the host's surface), shown exactly as it is.
    // In an intermission the shutter shuts and the bare screen covers it (pale by the house lights).
    float bare = 1.0 - uShutter;
    gl_FragColor = vec4(finishColor(BARE_SCREEN * uDay) * bare, bare);
}
`,Bt=`
uniform mat4 uInvViewProj;
varying vec4 vFar;
varying vec2 vUv;
void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
    vFar = uInvViewProj * vec4(position.xy, 1.0, 1.0);
    vUv = position.xy * 0.5 + 0.5;
}
`,Vt=`
${Pt}
${Ft}
uniform vec4 uBeamPlanes[4];
uniform sampler3D uNoise;
uniform float uBeamGain;
uniform float uSmokeTime;
// Drawn in a pass of its own after the hall (cinemaPost.ts): the eye, and the hall's depth to stop at.
uniform vec3 uEye;
uniform sampler2D uDepth;
uniform mat4 uInvProj;

varying vec4 vFar;
varying vec2 vUv;

const int STEPS = 14;

void main() {
    vec3 ro = uEye;
    vec3 rd = normalize(vFar.xyz / vFar.w - ro);
    // Clip the view ray to the pyramid from the lens to the screen's edges, and stop at the screen, and at
    // the first thing in the hall the eye sees along it (a curtain, the valance, a wall, a head).
    float t0 = 0.0;
    float t1 = rd.z < -1e-4 ? -ro.z / rd.z : 1e3;
    vec4 hit = uInvProj * vec4(vUv * 2.0 - 1.0, texture2D(uDepth, vUv).r * 2.0 - 1.0, 1.0);
    t1 = min(t1, length(hit.xyz / hit.w));
    for (int i = 0; i < 4; i++) {
        vec4 plane = uBeamPlanes[i];
        float dn = dot(plane.xyz, rd);
        float dist = dot(plane.xyz, ro) + plane.w;
        if (abs(dn) < 1e-6) {
            if (dist < 0.0) discard;
            continue;
        }
        float t = -dist / dn;
        if (dn > 0.0) t0 = max(t0, t);
        else t1 = min(t1, t);
    }
    if (t1 <= t0) discard;

    vec3 lens = vec3(0.0, PROJ_Y, PROJ_Z);
    float throwDistance = length(vec3(0.0, SCREEN_CY, 0.0) - lens);
    float dt = (t1 - t0) / float(STEPS);
    // Interleaved gradient noise: hides the banding of few steps without a crawling speckle.
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3 sum = vec3(0.0);
    for (int i = 0; i < STEPS; i++) {
        vec3 p = ro + rd * (t0 + (float(i) + jitter) * dt);
        vec2 uv = projectorUv(p);
        vec3 light = reelImage(clamp(uv, 0.0, 1.0), 4.0, true);
        light /= 1.0 + 0.8 * light;
        float d = length(p - lens);
        float spread = min(throwDistance * throwDistance / (d * d), 1.6);
        vec3 drift = vec3(uSmokeTime * 0.013, -uSmokeTime * 0.02, uSmokeTime * 0.008);
        float smoke = texture(uNoise, p * 0.085 + drift).r * 0.62 + texture(uNoise, p * 0.23 - drift * 1.7 + 0.37).r * 0.38;
        float density = 0.3 + 1.3 * smoothstep(0.35, 0.9, smoke);
        float edge = smoothstep(0.0, 0.025, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
        sum += light * density * spread * edge;
    }
    sum *= dt * uBeamGain;
    // Added onto the finished picture (the composite pass): brought into display space here.
    gl_FragColor = vec4(linearToSrgb(min(sum, vec3(1.0))) * 0.55, 1.0);
}
`,Ht=`
${we}
attribute vec4 aSeed;
uniform float uDustTime;
uniform float uProjScale;
uniform float uDustGain;
uniform vec3 uScreenL;
uniform vec3 uScreenC;
uniform vec3 uScreenR;
varying vec3 vColor;
varying float vBlur;

vec2 projectorUv(vec3 p) {
    vec3 o = vec3(0.0, PROJ_Y, PROJ_Z);
    vec3 s = p - o;
    vec3 q = o + s * (-o.z / min(s.z, -1e-4));
    return vec2((q.x + SCREEN_W * 0.5) / SCREEN_W, (q.y - (SCREEN_CY - SCREEN_H * 0.5)) / SCREEN_H);
}

void main() {
    vec3 boxMin = vec3(-SCREEN_W * 0.5 - 0.9, 3.0, 3.0);
    vec3 boxSize = vec3(SCREEN_W + 1.8, 7.4, 22.0);
    float t = uDustTime;
    vec3 drift = vec3(
        sin(t * 0.11 + aSeed.w * 40.0) * 0.012,
        t * (0.0018 + 0.003 * aSeed.w),
        cos(t * 0.07 + aSeed.x * 30.0) * 0.006
    );
    vec3 p = boxMin + fract(aSeed.xyz + drift) * boxSize;
    p += vec3(sin(t * 0.6 + aSeed.y * 50.0), sin(t * 0.47 + aSeed.z * 40.0), cos(t * 0.53 + aSeed.w * 20.0)) * 0.05;

    vec2 uv = projectorUv(p);
    float inside = smoothstep(0.0, 0.05, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    vec3 light = uv.x < 0.5 ? mix(uScreenL, uScreenC, uv.x * 2.0) : mix(uScreenC, uScreenR, uv.x * 2.0 - 1.0);
    // Motes turn as they float, catching the beam now and then.
    float glint = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(t * (1.2 + aSeed.w * 2.6) + aSeed.x * 60.0), 4.0);

    vec4 mv = viewMatrix * vec4(p, 1.0);
    float depth = max(-mv.z, 0.1);
    float size = (0.014 + 0.03 * aSeed.w) * uProjScale / depth;
    vBlur = smoothstep(5.0, 1.5, depth);
    float px = mix(max(size, 1.5), min(size * 3.0 + 6.0, 44.0), vBlur);
    // Light spread over a bigger disc is fainter per pixel.
    float energy = min(1.0, (size * size) / (px * px)) * mix(1.0, 3.0, vBlur);
    vColor = light * inside * glint * energy * uDustGain;
    gl_PointSize = px;
    gl_Position = projectionMatrix * mv;
}
`,Ut={room:{vertexShader:It,fragmentShader:Lt},screen:{vertexShader:Rt,fragmentShader:zt},beam:{vertexShader:Bt,fragmentShader:Vt},dust:{vertexShader:Ht,fragmentShader:`
varying vec3 vColor;
varying float vBlur;
void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float dot_ = exp(-r * r * 4.0);
    float disc = (1.0 - smoothstep(0.82, 1.0, r)) * (0.55 + 0.45 * r);
    gl_FragColor = vec4(vColor * mix(dot_, disc, vBlur), 1.0);
}
`},glow:{vertexShader:`
attribute vec3 aColor;
attribute vec2 aSizeKind;
uniform float uProjScale;
uniform float uTime;
uniform float uDay;
uniform vec3 uCove;
uniform float uGlowGain;
varying vec3 vColor;

void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = max(-mv.z, 0.1);
    float px = aSizeKind.x * uProjScale / depth;
    vec3 color = aColor;
    float kind = aSizeKind.y;
    if (kind > 1.5) {
        color = uCove * aColor.r;
    } else if (kind > 0.5) {
        float seed = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
        color *= (0.55 + 0.45 * sin(uTime * (0.6 + seed * 1.4) + seed * 40.0)) * (1.0 - uDay);
    }
    // Below two pixels a lamp keeps its light and loses its size.
    color *= min(1.0, (px * px) / 4.0);
    vColor = color * uGlowGain;
    gl_PointSize = clamp(px, 2.0, 220.0);
    gl_Position = projectionMatrix * mv;
}
`,fragmentShader:`
varying vec3 vColor;
void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float glow = exp(-r * r * 6.0) * (1.0 - r) + 0.7 * exp(-r * r * 60.0);
    gl_FragColor = vec4(vColor * glow, 1.0);
}
`}},Wt=`
varying vec2 vUv;
void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,Gt=`
uniform sampler2D uDepth;
uniform mat4 uInvProj;
uniform float uFocus;
uniform float uAperture;
float cocAt(vec2 uv) {
    vec4 view = uInvProj * vec4(uv * 2.0 - 1.0, texture2D(uDepth, uv).r * 2.0 - 1.0, 1.0);
    float dist = length(view.xyz / view.w);
    return clamp(uAperture * (uFocus / max(dist, 0.05) - 1.0), 0.0, 1.0);
}
`,Kt=`
${Gt}
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uBright;
uniform float uFromDepth;
varying vec2 vUv;
void main() {
    vec4 c = texture2D(uSource, vUv + uTexel * vec2(-0.5, -0.5))
        + texture2D(uSource, vUv + uTexel * vec2(0.5, -0.5))
        + texture2D(uSource, vUv + uTexel * vec2(-0.5, 0.5))
        + texture2D(uSource, vUv + uTexel * vec2(0.5, 0.5));
    c *= 0.25;
    if (uFromDepth > 0.5) {
        c.a = 0.25 * (cocAt(vUv + uTexel * vec2(-0.5, -0.5)) + cocAt(vUv + uTexel * vec2(0.5, -0.5))
            + cocAt(vUv + uTexel * vec2(-0.5, 0.5)) + cocAt(vUv + uTexel * vec2(0.5, 0.5)));
    }
    if (uBright > 0.5) {
        float l = max(c.r, max(c.g, c.b));
        float k = smoothstep(0.55, 1.0, l);
        c = vec4(c.rgb * k * k, 1.0);
    }
    gl_FragColor = c;
}
`,qt=`
uniform sampler2D uSource;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
    vec4 c = texture2D(uSource, vUv) * 0.2042;
    c += (texture2D(uSource, vUv + uStep) + texture2D(uSource, vUv - uStep)) * 0.1802;
    c += (texture2D(uSource, vUv + uStep * 2.0) + texture2D(uSource, vUv - uStep * 2.0)) * 0.1238;
    c += (texture2D(uSource, vUv + uStep * 3.0) + texture2D(uSource, vUv - uStep * 3.0)) * 0.0663;
    c += (texture2D(uSource, vUv + uStep * 4.0) + texture2D(uSource, vUv - uStep * 4.0)) * 0.0276;
    gl_FragColor = c;
}
`,Jt=`
${Gt}
uniform sampler2D uSharp;
uniform sampler2D uSoft;
uniform sampler2D uSofter;
uniform sampler2D uBloom;
uniform vec2 uResolution;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform float uBloomGain;
uniform sampler2D uVolume;
varying vec2 vUv;

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void main() {
    vec4 sharp = texture2D(uSharp, vUv);
    vec4 soft = texture2D(uSoft, vUv);
    vec4 softer = texture2D(uSofter, vUv);
    // Out of focus: the pixel's own blur, or the blur of a near thing spreading over it.
    float cover = sharp.a;
    float coc = max(cocAt(vUv), max(soft.a, softer.a * 0.9));
    vec3 c = mix(sharp.rgb, soft.rgb, smoothstep(0.02, 0.3, coc));
    c = mix(c, softer.rgb, smoothstep(0.3, 0.85, coc));
    // Bloom: added light, so it never darkens; a gentle shoulder keeps the brightest parts from clipping flat.
    vec2 bt = 0.5 / uResolution * 4.0;
    vec3 bloom = (texture2D(uBloom, vUv + vec2(bt.x, bt.y)) + texture2D(uBloom, vUv - vec2(bt.x, bt.y))
        + texture2D(uBloom, vUv + vec2(bt.x, -bt.y)) + texture2D(uBloom, vUv - vec2(bt.x, -bt.y))).rgb * 0.25 * uBloomGain;
    c = c + bloom * (1.0 - c * 0.5);
    // The light in the air (the projector's beam), already stopped at whatever the eye sees first.
    c += texture2D(uVolume, vUv).rgb;
    vec2 q = vUv - 0.5;
    q.x *= uResolution.x / uResolution.y;
    float vignette = 1.0 - uVignette * smoothstep(0.3, 1.15, length(q));
    c *= vignette;
    // Grain on a 1.5-pixel cell, weaker in the highlights as on film.
    float g = hash12(floor(gl_FragCoord.xy / 1.5) + fract(uTime * 7.13) * 917.0) - 0.5;
    c += g * uGrain * (0.35 + 0.65 * (1.0 - c)) * cover;
    // Premultiplied, and no colour beyond the coverage: the beam, the dust, the bloom and the blur add
    // nothing over the user's picture, which shows exactly as on the player page.
    gl_FragColor = vec4(min(c, vec3(cover)), cover);
}
`,Yt=e=>{let t=(e,t,n=!1)=>new ae(1,1,{samples:e,depthBuffer:t,stencilBuffer:!1,type:n?ee:f,minFilter:m,magFilter:m,generateMipmaps:!1}),n=t(4,!0);n.depthTexture=new c(1,1);let r=()=>({uDepth:{value:n.depthTexture},uInvProj:{value:new x},uFocus:{value:14},uAperture:{value:.1}}),i=[t(0,!1,!0),t(0,!1,!0)],a=[t(0,!1,!0),t(0,!1,!0)],o=[t(0,!1,!0),t(0,!1,!0)],s=t(0,!1,!0),l=[n,...i,...a,...o,s];Object.assign(e.uniforms,r(),{uEye:{value:new O}});let u=(e,t)=>new re({vertexShader:Wt,fragmentShader:e,uniforms:t,depthTest:!1,depthWrite:!1}),d=u(Kt,{...r(),uSource:{value:null},uTexel:{value:new _},uBright:{value:0},uFromDepth:{value:0}}),p=u(qt,{uSource:{value:null},uStep:{value:new _}}),h=u(Jt,{...r(),uSharp:{value:n.texture},uSoft:{value:i[0].texture},uSofter:{value:a[0].texture},uBloom:{value:o[0].texture},uResolution:{value:new _(1,1)},uTime:{value:0},uGrain:{value:0},uVignette:{value:0},uBloomGain:{value:0},uVolume:{value:s.texture}}),g=new ue;g.setAttribute(`position`,new v([-1,-1,0,3,-1,0,-1,3,0],3));let te=new y(g,d);te.frustumCulled=!1;let b=new oe(-1,1,1,-1,0,1),S=new _,C=0,w=0,T=(e,t,n)=>{te.material=t,e.setRenderTarget(n),e.render(te,b)},E=(e,t,r,i)=>{d.uniforms.uSource.value=t.texture,d.uniforms.uTexel.value.set(1/t.width,1/t.height),d.uniforms.uBright.value=+!!i,d.uniforms.uFromDepth.value=+(t===n),T(e,d,r)},ne=(e,t,n)=>{p.uniforms.uSource.value=t[0].texture,p.uniforms.uStep.value.set(n/t[0].width,0),T(e,p,t[1]),p.uniforms.uSource.value=t[1].texture,p.uniforms.uStep.value.set(0,n/t[0].height),T(e,p,t[0])},D=e=>{if(e.getDrawingBufferSize(S),S.x===C&&S.y===w)return;C=S.x,w=S.y,n.setSize(C,w);let t=Math.max(1,Math.floor(C/2)),r=Math.max(1,Math.floor(w/2));[...i,s].forEach(e=>e.setSize(t,r)),[...a,...o].forEach(e=>e.setSize(Math.max(1,Math.floor(t/2)),Math.max(1,Math.floor(r/2))))};return{render:(t,r,c,l)=>{D(t);let u=t.autoClear;t.autoClear=!0,t.setClearColor(0,1),t.setRenderTarget(n),t.render(r,c),[d,h,e].forEach(e=>{e.uniforms.uInvProj.value.copy(c.projectionMatrixInverse),e.uniforms.uFocus.value=l.focus,e.uniforms.uAperture.value=l.aperture}),e.uniforms.uEye.value.setFromMatrixPosition(c.matrixWorld),T(t,e,s),E(t,n,i[0],!1),E(t,i[0],o[0],!0),ne(t,i,1.4),E(t,i[0],a[0],!1),ne(t,a,1.6),ne(t,o,1.5),ne(t,o,3.2),h.uniforms.uResolution.value.set(C,w),h.uniforms.uTime.value=l.time,h.uniforms.uGrain.value=l.grain,h.uniforms.uVignette.value=l.vignette,h.uniforms.uBloomGain.value=l.bloom,T(t,h,null),t.autoClear=u},compile:async(t,r,i)=>{let a=new ie;[d,p,e].forEach(e=>a.add(new y(g,e))),D(t),t.setRenderTarget(n);let o=[t.compileAsync(r,i),t.compileAsync(a,b)];t.setRenderTarget(null),await Promise.all([...o,t.compileAsync(new y(g,h),b)])},dispose:()=>{l.forEach(e=>e.dispose()),[d,p,h].forEach(e=>e.dispose()),g.dispose()}}},Xt=1.7,Zt=520,Qt=.32,$t=()=>{let e=new Float32Array(32768);for(let t=0;t<e.length;t+=1)e[t]=Math.random();let t=(t,n,r)=>e[(r+32)%32*32*32+(n+32)%32*32+(t+32)%32],n=new Uint8Array(e.length);for(let e=0;e<32;e+=1)for(let r=0;r<32;r+=1)for(let i=0;i<32;i+=1){let a=0,o=0;for(let n=-1;n<=1;n+=1)for(let s=-1;s<=1;s+=1)for(let c=-1;c<=1;c+=1){let l=(2-Math.abs(c))*(2-Math.abs(s))*(2-Math.abs(n));a+=t(i+c,r+s,e+n)*l,o+=l}n[e*32*32+r*32+i]=Math.round(Math.min(1,Math.max(0,(a/o-.5)*2.6+.5))*255)}let r=new g(n,32,32,32);return r.format=E,r.type=f,r.minFilter=m,r.magFilter=m,r.wrapS=D,r.wrapT=D,r.wrapR=D,r.unpackAlignment=1,r.needsUpdate=!0,r},en=()=>{let e=new O(0,_e.y,_e.z),t=I.centerY-I.height/2,n=I.centerY+I.height/2,r=I.width/2,i=[new O(-r,t,0),new O(r,t,0),new O(r,n,0),new O(-r,n,0)],a=new O(0,I.centerY,0).sub(e);return i.map((t,n)=>{let r=i[(n+1)%4],o=new O().crossVectors(t.clone().sub(e),r.clone().sub(e)).normalize();return o.dot(a)<0&&o.negate(),new l(o.x,o.y,o.z,-o.dot(e))})},tn=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},$=(e,t,n)=>e+(t-e)*n,nn=(e,t,n,r)=>e+(t-e)*(1-Math.exp(-n*r)),rn=[.32,1,.32],an=()=>new Promise(e=>{setTimeout(e,0)}),on=async()=>{let e=vt(),t=$t(),n={uTime:{value:0},uResolution:{value:new _(1,1)},uExposure:{value:1},uFocus:{value:14},uAperture:{value:.1},uScreenL:{value:new O},uScreenC:{value:new O},uScreenR:{value:new O},uAmbient:{value:new O},uHaze:{value:new O},uCove:{value:new O},uHouse:{value:0},uSconce:{value:.55},uFoot:{value:.9},uDay:{value:0},uBoxLamp:{value:1},uTexA:{value:e.texture},uTexB:{value:e.texture},uAspectA:{value:1},uAspectB:{value:1},uChange:{value:1},uShutter:{value:1},uMargin:{value:new _(Qt/I.width,Qt/I.height)},uInvViewProj:{value:new x},uBeamPlanes:{value:en()},uNoise:{value:t},uBeamGain:{value:.05},uSmokeTime:{value:0},uDustTime:{value:0},uProjScale:{value:1e3},uDustGain:{value:.04},uGlowGain:{value:1}},r=new ie,i=[],a=[],o=e=>(e instanceof b?a.push(e):i.push(e),e),s=o(new re({...Ut.room,uniforms:n})),c=(e,t)=>{let n=new p(o(e),s,t.length);return t.forEach((e,t)=>n.setMatrixAt(t,e)),n.instanceMatrix.needsUpdate=!0,n};await an();let l=c(nt(),st());l.renderOrder=0;let u=c(rt(),ot());u.renderOrder=0,await an();let d=new y(o(et()),s);d.renderOrder=1,await an();let f=We(),m=new y(o(f.geometry),s);m.renderOrder=1,await an();let ee=Nt(),h={left:{top:0,bottom:0},right:{top:0,bottom:0}},g=(e,t)=>Math.abs(e.top-t.top)>1e-4||Math.abs(e.bottom-t.bottom)>1e-4,S=new y(o(new C(I.width+Qt*2,I.height+Qt*2)),o(new re({...Ut.screen,uniforms:n})));S.position.set(0,I.centerY,.02),S.renderOrder=2;let w=(e,t)=>o(new re({...e,uniforms:n,transparent:!0,depthWrite:!1,depthTest:t,blending:5,blendEquation:100,blendSrc:201,blendDst:201,blendSrcAlpha:200,blendDstAlpha:201})),T=dt(),E=o(new ue);E.setAttribute(`position`,new v(T.flatMap(e=>e.position),3)),E.setAttribute(`aColor`,new v(T.flatMap(e=>e.color),3)),E.setAttribute(`aSizeKind`,new v(T.flatMap(e=>[e.size,e.kind]),2));let ne=new ce(E,w(Ut.glow,!0));ne.renderOrder=5;let D=o(new ue),ae=new Float32Array(Zt*4);for(let e=0;e<ae.length;e+=1)ae[e]=Math.random();D.setAttribute(`position`,new v(new Float32Array(Zt*3),3)),D.setAttribute(`aSeed`,new v(ae,4));let k=new ce(D,w(Ut.dust,!0));k.renderOrder=6;let oe=Yt(o(new re({...Ut.beam,uniforms:{...n},depthTest:!1,depthWrite:!1})));[l,u,d,m,S,ne,k].forEach(e=>{e.frustumCulled=!1,r.add(e)});let A=e,j=e,se=1,le=0,M=0,N=0,P=0,de=0,fe=0,pe=[new O,new O,new O],F=[new O,new O,new O],L=(e,t)=>{e.colors.forEach((e,n)=>t[n].set(e.r,e.g,e.b).multiplyScalar(rn[n]))};L(e,pe),L(e,F);let R=t=>{t!==e&&t!==A&&t!==j&&t.texture.dispose()},z=(t,r)=>{let i=t??e;if(i===A)return;let a=j;j=A,A=i,R(a),se=+!r,n.uTexA.value=A.texture,n.uTexB.value=j.texture,n.uAspectA.value=A.aspect,n.uAspectB.value=j.aspect,L(A,pe),L(j,F)},B=[new O,new O,new O],V=[new O,new O,new O],H=!1,U=0,me=e=>{e&&(e.forEach((e,t)=>B[t].set(e.r,e.g,e.b)),U===0&&V.forEach((e,t)=>e.copy(B[t]))),H=e!==null},he=new O,ge=new O,_e=new O,W=({dt:e,running:t,power:r,bass:i,lightsUp:a,still:o,curtainsOnPause:s,cove:c,camera:l,bufferSize:u})=>{le+=e,N=t?nn(N,r,5,e):N,P=t?nn(P,i,7,e):P;let d=ee.step(e,t,a,o,s);M=d.lights;let p=d.shutter;(g(d.left,h.left)||g(d.right,h.right))&&(f.set(d.left,d.right),Object.assign(h.left,d.left),Object.assign(h.right,d.right)),se=t?Math.min(1,se+e/Xt):1,de+=e*(1+1.4*N),fe+=e*(1+1.8*N),n.uFocus.value=Math.hypot(l.position.x,l.position.y-I.centerY,l.position.z),n.uInvViewProj.value.multiplyMatrices(l.matrixWorld,l.projectionMatrixInverse),n.uProjScale.value=u.y/(2*Math.tan(te.degToRad(l.fov)/2)),n.uResolution.value.copy(u);let m=tn(.42,.58,se),_=1+.08*P,v=$(6.5,1.1,M)*_,y=[n.uScreenL.value,n.uScreenC.value,n.uScreenR.value],b=Ve(d.left,d.right),x=I.width/6,S=Math.min(1,Math.max(0,(b-x)/(2*x))),C=[S,Math.min(1,b/x),S];he.set(0,0,0),ge.set(0,0,0),U=nn(U,+!!H,2,e),U<.001&&!H&&(U=0),y.forEach((t,n)=>{V[n].lerp(B[n],1-Math.exp(-3*e)),_e.lerpVectors(F[n],pe[n],m).lerp(V[n],U).multiplyScalar((1-M)*p),_e.addScalar(M*.32),t.copy(_e).multiplyScalar(v),ge.add(t),t.multiplyScalar(C[n]),he.add(t)}),he.multiplyScalar(1/3),n.uTime.value=le,n.uDay.value=M,n.uShutter.value=p,n.uChange.value=se,n.uAmbient.value.copy(he).multiplyScalar(.012).add(new O(.0018,.002,.0027).multiplyScalar(1-M)),n.uHaze.value.copy(he).multiplyScalar(.004*(1-M)).add(new O(.2,.15,.1).multiplyScalar(M*.1)),n.uHouse.value=$(.085,1.7,M),n.uSconce.value=$(1.05,.9,M),n.uFoot.value=$(.7,.55,M),n.uBoxLamp.value=$(.78,.6,M),n.uCove.value.set(c.r,c.g,c.b).multiplyScalar($(.32,.5,M));let w=(.2126*ge.x+.7152*ge.y+.0722*ge.z)/(3*Math.max(v,.001));return n.uBeamGain.value=$(.06,.006,M)*(1+.18*P)*Math.min(1.6,.16/Math.max(w,.02))*p,n.uSmokeTime.value=de,n.uDustTime.value=fe,n.uDustGain.value=$(.35,.03,M)*(1+.6*N)*p,p},G={time:0,grain:0,vignette:0,bloom:0,focus:14,aperture:.1};return{setReel:z,setScreenLight:me,update:W,render:(e,t)=>{let i=1-Math.max(0,M);G.time=le,G.grain=$(.022,.05,i),G.vignette=$(.22,.5,i),G.bloom=$(.15,.5,i),G.focus=n.uFocus.value,G.aperture=n.uAperture.value,oe.render(e,r,t,G)},compile:(e,t)=>oe.compile(e,r,t),dispose:()=>{oe.dispose(),i.forEach(e=>e.dispose()),a.forEach(e=>e.dispose()),l.dispose(),u.dispose(),t.dispose(),[A,j].forEach(t=>{t!==e&&t.texture.dispose()}),e.texture.dispose()}}},sn=e=>[e[4]*e[8]-e[5]*e[7],e[2]*e[7]-e[1]*e[8],e[1]*e[5]-e[2]*e[4],e[5]*e[6]-e[3]*e[8],e[0]*e[8]-e[2]*e[6],e[2]*e[3]-e[0]*e[5],e[3]*e[7]-e[4]*e[6],e[1]*e[6]-e[0]*e[7],e[0]*e[4]-e[1]*e[3]],cn=(e,t)=>{let n=Array(9).fill(0);for(let r=0;r<3;r+=1)for(let i=0;i<3;i+=1)for(let a=0;a<3;a+=1)n[3*r+i]+=e[3*r+a]*t[3*a+i];return n},ln=e=>{let t=[e[0][0],e[1][0],e[2][0],e[0][1],e[1][1],e[2][1],1,1,1],n=sn(t),r=[n[0]*e[3][0]+n[1]*e[3][1]+n[2],n[3]*e[3][0]+n[4]*e[3][1]+n[5],n[6]*e[3][0]+n[7]*e[3][1]+n[8]];return cn(t,[r[0],0,0,0,r[1],0,0,0,r[2]])},un=(e,t,n)=>{let r=n.map(e=>e.w);if(r.every(e=>e!==void 0)){let[i,a,,o]=n,[s,c,,l]=r,u=[(a.x-i.x)/e,(o.x-i.x)/t,i.x,(a.y-i.y)/e,(o.y-i.y)/t,i.y,(c-s)/e,(l-s)/t,s],d=Math.max(...r.map(e=>Math.abs(e)),1e-9);return u.map(e=>e/d)}let i=ln([[0,0],[e,0],[0,t],[e,t]]),a=cn(ln([[n[0].x,n[0].y],[n[1].x,n[1].y],[n[3].x,n[3].y],[n[2].x,n[2].y]]),sn(i));return a.map(e=>e/a[8])},dn=(e,t,n)=>{let r=un(e,t,n);return`matrix3d(${[r[0],r[3],0,r[6],r[1],r[4],0,r[7],0,0,1,0,r[2],r[5],0,r[8]].map(e=>Number.isFinite(e)?Number(e.toFixed(9)):0).join(`,`)})`},fn=1280,pn=Math.round(fn*I.height/I.width),mn=Math.round((z.count-1)*(2/3)),hn=te.degToRad(80),gn=[[-I.width/2,I.centerY+I.height/2,.02],[I.width/2,I.centerY+I.height/2,.02],[I.width/2,I.centerY-I.height/2,.02],[-I.width/2,I.centerY-I.height/2,.02]];function _n(e,t,n,r){let a=new ne({alpha:!0,antialias:!1,powerPreference:`high-performance`});a.setClearColor(0,0);let o=a.domElement;e.appendChild(o);let s=new se(36,1,.1,90),c=Se().filter(e=>!at(mn,e)).sort((e,t)=>Math.abs(e)-Math.abs(t))[0]??0;s.position.set(c,xe(mn)+1.15,ye(mn,c)-.3);let u=new O(0,I.centerY-.2,0).sub(s.position),d=Math.atan2(-u.x,-u.z),f=Math.atan2(u.y,Math.hypot(u.x,u.z)),p=new _,m=new l,ee=new M,h=null,g=!1,v=!1,y=!1,b=0,x=0,S=0,C=0,w=0,T=0,E=!0,D=0,re,ie=0,ae,k=()=>{!g&&v&&!b&&!document.hidden&&(b=requestAnimationFrame(le))},oe=()=>{D=performance.now()+6500,k()},A=()=>{let t=e.clientWidth,n=e.clientHeight;t<=0||n<=0||t===S&&n===C||(S=t,C=n,a.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),a.setSize(S,C,!1),s.aspect=S/C,s.updateProjectionMatrix(),pe(s,fe),E=!0,k())},j=(e,t)=>{re=e;let n=++ie;e?yt(e).then(e=>{g||n!==ie||!h?e?.texture.dispose():(h.setReel(e,t),oe())}):h?.setReel(null,t)},ce=()=>{let e=gn.map(([e,t,n])=>(m.set(e,t,n,1).applyMatrix4(s.matrixWorldInverse).applyMatrix4(s.projectionMatrix),{x:(m.x+m.w)*S/2,y:(m.w-m.y)*C/2,w:m.w}));t.style.width=`${fn}px`,t.style.height=`${pn}px`,t.style.transform=dn(fn,pn,e)};function le(e){if(b=0,g||!h||document.hidden||!S||!C)x=0;else try{let o=n();o.cover!==re&&j(o.cover,o.playing),o.accent!==ae&&(ae=o.accent,ee.setStyle(i(`#ffd6a8`,ae,.4))),E&&=(s.rotation.set(f+T,d+w,0,`YXZ`),s.updateMatrixWorld(),ce(),!1);let c=x?Math.min(.1,Math.max(0,(e-x)/1e3)):0;x=e;let l=h.update({dt:c,running:o.playing,power:o.reducedMotion?0:o.power,bass:o.reducedMotion?0:o.bass,lightsUp:o.lightsUp,curtainsOnPause:o.curtainsOnPause,still:o.reducedMotion,cove:ee,camera:s,bufferSize:a.getDrawingBufferSize(p)});h.render(a,s),t.style.visibility=l>0?``:`hidden`,y||(y=!0,r(`ready`)),!o.reducedMotion&&(o.playing||e<D)?k():x=0}catch{F()}}let ue=new ResizeObserver(A),N=e=>{e.preventDefault(),F()},P=()=>{document.hidden?(cancelAnimationFrame(b),b=x=0):oe()};function de(){if(!g){g=!0,ie++,cancelAnimationFrame(b),ue.disconnect(),o.removeEventListener(`webglcontextlost`,N),document.removeEventListener(`visibilitychange`,P),h?.dispose(),h=null,a.dispose(),a.forceContextLoss(),o.remove();for(let e of[`width`,`height`,`transform`,`visibility`])t.style.removeProperty(e)}}function F(){g||(de(),r(`failed`))}return ue.observe(e),o.addEventListener(`webglcontextlost`,N),document.addEventListener(`visibilitychange`,P),A(),(async()=>{try{let e=await on();if(g){e.dispose();return}h=e,await e.compile(a,s),g||(v=!0,oe())}catch{F()}})(),{sync:oe,dispose:de,turn:(e,t)=>{w=te.clamp(w+e,-hn,hn),T=te.clamp(T+t,-hn-f,hn-f),E=!0,k()},reset:()=>{w=T=0,E=!0,k()}}}var vn=o();function yn({player:e,theme:t,lightsUp:i,curtainsOnPause:o,onClose:c,children:l}){let{t:u}=s(`localPlayer`),d=a(`uiMicroMotion`),[f,p]=(0,P.useState)(`loading`),m=(0,P.useRef)(null),ee=(0,P.useRef)(null),h=(0,P.useRef)(null),g=(0,P.useRef)(null),_=e.state?.playing===!0,v=e.state?.currentTrack?.cover??``,y=(0,P.useRef)({player:e,reducedMotion:d,playing:_,cover:v,accent:t.accentColor,lightsUp:i,curtainsOnPause:o});return y.current={player:e,reducedMotion:d,playing:_,cover:v,accent:t.accentColor,lightsUp:i,curtainsOnPause:o},(0,P.useEffect)(()=>{try{let e=_n(m.current,ee.current,()=>{let e=y.current;return{...e,power:Math.min(1,e.player.audioPower.get()/255),bass:Math.min(1,e.player.audioBands.bass.get()/255)}},p);g.current=e;let t=de(h.current,e.turn);return()=>{g.current=null,t(),e.dispose()}}catch{p(`failed`);return}},[]),(0,P.useEffect)(()=>{g.current?.sync()},[_,v,t.accentColor,i,o,d]),(0,vn.jsxs)(`section`,{ref:h,className:`local-cinema`,"data-testid":`local-cinema`,"data-status":f,"aria-label":u(`cinemaBeta`),tabIndex:f===`ready`?0:-1,onKeyDown:e=>{if(e.target!==e.currentTarget||f!==`ready`)return;let t={ArrowLeft:[.13,0],ArrowRight:[-.13,0],ArrowUp:[0,.1],ArrowDown:[0,-.1]}[e.key];t&&(e.preventDefault(),g.current?.turn(...t))},children:[(0,vn.jsx)(`div`,{ref:ee,className:`local-cinema-screen`,"data-testid":`local-cinema-screen`,children:l}),(0,vn.jsx)(`div`,{ref:m,className:`local-cinema-hall`,"aria-hidden":`true`}),(0,vn.jsxs)(`div`,{className:`local-cinema-tools`,"data-scene-no-look":!0,children:[(0,vn.jsx)(`button`,{type:`button`,"data-testid":`local-cinema-exit`,className:`local-glass`,onClick:c,title:u(`cinemaExit`),"aria-label":u(`cinemaExit`),children:(0,vn.jsx)(n,{size:19})}),f===`ready`&&(0,vn.jsx)(`button`,{type:`button`,"data-testid":`local-cinema-reset`,className:`local-glass`,title:u(`cinemaReset`),"aria-label":u(`cinemaReset`),onClick:()=>g.current?.reset(),children:(0,vn.jsx)(r,{size:17})}),f!==`ready`&&(0,vn.jsx)(`span`,{className:`local-glass`,role:`status`,children:u(f===`failed`?`cinemaUnavailable`:`cinemaLoading`)})]})]})}export{yn as default};