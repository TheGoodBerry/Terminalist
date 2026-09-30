// Terminalist script: tiny compiled language. Tier 1: produce/wait/repeat/log. Tier 2 (unlocked): if/else/end/throttle.
(()=>{
const KW=['produce','wait','repeat','if','else','end','throttle','log'],LOCKED=['if','else','end','throttle'];
const S=T.script={prog:null,pc:0,timer:0,running:false,usesIf:false,out:[],made:0,dirty:true};
const log=s=>{S.out.push(s);if(S.out.length>80)S.out.shift();S.dirty=true};S.log=log;
const VARS={memory:()=>T.state.mem/8,storage:()=>100*T.state.used/T.game.cap(),power:()=>100*T.game.load()};
S.compile=src=>{
 const ins=[],stk=[];let ok=true;const err=(n,m)=>{log(`Line ${n}:\n  ${m}`);ok=false};
 src.split('\n').forEach((raw,i)=>{const n=i+1,l=raw.trim();if(!l||l[0]=='#')return;
  const a=l.split(/\s+/),op=a[0].toLowerCase(),I={op,n};
  if(!KW.includes(op)){const s=T.suggest(op,KW);return err(n,`Unknown instruction "${a[0]}".`+(s?` Did you mean "${s}"?`:''))}
  if(LOCKED.includes(op)&&!T.state.unl.cond)return err(n,`"${op}" is locked. Complete more objectives to unlock it.`);
  if(op=='produce'){I.v=+a[1];if(!(I.v>0)||a[2]!='bits')return err(n,'Usage: produce <number> bits');if(I.v>16)return err(n,'produce is limited to 16 bits per call at this tier.')}
  else if(op=='wait'){I.v=+a[1];if(!(I.v>=.1))return err(n,'Usage: wait <seconds>  (minimum 0.1)')}
  else if(op=='throttle'){I.v=+a[1];if(!(I.v>=0&&I.v<=100))return err(n,'Usage: throttle <0-100>  (generator speed %)')}
  else if(op=='log')I.v=a.slice(1).join(' ');
  else if(op=='if'){I.k=a[1];I.o=a[2];I.v=+a[3];if(!VARS[I.k]||!['<','>'].includes(I.o)||isNaN(I.v))return err(n,'Usage: if <memory|storage|power> < or > <number>');stk.push({i:ins.length,e:-1})}
  else if(op=='else'){if(!stk.length||stk.at(-1).e>=0)return err(n,'"else" without a matching "if".');stk.at(-1).e=ins.length}
  else if(op=='end'){if(!stk.length)return err(n,'"end" without a matching "if".');const t=stk.pop(),x=ins.length;if(t.e>=0){ins[t.i].j=t.e+1;ins[t.e].j=x}else ins[t.i].j=x}
  ins.push(I)});
 if(ok&&stk.length){err(ins[stk.at(-1).i].n,'This "if" is never closed with "end".')}
 return ok?ins:null};
S.stop=(m)=>{if(S.running){S.running=false;log(m||'Program stopped.')}};
S.run=src=>{const p=S.compile(src);if(!p)return;S.prog=p;S.pc=0;S.timer=0;S.w=false;S.running=true;S.made=0;S.usesIf=p.some(i=>i.op=='if');S.usesThr=p.some(i=>i.op=='throttle');log('Program running...')};
S.tick=dt=>{
 if(!S.running)return;if(S.timer>0){S.timer-=dt;return}
 let steps=0;
 while(steps++<200){const I=S.prog[S.pc];if(!I)return S.stop('Program finished.');
  switch(I.op){
   case'wait':S.timer=I.v;S.pc++;S.w=true;return;
   case'repeat':if(!S.w)return S.stop(`Line ${I.n}:\n  This loop never waits and would freeze the factory. Add "wait 1" inside it.`);S.pc=0;S.w=false;continue;
   case'produce':if(T.game.deposit(I.v))S.made+=I.v;break;
   case'throttle':T.state.thr=I.v/100;break;
   case'log':log('> '+I.v);break;
   case'if':{const x=VARS[I.k]();if(I.o=='<'?x<I.v:x>I.v)break;S.pc=I.j;continue}
   case'else':S.pc=I.j;continue}
  S.pc++}
 S.stop('Program stopped: too many instructions without waiting.')};
})();
