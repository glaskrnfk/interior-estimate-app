// ============================================================
//  storage.js  v8.0 — FULL DB MIGRATION
//  - 모든 데이터(자재/노무/요율/공정/로고/도장/회사정보)를
//    Supabase DB에 저장. localStorage는 캐시 전용(없어도 동작).
//  - 다른 PC/기기에서 같은 링크로 열어도 100% 동일 데이터.
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
   Supabase 공통 helper
═══════════════════════════════════════════════════════ */
const SB_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
};

async function sbSelect(table, query = '') {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: SB_HEADERS });
        if (!res.ok) throw new Error(`${table} select failed: ${res.status}`);
        return await res.json();
    } catch (e) { console.error('[DB] sbSelect 오류', table, e); return []; }
}

async function sbUpsert(table, rows) {
    try {
        const body = Array.isArray(rows) ? rows : [rows];
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: { ...SB_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=representation' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`${table} upsert failed: ${res.status}`);
        return await res.json();
    } catch (e) { console.error('[DB] sbUpsert 오류', table, e); throw e; }
}

async function sbDelete(table, id) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers: SB_HEADERS });
    } catch (e) { console.error('[DB] sbDelete 오류', table, e); }
}

async function sbGetOne(table, id) {
    const rows = await sbSelect(table, `id=eq.${id}&limit=1`);
    return rows[0] || null;
}

/* ═══════════════════════════════════════════════════════
   인메모리 캐시 — 페이지 내에서만 유지, 매번 DB 재조회 방지
═══════════════════════════════════════════════════════ */
let _cache = { materials: null, labors: null, rates: null, settings: null };

function invalidateCache(key) {
    if (key) _cache[key] = null;
    else _cache = { materials: null, labors: null, rates: null, settings: null };
}

/* ═══════════════════════════════════════════════════════
   자재 마스터 — DB 기반
═══════════════════════════════════════════════════════ */
async function loadMaterialsAsync() {
    if (_cache.materials) return _cache.materials;
    const rows = await sbSelect('master_materials', 'order=sort_order.asc,name.asc');
    _cache.materials = rows;
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(rows)); // 캐시 백업
    return rows;
}

// 동기 함수 호환용 — 기존 코드가 loadMaterials()를 동기로 호출하는 경우를 위해
// 캐시가 있으면 즉시 반환, 없으면 localStorage 백업 사용 (페이지 로드 시 initMasterData가 먼저 캐시를 채워야 함)
function loadMaterials() {
    if (_cache.materials) return _cache.materials;
    try {
        const s = localStorage.getItem(STORAGE_KEYS.MATERIALS);
        return s ? JSON.parse(s) : [];
    } catch { return []; }
}

async function saveMaterials(list) {
    _cache.materials = list;
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(list));
    // 전체 동기화: 기존 항목 업데이트 + 신규 삽입 (delete-and-insert 방식은 위험하므로 upsert)
    // PostgREST 배열 upsert는 모든 객체가 동일한 키 집합을 가져야 하므로 컬럼을 명시적으로 고정한다.
    if (list.length > 0) {
        const rows = list.map((m, i) => ({
            id       : m.id,
            category : m.category || '',
            name     : m.name || '',
            brand    : m.brand || '',
            spec     : m.spec || '',
            grade    : m.grade || '',
            unit     : m.unit || '',
            price    : Number(m.price) || 0,
            sort_order: i
        }));
        await sbUpsert('master_materials', rows);
    }
}

async function addMaterial(item) {
    if (!item.id) item.id = genId('mat');
    const list = loadMaterials();
    list.push(item);
    await saveMaterials(list);
    return item.id;
}

async function deleteMaterial(id) {
    const list = loadMaterials().filter(m => m.id !== id);
    _cache.materials = list;
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(list));
    await sbDelete('master_materials', id);
}

/* ═══════════════════════════════════════════════════════
   노무 마스터 — DB 기반
═══════════════════════════════════════════════════════ */
async function loadLaborsAsync() {
    if (_cache.labors) return _cache.labors;
    const rows = await sbSelect('master_labors', 'order=sort_order.asc,name.asc');
    _cache.labors = rows;
    localStorage.setItem(STORAGE_KEYS.LABORS, JSON.stringify(rows));
    return rows;
}

function loadLabors() {
    if (_cache.labors) return _cache.labors;
    try {
        const s = localStorage.getItem(STORAGE_KEYS.LABORS);
        return s ? JSON.parse(s) : [];
    } catch { return []; }
}

async function saveLabors(list) {
    _cache.labors = list;
    localStorage.setItem(STORAGE_KEYS.LABORS, JSON.stringify(list));
    // PostgREST 배열 upsert는 모든 객체가 동일한 키 집합을 가져야 하므로 컬럼을 명시적으로 고정한다.
    if (list.length > 0) {
        const rows = list.map((l, i) => ({
            id       : l.id,
            category : l.category || '',
            name     : l.name || '',
            spec     : l.spec || '',
            basis    : l.basis || '',
            unit     : l.unit || '',
            price    : Number(l.price) || 0,
            sort_order: i
        }));
        await sbUpsert('master_labors', rows);
    }
}

async function addLabor(item) {
    if (!item.id) item.id = genId('lab');
    const list = loadLabors();
    list.push(item);
    await saveLabors(list);
    return item.id;
}

async function deleteLabor(id) {
    const list = loadLabors().filter(l => l.id !== id);
    _cache.labors = list;
    localStorage.setItem(STORAGE_KEYS.LABORS, JSON.stringify(list));
    await sbDelete('master_labors', id);
}

/* ═══════════════════════════════════════════════════════
   요율 — DB 기반
═══════════════════════════════════════════════════════ */
function getDefaultRates() {
    return { 간접노무비:3.11, 산재보험:3.545, 건강보험:3.545, 연금보험:4.5, 고용보험:0.79, 산업안전보건관리비:3.11, 일반관리비:1.5, 기업이윤:10, 부가세:10 };
}

async function loadRatesAsync() {
    if (_cache.rates) return _cache.rates;
    const row = await sbGetOne('master_rates', 'default');
    const rates = (row && row.rates && Object.keys(row.rates).length > 0) ? row.rates : getDefaultRates();
    _cache.rates = rates;
    localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify(rates));
    return rates;
}

function loadRates() {
    if (_cache.rates) return _cache.rates;
    try {
        const s = localStorage.getItem(STORAGE_KEYS.RATES);
        return s ? JSON.parse(s) : getDefaultRates();
    } catch { return getDefaultRates(); }
}

async function saveRates(obj) {
    _cache.rates = obj;
    localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify(obj));
    await sbUpsert('master_rates', { id: 'default', rates: obj, updated_at: new Date().toISOString() });
}

/* ═══════════════════════════════════════════════════════
   company_settings — 로고/도장/공정/단위/회사정보/VAT
═══════════════════════════════════════════════════════ */
async function loadSettingsAsync() {
    if (_cache.settings) return _cache.settings;
    const row = await sbGetOne('company_settings', 'default');
    _cache.settings = row || {};
    if (row) {
        if (row.logo_base64)  localStorage.setItem(STORAGE_KEYS.LOGO,  row.logo_base64);
        if (row.stamp_base64) localStorage.setItem(STORAGE_KEYS.STAMP, row.stamp_base64);
        if (row.company && Object.keys(row.company).length > 0)
            localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(row.company));
        if (row.processes && row.processes.length > 0)
            localStorage.setItem(STORAGE_KEYS.PROCESSES, JSON.stringify(row.processes));
        if (row.units && row.units.length > 0)
            localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(row.units));
        if (row.vat_mode) localStorage.setItem(STORAGE_KEYS.VAT_MODE, row.vat_mode);
    }
    return _cache.settings;
}

async function patchSettings(patch) {
    invalidateCache('settings');
    await sbUpsert('company_settings', { id: 'default', updated_at: new Date().toISOString(), ...patch });
}

/* ── 로고/도장 ─────────────────────────────────────── */
function loadLogo()  { return localStorage.getItem(STORAGE_KEYS.LOGO)  || ''; }
function loadStamp() { return localStorage.getItem(STORAGE_KEYS.STAMP) || ''; }
async function saveLogo(b64)  { localStorage.setItem(STORAGE_KEYS.LOGO, b64);  await patchSettings({ logo_base64: b64 }); }
async function saveStamp(b64) { localStorage.setItem(STORAGE_KEYS.STAMP, b64); await patchSettings({ stamp_base64: b64 }); }

/* ── VAT 모드 ─────────────────────────────────────── */
function loadVatMode() { return localStorage.getItem(STORAGE_KEYS.VAT_MODE) || 'include'; }
async function saveVatMode(mode) { localStorage.setItem(STORAGE_KEYS.VAT_MODE, mode); await patchSettings({ vat_mode: mode }); }

/* ── 시공사 정보 ──────────────────────────────────── */
function loadCompany() {
    try { const s = localStorage.getItem(STORAGE_KEYS.COMPANY); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
}
function loadCompanyInfo() { return loadCompany(); }
async function saveCompany(obj) { localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(obj)); await patchSettings({ company: obj }); }

/* ── 단위 마스터 ──────────────────────────────────── */
function getDefaultUnits() { return ['㎡','m','개','식','품','장','롤','box','평','단','포','세트','조','kg','L','통']; }
function loadUnits() {
    try { const s = localStorage.getItem(STORAGE_KEYS.UNITS); return s ? JSON.parse(s) : getDefaultUnits(); }
    catch { return getDefaultUnits(); }
}
async function saveUnits(list) { localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(list)); await patchSettings({ units: list }); }

/* ═══════════════════════════════════════════════════════
   공정 카테고리 — DB 기반
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
        { id:'proc_14', num:'14', name:'공조/시스템에어컨' },
        { id:'proc_15', num:'15', name:'기타' }
    ];
}

function loadProcesses() {
    try { const s = localStorage.getItem(STORAGE_KEYS.PROCESSES); return s ? JSON.parse(s) : getDefaultProcesses(); }
    catch { return getDefaultProcesses(); }
}

async function saveProcesses(list) {
    localStorage.setItem(STORAGE_KEYS.PROCESSES, JSON.stringify(list));
    await patchSettings({ processes: list });
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
    const hasMis = [...loadMaterials(), ...loadLabors()].some(x => x.category === '미분류');
    if (hasMis && !names.includes('미분류')) names.push('미분류');
    return names;
}

async function renameProcInItems(oldName, newName) {
    const mats = loadMaterials().map(m => { if (m.category === oldName) m.category = newName; return m; });
    await saveMaterials(mats);
    const labs = loadLabors().map(l => { if (l.category === oldName) l.category = newName; return l; });
    await saveLabors(labs);
}

async function orphanProcItems(procName) {
    const UNCAT = '미분류';
    const mats = loadMaterials().map(m => { if (m.category === procName) m.category = UNCAT; return m; });
    await saveMaterials(mats);
    const labs = loadLabors().map(l => { if (l.category === procName) l.category = UNCAT; return l; });
    await saveLabors(labs);
}

/* ═══════════════════════════════════════════════════════
   계약서 CRUD — Supabase contracts 테이블
═══════════════════════════════════════════════════════ */
function genContractId() { return 'cont_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

async function saveContract(contractObj) {
    if (!contractObj.id) contractObj.id = genContractId();
    contractObj.updated_at = new Date().toISOString();
    if (!contractObj.created_at) contractObj.created_at = contractObj.updated_at;
    await sbUpsert('contracts', contractObj);
    return contractObj.id;
}

async function loadContracts() { return await sbSelect('contracts', 'order=created_at.desc'); }
async function loadContract(id) { return await sbGetOne('contracts', id); }
async function deleteContract(id) { await sbDelete('contracts', id); }

/* ═══════════════════════════════════════════════════════
   genId
═══════════════════════════════════════════════════════ */
function genId(pfx) { return pfx + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

/* ═══════════════════════════════════════════════════════
   초기화 — 페이지 로드 시 DB에서 전체 데이터를 가져와
   캐시·localStorage를 채운다. 모든 페이지(index/admin)에서
   가장 먼저 await initMasterData()를 호출해야 한다.
═══════════════════════════════════════════════════════ */
async function initMasterData() {
    try {
        await Promise.all([
            loadMaterialsAsync(),
            loadLaborsAsync(),
            loadRatesAsync(),
            loadSettingsAsync()
        ]);
        console.log('[storage] DB 초기 동기화 완료 — 자재', _cache.materials.length, '건 / 노무', _cache.labors.length, '건');
    } catch (e) {
        console.error('[storage] DB 동기화 실패, localStorage 캐시로 동작', e);
    }
}

// 자동 실행 (스크립트 로드 시 즉시 백그라운드 시작)
// 페이지에서 데이터 사용 전 await initMasterData()를 명시적으로 호출하는 것을 권장하지만,
// 호출하지 않는 기존 코드와의 호환을 위해 여기서도 한 번 실행한다.
initMasterData();
