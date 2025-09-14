const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// Tab behavior
$$('.tabs button').forEach(btn=>btn.addEventListener('click', ()=>{
  $$('.tabs button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  $$('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
}));

const RULES_KEY = 'spec_rules';
const SETTINGS_KEY = 'spec_settings';

function loadDefaults(){
  return [
    {u:'%', mode:'nospace', reason:'업계 관행'},
    {u:'°C', mode:'nospace', reason:'업계 관행'},
    {u:'kg', mode:'space', reason:'SI 표준 (물리량)'},
    {u:'g', mode:'space', reason:'SI 표준 (물리량)'},
    {u:'m', mode:'space', reason:'SI 표준 (물리량)'},
    {u:'GB', mode:'space', reason:'업계 관행'},
    {u:'MB', mode:'space', reason:'업계 관행'}
  ];
}

function getSettings(cb){
  chrome.storage.sync.get([RULES_KEY, SETTINGS_KEY], res=>{
    const rules = res[RULES_KEY] || loadDefaults();
    const settings = res[SETTINGS_KEY] || {highlight:'box', ocr:false};
    cb(rules, settings);
  });
}

function renderRules(rules){
  const tbody = $('#rules-table tbody');
  tbody.innerHTML = '';
  rules.forEach((r, i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.u}</td><td>${r.mode==='space'?'띄어쓰기':'붙여쓰기'}</td><td>${r.reason}</td>
      <td><button data-del="${i}">삭제</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button[data-del]').forEach(btn=>btn.addEventListener('click', ()=>{
    const idx = +btn.dataset.del;
    rules.splice(idx,1);
    chrome.storage.sync.set({[RULES_KEY]:rules}, ()=>renderRules(rules));
  }));
}

function saveSettings(settings){
  chrome.storage.sync.set({[SETTINGS_KEY]:settings});
}

getSettings((rules, settings)=>{
  renderRules(rules);
  if(settings.highlight) document.querySelector(`input[name=highlight][value=${settings.highlight}]`).checked = true;
  $('#ocr-toggle').checked = !!settings.ocr;
});

$('#add-rule').addEventListener('click', ()=>{
  const u = $('#new-unit').value.trim();
  if(!u) return alert('단위를 입력하세요.');
  const mode = $('#new-mode').value;
  const reason = $('#new-reason').value;
  getSettings((rules, settings)=>{
    rules.push({u, mode, reason});
    chrome.storage.sync.set({[RULES_KEY]:rules}, ()=>{ renderRules(rules); $('#new-unit').value=''; });
  });
});

$('#rescan').addEventListener('click', ()=>{
  getSettings((rules, settings)=>{
    chrome.tabs.query({active:true,currentWindow:true}, tabs=>{
      chrome.scripting.executeScript({target:{tabId:tabs[0].id}, func: (r, s)=>{
        window.__specChecker_raw_rules = r;
        window.__specChecker_settings = s;
        if(window.__specChecker && window.__specChecker.run) window.__specChecker.run(true);
      }, args: [rules, settings]}).then(()=>fetchResults());
    });
  });
});

function fetchResults(){
  chrome.tabs.query({active:true,currentWindow:true}, tabs=>{
    chrome.tabs.sendMessage(tabs[0].id, {type:'GET_VIOLATIONS'}, resp=>{
      const list = resp || [];
      const container = $('#results-list');
      if(list.length===0){ container.innerHTML = '<div style="color:green">문제 없음</div>'; return; }
      const table = document.createElement('table');
      table.style.width='100%';
      table.innerHTML = '<thead><tr><th>잘못된 표기</th><th>권장 표기</th><th>근거</th><th>컨텍스트</th></tr></thead>';
      const tbody = document.createElement('tbody');
      list.forEach(it=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${it.text}</td><td>${it.suggestion}</td><td>${it.reason||''}</td><td>${it.context}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.innerHTML=''; container.appendChild(table);
    });
  });
}

$('#autofix').addEventListener('click', ()=>{
  chrome.tabs.query({active:true,currentWindow:true}, tabs=>{
    chrome.tabs.sendMessage(tabs[0].id, {type:'GET_VIOLATIONS'}, resp=>{
      const list = resp || [];
      if(list.length===0) return alert('교정할 항목이 없습니다.');
      const modal = document.createElement('div'); modal.style.position='fixed'; modal.style.left='20px'; modal.style.top='60px';
      modal.style.right='20px'; modal.style.bottom='60px'; modal.style.background='#fff'; modal.style.border='1px solid #ddd'; modal.style.padding='12px'; modal.style.overflow='auto'; modal.style.zIndex=9999;
      modal.innerHTML = '<h3>교정 검토</h3><div id="fix-list"></div><div style="margin-top:8px"><button id="apply-fixes">선택 적용</button> <button id="close-modal">닫기</button></div>';
      document.body.appendChild(modal);
      const fl = modal.querySelector('#fix-list');
      list.forEach((it,idx)=>{
        const div = document.createElement('div'); div.style.marginBottom='6px';
        div.innerHTML = `<label><input type="checkbox" data-idx="${idx}" checked> ${it.text} → ${it.suggestion} <small style="color:#666">(${it.reason||''})</small></label>`;
        fl.appendChild(div);
      });
      modal.querySelector('#close-modal').addEventListener('click', ()=>modal.remove());
      modal.querySelector('#apply-fixes').addEventListener('click', ()=>{
        const checked = Array.from(modal.querySelectorAll('input[type=checkbox]:checked')).map(cb=>+cb.dataset.idx);
        chrome.tabs.sendMessage(tabs[0].id, {type:'APPLY_FIXES', indexes:checked}, resp=>{ alert('선택 적용 완료'); modal.remove(); fetchResults(); });
      });
    });
  });
});

$('#export-csv').addEventListener('click', ()=>{
  chrome.tabs.query({active:true,currentWindow:true}, tabs=>{
    chrome.tabs.sendMessage(tabs[0].id, {type:'GET_VIOLATIONS'}, resp=>{
      const list = resp || [];
      if(list.length===0) return alert('내보낼 항목이 없습니다.');
      const rows = [['잘못된 표기','권장 표기','근거','컨텍스트','페이지']];
      list.forEach(it=> rows.push([it.text, it.suggestion, it.reason||'', it.context, tabs[0].url]));
      const csv = rows.map(r=> r.map(c=> `"${(''+c).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({url, filename:'spec_errors.csv'});
    });
  });
});

$('#input-text').addEventListener('input', ()=>{
  const text = $('#input-text').value;
  getSettings((rules, settings)=>{
    const numberUnitRegex = /(?<![\w\d\-\.])([0-9]{1,3}(?:[\,\s][0-9]{3})*(?:[\.,][0-9]+)?|[0-9]+(?:[\.,][0-9]+)?)(\s?)(%|°[CFK]|[A-Za-zµμΩ]+)\b/g;
    const findings=[];
    let m; numberUnitRegex.lastIndex=0;
    while((m=numberUnitRegex.exec(text))!==null){
      const [full,num,space,unit]=m;
      const rule = rules.find(r=> r.u.toLowerCase()===unit.toLowerCase());
      let violation=false; let suggestion='';
      if(rule){ violation = (rule.mode==='space'? space.length===0 : space.length>0); suggestion = rule.mode==='space'? (num+' '+unit) : (num+unit); }
      else { violation = /^[A-Za-zµμ]{2,}$/.test(unit) && space.length===0; suggestion = violation? (num+' '+unit): full; }
      if(violation) findings.push({text:full,suggestion,reason:rule?rule.reason:'기본 규칙',context: text.slice(Math.max(0,m.index-20), Math.min(text.length, numberUnitRegex.lastIndex+20))});
    }
    const out = $('#input-result');
    if(findings.length===0) out.innerHTML = '<div style="color:green">문제 없음</div>';
    else {
      const t = document.createElement('table'); t.style.width='100%'; t.innerHTML='<thead><tr><th>잘못</th><th>권장</th><th>근거</th></tr></thead>';
      const tb = document.createElement('tbody');
      findings.forEach(f=> tb.innerHTML += `<tr><td>${f.text}</td><td>${f.suggestion}</td><td>${f.reason}</td>`);
      t.appendChild(tb); out.innerHTML=''; out.appendChild(t);
    }
  });
});

fetchResults();

$$('input[name=highlight]').forEach(inp=> inp.addEventListener('change', ()=>{
  const settings = {highlight: document.querySelector('input[name=highlight]:checked').value, ocr: $('#ocr-toggle').checked};
  saveSettings(settings);
  chrome.tabs.query({active:true,currentWindow:true}, tabs=> chrome.tabs.sendMessage(tabs[0].id, {type:'SET_SETTINGS', settings}));
}));
$('#ocr-toggle').addEventListener('change', ()=>{
  const settings = {highlight: document.querySelector('input[name=highlight]:checked').value, ocr: $('#ocr-toggle').checked};
  saveSettings(settings);
  chrome.tabs.query({active:true,currentWindow:true}, tabs=> chrome.tabs.sendMessage(tabs[0].id, {type:'SET_SETTINGS', settings}));
});
