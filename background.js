// Animated topographic-contour site background.
//
// Renders evenly-spaced iso-contours of a smooth (domain-warped fractal-noise)
// field onto a full-viewport canvas behind the page content. The field slowly
// translates ("drift") along a gentle diagonal, with a subtle perpendicular
// contour sweep on top. Values below are the ones dialed in via bg_test2.html.
//
// Kept light on purpose: capped frame rate + device-pixel ratio, a coarse
// sampling grid, cached domain-warp coordinates, and a single stroke per frame.
// Honors prefers-reduced-motion (renders one static frame) and pauses while the
// tab is hidden.
(() => {
  "use strict";
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  // Set positioning inline too, so a stale/cached style.css can't leave the
  // canvas in normal flow (which would push the page content down).
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block";
  const ctx = canvas.getContext("2d");

  const INK = "#555753";
  const P = { scale:578, spacing:22, weight:0.6, oct:3, gain:0.30, lac:2.0, warp:90, seed:20240623 };
  const FPS_CAP = 10;     // render rate (Hz)
  const DPR_CAP = 1.5;    // clamp device-pixel ratio (raster cost)
  const CELL    = 8;      // sampling grid step (px); larger = cheaper, slightly softer
  const SPEED   = 0.1;    // overall motion rate
  const PAN_MAG = 0.04 * SPEED;          // field translation, noise-units/sec
  const PAN_DX  = 0.944, PAN_DY = 0.330; // unit diagonal travel direction
  const SWEEP   = 0.10 * SPEED;          // perpendicular contour sweep, cycles/sec

  // ---- value noise + fbm ----
  function makeNoise(seed){
    let s = seed>>>0;
    const rnd=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
    const perm=new Uint8Array(256);
    for(let i=0;i<256;i++) perm[i]=i;
    for(let i=255;i>0;i--){ const j=(rnd()*(i+1))|0; const t=perm[i]; perm[i]=perm[j]; perm[j]=t; }
    const fade=t=>t*t*(3-2*t);
    const hash=(x,y)=> perm[(perm[x&255]+(y&255))&255]/255*2-1;
    return (x,y)=>{
      const x0=Math.floor(x), y0=Math.floor(y), fx=fade(x-x0), fy=fade(y-y0);
      const v00=hash(x0,y0), v10=hash(x0+1,y0), v01=hash(x0,y0+1), v11=hash(x0+1,y0+1);
      const a=v00+(v10-v00)*fx, b=v01+(v11-v01)*fx;
      return a+(b-a)*fy;
    };
  }
  const nMain=makeNoise(P.seed), nWx=makeNoise(P.seed^0x9e37), nWy=makeNoise(P.seed^0x85eb);
  function fbm(noise,x,y,oct,gain,lac){
    let amp=1,f=1,sum=0,acc=0;
    for(let o=0;o<oct;o++){ acc+=amp*noise(x*f,y*f); sum+=amp; amp*=gain; f*=lac; }
    return acc/sum;
  }

  // ---- caches ----
  let W=0,H=0,dpr=1, cnx=0,cny=0, baseX=null,baseY=null, g=null, gLo=0,gHi=0,gGrad=0;

  // warp coords don't depend on time -> rebuilt only on size change
  function buildBase(){
    cnx=Math.ceil(W/CELL)+1; cny=Math.ceil(H/CELL)+1;
    const n=cnx*cny, f=1/P.scale, fw=f*0.55;
    baseX=new Float32Array(n); baseY=new Float32Array(n); g=new Float32Array(n);
    for(let j=0;j<cny;j++){ const y=j*CELL;
      for(let i=0;i<cnx;i++){ const x=i*CELL;
        let sx=x, sy=y;
        if(P.warp>0){
          sx += P.warp*fbm(nWx, x*fw, y*fw, 2, 0.5, 2);
          sy += P.warp*fbm(nWy, x*fw+3.1, y*fw+1.7, 2, 0.5, 2);
        }
        baseX[j*cnx+i]=sx*f; baseY[j*cnx+i]=sy*f;
      }
    }
  }

  function computeField(dox,doy){
    let lo=Infinity,hi=-Infinity;
    for(let k=0;k<g.length;k++){
      const v=fbm(nMain, baseX[k]+dox, baseY[k]+doy, P.oct, P.gain, P.lac);
      g[k]=v; if(v<lo)lo=v; if(v>hi)hi=v;
    }
    let gs=0,gn=0;
    for(let j=0;j<cny-1;j++) for(let i=0;i<cnx-1;i++){
      const a=g[j*cnx+i], b=g[j*cnx+i+1], d=g[(j+1)*cnx+i];
      gs+=Math.hypot((b-a)/CELL,(d-a)/CELL); gn++;
    }
    gLo=lo; gHi=hi; gGrad=gn?gs/gn:(hi-lo)/Math.min(W,H);
  }

  function draw(loffFrac){
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    if(gHi<=gLo) return;
    const step=Math.max((gHi-gLo)/600, P.spacing*gGrad);
    const loff=loffFrac*step;
    ctx.strokeStyle=INK; ctx.lineWidth=P.weight; ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.beginPath();
    for(let j=0;j<cny-1;j++){
      const y0=j*CELL, y1=y0+CELL;
      for(let i=0;i<cnx-1;i++){
        const x0=i*CELL, x1=x0+CELL;
        const a=g[j*cnx+i], b=g[j*cnx+i+1], c=g[(j+1)*cnx+i+1], d=g[(j+1)*cnx+i];
        let cmin=a,cmax=a;
        if(b<cmin)cmin=b; else if(b>cmax)cmax=b;
        if(c<cmin)cmin=c; else if(c>cmax)cmax=c;
        if(d<cmin)cmin=d; else if(d>cmax)cmax=d;
        const nlo=Math.ceil((cmin-loff)/step), nhi=Math.floor((cmax-loff)/step);
        for(let n=nlo;n<=nhi;n++){
          const L=n*step+loff;
          let idx=0; if(a>=L)idx|=1; if(b>=L)idx|=2; if(c>=L)idx|=4; if(d>=L)idx|=8;
          if(idx===0||idx===15) continue;
          // edge crossing points (unused ones are never referenced by the case)
          const tx=x0+(L-a)/(b-a)*CELL, ty=y0;
          const rx=x1,               ry=y0+(L-b)/(c-b)*CELL;
          const bx=x1-(L-c)/(d-c)*CELL, by=y1;
          const lx=x0,               ly=y1-(L-d)/(a-d)*CELL;
          // complementary cases (e.g. 1 & 14) draw the same segment, so they share a branch
          switch(idx){
            case 1: case 14: ctx.moveTo(tx,ty); ctx.lineTo(lx,ly); break;
            case 2: case 13: ctx.moveTo(tx,ty); ctx.lineTo(rx,ry); break;
            case 3: case 12: ctx.moveTo(rx,ry); ctx.lineTo(lx,ly); break;
            case 4: case 11: ctx.moveTo(rx,ry); ctx.lineTo(bx,by); break;
            case 6: case 9:  ctx.moveTo(tx,ty); ctx.lineTo(bx,by); break;
            case 7: case 8:  ctx.moveTo(bx,by); ctx.lineTo(lx,ly); break;
            case 5:  ctx.moveTo(tx,ty); ctx.lineTo(lx,ly); ctx.moveTo(rx,ry); ctx.lineTo(bx,by); break;
            case 10: ctx.moveTo(tx,ty); ctx.lineTo(rx,ry); ctx.moveTo(bx,by); ctx.lineTo(lx,ly); break;
          }
        }
      }
    }
    ctx.stroke();
  }

  function ensureSize(){
    const r=canvas.getBoundingClientRect();
    const nw=Math.round(r.width), nh=Math.round(r.height);
    const d=Math.min(DPR_CAP, window.devicePixelRatio||1);
    if(nw!==W||nh!==H||d!==dpr){
      W=nw; H=nh; dpr=d;
      canvas.width=Math.max(1,Math.round(W*dpr));
      canvas.height=Math.max(1,Math.round(H*dpr));
      if(W&&H) buildBase();
      return true;
    }
    return false;
  }

  function renderStatic(){ ensureSize(); if(W&&H){ computeField(0,0); draw(0); } }

  // ---- run loop ----
  const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let last=performance.now()-1000, t=0, raf=0;

  function frame(now){
    raf=requestAnimationFrame(frame);
    if(document.hidden){ last=now; return; }      // pause while tab hidden
    ensureSize();
    if(!W||!H) return;
    if(now-last < 1000/FPS_CAP) return;            // throttle
    const dt=(now-last)/1000; last=now; t+=dt;
    computeField(PAN_DX*PAN_MAG*t, PAN_DY*PAN_MAG*t);
    draw((SWEEP*t)%1);
  }

  function start(){
    cancelAnimationFrame(raf);
    if(mq && mq.matches){
      renderStatic();
      window.addEventListener("resize", renderStatic);
    } else {
      window.removeEventListener("resize", renderStatic);
      last=performance.now()-1000;
      raf=requestAnimationFrame(frame);
    }
  }
  if(mq && mq.addEventListener) mq.addEventListener("change", start);
  start();
})();
