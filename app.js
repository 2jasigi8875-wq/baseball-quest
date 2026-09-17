/* ====== 저장 키 ====== */
const KEY='bq4';

/* ====== 날짜 도우미 ====== */
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseD=s=>{const a=s.split('-');return new Date(+a[0],+a[1]-1,+a[2]);};
const shift=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return ymd(d);};
const TODAY=ymd(new Date());
const YOIL=['일','월','화','수','목','금','토'];

/* ====== 저장 데이터 ======
   log   : { '2026-09-17': {m:아침, n:저녁, l:레슨, g:경기, t:드릴선택} }
   weeks : { '그주월요일': {bat:'날짜', pit:'날짜'} }                        */
let D=JSON.parse(localStorage.getItem(KEY)||'{}');
if(!D.log)D.log={};
if(!D.weeks)D.weeks={};
if(!D.coupons)D.coupons=[];
if(!D.given)D.given=[];
if(D.tickets===undefined)D.tickets=0;
const save=()=>localStorage.setItem(KEY,JSON.stringify(D));

/* 화면 상태 */
let sel=TODAY;
let view=TODAY.slice(0,7);

const R=d=>D.log[d]||{};
function rec(d){if(!D.log[d])D.log[d]={};return D.log[d];}
function weekKey(d){const x=parseD(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return ymd(x);}
function wk(d){const k=weekKey(d);if(!D.weeks[k])D.weeks[k]={bat:'',pit:''};return D.weeks[k];}

/* ====== 하루 성공 기준 ======
   평일 = 아침 + 저녁 둘 다 / 주말 = 주말 루틴 완료          */
function ok(d){
  const r=R(d);
  const dow=parseD(d).getDay();
  if(dow===0||dow===6) return !!r.n;
  return !!r.m && !!r.n;
}
function runTo(date){
  let c=0,cur=date,guard=0;
  while(guard++<400){
    if(!ok(cur))break;
    c++;
    cur=shift(cur,-1);
  }
  return c;
}
function streakNow(){return ok(TODAY)?runTo(TODAY):runTo(shift(TODAY,-1));}
function bestStreak(){
  let best=0;
  Object.keys(D.log).forEach(d=>{if(ok(d)){const r=runTo(d);if(r>best)best=r;}});
  return best;
}

/* ====== 뽑기권 ====== */
function isMile(n){return MILESTONES.indexOf(n)>=0||(n>30&&n%10===0);}
function checkTicket(date){
  const c=runTo(date);
  if(isMile(c)&&D.given.indexOf(date)<0){D.given.push(date);D.tickets++;return c;}
  return 0;
}
function pickReward(){
  const tot=REWARDS.reduce((a,b)=>a+b.w,0);
  let r=Math.random()*tot;
  for(let i=0;i<REWARDS.length;i++){r-=REWARDS[i].w;if(r<0)return REWARDS[i].n;}
  return REWARDS[0].n;
}

/* ====== 화면 조각 ====== */
function item(e){
  const warn=e.c==='h'?' 🔴':(e.c==='m'?' 🟠':'');
  const reps=e.r?'<i>'+e.r+'</i>':'';
  const cue=e.cue?'<div>💡 '+e.cue+'</div>':'';
  const bad=e.bad?'<div>⚠️ 흔한 실수: '+e.bad+'</div>':'';
  const yt=e.v?'<div><a href="https://www.youtube.com/results?search_query='+encodeURIComponent(e.v)+'" target="_blank">▶ 영상 검색</a></div>':'';
  return '<details><summary><b>'+e.t+'</b><span>'+e.n+warn+'</span>'+reps+'</summary><div class="dt">'+cue+bad+yt+'</div></details>';
}
function plan(p){
  const eq=p.equip?'<span class="eq">'+p.equip+'</span>':'';
  const note=p.note?'<div class="sub" style="margin:6px 0 8px">'+p.note+'</div>':'';
  return '<div class="ttl">'+p.title+eq+'</div>'+note+p.list.map(item).join('');
}
function btnHTML(done,doId,undoId,label){
  if(sel>TODAY)return '<button class="btn" disabled>아직 오지 않은 날이에요</button>';
  if(done)return '<button class="btn" disabled>완료했어요 👍</button><button class="btn gray" id="'+undoId+'">완료 취소</button>';
  return '<button class="btn" id="'+doId+'">'+label+'</button>';
}

/* ====== 달력 ====== */
function drawCal(){
  const y=+view.slice(0,4), m=+view.slice(5,7);
  const lead=new Date(y,m-1,1).getDay();
  const days=new Date(y,m,0).getDate();
  let h='<div class="cal-head"><button class="cal-nav" id="prevM">‹</button><b>'+y+'년 '+m+'월</b><button class="cal-nav" id="nextM">›</button></div><div class="cal-grid">';
  YOIL.forEach((d,i)=>{h+='<div class="cal-dow '+(i===0?'sun':i===6?'sat':'')+'">'+d+'</div>';});
  for(let i=0;i<lead;i++)h+='<div class="cal-cell empty"></div>';
  for(let d=1;d<=days;d++){
    const ds=y+'-'+pad(m)+'-'+pad(d), r=R(ds);
    const mk=(r.m?'✅':'')+(r.n?'⚾':'');
    let c='cal-cell';
    if(ok(ds))c+=' done';
    if(ds>TODAY)c+=' future';
    if(ds===TODAY)c+=' today';
    if(ds===sel)c+=' sel';
    h+='<button class="'+c+'" data-d="'+ds+'">'+d+'<span class="mk">'+mk+'</span></button>';
  }
  h+='</div><div class="cal-legend">초록칸 = 그날 할 일 전부 완료 🔥<br>✅ 아침 미션 · ⚾ 저녁·주말 훈련<br>주황 테두리 = 오늘 / 파란 칸 = 선택한 날</div>';
  const box=document.getElementById('calCard');
  box.innerHTML=h;
  document.getElementById('prevM').onclick=()=>move(-1);
  document.getElementById('nextM').onclick=()=>move(1);
  box.querySelectorAll('.cal-cell[data-d]').forEach(b=>{b.onclick=()=>{sel=b.dataset.d;draw();};});
}
function move(n){
  let y=+view.slice(0,4), m=+view.slice(5,7)+n;
  if(m<1){m=12;y--;} if(m>12){m=1;y++;}
  view=y+'-'+pad(m); drawCal();
}

/* ====== 뽑기 ====== */
function drawGacha(){
  const box=document.getElementById('gachaCard');
  if(D.tickets<=0&&D.coupons.length===0){box.style.display='none';return;}
  box.style.display='';
  let h='';
  if(D.tickets>0){
    h+='<div class="gbox"><div class="ttl">🎁 보상 뽑기</div><div class="gname" id="gName">뽑기권 '+D.tickets+'장 있어요!</div><button class="btn" id="spinBtn">뽑기 돌리기 🎰</button></div>';
  }
  if(D.coupons.length){
    h+='<div class="ttl" style="margin-top:'+(D.tickets>0?14:0)+'px">🎟️ 내 쿠폰</div>';
    h+=D.coupons.map((c,i)=>'<div class="cp"><span>'+c+'</span><button data-i="'+i+'">사용</button></div>').join('');
  }
  box.innerHTML=h;
  const sb=document.getElementById('spinBtn');
  if(sb)sb.onclick=spin;
  box.querySelectorAll('.cp button').forEach(b=>{
    b.onclick=()=>{
      const i=+b.dataset.i;
      if(confirm('"'+D.coupons[i]+'"\n\n지금 사용할까요? (아빠 확인)')){D.coupons.splice(i,1);save();draw();}
    };
  });
}
function spin(){
  if(D.tickets<=0)return;
  D.tickets--;
  const el=document.getElementById('gName');
  document.getElementById('spinBtn').disabled=true;
  const win=pickReward();
  let i=0;
  const t=setInterval(()=>{
    el.textContent=REWARDS[Math.floor(Math.random()*REWARDS.length)].n;
    if(++i>13){
      clearInterval(t);
      el.textContent='🎉 '+win;
      D.coupons.push(win);save();
      setTimeout(draw,1600);
    }
  },90);
}

/* ====== 완료 처리 공통 ====== */
function afterDone(){
  const got=checkTicket(sel);
  save();draw();
  if(got) alert('🔥 '+got+'일 연속 성공!\n\n🎁 뽑기권 1장 획득!');
  else if(ok(sel)) alert('오늘 할 일 전부 완료! 👏');
  else alert('좋아! 남은 것도 끝내면 오늘 성공 🔥');
}

/* ====== 아침 미션 ====== */
function drawMorning(dow){
  const box=document.getElementById('morningCard');
  const p=MORNING[dow];
  if(!p){box.style.display='none';return;}
  box.style.display='';
  box.innerHTML=plan(p)+btnHTML(R(sel).m,'doM','undoM','아침 미션 완료! ✅');
  const a=document.getElementById('doM');
  if(a)a.onclick=()=>{rec(sel).m=true;afterDone();};
  const u=document.getElementById('undoM');
  if(u)u.onclick=()=>{if(confirm('완료를 취소할까요?')){rec(sel).m=false;save();draw();}};
}

/* ====== 레슨 / 경기 ====== */
function drawAsk(dow){
  const box=document.getElementById('askCard');
  if(dow===0||sel>TODAY){box.style.display='none';return;}
  box.style.display='';
  const r=R(sel);
  if(dow===6){
    box.innerHTML='<div class="ttl">🗓️ 이 날 경기 있어?</div><div class="sub" style="margin-top:6px">경기가 있으면 팀훈련 루틴 대신 경기 전·후 루틴이 나옵니다.</div><button class="btn gray'+(r.g?' on':'')+'" id="gBtn">'+(r.g?'✔ 경기 있는 날':'경기 있는 날 ⚾')+'</button>';
    document.getElementById('gBtn').onclick=()=>{rec(sel).g=!R(sel).g;save();draw();};
  }else{
    box.innerHTML='<div class="ttl">🗓️ 이 날 레슨 있어?</div><div class="sub" style="margin-top:6px">레슨 있는 날은 2분 쿨다운만. 드릴은 레슨 없는 날로 넘어갑니다.</div><button class="btn gray'+(r.l?' on':'')+'" id="lBtn">'+(r.l?'✔ 레슨 있는 날 (쿨다운만)':'레슨 있는 날 🏟️')+'</button>';
    document.getElementById('lBtn').onclick=()=>{rec(sel).l=!R(sel).l;save();draw();};
  }
}

/* ====== 저녁 / 주말 ====== */
function drawNight(dow){
  const box=document.getElementById('nightCard');
  const r=R(sel);
  let ps=[],mark='',swapTo='';

  if(dow===0)ps=[SUN];
  else if(dow===6)ps=[r.g?GAME:SAT];
  else if(r.l)ps=[COOL];
  else{
    const w=wk(sel);
    const batLeft=(!w.bat||w.bat===sel);
    const pitLeft=(!w.pit||w.pit===sel);
    let pick=r.t||'';
    if(pick==='bat'&&!batLeft)pick='';
    if(pick==='pit'&&!pitLeft)pick='';
    if(!pick)pick=batLeft?'bat':(pitLeft?'pit':'');
    if(pick==='bat'){ps=[BAT,COREA];mark='bat';}
    else if(pick==='pit'){ps=[PIT,COREB];mark='pit';}
    if(pick&&batLeft&&pitLeft&&!r.n&&sel<=TODAY){
      swapTo=(pick==='bat')?'pit':'bat';
    }
  }

  if(!ps.length){
    box.innerHTML='<div class="rest">🎉 이번 주 드릴 다 했어요!<br><span class="sub">오늘 저녁은 쉬거나 가볍게 캐치볼만.</span></div>'
      +btnHTML(r.n,'doN','undoN','오늘 훈련 완료! ✅');
  }else{
    let h=ps.map(plan).join('<div style="height:14px"></div>');
    if(swapTo){
      h+='<button class="btn gray" id="swapBtn">🔄 오늘은 '
        +(swapTo==='bat'?'타격':'투수')+' 드릴로 바꾸기</button>';
    }
    h+=btnHTML(r.n,'doN','undoN','오늘 훈련 완료! ✅');
    box.innerHTML=h;
  }

  const sw=document.getElementById('swapBtn');
  if(sw)sw.onclick=()=>{rec(sel).t=swapTo;save();draw();};

  const a=document.getElementById('doN');
  if(a)a.onclick=()=>{
    rec(sel).n=true;
    if(mark)wk(sel)[mark]=sel;
    afterDone();
  };
  const u=document.getElementById('undoN');
  if(u)u.onclick=()=>{
    if(!confirm('완료를 취소할까요?'))return;
    rec(sel).n=false;
    const w=wk(sel);
    if(w.bat===sel)w.bat='';
    if(w.pit===sel)w.pit='';
    save();draw();
  };
}

/* ====== 전체 그리기 ====== */
function draw(){
  drawCal();
  document.getElementById('streak').textContent=streakNow();
  document.getElementById('best').textContent=bestStreak();
  const d=parseD(sel);
  document.getElementById('today').textContent=(d.getMonth()+1)+'월 '+d.getDate()+'일 ('+YOIL[d.getDay()]+')'+(sel===TODAY?' · 오늘':' · 지난 날 기록 중');
  drawGacha();
  drawMorning(d.getDay());
  drawAsk(d.getDay());
  drawNight(d.getDay());
  save();
}
draw();
