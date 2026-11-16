const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const app=express(),server=http.createServer(app),io=new Server(server,{cors:{origin:'*'}});
app.use(express.static('public'));
const rooms=new Map();
const chars=['clucky','buffalo','peep','shadow'];
const eggs=['classic','scrambled','golden','boiled','rotten'];
const stats={classic:[1,1,1],scrambled:[.93,1.45,1.05],golden:[1.2,.72,.78],boiled:[.89,.86,.94],rotten:[1.03,1,1.16]};
const TRACK={cx:500,cy:350,rx:360,ry:230,inner:0.60};
const MAX=8;
function code(){let s;do{s=Math.random().toString(36).slice(2,8).toUpperCase()}while(rooms.has(s));return s}
function clean(v,n=20){return String(v||'').replace(/[<>]/g,'').trim().slice(0,n)}
function publicRoom(r){return {code:r.code,host:r.host,phase:r.phase,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,char:p.char,egg:p.egg,ready:p.ready,lap:p.lap,place:p.place,finished:p.finished})),countdown:r.countdown||0}}
function emit(r){io.to(r.code).emit('room',publicRoom(r))}
function join(socket,roomCode,name){let r=rooms.get(roomCode);if(!r)return socket.emit('errorMsg','Room not found.');if(r.phase!=='lobby')return socket.emit('errorMsg','Race already underway.');if(r.players.size>=MAX)return socket.emit('errorMsg','Room is full.');const i=r.players.size;const p={id:socket.id,name:clean(name)||'Chicken '+(i+1),char:chars[i%4],egg:'classic',ready:false,x:0,y:0,a:0,speed:0,lap:0,progress:0,prevAngle:0,place:0,finished:false,finishAt:0,stun:0,shield:0,boost:0,cooldown:0,trapCooldown:0,input:{gas:false,brake:false,left:false,right:false,ability:false}};r.players.set(socket.id,p);socket.join(r.code);socket.data.room=r.code;socket.emit('joined',{code:r.code,id:socket.id});emit(r)}
function reset(r){r.phase='lobby';r.countdown=0;r.traps=[];for(const p of r.players.values()){p.ready=false;p.finished=false;p.lap=0;p.place=0;p.speed=0;p.progress=0;p.boost=0;p.shield=0;p.stun=0;p.cooldown=0}emit(r)}
io.on('connection',s=>{
 s.on('create',({name}={})=>{const c=code(),r={code:c,host:s.id,phase:'lobby',players:new Map(),traps:[],countdown:0,started:0};rooms.set(c,r);join(s,c,name)});
 s.on('join',({code:c,name}={})=>join(s,clean(c,6).toUpperCase(),name));
 s.on('select',({char,egg}={})=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!p||r.phase!=='lobby')return;if(chars.includes(char))p.char=char;if(eggs.includes(egg))p.egg=egg;p.ready=false;emit(r)});
 s.on('ready',()=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(p&&r.phase==='lobby'){p.ready=!p.ready;emit(r)}});
 s.on('start',()=>{const r=rooms.get(s.data.room);if(!r||r.host!==s.id||r.phase!=='lobby'||r.players.size<1)return;if([...r.players.values()].some(p=>!p.ready))return;r.phase='countdown';r.countdown=Date.now()+3500;r.traps=[];let i=0;for(const p of r.players.values()){const angle=-Math.PI/2-i*.065;p.x=TRACK.cx+TRACK.rx*.82*Math.cos(angle);p.y=TRACK.cy+TRACK.ry*.82*Math.sin(angle);p.a=0;p.speed=0;p.lap=0;p.progress=0;p.prevAngle=angle;p.finished=false;p.finishAt=0;p.place=0;p.cooldown=0;p.boost=0;p.stun=0;p.shield=0;i++}emit(r)});
 s.on('input',v=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(p&&r.phase==='race'&&v&&typeof v==='object')for(const k of Object.keys(p.input))p.input[k]=!!v[k]});
 s.on('rematch',()=>{const r=rooms.get(s.data.room);if(r&&r.host===s.id&&r.phase==='results')reset(r)});
 s.on('disconnect',()=>{const r=rooms.get(s.data.room);if(!r)return;r.players.delete(s.id);if(!r.players.size){rooms.delete(r.code);return}if(r.host===s.id)r.host=r.players.keys().next().value;emit(r)})
});
let last=Date.now();setInterval(()=>{const now=Date.now(),dt=Math.min((now-last)/1000,.05);last=now;for(const r of rooms.values()){
 if(r.phase==='countdown'&&now>=r.countdown){r.phase='race';r.started=now;emit(r)}
 if(r.phase!=='race')continue;
 for(const p of r.players.values()){
  if(p.finished)continue;
  const st=stats[p.egg],inp=p.input;
  p.cooldown=Math.max(0,p.cooldown-dt);p.boost=Math.max(0,p.boost-dt);p.shield=Math.max(0,p.shield-dt);p.stun=Math.max(0,p.stun-dt);
  if(inp.ability&&p.cooldown<=0){p.cooldown=9;if(p.char==='clucky')p.boost=1.7;if(p.char==='peep')p.boost=2.5;if(p.char==='buffalo')p.shield=3;if(p.char==='shadow')r.traps.push({x:p.x,y:p.y,owner:p.id,expires:now+8000})}
  const nx=(p.x-TRACK.cx)/TRACK.rx,ny=(p.y-TRACK.cy)/TRACK.ry,rad=Math.sqrt(nx*nx+ny*ny),off=rad<TRACK.inner||rad>1;
  const maxSpeed=210*st[0]*(p.boost>0?1.6:1)*(off?.46:1)*(p.stun>0?.3:1);
  if(inp.gas)p.speed+=220*st[1]*dt;else p.speed-=100*dt;
  if(inp.brake)p.speed-=290*dt;
  p.speed=Math.max(-65,Math.min(maxSpeed,p.speed));
  const steer=(inp.right?1:0)-(inp.left?1:0);
  p.a+=steer*2.6*st[2]*dt*(p.speed>=0?1:-1)*Math.min(1,Math.abs(p.speed)/65);
  p.x+=Math.cos(p.a)*p.speed*dt;p.y+=Math.sin(p.a)*p.speed*dt;
  p.x=Math.max(25,Math.min(975,p.x));p.y=Math.max(25,Math.min(675,p.y));
  const angle=Math.atan2((p.y-TRACK.cy)/TRACK.ry,(p.x-TRACK.cx)/TRACK.rx);
  let delta=angle-p.prevAngle;if(delta>Math.PI)delta-=Math.PI*2;if(delta<-Math.PI)delta+=Math.PI*2;
  // A lap only counts when driving clockwise around the entire track.
  if(Math.abs(delta)<.35&&rad>.63&&rad<.98&&p.speed>0){p.progress+=Math.max(-.09,Math.min(.09,delta));if(p.progress>=Math.PI*2){p.progress-=Math.PI*2;p.lap++;if(p.lap>=3){p.finished=true;p.finishAt=now;p.speed=0}}}
  p.prevAngle=angle;
  for(const t of r.traps){if(t.owner!==p.id&&Math.hypot(p.x-t.x,p.y-t.y)<29&&p.shield<=0){p.stun=1.2;t.expires=0}}
 }
 r.traps=r.traps.filter(t=>t.expires>now);
 const order=[...r.players.values()].sort((a,b)=>Number(b.finished)-Number(a.finished)||(a.finished?a.finishAt-b.finishAt:(b.lap*6.283+b.progress)-(a.lap*6.283+a.progress)));
 order.forEach((p,i)=>p.place=i+1);
 if(order.every(p=>p.finished)||now-r.started>240000){r.phase='results';emit(r)}
 io.to(r.code).emit('state',{phase:r.phase,players:[...r.players.values()].map(p=>({id:p.id,x:p.x,y:p.y,a:p.a,lap:p.lap,place:p.place,finished:p.finished,boost:p.boost,shield:p.shield,cooldown:p.cooldown,char:p.char,egg:p.egg,name:p.name})),traps:r.traps,remaining:Math.max(0,240-Math.floor((now-r.started)/1000))});
}},50);
server.listen(process.env.PORT||3000,()=>console.log('Egg Prix running on port '+(process.env.PORT||3000)));
