/* ====== 저장 ====== */
const KEY='bq5';
function pad(n){return n<10?'0'+n:''+n;}
function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function parseD(s){const a=s.split('-');return new Date(+a[0],+a[1]-1,+a[2]);}
function shift(s,n){const d=parseD(s);d.setDate(d.getDate()+n);return ymd(d);}
function dow(s){return parseD(s).getDay();}
const TODAY=ymd(new Date());
const YOIL=['일','월','화','수','목','금','토'];

let D;
try{D=JSON.parse(localStorage.getItem(KEY))||{};}catch(e){D={};}
if(!D.log)D.log={};
if(!D.coupons)D.coupons=[];
if(!D.given)D.given=[];
if(!D.sgiven)D.sgiven=[];
if(D.tickets===undefined)D.tickets=0;
if(D.shields===undefined)D.shields=SHIELD_MAX;
if(D.best===undefined)D.best=0;
if(!D.rec)D.rec={};
function save(){try{localStorage.setItem(KEY,JSON.stringify(D));}catch(e){}}

/* ====== 소리 · 진동 ====== */
let AC=null;
function tone(f,dur,delay){
  try{
    if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state==='suspended')AC.resume();
    const o=AC.createOscillator(),g=AC.createGain();
    o.connect(g);g.connect(AC.destination);o.frequency.value=f;
    const t=AC.currentTime+delay;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(.25,t+.02);
    g.gain.linearRampToValueAtTime(0,t+dur);
    o.start(t);o.stop(t+dur+.02);
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
  try{if('wakeLock' in navigator){
    WL=await navigator.wakeLock.request('screen');
    WL.addEventListener('release',()=>{WL=null;});
  }}catch(e){}
}
function releaseAwake(){try{if(WL){WL.release();WL=null;}}catch(e){}}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'
    &&document.getElementById('tm').classList.contains('on')
    &&WL===null)keepAwake();
});

/* ====== 성공 판정 ====== */
function need(k){const w=dow(k);return w===0?[]:(w===6?['s']:['m','e']);}
function dayOK(k){
  const ns=need(k);if(ns.length===0)return true;
  const l=D.log[k];if(!l)return false;
  for(let i=0;i<ns.length;i++)if(!l[ns[i]])return false;
  return true;
}
function streakFrom(k){
  let c=0,d=k,n=0;
  while(n++<400){
    if(dow(d)===0){d=shift(d,-1);continue;}
    const l=D.log[d]||{};
    if(dayOK(d)||l.sh)c++;else break;
    d=shift(d,-1);
  }
  return c;
}
function streakNow(){return dayOK(TODAY)?streakFrom(TODAY):streakFrom(shift(TODAY,-1));}

function autoShield(){
  let d=shift(TODAY,-1),n=0;
  while(n++<14){
    if(dow(d)===0){d=shift(d,-1);continue;}
    const l=D.log[d]||{};
    if(dayOK(d)||l.sh||l.fail)break;
    if(streakFrom(shift(d,-1))>0&&D.shields>0){D.shields--;l.sh=1;}
    else l.fail=1;
    D.log[d]=l;save();
    break;
  }
}

/* ====== 뽑기 ====== */
function pickReward(){
  let t=0;REWARDS.forEach(r=>t+=r.w);
  let x=Math.random()*t;
  for(let i=0;i<REWARDS.length;i++){x-=REWARDS[i].w;if(x<=0)return REWARDS[i].n;}
  return REWARDS[0].n;
}
function spin(){
  if(D.tickets<=0)return;
  D.tickets--;
  const r=pickReward();
  D.coupons.push({n:r,d:TODAY});
  save();fanfare();
  setTimeout(()=>{alert('🎁 당첨!\n\n'+r+'\n\n쿠폰함에 들어갔어');draw();},120);
}

/* ====== 타이머 ====== */
let TMR={r:null,i:0,left:0,total:1,t:null,pause:false,cb:null};
function fmt(x){const m=Math.floor(x/60),s=x%60;return m>0?m+':'+pad(s):''+s;}
function paint(){
  document.getElementById('tnum').textContent=fmt(TMR.left);
  const p=Math.round((1-TMR.left/TMR.total)*100);
  document.getElementById('tring').style.background=
    'conic-gradient(var(--gold) '+p+'%,rgba(255,255,255,.1) 0)';
}
function loadStep(){
  const s=TMR.r.list[TMR.i];
  TMR.left=s.s;TMR.total=s.s;
  document.getElementById('tname').textContent=TMR.r.title;
  document.getElementById('tstep').textContent=
    (TMR.i+1)+' / '+TMR.r.list.length+' · '+s.n;
  document.getElementById('tcue').textContent=s.cue;
  paint();
}
function tick(){
  if(TMR.pause)return;
  TMR.left--;
  if(TMR.left<=0)nextStep();else paint();
}
function nextStep(){
  if(TMR.i>=TMR.r.list.length-1){endTimer(true);return;}
  beep();TMR.i++;loadStep();
}
function startTimer(r,cb){
  TMR={r:r,i:0,left:0,total:1,t:null,pause:false,cb:cb};
  document.getElementById('tm').classList.add('on');
  document.getElementById('tpause').textContent='일시정지';
  keepAwake();loadStep();
  tone(660,.12,0);
  TMR.t=setInterval(tick,1000);
}
function endTimer(done){
  if(TMR.t){clearInterval(TMR.t);TMR.t=null;}
  document.getElementById('tm').classList.remove('on');
  releaseAwake();
  if(done){
    fanfare();
    const cb=TMR.cb,ti=TMR.r.title;
    setTimeout(()=>{alert('🎉 훈련 완료!\n\n'+ti);if(cb)cb();},150);
  }
}
document.getElementById('tpause').onclick=function(){
  TMR.pause=!TMR.pause;
  this.textContent=TMR.pause?'계속하기':'일시정지';
};
document.getElementById('tskip').onclick=function(){nextStep();};
document.getElementById('texit').onclick=function(){
  if(confirm('훈련을 그만둘까?'))endTimer(false);
};

/* ====== 미션 체크 ====== */
function setDone(slot,v){
  if(!D.log[TODAY])D.log[TODAY]={};
  D.log[TODAY][slot]=v?1:0;
  save();afterDone();draw();
}
function afterDone(){
  const s=streakNow();
  if(s>D.best){D.best=s;}
  MILESTONES.forEach(m=>{
    if(s>=m&&D.given.indexOf(m)<0){D.given.push(m);D.tickets++;}
  });
  for(let w=7;w<=400;w+=7){
    if(s>=w&&D.sgiven.indexOf(w)<0){
      D.sgiven.push(w);
      if(D.shields<SHIELD_MAX)D.shields++;
    }
  }
  save();
}

/* ====== 미션 카드 ====== */
function msRow(em,nm,sb,slot,routine){
  const on=(D.log[TODAY]||{})[slot]?' on':'';
  return '<div class="ms"><div class="em">'+em+'</div>'
    +'<div class="in"><div class="nm">'+nm+'</div><div class="sb">'+sb+'</div></div>'
    +(routine?'<button class="go" data-go="'+slot+'">시작</button>':'')
    +'<button class="chk'+on+'" data-ck="'+slot+'">✓</button></div>';
}
function bindMission(box,map){
  box.querySelectorAll('[data-go]').forEach(b=>{
    b.onclick=()=>{
      const slot=b.dataset.go;
      startTimer(map[slot],()=>{setDone(slot,1);});
    };
  });
  box.querySelectorAll('[data-ck]').forEach(b=>{
    b.onclick=()=>{
      const slot=b.dataset.ck;
      const cur=(D.log[TODAY]||{})[slot];
      setDone(slot,!cur);
      if(!cur)tone(880,.18,0);
    };
  });
}
function drawMission(){
  const w=dow(TODAY),mb=document.getElementById('mCard'),eb=document.getElementById('eCard');
  if(w===0){
    mb.innerHTML='<div class="ttl">🌤️ 일요일</div>'
      +'<div style="text-align:center;padding:14px 0;color:var(--sub);font-size:13px">'
      +'오늘은 쉬는 날. 연속 기록은 안 끊겨.</div>'
      +'<button class="sub-b" id="sunb">가볍게 보충 훈련 하기 (10분)</button>';
    document.getElementById('sunb').onclick=()=>startTimer(SUN,null);
    eb.innerHTML='';return;
  }
  if(w===6){
    mb.innerHTML='<div class="ttl">🔥 토요일 훈련</div>'
      +msRow('🔥','토요일 훈련','30분 · 일주일 마무리','s',1);
    bindMission(mb,{s:SAT});
    eb.innerHTML='<div class="ttl">🏟️ 추가</div>'
      +'<button class="sub-b" id="gmb">경기 전 루틴 (12분)</button>';
    document.getElementById('gmb').onclick=()=>startTimer(GAME,null);
    return;
  }
  const mo=MORNING[w],ev=EVE[w];
  mb.innerHTML='<div class="ttl">🌅 아침 미션</div>'
    +msRow('🌅',mo.title.replace(/^🌅\s*/,''),'약 4분 · 일어나자마자','m',1);
  bindMission(mb,{m:mo});
  eb.innerHTML='<div class="ttl">💪 저녁 훈련</div>'
    +msRow('⚾',ev.title.replace(/^[^\s]+\s*/,''),'약 15분','e',1)
    +'<button class="sub-b" id="gmb">경기 전 루틴 (12분)</button>';
  bindMission(eb,{e:ev});
  document.getElementById('gmb').onclick=()=>startTimer(GAME,null);
}

/* ====== 달력 ====== */
function drawCal(){
  const box=document.getElementById('calCard');
  const t=parseD(TODAY),y=t.getFullYear(),m=t.getMonth();
  const first=new Date(y,m,1),last=new Date(y,m+1,0);
  let h='<div class="ttl">📅 '+(m+1)+'월 출석</div><div class="cal">';
  YOIL.forEach(d=>h+='<div class="hdc">'+d+'</div>');
  for(let i=0;i<first.getDay();i++)h+='<div></div>';
  for(let d=1;d<=last.getDate();d++){
    const k=y+'-'+pad(m+1)+'-'+pad(d);
    const l=D.log[k]||{};
    let c='cel';
    if(dow(k)===0)c+=' rest';
    else if(dayOK(k))c+=' ok';
    else if(l.sh)c+=' sh';
    else if(l.fail)c+=' no';
    if(k===TODAY)c+=' tdy';
    h+='<div class="'+c+'">'+d+'</div>';
  }
  h+='</div><div class="lgd">🟩 성공 · 🟦 실드 사용 · 🟥 놓침 · 회색 일요일</div>';
  box.innerHTML=h;
}

/* ====== 뽑기 카드 ====== */
function drawGacha(){
  const box=document.getElementById('gachaCard');
  let h='<div class="ttl">🎁 보상 뽑기</div><div class="gc">'
   +'<div class="tk">🎟️ '+D.tickets+'장</div>'
   +'<button class="sp" id="spin"'+(D.tickets>0?'':' disabled')+'>'
   +(D.tickets>0?'뽑기!':'3일 연속 채우면 한 장')+'</button></div>';
  if(D.coupons.length){
    h+='<div style="margin-top:14px;font-size:12px;color:var(--sub)">쿠폰함</div>';
    D.coupons.forEach((c,i)=>{
      h+='<div class="cp"><span>'+c.n+'</span>'
        +'<button data-cp="'+i+'">사용</button></div>';
    });
  }
  box.innerHTML=h;
  document.getElementById('spin').onclick=spin;
  box.querySelectorAll('[data-cp]').forEach(b=>{
    b.onclick=()=>{
      const i=+b.dataset.cp;
      if(confirm(D.coupons[i].n+'\n\n지금 사용할까?')){
        D.coupons.splice(i,1);save();draw();
      }
    };
  });
}

/* ====== 기록실 ====== */
function drawRec(){
  const box=document.getElementById('recCard');
  let h='<div class="ttl">🏆 기록실</div>';
  h+=RECORDS.map(r=>{
    const ic=r.ic||'🏅',u=r.u||'',v=D.rec[r.k];
    return '<div class="rc"><span class="ic">'+ic+'</span>'
      +'<span class="nm">'+r.n+'</span>'
      +'<span class="vl">'+(v!==undefined?v+u:'-')+'</span>'
      +'<button data-k="'+r.k+'">기록</button></div>';
  }).join('');
  box.innerHTML=h;
  box.querySelectorAll('.rc button').forEach(b=>{
    b.onclick=()=>{
      const k=b.dataset.k,r=RECORDS.filter(x=>x.k===k)[0],u=r.u||'';
      const v=prompt(r.n+(u?' ('+u+')':'')+'\n'+(r.hint||''),
        D.rec[k]!==undefined?D.rec[k]:'');
      if(v===null)return;
      const n=parseFloat(v);if(isNaN(n))return;
      const old=D.rec[k],hi=(r.hi===undefined)?1:r.hi;
      const isNew=(old===undefined)||(hi?n>old:n<old);
      if(isNew){
        D.rec[k]=n;save();fanfare();
        alert('🏆 신기록!\n\n'+(old!==undefined?old+u+' → ':'')+n+u);
      }else{
        alert('아쉽다! 최고 기록은 '+old+u+'\n다음엔 넘어보자 💪');
      }
      draw();
    };
  });
}

/* ====== 전체 그리기 ====== */
function draw(){
  autoShield();
  const t=parseD(TODAY);
  document.getElementById('today').textContent=
    (t.getMonth()+1)+'월 '+t.getDate()+'일 '+YOIL[t.getDay()]+'요일';
  const s=streakNow();
  if(s>D.best){D.best=s;save();}
  document.getElementById('streak').textContent=s;
  document.getElementById('best').textContent=D.best;
  document.getElementById('shield').textContent=D.shields;
  drawMission();drawGacha();drawCal();drawRec();
}
draw();
