const {carveMaze}=require('./maze_core.js');
function measure(g,size,cw){
  const idx=(x,y)=>y*size+x;
  const open=(x,y)=>x>=0&&y>=0&&x<size&&y<size&&g[idx(x,y)]===0;
  const widths=[];
  for(let y=1;y<size-1;y++) for(let x=1;x<size-1;x++){
    if(!open(x,y)) continue;
    const horiz = open(x-1,y)||open(x+1,y);
    const vert = open(x,y-1)||open(x,y+1);
    if(horiz){ let h=1,i=1; while(open(x,y-i)){h++;i++;} i=1; while(open(x,y+i)){h++;i++;} widths.push(h); }
    if(vert){ let w=1,i=1; while(open(x-i,y)){w++;i++;} i=1; while(open(x+i,y)){w++;i++;} widths.push(w); }
  }
  return widths;
}
for(const cw of [1,2]){
  let all=[];
  for(let i=0;i<200;i++){
    const size=15+((Math.random()*40)|0)*2;
    const g=carveMaze(size,null,cw);
    all=all.concat(measure(g,size,cw));
  }
  all.sort((a,b)=>a-b);
  const med=all[Math.floor(all.length/2)];
  console.log(`cw=${cw}: median Querschnittsbreite=${med}, min=${all[0]}, samples=${all.length}`);
}
