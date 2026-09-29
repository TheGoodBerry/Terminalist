window.T=window.T||{};
// Data formatting: bits -> readable units (8 bits = 1 B, 1024 = next unit)
T.fmt=b=>{if(b<8)return Math.floor(b)+' Bits';const u=['','B','KB','MB','GB','TB','PB','EB'];let v=b/8,i=1;while(v>=1024&&i<7){v/=1024;i++}return(v<10?v.toFixed(1):Math.floor(v))+' '+u[i]};
T.lev=(a,b)=>{const d=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]==b[j-1]?0:1));p=t}}return d[b.length]};
T.suggest=(w,list)=>{let best=null,bd=3;for(const k of list){const x=T.lev(w,k);if(x<bd){bd=x;best=k}}return best};
