// Core: world grid, machine simulation, power, objectives, rendering, input, UI.
(()=>{
const W=80,S=32,DIR=[[1,0],[0,1],[-1,0],[0,-1]],$=id=>document.getElementById(id),M=T.MACH,R=T.RES;
const fresh=()=>({mem:100,used:100,lvLine:0,obj:0,thr:1,stats:{},unl:{gen:1,line:1,asm:1,store:1,power:1}});
let st=T.state=fresh(),grid,ms,sat=1,supply=1,demand=0;
const cam={x:W*S/2,y:W*S/2,z:1},pl={x:W*S/2+64,y:W*S/2+64};
let tool=null,rot=0,sel=null,down=false,last=null,mp={x:0,y:0},keys={},vw=0,vh=0,tAcc=0,saveT=0,objT=0;
const cv=$('c'),cx=cv.getContext('2d'),G=T.game={};
const at=(x,y)=>x>=0&&y>=0&&x<W&&y<W?grid[y*W+x]:null;
const cap=G.cap=()=>256+ms.reduce((a,m)=>a+(m.t=='store'?M.store.cap*4**m.l:0),0);
G.load=()=>demand/Math.max(supply,.01);
const deposit=G.deposit=b=>{if(st.used+b>cap())return false;st.used+=b;st.mem+=b;return true};
const spend=a=>{if(st.mem<a)return false;const f=(st.mem-a)/st.mem;st.mem-=a;st.used*=f;return true};
G.toast=s=>{const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(t.h);t.h=setTimeout(()=>t.classList.remove('show'),2200)};
function init(){grid=new Array(W*W).fill(null);ms=[];sel=null}
function place(t,x,y,r,free){const d=M[t];if(!d||!st.unl[t]||x<0||y<0||x>=W||y>=W||at(x,y))return;
 if(!free&&!spend(d.cost)){G.toast('Not enough memory: need '+T.fmt(d.cost));return}
 const m={t,x,y,r,l:0,buf:0,prog:0,work:0,outq:0,q:[],st:'IDLE',fc:0,pc:0,ft:0,flow:0,pr:0};grid[y*W+x]=m;ms.push(m);return m}
function remove(m){grid[m.y*W+m.x]=null;ms.splice(ms.indexOf(m),1);deposit(Math.floor(M[m.t].cost/2));if(sel==m)sel=null}
// ---- transport ----
const lspd=()=>3*(1+st.lvLine),SPACING=.4;
function acc(tg,r,src){
 if(tg.t=='line'){if(src.t=='line'&&(tg.r+2)%4==src.r)return false;return tg.q.length<6&&(!tg.q.length||tg.q.at(-1).t>=SPACING)}
 const d=M[tg.t];if(d.cap)return st.used+R[r].s<=cap();return r===d.inR&&tg.buf<d.inN*2}
function give(tg,p){const d=M[tg.t];
 if(tg.t=='line'){p.t=0;tg.q.push(p)}
 else if(d.cap){st.used+=R[p.r].s*p.n;st.mem+=R[p.r].v*p.n;st.stats.stored=1}
 else tg.buf+=p.n}
function front(m){const d=DIR[m.r];return at(m.x+d[0],m.y+d[1])}
function tickLine(m,dt){
 const sp=lspd();for(let i=0;i<m.q.length;i++){const p=m.q[i],lim=i?m.q[i-1].t-SPACING:1;p.t=Math.min(p.t+dt*sp,lim)}
 const p=m.q[0];if(p&&p.t>=1){const tg=front(m);if(tg&&acc(tg,p.r,m)){m.fc+=R[p.r].v*p.n;m.pc++;give(tg,m.q.shift())}}
 m.ft+=dt;if(m.ft>=1){m.flow=m.fc/m.ft;m.pr=m.pc/m.ft;m.fc=m.pc=m.ft=0}
 m.st=m.pr/(sp/SPACING)>.9?'NEAR CAPACITY':m.q.length?'FLOWING':'IDLE'}
function tickMachine(m,dt){const d=M[m.t];
 if(d.cap){m.st=st.used/cap()>.97?'FULL':'ACTIVE';return}
 if(d.pw<0){m.st='GENERATING';return}
 if(sat<.02){m.st='NO POWER';return}
 if(m.outq){const tg=front(m);if(tg&&acc(tg,d.out,m)){give(tg,{r:d.out,n:m.outq,t:0});m.outq=0}else{m.st='OUTPUT BLOCKED';return}}
 if(m.work){const th=m.t=='gen'?st.thr:1;m.prog+=dt*sat*(1+m.l)*th/d.time;m.st=th?'PROCESSING':'THROTTLED';
  if(m.prog>=1){m.prog=0;m.work=0;m.outq=d.outN;st.stats[d.out]=(st.stats[d.out]||0)+d.outN}}
 else if(!d.inR||m.buf>=d.inN){m.buf-=d.inN||0;m.work=1}else m.st='NO INPUT'}
// ---- objectives ----
const OBJ=[
 ['Build a Code Generator and a Power Generator',()=>ms.some(m=>m.t=='gen')&&ms.some(m=>m.t=='power')],
 ['Route data into Storage with Data Lines',()=>st.stats.stored],
 ['Assemble your first Byte',()=>st.stats.byte>=1],
 ['Hold 1 KB in memory (upgrade or add Storage)',()=>st.mem>=8192,'comp','Compressor unlocked'],
 ['Compress data: make a Zip packet',()=>st.stats.zip>=1,'cond','Scripting: if / else / end / throttle unlocked'],
 ['Run a program that uses "if" in the Terminal (T)',()=>T.script.running&&T.script.usesIf],
 ['Hold 16 KB in memory',()=>st.mem>=131072]];
function checkObj(){const o=OBJ[st.obj];if(o&&o[1]()){G.toast('Objective complete: '+o[0]);if(o[2]){st.unl[o[2]]=1;setTimeout(()=>G.toast(o[3]),2300);menu()}st.obj++}}
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
function drawM(m,t){const d=M[m.t],px=m.x*S,py=m.y*S;
 if(m.t=='line'){cx.save();cx.translate(px+S/2,py+S/2);cx.rotate(m.r*Math.PI/2);cx.fillStyle='#0f2a33';cx.fillRect(-S/2,-6,S,12);cx.globalAlpha=.7;cx.fillStyle=d.c;cx.fillRect(-S/2,-1.5,S,3);cx.restore();arrow(px+S/2,py+S/2,m.r,5,'#39d0ff88');return}
 cx.fillStyle='#0d171d';cx.strokeStyle=d.c;cx.lineWidth=2;cx.fillRect(px+3,py+3,S-6,S-6);cx.strokeRect(px+3,py+3,S-6,S-6);
 const c=SC[m.st]||'#556',blink=m.st=='NO POWER'&&(t*4|0)%2;
 cx.fillStyle=blink?'#000':c;cx.beginPath();cx.arc(px+S-9,py+9,3,0,7);cx.fill();
 if(m.st=='PROCESSING'){cx.globalAlpha=.25+.15*Math.sin(t*10);cx.fillStyle=d.c;cx.fillRect(px+3,py+3,S-6,S-6);cx.globalAlpha=1}
 cx.fillStyle=d.c;cx.font='bold 9px monospace';cx.textAlign='center';cx.fillText(d.k+(m.l?'+'+m.l:''),px+S/2,py+S/2+4);
 if(d.out)arrow(px+S/2+DIR[m.r][0]*(S/2-1),py+S/2+DIR[m.r][1]*(S/2-1),m.r,4,d.c);
 if(d.cap||m.work){cx.fillStyle='#000';cx.fillRect(px+6,py+S-9,S-12,3);cx.fillStyle=d.cap?'#ffd23f':d.c;cx.fillRect(px+6,py+S-9,(S-12)*(d.cap?Math.min(1,st.used/cap()):m.prog),3)}}
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
 if(sel){cx.strokeStyle='#fff';cx.lineWidth=1.5;cx.strokeRect(sel.x*S,sel.y*S,S,S)}
 const tx=mp.x/S|0,ty=mp.y/S|0;
 if(tool){cx.globalAlpha=.5;const ok=!at(tx,ty);cx.fillStyle=ok?M[tool].c:'#f44';cx.fillRect(tx*S+3,ty*S+3,S-6,S-6);cx.globalAlpha=1;arrow(tx*S+S/2,ty*S+S/2,rot,6,'#fff')}
 cx.save();cx.translate(pl.x,pl.y);cx.rotate(Math.PI/4);cx.fillStyle='#39ff88';cx.shadowColor='#39ff88';cx.shadowBlur=12;cx.fillRect(-6,-6,12,12);cx.restore()}
// ---- UI ----
function menu(){const b=$('build');b.innerHTML='';let i=1;for(const k in M){if(!st.unl[k])continue;const e=document.createElement('button');e.dataset.k=k;e.className=tool==k?'on':'';e.innerHTML=`${i++}. ${M[k].n}<small>${T.fmt(M[k].cost)}</small>`;e.onclick=()=>pick(k);b.appendChild(e)}}
function pick(k){tool=tool==k?null:k;sel=null;menu()}
function lvCost(m){return m?M[m.t].cost*2**(m.l+1):64*4**st.lvLine}
G.up=()=>{if(!sel)return;if(sel.t=='line'){if(st.lvLine>=3||!spend(lvCost()))return;st.lvLine++}else{if(sel.l>=4||!spend(lvCost(sel)))return;sel.l++}G.toast('Upgraded')};
function ui(){
 const c=cap();$('mem').textContent=T.fmt(st.mem)+' / '+T.fmt(c);$('memb').style.width=Math.min(100,st.used/c*100)+'%';
 $('pow').textContent=demand.toFixed(1)+' / '+supply.toFixed(1)+' kW';$('powb').style.width=Math.min(100,demand/supply*100)+'%';$('powb').style.background=demand>supply?'#ff9a3c':'#39ff88';
 const o=OBJ[st.obj];$('obj').textContent=o?o[0]:'All current objectives done. More tiers coming.';
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
 st=T.state=Object.assign(fresh(),o.st);for(const a of o.ms){const m=place(a[0],a[1],a[2],a[3],1);if(m){m.l=a[4];m.buf=a[5]}}
 if(o.cam){pl.x=o.cam[0];pl.y=o.cam[1]}if(o.code)$('code').value=o.code;menu()};
// ---- input ----
const wpos=e=>({x:(e.clientX-vw/2)/cam.z+cam.x,y:(e.clientY-vh/2)/cam.z+cam.y});
function lay(x,y){if(tool=='line'&&last){const di=DIR.findIndex(d=>d[0]==x-last.x&&d[1]==y-last.y);if(di>=0){rot=di;const pm=at(last.x,last.y);if(pm&&pm.t=='line')pm.r=di}}
 if(!at(x,y))place(tool,x,y,rot);last={x,y}}
function resize(){vw=cv.width=innerWidth;vh=cv.height=innerHeight}
G.start=()=>{init();resize();menu();addEventListener('resize',resize);
 cv.oncontextmenu=e=>e.preventDefault();
 cv.onmousedown=e=>{const p=wpos(e),x=p.x/S|0,y=p.y/S|0;
  if(e.button==2){const m=at(x,y);if(m)remove(m);else{tool=null;sel=null;menu()}return}
  if(tool){down=true;last=null;lay(x,y)}else sel=at(x,y)};
 addEventListener('mouseup',()=>{down=false;last=null});
 cv.onmousemove=e=>{mp=wpos(e);const x=mp.x/S|0,y=mp.y/S|0;if(down&&tool&&(!last||last.x!=x||last.y!=y))lay(x,y)};
 cv.onwheel=e=>{cam.z=Math.min(2.5,Math.max(.4,cam.z*(e.deltaY<0?1.1:.9)))};
 addEventListener('keydown',e=>{if(e.target.tagName=='TEXTAREA'){if(e.key=='Escape')e.target.blur();return}
  const k=e.key.toLowerCase();if('wasd'.includes(k)&&k.length==1)keys[k]=1;
  if(k=='r'){if(sel&&!tool)sel.r=(sel.r+1)%4;else rot=(rot+1)%4}
  if(k=='escape'){tool=null;sel=null;menu()}
  if(k=='t')$('term').hidden=!$('term').hidden;
  const n=+k;if(n>0){const ks=Object.keys(M).filter(q=>st.unl[q]);if(ks[n-1])pick(ks[n-1])}});
 addEventListener('keyup',e=>{delete keys[e.key.toLowerCase()]});
 $('upg').onclick=G.up;$('bTerm').onclick=()=>$('term').hidden=!$('term').hidden;
 $('bSave').onclick=()=>T.save.save();$('bLoad').onclick=()=>T.save.load()?G.toast('Loaded'):G.toast('No save found');$('bReset').onclick=()=>T.save.reset();
 $('bRun').onclick=()=>T.script.run($('code').value);$('bStop').onclick=()=>T.script.stop();
 $('code').oninput=ui;$('code').onscroll=e=>{$('gut').scrollTop=e.target.scrollTop};
 let lt=0;const loop=ts=>{const dt=Math.min(.05,(ts-lt)/1000||0);lt=ts;update(dt);draw(ts/1000);requestAnimationFrame(loop)};requestAnimationFrame(loop)};
})();
