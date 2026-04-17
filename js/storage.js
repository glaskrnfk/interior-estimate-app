// ============================================================
//  storage.js  v6.0
//  - 공정 카테고리 동적 관리 (추가/수정/삭제/순서/번호)
//  - 마루/타일/설비/목공 대량 마스터 데이터
//  - 회사 로고 저장 지원
// ============================================================

const STORAGE_KEYS = {
    MATERIALS  : 'iq_materials',
    LABORS     : 'iq_labors',
    RATES      : 'iq_rates',
    PROCESSES  : 'iq_processes',   // 공정 카테고리 목록
    LOGO       : 'iq_logo',        // 회사 로고 base64
    STAMP      : 'iq_stamp',       // 대표 도장 이미지 base64
    VAT_MODE   : 'iq_vat_mode',    // 'include' | 'exclude'
    COMPANY    : 'iq_company',     // 시공사 정보
    UNITS      : 'iq_units'        // 단위 마스터
};

/* ═══════════════════════════════════════════════════════
   단위 마스터
═══════════════════════════════════════════════════════ */
function getDefaultUnits() {
    return ['㎡','m','개','식','품','장','롤','box','평','단','포','세트','조','kg','L','통'];
}
function loadUnits() {
    try {
        const s = localStorage.getItem(STORAGE_KEYS.UNITS);
        return s ? JSON.parse(s) : getDefaultUnits();
    } catch { return getDefaultUnits(); }
}
function saveUnits(list) {
    localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(list));
}

/* ═══════════════════════════════════════════════════════
   공정 카테고리 (동적 관리)
   각 항목: { id, num, name }
   num: 표시 번호 (자유 입력 가능, 예: "01", "1-1", "A")
═══════════════════════════════════════════════════════ */
function getDefaultProcesses() {
    return [
        { id:'proc_01', num:'01', name:'철거' },
        { id:'proc_02', num:'02', name:'샷시' },
        { id:'proc_03', num:'03', name:'목공' },
        { id:'proc_04', num:'04', name:'전기' },
        { id:'proc_05', num:'05', name:'설비' },
        { id:'proc_06', num:'06', name:'타일' },
        { id:'proc_07', num:'07', name:'도배' },
        { id:'proc_08', num:'08', name:'마루' },
        { id:'proc_09', num:'09', name:'필름' },
        { id:'proc_10', num:'10', name:'도장' },
        { id:'proc_11', num:'11', name:'조명' },
        { id:'proc_12', num:'12', name:'주방' },
        { id:'proc_13', num:'13', name:'욕실' },
        { id:'proc_14', num:'14', name:'가구' },
        { id:'proc_15', num:'15', name:'기타' }
    ];
}

function loadProcesses() {
    try {
        const s = localStorage.getItem(STORAGE_KEYS.PROCESSES);
        return s ? JSON.parse(s) : getDefaultProcesses();
    } catch(e) { return getDefaultProcesses(); }
}
function saveProcesses(list) {
    localStorage.setItem(STORAGE_KEYS.PROCESSES, JSON.stringify(list));
}
// 공정 이름 → 번호 조회 (표시용)
function getProcNum(name) {
    if (!name) return '-';
    if (name === '미분류') return '–';   // 미분류는 대시 표시
    const p = loadProcesses().find(x => x.name === name);
    return p ? p.num : name.slice(0,2);  // 공정 없으면 이름 앞 2글자
}
// 공정 순서 인덱스 (정렬용)
function getProcOrder(name) {
    if (name === '미분류') return 10000; // 미분류는 맨 뒤
    const list = loadProcesses();
    const i = list.findIndex(x => x.name === name);
    return i >= 0 ? i : 9999;
}
// 공정 이름 목록 (순서대로)
function getProcNames() {
    return loadProcesses().map(p => p.name);
}
// 공정 이름 목록 + 미분류 포함 (필터용)
function getAllProcNames() {
    const names = getProcNames();
    // 실제 자재·노무에 '미분류'가 있으면 포함
    const hasMisFun = (() => {
        try {
            const mats = JSON.parse(localStorage.getItem('iq_materials')||'[]');
            const labs = JSON.parse(localStorage.getItem('iq_labors')||'[]');
            return [...mats,...labs].some(x => x.category === '미분류');
        } catch { return false; }
    })();
    if (hasMisFun && !names.includes('미분류')) names.push('미분류');
    return names;
}

/* ═══════════════════════════════════════════════════════
   로고 / VAT 모드
═══════════════════════════════════════════════════════ */
function loadLogo()        { return localStorage.getItem(STORAGE_KEYS.LOGO)  || ''; }
function saveLogo(b64)     { localStorage.setItem(STORAGE_KEYS.LOGO,  b64); }
function loadStamp()       { return localStorage.getItem(STORAGE_KEYS.STAMP) || ''; }
function saveStamp(b64)    { localStorage.setItem(STORAGE_KEYS.STAMP, b64); }
function loadVatMode()     { return localStorage.getItem(STORAGE_KEYS.VAT_MODE) || 'include'; }
function saveVatMode(mode) { localStorage.setItem(STORAGE_KEYS.VAT_MODE, mode); }

/* ── 시공사 정보 ─────────────────────────────────── */
function loadCompany() {
    try {
        const s = localStorage.getItem(STORAGE_KEYS.COMPANY);
        return s ? JSON.parse(s) : {};
    } catch { return {}; }
}
function saveCompany(obj) {
    localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(obj));
}

/* ── 공정명 변경 시 자재·노무 category 일괄 rename ── */
function renameProcInItems(oldName, newName) {
    const mats = loadMaterials().map(m => {
        if (m.category === oldName) m.category = newName;
        return m;
    });
    saveMaterials(mats);
    const labs = loadLabors().map(l => {
        if (l.category === oldName) l.category = newName;
        return l;
    });
    saveLabors(labs);
}

/* ── 공정 삭제 시 해당 category → '미분류' 이관 ──── */
function orphanProcItems(procName) {
    const UNCAT = '미분류';
    const mats = loadMaterials().map(m => {
        if (m.category === procName) m.category = UNCAT;
        return m;
    });
    saveMaterials(mats);
    const labs = loadLabors().map(l => {
        if (l.category === procName) l.category = UNCAT;
        return l;
    });
    saveLabors(labs);
}

/* ═══════════════════════════════════════════════════════
   기본 자재 마스터
═══════════════════════════════════════════════════════ */
function getDefaultMaterials() {
    return [
        /* ──────── 철거 자재 ──────── */
        { id:'mat_ch_01', category:'철거', name:'현장/공용부 보양재', brand:'일반', spec:'PE폼+골판지 1식', unit:'식', price:70000, grade:'공통' },

        /* ──────── 샷시 ──────── */
        { id:'mat_sh01', category:'샷시', name:'이중창 샷시', brand:'LG하우시스', spec:'두께 44mm / 이중유리', unit:'㎡', price:220000, grade:'기본형' },
        { id:'mat_sh02', category:'샷시', name:'시스템창호', brand:'LG하우시스', spec:'삼중유리 / 고단열', unit:'㎡', price:380000, grade:'고급형' },
        { id:'mat_sh03', category:'샷시', name:'이중창 샷시', brand:'KCC', spec:'두께 44mm / 이중유리', unit:'㎡', price:200000, grade:'기본형' },

        /* ──────── 목공 단열재 ──────── */
        { id:'mat_ins01', category:'목공', name:'아이소핑크 단열재 20mm', brand:'국산', spec:'1220×2440×20mm', unit:'장', price:12000, grade:'공통' },
        { id:'mat_ins02', category:'목공', name:'아이소핑크 단열재 30mm', brand:'국산', spec:'1220×2440×30mm', unit:'장', price:16000, grade:'공통' },
        { id:'mat_ins03', category:'목공', name:'아이소핑크 단열재 50mm', brand:'국산', spec:'1220×2440×50mm', unit:'장', price:22000, grade:'공통' },
        { id:'mat_ins04', category:'목공', name:'글라스울 보온재 24K', brand:'KCC', spec:'50mm×600×1200mm', unit:'롤', price:18000, grade:'공통' },
        { id:'mat_ins05', category:'목공', name:'글라스울 보온재 32K', brand:'KCC', spec:'50mm×600×1200mm', unit:'롤', price:22000, grade:'공통' },
        { id:'mat_ins06', category:'목공', name:'온도리 열반사 단열재 5mm', brand:'국산', spec:'1.2m×10m 롤', unit:'롤', price:35000, grade:'공통' },
        { id:'mat_ins07', category:'목공', name:'온도리 열반사 단열재 8mm', brand:'국산', spec:'1.2m×10m 롤', unit:'롤', price:45000, grade:'공통' },

        /* ──────── 목공 각재 ──────── */
        { id:'mat_w_d01', category:'목공', name:'다루끼 각재 30×40mm', brand:'국산', spec:'30×40×3600mm 한단', unit:'단', price:8000, grade:'공통' },
        { id:'mat_w_d02', category:'목공', name:'다루끼 각재 40×50mm', brand:'국산', spec:'40×50×3600mm 한단', unit:'단', price:11000, grade:'공통' },
        { id:'mat_w_d03', category:'목공', name:'투바이 각재 2×4', brand:'국산', spec:'38×89×3600mm 한단', unit:'단', price:14000, grade:'공통' },
        { id:'mat_w_d04', category:'목공', name:'투바이 각재 2×6', brand:'국산', spec:'38×140×3600mm 한단', unit:'단', price:18000, grade:'공통' },

        /* ──────── 목공 석고보드 ──────── */
        { id:'mat_w_g01', category:'목공', name:'일반 석고보드 9.5T', brand:'KCC/국산', spec:'900×1800×9.5mm', unit:'장', price:4500, grade:'공통' },
        { id:'mat_w_g02', category:'목공', name:'일반 석고보드 12.5T', brand:'KCC/국산', spec:'900×1800×12.5mm', unit:'장', price:5500, grade:'공통' },
        { id:'mat_w_g03', category:'목공', name:'방수 석고보드 9.5T', brand:'KCC/국산', spec:'900×1800×9.5mm (녹색)', unit:'장', price:6500, grade:'공통' },
        { id:'mat_w_g04', category:'목공', name:'방수 석고보드 12.5T', brand:'KCC/국산', spec:'900×1800×12.5mm (녹색)', unit:'장', price:7500, grade:'공통' },
        { id:'mat_w_g05', category:'목공', name:'방화 석고보드 12.5T', brand:'KCC/국산', spec:'900×1800×12.5mm (적색)', unit:'장', price:8000, grade:'공통' },

        /* ──────── 목공 MDF/합판 ──────── */
        { id:'mat_w_m01', category:'목공', name:'MDF 9mm', brand:'유니드/동화', spec:'1220×2440×9mm', unit:'장', price:14000, grade:'공통' },
        { id:'mat_w_m02', category:'목공', name:'MDF 12mm', brand:'유니드/동화', spec:'1220×2440×12mm', unit:'장', price:17000, grade:'공통' },
        { id:'mat_w_m03', category:'목공', name:'MDF 15mm', brand:'유니드/동화', spec:'1220×2440×15mm', unit:'장', price:20000, grade:'공통' },
        { id:'mat_w_m04', category:'목공', name:'MDF 18mm', brand:'유니드/동화', spec:'1220×2440×18mm', unit:'장', price:22000, grade:'공통' },
        { id:'mat_w_h01', category:'목공', name:'합판 9mm', brand:'성창기업', spec:'1220×2440×9mm', unit:'장', price:14000, grade:'공통' },
        { id:'mat_w_h02', category:'목공', name:'합판 12mm', brand:'성창기업', spec:'1220×2440×12mm', unit:'장', price:18000, grade:'공통' },
        { id:'mat_w_h03', category:'목공', name:'합판 15mm', brand:'성창기업', spec:'1220×2440×15mm', unit:'장', price:21000, grade:'공통' },
        { id:'mat_w_h04', category:'목공', name:'합판 18mm', brand:'성창기업', spec:'1220×2440×18mm', unit:'장', price:24000, grade:'공통' },

        /* ──────── 목공 영림 문틀/도어 ──────── */
        { id:'mat_w_f01', category:'목공', name:'영림 문틀 ABS 화이트', brand:'영림', spec:'단열문틀 / ABS 화이트', unit:'개', price:45000, grade:'기본형' },
        { id:'mat_w_f02', category:'목공', name:'영림 문틀 ABS 우드', brand:'영림', spec:'단열문틀 / ABS 우드무늬', unit:'개', price:48000, grade:'기본형' },
        { id:'mat_w_f03', category:'목공', name:'영림 문틀 원목', brand:'영림', spec:'원목 문틀', unit:'개', price:80000, grade:'고급형' },
        { id:'mat_w_d10', category:'목공', name:'영림 도어 APA시리즈', brand:'영림', spec:'900×2100mm / ABS도어', unit:'개', price:180000, grade:'기본형' },
        { id:'mat_w_d11', category:'목공', name:'영림 도어 APT시리즈', brand:'영림', spec:'900×2100mm / 방화문', unit:'개', price:250000, grade:'중급형' },
        { id:'mat_w_d12', category:'목공', name:'영림 도어 원목시리즈', brand:'영림', spec:'900×2100mm / 원목도어', unit:'개', price:380000, grade:'고급형' },
        { id:'mat_w_d13', category:'목공', name:'영림 도어 슬라이딩', brand:'영림', spec:'900×2100mm / 슬라이딩', unit:'개', price:320000, grade:'중급형' },
        { id:'mat_w_d14', category:'목공', name:'영림 도어 포켓도어', brand:'영림', spec:'900×2100mm / 포켓슬라이딩', unit:'개', price:420000, grade:'고급형' },

        /* ──────── 전기 ──────── */
        { id:'mat_e01', category:'전기', name:'IV전선 2.5sq', brand:'국산', spec:'100m 롤', unit:'m', price:350, grade:'공통' },
        { id:'mat_e02', category:'전기', name:'IV전선 4.0sq', brand:'국산', spec:'100m 롤', unit:'m', price:550, grade:'공통' },
        { id:'mat_e03', category:'전기', name:'콘센트 (2구)', brand:'대림전기', spec:'250V/16A', unit:'개', price:2800, grade:'기본형' },
        { id:'mat_e04', category:'전기', name:'스위치 (1구)', brand:'대림전기', spec:'250V', unit:'개', price:2500, grade:'기본형' },
        { id:'mat_e05', category:'전기', name:'분전함 (24회로)', brand:'국산', spec:'ABS', unit:'식', price:85000, grade:'기본형' },

        /* ──────── 설비 ──────── */
        { id:'mat_p01', category:'설비', name:'냉온수 배관 (동관)', brand:'국산', spec:'15A 동관', unit:'m', price:4500, grade:'공통' },
        { id:'mat_p02', category:'설비', name:'양변기', brand:'대림바스', spec:'1피스 / 절수형', unit:'식', price:180000, grade:'기본형' },
        { id:'mat_p03', category:'설비', name:'세면기+배관', brand:'대림바스', spec:'500×400mm', unit:'식', price:95000, grade:'기본형' },
        { id:'mat_p04', category:'설비', name:'수전(냉온수 일체)', brand:'아메리칸스탠다드', spec:'크롬', unit:'개', price:65000, grade:'기본형' },
        { id:'mat_p05', category:'설비', name:'레미탈(방수용)', brand:'국산', spec:'25kg/포', unit:'포', price:5500, grade:'공통' },
        { id:'mat_p06', category:'설비', name:'시멘트', brand:'쌍용/한일', spec:'40kg/포', unit:'포', price:6000, grade:'공통' },
        { id:'mat_p07', category:'설비', name:'방수액', brand:'국산', spec:'18L 통', unit:'통', price:4000, grade:'공통' },
        { id:'mat_p08', category:'설비', name:'난방 분배기', brand:'국산', spec:'6구분배기', unit:'식', price:85000, grade:'기본형' },

        /* ──────── 타일 ──────── */
        // 녹수타일 - 프라임 1000
        { id:'mat_t_ns01', category:'타일', name:'녹수 프라임1000 사각', brand:'녹수', spec:'457.2×457.2×3mm / 1box=16매,3.34㎡', unit:'box', price:38000, grade:'기본형' },
        { id:'mat_t_ns02', category:'타일', name:'녹수 프라임1000 우드600', brand:'녹수', spec:'600×600×3mm / 1box=9매,3.24㎡', unit:'box', price:40000, grade:'기본형' },
        { id:'mat_t_ns03', category:'타일', name:'녹수 프라임1000 우드186', brand:'녹수', spec:'186×940×3mm / 1box=19매,3.24㎡', unit:'box', price:40000, grade:'기본형' },
        // 녹수타일 - 에코솔 2000
        { id:'mat_t_ns10', category:'타일', name:'녹수 에코솔2000 사각600', brand:'녹수', spec:'600×600×3mm / 1box=9매,3.24㎡', unit:'box', price:45000, grade:'중급형' },
        { id:'mat_t_ns11', category:'타일', name:'녹수 에코솔2000 사각457', brand:'녹수', spec:'457.2×457.2×3mm / 1box=16매,3.34㎡', unit:'box', price:45000, grade:'중급형' },
        { id:'mat_t_ns12', category:'타일', name:'녹수 에코솔2000 우드180', brand:'녹수', spec:'180×920×3mm / 1box=19매,3.15㎡', unit:'box', price:50000, grade:'중급형' },
        { id:'mat_t_ns13', category:'타일', name:'녹수 에코솔2000 헤링본', brand:'녹수', spec:'101.6×914.4×3mm / 1box=36매,3.34㎡', unit:'box', price:60000, grade:'중급형' },
        // 녹수타일 - 오키드 3000
        { id:'mat_t_ns20', category:'타일', name:'녹수 오키드3000 시그니처', brand:'녹수', spec:'457.2×914.4×3mm / 1box=8매,3.34㎡', unit:'box', price:55000, grade:'고급형' },
        { id:'mat_t_ns21', category:'타일', name:'녹수 오키드3000 일반우드', brand:'녹수', spec:'186×940×3mm / 1box=19매,3.15㎡', unit:'box', price:55000, grade:'고급형' },
        { id:'mat_t_ns22', category:'타일', name:'녹수 오키드3000 러스틱엣지', brand:'녹수', spec:'914.4×914.4×3mm / 1box=4매,5.02㎡', unit:'box', price:65000, grade:'고급형' },
        { id:'mat_t_ns23', category:'타일', name:'녹수 오키드3000 밸런드크라우트', brand:'녹수', spec:'152.4×914.4×3mm / 1box=18매,3.34㎡', unit:'box', price:50000, grade:'고급형' },
        { id:'mat_t_ns24', category:'타일', name:'녹수 오키드3000 304사이즈', brand:'녹수', spec:'304.8×609.6×3mm / 1box=18매,3.34㎡', unit:'box', price:50000, grade:'고급형' },
        { id:'mat_t_ns25', category:'타일', name:'녹수 오키드3000 동조자잘', brand:'녹수', spec:'457.2×457.2×3mm / 1box=18매,3.34㎡', unit:'box', price:55000, grade:'고급형' },
        // 동신타일
        { id:'mat_t_ds01', category:'타일', name:'동신 우드타일 AB.AD', brand:'동신', spec:'180×920×3mm / 1box=20매,3.24㎡', unit:'box', price:40000, grade:'기본형' },
        { id:'mat_t_ds02', category:'타일', name:'동신 마블/가죽600 DS', brand:'동신', spec:'600×600×3mm / 1box=9매,3.24㎡', unit:'box', price:40000, grade:'기본형' },
        { id:'mat_t_ds03', category:'타일', name:'동신 사각타일 AS', brand:'동신', spec:'457.2×457.2×3mm / 1box=16매,3.24㎡', unit:'box', price:40000, grade:'기본형' },
        { id:'mat_t_ds04', category:'타일', name:'동신 에코아트 ECO', brand:'동신', spec:'250×1050×3mm / 1box=4매,3.15㎡', unit:'box', price:65000, grade:'중급형' },
        { id:'mat_t_ds05', category:'타일', name:'동신 에코아트 헤링본 AH', brand:'동신', spec:'100×914.4×3mm / 1box=36매,3.24㎡', unit:'box', price:75000, grade:'고급형' },
        { id:'mat_t_ds06', category:'타일', name:'동신 에코아트 사각 AH', brand:'동신', spec:'457.2×457.2×3mm / 1box=16매,3.24㎡', unit:'box', price:50000, grade:'중급형' },
        // LX하우시스 타일
        { id:'mat_t_lx01', category:'타일', name:'LX 에코노플러스 장판(180×1200)', brand:'LX하우시스', spec:'180×1200×3mm / 1box=15매,3.24㎡', unit:'box', price:55000, grade:'기본형' },
        { id:'mat_t_lx02', category:'타일', name:'LX 에코노플러스 사각600', brand:'LX하우시스', spec:'600×600×3mm / 1box=9매,3.24㎡', unit:'box', price:55000, grade:'기본형' },
        { id:'mat_t_lx03', category:'타일', name:'LX 에코노플러스 사각450', brand:'LX하우시스', spec:'450×450×3mm / 1box=16매,3.24㎡', unit:'box', price:55000, grade:'기본형' },
        { id:'mat_t_lx04', category:'타일', name:'LX 파인.5 사각600', brand:'LX하우시스', spec:'600×600×3mm / 1box=9매,3.24㎡', unit:'box', price:60000, grade:'중급형' },
        { id:'mat_t_lx05', category:'타일', name:'LX 파인.5 우드(180×1200)', brand:'LX하우시스', spec:'180×1200×3mm / 1box=10매,3.3㎡', unit:'box', price:60000, grade:'중급형' },
        { id:'mat_t_lx06', category:'타일', name:'LX 하우스 우드100', brand:'LX하우시스', spec:'100×920×3mm / 1box=36매,3.24㎡', unit:'box', price:50000, grade:'기본형' },
        { id:'mat_t_lx07', category:'타일', name:'LX 하우스 우드150', brand:'LX하우시스', spec:'150×920×3mm / 1box=24매,3.24㎡', unit:'box', price:55000, grade:'기본형' },
        { id:'mat_t_lx08', category:'타일', name:'LX 하우스 헤링본', brand:'LX하우시스', spec:'92×450×3mm / 1box=80매,3.24㎡', unit:'box', price:85000, grade:'중급형' },
        { id:'mat_t_lx09', category:'타일', name:'LX 지아마루STYLE 우드', brand:'LX하우시스', spec:'150×1200×3mm / 1box=18매,3.31㎡', unit:'box', price:60000, grade:'중급형' },
        { id:'mat_t_lx10', category:'타일', name:'LX 지아마루STYLE 헤링본', brand:'LX하우시스', spec:'92×450×3mm / 1box=80매,3.31㎡', unit:'box', price:90000, grade:'고급형' },
        // LX 시트
        { id:'mat_t_lx20', category:'타일', name:'LX 시트 뉴생텍 1.8T', brand:'LX하우시스', spec:'1830mm / 1.8T', unit:'평', price:38000, grade:'실속형' },
        { id:'mat_t_lx21', category:'타일', name:'LX 시트 은행목 2.0T', brand:'LX하우시스', spec:'1830mm / 2.0T', unit:'평', price:38000, grade:'기본형' },
        { id:'mat_t_lx22', category:'타일', name:'LX 지아자연애 2.2T', brand:'LX하우시스', spec:'1830mm / 2.2T', unit:'평', price:45000, grade:'기본형' },
        { id:'mat_t_lx23', category:'타일', name:'LX 지아사랑애 2.7T', brand:'LX하우시스', spec:'1830mm / 2.7T', unit:'평', price:65000, grade:'중급형' },
        { id:'mat_t_lx24', category:'타일', name:'LX 지아소리잔 4.5T', brand:'LX하우시스', spec:'1830mm / 4.5T', unit:'평', price:95000, grade:'고급형' },
        { id:'mat_t_lx25', category:'타일', name:'LX 엑스컴포트 5.0T', brand:'LX하우시스', spec:'1830mm / 5.0T', unit:'평', price:100000, grade:'고급형' },
        // KCC 시트
        { id:'mat_t_kcc01', category:'타일', name:'KCC 슈그린 1.8T ML18', brand:'KCC', spec:'1.8T / 35M롤', unit:'평', price:30000, grade:'실속형' },
        { id:'mat_t_kcc02', category:'타일', name:'KCC 슈플름 2.0T MM20', brand:'KCC', spec:'2.0T / 30M롤', unit:'평', price:38000, grade:'기본형' },
        { id:'mat_t_kcc03', category:'타일', name:'KCC 숲목 2.2T MN22', brand:'KCC', spec:'2.2T / 30M롤', unit:'평', price:45000, grade:'기본형' },
        { id:'mat_t_kcc04', category:'타일', name:'KCC 도담 2.7T NJ27', brand:'KCC', spec:'2.7T / 25M롤', unit:'평', price:65000, grade:'중급형' },
        { id:'mat_t_kcc05', category:'타일', name:'KCC 뉴32 3.2T NR32', brand:'KCC', spec:'3.2T / 23M롤', unit:'평', price:72000, grade:'중급형' },
        { id:'mat_t_kcc06', category:'타일', name:'KCC 휴가온 4.5T NC45', brand:'KCC', spec:'4.5T / 20M롤', unit:'평', price:85000, grade:'고급형' },
        { id:'mat_t_kcc10', category:'타일', name:'KCC 센스타일', brand:'KCC', spec:'180×920×3mm / 1box=20매,3.24㎡', unit:'box', price:45000, grade:'기본형' },
        { id:'mat_t_kcc11', category:'타일', name:'KCC 센스타일 와이드우드', brand:'KCC', spec:'228.6×1219.2×3mm / 1box=12매,3.24㎡', unit:'box', price:50000, grade:'중급형' },
        { id:'mat_t_kcc12', category:'타일', name:'KCC 트랜디', brand:'KCC', spec:'180×920×3mm / 1box=20매,3.24㎡', unit:'box', price:40000, grade:'기본형' },
        { id:'mat_t_kcc13', category:'타일', name:'KCC/녹수 디럭스타일 3.0T 300', brand:'KCC', spec:'300×300×3mm / 1box=36매,3.24㎡', unit:'box', price:38000, grade:'기본형' },
        { id:'mat_t_kcc14', category:'타일', name:'KCC/녹수 디럭스타일 3.0T 450', brand:'KCC', spec:'450×450×3mm / 1box=16매,3.24㎡', unit:'box', price:38000, grade:'기본형' },
        { id:'mat_t_kcc15', category:'타일', name:'KCC/녹수 디럭스타일 2.0T 300', brand:'KCC', spec:'300×300×2mm / 1box=55매,4.8㎡', unit:'box', price:35000, grade:'실속형' },

        /* ──────── 도배 ──────── */
        { id:'mat_d01', category:'도배', name:'합지 기본', brand:'범일', spec:'합지 / 흰색 계열', unit:'㎡', price:4500, grade:'실속형' },
        { id:'mat_d02', category:'도배', name:'디아망', brand:'LX하우시스', spec:'실크 / 표준', unit:'㎡', price:9800, grade:'기본형' },
        { id:'mat_d03', category:'도배', name:'디아망 포티스', brand:'LX하우시스', spec:'실크 / 고급', unit:'㎡', price:14000, grade:'중급형' },
        { id:'mat_d04', category:'도배', name:'베스띠', brand:'LX하우시스', spec:'실크 / 프리미엄', unit:'㎡', price:19500, grade:'고급형' },
        { id:'mat_d05', category:'도배', name:'실크 기본', brand:'신한벽지', spec:'실크 / 표준', unit:'㎡', price:8500, grade:'기본형' },

        /* ──────── 마루 – 구정마루 ──────── */
        { id:'mat_fl_gj01', category:'마루', name:'구정 모던강마루 6mm', brand:'구정마루', spec:'95×800×6mm / 1box=35매,3.192㎡', unit:'box', price:95000, grade:'기본형' },
        { id:'mat_fl_gj02', category:'마루', name:'구정 그랑강마루 7.5mm', brand:'구정마루', spec:'94×800×7.5mm / 1box=43매,3.22㎡', unit:'box', price:100000, grade:'기본형' },
        { id:'mat_fl_gj03', category:'마루', name:'구정 헤링본 강마루', brand:'구정마루', spec:'94×387×7.5mm / 1box=48매,1.584㎡', unit:'box', price:140000, grade:'중급형' },
        { id:'mat_fl_gj04', category:'마루', name:'구정 프라임115', brand:'구정마루', spec:'115×800×7.5mm / 1box=33매,3.03㎡', unit:'box', price:110000, grade:'기본형' },
        { id:'mat_fl_gj05', category:'마루', name:'구정 프라임165', brand:'구정마루', spec:'165×1200×7.5mm / 1box=16매,3.17㎡', unit:'box', price:110000, grade:'기본형' },
        { id:'mat_fl_gj06', category:'마루', name:'구정 마르셀라 리브 393×797', brand:'구정마루', spec:'393×797×7.7mm / 1box=10매,3.13㎡', unit:'box', price:120000, grade:'중급형' },
        { id:'mat_fl_gj07', category:'마루', name:'구정 마르셀라 듀스 393×797', brand:'구정마루', spec:'393×797×7.7mm / 1box=10매,3.13㎡', unit:'box', price:125000, grade:'중급형' },
        { id:'mat_fl_gj08', category:'마루', name:'구정 마르셀라 393×1200 UV', brand:'구정마루', spec:'393×1200×8.7mm / 1box=6매,2.83㎡', unit:'box', price:130000, grade:'중급형' },
        { id:'mat_fl_gj09', category:'마루', name:'구정 마르셀라 듀스UV 597×1210', brand:'구정마루', spec:'597×1210×8.7mm / 1box=4매,2.89㎡', unit:'box', price:155000, grade:'고급형' },
        { id:'mat_fl_gj10', category:'마루', name:'구정 마르셀라 콘크 597×1210', brand:'구정마루', spec:'597×1210×8.7mm / 1box=4매,2.89㎡', unit:'box', price:160000, grade:'고급형' },
        { id:'mat_fl_gj11', category:'마루', name:'구정 마르셀라 뉴600', brand:'구정마루', spec:'597×957×8.7mm / 1box=9매,3.20㎡', unit:'box', price:140000, grade:'중급형' },
        { id:'mat_fl_gj12', category:'마루', name:'구정 마르셀라 뉴900', brand:'구정마루', spec:'900×900×8.7mm / 1box=4매,3.24㎡', unit:'box', price:190000, grade:'고급형' },
        { id:'mat_fl_gj13', category:'마루', name:'구정 본드형 주물바닥', brand:'구정마루', spec:'230×2420×8.7mm', unit:'평', price:150000, grade:'고급형' },
        // 천연마루 - 프레스티지
        { id:'mat_fl_gj20', category:'마루', name:'천연마루 프레스티지 오크', brand:'구정마루', spec:'142×1200×8.7mm / 1box=18매,3.07㎡', unit:'box', price:140000, grade:'고급형' },
        { id:'mat_fl_gj21', category:'마루', name:'천연마루 프레스티지 오크수종', brand:'구정마루', spec:'142×1200×8.7mm / 1box=18매,3.07㎡', unit:'box', price:145000, grade:'고급형' },
        { id:'mat_fl_gj22', category:'마루', name:'천연마루 프레스티지 티크/월넛', brand:'구정마루', spec:'142×1200×8.7mm / 1box=18매,3.07㎡', unit:'box', price:150000, grade:'고급형' },
        // 원목마루 - 헤리티지
        { id:'mat_fl_gj30', category:'마루', name:'구정 원목 헤리티지 오크/애쉬 12mm', brand:'구정마루', spec:'190×1900×10.5mm / 1box=6매,2.166㎡', unit:'box', price:240000, grade:'프리미엄' },
        { id:'mat_fl_gj31', category:'마루', name:'구정 원목 헤리티지 탄화오크/월넛', brand:'구정마루', spec:'190×1900×10.5mm / 1box=6매,2.166㎡', unit:'box', price:270000, grade:'프리미엄' },
        { id:'mat_fl_gj32', category:'마루', name:'구정 원목 헤리티지 오크브러쉬', brand:'구정마루', spec:'190×1900×14mm / 1box=6매,2.166㎡', unit:'box', price:300000, grade:'프리미엄' },
        { id:'mat_fl_gj33', category:'마루', name:'구정 원목 노블레스 오크브러쉬 240', brand:'구정마루', spec:'240×2200×14mm / 1box=4매,2.112㎡', unit:'box', price:420000, grade:'프리미엄' },
        { id:'mat_fl_gj34', category:'마루', name:'구정 원목 노블레스 샌디오크', brand:'구정마루', spec:'240×2200×14mm / 1box=4매,2.112㎡', unit:'box', price:420000, grade:'프리미엄' },
        { id:'mat_fl_gj35', category:'마루', name:'구정 원목 노블레스 리얼브러쉬', brand:'구정마루', spec:'240×2200×14mm / 1box=4매,2.112㎡', unit:'box', price:300000, grade:'프리미엄' },
        { id:'mat_fl_gj36', category:'마루', name:'구정 원목 헤링본 오크 90mm', brand:'구정마루', spec:'90×600×10mm / 1box=20매,1.08㎡', unit:'box', price:260000, grade:'프리미엄' },

        /* 한솔마루 – 접착식 */
        { id:'mat_fl_hs01', category:'마루', name:'한솔 sb강마루 95mm', brand:'한솔', spec:'95×800×7.5mm / 1box=42매,3.192㎡', unit:'box', price:85000, grade:'기본형' },
        { id:'mat_fl_hs02', category:'마루', name:'한솔 sb강마루 143mm', brand:'한솔', spec:'143×1205×7.5mm / 1box=18매,3.08㎡', unit:'box', price:90000, grade:'기본형' },
        { id:'mat_fl_hs03', category:'마루', name:'한솔 sb강마루 165mm', brand:'한솔', spec:'165×1205×7.5mm / 1box=16매,3.18㎡', unit:'box', price:90000, grade:'기본형' },
        { id:'mat_fl_hs04', category:'마루', name:'한솔 타일형 sb마루 390×790', brand:'한솔', spec:'390×790×7.5mm / 1box=10매,3.081㎡', unit:'box', price:90000, grade:'기본형' },
        { id:'mat_fl_hs05', category:'마루', name:'한솔 sb스톤 590×1200', brand:'한솔', spec:'590×1200×7.5mm / 1box=4매,2.832㎡', unit:'box', price:120000, grade:'중급형' },
        { id:'mat_fl_hs06', category:'마루', name:'한솔 sb소프트 590×1200', brand:'한솔', spec:'590×1200×7.5mm / 1box=4매,2.832㎡', unit:'box', price:125000, grade:'중급형' },
        { id:'mat_fl_hs07', category:'마루', name:'한솔 울트라165 강마루', brand:'한솔', spec:'95×800×7.5mm / 1box=40매,3.04㎡', unit:'box', price:95000, grade:'기본형' },
        { id:'mat_fl_hs08', category:'마루', name:'한솔 스킨플로어 복합강화', brand:'한솔', spec:'190×1700×7.5mm / 1box=10매,3.23㎡', unit:'box', price:120000, grade:'중급형' },
        // 한솔 비접착
        { id:'mat_fl_hs10', category:'마루', name:'한솔 강화마루 100폭 레브', brand:'한솔', spec:'100×800×8mm', unit:'평', price:85000, grade:'기본형' },
        { id:'mat_fl_hs11', category:'마루', name:'한솔 강화마루 190폭', brand:'한솔', spec:'190×1200×8mm', unit:'평', price:78000, grade:'기본형' },
        { id:'mat_fl_hs12', category:'마루', name:'한솔 강화마루 390폭', brand:'한솔', spec:'390×1200×8mm', unit:'평', price:88000, grade:'기본형' },
        { id:'mat_fl_hs13', category:'마루', name:'한솔 교실용마루 12T', brand:'한솔', spec:'190×1200×12mm', unit:'평', price:120000, grade:'중급형' },
        { id:'mat_fl_hs14', category:'마루', name:'한솔 교실용마루 15T', brand:'한솔', spec:'190×1200×15mm', unit:'평', price:130000, grade:'중급형' },

        /* 풍산홈플로 - 모네 */
        { id:'mat_fl_ps01', category:'마루', name:'풍산 프리미엄 PRIMUS 165mm', brand:'풍산홈플로', spec:'165×1203×7.5mm / 1box=16매,3.18㎡', unit:'box', price:105000, grade:'기본형' },
        { id:'mat_fl_ps02', category:'마루', name:'풍산 시그니처 SIGNITURE 142mm', brand:'풍산홈플로', spec:'142×1203×7.5mm / 1box=21매,3.08㎡', unit:'box', price:110000, grade:'중급형' },
        { id:'mat_fl_ps03', category:'마루', name:'풍산 로키 MONET ROCKY 398mm', brand:'풍산홈플로', spec:'398×800×7.7mm / 1box=10매,3.184㎡', unit:'box', price:110000, grade:'중급형' },
        { id:'mat_fl_ps04', category:'마루', name:'풍산 로키 MONET CUBE 접착식 597mm', brand:'풍산홈플로', spec:'597×597×7.7mm / 1box=9매,3.21㎡', unit:'box', price:130000, grade:'중급형' },
        { id:'mat_fl_ps05', category:'마루', name:'풍산 로키 듀플 600×1205', brand:'풍산홈플로', spec:'600×1205×7.7mm / 1box=4매,2.892㎡', unit:'box', price:135000, grade:'중급형' },
        { id:'mat_fl_ps06', category:'마루', name:'풍산 천연마루 알베로 ALBERO', brand:'풍산홈플로', spec:'190×1900×10mm / 1box=7매,2.527㎡', unit:'box', price:180000, grade:'고급형' },

        /* 파츠 NOV */
        { id:'mat_fl_pn01', category:'마루', name:'파츠NOV 아파트멘터리 원목', brand:'파츠NOV', spec:'165×1200×11mm / 1box=3.168㎡', unit:'box', price:165000, grade:'고급형' },

        /* LX하우시스 마루 */
        { id:'mat_fl_lx01', category:'마루', name:'LX 강마루 수퍼 20종 95mm', brand:'LX하우시스', spec:'95×800×6mm / 1box=42매,3.192㎡', unit:'box', price:105000, grade:'기본형' },
        { id:'mat_fl_lx02', category:'마루', name:'LX 강마루 와이드 12종 125mm', brand:'LX하우시스', spec:'125×1200×7.5mm / 1box=20매,3.0㎡', unit:'box', price:120000, grade:'중급형' },
        { id:'mat_fl_lx03', category:'마루', name:'LX 강마루 사각 4종', brand:'LX하우시스', spec:'295×590×7.5mm / 1box=18매,3.13㎡', unit:'box', price:125000, grade:'중급형' },
        { id:'mat_fl_lx04', category:'마루', name:'LX SPC 에디톤 450×900', brand:'LX하우시스', spec:'450×900×5mm / 1box=4매,1.62㎡', unit:'평', price:115000, grade:'고급형' },
        { id:'mat_fl_lx05', category:'마루', name:'LX SPC 에디톤 벽재 600×1200', brand:'LX하우시스', spec:'600×1200×4mm / 1box=4매,2.88㎡', unit:'box', price:70000, grade:'고급형' },

        /* 이건마루 */
        { id:'mat_fl_eg01', category:'마루', name:'이건 사각타일마루 그린395', brand:'이건마루', spec:'395×895×10.5mm / 1box=1.58㎡', unit:'box', price:130000, grade:'고급형' },
        { id:'mat_fl_eg02', category:'마루', name:'이건 정사각타일마루 그린597', brand:'이건마루', spec:'597×597×10.5mm / 1box=3.2㎡', unit:'box', price:140000, grade:'고급형' },
        { id:'mat_fl_eg03', category:'마루', name:'이건 합판강 강그린165', brand:'이건마루', spec:'165×1200×10.5mm / 1box=1.584㎡', unit:'box', price:120000, grade:'중급형' },
        { id:'mat_fl_eg04', category:'마루', name:'이건 장척강마루 세라플렉스', brand:'이건마루', spec:'190×1615×10.5mm / 1box=3.068㎡', unit:'box', price:150000, grade:'고급형' },

        /* 노바마루 */
        { id:'mat_fl_nb01', category:'마루', name:'노바 노봄 95mm 강마루', brand:'노바마루', spec:'95×800×6.5mm / 1box=3.192㎡', unit:'box', price:95000, grade:'기본형' },
        { id:'mat_fl_nb02', category:'마루', name:'노바 직사각 타일마루 테라스 395mm', brand:'노바마루', spec:'395×790×7.5mm / 2box=10매,3.12㎡', unit:'box', price:125000, grade:'중급형' },
        { id:'mat_fl_nb03', category:'마루', name:'노바 정사각 타일마루 테라스스퀘어 597mm', brand:'노바마루', spec:'597×597×8mm / 1box=9매,3.207㎡', unit:'box', price:135000, grade:'중급형' },
        { id:'mat_fl_nb04', category:'마루', name:'노바 원목 KB시리즈 190mm', brand:'노바마루', spec:'190×1900×15mm / 1box=2.166㎡', unit:'box', price:350000, grade:'프리미엄' },
        { id:'mat_fl_nb05', category:'마루', name:'노바 원목 STB 150mm', brand:'노바마루', spec:'150×1200×9mm / 1box=3.15㎡', unit:'box', price:220000, grade:'고급형' },

        /* 올고다 */
        { id:'mat_fl_og01', category:'마루', name:'올고다 로카 395mm', brand:'올고다', spec:'395×790×7mm / 2box=3.12㎡', unit:'box', price:120000, grade:'중급형' },
        { id:'mat_fl_og02', category:'마루', name:'올고다 로카 프리미엄 600mm', brand:'올고다', spec:'600×1200×7mm / 1box=2.88㎡', unit:'box', price:125000, grade:'고급형' },

        /* 디앤메종 */
        { id:'mat_fl_dm01', category:'마루', name:'디앤메종 텍스처 2.0 115mm', brand:'디앤메종', spec:'115×800×7.5mm / 1box=3.0㎡', unit:'box', price:110000, grade:'중급형' },
        { id:'mat_fl_dm02', category:'마루', name:'디앤메종 빅 3.0 125mm', brand:'디앤메종', spec:'125×1203×7.5mm / 1box=3.0㎡', unit:'box', price:115000, grade:'중급형' },
        { id:'mat_fl_dm03', category:'마루', name:'디앤메종 마제스틱 230mm', brand:'디앤메종', spec:'230×2000×7.5mm / 1box=3.2㎡', unit:'box', price:140000, grade:'고급형' },
        { id:'mat_fl_dm04', category:'마루', name:'디앤메종 헤링본 그레이스/텍스처', brand:'디앤메종', spec:'115×595×7.5mm / 1box=3.01㎡', unit:'box', price:140000, grade:'고급형' },
        { id:'mat_fl_dm05', category:'마루', name:'디앤메종 원목 텐우드 오크/애쉬 165mm', brand:'디앤메종', spec:'165×1200×10mm / 1box=3.168㎡', unit:'box', price:145000, grade:'고급형' },
        { id:'mat_fl_dm06', category:'마루', name:'디앤메종 원목 12T 티크/월넛', brand:'디앤메종', spec:'165×1200×10mm / 1box=3.168㎡', unit:'box', price:160000, grade:'프리미엄' },
        { id:'mat_fl_dm07', category:'마루', name:'디앤메종 원목 12T 오크 AB 190mm', brand:'디앤메종', spec:'190×1900×12mm / 1py=3.24㎡', unit:'평', price:280000, grade:'프리미엄' },
        { id:'mat_fl_dm08', category:'마루', name:'디앤메종 원목 12T 오크 ABCD', brand:'디앤메종', spec:'190×1900×12mm / 1py=3.24㎡', unit:'평', price:250000, grade:'프리미엄' },
        { id:'mat_fl_dm09', category:'마루', name:'디앤메종 원목 12T 올드아렌/월넛', brand:'디앤메종', spec:'190×1900×12mm / 1py=3.24㎡', unit:'평', price:260000, grade:'프리미엄' },
        { id:'mat_fl_dm10', category:'마루', name:'디앤메종 원목 12T 티크브러쉬', brand:'디앤메종', spec:'190×1900×12mm / 1py=3.24㎡', unit:'평', price:400000, grade:'프리미엄' },
        { id:'mat_fl_dm11', category:'마루', name:'디앤메종 원목 14T 오크브러쉬 AB', brand:'디앤메종', spec:'190×1900×14mm / 1py=3.24㎡', unit:'평', price:360000, grade:'프리미엄' },
        { id:'mat_fl_dm12', category:'마루', name:'디앤메종 원목 14T 오크브러쉬 ABCD', brand:'디앤메종', spec:'190×1900×14mm / 1py=3.24㎡', unit:'평', price:300000, grade:'프리미엄' },
        { id:'mat_fl_dm13', category:'마루', name:'디앤메종 원목 14T 카리브/벌포트', brand:'디앤메종', spec:'190×1900×14mm / 1py=3.24㎡', unit:'평', price:330000, grade:'프리미엄' },

        /* 동화자연마루 */
        { id:'mat_fl_dh01', category:'마루', name:'동화 강마루 나투스강 98mm', brand:'동화자연마루', spec:'98×800×7.5mm / 1box=3.192㎡', unit:'box', price:110000, grade:'기본형' },
        { id:'mat_fl_dh02', category:'마루', name:'동화 강마루 나투스강 프레 95mm', brand:'동화자연마루', spec:'95×800×6mm / 1box=3.192㎡', unit:'box', price:100000, grade:'기본형' },
        { id:'mat_fl_dh03', category:'마루', name:'동화 강마루 나투스강 텍스처 143mm', brand:'동화자연마루', spec:'143×1205×7.5mm / 1box=3.102㎡', unit:'box', price:115000, grade:'기본형' },
        { id:'mat_fl_dh04', category:'마루', name:'동화 진마루 나투스진 퓨어어반 98mm', brand:'동화자연마루', spec:'98×815×7mm / 1box=3.116㎡', unit:'box', price:88000, grade:'기본형' },
        { id:'mat_fl_dh05', category:'마루', name:'동화 진마루 나투스진 그란데 325×810', brand:'동화자연마루', spec:'325×810×7mm / 1box=3.068㎡', unit:'box', price:90000, grade:'중급형' },
        { id:'mat_fl_dh06', category:'마루', name:'동화 진마루 나투스진 정사각 그란데스퀘어 650×650', brand:'동화자연마루', spec:'650×650×7.5mm / 1box=7매,2.957㎡', unit:'box', price:130000, grade:'중급형' },
        { id:'mat_fl_dh07', category:'마루', name:'동화 진마루 나투스진 그란데스퀘어 1220 650×1220', brand:'동화자연마루', spec:'650×1220×7.5mm / 1box=4매,3.172㎡', unit:'box', price:130000, grade:'중급형' },
        { id:'mat_fl_dh08', category:'마루', name:'동화 진마루 나투스진 테지 125×800', brand:'동화자연마루', spec:'125×800×7mm / 1box=3.2㎡', unit:'box', price:95000, grade:'기본형' },
        { id:'mat_fl_dh09', category:'마루', name:'동화 진마루 나투스진 테리 161×1215', brand:'동화자연마루', spec:'161×1215×7.5mm / 1box=3.13㎡', unit:'box', price:100000, grade:'기본형' },
        { id:'mat_fl_dh10', category:'마루', name:'동화 진마루 나투스진 텍스쳐 125×800', brand:'동화자연마루', spec:'125×800×7mm / 1box=3.2㎡', unit:'box', price:105000, grade:'중급형' },
        { id:'mat_fl_dh11', category:'마루', name:'동화 나투스듀오 115mm', brand:'동화자연마루', spec:'115×800×7.5mm / 1box=3.036㎡', unit:'box', price:110000, grade:'기본형' },
        { id:'mat_fl_dh12', category:'마루', name:'동화 나투스듀오 650×750', brand:'동화자연마루', spec:'650×750×7.5mm / 1box=7매,2.957㎡', unit:'box', price:130000, grade:'중급형' },
        { id:'mat_fl_dh13', category:'마루', name:'동화 나투스듀오 텍스처 165×1205', brand:'동화자연마루', spec:'165×1205×10mm / 1box=3.182㎡', unit:'box', price:120000, grade:'중급형' },

        /* 네스트마루 */
        { id:'mat_fl_ns01', category:'마루', name:'네스트 미네랄마루 405×810', brand:'네스트', spec:'405×810×8.2mm / 2box=3.28㎡', unit:'box', price:180000, grade:'고급형' },

        /* ──────── 필름 ──────── */
        { id:'mat_fi01', category:'필름', name:'단색 시트지', brand:'현대L&C', spec:'무광 단색', unit:'㎡', price:12000, grade:'기본형' },
        { id:'mat_fi02', category:'필름', name:'대리석 시트지', brand:'현대L&C', spec:'대리석 패턴', unit:'㎡', price:18000, grade:'중급형' },
        { id:'mat_fi03', category:'필름', name:'우드 시트지', brand:'현대L&C', spec:'우드 패턴', unit:'㎡', price:16000, grade:'기본형' },

        /* ──────── 도장 ──────── */
        { id:'mat_dp01', category:'도장', name:'실내 수성페인트', brand:'노루페인트', spec:'2회 도장 기준', unit:'㎡', price:4500, grade:'기본형' },
        { id:'mat_dp02', category:'도장', name:'페인트 (프리미엄)', brand:'벤자민무어', spec:'2회 도장 기준', unit:'㎡', price:12000, grade:'고급형' },

        /* ──────── 조명 ──────── */
        { id:'mat_l01', category:'조명', name:'거실등 LED', brand:'국산', spec:'50W / 주광색', unit:'개', price:85000, grade:'기본형' },
        { id:'mat_l02', category:'조명', name:'방등 LED', brand:'국산', spec:'30W / 주광색', unit:'개', price:55000, grade:'기본형' },
        { id:'mat_l03', category:'조명', name:'다운라이트 LED', brand:'국산', spec:'8W / φ100', unit:'개', price:18000, grade:'기본형' },

        /* ──────── 주방 ──────── */
        { id:'mat_k01', category:'주방', name:'상판 인조대리석', brand:'(시공사)', spec:'두께 15mm', unit:'m', price:120000, grade:'기본형' },
        { id:'mat_k02', category:'주방', name:'상판 세라믹', brand:'(시공사)', spec:'두께 12mm', unit:'m', price:180000, grade:'중급형' },
        { id:'mat_k03', category:'주방', name:'싱크대 하부장', brand:'(시공사)', spec:'PET도어/스테인리스', unit:'식', price:850000, grade:'기본형' },

        /* ──────── 욕실 ──────── */
        { id:'mat_b01', category:'욕실', name:'양변기', brand:'대림바스', spec:'1피스 절수형', unit:'식', price:180000, grade:'기본형' },
        { id:'mat_b02', category:'욕실', name:'세면기+배관', brand:'대림바스', spec:'500×400mm', unit:'식', price:95000, grade:'기본형' },
        { id:'mat_b03', category:'욕실', name:'수전 (냉온수)', brand:'아메리칸스탠다드', spec:'크롬', unit:'개', price:65000, grade:'기본형' },
        { id:'mat_b04', category:'욕실', name:'욕실 벽타일 기본', brand:'이노타일', spec:'300×600mm', unit:'㎡', price:15000, grade:'기본형' },
        { id:'mat_b05', category:'욕실', name:'욕실 바닥타일 논슬립', brand:'이노타일', spec:'300×300mm 논슬립', unit:'㎡', price:12000, grade:'기본형' },
        { id:'mat_b06', category:'욕실', name:'샤워기 세트', brand:'국산', spec:'헤드+호스+선반', unit:'식', price:45000, grade:'기본형' },
        { id:'mat_b07', category:'욕실', name:'욕실 액세서리 세트', brand:'국산', spec:'수건걸이+휴지걸이+비누받침', unit:'식', price:35000, grade:'기본형' },
        { id:'mat_b08', category:'욕실', name:'욕실장 (PVC)', brand:'국산', spec:'600×800mm', unit:'식', price:85000, grade:'기본형' },

        /* ──────── 기타 ──────── */
        { id:'mat_g01', category:'기타', name:'보양재 (바닥)', brand:'(현장)', spec:'PE폼+골판지', unit:'식', price:120000, grade:'공통' },
        { id:'mat_g02', category:'기타', name:'실리콘 코킹재', brand:'국산', spec:'300ml 카트리지', unit:'개', price:3500, grade:'공통' },
        { id:'mat_g03', category:'기타', name:'마스킹 테이프', brand:'국산', spec:'50mm×30m', unit:'개', price:2000, grade:'공통' }
    ];
}

/* ═══════════════════════════════════════════════════════
   기본 노무비 마스터
═══════════════════════════════════════════════════════ */
function getDefaultLabors() {
    return [
        /* ── 철거 ── */
        { id:'lab_ch01', category:'철거', name:'현장/공용부 보양', spec:'자재별도, 노무비', basis:'식당', unit:'식', price:170000 },
        { id:'lab_ch02', category:'철거', name:'마루 철거', spec:'기존 강마루/마루 제거', basis:'평당', unit:'평', price:15000 },
        { id:'lab_ch03', category:'철거', name:'장판 철거', spec:'기존 장판 제거', basis:'평당', unit:'평', price:5000 },
        { id:'lab_ch04', category:'철거', name:'욕실 철거', spec:'욕실 1개소 전체 (타일+설비+방수)', basis:'식당', unit:'식', price:650000 },
        { id:'lab_ch05', category:'철거', name:'싱크대 철거', spec:'상하부장+후드', basis:'식당', unit:'식', price:70000 },
        { id:'lab_ch06', category:'철거', name:'거실 확장부 철거', spec:'발코니 확장부 철거', basis:'식당', unit:'식', price:300000 },
        { id:'lab_ch07', category:'철거', name:'문/문틀 철거', spec:'문짝+문틀 제거', basis:'개당', unit:'개', price:30000 },
        { id:'lab_ch08', category:'철거', name:'사다리차 임대', spec:'반나절 기준', basis:'식당', unit:'식', price:350000 },
        { id:'lab_ch09', category:'철거', name:'용역/소운반', spec:'자재 층간 소운반 일식', basis:'식당', unit:'식', price:190000 },
        { id:'lab_ch10', category:'철거', name:'폐기물 처리비', spec:'혼합 폐기물 / 1t 기준', basis:'식당', unit:'식', price:450000 },
        { id:'lab_ch11', category:'철거', name:'전체 철거 (일식)', spec:'도배·마루·타일·몰딩 포함', basis:'식당', unit:'식', price:1500000 },

        /* ── 샷시 ── */
        { id:'lab_sh01', category:'샷시', name:'샷시 설치', spec:'창호 실측·설치·코킹', basis:'㎡당', unit:'㎡', price:50000 },
        { id:'lab_sh02', category:'샷시', name:'샷시 설치 (일식)', spec:'전체 창호 교체 일식', basis:'식당', unit:'식', price:800000 },

        /* ── 목공 ── */
        { id:'lab_w01', category:'목공', name:'경량 칸막이 시공', spec:'스터드+석고보드 양면', basis:'㎡당', unit:'㎡', price:55000 },
        { id:'lab_w02', category:'목공', name:'천장 석고보드 시공', spec:'M바+석고보드', basis:'㎡당', unit:'㎡', price:45000 },
        { id:'lab_w03', category:'목공', name:'몰딩 시공', spec:'실측·절단·고정', basis:'m당', unit:'m', price:6000 },
        { id:'lab_w04', category:'목공', name:'붙박이장 제작', spec:'내부 선반 포함', basis:'식당', unit:'식', price:800000 },
        { id:'lab_w05', category:'목공', name:'목공 전체 (일식)', spec:'칸막이+천장+몰딩', basis:'식당', unit:'식', price:1200000 },
        { id:'lab_w06', category:'목공', name:'문틀/문짝 설치', spec:'영림 문틀+도어 설치', basis:'개당', unit:'개', price:80000 },

        /* ── 전기 ── */
        { id:'lab_e01', category:'전기', name:'전기 배선 (일식)', spec:'콘센트·스위치 배선 포함', basis:'식당', unit:'식', price:800000 },
        { id:'lab_e02', category:'전기', name:'분전반 교체', spec:'기존 제거·신규 설치', basis:'식당', unit:'식', price:300000 },
        { id:'lab_e03', category:'전기', name:'콘센트/스위치 교체', spec:'개당 설치 단가', basis:'개당', unit:'개', price:20000 },

        /* ── 설비 ── */
        { id:'lab_p01', category:'설비', name:'냉온수 배관 교체', spec:'평당 단가', basis:'평당', unit:'평', price:30000 },
        { id:'lab_p02', category:'설비', name:'냉온수 배관 교체 노무 (일식)', spec:'전체 배관 교체 일식', basis:'식당', unit:'식', price:400000 },
        { id:'lab_p03', category:'설비', name:'욕실 방수 (1차 액체방수)', spec:'레미탈+방수액 / 욕실 1개소', basis:'식당', unit:'식', price:280000 },
        { id:'lab_p04', category:'설비', name:'난방 배관 시공 (분배기 교체)', spec:'자재비 평당 40,000원 별도', basis:'평당', unit:'평', price:55000 },
        { id:'lab_p05', category:'설비', name:'수전 교체', spec:'기존 제거·신규 설치', basis:'개당', unit:'개', price:80000 },
        { id:'lab_p06', category:'설비', name:'양변기 교체', spec:'기존 제거·신규 설치', basis:'식당', unit:'식', price:150000 },
        { id:'lab_p07', category:'설비', name:'욕실 설비 전체 (일식)', spec:'수전+양변기+세면기', basis:'식당', unit:'식', price:350000 },
        { id:'lab_p08', category:'설비', name:'급수·배관 공사', spec:'동관 교체 포함', basis:'식당', unit:'식', price:600000 },

        /* ── 타일 ── */
        { id:'lab_t01', category:'타일', name:'욕실 타일 시공', spec:'벽+바닥 포함', basis:'㎡당', unit:'㎡', price:45000 },
        { id:'lab_t02', category:'타일', name:'욕실 타일 (일식)', spec:'욕실 1개소 완전 일식', basis:'식당', unit:'식', price:900000 },
        { id:'lab_t03', category:'타일', name:'주방 타일 시공', spec:'주방 벽면', basis:'㎡당', unit:'㎡', price:35000 },

        /* ── 도배 ── */
        { id:'lab_d01', category:'도배', name:'도배 시공 (합지)', spec:'합지 전면', basis:'㎡당', unit:'㎡', price:5000 },
        { id:'lab_d02', category:'도배', name:'도배 시공 (실크)', spec:'실크 전면', basis:'㎡당', unit:'㎡', price:8000 },
        { id:'lab_d03', category:'도배', name:'도배 시공 (일식)', spec:'초배+실크 포함', basis:'식당', unit:'식', price:900000 },

        /* ── 마루 ── */
        { id:'lab_fl01', category:'마루', name:'마루 시공 (접착식)', spec:'강마루·강화마루', basis:'㎡당', unit:'㎡', price:15000 },
        { id:'lab_fl02', category:'마루', name:'마루 시공 (일식)', spec:'걸레받이 포함', basis:'식당', unit:'식', price:700000 },
        { id:'lab_fl03', category:'마루', name:'원목마루 시공', spec:'원목마루 전문 시공', basis:'㎡당', unit:'㎡', price:25000 },

        /* ── 필름 ── */
        { id:'lab_fi01', category:'필름', name:'시트지 시공', spec:'문짝·가구·벽면', basis:'㎡당', unit:'㎡', price:18000 },

        /* ── 도장 ── */
        { id:'lab_dp01', category:'도장', name:'실내 도장', spec:'퍼티+2회 도장', basis:'㎡당', unit:'㎡', price:12000 },
        { id:'lab_dp02', category:'도장', name:'도장 전체 (일식)', spec:'전 공간 2회 도장', basis:'식당', unit:'식', price:500000 },

        /* ── 조명 ── */
        { id:'lab_l01', category:'조명', name:'조명 교체', spec:'기존 제거·신규 설치', basis:'개당', unit:'개', price:25000 },
        { id:'lab_l02', category:'조명', name:'조명 전체 (일식)', spec:'전 공간 교체 일식', basis:'식당', unit:'식', price:400000 },

        /* ── 주방 ── */
        { id:'lab_k01', category:'주방', name:'주방 상판 시공', spec:'실측·절단·설치', basis:'식당', unit:'식', price:250000 },
        { id:'lab_k02', category:'주방', name:'싱크대 조립·설치', spec:'상·하부장 포함', basis:'식당', unit:'식', price:400000 },
        { id:'lab_k03', category:'주방', name:'주방 전체 (일식)', spec:'상판+싱크+후드 설치', basis:'식당', unit:'식', price:700000 },

        /* ── 욕실 ── */
        { id:'lab_b01', category:'욕실', name:'욕실 철거+타일+설비 전체', spec:'철거+방수+타일+설비 일식', basis:'식당', unit:'식', price:1800000 },
        { id:'lab_b02', category:'욕실', name:'욕실 타일 시공', spec:'벽+바닥 타일 시공', basis:'식당', unit:'식', price:900000 },

        /* ── 기타 ── */
        { id:'lab_g01', category:'기타', name:'폐기물 처리', spec:'혼합 폐기물 / 5톤', basis:'식당', unit:'식', price:400000 },
        { id:'lab_g02', category:'기타', name:'입주 청소', spec:'전체 청소 일식', basis:'식당', unit:'식', price:450000 },
        { id:'lab_g03', category:'기타', name:'현장 보양', spec:'바닥·벽 보양재 설치', basis:'식당', unit:'식', price:200000 },
        { id:'lab_g04', category:'기타', name:'소운반', spec:'자재 층간 소운반', basis:'식당', unit:'식', price:150000 },
        { id:'lab_g05', category:'기타', name:'현장 관리', spec:'현장 소장 파견·관리', basis:'식당', unit:'식', price:500000 }
    ];
}

function getDefaultRates() {
    return {
        간접노무비        : 3.11,
        산재보험          : 3.545,
        건강보험          : 3.545,
        연금보험          : 4.5,
        고용보험          : 0.79,
        산업안전보건관리비: 3.11,
        일반관리비        : 1.5,
        기업이윤          : 10,
        부가세            : 10
    };
}

/* ── CRUD ──────────────────────────────────────────── */
function loadMaterials() {
    try { const s=localStorage.getItem(STORAGE_KEYS.MATERIALS); return s?JSON.parse(s):getDefaultMaterials(); }
    catch(e){ return getDefaultMaterials(); }
}
function saveMaterials(list){ localStorage.setItem(STORAGE_KEYS.MATERIALS,JSON.stringify(list)); }

function loadLabors() {
    try { const s=localStorage.getItem(STORAGE_KEYS.LABORS); return s?JSON.parse(s):getDefaultLabors(); }
    catch(e){ return getDefaultLabors(); }
}
function saveLabors(list){ localStorage.setItem(STORAGE_KEYS.LABORS,JSON.stringify(list)); }

function loadRates() {
    try { const s=localStorage.getItem(STORAGE_KEYS.RATES); return s?JSON.parse(s):getDefaultRates(); }
    catch(e){ return getDefaultRates(); }
}
function saveRates(obj){ localStorage.setItem(STORAGE_KEYS.RATES,JSON.stringify(obj)); }

function genId(pfx){ return pfx+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6); }

/* 최초 실행 시 기본 데이터 보장 */
(function bootstrap(){
    if(!localStorage.getItem(STORAGE_KEYS.MATERIALS)) saveMaterials(getDefaultMaterials());
    if(!localStorage.getItem(STORAGE_KEYS.LABORS))    saveLabors(getDefaultLabors());
    if(!localStorage.getItem(STORAGE_KEYS.RATES))     saveRates(getDefaultRates());
    if(!localStorage.getItem(STORAGE_KEYS.PROCESSES)) saveProcesses(getDefaultProcesses());
    if(!localStorage.getItem(STORAGE_KEYS.UNITS))     saveUnits(getDefaultUnits());
})();
