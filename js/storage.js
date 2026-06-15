// ============================================================
//  storage.js  v7.0
//  - 로고·도장·공정목록·회사정보 → Supabase DB 저장
//  - localStorage는 캐시 용도로만 병행 유지
//  - 계약서 저장/불러오기 추가
// ============================================================

const SUPABASE_URL = 'https://isrimiwqqytzzqjovtot.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcmltaXdxcXl0enpxam92dG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjg5NDEsImV4cCI6MjA5MjAwNDk0MX0.DescofNz1_U0eCp1CY0Nstxd3OzB_xlRMCv0IBiZAGA';

const STORAGE_KEYS = {
    MATERIALS  : 'iq_materials',
    LABORS     : 'iq_labors',
    RATES      : 'iq_rates',
    PROCESSES  : 'iq_processes',
    LOGO       : 'iq_logo',
    STAMP      : 'iq_stamp',
    VAT_MODE   : 'iq_vat_mode',
    COMPANY    : 'iq_company',
    UNITS      : 'iq_units'
};

/* ═══════════════════════════════════════════════════════
   Supabase helpers
═══════════════════════════════════════════════════════ */
async function sbGet(table, id) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&limit=1`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
        });
        const rows = await res.json();
        return rows && rows[0] ? rows[0] : null;
    } catch (e) { console.warn('sbGet error', e); return null; }
}

async function sbUpsert(table, data) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(data)
        });
    } catch (e) { console.warn('sbUpsert error', e); }
}

async function sbQuery(table, filters) {
    try {
        let url = `${SUPABASE_URL}/rest/v1/${table}?order=created_at.desc`;
        if (filters) url += '&' + filters;
        const res = await fetch(url, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
        });
        return await res.json();
    } catch (e) { console.warn('sbQuery error', e); return []; }
}

async function sbDelete(table, id) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
        });
    } catch (e) { console.warn('sbDelete error', e); }
}

/* ═══════════════════════════════════════════════════════
   company_settings — DB 기반 로드/저장
═══════════════════════════════════════════════════════ */
let _settingsCache = null;

async function loadSettingsFromDB() {
    if (_settingsCache) return _settingsCache;
    const row = await sbGet('company_settings', 'default');
    if (row) {
        _settingsCache = row;
        // localStorage 캐시 갱신 — 빈값/빈배열이면 덮어쓰지 않음
        if (row.logo_base64)  localStorage.setItem(STORAGE_KEYS.LOGO,  row.logo_base64);
        if (row.stamp_base64) localStorage.setItem(STORAGE_KEYS.STAMP, row.stamp_base64);
        if (row.company && Object.keys(row.company).length > 0)
            localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(row.company));
        if (row.processes && Array.isArray(row.processes) && row.processes.length > 0)
            localStorage.setItem(STORAGE_KEYS.PROCESSES, JSON.stringify(row.processes));
        if (row.units && Array.isArray(row.units) && row.units.length > 0)
            localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(row.units));
        if (row.rates && Object.keys(row.rates).length > 0)
            localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify(row.rates));
        if (row.vat_mode) localStorage.setItem(STORAGE_KEYS.VAT_MODE, row.vat_mode);
    }
    return _settingsCache;
}

async function saveSettingsToDB(patch) {
    _settingsCache = null; // 캐시 무효화
    await sbUpsert('company_settings', { id: 'default', updated_at: new Date().toISOString(), ...patch });
}

/* ── 로고 ─────────────────────────────────────────── */
function loadLogo()  { return localStorage.getItem(STORAGE_KEYS.LOGO)  || ''; }
function loadStamp() { return localStorage.getItem(STORAGE_KEYS.STAMP) || ''; }

async function saveLogo(b64) {
    localStorage.setItem(STORAGE_KEYS.LOGO, b64);
    await saveSettingsToDB({ logo_base64: b64 });
}
async function saveStamp(b64) {
    localStorage.setItem(STORAGE_KEYS.STAMP, b64);
    await saveSettingsToDB({ stamp_base64: b64 });
}

/* ── VAT 모드 ─────────────────────────────────────── */
function loadVatMode()     { return localStorage.getItem(STORAGE_KEYS.VAT_MODE) || 'include'; }
async function saveVatMode(mode) {
    localStorage.setItem(STORAGE_KEYS.VAT_MODE, mode);
    await saveSettingsToDB({ vat_mode: mode });
}

/* ── 시공사 정보 ──────────────────────────────────── */
function loadCompany() {
    try {
        const s = localStorage.getItem(STORAGE_KEYS.COMPANY);
        return s ? JSON.parse(s) : {};
    } catch { return {}; }
}
function loadCompanyInfo() { return loadCompany(); }

async function saveCompany(obj) {
    localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(obj));
    await saveSettingsToDB({ company: obj });
}

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
async function saveUnits(list) {
    localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(list));
    await saveSettingsToDB({ units: list });
}

/* ═══════════════════════════════════════════════════════
   공정 카테고리 — DB 저장으로 변경
═══════════════════════════════════════════════════════ */
function getDefaultProcesses() {
    return [
        { id:'proc_01', num:'01', name:'가설/철거' },
        { id:'proc_02', num:'02', name:'샷시' },
        { id:'proc_03', num:'03', name:'단열/목공' },
        { id:'proc_04', num:'04', name:'전기/조명' },
        { id:'proc_05', num:'05', name:'설비' },
        { id:'proc_06', num:'06', name:'타일' },
        { id:'proc_07', num:'07', name:'도배' },
        { id:'proc_08', num:'08', name:'마루' },
        { id:'proc_09', num:'09', name:'필름' },
        { id:'proc_10', num:'10', name:'도장' },
        { id:'proc_11', num:'11', name:'욕실위생금구류' },
        { id:'proc_12', num:'12', name:'주방가구' },
        { id:'proc_13', num:'13', name:'수납가구' },
        { id:'proc_14', num:'14', name:'기타' }
    ];
}

function loadProcesses() {
    try {
        const s = localStorage.getItem(STORAGE_KEYS.PROCESSES);
        return s ? JSON.parse(s) : getDefaultProcesses();
    } catch { return getDefaultProcesses(); }
}

async function saveProcesses(list) {
    localStorage.setItem(STORAGE_KEYS.PROCESSES, JSON.stringify(list));
    await saveSettingsToDB({ processes: list });
}

function getProcNum(name) {
    if (!name) return '-';
    if (name === '미분류') return '–';
    const p = loadProcesses().find(x => x.name === name);
    return p ? p.num : name.slice(0,2);
}

function getProcOrder(name) {
    if (name === '미분류') return 10000;
    const list = loadProcesses();
    const i = list.findIndex(x => x.name === name);
    return i >= 0 ? i : 9999;
}

function getProcNames() { return loadProcesses().map(p => p.name); }

function getAllProcNames() {
    const names = getProcNames();
    const hasMis = (() => {
        try {
            const mats = JSON.parse(localStorage.getItem('iq_materials')||'[]');
            const labs = JSON.parse(localStorage.getItem('iq_labors')||'[]');
            return [...mats,...labs].some(x => x.category === '미분류');
        } catch { return false; }
    })();
    if (hasMis && !names.includes('미분류')) names.push('미분류');
    return names;
}

function renameProcInItems(oldName, newName) {
    const mats = loadMaterials().map(m => { if (m.category===oldName) m.category=newName; return m; });
    saveMaterials(mats);
    const labs = loadLabors().map(l => { if (l.category===oldName) l.category=newName; return l; });
    saveLabors(labs);
}

function orphanProcItems(procName) {
    const UNCAT = '미분류';
    const mats = loadMaterials().map(m => { if (m.category===procName) m.category=UNCAT; return m; });
    saveMaterials(mats);
    const labs = loadLabors().map(l => { if (l.category===procName) l.category=UNCAT; return l; });
    saveLabors(labs);
}

/* ═══════════════════════════════════════════════════════
   계약서 CRUD — Supabase contracts 테이블
═══════════════════════════════════════════════════════ */
function genContractId() {
    return 'cont_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
}

async function saveContract(contractObj) {
    if (!contractObj.id) contractObj.id = genContractId();
    contractObj.updated_at = new Date().toISOString();
    if (!contractObj.created_at) contractObj.created_at = contractObj.updated_at;

    await fetch(`${SUPABASE_URL}/rest/v1/contracts`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(contractObj)
    });
    return contractObj.id;
}

async function loadContracts() {
    return await sbQuery('contracts', 'order=created_at.desc');
}

async function loadContract(id) {
    return await sbGet('contracts', id);
}

async function deleteContract(id) {
    await sbDelete('contracts', id);
}

/* ═══════════════════════════════════════════════════════
   앱 시작 시 DB에서 설정 동기화
═══════════════════════════════════════════════════════ */
async function initSettingsFromDB() {
    await loadSettingsFromDB();
    console.log('[storage] DB 설정 동기화 완료');
}

/* ═══════════════════════════════════════════════════════
   자재·노무·요율 (기존 유지)
═══════════════════════════════════════════════════════ */
function getDefaultMaterials() { return [
    /* ── 가설/철거 ── */
    { id:'mat_ch_01', category:'가설/철거', name:'현장/공용부 보양재', brand:'일반', spec:'PE폼+골판지 1식', unit:'식', price:70000, grade:'공통' },
    /* ── 샷시 ── */
    { id:'mat_sh01', category:'샷시', name:'이중창 샷시', brand:'LG하우시스', spec:'두께 44mm / 이중유리', unit:'㎡', price:220000, grade:'기본형' },
    { id:'mat_sh02', category:'샷시', name:'시스템창호', brand:'LG하우시스', spec:'삼중유리 / 고단열', unit:'㎡', price:380000, grade:'고급형' },
    { id:'mat_sh03', category:'샷시', name:'이중창 샷시', brand:'KCC', spec:'두께 44mm / 이중유리', unit:'㎡', price:200000, grade:'기본형' },
    /* ── 단열/목공 단열재 ── */
    { id:'mat_ins01', category:'단열/목공', name:'아이소핑크 단열재 20mm', brand:'국산', spec:'1220×2440×20mm', unit:'장', price:12000, grade:'공통' },
    { id:'mat_ins02', category:'단열/목공', name:'아이소핑크 단열재 30mm', brand:'국산', spec:'1220×2440×30mm', unit:'장', price:16000, grade:'공통' },
    { id:'mat_ins03', category:'단열/목공', name:'아이소핑크 단열재 50mm', brand:'국산', spec:'1220×2440×50mm', unit:'장', price:22000, grade:'공통' },
    { id:'mat_ins04', category:'단열/목공', name:'글라스울 보온재 24K', brand:'KCC', spec:'50mm×600×1200mm', unit:'롤', price:18000, grade:'공통' },
    { id:'mat_ins05', category:'단열/목공', name:'글라스울 보온재 32K', brand:'KCC', spec:'50mm×600×1200mm', unit:'롤', price:22000, grade:'공통' },
    { id:'mat_ins06', category:'단열/목공', name:'온도리 열반사 단열재 5mm', brand:'국산', spec:'1.2m×10m 롤', unit:'롤', price:35000, grade:'공통' },
    { id:'mat_ins07', category:'단열/목공', name:'온도리 열반사 단열재 8mm', brand:'국산', spec:'1.2m×10m 롤', unit:'롤', price:45000, grade:'공통' },
    { id:'mat_w_d01', category:'단열/목공', name:'다루끼 각재 30×40mm', brand:'국산', spec:'30×40×3600mm 한단', unit:'단', price:8000, grade:'공통' },
    { id:'mat_w_d02', category:'단열/목공', name:'다루끼 각재 40×50mm', brand:'국산', spec:'40×50×3600mm 한단', unit:'단', price:11000, grade:'공통' },
    { id:'mat_w_d03', category:'단열/목공', name:'투바이 각재 2×4', brand:'국산', spec:'38×89×3600mm 한단', unit:'단', price:14000, grade:'공통' },
    { id:'mat_w_d04', category:'단열/목공', name:'투바이 각재 2×6', brand:'국산', spec:'38×140×3600mm 한단', unit:'단', price:18000, grade:'공통' },
    { id:'mat_w_g01', category:'단열/목공', name:'일반 석고보드 9.5T', brand:'KCC/국산', spec:'900×1800×9.5mm', unit:'장', price:4500, grade:'공통' },
    { id:'mat_w_g02', category:'단열/목공', name:'일반 석고보드 12.5T', brand:'KCC/국산', spec:'900×1800×12.5mm', unit:'장', price:5500, grade:'공통' },
    { id:'mat_w_g03', category:'단열/목공', name:'방수 석고보드 9.5T', brand:'KCC/국산', spec:'900×1800×9.5mm (녹색)', unit:'장', price:6500, grade:'공통' },
    { id:'mat_w_g04', category:'단열/목공', name:'방수 석고보드 12.5T', brand:'KCC/국산', spec:'900×1800×12.5mm (녹색)', unit:'장', price:7500, grade:'공통' },
    { id:'mat_w_g05', category:'단열/목공', name:'방화 석고보드 12.5T', brand:'KCC/국산', spec:'900×1800×12.5mm (적색)', unit:'장', price:8000, grade:'공통' },
    { id:'mat_w_m01', category:'단열/목공', name:'MDF 9mm', brand:'유니드/동화', spec:'1220×2440×9mm', unit:'장', price:14000, grade:'공통' },
    { id:'mat_w_m02', category:'단열/목공', name:'MDF 12mm', brand:'유니드/동화', spec:'1220×2440×12mm', unit:'장', price:17000, grade:'공통' },
    { id:'mat_w_m03', category:'단열/목공', name:'MDF 15mm', brand:'유니드/동화', spec:'1220×2440×15mm', unit:'장', price:20000, grade:'공통' },
    { id:'mat_w_m04', category:'단열/목공', name:'MDF 18mm', brand:'유니드/동화', spec:'1220×2440×18mm', unit:'장', price:22000, grade:'공통' },
    { id:'mat_w_h01', category:'단열/목공', name:'합판 9mm', brand:'성창기업', spec:'1220×2440×9mm', unit:'장', price:14000, grade:'공통' },
    { id:'mat_w_h02', category:'단열/목공', name:'합판 12mm', brand:'성창기업', spec:'1220×2440×12mm', unit:'장', price:18000, grade:'공통' },
    { id:'mat_w_h03', category:'단열/목공', name:'합판 15mm', brand:'성창기업', spec:'1220×2440×15mm', unit:'장', price:21000, grade:'공통' },
    { id:'mat_w_h04', category:'단열/목공', name:'합판 18mm', brand:'성창기업', spec:'1220×2440×18mm', unit:'장', price:24000, grade:'공통' },
    { id:'mat_w_f01', category:'단열/목공', name:'영림 문틀 ABS 화이트', brand:'영림', spec:'단열문틀 / ABS 화이트', unit:'개', price:45000, grade:'기본형' },
    { id:'mat_w_f02', category:'단열/목공', name:'영림 문틀 ABS 우드', brand:'영림', spec:'단열문틀 / ABS 우드무늬', unit:'개', price:48000, grade:'기본형' },
    { id:'mat_w_f03', category:'단열/목공', name:'영림 문틀 원목', brand:'영림', spec:'원목 문틀', unit:'개', price:80000, grade:'고급형' },
    { id:'mat_w_d10', category:'단열/목공', name:'영림 도어 APA시리즈', brand:'영림', spec:'900×2100mm / ABS도어', unit:'개', price:180000, grade:'기본형' },
    { id:'mat_w_d11', category:'단열/목공', name:'영림 도어 APT시리즈', brand:'영림', spec:'900×2100mm / 방화문', unit:'개', price:250000, grade:'중급형' },
    { id:'mat_w_d12', category:'단열/목공', name:'영림 도어 원목시리즈', brand:'영림', spec:'900×2100mm / 원목도어', unit:'개', price:380000, grade:'고급형' },
    { id:'mat_w_d13', category:'단열/목공', name:'영림 도어 슬라이딩', brand:'영림', spec:'900×2100mm / 슬라이딩', unit:'개', price:320000, grade:'중급형' },
    { id:'mat_w_d14', category:'단열/목공', name:'영림 도어 포켓도어', brand:'영림', spec:'900×2100mm / 포켓슬라이딩', unit:'개', price:420000, grade:'고급형' },
    /* ── 전기/조명 ── */
    { id:'mat_e01', category:'전기/조명', name:'IV전선 2.5sq', brand:'국산', spec:'100m 롤', unit:'m', price:350, grade:'공통' },
    { id:'mat_e02', category:'전기/조명', name:'IV전선 4.0sq', brand:'국산', spec:'100m 롤', unit:'m', price:550, grade:'공통' },
    { id:'mat_e03', category:'전기/조명', name:'콘센트 (2구)', brand:'대림전기', spec:'250V/16A', unit:'개', price:2800, grade:'기본형' },
    { id:'mat_e04', category:'전기/조명', name:'스위치 (1구)', brand:'대림전기', spec:'250V', unit:'개', price:2500, grade:'기본형' },
    { id:'mat_e05', category:'전기/조명', name:'분전함 (24회로)', brand:'국산', spec:'ABS', unit:'식', price:85000, grade:'기본형' },
    { id:'mat_l01', category:'전기/조명', name:'거실등 LED', brand:'국산', spec:'50W / 주광색', unit:'개', price:85000, grade:'기본형' },
    { id:'mat_l02', category:'전기/조명', name:'방등 LED', brand:'국산', spec:'30W / 주광색', unit:'개', price:55000, grade:'기본형' },
    { id:'mat_l03', category:'전기/조명', name:'다운라이트 LED', brand:'국산', spec:'8W / φ100', unit:'개', price:18000, grade:'기본형' },
    /* ── 설비 ── */
    { id:'mat_p01', category:'설비', name:'냉온수 배관 (동관)', brand:'국산', spec:'15A 동관', unit:'m', price:4500, grade:'공통' },
    { id:'mat_p02', category:'설비', name:'양변기', brand:'대림바스', spec:'1피스 / 절수형', unit:'식', price:180000, grade:'기본형' },
    { id:'mat_p03', category:'설비', name:'세면기+배관', brand:'대림바스', spec:'500×400mm', unit:'식', price:95000, grade:'기본형' },
    { id:'mat_p04', category:'설비', name:'수전(냉온수 일체)', brand:'아메리칸스탠다드', spec:'크롬', unit:'개', price:65000, grade:'기본형' },
    { id:'mat_p05', category:'설비', name:'레미탈(방수용)', brand:'국산', spec:'25kg/포', unit:'포', price:5500, grade:'공통' },
    { id:'mat_p06', category:'설비', name:'시멘트', brand:'쌍용/한일', spec:'40kg/포', unit:'포', price:6000, grade:'공통' },
    { id:'mat_p07', category:'설비', name:'방수액', brand:'국산', spec:'18L 통', unit:'통', price:4000, grade:'공통' },
    { id:'mat_p08', category:'설비', name:'난방 분배기', brand:'국산', spec:'6구분배기', unit:'식', price:85000, grade:'기본형' },
    /* ── 타일 (녹수) ── */
    { id:'mat_t_ns01', category:'타일', name:'녹수 프라임1000 사각', brand:'녹수', spec:'457.2×457.2×3mm / 1box=16매,3.34㎡', unit:'box', price:38000, grade:'기본형' },
    { id:'mat_t_ns02', category:'타일', name:'녹수 프라임1000 우드600', brand:'녹수', spec:'600×600×3mm / 1box=9매,3.24㎡', unit:'box', price:40000, grade:'기본형' },
    { id:'mat_t_ns03', category:'타일', name:'녹수 프라임1000 우드186', brand:'녹수', spec:'186×940×3mm / 1box=19매,3.24㎡', unit:'box', price:40000, grade:'기본형' },
    { id:'mat_t_ns10', category:'타일', name:'녹수 에코솔2000 사각600', brand:'녹수', spec:'600×600×3mm / 1box=9매,3.24㎡', unit:'box', price:45000, grade:'중급형' },
    { id:'mat_t_ns11', category:'타일', name:'녹수 에코솔2000 사각457', brand:'녹수', spec:'457.2×457.2×3mm / 1box=16매,3.34㎡', unit:'box', price:45000, grade:'중급형' },
    { id:'mat_t_ns12', category:'타일', name:'녹수 에코솔2000 우드180', brand:'녹수', spec:'180×920×3mm / 1box=19매,3.15㎡', unit:'box', price:50000, grade:'중급형' },
    { id:'mat_t_ns13', category:'타일', name:'녹수 에코솔2000 헤링본', brand:'녹수', spec:'101.6×914.4×3mm / 1box=36매,3.34㎡', unit:'box', price:60000, grade:'중급형' },
    { id:'mat_t_ns20', category:'타일', name:'녹수 오키드3000 시그니처', brand:'녹수', spec:'457.2×914.4×3mm / 1box=8매,3.34㎡', unit:'box', price:55000, grade:'고급형' },
    { id:'mat_t_ns21', category:'타일', name:'녹수 오키드3000 일반우드', brand:'녹수', spec:'186×940×3mm / 1box=19매,3.15㎡', unit:'box', price:55000, grade:'고급형' },
    { id:'mat_t_ns22', category:'타일', name:'녹수 오키드3000 러스틱엣지', brand:'녹수', spec:'914.4×914.4×3mm / 1box=4매,5.02㎡', unit:'box', price:65000, grade:'고급형' },
    /* ── 타일 (동신) ── */
    { id:'mat_t_ds01', category:'타일', name:'동신 우드타일 AB.AD', brand:'동신', spec:'180×920×3mm / 1box=20매,3.24㎡', unit:'box', price:40000, grade:'기본형' },
    { id:'mat_t_ds02', category:'타일', name:'동신 마블/가죽600 DS', brand:'동신', spec:'600×600×3mm / 1box=9매,3.24㎡', unit:'box', price:40000, grade:'기본형' },
    { id:'mat_t_ds04', category:'타일', name:'동신 에코아트 ECO', brand:'동신', spec:'250×1050×3mm / 1box=4매,3.15㎡', unit:'box', price:65000, grade:'중급형' },
    { id:'mat_t_ds05', category:'타일', name:'동신 에코아트 헤링본 AH', brand:'동신', spec:'100×914.4×3mm / 1box=36매,3.24㎡', unit:'box', price:75000, grade:'고급형' },
    /* ── 타일 (LX) ── */
    { id:'mat_t_lx01', category:'타일', name:'LX 에코노플러스 장판(180×1200)', brand:'LX하우시스', spec:'180×1200×3mm / 1box=15매,3.24㎡', unit:'box', price:55000, grade:'기본형' },
    { id:'mat_t_lx02', category:'타일', name:'LX 에코노플러스 사각600', brand:'LX하우시스', spec:'600×600×3mm / 1box=9매,3.24㎡', unit:'box', price:55000, grade:'기본형' },
    { id:'mat_t_lx04', category:'타일', name:'LX 파인.5 사각600', brand:'LX하우시스', spec:'600×600×3mm / 1box=9매,3.24㎡', unit:'box', price:60000, grade:'중급형' },
    { id:'mat_t_lx08', category:'타일', name:'LX 하우스 헤링본', brand:'LX하우시스', spec:'92×450×3mm / 1box=80매,3.24㎡', unit:'box', price:85000, grade:'중급형' },
    /* ── 타일 (시트/장판) ── */
    { id:'mat_t_lx20', category:'타일', name:'LX 시트 뉴생텍 1.8T', brand:'LX하우시스', spec:'1830mm / 1.8T', unit:'평', price:38000, grade:'실속형' },
    { id:'mat_t_lx21', category:'타일', name:'LX 시트 은행목 2.0T', brand:'LX하우시스', spec:'1830mm / 2.0T', unit:'평', price:38000, grade:'기본형' },
    { id:'mat_t_lx22', category:'타일', name:'LX 지아자연애 2.2T', brand:'LX하우시스', spec:'1830mm / 2.2T', unit:'평', price:45000, grade:'기본형' },
    { id:'mat_t_lx23', category:'타일', name:'LX 지아사랑애 2.7T', brand:'LX하우시스', spec:'1830mm / 2.7T', unit:'평', price:65000, grade:'중급형' },
    { id:'mat_t_lx24', category:'타일', name:'LX 지아소리잔 4.5T', brand:'LX하우시스', spec:'1830mm / 4.5T', unit:'평', price:95000, grade:'고급형' },
    { id:'mat_t_kcc01', category:'타일', name:'KCC 슈그린 1.8T', brand:'KCC', spec:'1.8T / 35M롤', unit:'평', price:30000, grade:'실속형' },
    { id:'mat_t_kcc02', category:'타일', name:'KCC 슈플름 2.0T', brand:'KCC', spec:'2.0T / 30M롤', unit:'평', price:38000, grade:'기본형' },
    { id:'mat_t_kcc04', category:'타일', name:'KCC 도담 2.7T', brand:'KCC', spec:'2.7T / 25M롤', unit:'평', price:65000, grade:'중급형' },
    { id:'mat_t_kcc06', category:'타일', name:'KCC 휴가온 4.5T', brand:'KCC', spec:'4.5T / 20M롤', unit:'평', price:85000, grade:'고급형' },
    { id:'mat_t_kcc10', category:'타일', name:'KCC 센스타일', brand:'KCC', spec:'180×920×3mm / 1box=20매,3.24㎡', unit:'box', price:45000, grade:'기본형' },
    { id:'mat_t_kcc11', category:'타일', name:'KCC 센스타일 와이드우드', brand:'KCC', spec:'228.6×1219.2×3mm / 1box=12매,3.24㎡', unit:'box', price:50000, grade:'중급형' },
    /* ── 도배 ── */
    { id:'mat_d01', category:'도배', name:'합지 기본', brand:'범일', spec:'합지 / 흰색 계열', unit:'㎡', price:4500, grade:'실속형' },
    { id:'mat_d02', category:'도배', name:'디아망', brand:'LX하우시스', spec:'실크 / 표준', unit:'㎡', price:9800, grade:'기본형' },
    { id:'mat_d03', category:'도배', name:'디아망 포티스', brand:'LX하우시스', spec:'실크 / 고급', unit:'㎡', price:14000, grade:'중급형' },
    { id:'mat_d04', category:'도배', name:'베스띠', brand:'LX하우시스', spec:'실크 / 프리미엄', unit:'㎡', price:19500, grade:'고급형' },
    { id:'mat_d05', category:'도배', name:'실크 기본', brand:'신한벽지', spec:'실크 / 표준', unit:'㎡', price:8500, grade:'기본형' },
    /* ── 마루 (구정) ── */
    { id:'mat_fl_gj01', category:'마루', name:'구정 모던강마루 6mm', brand:'구정마루', spec:'95×800×6mm / 1box=35매,3.192㎡', unit:'box', price:95000, grade:'기본형' },
    { id:'mat_fl_gj02', category:'마루', name:'구정 그랑강마루 7.5mm', brand:'구정마루', spec:'94×800×7.5mm / 1box=43매,3.22㎡', unit:'box', price:100000, grade:'기본형' },
    { id:'mat_fl_gj05', category:'마루', name:'구정 프라임165', brand:'구정마루', spec:'165×1200×7.5mm / 1box=16매,3.17㎡', unit:'box', price:110000, grade:'기본형' },
    { id:'mat_fl_gj08', category:'마루', name:'구정 마르셀라 393×1200 UV', brand:'구정마루', spec:'393×1200×8.7mm / 1box=6매,2.83㎡', unit:'box', price:130000, grade:'중급형' },
    { id:'mat_fl_gj09', category:'마루', name:'구정 마르셀라 듀스UV 597×1210', brand:'구정마루', spec:'597×1210×8.7mm / 1box=4매,2.89㎡', unit:'box', price:155000, grade:'고급형' },
    { id:'mat_fl_gj30', category:'마루', name:'구정 원목 헤리티지 오크/애쉬 12mm', brand:'구정마루', spec:'190×1900×10.5mm / 1box=6매,2.166㎡', unit:'box', price:240000, grade:'프리미엄' },
    { id:'mat_fl_gj31', category:'마루', name:'구정 원목 헤리티지 탄화오크/월넛', brand:'구정마루', spec:'190×1900×10.5mm / 1box=6매,2.166㎡', unit:'box', price:270000, grade:'프리미엄' },
    /* ── 마루 (한솔) ── */
    { id:'mat_fl_hs01', category:'마루', name:'한솔 sb강마루 95mm', brand:'한솔', spec:'95×800×7.5mm / 1box=42매,3.192㎡', unit:'box', price:85000, grade:'기본형' },
    { id:'mat_fl_hs02', category:'마루', name:'한솔 sb강마루 143mm', brand:'한솔', spec:'143×1205×7.5mm / 1box=18매,3.08㎡', unit:'box', price:90000, grade:'기본형' },
    { id:'mat_fl_hs05', category:'마루', name:'한솔 sb스톤 590×1200', brand:'한솔', spec:'590×1200×7.5mm / 1box=4매,2.832㎡', unit:'box', price:120000, grade:'중급형' },
    /* ── 마루 (LX) ── */
    { id:'mat_fl_lx01', category:'마루', name:'LX 강마루 수퍼 20종 95mm', brand:'LX하우시스', spec:'95×800×6mm / 1box=42매,3.192㎡', unit:'box', price:105000, grade:'기본형' },
    { id:'mat_fl_lx02', category:'마루', name:'LX 강마루 와이드 12종 125mm', brand:'LX하우시스', spec:'125×1200×7.5mm / 1box=20매,3.0㎡', unit:'box', price:120000, grade:'중급형' },
    /* ── 마루 (이건) ── */
    { id:'mat_fl_eg01', category:'마루', name:'이건 사각타일마루 그린395', brand:'이건마루', spec:'395×895×10.5mm / 1box=1.58㎡', unit:'box', price:130000, grade:'고급형' },
    { id:'mat_fl_eg03', category:'마루', name:'이건 합판강 강그린165', brand:'이건마루', spec:'165×1200×10.5mm / 1box=1.584㎡', unit:'box', price:120000, grade:'중급형' },
    /* ── 마루 (동화) ── */
    { id:'mat_fl_dh01', category:'마루', name:'동화 강마루 나투스강 98mm', brand:'동화자연마루', spec:'98×800×7.5mm / 1box=3.192㎡', unit:'box', price:110000, grade:'기본형' },
    { id:'mat_fl_dh04', category:'마루', name:'동화 진마루 나투스진 퓨어어반 98mm', brand:'동화자연마루', spec:'98×815×7mm / 1box=3.116㎡', unit:'box', price:88000, grade:'기본형' },
    /* ── 필름 ── */
    { id:'mat_fi01', category:'필름', name:'단색 시트지', brand:'현대L&C', spec:'무광 단색', unit:'㎡', price:12000, grade:'기본형' },
    { id:'mat_fi02', category:'필름', name:'대리석 시트지', brand:'현대L&C', spec:'대리석 패턴', unit:'㎡', price:18000, grade:'중급형' },
    { id:'mat_fi03', category:'필름', name:'우드 시트지', brand:'현대L&C', spec:'우드 패턴', unit:'㎡', price:16000, grade:'기본형' },
    /* ── 도장 ── */
    { id:'mat_dp01', category:'도장', name:'실내 수성페인트', brand:'노루페인트', spec:'2회 도장 기준', unit:'㎡', price:4500, grade:'기본형' },
    { id:'mat_dp02', category:'도장', name:'페인트 (프리미엄)', brand:'벤자민무어', spec:'2회 도장 기준', unit:'㎡', price:12000, grade:'고급형' },
    /* ── 욕실위생금구류 ── */
    { id:'mat_b01', category:'욕실위생금구류', name:'양변기', brand:'대림바스', spec:'1피스 절수형', unit:'식', price:180000, grade:'기본형' },
    { id:'mat_b02', category:'욕실위생금구류', name:'세면기+배관', brand:'대림바스', spec:'500×400mm', unit:'식', price:95000, grade:'기본형' },
    { id:'mat_b03', category:'욕실위생금구류', name:'수전 (냉온수)', brand:'아메리칸스탠다드', spec:'크롬', unit:'개', price:65000, grade:'기본형' },
    { id:'mat_b04', category:'욕실위생금구류', name:'욕실 벽타일 기본', brand:'이노타일', spec:'300×600mm', unit:'㎡', price:15000, grade:'기본형' },
    { id:'mat_b05', category:'욕실위생금구류', name:'욕실 바닥타일 논슬립', brand:'이노타일', spec:'300×300mm 논슬립', unit:'㎡', price:12000, grade:'기본형' },
    { id:'mat_b06', category:'욕실위생금구류', name:'샤워기 세트', brand:'국산', spec:'헤드+호스+선반', unit:'식', price:45000, grade:'기본형' },
    { id:'mat_b07', category:'욕실위생금구류', name:'욕실 액세서리 세트', brand:'국산', spec:'수건걸이+휴지걸이+비누받침', unit:'식', price:35000, grade:'기본형' },
    { id:'mat_b08', category:'욕실위생금구류', name:'욕실장 (PVC)', brand:'국산', spec:'600×800mm', unit:'식', price:85000, grade:'기본형' },
    /* ── 주방가구 ── */
    { id:'mat_k01', category:'주방가구', name:'상판 인조대리석', brand:'(시공사)', spec:'두께 15mm', unit:'m', price:120000, grade:'기본형' },
    { id:'mat_k02', category:'주방가구', name:'상판 세라믹', brand:'(시공사)', spec:'두께 12mm', unit:'m', price:180000, grade:'중급형' },
    { id:'mat_k03', category:'주방가구', name:'싱크대 하부장', brand:'(시공사)', spec:'PET도어/스테인리스', unit:'식', price:850000, grade:'기본형' },
    /* ── 기타 ── */
    { id:'mat_g01', category:'기타', name:'보양재 (바닥)', brand:'(현장)', spec:'PE폼+골판지', unit:'식', price:120000, grade:'공통' },
    { id:'mat_g02', category:'기타', name:'실리콘 코킹재', brand:'국산', spec:'300ml 카트리지', unit:'개', price:3500, grade:'공통' },
    { id:'mat_g03', category:'기타', name:'마스킹 테이프', brand:'국산', spec:'50mm×30m', unit:'개', price:2000, grade:'공통' }
]; }

function getDefaultLabors() { return [
    /* ── 가설/철거 ── */
    { id:'lab_ch01', category:'가설/철거', name:'현장/공용부 보양', spec:'자재별도, 노무비', basis:'식당', unit:'식', price:170000 },
    { id:'lab_ch02', category:'가설/철거', name:'마루 철거', spec:'기존 강마루/마루 제거', basis:'평당', unit:'평', price:15000 },
    { id:'lab_ch03', category:'가설/철거', name:'장판 철거', spec:'기존 장판 제거', basis:'평당', unit:'평', price:5000 },
    { id:'lab_ch04', category:'가설/철거', name:'욕실 철거', spec:'욕실 1개소 전체 (타일+설비+방수)', basis:'식당', unit:'식', price:650000 },
    { id:'lab_ch05', category:'가설/철거', name:'싱크대 철거', spec:'상하부장+후드', basis:'식당', unit:'식', price:70000 },
    { id:'lab_ch06', category:'가설/철거', name:'거실 확장부 철거', spec:'발코니 확장부 철거', basis:'식당', unit:'식', price:300000 },
    { id:'lab_ch07', category:'가설/철거', name:'문/문틀 철거', spec:'문짝+문틀 제거', basis:'개당', unit:'개', price:30000 },
    { id:'lab_ch08', category:'가설/철거', name:'사다리차 임대', spec:'반나절 기준', basis:'식당', unit:'식', price:350000 },
    { id:'lab_ch09', category:'가설/철거', name:'용역/소운반', spec:'자재 층간 소운반 일식', basis:'식당', unit:'식', price:190000 },
    { id:'lab_ch10', category:'가설/철거', name:'폐기물 처리비', spec:'혼합 폐기물 / 1t 기준', basis:'식당', unit:'식', price:450000 },
    { id:'lab_ch11', category:'가설/철거', name:'전체 철거 (일식)', spec:'도배·마루·타일·몰딩 포함', basis:'식당', unit:'식', price:1500000 },
    /* ── 샷시 ── */
    { id:'lab_sh01', category:'샷시', name:'샷시 설치', spec:'창호 실측·설치·코킹', basis:'㎡당', unit:'㎡', price:50000 },
    { id:'lab_sh02', category:'샷시', name:'샷시 설치 (일식)', spec:'전체 창호 교체 일식', basis:'식당', unit:'식', price:800000 },
    /* ── 단열/목공 ── */
    { id:'lab_w01', category:'단열/목공', name:'경량 칸막이 시공', spec:'스터드+석고보드 양면', basis:'㎡당', unit:'㎡', price:55000 },
    { id:'lab_w02', category:'단열/목공', name:'천장 석고보드 시공', spec:'M바+석고보드', basis:'㎡당', unit:'㎡', price:45000 },
    { id:'lab_w03', category:'단열/목공', name:'몰딩 시공', spec:'실측·절단·고정', basis:'m당', unit:'m', price:6000 },
    { id:'lab_w04', category:'단열/목공', name:'붙박이장 제작', spec:'내부 선반 포함', basis:'식당', unit:'식', price:800000 },
    { id:'lab_w05', category:'단열/목공', name:'목공 전체 (일식)', spec:'칸막이+천장+몰딩', basis:'식당', unit:'식', price:1200000 },
    { id:'lab_w06', category:'단열/목공', name:'문틀/문짝 설치', spec:'영림 문틀+도어 설치', basis:'개당', unit:'개', price:80000 },
    /* ── 전기/조명 ── */
    { id:'lab_e01', category:'전기/조명', name:'전기 배선 (일식)', spec:'콘센트·스위치 배선 포함', basis:'식당', unit:'식', price:800000 },
    { id:'lab_e02', category:'전기/조명', name:'분전반 교체', spec:'기존 제거·신규 설치', basis:'식당', unit:'식', price:300000 },
    { id:'lab_e03', category:'전기/조명', name:'콘센트/스위치 교체', spec:'개당 설치 단가', basis:'개당', unit:'개', price:20000 },
    { id:'lab_l01', category:'전기/조명', name:'조명 교체', spec:'기존 제거·신규 설치', basis:'개당', unit:'개', price:25000 },
    { id:'lab_l02', category:'전기/조명', name:'조명 전체 (일식)', spec:'전 공간 교체 일식', basis:'식당', unit:'식', price:400000 },
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
    /* ── 욕실위생금구류 ── */
    { id:'lab_b01', category:'욕실위생금구류', name:'욕실 철거+타일+설비 전체', spec:'철거+방수+타일+설비 일식', basis:'식당', unit:'식', price:1800000 },
    { id:'lab_b02', category:'욕실위생금구류', name:'욕실 타일 시공', spec:'벽+바닥 타일 시공', basis:'식당', unit:'식', price:900000 },
    /* ── 주방가구 ── */
    { id:'lab_k01', category:'주방가구', name:'주방 상판 시공', spec:'실측·절단·설치', basis:'식당', unit:'식', price:250000 },
    { id:'lab_k02', category:'주방가구', name:'싱크대 조립·설치', spec:'상·하부장 포함', basis:'식당', unit:'식', price:400000 },
    { id:'lab_k03', category:'주방가구', name:'주방 전체 (일식)', spec:'상판+싱크+후드 설치', basis:'식당', unit:'식', price:700000 },
    /* ── 수납가구 ── */
    { id:'lab_g04s', category:'수납가구', name:'붙박이장 설치', spec:'제작+설치 일식', basis:'식당', unit:'식', price:800000 },
    { id:'lab_g05s', category:'수납가구', name:'현관장 설치', spec:'제작+설치 일식', basis:'식당', unit:'식', price:300000 },
    /* ── 기타 ── */
    { id:'lab_g01', category:'기타', name:'폐기물 처리', spec:'혼합 폐기물 / 5톤', basis:'식당', unit:'식', price:400000 },
    { id:'lab_g02', category:'기타', name:'입주 청소', spec:'전체 청소 일식', basis:'식당', unit:'식', price:450000 },
    { id:'lab_g03', category:'기타', name:'현장 보양', spec:'바닥·벽 보양재 설치', basis:'식당', unit:'식', price:200000 },
    { id:'lab_g04', category:'기타', name:'소운반', spec:'자재 층간 소운반', basis:'식당', unit:'식', price:150000 },
    { id:'lab_g05', category:'기타', name:'현장 관리', spec:'현장 소장 파견·관리', basis:'식당', unit:'식', price:500000 }
]; }

function getDefaultRates() {
    return { 간접노무비:3.11, 산재보험:3.545, 건강보험:3.545, 연금보험:4.5, 고용보험:0.79, 산업안전보건관리비:3.11, 일반관리비:1.5, 기업이윤:10, 부가세:10 };
}

function loadMaterials() {
    try { const s=localStorage.getItem(STORAGE_KEYS.MATERIALS); return s?JSON.parse(s):getDefaultMaterials(); } catch { return getDefaultMaterials(); }
}
function saveMaterials(list) { localStorage.setItem(STORAGE_KEYS.MATERIALS,JSON.stringify(list)); }

function loadLabors() {
    try { const s=localStorage.getItem(STORAGE_KEYS.LABORS); return s?JSON.parse(s):getDefaultLabors(); } catch { return getDefaultLabors(); }
}
function saveLabors(list) { localStorage.setItem(STORAGE_KEYS.LABORS,JSON.stringify(list)); }

function loadRates() {
    try { const s=localStorage.getItem(STORAGE_KEYS.RATES); return s?JSON.parse(s):getDefaultRates(); } catch { return getDefaultRates(); }
}
function saveRates(obj) { localStorage.setItem(STORAGE_KEYS.RATES,JSON.stringify(obj)); }

function genId(pfx) { return pfx+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6); }

/* ═══════════════════════════════════════════════════════
   bootstrap
═══════════════════════════════════════════════════════ */
(function bootstrap() {
    // 자재·노무·요율: localStorage에 이미 있으면 절대 덮어쓰지 않음
    if (!localStorage.getItem(STORAGE_KEYS.MATERIALS)) saveMaterials(getDefaultMaterials());
    if (!localStorage.getItem(STORAGE_KEYS.LABORS))    saveLabors(getDefaultLabors());
    if (!localStorage.getItem(STORAGE_KEYS.RATES))     saveRates(getDefaultRates());
    // 공정·단위: localStorage에 없을 때만 기본값 세팅
    if (!localStorage.getItem(STORAGE_KEYS.PROCESSES)) localStorage.setItem(STORAGE_KEYS.PROCESSES, JSON.stringify(getDefaultProcesses()));
    if (!localStorage.getItem(STORAGE_KEYS.UNITS))     localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(getDefaultUnits()));
    // DB 동기화는 비동기 백그라운드로만 실행 (덮어쓰기 안전장치 있음)
    initSettingsFromDB().catch(e => console.warn('DB 설정 동기화 실패', e));
})();
