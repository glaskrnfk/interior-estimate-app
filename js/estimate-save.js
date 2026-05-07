// ============================================================
//  estimate-save.js  v3.0  –  Supabase 동기화 + localStorage 폴백
//
//  ▣ 저장 흐름
//    최초 저장  → 팝업(제목 자동채움) → 신규 레코드 생성
//    이후 저장  → 즉시 덮어쓰기 (현재 ID) → 토스트만 표시
//    다른이름저장 → 팝업(제목 자동채움) → 새 레코드 생성
//    계약완료   → 현재 레코드 contractedAt 토글
//
//  ▣ Supabase 전략 (A안: public read/write, anon key)
//    - 저장: Supabase upsert + localStorage 동시 저장
//    - 로드: Supabase 우선, 실패 시 localStorage fallback
//    - 삭제: Supabase delete + localStorage 동시 삭제
//    - 오프라인/오류 시 localStorage 단독 동작 (무중단)
//
//  ▣ Supabase 테이블: estimates
//    id          text PRIMARY KEY
//    title       text
//    client_name text
//    site_name   text
//    saved_at    bigint
//    contracted  boolean default false
//    contracted_at bigint
//    cost_snapshot jsonb
//    data        jsonb   (fields, selectedMats, selectedLabs, detailRows, estRates, vatMode, step 전체)
//    created_at  timestamptz default now()
//    updated_at  timestamptz default now()
// ============================================================

/* ══════════════════════════════════════════════════════
   Supabase 설정
══════════════════════════════════════════════════════ */
const EST_SB_URL  = 'https://isrimiwqqytzzqjovtot.supabase.co';
const EST_SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcmltaXdxcXl0enpxam92dG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjg5NDEsImV4cCI6MjA5MjAwNDk0MX0.DescofNz1_U0eCp1CY0Nstxd3OzB_xlRMCv0IBiZAGA';
const EST_SB_TABLE = 'estimates';
const EST_SAVE_KEY = 'iq_estimates';   // localStorage 키 (폴백용)

/* Supabase fetch 헤더 */
function _estSbHeaders() {
    return {
        'Content-Type'  : 'application/json',
        'apikey'        : EST_SB_KEY,
        'Authorization' : 'Bearer ' + EST_SB_KEY,
        'Prefer'        : 'return=representation'
    };
}

/* ══════════════════════════════════════════════════════
   Supabase CRUD 헬퍼
══════════════════════════════════════════════════════ */

/** 전체 목록 조회 (최신순) */
async function _sbFetchAll() {
    const res = await fetch(
        `${EST_SB_URL}/rest/v1/${EST_SB_TABLE}?order=saved_at.desc&limit=200`,
        { headers: _estSbHeaders() }
    );
    if (!res.ok) throw new Error('Supabase fetch 오류: ' + res.status);
    const rows = await res.json();
    // DB row → 앱 record 변환
    return rows.map(_rowToRecord);
}

/** 단건 upsert (insert or update) */
async function _sbUpsert(record) {
    const row = _recordToRow(record);
    const res = await fetch(
        `${EST_SB_URL}/rest/v1/${EST_SB_TABLE}`,
        {
            method  : 'POST',
            headers : { ..._estSbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
            body    : JSON.stringify(row)
        }
    );
    if (!res.ok) {
        const errText = await res.text();
        throw new Error('Supabase upsert 오류: ' + res.status + ' ' + errText);
    }
    return record;
}

/** 단건 삭제 */
async function _sbDelete(id) {
    const res = await fetch(
        `${EST_SB_URL}/rest/v1/${EST_SB_TABLE}?id=eq.${encodeURIComponent(id)}`,
        { method: 'DELETE', headers: _estSbHeaders() }
    );
    if (!res.ok) throw new Error('Supabase delete 오류: ' + res.status);
}

/* ── DB row ↔ 앱 record 변환 ─────────────────────── */
function _recordToRow(r) {
    return {
        id            : r.id,
        title         : r.title         || '',
        client_name   : r.clientName    || '',
        site_name     : r.siteName      || '',
        saved_at      : r.savedAt       || Date.now(),
        contracted    : !!r.contracted,
        contracted_at : r.contractedAt  || null,
        cost_snapshot : r.costSnapshot  || null,
        data          : {
            fields      : r.fields       || {},
            selectedMats: r.selectedMats || {},
            selectedLabs: r.selectedLabs || {},
            detailRows  : r.detailRows   || [],
            estRates    : r.estRates     || {},
            vatMode     : r.vatMode      || 'include',
            step        : r.step         || 1
        }
    };
}
function _rowToRecord(row) {
    const d = row.data || {};
    return {
        id           : row.id,
        title        : row.title         || '',
        clientName   : row.client_name   || '',
        siteName     : row.site_name     || '',
        savedAt      : row.saved_at      || 0,
        contracted   : !!row.contracted,
        contractedAt : row.contracted_at || null,
        costSnapshot : row.cost_snapshot || null,
        fields       : d.fields          || {},
        selectedMats : d.selectedMats    || {},
        selectedLabs : d.selectedLabs    || {},
        detailRows   : d.detailRows      || [],
        estRates     : d.estRates        || {},
        vatMode      : d.vatMode         || 'include',
        step         : d.step            || 1
    };
}

/* ══════════════════════════════════════════════════════
   동기화 상태 표시 헬퍼
══════════════════════════════════════════════════════ */
function _setSyncStatus(status) {
    // status: 'syncing' | 'ok' | 'offline' | 'error'
    const el = document.getElementById('sync-status-badge');
    if (!el) return;
    const map = {
        syncing : { text: '☁ 동기화 중…', cls: 'sync-syncing' },
        ok      : { text: '☁ 동기화 완료', cls: 'sync-ok'      },
        offline : { text: '⚡ 오프라인 (로컬저장)', cls: 'sync-offline' },
        error   : { text: '⚠ 동기화 실패 (로컬저장)', cls: 'sync-error' }
    };
    const m = map[status] || map.offline;
    el.textContent = m.text;
    el.className   = 'sync-status-badge ' + m.cls;
    el.style.display = 'inline-flex';
    if (status === 'ok') {
        setTimeout(() => { if (el.classList.contains('sync-ok')) el.style.display = 'none'; }, 3000);
    }
}

/* ══════════════════════════════════════════════════════
   localStorage 래퍼 (폴백)
══════════════════════════════════════════════════════ */
function _lsLoad() {
    try { return JSON.parse(localStorage.getItem(EST_SAVE_KEY) || '[]'); }
    catch { return []; }
}
function _lsSave(list) {
    try { localStorage.setItem(EST_SAVE_KEY, JSON.stringify(list)); }
    catch(e) { console.warn('localStorage 저장 실패:', e); }
}

/* ══════════════════════════════════════════════════════
   공개 API: 목록 로드 (Supabase → localStorage fallback)
══════════════════════════════════════════════════════ */

/** 비동기 로드: Supabase에서 가져와 localStorage 캐시 갱신 */
async function loadEstimatesFromCloud() {
    try {
        _setSyncStatus('syncing');
        const list = await _sbFetchAll();
        _lsSave(list);   // 로컬 캐시 갱신
        _setSyncStatus('ok');
        return list;
    } catch (e) {
        console.warn('[estimate-save] Supabase 로드 실패, localStorage 사용:', e.message);
        _setSyncStatus('offline');
        return _lsLoad();
    }
}

/** 동기 로드: localStorage 캐시 반환 (즉시 렌더용) */
function loadEstimates() {
    return _lsLoad();
}

/** 동기 저장 (localStorage만) — 내부 호환용 */
function saveEstimates(list) {
    _lsSave(list);
}

/* ══════════════════════════════════════════════════════
   유틸
══════════════════════════════════════════════════════ */
function genEstId() {
    return 'est_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

/* ── 현재 견적 상태 수집 ──────────────────────────────── */
function collectCurrentState() {
    const fieldIds = [
        'clientName','siteName','siteAddress',
        'areaPyeong','areaSqm','constDays','constDaysActual',
        'constStartDate','constEndDate',
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

/** 새 레코드 생성 (localStorage 즉시 + Supabase 비동기) */
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

    // ① localStorage 즉시 저장
    const list = _lsLoad();
    list.unshift(record);
    _lsSave(list);

    // ② Supabase 비동기 upsert
    _setSyncStatus('syncing');
    _sbUpsert(record)
        .then(() => _setSyncStatus('ok'))
        .catch(e => { console.warn('[estimate-save] 클라우드 저장 실패:', e.message); _setSyncStatus('error'); });

    return record;
}

/** 기존 레코드 덮어쓰기 (localStorage 즉시 + Supabase 비동기) */
function updateEstimate(id, titleOverride) {
    const state    = collectCurrentState();
    const list     = _lsLoad();
    const idx      = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    const existing = list[idx];
    const updated  = {
        ...existing,
        ...state,
        title        : titleOverride || existing.title,
        clientName   : state.fields.clientName || existing.clientName,
        siteName     : state.fields.siteName   || existing.siteName,
        savedAt      : Date.now(),
        contracted   : existing.contracted,
        contractedAt : existing.contractedAt,
        costSnapshot : existing.costSnapshot
    };
    list[idx] = updated;
    _lsSave(list);

    // Supabase 비동기 upsert
    _setSyncStatus('syncing');
    _sbUpsert(updated)
        .then(() => _setSyncStatus('ok'))
        .catch(e => { console.warn('[estimate-save] 클라우드 저장 실패:', e.message); _setSyncStatus('error'); });

    return updated;
}

/* ══════════════════════════════════════════════════════
   저장 버튼 핸들러 (스마트 저장)
══════════════════════════════════════════════════════ */
function smartSave() {
    if (!_currentEstimateId) {
        openSaveDialog(false);
    } else {
        const record = updateEstimate(_currentEstimateId);
        if (record) {
            showToast(`💾 "${record.title}" 저장되었습니다.`);
            updateCurrentEstBadge();
            if (typeof renderEstimateList === 'function') renderEstimateList();
        }
    }
}

function saveAsNew() { openSaveDialog(true); }

/* ══════════════════════════════════════════════════════
   계약 완료 토글
══════════════════════════════════════════════════════ */
function toggleContract() {
    if (!_currentEstimateId) {
        showToast('⚠️ 먼저 견적서를 저장해 주세요.');
        openSaveDialog(false);
        return;
    }
    const list = _lsLoad();
    const idx  = list.findIndex(r => r.id === _currentEstimateId);
    if (idx === -1) return;

    const cur = list[idx];
    const newContracted = !cur.contracted;
    let updated;

    if (newContracted) {
        if (!confirm(`"${cur.title}"\n\n이 견적서를 계약 완료로 표시하시겠습니까?\n계약 시점의 금액 정보가 함께 저장됩니다.`)) return;
        const snap = typeof costResult !== 'undefined' ? JSON.parse(JSON.stringify(costResult)) : {};
        updated = { ...cur, contracted: true, contractedAt: Date.now(), costSnapshot: snap };
        showToast('🎉 계약 완료로 표시되었습니다!');
    } else {
        if (!confirm(`"${cur.title}"\n\n계약 완료 표시를 해제하시겠습니까?`)) return;
        updated = { ...cur, contracted: false, contractedAt: null };
        showToast('계약 완료 표시가 해제되었습니다.');
    }
    list[idx] = updated;
    _lsSave(list);

    // Supabase 동기화
    _setSyncStatus('syncing');
    _sbUpsert(updated)
        .then(() => _setSyncStatus('ok'))
        .catch(e => { console.warn('[estimate-save] 클라우드 동기화 실패:', e.message); _setSyncStatus('error'); });

    updateCurrentEstBadge();
    if (typeof renderEstimateList === 'function') renderEstimateList();
}

/* ══════════════════════════════════════════════════════
   저장 다이얼로그
══════════════════════════════════════════════════════ */
function openSaveDialog(isNew = false) {
    const modal = document.getElementById('save-dialog-modal');
    if (!modal) return;
    const titleInput = document.getElementById('save-title-input');
    if (titleInput) {
        titleInput.value = buildAutoTitle();
        setTimeout(() => { titleInput.focus(); titleInput.select(); }, 100);
    }
    modal.dataset.saveMode = isNew ? 'new' : 'first';
    modal.classList.add('open');
}
function closeSaveDialog() {
    const modal = document.getElementById('save-dialog-modal');
    if (modal) modal.classList.remove('open');
}
function confirmSave() {
    const modal      = document.getElementById('save-dialog-modal');
    const titleInput = document.getElementById('save-title-input');
    const title      = (titleInput ? titleInput.value.trim() : '') || buildAutoTitle() || '새 견적서';
    const saveMode   = modal ? modal.dataset.saveMode : 'first';

    const record = createEstimate(title);
    setCurrentEstimateId(record.id);
    showToast(saveMode === 'new'
        ? `✅ "${record.title}" 새 버전으로 저장되었습니다.`
        : `✅ "${record.title}" 저장 완료`);
    closeSaveDialog();
    updateCurrentEstBadge();
    if (typeof renderEstimateList === 'function') renderEstimateList();
}

/* ══════════════════════════════════════════════════════
   견적 목록 모달
══════════════════════════════════════════════════════ */
function openEstimateList() {
    const modal = document.getElementById('estimate-list-modal');
    if (!modal) return;
    modal.classList.add('open');

    // ① 로컬 캐시로 즉시 렌더
    renderEstimateList();

    // ② 클라우드 최신 데이터로 갱신
    loadEstimatesFromCloud().then(list => {
        renderEstimateList();   // 최신 데이터로 재렌더
    });
}
function closeEstimateList() {
    const modal = document.getElementById('estimate-list-modal');
    if (modal) modal.classList.remove('open');
}

function renderEstimateList() {
    const container = document.getElementById('estimate-list-body');
    if (!container) return;
    const list = loadEstimates();   // 로컬 캐시 사용 (빠른 렌더)

    const count = document.getElementById('est-list-count');
    if (count) count.textContent = `전체 ${list.length}건`;

    const contractCount = list.filter(r => r.contracted).length;
    const contractBadge = document.getElementById('est-list-contract-count');
    if (contractBadge) contractBadge.textContent = `계약완료 ${contractCount}건`;

    if (list.length === 0) {
        container.innerHTML = `
          <div style="text-align:center;padding:48px 20px;color:#aaa">
            <i class="fas fa-cloud" style="font-size:42px;margin-bottom:14px;display:block;color:#d0d8e4"></i>
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
            <span class="est-cloud-badge" title="클라우드 동기화됨">☁</span>
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

/* ══════════════════════════════════════════════════════
   불러오기
══════════════════════════════════════════════════════ */
function loadEstimateById(id) {
    // 로컬 캐시에서 먼저 검색
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

/* ══════════════════════════════════════════════════════
   삭제
══════════════════════════════════════════════════════ */
function deleteEstimate(id) {
    const list = _lsLoad().filter(r => r.id !== id);
    _lsSave(list);
}
function deleteEstimateUI(id) {
    const list   = _lsLoad();
    const record = list.find(r => r.id === id);
    if (!record) return;
    if (!confirm(`"${record.title}" 견적서를 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;

    // localStorage 즉시 삭제
    deleteEstimate(id);
    if (id === _currentEstimateId) {
        _currentEstimateId = null;
        updateCurrentEstBadge();
    }
    renderEstimateList();
    showToast('견적서가 삭제되었습니다.');

    // Supabase 비동기 삭제
    _sbDelete(id)
        .then(() => _setSyncStatus('ok'))
        .catch(e => { console.warn('[estimate-save] 클라우드 삭제 실패:', e.message); _setSyncStatus('error'); });
}

/* ══════════════════════════════════════════════════════
   JSON 내보내기 / 가져오기
══════════════════════════════════════════════════════ */
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

function importEstimateFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const record = JSON.parse(e.target.result);
                if (!record.id || !record.savedAt) { reject(new Error('유효하지 않은 견적 파일입니다.')); return; }
                const list = _lsLoad();
                if (list.some(r => r.id === record.id)) {
                    record.id    = genEstId();
                    record.title = '[가져오기] ' + (record.title || '');
                }
                list.unshift(record);
                _lsSave(list);
                // Supabase 업로드
                _sbUpsert(record).catch(e => console.warn('[import] 클라우드 업로드 실패:', e.message));
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
    const badge       = document.getElementById('current-est-badge');
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
   자동 임시저장 (localStorage 전용 — 클라우드 불필요)
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
