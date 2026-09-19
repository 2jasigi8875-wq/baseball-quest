/* ====== 저장 ====== */
const KEY='bq5', OLDKEY='bq4';
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseD=s=>{const a=s.split('-');return new Date(+a[0],+a[1]-1,+a[2]);};
const shift=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return ymd(d);};
const TODAY=ymd(new Date());
const YOIL=['일','월','화','수','목','금','토'];
const $=id=>document.getElementById(id);
const EVERY=(typeof TICKET_EVERY!=='undefined')?TICKET_EVERY:3;
const SMAX=(typeof SHIELD_MAX!=='undefined')?SHIELD_MAX:2;

let D=JSON.parse(localStorage.getItem(KEY)||'null');
if(!D) D=JSON.parse(localStorage.getItem(OLDKEY)||'{}');   /* 예전 기록 이어받기 */
if(!D.log)D.log={};
if(!D.weeks)D.weeks={};
if(!D.coupons)D.coupons=[];
if(!D.given)D.given=[];
if(!D.sgiven)D.sgiven=[];
if(!D.shld)D.shld={};
if(!D.rec)D.rec={};
if(D.tickets===undefined)D.tickets=0;
if(D.shields===undefined)D.shields=0;
const save=()=>localStorage.setItem(KEY,JSON.stringify(D));

let sel=TODAY, view=TODAY.slice(0,7), SCREEN=[];
const R=d=>D.log[d]||{};
function rec(d){if(!D.log[d])D.log[d]={};return D.log[d];}
function weekKey(d){const x=parseD(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return ymd(x);}
function wk(d){const k=weekKey(d);if(!D.weeks[k])D.weeks[k]={bat:'',pit:''};return D.weeks[k];}

/* ====== 소리 · 진동 ====== */
let AC=null;
function tone(f,dur,delay){
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state==='suspended')AC.resume();
    const o=AC.createOscillator(),g=AC.createGain(),t0=AC.currentTime+(delay||0);
    o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(.0001,t0);
    g.gain.exponentialRampToValueAtTime(.3,t0+.02);
    g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
    o.connect(g);g.connect(AC.destination);o.start(t0);o.stop(t0+dur+.05);
  }catch(e){}
}
function beep(){tone(880,.18);tone(1175,.22,.16);if(navigator.vibrate)navigator.vibrate([120,60,120]);}
function fanfare(){[523,659,784,1047].forEach((f,i)=>tone(f,.26,i*.13));if(navigator.vibrate)navigator.vibrate([90,50,90,50,220]);}

/* ====== 화면 꺼짐 방지 ====== */
let WL=null;
async function keepAwake(){try{if('wakeLock' in navigator)WL=await navigator.wakeLock.request('screen');}catch(e){}}
function releaseAwake(){try{if(WL){WL.release();WL=null;}}catch(e){}}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&$('tm').classList.contains('on'))keepAwake();
});

/* ====== 하루 성공 기준 ====== */
function ok(d){
  const r=R(d), dow=parseD(d).getDay();
  if(dow===0||dow===6) return !!r.n;
  return !!r.m && !!r.n;
}
function okS(d){return ok(d)||!!D.shld[d];}
function runTo(date){
  let c=0,cur=date,g=0;
  while(g++<400){ if(!okS(cur))break; c++; cur=shift(cur,-1); }
  return c;
}
function streakNow(){return okS(TODAY)?runTo(TODAY):runTo(shift(TODAY,-1));}
function bestStreak(){
  let b=0, all={};
  Object.keys(D.log).forEach(d=>all[d]=1);
  Object.keys(D.shld).forEach(d=>all[d]=1);
  Object.keys(all).forEach(d=>{if(okS(d)){const r=runTo(d);if(r>b)b=r;}});
  return Math.max(b,D.best||0);
}

/* ====== 실드 자동 사용 ====== */
function autoShield(){
  let used=[], d=shift(TODAY,-1), g=0;
  while(g++<SMAX+1){
    if(okS(d))break;
    if(D.shields<=0)break;
    if(runTo(shift(d,-1))<1)break;
    D.shields--; D.shld[d]=true; used.push(d);
    d=shift(d,-1);
  }
  if(used.length){
    save();
    if(D.alerted!==TODAY){
      D.alerted=TODAY;save();
      setTimeout(()=>alert('🛡️ 실드 '+used.length+'개 사용!\n\n'+used.join(', ')+' 빠진 날을 막아서 연속 기록이 살았어요.'),300);
    }
  }
}

/* ====== 뽑기권 · 실드 지급 ====== */
function isMile(n){return n>0&&n%EVERY===0;}
function checkRewards(date){
  const c=runTo(date); let got={t:0,s:0,c:c};
  if(isMile(c)&&D.given.indexOf(date)<0){D.given.push(date);D.tickets++;got.t=1;}
  if(c%7===0&&D.sgiven.indexOf(date)<0&&D.shields<SMAX){D.sgiven.push(date);D.shields++;got.s=1;}
  return got;
}
function pickReward(){
  const tot=REWARDS.reduce((a,b)=>a+b.w,0);
  let r=Math.random()*tot;
  for(let i=0;i<REWARDS.length;i++){r-=REWARDS[i].w;if(r<0)return REWARDS[i].n;}
  return REWARDS[0].n;
}

/* ====== 타이머 ====== */
let T={list:[],i:0,left:0,tot:0,run:false,int:null,manual:false,title:''};
function secOf(t){
  if(!t)return 0;
  const s=String(t); let v=0;
  const m=s.match(/(\d+)\s*분/); if(m)v+=+m[1]*60;
  const c=s.match(/(\d+)\s*초/); if(c)v+=+c[1];
  return v;
}
const fmt=x=>Math.floor(x/60)+':'+pad(x%60);
function startPlan(p){
  if(!p||!p.list||!p.list.length)return;
  T.list=p.list;T.i=0;T.title=p.title;
  $('tm').classList.add('on');
  tone(660,.12);keepAwake();loadStep();
}
function loadStep(){
  clearInterval(T.int);
  if(T.i>=T.list.length){finishPlan();return;}
  const e=T.list[T.i], nx=T.list[T.i+1];
  $('tStep').textContent=(T.i+1)+' / '+T.list.length;
  $('tName').textContent=e.n||'';
  $('tReps').textContent=e.r||'';
  $('tCue').innerHTML=(e.cue?'💡 '+e.cue:'')+(e.bad?'<br>⚠️ '+e.bad:'');
  $('tNext').textContent=nx?('다음 ▸ '+nx.n):'마지막 동작이에요';
  const s=secOf(e.t);
  if(s>0){
    T.manual=false;T.tot=s;T.left=s;T.run=true;
    $('tPause').textContent='일시정지';
    paint();
    T.int=setInterval(tick,1000);
  }else{
    T.manual=true;T.run=false;T.tot=0;T.left=0;
    $('tTime').textContent=e.t||'—';
    $('tRing').style.setProperty('--p',100);
    $('tPause').textContent='다 했어요 ▸';
  }
}
function paint(){
  $('tTime').textContent=fmt(T.left);
  $('tRing').style.setProperty('--p',T.tot?((T.tot-T.left)/T.tot*100):0);
}
function tick(){
  if(!T.run)return;
  T.left--;
  if(T.left>0&&T.left<=3)tone(700,.07);
  if(T.left<=0){clearInterval(T.int);beep();T.i++;setTimeout(loadStep,350);return;}
  paint();
}
function closeTimer(){clearInterval(T.int);T.run=false;$('tm').classList.remove('on');releaseAwake();}
function finishPlan(){
  closeTimer();fanfare();
  setTimeout(()=>alert('🎉 '+T.title+' 끝!\n\n아래 완료 버튼 눌러서 기록하자.'),250);
}
$('tExit').onclick=()=>{if(confirm('훈련을 중단할까요?'))closeTimer();};
$('tSkip').onclick=()=>{clearInterval(T.int);T.i++;loadStep();};
$('tPause').onclick=()=>{
  if(T.manual){T.i++;loadStep();return;}
  T.run=!T.run;
  $('tPause').textContent=T.run?'일시정지':'계속하기';
};

/* ====== 화면 조각 ====== */
function item(e){
  const warn=e.c==='h'?' 🔴':(e.c==='m'?' 🟠':'');
  const reps=e.r?'<i>'+e.r+'</i>':'';
  const cue=e.cue?'<div>💡 '+e.cue+'</div>':'';
  const bad=e.bad?'<div>⚠️ 흔한 실수: '+e.bad+'</div>':'';
  const yt=e.v?'<div><a href="https://www.youtube.com/results?search_query='+encodeURIComponent(e.v)+'" target="_blank">▶ 영상 검색</a></div>':'';
  return '<details><summary><b>'+(e.t||'—')+'</b><span>'+e.n+warn+'</span>'+reps+'</summary><div class="dt">'+cue+bad+yt+'</div></details>';
}
function plan(p){
  const i=SCREEN.length; SCREEN.push(p);
  const eq=p.equip?'<span class="eq">'+p.equip+'</span>':'';
  const note=p.note?'<div class="sub" style="margin:6px 0 8px">'+p.note+'</div>':'';
  return '<div class="ttl">'+p.title+eq+'</div>'+note
    +p.list.map(item).join('')
    +'<button class="btn timer" data-run="'+i+'">▶ 타이머로 따라하기</button>';
}
function btnHTML(done,doId,undoId,label){
  if(sel>TODAY)return '<button class="btn" disabled>아직 오지 않은 날이에요</button>';
  if(done)return '<button class="btn" disabled>완료했어요 👍</button><button class="btn gray" id="'+undoId+'">완료 취소</button>';
  return '<button class="btn" id="'+doId+'">'+label+'</button>';
}

/* ====== 다이아몬드 ====== */
function drawDia(){
  const s=streakNow(), m=s%EVERY, home=(s>0&&m===0);
  const on=home?4:m;
  ['d1','d2','d3','dh'].forEach((id,i)=>$(id).classList.toggle('on',home?true:(i<on)));
  let msg;
  if(s===0)msg='타석에 들어섰어요. 오늘 미션 완료하면 <b>1루</b>!';
  else if(home)msg='🎉 홈인! <b>'+s+'일 연속</b> · 뽑기권 획득!';
  else msg='<b>'+s+'일 연속</b> · '+m+'루 · 홈까지 <b>'+(EVERY-m)+'일</b>';
  $('dmsg').innerHTML=msg;
}

/* ====== 달력 ====== */
function drawCal(){
  const y=+view.slice(0,4), m=+view.slice(5,7);
  const lead=new Date(y,m-1,1).getDay(), days=new Date(y,m,0).getDate();
  let h='<div class="cal-head"><button class="cal-nav" id="prevM">‹</button><b>'+y+'년 '+m+'월</b><button class="cal-nav" id="nextM">›</button></div><div class="cal-grid">';
  YOIL.forEach((d,i)=>{h+='<div class="cal-dow '+(i===0?'sun':i===6?'sat':'')+'">'+d+'</div>';});
  for(let i=0;i<lead;i++)h+='<div class="cal-cell empty"></div>';
  for(let d=1;d<=days;d++){
    const ds=y+'-'+pad(m)+'-'+pad(d), r=R(ds);
    const mk=D.shld[ds]?'🛡':((r.m?'✅':'')+(r.n?'⚾':''));
    let c='cal-cell';
    if(ok(ds))c+=' done'; else if(D.shld[ds])c+=' shld';
    if(ds>TODAY)c+=' future';
    if(ds===TODAY)c+=' today';
    if(ds===sel)c+=' sel';
    h+='<button class="'+c+'" data-d="'+ds+'">'+d+'<span class="mk">'+mk+'</span></button>';
  }
  h+='</div><div class="cal-legend">초록칸 = 그날 할 일 전부 완료 🔥 · 파란칸 = 실드로 지킨 날 🛡<br>✅ 아침 미션 · ⚾ 저녁·주말 훈련<br>주황 테두리 = 오늘 / 파란 테두리 = 선택한 날</div>';
  const box=$('calCard'); box.innerHTML=h;
  $('prevM').onclick=()=>move(-1);
  $('nextM').onclick=()=>move(1);
  box.querySelectorAll('.cal-cell[data-d]').forEach(b=>{b.onclick=()=>{sel=b.dataset.d;draw();};});
}
function move(n){
  let y=+view.slice(0,4), m=+view.slice(5,7)+n;
  if(m<1){m=12;y--;} if(m>12){m=1;y++;}
  view=y+'-'+pad(m); drawCal();
}

/* ====== 뽑기 ====== */
function drawGacha(){
  const box=$('gachaCard');
  if(D.tickets<=0&&D.coupons.length===0){box.style.display='none';return;}
  box.style.display='';
  let h='';
  if(D.tickets>0)
    h+='<div class="gbox"><div class="ttl">🎁 보상 뽑기</div><div class="gname" id="gName">뽑기권 '+D.tickets+'장 있어요!</div><button class="btn" id="spinBtn">뽑기 돌리기 🎰</button></div>';
  if(D.coupons.length){
    h+='<div class="ttl" style="margin-top:'+(D.tickets>0?14:0)+'px">🎟️ 내 쿠폰</div>';
    h+=D.coupons.map((c,i)=>'<div class="cp"><span>'+c+'</span><button data-i="'+i+'">사용</button></div>').join('');
  }
  box.innerHTML=h;
  const sb=$('spinBtn'); if(sb)sb.onclick=spin;
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
  const el=$('gName'); $('spinBtn').disabled=true;
  const win=pickReward(); let i=0;
  const t=setInterval(()=>{
    el.textContent=REWARDS[Math.floor(Math.random()*REWARDS.length)].n;
    tone(1000,.04);
    if(++i>13){
      clearInterval(t);
      el.textContent='🎉 '+win;
      D.coupons.push(win);save();fanfare();
      setTimeout(draw,1700);
    }
  },90);
}

/* ====== 완료 처리 ====== */
function afterDone(){
  const g=checkRewards(sel);
  if(g.t||g.s)fanfare();
  save();draw();
  let msg='';
  if(g.t)msg+='🔥 '+g.c+'일 연속 성공!\n🎁 뽑기권 1장 획득!\n';
  if(g.s)msg+='🛡️ 실드 1개 획득! (하루 빠져도 연속 유지)\n';
  if(msg)alert(msg);
  else if(ok(sel))alert('오늘 할 일 전부 완료! 👏');
  else alert('좋아! 남은 것도 끝내면 오늘 성공 🔥');
}

/* ====== 아침 미션 ====== */
function drawMorning(dow){
  const box=$('morningCard'), p=MORNING[dow];
  if(!p){box.style.display='none';return;}
  box.style.display='';
  box.innerHTML=plan(p)+btnHTML(R(sel).m,'doM','undoM','아침 미션 완료! ✅');
  const a=$('doM'); if(a)a.onclick=()=>{rec(sel).m=true;afterDone();};
  const u=$('undoM'); if(u)u.onclick=()=>{if(confirm('완료를 취소할까요?')){rec(sel).m=false;save();draw();}};
}

/* ====== 레슨 / 경기 ====== */
function drawAsk(dow){
  const box=$('askCard');
  if(dow===0||sel>TODAY){box.style.display='none';return;}
  box.style.display='';
  const r=R(sel);
  if(dow===6){
    box.innerHTML='<div class="ttl">🗓️ 이 날 경기 있어?</div><div class="sub" style="margin-top:6px">경기가 있으면 팀훈련 루틴 대신 경기 전·후 루틴이 나옵니다.</div><button class="btn gray'+(r.g?' on':'')+'" id="gBtn">'+(r.g?'✔ 경기 있는 날':'경기 있는 날 ⚾')+'</button>';
    $('gBtn').onclick=()=>{rec(sel).g=!R(sel).g;save();draw();};
  }else{
    box.innerHTML='<div class="ttl">🗓️ 이 날 레슨 있어?</div><div class="sub" style="margin-top:6px">레슨 있는 날은 2분 쿨다운만. 드릴은 레슨 없는 날로 넘어갑니다.</div><button class="btn gray'+(r.l?' on':'')+'" id="lBtn">'+(r.l?'✔ 레슨 있는 날 (쿨다운만)':'레슨 있는 날 🏟️')+'</button>';
    $('lBtn').onclick=()=>{rec(sel).l=!R(sel).l;save();draw();};
  }
}

/* ====== 저녁 / 주말 ====== */
function drawNight(dow){
  const box=$('nightCard'), r=R(sel);
  let ps=[],mark='',swapTo='';
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
  if(!ps.length){
    box.innerHTML='<div class="rest">🎉 이번 주 드릴 다 했어요!<br><span class="sub">오늘 저녁은 쉬거나 가볍게 캐치볼만.</span></div>'
      +btnHTML(r.n,'doN','undoN','오늘 훈련 완료! ✅');
  }else{
    let h=ps.map(plan).join('<div style="height:14px"></div>');
    if(swapTo)h+='<button class="btn gray" id="swapBtn">🔄 오늘은 '+(swapTo==='bat'?'타격':'투수')+' 드릴로 바꾸기</button>';
    h+=btnHTML(r.n,'doN','undoN','오늘 훈련 완료! ✅');
    box.innerHTML=h;
  }
  const sw=$('swapBtn'); if(sw)sw.onclick=()=>{rec(sel).t=swapTo;save();draw();};
  const a=$('doN'); if(a)a.onclick=()=>{rec(sel).n=true;if(mark)wk(sel)[mark]=sel;afterDone();};
  const u=$('undoN'); if(u)u.onclick=()=>{
    if(!confirm('완료를 취소할까요?'))return;
    rec(sel).n=false;
    const w=wk(sel); if(w.bat===sel)w.bat=''; if(w.pit===sel)w.pit='';
    save();draw();
  };
}

/* ====== 기록실 ====== */
function drawRec(){
  const box=$('recCard');
  let h='<div class="ttl">🏆 기록실</div><div class="sub" style="margin:6px 0 4px">기록을 새로 쓰면 팡파레가 울려요.</div>';
  h+=RECORDS.map(r=>{
    const v=D.rec[r.k];
    return '<div class="rec"><span class="em">'+(r.e||'🏅')+'</span>'
      +'<span class="nm">'+r.n+(r.h?'<small>'+r.h+'</small>':'')+'</span>'
      +'<span class="vl">'+(v!==undefined?v:'-')+'<u>'+r.u+'</u></span>'
      +'<button data-k="'+r.k+'">기록</button></div>';
  }).join('');
  box.innerHTML=h;
  box.querySelectorAll('.rec button').forEach(b=>{
    b.onclick=()=>{
      const k=b.dataset.k, r=RECORDS.filter(x=>x.k===k)[0];
      const v=prompt(r.n+' ('+r.u+')\n'+(r.h||''),D.rec[k]!==undefined?D.rec[k]:'');
      if(v===null)return;
      const n=parseFloat(v); if(isNaN(n))return;
      const old=D.rec[k], low=r.low===true;
      const isNew=(old===undefined)||(low?n<old:n>old);
      if(isNew){
        D.rec[k]=n;save();fanfare();
        alert('🏆 신기록!\n\n'+(old!==undefined?old+r.u+' → ':'')+n+r.u);
      }else{
        alert('아쉽다! 최고 기록은 '+old+r.u+'\n다음엔 꼭 넘어보자 💪');
      }
      draw();
    };
  });
}

/* ====== 전체 그리기 ====== */
function draw(){
  SCREEN=[];
  const s=streakNow(), b=bestStreak();
  if(b>(D.best||0))D.best=b;
  $('streak').textContent=s;
  $('best').textContent=D.best||0;
  $('shield').textContent=D.shields;
  drawDia();
  drawCal();
  const d=parseD(sel);
  $('today').textContent=(d.getMonth()+1)+'월 '+d.getDate()+'일 ('+YOIL[d.getDay()]+')'+(sel===TODAY?' · 오늘':' · 지난 날 기록 중');
  drawGacha();
  drawMorning(d.getDay());
  drawAsk(d.getDay());
  drawNight(d.getDay());
  drawRec();
  document.querySelectorAll('[data-run]').forEach(b=>{
    b.onclick=()=>startPlan(SCREEN[+b.dataset.run]);
  });
  save();
}

autoShield();
draw();
