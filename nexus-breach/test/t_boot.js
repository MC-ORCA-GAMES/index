const {boot}=require('./harness');
const h=boot();
h.frame(120);
const B=h.B();
console.log('state',B.state,'errors',h.errors.length,'warns',h.warns);
console.log('NX keys',Object.keys(B.NX).join(','));
console.log('level biome',B.NX.level.biome,'grid',B.NX.level.width+'x'+B.NX.level.height,'enemies',B.NX.enemies.list.length);
console.log('save',JSON.stringify(B.NX.save.data).slice(0,200));
process.exit(h.errors.length?1:0);
