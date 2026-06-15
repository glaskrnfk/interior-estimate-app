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
    { id:'mat_ch_01', category:'가설/철거', name:'현장/공용부 보양재', brand:'일반', spec:'PE폼+골판지 1식', unit:'식', price:70000, grade:'공통' },
    { id:'mat_d01', category:'도배', name:'합지 기본', brand:'범일', spec:'합지 / 흰색 계열', unit:'㎡', price:4500, grade:'실속형' },
    { id:'mat_d02', category:'도배', name:'디아망', brand:'LX하우시스', spec:'실크 / 표준', unit:'㎡', price:9800, grade:'기본형' },
    { id:'mat_d03', category:'도배', name:'디아망 포티스', brand:'LX하우시스', spec:'실크 / 고급', unit:'㎡', price:14000, grade:'중급형' },
    { id:'mat_d04', category:'도배', name:'베스띠', brand:'LX하우시스', spec:'실크 / 프리미엄', unit:'㎡', price:19500, grade:'고급형' },
    { id:'mat_fi01', category:'필름', name:'단색 시트지', brand:'현대L&C', spec:'무광 단색', unit:'㎡', price:12000, grade:'기본형' },
    { id:'mat_l01', category:'전기/조명', name:'거실등 LED', brand:'국산', spec:'50W / 주광색', unit:'개', price:85000, grade:'기본형' },
    { id:'mat_l02', category:'전기/조명', name:'방등 LED', brand:'국산', spec:'30W / 주광색', unit:'개', price:55000, grade:'기본형' },
    { id:'mat_l03', category:'전기/조명', name:'다운라이트 LED', brand:'국산', spec:'8W / φ100', unit:'개', price:18000, grade:'기본형' },
    { id:'mat_k01', category:'주방가구', name:'상판 인조대리석', brand:'(시공사)', spec:'두께 15mm', unit:'m', price:120000, grade:'기본형' },
    { id:'mat_b01', category:'욕실위생금구류', name:'양변기', brand:'대림바스', spec:'1피스 절수형', unit:'식', price:180000, grade:'기본형' },
    { id:'mat_g01', category:'기타', name:'실리콘 코킹재', brand:'국산', spec:'300ml', unit:'개', price:3500, grade:'공통' }
]; }

function getDefaultLabors() { return [
    { id:'lab_ch01', category:'가설/철거', name:'현장/공용부 보양', spec:'자재별도, 노무비', basis:'식당', unit:'식', price:170000 },
    { id:'lab_ch02', category:'가설/철거', name:'마루 철거', spec:'기존 마루 제거', basis:'평당', unit:'평', price:15000 },
    { id:'lab_ch10', category:'가설/철거', name:'폐기물 처리비', spec:'혼합 폐기물 / 1t', basis:'식당', unit:'식', price:450000 },
    { id:'lab_d01', category:'도배', name:'도배 시공 (합지)', spec:'합지 전면', basis:'㎡당', unit:'㎡', price:5000 },
    { id:'lab_d02', category:'도배', name:'도배 시공 (실크)', spec:'실크 전면', basis:'㎡당', unit:'㎡', price:8000 },
    { id:'lab_fl01', category:'마루', name:'마루 시공 (접착식)', spec:'강마루·강화마루', basis:'㎡당', unit:'㎡', price:15000 },
    { id:'lab_fl02', category:'마루', name:'마루 시공 (일식)', spec:'걸레받이 포함', basis:'식당', unit:'식', price:700000 },
    { id:'lab_g02', category:'기타', name:'입주 청소', spec:'전체 청소 일식', basis:'식당', unit:'식', price:450000 },
    { id:'lab_g04', category:'기타', name:'소운반', spec:'자재 층간 소운반', basis:'식당', unit:'식', price:150000 }
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
