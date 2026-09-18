/* ====== 저장 키 ====== */
const KEY='bq5';

/* ====== 날짜 도우미 ====== */
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseD=s=>{const a=s.split('-');return new Date(+a[0],+a[1]-1,+a[2]);};
const shift=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return ymd(d);};
const TODAY=ymd(new Date());
const YOIL=['일','월','화','수','목','금','토'];

/* ====== 저장 데이터 ====== */
let D=JSON.parse(localStorage.getItem(KEY)||'{}');
if(!D.log)D.log={};
if(!D.weeks)D.weeks={};
if(!D.coupons)D.coupons=[];
if(!D.given)D.given=[];
if(!D.shielded)D.shielded=[];
if(!D.shGiven)D.shGiven=[];
if(!D.rec)D.rec={};
if(D.tickets===undefined)D.tickets=0;
if(D.shields===undefined)D.shields=0;
const save=()=>localStorage.setItem(KEY,JSON.stringify(D));

let sel=TODAY, view=TODAY.slice(0,7);
const R=d=>D.log[d]||{};
function rec(d){if(!D.log[d])D.log[d]={};return D.log[d];}
function weekKey(d){const x=parseD(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return ymd(x);}
function wk(d){const k=weekKey(d);if(!D.weeks[k])D.weeks[k]={bat:'',pit:''};return D.weeks[k];}

/* ====== 소리 & 진동 ====== */
let AC=null;
function beep(f,dur,vol){
  try{
    if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();
    const o=AC.createOscillator(),g=AC.createGain();
    o.connect(g);g.connect(AC.destination);
    o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(vol||0.18,AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+(dur||0.14));
    o.start();o.stop(AC.currentTime+(dur||0.15));
  }catch(e){}
}
function vib(p){try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}}
function fanfare(){[0,140,280,470].forEach((d,i)=>setTimeout(()=>beep([523,659,784,1047][i],.22,.2),d));vib([60,50,60,50,140]);}

/* ====== 하루 성공 기준 ====== */
function ok(d){
  const r=R(d), dow=parseD(d).getDay();
  if(dow===0||dow===6) return !!r.n;
  return !!r.m && !!r.n;
}
const isSh=d=>D.shielded.indexOf(d)>=0;
const okS=d=>ok(d)||isSh(d);
function runTo(date){
  let c=0,cur=date,g=0;
  while(g++<400){ if(!okS(cur))break; c++; cur=shift(cur,-1); }
  return c;
}
function streakNow(){return okS(TODAY)?runTo(TODAY):runTo(shift(TODAY,-1));}
function bestStreak(){
  let b=0;
  const keys=Object.keys(D.log).concat(D.shielded);
  keys.forEach(d=>{if(okS(d)){const r=runTo(d);if(r>b)b=r;}});
  return b;
}

/* ====== 실드 자동 사용 ====== */
function applyShields(){
  if(D.shields<=0)return;
  let cur=shift(TODAY,-1), gaps=[], g=0;
  while(g++<10){ if(okS(cur))break; gaps.push(cur); cur=shift(cur,-1); }
  if(!okS(cur))return;                 // 지킬 연속 기록이 없음
  if(gaps.length===0)return;
  if(gaps.length>D.shields)return;     // 실드가 모자라면 낭비하지 않음
  gaps.forEach(d=>{ D.shielded.push(d); D.shields--; });
  save();
  setTimeout(()=>alert('🛡️ 실드가 '+gaps.length+'일을 막아줬어요!\n연속 기록이 지켜졌습니다.'),400);
}

/* ====== 보상 ====== */
function isMile(n){return MILESTONES.indexOf(n)>=0||(n>30&&n%10===0);}
function checkAwards(date){
  const c=runTo(date); const msg=[];
  if(isMile(c)&&D.given.indexOf(date)<0){D.given.push(date);D.tickets++;msg.push('🎁 뽑기권 +1');}
  if(c>0&&c%7===0&&D.shGiven.indexOf(date)<0&&D.shields<SHIELD_MAX){
    D.shGiven.push(date);D.shields++;msg.push('🛡️ 실드 +1');
  }
  return {c:c,msg:msg};
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

/* ====== 타이머 ====== */
const CUR={m:null,n:null};
function secOf(t){
  const s=String(t||'').replace(/\s/g,'');
  const m=s.match(/(\d+)/);
  if(!m)return 0;
  const v=+m[1];
  if(s.indexOf('분')>=0)return v*60;
  if(s.indexOf('초')>=0)return v;
  return 0;
}
function buildSteps(plans){
  const out=[];
  plans.forEach(p=>p.list.forEach(e=>{
    const s=secOf(e.t);
    if(s>0)out.push({s:s,n:e.n,r:e.r,cue:e.cue});
  }));
  return out;
}
let T={list:[],i:0,left:0,tick:null,paused:false};
function startTimer(which){
  const plans=CUR[which]; if(!plans)return;
  const steps=buildSteps(plans);
  if(!steps.length){alert('이 루틴은 시간이 정해진 동작이 없어요.');return;}
  T.list=steps;T.i=0;T.paused=false;
  document.getElementById('tm').classList.add('on');
  loadStep();
  T.tick=setInterval(()=>{
    if(T.paused)return;
    T.left--;
    if(T.left<=3&&T.left>0)beep(700,.08,.12);
    if(T.left<=0){ nextStep(); return; }
    paint();
  },1000);
}
function loadStep(){
  const s=T.list[T.i];
  T.left=s.s;
  document.getElementById('tName').textContent=s.n;
  document.getElementById('tReps').textContent=s.r||'';
  document.getElementById('tCue').textContent=s.cue?('💡 '+s.cue):'';
  const nx=T.list[T.i+1];
  document.getElementById('tNext').textContent=nx?('다음 ▸ '+nx.n):'마지막 동작!';
  paint();
}
function paint(){
  const s=T.list[T.i];
  const p=100-(T.left/s.s*100);
  document.getElementById('tRing').style.setProperty('--p',p);
  document.getElementById('tTime').textContent=Math.floor(T.left/60)+':'+pad(T.left%60);
  document.getElementById('tStep').textContent='STEP '+(T.i+1)+' / '+T.list.length;
}
function nextStep(){
  if(T.i>=T.list.length-1){ endTimer(true); return; }
  T.i++; beep(980,.18,.22); vib(80); loadStep();
}
function endTimer(done){
  clearInterval(T.tick);
  document.getElementById('tm').classList.remove('on');
  if(done){ fanfare(); setTimeout(()=>alert('🎉 루틴 완주!\n아래 완료 버튼을 눌러 기록하세요.'),300); }
}
document.getElementById('tExit').onclick=()=>{ if(confirm('타이머를 끝낼까요?'))endTimer(false); };
document.getElementById('tSkip').onclick=()=>nextStep();
document.getElementById('tPause').onclick=function(){
  T.paused=!T.paused; this.textContent=T.paused?'계속하기 ▶':'일시정지';
};

/* ====== 달력 ====== */
function drawCal(){
  const y=+view.slice(0,4), m=+view.slice(5,7);
  const lead=new Date(y,m-1,1).getDay(), days=new Date(y,m,0).getDate();
  let h='<div class="cal-head"><button class="cal-nav" id="prevM">‹</button><b>'+y+'. '+pad(m)+'</b><button class="cal-nav" id="nextM">›</button></div><div class="cal-grid">';
  YOIL.forEach((d,i)=>{h+='<div class="cal-dow '+(i===0?'sun':i===6?'sat':'')+'">'+d+'</div>';});
  for(let i=0;i<lead;i++)h+='<div class="cal-cell empty"></div>';
  for(let d=1;d<=days;d++){
    const ds=y+'-'+pad(m)+'-'+pad(d), r=R(ds);
    let mk=isSh(ds)?'🛡️':((r.m?'✅':'')+(r.n?'⚾':''));
    let c='cal-cell';
    if(ok(ds))c+=' done'; else if(isSh(ds))c+=' shld';
    if(ds>TODAY)c+=' future';
    if(ds===TODAY)c+=' today';
    if(ds===sel)c+=' sel';
    h+='<button class="'+c+'" data-d="'+ds+'">'+d+'<span class="mk">'+mk+'</span></button>';
  }
  h+='</div><div class="cal-legend">초록 = 그날 할 일 전부 완료 · 파랑 🛡️ = 실드 사용<br>✅ 아침 · ⚾ 저녁/주말 · 주황테두리 = 오늘</div>';
  const box=document.getElementById('calCard'); box.innerHTML=h;
  document.getElementById('prevM').onclick=()=>move(-1);
  document.getElementById('nextM').onclick=()=>move(1);
  box.querySelectorAll('.cal-cell[data-d]').forEach(b=>{b.onclick=()=>{sel=b.dataset.d;draw();};});
}
function move(n){
  let y=+view.slice(0,4), m=+view.slice(5,7)+n;
  if(m<1){m=12;y--;} if(m>12){m=1;y++;}
  view=y+'-'+pad(m); drawCal();
}

/* ====== 다이아몬드 ====== */
function drawDiamond(){
  const r=R(sel), dow=parseD(sel).getDay(), wknd=(dow===0||dow===6);
  const first=wknd?!!r.n:!!r.m, home=!!r.n&&(wknd||!!r.m);
  ['d1','d2','d3'].forEach(id=>document.getElementById(id).classList.toggle('on',first||home));
  document.getElementById('d1').classList.toggle('on',first||home);
  document.getElementById('d2').classList.toggle('on',home);
  document.getElementById('d3').classList.toggle('on',home);
  document.getElementById('dh').classList.toggle('on',home);
  const msg=document.getElementById('dmsg');
  if(home) msg.innerHTML='<b>⚾ 홈인! 오늘 득점 성공</b>';
  else if(first) msg.textContent='1루 진출 · 저녁 훈련이면 홈인!';
  else msg.textContent=wknd?'아직 타석 · 오늘 루틴을 시작해요':'아직 타석 · 아침 미션부터!';
}

/* ====== 뽑기 ====== */
function drawGacha(){
  const box=document.getElementById('gachaCard');
  if(D.tickets<=0&&D.coupons.length===0){box.style.display='none';return;}
  box.style.display='';
  let h='';
  if(D.tickets>0){
    h+='<div class="gbox"><div class="ttl">🎁 보상 뽑기</div><div class="gname" id="gName">뽑기권 '+D.tickets+'장!</div><button class="btn" id="spinBtn">뽑기 돌리기 🎰</button></div>';
  }
  if(D.coupons.length){
    if(D.tickets>0)h+='<div class="stitch"></div>';
    h+='<div class="ttl">🎟️ 내 쿠폰</div>';
    h+=D.coupons.map((c,i)=>'<div class="cp"><span>'+c+'</span><button data-i="'+i+'">사용</button></div>').join('');
  }
  box.innerHTML=h;
  const sb=document.getElementById('spinBtn'); if(sb)sb.onclick=spin;
  box.querySelectorAll('.cp button').forEach(b=>{
    b.onclick=()=>{const i=+b.dataset.i;
      if(confirm('"'+D.coupons[i]+'"\n\n지금 사용할까요? (아빠 확인)')){D.coupons.splice(i,1);save();draw();}};
  });
}
function spin(){
  if(D.tickets<=0)return;
  D.tickets--;
  const el=document.getElementById('gName');
  document.getElementById('spinBtn').disabled=true;
  const win=pickReward(); let i=0;
  const t=setInterval(()=>{
    el.textContent=REWARDS[Math.floor(Math.random()*REWARDS.length)].n;
    beep(500+Math.random()*300,.05,.08);
    if(++i>14){clearInterval(t);el.textContent='🎉 '+win;D.coupons.push(win);save();fanfare();setTimeout(draw,1700);}
  },90);
}

/* ====== 기록실 ====== */
function drawRec(){
  let h='<div class="ttl">🏆 기록실 · MY BEST</div><div class="sub" style="margin:6px 0 4px">기록을 깨면 여기에 남습니다. 무리해서 재지 말고 컨디션 좋은 날에만.</div>';
  h+=RECORDS.map(r=>{
    const d=D.rec[r.k];
    const val=d?('<span class="vl">'+d.v+'<u>'+r.u+'</u></span>'):'<span class="vl" style="color:#3d566c">–</span>';
    const sub=d?('최고 기록 · '+d.d.slice(5).replace('-','/')):r.h;
    return '<div class="rec"><span class="em">'+r.e+'</span><span class="nm">'+r.n+'<small>'+sub+'</small></span>'+val+'<button data-k="'+r.k+'">입력</button></div>';
  }).join('');
  const box=document.getElementById('recCard'); box.innerHTML=h;
  box.querySelectorAll('.rec button').forEach(b=>{
    b.onclick=()=>{
      const r=RECORDS.find(x=>x.k===b.dataset.k);
      const cur=D.rec[r.k];
      const inp=prompt(r.e+' '+r.n+'\n단위: '+r.u+(cur?('\n현재 최고: '+cur.v+r.u):''),'');
      if(inp===null)return;
      const v=parseFloat(inp);
      if(isNaN(v)||v<=0){alert('숫자로 입력해주세요.');return;}
      const better=!cur||(r.low?v<cur.v:v>cur.v);
      if(better){
        const old=cur?cur.v:null;
        D.rec[r.k]={v:v,d:TODAY};save();drawRec();fanfare();
        alert('🏆 신기록!\n\n'+r.n+'\n'+(old!==null?(old+r.u+' → '):'')+v+r.u);
      }else{
        alert('기록 '+v+r.u+' 확인!\n현재 최고는 '+cur.v+r.u+'입니다. 다음엔 깰 수 있어요 💪');
      }
    };
  });
}

/* ====== 완료 처리 ====== */
function afterDone(){
  const a=checkAwards(sel);
  save();draw();
  if(a.msg.length){ fanfare(); alert('🔥 '+a.c+'일 연속 성공!\n\n'+a.msg.join('\n')); }
  else if(ok(sel)){ beep(880,.2,.2);vib(90); alert('⚾ 홈인! 오늘 할 일 전부 완료 👏'); }
  else { beep(660,.15,.18); alert('1루 진출! 남은 것도 끝내면 오늘 득점 🔥'); }
}

/* ====== 아침 ====== */
function drawMorning(dow){
  const box=document.getElementById('morningCard'), p=MORNING[dow];
  CUR.m=null;
  if(!p){box.style.display='none';return;}
  box.style.display='';
  CUR.m=[p];
  box.innerHTML=plan(p)
    +'<button class="btn timer" id="tmM">▶ 타이머 따라하기</button>'
    +btnHTML(R(sel).m,'doM','undoM','아침 미션 완료! ✅');
  document.getElementById('tmM').onclick=()=>startTimer('m');
  const a=document.getElementById('doM'); if(a)a.onclick=()=>{rec(sel).m=true;afterDone();};
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
  const box=document.getElementById('nightCard'), r=R(sel);
  let ps=[],mark='',swapTo='';
  CUR.n=null;
  if(dow===0)ps=[SUN];
  else if(dow===6)ps=[r.g?GAME:SAT];
  else if(r.l)ps=[COOL];
  else{
    const w=wk(sel);
    const batLeft=(!w.bat||w.bat===sel), pitLeft=(!w.pit||w.pit===sel);
    let pick=r.t||'';
    if(pick==='bat'&&!batLeft)pick='';
    if(pick==='pit'&&!pitLeft)pick='';
    if(!pick)pick=batLeft?'bat':(pitLeft?'pit':'');
    if(pick==='bat'){ps=[BAT,COREA];mark='bat';}
    else if(pick==='pit'){ps=[PIT,COREB];mark='pit';}
    if(pick&&batLeft&&pitLeft&&!r.n&&sel<=TODAY)swapTo=(pick==='bat')?'pit':'bat';
  }
  let h='';
  if(!ps.length){
    h='<div class="rest">🎉 이번 주 드릴 다 했어요!<br><span class="sub">오늘 저녁은 쉬거나 가볍게 캐치볼만.</span></div>';
  }else{
    CUR.n=ps;
    h=ps.map(plan).join('<div class="stitch"></div>');
    h+='<button class="btn timer" id="tmN">▶ 타이머 따라하기</button>';
    if(swapTo)h+='<button class="btn gray" id="swapBtn">🔄 오늘은 '+(swapTo==='bat'?'타격':'투수')+' 드릴로 바꾸기</button>';
  }
  h+=btnHTML(r.n,'doN','undoN','오늘 훈련 완료! ✅');
  box.innerHTML=h;
  const tb=document.getElementById('tmN'); if(tb)tb.onclick=()=>startTimer('n');
  const sw=document.getElementById('swapBtn'); if(sw)sw.onclick=()=>{rec(sel).t=swapTo;save();draw();};
  const a=document.getElementById('doN');
  if(a)a.onclick=()=>{rec(sel).n=true;if(mark)wk(sel)[mark]=sel;afterDone();};
  const u=document.getElementById('undoN');
  if(u)u.onclick=()=>{
    if(!confirm('완료를 취소할까요?'))return;
    rec(sel).n=false;
    const w=wk(sel); if(w.bat===sel)w.bat=''; if(w.pit===sel)w.pit='';
    save();draw();
  };
}

/* ====== 전체 그리기 ====== */
function draw(){
  drawCal();
  document.getElementById('streak').textContent=streakNow();
  document.getElementById('best').textContent=bestStreak();
  document.getElementById('shield').textContent=D.shields;
  const d=parseD(sel);
  document.getElementById('today').textContent=
    (d.getMonth()+1)+'월 '+d.getDate()+'일 ('+YOIL[d.getDay()]+')'+(sel===TODAY?' · TODAY':' · 지난 날 기록 중');
  drawDiamond();
  drawGacha();
  drawMorning(d.getDay());
  drawAsk(d.getDay());
  drawNight(d.getDay());
  drawRec();
  save();
}
applyShields();
draw();
