/* Логика прототипа: состояние, расчёт баллов, экраны ролей, обработка событий */
/* ======================= СОСТОЯНИЕ ======================= */
const KEY='evviva-proto-v1';
const clone = o => JSON.parse(JSON.stringify(o));
let S;
function fresh(){ return {settings:clone(DEFAULT_SETTINGS), people:clone(DEFAULT_PEOPLE),
  ui:{role:'employee', empId:'p1', empTab:'home', asTab:'list', asId:null, coTab:'list', coId:null, setTab:'rules', open:{}, draft:{}, dec:{}}}; }
function load(){ try{ const r=localStorage.getItem(KEY); if(r){ S=JSON.parse(r); if(S&&S.people&&S.settings&&S.ui) return; } }catch(e){} S=fresh(); }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }

/* ======================= УТИЛИТЫ ======================= */
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso = (d=new Date()) => { const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
const plusDays = n => { const d=new Date(); d.setDate(d.getDate()+n); return iso(d); };
const fd = s => s ? s.split('-').reverse().join('.') : '—';
const f2 = n => (n==null||isNaN(n)) ? '—' : n.toFixed(2).replace('.',',');
const initials = fio => fio.split(' ').slice(0,2).map(w=>w[0]).join('');
const shortName = fio => { const p=fio.split(' '); return p[0]+' '+(p[1]?p[1][0]+'.':'')+(p[2]?p[2][0]+'.':''); };
const person = id => S.people.find(p=>p.id===id);
const req = (p,cid) => S.settings.matrix[p.profile][cid];
const applicable = p => CRITERIA.filter(c=>req(p,c.id).req!=='net');
const learnedCount = p => applicable(p).filter(c=>p.learned[c.id]).length;
function toast(msg, err){ const t=$('#toast'); t.textContent=msg; t.className=(err?'err ':'')+'on'; clearTimeout(t._h); t._h=setTimeout(()=>t.className='',2600); }

function testResult(p){
  const by={}; let ok=0,total=0;
  if(!p.test||!p.test.done) return null;
  QUESTIONS.forEach(q=>{
    if(req(p,q.c).req==='net') return;
    by[q.c]=by[q.c]||{ok:0,total:0};
    by[q.c].total++; total++;
    if(p.test.answers && p.test.answers[q.id]===q.a){ by[q.c].ok++; ok++; }
  });
  return {by, ok, total, pct: total?Math.round(ok*100/total):0};
}

function calc(p){
  const st=S.settings; let sum=0, scored=0, no=0, np=0; const risks=[];
  CRITERIA.forEach(c=>{
    const r=req(p,c.id); const s=p.scores[c.id]; let v = r.req==='net' ? 'НП' : (s?s.v:null);
    if(v==='НП'){ np++; return; }
    if(v==='НО'){ no++; if(r.mand) risks.push({c, lim:true, t:`Критерий ${c.n} обязательный, но не оценён (Н/О) — ограничение заключения`}); return; }
    if(typeof v==='number'){
      sum+=v; scored++;
      const min = r.req==='op' ? st.minOp : st.minDa;
      if(r.mand && v<min) risks.push({c, t:`Критерий ${c.n} «${c.short}»: ${v} при минимуме ${min} — дефицит по обязательному критерию`});
    }
  });
  const applicableN = CRITERIA.length - np;
  const notScored = applicableN - scored - no;
  const avg = scored ? sum/scored : null;
  const defs = risks.filter(r=>!r.lim).length;
  let verdict = {k:'none', t:'Недостаточно данных для вывода'};
  if(avg!=null){
    if(avg>=st.tFull && !defs) verdict={k:'ok', t:'Соответствует требованиям модуля'};
    else if(avg>=st.tPlan) verdict={k:'plan', t:'Соответствует при условии выполнения плана развития'};
    else verdict={k:'def', t:'Значимый дефицит — нужны обучение и повторная оценка'};
  }
  let level=null;
  if(avg!=null){ const L=[...st.levels].sort((a,b)=>b.min-a.min); level = (L.find(l=>avg>=l.min && (!l.noDef || !defs))||null); }
  return {sum, scored, no, np, applicable:applicableN, notScored, avg, risks, defs, verdict, level};
}

function scoreBtnClass(v){ if(v==null) return ''; if(v==='НО'||v==='НП') return 'sx'; return 's'+v; }
function reqChip(r){ return `<span class="chip ${r.req}">${r.req==='net'?'Не оценивается':'Требование: '+REQ[r.req]}</span>${r.mand&&r.req!=='net'?'<span class="chip mand">обязательный</span>':''}`; }
function statusChip(p){ const s=STATUS[p.status]; let t=s.t; if(p.status==='decided' && p.decision && !p.decision.approved) t='На утверждении ГД'; return `<span class="chip ${p.status==='decided'&&p.decision&&!p.decision.approved?'warn':s.cls}">${t}</span>`; }

/* ======================= ШАПКА ======================= */
function vProtobar(){
  const R=[['employee','Сотрудник'],['assessor','Оценщик'],['commission','Комиссия / HR'],['settings','Настройки']];
  return `<span class="tag">ПРОТОТИП</span><span class="desc">Модуль 4 «Юридический блок» · данные демонстрационные</span><span class="sp"></span>
  <div class="roles"><span>Смотреть как:</span>${R.map(([k,t])=>`<button data-a="role" data-v="${k}" class="${S.ui.role===k?'on':''}">${t}</button>`).join('')}</div>`;
}
function vHeader(){
  let name, sub, ini;
  if(S.ui.role==='employee'){ const p=person(S.ui.empId); name=shortName(p.fio); sub=p.position; ini=initials(p.fio); }
  else if(S.ui.role==='assessor'){ name='Ответственный за модуль 4'; sub='Руководитель юридического департамента'; ini='ЮД'; }
  else if(S.ui.role==='commission'){ name='Оценочная комиссия'; sub='Кадровый департамент'; ini='ОК'; }
  else { name='Администратор'; sub='Настройки методики'; ini='А'; }
  return `<div class="logo"><img src="${LOGO}" alt="Эввива"><small>Медицинский центр<br>высшей категории</small></div>
  <div class="ptitle"><b>Платформа обучения и оценки персонала</b><span>Онбординг · обучение · оценка компетенций · ступени роста</span></div>
  <div class="user"><div class="ava">${esc(ini)}</div><div><b>${esc(name)}</b><small>${esc(sub)}</small></div></div>`;
}
function vSubnav(){
  const u=S.ui; let tabs=[], key, crumb='';
  if(u.role==='employee'){ key='empTab'; tabs=[['home','Главная'],['learn','Обучение'],['test','Тест'],['results','Мои результаты']]; }
  if(u.role==='assessor'){ key='asTab'; tabs=[['list','Оцениваемые']]; if(u.asId){ tabs.push(['protocol','Протокол № 4']); crumb=shortName(person(u.asId).fio); } }
  if(u.role==='commission'){ key='coTab'; tabs=[['list','Результаты оценки']]; if(u.coId){ tabs.push(['decision','Решение комиссии']); crumb=shortName(person(u.coId).fio); } }
  if(u.role==='settings'){ key='setTab'; tabs=[['rules','Пороги и требования'],['levels','Ступени роста'],['bank','Банк вопросов']]; }
  return tabs.map(([k,t])=>`<button data-a="tab" data-k="${key}" data-v="${k}" class="${u[key]===k?'on':''}">${t}</button>`).join('') + (crumb?`<span class="crumb">${esc(crumb)}</span>`:'');
}

/* ======================= СОТРУДНИК ======================= */
function vEmployee(){
  const p=person(S.ui.empId);
  const sel = `<div class="row" style="margin-bottom:18px"><span class="small muted">Демо: войти как</span>
    <select data-f="emp" style="width:auto;min-width:300px">${S.people.map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.fio)} — ${esc(x.position)}</option>`).join('')}</select></div>`;
  const t=S.ui.empTab;
  return sel + (t==='home'?empHome(p): t==='learn'?empLearn(p): t==='test'?empTest(p): empResults(p));
}

function empHome(p){
  const ac=applicable(p).length, lc=learnedCount(p), tr=testResult(p);
  const st=p.status, dec=p.decision;
  const steps=[
    {t:'Обучение', d:`${lc} из ${ac} тем`, done: lc>=ac || p.test.done},
    {t:'Тест', d: tr?`${tr.pct}% · ${fd(p.test.date)}`:'не пройден', done:!!tr},
    {t:'Оценка ответственным', d: (st==='assessed'||st==='decided')?`проведена ${fd(p.assessor&&p.assessor.date)}`:'юридический департамент', done: st==='assessed'||st==='decided'},
    {t:'Оценочная комиссия', d: st==='decided'?`решение ${fd(dec.date)}`:'после оценки', done: st==='decided'},
    {t:'Ступень и план развития', d: st==='decided'&&dec.approved?'утверждено ГД':'утверждает ГД', done: st==='decided'&&dec&&dec.approved}
  ];
  const cur = steps.findIndex(s=>!s.done);
  let next;
  if(!tr && lc<ac) next=`<button class="btn" data-a="tab" data-k="empTab" data-v="learn">Продолжить обучение</button><button class="btn ghost" data-a="tab" data-k="empTab" data-v="test">Перейти к тесту</button>`;
  else if(!tr) next=`<button class="btn" data-a="tab" data-k="empTab" data-v="test">Пройти тест</button>`;
  else if(st==='tested') next=`<div class="note green">Тест пройден. Результаты переданы ответственному за модуль — с вами свяжутся, чтобы назначить собеседование.</div>`;
  else if(st==='assessed') next=`<div class="note green">Оценка проведена. Результаты рассматривает оценочная комиссия.</div>`;
  else next=`<button class="btn" data-a="tab" data-k="empTab" data-v="results">Посмотреть результаты и план развития</button>`;

  return `<h1>Добрый день, ${esc(p.fio.split(' ')[1])}!</h1>
  <p class="lead">Здесь вы проходите обучение по модулям, сдаёте тесты и видите результаты оценки, свою ступень и план развития.</p>
  <div class="card hero"><div style="flex:1">
    <p class="big">${esc(p.position)}</p>
    <div class="kv"><div><span>Статус</span><b>${esc(p.kind)}</b></div><div><span>Требования</span><b>${PROFILE[p.profile]}</b></div><div><span>Текущая ступень</span><b>${esc(p.level)}</b></div><div><span>Этап</span>${statusChip(p)}</div></div>
  </div></div>
  <div class="card"><h2>Модуль 4 «Юридический блок» — ваш путь</h2>
    <div class="steps">${steps.map((s,i)=>`<div class="step ${s.done?'done':i===cur?'cur':''}"><div class="dot">${s.done?'✓':i+1}</div><b>${s.t}</b><span>${esc(s.d)}</span></div>`).join('')}</div>
    <hr><div class="row">${next}</div>
  </div>
  <div class="card"><h2>Модули оценки</h2><p class="muted small" style="margin-top:-6px">В прототипе работает модуль 4. Остальные подключаются по тому же принципу.</p>
    <div class="grid g4 mods">${MODULES.map(m=>m.active?`<div class="m on" data-a="tab" data-k="empTab" data-v="learn"><small>Модуль ${m.n} · ${ac} критериев</small><b>${m.t}</b><div class="sp"></div><div class="bar"><i style="width:${Math.round((tr?ac:lc)*100/ac)}%"></i></div><small>${tr?'Тест пройден':`Изучено ${lc} из ${ac}`}</small></div>`
      :`<div class="m off"><small>Модуль ${m.n} · ${m.k} критериев</small><b>${m.t}</b><div class="sp"></div><small>Скоро</small></div>`).join('')}</div>
  </div>`;
}

function empLearn(p){
  const ac=applicable(p).length, lc=learnedCount(p);
  return `<h1>Обучение: Юридический блок</h1>
  <p class="lead">Изучите темы модуля — по ним проводится тест и собеседование с ответственным за модуль (руководитель юридического департамента). Изучено: <b>${lc} из ${ac}</b>.</p>
  ${CRITERIA.map(c=>{
    const r=req(p,c.id), net=r.req==='net', done=!!p.learned[c.id], op=!!S.ui.open['l'+c.id];
    return `<div class="lesson ${done?'done':''} ${net?'dim':''} ${op?'open':''}">
      <div class="lh" data-a="toggle" data-v="l${c.id}"><div class="n">${done?'✓':c.n}</div>
        <div class="lt"><b>${esc(c.short)}</b><div class="cmeta" style="margin:4px 0 0">${reqChip(r)}</div></div><span class="caret">▶</span></div>
      ${op?`<div class="lb">
        ${net?`<div class="note" style="margin-bottom:10px">Для вашей должности тема не оценивается. Её можно изучить для общего развития.</div>`:''}
        <h3>Что нужно знать и уметь</h3>
        <ul>${c.points.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
        <h3>Материалы</h3>
        <div class="mats"><div class="mat"><b>Конспект</b> · загружает юр. департамент</div><div class="mat"><b>Видеолекция</b> · 10–15 мин</div><div class="mat"><b>Внутренние документы</b> · Устав, положения, приказы</div></div>
        <button class="btn ${done?'ghost':''} sm" data-a="learn" data-v="${c.id}">${done?'Изучено ✓ (отменить)':'Отметить как изученное'}</button>
      </div>`:''}
    </div>`;}).join('')}
  <div class="row" style="margin-top:16px"><button class="btn" data-a="tab" data-k="empTab" data-v="test">Перейти к тесту</button></div>`;
}

function empTest(p){
  const tr=testResult(p);
  const qs=QUESTIONS.filter(q=>req(p,q.c).req!=='net');
  if(tr){
    const canRetry = p.status==='tested' || p.status==='learning';
    return `<h1>Тест: Юридический блок</h1>
    <p class="lead">Тест пройден ${fd(p.test.date)}. Результат передан ответственному за модуль как одно из доказательств. Итоговый балл по каждому критерию выставляет оценщик по шкале 1–5.</p>
    <div class="grid g2" style="align-items:start">
      <div class="card"><h2>Результат: ${tr.ok} из ${tr.total} (${tr.pct}%)</h2>
        <div class="bars">${applicable(p).map(c=>{const b=tr.by[c.id]; if(!b) return ''; const pc=Math.round(b.ok*100/b.total); return `<div class="b"><span>${c.n}. ${esc(c.short)}</span><div class="bar"><i style="width:${pc}%;background:${pc<50?'var(--red)':pc<100?'#e8a33a':'var(--g)'}"></i></div><b class="num">${b.ok}/${b.total}</b></div>`;}).join('')}</div>
      </div>
      <div class="card"><h2>Кейс</h2><p class="small muted">${esc(CASE_TEXT)}</p><div class="case"><b>Ваш ответ</b>${esc(p.test.caseAnswer||'—')}</div><p class="small muted">Ответ на кейс оценивает ответственный за модуль на собеседовании (критерий 8).</p></div>
    </div>
    <div class="card"><h2>Разбор ответов</h2>${qs.map((q,i)=>{const a=p.test.answers[q.id]; return `<div class="q"><p>${i+1}. ${esc(q.text)}</p>${q.o.map((o,j)=>`<div class="opt ${j===q.a?'right':j===a?'wrong':''}"><span>${j===q.a?'✓':j===a?'✗':'·'}</span><span>${esc(o)}</span></div>`).join('')}</div>`;}).join('')}</div>
    ${canRetry?`<div class="row" style="margin-top:16px"><button class="btn ghost" data-a="retest">Пройти тест заново</button><span class="small muted">В прототипе пересдача доступна до начала оценки.</span></div>`:''}`;
  }
  const d=S.ui.draft[p.id]||(S.ui.draft[p.id]={answers:{},caseAnswer:''});
  let lastC=null;
  return `<h1>Тест: Юридический блок</h1>
  <p class="lead">${qs.length} вопросов с выбором ответа и 1 кейс. Тест — одно из доказательств для оценщика; итоговый балл ставит ответственный за модуль.</p>
  <div class="note" style="margin-bottom:16px">Вопросы демонстрационные. Финальную редакцию банка вопросов утверждает юридический департамент.</div>
  <form class="card" data-form="test" onsubmit="return false">
    ${qs.map((q,i)=>{ const c=CRITERIA.find(x=>x.id===q.c); const head = q.c!==lastC ? `<h3 style="margin-top:${i?18:0}px">Тема ${c.n}. ${esc(c.short)}</h3>`:''; lastC=q.c;
      return head+`<div class="q"><p>${i+1}. ${esc(q.text)}</p>${q.o.map((o,j)=>`<label class="opt"><input type="radio" name="${q.id}" value="${j}" data-f="ans" data-q="${q.id}" ${d.answers[q.id]===j?'checked':''}><span>${esc(o)}</span></label>`).join('')}</div>`;}).join('')}
    <h3 style="margin-top:18px">Кейс (тема 8)</h3>
    <p class="small">${esc(CASE_TEXT)}</p>
    <textarea data-f="case" placeholder="Опишите план действий…">${esc(d.caseAnswer)}</textarea>
    <div class="row" style="margin-top:16px"><button class="btn" data-a="submitTest">Отправить ответы</button><span class="small muted" id="ansCount">Отвечено: ${Object.keys(d.answers).length} из ${qs.length}</span></div>
  </form>`;
}

function empResults(p){
  const tr=testResult(p);
  if(p.status!=='decided'){
    const msg = !tr ? 'Сначала пройдите обучение и тест.' : p.status==='tested' ? 'Тест пройден. Ожидается оценка ответственным за модуль.' : 'Оценка проведена. Результаты рассматривает оценочная комиссия.';
    return `<h1>Мои результаты</h1><div class="card empty"><b>Итоговые результаты пока недоступны</b>${msg}<br><br>${!tr?`<button class="btn" data-a="tab" data-k="empTab" data-v="learn">К обучению</button>`:`<button class="btn ghost" data-a="tab" data-k="empTab" data-v="test">Результаты теста</button>`}</div>`;
  }
  const k=calc(p), dec=p.decision;
  return `<h1>Мои результаты</h1>
  <p class="lead">Модуль 4 «Юридический блок» · решение комиссии от ${fd(dec.date)}${dec.approved?' · утверждено генеральным директором':' · на утверждении у генерального директора'}</p>
  <div class="grid g3">
    <div class="card sum"><span class="small muted">Средний балл по модулю</span><div class="score">${f2(k.avg)} <small>/ 5</small></div><p class="small muted" style="margin:8px 0 0">Оценено ${k.scored} из ${k.applicable} применимых критериев</p></div>
    <div class="card"><span class="small muted">Решение комиссии</span><p style="margin:6px 0 0;font-weight:500;color:var(--gd)">${DECISIONS[dec.type]}</p></div>
    <div class="card"><span class="small muted">Ступень</span><p style="margin:6px 0 0;font-size:20px;font-weight:700;color:var(--gd)">${esc(dec.level)}</p></div>
  </div>
  <div class="grid g2" style="margin-top:16px;align-items:start">
    <div class="card"><h2>Баллы по критериям</h2><table class="t"><tbody>${CRITERIA.map(c=>{const r=req(p,c.id); const s=p.scores[c.id]; const v=r.req==='net'?'НП':s?s.v:'—'; return `<tr><td>${c.n}. ${esc(c.short)}</td><td class="num" style="text-align:right"><button class="sb ${scoreBtnClass(v)} ${typeof v!=='number'?'w':''}" disabled>${v==='НП'?'Н/П':v==='НО'?'Н/О':v}</button></td></tr>`;}).join('')}</tbody></table></div>
    <div class="card"><h2>План развития</h2>${dec.plan&&dec.plan.length?`<table class="t"><thead><tr><th>Задача</th><th>Ответственный</th><th>Срок</th></tr></thead><tbody>${dec.plan.map(x=>`<tr><td>${esc(x.t)}</td><td class="small">${esc(x.o)}</td><td class="num small">${fd(x.d)}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Задач нет.</p>'}
      <hr><h3>Рекомендации оценщика</h3><p class="small">${esc(p.concl.training||'—')}</p></div>
  </div>`;
}

/* ======================= ОЦЕНЩИК ======================= */
function vAssessor(){ return S.ui.asTab==='protocol' && S.ui.asId ? asProtocol(person(S.ui.asId)) : asList(); }
function asList(){
  return `<h1>Оценка по модулю 4</h1>
  <p class="lead">Ответственный: руководитель юридического департамента. Откройте протокол, выставьте баллы 1–5 по каждому критерию, приложите доказательства и сформируйте лист заключений.</p>
  <div class="card tscroll"><table class="t"><thead><tr><th>Оцениваемый</th><th>Статус</th><th>Требования</th><th>Тест</th><th>Балл модуля</th><th>Этап</th><th></th></tr></thead><tbody>
  ${S.people.map(p=>{const tr=testResult(p), k=calc(p); return `<tr>
    <td class="who"><b>${esc(p.fio)}</b><small>${esc(p.position)}</small></td>
    <td class="small">${esc(p.kind)}</td>
    <td><span class="chip ${p.profile==='profile'?'da':'grey'}">${p.profile==='profile'?'Профильная':'Непрофильная'}</span></td>
    <td class="num">${tr?`${tr.pct}%`:'<span class="muted">—</span>'}</td>
    <td class="num"><b>${f2(k.avg)}</b></td>
    <td>${statusChip(p)}</td>
    <td style="text-align:right"><button class="btn sm ${p.status==='tested'?'':'ghost'}" data-a="openAs" data-v="${p.id}">${p.status==='tested'?'Оценить':'Открыть протокол'}</button></td></tr>`;}).join('')}
  </tbody></table></div>
  <div class="note green" style="margin-top:16px">Начните с <b>Петренко А. В.</b>: он прошёл тест и ждёт оценки. Затем передайте протокол в комиссию и переключитесь на вкладку «Комиссия / HR».</div>`;
}

function asProtocol(p){
  const tr=testResult(p), k=calc(p), locked=p.status==='decided';
  const rows = CRITERIA.map(c=>{
    const r=req(p,c.id), net=r.req==='net', s=p.scores[c.id]||{}, v=net?'НП':s.v;
    const tb = tr&&tr.by[c.id] ? `<span class="chip test">Тест: ${tr.by[c.id].ok} из ${tr.by[c.id].total}</span>` : '';
    const btn = (val,label,w) => `<button class="sb ${w?'w':''} ${v===val?scoreBtnClass(val):''}" data-a="score" data-c="${c.id}" data-v="${val}" ${net||locked?'disabled':''} title="${label}">${label}</button>`;
    return `<div class="crow ${net?'dim':''}">
      <div class="cnum">${c.n}</div>
      <div><div class="ctitle">${esc(c.title)}</div>
        <div class="cmeta">${reqChip(r)}${tb}</div>
        <details data-open="as${c.id}" ${S.ui.open['as'+c.id]?'open':''}><summary>Что проверять</summary><ul>${c.points.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>
        ${c.id==='c8'&&p.test.caseAnswer?`<div class="case"><b>Ответ на кейс (с платформы)</b>${esc(p.test.caseAnswer)}</div>`:''}
        ${net?`<div class="small muted">Для непрофильной должности критерий не применим — автоматически Н/П, не входит в расчёт.</div>`:`<input type="text" data-f="cm" data-c="${c.id}" value="${esc(s.cm||'')}" placeholder="Комментарий / краткое доказательство" ${locked?'disabled':''}>`}
      </div>
      <div class="cscore"><div class="scores">${[1,2,3,4,5].map(n=>btn(n,n)).join('')}</div>
        <div class="scores" style="margin-top:4px;justify-content:flex-end">${btn('НО','Н/О',1)}${btn('НП','Н/П',1)}</div></div>
    </div>`;}).join('');
  const C=p.concl;
  return `<div class="row" style="margin-bottom:10px"><button class="link" data-a="tab" data-k="asTab" data-v="list">← Все оцениваемые</button></div>
  <h1>Протокол № 4. Юридический блок</h1>
  <p class="lead">${esc(p.fio)} · ${esc(p.position)} · ${esc(p.kind)} · ${PROFILE[p.profile].toLowerCase()} · дата ${fd(p.assessor&&p.assessor.date||iso())}</p>
  ${locked?`<div class="note green" style="margin-bottom:16px">Комиссия приняла решение — протокол закрыт для изменений.</div>`:''}
  <div class="side">
    <div>
      <div class="card"><div class="row"><h2 style="margin:0">Критерии</h2><span class="sp"></span><span class="small muted">1 — не продемонстрировано · 3 — базовый рабочий · 5 — самостоятельно в сложных ситуациях</span></div>${rows}</div>
      <div class="card"><h2>Лист заключений № 4</h2>
        <div class="field"><label>Применённые методы оценки</label><div class="checks">${Object.entries(METHODS).map(([mk,mt])=>`<label><input type="checkbox" data-f="method" data-v="${mk}" ${C.methods.includes(mk)?'checked':''} ${locked?'disabled':''}>${mt}</label>`).join('')}</div></div>
        ${!locked?`<div class="row" style="margin-bottom:14px"><button class="btn ghost sm" data-a="autofill">Заполнить черновик по баллам</button><span class="small muted">Система предложит формулировки, их можно отредактировать</span></div>`:''}
        <div class="grid g2">
        ${[['strengths','Сильные стороны и подтверждённые компетенции'],['gaps','Выявленные пробелы и профильные риски'],['verdict','Заключение о соответствии требованиям должности'],['proposals','Предложения по назначению / продолжению работы / повторной оценке'],['training','Рекомендации по обучению и развитию'],['responsible','Ответственный за исполнение рекомендаций; срок']].map(([fk,fl])=>`<div class="field"><label>${fl}</label><textarea data-f="concl" data-k="${fk}" ${locked?'disabled':''} style="min-height:${fk==='responsible'?60:90}px">${esc(C[fk])}</textarea></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="sticky">${summaryCard(p,k,true)}
      <div class="card"><div class="grid" style="gap:8px">
        <button class="btn ghost" data-a="preview" data-v="${p.id}">Предпросмотр протокола</button>
        ${!locked?`<button class="btn" data-a="submitAs">${p.status==='assessed'?'Обновить данные для комиссии':'Передать в комиссию'}</button>`:''}
      </div><p class="small muted" style="margin:10px 0 0">В рабочей версии: выгрузка протокола и листа заключений в PDF для подписи.</p></div>
    </div>
  </div>`;
}

function summaryCard(p,k,live){
  return `<div class="card sum">
    <span class="small muted">Средний балл по модулю${live?' (считается автоматически)':''}</span>
    <div class="score">${f2(k.avg)} <small>/ 5,00</small></div>
    <div class="cnt"><div>Применимых<b>${k.applicable}</b></div><div>Оценено<b>${k.scored}</b></div><div>Н/О<b>${k.no}</b></div><div>Н/П<b>${k.np}</b></div></div>
    ${k.notScored>0?`<p class="small muted" style="margin:-4px 0 10px">Ещё не оценено: ${k.notScored}</p>`:''}
    <div class="verdict ${k.verdict.k}">${k.verdict.t}</div>
    ${k.risks.length?`<ul class="risks">${k.risks.map(r=>`<li class="${r.lim?'lim':''}">${esc(r.t)}</li>`).join('')}</ul>`:''}
    <div class="level"><span>Предлагаемая ступень (по порогам)</span><b>${k.level?esc(k.level.name):'—'}</b></div>
    <p class="small muted" style="margin:10px 0 0">Н/О и Н/П не заменяются нулём и исключаются из делителя. Окончательное решение принимает комиссия.</p>
  </div>`;
}

function autofill(p){
  const k=calc(p), C=p.concl;
  const sc = c => { const r=req(p,c.id); if(r.req==='net') return null; const s=p.scores[c.id]; return s&&typeof s.v==='number'?s.v:null; };
  const strong=CRITERIA.filter(c=>sc(c)>=4), weak=CRITERIA.filter(c=>sc(c)!=null&&sc(c)<=3), no=CRITERIA.filter(c=>p.scores[c.id]&&p.scores[c.id].v==='НО'&&req(p,c.id).req!=='net');
  C.strengths = strong.length ? 'Уверенный уровень по критериям: '+strong.map(c=>`${c.n} (${c.short.toLowerCase()})`).join('; ')+'.' : 'Критериев с уверенным уровнем (4–5) не выявлено.';
  C.gaps = [weak.length?'Пробелы: '+weak.map(c=>`${c.n} — ${sc(c)} балл(а)`).join('; ')+'.':'', k.risks.filter(r=>!r.lim).length?'Дефицит по обязательным критериям: '+k.risks.filter(r=>!r.lim).map(r=>r.c.n).join(', ')+'.':'', no.length?'Не оценены (Н/О): '+no.map(c=>c.n).join(', ')+'.':''].filter(Boolean).join(' ') || 'Значимых пробелов не выявлено.';
  C.verdict = k.verdict.t + '.' + (k.avg!=null?` Средний балл ${f2(k.avg)}.`:'');
  if(!C.methods.length){ C.methods=['interview']; if(p.test&&p.test.done) C.methods.unshift('test','case'); }
  C.proposals = k.verdict.k==='ok' ? 'Подтвердить соответствие / назначить на должность.' : k.verdict.k==='plan' ? 'Назначение / продолжение работы с планом развития и повторной проверкой слабых критериев через 2 месяца.' : 'Не назначать до устранения дефицитов; повторная оценка после обучения.';
  C.training = weak.length ? 'Повторно изучить '+(weak.length>1?'темы ':'тему ')+weak.map(c=>`${c.n} «${c.short}»`).join(', ')+', пройти тест и собеседование по ним.' : 'Поддерживать актуальность знаний: ежеквартальный обзор изменений законодательства.';
  C.responsible = 'Руководитель юридического департамента; '+(weak.length?'2 месяца':'по графику');
}

function protocolDoc(p){
  const k=calc(p), m=S.settings.matrix, C=p.concl;
  const reqT = r => r.req==='op'?'общее представление':r.req==='da'?'да':'нет';
  return `<div class="doc" id="docText">
    <p class="c" style="margin:0 0 10px">ПМУ «Эввива»</p>
    <h4>ПРОТОКОЛ № 4. ЮРИДИЧЕСКИЙ БЛОК</h4>
    <p>Должность: <b>${esc(p.position)}</b> &nbsp; ФИО: <b>${esc(p.fio)}</b><br>Статус: ${esc(p.kind)} &nbsp; Дата: ${fd(p.assessor&&p.assessor.date||iso())}</p>
    <table><thead><tr><th>№</th><th>Оцениваемые знания, способности и умения</th><th>Профильный</th><th>Непрофильный</th><th>Балл 1–5</th><th>Комментарий / доказательство</th></tr></thead><tbody>
    ${CRITERIA.map(c=>{const r=req(p,c.id); const s=p.scores[c.id]||{}; const v=r.req==='net'?'Н/П':s.v==='НО'?'Н/О':s.v==='НП'?'Н/П':(s.v||'');
      return `<tr><td>${c.n}</td><td>${esc(c.title)}</td><td>${reqT(m.profile[c.id])}</td><td>${reqT(m.nonprofile[c.id])}</td><td style="text-align:center"><b>${v}</b></td><td>${esc(s.cm||'')}</td></tr>`;}).join('')}
    </tbody></table>
    <p><b>Средний балл по модулю: ${f2(k.avg)}</b> &nbsp; Применимых критериев: ${k.applicable} &nbsp; Оценено: ${k.scored} &nbsp; Н/О: ${k.no} &nbsp; Н/П: ${k.np}</p>
    <p><b>Ответственный:</b> Руководитель юридического департамента ПМУ «Эввива»</p>
    <p>ФИО оценщика: <span class="ln"></span> Подпись: <span class="ln" style="min-width:100px"></span> Дата: ${fd(p.assessor&&p.assessor.date||iso())}</p>
    <h4 style="margin-top:22px">ЛИСТ ЗАКЛЮЧЕНИЙ № 4. «ЮРИДИЧЕСКИЙ БЛОК»</h4>
    <table><tbody>
      <tr><td style="width:38%">Средний балл по модулю; количество проверенных критериев</td><td>${f2(k.avg)}; ${k.scored} из ${k.applicable}</td></tr>
      <tr><td>Применённые методы оценки и подтверждающие материалы</td><td>${C.methods.map(x=>METHODS[x]).join('; ')||''}</td></tr>
      <tr><td>Сильные стороны и подтверждённые компетенции</td><td>${esc(C.strengths)}</td></tr>
      <tr><td>Выявленные пробелы и профильные риски</td><td>${esc(C.gaps)}</td></tr>
      <tr><td>Заключение о соответствии требованиям должности</td><td>${esc(C.verdict)}</td></tr>
      <tr><td>Предложения по назначению / продолжению работы / повторной оценке</td><td>${esc(C.proposals)}</td></tr>
      <tr><td>Рекомендации по обучению и развитию</td><td>${esc(C.training)}</td></tr>
      <tr><td>Ответственный за исполнение рекомендаций; контрольный срок</td><td>${esc(C.responsible)}</td></tr>
    </tbody></table>
    <p>Ответственный за модуль: <span class="ln"></span> Подпись: <span class="ln" style="min-width:100px"></span></p>
    <p>Ознакомлен(а) с результатами: <span class="ln"></span> «___» __________ 20___ г.</p>
  </div>`;
}

/* ======================= КОМИССИЯ ======================= */
function vCommission(){ return S.ui.coTab==='decision' && S.ui.coId ? coDecision(person(S.ui.coId)) : coList(); }
function coList(){
  return `<h1>Результаты оценки</h1>
  <p class="lead">Сводка по модулю 4. Система считает средний балл, проверяет обязательные критерии и предлагает ступень. Решение принимает комиссия, утверждает генеральный директор.</p>
  <div class="card tscroll"><table class="t"><thead><tr><th>Оцениваемый</th><th>Балл</th><th>Вывод системы</th><th>Предлагаемая ступень</th><th>Риски</th><th>Этап</th><th></th></tr></thead><tbody>
  ${S.people.map(p=>{const k=calc(p); const ready=p.status==='assessed'||p.status==='decided'; return `<tr>
    <td class="who"><b>${esc(p.fio)}</b><small>${esc(p.position)} · ${esc(p.kind)}</small></td>
    <td class="num"><b>${ready?f2(k.avg):'—'}</b></td>
    <td>${ready?`<span class="chip ${k.verdict.k==='ok'?'ok':k.verdict.k==='plan'?'warn':k.verdict.k==='def'?'bad':'grey'}">${k.verdict.k==='ok'?'Соответствует':k.verdict.k==='plan'?'С планом развития':k.verdict.k==='def'?'Дефицит':'—'}</span>`:'<span class="muted small">оценка не завершена</span>'}</td>
    <td>${ready?(p.status==='decided'?`<b>${esc(p.decision.level)}</b>`:esc(k.level?k.level.name:'—')):'—'}</td>
    <td>${ready&&k.defs?`<span class="chip bad">${k.defs}</span>`:ready?'<span class="muted">нет</span>':''}</td>
    <td>${statusChip(p)}</td>
    <td style="text-align:right">${ready?`<button class="btn sm ${p.status==='assessed'?'':'ghost'}" data-a="openCo" data-v="${p.id}">${p.status==='assessed'?'Рассмотреть':'Открыть'}</button>`:''}</td></tr>`;}).join('')}
  </tbody></table></div>`;
}

function decDraft(p){
  if(p.decision) return p.decision;
  if(!S.ui.dec[p.id]){
    const k=calc(p);
    const type = k.verdict.k==='ok'?'ok':k.verdict.k==='plan'?'plan':'retry';
    const plan = CRITERIA.filter(c=>{const s=p.scores[c.id]; return req(p,c.id).req!=='net' && s && typeof s.v==='number' && s.v<4;})
      .map(c=>({t:`Тема ${c.n} «${c.short}»: повторное изучение, тест и собеседование`, o:'Руководитель юридического департамента', d:plusDays(p.scores[c.id].v<3?60:90)}));
    S.ui.dec[p.id]={type, level:k.level?k.level.name:S.settings.levels[0].name, just:'', plan};
  }
  return S.ui.dec[p.id];
}

function coDecision(p){
  const k=calc(p), d=decDraft(p), done=p.status==='decided';
  const proposed=k.level?k.level.name:'—', differs = d.level!==proposed;
  return `<div class="row" style="margin-bottom:10px"><button class="link" data-a="tab" data-k="coTab" data-v="list">← Все результаты</button></div>
  <h1>Решение комиссии</h1>
  <p class="lead">${esc(p.fio)} · ${esc(p.position)} · ${esc(p.kind)} · текущая ступень: ${esc(p.level)}</p>
  <div class="side">
    <div>
      <div class="card"><div class="row"><h2 style="margin:0">Баллы по критериям</h2><span class="sp"></span><button class="btn ghost sm" data-a="preview" data-v="${p.id}">Протокол и лист заключений</button></div>
        <div class="tscroll"><table class="t" style="margin-top:8px"><tbody>${CRITERIA.map(c=>{const r=req(p,c.id); const s=p.scores[c.id]||{}; const v=r.req==='net'?'НП':s.v; const lab=v==='НП'?'Н/П':v==='НО'?'Н/О':v==null?'—':v;
          return `<tr><td style="width:44px"><button class="sb ${scoreBtnClass(v)} ${typeof v!=='number'?'w':''}" disabled>${lab}</button></td><td><b style="font-weight:500">${c.n}. ${esc(c.short)}</b>${r.mand&&r.req!=='net'?' <span class="chip mand">обяз.</span>':''}<div class="small muted">${esc(s.cm||'')}</div></td></tr>`;}).join('')}</tbody></table></div>
      </div>
      <div class="card"><h2>Заключение оценщика</h2>
        <div class="grid g2 small"><div><b>Пробелы и риски</b><p>${esc(p.concl.gaps||'—')}</p></div><div><b>Рекомендации</b><p>${esc(p.concl.training||'—')}</p></div></div>
      </div>
      <div class="card"><h2>Решение</h2>
        <div class="radios">${Object.entries(DECISIONS).map(([dk,dt])=>`<label class="${d.type===dk?'on':''}"><input type="radio" name="dtype" data-f="dtype" value="${dk}" ${d.type===dk?'checked':''} ${done?'disabled':''}><span>${dt}</span></label>`).join('')}</div>
        <div class="grid g2">
          <div class="field"><label>Ступень роста</label><select data-f="dlevel" ${done?'disabled':''}>${S.settings.levels.map(l=>`<option ${l.name===d.level?'selected':''}>${esc(l.name)}</option>`).join('')}</select>
            <div class="small muted" style="margin-top:4px">Предложено системой: <b>${esc(proposed)}</b></div></div>
          <div class="field"><label>Обоснование${differs?' <span style="color:var(--red)">— обязательно, ступень отличается от предложенной</span>':''}</label><textarea data-f="djust" style="min-height:70px" ${done?'disabled':''} placeholder="Мотивированное заключение комиссии">${esc(d.just)}</textarea></div>
        </div>
        <h3>План развития</h3>
        <div class="tscroll"><table class="t plan"><thead><tr><th>Задача</th><th>Ответственный</th><th>Срок</th><th></th></tr></thead><tbody>
          ${d.plan.map((x,i)=>`<tr><td><input type="text" data-f="plan" data-i="${i}" data-k="t" value="${esc(x.t)}" ${done?'disabled':''}></td><td><input type="text" data-f="plan" data-i="${i}" data-k="o" value="${esc(x.o)}" ${done?'disabled':''}></td><td><input type="date" data-f="plan" data-i="${i}" data-k="d" value="${esc(x.d)}" ${done?'disabled':''}></td><td>${done?'':`<button class="x" data-a="delPlan" data-v="${i}" title="Удалить">×</button>`}</td></tr>`).join('') || `<tr><td colspan="4" class="muted small">Задач нет</td></tr>`}
        </tbody></table></div>
        ${done?'':`<button class="link" data-a="addPlan" style="margin-top:10px">+ Добавить задачу</button>`}
        <hr>
        ${done?`<div class="row"><div class="note green" style="flex:1">Решение зафиксировано ${fd(p.decision.date)}. ${p.decision.approved?'Утверждено генеральным директором.':'Ожидает утверждения генеральным директором.'}</div>${p.decision.approved?'':`<button class="btn" data-a="approve">Отметить утверждение ГД</button>`}</div>`
          :`<button class="btn" data-a="decide">Зафиксировать решение комиссии</button> <span class="small muted">&nbsp;После фиксации решение уходит на утверждение генеральному директору.</span>`}
      </div>
    </div>
    <div class="sticky">${summaryCard(p,k,false)}</div>
  </div>`;
}

/* ======================= НАСТРОЙКИ ======================= */
function vSettings(){
  const t=S.ui.setTab, st=S.settings;
  if(t==='levels') return `<h1>Ступени роста</h1>
    <p class="lead">Пример трека для руководителей. Система предлагает самую высокую ступень, порог которой достигнут. Для части ступеней дополнительно требуется отсутствие дефицитов по обязательным критериям. В полной версии у каждой должности свой трек, а расчёт идёт по всем 8 модулям.</p>
    <div class="card tscroll"><table class="t"><thead><tr><th>#</th><th>Ступень</th><th>Минимальный средний балл</th><th>Без дефицитов по обязательным</th></tr></thead><tbody>
    ${st.levels.map((l,i)=>`<tr><td>${i+1}</td><td><input type="text" data-f="lvl" data-i="${i}" data-k="name" value="${esc(l.name)}"></td><td style="width:200px"><input type="number" step="0.1" min="0" max="5" data-f="lvl" data-i="${i}" data-k="min" value="${l.min}"></td><td style="width:220px"><label class="checks"><label><input type="checkbox" data-f="lvl" data-i="${i}" data-k="noDef" ${l.noDef?'checked':''}> требуется</label></label></td></tr>`).join('')}
    </tbody></table></div>
    <div class="note" style="margin-top:16px">Названия ступеней и пороги — пример для прототипа. Их нужно согласовать с кадровым департаментом и утвердить.</div>`;
  if(t==='bank') return `<h1>Банк вопросов</h1>
    <p class="lead">Модуль 4: ${QUESTIONS.length} вопросов и 1 кейс. Правильный ответ выделен. В рабочей версии банк редактирует ответственный за модуль, вопросы выдаются в случайном порядке.</p>
    <div class="note" style="margin-bottom:16px">Демонстрационные вопросы. Перед запуском их проверяет и утверждает юридический департамент.</div>
    ${CRITERIA.map(c=>`<div class="card"><h3>${c.n}. ${esc(c.short)}</h3>${QUESTIONS.filter(q=>q.c===c.id).map(q=>`<div class="q"><p>${esc(q.text)}</p>${q.o.map((o,j)=>`<div class="opt ${j===q.a?'right':''}"><span>${j===q.a?'✓':'·'}</span><span>${esc(o)}</span></div>`).join('')}</div>`).join('')}${c.id==='c8'?`<div class="q"><p>Кейс (открытый ответ, оценивает ответственный)</p><div class="small">${esc(CASE_TEXT)}</div></div>`:''}</div>`).join('')}`;
  return `<h1>Пороги и требования</h1>
    <p class="lead">Настройки методики для модуля 4. Изменения сразу пересчитывают выводы во всех разделах прототипа.</p>
    <div class="card"><h2>Пороги вывода по модулю</h2><div class="grid g4">
      <div class="field"><label>«Соответствует» — средний балл от</label><input type="number" step="0.1" min="1" max="5" data-f="set" data-k="tFull" value="${st.tFull}"></div>
      <div class="field"><label>«С планом развития» — от</label><input type="number" step="0.1" min="1" max="5" data-f="set" data-k="tPlan" value="${st.tPlan}"></div>
      <div class="field"><label>Минимум по обязательному критерию «Да»</label><input type="number" step="1" min="1" max="5" data-f="set" data-k="minDa" value="${st.minDa}"></div>
      <div class="field"><label>Минимум для «Общее представление»</label><input type="number" step="1" min="1" max="5" data-f="set" data-k="minOp" value="${st.minOp}"></div>
    </div><p class="small muted" style="margin:0">Ниже порога «С планом развития» — значимый дефицит. Если есть дефицит по обязательному критерию, вывод «Соответствует» не ставится.</p></div>
    <div class="card tscroll"><h2>Требования по типам должностей</h2>
      <table class="t"><thead><tr><th>Критерий</th><th>Профильная (юридическая)</th><th>Обяз.</th><th>Непрофильная</th><th>Обяз.</th></tr></thead><tbody>
      ${CRITERIA.map(c=>`<tr><td>${c.n}. ${esc(c.short)}</td>${['profile','nonprofile'].map(pf=>{const r=st.matrix[pf][c.id]; return `<td style="width:190px"><select data-f="mx" data-p="${pf}" data-c="${c.id}" data-k="req">${Object.entries(REQ).map(([rk,rt])=>`<option value="${rk}" ${r.req===rk?'selected':''}>${rt}</option>`).join('')}</select></td><td style="width:60px;text-align:center"><input type="checkbox" data-f="mx" data-p="${pf}" data-c="${c.id}" data-k="mand" ${r.mand?'checked':''} style="accent-color:var(--g)"></td>`;}).join('')}</tr>`).join('')}
      </tbody></table>
      <p class="small muted" style="margin:10px 0 0">Значения «Да / Нет» взяты из протокола № 4. Отметки «обязательный» для непрофильных должностей — предложение для прототипа.</p>
    </div>
    <div class="card"><h2>Демо-данные</h2><p class="small muted">Вернуть прототип в исходное состояние: оценки, решения и настройки.</p><button class="btn red" data-a="reset">${S.ui.resetArm?'Нажмите ещё раз для подтверждения':'Сбросить демо-данные'}</button></div>`;
}

/* ======================= РЕНДЕР ======================= */
function render(){
  $('#protobar').innerHTML=vProtobar();
  $('#header').innerHTML=vHeader();
  $('#subnav').innerHTML=vSubnav();
  const v={employee:vEmployee, assessor:vAssessor, commission:vCommission, settings:vSettings}[S.ui.role];
  $('#app').innerHTML=v();
  save();
}
function setRole(r){ S.ui.role=r; S.ui.resetArm=false; try{ if(location.hash!=='#'+r) history.replaceState(null,'','#'+r); }catch(e){} }

function openModal(html){ const m=$('#modal'); m.innerHTML=html; m.classList.remove('hidden'); }
function closeModal(){ $('#modal').classList.add('hidden'); $('#modal').innerHTML=''; }

/* ======================= СОБЫТИЯ ======================= */
document.addEventListener('click', e=>{
  if(e.target.id==='modal'){ closeModal(); return; }
  const a=e.target.closest('[data-a]'); if(!a) return;
  const act=a.dataset.a, v=a.dataset.v;
  const scrollTop = ['tab','role','openAs','openCo'].includes(act);
  switch(act){
    case 'role': setRole(v); break;
    case 'tab': S.ui[a.dataset.k]=v; break;
    case 'toggle': S.ui.open[v]=!S.ui.open[v]; break;
    case 'learn': { const p=person(S.ui.empId); p.learned[v]=!p.learned[v]; if(p.learned[v]){ toast('Тема отмечена как изученная'); } break; }
    case 'submitTest': {
      const p=person(S.ui.empId), d=S.ui.draft[p.id]||{answers:{}};
      const qs=QUESTIONS.filter(q=>req(p,q.c).req!=='net'); const miss=qs.filter(q=>d.answers[q.id]==null);
      if(miss.length){ toast(`Ответьте на все вопросы: осталось ${miss.length}`, true); return; }
      if(!(d.caseAnswer||'').trim()){ toast('Заполните ответ на кейс', true); return; }
      p.test={done:true, date:iso(), answers:{...d.answers}, caseAnswer:d.caseAnswer};
      if(p.status==='learning') p.status='tested';
      delete S.ui.draft[p.id];
      const tr=testResult(p); toast(`Тест отправлен: ${tr.ok} из ${tr.total}. Результаты переданы оценщику`);
      window.scrollTo(0,0); break;
    }
    case 'retest': { const p=person(S.ui.empId); p.test={done:false}; if(p.status==='tested') p.status='learning'; break; }
    case 'openAs': S.ui.asId=v; S.ui.asTab='protocol'; break;
    case 'score': {
      const p=person(S.ui.asId); const c=a.dataset.c; const val = (v==='НО'||v==='НП')?v:Number(v);
      p.scores[c]=p.scores[c]||{cm:''};
      p.scores[c].v = p.scores[c].v===val ? null : val;
      if(!p.assessor) p.assessor={date:iso()};
      break;
    }
    case 'autofill': { autofill(person(S.ui.asId)); toast('Черновик заключения заполнен — проверьте формулировки'); break; }
    case 'submitAs': {
      const p=person(S.ui.asId); const k=calc(p);
      const miss=CRITERIA.filter(c=>req(p,c.id).req!=='net' && !(p.scores[c.id]&&p.scores[c.id].v!=null));
      if(miss.length){ toast('Не оценены критерии: '+miss.map(c=>c.n).join(', ')+'. Поставьте балл или Н/О', true); return; }
      if(!p.concl.verdict.trim()){ autofill(p); }
      p.assessor={date:(p.assessor&&p.assessor.date)||iso()};
      const was=p.status; p.status='assessed'; delete S.ui.dec[p.id];
      toast(was==='assessed'?'Данные для комиссии обновлены':`Протокол передан в комиссию · ${f2(k.avg)} · ${k.verdict.t}`);
      S.ui.asTab='list'; window.scrollTo(0,0); break;
    }
    case 'preview': {
      const p=person(v);
      openModal(`<div class="sheet"><div class="sh"><b style="color:var(--gd)">Предпросмотр документа</b><span class="sp"></span><button class="btn ghost sm" data-a="copyDoc">Копировать текст</button><button class="btn sm" data-a="closeModal">Закрыть</button></div>${protocolDoc(p)}</div>`);
      return;
    }
    case 'copyDoc': { const el=document.getElementById('docText'); try{ navigator.clipboard.writeText(el.innerText).then(()=>toast('Текст скопирован'),()=>toast('Не удалось скопировать',true)); }catch(err){ toast('Не удалось скопировать',true); } return; }
    case 'closeModal': closeModal(); return;
    case 'openCo': S.ui.coId=v; S.ui.coTab='decision'; break;
    case 'addPlan': { const d=decDraft(person(S.ui.coId)); d.plan.push({t:'',o:'Руководитель юридического департамента',d:plusDays(60)}); break; }
    case 'delPlan': { const d=decDraft(person(S.ui.coId)); d.plan.splice(Number(v),1); break; }
    case 'decide': {
      const p=person(S.ui.coId), d=decDraft(p), k=calc(p);
      const proposed=k.level?k.level.name:'—';
      if(d.level!==proposed && !d.just.trim()){ toast('Укажите обоснование: ступень отличается от предложенной системой', true); return; }
      p.decision={...clone(d), date:iso(), approved:false};
      p.status='decided';
      delete S.ui.dec[p.id];
      toast('Решение зафиксировано и отправлено на утверждение генеральному директору'); break;
    }
    case 'approve': { const p=person(S.ui.coId); p.decision.approved=true; p.level=p.decision.level; toast(`Утверждено. Ступень «${p.decision.level}» назначена`); break; }
    case 'reset': {
      if(!S.ui.resetArm){ S.ui.resetArm=true; break; }
      const role=S.ui.role; S=fresh(); S.ui.role=role; S.ui.setTab='rules'; toast('Демо-данные сброшены'); break;
    }
    default: return;
  }
  if(act!=='reset') S.ui.resetArm=false;
  render();
  if(scrollTop) window.scrollTo(0,0);
});

document.addEventListener('toggle', e=>{ const d=e.target; if(d.dataset && d.dataset.open){ S.ui.open[d.dataset.open]=d.open; save(); } }, true);

function field(e, isChange){
  const t=e.target, f=t.dataset&&t.dataset.f; if(!f) return;
  switch(f){
    case 'emp': if(isChange){ S.ui.empId=t.value; render(); } return;
    case 'ans': { const p=person(S.ui.empId); const d=S.ui.draft[p.id]||(S.ui.draft[p.id]={answers:{},caseAnswer:''}); d.answers[t.dataset.q]=Number(t.value); const qs=QUESTIONS.filter(q=>req(p,q.c).req!=='net'); const el=$('#ansCount'); if(el) el.textContent=`Отвечено: ${Object.keys(d.answers).length} из ${qs.length}`; save(); return; }
    case 'case': { const p=person(S.ui.empId); const d=S.ui.draft[p.id]||(S.ui.draft[p.id]={answers:{},caseAnswer:''}); d.caseAnswer=t.value; save(); return; }
    case 'cm': { const p=person(S.ui.asId); p.scores[t.dataset.c]=p.scores[t.dataset.c]||{v:null}; p.scores[t.dataset.c].cm=t.value; save(); return; }
    case 'concl': { person(S.ui.asId).concl[t.dataset.k]=t.value; save(); return; }
    case 'method': { if(!isChange) return; const C=person(S.ui.asId).concl; const m=t.dataset.v; C.methods = t.checked ? [...new Set([...C.methods,m])] : C.methods.filter(x=>x!==m); save(); return; }
    case 'dtype': if(isChange){ decDraft(person(S.ui.coId)).type=t.value; render(); } return;
    case 'dlevel': if(isChange){ decDraft(person(S.ui.coId)).level=t.value; render(); } return;
    case 'djust': decDraft(person(S.ui.coId)).just=t.value; save(); return;
    case 'plan': { const d=decDraft(person(S.ui.coId)); d.plan[Number(t.dataset.i)][t.dataset.k]=t.value; save(); return; }
    case 'set': if(isChange){ const n=parseFloat(String(t.value).replace(',','.')); if(!isNaN(n)) S.settings[t.dataset.k]=n; render(); } return;
    case 'mx': if(isChange){ const r=S.settings.matrix[t.dataset.p][t.dataset.c]; if(t.dataset.k==='mand') r.mand=t.checked; else r.req=t.value; render(); } return;
    case 'lvl': {
      const l=S.settings.levels[Number(t.dataset.i)];
      if(t.dataset.k==='name'){ l.name=t.value; save(); return; }
      if(!isChange) return;
      if(t.dataset.k==='noDef') l.noDef=t.checked; else { const n=parseFloat(String(t.value).replace(',','.')); if(!isNaN(n)) l.min=n; }
      render(); return;
    }
  }
}
document.addEventListener('input', e=>field(e,false));
document.addEventListener('change', e=>field(e,true));
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });
window.addEventListener('hashchange', ()=>{ const h=location.hash.slice(1); if(['employee','assessor','commission','settings'].includes(h) && h!==S.ui.role){ S.ui.role=h; render(); } });

load();
(function(){ const h=location.hash.slice(1); if(['employee','assessor','commission','settings'].includes(h)) S.ui.role=h; })();
render();
