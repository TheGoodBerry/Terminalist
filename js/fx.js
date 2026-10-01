// Pooled particle system (ring buffer, no per-frame allocation). Drawn additively for a glowing look.
(()=>{const N=2000,X=new Float32Array(N),Y=new Float32Array(N),VX=new Float32Array(N),VY=new Float32Array(N),L=new Float32Array(N),ML=new Float32Array(N),SZ=new Float32Array(N),C=new Array(N).fill('#fff');let i=0;
T.fx={
 emit(x,y,n,c,sp,life,sz){for(let k=0;k<n;k++){const a=Math.random()*6.283,s=sp*(.3+Math.random()*.7);X[i]=x;Y[i]=y;VX[i]=Math.cos(a)*s;VY[i]=Math.sin(a)*s;L[i]=ML[i]=life*(.6+Math.random()*.4);SZ[i]=sz*(.6+Math.random()*.8);C[i]=c;i=(i+1)%N}},
 update(dt){const f=1-dt*1.6;for(let k=0;k<N;k++)if(L[k]>0){L[k]-=dt;X[k]+=VX[k]*dt;Y[k]+=VY[k]*dt;VX[k]*=f;VY[k]*=f}},
 draw(cx){cx.globalCompositeOperation='lighter';for(let k=0;k<N;k++)if(L[k]>0){const a=L[k]/ML[k],s=SZ[k]*(.4+a);cx.globalAlpha=a;cx.fillStyle=C[k];cx.fillRect(X[k]-s/2,Y[k]-s/2,s,s)}cx.globalAlpha=1;cx.globalCompositeOperation='source-over'}};
})();
