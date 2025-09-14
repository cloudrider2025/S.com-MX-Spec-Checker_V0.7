(function(){
  if(window.__specChecker_loaded) return;
  window.__specChecker_loaded = true;

  let RULES = [
    {u:'%', mode:'nospace', reason:'업계 관행'},
    {u:'°C', mode:'nospace', reason:'업계 관행'},
    {u:'kg', mode:'space', reason:'SI 표준 (물리량)'},
    {u:'g', mode:'space', reason:'SI 표준 (물리량)'},
    {u:'m', mode:'space', reason:'SI 표준 (물리량)'},
    {u:'GB', mode:'space', reason:'업계 관행'}
  ];
  let SETTINGS = {highlight:'box', ocr:false};

  chrome.storage.sync.get(['spec_rules','spec_settings'], res=>{
    if(res.spec_rules) RULES = res.spec_rules;
    if(res.spec_settings) SETTINGS = res.spec_settings;
  });

  function cleanupMarks(){
    document.querySelectorAll('.spec-checker-violation').forEach(el=>{
      const txt = document.createTextNode(el.getAttribute('data-original')||el.textContent);
      el.replaceWith(txt);
    });
    document.querySelectorAll('.spec-checker-img-wrapper').forEach(w=>{
      const img = w.querySelector('img');
      if(img) w.replaceWith(img); else w.remove();
    });
    document.querySelectorAll('.spec-checker-tooltip').forEach(t=>t.remove());
    const s = document.getElementById('spec-checker-style'); if(s) s.remove();
  }

  function injectStyle(){
    if(document.getElementById('spec-checker-style')) return;
    const css = document.createElement('style'); css.id='spec-checker-style';
    css.textContent = `
      .spec-checker-violation{ background:rgba(255,230,230,0.9); border-bottom:2px solid #d9534f; cursor:help; }
      @keyframes spec-blink { 0%{opacity:1}50%{opacity:0.2}100%{opacity:1} }
      .spec-blink { animation: spec-blink 1s linear infinite; }
      .spec-checker-tooltip{ position:fixed; z-index:2147483647; background:#fff;border:1px solid #ccc;padding:8px;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,0.12);font-size:13px;max-width:360px; }
      .spec-checker-img-outline{ outline:3px solid rgba(217,83,79,0.9); }
      .spec-checker-img-wrapper{ position:relative; display:inline-block; }
      .spec-checker-img-badge{ position:absolute; top:6px; left:6px; background:rgba(255,255,255,0.95); color:#a00; padding:4px 6px; border-radius:4px; font-size:12px; border:1px solid #ddd; z-index:2147483647; }
    `;
    document.head.appendChild(css);
  }

  const numberUnitRegex = /(?<![\w\d\-\.])([0-9]{1,3}(?:[\,\s][0-9]{3})*(?:[\.,][0-9]+)?|[0-9]+(?:[\.,][0-9]+)?)(\s?)(%|°[CFK]|[A-Za-zµμΩ]+)\b/g;

  function findRuleFor(unit){ return RULES.find(r=> r.u.toLowerCase()===unit.toLowerCase()); }
  function isViolation(num, space, unit){ const rule = findRuleFor(unit); if(rule) return (rule.mode==='space'? space.length===0 : space.length>0); if(/^[A-Za-zµμ]{2,}$/.test(unit)) return space.length===0; return false; }
  function suggestionFor(num, unit){ const rule = findRuleFor(unit); if(rule) return rule.mode==='space'? (num+' '+unit) : (num+unit); return num+' '+unit; }

  function walkTextNodes(node, cb){
    let child = node.firstChild;
    while(child){
      const next = child.nextSibling;
      if(child.nodeType===3){
        cb(child);
      } else if(child.nodeType===1 && !['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(child.tagName) && !child.classList.contains('spec-checker-violation') && !child.classList.contains('spec-checker-img-wrapper')){
        walkTextNodes(child, cb);
      }
      child = next;
    }
  }

  let currentTooltip = null;
  function showTooltipAt(target, suggestion){
    hideTooltip();
    const tip = document.createElement('div');
    tip.className = 'spec-checker-tooltip';
    tip.innerHTML = `<div><strong>권장 표기</strong></div><div style="margin-top:6px"><code>${suggestion}</code></div><div style="margin-top:8px"><button id="spec-apply">이 표기로 교정</button></div>`;
    document.body.appendChild(tip);
    const r = target.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 80, r.bottom + 6);
    const left = Math.max(6, r.left);
    tip.style.top = top + 'px'; tip.style.left = left + 'px';
    tip.querySelector('#spec-apply').addEventListener('click', ()=>{ applyFix(target, suggestion); hideTooltip(); });
    currentTooltip = tip;
  }
  function hideTooltip(){ if(currentTooltip){ currentTooltip.remove(); currentTooltip=null; } }
  function applyFix(span, suggestion){ span.replaceWith(document.createTextNode(suggestion)); }

  function run(highlightOnly){
    highlightOnly = !!highlightOnly;
    cleanupMarks();
    injectStyle();
    const violations = [];
    walkTextNodes(document.body, textNode=>{
      const text = textNode.nodeValue;
      let match; let last=0; const frag = document.createDocumentFragment();
      numberUnitRegex.lastIndex=0;
      let replaced=false;
      while((match=numberUnitRegex.exec(text))!==null){
        const [full,num,space,unit] = match;
        const start = match.index; const end = numberUnitRegex.lastIndex;
        if(start>last) frag.appendChild(document.createTextNode(text.slice(last,start)));
        if(isViolation(num, space, unit)){
          const span = document.createElement('span');
          span.className = 'spec-checker-violation';
          span.textContent = full;
          span.setAttribute('data-original', full);
          const suggestion = suggestionFor(num, unit);
          span.setAttribute('data-suggestion', suggestion);
          const rule = findRuleFor(unit);
          span.setAttribute('data-reason', rule? rule.reason : '기본 규칙');
          span.addEventListener('mouseenter', e=> showTooltipAt(span, suggestion));
          span.addEventListener('mouseleave', hideTooltip);
          if(SETTINGS.highlight==='blink') span.classList.add('spec-blink');
          frag.appendChild(span);
          violations.push({text:full, suggestion, reason: span.getAttribute('data-reason'), context: text.slice(Math.max(0,start-30), Math.min(text.length,end+30))});
        } else {
          frag.appendChild(document.createTextNode(full));
        }
        last = end; replaced=true;
      }
      if(replaced){
        if(last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        textNode.parentNode.replaceChild(frag, textNode);
      }
    });

    (async ()=>{
      if(!SETTINGS.ocr) return;
      if(!window.Tesseract || !window.Tesseract.recognize){ console.log('Tesseract not available for OCR'); return; }
      const imgs = Array.from(document.images).filter(i=>i.naturalWidth>40 && i.naturalHeight>12);
      for(const img of imgs){
        try{
          const res = await window.Tesseract.recognize(img, 'eng');
          const text = res.data.text || '';
          let m; numberUnitRegex.lastIndex=0;
          while((m = numberUnitRegex.exec(text))!==null){
            const [full,num,space,unit] = m;
            if(isViolation(num,space,unit)){
              if(!img.parentElement.classList.contains('spec-checker-img-wrapper')){
                const wrap = document.createElement('span'); wrap.className='spec-checker-img-wrapper'; img.replaceWith(wrap); wrap.appendChild(img);
              }
              const wrapper = img.parentElement;
              wrapper.classList.add('spec-checker-img-wrapper');
              if(!wrapper.querySelector('.spec-checker-img-badge')){
                const badge = document.createElement('div'); badge.className='spec-checker-img-badge';
                badge.textContent = `${full} → ${suggestionFor(num,unit)}`;
                wrapper.appendChild(badge);
              }
            }
          }
        }catch(e){ console.log('OCR error', e); }
      }
    })();

    window.__specCheckerViolations = violations;
    return violations;
  }

  function applySelectedFixes(indexes){
    const list = window.__specCheckerViolations || [];
    indexes.forEach(i=>{
      const item = list[i];
      if(!item) return;
      const span = Array.from(document.querySelectorAll('.spec-checker-violation')).find(s=> s.textContent===item.text && s.getAttribute('data-suggestion')===item.suggestion);
      if(span) span.replaceWith(document.createTextNode(item.suggestion));
    });
    window.__specCheckerViolations = [];
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
    if(msg.type==='GET_VIOLATIONS'){
      const arr = window.__specCheckerViolations || run(true);
      const mapped = arr.map((v,idx)=> ({text:v.text, suggestion:v.suggestion, reason:v.reason, context:v.context, _idx:idx}));
      sendResponse(mapped);
    } else if(msg.type==='APPLY_FIXES'){
      applySelectedFixes(msg.indexes || []);
      sendResponse({ok:true});
    } else if(msg.type==='SET_SETTINGS' && msg.settings){
      SETTINGS = msg.settings;
      run(true);
      sendResponse({ok:true});
    }
  });

  window.__specChecker = { run, autofix: ()=>{ const v = run(true); const spans = Array.from(document.querySelectorAll('.spec-checker-violation')); spans.forEach(s=>{ const sug = s.getAttribute('data-suggestion'); s.replaceWith(document.createTextNode(sug)); }); window.__specCheckerViolations = []; } };

  try{ if(window.__specChecker_raw_rules) RULES = window.__specChecker_raw_rules; if(window.__specChecker_settings) SETTINGS = window.__specChecker_settings; }catch(e){}
  run(true);

  let timer=null;
  const mo = new MutationObserver(()=>{ if(timer) clearTimeout(timer); timer = setTimeout(()=> run(true), 300); });
  mo.observe(document.body, {childList:true, subtree:true, characterData:true});

})();
