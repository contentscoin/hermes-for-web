// Memory Candidate Inbox MVP (Batch 1)
let _memoryInboxCache = {candidates: [], facts: []};

async function loadMemoryInbox(){
  const box=$('memoryInboxPanel');
  if(!box)return;
  box.innerHTML='<div class="memory-inbox-empty">불러오는 중...</div>';
  try{
    const [candData, factData]=await Promise.all([
      api('/api/memory-candidates?status=pending'),
      api('/api/facts?status=active')
    ]);
    _memoryInboxCache.candidates=candData.candidates||[];
    _memoryInboxCache.facts=factData.facts||[];
    renderMemoryInbox(candData.summary||factData.summary||{});
  }catch(e){
    box.innerHTML=`<div class="memory-inbox-error">Memory Inbox 로드 실패: ${esc(e.message||String(e))}</div>`;
  }
}

function renderMemoryInbox(summary){
  const box=$('memoryInboxPanel');
  if(!box)return;
  const candidates=_memoryInboxCache.candidates||[];
  const facts=_memoryInboxCache.facts||[];
  const summaryHtml=`
    <div class="memory-inbox-summary">
      <div><strong>${candidates.length}</strong><span>승인 대기</span></div>
      <div><strong>${facts.length}</strong><span>활성 Fact</span></div>
      <div><strong>승인형</strong><span>Paperclip/Telegram 자동 반영 없음</span></div>
    </div>`;
  if(!candidates.length){
    box.innerHTML=summaryHtml + '<div class="memory-inbox-empty">대기 중인 기억 후보가 없습니다. 오른쪽 빠른 실행의 “기억 후보 추출”로 후보 JSON을 만들고, 하단 입력 폼에 붙여 넣어 저장하세요.</div>' + memoryCandidateFormHtml() + renderFactsPreview(facts);
    return;
  }
  box.innerHTML=summaryHtml + candidates.map(renderMemoryCandidateCard).join('') + memoryCandidateFormHtml() + renderFactsPreview(facts);
}

function renderMemoryCandidateCard(c){
  const badge=c.recommended_action==='paperclip_draft_only' ? '<span class="memory-badge draft">Paperclip draft only</span>' : `<span class="memory-badge">${esc(c.category||'knowledge')}</span>`;
  return `<div class="memory-candidate-card" data-candidate-id="${esc(c.id)}">
    <div class="memory-candidate-head">
      <div>${badge}<span class="memory-badge scope">${esc(c.scope||'global')}:${esc(c.scope_ref||'default')}</span></div>
      <span class="memory-confidence">${Math.round(Number(c.confidence||0)*100)}%</span>
    </div>
    <textarea class="memory-candidate-statement" id="candEdit_${esc(c.id)}">${esc(c.statement||'')}</textarea>
    <div class="memory-candidate-meta">
      source: ${esc(c.source_session_id||'manual')} · ${esc(c.reason||'승인 후에만 fact store에 저장됩니다.')}
    </div>
    <div class="memory-candidate-actions">
      <button class="cron-btn run" onclick="approveMemoryCandidate('${esc(c.id)}')">승인 → Fact</button>
      <button class="cron-btn" onclick="rejectMemoryCandidate('${esc(c.id)}')">거절</button>
    </div>
  </div>`;
}

function memoryCandidateFormHtml(){
  return `<div class="memory-candidate-form">
    <div class="memory-candidate-form-title">수동 후보 추가</div>
    <textarea id="memoryCandidateJson" rows="5" placeholder='JSON 1개 또는 배열을 붙여넣기: {"category":"decision","scope":"project","scope_ref":"...","statement":"..."}'></textarea>
    <div class="memory-candidate-actions">
      <button class="cron-btn run" onclick="submitMemoryCandidateJson()">후보 저장</button>
      <button class="cron-btn" onclick="fillMemoryCandidateExample()">예시</button>
    </div>
    <div class="memory-inbox-note">안전 원칙: 이 기능은 로컬 후보/Facts JSONL만 씁니다. memory tool, Paperclip, Telegram은 실행하지 않습니다.</div>
  </div>`;
}

function renderFactsPreview(facts){
  if(!facts.length)return '';
  return `<div class="memory-facts-preview"><div class="memory-candidate-form-title">최근 활성 Fact</div>${facts.slice(0,6).map(f=>`<div class="memory-fact-row"><span>${esc(f.scope||'global')}:${esc(f.scope_ref||'default')}</span>${esc(f.statement||'')}</div>`).join('')}</div>`;
}

async function approveMemoryCandidate(id){
  const text=$('candEdit_'+id)?.value||'';
  try{
    await api('/api/memory-candidates/approve',{candidate_id:id, edited_statement:text});
    showToast('후보를 승인해 Fact로 저장했습니다');
    await loadMemoryInbox();
  }catch(e){showToast('승인 실패: '+(e.message||e));}
}

async function rejectMemoryCandidate(id){
  const reason=prompt('거절 사유 (선택)')||'';
  try{
    await api('/api/memory-candidates/reject',{candidate_id:id, reason});
    showToast('후보를 거절했습니다');
    await loadMemoryInbox();
  }catch(e){showToast('거절 실패: '+(e.message||e));}
}

function fillMemoryCandidateExample(){
  const box=$('memoryCandidateJson');
  if(!box)return;
  box.value=JSON.stringify({
    category:'decision', scope:'project', scope_ref:(S.session&&S.session.workspace)||'default',
    statement:'Paperclip 반영은 실행 승인 후에만 진행한다.', source_session_id:(S.session&&S.session.session_id)||null,
    confidence:0.8, recommended_action:'approve', reason:'현재 대화에서 반복 확인된 운영 원칙'
  }, null, 2);
}

async function submitMemoryCandidateJson(){
  const raw=($('memoryCandidateJson')?.value||'').trim();
  if(!raw){showToast('저장할 JSON을 입력하세요');return;}
  let parsed;
  try{parsed=JSON.parse(raw);}catch(e){showToast('JSON 파싱 실패: '+e.message);return;}
  const items=Array.isArray(parsed)?parsed:[parsed];
  try{
    for(const item of items){
      await api('/api/memory-candidates', {
        category:item.category||'knowledge', scope:item.scope||'global', scope_ref:item.scope_ref||'default',
        statement:item.statement||'', source_session_id:item.source_session_id||((S.session&&S.session.session_id)||null),
        source_message_ids:item.source_message_ids||[], confidence:item.confidence, reason:item.reason||'',
        sensitivity:item.sensitivity||'internal', recommended_action:item.recommended_action||'approve', metadata:item.metadata||{}
      });
    }
    showToast(`${items.length}개 후보를 저장했습니다`);
    await loadMemoryInbox();
  }catch(e){showToast('저장 실패: '+(e.message||e));}
}
