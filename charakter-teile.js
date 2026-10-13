/* RB-Party Charakter-Teile (v2, Stil 9: weiche Bitmoji-Optik ohne Umrisse)
   Alles (Haare, Mütze, Brille, Bart, Ohren, Hals, Kleidung) wird aus der Kopfgeometrie berechnet
   und passt sich automatisch an Gesichtsbreite, -länge, Kieferform und Körperbau an.
   Stil: einheitliche dunkle Umrisse, flache Farben, ein Schattenton, große Augen.
   Konfiguration (cfg.v = 2):
   { v:2, face:{s,c,w,h}, body:{s}, hair:{s,c}, beard:{s,c}, brows:{s,c}, eyes:{s,c}, nose:{s}, mouth:{s,c},
     marks:{s,c,c2}, glasses:{s,c,c2}, hat:{s,c,c2}, outfit:{s,c,c2}, jewel:{s,c,c2}, extra:{s,c,c2} }
   s = Stil, c = Hauptfarbe, c2 = Zweitfarbe, face.w/h = Breite/Länge-Faktor. c='' bei beard/brows = wie Haare. */
(function(root){
  'use strict';
  let uid = 0;
  const INK = '#3A2A26', LW = 1.5;

  // ---------- Hilfsfunktionen ----------
  function shade(hex, amt){
    const m = /^#?([0-9a-f]{6})$/i.exec(hex||''); if(!m) return hex;
    const n = parseInt(m[1],16); let r=n>>16, g=(n>>8)&255, b=n&255;
    const f = amt<0 ? 0 : 255, p = Math.abs(amt);
    r=Math.round((f-r)*p+r); g=Math.round((f-g)*p+g); b=Math.round((f-b)*p+b);
    return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
  }
  const r1 = n=>Math.round(n*10)/10;
  const P = p=>r1(p[0])+' '+r1(p[1]);
  function crOpen(pts){
    let d='';
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[Math.max(0,i-1)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(pts.length-1,i+2)];
      d += `C${P([p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6])} ${P([p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6])} ${P(p2)}`;
    }
    return d;
  }
  function crClosed(pts){
    const n=pts.length; let d='M'+P(pts[0]);
    for(let i=0;i<n;i++){
      const p0=pts[(i-1+n)%n], p1=pts[i], p2=pts[(i+1)%n], p3=pts[(i+2)%n];
      d += `C${P([p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6])} ${P([p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6])} ${P(p2)}`;
    }
    return d+'Z';
  }
  const pathOpen = pts=>'M'+P(pts[0])+crOpen(pts);
  const poly = pts=>'M'+pts.map(P).join('L');
  const mirror = pts=>pts.map(p=>[200-p[0],p[1]]);
  const rev = a=>a.slice().reverse();
  // Stil 9: keine Umrisse. OL/lo bleiben als leere Funktionen, damit alle Aufrufe weiter funktionieren.
  const OL = ()=>'';
  const lo = ()=>'';
  function clip(g, d){ const id=g.id('cp'); g.defs += `<clipPath id="${id}"><path d="${d}"/></clipPath>`; return id; }

  // Verlauf-Helfer: legen Definitionen in g.defs ab und liefern die ID
  // Comic-Stil: flache Farben (Verläufe werden zur Mittelfarbe, Licht-/Schatten-Überlagerungen unsichtbar) und dunkle Konturen per Filter
  const TOON = true, OLW = 1.35;
  const flat = stops=>{ if(!TOON) return stops; if(stops.some(s=>s[2]!==undefined)) return stops.map(s=>[s[0],s[1],0]); const m=stops[Math.floor(stops.length/2)][1]; return stops.map(s=>[s[0],m]); };
  function lin(g, stops, x1,y1,x2,y2, user){
    stops=flat(stops); const id=g.id('lg');
    g.defs += `<linearGradient id="${id}"${user?' gradientUnits="userSpaceOnUse"':''} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(s=>`<stop offset="${s[0]}" stop-color="${s[1]}"${s[2]!==undefined?` stop-opacity="${s[2]}"`:''}/>`).join('')}</linearGradient>`;
    return id;
  }
  function rad(g, stops, cx,cy,r, user){
    stops=flat(stops); const id=g.id('rg');
    g.defs += `<radialGradient id="${id}"${user?' gradientUnits="userSpaceOnUse"':''} cx="${cx}" cy="${cy}" r="${r}">${stops.map(s=>`<stop offset="${s[0]}" stop-color="${s[1]}"${s[2]!==undefined?` stop-opacity="${s[2]}"`:''}/>`).join('')}</radialGradient>`;
    return id;
  }

  // ---------- Paletten ----------
  const SKIN = ['#FFE0C7','#F9CFA9','#F0B98F','#DFA172','#C98856','#A86B3E','#7D4A28','#52301B','#B7E4A0','#9EC9F0'];
  const HAIR = ['#F2D98D','#E0B95A','#C69A4A','#A8693A','#7A4A28','#4A2C1B','#2B1F1A','#141414','#C4501F','#9B9B9B','#EDEDED','#7B4BC9','#2E86DE','#E84393','#27AE60'];
  const IRIS = ['#4F8FD6','#7FA4C2','#4F9A5B','#B07D2F','#7A4A28','#3B2418','#8E8E93','#7B4BC9'];
  const LIPS = ['#D9776F','#C4565F','#A95A4C','#E8869A','#8A4B44','#F0A090'];
  const CLOTH = ['#1D1D1F','#F5F5F7','#8E8E93','#C9CCD1','#3A3F44','#1F2A55','#4B6A94','#8FB8E0','#C0392B','#E8590C','#F2C230','#3D8B44','#6C3FB5','#E84393','#D9C9A3','#7A4B26'];
  const METAL = ['#C9CCD1','#B8860B','#F2B01E','#1D1D1F','#F5F5F7','#7A4B26'];
  const BLUSH = ['#F2677F','#E8869A','#D9534A','#B0764A'];

  // ---------- Gesichtsformen ----------
  const FACES = [
    {n:'Normal',   hw:47, ht:98,  jaw:.80, flat:.40},
    {n:'Rund',     hw:52, ht:92,  jaw:.90, flat:.50},
    {n:'Schmal',   hw:42, ht:102, jaw:.76, flat:.30},
    {n:'Eckig',    hw:49, ht:98,  jaw:.98, flat:.62},
    {n:'Herzform', hw:47, ht:100, jaw:.64, flat:.22},
    {n:'Kräftig',  hw:54, ht:98,  jaw:1.0, flat:.55},
    {n:'Kantig',   hw:44, ht:100, jaw:.92, flat:.56}
  ];  const BODIES = [{n:'Schmal',k:.88},{n:'Normal',k:1},{n:'Kräftig',k:1.14},{n:'Breit',k:1.28}];

  function geom(cfg){
    const f = FACES[cfg.face.s], k = cfg.face.w, hk = cfg.face.h, bk = BODIES[cfg.body.s].k*(1+.16*(cfg.body.w||0));
    const E=cfg.eyes||{}, B=cfg.brows||{}, N=cfg.nose||{}, M=cfg.mouth||{}, H=cfg.hair||{};
    const jawF = Math.max(.5,Math.min(1.05,f.jaw+(cfg.face.j||0)*.16));
    const hw = f.hw*k, ht = f.ht*hk, top = 46, chin = top+ht;
    const jw = hw*jawF, cw = Math.max(2, jw*f.flat);
    const R = [[0,top],[hw*.72,top+.07*ht],[hw*.97,top+.22*ht],[hw,top+.42*ht],[hw*(1+jawF)/2*.99,top+.60*ht],[jw,top+.76*ht],[cw+(jw-cw)*.5,top+.90*ht],[cw,chin]];
    const full = R.map(p=>[100+p[0],p[1]]);
    for(let i=R.length-1;i>=1;i--) full.push([100-R[i][0],R[i][1]]);
    const g = {hw, ht, top, chin, jw, cw, R, headD:crClosed(full), n:++uid, k:0, defs:'', sk:cfg.face.c};
    g.id = p=>p+g.n+'_'+(++g.k);
    // Kopfbreite je Höhe: aus der echten (weichen) Kopfkurve abgetastet, damit Haare keine Knicke bekommen
    const dense=[], nF=full.length;
    for(let i=0;i<R.length-1;i++){
      const p0=full[(i-1+nF)%nF], p1=full[i], p2=full[i+1], p3=full[(i+2)%nF];
      const c1=[p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6], c2=[p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6];
      for(let s=(i?1:0);s<=16;s++){ const q=s/16, m=1-q;
        dense.push([m*m*m*p1[0]+3*m*m*q*c1[0]+3*m*q*q*c2[0]+q*q*q*p2[0]-100, m*m*m*p1[1]+3*m*m*q*c1[1]+3*m*q*q*c2[1]+q*q*q*p2[1]]); }
    }
    g.hwAt = y=>{
      if(y<=top) return 0.5; if(y>=chin) return cw;
      for(let i=0;i<dense.length-1;i++){ const a=dense[i], b=dense[i+1]; if(y<=b[1]){ const t=b[1]===a[1]?0:(y-a[1])/(b[1]-a[1]); return Math.max(.5,a[0]+(b[0]-a[0])*t); } }
      return cw;
    };    const u = hw/10; g.u = u;
    g.eyeRed = E.red||0; g.ue = u*(1+.45*(E.size||0)); g.um = u*(1+.45*(M.size||0)); g.un = u*(1+.45*(N.size||0));
    g.eyeY = top+.53*ht + u*1.1*(E.dy||0); g.eDX = hw*.42*(1+.28*(E.sep||0)); g.er = g.ue*1.15; g.browY = g.eyeY-u*2.5 - u*1.1*(B.dy||0);
    g.browTilt = (B.tilt||0)*.7;
    g.noseY = g.eyeY+u*2.4 + u*.9*(N.dy||0); g.mouthY = g.eyeY+u*4.7 + u*1.0*(M.dy||0); g.earY = g.eyeY+u*.5; g.mw = g.um*1.5;
    g.earK = 1+.4*(cfg.face.ear||0);
    g.hv = 1+.5*(H.vol||0); g.bl = (H.bangs||0)*u*2.4;
    g.nw = hw*.3*(1+(bk-1)*.7); g.sw = 72*bk; g.bw = Math.min(99, g.sw+8); g.bk = bk;
    g.dy = Math.max(-8, Math.min(20, chin-143));
    const sw = g.sw, bw = g.bw, nw = g.nw;
    g.torsoD = `M${100-bw} 236L${100-bw} 214Q${100-sw-3} 186 ${100-sw*.72} 168Q${100-nw-14} 157 ${100-nw-4} 152L${100+nw+4} 152Q${100+nw+14} 157 ${100+sw*.72} 168Q${100+sw+3} 186 ${100+bw} 214L${100+bw} 236Z`;
    g.headClip = clip(g, g.headD);
    return g;
  }
  // Kontur-Punkte der rechten Kopfseite (abs, von yEnd bis zum Scheitel), um 'off' nach außen versetzt
  function sideR(g, off, yEnd, jag, offY){
    const out=[], n=18;
    for(let i=0;i<=n;i++){
      const u=i/n, y0=yEnd+(g.top-yEnd)*u, ph=u*Math.PI/2;
      const j=(jag && i%2 && i>0 && i<n) ? jag : 0;
      out.push([100+g.hwAt(y0)+(off+j)*Math.cos(ph), y0-(offY===undefined?off:offY)*Math.sin(ph)]);
    }
    return out;
  }
  const sideL = (g,off,yEnd,jag,offY)=>mirror(sideR(g,off,yEnd,jag,offY));
  // tip: läuft unten spitz an den Kopf zu (Koteletten) statt in einer flachen Kante zu enden
  function outlineSeq(g,off,yEnd,jag,tip,offY){
    const R=sideR(g,off,yEnd,jag,offY), L=rev(sideL(g,off,yEnd,jag,offY)); R.pop(); L[0]=[100,L[0][1]];
    if(tip){ const yt=yEnd+7, xt=g.hwAt(yt)+off*.1; R.unshift([100+xt,yt]); L.push([100-xt,yt]); }
    return R.concat(L);
  }
  const massD = (g,off,yEnd,jag,offY)=>pathOpen(outlineSeq(g,off,yEnd,jag,true,offY))+'Z';

  // ---------- Haar: eine zusammenhängende Silhouette mit einem einzigen Umriss ----------
  function strands(c, o, targets){
    let s='';
    targets.forEach((t,i)=>{
      const q=[t[0]+(o[0]-t[0])*.5, t[1]+(o[1]-t[1])*.5], dx=t[0]-q[0], dy=t[1]-q[1], len=Math.hypot(dx,dy)||1, bend=((i%2)?1:-1)*(1.5+(i%3)*.7);
      const mx=(q[0]+t[0])/2+(-dy/len)*bend, my=(q[1]+t[1])/2+(dx/len)*bend;
      s+=`<path d="M${P(q)}Q${P([mx,my])} ${P(t)}" fill="none" stroke="${shade(c,-.3)}" stroke-width="2.2" stroke-opacity=".09" stroke-linecap="round"/>`;
    });
    return s;
  }
  const bandD = g=>{ const cx=100-g.hw*.28, cy=g.top+g.u*1.3, rx=g.hw*.46, ry=g.u*.95; return `M${r1(cx-rx)} ${r1(cy)}a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(rx*2)} 0a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-rx*2)} 0Z`; };
  const sheen = (g,c)=>`<path d="${bandD(g)}" fill="url(#${rad(g,[[0,shade(c,.45),.32],[1,shade(c,.45),0]],.5,.5,.5)})"/>`;
  // items: {d, o, targets, band}. Eine Silhouette ohne Umriss, mit weichem Verlauf, Strähnen und Glanz.
  // gemeinsamer Verlauf für alle Haarteile: gleiche Höhe = gleiche Farbe, deshalb keine Nähte
  const hairGrad = (g,c)=>lin(g,[[0,shade(c,.16)],[.5,c],[1,shade(c,-.18)]],0,g.top-14,0,g.top+g.ht*.85,true);
  function unionLayers(g, c, items){
    let fill='', det='';
    const gid=hairGrad(g,c);
    items.forEach(it=>{
      fill+=`<path d="${it.d}" fill="url(#${gid})"/>`;
      if(it.targets||it.band){
        const cid=clip(g,it.d);
        det+=`<g clip-path="url(#${cid})">${it.targets?strands(c,it.o||[100+g.hw*.1,g.top+2],it.targets.filter((p,i)=>i%3===1)):''}${it.band?`${sheen(g,c)}`:''}</g>`;
      }
    });
    return fill+det;
  }  const hairShape = (g,d,c,o,targets)=>unionLayers(g,c,[{d,o,targets,band:true}]);
  const massItem = (g,off,yEnd,jag,offY)=>{ const o2=off*(g.hv||1), oy=offY===undefined?undefined:offY*(g.hv||1); return {d:massD(g,o2,yEnd,jag,oy), targets:outlineSeq(g,o2,yEnd,jag,true,oy)}; };
  const mass = (g,c,off,yEnd,jag,offY)=>unionLayers(g,c,[massItem(g,off,yEnd,jag,offY)]);
  // Haaransatz als runde Kuppel: Scheitel bei apex*Kopfhöhe, an den Seiten browY-side
  const hl = (g,t,apex,side,pw)=>{ const a=Math.min(1,Math.abs(t)); return g.top+apex*g.ht+(g.browY-side-(g.top+apex*g.ht))*Math.pow(a,pw); };
  // Pony/Frisur über der Stirn: f(t,i) -> y der Unterkante, t von -1 (links) bis 1 (rechts)
  function fringeParts(g, f, sharp){
    const N=14, bottom=[], so=2.6;
    for(let i=0;i<=N;i++){ const t=1-2*i/N, y=f(t,i)+(g.bl||0); bottom.push([100+t*(g.hwAt(y)+(Math.abs(t)===1?so:0)), y]); }
    const yR=bottom[0][1], yL=bottom[N][1];
    const Lc=sideL(g,so,yL).slice(0,-1), Rc=rev(sideR(g,so,yR)).slice(1);
    const pts=bottom.concat(Lc,[[100,g.top-so]],Rc);
    const bp = sharp?poly(bottom):pathOpen(bottom);
    return {bottom, bp, d: sharp ? poly(pts)+'Z' : crClosed(pts)};
  }  // Pony: Verlauf, Strähnen, Glanz und weicher Schatten auf der Stirn
  function fringe(g, c, f, sharp, o){
    const p=fringeParts(g,f,sharp), cid=clip(g,p.d), gid=hairGrad(g,c);
    const sh=`<g clip-path="url(#${g.headClip})"><path d="${p.bp}L${r1(100+g.hw+6)} ${r1(g.top-8)}L${r1(100-g.hw-6)} ${r1(g.top-8)}Z" fill="#3a1d10" opacity=".2" transform="translate(0 ${r1(g.u*.8)})"/></g>`;
    return (TOON?'':sh)+`<path d="${p.d}" fill="url(#${gid})"/><g clip-path="url(#${cid})">${strands(c,o||[100+g.hw*.12,g.top+1],p.bottom.filter((q,i)=>i%3===1))}${sheen(g,c)}</g>`;
  }  // Locken: Silhouette aus vielen überlappenden Bögen plus Spiralen im Inneren
  const circD = (p,r)=>`M${r1(p[0]-r)} ${r1(p[1])}a${r1(r)} ${r1(r)} 0 1 0 ${r1(r*2)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-r*2)} 0Z`;
  const dens = seq=>{ const d=[]; seq.forEach((p,i)=>{ d.push(p); if(i<seq.length-1) d.push([(p[0]+seq[i+1][0])/2,(p[1]+seq[i+1][1])/2]); }); return d; };
  function swirl(x,y,r,c){
    const pts=[]; for(let a=0;a<=2.6*Math.PI;a+=.5){ const rr=r*(.16+.84*a/(2.6*Math.PI)); pts.push([x+Math.cos(a+1)*rr, y+Math.sin(a+1)*rr]); }
    return `<path d="${pathOpen(pts)}" fill="none" stroke="${shade(c,-.4)}" stroke-width="1.3" stroke-linecap="round" opacity=".85"/>`;
  }
  function curls(g, c, off, yEnd, r, offY){
    off*=(g.hv||1); if(offY!==undefined) offY*=(g.hv||1);
    const seq=dens(outlineSeq(g,off,yEnd,0,false,offY)), items=[{d:massD(g,off*.55,yEnd,0,offY===undefined?undefined:offY*.55)}];
    seq.forEach((p,i)=>items.push({d:circD(p, r*.74*(i%3===0?1.15:(i%3===1?.9:1)))}));
    let sw=''; seq.forEach((p,i)=>{ if(i%3===1){ const q=[p[0]+(100-p[0])*.3, p[1]+(g.top+g.ht*.22-p[1])*.3]; sw+=swirl(q[0],q[1],r*.5,c); } });
    return unionLayers(g,c,items)+sw;
  }
  function curlsFront(g, c, r, n){
    const f=t=>g.top+.29*g.ht+3*t*t, p=fringeParts(g,f,false), items=[{d:p.d,noOL:true}];
    for(let i=0;i<n;i++){ const t=-1+2*i/(n-1), yy=f(t)+(i%2?1.5:-1); items.push({d:circD([100+t*(g.hwAt(yy)+.5), yy], r*(i%2?.9:1.08))}); }
    let sw=''; [[-.55,18],[0,12],[.55,18],[-.3,28],[.3,28],[-.8,30],[.8,30]].forEach(q=>{ sw+=swirl(100+q[0]*g.hw, g.top+q[1], r*.7, c); });
    return unionLayers(g,c,items)+sw;
  }

  // Lange Haare: Außenkante läuft weich vom Kopf nach außen (keine Stufe), Strähnen liegen innerhalb der Masse
  function longOuter(g,s,X,bot){ const yS=g.browY-9; return [[100+s*X,bot],[100+s*X,g.mouthY+6],[100+s*(g.hwAt(g.earY)+(X-g.hwAt(g.earY))*.72),g.earY],[100+s*(g.hwAt(yS)+2),yS]]; }
  function longBackD(g,X,bot){ const yS=g.browY-9; const R=longOuter(g,1,X,bot).concat(sideR(g,2,yS,0).slice(1)), L=rev(longOuter(g,-1,X,bot).concat(sideL(g,2,yS,0).slice(1))); return pathOpen(R.concat([[100,g.top-3]]).concat(L))+'Z'; }
  // Haarsträhne, die vom Pony nahtlos an der Wange entlang nach unten fällt (nur Innen-, Unter- und Außenkante haben einen Umriss)
  function longFall(g, c, s, X, bot, wavy){
    const yT=g.browY-16, A=[100+s*(g.hwAt(yT)-1.5), yT], B=[100+s*(g.hwAt(g.earY)-1.2), g.earY], M=[100+s*(g.hwAt(g.mouthY)-.5), g.mouthY], C=[100+s*(g.hwAt(g.mouthY)+4), bot-10];
    const out=longOuter(g,s,X,bot-6), Xx=out[0][0], inner=pathOpen([A,B,M,C]);
    const bottom = wavy ? `Q${r1((C[0]+Xx)/2)} ${r1(bot+9)} ${r1(Xx)} ${r1(bot-6)}` : `Q${r1(C[0])} ${r1(bot)} ${r1(C[0]+s*4)} ${r1(bot)}L${r1(Xx-s*4)} ${r1(bot)}Q${r1(Xx)} ${r1(bot)} ${r1(Xx)} ${r1(bot-6)}`;
    const dLine=inner+bottom+crOpen(out), dFill=dLine+'Z', cid=clip(g,dFill);
    return `<path d="${dFill}" fill="url(#${hairGrad(g,c)})"/><g clip-path="url(#${cid})">${strands(c,A,[[C[0],bot-8],[Xx-s*5,bot-8],[Xx-s*10,bot-30],[C[0]+s*3,bot-34]])}</g><path d="${dLine}" fill="none" ${OL()}/>`;
  }

  // ---------- Haare ----------
  const HAIRS = [
    {n:'Glatze'},
    {n:'Stoppelhaar', back:(g,c)=>`<g opacity=".8">${mass(g,c,1.8,g.earY-10)}</g>`, front:(g,c)=>`<g opacity=".8">${fringe(g,c,(t)=>g.top+.14*g.ht+5*t*t)}</g>`},
    {n:'Kurz, Fransen', back:(g,c)=>mass(g,c,3,g.earY-12,0,11), front:(g,c)=>fringe(g,c,(t,i)=>g.browY-8+1.8*Math.sin(i*1.35)+t*1.5)},
    {n:'Pony lang', back:(g,c)=>mass(g,c,3,g.earY-4,0,11), front:(g,c)=>fringe(g,c,(t,i)=>g.browY-1+1.6*Math.sin(i*1.3)-Math.abs(t)*6-t*2)},
    {n:'Mittelscheitel', back:(g,c)=>mass(g,c,3.2,g.earY+8,0,12), front:(g,c)=>fringe(g,c,t=>{ return hl(g,t,.17,6,1.9); },false,[100,g.top+1])},
    {n:'Seitenscheitel', back:(g,c)=>mass(g,c,3,g.earY-8,0,10), front:(g,c)=>fringe(g,c,t=>g.browY-5-26*Math.pow((t+1)/2,1.4),false,[100-g.hw*.5,g.top+4])},
    {n:'Wuschel', back:(g,c)=>mass(g,c,4,g.earY-10,.8,14), front:(g,c)=>fringe(g,c,(t,i)=>g.browY-10+2.6*Math.sin(i*1.8)-Math.abs(t)*2)},
    {n:'Tolle', back:(g,c)=>unionLayers(g,c,[massItem(g,3,g.earY-10,0,10),{d:`M${100-g.hw*.8} ${g.top+8}Q${100-g.hw*.7} ${g.top-22} 100 ${g.top-19}Q${100+g.hw*.95} ${g.top-16} ${100+g.hw*.86} ${g.top+8}Z`,o:[100-g.hw*.3,g.top+8],targets:[[100-g.hw*.7,g.top-8],[100,g.top-18],[100+g.hw*.8,g.top-8],[100+g.hw*.4,g.top-16]]}]), front:(g,c)=>fringe(g,c,t=>g.top+17+18*Math.pow((t+1)/2,1.6))},
    {n:'Topfschnitt', back:(g,c)=>mass(g,c,3.2,g.earY-16,0,9), front:(g,c)=>fringe(g,c,t=>g.browY-4+Math.pow(Math.abs(t),5)*3)},
    {n:'Locken kurz', back:(g,c)=>curls(g,c,3,g.browY-3,9.5,11), front:(g,c)=>curlsFront(g,c,6.5,9)},
    {n:'Große Locken', noEars:1, back:(g,c)=>curls(g,c,15,g.chin-26,14), front:(g,c)=>curlsFront(g,c,8,8)},
    {n:'Halblang, Wuschel', noEars:1, back:(g,c)=>mass(g,c,12,g.chin-24,1.2), front:(g,c)=>fringe(g,c,(t,i)=>{ return hl(g,t,.18,5,1.7)+1.2*Math.sin(i*1.6); })},
    {n:'Lange Wellen', noEars:1,
      back:(g,c)=>{ const X=g.hwAt(g.earY)+14, bot=196; return hairShape(g,longBackD(g,X,bot),c,null,[[100-X,bot],[100,bot],[100+X,bot],[100-X,150],[100+X,150]]); },
      front:(g,c)=>fringe(g,c,t=>{ return hl(g,t,.17,9,1.9); },false,[100,g.top+1]),
      over:(g,c)=>[1,-1].map(s=>longFall(g,c,s,g.hwAt(g.earY)+14,196,true)).join('')},
    {n:'Lang, glatt', noEars:1,
      back:(g,c)=>{ const X=g.hwAt(g.earY-4)+13, bot=206; return hairShape(g,longBackD(g,X,bot),c,null,[[100-X,bot],[100,bot],[100+X,bot],[100-X,160],[100+X,160]]); },
      front:(g,c)=>fringe(g,c,t=>{ return hl(g,t,.16,6,1.9); },false,[100,g.top+1]),
      over:(g,c)=>[1,-1].map(s=>longFall(g,c,s,g.hwAt(g.earY-4)+13,206,false)).join('')},
    {n:'Pferdeschwanz', back:(g,c)=>unionLayers(g,c,[massItem(g,3,g.earY-12,0,7),{d:`M${100+g.hw*.2} ${g.top-5}Q${100+g.hw+30} ${g.top-14} ${100+g.hw+24} ${g.top+50}Q${100+g.hw+14} ${g.top+26} ${100+g.hw*.55} ${g.top+4}Z`,o:[100+g.hw*.3,g.top-2],targets:[[100+g.hw+24,g.top+48],[100+g.hw+26,g.top+20],[100+g.hw+10,g.top+6]]}]), front:(g,c)=>fringe(g,c,t=>g.browY-7-14*Math.pow((t+1)/2,1.2))},
    {n:'Dutt', back:(g,c)=>unionLayers(g,c,[{d:`M${100-15} ${g.top-4}Q${100-17} ${g.top-27} 100 ${g.top-28}Q${100+17} ${g.top-27} ${100+15} ${g.top-4}Z`,o:[100,g.top-26],targets:[[100-14,g.top-8],[100,g.top-6],[100+14,g.top-8]]},massItem(g,3,g.earY-12,0,7)]), front:(g,c)=>fringe(g,c,t=>g.top+.2*g.ht+6*t*t)},
    {n:'Lang, hinter den Schultern', noEars:1,
      back:(g,c)=>{ const X=g.hwAt(g.earY-4)+12, bot=236; return hairShape(g,longBackD(g,X,bot),c,null,[[100-X,bot],[100,bot],[100+X,bot],[100-X,170],[100+X,170]]); },
      front:(g,c)=>fringe(g,c,t=>{ return hl(g,t,.16,6,1.9); },false,[100,g.top+1])}
  ];

  // ---------- Bart (c leer = Haarfarbe) ----------
  function clipFace(g, inner){ return `<g clip-path="url(#${g.headClip})">${inner}</g>`; }
  function stache(g,c,th,droop){
    const my=g.mouthY, w=g.mw*1.7, up=my-g.u*1.15;
    const pts=[[100-w,up+3+droop],[100-w*.55,up-3],[100,up-1.6],[100+w*.55,up-3],[100+w,up+3+droop]];
    const low=[[100+w,up+3+droop],[100+w*.55,up-1+th*.6],[100,up+1+th*.5],[100-w*.55,up-1+th*.6],[100-w,up+3+droop]];
    return `<path d="${pathOpen(pts)}${crOpen(low)}Z" fill="${c}" ${lo(c,1.2)}/>`;
  }
  // --- neue Bart-Bausteine (Comic-Stil, Formen aus kräftigen Flächen und Strichen) ---
  const bst = (g,c,d,w)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${r1(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const blobD = pts=>crClosed(pts);
  // Fleck unter der Unterlippe bis zum Kinn: wT/wB = halbe Breite oben/unten, len = Länge unter das Kinn (in u)
  function chinPatch(g,c,wT,wB,len,tip){
    const u=g.u, my=g.mouthY, yT=my+1.3*u, yB=g.chin+(len||0)*u, yM=(yT+yB)/2;
    const pts=[[100-wT,yT],[100,yT-.35*u],[100+wT,yT],[100+wB,yM],tip?[100,yB+tip*u]:[100,yB],[100-wB,yM]];
    return `<path d="${blobD(pts)}" fill="${c}"/>`;
  }
  // Schnurrbart mit optionalen Spitzen: curl = Spitzen nach oben (u), droop = nach unten hängende Enden
  function stache2(g,c,th,droop,wk,curl){
    const u=g.u, my=g.mouthY, w=g.mw*(wk||1.7)*1.2, up=my-u*1.15;
    const pts=[[100-w,up+3+droop],[100-w*.55,up-3],[100,up-1.6],[100+w*.55,up-3],[100+w,up+3+droop]];
    const low=[[100+w,up+3+droop],[100+w*.55,up-1+th*.6],[100,up+1+th*.5],[100-w*.55,up-1+th*.6],[100-w,up+3+droop]];
    let s=`<path d="${pathOpen(pts)}${crOpen(low)}Z" fill="${c}"/>`;
    if(curl) [-1,1].forEach(q=>{ s+=bst(g,c,`M${r1(100+q*w*.9)} ${r1(up+1+droop)}Q${r1(100+q*(w+.9*u))} ${r1(up+.8+droop)} ${r1(100+q*(w+1.2*u))} ${r1(up-curl*u)}`,.75*u); });
    return s;
  }
  // senkrechter Streifen vom Mundwinkel nach unten (Fu Manchu / Hufeisen)
  const dropStrips = (g,c,x,len,w)=>[-1,1].map(q=>bst(g,c,`M${r1(100+q*x)} ${r1(g.mouthY-g.u*1.8)}Q${r1(100+q*(x+.3*g.u))} ${r1(g.mouthY+g.u*1.5)} ${r1(100+q*x*.95)} ${r1(g.mouthY+len*g.u)}`,w*g.u)).join('');
  // Koteletten: Streifen vor dem Ohr, am Kiefer breiter; ln = Länge bis zur Höhe (0 = Ohr, 1 = Mundhöhe, 1.6 = Kinn)
  function chops(g,c,ln,wide){
    const u=g.u, y0=g.earY-3*u, y1=g.earY+(g.mouthY-g.earY)*ln, mid=(y0+y1)/2, ins=wide?3.4*u:2*u;
    const R=[[100+g.hwAt(y0)+.5,y0],[100+g.hwAt(mid)+.5,mid],[100+g.hwAt(y1)+.5,y1],[100+g.hwAt(y1)-ins*.6,y1+.5*u],[100+g.hwAt(mid)-ins,mid],[100+g.hwAt(y0)-ins,y0]];
    const L=R.map(p=>[200-p[0],p[1]]);
    return clipFace(g,`<path d="${blobD(R)}" fill="${c}"/><path d="${blobD(L)}" fill="${c}"/>`);
  }
  // Vollbart-Körper mit frei wählbarer Spitze: sp = Spitze unter dem Kinn (u), rd = Rundung
  function beardBody(g,c,sp,wk){
    const u=g.u, ye=g.earY-4, ex=g.hwAt(g.earY)+1, k=wk||1;
    const d=`M${r1(100-ex)} ${r1(ye)}Q${r1(100-g.hw*.55)} ${r1(g.noseY+2)} 100 ${r1(g.noseY)}Q${r1(100+g.hw*.55)} ${r1(g.noseY+2)} ${r1(100+ex)} ${r1(ye)}Q${r1(100+g.hw*k+3)} ${r1(g.chin-16)} ${r1(100+g.cw*k+6)} ${r1(g.chin+2*u)}Q${r1(100+g.cw*.5)} ${r1(g.chin+sp*u*.9)} 100 ${r1(g.chin+sp*u)}Q${r1(100-g.cw*.5)} ${r1(g.chin+sp*u*.9)} ${r1(100-g.cw*k-6)} ${r1(g.chin+2*u)}Q${r1(100-g.hw*k-3)} ${r1(g.chin-16)} ${r1(100-ex)} ${r1(ye)}Z`;
    return `<path d="${d}" fill="${c}"/>`;
  }
  const mouthHole = g=>`<ellipse cx="100" cy="${r1(g.mouthY-.3)}" rx="${r1(g.mw*1.6)}" ry="${r1(g.u*1.7)}" fill="${g.sk}"/>`;

  const BEARDS = [
    {n:'Kein Bart'},
    {n:'Dreitagebart', noOL:1, base:(g,c)=>clipFace(g,`<path d="M0 ${r1(g.noseY+4)}H200V260H0Z" fill="${c}" opacity=".3"/>`)},
    {n:'Schnurrbart', front:(g,c)=>stache(g,c,6,3)},
    {n:'Schnurrbart dünn', front:(g,c)=>stache(g,c,3.4,4)},
    {n:'Kinnbart', base:(g,c)=>`<path d="M${r1(100-g.mw*1.9)} ${r1(g.mouthY+5)}Q${r1(100-g.mw*2.2)} ${r1(g.mouthY+19)} 100 ${r1(g.chin+2)}Q${r1(100+g.mw*2.2)} ${r1(g.mouthY+19)} ${r1(100+g.mw*1.9)} ${r1(g.mouthY+5)}Q100 ${r1(g.mouthY+8)} ${r1(100-g.mw*1.9)} ${r1(g.mouthY+5)}Z" fill="${c}" ${OL(1.4)}/>`, front:(g,c)=>stache(g,c,4.4,3)},
    {n:'Fliege (Soul Patch)', base:(g,c)=>`<path d="M${r1(100-4)} ${r1(g.mouthY+6)}Q100 ${r1(g.mouthY+4.6)} ${r1(100+4)} ${r1(g.mouthY+6)}Q${r1(100+3)} ${r1(g.mouthY+13)} 100 ${r1(g.mouthY+14)}Q${r1(100-3)} ${r1(g.mouthY+13)} ${r1(100-4)} ${r1(g.mouthY+6)}Z" fill="${c}" ${OL(1.1)}/>`},
    {n:'Vollbart kurz', noOL:1, base:(g,c)=>`<g clip-path="url(#${g.headClip})"><path d="M${r1(100-g.hw-10)} ${r1(g.earY-4)}Q${r1(100-g.hw*.5)} ${r1(g.noseY+2)} 100 ${r1(g.noseY)}Q${r1(100+g.hw*.5)} ${r1(g.noseY+2)} ${r1(100+g.hw+10)} ${r1(g.earY-4)}V260H${r1(100-g.hw-10)}Z" fill="${c}" opacity=".78"/><ellipse cx="100" cy="${r1(g.mouthY-.5)}" rx="${r1(g.mw*1.65)}" ry="7.5" fill="${g.sk}"/></g>`, front:(g,c)=>stache(g,c,5,2)},
    {n:'Vollbart lang', base:(g,c)=>{ const d=`M${r1(100-g.hwAt(g.earY)-1)} ${r1(g.earY-4)}Q${r1(100-g.hw*.55)} ${r1(g.noseY+2)} 100 ${r1(g.noseY)}Q${r1(100+g.hw*.55)} ${r1(g.noseY+2)} ${r1(100+g.hwAt(g.earY)+1)} ${r1(g.earY-4)}Q${r1(100+g.hw+3)} ${r1(g.chin-16)} ${r1(100+g.cw+6)} ${r1(g.chin+12)}Q100 ${r1(g.chin+27)} ${r1(100-g.cw-6)} ${r1(g.chin+12)}Q${r1(100-g.hw-3)} ${r1(g.chin-16)} ${r1(100-g.hwAt(g.earY)-1)} ${r1(g.earY-4)}Z`;
        return `<path d="${d}" fill="${c}" ${OL()}/><ellipse cx="100" cy="${r1(g.mouthY-.5)}" rx="${r1(g.mw*1.65)}" ry="7.5" fill="${g.sk}"/>`; }, front:(g,c)=>stache(g,c,5,2)},
    {n:'Kreisbart', base:(g,c)=>{ const u=g.u, my=g.mouthY+.5*u, rx=g.mw*1.5, ry=u*2.3, e=(a,b)=>`M${r1(100-a)} ${r1(my)}a${r1(a)} ${r1(b)} 0 1 0 ${r1(a*2)} 0a${r1(a)} ${r1(b)} 0 1 0 ${r1(-a*2)} 0Z`; return `<path fill-rule="evenodd" d="${e(rx,ry)}${e(rx-.95*u,ry-.95*u)}" fill="${c}"/>`; }},
    {n:'Ziegenbart', base:(g,c)=>chinPatch(g,c,g.mw*1.2,g.mw*.9,.4)},
    {n:'Van Dyke', base:(g,c)=>chinPatch(g,c,g.mw*.9,g.mw*.55,1,1.6), front:(g,c)=>stache2(g,c,3.2,1,1.5,.9)},
    {n:'Zwirbelbart', base:(g,c)=>chinPatch(g,c,g.mw*.7,g.mw*.4,1.2,2.2), front:(g,c)=>stache2(g,c,4,1.5,1.7,2.4)},
    {n:'Garibaldi', base:(g,c)=>beardBody(g,c,3.4,1.04)+mouthHole(g), front:(g,c)=>stache2(g,c,5,1,1.7)},
    {n:'Hufeisen', front:(g,c)=>stache2(g,c,4.4,2,1.7)+dropStrips(g,c,g.mw*1.6,4.6,.9)},
    {n:'Fu Manchu', front:(g,c)=>stache2(g,c,4,2.5,1.7)+dropStrips(g,c,g.mw*1.6,8.5,.8)},
    {n:'Koteletten', base:(g,c)=>chops(g,c,.55,false)},
    {n:'Backenbart', base:(g,c)=>chops(g,c,1.3,true), front:(g,c)=>stache2(g,c,4.6,2,1.8)},
    {n:'Walross', front:(g,c)=>stache2(g,c,8,5.5,2.15)},
    {n:'Spitzbart lang', base:(g,c)=>beardBody(g,c,5.5,.94)+mouthHole(g), front:(g,c)=>stache2(g,c,4.4,2,1.7)},
    {n:'Schifferkrause', base:(g,c)=>{ const u=g.u, ey=g.earY+u*.6, d=`M${r1(100-g.hwAt(ey)+.5)} ${r1(ey)}Q${r1(100-g.hwAt(g.mouthY+2*u))} ${r1(g.mouthY+3*u)} ${r1(100-g.cw-3)} ${r1(g.chin-.5*u)}Q100 ${r1(g.chin+1.6*u)} ${r1(100+g.cw+3)} ${r1(g.chin-.5*u)}Q${r1(100+g.hwAt(g.mouthY+2*u))} ${r1(g.mouthY+3*u)} ${r1(100+g.hwAt(ey)-.5)} ${r1(ey)}`; return clipFace(g,bst(g,c,d,1.5*u))+chinPatch(g,c,g.mw*.5,g.mw*.3,.4); }, front:(g,c)=>stache2(g,c,3.4,1.4,1.55)}
  ];

  // ---------- Augenbrauen (c leer = dunkleres Haar): kräftige, geschwungene Striche ----------
  function brow(g, c, s, th, arch, tilt, len){
    const u=g.u, cx=100+s*g.eDX, bl=u*(len||1.35), xi=cx-s*bl, xp=cx+s*bl*.15, xo=cx+s*bl*1.15;
    const tl=tilt+(g.browTilt||0), yi=g.browY+.3*u+tl*u, yp=g.browY-arch*u, yo=g.browY+.5*u-tl*u*.3;
    return `<path d="M${r1(xi)} ${r1(yi)}Q${r1(xp)} ${r1(yp)} ${r1(xo)} ${r1(yo)}" fill="none" stroke="${c}" stroke-width="${r1(th*u)}" stroke-linecap="round"/>`;
  }
  const BROWS = [
    {n:'Normal',      f:(g,c)=>[-1,1].map(s=>brow(g,c,s,.42,.95,0)).join('')},
    {n:'Dick',        f:(g,c)=>[-1,1].map(s=>brow(g,c,s,.64,.95,.05)).join('')},
    {n:'Dünn',        f:(g,c)=>[-1,1].map(s=>brow(g,c,s,.2,.8,0)).join('')},
    {n:'Hochgezogen', f:(g,c)=>[-1,1].map(s=>brow(g,c,s,.42,1.9,-.2)).join('')},
    {n:'Ernst',       f:(g,c)=>[-1,1].map(s=>brow(g,c,s,.52,.35,.65)).join('')},
    {n:'Buschig',     f:(g,c)=>[-1,1].map(s=>brow(g,c,s,.88,.95,.05,1.55)).join('')}
  ];

  // ---------- Augen (c = Irisfarbe): Mandelauge mit Lid, Lidfalte und Glanz ----------
  function eyeLid(g, s, c, o){
    o=o||{}; const u=g.ue, sk=g.sk, cx=100+s*g.eDX, cy=g.eyeY, W=1.2*u*(o.w||1), H=o.H||1, look=(o.look||0)*.34*u;
    const x1=cx-W, x2=cx+W, yc=cy+.2*u, ir=.82*u*(o.ir||1);
    const d=`M${r1(x1)} ${r1(yc)}Q${r1(cx)} ${r1(cy-1.55*u*H)} ${r1(x2)} ${r1(yc)}Q${r1(cx)} ${r1(cy+1.0*u*H)} ${r1(x1)} ${r1(yc)}Z`;
    const id=clip(g,d), ig=g.id('ig');
    g.defs+=`<radialGradient id="${ig}" cx=".5" cy=".4" r=".72"><stop offset="0" stop-color="${shade(c,.3)}"/><stop offset=".7" stop-color="${c}"/><stop offset="1" stop-color="${shade(c,-.42)}"/></radialGradient>`;
    let out=`<path d="${d}" fill="${scleraCol(g,"#FBF8F4")}"/><g clip-path="url(#${id})">${veins(g,cx,cy,W,1.2*u*H,s)}<circle cx="${r1(cx+look)}" cy="${r1(cy-.05*u)}" r="${r1(ir)}" fill="url(#${ig})"/><circle cx="${r1(cx+look)}" cy="${r1(cy-.05*u)}" r="${r1(ir*.48)}" fill="${INK}"/><circle cx="${r1(cx+look-.28*u)}" cy="${r1(cy-.4*u)}" r="${r1(.21*u)}" fill="#fff"/><circle cx="${r1(cx+look+.27*u)}" cy="${r1(cy+.32*u)}" r="${r1(.1*u)}" fill="#fff" opacity=".8"/><path d="${d}" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="${r1(.9*u)}"/>`;
    let lidY=null;
    if(o.lid){ const hh=2*u*(.35+.8*o.lid); lidY=cy-2*u+hh; out+=`<rect x="${r1(x1-1)}" y="${r1(cy-2*u)}" width="${r1(2*W+2)}" height="${r1(hh)}" fill="${shade(sk,-.05)}"/>`; }
    out+=`</g>`;
    const top = lidY!==null ? `M${r1(x1)} ${r1(lidY+.1*u)}Q${r1(cx)} ${r1(lidY-.5*u)} ${r1(x2)} ${r1(lidY+.1*u)}` : `M${r1(x1-.05*u)} ${r1(yc)}Q${r1(cx)} ${r1(cy-1.7*u*H)} ${r1(x2+.05*u)} ${r1(yc)}`;
    out+=`<path d="${top}" fill="none" stroke="${INK}" stroke-width="${r1(.32*u)}" stroke-linecap="round"/>`;
    out+=`<path d="M${r1(cx+s*W)} ${r1(yc-.1*u)}l${r1(s*.6*u)} ${r1(-.42*u)}" stroke="${INK}" stroke-width="${r1(.2*u)}" stroke-linecap="round"/>`;
    out+=`<path d="M${r1(cx-W*.85)} ${r1(cy-1.5*u*H-.1*u)}Q${r1(cx)} ${r1(cy-2.25*u*H)} ${r1(cx+W*.85)} ${r1(cy-1.5*u*H-.1*u)}" fill="none" stroke="${shade(sk,-.32)}" stroke-width="${r1(.15*u)}" stroke-linecap="round" opacity=".85"/>`;
    out+=`<path d="M${r1(x1+.25*u)} ${r1(yc+.12*u)}Q${r1(cx)} ${r1(cy+1.2*u*H)} ${r1(x2-.25*u)} ${r1(yc+.12*u)}" fill="none" stroke="${shade(sk,-.2)}" stroke-width="${r1(.1*u)}" stroke-linecap="round" opacity=".5"/>`;
    return out;
  }
  function eyeArc(g, s, dir){
    const u=g.ue, cx=100+s*g.eDX, cy=g.eyeY, W=1.1*u;
    return `<path d="M${r1(cx-W)} ${r1(cy+.2*u)}Q${r1(cx)} ${r1(cy-dir*1.35*u+.2*u)} ${r1(cx+W)} ${r1(cy+.2*u)}" fill="none" stroke="${INK}" stroke-width="${r1(.32*u)}" stroke-linecap="round"/><path d="M${r1(cx+s*W)} ${r1(cy+.2*u)}l${r1(s*.5*u)} ${r1(dir>0?-.38*u:.42*u)}" stroke="${INK}" stroke-width="${r1(.17*u)}" stroke-linecap="round"/>`;
  }
  // Rötung der Augäpfel (Regler "Rötung"): Weiß wird rosa-rot, ab etwa 30 % kommen Äderchen dazu
  const mixHex = (a,b,k)=>{ const A=parseInt(a.slice(1),16), B=parseInt(b.slice(1),16), ch=s=>Math.round(((A>>s)&255)*(1-k)+((B>>s)&255)*k); return "#"+((1<<24)|(ch(16)<<16)|(ch(8)<<8)|ch(0)).toString(16).slice(1); };
  const scleraCol = (g,base)=>mixHex(base,"#E8554B",.62*(g.eyeRed||0));
  const veins = (g,cx,cy,rx,ry,s)=>{ const k=g.eyeRed||0; if(k<.3) return ""; const a=Math.min(1,(k-.2)*1.2); return [[-1,-.25],[-.8,.5],[1,-.1],[.9,.55],[-.2,-1],[.35,-.95]].map((p,i)=>`<path d="M${r1(cx+p[0]*rx)} ${r1(cy+p[1]*ry)}Q${r1(cx+p[0]*rx*.7)} ${r1(cy+p[1]*ry*.6+(i%2?1:-1)*.25*rx)} ${r1(cx+p[0]*rx*.4)} ${r1(cy+p[1]*ry*.35)}" fill="none" stroke="#C0302A" stroke-width="${r1(.12*g.u)}" stroke-linecap="round" opacity="${r1(a*.8*100)/100}"/>`).join(""); };
  // Comic-Augen: weißer Augapfel mit dunkler Kontur, schwarze Pupille, optional Lid / Wimpern
  function cEye(g, s, o){
    const u=g.ue, cx=100+s*g.eDX, cy=g.eyeY, K=1.4, rx=u*K*(o.rx||1.1), ry=u*K*(o.ry||1.4), sw=r1(.34*u), lk=o.lx||0, lv=o.ly||0, pr=u*K*(o.pr||.5);
    const ed=`M${r1(cx-rx)} ${r1(cy)}a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(rx*2)} 0a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-rx*2)} 0Z`;
    let out='';
    if(o.dot){ return `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx*.62)}" ry="${r1(ry*.85)}" fill="${INK}"/><ellipse cx="${r1(cx-.2*u)}" cy="${r1(cy-.45*u)}" rx="${r1(.2*u)}" ry="${r1(.26*u)}" fill="#fff"/>`; }
    const id=clip(g,ed), px=cx+lk*(rx-pr)*.85, py=cy+lv*(ry-pr)*.85;
    out+=`<path d="${ed}" fill="${scleraCol(g,"#ffffff")}"/><g clip-path="url(#${id})">${veins(g,cx,cy,rx,ry,s)}<ellipse cx="${r1(px)}" cy="${r1(py)}" rx="${r1(pr*(o.pw||1))}" ry="${r1(pr*(o.ph||1.12))}" fill="${INK}"/><circle cx="${r1(px-pr*.32)}" cy="${r1(py-pr*.4)}" r="${r1(pr*.3)}" fill="#fff"/>`;
    if(o.lid!==undefined){ const y0=cy-ry, hh=ry*2*o.lid, sl=(o.slant||0)*u*s; out+=`<path d="M${r1(cx-rx-1)} ${r1(y0-1)}H${r1(cx+rx+1)}V${r1(y0+hh+sl*1)}L${r1(cx-rx-1)} ${r1(y0+hh-sl*1)}Z" fill="${shade(g.sk,-.04)}"/>`; }
    out+=`</g><path d="${ed}" fill="none" stroke="${INK}" stroke-width="${sw}"/>`;
    if(o.lid!==undefined){ const y0=cy-ry, hh=ry*2*o.lid, sl=(o.slant||0)*u*s; out+=`<path d="M${r1(cx-rx)} ${r1(y0+hh-sl)}L${r1(cx+rx)} ${r1(y0+hh+sl)}" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round"/>`; }
    if(o.lash) out+=[-.8,0,.8].map(k=>`<path d="M${r1(cx+k*rx*.9)} ${r1(cy-ry*(1-.15*k*k)-.1*u)}l${r1(s*.3*u+k*.45*u)} ${r1(-.7*u)}" stroke="${INK}" stroke-width="${r1(.24*u)}" stroke-linecap="round"/>`).join('');
    return out;
  }
  const EYES = [
    {n:'Normal',      f:(g,c)=>[-1,1].map(s=>eyeLid(g,s,c,{})).join('')},
    {n:'Groß',        f:(g,c)=>[-1,1].map(s=>eyeLid(g,s,c,{H:1.18,w:1.1,ir:1.12})).join('')},
    {n:'Schmal',      f:(g,c)=>[-1,1].map(s=>eyeLid(g,s,c,{H:.68,ir:.9})).join('')},
    {n:'Müde',        f:(g,c)=>[-1,1].map(s=>eyeLid(g,s,c,{lid:.5})).join('')},
    {n:'Lächelnd',    f:(g,c)=>[-1,1].map(s=>eyeArc(g,s,1)).join('')},
    {n:'Geschlossen', f:(g,c)=>[-1,1].map(s=>eyeArc(g,s,-1)).join('')},
    {n:'Zwinkern',    f:(g,c)=>eyeLid(g,-1,c,{})+eyeArc(g,1,1)},
    {n:'Seitenblick', f:(g,c)=>[-1,1].map(s=>eyeLid(g,s,c,{look:1,lid:.12})).join('')},
    {n:'Comic rund',     f:(g,c)=>[-1,1].map(s=>cEye(g,s,{})).join('')},
    {n:'Comic oval',     f:(g,c)=>[-1,1].map(s=>cEye(g,s,{rx:.9,ry:1.6,pr:.48})).join('')},
    {n:'Comic glubsch',  f:(g,c)=>[-1,1].map(s=>cEye(g,s,{rx:1.45,ry:1.6,pr:.36,ph:1})).join('')},
    {n:'Comic müde',     f:(g,c)=>[-1,1].map(s=>cEye(g,s,{lid:.5,ly:.4})).join('')},
    {n:'Comic wütend',   f:(g,c)=>[-1,1].map(s=>cEye(g,s,{lid:.42,slant:.5,ly:.3})).join('')},
    {n:'Comic Punkte',   f:(g,c)=>[-1,1].map(s=>cEye(g,s,{dot:1})).join('')},
    {n:'Comic Seitenblick', f:(g,c)=>[-1,1].map(s=>cEye(g,s,{lx:1})).join('')},
    {n:'Comic Wimpern',  f:(g,c)=>[-1,1].map(s=>cEye(g,s,{lash:1,ry:1.3,lv:-.15})).join('')},
    {n:'Comic verträumt', f:(g,c)=>[-1,1].map(s=>cEye(g,s,{lid:.28,ly:-.5,lx:.2,pr:.55})).join('')}
  ];

  // ---------- Nase: weiche Form durch Schatten und kleine Nasenlöcher ----------
  function noseSvg9(g, o){
    const u=g.un*(o.k||1), sk=g.sk, x=100, y=g.noseY+(o.dy||0)*g.u, c=shade(sk,-.3), wd=o.w||.8, nn=o.nos||1;
    if(TOON) return `<path d="M${r1(x-wd*u*.9)} ${r1(y+.2*u)}Q${r1(x-wd*u*.2)} ${r1(y+(o.base||.95)*u*1.25)} ${r1(x+wd*u*.35)} ${r1(y+.45*u)}Q${r1(x+wd*u*.8)} ${r1(y-.1*u)} ${r1(x+wd*u*.25)} ${r1(y-.5*u)}" fill="none" stroke="${INK}" stroke-width="${r1(.34*u)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<path d="M${r1(x+.5*u)} ${r1(y-1.9*u)}Q${r1(x+.9*u)} ${r1(y-.5*u)} ${r1(x+wd*u)} ${r1(y+.1*u)}" fill="none" stroke="${shade(sk,-.18)}" stroke-width="${r1(.5*u)}" stroke-linecap="round" opacity=".5"/>`
      + `<path d="M${r1(x-wd*u)} ${r1(y+.35*u)}Q${x} ${r1(y+(o.base||.95)*u)} ${r1(x+wd*u)} ${r1(y+.35*u)}" fill="none" stroke="${c}" stroke-width="${r1(.24*u)}" stroke-linecap="round"/>`
      + `<ellipse cx="${r1(x-.46*u*(wd/.8))}" cy="${r1(y+.45*u)}" rx="${r1(.17*u*nn)}" ry="${r1(.11*u*nn)}" fill="${shade(sk,-.5)}"/><ellipse cx="${r1(x+.46*u*(wd/.8))}" cy="${r1(y+.45*u)}" rx="${r1(.17*u*nn)}" ry="${r1(.11*u*nn)}" fill="${shade(sk,-.5)}"/>`
;
  }
  const NOSES = [
    {n:'Klein',     f:g=>noseSvg9(g,{k:.8})},
    {n:'Normal',    f:g=>noseSvg9(g,{k:1})},
    {n:'Groß',      f:g=>noseSvg9(g,{k:1.22,w:.95,nos:1.3})},
    {n:'Spitz',     f:g=>noseSvg9(g,{k:1,w:.68,dy:.3,base:1.2})},
    {n:'Stupsnase', f:g=>noseSvg9(g,{k:.95,dy:-.25,base:.62,nos:1.55})}
  ];

  // ---------- Mund: Lippen mit Oberlippenbogen und Glanz (c = Lippenfarbe) ----------
  // Münder: nur Linien (Stimmungen), offene Münder als dunkle Fläche
  function lips(g, lc, p){
    const u=g.um, mw=g.mw*(p.mwk||1), my=g.mouthY, sw=r1(.4*u), lc2=shade(lc,-.62);
    const fs=[-1,-.5,0,.5,1], cvf=f=>(f<0?p.cvL:p.cvR)*u*Math.pow(Math.abs(f),1.6);
    const ln=fs.map(f=>[100+f*mw, my+cvf(f)+(p.dy||0)*u]);
    const stroke=d=>`<path d="${d}" fill="none" stroke="${lc2}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    let s='';
    if(p.open){
      const o=p.open*u, low=fs.map(f=>[100+f*mw, my+cvf(f)+o*Math.pow(1-f*f,.8)]);
      const dI=pathOpen(ln)+'L'+P(low[4])+crOpen(rev(low))+'Z', cid=clip(g,dI);
      s+=`<path d="${dI}" fill="${shade(lc,-.72)}"/><g clip-path="url(#${cid})">`;
      if(p.teeth) s+=`<rect x="${r1(100-mw)}" y="${r1(my-u)}" width="${r1(mw*2)}" height="${r1(o*.45+u)}" fill="#F7F3EC"/>`;
      if(p.tongue) s+=`<ellipse cx="100" cy="${r1(my+o*.95)}" rx="${r1(mw*.5)}" ry="${r1(o*.36)}" fill="#E0808D"/>`;
      s+=`</g>`+stroke(pathOpen(ln)+crOpen(rev(low)).replace(/^M/,'L'));
    } else s+=stroke(pathOpen(ln));
    if(p.dimple) s+=[-1,1].map(d=>`<path d="M${r1(100+d*(mw+.5*u))} ${r1(my-.5*u)}q${r1(d*.35*u)} ${r1(.6*u)} ${r1(-d*.1*u)} ${r1(1.1*u)}" fill="none" stroke="${lc2}" stroke-width="${r1(sw*.8)}" stroke-linecap="round" opacity=".7"/>`).join('');
    if(p.out) s+=`<path d="M${r1(100-.9*u)} ${r1(my+.2*u)}Q${r1(100-1*u)} ${r1(my+2.3*u)} 100 ${r1(my+2.4*u)}Q${r1(100+1*u)} ${r1(my+2.3*u)} ${r1(100+.9*u)} ${r1(my+.2*u)}Z" fill="#E0808D"/><path d="M100 ${r1(my+.3*u)}V${r1(my+1.8*u)}" stroke="#B5525F" stroke-width="${r1(.12*u)}"/>`+stroke(pathOpen(ln));
    return s;
  }
  // Comic-Münder: kräftige dunkle Linien, offene Münder mit Zunge / Zähnen
  function cMouth(g, lc, k){
    const u=g.um, w=g.mw*1.5, my=g.mouthY, sw=r1(.42*u), ink=shade(lc,-.7), x=100, st=d=>`<path d="${d}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const body=(d,inner)=>{ const id=clip(g,d); return `<path d="${d}" fill="${shade(lc,-.75)}"/><g clip-path="url(#${id})">${inner||''}</g>`+st(d); };
    if(k==="D"){ const d=`M${r1(x-w)} ${r1(my-.6*u)}Q${r1(x)} ${r1(my-.2*u)} ${r1(x+w)} ${r1(my-.6*u)}Q${r1(x+w*.8)} ${r1(my+2.6*u)} ${r1(x)} ${r1(my+2.7*u)}Q${r1(x-w*.8)} ${r1(my+2.6*u)} ${r1(x-w)} ${r1(my-.6*u)}Z`; return body(d,`<ellipse cx="${x}" cy="${r1(my+2.7*u)}" rx="${r1(w*.55)}" ry="${r1(1.1*u)}" fill="#E0808D"/><rect x="${r1(x-w)}" y="${r1(my-.8*u)}" width="${r1(w*2)}" height="${r1(.9*u)}" fill="#fff"/>`); }
    if(k==="teeth"){ const d=`M${r1(x-w)} ${r1(my-.3*u)}Q${r1(x)} ${r1(my+.3*u)} ${r1(x+w)} ${r1(my-.3*u)}Q${r1(x+w*.7)} ${r1(my+1.9*u)} ${r1(x)} ${r1(my+1.9*u)}Q${r1(x-w*.7)} ${r1(my+1.9*u)} ${r1(x-w)} ${r1(my-.3*u)}Z`; return body(d,`<rect x="${r1(x-w)}" y="${r1(my-.5*u)}" width="${r1(w*2)}" height="${r1(1.1*u)}" fill="#fff"/><path d="M${r1(x-w)} ${r1(my+.6*u)}H${r1(x+w)}" stroke="${ink}" stroke-width="${r1(.18*u)}"/>`); }
    if(k==="wavy") return st(`M${r1(x-w)} ${r1(my)}q${r1(w*.25)} ${r1(-1.1*u)} ${r1(w*.5)} 0t${r1(w*.5)} 0t${r1(w*.5)} 0t${r1(w*.5)} 0`);
    if(k==="cat") return st(`M${r1(x-w)} ${r1(my-.2*u)}Q${r1(x-w*.5)} ${r1(my+1.2*u)} ${r1(x)} ${r1(my-.1*u)}Q${r1(x+w*.5)} ${r1(my+1.2*u)} ${r1(x+w)} ${r1(my-.2*u)}`);
    if(k==="o"){ const d=`M${r1(x-.8*u)} ${r1(my)}a${r1(.8*u)} ${r1(1.1*u)} 0 1 0 ${r1(1.6*u)} 0a${r1(.8*u)} ${r1(1.1*u)} 0 1 0 ${r1(-1.6*u)} 0Z`; return body(d,`<ellipse cx="${x}" cy="${r1(my+.9*u)}" rx="${r1(.6*u)}" ry="${r1(.45*u)}" fill="#E0808D"/>`); }
    if(k==="grit"){ const d=`M${r1(x-w)} ${r1(my-.7*u)}H${r1(x+w)}V${r1(my+.9*u)}H${r1(x-w)}Z`; return `<path d="${d}" fill="#fff"/>`+[-.6,-.2,.2,.6].map(f=>`<path d="M${r1(x+f*w)} ${r1(my-.7*u)}V${r1(my+.9*u)}" stroke="${ink}" stroke-width="${r1(.16*u)}"/>`).join('')+`<path d="M${r1(x-w)} ${r1(my+.1*u)}H${r1(x+w)}" stroke="${ink}" stroke-width="${r1(.16*u)}"/>`+st(d); }
    return st(`M${r1(x-w*.8)} ${r1(my+.9*u)}Q${r1(x)} ${r1(my-.9*u)} ${r1(x+w*.8)} ${r1(my+.9*u)}`);
  }
  const MOUTHS = [
    {n:'Lächeln',      f:(g,c)=>lips(g,c,{cvL:-.8,cvR:-.8,mwk:1.1})},
    {n:'Neutral',      f:(g,c)=>lips(g,c,{cvL:0,cvR:0,mwk:.85})},
    {n:'Schmunzeln',   f:(g,c)=>lips(g,c,{cvL:.1,cvR:-.9,mwk:.9})},
    {n:'Traurig',      f:(g,c)=>lips(g,c,{cvL:.9,cvR:.9,mwk:.85})},
    {n:'Grinsen',      f:(g,c)=>lips(g,c,{cvL:-.6,cvR:-.6,open:1.3,teeth:1,mwk:1.25})},
    {n:'Lachen',       f:(g,c)=>lips(g,c,{cvL:-.9,cvR:-.9,open:2.4,teeth:1,tongue:1,mwk:1.3})},
    {n:'Überrascht',   f:(g,c)=>lips(g,c,{cvL:0,cvR:0,open:2.2,mwk:.42})},
    {n:'Schief',       f:(g,c)=>lips(g,c,{cvL:.5,cvR:-.5,mwk:.9,dy:.1})},
    {n:'Zunge raus',   f:(g,c)=>lips(g,c,{cvL:-.5,cvR:-.5,out:1,mwk:1})},
    {n:'Comic Lachen D',  f:(g,c)=>cMouth(g,c,'D')},
    {n:'Comic Zähne',     f:(g,c)=>cMouth(g,c,'teeth')},
    {n:'Comic Wellig',    f:(g,c)=>cMouth(g,c,'wavy')},
    {n:'Comic Katze',     f:(g,c)=>cMouth(g,c,'cat')},
    {n:'Comic Staunen',   f:(g,c)=>cMouth(g,c,'o')},
    {n:'Comic Zähneknirschen', f:(g,c)=>cMouth(g,c,'grit')},
    {n:'Comic Schmollen', f:(g,c)=>cMouth(g,c,'pout')}
  ];
  // ---------- Merkmale ----------
  const MARKS = [
    {n:'Keine'},
    {n:'Sommersprossen', f:(g,c)=>[-1,1].map(s=>[[.5,-4],[.85,1],[1.05,-5],[.62,5],[1.0,6]].map((p,i)=>`<circle cx="${r1(100+s*g.eDX*p[0]*1.05)}" cy="${r1(g.noseY+p[1]-6)}" r="${i%2?1:1.3}" fill="${c}" opacity=".75"/>`).join('')).join('')},
    {n:'Rote Wangen', f:(g,c)=>[-1,1].map(s=>`<ellipse cx="${r1(100+s*g.eDX*1.1)}" cy="${r1(g.eyeY+g.er*1.9)}" rx="${r1(g.hw*.2)}" ry="${r1(g.hw*.12)}" fill="${c}" opacity=".5"/>`).join('')},
    {n:'Rote Wangen + Nase', f:(g,c)=>[-1,1].map(s=>`<ellipse cx="${r1(100+s*g.eDX*1.1)}" cy="${r1(g.eyeY+g.er*1.9)}" rx="${r1(g.hw*.2)}" ry="${r1(g.hw*.12)}" fill="${c}" opacity=".5"/>`).join('')+`<ellipse cx="100" cy="${r1(g.noseY+1)}" rx="6" ry="4.4" fill="${c}" opacity=".45"/>`},
    {n:'Augenringe', f:(g,c)=>[-1,1].map(s=>`<path d="M${r1(100+s*g.eDX-g.er*.9)} ${r1(g.eyeY+g.er*1.3)}Q${r1(100+s*g.eDX)} ${r1(g.eyeY+g.er*1.9)} ${r1(100+s*g.eDX+g.er*.9)} ${r1(g.eyeY+g.er*1.3)}" stroke="${shade(g.sk,-.3)}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>`).join('')},
    {n:'Narbe', f:(g,c)=>`<path d="M${r1(100+g.eDX+3)} ${r1(g.browY-8)}L${r1(100+g.eDX-1)} ${r1(g.browY+13)}" stroke="${shade(g.sk,-.35)}" stroke-width="2" stroke-linecap="round"/><path d="M${r1(100+g.eDX-2)} ${r1(g.browY-2)}h6M${r1(100+g.eDX-3)} ${r1(g.browY+4)}h6M${r1(100+g.eDX-4)} ${r1(g.browY+10)}h6" stroke="${shade(g.sk,-.35)}" stroke-width="1.1" stroke-linecap="round"/>`},
    {n:'Pflaster', f:(g,c,c2)=>`<g transform="rotate(-18 ${r1(100+g.eDX)} ${r1(g.noseY)})"><rect x="${r1(100+g.eDX-12)}" y="${r1(g.noseY-4)}" width="24" height="8" rx="4" fill="${c}" ${OL(1.1)}/><rect x="${r1(100+g.eDX-4)}" y="${r1(g.noseY-4)}" width="8" height="8" fill="${c2}" opacity=".6"/></g>`},
    {n:'Leberfleck', f:(g,c)=>`<circle cx="${r1(100+g.mw*1.5)}" cy="${r1(g.mouthY+5)}" r="1.6" fill="${shade(g.sk,-.6)}"/>`}
  ];

  // ---------- Brille: Rahmen mit Umriss, Gläser flach getönt ----------
  const lensR = g=>g.er*1.8;
  const frame = (d,c,w)=> w>=2.4 ? `<path d="${d}" fill="none" stroke="${shade(c,-.45)}" stroke-width="${r1(w+.9)}" stroke-linejoin="round" opacity=".5"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round"/>` : `<path d="${d}" fill="none" stroke="${c==='#F5F5F7'?'#8E8E93':c}" stroke-width="${w}" stroke-linejoin="round"/>`;
  const bridge = (g,c,w,y,r)=>frame(`M${r1(100-g.eDX+r)} ${r1(y)}Q100 ${r1(y-3)} ${r1(100+g.eDX-r)} ${r1(y)}`,c,w);
  const arms = (g,c,w,y)=>frame(`M${r1(100-g.eDX-lensR(g))} ${r1(y)}L${r1(100-g.hwAt(g.eyeY)-3)} ${r1(y)}M${r1(100+g.eDX+lensR(g))} ${r1(y)}L${r1(100+g.hwAt(g.eyeY)+3)} ${r1(y)}`,c,w);
  function lensSet(g, c, c2, shapeFn, w, alpha){
    return [-1,1].map(s=>{ const d=shapeFn(100+s*g.eDX), cid=clip(g,d), x=100+s*g.eDX, R=lensR(g);
      return `<path d="${d}" fill="${c2}" fill-opacity="${alpha}"/><g clip-path="url(#${cid})"><path d="M${r1(x-R*.72)} ${r1(g.eyeY-R*.2)}L${r1(x-R*.4)} ${r1(g.eyeY-R*.62)}M${r1(x-R*.55)} ${r1(g.eyeY+R*.1)}L${r1(x-R*.5)} ${r1(g.eyeY+R*.0)}" stroke="#fff" stroke-width="1.8" stroke-opacity=".75" stroke-linecap="round"/></g>${frame(d,c,w)}`; }).join('');
  }
  const circ = (g,r)=>x=>{ const y=g.eyeY; return `M${r1(x-r)} ${r1(y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(r*2)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-r*2)} 0Z`; };
  const boxy = (g,w,h,rr)=>x=>{ const y=g.eyeY; return `M${r1(x-w+rr)} ${r1(y-h)}H${r1(x+w-rr)}Q${r1(x+w)} ${r1(y-h)} ${r1(x+w)} ${r1(y-h+rr)}V${r1(y+h-rr)}Q${r1(x+w)} ${r1(y+h)} ${r1(x+w-rr)} ${r1(y+h)}H${r1(x-w+rr)}Q${r1(x-w)} ${r1(y+h)} ${r1(x-w)} ${r1(y+h-rr)}V${r1(y-h+rr)}Q${r1(x-w)} ${r1(y-h)} ${r1(x-w+rr)} ${r1(y-h)}Z`; };
  const GLASSES = [
    {n:'Keine'},
    {n:'Rund dünn',     f:(g,c,c2)=>lensSet(g,c,c2,circ(g,lensR(g)*.98),1.7,.18)+bridge(g,c,1.7,g.eyeY-1,lensR(g)*.98)+arms(g,c,1.7,g.eyeY-1)},
    {n:'Rund klar',     f:(g,c,c2)=>lensSet(g,c,c2,circ(g,lensR(g)),2.6,.14)+bridge(g,c,2.4,g.eyeY-1,lensR(g))+arms(g,c,2.4,g.eyeY-1)},
    {n:'Pilotenbrille', f:(g,c,c2)=>{ const w=lensR(g)*1.1,h=lensR(g)*.98; return lensSet(g,c,c2,x=>{ const y=g.eyeY; return `M${r1(x-w)} ${r1(y-h*.85)}Q${r1(x)} ${r1(y-h*1.05)} ${r1(x+w)} ${r1(y-h*.85)}L${r1(x+w*.9)} ${r1(y+h*.5)}Q${r1(x)} ${r1(y+h*1.2)} ${r1(x-w*.9)} ${r1(y+h*.5)}Z`; },3.6,.14)+bridge(g,c,3.4,g.eyeY-lensR(g)*.55,w)+arms(g,c,3,g.eyeY-lensR(g)*.55); }},
    {n:'Eckig dick',    f:(g,c,c2)=>{ const w=lensR(g)*1.05,h=lensR(g)*.8; return lensSet(g,c,c2,boxy(g,w,h,3.4),3.4,.14)+bridge(g,c,3,g.eyeY-h*.5,w)+arms(g,c,2.8,g.eyeY-h*.5); }},
    {n:'Eckig dünn',    f:(g,c,c2)=>{ const w=lensR(g)*1.02,h=lensR(g)*.78; return lensSet(g,c,c2,boxy(g,w,h,3),1.7,.18)+bridge(g,c,1.7,g.eyeY-h*.5,w)+arms(g,c,1.7,g.eyeY-h*.5); }},
    {n:'Sonnenbrille',  f:(g,c,c2)=>{ const w=lensR(g)*1.1; return lensSet(g,c,c2,x=>{ const y=g.eyeY, h=lensR(g); return `M${r1(x-w)} ${r1(y-h*.8)}H${r1(x+w)}Q${r1(x+w)} ${r1(y+h*1.05)} ${r1(x)} ${r1(y+h*1.05)}Q${r1(x-w)} ${r1(y+h*1.05)} ${r1(x-w)} ${r1(y-h*.8)}Z`; },2.8,.95)+bridge(g,c,2.8,g.eyeY-lensR(g)*.6,w)+arms(g,c,2.6,g.eyeY-lensR(g)*.6); }},
    {n:'Augenklappe', f:(g,c,c2)=>{ const x=100-g.eDX, y=g.eyeY, rx=lensR(g)*.95, ry=lensR(g)*.82;
        const strap=`<path d="M${r1(x-rx*.5)} ${r1(y-ry*.7)}L${r1(100-g.hwAt(g.eyeY-14)-1)} ${r1(g.eyeY-16)}M${r1(x+rx*.6)} ${r1(y-ry*.75)}L${r1(100+g.hw*.7)} ${r1(g.top+9)}" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
        const patch=`<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${c}" stroke="${INK}" stroke-width=".9"/>`;
        return strap+patch; }}
  ];

  // ---------- Kopfbedeckung ----------
  const capBase = (g,off,yEnd,bulge)=>{ const seq=outlineSeq(g,off,yEnd,0); return pathOpen(seq)+`Q100 ${r1(yEnd+bulge)} ${P(seq[0])}Z`; };
  function fab(g, d, c, extra){
    const cid=clip(g,d), gid=lin(g,[[0,shade(c,.16)],[.55,c],[1,shade(c,-.2)]],0,0,1,1);
    return (TOON?'':`<path d="${d}" fill="#000" opacity=".15" transform="translate(0 1.6)"/>`)+`<path d="${d}" fill="url(#${gid})"/><g clip-path="url(#${cid})">${extra||''}</g>`;
  }  const hiBand = (g,c)=>`<path d="M${r1(100-g.hw*.8)} ${r1(g.top+14)}Q${r1(100-g.hw*.5)} ${r1(g.top-8)} ${r1(100+g.hw*.1)} ${r1(g.top-9)}Q${r1(100-g.hw*.35)} ${r1(g.top+1)} ${r1(100-g.hw*.45)} ${r1(g.top+16)}Z" fill="${shade(c,.25)}" opacity=".8"/>`;
  const leafStar = (cx,cy,s,c)=>`<g transform="translate(${r1(cx)} ${r1(cy)}) scale(${s})" fill="${c}" stroke="${INK}" stroke-width="1">${[0,45,90,135,180,225,270,315].map(a=>`<path d="M0 -13L3 -6L-3 -6Z" transform="rotate(${a})"/>`).join('')}<circle r="8" fill="#F5F5F7"/>${[-55,-28,0,28,55].map(a=>`<ellipse rx="1.5" ry="${a===0?6:4.6}" cy="-${a===0?3:2.4}" transform="rotate(${a})" stroke="none"/>`).join('')}</g>`;
  function capSeams(g,y,c){ let s=''; for(let i=-2;i<=2;i++) s+=`<path d="M${r1(100+i*3)} ${r1(g.top-12)}Q${r1(100+i*g.hw*.38)} ${r1(g.top+6)} ${r1(100+i*g.hw*.58)} ${r1(y+2)}" fill="none" stroke="${shade(c,-.35)}" stroke-width="1" stroke-opacity=".7"/>`; return s; }
  function brim(g,y,c2,depth){
    const hwy=g.hwAt(y)+12, d=`M${r1(100-hwy)} ${r1(y+1)}Q100 ${r1(y+depth)} ${r1(100+hwy)} ${r1(y+1)}Q100 ${r1(y+8)} ${r1(100-hwy)} ${r1(y+1)}Z`;
    return fab(g,d,c2);
  }
  function beanie(g,c,c2,patch){
    const y=g.browY-9, o=12, k=g.hwAt(y-16)+o, k2=g.hwAt(y)+o; let rib=''; for(let i=-6;i<=6;i++) rib+=`<path d="M${r1(100+i*(k2/6.2))} ${r1(y-16)}V${r1(y+8)}" stroke="${shade(c,-.3)}" stroke-width="1" stroke-opacity=".7"/>`;
    let s=fab(g,capBase(g,o,y,5),c,hiBand(g,c))+fab(g,`M${r1(100-k)} ${r1(y-16)}Q100 ${r1(y-10)} ${r1(100+k)} ${r1(y-16)}L${r1(100+k2)} ${r1(y)}Q100 ${r1(y+6)} ${r1(100-k2)} ${r1(y)}Z`,shade(c,-.1),rib);
    if(patch) s+=`<rect x="84" y="${r1(y-12)}" width="32" height="13" rx="2" fill="#F5F5F7" ${OL(1.2)}/><path d="M0 2.4c-4.6-4.2 -7.6-.8 -4.2 2.4L0 8.6l4.2-3.8c3.4-3.2 -.4-6.6 -4.2-2.4z" fill="${c2}" transform="translate(100 ${r1(y-10.6)}) scale(1.1)"/>`;
    return s;
  }
  // Kapuze (Mii/Switch-Stil): runder Körper hinter dem Kopf, einfacher Rand ums Gesicht, Kragen am Hals
  function hoodBack(g,c){
    const hw=g.hw, R=[[100+hw+26,182],[100+hw+24,g.mouthY],[100+hw+18,g.earY-6],[100+hw+10,g.browY-18],[100+hw*.6,g.top-12],[104,g.top-17]], L=rev(mirror(R.slice(0,-1)));
    return fab(g,pathOpen(R.concat([[100,g.top-18]]).concat(L))+'Z',shade(c,-.12));
  }
  // Vorderteil der Kapuze: sitzt nur oben auf dem Kopf (bis zu den Ohren), Kinn und Wangen bleiben frei
  function hoodFront(g,c){
    const yE=g.earY+8, hwE=g.hwAt(yE), outer=outlineSeq(g,10,yE,0,false,11), yb=g.browY-9;
    const inner=[[100+hwE+1.5,yE],[100+g.hwAt(g.earY)+1.5,g.earY],[100+g.hwAt(g.browY)+2,g.browY],[100+g.hw*.7,yb+3],[100,yb-2],[100-g.hw*.7,yb+3],[100-g.hwAt(g.browY)-2,g.browY],[100-g.hwAt(g.earY)-1.5,g.earY],[100-hwE-1.5,yE]];
    return `<path fill-rule="evenodd" d="${pathOpen(outer)}Z${pathOpen(inner)}Z" fill="${c}"/><path d="${pathOpen(outer)}${pathOpen(inner)}" fill="none" ${lo(c)}/>`;
  }
  // Sturmmaske: bedeckt Kopf, Wangen, Nase und Mund, nur die Augen bleiben frei
  function balaclava(g,c,c2){
    const yE=g.chin-8, seq=outlineSeq(g,3,yE,0,false,3), ch=[[100-g.cw-4,g.chin+3],[100,g.chin+5],[100+g.cw+4,g.chin+3]];
    const dOut=pathOpen(seq.concat(ch))+'Z';
    const x1=100-(g.eDX+g.er+5), x2=100+(g.eDX+g.er+5), y1=g.browY-5, y2=g.eyeY+g.er*.9+3, r=Math.min(10,(y2-y1)/2);
    const slot=`M${r1(x1+r)} ${r1(y1)}H${r1(x2-r)}Q${r1(x2)} ${r1(y1)} ${r1(x2)} ${r1(y1+r)}V${r1(y2-r)}Q${r1(x2)} ${r1(y2)} ${r1(x2-r)} ${r1(y2)}H${r1(x1+r)}Q${r1(x1)} ${r1(y2)} ${r1(x1)} ${r1(y2-r)}V${r1(y1+r)}Q${r1(x1)} ${r1(y1)} ${r1(x1+r)} ${r1(y1)}Z`;
    const id=g.id('cp'); g.defs+=`<clipPath id="${id}"><path clip-rule="evenodd" d="${dOut}${slot}"/></clipPath>`;
    let rib=''; for(let i=-7;i<=7;i++) rib+=`<path d="M${r1(100+i*g.hw*.15)} ${r1(g.top-8)}V${r1(g.chin+8)}" stroke="${shade(c,-.25)}" stroke-width="1" stroke-opacity=".45"/>`;
    return `<path fill-rule="evenodd" d="${dOut}${slot}" fill="${c}"/><g clip-path="url(#${id})">${hiBand(g,c)}${rib}</g><path d="${dOut}" fill="none" ${lo(c)}/><path d="${slot}" fill="none" ${lo(c)}/><path d="${slot}" fill="none" stroke="${shade(c,.3)}" stroke-width="1" stroke-dasharray="2 2" transform="translate(0 0)" opacity=".6"/>`;
  }
  const HATS = [
    {n:'Keine'},
    {n:'Cap', front:(g,c,c2)=>{ const y=g.browY-9; return fab(g,capBase(g,11,y,7),c,hiBand(g,c)+capSeams(g,y,c))+brim(g,y,c2,24)+`<circle cx="100" cy="${r1(g.top-9)}" r="2.8" fill="${c2}" ${OL(1)}/>`; }},
    {n:'Cap verkehrt', front:(g,c,c2)=>{ const y=g.browY-13, w=g.hwAt(y)+11; return fab(g,capBase(g,11,y,5),c,hiBand(g,c)+capSeams(g,y,c))+`<path d="M${r1(100-w)} ${r1(y+1)}Q100 ${r1(y+7)} ${r1(100+w)} ${r1(y+1)}" stroke="${INK}" stroke-width="5.6" fill="none" stroke-linecap="round"/><path d="M${r1(100-w)} ${r1(y+1)}Q100 ${r1(y+7)} ${r1(100+w)} ${r1(y+1)}" stroke="${c2}" stroke-width="3.6" fill="none" stroke-linecap="round"/><rect x="90" y="${r1(y-3)}" width="20" height="8" rx="2" fill="${c2}" ${OL(1.1)}/>`; }},
    {n:'Hanf-Cap', front:(g,c,c2)=>{ const y=g.browY-9; return fab(g,capBase(g,11,y,7),c,hiBand(g,c)+capSeams(g,y,c)+leafStar(100,g.top-2,1.1,c2))+brim(g,y,shade(c,-.1),24); }},
    {n:'Beanie', front:(g,c,c2)=>beanie(g,c,c2,false)},
    {n:'Beanie mit Aufnäher', front:(g,c,c2)=>beanie(g,c,c2,true)},
    {n:'Fellmütze', front:(g,c,c2)=>{ const yF=g.chin-2, yb=g.browY-10, outer=outlineSeq(g,12,yF,3,false,13);
        const inner=[[100+g.hwAt(yF)+1,yF],[100+g.hwAt(g.mouthY)+1.5,g.mouthY],[100+g.hwAt(g.earY)+1.5,g.earY],[100+g.hwAt(g.browY)+2,g.browY],[100+g.hw*.7,yb+3],[100,yb-2],[100-g.hw*.7,yb+3],[100-g.hwAt(g.browY)-2,g.browY],[100-g.hwAt(g.earY)-1.5,g.earY],[100-g.hwAt(g.mouthY)-1.5,g.mouthY],[100-g.hwAt(yF)-1,yF]];
        const d=`${pathOpen(outer)}Z${pathOpen(inner)}Z`, id=g.id('cp'); g.defs+=`<clipPath id="${id}"><path clip-rule="evenodd" d="${d}"/></clipPath>`;
        let fur=''; for(let i=0;i<30;i++){ const a=Math.PI*(1+i/29), rx=g.hw+11; fur+=`<path d="M${r1(100+Math.cos(a)*rx*.4)} ${r1(g.top+14+Math.sin(a)*10)}L${r1(100+Math.cos(a)*rx)} ${r1(g.top+18+Math.sin(a)*g.ht*.2)}" stroke="${shade(c,-.2)}" stroke-width="1.2" stroke-opacity=".5" stroke-linecap="round"/>`; }
        for(let i=0;i<8;i++){ [1,-1].forEach(s=>{ fur+=`<path d="M${r1(100+s*(g.hwAt(g.earY)+2))} ${r1(g.earY-8+i*6)}l${r1(s*9)} ${r1(2)}" stroke="${shade(c,-.2)}" stroke-width="1.2" stroke-opacity=".5" stroke-linecap="round"/>`; }); }
        return `<path fill-rule="evenodd" d="${d}" fill="${c}"/><g clip-path="url(#${id})">${hiBand(g,c)}${fur}</g><path d="${pathOpen(outer)}${pathOpen(inner)}" fill="none" ${lo(c)}/>`; }},
    {n:'Kapuze', back:(g,c,c2)=>hoodBack(g,c), front:(g,c,c2)=>hoodFront(g,c)},
    {n:'Bandana', front:(g,c,c2)=>{ const y=g.browY-9; let dt=''; [[-18,-8],[-6,-14],[8,-9],[20,-14],[-26,-2],[26,-3],[0,-24],[-14,-22],[14,-22],[-30,-16],[30,-16]].forEach(p=>{ dt+=`<circle cx="${r1(100+p[0])}" cy="${r1(y+p[1]+(p[1]>-8?-1:0)+4)}" r="2" fill="${c2}"/>`; }); const kx=100+g.hwAt(y)+4;
        return fab(g,`M${r1(kx)} ${r1(y-4)}l13 -7 l-1 11 l11 5 l-13 1 l-2 9 l-7 -12 z`,c,'')+fab(g,capBase(g,6.5,y,3),c,hiBand(g,c)+dt)+`<path d="M${r1(100-g.hwAt(y)-5)} ${r1(y-5)}Q100 ${r1(y)} ${r1(100+g.hwAt(y)+5)} ${r1(y-5)}" stroke="${c2}" stroke-width="2.2" fill="none"/>`; }},
    {n:'Stirnband', front:(g,c,c2)=>{ const ya=g.browY-21, yb=g.browY-6; const R=[ya,(ya+yb)/2,yb].map(y=>[100+g.hwAt(y)+3,y]); const L=rev(mirror(R)); return fab(g,`${pathOpen(R.concat(L))}Q100 ${r1(yb+6)} ${P(R[0])}Z`,c)+`<path d="M${P(L[0])}Q100 ${r1(ya+5)} ${P(R[0])}" stroke="${c2}" stroke-width="2" fill="none"/>`; }},
    {n:'Kopfhörer', front:(g,c,c2)=>{ const xo=g.hwAt(g.earY)+9.5, band=`M${r1(100-xo)} ${r1(g.earY)}Q${r1(100-xo-5)} ${r1(g.top-15)} 100 ${r1(g.top-16)}Q${r1(100+xo+5)} ${r1(g.top-15)} ${r1(100+xo)} ${r1(g.earY)}`; return `<path d="${band}" stroke="${INK}" stroke-width="9.4" fill="none" stroke-linecap="round"/><path d="${band}" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/>`+[-1,1].map(s=>fab(g,`M${r1(100+s*xo-8.5)} ${r1(g.earY-8)}Q${r1(100+s*xo-8.5)} ${r1(g.earY-17)} ${r1(100+s*xo)} ${r1(g.earY-17)}Q${r1(100+s*xo+8.5)} ${r1(g.earY-17)} ${r1(100+s*xo+8.5)} ${r1(g.earY-8)}V${r1(g.earY+14)}Q${r1(100+s*xo+8.5)} ${r1(g.earY+22)} ${r1(100+s*xo)} ${r1(g.earY+22)}Q${r1(100+s*xo-8.5)} ${r1(g.earY+22)} ${r1(100+s*xo-8.5)} ${r1(g.earY+14)}Z`,c2)).join(''); }},
    {n:'Sturmmaske', front:(g,c,c2)=>balaclava(g,c,c2)},
    {n:'Piratenhut', front:(g,c,c2)=>{ const y=g.browY-13, w=g.hw+24;
        const brimD=`M${r1(100-w)} ${r1(y-9)}Q${r1(100-w*.55)} ${r1(y+13)} 100 ${r1(y+10)}Q${r1(100+w*.55)} ${r1(y+13)} ${r1(100+w)} ${r1(y-9)}Q${r1(100+w*.6)} ${r1(y+1)} 100 ${r1(y+1.5)}Q${r1(100-w*.6)} ${r1(y+1)} ${r1(100-w)} ${r1(y-9)}Z`;
        const sk=`<circle cx="100" cy="${r1(y-14)}" r="4.2" fill="${c2}"/><rect x="97.4" y="${r1(y-11)}" width="5.2" height="3.4" rx="1" fill="${c2}"/><circle cx="98.2" cy="${r1(y-14.4)}" r="1" fill="${c}"/><circle cx="101.8" cy="${r1(y-14.4)}" r="1" fill="${c}"/><path d="M93 ${r1(y-5)}L107 ${r1(y-9.4)}M93 ${r1(y-9.4)}L107 ${r1(y-5)}" stroke="${c2}" stroke-width="1.6" stroke-linecap="round"/>`;
        return fab(g,brimD,shade(c,.05),'')+fab(g,capBase(g,10,y+2,5),c,hiBand(g,c)+sk); }},
    {n:'Cowboyhut', front:(g,c,c2)=>{ const y=g.browY-12, k=g.hwAt(y-10)+9, w=g.hw+27, top=g.top-17;
        const crown=`M${r1(100-k)} ${r1(y)}Q${r1(100-k-2)} ${r1(g.top-4)} ${r1(100-k*.55)} ${r1(top)}Q100 ${r1(top+7)} ${r1(100+k*.55)} ${r1(top)}Q${r1(100+k+2)} ${r1(g.top-4)} ${r1(100+k)} ${r1(y)}Z`;
        const brimD=`M${r1(100-w)} ${r1(y-8)}Q${r1(100-w*.55)} ${r1(y+12)} 100 ${r1(y+9)}Q${r1(100+w*.55)} ${r1(y+12)} ${r1(100+w)} ${r1(y-8)}Q${r1(100+w*.6)} ${r1(y+1)} 100 ${r1(y+1)}Q${r1(100-w*.6)} ${r1(y+1)} ${r1(100-w)} ${r1(y-8)}Z`;
        const band=`<path d="M${r1(100-k-4)} ${r1(y-3)}Q100 ${r1(y+3)} ${r1(100+k+4)} ${r1(y-3)}" fill="none" stroke="${c2}" stroke-width="4.2"/>`;
        return fab(g,brimD,shade(c,.05),'')+fab(g,crown,c,hiBand(g,c)+band); }},
    {n:'Ritterhelm', front:(g,c,c2)=>{ const yb=g.browY-9;
        const plume=`M${r1(100-5)} ${r1(g.top-8)}Q${r1(100-4)} ${r1(g.top-34)} ${r1(100+24)} ${r1(g.top-18)}Q${r1(100+14)} ${r1(g.top-12)} ${r1(100+7)} ${r1(g.top-6)}Z`;
        const nose=`<rect x="98.3" y="${r1(yb-4)}" width="3.4" height="${r1(g.noseY-yb+4)}" rx="1.2" fill="${shade(c,-.18)}"/>`;
        return fab(g,plume,c2,'')+hoodFront(g,c)+`<path d="M${r1(100-g.hw*.8)} ${r1(g.top+6)}Q100 ${r1(g.top-6)} ${r1(100+g.hw*.8)} ${r1(g.top+6)}" fill="none" stroke="${shade(c,-.2)}" stroke-width="2.4"/>`+nose; }},
    {n:'Krone', front:(g,c,c2)=>{ const y1=g.top+13, k=g.hwAt(g.top+24)*.9;
        const d=`M${r1(100-k)} ${r1(y1)}L${r1(100-k)} ${r1(y1-16)}L${r1(100-k*.5)} ${r1(y1-6)}L100 ${r1(y1-22)}L${r1(100+k*.5)} ${r1(y1-6)}L${r1(100+k)} ${r1(y1-16)}L${r1(100+k)} ${r1(y1)}Q100 ${r1(y1+5)} ${r1(100-k)} ${r1(y1)}Z`;
        const gems=[[-k,y1-16],[0,y1-22],[k,y1-16]].map(p=>`<circle cx="${r1(100+p[0])}" cy="${r1(p[1])}" r="2.4" fill="${c2}"/>`).join('')+`<circle cx="100" cy="${r1(y1+.5)}" r="2.2" fill="${c2}"/>`;
        return fab(g,d,c,gems); }},
    {n:'Astronautenhelm', front:(g,c,c2)=>{ const cx=100, cy=g.top+g.ht*.5, rx=g.hw+15, ry=g.ht*.5+14, ri=1.0;
        const e=(a,b,y)=>`M${r1(cx-a)} ${r1(y)}a${r1(a)} ${r1(b)} 0 1 0 ${r1(a*2)} 0a${r1(a)} ${r1(b)} 0 1 0 ${r1(-a*2)} 0Z`;
        const ring=`<path fill-rule="evenodd" d="${e(rx,ry,cy)}${e(rx-6.5,ry-6.5,cy)}" fill="${c}"/>`;
        const hl=`<path d="M${r1(cx-rx*.78)} ${r1(cy-ry*.5)}Q${r1(cx-rx*.7)} ${r1(cy-ry*.88)} ${r1(cx-rx*.25)} ${r1(cy-ry*.97)}" fill="none" stroke="${shade(c,.5)}" stroke-width="2.6" stroke-linecap="round"/>`;
        const ant=`<path d="M${r1(cx+rx*.62)} ${r1(cy-ry*.72)}L${r1(cx+rx*.8)} ${r1(cy-ry*1.12)}" stroke="${c2}" stroke-width="2" stroke-linecap="round"/><circle cx="${r1(cx+rx*.8)}" cy="${r1(cy-ry*1.14)}" r="2.6" fill="${c2}"/>`;
        const collar=`<path d="M${r1(cx-g.nw-10)} ${r1(g.chin+4)}Q100 ${r1(g.chin+14)} ${r1(cx+g.nw+10)} ${r1(g.chin+4)}L${r1(cx+g.nw+12)} ${r1(g.chin+12)}Q100 ${r1(g.chin+22)} ${r1(cx-g.nw-12)} ${r1(g.chin+12)}Z" fill="${c2}"/>`;
        return fab(g,`M${r1(cx-g.nw-10)} ${r1(g.chin+4)}Q100 ${r1(g.chin+14)} ${r1(cx+g.nw+10)} ${r1(g.chin+4)}L${r1(cx+g.nw+12)} ${r1(g.chin+12)}Q100 ${r1(g.chin+22)} ${r1(cx-g.nw-12)} ${r1(g.chin+12)}Z`,c2,'')+ring+hl+ant; }},
    {n:'Feuerwehrhelm', front:(g,c,c2)=>{ const y=g.browY-8, k=g.hwAt(y-10)+10;
        const badge=`<path d="M${r1(100-9)} ${r1(y-17)}h18v7.5c0 6-9 9.5-9 9.5s-9-3.5-9-9.5z" fill="${c2}" stroke="${shade(c,-.4)}" stroke-width="1"/><path d="M100 ${r1(y-14)}v8" stroke="${shade(c,-.4)}" stroke-width="1.6" stroke-linecap="round"/>`;
        const ridge=`<path d="M100 ${r1(g.top-14)}V${r1(y-18)}" stroke="${shade(c,-.3)}" stroke-width="3.4" stroke-linecap="round"/>`;
        const flap=`M${r1(100-k-2)} ${r1(y-1)}Q100 ${r1(y+12)} ${r1(100+k+2)} ${r1(y-1)}L${r1(100+k)} ${r1(y+3)}Q100 ${r1(y+14)} ${r1(100-k)} ${r1(y+3)}Z`;
        return fab(g,capBase(g,11,y,6),c,hiBand(g,c)+ridge+badge)+fab(g,flap,shade(c,-.1),''); }},
    {n:'Kochmütze', front:(g,c,c2)=>{ const y=g.browY-9, k=g.hwAt(y-8)+8, ty=g.top-14;
        const puff=(x,yy,r)=>fab(g,`M${r1(x-r)} ${r1(yy)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(r*2)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-r*2)} 0Z`,c,'');
        const band=fab(g,`M${r1(100-k)} ${r1(y-9)}Q100 ${r1(y-5)} ${r1(100+k)} ${r1(y-9)}L${r1(100+k)} ${r1(y+1)}Q100 ${r1(y+5)} ${r1(100-k)} ${r1(y+1)}Z`,c,`<path d="M${r1(100-k)} ${r1(y-3)}Q100 ${r1(y+1)} ${r1(100+k)} ${r1(y-3)}" fill="none" stroke="${c2}" stroke-width="1.4" opacity=".8"/>`);
        return puff(100-k*.62,ty+12,15)+puff(100+k*.62,ty+12,15)+puff(100,ty+2,18)+fab(g,`M${r1(100-k*.9)} ${r1(ty+12)}H${r1(100+k*.9)}V${r1(y-6)}H${r1(100-k*.9)}Z`,c,'')+band; }}
  ];

  // ---------- Kleidung ----------
  const SL = (w)=>`stroke="#000" stroke-opacity=".28" stroke-width="${(w||1.3)*.8}" stroke-linejoin="round" stroke-linecap="round"`;
  const neckline = (g,c,sk,depth,w)=>`<path d="M${r1(100-g.nw-(w||6))} 150Q100 ${r1(depth+g.nw*.1)} ${r1(100+g.nw+(w||6))} 150Z" fill="${sk}" ${SL()}/>`;
  const OUTFITS = [
    {n:'T-Shirt', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c}"/>${neckline(g,c,sk,168)}`})},
    {n:'T-Shirt mit Print', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c}"/>${neckline(g,c,sk,168)}<g fill="${c2}"><rect x="${r1(100-g.sw*.4)}" y="190" width="${r1(g.sw*.8)}" height="6" rx="1.5"/><rect x="${r1(100-g.sw*.4)}" y="200" width="${r1(g.sw*.58)}" height="6" rx="1.5"/><rect x="${r1(100-g.sw*.4)}" y="210" width="${r1(g.sw*.7)}" height="6" rx="1.5"/></g>`})},
    {n:'Hanf-Shirt', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c}"/>${neckline(g,c,sk,168)}<g transform="translate(100 214) scale(${r1(.9+g.bk*.1)})" fill="${c2}" ${SL(1)}>${[-62,-31,0,31,62].map(a=>`<ellipse rx="4.4" ry="${a===0?21:17}" cy="-${a===0?19:15}" transform="rotate(${a})"/>`).join('')}<rect x="-1.2" y="0" width="2.4" height="12"/></g>`})},
    {n:'Sweatshirt', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-8)} 151Q100 ${r1(172+g.nw*.1)} ${r1(100+g.nw+8)} 151Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.nw-8)} 151Q100 ${r1(172+g.nw*.1)} ${r1(100+g.nw+8)} 151" fill="none" stroke="${shade(c,-.2)}" stroke-width="5"/><path d="M${r1(100-g.nw-8)} 151Q100 ${r1(172+g.nw*.1)} ${r1(100+g.nw+8)} 151" fill="none" ${SL(1.3)}/><path d="M${r1(100-g.bw)} 226H${r1(100+g.bw)}" ${SL(1.3)}/>`})},
    {n:'Hoodie', f:(g,c,c2,sk)=>({back:`<ellipse cx="100" cy="158" rx="${r1(g.nw+24)}" ry="19" fill="${shade(c,-.25)}" ${OL()}/>`,
      inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-10)} 152Q100 ${r1(176+g.nw*.15)} ${r1(100+g.nw+10)} 152Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.nw-10)} 152Q${r1(100-g.nw*.4)} 164 ${r1(100-g.nw*.4)} 176M${r1(100+g.nw+10)} 152Q${r1(100+g.nw*.4)} 164 ${r1(100+g.nw*.4)} 176" fill="none" stroke="${shade(c,-.2)}" stroke-width="5"/><path d="M${r1(100-g.nw-10)} 152Q100 ${r1(176+g.nw*.15)} ${r1(100+g.nw+10)} 152" fill="none" ${SL()}/><path d="M${r1(100-g.nw*.6)} 172V198M${r1(100+g.nw*.6)} 172V198" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M${r1(100-g.nw*.6)} 172V198M${r1(100+g.nw*.6)} 172V198" stroke="${c2}" stroke-width="2.4" stroke-linecap="round"/><path d="M${r1(100-g.sw*.55)} 236L${r1(100-g.sw*.4)} 208Q100 200 ${r1(100+g.sw*.4)} 208L${r1(100+g.sw*.55)} 236" fill="${shade(c,-.08)}" ${SL()}/>`})},
    {n:'Zip-Hoodie', f:(g,c,c2,sk)=>({back:`<ellipse cx="100" cy="158" rx="${r1(g.nw+24)}" ry="19" fill="${shade(c,-.25)}" ${OL()}/>`,
      inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-8)} 152L100 184L${r1(100+g.nw+8)} 152Z" fill="${c2}" ${SL()}/><path d="M${r1(100-g.nw-10)} 152L100 186L${r1(100+g.nw+10)} 152" fill="none" stroke="${shade(c,-.2)}" stroke-width="4"/><path d="M${r1(100-g.nw-10)} 152L100 186L${r1(100+g.nw+10)} 152" fill="none" ${SL()}/><path d="M100 186V236" ${SL(1.3)} stroke-dasharray="2 2"/><path d="M${r1(100-g.nw*.75)} 168V190M${r1(100+g.nw*.75)} 168V190" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path d="M${r1(100-g.nw*.75)} 168V190M${r1(100+g.nw*.75)} 168V190" stroke="${shade(c,.3)}" stroke-width="2.2" stroke-linecap="round"/>`})},
    {n:'Hemd offen', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-6)} 150L100 184L${r1(100+g.nw+6)} 150Z" fill="${sk}" ${SL()}/><path d="M100 184V236" ${SL(1.3)}/><g fill="${c2}" ${SL(1)}>${[196,210,224].map(y=>`<circle cx="100" cy="${y}" r="1.9"/>`).join('')}</g>`,
      outer:`<path d="M${r1(100-g.nw-4)} 148L${r1(100-g.nw-18)} 164L100 186L${r1(100-g.nw*.15)} 168Z" fill="${shade(c,.15)}" ${SL()}/><path d="M${r1(100+g.nw+4)} 148L${r1(100+g.nw+18)} 164L100 186L${r1(100+g.nw*.15)} 168Z" fill="${shade(c,.15)}" ${SL()}/>`})},
    {n:'Hemd geschlossen', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-3)} 150L100 164L${r1(100+g.nw+3)} 150Z" fill="${sk}" ${SL()}/><path d="M100 164V236" ${SL(1.3)}/><g fill="${c2}" ${SL(1)}>${[172,186,200,214,228].map(y=>`<circle cx="100" cy="${y}" r="1.9"/>`).join('')}</g>`,
      outer:`<path d="M${r1(100-g.nw-5)} 147L${r1(100-g.nw-15)} 160L100 170L${r1(100-g.nw*.1)} 156Z" fill="${shade(c,.15)}" ${SL()}/><path d="M${r1(100+g.nw+5)} 147L${r1(100+g.nw+15)} 160L100 170L${r1(100+g.nw*.1)} 156Z" fill="${shade(c,.15)}" ${SL()}/>`})},
    {n:'Karo-Jacke', f:(g,c,c2,sk)=>{ let grid=''; for(let y=150;y<240;y+=11) grid+=`<path d="M0 ${y}H200" stroke="${c2}" stroke-width="3.6" opacity=".55"/>`; for(let x=0;x<=200;x+=11) grid+=`<path d="M${x} 150V240" stroke="${c2}" stroke-width="3.6" opacity=".55"/>`;
      return {inner:`<path d="${g.torsoD}" fill="${c}"/>${grid}<path d="M${r1(100-g.nw-6)} 150L${r1(100-g.nw*.2)} 236H${r1(100+g.nw*.2)}L${r1(100+g.nw+6)} 150Q100 ${r1(166+g.nw*.1)} ${r1(100-g.nw-6)} 150Z" fill="#F5F5F7" ${SL()}/><path d="M${r1(100-g.nw-6)} 150Q100 ${r1(166+g.nw*.1)} ${r1(100+g.nw+6)} 150Z" fill="${sk}" ${SL()}/>`}; }},
    {n:'Daunenjacke', f:(g,c,c2,sk)=>{ let q=''; for(let y=178;y<240;y+=15) q+=`<path d="M${100-g.bw} ${y}Q100 ${y+6} ${100+g.bw} ${y}" fill="none" ${SL(1.4)}/>`;
      return {back:`<ellipse cx="100" cy="157" rx="${r1(g.nw+22)}" ry="17" fill="${shade(c,-.25)}" ${OL()}/>`, inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-6)} 150L${r1(100-g.nw*.15)} 236H${r1(100+g.nw*.15)}L${r1(100+g.nw+6)} 150Z" fill="${c2}" ${SL()}/><path d="M${r1(100-g.nw-6)} 150Q100 ${r1(168+g.nw*.1)} ${r1(100+g.nw+6)} 150Z" fill="${sk}" ${SL()}/>${q}`,
        outer:`<path d="M${r1(100-g.nw-18)} 152Q100 ${r1(166+g.nw*.1)} ${r1(100+g.nw+18)} 152L${r1(100+g.nw+12)} 164Q100 178 ${r1(100-g.nw-12)} 164Z" fill="${shade(c,.08)}" ${OL()}/>`}; }},
    {n:'Weste + Pulli', f:(g,c,c2,sk)=>({back:`<ellipse cx="100" cy="157" rx="${r1(g.nw+20)}" ry="16" fill="${shade(c,-.25)}" ${OL()}/>`, inner:`<path d="${g.torsoD}" fill="${c2}"/><path d="M${r1(100-g.nw-6)} 150Q100 ${r1(170+g.nw*.1)} ${r1(100+g.nw+6)} 150Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.sw*.66)} 236L${r1(100-g.sw*.6)} 182Q${r1(100-g.sw*.5)} 160 ${r1(100-g.nw-6)} 150L${r1(100-g.nw*.15)} 236Z M${r1(100+g.sw*.66)} 236L${r1(100+g.sw*.6)} 182Q${r1(100+g.sw*.5)} 160 ${r1(100+g.nw+6)} 150L${r1(100+g.nw*.15)} 236Z" fill="${c}" ${SL(1.6)}/>`,
        outer:`<path d="M${r1(100-g.nw-14)} 150Q${r1(100-g.nw-16)} 162 ${r1(100-g.nw-4)} 168L${r1(100-g.nw)} 150Z M${r1(100+g.nw+14)} 150Q${r1(100+g.nw+16)} 162 ${r1(100+g.nw+4)} 168L${r1(100+g.nw)} 150Z" fill="${c}" ${SL()}/>`})},
    {n:'Tanktop', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${sk}"/><path d="M${r1(100-g.nw-9)} 150Q${r1(100-g.sw*.55)} 172 ${r1(100-g.sw*.62)} 188L${r1(100-g.bw)} 236H${r1(100+g.bw)}L${r1(100+g.sw*.62)} 188Q${r1(100+g.sw*.55)} 172 ${r1(100+g.nw+9)} 150L${r1(100+g.nw+3)} 150Q100 186 ${r1(100-g.nw-3)} 150Z" fill="${c}" ${SL(1.5)}/>`})},
    {n:'Strickpulli', f:(g,c,c2,sk)=>{ let z=''; for(let y=168,i=0;y<240;y+=13,i++){ let pts=[]; for(let x=0;x<=200;x+=10) pts.push(`${x} ${y+((x/10)%2?5:-1)}`); z+=`<path d="M${pts.join('L')}" stroke="${i%2?c2:'#1D1D1F'}" stroke-width="${i%2?4:3}" fill="none"/>`; }
      return {inner:`<path d="${g.torsoD}" fill="${c}"/>${z}<path d="M${r1(100-g.nw-8)} 150L100 176L${r1(100+g.nw+8)} 150Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.nw-8)} 150L100 176L${r1(100+g.nw+8)} 150" stroke="#1D1D1F" stroke-width="4.4" fill="none" stroke-linejoin="round"/>`}; }},
    {n:'Dirndl', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="#F5F5F7"/><path d="M${r1(100-g.nw-14)} 152Q100 180 ${r1(100+g.nw+14)} 152L${r1(100+g.nw+16)} 162Q100 188 ${r1(100-g.nw-16)} 162Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.sw*.56)} 236L${r1(100-g.sw*.5)} 188Q100 184 ${r1(100+g.sw*.5)} 188L${r1(100+g.sw*.56)} 236Z" fill="${c}" ${SL(1.5)}/><path d="M${r1(100-g.sw*.5)} 188Q100 196 ${r1(100+g.sw*.5)} 188" stroke="${c2}" stroke-width="3" fill="none"/><path d="M92 196L108 204L92 212L108 220L92 228" stroke="${c2}" stroke-width="1.8" fill="none"/>`, outer:`<path d="M${r1(100-g.sw*.9)} 180Q${r1(100-g.sw*.98)} 168 ${r1(100-g.sw*.7)} 164Q${r1(100-g.sw*.5)} 170 ${r1(100-g.sw*.5)} 184Z M${r1(100+g.sw*.9)} 180Q${r1(100+g.sw*.98)} 168 ${r1(100+g.sw*.7)} 164Q${r1(100+g.sw*.5)} 170 ${r1(100+g.sw*.5)} 184Z" fill="#F5F5F7" ${SL()}/>`})},
    {n:'Sakko', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-6)} 150L100 206L${r1(100+g.nw+6)} 150Z" fill="${c2}" ${SL()}/><path d="M${r1(100-g.nw-6)} 150Q100 160 ${r1(100+g.nw+6)} 150Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.nw-6)} 150L${r1(100-g.nw-14)} 176L100 222L${r1(100+g.nw+14)} 176L${r1(100+g.nw+6)} 150" fill="none" ${SL(1.6)}/>`,
        outer:`<path d="M${r1(100-g.nw-4)} 148L${r1(100-g.nw-17)} 164L${r1(100-g.nw*.2)} 190L${r1(100-g.nw*.1)} 166Z M${r1(100+g.nw+4)} 148L${r1(100+g.nw+17)} 164L${r1(100+g.nw*.2)} 190L${r1(100+g.nw*.1)} 166Z" fill="${shade(c,.12)}" ${SL()}/>`})},
    {n:'Piratenmantel', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-8)} 150L100 192L${r1(100+g.nw+8)} 150Z" fill="${c2}" ${SL()}/><path d="M${r1(100-g.nw-4)} 150Q100 ${r1(166+g.nw*.1)} ${r1(100+g.nw+4)} 150Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.bw)} 216H${r1(100+g.bw)}" stroke="${INK}" stroke-width="7"/><rect x="94" y="211.5" width="12" height="9" rx="1.5" fill="#F2B01E" ${SL(1)}/><g fill="#F2B01E">${[168,180,192].map(y=>`<circle cx="${r1(100-g.sw*.42)}" cy="${y}" r="1.8"/><circle cx="${r1(100+g.sw*.42)}" cy="${y}" r="1.8"/>`).join('')}</g>`,
      outer:`<path d="M${r1(100-g.nw-4)} 148L${r1(100-g.nw-19)} 168L${r1(100-g.nw*.1)} 192L${r1(100-g.nw*.15)} 166Z M${r1(100+g.nw+4)} 148L${r1(100+g.nw+19)} 168L${r1(100+g.nw*.1)} 192L${r1(100+g.nw*.15)} 166Z" fill="${shade(c,-.12)}" ${SL()}/>`})},
    {n:'Rüstung', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-8)} 150Q100 ${r1(168+g.nw*.1)} ${r1(100+g.nw+8)} 150Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.sw*.62)} 176Q100 188 ${r1(100+g.sw*.62)} 176M100 184V236M${r1(100-g.sw*.55)} 206H${r1(100+g.sw*.55)}" fill="none" stroke="${shade(c,-.3)}" stroke-width="2"/><g fill="${c2}" stroke="${shade(c,-.45)}" stroke-width=".6">${[[-.4,176],[.4,176],[-.52,206],[.52,206]].map(p=>`<circle cx="${r1(100+p[0]*g.sw)}" cy="${p[1]}" r="2.2"/>`).join('')}</g>`,
      outer:[-1,1].map(q=>`<ellipse cx="${r1(100+q*g.sw*.8)}" cy="174" rx="${r1(15)}" ry="10" transform="rotate(${q*-14} ${r1(100+q*g.sw*.8)} 174)" fill="${shade(c,.12)}" ${SL()}/>`).join('')})},
    {n:'Königsmantel', f:(g,c,c2,sk)=>{ let sp=''; [[-.7,178],[-.2,184],[.3,181],[.78,177],[-.45,170],[.55,170],[0,174]].forEach(p=>{ sp+=`<ellipse cx="${r1(100+p[0]*(g.nw+14))}" cy="${p[1]}" rx="1.7" ry="2.6" fill="${INK}"/>`; });
      return {inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-6)} 150Q100 ${r1(166+g.nw*.1)} ${r1(100+g.nw+6)} 150Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.nw-18)} 150Q100 ${r1(186)} ${r1(100+g.nw+18)} 150L${r1(100+g.nw+26)} 168Q100 ${r1(204)} ${r1(100-g.nw-26)} 168Z" fill="${c2}" ${SL()}/>${sp}<path d="M${r1(100-g.sw*.5)} 236V204M${r1(100+g.sw*.5)} 236V204" stroke="${c2}" stroke-width="6"/>`}; }},
    {n:'Raumanzug', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c}"/><rect x="${r1(100-g.sw*.34)}" y="176" width="${r1(g.sw*.68)}" height="24" rx="4" fill="${shade(c,-.1)}" ${SL(1)}/><g>${[[-.2,'#E8590C'],[0,'#2E86DE'],[.2,'#F2C230']].map(p=>`<circle cx="${r1(100+p[0]*g.sw)}" cy="188" r="3" fill="${p[1]}" ${SL(.8)}/>`).join('')}</g><path d="M${r1(100-g.bw)} 214H${r1(100+g.bw)}" stroke="${c2}" stroke-width="6"/><rect x="${r1(100+g.sw*.18)}" y="204" width="14" height="6" rx="1.5" fill="${c2}" ${SL(.8)}/>`,
      outer:`<ellipse cx="100" cy="153" rx="${r1(g.nw+13)}" ry="7" fill="${c2}" ${SL()}/>`})},
    {n:'Cowboy-Weste', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c2}"/><path d="M${r1(100-g.nw-6)} 150L${r1(100-g.nw*.15)} 190L${r1(100+g.nw*.15)} 190L${r1(100+g.nw+6)} 150Q100 ${r1(166+g.nw*.1)} ${r1(100-g.nw-6)} 150Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.sw*.66)} 236L${r1(100-g.sw*.6)} 182Q${r1(100-g.sw*.5)} 160 ${r1(100-g.nw-6)} 150L${r1(100-g.nw*.15)} 190L${r1(100-g.nw*.15)} 236Z M${r1(100+g.sw*.66)} 236L${r1(100+g.sw*.6)} 182Q${r1(100+g.sw*.5)} 160 ${r1(100+g.nw+6)} 150L${r1(100+g.nw*.15)} 190L${r1(100+g.nw*.15)} 236Z" fill="${c}" ${SL(1.6)}/><g fill="${shade(c,.2)}">${[200,214,228].map(y=>`<circle cx="${r1(100-g.nw*.15)}" cy="${y}" r="1.6"/>`).join('')}</g>`})},
    {n:'Zerrissen (Zombie)', f:(g,c,c2,sk)=>{ const tears=[[-.55,176,10],[.2,190,12],[-.1,214,9],[.6,206,10]].map(p=>`<path d="M${r1(100+p[0]*g.sw)} ${p[1]}l${p[2]} 3l-4 5l5 4l-8 4l-4 -6l-4 3z" fill="${shade(sk,-.12)}"/>`).join('');
      return {inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-6)} 150Q100 ${r1(168+g.nw*.1)} ${r1(100+g.nw+6)} 150Z" fill="${sk}" ${SL()}/>${tears}<path d="M${r1(100-g.bw)} 232l8 -6l8 6l8 -6l8 6l8 -6l8 6l8 -6l8 6l8 -6l8 6l8 -6l8 6l8 -6l8 6l8 -6l8 6l8 -6l8 6" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".5"/>`}; }},
    {n:'Fußballtrikot', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-8)} 150L100 168L${r1(100+g.nw+8)} 150Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.nw-8)} 150L100 168L${r1(100+g.nw+8)} 150" fill="none" stroke="${c2}" stroke-width="3.2" stroke-linejoin="round"/><path d="M${r1(100-g.bw+4)} 226L${r1(100-g.sw*.8)} 176M${r1(100+g.bw-4)} 226L${r1(100+g.sw*.8)} 176" stroke="${c2}" stroke-width="3.4" stroke-linecap="round"/>`})},
    {n:'Feuerwehrjacke', f:(g,c,c2,sk)=>({inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-8)} 151Q100 ${r1(170+g.nw*.1)} ${r1(100+g.nw+8)} 151Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.nw-8)} 151Q100 ${r1(170+g.nw*.1)} ${r1(100+g.nw+8)} 151" fill="none" stroke="${shade(c,-.25)}" stroke-width="5"/><rect x="0" y="198" width="200" height="4.6" fill="${c2}"/><rect x="0" y="210" width="200" height="4.6" fill="${c2}"/><path d="M100 172V236" stroke="${shade(c,-.3)}" stroke-width="1.4" stroke-dasharray="2 2"/>`})},
    {n:'Kochjacke', f:(g,c,c2,sk)=>{ let b=''; [174,188,202,216].forEach(y=>{ b+=`<circle cx="${r1(100-8)}" cy="${y}" r="1.7" fill="${shade(c,-.3)}"/><circle cx="${r1(100+8)}" cy="${y}" r="1.7" fill="${shade(c,-.3)}"/>`; });
      return {inner:`<path d="${g.torsoD}" fill="${c}"/><path d="M${r1(100-g.nw-6)} 150Q100 ${r1(166+g.nw*.1)} ${r1(100+g.nw+6)} 150Z" fill="${sk}" ${SL()}/><path d="M${r1(100-g.nw-4)} 150L100 ${r1(176)}L${r1(100+g.nw+4)} 150Q100 ${r1(160)} ${r1(100-g.nw-4)} 150Z" fill="${c2}" ${SL()}/><path d="M${r1(100-12)} 172L${r1(100-12)} 236M${r1(100+12)} 172L${r1(100+12)} 236" stroke="${shade(c,-.2)}" stroke-width="1.4" fill="none"/>${b}`}; }}
  ];

  // ---------- Aufdruck auf der Kleidung (c = Schriftfarbe, c2 = Rand) ----------
  const prTxt = (t,x,y,sz,c,c2)=>`<text x="${r1(x)}" y="${r1(y)}" text-anchor="middle" font-family="'Arial Black','Impact','Helvetica Neue',Arial,sans-serif" font-weight="900" font-size="${sz}" fill="${c}" stroke="${c2}" stroke-width="${r1(sz*.09)}" stroke-linejoin="round" paint-order="stroke">${t}</text>`;
  const PRINTS = [
    {n:'Kein Aufdruck'},
    {n:'RB groß',        f:(g,c,c2)=>prTxt('RB',100,196,30,c,c2)},
    {n:'63 groß',        f:(g,c,c2)=>prTxt('63',100,197,34,c,c2)},
    {n:'RB 63',          f:(g,c,c2)=>prTxt('RB',100,187,22,c,c2)+prTxt('63',100,210,22,c,c2)},
    {n:'RB 63 nebeneinander', f:(g,c,c2)=>prTxt('RB 63',100,194,23,c,c2)},
    {n:'RB klein links', f:(g,c,c2)=>prTxt('RB',100-g.sw*.38,178,13,c,c2)},
    {n:'63 klein links', f:(g,c,c2)=>prTxt('63',100-g.sw*.38,178,14,c,c2)},
    {n:'RB 63 klein',    f:(g,c,c2)=>prTxt('RB 63',100-g.sw*.34,178,11,c,c2)},
    {n:'Sheriffstern', f:(g,c,c2)=>{ const cx=100-g.sw*.34, cy=188, pts=[]; for(let i=0;i<10;i++){ const r=i%2?4.4:10, a=-Math.PI/2+i*Math.PI/5; pts.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]); } return `<path d="${poly(pts)}Z" fill="${c}" stroke="${c2}" stroke-width="1.2" stroke-linejoin="round"/>`; }},
    {n:'Totenkopf', f:(g,c,c2)=>`<g><path d="M91 218L109 232M109 218L91 232" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/><path d="M100 187c-8 0-12 5-12 11 0 4 2 6 4 8v5h16v-5c2-2 4-4 4-8 0-6-4-11-12-11z" fill="${c}" stroke="${c2}" stroke-width="1.1"/><circle cx="95.6" cy="198" r="2.8" fill="${c2}"/><circle cx="104.4" cy="198" r="2.8" fill="${c2}"/><path d="M100 202l-1.6 3h3.2z" fill="${c2}"/></g>`}
  ];

  // ---------- Schmuck (Hals / Ohr) ----------
  const chain = (g,w,c,drop)=>`<path d="M${r1(100-g.nw-3)} 151Q100 ${r1(drop+g.nw*.2)} ${r1(100+g.nw+3)} 151" fill="none" stroke="${INK}" stroke-width="${w+1.4}" stroke-linecap="round"/><path d="M${r1(100-g.nw-3)} 151Q100 ${r1(drop+g.nw*.2)} ${r1(100+g.nw+3)} 151" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const JEWELS = [
    {n:'Keiner'},
    {n:'Kette dünn', body:1, f:(g,c)=>chain(g,1.3,c,190)},
    {n:'Kette mit Kreuz', body:1, f:(g,c,c2)=>chain(g,1.3,c,190)+`<path d="M100 ${r1(176+g.nw*.1)}V${r1(192+g.nw*.1)}M${r1(96)} ${r1(181+g.nw*.1)}H${r1(104)}" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path d="M100 ${r1(176+g.nw*.1)}V${r1(192+g.nw*.1)}M${r1(96)} ${r1(181+g.nw*.1)}H${r1(104)}" stroke="${c2}" stroke-width="2.2" stroke-linecap="round"/>`},
    {n:'Dicke Kette', body:1, f:(g,c,c2)=>chain(g,3.6,c,186)},
    {n:'Creolen', f:(g,c)=>[-1,1].map(s=>`<circle cx="${r1(100+s*(g.hwAt(g.earY)+1))}" cy="${r1(g.earY+11)}" r="6" fill="none" stroke="${INK}" stroke-width="3.6"/><circle cx="${r1(100+s*(g.hwAt(g.earY)+1))}" cy="${r1(g.earY+11)}" r="6" fill="none" stroke="${c}" stroke-width="1.8"/>`).join('')},
    {n:'Ohrstecker', f:(g,c)=>[-1,1].map(s=>`<circle cx="${r1(100+s*(g.hwAt(g.earY)+.5))}" cy="${r1(g.earY+8)}" r="2.6" fill="${c}" ${OL(1)}/>`).join('')},
    {n:'Schal', body:1, f:(g,c,c2)=>`<path d="M${r1(100-g.nw-12)} 146Q100 ${r1(178+g.nw*.1)} ${r1(100+g.nw+12)} 146L${r1(100+g.nw+16)} 164Q100 194 ${r1(100-g.nw-16)} 164Z" fill="${c}" ${OL()}/><path d="M${r1(100+g.nw*.2)} 176L${r1(100+g.nw*.2+20)} 172L${r1(100+g.nw*.2+26)} 222L${r1(100+g.nw*.2+6)} 226Z" fill="${c2}" ${OL()}/>`}
  ];

  // ---------- Zubehör ----------
  const EXTRAS = [
    {n:'Keines'},
    {n:'Umhängetasche', body:1, f:(g,c,c2)=>`<path d="M${r1(100-g.nw-10)} 152L${r1(100+g.bw-12)} 236H${r1(100+g.bw+2)}L${r1(100-g.nw+4)} 150Z" fill="${c}" ${OL(1.4)}/><rect x="${r1(100+g.sw*.32)}" y="206" width="9" height="6" rx="1" fill="${c2}" ${OL(1)} transform="rotate(-18 ${r1(100+g.sw*.32+4)} 209)"/>`},
    {n:'Joint', col3:'Papier', f:(g,c,c2,c3)=>`<g transform="rotate(-18 ${r1(100+g.mw)} ${r1(g.mouthY+1)})"><rect x="${r1(100+g.mw-4)}" y="${r1(g.mouthY-2)}" width="30" height="4.6" rx="2.2" fill="${c3||'#F5F5F7'}" ${OL(1.1)}/><rect x="${r1(100+g.mw+24)}" y="${r1(g.mouthY-2.2)}" width="6.6" height="5" rx="2" fill="${c2}" ${OL(1)}/><rect x="${r1(100+g.mw-4)}" y="${r1(g.mouthY-2)}" width="6" height="4.6" rx="1.4" fill="${c}" ${OL(1)}/></g>`},
    {n:'Zigarette', col3:'Papier', f:(g,c,c2,c3)=>`<g transform="rotate(-12 ${r1(100+g.mw)} ${r1(g.mouthY+1)})"><rect x="${r1(100+g.mw-4)}" y="${r1(g.mouthY-1.6)}" width="22" height="3.4" rx="1.2" fill="${c3||'#F5F5F7'}" ${OL(1.1)}/><rect x="${r1(100+g.mw-4)}" y="${r1(g.mouthY-1.6)}" width="6" height="3.4" rx="1" fill="${c}" ${OL(1)}/><rect x="${r1(100+g.mw+16)}" y="${r1(g.mouthY-1.6)}" width="2.8" height="3.4" fill="${c2}"/></g>`},
    {n:'Nasenring', f:(g,c)=>`<circle cx="${r1(100+g.nw*.5+3)}" cy="${r1(g.noseY+3)}" r="3" fill="none" stroke="${INK}" stroke-width="3"/><circle cx="${r1(100+g.nw*.5+3)}" cy="${r1(g.noseY+3)}" r="3" fill="none" stroke="${c}" stroke-width="1.4"/>`},
    {n:'Kopfhörer am Hals', body:1, f:(g,c,c2)=>`<path d="M${r1(100-g.nw-14)} 150Q${r1(100-g.nw-18)} 188 100 190Q${r1(100+g.nw+18)} 188 ${r1(100+g.nw+14)} 150" stroke="${INK}" stroke-width="7.4" fill="none" stroke-linecap="round"/><path d="M${r1(100-g.nw-14)} 150Q${r1(100-g.nw-18)} 188 100 190Q${r1(100+g.nw+18)} 188 ${r1(100+g.nw+14)} 150" stroke="${c}" stroke-width="4.4" fill="none" stroke-linecap="round"/><rect x="${r1(100-g.nw-24)}" y="146" width="12" height="24" rx="5" fill="${c2}" ${OL(1.4)}/><rect x="${r1(100+g.nw+12)}" y="146" width="12" height="24" rx="5" fill="${c2}" ${OL(1.4)}/>`}
  ];

  const PARTS = {face:FACES, body:BODIES, hair:HAIRS, beard:BEARDS, brows:BROWS, eyes:EYES, nose:NOSES, mouth:MOUTHS, marks:MARKS, glasses:GLASSES, hat:HATS, outfit:OUTFITS, print:PRINTS, jewel:JEWELS, extra:EXTRAS};

  // Kategorien für den Editor. sliders: Regler, auto: Farbe 'wie Haare' möglich, noColor: keine Farbwahl
  const SLD = (k,label,min,max,step,def)=>({k,label,min,max,step,def});
  const CATEGORIES = [
    {k:'face',   label:'Gesicht',     col1:'Hautfarbe',   pal:SKIN,  vb:'30 30 140 130', sliders:[SLD('w','Gesichtsbreite',.85,1.25,.05,1),SLD('h','Gesichtslänge',.92,1.1,.02,1),SLD('j','Kinn / Kiefer',-1,1,.05,0),SLD('ear','Ohrengröße',-1,1,.05,0)]},
    {k:'body',   label:'Körperbau',   vb:'0 126 200 106', noColor:true, sliders:[SLD('w','Schulterbreite',-1,1,.05,0)]},
    {k:'hair',   label:'Haare',       col1:'Haarfarbe',   pal:HAIR,  vb:'16 10 168 150', sliders:[SLD('vol','Volumen',-1,1,.05,0),SLD('bangs','Pony-Länge',-1,1,.05,0)]},
    {k:'beard',  label:'Bart',        col1:'Bartfarbe',   pal:HAIR,  vb:'46 88 108 66', auto:'Wie Haare', sliders:[SLD('size','Breite',-1,1,.05,0),SLD('len','Länge',-1,1,.05,0),SLD('dy','Höhe',-1,1,.05,0),SLD('dens','Dichte',0,1,.05,1)]},
    {k:'brows',  label:'Brauen',      col1:'Brauenfarbe', pal:HAIR,  vb:'50 66 100 36', auto:'Wie Haare', sliders:[SLD('dy','Höhe',-1,1,.05,0),SLD('tilt','Neigung',-1,1,.05,0)]},
    {k:'eyes',   label:'Augen',       col1:'Augenfarbe',  pal:IRIS,  vb:'50 76 100 42', sliders:[SLD('size','Größe',-1,1,.05,0),SLD('sep','Abstand',-1,1,.05,0),SLD('dy','Höhe',-1,1,.05,0),SLD('red','Rötung',0,1,.05,0)]},
    {k:'nose',   label:'Nase',        vb:'66 86 68 44', noColor:true, sliders:[SLD('size','Größe',-1,1,.05,0),SLD('dy','Höhe',-1,1,.05,0)]},
    {k:'mouth',  label:'Mund',        col1:'Lippenfarbe', pal:LIPS,  vb:'62 102 76 36', sliders:[SLD('size','Größe',-1,1,.05,0),SLD('dy','Höhe',-1,1,.05,0)]},
    {k:'marks',  label:'Merkmale',    col1:'Farbe', col2:'Zweitfarbe', pal:BLUSH.concat(['#4A3020','#8D5A3B','#F5C6A5','#C9CCD1']), vb:'44 66 112 72', sliders:[SLD('size','Größe',-1,1,.05,0),SLD('dy','Höhe',-1,1,.05,0)]},
    {k:'glasses',label:'Brille',      col1:'Rahmen', col2:'Gläser', pal:CLOTH, vb:'36 74 128 46', sliders:[SLD('size','Größe',-1,1,.05,0),SLD('dy','Höhe',-1,1,.05,0),SLD('tilt','Neigung',-1,1,.05,0)]},
    {k:'hat',    label:'Kopfbedeckung', col1:'Hauptfarbe', col2:'Zweitfarbe', pal:CLOTH, vb:'16 4 168 118', sliders:[SLD('size','Größe',-1,1,.05,0),SLD('dy','Höhe',-1,1,.05,0),SLD('tilt','Neigung',-1,1,.05,0)]},
    {k:'outfit', label:'Kleidung',    col1:'Hauptfarbe', col2:'Zweitfarbe', pal:CLOTH, vb:'6 130 188 104', sliders:[SLD('size','Größe',-1,1,.05,0),SLD('dy','Höhe',-1,1,.05,0)]},
    {k:'print',  label:'Aufdruck',    col1:'Schriftfarbe', col2:'Randfarbe', pal:CLOTH, vb:'6 130 188 104', sliders:[SLD('size','Größe',-1,1,.05,0),SLD('dy','Höhe',-1,1,.05,0)]},
    {k:'jewel',  label:'Schmuck',     col1:'Hauptfarbe', col2:'Zweitfarbe', pal:METAL.concat(CLOTH), vb:'36 112 128 86', sliders:[SLD('size','Größe',-1,1,.05,0),SLD('dy','Höhe',-1,1,.05,0)]},
    {k:'extra',  label:'Zubehör',     col1:'Hauptfarbe', col2:'Zweitfarbe', pal:CLOTH, vb:'16 90 168 140', sliders:[SLD('size','Größe',-1,1,.05,0),SLD('dy','Höhe',-1,1,.05,0),SLD('tilt','Neigung',-1,1,.05,0)]}
  ];
  function defaultConfig(){
    const d = {v:2,
      face:{s:0,c:SKIN[1]}, body:{s:1}, hair:{s:2,c:HAIR[3]}, beard:{s:0,c:''}, brows:{s:0,c:''}, eyes:{s:8,c:IRIS[4]},
      nose:{s:1}, mouth:{s:0,c:LIPS[0]}, marks:{s:0,c:BLUSH[0],c2:'#F5C6A5'},
      glasses:{s:0,c:'#1D1D1F',c2:'#8FB8E0'}, hat:{s:0,c:'#1D1D1F',c2:'#F5F5F7'},
      outfit:{s:0,c:'#1D1D1F',c2:'#F5F5F7'}, print:{s:0,c:'#F5F5F7',c2:'#1D1D1F'}, jewel:{s:0,c:'#C9CCD1',c2:'#F2B01E'}, extra:{s:0,c:'#1D1D1F',c2:'#E8590C',c3:'#F5F5F7'}
    };
    CATEGORIES.forEach(cat=>(cat.sliders||[]).forEach(sl=>{ d[cat.k][sl.k]=sl.def; }));
    return d;
  }
  const clampN = (v,a,b,d)=>(typeof v==='number' && isFinite(v)) ? Math.min(b,Math.max(a,v)) : d;
  function normalize(cfg){
    const d = defaultConfig(); if(!cfg || cfg.v!==2) return d;
    CATEGORIES.forEach(cat=>{
      const src = cfg[cat.k] || {}, dst = d[cat.k], n = PARTS[cat.k].length;
      if(Number.isInteger(src.s) && src.s>=0 && src.s<n) dst.s = src.s;
      if(typeof src.c==='string') dst.c = src.c;
      if(typeof src.c2==='string') dst.c2 = src.c2;
      if(typeof src.c3==='string') dst.c3 = src.c3;
      (cat.sliders||[]).forEach(sl=>{ dst[sl.k] = clampN(src[sl.k], sl.min, sl.max, sl.def); });
    });
    return d;
  }  const pick = a=>a[Math.floor(Math.random()*a.length)];
  const rnd = n=>Math.floor(Math.random()*n);
  function randomConfig(){
    const c = defaultConfig();
    c.face = {s:rnd(FACES.length), c:pick(SKIN.slice(0,7)), w:+(.9+Math.random()*.3).toFixed(2), h:+(.94+Math.random()*.14).toFixed(2)};
    c.body = {s:rnd(BODIES.length)};
    c.hair = {s:rnd(HAIRS.length), c:pick(HAIR.slice(0,9))};
    c.beard = {s:Math.random()<.55?0:rnd(BEARDS.length), c:''};
    c.brows = {s:rnd(BROWS.length), c:''};
    c.eyes = {s:rnd(EYES.length), c:pick(IRIS)};
    c.nose = {s:rnd(NOSES.length)};
    c.mouth = {s:rnd(MOUTHS.length), c:pick(LIPS)};
    c.marks = {s:Math.random()<.5?0:rnd(MARKS.length), c:pick(BLUSH), c2:'#F5C6A5'};
    ['glasses','hat','outfit','jewel','extra'].forEach(k=>{ c[k] = {s:rnd(PARTS[k].length), c:pick(CLOTH), c2:pick(CLOTH)}; });
    c.jewel.c = pick(METAL);
    if(Math.random()<.5) c.hat.s = 0;
    if(Math.random()<.5) c.jewel.s = 0;
    if(Math.random()<.6) c.glasses.s = 0;
    if(Math.random()<.7) c.extra.s = 0;
    return normalize(c);
  }

  /* Liefert ein komplettes <svg>. opts: {viewBox, only:{k:styleIndex}, cls} */
  function render(cfg, opts){
    cfg = normalize(cfg); opts = opts || {};
    if(opts.only){ cfg = JSON.parse(JSON.stringify(cfg)); Object.keys(opts.only).forEach(k=>{ cfg[k].s = opts.only[k]; }); }
    const g = geom(cfg), sk = cfg.face.c, u = g.u;
    const hair=HAIRS[cfg.hair.s], beard=BEARDS[cfg.beard.s], hat=HATS[cfg.hat.s], outfit=OUTFITS[cfg.outfit.s];
    const hc = cfg.hair.c, bc = cfg.beard.c||hc, brc = cfg.brows.c||shade(hc,-.24);
    const o = cfg.outfit, h = cfg.hat, j = cfg.jewel, x = cfg.extra, gl = cfg.glasses, m = cfg.marks;
    const ot = outfit.f(g, o.c, o.c2, shade(sk,-.1)) || {};
    const sub = t=>t.replace(/var\(--sk\)/g, sk);
    const TF = (t,px,py,v)=>{ if(!t) return t; const k=1+.25*(v.size||0), dy=8*(v.dy||0), r=12*(v.tilt||0); if(k===1&&!dy&&!r) return t; return `<g transform="translate(0 ${r1(dy)}) rotate(${r1(r)} ${r1(px)} ${r1(py)}) translate(${r1(px)} ${r1(py)}) scale(${k}) translate(${r1(-px)} ${r1(-py)})">${t}</g>`; };
    let s = '';
    // Kontur um die Silhouette einer Ebene (Filter: Alpha vergrößern, in Tinte einfärben, hinter die Ebene legen)
    const fid = g.id('ol');
    if(TOON) g.defs += `<filter id="${fid}" filterUnits="userSpaceOnUse" x="-30" y="-30" width="260" height="320"><feMorphology in="SourceAlpha" operator="dilate" radius="${OLW}" result="d"/><feFlood flood-color="${INK}"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    let mk = 0;
    const layer = ()=>{ if(TOON && s.length>mk) s = s.slice(0,mk)+`<g filter="url(#${fid})">${s.slice(mk)}</g>`; mk = s.length; };
    // hinter dem Kopf
    if(hair.back) s += hair.back(g,hc);
    const hk=1+.18*(h.size||0), hdy=8*(h.dy||0), hrot=12*(h.tilt||0), hpy=g.top+g.ht*.35;
    const hatT = t=>(t && (hk!==1||hdy||hrot)) ? `<g transform="translate(0 ${r1(hdy)}) rotate(${r1(hrot)} 100 ${r1(hpy)}) translate(100 ${r1(hpy)}) scale(${r1(hk*100)/100}) translate(-100 ${r1(-hpy)})">${t}</g>` : t;
    if(hat.back) s += hatT(hat.back(g,h.c,h.c2));
    layer();
    // Körper (um dy verschoben), weiches Licht von links oben
    const cs = lin(g,[[0,'#fff',.12],[.5,'#fff',0],[1,'#000',.26]],0,0,1,0), cv = lin(g,[[0,'#000',.3],[.3,'#000',0],[1,'#000',.1]],0,0,0,1);
    const tcp = clip(g,g.torsoD);
    s += `<g transform="translate(0 ${r1(g.dy+6*(o.dy||0))}) translate(100 152) scale(${1+.2*(o.size||0)}) translate(-100 -152)">`;
    if(ot.back) s += ot.back;
    const neckD=`M${r1(100-g.nw)} ${r1(g.chin-18-g.dy)}L${r1(100-g.nw-2)} 166L${r1(100+g.nw+2)} 166L${r1(100+g.nw)} ${r1(g.chin-18-g.dy)}Z`;
    const ng = lin(g,[[0,shade(sk,-.12)],[1,shade(sk,-.24)]],0,0,0,1), ncp = clip(g,neckD);
    s += `<path d="${neckD}" fill="url(#${ng})"/>`;
    s += `<g clip-path="url(#${tcp})">${ot.inner||''}<rect x="0" y="140" width="200" height="110" fill="url(#${cs})"/><rect x="0" y="140" width="200" height="110" fill="url(#${cv})"/>`
       + [-1,1].map(q=>`<path d="M${r1(100+q*g.sw*.68)} 172Q${r1(100+q*g.sw*.6)} 200 ${r1(100+q*g.sw*.5)} 232" fill="none" stroke="#000" stroke-opacity=".1" stroke-width="3.6" stroke-linecap="round"/>`).join('')
       + (PRINTS[cfg.print.s].f ? TF(PRINTS[cfg.print.s].f(g,cfg.print.c,cfg.print.c2),100,200,cfg.print) : '')
       + `</g>`;
    if(ot.outer) s += ot.outer;
    if(JEWELS[j.s].body && JEWELS[j.s].f) s += TF(JEWELS[j.s].f(g,j.c,j.c2),100,156,j);
    if(EXTRAS[x.s].body && EXTRAS[x.s].f) s += TF(EXTRAS[x.s].f(g,x.c,x.c2,x.c3),100,190,x);
    s += `</g>`;
    layer();
    // Schatten des Kinns auf dem Hals
    const sh = rad(g,[[0,'#000',.34],[1,'#000',0]],100,g.chin+3,g.nw*1.3,true);
    s += `<ellipse cx="100" cy="${r1(g.chin+5)}" rx="${r1(g.nw*1.15)}" ry="11" fill="url(#${sh})"/>`;
    // Ohren (weich)
    (hair.noEars?[]:[-1,1]).forEach(sd=>{ const u=g.u*g.earK, ex=100+sd*(g.hwAt(g.earY)-.5), y=g.earY, q=d=>r1(ex+sd*d);
      s += `<path d="M${q(0)} ${r1(y-2.1*u)}C${q(1.6*u)} ${r1(y-2.8*u)} ${q(2.2*u)} ${r1(y-.7*u)} ${q(1.8*u)} ${r1(y+.9*u)}C${q(1.4*u)} ${r1(y+2.3*u)} ${q(.7*u)} ${r1(y+3*u)} ${q(.2*u)} ${r1(y+2.5*u)}Z" fill="${shade(sk,-.04)}"/><path d="M${q(.45*u)} ${r1(y-1.1*u)}C${q(1.35*u)} ${r1(y-1.4*u)} ${q(1.5*u)} ${r1(y)} ${q(1.1*u)} ${r1(y+.9*u)}" fill="none" stroke="${shade(sk,-.4)}" stroke-width="${r1(.2*u)}" stroke-opacity=".5" stroke-linecap="round"/><ellipse cx="${q(.7*u)}" cy="${r1(y+.2*u)}" rx="${r1(.4*u)}" ry="${r1(.7*u)}" fill="${shade(sk,-.35)}" opacity=".3"/>`; });
    // Kopf mit Licht und Schatten
    const sg = lin(g,[[0,shade(sk,.1)],[.5,sk],[1,shade(sk,-.1)]],.2,0,.8,1);
    const sideG = lin(g,[[0,'#fff',.1],[.45,'#000',0],[1,'#3A1A10',.2]],0,0,1,0);
    const jawG = lin(g,[[0,'#000',0],[1,'#3A1A10',.16]],0,g.chin-g.ht*.28,0,g.chin,true);
    const foreG = rad(g,[[0,'#fff',.2],[1,'#fff',0]],100,g.top+g.ht*.22,g.hw*.7,true);
    s += `<path d="${g.headD}" fill="url(#${sg})"/><g clip-path="url(#${g.headClip})"><rect x="0" y="0" width="200" height="240" fill="url(#${sideG})"/><rect x="0" y="0" width="200" height="240" fill="url(#${jawG})"/><ellipse cx="100" cy="${r1(g.top+g.ht*.22)}" rx="${r1(g.hw*.7)}" ry="${r1(g.ht*.14)}" fill="url(#${foreG})"/>`
       + `</g>`;
    layer();
    if(MARKS[m.s].f) s += TF(MARKS[m.s].f(g, m.c, m.c2),100,g.noseY,m);
    g.fid = fid; const bsx=1+.3*(cfg.beard.size||0), bsy=1+.5*(cfg.beard.len||0), bdy=g.u*1.2*(cfg.beard.dy||0), my0=g.mouthY;
    const bx = t=>(t && (bsx!==1||bsy!==1||bdy)) ? `<g transform="translate(100 ${r1(my0+bdy)}) scale(${bsx} ${bsy}) translate(-100 ${r1(-my0)})">${t}</g>` : t;
    const bop = .25+.75*(typeof cfg.beard.dens==="number" ? cfg.beard.dens : 1);
    const ob = (t,no)=>{ t=bx(t); if(TOON && !no && t) t=`<g filter="url(#${fid})">${t}</g>`; return (t && bop<.999) ? `<g opacity="${r1(bop*100)/100}">${t}</g>` : t; };
    if(beard.base) s += ob(sub(beard.base(g,bc)), beard.noOL);
    s += NOSES[cfg.nose.s].f(g);
    s += MOUTHS[cfg.mouth.s].f(g, cfg.mouth.c);
    if(beard.front) s += ob(beard.front(g,bc));
    s += sub(EYES[cfg.eyes.s].f(g, cfg.eyes.c));
    s += BROWS[cfg.brows.s].f(g, brc);
    mk = s.length;
    if(hair.over) s += hair.over(g,hc);
    if(hair.front) s += hair.front(g,hc);
    layer();
    if(GLASSES[gl.s].f) s += TF(GLASSES[gl.s].f(g, gl.c, gl.c2),100,g.eyeY,gl);
    if(!JEWELS[j.s].body && JEWELS[j.s].f) s += TF(JEWELS[j.s].f(g,j.c,j.c2),100,g.earY+8,j);
    if(!EXTRAS[x.s].body && EXTRAS[x.s].f) s += TF(EXTRAS[x.s].f(g,x.c,x.c2,x.c3),100,g.mouthY,x);
    mk = s.length;
    if(hat.front) s += hatT(hat.front(g,h.c,h.c2));
    layer();
    const vb = opts.viewBox || '0 0 200 232';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="${opts.cls||'rbchar'}" role="img" aria-label="Charakter"><defs>${g.defs}</defs>${s}</svg>`;
  }

  root.RBChar = {VERSION:'2.3.126', render, defaultConfig, randomConfig, normalize, CATEGORIES, PARTS, shade,
    styleName:(k,i)=>PARTS[k][i].n};
})(typeof window!=='undefined' ? window : this);
