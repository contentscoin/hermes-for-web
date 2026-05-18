async function cancelStream(){
  const streamId = S.activeStreamId;
  if(!streamId) return;
  try{
    await fetch(new URL(`/api/chat/cancel?stream_id=${encodeURIComponent(streamId)}`,location.origin).href,{credentials:'include'});
    const btn=$('btnCancel');if(btn)btn.style.display='none';
    setStatus('Cancelling…');
  }catch(e){setStatus('Cancel failed: '+e.message);}
}

// ── Mobile navigation ──────────────────────────────────────────────────────
function toggleMobileSidebar(){
  const sidebar=document.querySelector('.sidebar');
  const overlay=$('mobileOverlay');
  if(!sidebar)return;
  const isOpen=sidebar.classList.contains('mobile-open');
  if(isOpen){closeMobileSidebar();}
  else{sidebar.classList.add('mobile-open');if(overlay)overlay.classList.add('visible');}
}
function closeMobileSidebar(){
  const sidebar=document.querySelector('.sidebar');
  const overlay=$('mobileOverlay');
  if(sidebar)sidebar.classList.remove('mobile-open');
  if(overlay)overlay.classList.remove('visible');
}
function toggleMobileFiles(){
  const panel=document.querySelector('.rightpanel');
  if(!panel)return;
  panel.classList.toggle('mobile-open');
}
function mobileSwitchPanel(name){
  // Switch the panel content view
  switchPanel(name);
  // For non-chat panels (tasks, skills, memory, spaces), open the sidebar
  // so the panel is visible. For 'chat', the content is in the main area —
  // just close the sidebar so the chat view is unobstructed.
  if(name==='chat'){
    closeMobileSidebar();
  } else {
    const sidebar=document.querySelector('.sidebar');
    const overlay=$('mobileOverlay');
    if(sidebar){
      sidebar.classList.add('mobile-open');
      if(overlay)overlay.classList.add('visible');
    }
  }
  // Update bottom nav active state
  document.querySelectorAll('.mobile-nav-btn').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.panel===name);
  });
}

$('btnSend').onclick=()=>{if(window._micActive)_stopMic();send();};
$('btnAttach').onclick=()=>$('fileInput').click();

// ── Voice input (Web Speech API) ─────────────────────────────────────────
(function(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition) return; // Browser unsupported — mic button stays hidden

  const btn=$('btnMic');
  const status=$('micStatus');
  const ta=$('msg');
  btn.style.display=''; // Show button — browser supports speech

  const recognition=new SpeechRecognition();
  recognition.continuous=false;
  recognition.interimResults=true;
  recognition.lang=(navigator.language||'ko-KR');

  let _finalText='';
  let _prefix='';

  function _setRecording(on){
    window._micActive=on;
    btn.classList.toggle('recording',on);
    status.style.display=on?'':'none';
    if(!on){ _finalText=''; _prefix=''; }
  }

  recognition.onstart=()=>{ _finalText=''; };

  recognition.onresult=(event)=>{
    let interim='';
    let final=_finalText;
    for(let i=event.resultIndex;i<event.results.length;i++){
      const t=event.results[i][0].transcript;
      if(event.results[i].isFinal){ final+=t; _finalText=final; }
      else{ interim+=t; }
    }
    // Append to whatever was already in the textarea before mic started
    ta.value=_prefix+(final||interim);
    autoResize();
  };

  recognition.onend=()=>{
    // Commit: prefix + final transcription; trim trailing space if prefix was non-empty
    const committed=_finalText
      ? (_prefix&&!_prefix.endsWith(' ')&&!_prefix.endsWith('\n')
          ? _prefix+' '+_finalText.trimStart()
          : _prefix+_finalText)
      : ta.value; // no speech detected — leave whatever is there
    _setRecording(false);
    ta.value=committed;
    autoResize();
  };

  recognition.onerror=(event)=>{
    _setRecording(false);
    const msgs={
      'not-allowed':'마이크 권한이 차단되었습니다. 브라우저 사이트 권한에서 마이크를 허용해 주세요.',
      'service-not-allowed':'이 브라우저/환경에서 음성 인식 서비스 사용이 차단되었습니다.',
      'no-speech':'음성이 감지되지 않았습니다. 다시 시도해 주세요.',
      'audio-capture':'마이크를 찾지 못했습니다. 입력 장치를 확인해 주세요.',
      'network':'음성 인식 서비스를 사용할 수 없습니다. 네트워크 또는 브라우저 지원 여부를 확인해 주세요.',
    };
    showToast(msgs[event.error]||('음성 입력 오류: '+event.error));
  };

  function _stopMic(){
    if(window._micActive){ recognition.stop(); }
  }
  window._stopMic=_stopMic; // expose for send-guard above

  btn.onclick=()=>{
    if(window._micActive){
      recognition.stop();
      // _setRecording(false) will be called by onend
    } else {
      _finalText='';
      // Snapshot existing textarea content so we append rather than replace
      _prefix=ta.value;
      showToast(`음성 인식 시작 (${recognition.lang})`);
      recognition.start();
      _setRecording(true);
    }
  };
})();
window._micActive=window._micActive||false;
$('fileInput').onchange=e=>{addFiles(Array.from(e.target.files));e.target.value='';};
$('btnNewChat').onclick=async()=>{await newSession();await renderSessionList();$('msg').focus();};
$('btnDownload').onclick=()=>{
  if(!S.session)return;
  const blob=new Blob([transcript()],{type:'text/markdown'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`hermes-${S.session.session_id}.md`;a.click();URL.revokeObjectURL(a.href);
};
$('btnExportJSON').onclick=()=>{
  if(!S.session)return;
  const url=`/api/session/export?session_id=${encodeURIComponent(S.session.session_id)}`;
  const a=document.createElement('a');a.href=url;
  a.download=`hermes-${S.session.session_id}.json`;a.click();
};
$('btnImportJSON').onclick=()=>$('importFileInput').click();
$('importFileInput').onchange=async(e)=>{
  const file=e.target.files[0];
  if(!file)return;
  e.target.value='';
  try{
    const text=await file.text();
    const data=JSON.parse(text);
    const res=await api('/api/session/import',{method:'POST',body:JSON.stringify(data)});
    if(res.ok&&res.session){
      await loadSession(res.session.session_id);
      await renderSessionList();
      showToast('Session imported');
    }
  }catch(err){
    showToast('Import failed: '+(err.message||'Invalid JSON'));
  }
};
// btnRefreshFiles is now panel-icon-btn in header (see HTML)
function clearPreview(){
  const pa=$('previewArea');if(pa)pa.classList.remove('visible');
  const pi=$('previewImg');if(pi){pi.onerror=null;pi.src='';}
  const pm=$('previewMd');if(pm)pm.innerHTML='';
  const pc=$('previewCode');if(pc)pc.textContent='';
  const pp=$('previewPathText');if(pp)pp.textContent='';
  const ft=$('fileTree');if(ft)ft.style.display='';
  const we=$('workspaceEmpty');if(we)we.style.display='flex';
  _previewCurrentPath='';_previewCurrentMode='';_previewDirty=false;
}
$('btnClearPreview').onclick=clearPreview;
// workspacePath click handler removed -- use topbar workspace chip dropdown instead
$('modelSelect').onchange=async()=>{
  if(!S.session)return;
  const selectedModel=$('modelSelect').value;
  localStorage.setItem('hermes-webui-model', selectedModel);
  await api('/api/session/update',{method:'POST',body:JSON.stringify({session_id:S.session.session_id,workspace:S.session.workspace,model:selectedModel})});
  S.session.model=selectedModel;syncTopbar();
  if(typeof syncModelDrawer==='function') syncModelDrawer();
};
$('msg').addEventListener('input',()=>{
  autoResize();
  updateSendBtn();
  const text=$('msg').value;
  if(text.startsWith('/')&&text.indexOf('\n')===-1){
    const prefix=text.slice(1);
    const matches=getMatchingCommands(prefix);
    if(matches.length)showCmdDropdown(matches); else hideCmdDropdown();
  } else {
    hideCmdDropdown();
  }
});
let _msgComposing=false;
$('msg').addEventListener('compositionstart',()=>{ _msgComposing=true; });
$('msg').addEventListener('compositionend',()=>{ _msgComposing=false; });
$('msg').addEventListener('keydown',e=>{
  if(e.isComposing||_msgComposing)return;
  // Autocomplete navigation when dropdown is open
  const dd=$('cmdDropdown');
  const dropdownOpen=dd&&dd.classList.contains('open');
  if(dropdownOpen){
    if(e.key==='ArrowUp'){e.preventDefault();navigateCmdDropdown(-1);return;}
    if(e.key==='ArrowDown'){e.preventDefault();navigateCmdDropdown(1);return;}
    if(e.key==='Tab'){e.preventDefault();selectCmdDropdownItem();return;}
    if(e.key==='Escape'){e.preventDefault();hideCmdDropdown();return;}
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();selectCmdDropdownItem();return;}
  }
  // Send key: respect user preference
  if(e.key==='Enter'){
    if(window._sendKey==='ctrl+enter'){
      if(e.ctrlKey||e.metaKey){e.preventDefault();send();}
    } else {
      if(!e.shiftKey){e.preventDefault();send();}
    }
  }
});
// B14: Cmd/Ctrl+K creates a new chat from anywhere
document.addEventListener('keydown',async e=>{
  if((e.metaKey||e.ctrlKey)&&e.key==='k'){
    e.preventDefault();
    if(!S.busy){await newSession();await renderSessionList();$('msg').focus();}
  }
  if(e.key==='Escape'){
    // Close settings overlay if open
    const settingsOverlay=$('settingsOverlay');
    if(settingsOverlay&&settingsOverlay.style.display!=='none'){_closeSettingsPanel();return;}
    // Close workspace dropdown
    closeWsDropdown();
    // Clear session search
    const ss=$('sessionSearch');
    if(ss&&ss.value){ss.value='';filterSessions();}
    // Cancel any active message edit
    const editArea=document.querySelector('.msg-edit-area');
    if(editArea){
      const bar=editArea.closest('.msg-row')&&editArea.closest('.msg-row').querySelector('.msg-edit-bar');
      if(bar){const cancel=bar.querySelector('.msg-edit-cancel');if(cancel)cancel.click();}
    }
  }
});
$('msg').addEventListener('paste',e=>{
  const items=Array.from(e.clipboardData?.items||[]);
  const imageItems=items.filter(i=>i.type.startsWith('image/'));
  if(!imageItems.length)return;
  e.preventDefault();
  const files=imageItems.map(i=>{
    const blob=i.getAsFile();
    const ext=i.type.split('/')[1]||'png';
    return new File([blob],`screenshot-${Date.now()}.${ext}`,{type:i.type});
  });
  addFiles(files);
  setStatus(`Image pasted: ${files.map(f=>f.name).join(', ')}`);
});
document.querySelectorAll('.suggestion').forEach(btn=>{
  btn.onclick=()=>{$('msg').value=btn.dataset.msg;send();};
});

const QUICK_ACTION_TEMPLATES={
  'workspace-summary':'현재 작업공간을 빠르게 훑고, 중요한 파일/폴더와 지금 바로 할 수 있는 작업 5가지를 요약해줘.',
  'note-draft':'이 대화나 현재 작업을 바탕으로 바로 저장 가능한 Obsidian 노트 초안을 만들어줘. frontmatter와 읽기 좋은 구조를 포함해줘.',
  'blog-post':'이 주제를 바탕으로 블로그 포스트 또는 /posting 초안 방향을 잡아줘. 핵심 논지, 구조, 시각화 아이디어까지 제안해줘.',
  'schedule-task':'이 작업을 나중에 자동으로 반복하려면 어떤 cron job 이 좋은지 제안하고, 바로 만들 수 있게 초안을 작성해줘.'
};
document.querySelectorAll('.quick-action').forEach(btn=>{
  btn.onclick=()=>{
    const key=btn.dataset.template;
    const text=QUICK_ACTION_TEMPLATES[key]||'';
    if(!text)return;
    $('msg').value=text;
    autoResize();
    $('msg').focus();
    showToast('빠른 작업 템플릿을 입력창에 넣었습니다');
  };
});

function buildArtifactPrompt(kind){
  const title=(S.session&&S.session.title)||'현재 작업';
  const workspace=(S.session&&S.session.workspace)||'';
  const lead=`현재 세션 제목은 "${title}"이고 작업공간은 "${workspace}" 입니다. `;
  if(kind==='obsidian-note'){
    return lead + '지금까지의 대화와 작업 맥락을 바탕으로, 바로 저장 가능한 Obsidian 노트 초안을 만들어줘. frontmatter, 가독성 높은 구조, 필요하면 시각화 아이디어도 포함해줘.';
  }
  if(kind==='share-note'){
    return lead + '지금까지의 내용을 바탕으로 ShareNote 생성까지 염두에 둔 공개 가능한 노트 초안을 만들어줘. Obsidian 스타일, frontmatter, 요약, 핵심 포인트, 공유용 구조를 포함해줘.';
  }
  if(kind==='posting-brief'){
    return lead + '이 대화 내용을 /posting 으로 발전시키기 위한 브리프를 만들어줘. 주제, 핵심 메시지, 독자, 섹션 구조, 필요한 자료, 시각화 1~2개 아이디어를 정리해줘.';
  }
  if(kind==='schedule-followup'){
    return lead + '이 작업을 후속 자동화로 이어가려면 어떤 예약작업이 좋은지 제안하고, cron 자연어 요청 한 줄과 구체 프롬프트 초안을 함께 만들어줘.';
  }
  return '';
}
document.querySelectorAll('.artifact-action').forEach(btn=>{
  if(btn.dataset.workflow) return;
  btn.onclick=()=>{
    const kind=btn.dataset.artifact;
    const text=buildArtifactPrompt(kind);
    if(!text)return;
    $('msg').value=text;
    autoResize();
    $('msg').focus();
    showToast('아티팩트 작업 프롬프트를 입력창에 넣었습니다');
  };
});

function buildWorkflowPrompt(kind){
  const title=(S.session&&S.session.title)||'현재 작업';
  const workspace=(S.session&&S.session.workspace)||'';
  const lead=`현재 세션 제목은 "${title}"이고 작업공간은 "${workspace}" 입니다. `;
  if(kind==='generate-note'){
    return lead + '지금까지의 대화를 바탕으로 저장 가능한 정리 노트를 만들어줘. 가능하면 Obsidian 친화적으로 작성하고, 저장 전 핵심 구조를 먼저 제안해줘.';
  }
  if(kind==='generate-posting'){
    return lead + '이 대화를 /posting 가능한 브리프로 전환해줘. 핵심 주제, 메시지, 독자, 구조, 시각화 아이디어를 정리해줘.';
  }
  if(kind==='generate-decision-report'){
    return lead + '현재 대화와 작업 맥락을 바탕으로 Paperclip 반영 전용 Decision Report 초안을 작성해줘. 반드시 정본 `paperclip-ops-pack/templates/decision-report-template.md` 구조에 맞춰 1) 논의 주제 2) 배경 3) 검토 옵션 4) 추천안 5) 예상 반영 유형(comment / new issue / issue update) 6) 승인 상태(기본값: 미승인) 7) 승인 요청 문구를 정리해줘. 아직 Paperclip에는 반영하지 말고, hela 스타일로 summary → options → recommendation → next action 구조를 유지해줘.';
  }
  if(kind==='request-approval'){
    return lead + '현재 논의에 대해 사용자가 바로 복사해서 보낼 수 있는 Paperclip 실행승인 문구를 4가지 범위로 짧게 작성해줘. comment only / issue create / issue update / full execution 으로 승인 범위가 나뉘도록 해줘. 아직 반영은 하지 말고 승인 문구만 제안해줘.';
  }
  if(kind==='reflect-paperclip-comment'){
    return lead + '현재 세션에서 comment only 범위의 명시적 실행승인 문구가 실제로 존재하는지 먼저 확인하고, 확인된 경우에만 Decision Report Comment 반영안을 진행해줘. 순서는 반드시: 1) 승인 문구 재확인 2) 논의 요약 3) 최종 결정 4) comment 초안 또는 실제 comment 반영 5) comment id와 결과 보고. comment only 승인 문구가 세션에 없거나 모호하면 절대 반영하지 말고 보류 사유만 설명해줘.';
  }
  if(kind==='reflect-paperclip-issue'){
    return lead + '현재 세션에서 issue create 범위의 명시적 실행승인 문구가 실제로 존재하는지 먼저 확인하고, 확인된 경우에만 신규 Executable Issue 생성안만 진행해줘. 순서는 반드시: 1) 승인 문구 재확인 2) 논의 요약 3) 최종 결정 4) 생성할 issue 구조 정리 5) 필요한 경우에만 신규 issue 실제 생성 6) identifier와 결과 보고. issue create 승인 문구가 세션에 없거나 모호하면 절대 반영하지 말고 보류 사유만 설명해줘.';
  }
  if(kind==='reflect-paperclip-full'){
    return lead + '현재 세션에서 full execution 범위의 명시적 실행승인 문구가 실제로 존재하는지 먼저 확인하고, 확인된 경우에만 그 승인 범위 안에서 Paperclip 반영 실행안을 진행해줘. 순서는 반드시: 1) 승인 문구 재확인 2) 논의 요약 3) 최종 결정 4) 실행 항목 5) 필요한 경우에만 decision comment / new issue / issue update 실제 실행 6) 생성/수정된 identifier와 결과 보고. full execution 승인 문구가 세션에 없거나 모호하면 절대 반영하지 말고 보류 사유만 설명해줘.';
  }
  if(kind==='extract-memory-candidates'){
    return lead + '현재 대화에서 장기적으로 유지할 가치가 있는 후보만 JSON 배열로 추출해줘. 필드는 category(decision/preference/pattern/knowledge/constraint), scope(global/company/project/telegram_group/workspace/profile), scope_ref, statement, source_session_id, source_message_ids, confidence(0~1), sensitivity(public/internal/confidential), recommended_action(approve/edit/reject/paperclip_draft_only), reason 을 포함해줘. 절대 memory tool, Paperclip, Telegram 전송을 실행하지 말고 JSON만 제공해줘. 아직 Paperclip에는 반영하지 않았습니다. 실행 승인 시에만 반영합니다.';
  }
  if(kind==='save-memory'){
    return lead + '현재 대화에서 장기적으로 유용한 항목을 바로 memory에 저장하지 말고, Memory Candidate Inbox에 넣을 후보 JSON 배열로만 정리해줘. 승인 전에는 memory tool, Paperclip, Telegram을 실행하지 마. 아직 Paperclip에는 반영하지 않았습니다. 실행 승인 시에만 반영합니다.';
  }
  if(kind==='telegram-handoff'){
    return lead + '현재 작업을 텔레그램 구찌에서도 바로 이어갈 수 있도록 handoff summary 를 만들어줘. 핵심 맥락, 다음 액션, 기억해둘 사항을 간단히 정리하고 memory 저장이 필요하면 함께 반영해줘.';
  }
  return '';
}

function detectPaperclipApprovalScope(){
  const msgs=(S&&S.messages)||[];
  const patterns={
    full:[/full execution/, /전체 반영/, /전부 반영/, /이 안으로 반영해/, /승인, 이 안으로 반영해/],
    issue:[/issue create/, /이슈 생성 승인/, /이슈 만들어/, /issue 생성/],
    comment:[/comment only/, /코멘트만/, /comment 승인/, /comment only 승인/],
    generic:[/(^|\s)승인(,|\s|$)/, /반영해/, /실행해/],
  };
  let scope='none';
  for(const m of msgs){
    if(!m || m.role!=='user') continue;
    const text=String(m.content||'').trim();
    if(!text) continue;
    if([/좋아/,/괜찮네/,/그 방향으로 보자/,/맞는 듯/,/오케이/].some(rx=>rx.test(text))) continue;
    if(patterns.full.some(rx=>rx.test(text))) scope='full';
    else if(patterns.issue.some(rx=>rx.test(text)) && scope!=='full') scope='issue';
    else if(patterns.comment.some(rx=>rx.test(text)) && !['full','issue'].includes(scope)) scope='comment';
    else if(patterns.generic.some(rx=>rx.test(text)) && scope==='none') scope='full';
  }
  return scope;
}

function hasExplicitPaperclipApproval(){
  return detectPaperclipApprovalScope()!=='none';
}

function updatePaperclipApprovalUI(){
  const scopedButtons=(kind)=>Array.from(document.querySelectorAll(`.artifact-action[data-workflow="${kind}"]`));
  const btnComments=scopedButtons('reflect-paperclip-comment');
  const btnIssues=scopedButtons('reflect-paperclip-issue');
  const btnFulls=scopedButtons('reflect-paperclip-full');
  const hints=[$('paperclipApprovalHint'), $('paperclipApprovalHintMain')].filter(Boolean);
  if(!btnComments.length && !btnIssues.length && !btnFulls.length && !hints.length) return;
  const scope=detectPaperclipApprovalScope();
  const enableComment=['comment','issue','full'].includes(scope);
  const enableIssue=['issue','full'].includes(scope);
  const enableFull=scope==='full';
  const setBtn=(btn, enabled, title)=>{
    btn.disabled=!enabled;
    btn.title=title;
    btn.style.opacity=enabled ? '1' : '0.55';
    btn.style.cursor=enabled ? 'pointer' : 'not-allowed';
  };
  btnComments.forEach(btn=>setBtn(btn, enableComment, enableComment ? `승인 범위 감지됨 (${scope}) — comment 반영 가능` : 'comment only 승인 후에만 활성화됩니다'));
  btnIssues.forEach(btn=>setBtn(btn, enableIssue, enableIssue ? `승인 범위 감지됨 (${scope}) — issue 생성 가능` : 'issue create 승인 후에만 활성화됩니다'));
  btnFulls.forEach(btn=>setBtn(btn, enableFull, enableFull ? 'full execution 승인 감지됨 — 전체 반영 가능' : 'full execution 승인 후에만 활성화됩니다'));
  if(hints.length){
    const map={
      none:'아직 명시적 실행승인이 없습니다. 승인 전에는 Decision Report 초안까지만 진행합니다.',
      comment:'comment only 승인이 감지되었습니다. Comment 반영만 활성화됩니다.',
      issue:'issue create 승인이 감지되었습니다. Comment 반영과 Issue 생성이 활성화됩니다.',
      full:'full execution 승인이 감지되었습니다. 모든 Paperclip 반영 버튼을 사용할 수 있습니다.',
    };
    hints.forEach(hint=>{ hint.textContent=map[scope]||map.none; });
  }
}

function _paperclipWorkflowStoreKey(){
  const sid=S.session&&S.session.session_id;
  return sid?`hermes-webui-paperclip-history:${sid}`:'hermes-webui-paperclip-history:global';
}
function _loadPaperclipWorkflowHistory(){
  try{return JSON.parse(localStorage.getItem(_paperclipWorkflowStoreKey())||'[]');}catch(e){return [];}
}
function _savePaperclipWorkflowHistory(items){
  localStorage.setItem(_paperclipWorkflowStoreKey(), JSON.stringify(items.slice(0,12)));
}
function renderPaperclipWorkflowHistory(){
  const wraps=[$('paperclipWorkflowHistory'), $('paperclipWorkflowHistoryPanel'), $('paperclipWorkflowHistoryMain')].filter(Boolean);
  if(!wraps.length) return;
  const items=_loadPaperclipWorkflowHistory();
  if(!items.length){
    wraps.forEach(w=>w.innerHTML='<div class="artifact-empty">아직 Paperclip workflow 기록이 없습니다.</div>');
    return;
  }
  const html=items.map(item=>{
    const scope=item.scope||'paperclip';
    const status=item.status||'running';
    return `<div class="artifact-item"><div class="artifact-item-main"><div class="artifact-item-title"><span class="paperclip-badge paperclip-scope-${esc(scope)}">${esc(scope)}</span> <span class="paperclip-badge paperclip-status-${esc(status)}">${esc(status)}</span></div><div class="artifact-item-meta">${esc(item.identifier||'identifier pending')} · ${esc(item.updated_at||item.created_at||'')}</div></div><div class="artifact-item-actions">${item.artifact_path?`<button class="artifact-mini-btn" onclick="openArtifactPath('${esc(item.artifact_path)}')">열기</button>`:''}</div></div>`;
  }).join('');
  wraps.forEach(w=>w.innerHTML=html);
}
function renderPaperclipConsoleSummary(){
  const hints=[$('paperclipConsoleHint'), $('paperclipConsoleHintMain')].filter(Boolean);
  if(!hints.length) return;
  const scope=typeof detectPaperclipApprovalScope==='function' ? detectPaperclipApprovalScope() : 'none';
  const hist=_loadPaperclipWorkflowHistory();
  const latest=hist[0]||null;
  const latestText=latest ? `${latest.scope||'paperclip'} / ${latest.status||'running'} / ${latest.identifier||'identifier pending'}` : '최근 반영 이력 없음';
  const scopeMap={
    none:'승인 없음',
    comment:'comment only 승인',
    issue:'issue create 승인',
    full:'full execution 승인',
  };
  hints.forEach(hint=>{ hint.textContent=`현재 승인 상태: ${scopeMap[scope]||scope} · 최근 실행: ${latestText}`; });
  const btnTg=$('btnConsoleTelegram');
  const btnMem=$('btnConsoleMemory');
  const latestArtifact=latest&&latest.artifact_path ? latest.artifact_path : null;
  if(btnTg){
    btnTg.disabled=!latestArtifact;
    btnTg.style.opacity=latestArtifact?'1':'0.55';
    btnTg.style.cursor=latestArtifact?'pointer':'not-allowed';
    btnTg.title=latestArtifact?`최근 결과 Artifact를 Telegram handoff로 전달`:'최근 Artifact가 있어야 사용 가능합니다';
  }
  if(btnMem){
    btnMem.disabled=!latestArtifact;
    btnMem.style.opacity=latestArtifact?'1':'0.55';
    btnMem.style.cursor=latestArtifact?'pointer':'not-allowed';
    btnMem.title=latestArtifact?`최근 결과 Artifact를 memory 흐름으로 전달`:'최근 Artifact가 있어야 사용 가능합니다';
  }
}

function runPaperclipConsoleAction(action){
  const hist=_loadPaperclipWorkflowHistory();
  const latest=hist[0]||null;
  if(!latest || !latest.artifact_path){
    showToast('최근 Paperclip 결과 Artifact가 없습니다');
    return;
  }
  if(action==='telegram') return runArtifactWorkflow(latest.artifact_path,'telegram');
  if(action==='memory') return runArtifactWorkflow(latest.artifact_path,'memory');
}
function recordPaperclipWorkflowRun(scope, artifactPath){
  const items=_loadPaperclipWorkflowHistory();
  items.unshift({scope,status:'running',artifact_path:artifactPath||'',created_at:new Date().toISOString()});
  _savePaperclipWorkflowHistory(items);
  renderPaperclipWorkflowHistory();
  renderPaperclipConsoleSummary();
}
function finalizePaperclipWorkflowRun(scope, info){
  const items=_loadPaperclipWorkflowHistory();
  const idx=items.findIndex(x=>x.scope===scope && x.status==='running');
  if(idx<0) return;
  items[idx]={...items[idx], ...info, status:'done', updated_at:new Date().toISOString()};
  _savePaperclipWorkflowHistory(items);
  renderPaperclipWorkflowHistory();
  renderPaperclipConsoleSummary();
}

async function createPaperclipResultArtifact(kind){
  if(!S.session) return null;
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const names={
    'reflect-paperclip-comment':`paperclip-comment-result-${stamp}.md`,
    'reflect-paperclip-issue':`paperclip-issue-result-${stamp}.md`,
    'reflect-paperclip-full':`paperclip-full-result-${stamp}.md`,
  };
  const labels={
    'reflect-paperclip-comment':'Comment Only',
    'reflect-paperclip-issue':'Issue Create',
    'reflect-paperclip-full':'Full Execution',
  };
  const name=names[kind];
  if(!name) return null;
  const relPath=S.currentDir==='.'?name:(S.currentDir+'/'+name);
  const content=`# Paperclip ${labels[kind]||'Execution'} Result\n\n- created_at: ${new Date().toISOString()}\n- session_id: ${(S.session&&S.session.session_id)||''}\n- approval_scope: ${labels[kind]||kind}\n\n## Summary\n\n## Decision\n\n## Execution items\n\n## Result\n- identifiers:\n- comments:\n- status:\n`;
  try{
    await api('/api/file/create',{method:'POST',body:JSON.stringify({session_id:S.session.session_id,path:relPath,content})});
    registerArtifact({name,path:relPath,type:'paperclip-result'});
    await loadDir(S.currentDir);
    if(typeof openFile==='function') openFile(relPath);
    return relPath;
  }catch(e){
    console.warn('paperclip artifact create failed', e);
    return null;
  }
}

document.querySelectorAll('.artifact-action[data-workflow]').forEach(btn=>{
  btn.onclick=async()=>{
    const kind=btn.dataset.workflow;
    const gatedKinds=['reflect-paperclip-comment','reflect-paperclip-issue','reflect-paperclip-full'];
    if(gatedKinds.includes(kind)){
      const scope=detectPaperclipApprovalScope();
      const allowed = (
        (kind==='reflect-paperclip-comment' && ['comment','issue','full'].includes(scope)) ||
        (kind==='reflect-paperclip-issue' && ['issue','full'].includes(scope)) ||
        (kind==='reflect-paperclip-full' && scope==='full')
      );
      if(!allowed){
        updatePaperclipApprovalUI();
        showToast('현재 승인 범위로는 이 Paperclip 반영 버튼을 사용할 수 없습니다');
        return;
      }
    }
    const artifactPath=gatedKinds.includes(kind) ? await createPaperclipResultArtifact(kind) : null;
    let text=buildWorkflowPrompt(kind);
    if(artifactPath){
      const scopeLabelMap={
        'reflect-paperclip-comment':'comment',
        'reflect-paperclip-issue':'issue',
        'reflect-paperclip-full':'full',
      };
      recordPaperclipWorkflowRun(scopeLabelMap[kind]||kind, artifactPath);
      text += ` 반영 결과는 워크스페이스의 ${artifactPath} 파일에도 정리해줘. 최소한 summary, approval scope, generated/updated identifiers, final status 를 파일에 남겨줘.`;
    }
    if(!text)return;
    if(S.busy){showToast('현재 작업이 끝난 뒤 다시 시도해 주세요');return;}
    $('msg').value=text;
    autoResize();
    $('msg').focus();
    if(document.body.classList.contains('paperclip-main-mode') && typeof switchMainView==='function') switchMainView('chat');
    showToast(gatedKinds.includes(kind) ? 'Paperclip 반영 결과용 아티팩트를 만들고 워크플로우를 실행합니다' : '워크플로우 작업을 바로 실행합니다');
    await send();
    setTimeout(updatePaperclipApprovalUI, 100);
  };
});
setInterval(updatePaperclipApprovalUI, 1200);
setTimeout(updatePaperclipApprovalUI, 50);
setTimeout(renderPaperclipWorkflowHistory, 50);
setTimeout(renderPaperclipConsoleSummary, 50);
setTimeout(()=>{
  const tg=$('btnConsoleTelegram');
  const mem=$('btnConsoleMemory');
  if(tg) tg.onclick=()=>runPaperclipConsoleAction('telegram');
  if(mem) mem.onclick=()=>runPaperclipConsoleAction('memory');
}, 50);

function _artifactStoreKey(){
  const sid=S.session&&S.session.session_id;
  return sid?`hermes-webui-artifacts:${sid}`:'hermes-webui-artifacts:global';
}
function _loadArtifacts(){
  try{return JSON.parse(localStorage.getItem(_artifactStoreKey())||'[]');}catch(e){return [];}
}
function _saveArtifacts(items){
  localStorage.setItem(_artifactStoreKey(), JSON.stringify(items.slice(0,20)));
}
let _recentArtifactPath='';
function registerArtifact(item){
  const items=_loadArtifacts().filter(x=>x.path!==item.path);
  items.unshift({...item,created_at:new Date().toISOString()});
  _saveArtifacts(items);
  _recentArtifactPath=item.path;
  renderArtifactList();
}
function renameArtifactRecord(oldPath,newPath,newName){
  const items=_loadArtifacts().map(x=>x.path===oldPath?{...x,path:newPath,name:newName||newPath.split('/').pop()}:x);
  _saveArtifacts(items);
  if(_recentArtifactPath===oldPath) _recentArtifactPath=newPath;
  renderArtifactList();
}
function removeArtifactRecord(path){
  const items=_loadArtifacts().filter(x=>x.path!==path);
  _saveArtifacts(items);
  renderArtifactList();
}
function _paperclipResultPrefixFromPath(path){
  const file=(path||'').split('/').pop()||'';
  if(file.startsWith('paperclip-comment-result-')) return 'comment';
  if(file.startsWith('paperclip-issue-result-')) return 'issue';
  if(file.startsWith('paperclip-full-result-')) return 'full';
  return null;
}
async function maybeRenameRecentPaperclipArtifactFromMessages(){
  if(!S.session || !_recentArtifactPath) return null;
  const scope=_paperclipResultPrefixFromPath(_recentArtifactPath);
  if(!scope) return null;
  const lastAssistant=[...(S.messages||[])].reverse().find(m=>m&&m.role==='assistant'&&typeof m.content==='string'&&m.content.trim());
  const text=lastAssistant&&lastAssistant.content||'';
  const match=text.match(/\b([A-Z]{2,10}-\d+)\b/);
  if(!match) return null;
  const identifier=match[1];
  const parts=_recentArtifactPath.split('/');
  const oldName=parts.pop()||'';
  const dir=parts.length?parts.join('/')+'/':'';
  const newName=`paperclip-${identifier}-${scope}-result.md`;
  if(oldName===newName){
    finalizePaperclipWorkflowRun(scope,{identifier,artifact_path:_recentArtifactPath});
    return {identifier,path:_recentArtifactPath,renamed:false};
  }
  const newPath=dir+newName;
  try{
    await api('/api/file/rename',{method:'POST',body:JSON.stringify({session_id:S.session.session_id,path:_recentArtifactPath,new_name:newName})});
    renameArtifactRecord(_recentArtifactPath,newPath,newName);
    await loadDir(S.currentDir);
    if(typeof openFile==='function') openFile(newPath);
    finalizePaperclipWorkflowRun(scope,{identifier,artifact_path:newPath});
    return {identifier,path:newPath,renamed:true};
  }catch(e){
    console.warn('paperclip artifact rename failed', e);
    finalizePaperclipWorkflowRun(scope,{identifier,artifact_path:_recentArtifactPath,error:String(e&&e.message||e)});
    return {identifier,path:_recentArtifactPath,renamed:false,error:String(e&&e.message||e)};
  }
}
function buildArtifactActionPrompt(path, action){
  if(action==='share') return `워크스페이스의 ${path} 파일을 기준으로 ShareNote 공유용으로 다듬어줘. 공유 전 체크포인트와 ShareNote 링크 생성 흐름도 함께 안내해줘.`;
  if(action==='telegram') return `워크스페이스의 ${path} 파일을 기준으로 텔레그램 handoff summary 를 만들어줘. 텔레그램 구찌에서 바로 이어갈 수 있게 핵심 맥락과 다음 액션을 정리해줘.`;
  if(action==='memory') return `워크스페이스의 ${path} 파일과 현재 대화를 참고해서 장기적으로 기억할 만한 선호/환경/workflow 규칙이 있으면 memory 또는 user profile 에 저장해줘.`;
  return '';
}
async function runArtifactWorkflow(path, action){
  if(!path)return;
  const text=buildArtifactActionPrompt(path, action);
  if(!text)return;
  if(S.busy){showToast('현재 작업이 끝난 뒤 다시 시도해 주세요');return;}
  $('msg').value=text;
  autoResize();
  $('msg').focus();
  showToast('아티팩트 워크플로우를 실행합니다');
  await send();
}
function renderArtifactList(){
  const wraps=[$('artifactList'), $('artifactListSidebar'), $('paperclipArtifactListPanel'), $('paperclipArtifactListMain')].filter(Boolean);
  if(!wraps.length)return;
  const items=_loadArtifacts();
  if(!items.length){
    wraps.forEach(w=>w.innerHTML='<div class="artifact-empty">아직 아티팩트가 없습니다. 아티팩트 추가 또는 AI로 만들기 버튼을 눌러 시작해보세요.</div>');
    return;
  }
  const html=items.map(item=>`<div class="artifact-item ${item.path===_recentArtifactPath?'just-created':''}"><div class="artifact-item-main"><div class="artifact-item-title">${esc(item.name||item.path)}</div><div class="artifact-item-meta">${esc(item.type||'artifact')} · ${esc(item.path||'')}</div></div><div class="artifact-item-actions"><button class="artifact-mini-btn" onclick="openArtifactPath('${esc(item.path)}')">열기</button><button class="artifact-mini-btn" onclick="runArtifactWorkflow('${esc(item.path)}','share')">Share</button><button class="artifact-mini-btn" onclick="runArtifactWorkflow('${esc(item.path)}','telegram')">Telegram</button><button class="artifact-mini-btn" onclick="runArtifactWorkflow('${esc(item.path)}','memory')">Memory</button><button class="artifact-mini-btn" onclick="deleteArtifactPath('${esc(item.path)}','${esc(item.name||item.path)}')">삭제</button></div></div>`).join('');
  wraps.forEach(w=>w.innerHTML=html);
}
async function openArtifactPath(path){
  if(!path||!S.session)return;
  await loadDir('.');
  openFile(path);
}
async function deleteArtifactPath(path,name){
  if(!path||!S.session)return;
  await deleteWorkspaceFile(path,name||path);
  removeArtifactRecord(path);
}
function promptAiArtifact(){
  const text='현재 대화를 바탕으로 바로 작업할 수 있는 아티팩트 초안을 하나 만들어줘. 적절한 아티팩트 유형(note, posting brief, memo, research brief)을 추천하고, 파일명 제안과 함께 저장 가능한 초안을 작성해줘.';
  $('msg').value=text; autoResize(); $('msg').focus(); showToast('AI 아티팩트 생성 프롬프트를 입력창에 넣었습니다');
}
function openArtifactModal(){
  const overlay=$('artifactModalOverlay');
  if(!overlay)return;
  $('artifactModalError').style.display='none';
  $('artifactType').value='note';
  if($('artifactCustomTypeWrap')) $('artifactCustomTypeWrap').style.display='none';
  if($('artifactCustomType')) $('artifactCustomType').value='';
  $('artifactName').value='';
  $('artifactSeed').value='';
  $('artifactUseAi').checked=false;
  overlay.style.display='flex';
  $('artifactName').focus();
}
function closeArtifactModal(){
  const overlay=$('artifactModalOverlay');
  if(overlay) overlay.style.display='none';
}
async function submitArtifactModal(){
  const selectedType=($('artifactType').value||'note').trim();
  const customType=(($('artifactCustomType')||{}).value||'').trim();
  const type=selectedType==='custom' ? (customType||'custom') : selectedType;
  const name=($('artifactName').value||'').trim();
  const seed=($('artifactSeed').value||'').trim();
  const useAi=$('artifactUseAi').checked;
  const err=$('artifactModalError');
  err.style.display='none';
  if(selectedType==='custom' && !customType){err.textContent='사용자 정의 유형을 입력해 주세요';err.style.display='';return;}
  if(!name){err.textContent='파일 이름이 필요합니다';err.style.display='';return;}
  const cleanName=name.endsWith('.md')?name:name+'.md';
  const relPath=S.currentDir==='.'?cleanName:(S.currentDir+'/'+cleanName);
  const templateMap={
    note:'---\ntitle: '+cleanName.replace(/\.md$/,'')+'\ncreated: '+new Date().toISOString().slice(0,10)+'\n---\n\n# '+cleanName.replace(/\.md$/,'')+'\n\n'+(seed?seed+'\n\n':'')+'- 요약\n- 핵심 포인트\n',
    posting:'# Posting Brief\n\n'+(seed?seed+'\n\n':'')+'## Topic\n\n## Audience\n\n## Key message\n',
    brief:'# Brief\n\n'+(seed?seed+'\n\n':'')+'## Goal\n\n## Inputs\n\n## Next steps\n',
    memo:'# Memo\n\n'+(seed?seed+'\n\n':'')+'- Idea\n- Context\n- Follow-up\n',
    research:'# Research Brief\n\n'+(seed?seed+'\n\n':'')+'## Question\n\n## Hypothesis\n\n## Sources\n',
    custom:'# Custom Artifact\n\n'+(seed?seed+'\n\n':'')+'## Purpose\n\n## Notes\n\n## Next Steps\n'
  };
  try{
    await api('/api/file/create',{method:'POST',body:JSON.stringify({session_id:S.session.session_id,path:relPath,content:templateMap[type]||templateMap.note})});
    registerArtifact({name:cleanName,path:relPath,type});
    closeArtifactModal();
    showToast('아티팩트를 만들었습니다');
    await loadDir(S.currentDir);
    openFile(relPath);
    if(useAi){
      $('msg').value=`방금 생성한 ${cleanName} 파일을 바탕으로 ${type} 아티팩트를 더 완성해줘. 사용자 메모: ${seed||'없음'}`;
      autoResize();
      $('msg').focus();
    }
  }catch(e){err.textContent='생성 실패: '+e.message;err.style.display='';}
}
function updateArtifactTypeUi(){
  const wrap=$('artifactCustomTypeWrap');
  const type=($('artifactType').value||'note').trim();
  if(wrap) wrap.style.display = type==='custom' ? '' : 'none';
}
function suggestArtifactWithAi(){
  const seed=(($('artifactSeed')||{}).value||'').trim();
  const text=`현재 대화를 바탕으로 어떤 아티팩트를 만들면 좋을지 추천해줘. note, posting brief, memo, research brief, custom artifact 중 하나를 고르고, 이유와 파일명 제안 3개, 초안 구조를 간단히 제시해줘. 사용자 메모: ${seed||'없음'}`;
  $('msg').value=text;
  autoResize();
  $('msg').focus();
  showToast('AI 추천 프롬프트를 입력창에 넣었습니다');
}
if($('btnAddArtifact')) $('btnAddArtifact').onclick=openArtifactModal;
if($('btnAddArtifactSidebar')) $('btnAddArtifactSidebar').onclick=openArtifactModal;
if($('btnAiArtifact')) $('btnAiArtifact').onclick=promptAiArtifact;
if($('btnAiArtifactSidebar')) $('btnAiArtifactSidebar').onclick=promptAiArtifact;
if($('btnArtifactCancel')) $('btnArtifactCancel').onclick=closeArtifactModal;
if($('btnCloseArtifactModal')) $('btnCloseArtifactModal').onclick=closeArtifactModal;
if($('btnArtifactCreate')) $('btnArtifactCreate').onclick=submitArtifactModal;
if($('artifactType')) $('artifactType').onchange=updateArtifactTypeUi;
if($('btnArtifactSuggest')) $('btnArtifactSuggest').onclick=suggestArtifactWithAi;
renderArtifactList();

function _setupPackStoreKey(){
  return 'hermes-webui-setup-pack-history';
}
function _loadSetupPackHistory(){
  try{return JSON.parse(localStorage.getItem(_setupPackStoreKey())||'[]');}catch(e){return [];}
}
function _saveSetupPackHistory(items){
  localStorage.setItem(_setupPackStoreKey(), JSON.stringify(items.slice(0,12)));
}
function recordSetupPackRun(pack){
  const items=_loadSetupPackHistory().filter(x=>x.pack!==pack);
  items.unshift({pack, ran_at:new Date().toISOString(), status:'running'});
  _saveSetupPackHistory(items);
  renderSetupPackHistory();
}
function updateSetupPackStatus(pack, status){
  const items=_loadSetupPackHistory();
  const idx=items.findIndex(x=>x.pack===pack);
  if(idx>=0){
    items[idx].status=status;
    items[idx].updated_at=new Date().toISOString();
    _saveSetupPackHistory(items);
    renderSetupPackHistory();
  }
}
function renderSetupPackHistory(){
  const wraps=[$('setupPackHistory'), $('setupPackHistorySidebar')].filter(Boolean);
  if(!wraps.length)return;
  const items=_loadSetupPackHistory();
  if(!items.length){
    wraps.forEach(w=>w.innerHTML='<div class="artifact-empty">아직 실행한 setup pack 이 없습니다.</div>');
    return;
  }
  const html=items.map(item=>`<div class="artifact-item"><div class="artifact-item-main"><div class="artifact-item-title">${esc(item.pack)}</div><div class="artifact-item-meta">${esc(item.status)} · ${esc(item.updated_at||item.ran_at)}</div></div><div class="artifact-item-actions"><button class="artifact-mini-btn" onclick="rerunSetupPack('${esc(item.pack)}')">재실행</button><button class="artifact-mini-btn" onclick="updateSetupPackStatus('${esc(item.pack)}','done')">완료</button><button class="artifact-mini-btn" onclick="updateSetupPackStatus('${esc(item.pack)}','needs-approval')">승인필요</button></div></div>`).join('');
  wraps.forEach(w=>w.innerHTML=html);
}

const SETUP_PACK_TEMPLATES={
  'obsidian-starter':'내 환경에서 Obsidian Starter Pack 을 설치해줘. Obsidian vault 확인, note 작성에 필요한 기본 도구/스킬 점검, Obsidian 친화 markdown workflow 확인까지 진행해줘. 무엇을 설치/설정했는지 마지막에 요약해줘.',
  'sharenote-telegram':'ShareNote + Telegram Publishing Pack 을 설치해줘. Obsidian ShareNote 플러그인/Advanced URI/공유 링크 생성 도우미/텔레그램 전달 흐름을 점검하고 설정해줘. 환경별 승인 필요한 단계가 있으면 설명하고 진행해줘.',
  'obsidian-power':'Obsidian Power Workflow Pack 을 설치해줘. Obsidian note 작성, posting, ShareNote 생성, Telegram handoff 까지 이어지는 범용 워크플로우를 점검/설정하고 최종 사용법을 정리해줘.',
  'memory-sync':'Memory Sync Pack 을 점검해줘. WebUI, CLI, Telegram 간에 이어서 작업하기 좋은 memory/workflow 규칙을 확인하고, 필요한 공유 기억/핸드오프 사용법을 정리해줘.',
  'telegram-onboarding':'Hermes Telegram onboarding pack 을 실행해줘. 텔레그램에서 Hermes 봇을 아직 써보지 않은 사용자도 쉽게 시작할 수 있도록 필요한 설정, 계정 연결, 기본 사용 흐름, 점검 항목을 단계별로 정리하고 가능한 부분은 직접 세팅해줘. 마지막에는 초보자용 사용 가이드를 짧게 써줘.',
  'hermes-full-install':'Hermes 를 처음 쓰는 사용자를 위한 Full Hermes Install pack 을 실행해줘. https://github.com/NousResearch/hermes-agent 와 https://github.com/reallygood83/hermes-for-web 를 기준으로, Hermes Agent 설치부터 필요한 의존성, 기본 설정, Telegram 연결 가능 여부 점검, WebUI 실행 준비까지 한 번에 진행해줘. 이미 설치된 항목은 재사용하고, 초보자도 이해할 수 있게 단계와 결과를 요약해줘.',
  'webui-only-install':'이미 Hermes Agent 를 쓰는 사용자를 위한 WebUI-only Install pack 을 실행해줘. https://github.com/reallygood83/hermes-for-web 를 설치 또는 업데이트하고, localhost:8788 기준 실행 준비, Cherry Blossom 기본 테마, Assistant Name, Setup Packs, Artifact/Workspace 흐름까지 점검해줘.',
  'last30days':'last30days research pack 을 설치/점검해줘. 사용자가 최근 30일간 X/Reddit 기반 반응 조사를 쉽게 시작할 수 있도록 last30days 사용법, 소스 선택법(x/reddit/both), 대표 예시, 필수 전제 조건을 정리하고 가능한 환경 점검을 진행해줘.',
  'autoresearch':'AutoResearch pack 을 설치/점검해줘. 사용자가 조사 질문을 넣으면 리서치 흐름을 반복 실행하거나 심화 탐색할 수 있도록 기본 구조, 추천 워크플로우, 필요한 도구/전제 조건, 결과 정리 방식을 설명하고 가능한 환경 점검을 진행해줘.',
  'paperclip-ops':'Paperclip Ops Pack 을 설치/점검해줘. Telegram ↔ Hermes ↔ Paperclip 실운영 흐름에서 Decision Report 템플릿 자동화, 승인 문구 판정 규칙, 반영 전 체크리스트, 반영 후 기록 형식을 정리하고 가능한 문서/템플릿/가이드를 실제 파일로 생성·업데이트해줘. 정본은 `paperclip-ops-pack/` 아래에 정리하고, 반영 전에 반드시 실행승인 받는 구조를 hard gate 로 유지해줘.'
};
const SETUP_PACK_DESCRIPTIONS={
  'obsidian-starter':'Obsidian 중심 note workflow 를 시작하는 기본 세팅 팩',
  'sharenote-telegram':'공유 링크 생성과 Telegram 전달 흐름을 붙이는 발행 팩',
  'obsidian-power':'노트, posting, ShareNote, handoff 까지 묶는 고급 Obsidian 팩',
  'memory-sync':'WebUI/CLI/Telegram 사이 기억과 handoff 감각을 맞추는 팩',
  'telegram-onboarding':'Hermes Telegram 을 처음 쓰는 사람을 위한 입문 팩',
  'hermes-full-install':'Hermes Agent 설치부터 Telegram/WebUI 준비까지 한 번에 시작하는 풀 설치 팩',
  'webui-only-install':'이미 Hermes 사용자라면 WebUI 만 빠르게 붙이는 설치 팩',
  'last30days':'최근 30일간 X/Reddit 반응 조사를 빠르게 시작하는 연구 팩',
  'autoresearch':'질문을 반복 조사/심화 탐색 workflow 로 키우는 리서치 팩',
  'paperclip-ops':'Decision Report 정본 템플릿, 승인 판정 규칙, reflection 체크리스트를 묶고 실행승인 전 반영 금지를 hard gate 로 고정하는 운영 팩'
};
const SETUP_PACK_DETAILS={
  'obsidian-starter':{title:'Obsidian Starter',who:'Obsidian 중심으로 Hermes 를 시작하려는 사용자',outcome:['노트 workflow 점검','Obsidian 친화 markdown 흐름 정리','기본 note 작성 스타트']},
  'sharenote-telegram':{title:'Share+Telegram',who:'노트를 링크로 공유하고 Telegram 으로 이어가고 싶은 사용자',outcome:['공유 링크 생성 흐름 점검','Telegram handoff 흐름 정리','발행/공유 workflow 시작']},
  'obsidian-power':{title:'Obsidian Power',who:'노트, posting, 공유까지 하나의 흐름으로 쓰는 파워 유저',outcome:['노트→posting→ShareNote 흐름 정리','콘텐츠 운영형 workflow 점검','고급 사용 예시 확보']},
  'memory-sync':{title:'Memory Sync',who:'CLI / WebUI / Telegram 사이 기억 이어짐이 중요한 사용자',outcome:['handoff 감각 정리','공유 기억 규칙 점검','표면 간 연속성 강화']},
  'telegram-onboarding':{title:'Telegram Onboarding',who:'Hermes Telegram 을 아직 안 써본 초보 사용자',outcome:['첫 사용 흐름 이해','필요 설정 점검','첫 메시지 가이드 확보']},
  'hermes-full-install':{title:'Full Hermes Install',who:'Hermes 를 처음 설치하는 완전 초보 사용자',outcome:['Hermes Agent 설치 흐름 시작','Telegram / WebUI 연결 준비','초보자용 설치 요약 확보']},
  'webui-only-install':{title:'WebUI-only Install',who:'이미 Hermes Agent 를 쓰고 있고 WebUI 만 붙이고 싶은 사용자',outcome:['WebUI 설치/업데이트','localhost:8788 실행 준비','테마/팩/아티팩트 기본 점검']},
  'last30days':{title:'last30days',who:'최근 30일간 X/Reddit 반응 조사를 빠르게 하고 싶은 사용자',outcome:['소스 선택법 정리: x=빠른 public 반응, reddit=커뮤니티 심층 토론, both=비교 기본값','대표 프롬프트 확보: 주제·소스·기간·목표·출력 형식만 넣으면 시작','필수 전제 조건 점검: X/Reddit 접근 경로, 웹 검색 fallback, 날짜 범위, source limitation 공개','결과 형식 확보: executive brief, source table, sentiment/reaction map, next actions']},
  'autoresearch':{title:'AutoResearch',who:'질문 하나를 반복 조사/심화 탐색 흐름으로 키우고 싶은 사용자',outcome:['기본 구조 확보: intake → question refinement → broad scan → synthesis → deepening → final output','반복 루프 선택: stop/deepen/broaden/verify/convert/approval wait','도구/전제 조건 점검: web/search/browser, arxiv, blogwatcher, youtube, last30days, workspace 저장','결과 정리 방식 확보: source table, facts/interpretations/hypotheses/unknowns, deepening angles, next actions']},
  'paperclip-ops':{title:'Paperclip Ops',who:'Telegram 논의와 Paperclip 반영 사이 승인/기록 규칙을 고정하고 싶은 운영자',outcome:['paperclip-ops-pack 정본 문서 세트 확보','Decision Report / comment / issue / update 템플릿 분리','승인 문구 판정 규칙과 pre/post reflection 체크리스트 고정','실행승인 전 반영 금지 hard gate 유지']}
};
document.querySelectorAll('.setup-pack').forEach(btn=>{
  btn.dataset.desc = SETUP_PACK_DESCRIPTIONS[btn.dataset.pack] || '이 setup pack 이 하는 일을 설명합니다.';
  btn.onmouseenter=()=>renderSetupPackDetail(btn.dataset.pack);
  btn.onclick=async()=>{
    renderSetupPackDetail(btn.dataset.pack);
    const key=btn.dataset.pack;
    const text=SETUP_PACK_TEMPLATES[key]||'';
    if(!text)return;
    if(S.busy){showToast('현재 작업이 끝난 뒤 다시 시도해 주세요');return;}
    recordSetupPackRun(key);
    $('msg').value=text;
    autoResize();
    $('msg').focus();
    showToast('설치 팩 작업을 바로 실행합니다');
    await send();
  };
});
function renderSetupPackDetail(key){
  const detail=SETUP_PACK_DETAILS[key];
  const wraps=[$('setupPackDetail'), $('setupPackDetailSidebar')].filter(Boolean);
  if(!wraps.length || !detail) return;
  const html=`<div class="setup-pack-detail-title">${esc(detail.title)}</div><div class="setup-pack-detail-meta">추천 대상: ${esc(detail.who)}</div><div>이 팩을 실행하면 보통 아래 같은 결과를 기대할 수 있습니다.</div><ul>${detail.outcome.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
  wraps.forEach(w=>{w.innerHTML=html;w.style.display='block';});
}
async function rerunSetupPack(key){
  const text=SETUP_PACK_TEMPLATES[key]||'';
  if(!text)return;
  if(S.busy){showToast('현재 작업이 끝난 뒤 다시 시도해 주세요');return;}
  recordSetupPackRun(key);
  $('msg').value=text;
  autoResize();
  $('msg').focus();
  showToast('설치 팩을 다시 실행합니다');
  await send();
}

function runPreflight(kind){
  const artifacts=_loadArtifacts();
  const modalOpen=$('artifactModalOverlay') && $('artifactModalOverlay').style.display!=='none';
  const artifactName=($('artifactName')&&$('artifactName').value||'').trim();
  const artifactType=($('artifactType')&&$('artifactType').value||'note').trim();
  const cronSchedule=($('cronFormSchedule')&&$('cronFormSchedule').value||'').trim();
  const cronPrompt=($('cronFormPrompt')&&$('cronFormPrompt').value||'').trim();
  const cronVibe=($('cronFormVibe')&&$('cronFormVibe').value||'').trim();

  if(kind==='note'){
    const details=[]; let status='pass';
    if(modalOpen && !artifactName){status='warn'; details.push('아티팩트 모달에서 파일 이름이 비어 있습니다');}
    if(modalOpen && artifactType!=='note'){status='warn'; details.push('현재 모달 유형이 Note가 아닙니다');}
    if(!artifacts.some(a => String(a.type||'').includes('note'))){status=status==='pass'?'warn':status; details.push('최근 note 아티팩트가 없습니다');}
    details.push('frontmatter/Obsidian 구조 확인 권장');
    return {title:'Note Check',status,details};
  }
  if(kind==='posting'){
    const details=[]; let status='warn';
    if(artifacts.some(a => String(a.type||'').includes('posting'))){status='pass'; details.push('최근 posting 계열 아티팩트가 있습니다');}
    else details.push('posting 아티팩트가 아직 없습니다');
    details.push('독자/핵심 메시지/시각화 1~2개 아이디어 포함 권장');
    details.push('최종 ShareNote/배포 경로 확인 권장');
    return {title:'Posting Check',status,details};
  }
  if(kind==='cron'){
    const details=[]; let status='warn';
    if(cronSchedule) details.push(`스케줄 입력됨: ${cronSchedule}`); else details.push('스케줄 입력이 없습니다');
    if(cronPrompt || cronVibe) details.push('작업 설명이 입력되어 있습니다'); else details.push('작업 설명이 부족합니다');
    if(cronSchedule && (cronPrompt || cronVibe)) status='pass';
    if(!cronSchedule && !(cronPrompt || cronVibe)) status='fail';
    details.push('deliver 채널과 self-contained prompt 확인 권장');
    return {title:'Cron Check',status,details};
  }
  return {title:'Check',status:'fail',details:['검사 항목을 찾을 수 없습니다']};
}
function renderPreflightResult(kind){
  const wraps=[$('preflightList'), $('preflightListSidebar')].filter(Boolean);
  if(!wraps.length)return;
  const res=runPreflight(kind);
  const klass=res.status==='pass'?'preflight-pass':res.status==='warn'?'preflight-warn':'preflight-fail';
  const html=`<div class="artifact-item ${klass}"><div class="artifact-item-main"><div class="artifact-item-title">${esc(res.title)}</div><div class="artifact-item-meta">${esc(res.status.toUpperCase())}</div><div class="artifact-item-meta">${res.details.map(esc).join(' · ')}</div></div></div>`;
  wraps.forEach(w=>w.innerHTML=html);
}
document.querySelectorAll('.preflight-run').forEach(btn=>{
  btn.onclick=()=>{
    renderPreflightResult(btn.dataset.preflight);
    showToast('Preflight 점검 결과를 업데이트했습니다');
  };
});
renderSetupPackHistory();
function maybeShowOnboardingModal(){
  const key='hermes-webui-onboarding-dismissed';
  if(localStorage.getItem(key)==='1') return;
  const hasSeenSession=!!localStorage.getItem('hermes-webui-session');
  if(hasSeenSession) return;
  const overlay=$('onboardingOverlay');
  if(overlay) overlay.style.display='flex';
}
function closeOnboardingModal(){
  const overlay=$('onboardingOverlay');
  if(!overlay) return;
  if(($('onboardingDontShow')||{}).checked) localStorage.setItem('hermes-webui-onboarding-dismissed','1');
  overlay.style.display='none';
}

async function loadPersonalizationCard(){
  const card=$('personalizationCard');
  if(!card)return;
  try{
    const data=await api('/api/memory');
    const memory=(data.memory||'').trim();
    const user=(data.user||'').trim();
    if(!memory && !user){
      card.style.display='none';
      return;
    }
    const summarize = (text)=> text.split(/\n+/).map(s=>s.replace(/^[-*#\s]+/,'').trim()).filter(Boolean).slice(0,3);
    const userPoints=summarize(user);
    const memPoints=summarize(memory);
    const bullets=[...userPoints.slice(0,2), ...memPoints.slice(0,2)].slice(0,4);
    card.innerHTML=`<div class="personalization-card-title">개인화 미리보기</div><div class="personalization-card-body">이 WebUI 는 사용자의 Hermes memory 와 profile 을 읽어 점점 더 개인화됩니다.${bullets.length?'<ul>'+bullets.map(b=>`<li>${esc(b)}</li>`).join('')+'</ul>':''}</div>`;
    card.style.display='block';
  }catch(e){
    card.style.display='none';
  }
}

async function applyBotName(){
  try{
    const settings=await api('/api/settings');
    const name=(settings.bot_name||'Hermes').trim() || 'Hermes';
    const titleEl=$('topbarTitle');
    if(titleEl && (!$('msgInner') || !$('msgInner').children.length)) titleEl.textContent=name;
    document.querySelectorAll('.assistant-name-dynamic').forEach(el=>el.textContent=name);
    const msgBox=$('msg');
    if(msgBox) msgBox.placeholder=`${name}에게 메시지 보내기…`;
    const meta=$('topbarMeta');
    if(meta && (!$('msgInner') || !$('msgInner').children.length)) meta.textContent=`${name}와 새 대화를 시작해보세요`;
  }catch(e){}
}

// Boot: restore last session or start fresh
// ── Resizable panels ──────────────────────────────────────────────────────
(function(){
  const SIDEBAR_MIN=180, SIDEBAR_MAX=420;
  const PANEL_MIN=180,   PANEL_MAX=500;

  function initResize(handleId, targetEl, edge, minW, maxW, storageKey){
    const handle = $(handleId);
    if(!handle || !targetEl) return;

    // Restore saved width
    const saved = localStorage.getItem(storageKey);
    if(saved) targetEl.style.width = saved + 'px';

    let startX=0, startW=0;

    handle.addEventListener('mousedown', e=>{
      e.preventDefault();
      startX = e.clientX;
      startW = targetEl.getBoundingClientRect().width;
      handle.classList.add('dragging');
      document.body.classList.add('resizing');

      const onMove = ev=>{
        const delta = edge==='right' ? ev.clientX - startX : startX - ev.clientX;
        const newW = Math.min(maxW, Math.max(minW, startW + delta));
        targetEl.style.width = newW + 'px';
      };
      const onUp = ()=>{
        handle.classList.remove('dragging');
        document.body.classList.remove('resizing');
        localStorage.setItem(storageKey, parseInt(targetEl.style.width));
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // Run after DOM ready (called from boot)
  window._initResizePanels = function(){
    const sidebar    = document.querySelector('.sidebar');
    const rightpanel = document.querySelector('.rightpanel');
    initResize('sidebarResize',    sidebar,    'right', SIDEBAR_MIN, SIDEBAR_MAX, 'hermes-sidebar-w');
    initResize('rightpanelResize', rightpanel, 'left',  PANEL_MIN,   PANEL_MAX,   'hermes-panel-w');
  };
})();

(async()=>{
  // Load send key preference
  try{const s=await api('/api/settings');window._sendKey=s.send_key||'enter';window._showTokenUsage=!!s.show_token_usage;window._showCliSessions=!!s.show_cli_sessions;const _theme=s.theme||'dark';document.documentElement.dataset.theme=_theme;localStorage.setItem('hermes-theme',_theme);}catch(e){window._sendKey='enter';window._showTokenUsage=false;window._showCliSessions=false;}
  // Fetch active profile
  try{const p=await api('/api/profile/active');S.activeProfile=p.name||'default';}catch(e){S.activeProfile='default';}
  if(window.ensureMultiAgentState) ensureMultiAgentState();
  // Update profile chip label immediately
  const profileLabel=$('profileChipLabel');
  if(profileLabel) profileLabel.textContent=S.activeProfile||'default';
  // Fetch available models from server and populate dropdown dynamically
  await populateModelDropdown();
  await applyBotName();
  await loadPersonalizationCard();
  if(window.ensureMultiAgentState) ensureMultiAgentState();
  if($('btnCloseOnboarding')) $('btnCloseOnboarding').onclick=closeOnboardingModal;
  maybeShowOnboardingModal();
  // Restore last-used model preference
  const savedModel=localStorage.getItem('hermes-webui-model');
  if(savedModel && $('modelSelect')){
    $('modelSelect').value=savedModel;
    // If the value didn't take (model not in list), clear the bad pref
    if($('modelSelect').value!==savedModel) localStorage.removeItem('hermes-webui-model');
  }
  syncTopbar();
  if(typeof initQuickbarAndScroll==='function') initQuickbarAndScroll();
  if(typeof initModelDrawer==='function') initModelDrawer();
  // Pre-load workspace list so sidebar name is correct from first render
  await loadWorkspaceList();
  _initResizePanels();
  const saved=localStorage.getItem('hermes-webui-session');
  if(saved){
    try{await loadSession(saved);await renderSessionList();await checkInflightOnBoot(saved);if(window.ensureMultiAgentState) ensureMultiAgentState();return;}
    catch(e){localStorage.removeItem('hermes-webui-session');}
  }
  // no saved session - show empty state, wait for user to hit +
  $('emptyState').style.display='';
  await renderSessionList();
  if(window.ensureMultiAgentState) ensureMultiAgentState();
})();



// ── Research Intake image draft → visual evidence review ───────────────────
function _researchIntakeWorkspace(){
  return (S&&S.session&&S.session.workspace) || '';
}
let _researchIntakeCurrentPackage=null;
function _researchIntakeSetResult(message, isError){
  const el=$('researchIntakeResult');
  if(!el) return;
  el.textContent=message;
  el.classList.toggle('error', Boolean(isError));
}
function _researchIntakeSetApprovalEnabled(enabled){
  const btn=$('researchIntakeApprovePromotion');
  if(btn) btn.disabled=!enabled;
  const execBtn=$('researchIntakeExecutionPlan');
  if(execBtn) execBtn.disabled=!enabled;
  const reportBtn=$('researchIntakeFinalExecutionReport');
  if(reportBtn) reportBtn.disabled=!enabled;
  const promptBtn=$('researchIntakeFinalApprovalPrompt');
  if(promptBtn) promptBtn.disabled=!enabled;
  const opencrabBtn=$('researchIntakeExecuteOpenCrab');
  if(opencrabBtn) opencrabBtn.disabled=!enabled;
  const runnerBtn=$('researchIntakeRunOpenCrabConnector');
  if(runnerBtn) runnerBtn.disabled=!enabled;
  const runnerGateBtn=$('researchIntakeApproveOpenCrabRunner');
  if(runnerGateBtn) runnerGateBtn.disabled=!enabled;
  const preflightBtn=$('researchIntakePreflightOpenCrabRunner');
  if(preflightBtn) preflightBtn.disabled=!enabled;
  const liveStubBtn=$('researchIntakeRunOpenCrabLiveStub');
  if(liveStubBtn) liveStubBtn.disabled=!enabled;
  const finalLivePromptBtn=$('researchIntakeOpenCrabLiveFinalApprovalPrompt');
  if(finalLivePromptBtn) finalLivePromptBtn.disabled=!enabled;
  const executionGateBtn=$('researchIntakeOpenCrabLiveExecutionGate');
  if(executionGateBtn) executionGateBtn.disabled=!enabled;
  const liveRunnerHealthBtn=$('researchIntakeOpenCrabLiveRunnerHealth');
  if(liveRunnerHealthBtn) liveRunnerHealthBtn.disabled=!enabled;
  const liveRunnerRetry=$('researchIntakeOpenCrabLiveRunnerRetry');
  if(liveRunnerRetry) liveRunnerRetry.disabled=!enabled;
  const liveRunnerBtn=$('researchIntakeOpenCrabLiveRunner');
  if(liveRunnerBtn) liveRunnerBtn.disabled=!enabled;
}
function _researchIntakeRenderReview(data){
  const panel=$('researchIntakeReviewPanel');
  if(!panel) return;
  const content=(data&&data.content)||'';
  const manifest=(data&&data.manifest)||{};
  const counts=manifest.counts||{};
  const decision=(data&&data.promotion_decision)||null;
  const executionReport=(data&&data.execution_report)||null;
  const decisionLine=decision?`<div class="research-intake-promotion-state">승인 기록: ${esc(decision.status||'recorded')} · external mutations performed: ${esc((decision.external_mutations_performed||[]).length)}</div>`:'';
  const reportLine=executionReport?`<div class="research-intake-final-report"><strong>최종 실행 decision report</strong><div>status: ${esc(executionReport.status||'execution_plan_ready')} · final tool execution approval required</div><pre>${esc(executionReport.content||'execution report unavailable')}</pre></div>`:'';
  panel.innerHTML=`
    <div class="research-intake-review-head">
      <strong>Visual evidence review</strong>
      <span>${esc(data.package_id||manifest.package_id||'draft')}</span>
    </div>
    <div class="research-intake-guard-lines">
      <span>OpenCrab sync: disabled</span>
      <span>Neo4j write: disabled</span>
      <span>Paperclip reflection: disabled</span>
    </div>
    ${decisionLine}
    ${reportLine}
    <div class="research-intake-counts">claims ${esc(counts.claims||0)} · nodes ${esc(counts.nodes||0)} · evidence ${esc(counts.evidence||0)}</div>
    <pre>${esc(content||'review content unavailable')}</pre>`;
}
async function loadResearchIntakeReview(packageIdOrDir){
  if(!packageIdOrDir) return;
  const isDir=String(packageIdOrDir).startsWith('/');
  const qs=isDir?`package_dir=${encodeURIComponent(packageIdOrDir)}`:`package_id=${encodeURIComponent(packageIdOrDir)}`;
  const res=await fetch(new URL(`/api/research-intake/review?${qs}`,location.origin).href,{credentials:'include'});
  const data=await res.json();
  if(!res.ok||!data.ok) throw new Error(data.error||'review load failed');
  _researchIntakeRenderReview(data);
  return data;
}
async function createResearchIntakeImageDraft(){
  const source=($('researchIntakeImageSource')?.value||'').trim();
  if(!source){_researchIntakeSetResult('이미지 경로를 입력하세요.', true);return;}
  const payload={
    source_path: source,
    workspace: _researchIntakeWorkspace(),
    run_ocr: Boolean($('researchIntakeRunOcr')?.checked),
    draft_ocr_claims: Boolean($('researchIntakeDraftClaims')?.checked),
  };
  const fixture=($('researchIntakeOcrFixture')?.value||'').trim();
  if(fixture) payload.ocr_fixture_text=fixture;
  _researchIntakeSetResult('Research Intake draft package 생성 중...', false);
  try{
    const res=await fetch(new URL('/api/research-intake/image-draft',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||'draft package failed');
    _researchIntakeCurrentPackage=data.package_id||data.package_dir;
    _researchIntakeSetApprovalEnabled(Boolean(_researchIntakeCurrentPackage));
    _researchIntakeSetResult(`Draft 생성 완료: ${data.package_id} · OpenCrab sync: disabled · Neo4j write: disabled · Paperclip reflection: disabled`, false);
    await loadResearchIntakeReview(data.package_id||data.package_dir);
  }catch(e){
    _researchIntakeSetResult('Research Intake 생성 실패: '+(e.message||e), true);
  }
}
async function approveResearchIntakePromotion(){
  const packageId=_researchIntakeCurrentPackage;
  if(!packageId){_researchIntakeSetResult('먼저 review package를 생성하세요.', true);return;}
  _researchIntakeSetResult('승인 기록 저장 중... 외부 sync/write/reflection은 실행하지 않습니다.', false);
  try{
    const res=await fetch(new URL('/api/research-intake/approve-promotion',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        package_id:packageId,
        approved:true,
        approved_actions:['opencrab_sync','neo4j_write','paperclip_reflection'],
        approver:'webui-user'
      })
    });
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||'approval record failed');
    _researchIntakeSetResult(`승인 기록 완료: ${data.status} · 별도 실행 승인 전 OpenCrab/Neo4j/Paperclip 반영 없음`, false);
    await loadResearchIntakeReview(data.package_id||packageId);
  }catch(e){
    _researchIntakeSetResult('승인 기록 실패: '+(e.message||e), true);
  }
}
async function loadResearchIntakeExecutionReport(packageIdOrDir){
  const packageId=packageIdOrDir||_researchIntakeCurrentPackage;
  if(!packageId){_researchIntakeSetResult('먼저 execution plan을 생성하세요.', true);return null;}
  const isDir=String(packageId).startsWith('/');
  const qs=isDir?`package_dir=${encodeURIComponent(packageId)}`:`package_id=${encodeURIComponent(packageId)}`;
  try{
    const res=await fetch(new URL(`/api/research-intake/execution-report?${qs}`,location.origin).href,{credentials:'include'});
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||'execution report load failed');
    const panel=$('researchIntakeReviewPanel');
    if(panel){
      panel.innerHTML=`<div class="research-intake-final-report"><strong>최종 실행 decision report</strong><div>status: ${esc(data.status||'execution_plan_ready')} · final tool execution approval required</div><pre>${esc(data.content||'execution report unavailable')}</pre></div>`;
    }
    _researchIntakeSetResult('최종 실행 decision report 표시 완료 · 아직 외부 반영 없음', false);
    return data;
  }catch(e){
    _researchIntakeSetResult('최종 실행 decision report 로드 실패: '+(e.message||e), true);
    return null;
  }
}
async function createResearchIntakeOpenCrabExecutionRequest(executeLive=false){
  const packageId=_researchIntakeCurrentPackage;
  if(!packageId){_researchIntakeSetResult('먼저 최종 실행 승인 요청 문구를 생성하세요.', true);return null;}
  _researchIntakeSetResult(executeLive?'OpenCrab live bridge contract 준비 중... separate operator-approved tool path 필요':'OpenCrab 실행 준비 요청 기록 중... WebUI는 실제 sync를 하지 않습니다.', false);
  try{
    const res=await fetch(new URL('/api/research-intake/execute-opencrab',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        package_id:packageId,
        final_execution_approval:'FINAL_EXECUTE_RESEARCH_INTAKE',
        dry_run:!executeLive,
        execute_live:!!executeLive,
        operator:'webui-user'
      })
    });
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||'opencrab execution request failed');
    const panel=$('researchIntakeReviewPanel');
    if(panel){
      const liveLine=executeLive?`Live bridge contract: ${esc(data.status||'opencrab_live_sync_contract_ready')} · connector: ${esc(data.connector||'configured')} · external mutations disabled until separate operator-approved tool path`:`${esc(data.status||'opencrab_execution_ready')} · dry run: ${esc(String(data.dry_run))} · external mutations disabled`;
      panel.innerHTML=`<div class="research-intake-final-report"><strong>OpenCrab 실행 준비</strong><div>${liveLine}</div><pre>${esc('OpenCrab sync: not executed by WebUI\nNeo4j write: not executed\nPaperclip reflection: not executed\n\nLive execution still requires a separate operator-approved tool path.')}</pre></div>`;
    }
    _researchIntakeSetResult(executeLive?'OpenCrab live bridge contract 준비 완료 · WebUI 직접 sync 없음':'OpenCrab 실행 준비 요청 기록 완료 · 실제 sync 없음', false);
    return data;
  }catch(e){
    _researchIntakeSetResult('OpenCrab 실행 준비 실패: '+(e.message||e), true);
    return null;
  }
}
async function createResearchIntakeOpenCrabLiveFinalApprovalPrompt(){
  const packageId=_researchIntakeCurrentPackage;
  if(!packageId){_researchIntakeSetResult('먼저 Paperclip OpenCrab live runner stub를 완료하세요.', true);return null;}
  _researchIntakeSetResult('OpenCrab live 최종 승인 prompt 생성 중... 실제 sync는 하지 않습니다.', false);
  try{
    const res=await fetch(new URL('/api/research-intake/opencrab-live-final-approval-prompt',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        package_id:packageId,
        connector:'paperclip_opencrab_plugin',
        requester:'webui-user'
      })
    });
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||'opencrab_live_final_approval_prompt failed');
    const panel=$('researchIntakeReviewPanel');
    if(panel){
      const scope=data.mutation_scope||{};
      panel.innerHTML=`<div class="research-intake-final-report"><strong>OpenCrab live 최종 승인 prompt</strong><div>${esc(data.status||'opencrab_live_final_approval_prompt_ready')} · approval required</div><pre>${esc(`Required phrase: EXECUTE_PAPERCLIP_OPENCRAB_LIVE_SYNC\nPayload SHA-256: ${data.payload_sha256||''}\nPrompt artifact: opencrab_live_runner_final_approval_prompt\n\nMutation scope if approved:\nOpenCrab sync: ${scope.opencrab_sync?'will execute in next live runner':'disabled'}\nNeo4j write: disabled\nPaperclip reflection: disabled\n\nCurrent step:\nOpenCrab sync: not executed\nNeo4j write: not executed\nPaperclip reflection: not executed`)}</pre></div>`;
    }
    _researchIntakeSetResult('OpenCrab live 최종 승인 prompt 준비 완료 · 실제 sync 없음', false);
    return data;
  }catch(e){
    _researchIntakeSetResult('OpenCrab live 최종 승인 prompt 실패: '+(e.message||e), true);
    return null;
  }
}
async function runResearchIntakeOpenCrabLiveStub(){
  const packageId=_researchIntakeCurrentPackage;
  if(!packageId){_researchIntakeSetResult('먼저 OpenCrab live runner preflight를 완료하세요.', true);return null;}
  _researchIntakeSetResult('Paperclip OpenCrab live runner stub 준비 중... 실제 sync는 하지 않습니다.', false);
  try{
    const res=await fetch(new URL('/api/research-intake/run-opencrab-live-stub',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        package_id:packageId,
        connector:'paperclip_opencrab_plugin',
        runner_mode:'stub',
        operator:'webui-user'
      })
    });
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||'opencrab_live_runner_stub_result failed');
    const panel=$('researchIntakeReviewPanel');
    if(panel){
      const req=data.request_schema||{};
      panel.innerHTML=`<div class="research-intake-final-report"><strong>Paperclip OpenCrab live runner stub</strong><div>${esc(data.status||'opencrab_live_runner_stub_ready')} · tool: ${esc(req.tool||'paperclip.opencrab.sync_research_intake')} · actual sync not executed</div><pre>${esc(`Payload SHA-256: ${data.payload_sha256||''}\nResult artifact: opencrab_live_runner_stub_result\n\nOpenCrab sync: not executed\nNeo4j write: not executed\nPaperclip reflection: not executed\n\nThis only fixes the live connector request/response schema.`)}</pre></div>`;
    }
    _researchIntakeSetResult('Paperclip OpenCrab live runner stub 준비 완료 · 실제 sync 없음', false);
    return data;
  }catch(e){
    _researchIntakeSetResult('Paperclip OpenCrab live runner stub 실패: '+(e.message||e), true);
    return null;
  }
}
async function preflightResearchIntakeOpenCrabRunner(){
  const packageId=_researchIntakeCurrentPackage;
  if(!packageId){_researchIntakeSetResult('먼저 OpenCrab runner approval gate를 기록하세요.', true);return null;}
  _researchIntakeSetResult('OpenCrab live runner preflight 검증 중... 실제 sync는 하지 않습니다.', false);
  try{
    const res=await fetch(new URL('/api/research-intake/preflight-opencrab-runner',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        package_id:packageId,
        connector:'paperclip_opencrab_plugin',
        runner_mode:'live',
        operator:'webui-user'
      })
    });
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||'opencrab_live_runner_preflight failed');
    const panel=$('researchIntakeReviewPanel');
    if(panel){
      const counts=(data.verified&&data.verified.source_counts)||{};
      panel.innerHTML=`<div class="research-intake-final-report"><strong>OpenCrab live runner preflight</strong><div>${esc(data.status||'opencrab_live_runner_preflight_verified')} · ready: ${esc(String(data.ready_for_live_runner))} · separate live runner still required</div><pre>${esc(`Payload SHA-256: ${data.payload_sha256||''}\nCounts: claims=${counts.claims||0}, nodes=${counts.nodes||0}, evidence=${counts.evidence||0}\n\nOpenCrab sync: not executed\nNeo4j write: not executed\nPaperclip reflection: not executed\n\nopencrab_live_runner_preflight artifact is ready for a separate live runner.`)}</pre></div>`;
    }
    _researchIntakeSetResult('OpenCrab live runner preflight 완료 · 실제 sync 없음', false);
    return data;
  }catch(e){
    _researchIntakeSetResult('OpenCrab live runner preflight 실패: '+(e.message||e), true);
    return null;
  }
}
async function approveResearchIntakeOpenCrabRunner(){
  const packageId=_researchIntakeCurrentPackage;
  if(!packageId){_researchIntakeSetResult('먼저 OpenCrab live sync contract를 준비하세요.', true);return null;}
  _researchIntakeSetResult('OpenCrab runner approval gate 기록 중... 실제 sync는 하지 않습니다.', false);
  try{
    const res=await fetch(new URL('/api/research-intake/approve-opencrab-runner',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        package_id:packageId,
        connector:'paperclip_opencrab_plugin',
        runner_mode:'live',
        approval_phrase:'APPROVE_OPENCRAB_CONNECTOR_RUNNER',
        approver:'webui-user'
      })
    });
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||'runner approval gate failed');
    const panel=$('researchIntakeReviewPanel');
    if(panel){
      panel.innerHTML=`<div class="research-intake-final-report"><strong>OpenCrab runner 승인 gate</strong><div>${esc(data.status||'opencrab_runner_approval_recorded')} · connector: ${esc(data.connector||'paperclip_opencrab_plugin')} · separate live runner required</div><pre>${esc(`Payload SHA-256: ${data.payload_sha256||''}\n\nOpenCrab sync: not executed\nNeo4j write: not executed\nPaperclip reflection: not executed\n\nA real connector runner must verify this checksum before mutation.`)}</pre></div>`;
    }
    _researchIntakeSetResult('OpenCrab runner approval gate 기록 완료 · 실제 sync 없음', false);
    return data;
  }catch(e){
    _researchIntakeSetResult('OpenCrab runner approval gate 실패: '+(e.message||e), true);
    return null;
  }
}
async function runResearchIntakeOpenCrabConnector(){
  const packageId=_researchIntakeCurrentPackage;
  if(!packageId){_researchIntakeSetResult('먼저 OpenCrab live sync contract를 준비하세요.', true);return null;}
  _researchIntakeSetResult('OpenCrab connector dry_run_adapter 검증 중... 실제 sync는 하지 않습니다.', false);
  try{
    const res=await fetch(new URL('/api/research-intake/run-opencrab-connector',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        package_id:packageId,
        connector:'dry_run_adapter',
        runner_mode:'dry_run',
        operator:'webui-user'
      })
    });
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||'connector runner dry-run failed');
    const panel=$('researchIntakeReviewPanel');
    if(panel){
      const would=data.would_sync||{};
      panel.innerHTML=`<div class="research-intake-final-report"><strong>OpenCrab connector dry-run</strong><div>${esc(data.status||'opencrab_connector_dry_run_validated')} · connector: ${esc(data.connector||'dry_run_adapter')} · external mutations disabled</div><pre>${esc(`Would sync\n- claims: ${would.claims||0}\n- nodes: ${would.nodes||0}\n- evidence: ${would.evidence||0}\n\nOpenCrab sync: not executed\nNeo4j write: not executed\nPaperclip reflection: not executed`)}</pre></div>`;
    }
    _researchIntakeSetResult('OpenCrab connector dry-run 검증 완료 · 실제 sync 없음', false);
    return data;
  }catch(e){
    _researchIntakeSetResult('OpenCrab connector dry-run 실패: '+(e.message||e), true);
    return null;
  }
}
async function createResearchIntakeOpenCrabLiveExecutionGate(){
  const packageId=_researchIntakeCurrentPackage;
  if(!packageId){_researchIntakeSetResult('먼저 OpenCrab live 최종 승인 prompt를 완료하세요.', true);return null;}
  _researchIntakeSetResult('OpenCrab live execution gate 확인 중... HERMES_OPENCRAB_ENABLE_LIVE_RUNNER가 꺼져 있으면 Locked 처리됩니다.', false);
  try{
    const res=await fetch(new URL('/api/research-intake/opencrab-live-execution-gate',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        package_id:packageId,
        connector:'paperclip_opencrab_plugin',
        approval_phrase:'EXECUTE_PAPERCLIP_OPENCRAB_LIVE_SYNC',
        operator:'webui-user'
      })
    });
    const data=await res.json();
    if(!res.ok&&res.status!==423) throw new Error(data.error||'opencrab_live_execution_gate failed');
    const panel=$('researchIntakeReviewPanel');
    if(panel){
      const req=data.would_request||{};
      panel.innerHTML=`<div class="research-intake-final-report"><strong>OpenCrab live execution gate</strong><div>${esc(data.status||'opencrab_live_runner_locked')} · ${esc(data.feature_flag||'HERMES_OPENCRAB_ENABLE_LIVE_RUNNER')}=${data.feature_flag_enabled?'true':'false'}</div><pre>${esc(`Payload SHA-256: ${data.payload_sha256||''}\nTool: ${req.tool||'paperclip.opencrab.sync_research_intake'}\nGate artifact: opencrab_live_runner_execution_gate\n\nHERMES_OPENCRAB_ENABLE_LIVE_RUNNER: ${data.feature_flag_enabled?'enabled':'disabled / locked'}\n\nCurrent step:\nOpenCrab sync: not executed\nNeo4j write: not executed\nPaperclip reflection: not executed`)}</pre></div>`;
    }
    _researchIntakeSetResult(data.feature_flag_enabled?'OpenCrab live execution gate 준비 완료 · 실제 호출은 live runner 버튼에서 수행':'OpenCrab live execution gate locked · feature flag off · 실제 sync 없음', !data.feature_flag_enabled);
    return data;
  }catch(e){
    _researchIntakeSetResult('OpenCrab live execution gate 실패: '+(e.message||e), true);
    return null;
  }
}
async function checkResearchIntakeOpenCrabLiveRunnerHealth(){
  _researchIntakeSetResult('OpenCrab live runner bridge health 확인 중... 실제 sync는 하지 않습니다.', false);
  try{
    const res=await fetch(new URL('/api/research-intake/opencrab-live-runner-health',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({operator:'webui-user'})
    });
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||'opencrab_live_runner_health failed');
    const panel=$('researchIntakeReviewPanel');
    if(panel){
      const bridge=data.bridge_result||{};
      panel.innerHTML=`<div class="research-intake-final-report"><strong>OpenCrab live runner bridge health</strong><div>${esc(data.status||'opencrab_live_runner_bridge_unconfigured')} · schema valid: ${data.schema_valid?'true':'false'}</div><pre>${esc(`Feature flag: ${data.feature_flag||'HERMES_OPENCRAB_ENABLE_LIVE_RUNNER'}=${data.feature_flag_enabled?'true':'false'}\nRunner URL configured: ${data.runner_url_configured?'true':'false'}\nExpected tool: ${data.expected_tool||'paperclip.opencrab.sync_research_intake'}\nBridge tool: ${bridge.tool||''}\nBridge status: ${bridge.status||''}\n\nOpenCrab sync: not executed\nNeo4j write: not executed\nPaperclip reflection: not executed\n\nReady status: opencrab_live_runner_bridge_ready`)}</pre></div>`;
    }
    _researchIntakeSetResult(data.status==='opencrab_live_runner_bridge_ready'?'OpenCrab live runner bridge ready · 실제 sync 없음':'OpenCrab live runner bridge 점검 완료 · 실제 sync 없음', data.status!=='opencrab_live_runner_bridge_ready');
    return data;
  }catch(e){
    _researchIntakeSetResult('OpenCrab live runner bridge health 실패: '+(e.message||e), true);
    return null;
  }
}
async function runResearchIntakeOpenCrabLiveRunner(){
  const packageId=_researchIntakeCurrentPackage;
  if(!packageId){_researchIntakeSetResult('먼저 OpenCrab live execution gate를 완료하세요.', true);return null;}
  _researchIntakeSetResult('OpenCrab live runner 호출 중... 승인 문구와 feature flag를 재검증합니다.', false);
  try{
    const res=await fetch(new URL('/api/research-intake/opencrab-live-runner',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        package_id:packageId,
        connector:'paperclip_opencrab_plugin',
        approval_phrase:'EXECUTE_PAPERCLIP_OPENCRAB_LIVE_SYNC',
        operator:'webui-user',
        retry:!!($('researchIntakeOpenCrabLiveRunnerRetry')&&$('researchIntakeOpenCrabLiveRunnerRetry').checked)
      })
    });
    const data=await res.json();
    if(!res.ok&&res.status!==423&&res.status!==409&&res.status!==502) throw new Error(data.error||'opencrab_live_runner failed');
    const panel=$('researchIntakeReviewPanel');
    if(panel){
      const result=data.connector_result||{};
      const retry=data.retry_guard||{};
      const verification=data.success_verification||data.verification||{};
      const checks=verification.checks||{};
      panel.innerHTML=`<div class="research-intake-final-report"><strong>OpenCrab live runner result</strong><div>${esc(data.status||'opencrab_live_runner_locked')} · connector: ${esc(data.connector||'paperclip_opencrab_plugin')}</div><pre>${esc(`Payload SHA-256: ${data.payload_sha256||''}\nResult artifact: ${data.status==='opencrab_live_runner_failed'?'opencrab_live_runner_failure':'opencrab_live_runner_result'}\nsuccess verification artifact: opencrab_live_runner_success_verification\nSuccess verification: ${verification.status||''}\nPayload check: ${checks.payload_sha256_match===true?'true':'false'}\nCounts check: ${checks.synced_counts_match_request===true?'true':'false'}\nOpenCrab result id check: ${checks.opencrab_result_id_present===true?'true':'false'}\nFailure artifact: opencrab_live_runner_failure\nFailure type: ${data.failure_type||''}\nRetry guard: ${retry.retry_required?'retry_required=true':'none'}\nOpenCrab result id: ${result.opencrab_result_id||''}\n\nMutations:\nOpenCrab sync: ${data.external_mutations&&data.external_mutations.opencrab_sync?'executed':'not executed'}\nNeo4j write: not executed\nPaperclip reflection: not executed`)}</pre></div>`;
    }
    _researchIntakeSetResult(data.status==='opencrab_live_runner_completed'?'OpenCrab live runner 완료 · Paperclip reflection/Neo4j write 없음':(data.status==='opencrab_live_runner_retry_blocked'?'OpenCrab live runner retry blocked · retry=true 필요':'OpenCrab live runner 완료 아님 · failure/retry guard 확인'), data.status!=='opencrab_live_runner_completed');
    return data;
  }catch(e){
    _researchIntakeSetResult('OpenCrab live runner 실패: '+(e.message||e), true);
    return null;
  }
}
async function createResearchIntakeFinalApprovalPrompt(){
  const packageId=_researchIntakeCurrentPackage;
  if(!packageId){_researchIntakeSetResult('먼저 최종 실행 decision report를 생성하세요.', true);return null;}
  _researchIntakeSetResult('최종 실행 승인 요청 문구 생성 중... 실제 반영은 하지 않습니다.', false);
  try{
    const res=await fetch(new URL('/api/research-intake/approval-prompt',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        package_id:packageId,
        actions:['opencrab_sync','neo4j_write','paperclip_reflection'],
        approver:'webui-user'
      })
    });
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||'approval prompt failed');
    const panel=$('researchIntakeReviewPanel');
    if(panel){
      panel.innerHTML=`<div class="research-intake-final-report"><strong>최종 실행 승인 요청 문구</strong><div>type exactly: ${esc(data.approval_phrase||'FINAL_EXECUTE_RESEARCH_INTAKE')} · external mutations disabled</div><pre>${esc(data.prompt||'approval prompt unavailable')}</pre></div>`;
    }
    _researchIntakeSetResult('최종 실행 승인 요청 문구 생성 완료 · 아직 외부 반영 없음', false);
    return data;
  }catch(e){
    _researchIntakeSetResult('최종 실행 승인 요청 문구 생성 실패: '+(e.message||e), true);
    return null;
  }
}
async function createResearchIntakeExecutionPlan(){
  const packageId=_researchIntakeCurrentPackage;
  if(!packageId){_researchIntakeSetResult('먼저 승인된 review package를 선택하세요.', true);return;}
  _researchIntakeSetResult('실행 계획 생성 중... OpenCrab/Neo4j/Paperclip 실제 반영은 하지 않습니다.', false);
  try{
    const res=await fetch(new URL('/api/research-intake/execution-plan',location.origin).href,{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        package_id:packageId,
        actions:['opencrab_sync','neo4j_write','paperclip_reflection'],
        execution_approval:'EXECUTE_RESEARCH_INTAKE_PROMOTION',
        approver:'webui-user'
      })
    });
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||'execution plan failed');
    _researchIntakeSetResult(`실행 계획 준비: ${data.status} · final tool execution approval 필요 · external mutations: disabled`, false);
    await loadResearchIntakeReview(data.package_id||packageId);
    await loadResearchIntakeExecutionReport(data.package_id||packageId);
  }catch(e){
    _researchIntakeSetResult('실행 계획 생성 실패: '+(e.message||e), true);
  }
}
window.createResearchIntakeImageDraft=createResearchIntakeImageDraft;
window.loadResearchIntakeReview=loadResearchIntakeReview;
window.approveResearchIntakePromotion=approveResearchIntakePromotion;
window.loadResearchIntakeExecutionReport=loadResearchIntakeExecutionReport;
window.createResearchIntakeOpenCrabExecutionRequest=createResearchIntakeOpenCrabExecutionRequest;
window.runResearchIntakeOpenCrabConnector=runResearchIntakeOpenCrabConnector;
window.approveResearchIntakeOpenCrabRunner=approveResearchIntakeOpenCrabRunner;
window.preflightResearchIntakeOpenCrabRunner=preflightResearchIntakeOpenCrabRunner;
window.runResearchIntakeOpenCrabLiveStub=runResearchIntakeOpenCrabLiveStub;
window.createResearchIntakeOpenCrabLiveFinalApprovalPrompt=createResearchIntakeOpenCrabLiveFinalApprovalPrompt;
window.createResearchIntakeOpenCrabLiveExecutionGate=createResearchIntakeOpenCrabLiveExecutionGate;
window.checkResearchIntakeOpenCrabLiveRunnerHealth=checkResearchIntakeOpenCrabLiveRunnerHealth;
window.runResearchIntakeOpenCrabLiveRunner=runResearchIntakeOpenCrabLiveRunner;
window.createResearchIntakeFinalApprovalPrompt=createResearchIntakeFinalApprovalPrompt;
window.createResearchIntakeExecutionPlan=createResearchIntakeExecutionPlan;
