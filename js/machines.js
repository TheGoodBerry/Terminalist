// Data-driven machine definitions. pw>0 consumes kW, pw<0 supplies kW. w/h = footprint in tiles. Add a machine = add an entry.
T.RES={bit:{c:'#7dffb0',v:1,s:1,r:2},byte:{c:'#39d0ff',v:8,s:8,r:3.5},zip:{c:'#c77dff',v:80,s:64,r:5},
 kb:{c:'#ffd23f',v:8192,s:8192,r:6},mb:{c:'#ff5cf0',v:8388608,s:8388608,r:7.5},gb:{c:'#ffffff',v:8589934592,s:8589934592,r:9}}; // v=logical bits, s=space used
T.MACH={
 // production
 gen:{n:'Code Generator',k:'GEN',c:'#39ff88',cost:16,pw:.5,out:'bit',outN:1,time:.25},
 gen2:{n:'Cluster Generator',k:'CLU',c:'#39ff88',w:2,cost:300,pw:3,out:'bit',outN:4,time:.25},
 // transport
 line:{n:'Data Line',k:'',c:'#1fa8c9',cost:1,pw:0},
 router:{n:'Router',k:'RTR',c:'#ff5cf0',cost:8,pw:0},
 // processing
 asm:{n:'Byte Assembler',k:'ASM',c:'#39d0ff',cost:24,pw:1,inR:'bit',inN:8,out:'byte',outN:1,time:1.5},
 asm2:{n:'Parallel Assembler',k:'PAR',c:'#39d0ff',w:2,cost:400,pw:4,inR:'bit',inN:32,out:'byte',outN:4,time:1.5},
 comp:{n:'Compressor',k:'ZIP',c:'#c77dff',cost:160,pw:2,inR:'byte',inN:10,out:'zip',outN:1,time:2},
 comp2:{n:'Deep Compressor',k:'DEEP',c:'#c77dff',w:3,cost:1500,pw:8,inR:'byte',inN:40,out:'zip',outN:4,time:2},
 refKB:{n:'Kilobyte Refinery',k:'KB',c:'#ffd23f',w:3,cost:2400,pw:8,inR:'byte',inN:32,out:'kb',outN:1,time:4},
 refMB:{n:'Megabyte Foundry',k:'MB',c:'#ff5cf0',w:4,cost:80000,pw:20,inR:'kb',inN:16,out:'mb',outN:1,time:8},
 refGB:{n:'Gigabyte Reactor',k:'GB',c:'#ffffff',w:5,cost:4000000,pw:60,inR:'mb',inN:16,out:'gb',outN:1,time:16},
 // storage
 store:{n:'Storage',k:'MEM',c:'#ffd23f',cost:48,pw:0,cap:1024},
 vault:{n:'Vault',k:'VAULT',c:'#ffd23f',w:3,cost:1200,pw:0,cap:32768},
 array:{n:'Data Array',k:'ARRAY',c:'#ffd23f',w:4,cost:30000,pw:0,cap:1048576},
 dc:{n:'Data Center',k:'DATA CENTER',c:'#ffd23f',w:6,cost:1000000,pw:0,cap:33554432},
 // power
 power:{n:'Power Generator',k:'PWR',c:'#ff9a3c',cost:32,pw:-3},
 solar:{n:'Solar Array',k:'SOLAR',c:'#ff9a3c',w:2,cost:500,pw:-8},
 fusion:{n:'Fusion Reactor',k:'FUSION',c:'#ff9a3c',w:4,cost:30000,pw:-60}
};
for(const k in T.MACH){const d=T.MACH[k];d.w=d.w||1;d.h=d.h||d.w}
