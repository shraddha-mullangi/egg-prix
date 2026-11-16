
const socket = io();
const $ = id => document.getElementById(id);
let room = null;
let myId = null;
let state = null;

const input = {
  gas:false, brake:false, left:false,
  right:false, ability:false
};

function show(page) {
  ["home","lobby","race","results"].forEach(id =>
    $(id).classList.toggle("hidden",id!==page)
  );
}

function message(text) {
  $("message").textContent = text;
}

socket.on("connect",()=>message("Connected!"));
socket.on("disconnect",()=>message("Connection lost. Reconnecting..."));
socket.on("errorMsg",message);

$("create").onclick = () =>
  socket.emit("create",{name:$("name").value});

$("join").onclick = () =>
  socket.emit("join",{
    code:$("code").value.trim().toUpperCase(),
    name:$("name").value
  });

const inviteCode = new URLSearchParams(location.search).get("room");
if(inviteCode) $("code").value = inviteCode.toUpperCase();

socket.on("joined",data=>{
  myId = data.id;
  history.replaceState(null,"","?room="+data.code);
  show("lobby");
});

$("invite").onclick = async ()=>{
  const url = location.origin+"?room="+room.code;
  try {
    await navigator.clipboard.writeText(url);
    message("Invite link copied!");
  } catch {
    message("Share this link: "+url);
  }
};

function selectKart() {
  socket.emit("select",{
    char:$("chicken").value,
    egg:$("egg").value
  });
}
$("chicken").onchange = selectKart;
$("egg").onchange = selectKart;
$("ready").onclick = ()=>socket.emit("ready");
$("start").onclick = ()=>socket.emit("start");
$("rematch").onclick = ()=>socket.emit("rematch");

socket.on("room",data=>{
  room = data;
  $("roomCode").textContent = data.code;
  const me = data.players.find(p=>p.id===myId);
  if(me){
    $("chicken").value=me.char;
    $("egg").value=me.egg;
  }
  $("players").replaceChildren();
  data.players.forEach(p=>{
    const div=document.createElement("div");
    div.className="player";
    div.textContent=(p.ready?"✅ ":"⏳ ")+p.name+
      " — "+p.char+" / "+p.egg;
    $("players").appendChild(div);
  });
  $("ready").textContent=me?.ready?"Cancel Ready":"I'm Ready!";
  $("start").classList.toggle("hidden",data.host!==myId);
  $("start").disabled=!data.players.every(p=>p.ready);
  if(data.phase==="lobby") show("lobby");
  if(data.phase==="countdown"){
    show("race");
    $("status").textContent="Get ready...";
  }
  if(data.phase==="race") show("race");
  if(data.phase==="results"){
    show("results");
    $("standings").replaceChildren();
    [...data.players].sort((a,b)=>a.place-b.place)
      .forEach(p=>{
        const line=document.createElement("p");
        line.textContent="#"+p.place+" "+p.name+
          (p.finished?" 🏁":"");
        $("standings").appendChild(line);
      });
    $("rematch").classList.toggle("hidden",data.host!==myId);
  }
});

socket.on("state",data=>{
  state=data;
  if(data.phase==="race") $("status").textContent="GO! 🏁";
  const me=data.players.find(p=>p.id===myId);
  if(me){
    $("hud").textContent="Lap "+Math.min(3,me.lap+1)+
      "/3  |  Position #"+me.place+
      "  |  Special: "+Math.ceil(me.cooldown)+"s";
  }
});

const canvas=$("track");
const ctx=canvas.getContext("2d");

function ellipse(cx,cy,rx,ry,color){
  ctx.beginPath();
  ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
  ctx.fillStyle=color;
  ctx.fill();
}

const colors={
  classic:"#fff9e6",
  scrambled:"#ffbb45",
  golden:"#ffe05a",
  boiled:"#a8d8ff",
  rotten:"#94d96b"
};
const faces={
  clucky:"🐔",
  buffalo:"🐓",
  peep:"🐤",
  shadow:"🐔"
};

function render(){
  requestAnimationFrame(render);
  ctx.clearRect(0,0,1000,700);
  ctx.fillStyle="#72b86b";
  ctx.fillRect(0,0,1000,700);

  // Grass, road, and inside field
  ellipse(500,350,365,235,"#e8d8a1");
  ellipse(500,350,360,230,"#535b60");
  ellipse(500,350,216,138,"#72b86b");

  // Dashed center racing line
  ctx.beginPath();
  ctx.ellipse(500,350,290,184,0,0,Math.PI*2);
  ctx.strokeStyle="#fff9d8";
  ctx.lineWidth=4;
  ctx.setLineDash([18,22]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Start/finish line
  ctx.save();
  ctx.translate(500,166);
  for(let i=0;i<8;i++){
    ctx.fillStyle=i%2?"#fff":"#111";
    ctx.fillRect(0,i*8,28,8);
  }
  ctx.restore();

  // Farm decorations
  ctx.font="42px serif";
  ctx.fillText("🌳",90,120);
  ctx.fillText("🌻",830,140);
  ctx.fillText("🏡",440,370);
  ctx.fillText("🌾",110,610);
  ctx.fillText("🐄",790,610);

  if(!state)return;

  for(const trap of state.traps||[]){
    ctx.font="30px serif";
    ctx.fillText("💨",trap.x-15,trap.y+10);
  }

  for(const p of state.players){
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(p.a);

    // Egg-shaped racing vehicle
    ctx.beginPath();
    ctx.ellipse(0,0,25,17,0,0,Math.PI*2);
    ctx.fillStyle=colors[p.egg]||"#fff";
    ctx.fill();
    ctx.strokeStyle=p.id===myId?"#ff4242":"#273b40";
    ctx.lineWidth=p.id===myId?5:2;
    ctx.stroke();

    ctx.font="25px serif";
    ctx.textAlign="center";
    ctx.fillText(faces[p.char]||"🐔",0,8);

    if(p.shield>0){
      ctx.beginPath();
      ctx.arc(0,0,31,0,Math.PI*2);
      ctx.strokeStyle="#60dfff";
      ctx.lineWidth=4;
      ctx.stroke();
    }
    if(p.boost>0){
      ctx.font="22px serif";
      ctx.fillText("🔥",-34,8);
    }
    ctx.restore();

    ctx.font="bold 14px system-ui";
    ctx.textAlign="center";
    ctx.fillStyle="#fff";
    ctx.strokeStyle="#182b30";
    ctx.lineWidth=4;
    ctx.strokeText(p.name,p.x,p.y-32);
    ctx.fillText(p.name,p.x,p.y-32);
  }
}
render();

const keyMap={
  ArrowUp:"gas",KeyW:"gas",
  ArrowDown:"brake",KeyS:"brake",
  ArrowLeft:"left",KeyA:"left",
  ArrowRight:"right",KeyD:"right",
  Space:"ability"
};

document.addEventListener("keydown",e=>{
  const k=keyMap[e.code];
  if(k && !["INPUT","SELECT","TEXTAREA"].includes(
    document.activeElement.tagName)){
    e.preventDefault();
    input[k]=true;
  }
});
document.addEventListener("keyup",e=>{
  const k=keyMap[e.code];
  if(k){e.preventDefault();input[k]=false;}
});
window.addEventListener("blur",()=>{
  Object.keys(input).forEach(k=>input[k]=false);
});

document.querySelectorAll("[data-key]").forEach(button=>{
  const k=button.dataset.key;
  button.addEventListener("pointerdown",e=>{
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    input[k]=true;
  });
  ["pointerup","pointercancel","lostpointercapture"]
    .forEach(type=>button.addEventListener(type,()=>{
      input[k]=false;
    }));
});

setInterval(()=>{
  if(socket.connected) socket.emit("input",input);
},50);
