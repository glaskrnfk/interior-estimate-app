// ============================================================
//  app.js  v6.0  –  견적 시스템 메인 로직
//  - 동적 공정 카테고리 (storage.js getProcNames/getProcNum 사용)
//  - 세부내역: 카테고리 내 행 추가, 카테고리 간 행 이동
//  - 공정번호 직접 편집 가능
//  - 부가세 포함/제외 토글 + 표지 반영
//  - 로고 업로드 + 표지 반영
// ============================================================

/* ── 요율 정의 ──────────────────────────────────────── */
const RATE_DEFS = [
    { key:'간접노무비',         label:'간접노무비 (%)',          hint:'직접 노무비 기준', step:0.001 },
    { key:'산재보험',           label:'산재보험료 (%)',          hint:'직접 노무비 기준', step:0.001 },
    { key:'건강보험',           label:'건강보험료 (%)',          hint:'직접 노무비 기준', step:0.001 },
    { key:'연금보험',           label:'연금보험료 (%)',          hint:'직접 노무비 기준', step:0.001 },
    { key:'고용보험',           label:'고용보험료 (%)',          hint:'직접 노무비 기준', step:0.001 },
    { key:'산업안전보건관리비', label:'산업안전보건관리비 (%)', hint:'직접공사비 기준',  step:0.001 },
    { key:'일반관리비',         label:'일반관리비 (%)',          hint:'직접공사비 기준',  step:0.1   },
    { key:'기업이윤',           label:'기업이윤 (%)',            hint:'직접공사비 기준',  step:0.5   },
    { key:'부가세',             label:'부가가치세 (%)',          hint:'공급가액 기준',    step:0.1   }
];

/* ── 전역 상태 ──────────────────────────────────────── */
let currentStep  = 1;
let selectedMats = {};   // id → item 객체
let selectedLabs = {};   // id → item 객체
let detailRows   = [];   // 세부내역 행
let costResult   = {};   // 원가 계산 결과
let estRates     = {};   // 이 견적서에서 사용할 요율
let vatMode      = 'include'; // 'include' | 'exclude'

/* ── 초기화 ─────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
    estRates = { ...loadRates() };
    vatMode  = loadVatMode();
    buildRateForm();
    renderMatBlocks();
    renderLabBlocks();
    updateVatToggleUI();

    // 로고 미리보기 초기화
    const savedLogo = loadLogo();
    if (savedLogo) {
        const prev = document.getElementById('logo-preview');
        if (prev) { prev.src = savedLogo; prev.style.display = 'block'; }
    }

    // 미리보기 버튼
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            buildEstDoc();
            showPreviewModal();
        });
    }

    // 로고 업로드
    const logoInput = document.getElementById('logo-input');
    if (logoInput) {
        logoInput.addEventListener('change', handleLogoUpload);
    }

    // 도장 미리보기 초기화
    const savedStamp = loadStamp();
    if (savedStamp) {
        const stampPrev = document.getElementById('stamp-preview');
        const stampHint = document.getElementById('stamp-empty-hint');
        if (stampPrev) { stampPrev.src = savedStamp; stampPrev.style.display = 'block'; }
        if (stampHint) stampHint.style.display = 'none';
    }

    // 도장 업로드
    const stampInput = document.getElementById('stamp-input');
    if (stampInput) {
        stampInput.addEventListener('change', handleStampUpload);
    }

    // ── 시공사 정보 자동 반영 (어드민에서 저장된 값) ──
    const co = loadCompany();
    if (co && Object.keys(co).length > 0) {
        ['companyName','repName','companyTel','companyFax','companyAddr'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.value && co[id]) el.value = co[id];
        });
    }

    // 플로팅 네비게이션 초기화
    updateFloatingNav();

    // ── 자동 임시저장: 30초 간격 ──
    setInterval(() => {
        if (typeof autoSaveDraft === 'function') autoSaveDraft();
    }, 30000);

    // ── 임시 저장본 복원 제안 ──
    setTimeout(() => {
        if (typeof loadAutoSaveDraft !== 'function') return;
        const draft = loadAutoSaveDraft();
        if (!draft) return;
        const hasContent =
            (draft.fields && (draft.fields.clientName || draft.fields.siteName)) ||
            Object.keys(draft.selectedMats || {}).length > 0 ||
            (draft.detailRows || []).length > 0;
        if (!hasContent) return;

        const date = new Date(draft.savedAt);
        const dateStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
        const clientStr = (draft.fields && draft.fields.clientName) || '';
        const siteStr   = (draft.fields && draft.fields.siteName)   || '';
        const label = [clientStr, siteStr].filter(Boolean).join(' · ') || '작업 내용';

        if (confirm(`🔄 이전 자동저장 내용이 있습니다.\n\n"${label}" (${dateStr})\n\n복원하시겠습니까?\n(취소하면 해당 임시저장이 삭제됩니다.)`)) {
            if (typeof restoreState === 'function') {
                restoreState(draft);
                if (typeof renderMatBlocks  === 'function') renderMatBlocks();
                if (typeof renderLabBlocks  === 'function') renderLabBlocks();
                if (typeof updateSelCount   === 'function') updateSelCount();
                if (typeof syncRateForm     === 'function') syncRateForm();
                if (typeof updateVatToggleUI === 'function') updateVatToggleUI();
                if (typeof renderEditTable  === 'function') renderEditTable();
                if (typeof recalc           === 'function') recalc();
                const targetStep = Math.min(Math.max(draft.step || 1, 1), 5);
                goStep(targetStep);
                showToast('✅ 임시저장 내용을 복원했습니다.');
            }
        }
        clearAutoSave();
    }, 1200);
});

/* ══════════════════════════════════════════════════════
   스텝 이동
══════════════════════════════════════════════════════ */
function goStep(n) {
    if (n < 1 || n > 5) return;
    // Step2→3: detailRows가 비어있을 때만 새로 빌드 (기존 편집 내용 보존)
    if (currentStep === 2 && n === 3) {
        if (detailRows.length === 0) buildDetailRows();
    }
    if (n >= 4) recalc();
    if (n === 5) { recalc(); buildEstDoc(); }

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById('step' + n);
    if (sec) sec.classList.add('active');

    // 새 step-item 방식 + 기존 .step 방식 모두 지원
    document.querySelectorAll('.step-item, .step').forEach(el => {
        const sn = +el.dataset.step;
        el.classList.toggle('active',    sn === n);
        el.classList.toggle('completed', sn < n);
    });
    currentStep = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (n === 3) renderEditTable();
    if (n === 4) { syncRateForm(); recalc(); renderCostTable(); }
    if (n === 5) { renderScreenPreview(); }

    updateFloatingNav();
}

function updateFloatingNav() {
    const upBtn  = document.getElementById('fnav-up');
    const dnBtn  = document.getElementById('fnav-down');
    const label  = document.getElementById('fnav-label');
    if (!upBtn) return;
    upBtn.disabled = currentStep <= 1;
    dnBtn.disabled = currentStep >= 5;
    if (label) label.textContent = currentStep + '/5';
}

/* ══════════════════════════════════════════════════════
   STEP 2 – 자재/노무 선택
══════════════════════════════════════════════════════ */
function switchSelTab(type, btn) {
    document.querySelectorAll('.sel-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('sel-mat-panel').style.display = type === 'mat' ? '' : 'none';
    document.getElementById('sel-lab-panel').style.display = type === 'lab' ? '' : 'none';
}

function renderMatBlocks() {
    let mats = loadMaterials();

    // ── 공종 필터 옵션 동적 생성 ──
    const catSel = document.getElementById('mat-cat-filter2');
    if (catSel) {
        const curCat = catSel.value;
        const allCats = getAllProcNames();
        // 실제 자재가 있는 카테고리만 포함
        const matCats = [...new Set(mats.map(m => m.category).filter(Boolean))];
        const validCats = allCats.filter(c => matCats.includes(c));
        matCats.filter(c => !allCats.includes(c)).forEach(c => validCats.push(c));
        catSel.innerHTML = '<option value="">전체 공종</option>' +
            validCats.map(c => `<option value="${esc(c)}" ${c===curCat?'selected':''}>${getProcNum(c)} ${esc(c)}</option>`).join('');
        if (curCat && catSel.value !== curCat) catSel.value = '';
    }

    // ── 브랜드 필터 옵션 동적 생성 (공종 필터 적용 후) ──
    const catF2   = catSel ? catSel.value : '';
    let matsForBrand = catF2 ? mats.filter(m => m.category === catF2) : mats;

    const brandSel = document.getElementById('mat-brand-filter');
    if (brandSel) {
        const curBrand = brandSel.value;
        const brands   = [...new Set(matsForBrand.map(m => m.brand).filter(Boolean))].sort();
        brandSel.innerHTML = '<option value="">브랜드 전체</option>' +
            brands.map(b => `<option value="${b}" ${b===curBrand?'selected':''}>${b}</option>`).join('');
    }

    // ── 필터 적용 ──
    const brandF = brandSel ? brandSel.value : '';
    const gradeF = (document.getElementById('mat-grade-filter2') || {}).value || '';
    const sortF  = (document.getElementById('mat-sort-filter')   || {}).value || '';

    if (catF2)  mats = mats.filter(m => m.category === catF2);
    if (brandF) mats = mats.filter(m => m.brand === brandF);
    if (gradeF) mats = mats.filter(m => m.grade === gradeF);

    // ── 정렬 ──
    if (sortF === 'price_asc')  mats.sort((a,b) => a.price - b.price);
    if (sortF === 'price_desc') mats.sort((a,b) => b.price - a.price);
    if (sortF === 'brand')      mats.sort((a,b) => (a.brand||'').localeCompare(b.brand||''));

    const byProc = groupBy(mats, 'category');
    const wrap   = document.getElementById('mat-proc-blocks');
    const procNames = getAllProcNames();
    const cats   = [
        ...procNames.filter(p => byProc[p]),
        ...Object.keys(byProc).filter(k => !procNames.includes(k))
    ];
    // 공종 필터가 적용된 경우 해당 공종만 자동 펼침
    wrap.innerHTML = cats.map(p => procBlock(p, byProc[p], 'mat', !!catF2)).join('');
}

function clearMatFilters() {
    ['mat-cat-filter2','mat-brand-filter','mat-grade-filter2','mat-sort-filter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderMatBlocks();
}

function renderLabBlocks() {
    let labs   = loadLabors();

    // ── 공종 필터 옵션 동적 생성 ──
    const catSel = document.getElementById('lab-cat-filter2');
    if (catSel) {
        const curCat = catSel.value;
        const allCats = getAllProcNames();
        const labCats = [...new Set(labs.map(l => l.category).filter(Boolean))];
        const validCats = allCats.filter(c => labCats.includes(c));
        labCats.filter(c => !allCats.includes(c)).forEach(c => validCats.push(c));
        catSel.innerHTML = '<option value="">전체 공종</option>' +
            validCats.map(c => `<option value="${esc(c)}" ${c===curCat?'selected':''}>${getProcNum(c)} ${esc(c)}</option>`).join('');
        if (curCat && catSel.value !== curCat) catSel.value = '';
    }

    const catF2 = catSel ? catSel.value : '';
    if (catF2) labs = labs.filter(l => l.category === catF2);

    const byProc = groupBy(labs, 'category');
    const wrap   = document.getElementById('lab-proc-blocks');
    const procNames = getAllProcNames();
    const cats   = [
        ...procNames.filter(p => byProc[p]),
        ...Object.keys(byProc).filter(k => !procNames.includes(k))
    ];
    wrap.innerHTML = cats.map(p => procBlock(p, byProc[p], 'lab', !!catF2)).join('');
}

function procBlock(cat, items, type, forceOpen) {
    const num    = getProcNum(cat);
    const selMap = type === 'mat' ? selectedMats : selectedLabs;
    const selCnt = items.filter(i => selMap[i.id]).length;
    // 이미 선택된 항목이 있거나 강제 펼침 시 open
    const isOpen = forceOpen || selCnt > 0;

    const cards = items.map(item => {
        const isSel = !!selMap[item.id];
        const label = type === 'mat'
            ? `${item.brand || ''} ${item.spec || ''}`.trim()
            : item.spec || '';
        // 자재: 브랜드·규격 표시 / 노무: 산출기준 표시
        const typeLabel = type === 'mat'
            ? (item.grade ? `<span class="ic-grade ic-grade-${item.grade}">${item.grade}</span>` : '')
            : `<span class="ic-basis">${item.basis || ''}</span>`;
        return `
        <div class="item-card ${isSel ? 'selected' : ''}"
             onclick="toggle${type === 'mat' ? 'Mat' : 'Lab'}('${item.id}')">
          <div class="ic-chk"><i class="fas fa-check"></i></div>
          ${typeLabel}
          <div class="ic-name">${esc(item.name)}</div>
          <div class="ic-spec">${esc(label)}</div>
          <div>
            <span class="ic-price">${Number(item.price).toLocaleString()}</span>
            <span class="ic-unit">원/${item.unit}</span>
          </div>
        </div>`;
    }).join('');

    return `
    <div class="proc-block">
      <div class="proc-block-hdr ${isOpen ? 'open' : ''}" onclick="toggleBlock(this)">
        <div class="proc-icon">${num}</div>
        <span class="proc-name">${esc(cat)}</span>
        ${selCnt > 0 ? `<span class="sel-badge">${selCnt}개 선택</span>` : ''}
        <i class="fas fa-chevron-${isOpen ? 'up' : 'down'} toggle-arr"></i>
      </div>
      <div class="proc-items" ${isOpen ? '' : 'style="display:none"'}>
        <div class="item-grid">${cards}</div>
      </div>
    </div>`;
}

function toggleBlock(hdr) {
    hdr.classList.toggle('open');
    const items = hdr.nextElementSibling;
    if (items) items.style.display = hdr.classList.contains('open') ? '' : 'none';
    const arr = hdr.querySelector('.toggle-arr');
    if (arr) {
        arr.className = 'fas toggle-arr fa-chevron-' + (hdr.classList.contains('open') ? 'up' : 'down');
    }
}

function toggleMat(id) {
    const wasSelected = !!selectedMats[id];
    if (wasSelected) {
        delete selectedMats[id];
        // 세부내역에서 해당 자재 행 제거 (수동 추가된 빈 행은 유지)
        syncDetailRowFromMat(id, false);
    } else {
        const m = loadMaterials().find(x => x.id === id);
        if (m) {
            selectedMats[id] = m;
            // 세부내역에 행 추가
            syncDetailRowFromMat(id, true, m);
        }
    }
    const scrollY = window.scrollY;
    renderMatBlocks();
    window.scrollTo(0, scrollY);
    updateSelCount();
    // Step3가 열려 있으면 즉시 갱신
    if (currentStep === 3) renderEditTable();
}

function toggleLab(id) {
    const wasSelected = !!selectedLabs[id];
    if (wasSelected) {
        delete selectedLabs[id];
        syncDetailRowFromLab(id, false);
    } else {
        const l = loadLabors().find(x => x.id === id);
        if (l) {
            selectedLabs[id] = l;
            syncDetailRowFromLab(id, true, l);
        }
    }
    const scrollY = window.scrollY;
    renderLabBlocks();
    window.scrollTo(0, scrollY);
    updateSelCount();
    if (currentStep === 3) renderEditTable();
}

/* ── 자재 선택/해제 시 detailRows 동기화 ──────────── */
function syncDetailRowFromMat(matId, adding, item) {
    if (adding) {
        // 이미 동일 _matId 행이 있으면 중복 추가 안 함
        if (detailRows.some(r => r._matId === matId)) return;
        // 같은 카테고리의 노무 행 중 labPrice가 없는 행에 합치기 시도
        const labRow = detailRows.find(r =>
            r.category === item.category && r._type === 'lab' &&
            r.matPrice === 0 && r.unit === item.unit
        );
        if (labRow) {
            labRow.matPrice = item.price;
            labRow._matId   = matId;
            labRow._type    = 'both';
            return;
        }
        detailRows.push({
            id: genRowId(), category: item.category,
            name: item.name,
            brand: [item.brand, item.spec].filter(Boolean).join(' / '),
            unit: item.unit, qty: 1,
            matPrice: item.price, labPrice: 0,
            execMatPrice: 0, execLabPrice: 0,
            isLocked: false, isService: false,
            _matId: matId, _type: 'mat'
        });
        detailRows.sort((a, b) => getProcOrder(a.category) - getProcOrder(b.category));
    } else {
        // 해당 자재 matId를 가진 행 처리
        for (let i = detailRows.length - 1; i >= 0; i--) {
            const r = detailRows[i];
            if (r._matId !== matId) continue;
            if (r._type === 'both') {
                // 노무는 유지, 자재만 제거
                r.matPrice = 0;
                delete r._matId;
                r._type = 'lab';
            } else {
                // 자재 전용 행 삭제 (잠김 행은 유지하고 알림)
                if (r.isLocked) {
                    showToast('⚠️ 잠긴 행이 있어 자재 연결만 해제되었습니다.');
                    delete r._matId;
                } else {
                    detailRows.splice(i, 1);
                }
            }
        }
    }
}

/* ── 노무 선택/해제 시 detailRows 동기화 ──────────── */
function syncDetailRowFromLab(labId, adding, item) {
    if (adding) {
        if (detailRows.some(r => r._labId === labId)) return;
        // 같은 카테고리의 자재 행 중 labPrice가 없는 행에 합치기 시도
        const matRow = detailRows.find(r =>
            r.category === item.category && r._type === 'mat' &&
            r.labPrice === 0 && r.unit === item.unit
        );
        if (matRow) {
            matRow.labPrice = item.price;
            matRow._labId   = labId;
            matRow._type    = 'both';
            return;
        }
        detailRows.push({
            id: genRowId(), category: item.category,
            name: item.name,
            brand: item.spec || '-',
            unit: item.unit, qty: 1,
            matPrice: 0, labPrice: item.price,
            execMatPrice: 0, execLabPrice: 0,
            isLocked: false, isService: false,
            _labId: labId, _type: 'lab'
        });
        detailRows.sort((a, b) => getProcOrder(a.category) - getProcOrder(b.category));
    } else {
        for (let i = detailRows.length - 1; i >= 0; i--) {
            const r = detailRows[i];
            if (r._labId !== labId) continue;
            if (r._type === 'both') {
                r.labPrice = 0;
                delete r._labId;
                r._type = 'mat';
            } else {
                if (r.isLocked) {
                    showToast('⚠️ 잠긴 행이 있어 노무 연결만 해제되었습니다.');
                    delete r._labId;
                } else {
                    detailRows.splice(i, 1);
                }
            }
        }
    }
}
function updateSelCount() {
    document.getElementById('sel-mat-count').textContent = Object.keys(selectedMats).length;
    document.getElementById('sel-lab-count').textContent = Object.keys(selectedLabs).length;
}

/* ══════════════════════════════════════════════════════
   STEP 2→3 : 세부행 자동 생성
══════════════════════════════════════════════════════ */
function buildDetailRows() {
    detailRows = [];

    Object.values(selectedMats).forEach(m => {
        detailRows.push({
            id           : genRowId(),
            category     : m.category,
            name         : m.name,
            brand        : [m.brand, m.spec].filter(Boolean).join(' / '),
            unit         : m.unit,
            qty          : 1,
            matPrice     : m.price,
            labPrice     : 0,
            execMatPrice : 0,   // 실행단가 (관리자용)
            execLabPrice : 0,   // 실행단가 (관리자용)
            isLocked     : false,  // 완료 잠금
            isService    : false,  // 서비스 항목 (붉은 글자)
            _matId       : m.id,
            _type        : 'mat'
        });
    });

    Object.values(selectedLabs).forEach(l => {
        const row = detailRows.find(r => r.category === l.category && r.labPrice === 0 && r._type === 'mat');
        if (row && row.unit === l.unit) {
            row.labPrice = l.price;
            row._labId   = l.id;
            row._type    = 'both';
        } else {
            detailRows.push({
                id           : genRowId(),
                category     : l.category,
                name         : l.name,
                brand        : l.spec || '-',
                unit         : l.unit,
                qty          : 1,
                matPrice     : 0,
                labPrice     : l.price,
                execMatPrice : 0,
                execLabPrice : 0,
                isLocked     : false,
                isService    : false,
                _labId       : l.id,
                _type        : 'lab'
            });
        }
    });

    // 공정 순서 정렬
    detailRows.sort((a, b) => getProcOrder(a.category) - getProcOrder(b.category));
}

/* ══════════════════════════════════════════════════════
   STEP 3 – 세부 내역 편집 테이블
   ▸ 각 공정 내 행 추가 버튼
   ▸ 행 이동 (위/아래, 카테고리 변경)
   ▸ 공정 번호 직접 편집 (cat-hdr에 num 입력)
══════════════════════════════════════════════════════ */
function renderEditTable() {
    const tbody = document.getElementById('edit-tbody');
    tbody.innerHTML = '';

    const groups     = {};
    const groupOrder = [];
    detailRows.forEach(r => {
        if (!groups[r.category]) { groups[r.category] = []; groupOrder.push(r.category); }
        groups[r.category].push(r);
    });

    // 중복 제거 후 공정 순서 정렬
    const procNames  = getProcNames();
    const uniqueCats = [...new Set(groupOrder)];
    const orderedCats = [
        ...procNames.filter(p => uniqueCats.includes(p)),
        ...uniqueCats.filter(k => !procNames.includes(k))
    ];

    let totalDirect  = 0;
    let totalMat     = 0;
    let totalLab     = 0;
    let totalExecMat = 0;   // 실행 자재 합계
    let totalExecLab = 0;   // 실행 노무 합계

    orderedCats.forEach(cat => {
        const rows = groups[cat];
        if (!rows || rows.length === 0) return;

        let procTotal    = 0;
        let procMatTotal = 0;
        let procLabTotal = 0;
        let procExecMat  = 0;   // 공종별 실행 자재 합계
        let procExecLab  = 0;   // 공종별 실행 노무 합계

        // 공종 헤더 행 (번호 직접 편집 가능)
        const hdr = document.createElement('tr');
        hdr.className = 'cat-hdr';
        hdr.dataset.cat = cat;
        const currentNum = getProcNum(cat);
        // colgroup에 맞는 colspan: 공종+품목명+브랜드+단위+수량+재료비+노무비+합계+실행단가(자)+실행단가(노)+상태+삭제 = 12
        hdr.innerHTML = `
          <td colspan="12">
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="text" value="${esc(currentNum)}"
                     title="공정 번호 (직접 수정 가능)"
                     style="width:42px;padding:2px 5px;font-size:12px;font-weight:700;border:1.5px solid #9ab;border-radius:4px;color:#1a3e72;background:#fff;"
                     onchange="updateProcNum('${esc(cat)}', this.value)"
                     onclick="event.stopPropagation()">
              <span style="font-weight:700;font-size:13px;color:#1a3e72;">${esc(cat)}</span>
              <button class="add-row-btn" onclick="addRowInCat('${esc(cat)}')" title="이 공정에 행 추가">
                <i class="fas fa-plus"></i> 행 추가
              </button>
            </div>
          </td>`;
        tbody.appendChild(hdr);

        rows.forEach(row => {
            const idx      = detailRows.indexOf(row);
            const rowMat   = (row.matPrice || 0) * (row.qty || 0);
            const rowLab   = (row.labPrice || 0) * (row.qty || 0);
            const rowTotal = rowMat + rowLab;
            procMatTotal += rowMat;
            procLabTotal += rowLab;
            procTotal    += rowTotal;
            totalMat     += rowMat;
            totalLab     += rowLab;
            totalDirect  += rowTotal;
            // 실행단가 합계 (수량 × 실행단가)
            const execMat = (row.execMatPrice || 0) * (row.qty || 0);
            const execLab = (row.execLabPrice || 0) * (row.qty || 0);
            procExecMat  += execMat;
            procExecLab  += execLab;
            totalExecMat += execMat;
            totalExecLab += execLab;

            const tr = document.createElement('tr');
            tr.dataset.rowId = row.id;

            // 잠금 상태 스타일
            const isLocked  = !!row.isLocked;
            const isService = !!row.isService;
            if (isLocked)  tr.classList.add('row-locked');
            if (isService) tr.classList.add('row-service');

            // 자재/노무 구분 뱃지 (이름 선택 시에도 반영)
            const typeVal = row._type || (row._matId ? 'mat' : row._labId ? 'lab' : 'mat');
            const typeBadge = typeVal === 'lab'
                ? `<span class="type-badge-lab">노무</span>`
                : typeVal === 'both'
                    ? `<span class="type-badge-mat" style="background:#7c3aed">혼합</span>`
                    : `<span class="type-badge-mat">자재</span>`;

            // 카테고리 이동 옵션 생성
            const catOptions = getCatMoveOptions(cat);

            // 같은 공종 내 순서 이동 드롭다운
            const catIdxs = [];
            detailRows.forEach((r, i) => { if (r.category === cat) catIdxs.push(i); });
            const localIdx = catIdxs.indexOf(idx);
            const orderOpts = catIdxs.map((_, li) =>
                `<option value="${li}" ${li === localIdx ? 'selected' : ''}>${li + 1}번</option>`
            ).join('');

            // 단위 목록
            const unitList = (typeof loadUnits === 'function') ? loadUnits() : ['㎡','m','개','식','품','장','롤','box','평','단','포','세트','조'];
            const unitBtns = unitList.map(u =>
                `<span class="unit-opt" onclick="setUnit(${idx},'${u}')">${u}</span>`
            ).join('');

            // 품목명 팝업 (클릭 시 브랜드/규격/금액 자동 반영)
            const allMats = loadMaterials().filter(m => m.category === cat);
            const allLabs = loadLabors().filter(l => l.category === cat);
            const nameBtns = [
                ...allMats.map(m => `<div class="name-opt" data-type="mat"
                    onclick="setNameFull(${idx},'${esc(m.name)}','${esc([m.brand,m.spec].filter(Boolean).join(' / '))}',${m.price},0,'mat','${m.id}','')"
                    ><span class="name-opt-badge mat">자재</span>${esc(m.name)}<span class="name-opt-price">${Number(m.price).toLocaleString()}원</span></div>`),
                ...allLabs.map(l => `<div class="name-opt" data-type="lab"
                    onclick="setNameFull(${idx},'${esc(l.name)}','${esc(l.spec||'-')}',0,${l.price},'lab','','${l.id}')"
                    ><span class="name-opt-badge lab">노무</span>${esc(l.name)}<span class="name-opt-price">${Number(l.price).toLocaleString()}원</span></div>`)
            ].join('');

            const lockIcon  = isLocked  ? 'fa-lock'   : 'fa-lock-open';
            const lockTitle = isLocked  ? '잠금 해제' : '완료 잠금';
            const lockStyle = isLocked  ? 'color:#b91c1c' : 'color:#9ca3af';
            const svcStyle  = isService ? 'color:#dc2626;font-weight:700' : 'color:#d1d5db';

            const disAttr   = isLocked ? 'disabled style="pointer-events:none;opacity:.55"' : '';

            tr.innerHTML = `
              <td>
                ${typeBadge}
                <select onchange="moveRowToCategory(${idx}, this.value)"
                        style="width:72px;font-size:11px;padding:3px 4px;border:1px solid #ccd6e0;border-radius:4px;margin-top:3px" ${disAttr}>
                  ${catOptions}
                </select>
              </td>
              <td>
                <div class="name-btn-wrap">
                  <input type="text" value="${esc(row.name)}"
                         onchange="upRow(${idx},'name',this.value)"
                         onfocus="openNamePopup(${idx})"
                         id="name-inp-${idx}"
                         style="width:100%" ${disAttr}>
                  <div class="name-popup" id="name-pop-${idx}">
                    ${nameBtns || '<div style="padding:8px 14px;color:#aaa;font-size:12px">항목 없음</div>'}
                  </div>
                </div>
              </td>
              <td><input type="text" value="${esc(row.brand)}"
                   onchange="upRow(${idx},'brand',this.value)" ${disAttr}></td>
              <td>
                <div class="unit-btn-wrap">
                  <input type="text" value="${esc(row.unit)}" id="unit-inp-${idx}"
                         class="unit-input-small"
                         onchange="upRow(${idx},'unit',this.value)"
                         onclick="toggleUnitPopup(${idx})" readonly ${disAttr}>
                  <div class="unit-popup" id="unit-pop-${idx}">${unitBtns}</div>
                </div>
              </td>
              <td><input type="number" value="${row.qty}"
                   onchange="upRow(${idx},'qty',+this.value)" min="0" step="1" style="width:56px" ${disAttr}></td>
              <td><input type="number" value="${row.matPrice}"
                   onchange="upRow(${idx},'matPrice',+this.value)" min="0" step="100" style="width:88px" ${disAttr}></td>
              <td><input type="number" value="${row.labPrice}"
                   onchange="upRow(${idx},'labPrice',+this.value)" min="0" step="100" style="width:88px" ${disAttr}></td>
              <td style="text-align:right;font-weight:600;white-space:nowrap">${won(rowTotal)}</td>
              <td class="exec-col">
                <input type="number" value="${row.execMatPrice||0}"
                   onchange="upRow(${idx},'execMatPrice',+this.value)" min="0" step="100"
                   style="width:82px;background:#fffbeb;border-color:#fcd34d" title="실행 자재단가(관리용)">
              </td>
              <td class="exec-col">
                <input type="number" value="${row.execLabPrice||0}"
                   onchange="upRow(${idx},'execLabPrice',+this.value)" min="0" step="100"
                   style="width:82px;background:#fffbeb;border-color:#fcd34d" title="실행 노무단가(관리용)">
              </td>
              <td style="text-align:center;white-space:nowrap;min-width:64px">
                <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
                  <button class="icon-btn" title="${lockTitle}"
                          onclick="upRow(${idx},'isLocked',${!isLocked})"
                          style="${lockStyle};background:none;border:none;cursor:pointer;font-size:13px;padding:2px 5px">
                    <i class="fas ${lockIcon}"></i>
                  </button>
                  <button class="icon-btn" title="서비스 항목"
                          onclick="upRow(${idx},'isService',${!isService})"
                          style="${svcStyle};background:none;border:none;cursor:pointer;font-size:13px;padding:2px 5px">
                    <i class="fas fa-gift"></i>
                  </button>
                </div>
              </td>
              <td style="text-align:center;white-space:nowrap;min-width:90px">
                <select onchange="moveRowByOrder(${idx},this.value)"
                        style="font-size:11px;padding:2px 3px;border:1px solid #ccd6e0;border-radius:4px;width:52px" title="순서 변경" ${disAttr}>
                  ${orderOpts}
                </select>
                <button class="del-btn" onclick="delRow(${idx})"><i class="fas fa-trash"></i></button>
              </td>`;
            tbody.appendChild(tr);
        });

        // 공종 소계 행 (자재비 / 노무비 / 합계 + 실행단가 합계)
        const stTr = document.createElement('tr');
        stTr.className = 'sub-tr';
        const execTotal = procExecMat + procExecLab;
        const execDiff  = execTotal - procTotal; // 견적 대비 실행 차이
        const diffStyle = execDiff > 0 ? 'color:#dc2626' : execDiff < 0 ? 'color:#059669' : 'color:#888';
        stTr.innerHTML = `
          <td colspan="5" style="text-align:right;padding-right:10px;font-size:11.5px">
            <strong>${getProcNum(cat)} ${esc(cat)}</strong> 소계
          </td>
          <td style="text-align:right;white-space:nowrap;font-size:11px;color:#1a3e72">${won(procMatTotal)}</td>
          <td style="text-align:right;white-space:nowrap;font-size:11px;color:#059669">${won(procLabTotal)}</td>
          <td style="text-align:right;white-space:nowrap;font-weight:700">${won(procTotal)}</td>
          <td class="exec-col" style="text-align:right;white-space:nowrap;font-size:11px;color:#92400e;font-weight:600">${won(procExecMat)}</td>
          <td class="exec-col" style="text-align:right;white-space:nowrap;font-size:11px;color:#92400e;font-weight:600">${won(procExecLab)}</td>
          <td colspan="2" style="text-align:right;white-space:nowrap;font-size:11px">
            <span style="color:#92400e;font-weight:700">${won(execTotal)}</span>
            ${execTotal > 0 ? `<br><span style="font-size:10px;${diffStyle}">${execDiff >= 0 ? '+' : ''}${won(execDiff)}</span>` : ''}
          </td>`;
        tbody.appendChild(stTr);
    });

    // 전체 합계 업데이트
    document.getElementById('edit-total-cell').textContent = won(totalDirect);
    const matCell = document.getElementById('edit-mat-cell');
    const labCell = document.getElementById('edit-lab-cell');
    if (matCell) matCell.textContent = won(totalMat);
    if (labCell) labCell.textContent = won(totalLab);
    // 실행 합계
    const execMatCell  = document.getElementById('edit-exec-mat-cell');
    const execLabCell  = document.getElementById('edit-exec-lab-cell');
    const execTotCell  = document.getElementById('edit-exec-total-cell');
    const execDiffCell = document.getElementById('edit-exec-diff-cell');
    const totExec = totalExecMat + totalExecLab;
    const totDiff = totExec - totalDirect;
    if (execMatCell)  execMatCell.textContent  = won(totalExecMat);
    if (execLabCell)  execLabCell.textContent  = won(totalExecLab);
    if (execTotCell)  execTotCell.textContent  = won(totExec);
    if (execDiffCell) {
        execDiffCell.textContent  = (totDiff >= 0 ? '+' : '') + won(totDiff);
        execDiffCell.style.color  = totDiff > 0 ? '#dc2626' : totDiff < 0 ? '#059669' : '#888';
    }
}

/* ── 단위 팝업 ──────────────────────────────────── */
function toggleUnitPopup(idx) {
    document.querySelectorAll('.unit-popup.open').forEach(p => {
        if (p.id !== 'unit-pop-' + idx) p.classList.remove('open');
    });
    const pop = document.getElementById('unit-pop-' + idx);
    if (pop) pop.classList.toggle('open');
}
function setUnit(idx, unit) {
    upRow(idx, 'unit', unit);
    document.querySelectorAll('.unit-popup').forEach(p => p.classList.remove('open'));
}

/* ── 품목명 팝업 ────────────────────────────────── */
function openNamePopup(idx) {
    document.querySelectorAll('.name-popup.open').forEach(p => {
        if (p.id !== 'name-pop-' + idx) p.classList.remove('open');
    });
    const pop = document.getElementById('name-pop-' + idx);
    if (pop && pop.children.length > 0) pop.classList.add('open');
}
function setName(idx, name) {
    if (!detailRows[idx]) return;
    detailRows[idx].name = name;
    const inp = document.getElementById('name-inp-' + idx);
    if (inp) inp.value = name;
    document.querySelectorAll('.name-popup').forEach(p => p.classList.remove('open'));
    renderEditTable();
}

/* 품목명 선택 + 브랜드/규격/금액 자동 반영 */
function setNameFull(idx, name, brand, matPrice, labPrice, type, matId, labId) {
    if (!detailRows[idx]) return;
    if (detailRows[idx].isLocked) {
        showToast('⛔ 잠긴 항목입니다. 잠금을 해제하세요.');
        return;
    }
    detailRows[idx].name     = name;
    detailRows[idx].brand    = brand;
    if (matPrice > 0) detailRows[idx].matPrice = matPrice;
    if (labPrice > 0) detailRows[idx].labPrice = labPrice;
    if (type === 'mat') {
        detailRows[idx]._type  = 'mat';
        detailRows[idx]._matId = matId;
    } else if (type === 'lab') {
        detailRows[idx]._type  = 'lab';
        detailRows[idx]._labId = labId;
    }
    document.querySelectorAll('.name-popup').forEach(p => p.classList.remove('open'));
    renderEditTable();
}

// 팝업 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
    if (!e.target.closest('.unit-btn-wrap') && !e.target.closest('.name-btn-wrap')) {
        document.querySelectorAll('.unit-popup.open,.name-popup.open')
                .forEach(p => p.classList.remove('open'));
    }
});

/* 카테고리 이동 셀렉트 옵션 생성 */
function getCatMoveOptions(currentCat) {
    const allCats = getAllCategories();
    return allCats.map(c =>
        `<option value="${esc(c)}" ${c === currentCat ? 'selected' : ''}>${getProcNum(c)} ${esc(c)}</option>`
    ).join('');
}

/* 현재 detailRows + 공정 목록의 합집합 카테고리 */
function getAllCategories() {
    const procNames = getProcNames();
    const rowCats   = [...new Set(detailRows.map(r => r.category))];
    return [
        ...procNames.filter(p => rowCats.includes(p)),
        ...rowCats.filter(k => !procNames.includes(k))
    ];
}

/* 공정 번호 업데이트 */
function updateProcNum(catName, newNum) {
    const procs = loadProcesses();
    const proc  = procs.find(p => p.name === catName);
    if (proc) {
        proc.num = newNum.trim() || proc.num;
        saveProcesses(procs);
        renderEditTable();
    }
}

/* 카테고리 내 행 추가 */
function addRowInCat(cat) {
    // 해당 카테고리의 마지막 행 다음에 삽입
    let lastIdx = -1;
    detailRows.forEach((r, i) => { if (r.category === cat) lastIdx = i; });
    const newRow = {
        id: genRowId(), category: cat, name: '새 항목',
        brand: '-', unit: '식', qty: 1, matPrice: 0, labPrice: 0,
        execMatPrice: 0, execLabPrice: 0,
        isLocked: false, isService: false, _type: 'mat'
    };
    if (lastIdx >= 0) {
        detailRows.splice(lastIdx + 1, 0, newRow);
    } else {
        detailRows.push(newRow);
    }
    renderEditTable();
}

/* 행 카테고리 이동 */
function moveRowToCategory(idx, newCat) {
    if (!detailRows[idx]) return;
    const oldCat = detailRows[idx].category;
    if (oldCat === newCat) return;
    detailRows[idx].category = newCat;
    // 해당 카테고리 마지막으로 이동
    const row = detailRows.splice(idx, 1)[0];
    let lastIdx = detailRows.findLastIndex ? detailRows.findLastIndex(r => r.category === newCat) : -1;
    if (lastIdx < 0) {
        // 공정 순서대로 삽입
        const procNames = getProcNames();
        const newOrder  = procNames.indexOf(newCat);
        let insertAt    = detailRows.length;
        for (let i = detailRows.length - 1; i >= 0; i--) {
            const o = procNames.indexOf(detailRows[i].category);
            if (o <= newOrder) { insertAt = i + 1; break; }
        }
        detailRows.splice(insertAt, 0, row);
    } else {
        detailRows.splice(lastIdx + 1, 0, row);
    }
    renderEditTable();
    showToast(`항목을 "${newCat}"(으)로 이동했습니다.`);
}

/* 행 위로 이동 (내부 유지, 호환성) */
function moveRowUp(idx) {
    if (idx <= 0) return;
    [detailRows[idx - 1], detailRows[idx]] = [detailRows[idx], detailRows[idx - 1]];
    renderEditTable();
}

/* 행 아래로 이동 (내부 유지, 호환성) */
function moveRowDown(idx) {
    if (idx >= detailRows.length - 1) return;
    [detailRows[idx], detailRows[idx + 1]] = [detailRows[idx + 1], detailRows[idx]];
    renderEditTable();
}

/* 행 순서 이동 - 드롭다운 방식 (같은 공종 내 특정 위치로) */
function moveRowByOrder(idx, newPosStr) {
    const newPos = parseInt(newPosStr, 10);
    if (isNaN(newPos)) return;
    const row = detailRows[idx];
    const cat = row.category;
    const catIdxs = [];
    detailRows.forEach((r, i) => { if (r.category === cat) catIdxs.push(i); });
    const localIdx = catIdxs.indexOf(idx);
    if (localIdx === -1 || localIdx === newPos) return;
    detailRows.splice(idx, 1);
    const newCatIdxs = [];
    detailRows.forEach((r, i) => { if (r.category === cat) newCatIdxs.push(i); });
    const targetLocal = Math.max(0, Math.min(newPos, newCatIdxs.length));
    if (targetLocal >= newCatIdxs.length) {
        const last = newCatIdxs.length > 0 ? newCatIdxs[newCatIdxs.length - 1] + 1 : detailRows.length;
        detailRows.splice(last, 0, row);
    } else {
        detailRows.splice(newCatIdxs[targetLocal], 0, row);
    }
    renderEditTable();
}

function upRow(idx, field, val) {
    if (!detailRows[idx]) return;
    if (detailRows[idx].isLocked && field !== 'isLocked' && field !== 'isService') {
        showToast('⛔ 잠긴 항목입니다. 잠금을 해제하세요.');
        renderEditTable();
        return;
    }
    detailRows[idx][field] = val;
    renderEditTable();
}
function delRow(idx) {
    if (detailRows[idx] && detailRows[idx].isLocked) {
        showToast('⛔ 잠긴 항목은 삭제할 수 없습니다.');
        return;
    }
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    detailRows.splice(idx, 1);
    renderEditTable();
}
function addBlankRow() {
    const cats = getAllCategories();
    const cat  = cats.length > 0 ? cats[cats.length - 1] : '기타';
    detailRows.push({
        id: genRowId(), category: cat, name: '새 항목',
        brand: '-', unit: '식', qty: 1, matPrice: 0, labPrice: 0,
        execMatPrice: 0, execLabPrice: 0,
        isLocked: false, isService: false, _type: 'mat'
    });
    renderEditTable();
}

/* ══════════════════════════════════════════════════════
   STEP 4 – VAT 토글 + 비용 계산
══════════════════════════════════════════════════════ */
function setVatMode(mode) {
    vatMode = mode;
    saveVatMode(mode);
    updateVatToggleUI();
    recalc();
    renderCostTable();
}

function updateVatToggleUI() {
    const btnInc = document.getElementById('vat-btn-include');
    const btnExc = document.getElementById('vat-btn-exclude');
    if (btnInc) btnInc.classList.toggle('active', vatMode === 'include');
    if (btnExc) btnExc.classList.toggle('active', vatMode === 'exclude');
    // 부가세 행 표시/숨김
    const vatRow = document.getElementById('cost-vat-row');
    if (vatRow) vatRow.style.display = vatMode === 'include' ? '' : 'none';
}

function buildRateForm() {
    document.getElementById('rate-form-4').innerHTML = RATE_DEFS.map(d => `
      <div class="rg">
        <label>${d.label}</label>
        <input type="number" id="rf-${d.key}" value="${estRates[d.key] ?? 0}"
               step="${d.step}"
               onchange="estRates['${d.key}']=+this.value;recalc();renderCostTable()">
        <div class="rg-hint">${d.hint}</div>
      </div>`).join('');
}

function syncRateForm() {
    RATE_DEFS.forEach(d => {
        const el = document.getElementById('rf-' + d.key);
        if (el) el.value = estRates[d.key] ?? 0;
    });
}

function recalc() {
    let matTotal = 0, labTotal = 0;
    let execMatTotal = 0, execLabTotal = 0;
    detailRows.forEach(r => {
        matTotal     += (r.matPrice     || 0) * (r.qty || 0);
        labTotal     += (r.labPrice     || 0) * (r.qty || 0);
        execMatTotal += (r.execMatPrice || 0) * (r.qty || 0);
        execLabTotal += (r.execLabPrice || 0) * (r.qty || 0);
    });
    const direct = matTotal + labTotal;
    const R  = estRates;
    const il = labTotal * (R['간접노무비']         || 0) / 100;
    const i1 = labTotal * (R['산재보험']            || 0) / 100;
    const i2 = labTotal * (R['건강보험']            || 0) / 100;
    const i3 = labTotal * (R['연금보험']            || 0) / 100;
    const i4 = labTotal * (R['고용보험']            || 0) / 100;
    const sf = direct   * (R['산업안전보건관리비']  || 0) / 100;
    const ad = direct   * (R['일반관리비']          || 0) / 100;
    const pr = direct   * (R['기업이윤']            || 0) / 100;
    const sup = direct + il + i1 + i2 + i3 + i4 + sf + ad + pr;
    const vt  = vatMode === 'include' ? sup * (R['부가세'] || 0) / 100 : 0;
    const fin = Math.floor((sup + vt) / 10000) * 10000;

    // ── 실행 원가 계산 ────────────────────────────────
    // ※ 기업이윤은 "견적에서 받는 이윤"이므로 실행원가(지출)에 포함하지 않음
    // ※ 실행원가 = 실행직접공사비 + 간접노무비 + 보험류 + 안전관리비 + 일반관리비
    //              (기업이윤은 실행원가 계산에서 제외)
    const execDirect = execMatTotal + execLabTotal;
    const exec_il = execLabTotal * (R['간접노무비']         || 0) / 100;
    const exec_i1 = execLabTotal * (R['산재보험']            || 0) / 100;
    const exec_i2 = execLabTotal * (R['건강보험']            || 0) / 100;
    const exec_i3 = execLabTotal * (R['연금보험']            || 0) / 100;
    const exec_i4 = execLabTotal * (R['고용보험']            || 0) / 100;
    const exec_sf = execDirect   * (R['산업안전보건관리비']  || 0) / 100;
    const exec_ad = execDirect   * (R['일반관리비']          || 0) / 100;
    // exec_pr: 기업이윤은 실행 지출에 포함하지 않음 (표시용으로만 0 처리)
    const exec_pr = 0;
    const exec_sup = execDirect + exec_il + exec_i1 + exec_i2 + exec_i3 + exec_i4 + exec_sf + exec_ad;
    const exec_vt  = vatMode === 'include' ? exec_sup * (R['부가세'] || 0) / 100 : 0;
    const exec_fin = Math.floor((exec_sup + exec_vt) / 10000) * 10000;

    // ── 실제 예상 순수익 계산 ─────────────────────────
    // 순수익 = 견적 기업이윤 + (견적 직접공사비 - 실행 직접공사비)
    // = 고객에게 받은 이윤 + 직접공사비 절감분
    const profitFromRate   = pr;                    // 견적 기업이윤 (요율로 책정된 이윤)
    const savingFromExec   = direct - execDirect;   // 직접공사비 절감액 (견적 - 실행)
    const margin    = profitFromRate + savingFromExec;
    const marginPct = exec_fin > 0 ? ((margin / exec_fin) * 100).toFixed(1) : '—';

    costResult = {
        matTotal, labTotal, direct, il, i1, i2, i3, i4, sf, ad, pr, sup, vt, fin,
        execMatTotal, execLabTotal, execDirect,
        exec_il, exec_i1, exec_i2, exec_i3, exec_i4, exec_sf, exec_ad, exec_pr,
        exec_sup, exec_vt, exec_fin,
        profitFromRate, savingFromExec,
        margin, marginPct
    };
}

function renderCostTable() {
    const C = costResult, R = estRates;
    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    s('c-mat',    won(C.matTotal));  s('c-lab',  won(C.labTotal));
    s('c-direct', won(C.direct));
    s('c-il',     won(C.il));        s('c-i1',   won(C.i1));
    s('c-i2',     won(C.i2));        s('c-i3',   won(C.i3));
    s('c-i4',     won(C.i4));        s('c-sf',   won(C.sf));
    s('c-ad',     won(C.ad));        s('c-pr',   won(C.pr));
    s('c-sup',    won(C.sup));       s('c-vt',   won(C.vt));
    s('c-fin',    won(C.fin));

    // ── 실행 원가 계산서 렌더링 ──────────────────────
    const ec = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    ec('ec-mat',    won(C.execMatTotal));
    ec('ec-lab',    won(C.execLabTotal));
    ec('ec-direct', won(C.execDirect));
    ec('ec-il',     won(C.exec_il));    ec('ec-i1', won(C.exec_i1));
    ec('ec-i2',     won(C.exec_i2));    ec('ec-i3', won(C.exec_i3));
    ec('ec-i4',     won(C.exec_i4));    ec('ec-sf', won(C.exec_sf));
    ec('ec-ad',     won(C.exec_ad));
    // 기업이윤 셀: 실행원가에서 제외됨을 명시
    const ecPrEl = document.getElementById('ec-pr');
    if (ecPrEl) {
        ecPrEl.textContent = '—';
        ecPrEl.title = '기업이윤은 실행 지출에 포함되지 않습니다';
        ecPrEl.style.color = '#9ca3af';
    }
    ec('ec-sup',    won(C.exec_sup));   ec('ec-vt', won(C.exec_vt));
    ec('ec-fin',    won(C.exec_fin));

    // ── 예상 순수익 상세 표시 ─────────────────────────
    const marginEl = document.getElementById('ec-margin');
    if (marginEl) {
        const positive = (C.margin || 0) >= 0;
        const color = positive ? '#059669' : '#dc2626';
        const pctStr = C.marginPct !== '—' ? ` (수익률 ${C.marginPct}%)` : '';
        // 수익 구성 상세 (기업이윤 + 직접공사비 절감액)
        const profitPart  = (C.profitFromRate  || 0);
        const savingPart  = (C.savingFromExec  || 0);
        const profitSign  = profitPart  >= 0 ? '+' : '';
        const savingSign  = savingPart  >= 0 ? '+' : '';
        const execEntered = (C.execMatTotal || 0) + (C.execLabTotal || 0) > 0;

        marginEl.innerHTML = `
          <div style="font-size:15px;font-weight:800;color:${color}">
            ${positive ? '+' : ''}${won(C.margin || 0)}${pctStr}
          </div>
          ${execEntered ? `
          <div style="font-size:10.5px;color:#6b7280;margin-top:5px;line-height:1.7;border-top:1px dashed #d1d5db;padding-top:5px">
            <span style="color:#1a3e72">견적 기업이윤</span> ${profitSign}${won(profitPart)}<br>
            <span style="color:#374151">직접공사비 절감</span> ${savingSign}${won(savingPart)}<br>
            <span style="font-size:9.5px;color:#9ca3af">= 기업이윤 + (견적직접 − 실행직접)</span>
          </div>` : `<div style="font-size:10.5px;color:#9ca3af;margin-top:4px">실행단가 입력 후 계산됩니다</div>`}
        `;
        marginEl.style.color = '';   // innerHTML 방식이므로 style.color 초기화
    }

    // 최종금액 레이블
    const finLbl = document.getElementById('c-fin-label');
    if (finLbl) {
        finLbl.textContent = vatMode === 'include'
            ? '최 종 견 적 금 액 (VAT 포함 · 만원 단위 절사)'
            : '최 종 견 적 금 액 (VAT 제외 · 만원 단위 절사)';
    }

    updateVatToggleUI();

    const lbl = (id, base, key) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${base} (${R[key] ?? 0}%)`;
    };
    lbl('lbl-il','간접노무비',          '간접노무비');
    lbl('lbl-i1','산재보험료',          '산재보험');
    lbl('lbl-i2','건강보험료',          '건강보험');
    lbl('lbl-i3','연금보험료',          '연금보험');
    lbl('lbl-i4','고용보험료',          '고용보험');
    lbl('lbl-sf','산업안전보건관리비',  '산업안전보건관리비');
    lbl('lbl-ad','일반관리비',          '일반관리비');
    lbl('lbl-pr','기업이윤',            '기업이윤');
    lbl('lbl-vt','부가가치세',          '부가세');

    // ── 공종별 견적 vs 실행 비교표 렌더링 ──────────────
    renderExecProcTable();
}

/* ══════════════════════════════════════════════════════
   공종별 견적 · 실행 비교표 렌더링 (Step4 전용)
══════════════════════════════════════════════════════ */
function renderExecProcTable() {
    const tbody = document.getElementById('exec-proc-tbody');
    const tfoot = document.getElementById('exec-proc-tfoot');
    if (!tbody) return;

    // 공정 순서대로 그룹핑
    const groups = {};
    const groupOrder = [];
    detailRows.forEach(r => {
        const cat = r.category || '기타';
        if (!groups[cat]) { groups[cat] = []; groupOrder.push(cat); }
        groups[cat].push(r);
    });
    const procNames = getProcNames();
    const uniqueCats = [...new Set(groupOrder)];
    const orderedCats = [
        ...procNames.filter(p => uniqueCats.includes(p)),
        ...uniqueCats.filter(k => !procNames.includes(k))
    ];

    if (orderedCats.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:#aaa;font-size:12px">세부내역에 실행단가를 입력하면 자동 계산됩니다.</td></tr>`;
        tfoot.innerHTML = '';
        return;
    }

    let totEstMat = 0, totEstLab = 0, totExecMat = 0, totExecLab = 0;

    const rows = orderedCats.map(cat => {
        const catRows = groups[cat];
        let estMat = 0, estLab = 0, execMat = 0, execLab = 0;
        catRows.forEach(r => {
            estMat  += (r.matPrice     || 0) * (r.qty || 0);
            estLab  += (r.labPrice     || 0) * (r.qty || 0);
            execMat += (r.execMatPrice || 0) * (r.qty || 0);
            execLab += (r.execLabPrice || 0) * (r.qty || 0);
        });
        const estTotal  = estMat  + estLab;
        const execTotal = execMat + execLab;
        const diff      = estTotal - execTotal;
        const marginPct = execTotal > 0 ? ((diff / execTotal) * 100).toFixed(1) : '—';
        const diffStyle = diff > 0 ? 'color:#059669;font-weight:700' : diff < 0 ? 'color:#dc2626;font-weight:700' : 'color:#888';
        const pctStyle  = diff > 0 ? 'color:#059669' : diff < 0 ? 'color:#dc2626' : 'color:#888';

        totEstMat  += estMat;  totEstLab  += estLab;
        totExecMat += execMat; totExecLab += execLab;

        const hasExec = execMat > 0 || execLab > 0;

        return `<tr style="border-bottom:1px solid #f0e6c8;${!hasExec ? 'opacity:.5' : ''}">
          <td style="padding:7px 12px;font-size:12px;font-weight:600;color:#1a3e72">${getProcNum(cat)} ${esc(cat)}</td>
          <td style="text-align:right;padding:7px 10px;font-size:11.5px;color:#1a3e72">${won(estMat)}</td>
          <td style="text-align:right;padding:7px 10px;font-size:11.5px;color:#059669">${won(estLab)}</td>
          <td style="text-align:right;padding:7px 10px;font-size:12px;font-weight:700;color:#1a3e72">${won(estTotal)}</td>
          <td style="text-align:right;padding:7px 10px;font-size:11.5px;color:#92400e;background:#fffbeb">${won(execMat)}</td>
          <td style="text-align:right;padding:7px 10px;font-size:11.5px;color:#92400e;background:#fffbeb">${won(execLab)}</td>
          <td style="text-align:right;padding:7px 10px;font-size:12px;font-weight:700;color:#92400e;background:#fffbeb">${won(execTotal)}</td>
          <td style="text-align:right;padding:7px 10px;font-size:12px;${diffStyle}">${hasExec ? (diff >= 0 ? '+' : '') + won(diff) : '—'}</td>
          <td style="text-align:right;padding:7px 10px;font-size:11.5px;${pctStyle}">${hasExec && marginPct !== '—' ? marginPct + '%' : '—'}</td>
        </tr>`;
    }).join('');

    tbody.innerHTML = rows;

    // tfoot 합계 행
    const totEst    = totEstMat  + totEstLab;
    const totExec   = totExecMat + totExecLab;
    const totDiff   = totEst - totExec;
    const totPct    = totExec > 0 ? ((totDiff / totExec) * 100).toFixed(1) : '—';
    const diffStyle = totDiff > 0 ? 'color:#059669' : totDiff < 0 ? 'color:#dc2626' : 'color:#888';
    const pctStyle  = totDiff > 0 ? 'color:#059669' : totDiff < 0 ? 'color:#dc2626' : 'color:#888';
    tfoot.innerHTML = `
      <tr style="background:#fef9c3;border-top:2px solid #fcd34d;font-weight:700">
        <td style="padding:9px 12px;font-size:12.5px;color:#92400e">합 계</td>
        <td style="text-align:right;padding:9px 10px;font-size:12px;color:#1a3e72">${won(totEstMat)}</td>
        <td style="text-align:right;padding:9px 10px;font-size:12px;color:#059669">${won(totEstLab)}</td>
        <td style="text-align:right;padding:9px 10px;font-size:13px;color:#1a3e72">${won(totEst)}</td>
        <td style="text-align:right;padding:9px 10px;font-size:12px;color:#92400e;background:#fef3c7">${won(totExecMat)}</td>
        <td style="text-align:right;padding:9px 10px;font-size:12px;color:#92400e;background:#fef3c7">${won(totExecLab)}</td>
        <td style="text-align:right;padding:9px 10px;font-size:13px;color:#92400e;background:#fef3c7">${won(totExec)}</td>
        <td style="text-align:right;padding:9px 10px;font-size:13px;${diffStyle}">${totExec > 0 ? (totDiff >= 0 ? '+' : '') + won(totDiff) : '—'}</td>
        <td style="text-align:right;padding:9px 10px;font-size:12px;${pctStyle}">${totExec > 0 && totPct !== '—' ? totPct + '%' : '—'}</td>
      </tr>`;
}

/* ══════════════════════════════════════════════════════
   로고 업로드
══════════════════════════════════════════════════════ */
function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 2) { showToast('로고 파일은 2MB 이하만 가능합니다.'); return; }
    const reader = new FileReader();
    reader.onload = function(ev) {
        const b64 = ev.target.result;
        saveLogo(b64);
        const prev = document.getElementById('logo-preview');
        if (prev) { prev.src = b64; prev.style.display = 'block'; }
        showToast('로고가 저장되었습니다.');
    };
    reader.readAsDataURL(file);
}

function removeLogo() {
    saveLogo('');
    const prev = document.getElementById('logo-preview');
    if (prev) { prev.src = ''; prev.style.display = 'none'; }
    const input = document.getElementById('logo-input');
    if (input) input.value = '';
    showToast('로고가 삭제되었습니다.');
}

/* ══════════════════════════════════════════════════════
   도장 업로드 / 삭제
══════════════════════════════════════════════════════ */
function handleStampUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 2) { showToast('도장 파일은 2MB 이하만 가능합니다.'); return; }
    const reader = new FileReader();
    reader.onload = function(ev) {
        const b64 = ev.target.result;
        saveStamp(b64);
        const prev = document.getElementById('stamp-preview');
        const hint = document.getElementById('stamp-empty-hint');
        if (prev) { prev.src = b64; prev.style.display = 'block'; }
        if (hint) hint.style.display = 'none';
        showToast('도장이 저장되었습니다.');
    };
    reader.readAsDataURL(file);
}

function removeStamp() {
    saveStamp('');
    const prev  = document.getElementById('stamp-preview');
    const hint  = document.getElementById('stamp-empty-hint');
    const input = document.getElementById('stamp-input');
    if (prev)  { prev.src = ''; prev.style.display = 'none'; }
    if (hint)  hint.style.display = 'flex';
    if (input) input.value = '';
    showToast('도장이 삭제되었습니다.');
}

/* ══════════════════════════════════════════════════════
   견적서 문서 DOM 빌드 (PDF/미리보기 공용)
══════════════════════════════════════════════════════ */
function buildEstDoc() {
    recalc();
    const C     = costResult;
    const R     = estRates;
    const today = new Date();
    const ymd   = `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일`;
    const ymdEn = `${today.getFullYear()} ${zp(today.getMonth()+1)} ${zp(today.getDate())}`;

    const logoSrc  = loadLogo();
    const stampSrc = loadStamp();
    const vatLabel = vatMode === 'include' ? '부가가치세 포함' : '부가가치세 별도';

    // 공정별 그룹핑
    const groups = {};
    detailRows.forEach(r => {
        const k = r.category || '기타';
        if (!groups[k]) groups[k] = [];
        groups[k].push(r);
    });
    const procNames  = getProcNames();
    const rowCats    = [...new Set(detailRows.map(r => r.category))];
    const orderedCats = [
        ...procNames.filter(p => groups[p]),
        ...rowCats.filter(k => !procNames.includes(k) && groups[k])
    ];

    // 현장 요약 시공내역 값
    const siteWorkSummaryEl = document.getElementById('siteWorkSummary');
    const siteWorkSummary   = siteWorkSummaryEl ? siteWorkSummaryEl.value.trim() : '';

    let html = '';

    /* ━━━ PAGE 1 : 표지 ━━━ */
    // 로고 우측 배치: 제목(좌) / 날짜+로고(우)
    const logoHtml = logoSrc
        ? `<img src="${logoSrc}" alt="로고" style="height:62px;object-fit:contain;max-width:200px;">`
        : '';
    // 현장 요약 시공내역 섹션 (입력된 경우에만 표시)
    const summaryHtml = siteWorkSummary
        ? `<div class="cov-summary-block">
             <div class="cov-summary-title">시 공 내 역 요 약</div>
             <div class="cov-summary-body">${siteWorkSummary.replace(/\n/g,'<br>')}</div>
           </div>`
        : '';

    html += `
    <div class="est-page" id="ep-cover">
      <div class="cov-topbar">
        <div>
          <div class="cov-title-main">견 &nbsp; 적 &nbsp; 서</div>
          <div class="cov-title-sub">INTERIOR &nbsp; ESTIMATE</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          ${logoHtml}
          <div class="cov-date-block">DATE &nbsp; <strong>${ymdEn}</strong></div>
        </div>
      </div>

      <div class="cov-info-block">
        <div class="cov-info-row">
          <div class="cov-info-label">발 주 처<span>TO</span></div>
          <div class="cov-info-value">${vt('clientName')}</div>
        </div>
        <div class="cov-info-row">
          <div class="cov-info-label">공 사 명<span>PROJECT</span></div>
          <div class="cov-info-value">${vt('siteName')}</div>
        </div>
        <div class="cov-info-row">
          <div class="cov-info-label">현장 주소</div>
          <div class="cov-info-value">${vt('siteAddress') || '-'}</div>
        </div>
        <div class="cov-info-row">
          <div class="cov-info-label">면 &nbsp;&nbsp;&nbsp;&nbsp; 적</div>
          <div class="cov-info-value">${vt('areaPyeong')}평 &nbsp;(공급면적 ${vt('areaSqm')} ㎡)</div>
        </div>
        <div class="cov-info-row">
          <div class="cov-info-label">공사 기간</div>
          <div class="cov-info-value">${vt('constDays')} 일</div>
        </div>
      </div>

      <div class="cov-amount-wrap">
        <div class="cov-amount-left">
          <div class="cov-amount-label">금 &nbsp;&nbsp; 액 &nbsp;&nbsp; / &nbsp;&nbsp; AMOUNT</div>
          <div class="cov-amount-krw">일금 &nbsp;<strong>${krwText(C.fin)}</strong>&nbsp; 원정</div>
          <div class="cov-amount-num">₩ &nbsp;${C.fin.toLocaleString()}</div>
          <div class="cov-amount-note">( ${vatLabel} &nbsp;/&nbsp; 만원 단위 절사 )</div>
        </div>
        <div class="cov-stamp-area">
          ${stampSrc
            ? `<img src="${stampSrc}" alt="도장" class="cov-stamp-img">`
            : `<div class="cov-stamp-box">印</div>`}
          <div style="margin-top:6px">대표 &nbsp;${vt('repName') || ''}</div>
        </div>
      </div>

      ${summaryHtml}

      <div class="cov-remark">
        <strong>비 고 / REMARK</strong><br>
        · 본 견적서의 유효기간은 발행일로부터 30일입니다.<br>
        · 내역 외 추가·변경 공사비는 별도 협의 산정됩니다.<br>
        · 상기 금액은 첨부 세부내역서를 기준으로 산출하였습니다.
      </div>

      <div class="cov-company">
        <div>
          <div class="cov-company-name">${vt('companyName') || '(주) 인테리어 전문'}</div>
          <div class="cov-company-detail">
            주소 : ${vt('companyAddr') || '-'}<br>
            TEL : ${vt('companyTel') || '-'} &nbsp;&nbsp; FAX : ${vt('companyFax') || '-'}
          </div>
        </div>
        <div style="font-size:12px;color:#888;text-align:right;padding-top:4px">발행일 : ${ymd}</div>
      </div>
    </div>`;

    /* ━━━ PAGE 2 : 공사원가계산서 ━━━ */
    const pcr = (label, val, formula, cls='') => `
      <tr class="${cls}">
        <td>${label}</td>
        <td class="formula">${formula}</td>
        <td class="num">${val !== null ? won(val) : ''}</td>
      </tr>`;

    html += `
    <div class="est-page" id="ep-cost">
      <div class="page-title">공 사 원 가 계 산 서</div>
      <table class="cost-calc-table">
        <thead><tr>
          <th style="width:38%">비 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 목</th>
          <th style="width:34%">산 &nbsp;&nbsp; 출 &nbsp;&nbsp; 근 &nbsp;&nbsp; 거</th>
          <th style="width:28%">금 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 액</th>
        </tr></thead>
        <tbody>
          ${pcr('재 료 비', null, '', 'lv1')}
          ${pcr('└ 직접 재료비', C.matTotal, '', 'lv2')}
          ${pcr('재료비 소계', C.matTotal, '', 'subtotal')}
          ${pcr('노 무 비', null, '', 'lv1')}
          ${pcr('└ 직접 노무비', C.labTotal, '', 'lv2')}
          ${pcr('└ 간접 노무비', C.il, `직접노무비 × ${R['간접노무비']}%`, 'lv2')}
          ${pcr('노무비 소계', C.labTotal + C.il, '', 'subtotal')}
          ${pcr('경 &nbsp;&nbsp; 비', null, '', 'lv1')}
          ${pcr('└ 산재보험료',         C.i1, `직접노무비 × ${R['산재보험']}%`,           'lv2')}
          ${pcr('└ 건강보험료',         C.i2, `직접노무비 × ${R['건강보험']}%`,           'lv2')}
          ${pcr('└ 연금보험료',         C.i3, `직접노무비 × ${R['연금보험']}%`,           'lv2')}
          ${pcr('└ 고용보험료',         C.i4, `직접노무비 × ${R['고용보험']}%`,           'lv2')}
          ${pcr('└ 산업안전보건관리비', C.sf, `직접공사비 × ${R['산업안전보건관리비']}%`, 'lv2')}
          ${pcr('순 공사 원가', C.direct + C.il + C.i1 + C.i2 + C.i3 + C.i4 + C.sf, '', 'subtotal')}
          ${pcr('└ 일반관리비', C.ad, `원가계 × ${R['일반관리비']}%`, 'lv2')}
          ${pcr('└ 기업이윤',   C.pr, `원가계 × ${R['기업이윤']}%`,   'lv2')}
          ${pcr('공 급 가 액', C.sup, '', 'subtotal')}
          ${vatMode === 'include' ? pcr('└ 부가가치세', C.vt, `공급가액 × ${R['부가세']}%`, 'lv2') : ''}
          <tr class="total-row">
            <td colspan="2">최 종 견 적 금 액 &nbsp;(${vatLabel} · 만원 단위 절사)</td>
            <td class="num">${won(C.fin)}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top:20px;padding:12px 16px;background:#f4f7fb;border-radius:6px;font-size:12px;color:#555;line-height:1.7;border-left:3px solid #1a3e72">
        <strong>※ 산출 기준</strong><br>
        · 재료비 : ${won(C.matTotal)} &nbsp;|&nbsp; 직접 노무비 : ${won(C.labTotal)} &nbsp;|&nbsp; 직접공사비 합계 : ${won(C.direct)}<br>
        · 공급가액 : ${won(C.sup)} ${vatMode === 'include' ? `&nbsp;|&nbsp; 부가가치세(${R['부가세']}%) : ${won(C.vt)}` : '(부가세 제외)'}
      </div>
    </div>`;

    /* ━━━ PAGE 3+ : 세부 내역서 ━━━
       전략 (v7.0 행 단위 정밀 분할):
       1. 모든 섹션을 DOM에 실제로 렌더링한 뒤 각 행/요소의 offsetTop+offsetHeight로 측정
       2. A4 내부 가용 영역(상하 패딩 제외)을 기준으로 행 단위로 페이지 분할
       3. 공정 헤더는 반드시 첫 번째 데이터 행과 같이 이동 (고아 헤더 방지)
       4. 소계 행도 마지막 데이터 행과 같은 페이지에 배치
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    let grandTotal = 0;

    // ── .est-page 의 실제 내부 폭 (padding 48px×2 제외) ──
    const PAGE_INNER_W = 794 - 48 - 48;  // 698px
    // A4 실제 가용 높이: padding-top 38px + padding-bottom 26px 제외
    const PAGE_INNER_H = 1123 - 38 - 26 - 4;  // ≒ 1055px (안전 여백 4px)
    // 페이지 타이틀 높이
    const TITLE_H      = 58;
    // 직접공사비 합계 행 높이
    const FOOTER_H     = 46;
    // 공정 헤더가 홀로 남지 않도록 추가 예약 높이 (thead + 1행 최소)
    const HEADER_MIN   = 80;

    // ── 테이블 thead HTML ─────────────────────────────
    const detailThead = `<thead><tr>
      <th style="min-width:110px">품목명</th>
      <th style="min-width:120px">브랜드/규격</th>
      <th style="width:40px">단위</th>
      <th style="width:46px">수량</th>
      <th style="width:96px">재료비(단가)</th>
      <th style="width:96px">노무비(단가)</th>
      <th style="width:90px">합 계</th>
    </tr></thead>`;

    // ── 공정별 섹션 데이터 구성 ───────────────────────
    let grandTotalMat = 0;
    let grandTotalLab = 0;
    const sections = orderedCats.map(cat => {
        const rows = groups[cat];
        if (!rows || rows.length === 0) return null;
        let catMatTotal = 0, catLabTotal = 0;
        rows.forEach(r => {
            catMatTotal += (r.matPrice || 0) * (r.qty || 0);
            catLabTotal += (r.labPrice || 0) * (r.qty || 0);
        });
        const catTotal = catMatTotal + catLabTotal;
        grandTotal     += catTotal;
        grandTotalMat  += catMatTotal;
        grandTotalLab  += catLabTotal;

        const dataRows = rows.map(r => {
            const rm = (r.matPrice || 0) * (r.qty || 0);
            const rl = (r.labPrice || 0) * (r.qty || 0);
            const rt = rm + rl;
            // 서비스 항목: 붉은 글자
            const svcStyle = r.isService ? 'style="color:#dc2626;font-weight:700"' : '';
            const svcMark  = r.isService ? ' <span style="color:#dc2626;font-size:9px;font-weight:700">SVC</span>' : '';
            return `<tr ${r.isService ? 'class="pdf-service-row"' : ''}>
              <td class="name-cell" ${svcStyle}>${esc(r.name)}${svcMark}</td>
              <td class="brand-cell" ${svcStyle}>${esc(r.brand || '-')}</td>
              <td class="c">${esc(r.unit)}</td>
              <td class="r">${r.qty}</td>
              <td class="r" ${svcStyle}>${r.matPrice ? won(r.matPrice) : '-'}</td>
              <td class="r" ${svcStyle}>${r.labPrice ? won(r.labPrice) : '-'}</td>
              <td class="r bold" ${svcStyle}>${won(rt)}</td>
            </tr>`;
        });

        // 공종 소계: 자재비 / 노무비 / 합계 3개 열
        const subtotalRow = `<tr class="subtotal-tr">
          <td colspan="4" style="text-align:right;font-weight:700;font-size:11px">
            ${getProcNum(cat)} ${esc(cat)} &nbsp;소 계
          </td>
          <td class="r" style="font-size:11px;color:#1a3e72">${won(catMatTotal)}</td>
          <td class="r" style="font-size:11px;color:#059669">${won(catLabTotal)}</td>
          <td class="r">${won(catTotal)}</td>
        </tr>`;

        return { cat, catTotal, catMatTotal, catLabTotal, dataRows, subtotalRow,
                 procHeader: `<div class="proc-header">
                   <span class="proc-num">${getProcNum(cat)}</span>
                   ${esc(cat)}
                   <span class="proc-total-badge">소계 ${won(catTotal)}</span>
                 </div>`,
                 thead: detailThead };
    }).filter(Boolean);

    // ── 높이 측정용 probe (실제 CSS 적용) ────────────
    const probe = document.createElement('div');
    probe.className = 'est-page';
    probe.style.cssText = `
        position:absolute; left:-9999px; top:0;
        width:794px; visibility:hidden; pointer-events:none;
        padding:40px 50px 36px; box-sizing:border-box;
        background:#fff; overflow:visible;
    `;
    document.body.appendChild(probe);

    const measureH = (htmlStr) => {
        probe.innerHTML = htmlStr;
        return probe.scrollHeight;
    };

    // ── 행 단위 페이지 분할 ───────────────────────────
    // 각 페이지는 { items: [{type, html}], isFirst } 구조
    // type: 'section-start'(헤더+thead 오픈), 'row', 'subtotal', 'section-end'(닫기 태그)
    //
    // 단순화: 각 공정 섹션 전체를 측정하고, A4에 맞으면 통째로, 안 맞으면 행 단위로 쪼개기

    const detailPages = [];
    let curPageParts  = [];  // { html: string } 배열
    let curPageH      = TITLE_H;
    let isFirstDetail = true;

    // 연속 페이지의 작은 타이틀 높이
    const CONT_TITLE_H = 42;

    const flushPage = () => {
        if (curPageParts.length > 0) {
            detailPages.push({ parts: [...curPageParts], isFirst: isFirstDetail });
            isFirstDetail = false;
        }
        curPageParts = [];
        // 새 페이지 시작 – 연속 타이틀 높이로 초기화
        curPageH = CONT_TITLE_H;
    };

    for (const sec of sections) {
        // 섹션 전체 HTML 생성 후 높이 측정
        const fullSecHtml = `
          ${sec.procHeader}
          <table class="detail-table">
            ${sec.thead}
            <tbody>${sec.dataRows.join('')}</tbody>
            <tfoot>${sec.subtotalRow}</tfoot>
          </table>`;

        const secH = measureH(fullSecHtml);
        const available = PAGE_INNER_H - curPageH - FOOTER_H;

        if (secH <= available || curPageParts.length === 0) {
            // ── 현재 페이지에 통째로 들어갈 수 있거나 첫 항목 ──
            curPageParts.push({ html: fullSecHtml });
            curPageH += secH + 8;
        } else if (secH <= PAGE_INNER_H - CONT_TITLE_H - FOOTER_H) {
            // ── 현재 페이지엔 안 맞지만, 새 페이지엔 통째로 들어감 ──
            flushPage();
            curPageParts.push({ html: fullSecHtml });
            curPageH += secH + 8;
        } else {
            // ── 섹션이 한 페이지보다 큰 경우: 행 단위 분할 ──
            // 헤더 + thead는 항상 같이 다님
            const headerHtml = `${sec.procHeader}<table class="detail-table">${sec.thead}<tbody>`;
            const headerH = measureH(headerHtml + '</tbody></table>');

            // 헤더가 현재 페이지에 안 맞으면 새 페이지로
            if (curPageH + headerH + FOOTER_H > PAGE_INNER_H && curPageParts.length > 0) {
                flushPage();
            }

            // 행 단위로 누적
            let openHtml   = headerHtml;
            let rowsOnPage = [];
            let rowPageH   = curPageH + headerH;
            const subtotalH = measureH(`<table class="detail-table"><tfoot>${sec.subtotalRow}</tfoot></table>`);

            for (let ri = 0; ri < sec.dataRows.length; ri++) {
                const rowH = measureH(`<table class="detail-table"><tbody>${sec.dataRows[ri]}</tbody></table>`);
                const isLastRow = ri === sec.dataRows.length - 1;
                // 마지막 행은 소계 행 높이도 함께 확보
                const extraH = isLastRow ? subtotalH : 0;

                if (rowPageH + rowH + extraH + FOOTER_H > PAGE_INNER_H && rowsOnPage.length > 0) {
                    // 현재 행 배치 전 페이지 마감 (소계 행 없이 닫기)
                    const closedHtml = openHtml + rowsOnPage.join('') + '</tbody></table>';
                    curPageParts.push({ html: closedHtml });
                    flushPage();
                    openHtml   = headerHtml;  // 새 페이지에도 헤더 반복
                    rowsOnPage = [];
                    rowPageH   = curPageH + headerH;  // flushPage 후 curPageH = CONT_TITLE_H
                }
                rowsOnPage.push(sec.dataRows[ri]);
                rowPageH += rowH;
            }

            // 남은 행 + 소계 행 닫기
            const closedHtml = openHtml + rowsOnPage.join('') +
                `</tbody><tfoot>${sec.subtotalRow}</tfoot></table>`;
            curPageParts.push({ html: closedHtml });
            curPageH = rowPageH + subtotalH + 8;
        }
    }
    // 남은 섹션 마지막 페이지에 추가
    if (curPageParts.length > 0) {
        detailPages.push({ parts: [...curPageParts], isFirst: isFirstDetail });
    }

    // probe 제거
    document.body.removeChild(probe);

    // ── 페이지별 HTML 생성 ────────────────────────────
    detailPages.forEach((pg, idx) => {
        const isLast    = idx === detailPages.length - 1;
        const titleHtml = pg.isFirst
            ? `<div class="page-title">세 부 내 역 서</div>`
            : `<div class="page-title" style="font-size:15px;letter-spacing:4px;margin-bottom:10px">세 부 내 역 서 (계속)</div>`;
        const footerHtml = isLast
            ? `<div class="grand-total-row">
                 <span>직접공사비 합계</span>
                 <span style="display:flex;gap:24px;align-items:center">
                   <span style="font-size:11px;opacity:.85">자재 ${won(grandTotalMat)}</span>
                   <span style="font-size:11px;opacity:.85">노무 ${won(grandTotalLab)}</span>
                   <span>${won(grandTotal)}</span>
                 </span>
               </div>`
            : '';
        const bodyHtml = pg.parts.map(p => p.html).join('');

        html += `<div class="est-page" id="ep-detail-${idx}">${titleHtml}${bodyHtml}${footerHtml}</div>`;
    });

    // 세부내역이 없는 경우 빈 페이지 한 장
    if (detailPages.length === 0) {
        html += `<div class="est-page" id="ep-detail-0">
          <div class="page-title">세 부 내 역 서</div>
          <p style="text-align:center;color:#aaa;padding:40px 0">세부 내역이 없습니다.</p>
          <div class="grand-total-row"><span>직접공사비 합계</span><span>${won(0)}</span></div>
        </div>`;
    }

    document.getElementById('estimate-doc').innerHTML = html;
}

/* ── 화면 미리보기 ──────────────────────────────── */
function renderScreenPreview() {
    buildEstDoc();
    const wrap  = document.getElementById('screen-preview-wrap');
    const clone = document.getElementById('estimate-doc').cloneNode(true);
    clone.style.cssText = 'transform:scale(0.7);transform-origin:top left;width:142.8%;pointer-events:none';
    wrap.innerHTML = '';
    const scaler = document.createElement('div');
    scaler.style.cssText = 'overflow:hidden;width:100%';
    scaler.appendChild(clone);
    wrap.appendChild(scaler);
}

function showPreviewModal() {
    buildEstDoc();
    const body  = document.getElementById('modal-preview-body');
    const clone = document.getElementById('estimate-doc').cloneNode(true);
    clone.style.cssText = 'transform:scale(0.62);transform-origin:top left;width:161.3%;pointer-events:none';
    const w = document.createElement('div');
    w.style.cssText = 'overflow:hidden;min-height:400px';
    w.appendChild(clone);
    body.innerHTML = '';
    body.appendChild(w);
    const modal = document.getElementById('previewModal');
    if (modal) {
        // 새 overlay 방식(.open) + 기존 방식(.active) 모두 지원
        modal.classList.add('open');
        modal.classList.add('active');
    }
}
function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    if (modal) {
        modal.classList.remove('open');
        modal.classList.remove('active');
    }
}

/* ── 인쇄 ────────────────────────────────────────── */
function doPrint() {
    buildEstDoc();
    const content = document.getElementById('estimate-doc').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="ko"><head>
      <meta charset="UTF-8">
      <link rel="stylesheet" href="css/estimate.css">
      <style>
        @page { size: A4 portrait; margin: 0; }
        body  { margin: 0; background: #fff; font-family: 'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo','NanumGothic','Noto Sans KR',sans-serif; }
        .est-page {
            width: 210mm !important;
            min-height: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 14mm 16mm 12mm !important;
            box-shadow: none !important;
            page-break-after: always;
            break-after: page;
            overflow: visible !important;
        }
        .est-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
        }
        .detail-table tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
        }
        .proc-header {
            break-after: avoid !important;
            page-break-after: avoid !important;
        }
      </style>
    </head><body>${content}</body></html>`);
    win.document.close();
    win.addEventListener('load', () => {
        setTimeout(() => { win.print(); }, 1000);
    });
}

/* ── 유틸 ───────────────────────────────────────── */
function v(id)   { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function vt(id)  { return esc(v(id)); }
function won(n)  { return Math.round(n || 0).toLocaleString('ko-KR') + ' 원'; }
function esc(s)  { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function zp(n)   { return String(n).padStart(2,'0'); }
function genRowId() { return 'r' + Date.now() + Math.random().toString(36).slice(2,5); }
function groupBy(arr, key) {
    return arr.reduce((acc, item) => {
        const k = item[key] || '기타';
        if (!acc[k]) acc[k] = [];
        acc[k].push(item);
        return acc;
    }, {});
}
function showToast(msg) {
    const t = document.getElementById('toast-msg');
    if (!t) return;
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.style.display = 'none'; }, 3500);
}

function krwText(n) {
    if (!n || n <= 0) return '영';
    const units     = ['','일','이','삼','사','오','육','칠','팔','구'];
    const scales    = ['','십','백','천'];
    const bigScales = ['','만','억','조'];
    let result = '';
    let num    = Math.floor(n);
    let bigIdx = 0;
    while (num > 0) {
        const chunk = num % 10000;
        if (chunk > 0) {
            let cs = '', tmp = chunk;
            for (let i = 3; i >= 0; i--) {
                const d = Math.floor(tmp / Math.pow(10, i));
                if (d > 0) cs += (d > 1 || i === 0 ? units[d] : '') + scales[i];
                tmp %= Math.pow(10, i);
            }
            result = cs + bigScales[bigIdx] + result;
        }
        num = Math.floor(num / 10000);
        bigIdx++;
    }
    return result;
}
