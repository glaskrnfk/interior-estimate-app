// ============================================================
//  estimate-save.js  v2.0
//  견적서 저장 · 불러오기 · 계약완료 관리 모듈
//
//  ▣ 저장 흐름
//    최초 저장  → 팝업(제목 자동채움) → 신규 레코드 생성
//    이후 저장  → 즉시 덮어쓰기 (현재 ID) → 토스트만 표시
//    다른이름저장 → 팝업(제목 자동채움) → 새 레코드 생성
//    계약완료   → 현재 레코드 contractedAt 토글
//
//  ▣ EstimateRecord 스키마
//    {
//      id           : string  (UUID)
//      title        : string  (현장명 + 평수 + 관리자 입력)
//      clientName   : string
//      siteName     : string
//      version      : string
//      savedAt      : number  (timestamp ms)
//      step         : number
//      fields       : object
//      selectedMats : object
//      selectedLabs : object
//      detailRows   : array
//      estRates     : object
//      vatMode      : string
//      contracted   : boolean  (계약완료 여부)
//      contractedAt : number   (계약완료 시각, ms)
//      costSnapshot : object   (계약 시점 costResult 스냅샷)
//    }
// ============================================================

const EST_SAVE_KEY = 'iq_estimates';

/* ── 유틸 ─────────────────────────────────────────────── */
function genEstId() {
    return 'est_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

/* ── 목록 로드/저장 ───────────────────────────────────── */
function loadEstimates() {
    try { return JSON.parse(localStorage.getItem(EST_SAVE_KEY) || '[]'); }
    catch { return []; }
}
function saveEstimates(list) {
    localStorage.setItem(EST_SAVE_KEY, JSON.stringify(list));
}

/* ── 현재 견적 상태 수집 ──────────────────────────────── */
function collectCurrentState() {
    const fieldIds = [
        'clientName','siteName','siteAddress',
        'areaPyeong','areaSqm','constDays',
        'companyName','repName','companyTel','companyFax','companyAddr',
        'siteWorkSummary','adminMemo'
    ];
    const fields = {};
    fieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) fields[id] = el.value;
    });
    return {
        fields,
        selectedMats : JSON.parse(JSON.stringify(typeof selectedMats !== 'undefined' ? selectedMats : {})),
        selectedLabs : JSON.parse(JSON.stringify(typeof selectedLabs !== 'undefined' ? selectedLabs : {})),
        detailRows   : JSON.parse(JSON.stringify(typeof detailRows   !== 'undefined' ? detailRows   : [])),
        estRates     : JSON.parse(JSON.stringify(typeof estRates     !== 'undefined' ? estRates     : {})),
        vatMode      : typeof vatMode !== 'undefined' ? vatMode : 'include',
        step         : typeof currentStep !== 'undefined' ? currentStep : 1
    };
}

/* ── 자동 제목 생성 ───────────────────────────────────── */
function buildAutoTitle() {
    const siteName   = (document.getElementById('siteName')   || {}).value || '';
    const areaPyeong = (document.getElementById('areaPyeong') || {}).value || '';
    const parts = [siteName, areaPyeong ? areaPyeong + '평' : ''].filter(Boolean);
    return parts.join(' ');
}

/* ── 상태 복원 ────────────────────────────────────────── */
function restoreState(record) {
    if (record.fields) {
        Object.entries(record.fields).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        });
    }
    if (typeof selectedMats !== 'undefined') {
        Object.keys(selectedMats).forEach(k => delete selectedMats[k]);
        Object.assign(selectedMats, record.selectedMats || {});
    }
    if (typeof selectedLabs !== 'undefined') {
        Object.keys(selectedLabs).forEach(k => delete selectedLabs[k]);
        Object.assign(selectedLabs, record.selectedLabs || {});
    }
    if (typeof detailRows !== 'undefined') {
        detailRows.length = 0;
        (record.detailRows || []).forEach(r => detailRows.push(r));
    }
    if (typeof estRates !== 'undefined') {
        Object.keys(estRates).forEach(k => delete estRates[k]);
        Object.assign(estRates, record.estRates || {});
    }
    if (typeof setVatMode === 'function') {
        setVatMode(record.vatMode || 'include');
    }
}

/* ══════════════════════════════════════════════════════
   핵심 저장 함수
══════════════════════════════════════════════════════ */

/* 새 레코드 생성 */
function createEstimate(title) {
    const state  = collectCurrentState();
    const fields = state.fields;
    const record = {
        id           : genEstId(),
        title        : title || buildAutoTitle() || '새 견적서',
        clientName   : fields.clientName || '',
        siteName     : fields.siteName   || '',
        savedAt      : Date.now(),
        contracted   : false,
        contractedAt : null,
        costSnapshot : null,
        ...state
    };
    const list = loadEstimates();
    list.unshift(record);
    saveEstimates(list);
    return record;
}

/* 기존 레코드 덮어쓰기 */
function updateEstimate(id, titleOverride) {
    const state = collectCurrentState();
    const list  = loadEstimates();
    const idx   = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    const existing = list[idx];
    list[idx] = {
        ...existing,
        ...state,
        title        : titleOverride || existing.title,
        clientName   : state.fields.clientName || existing.clientName,
        siteName     : state.fields.siteName   || existing.siteName,
        savedAt      : Date.now(),
        // 계약 상태는 유지
        contracted   : existing.contracted,
        contractedAt : existing.contractedAt,
        costSnapshot : existing.costSnapshot
    };
    saveEstimates(list);
    return list[idx];
}

/* ══════════════════════════════════════════════════════
   저장 버튼 클릭 핸들러 (스마트 저장)
   - 현재 작업 중인 ID가 없으면 → 팝업(최초 저장)
   - 있으면 → 즉시 덮어쓰기
══════════════════════════════════════════════════════ */
function smartSave() {
    if (!_currentEstimateId) {
        // 최초 저장 → 팝업
        openSaveDialog(false);
    } else {
        // 이미 저장된 적 있음 → 즉시 덮어쓰기
        const record = updateEstimate(_currentEstimateId);
        if (record) {
            showToast(`💾 "${record.title}" 저장되었습니다.`);
            updateCurrentEstBadge();
            if (typeof renderEstimateList === 'function') renderEstimateList();
        }
    }
}

/* 다른 이름으로 저장 → 항상 팝업 */
function saveAsNew() {
    openSaveDialog(true);
}

/* ══════════════════════════════════════════════════════
   계약 완료 토글
══════════════════════════════════════════════════════ */
function toggleContract() {
    // 미저장 상태면 먼저 저장하도록 안내
    if (!_currentEstimateId) {
        showToast('⚠️ 먼저 견적서를 저장해 주세요.');
        openSaveDialog(false);
        return;
    }
    const list  = loadEstimates();
    const idx   = list.findIndex(r => r.id === _currentEstimateId);
    if (idx === -1) return;

    const cur = list[idx];
    const newContracted = !cur.contracted;

    if (newContracted) {
        if (!confirm(`"${cur.title}"\n\n이 견적서를 계약 완료로 표시하시겠습니까?\n계약 시점의 금액 정보가 함께 저장됩니다.`)) return;
        // costResult 스냅샷 저장
        const snap = typeof costResult !== 'undefined' ? JSON.parse(JSON.stringify(costResult)) : {};
        list[idx] = { ...cur, contracted: true, contractedAt: Date.now(), costSnapshot: snap };
        showToast('🎉 계약 완료로 표시되었습니다!');
    } else {
        if (!confirm(`"${cur.title}"\n\n계약 완료 표시를 해제하시겠습니까?`)) return;
        list[idx] = { ...cur, contracted: false, contractedAt: null };
        showToast('계약 완료 표시가 해제되었습니다.');
    }
    saveEstimates(list);
    updateCurrentEstBadge();
    if (typeof renderEstimateList === 'function') renderEstimateList();
}

/* ══════════════════════════════════════════════════════
   저장 다이얼로그 열기/닫기
   isNew = true  → 다른이름저장 (항상 신규 생성)
   isNew = false → 최초 저장
══════════════════════════════════════════════════════ */
function openSaveDialog(isNew = false) {
    const modal = document.getElementById('save-dialog-modal');
    if (!modal) return;

    // 제목 자동 채움
    const titleInput = document.getElementById('save-title-input');
    if (titleInput) {
        const autoTitle = buildAutoTitle();
        titleInput.value = autoTitle;
        setTimeout(() => {
            titleInput.focus();
            titleInput.select();
        }, 100);
    }

    modal.dataset.saveMode = isNew ? 'new' : 'first';
    modal.classList.add('open');
}

function closeSaveDialog() {
    const modal = document.getElementById('save-dialog-modal');
    if (modal) modal.classList.remove('open');
}

function confirmSave() {
    const modal     = document.getElementById('save-dialog-modal');
    const titleInput = document.getElementById('save-title-input');
    const title     = (titleInput ? titleInput.value.trim() : '') || buildAutoTitle() || '새 견적서';
    const saveMode  = modal ? modal.dataset.saveMode : 'first';

    let record;
    if (saveMode === 'new') {
        // 다른이름으로 저장 → 반드시 신규 생성
        record = createEstimate(title);
        setCurrentEstimateId(record.id);
        showToast(`✅ "${record.title}" 새 버전으로 저장되었습니다.`);
    } else {
        // 최초 저장
        record = createEstimate(title);
        setCurrentEstimateId(record.id);
        showToast(`✅ "${record.title}" 저장 완료`);
    }
    closeSaveDialog();
    updateCurrentEstBadge();
    if (typeof renderEstimateList === 'function') renderEstimateList();
}

/* ── 기존 호환용 (외부에서 openSaveDialog() 단독 호출 시) */
// 이미 위에서 정의됨

/* ══════════════════════════════════════════════════════
   견적 목록 모달
══════════════════════════════════════════════════════ */
function openEstimateList() {
    const modal = document.getElementById('estimate-list-modal');
    if (!modal) return;
    renderEstimateList();
    modal.classList.add('open');
}
function closeEstimateList() {
    const modal = document.getElementById('estimate-list-modal');
    if (modal) modal.classList.remove('open');
}

function renderEstimateList() {
    const container = document.getElementById('estimate-list-body');
    if (!container) return;
    const list = loadEstimates();

    const count = document.getElementById('est-list-count');
    if (count) count.textContent = `전체 ${list.length}건`;

    const contractCount = list.filter(r => r.contracted).length;
    const contractBadge = document.getElementById('est-list-contract-count');
    if (contractBadge) contractBadge.textContent = `계약완료 ${contractCount}건`;

    if (list.length === 0) {
        container.innerHTML = `
          <div style="text-align:center;padding:48px 20px;color:#aaa">
            <i class="fas fa-folder-open" style="font-size:42px;margin-bottom:14px;display:block;color:#d0d8e4"></i>
            <p style="font-size:14px;font-weight:600;margin-bottom:6px">저장된 견적서가 없습니다</p>
            <p style="font-size:12px">작업 중인 견적을 저장해 보세요.</p>
          </div>`;
        return;
    }

    container.innerHTML = list.map(r => {
        const date     = new Date(r.savedAt);
        const dateStr  = `${date.getFullYear()}.${zp2(date.getMonth()+1)}.${zp2(date.getDate())} ${zp2(date.getHours())}:${zp2(date.getMinutes())}`;
        const rowCount = (r.detailRows || []).length;
        const pyeong   = r.fields && r.fields.areaPyeong ? r.fields.areaPyeong + '평' : '';
        const isCur    = r.id === _currentEstimateId;
        const isContr  = !!r.contracted;

        // 금액 표시 (costSnapshot 또는 detailRows 합산)
        let finText = '';
        if (r.costSnapshot && r.costSnapshot.fin) {
            finText = `₩ ${Number(r.costSnapshot.fin).toLocaleString()}`;
        }
        const contractDate = r.contractedAt
            ? new Date(r.contractedAt).toLocaleDateString('ko-KR')
            : '';

        return `
        <div class="est-card ${isContr ? 'contracted' : ''} ${isCur ? 'current' : ''}" id="ec-${r.id}">
          <div class="est-card-header">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
              ${isContr ? `<span class="est-badge-contracted"><i class="fas fa-handshake"></i> 계약완료</span>` : ''}
              ${isCur   ? `<span class="est-badge-current"><i class="fas fa-pen"></i> 작성중</span>` : ''}
              <div class="est-card-title">${escHtml(r.title || r.siteName || '제목 없음')}</div>
            </div>
          </div>
          <div class="est-card-meta">
            <span><i class="fas fa-user"></i> ${escHtml(r.clientName || '—')}</span>
            <span><i class="fas fa-map-marker-alt"></i> ${escHtml(r.siteName || '—')}</span>
            ${pyeong ? `<span><i class="fas fa-ruler-combined"></i> ${pyeong}</span>` : ''}
            ${finText ? `<span style="color:#1a3e72;font-weight:700"><i class="fas fa-won-sign"></i> ${finText}</span>` : ''}
            <span><i class="fas fa-list"></i> ${rowCount}개 항목</span>
            <span><i class="fas fa-clock"></i> ${dateStr}</span>
            ${isContr && contractDate ? `<span style="color:#059669"><i class="fas fa-handshake"></i> 계약일 ${contractDate}</span>` : ''}
          </div>
          <div class="est-card-actions">
            <button class="est-card-btn primary" onclick="loadEstimateById('${r.id}')">
              <i class="fas fa-folder-open"></i> 불러오기
            </button>
            <button class="est-card-btn" onclick="exportEstimateAsJSON('${r.id}')">
              <i class="fas fa-download"></i> 내보내기
            </button>
            <button class="est-card-btn danger" onclick="deleteEstimateUI('${r.id}')">
              <i class="fas fa-trash"></i> 삭제
            </button>
          </div>
        </div>`;
    }).join('');
}

function zp2(n) { return String(n).padStart(2,'0'); }

/* ── 불러오기 ─────────────────────────────────────────── */
function loadEstimateById(id) {
    const list   = loadEstimates();
    const record = list.find(r => r.id === id);
    if (!record) { showToast('견적서를 찾을 수 없습니다.'); return; }
    if (!confirm(`"${record.title}" 견적서를 불러오면 현재 작업 내용이 대체됩니다.\n계속하시겠습니까?`)) return;

    restoreState(record);
    if (typeof renderMatBlocks   === 'function') renderMatBlocks();
    if (typeof renderLabBlocks   === 'function') renderLabBlocks();
    if (typeof updateSelCount    === 'function') updateSelCount();
    if (typeof syncRateForm      === 'function') syncRateForm();
    if (typeof updateVatToggleUI === 'function') updateVatToggleUI();
    if (typeof renderEditTable   === 'function') renderEditTable();
    if (typeof recalc            === 'function') recalc();

    setCurrentEstimateId(record.id);
    const targetStep = Math.min(Math.max(record.step || 1, 1), 5);
    if (typeof goStep === 'function') goStep(targetStep);

    closeEstimateList();
    showToast(`✅ "${record.title}" 불러오기 완료`);
}

/* ── 삭제 ─────────────────────────────────────────────── */
function deleteEstimate(id) {
    const list = loadEstimates().filter(r => r.id !== id);
    saveEstimates(list);
}
function deleteEstimateUI(id) {
    const list   = loadEstimates();
    const record = list.find(r => r.id === id);
    if (!record) return;
    if (!confirm(`"${record.title}" 견적서를 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
    deleteEstimate(id);
    if (id === _currentEstimateId) {
        _currentEstimateId = null;
        updateCurrentEstBadge();
    }
    renderEstimateList();
    showToast('견적서가 삭제되었습니다.');
}

/* ── JSON 내보내기 ────────────────────────────────────── */
function exportEstimateAsJSON(id) {
    const record = loadEstimates().find(r => r.id === id);
    if (!record) return;
    const json = JSON.stringify(record, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `견적_${record.clientName || ''}_${record.title || ''}_${
        new Date(record.savedAt).toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ── JSON 가져오기 ────────────────────────────────────── */
function importEstimateFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const record = JSON.parse(e.target.result);
                if (!record.id || !record.savedAt) { reject(new Error('유효하지 않은 견적 파일입니다.')); return; }
                const list = loadEstimates();
                if (list.some(r => r.id === record.id)) {
                    record.id    = genEstId();
                    record.title = '[가져오기] ' + (record.title || '');
                }
                list.unshift(record);
                saveEstimates(list);
                resolve(record);
            } catch (err) { reject(err); }
        };
        reader.onerror = () => reject(new Error('파일 읽기 실패'));
        reader.readAsText(file);
    });
}
function triggerImportFile() {
    const input = document.getElementById('import-est-input');
    if (input) input.click();
}
function handleImportFile(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    importEstimateFromFile(file)
        .then(record => { showToast(`✅ "${record.title || '견적서'}" 가져오기 완료`); renderEstimateList(); evt.target.value = ''; })
        .catch(err => { alert('가져오기 실패: ' + err.message); evt.target.value = ''; });
}

/* ── HTML 이스케이프 ────────────────────────────────── */
function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
}

/* ══════════════════════════════════════════════════════
   현재 작업 중인 견적 ID 관리
══════════════════════════════════════════════════════ */
let _currentEstimateId = null;

function setCurrentEstimateId(id) { _currentEstimateId = id; updateCurrentEstBadge(); }
function getCurrentEstimateId()   { return _currentEstimateId; }

function updateCurrentEstBadge() {
    const badge      = document.getElementById('current-est-badge');
    const contractBtn = document.getElementById('btn-contract');
    if (!badge) return;

    if (!_currentEstimateId) {
        badge.textContent = '미저장';
        badge.className   = 'cur-est-badge unsaved';
        if (contractBtn) { contractBtn.classList.remove('contracted'); contractBtn.title = '계약완료 표시 (먼저 저장하세요)'; }
        return;
    }
    const list   = loadEstimates();
    const record = list.find(r => r.id === _currentEstimateId);
    if (record) {
        const isContr = !!record.contracted;
        badge.textContent = (isContr ? '🤝 ' : '') + (record.title || '저장됨');
        badge.className   = 'cur-est-badge ' + (isContr ? 'contracted' : 'saved');
        if (contractBtn) {
            contractBtn.classList.toggle('contracted', isContr);
            contractBtn.innerHTML = isContr
                ? '<i class="fas fa-handshake"></i> 계약완료 ✓'
                : '<i class="fas fa-handshake"></i> 계약완료';
            contractBtn.title = isContr ? '계약완료 해제' : '계약완료로 표시';
        }
    }
}

/* ══════════════════════════════════════════════════════
   자동 임시저장
══════════════════════════════════════════════════════ */
function autoSaveDraft() {
    const state = collectCurrentState();
    const hasContent = (state.fields.clientName || state.fields.siteName) ||
        Object.keys(state.selectedMats).length > 0 || state.detailRows.length > 0;
    if (!hasContent) return;
    localStorage.setItem('iq_autosave', JSON.stringify({ ...state, savedAt: Date.now() }));
}
function loadAutoSaveDraft() {
    try { const raw = localStorage.getItem('iq_autosave'); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
}
function clearAutoSave() { localStorage.removeItem('iq_autosave'); }
