// Core: world grid, machine simulation, power, objectives, rendering, input, UI.
(()=>{
const W=80,S=32,DIR=[[1,0],[0,1],[-1,0],[0,-1]],$=id=>document.getElementById(id),M=T.MACH,R=T.RES;
const fresh=()=>({mem:100,used:100,lvLine:0,obj:0,sp:0,skills:{},thr:1,stats:{},unl:{gen:1,line:1,asm:1,store:1,power:1}});
let st=T.state=fresh(),grid,ms,sat=1,supply=1,demand=0;
const cam={x:W*S/2,y:W*S/2,z:1},pl={x:W*S/2+64,y:W*S/2+64};
let tool=null,rot=0,sel=null,down=false,last=null,mp={x:0,y:0},keys={},vw=0,vh=0,tAcc=0,saveT=0,objT=0;
const cv=$('c'),cx=cv.getContext('2d'),G=T.game={};
const at=(x,y)=>x>=0&&y>=0&&x<W&&y<W?grid[y*W+x]:null;
const cap=G.cap=()=>256+ms.reduce((a,m)=>a+(M[m.t].cap?M[m.t].cap*4**m.l:0),0);
G.load=()=>demand/Math.max(supply,.01);
const deposit=G.deposit=b=>{if(st.used+b>cap())return false;st.used+=b;st.mem+=b;return true};
const spend=a=>{if(st.mem<a)return false;const f=(st.mem-a)/st.mem;st.mem-=a;st.used*=f;return true};
G.toast=s=>{const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(t.h);t.h=setTimeout(()=>t.classList.remove('show'),2200)};
function init(){grid=new Array(W*W).fill(null);ms=[];sel=null}
function fits(t,x,y){const d=M[t];if(x<0||y<0||x+d.w>W||y+d.h>W)return false;for(let j=0;j<d.h;j++)for(let i=0;i<d.w;i++)if(grid[(y+j)*W+x+i])return false;return true}
const anc=(k,x,y)=>[x-((M[k].w-1)>>1),y-((M[k].h-1)>>1)];
function place(t,x,y,r,free){const d=M[t];if(!d||!st.unl[t]||!fits(t,x,y))return;
 if(!free&&!spend(d.cost)){G.toast('Not enough memory: need '+T.fmt(d.cost));return}
 const m={t,x,y,r,k:0,hold:null,l:0,buf:0,prog:0,work:0,outq:0,q:[],st:'IDLE',fc:0,pc:0,ft:0,flow:0,pr:0};for(let j=0;j<d.h;j++)for(let i=0;i<d.w;i++)grid[(y+j)*W+x+i]=m;ms.push(m);return m}
function remove(m){const d=M[m.t];for(let j=0;j<d.h;j++)for(let i=0;i<d.w;i++)grid[(m.y+j)*W+m.x+i]=null;ms.splice(ms.indexOf(m),1);deposit(Math.floor(M[m.t].cost/2));if(sel==m)sel=null}
// ---- transport ----
const lspd=()=>3*(1+st.lvLine),SPACING=.4;
function acc(tg,r,src){
 if(tg.t=='line'){if(front(tg)===src)return false;return tg.q.length<6&&(!tg.q.length||tg.q.at(-1).t>=SPACING)}
 if(tg.t=='router')return !tg.hold;const d=M[tg.t];if(d.cap)return st.used+R[r].s<=cap();return r===d.inR&&tg.buf<d.inN*2}
function give(tg,p){const d=M[tg.t];
 if(tg.t=='line'){p.t=0;tg.q.push(p)}
 else if(tg.t=='router')tg.hold=p;
 else if(d.cap){st.used+=R[p.r].s*p.n;st.mem+=R[p.r].v*p.n;st.stats.stored=1}
 else tg.buf+=p.n}
function fpos(m){const d=M[m.t],r=m.r;return[r==0?m.x+d.w:r==2?m.x-1:m.x+(d.w>>1),r==1?m.y+d.h:r==3?m.y-1:m.y+(d.h>>1)]}
function front(m){const p=fpos(m);return at(p[0],p[1])}
function tickLine(m,dt){
 const sp=lspd();for(let i=0;i<m.q.length;i++){const p=m.q[i],lim=i?m.q[i-1].t-SPACING:1;p.t=Math.min(p.t+dt*sp,lim)}
 const p=m.q[0];if(p&&p.t>=1){const tg=front(m);if(tg&&acc(tg,p.r,m)){m.fc+=R[p.r].v*p.n;m.pc++;give(tg,m.q.shift())}}
 m.ft+=dt;if(m.ft>=1){m.flow=m.fc/m.ft;m.pr=m.pc/m.ft;m.fc=m.pc=m.ft=0}
 m.st=m.pr/(sp/SPACING)>.9?'NEAR CAPACITY':m.q.length?'FLOWING':'IDLE'}
function tickMachine(m,dt){const d=M[m.t];
 if(m.t=='router'){if(!m.hold){m.st='IDLE';return}for(let i=0;i<3;i++){const r=(m.r+3+(m.k+i)%3)%4,dd=DIR[r],tg=at(m.x+dd[0],m.y+dd[1]);if(tg&&acc(tg,m.hold.r,m)){give(tg,m.hold);m.hold=null;m.k=(m.k+i+1)%3;m.st='ACTIVE';return}}m.st='OUTPUT BLOCKED';return}
 if(d.cap){m.st=st.used/cap()>.97?'FULL':'ACTIVE';return}
 if(d.pw<0){m.st='GENERATING';return}
 if(sat<.02){m.st='NO POWER';return}
 if(m.outq){const tg=front(m);if(tg&&acc(tg,d.out,m)){give(tg,{r:d.out,n:m.outq,t:0});m.outq=0}else{m.st='OUTPUT BLOCKED';return}}
 if(m.work){const th=m.t=='gen'?st.thr:1;m.prog+=dt*sat*(1+m.l)*th/d.time;m.st=th?'PROCESSING':'THROTTLED';
  if(m.prog>=1){m.prog=0;m.work=0;m.outq=d.outN;st.stats[d.out]=(st.stats[d.out]||0)+d.outN}}
 else if(!d.inR||m.buf>=d.inN){m.buf-=d.inN||0;m.work=1}else m.st='NO INPUT'}
// ---- objectives ----
const has=t=>ms.some(m=>m.t==t),cnt=t=>ms.reduce((a,m)=>a+(m.t==t),0);
const OBJ=[
 ['Build a Code Generator and a Power Generator',()=>has('gen')&&has('power')],
 ['Route data into Storage with Data Lines',()=>st.stats.stored],
 ['Assemble your first Byte',()=>st.stats.byte>=1],
 ['Hold 1 KB in memory (upgrade or add Storage)',()=>st.mem>=8192,'comp','Compressor unlocked'],
 ['Compress data: make a Zip packet',()=>st.stats.zip>=1,'cond,router','Unlocked: scripting (if/else/throttle) and Router'],
 ['Run a program that uses "if" in the Terminal (T)',()=>T.script.running&&T.script.usesIf],
 ['Build 3 Code Generators',()=>cnt('gen')>=3],
 ['Lay 20 Data Lines',()=>cnt('line')>=20],
 ['Upgrade any machine to MK II',()=>ms.some(m=>m.t!='line'&&m.l>=1)],
 ['Upgrade your Data Lines to MK II',()=>st.lvLine>=1],
 ['Split a data flow with a Router',()=>has('router')],
 ['Assemble 100 Bytes',()=>st.stats.byte>=100,'gen2,asm2,vault','Unlocked: Cluster Generator, Parallel Assembler, Vault'],
 ['Build a Vault (3x3 storage)',()=>has('vault')],
 ['Hold 8 KB in memory',()=>st.mem>=65536,'refKB,solar','Unlocked: Kilobyte Refinery, Solar Array'],
 ['Build a Kilobyte Refinery (3x3)',()=>has('refKB')],
 ['Refine your first KB packet',()=>st.stats.kb>=1],
 ['Compress 50 Zip packets',()=>st.stats.zip>=50,'comp2','Unlocked: Deep Compressor'],
 ['Run a program that uses throttle',()=>T.script.running&&T.script.usesThr],
 ['Hold 64 KB in memory',()=>st.mem>=524288,'array','Unlocked: Data Array'],
 ['Build a Data Array (4x4 storage)',()=>has('array')],
 ['Refine 100 KB packets',()=>st.stats.kb>=100,'refMB','Unlocked: Megabyte Foundry'],
 ['Hold 1 MB in memory',()=>st.mem>=8388608,'fusion','Unlocked: Fusion Reactor'],
 ['Build a Fusion Reactor (4x4)',()=>has('fusion')],
 ['Supply 100 kW of power',()=>supply>=100],
 ['Build a Megabyte Foundry (4x4)',()=>has('refMB')],
 ['Forge your first MB packet',()=>st.stats.mb>=1,'dc,refGB','Unlocked: Data Center, Gigabyte Reactor'],
 ['Hold 16 MB in memory',()=>st.mem>=134217728],
 ['Build a Data Center (6x6)',()=>has('dc')],
 ['Build a Gigabyte Reactor (5x5)',()=>has('refGB')],
 ['Produce your first GB',()=>st.stats.gb>=1],
 ['Run 60 machines at once',()=>ms.length>=60]];
const BON=[3,11,13,15,18,20,21,23,25,29];
const SK=[
 {id:'comp',n:'Compression',c:1,r:[],unl:'comp',d:'Compressor: packs 10 Bytes into a Zip that takes less space.'},
 {id:'cond',n:'Logic',c:1,r:['comp'],unl:'cond',d:'Scripting: if / else / end / throttle.'},
 {id:'router',n:'Routing',c:1,r:[],unl:'router',d:'Router: splits a flow across three outputs.'},
 {id:'solar',n:'Solar Power',c:1,r:[],unl:'solar',d:'Solar Array (2x2): 8 kW.'},
 {id:'gen2',n:'Clustering',c:2,r:['router'],unl:'gen2',d:'Cluster Generator (2x2): 16 bits/s.'},
 {id:'asm2',n:'Parallel Assembly',c:2,r:['gen2'],unl:'asm2',d:'Parallel Assembler (2x2).'},
 {id:'vault',n:'Bulk Storage',c:2,r:['comp'],unl:'vault',d:'Vault (3x3): 4 KB.'},
 {id:'refKB',n:'Refining',c:3,r:['asm2','vault'],unl:'refKB',d:'Kilobyte Refinery (3x3).'},
 {id:'comp2',n:'Deep Compression',c:3,r:['refKB'],unl:'comp2',d:'Deep Compressor (3x3).'},
 {id:'array',n:'Data Arrays',c:3,r:['vault','refKB'],unl:'array',d:'Data Array (4x4): 128 KB.'},
 {id:'refMB',n:'Foundry',c:4,r:['array'],unl:'refMB',d:'Megabyte Foundry (4x4).'},
 {id:'fusion',n:'Fusion',c:4,r:['solar','array'],unl:'fusion',d:'Fusion Reactor (4x4): 60 kW.'},
 {id:'dc',n:'Data Centers',c:5,r:['array'],unl:'dc',d:'Data Center (6x6): 4 MB.'},
 {id:'refGB',n:'Gigabyte Reactor',c:6,r:['refMB','dc'],unl:'refGB',d:'Gigabyte Reactor (5x5).'}];
const sk=id=>SK.find(x=>x.id==id),dep=x=>x.r.length?1+Math.max(...x.r.map(i=>dep(sk(i)))):0;
const CODE='<code>produce 8 bits<br>if storage &gt; 80<br>&nbsp;&nbsp;throttle 30<br>else<br>&nbsp;&nbsp;throttle 100<br>end<br>wait 1<br>repeat</code>';
const HINTS=[
 'Pick Code Generator in the build bar (or press 1-6) and click a tile. Do the same for a Power Generator. Machines draw power, and the POWER readout turns orange when demand exceeds supply.',
 'Place a Storage (MEM) a few tiles from the generator. Turn the generator\'s arrow (the output side) with R, then pick Data Line and click-drag from that arrow to the storage. Lines turn automatically as you drag.',
 'Generator -> line -> Byte Assembler -> line -> Storage. The assembler needs 8 bits and power to make 1 Byte, and outputs from its arrow side.',
 'Memory (top left) is current / capacity. Select a Storage and press Upgrade, or build more Storage, then keep the factory running until you hold 1 KB.',
 'Open Skills (K) and buy Compression. Build Assembler -> line -> Compressor -> line -> Storage. The Compressor needs 10 Bytes per Zip.',
 'Buy the Logic skill (K), press T for the Terminal and enter:<br>'+CODE+'<br>Press RUN and leave it running.',
 'Place 3 Code Generators anywhere. Each draws 0.5 kW, so add another Power Generator if power runs short.',
 'Choose Data Line and hold the mouse button while dragging: every tile you cross becomes a line (1 bit each).',
 'Click any machine (not a line) to select it, then press Upgrade in the right-hand panel. Upgrades cost memory.',
 'Click any Data Line and press "Upgrade all lines" in the panel. It speeds up every line.',
 'Buy Routing (K). Put a Router in the middle of a line. It sends packets out its left, front and right sides in turn (R rotates "front"). Attach lines to two sides, for example one to Storage and one to an Assembler, to split the flow.',
 'Keep the pipeline running. Add generators and assemblers, or upgrade them, if it is slow. Click a line to find the bottleneck.',
 'Buy Bulk Storage (K). The Vault is 3x3, so clear a 3x3 area (the ghost turns red if it does not fit). Any line pointing at any edge tile of a big machine feeds it.',
 'Capacity is what limits you. Vaults and upgraded Storage raise it, and Zips store 10 Bytes in less space.',
 'Buy Refining (needs Parallel Assembly and Bulk Storage first). The 3x3 Refinery takes 32 Bytes and outputs a KB packet from the side its arrow faces.',
 'Send its output line to a Vault or an upgraded Storage, because a KB packet is too big for a basic Storage.',
 'Compressors need 10 Bytes each. Feed them a steady line of Bytes.',
 'While a program containing "throttle" is running this completes. You can reuse the Logic example:<br>'+CODE,
 'Hold 64 KB: add Vaults, compress data, and refine Bytes into KB packets.',
 'Buy Data Arrays (K). The Array is 4x4, so find a clear 4x4 space.',
 'Keep Bytes flowing into Refineries. Build several and upgrade them. Power may become a limit, so add generators.',
 'Hold 1 MB. Arrays and refined KB packets get you there.',
 'Buy Fusion (needs Solar Power and Data Arrays). The Fusion Reactor is 4x4 and supplies 60 kW.',
 'Combine Fusion Reactors, Solar Arrays and Power Generators until supply reaches 100 kW (see POWER in the HUD).',
 'Buy Foundry (needs Data Arrays). It is 4x4 and turns 16 KB packets into an MB packet. Feed it from Refineries.',
 'Keep KB packets flowing into the Foundry and send its output to an Array or Data Center, because an MB packet needs a lot of space.',
 'Hold 16 MB. Buy Data Centers (K) for huge capacity, and upgrade them.',
 'Buy Data Centers (K). It is 6x6, so clear a large area.',
 'Buy Gigabyte Reactor (needs Foundry and Data Centers). It is 5x5 and consumes MB packets.',
 'Feed the Reactor MB packets from Foundries and keep it powered.',
 'Keep building. Routers and scripts help manage a large factory.'];
const BASICS='<b>Data</b> starts as bits (8 bits = 1 Byte) and moves as packets along Data Lines. <b>Machines</b> output from the side their arrow faces (R rotates; select a machine and press R to turn it). A line pointing into any edge tile of a machine feeds it. <b>Power</b> is one shared grid, and everything slows when demand exceeds supply. <b>Storage</b> holds your memory, and machines that cannot deliver show OUTPUT BLOCKED. Click a machine or line for status, throughput and upgrades. <b>Skills (K)</b>: objectives award skill points, which you spend to unlock machines and scripting. <b>Terminal (T)</b>: write programs to automate the factory.';
function guide(){const g=$('guide'),o=OBJ[st.obj];g.dataset.o=st.obj;g.hidden=false;g.innerHTML='<div class="th">GUIDE<button id="xg">X</button></div><div class="gb"><h4>Current objective</h4><p>'+(o?o[0]+'</p><p>'+HINTS[st.obj]:'All done!')+'</p><h4>How things work</h4><p>'+BASICS+'</p></div>'}
function tree(){const t=$('tree'),cols=[];SK.forEach(x=>{const d=dep(x);(cols[d]=cols[d]||[]).push(x)});
 t.innerHTML='<div class="th">SKILL TREE <span>'+st.sp+' point'+(st.sp==1?'':'s')+'</span><button id="xt">X</button></div><div class="cols">'+cols.map(c=>'<div>'+c.map(x=>{const own=st.skills[x.id],ok=x.r.every(r=>st.skills[r]);return`<button class="sk ${own?'own':ok?'ok':'lock'}" data-id="${x.id}"><b>${x.n}</b> ${own?'✓':x.c+' SP'}<small>${x.d}</small>${!own&&x.r.length?'<em>needs '+x.r.map(r=>sk(r).n).join(', ')+'</em>':''}</button>`}).join('')+'</div>').join('')+'</div>';t.dataset.k=st.sp+Object.keys(st.skills).join()}
G.buy=id=>{const x=sk(id);if(!x||st.skills[id])return;const miss=x.r.filter(r=>!st.skills[r]);if(miss.length)return G.toast('Requires: '+miss.map(r=>sk(r).n).join(', '));if(st.sp<x.c)return G.toast('Need '+x.c+' skill points');st.sp-=x.c;st.skills[id]=1;x.unl.split(',').forEach(k=>st.unl[k]=1);menu();tree();G.toast('Unlocked: '+x.n)};
function checkObj(){const o=OBJ[st.obj];if(o&&o[1]()){const p=BON.includes(st.obj)?2:1;st.sp+=p;G.toast('Objective complete: '+o[0]+'  (+'+p+' skill point'+(p>1?'s':'')+')');st.obj++}}
// ---- update ----
function update(dt){
 const k=keys,vx=(k.d?1:0)-(k.a?1:0),vy=(k.s?1:0)-(k.w?1:0),n=Math.hypot(vx,vy)||1;
 pl.x=Math.min(W*S,Math.max(0,pl.x+vx/n*230*dt));pl.y=Math.min(W*S,Math.max(0,pl.y+vy/n*230*dt));
 cam.x+=(pl.x-cam.x)*Math.min(1,dt*6);cam.y+=(pl.y-cam.y)*Math.min(1,dt*6);
 supply=1;demand=0;for(const m of ms){const d=M[m.t];if(d.pw<0)supply-=d.pw*(1+m.l);else demand+=d.pw*(1+.5*m.l)}
 sat=demand?Math.min(1,supply/demand):1;
 T.script.tick(dt);
 for(const m of ms)m.t=='line'?tickLine(m,dt):tickMachine(m,dt);
 if((objT+=dt)>.5){objT=0;checkObj()}
 if((saveT+=dt)>30){saveT=0;T.save.save()}
 if((tAcc+=dt)>.2){tAcc=0;ui()}}
// ---- render ----
const SC={PROCESSING:'#39ff88',GENERATING:'#ff9a3c',ACTIVE:'#ffd23f',IDLE:'#556','NO INPUT':'#889','NO POWER':'#ff9a3c','OUTPUT BLOCKED':'#ff4d4d',FULL:'#ff4d4d',THROTTLED:'#889'};
function arrow(x,y,r,s,c){cx.save();cx.translate(x,y);cx.rotate(r*Math.PI/2);cx.fillStyle=c;cx.beginPath();cx.moveTo(s,0);cx.lineTo(-s*.6,-s*.7);cx.lineTo(-s*.6,s*.7);cx.fill();cx.restore()}
function drawM(m,t){const d=M[m.t],px=m.x*S,py=m.y*S,w=d.w*S,h=d.h*S;
 if(m.t=='line'){cx.save();cx.translate(px+S/2,py+S/2);cx.rotate(m.r*Math.PI/2);cx.fillStyle='#0f2a33';cx.fillRect(-S/2,-6,S,12);cx.globalAlpha=.7;cx.fillStyle=d.c;cx.fillRect(-S/2,-1.5,S,3);cx.restore();arrow(px+S/2,py+S/2,m.r,5,'#39d0ff88');return}
 cx.fillStyle='#0d171d';cx.strokeStyle=d.c;cx.lineWidth=2;cx.fillRect(px+3,py+3,w-6,h-6);cx.strokeRect(px+3,py+3,w-6,h-6);
 const c=SC[m.st]||'#556',blink=m.st=='NO POWER'&&(t*4|0)%2;
 if(d.w>1){cx.strokeStyle=d.c+'33';cx.lineWidth=1;cx.beginPath();for(let i=1;i<d.w*2;i++){cx.moveTo(px+i*S/2,py+6);cx.lineTo(px+i*S/2,py+h-6)}for(let i=1;i<d.h*2;i++){cx.moveTo(px+6,py+i*S/2);cx.lineTo(px+w-6,py+i*S/2)}cx.stroke()}
 cx.fillStyle=blink?'#000':c;cx.beginPath();cx.arc(px+w-9,py+9,3,0,7);cx.fill();
 if(m.st=='PROCESSING'||m.st=='GENERATING'){cx.globalAlpha=.2+.15*Math.sin(t*10+m.x);cx.fillStyle=d.c;cx.fillRect(px+3,py+3,w-6,h-6);cx.globalAlpha=1}
 cx.fillStyle=d.c;cx.font=(d.w>1?'bold 13px':'bold 9px')+' monospace';cx.textAlign='center';cx.fillText(d.k+(m.l?'+'+m.l:''),px+w/2,py+h/2+4);
 if(d.out||m.t=='router'){const f=fpos(m);arrow((f[0]+.5)*S-DIR[m.r][0]*S/2,(f[1]+.5)*S-DIR[m.r][1]*S/2,m.r,4+d.w,d.c)}
 if(d.cap||m.work){cx.fillStyle='#000';cx.fillRect(px+6,py+h-9,w-12,3);cx.fillStyle=d.cap?'#ffd23f':d.c;cx.fillRect(px+6,py+h-9,(w-12)*(d.cap?Math.min(1,st.used/cap()):m.prog),3)}}
function draw(t){
 cx.setTransform(1,0,0,1,0,0);cx.fillStyle='#04070a';cx.fillRect(0,0,vw,vh);
 cx.translate(vw/2,vh/2);cx.scale(cam.z,cam.z);cx.translate(-cam.x,-cam.y);
 cx.fillStyle='#090f14';cx.fillRect(0,0,W*S,W*S);
 const hx=vw/2/cam.z,hy=vh/2/cam.z,x0=Math.max(0,(cam.x-hx)/S|0),x1=Math.min(W,(cam.x+hx)/S+1|0),y0=Math.max(0,(cam.y-hy)/S|0),y1=Math.min(W,(cam.y+hy)/S+1|0);
 cx.strokeStyle='#12222b';cx.lineWidth=1;cx.beginPath();for(let x=x0;x<=x1;x++){cx.moveTo(x*S,y0*S);cx.lineTo(x*S,y1*S)}for(let y=y0;y<=y1;y++){cx.moveTo(x0*S,y*S);cx.lineTo(x1*S,y*S)}cx.stroke();
 for(const m of ms)drawM(m,t);
 for(const m of ms)if(m.t=='line')for(const p of m.q){const r=R[p.r],d=DIR[m.r],x=(m.x+.5+d[0]*(p.t-.5))*S,y=(m.y+.5+d[1]*(p.t-.5))*S;
  cx.fillStyle=r.c+'44';cx.beginPath();cx.arc(x,y,r.r+3,0,7);cx.fill();cx.fillStyle=r.c;
  if(p.r=='bit'){cx.beginPath();cx.arc(x,y,r.r,0,7);cx.fill()}else cx.fillRect(x-r.r,y-r.r,r.r*2,r.r*2)}
 if(sel){const d=M[sel.t];cx.strokeStyle='#fff';cx.lineWidth=1.5;cx.strokeRect(sel.x*S,sel.y*S,d.w*S,d.h*S)}
 const tx=mp.x/S|0,ty=mp.y/S|0;
 if(tool){const d=M[tool],a=anc(tool,tx,ty);cx.globalAlpha=.5;cx.fillStyle=fits(tool,a[0],a[1])?d.c:'#f44';cx.fillRect(a[0]*S+3,a[1]*S+3,d.w*S-6,d.h*S-6);cx.globalAlpha=1;arrow(a[0]*S+d.w*S/2,a[1]*S+d.h*S/2,rot,6,'#fff')}
 cx.save();cx.translate(pl.x,pl.y);cx.rotate(Math.PI/4);cx.fillStyle='#39ff88';cx.shadowColor='#39ff88';cx.shadowBlur=12;cx.fillRect(-6,-6,12,12);cx.restore()}
// ---- UI ----
function menu(){const b=$('build');b.innerHTML='';let i=1;for(const k in M){if(!st.unl[k])continue;const e=document.createElement('button');e.dataset.k=k;e.className=tool==k?'on':'';e.innerHTML=`${i++}. ${M[k].n}<small>${T.fmt(M[k].cost)}${M[k].w>1?' · '+M[k].w+'x'+M[k].h:''}</small>`;e.onclick=()=>pick(k);b.appendChild(e)}}
function pick(k){tool=tool==k?null:k;sel=null;menu()}
function lvCost(m){return m?M[m.t].cost*2**(m.l+1):64*4**st.lvLine}
G.up=()=>{if(!sel)return;if(sel.t=='line'){if(st.lvLine>=3||!spend(lvCost()))return;st.lvLine++}else{if(sel.l>=4||!spend(lvCost(sel)))return;sel.l++}G.toast('Upgraded')};
function ui(){
 const c=cap();$('mem').textContent=T.fmt(st.mem)+' / '+T.fmt(c);$('memb').style.width=Math.min(100,st.used/c*100)+'%';
 $('pow').textContent=demand.toFixed(1)+' / '+supply.toFixed(1)+' kW';$('powb').style.width=Math.min(100,demand/supply*100)+'%';$('powb').style.background=demand>supply?'#ff9a3c':'#39ff88';
 const o=OBJ[st.obj];$('obj').textContent=o?(st.obj+1)+'/'+OBJ.length+'  '+o[0]:'All current objectives done. More tiers coming.';
 $('bSkill').textContent='Skills (K)'+(st.sp?' ['+st.sp+']':'');$('bSkill').classList.toggle('pulse',st.sp>0);
 {const t=$('tree');if(!t.hidden&&t.dataset.k!=st.sp+Object.keys(st.skills).join())tree();const g=$('guide');if(!g.hidden&&g.dataset.o!=st.obj)guide()}
 const i=$('info');i.hidden=!sel;
 if(sel){const m=sel,d=M[m.t];let s='',u;
  if(m.t=='line'){const mx=lspd()/SPACING;s=`Throughput: ${m.pr.toFixed(1)} / ${mx.toFixed(1)} pkts/s<br>Moving: ${m.flow.toFixed(1)} bits/s<br>Utilization: ${(m.pr/mx*100|0)}%<br>Status: ${m.st}<br>Line speed MK ${st.lvLine+1} (all lines)`;u=st.lvLine<3?'Upgrade all lines: '+T.fmt(lvCost()):'Max level'}
  else{s=`Status: ${m.st}<br>Level: MK ${m.l+1}<br>`;if(d.out)s+=`Output: ${(d.outN*(1+m.l)/d.time).toFixed(1)} ${d.out}(s)/s<br>`;if(d.inR)s+=`Input: ${d.inN} ${d.inR}s/cycle (buffer ${m.buf})<br>`;
   if(d.pw>0)s+=`Power: ${(d.pw*(1+.5*m.l)).toFixed(2)} kW<br>`;if(d.pw<0)s+=`Supplies: ${-d.pw*(1+m.l)} kW<br>`;if(d.cap)s+=`Capacity: ${T.fmt(d.cap*4**m.l)}<br>`;
   u=m.l<4?'Upgrade: '+T.fmt(lvCost(m)):'Max level'}
  $('ititle').textContent=d.n;$('istats').innerHTML=s;const b=$('upg');b.textContent=u;b.disabled=!u.startsWith('Up')||st.mem<lvCost(m.t=='line'?null:m)}
 const sc=T.script,p=$('pstat');p.textContent=sc.running?'RUNNING '+T.fmt(sc.made)+' made':'IDLE';
 if(sc.dirty){sc.dirty=false;const o=$('out');o.textContent=sc.out.join('\n');o.scrollTop=1e9}
 const n=$('code').value.split('\n').length;if($('gut').dataset.n!=n){$('gut').dataset.n=n;$('gut').textContent=Array.from({length:n},(_,i)=>i+1).join('\n')}}
// ---- save / load ----
G.exp=()=>({v:1,st,cam:[pl.x,pl.y],code:$('code').value,ms:ms.map(m=>[m.t,m.x,m.y,m.r,m.l,m.buf])});
G.imp=o=>{init();T.script.stop('Program stopped.');if(!o){st=T.state=fresh();ms.length=0;menu();return}
 st=T.state=Object.assign(fresh(),o.st);if(!o.st.skills){st.skills={};st.sp=0;for(let i=0;i<st.obj;i++)st.sp+=BON.includes(i)?2:1}for(const id in st.skills)if(sk(id))sk(id).unl.split(',').forEach(k=>st.unl[k]=1);for(const a of o.ms){const m=place(a[0],a[1],a[2],a[3],1);if(m){m.l=a[4];m.buf=a[5]}}
 if(o.cam){pl.x=o.cam[0];pl.y=o.cam[1]}if(o.code)$('code').value=o.code;menu()};
// ---- input ----
const wpos=e=>({x:(e.clientX-vw/2)/cam.z+cam.x,y:(e.clientY-vh/2)/cam.z+cam.y});
function lay(x,y){if(tool=='line'&&last){const di=DIR.findIndex(d=>d[0]==x-last.x&&d[1]==y-last.y);if(di>=0){rot=di;const pm=at(last.x,last.y);if(pm&&pm.t=='line')pm.r=di}}
 const a=anc(tool,x,y);place(tool,a[0],a[1],rot);last={x,y}}
function resize(){vw=cv.width=innerWidth;vh=cv.height=innerHeight}
G.start=()=>{init();resize();menu();addEventListener('resize',resize);
 cv.oncontextmenu=e=>e.preventDefault();
 cv.onmousedown=e=>{const p=wpos(e),x=p.x/S|0,y=p.y/S|0;
  if(e.button==2){const m=at(x,y);if(m)remove(m);else{tool=null;sel=null;menu()}return}
  if(tool){down=true;last=null;lay(x,y)}else sel=at(x,y)};
 addEventListener('mouseup',()=>{down=false;last=null});
 cv.onmousemove=e=>{mp=wpos(e);const x=mp.x/S|0,y=mp.y/S|0;if(down&&tool=='line'&&(!last||last.x!=x||last.y!=y))lay(x,y)};
 cv.onwheel=e=>{cam.z=Math.min(2.5,Math.max(.4,cam.z*(e.deltaY<0?1.1:.9)))};
 addEventListener('keydown',e=>{if(e.target.tagName=='TEXTAREA'){if(e.key=='Escape')e.target.blur();return}
  const k=e.key.toLowerCase();if('wasd'.includes(k)&&k.length==1)keys[k]=1;
  if(k=='r'){if(sel&&!tool)sel.r=(sel.r+1)%4;else rot=(rot+1)%4}
  if(k=='escape'){tool=null;sel=null;$('tree').hidden=$('guide').hidden=true;menu()}
  if(k=='k')togTree();if(k=='h')$('guide').hidden?guide():$('guide').hidden=true;
  if(k=='t')$('term').hidden=!$('term').hidden;
  const n=+k;if(n>0){const ks=Object.keys(M).filter(q=>st.unl[q]);if(ks[n-1])pick(ks[n-1])}});
 addEventListener('keyup',e=>{delete keys[e.key.toLowerCase()]});
 const togTree=()=>{const t=$('tree');t.hidden=!t.hidden;if(!t.hidden)tree()};G.togTree=togTree;
 $('bSkill').onclick=togTree;$('bHelp').onclick=guide;$('tree').onclick=e=>{const b=e.target.closest('.sk');if(b)G.buy(b.dataset.id);if(e.target.id=='xt')$('tree').hidden=true};$('guide').onclick=e=>{if(e.target.id=='xg')$('guide').hidden=true};
 $('upg').onclick=G.up;$('bTerm').onclick=()=>$('term').hidden=!$('term').hidden;
 $('bSave').onclick=()=>T.save.save();$('bLoad').onclick=()=>T.save.load()?G.toast('Loaded'):G.toast('No save found');$('bReset').onclick=()=>T.save.reset();
 $('bRun').onclick=()=>T.script.run($('code').value);$('bStop').onclick=()=>T.script.stop();
 $('code').oninput=ui;$('code').onscroll=e=>{$('gut').scrollTop=e.target.scrollTop};
 let lt=0;const loop=ts=>{const dt=Math.min(.05,(ts-lt)/1000||0);lt=ts;update(dt);draw(ts/1000);requestAnimationFrame(loop)};requestAnimationFrame(loop)};
})();
