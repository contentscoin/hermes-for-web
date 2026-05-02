(function(){
  const DEFAULT_LANES=[
    {id:'hela',label:'Hela',profile:'default',placeholder:'전체 조율/요약을 물어보세요'},
    {id:'plan',label:'Plan',profile:'paperclip-plan',placeholder:'기획/우선순위/로드맵을 물어보세요'},
    {id:'dev',label:'Dev',profile:'paperclip-dev',placeholder:'구현/테스트/디버깅을 물어보세요'},
    {id:'mkt',label:'Mkt',profile:'paperclip-mkt',placeholder:'메시지/브랜딩/마케팅을 물어보세요'},
  ];
  const TELEGRAM_IDENTITIES={
    'default': {name:'Hela', handle:'@Paxclawbot'},
    'paperclip-plan': {name:'Mendy', handle:'@Paxclawplanbot'},
    'paperclip-dev': {name:'Clay', handle:'@Paxclawdevbot'},
    'paperclip-mkt': {name:'Jay', handle:'@Paxclawmktbot'},
  };
  const LANE_INVOCATIONS={
    hela:['hela','@paxclawbot'],
    plan:['mendy','@paxclawplanbot','plan','planning','pm','기획'],
    dev:['clay','@paxclawdevbot','dev','development','개발'],
    mkt:['jay','@paxclawmktbot','mkt','marketing','마케팅','브랜딩','콘텐츠'],
  };

  function ensureMultiAgentState(){
    if(!window.S) return;
    if(!S.multiAgent){
      S.multiAgent={enabled:false,profiles:null,lanes:DEFAULT_LANES.map(makeLaneState)};
    }
    if(!Array.isArray(S.multiAgent.lanes)||!S.multiAgent.lanes.length){
      S.multiAgent.lanes=DEFAULT_LANES.map(makeLaneState);
    }
  }

  function makeLaneState(def){
    const workspace=(S&&S.session&&S.session.workspace)||null;
    const model=(S&&S.session&&S.session.model)||null;
    return {
      id:def.id,
      label:def.label,
      profile:def.profile,
      session:null,
      messages:[],
      workspace,
      model,
      busy:false,
      streamId:null,
      placeholder:def.placeholder,
      draft:'',
    };
  }

  function getLane(id){ ensureMultiAgentState(); return S.multiAgent.lanes.find(l=>l.id===id); }

  async function loadProfilesForMultiAgent(){
    ensureMultiAgentState();
    if(S.multiAgent.profiles) return S.multiAgent.profiles;
    const data=await api('/api/profiles');
    S.multiAgent.profiles=data.profiles||[];
    return S.multiAgent.profiles;
  }

  function escapeAttr(s){ return esc(s).replace(/"/g,'&quot;'); }

  function buildMultiAgentModelOptions(){
    const base=$('modelSelect');
    if(!base) return '';
    const options=Array.from(base.options||[]).filter(o=>o&&o.value);
    const current=base.value||'';
    const score=o=>o.value===current?0:(o.value==='gpt-5.5'?1:o.value.startsWith('openai/')?2:o.value.startsWith('anthropic/')?3:4);
    const norm=v=>String(v||'').toLowerCase().replace(/^[^/]+\//,'');
    const seen=new Map();
    for(const opt of options.sort((a,b)=>score(a)-score(b))){
      const key=norm(opt.value);
      if(!seen.has(key)) seen.set(key,opt);
    }
    return Array.from(seen.values()).map(o=>`<option value="${escapeAttr(o.value)}">${esc(o.textContent||o.value)}</option>`).join('');
  }

  function renderMultiAgentShell(){
    ensureMultiAgentState();
    const grid=$('multiAgentGrid');
    if(!grid) return;
    grid.innerHTML='';
    const profiles=S.multiAgent.profiles||[];
    const modelOptions=buildMultiAgentModelOptions();
    for(const lane of S.multiAgent.lanes){
      const card=document.createElement('section');
      card.className='lane-card'+(lane.busy?' is-busy':'');
      const profileOptions=profiles.map(p=>`<option value="${escapeAttr(p.name)}" ${p.name===lane.profile?'selected':''}>${esc(p.name)}</option>`).join('');
      const laneModel=lane.model||$('modelSelect')?.value||'';
      const messagesHtml=renderLaneMessagesHtml(lane);
      const telegramIdentity=TELEGRAM_IDENTITIES[lane.profile]||null;
      const telegramMeta=telegramIdentity
        ? `<div class="lane-telegram">Telegram: <strong>${esc(telegramIdentity.name)}</strong> <span>${esc(telegramIdentity.handle)}</span></div>`
        : `<div class="lane-telegram">Telegram: <span>연결 정보 없음</span></div>`;
      card.innerHTML=`
        <div class="lane-head">
          <div>
            <div class="lane-title">${esc(lane.label)}</div>
            <div class="lane-meta">profile <strong>${esc(lane.profile)}</strong></div>
            ${telegramMeta}
          </div>
          <div class="lane-head-actions">
            <button class="lane-btn" data-lane-reset="${lane.id}">새 세션</button>
          </div>
        </div>
        <div class="lane-controls">
          <label class="lane-field">
            <span>Profile</span>
            <select data-lane-profile="${lane.id}">${profileOptions}</select>
          </label>
          <label class="lane-field">
            <span>Model</span>
            <select data-lane-model="${lane.id}">${modelOptions}</select>
          </label>
          <label class="lane-field lane-field-wide">
            <span>Workspace</span>
            <input data-lane-workspace="${lane.id}" value="${escapeAttr(lane.workspace||'')}" placeholder="/absolute/path/to/workspace">
          </label>
        </div>
        <div class="lane-messages" id="laneMessages-${lane.id}">${messagesHtml}</div>
        <div class="lane-composer">
          <textarea data-lane-input="${lane.id}" placeholder="${escapeAttr(lane.placeholder)}">${esc(lane.draft||'')}</textarea>
          <div class="lane-composer-row">
            <button class="lane-btn primary" data-lane-send="${lane.id}" ${lane.busy?'disabled':''}>${lane.busy?'실행 중…':'보내기'}</button>
          </div>
        </div>`;
      grid.appendChild(card);
      const modelSel=card.querySelector(`[data-lane-model="${lane.id}"]`);
      if(modelSel&&laneModel)_applyModelToDropdown(laneModel,modelSel);
    }
    bindMultiAgentEvents();
    renderMultiAgentSummary();
  }

  function renderLaneMessagesHtml(lane){
    if(!lane.messages.length){
      return `<div class="lane-empty">아직 대화가 없습니다. ${esc(lane.label)} lane에서 바로 시작해보세요.</div>`;
    }
    return lane.messages.map(m=>{
      const role=(m.role||'assistant');
      const cls=role==='user'?'user':'assistant';
      const label=role==='user'?'You':lane.label;
      const content=typeof m.content==='string'?m.content:JSON.stringify(m.content||'');
      return `<div class="lane-msg ${cls}"><div class="lane-msg-role">${esc(label)}</div><div class="lane-msg-body">${renderMd(content)}</div></div>`;
    }).join('');
  }

  function bindMultiAgentEvents(){
    const routerBtn=$('btnRouteMultiAgent');
    const routerInput=$('multiAgentPrompt');
    if(routerBtn) routerBtn.onclick=()=>routePromptToLanes();
    if(routerInput){
      routerInput.onkeydown=e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); routePromptToLanes(); } };
    }
    document.querySelectorAll('[data-lane-send]').forEach(btn=>btn.onclick=()=>sendLaneMessage(btn.dataset.laneSend));
    document.querySelectorAll('[data-lane-reset]').forEach(btn=>btn.onclick=()=>resetLane(btn.dataset.laneReset));
    document.querySelectorAll('[data-lane-profile]').forEach(sel=>sel.onchange=()=>updateLaneProfile(sel.dataset.laneProfile,sel.value));
    document.querySelectorAll('[data-lane-model]').forEach(sel=>sel.onchange=()=>{const lane=getLane(sel.dataset.laneModel);if(lane) lane.model=sel.value; renderMultiAgentSummary();});
    document.querySelectorAll('[data-lane-workspace]').forEach(inp=>inp.onchange=()=>{const lane=getLane(inp.dataset.laneWorkspace);if(lane) lane.workspace=inp.value.trim(); renderMultiAgentSummary();});
    document.querySelectorAll('[data-lane-input]').forEach(ta=>{
      ta.oninput=()=>{const lane=getLane(ta.dataset.laneInput);if(lane) lane.draft=ta.value;};
      ta.onkeydown=e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendLaneMessage(ta.dataset.laneInput); } };
    });
  }

  function laneMatchesInvocation(laneId, text){
    const hay=(text||'').toLowerCase();
    const keys=LANE_INVOCATIONS[laneId]||[];
    return keys.some(k=>hay.includes(String(k).toLowerCase()));
  }

  function resolveTargetLanes(text){
    const targets=[];
    for(const lane of DEFAULT_LANES){
      if(lane.id==='hela') continue;
      if(laneMatchesInvocation(lane.id, text)) targets.push(lane.id);
    }
    if(laneMatchesInvocation('hela', text)) targets.unshift('hela');
    return targets.length ? Array.from(new Set(targets)) : ['hela'];
  }

  async function routePromptToLanes(){
    ensureMultiAgentState();
    const input=$('multiAgentPrompt');
    const text=(input&&input.value||'').trim();
    if(!text) return;
    const targetLaneIds=resolveTargetLanes(text);
    if(input) input.value='';
    for(const laneId of targetLaneIds){
      const lane=getLane(laneId);
      if(!lane) continue;
      await sendLaneText(lane, text);
    }
  }

  function renderLaneToDom(lane){
    const box=$(`laneMessages-${lane.id}`);
    if(box){
      box.innerHTML=renderLaneMessagesHtml(lane);
      box.scrollTop=box.scrollHeight;
    }
    renderMultiAgentSummary();
  }

  function renderMultiAgentSummary(){
    ensureMultiAgentState();
    const el=$('multiAgentSummary');
    if(!el) return;
    const parts=S.multiAgent.lanes.map(lane=>{
      const last=[...lane.messages].reverse().find(m=>m.role==='assistant');
      const text=last&&typeof last.content==='string'?last.content.replace(/\s+/g,' ').trim():'';
      const handoff=(lane.id==='hela'&&text)
        ? `<div class="multi-agent-handoff"><div class="multi-agent-handoff-label">Hela 응답 후 관점 넘기기</div><div class="multi-agent-handoff-actions"><button class="lane-btn" data-handoff="plan">Plan</button><button class="lane-btn" data-handoff="dev">Dev</button><button class="lane-btn" data-handoff="mkt">Mkt</button></div></div>`
        : '';
      return `<div class="multi-agent-summary-card"><div class="multi-agent-summary-title">${esc(lane.label)}</div><div class="multi-agent-summary-body">${esc(text?text.slice(0,180):'아직 응답 없음')}</div>${handoff}</div>`;
    }).join('');
    el.innerHTML=`<div class="multi-agent-summary-head">Latest lane outputs</div><div class="multi-agent-summary-grid">${parts}</div>`;
    bindHandoffButtons();
  }

  function buildHandoffPrompt(targetLaneId){
    const hela=getLane('hela');
    const lastUser=hela?[...hela.messages].reverse().find(m=>m.role==='user'):null;
    const lastAssistant=hela?[...hela.messages].reverse().find(m=>m.role==='assistant' && typeof m.content==='string' && m.content.trim()):null;
    const userText=lastUser&&typeof lastUser.content==='string'?lastUser.content.trim():'';
    const assistantText=lastAssistant&&typeof lastAssistant.content==='string'?lastAssistant.content.trim():'';
    const lanePrompts={
      plan:'이 질문을 기획 관점에서 정리해줘.',
      dev:'이 질문을 개발 관점에서 feasibility/구현 기준으로 봐줘.',
      mkt:'이 질문을 마케팅 관점에서 메시지/채널 기준으로 봐줘.',
    };
    return `${lanePrompts[targetLaneId]||'이 질문을 해당 관점으로 봐줘.'}\n\n원래 질문:\n${userText||'(없음)'}\n\nHela 요약:\n${assistantText||'(없음)'}`;
  }

  function bindHandoffButtons(){
    document.querySelectorAll('[data-handoff]').forEach(btn=>{
      btn.onclick=async()=>{
        const target=btn.dataset.handoff;
        const lane=getLane(target);
        if(!lane||lane.busy) return;
        const prompt=buildHandoffPrompt(target);
        await sendLaneText(lane, prompt);
      };
    });
  }

  function applyMultiAgentVisibility(){
    const enabled=!!(S&&S.multiAgent&&S.multiAgent.enabled);
    document.body.classList.toggle('multi-agent-mode',enabled);
    const shell=$('multiAgentShell');
    if(shell) shell.style.display=enabled?'block':'none';
    const btn=$('btnMultiAgent');
    if(btn) btn.classList.toggle('active',enabled);
  }

  async function createLaneSession(lane){
    const data=await api('/api/session/new', {method:'POST', body: JSON.stringify({
      profile: lane.profile,
      workspace: lane.workspace || (S.session&&S.session.workspace) || null,
      model: lane.model || $('modelSelect')?.value || null,
    })});
    lane.session=data.session;
    lane.messages=data.session.messages||[];
    lane.workspace=lane.session.workspace;
    lane.model=lane.session.model;
    return lane.session;
  }

  async function sendLaneMessage(laneId){
    ensureMultiAgentState();
    const lane=getLane(laneId);
    if(!lane||lane.busy) return;
    const text=(lane.draft||'').trim();
    if(!text) return;
    lane.draft='';
    await sendLaneText(lane, text);
  }

  async function sendLaneText(lane, text){
    lane.busy=true;
    if(!lane.session) await createLaneSession(lane);
    lane.messages.push({role:'user',content:text});
    lane.messages.push({role:'assistant',content:''});
    renderMultiAgentShell();
    try{
      const start=await api('/api/chat/start',{method:'POST', body: JSON.stringify({
        session_id: lane.session.session_id,
        message: text,
        model: lane.model || lane.session.model,
        workspace: lane.workspace || lane.session.workspace,
        profile: lane.profile,
      })});
      lane.streamId=start.stream_id;
      await consumeLaneStream(lane);
    }catch(e){
      lane.messages[lane.messages.length-1]={role:'assistant',content:`**Error:** ${e.message}`};
      lane.busy=false;
      renderMultiAgentShell();
      showToast(`Lane ${lane.label}: ${e.message}`);
    }
  }

  function consumeLaneStream(lane){
    return new Promise((resolve)=>{
      let assistantText='';
      const src=new EventSource(new URL(`/api/chat/stream?stream_id=${encodeURIComponent(lane.streamId)}`,location.origin).href,{withCredentials:true});
      const apply=()=>{
        const last=lane.messages[lane.messages.length-1];
        if(last&&last.role==='assistant') last.content=assistantText;
        renderLaneToDom(lane);
      };
      src.addEventListener('token',e=>{
        const d=JSON.parse(e.data);
        assistantText += d.text || '';
        apply();
      });
      src.addEventListener('done',e=>{
        src.close();
        const d=JSON.parse(e.data);
        lane.session=d.session;
        lane.messages=d.session.messages||lane.messages;
        lane.workspace=lane.session.workspace;
        lane.model=lane.session.model;
        lane.streamId=null;
        lane.busy=false;
        renderMultiAgentShell();
        resolve();
      });
      src.addEventListener('apperror',e=>{
        src.close();
        try{
          const d=JSON.parse(e.data);
          lane.messages[lane.messages.length-1]={role:'assistant',content:`**Error:** ${d.message||'unknown error'}`};
        }catch(_){
          lane.messages[lane.messages.length-1]={role:'assistant',content:'**Error:** stream failed'};
        }
        lane.streamId=null;
        lane.busy=false;
        renderMultiAgentShell();
        resolve();
      });
      src.addEventListener('error',()=>{
        src.close();
        lane.streamId=null;
        lane.busy=false;
        renderMultiAgentShell();
        resolve();
      });
    });
  }

  function updateLaneProfile(laneId, profile){
    const lane=getLane(laneId);
    if(!lane) return;
    lane.profile=profile;
    lane.session=null;
    lane.messages=[];
    renderMultiAgentShell();
  }

  function resetLane(laneId){
    const lane=getLane(laneId);
    if(!lane) return;
    const fresh=makeLaneState(DEFAULT_LANES.find(d=>d.id===laneId)||lane);
    fresh.profile=lane.profile;
    fresh.workspace=lane.workspace;
    fresh.model=lane.model;
    const idx=S.multiAgent.lanes.findIndex(l=>l.id===laneId);
    if(idx>=0) S.multiAgent.lanes[idx]=fresh;
    renderMultiAgentShell();
  }

  function resetMultiAgentWorkspace(){
    ensureMultiAgentState();
    S.multiAgent.lanes=DEFAULT_LANES.map(makeLaneState);
    renderMultiAgentShell();
  }

  async function toggleMultiAgentWorkspace(force){
    ensureMultiAgentState();
    if(typeof force==='boolean') S.multiAgent.enabled=force;
    else S.multiAgent.enabled=!S.multiAgent.enabled;
    if(S.multiAgent.enabled){
      await loadProfilesForMultiAgent();
      renderMultiAgentShell();
    }
    applyMultiAgentVisibility();
  }

  window.ensureMultiAgentState=ensureMultiAgentState;
  window.toggleMultiAgentWorkspace=toggleMultiAgentWorkspace;
  window.renderMultiAgentShell=renderMultiAgentShell;
  window.resetMultiAgentWorkspace=resetMultiAgentWorkspace;
})();
