// Data-driven machine definitions. pw>0 consumes kW, pw<0 supplies kW. Add a machine = add an entry.
T.RES={bit:{c:'#7dffb0',v:1,s:1,r:2},byte:{c:'#39d0ff',v:8,s:8,r:3.5},zip:{c:'#c77dff',v:80,s:64,r:5}}; // v=logical bits, s=space used
T.MACH={
 gen:{n:'Code Generator',k:'GEN',c:'#39ff88',cost:16,pw:.5,out:'bit',outN:1,time:.25},
 line:{n:'Data Line',k:'',c:'#1fa8c9',cost:1,pw:0},
 asm:{n:'Byte Assembler',k:'ASM',c:'#39d0ff',cost:24,pw:1,inR:'bit',inN:8,out:'byte',outN:1,time:1.5},
 comp:{n:'Compressor',k:'ZIP',c:'#c77dff',cost:160,pw:2,inR:'byte',inN:10,out:'zip',outN:1,time:2},
 store:{n:'Storage',k:'MEM',c:'#ffd23f',cost:48,pw:0,cap:1024},
 power:{n:'Power Generator',k:'PWR',c:'#ff9a3c',cost:32,pw:-3}
};
