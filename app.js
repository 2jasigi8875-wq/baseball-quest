/* ====== 저장 키 (바꾸면 기록 초기화됨) ====== */
const KEY='bq5';

/* ====== 날짜 도우미 ====== */
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseD=s=>{const p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2]);};
const shift=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return ymd(d);};
const TODAY=ymd(new Date());
const YOIL=['일','월','화','수','목','금','토'];
const dow=d=>parseD(d).getDay();
function mondayOf(s){const d=parseD(s);return shift(s,-((d.getDay()+6)%7));}

/* ====== 저장 데이터 ====== */
let D=JSON.parse(localStorage.getItem(KEY)||'{}');
if(!D.log)D.log={};
if(!D.weeks)D.weeks={};
if(!D.coupons)D.coupons=[];
if(!D.given)D.given=[];
if(!D.sgiven)D.sgiven=[];
if(D.tickets===undefined)D.tickets=0;
if(D.shields===undefined)D.shields=0;
if(D.best===undefined)D.best=0;
if(!D.rec)D.rec={};
const save=()=>localStorage.setItem(KEY,JSON.stringify(D));

let sel=TODAY;
let view=TODAY.slice(0,7);

function rec(d){if(!D.log[d])D.log[d]={};return D.log[d];}
function R(d){return D.log[d]||{};}
function wk(d){const m=mondayOf(d);if(!D.weeks[m])D.weeks[m]={bat:'',pit:''};return D.weeks[m];}

/* ====== 성공 판정 ====== */
function ok(d){
  const r=R(d);
  if(r.s)return true;
  const w=dow(d);
  if(w===0||w===6)return !!r.n;
  return !!r.m&&!!r.n;
}

/* ====== 연속일 ====== */
function runTo(date){
  let c=0,cur=date,g=0;
  while(g++<400){if(ok(cur))c++;else break;cur=shift(cur,-1);}
  return c;
}
function streakNow(){return ok(TODAY)?runTo(TODAY):runTo(shift(TODAY,-1));}
function bestStreak(){
  let b=0;
  Object.keys(D.log).forEach(d=>{if(ok(d)){const r=runTo(d);if(r>b)b=r;}});
  return b;
}

/* ====== 실드 자동 사용 ====== */
function firstDay(){const k=Object.keys(D.log).sort();return k.length?k[0]:TODAY;}
function autoShield(){
  if(!Object.keys(D.log).length)return;
  const f=firstDay();
  for(let i=7;i>=1;i--){
    const d=shift(TODAY,-i);
    if(d<f)continue;
    const r=R(d);
    if(r.s||ok(d))continue;
    if(D.shields>0){D.shields--;rec(d).s=true;}
  }
}

/* ====== 소리 · 진동 ====== */
let AC=null;
function tone(f,dur,delay){
  try{
    if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state==='suspended')AC.resume();
    const o=AC.createOscillator(),g=AC.createGain();
    o.connect(g);g.connect(AC.destination);
    o.frequency.value=f;
    const t=AC.currentTime+delay;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(.25,t+.02);
    g.gain.linearRampToValueAtTime(0,t+dur);
    o.start(t);o.stop(t+dur+.03);
  }catch(e){}
}
function beep(){
  tone(880,.15,0);tone(880,.15,.22);tone(1175,.32,.44);
  if(navigator.vibrate)navigator.vibrate([200,100,200,100,350]);
}
function fanfare(){
  tone(660,.15,0);tone(880,.15,.16);tone(1047,.15,.32);tone(1319,.45,.48);
  if(navigator.vibrate)navigator.vibrate([150,80,150,80,150,80,450]);
}

/* ====== 화면 꺼짐 방지 ====== */
let WL=null;
async function keepAwake(){
  try{
    if('wakeLock' in navigator){
      WL=await navigator.wakeLock.request('screen');
      WL.addEventListener('release',()=>{WL=null;});
    }
  }catch(e){}
}
function releaseAwake(){try{if(WL){WL.release();WL=null;}}catch(e){}}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'
   &&document.getElementById('tm').classList.contains('on')
   &&WL===null)keepAwake();
});

/* ====== 타이머 ====== */
let T={steps:[],i:0,left:0,tid:null,paused:false};
function secOf(t){
  if(!t)return 0;
  const m=String(t).match(/(\d+)\s*(분|초)/);
  if(!m)return 0;
  return m[2]==='분'?(+m[1])*60:(+m[1]);
}
function stepsOf(plans){
  let out=[];
  plans.forEach(p=>{
    p.list.forEach(e=>{
      const s=secOf(e.t);
      if(s>0)out.push({n:e.n,s:s,cue:e.cue||e.r||''});
    });
  });
  return out;
}
function startTimer(plans){
  const st=stepsOf(plans);
  if(!st.length){alert('타이머로 돌릴 수 있는 항목이 없어요.');return;}
  T.steps=st;T.i=0;T.paused=false;
  document.getElementById('tpause').textContent='일시정지';
  document.getElementById('tm').classList.add('on');
  keepAwake();
  tone(660,.12,0);
  loadStep();
}
function loadStep(){
  const s=T.steps[T.i];
  T.left=s.s;
  document.getElementById('tname').textContent=s.n;
  document.getElementById('tcue').textContent=s.cue;
  document.getElementById('tstep').textContent=(T.i+1)+' / '+T.steps.length;
  tick();
  clearInterval(T.tid);
  T.tid=setInterval(()=>{
    if(T.paused)return;
    T.left--;
    if(T.left<=0){
      if(T.i<T.steps.length-1){beep();T.i++;loadStep();}
      else{clearInterval(T.tid);endTimer(true);}
      return;
    }
    tick();
  },1000);
}
function tick(){
  const s=T.steps[T.i];
  const m=Math.floor(T.left/60),sec=T.left%60;
  document.getElementById('tnum').textContent=m>0?(m+':'+pad(sec)):sec;
  const deg=360*(1-T.left/s.s);
  document.getElementById('tring').style.background=
    'conic-gradient(var(--orange) '+deg+'deg,#1e3a57 '+deg+'deg)';
}
function endTimer(done){
  clearInterval(T.tid);
  document.getElementById('tm').classList.remove('on');
  releaseAwake();
  if(done){fanfare();setTimeout(()=>alert('⏰ 전부 끝났어요! 잘했어 👏'),300);}
}
document.getElementById('tpause').onclick=function(){
  T.paused=!T.paused;this.textContent=T.paused?'계속하기':'일시정지';
};
document.getElementById('tskip').onclick=()=>{
  if(T.i<T.steps.length-1){T.i++;loadStep();}else endTimer(true);
};
document.getElementById('texit').onclick=()=>endTimer(false);

/* ====== 다이아몬드 ====== */
function drawDiamond(){
  const r=R(sel),w=dow(sel);
  let cnt=0,tx='';
  if(w===0||w===6){cnt=r.n?4:0;tx=r.n?'🏆 홈런!':'오늘 훈련 시작 전';}
  else{
    if(r.m)cnt++;
    if(r.n)cnt+=3;
    tx=cnt===0?'타석에 들어섰어요':(cnt===1?'1루 진출! (아침 완료)':
       (cnt===3?'3루! (저녁 완료)':'🏆 홈런! 오늘 미션 완료'));
  }
  ['bs1','bs2','bs3','bsh'].forEach((id,i)=>{
    document.getElementById(id).classList.toggle('on',cnt>i);
  });
  document.getElementById('diatx').textContent=tx;
}

/* ====== 달력 ====== */
function drawCal(){
  const y=+view.slice(0,4),m=+view.slice(5,7);
  const first=new Date(y,m-1,1),last=new Date(y,m,0).getDate();
  let h='<div class="ch"><button class="cn" id="pv">‹</button><b>'+y+'년 '+m+'월</b>'
       +'<button class="cn" id="nx">›</button></div><div class="cg">';
  ['일','월','화','수','목','금','토'].forEach((d,i)=>{
    h+='<div class="cd'+(i===0?' s':(i===6?' t':''))+'">'+d+'</div>';
  });
  for(let i=0;i<first.getDay();i++)h+='<div class="cc e"></div>';
  for(let i=1;i<=last;i++){
    const ds=y+'-'+pad(m)+'-'+pad(i);
    const r=R(ds);
    let c='cc';
    if(r.s)c+=' shield';else if(ok(ds))c+=' done';
    if(ds===TODAY)c+=' t';
    if(ds===sel)c+=' sel';
    if(ds>TODAY)c+=' f';
    let mk='';
    if(r.s)mk='🛡️';else{if(r.m)mk+='✅';if(r.n)mk+='⚾';}
    h+='<button class="'+c+'" data-d="'+ds+'">'+i+'<span class="mk">'+mk+'</span></button>';
  }
  h+='</div><div class="lg">✅ 아침 · ⚾ 저녁/주말 · 🛡️ 실드<br>'
    +'초록색 = 그날 미션 전부 완료</div>';
  const box=document.getElementById('calCard');
  box.innerHTML=h;
  box.querySelectorAll('.cc[data-d]').forEach(b=>{
    b.onclick=()=>{sel=b.dataset.d;draw();};
  });
  document.getElementById('pv').onclick=()=>mv(-1);
  document.getElementById('nx').onclick=()=>mv(1);
}
function mv(n){
  let y=+view.slice(0,4),m=+view.slice(5,7)+n;
  if(m<1){m=12;y--;}if(m>12){m=1;y++;}
  view=y+'-'+pad(m);drawCal();
}

/* ====== 뽑기 ====== */
function isMile(n){return MILESTONES.indexOf(n)>=0||(n>30&&n%10===0);}
function pickReward(){
  const t=REWARDS.reduce((a,b)=>a+b.w,0);
  let r=Math.random()*t;
  for(let i=0;i<REWARDS.length;i++){r-=REWARDS[i].w;if(r<0)return REWARDS[i].n;}
  return REWARDS[0].n;
}
function drawGacha(){
  const box=document.getElementById('gachaCard');
  if(D.tickets<=0&&!D.coupons.length){box.style.display='none';return;}
  box.style.display='';
  let h='';
  if(D.tickets>0){
    h+='<div class="ttl">🎁 보상 뽑기</div>'
      +'<div class="gname" id="gn">뽑기권 '+D.tickets+'장 있어요!</div>'
      +'<button class="btn" id="sp">뽑기 돌리기 🎰</button>';
  }
  if(D.coupons.length){
    h+='<div class="ttl" style="margin-top:'+(D.tickets>0?14:0)+'px">🎟️ 내 쿠폰</div>';
    h+=D.coupons.map((c,i)=>'<div class="cp"><span>'+c+'</span>'
      +'<button data-i="'+i+'">사용</button></div>').join('');
  }
  box.innerHTML=h;
  const sp=document.getElementById('sp');
  if(sp)sp.onclick=spin;
  box.querySelectorAll('.cp button').forEach(b=>{
    b.onclick=()=>{
      const i=+b.dataset.i;
      if(confirm('"'+D.coupons[i]+'"\n\n지금 사용할까요? (아빠 확인)')){
        D.coupons.splice(i,1);save();draw();
      }
    };
  });
}
function spin(){
  if(D.tickets<=0)return;
  D.tickets--;
  const el=document.getElementById('gn');
  document.getElementById('sp').disabled=true;
  const win=pickReward();
  let i=0;
  const t=setInterval(()=>{
    el.textContent=REWARDS[Math.floor(Math.random()*REWARDS.length)].n;
    tone(1200,.04,0);
    if(++i>13){
      clearInterval(t);
      el.textContent='🎉 '+win;
      D.coupons.push(win);save();fanfare();
      setTimeout(()=>{alert('🎁 '+win);draw();},900);
    }
  },90);
}

/* ====== 화면 조각 ====== */
function item(e){
  const warn=e.c==='h'?' 🔴':(e.c==='m'?' 🟠':'');
  const reps=e.r?'<i>'+e.r+'</i>':'';
  const cue=e.cue?'<div>💡 '+e.cue+'</div>':'';
  const bad=e.bad?'<div>⚠️ 흔한 실수: '+e.bad+'</div>':'';
  const yt=e.v?'<div><a href="https://www.youtube.com/results?search_query='
    +encodeURIComponent(e.v)+'" target="_blank">▶ 영상 검색</a></div>':'';
  return '<details><summary><b>'+e.t+'</b><span>'+e.n+warn+'</span>'+reps
    +'</summary><div class="dt2">'+cue+bad+yt+'</div></details>';
}
function plan(p){
  const eq=p.equip?'<span class="eq">'+p.equip+'</span>':'';
  const note=p.note?'<div class="sub" style="margin:6px 0 8px">'+p.note+'</div>':'';
  return '<div class="ttl">'+p.title+eq+'</div>'+note+p.list.map(item).join('');
}
function btnHTML(done,did,uid,label){
  const future=sel>TODAY;
  let h='<button class="btn" id="'+did+'"'+((done||future)?' disabled':'')+'>'
    +(done?'완료했어요 👍':label)+'</button>';
  if(done)h+='<button class="btn gray sm" id="'+uid+'">완료 취소</button>';
  return h;
}

/* ====== 아침 미션 ====== */
function drawMorning(dw){
  const box=document.getElementById('morningCard');
  const p=MORNING[dw];
  if(!p){box.style.display='none';return;}
  box.style.display='';
  const r=R(sel);
  box.innerHTML=plan(p)
    +'<button class="btn tm" id="tmM">▶ 타이머 따라하기</button>'
    +btnHTML(r.m,'doM','unM','아침 미션 완료! ✅');
  document.getElementById('tmM').onclick=()=>startTimer([p]);
  const a=document.getElementById('doM');
  if(a)a.onclick=()=>{rec(sel).m=true;afterDone();};
  const u=document.getElementById('unM');
  if(u)u.onclick=()=>{if(!confirm('완료를 취소할까요?'))return;rec(sel).m=false;save();draw();};
}

/* ====== 레슨 / 경기 ====== */
function drawAsk(dw){
  const box=document.getElementById('askCard');
  if(dw===0){box.style.display='none';return;}
  box.style.display='';
  const r=rec(sel);
  if(dw===6){
    const on=!!r.g;
    box.innerHTML='<div class="ttl">🗓️ 오늘 경기 있어?</div>'
      +'<div class="sub" style="margin-top:6px">경기가 있으면 경기 전·후 루틴으로 바뀝니다.</div>'
      +'<button class="btn gray'+(on?' on':'')+'" id="gB">'
      +(on?'✔ 경기 있는 날':'경기 있는 날 ⚾')+'</button>';
    document.getElementById('gB').onclick=()=>{r.g=!on;save();draw();};
  }else{
    const on=!!r.l;
    box.innerHTML='<div class="ttl">🗓️ 오늘 레슨 있어?</div>'
      +'<div class="sub" style="margin-top:6px">레슨 있는 날은 쿨다운만 합니다.</div>'
      +'<button class="btn gray'+(on?' on':'')+'" id="lB">'
      +(on?'✔ 레슨 있는 날 (쿨다운만)':'레슨 있는 날 🏟️')+'</button>';
    document.getElementById('lB').onclick=()=>{r.l=!on;save();draw();};
  }
}

/* ====== 저녁 / 주말 ====== */
function drawNight(dw){
  const box=document.getElementById('nightCard');
  const r=R(sel);
  let ps=[],mark='',swapTo='';

  if(dw===0)ps=[SUN];
  else if(dw===6)ps=[r.g?GAME:SAT];
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
    if(pick&&batLeft&&pitLeft&&!r.n&&sel<=TODAY)
      swapTo=(pick==='bat')?'pit':'bat';
  }

  if(!ps.length){
    box.innerHTML='<div class="rest">🎉 이번 주 드릴 다 했어요!<br>'
      +'<span class="sub">오늘 저녁은 쉬거나 가볍게 캐치볼만.</span></div>'
      +btnHTML(r.n,'doN','unN','오늘 훈련 완료! ✅');
  }else{
    let h=ps.map(plan).join('<div style="height:14px"></div>');
    if(swapTo)h+='<button class="btn gray" id="swB">🔄 오늘은 '
      +(swapTo==='bat'?'타격':'투수')+' 드릴로 바꾸기</button>';
    h+='<button class="btn tm" id="tmN">▶ 타이머 따라하기</button>';
    h+=btnHTML(r.n,'doN','unN','오늘 훈련 완료! ✅');
    box.innerHTML=h;
    const t=document.getElementById('tmN');
    if(t)t.onclick=()=>startTimer(ps);
    const sw=document.getElementById('swB');
    if(sw)sw.onclick=()=>{rec(sel).t=swapTo;save();draw();};
  }

  const a=document.getElementById('doN');
  if(a)a.onclick=()=>{
    rec(sel).n=true;
    if(mark)wk(sel)[mark]=sel;
    afterDone();
  };
  const u=document.getElementById('unN');
  if(u)u.onclick=()=>{
    if(!confirm('완료를 취소할까요?'))return;
    rec(sel).n=false;
    const w=wk(sel);
    if(w.bat===sel)w.bat='';
    if(w.pit===sel)w.pit='';
    save();draw();
  };
}

/* ====== 기록실 ====== */
function drawRec(){
  const box=document.getElementById('recCard');
  let h='<div class="ttl">🏆 기록실</div>';
  h+=RECORDS.map(r=>{
    const v=D.rec[r.k];
    return '<div class="rc"><span class="ic">'+r.ic+'</span>'
      +'<span class="nm">'+r.n+'</span>'
      +'<span class="vl">'+(v!==undefined?v+r.u:'-')+'</span>'
      +'<button data-k="'+r.k+'">기록</button></div>';
  }).join('');
  box.innerHTML=h;
  box.querySelectorAll('.rc button').forEach(b=>{
    b.onclick=()=>{
      const k=b.dataset.k;
      const r=RECORDS.filter(x=>x.k===k)[0];
      const v=prompt(r.n+' ('+r.u+')\n'+(r.hint||''),D.rec[k]!==undefined?D.rec[k]:'');
      if(v===null)return;
      const n=parseFloat(v);
      if(isNaN(n))return;
      const old=D.rec[k];
      const hi=(r.hi===undefined)?1:r.hi;
      const isNew=(old===undefined)||(hi?n>old:n<old);
      if(isNew){
        D.rec[k]=n;save();fanfare();
        alert('🏆 신기록!\n\n'+(old!==undefined?old+r.u+' → ':'')+n+r.u);
      }else{
        alert('아쉽다! 최고 기록은 '+old+r.u+'\n다음엔 넘어보자 💪');
      }
      draw();
    };
  });
}

/* ====== 완료 처리 ====== */
function afterDone(){
  save();
  if(!ok(sel)){draw();return;}
  const s=streakNow();
  if(s>D.best)D.best=s;
  let msg='🔥 '+s+'일 연속 성공!';
  if(isMile(s)&&D.given.indexOf(sel)<0){
    D.given.push(sel);D.tickets++;
    msg+='\n\n🎁 뽑기권 1장 획득!';
  }
  if(s>0&&s%7===0&&D.sgiven.indexOf(s)<0&&D.shields<SHIELD_MAX){
    D.sgiven.push(s);D.shields++;
    msg+='\n\n🛡️ 실드 1개 획득! (하루 빠져도 연속이 안 끊겨요)';
  }
  save();fanfare();draw();
  setTimeout(()=>alert(msg),200);
}

/* ====== 전체 그리기 ====== */
function draw(){
  autoShield();
  const d=parseD(sel);
  document.getElementById('today').textContent=
    (d.getMonth()+1)+'월 '+d.getDate()+'일 ('+YOIL[d.getDay()]+')'
    +(sel===TODAY?' · 오늘':' · 지난 기록');

  const s=streakNow(),b=bestStreak();
  if(b>D.best)D.best=b;
  document.getElementById('streak').textContent=s;
  document.getElementById('best').textContent=D.best;
  document.getElementById('shield').textContent=D.shields;

  drawDiamond();
  drawCal();
  drawGacha();
  drawMorning(d.getDay());
  drawAsk(d.getDay());
  drawNight(d.getDay());
  drawRec();
  save();
}
draw();
