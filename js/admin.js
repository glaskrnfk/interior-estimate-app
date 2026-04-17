// ========================================
// 관리자 페이지 - 자재 및 요율 관리
// ========================================

let currentMaterials = {};
let currentCategory = 'all';
let editingMaterialId = null;

// ========================================
// 초기화
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    initializeAdmin();
});

function initializeAdmin() {
    // 자재 데이터 로드
    currentMaterials = loadMaterialsFromStorage();
    
    // 화면 렌더링
    renderMaterialsTable();
    loadRatesForm();
    
    // 실시간 계산 이벤트
    var matCostEl = document.getElementById('mat_materialCost');
    var labCostEl  = document.getElementById('mat_laborCost');
    if (matCostEl) matCostEl.addEventListener('input', updateMaterialTotal);
    if (labCostEl)  labCostEl.addEventListener('input', updateMaterialTotal);
}

// ========================================
// 탭 관리
// ========================================

function showTab(tabName) {
    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 모든 섹션 숨기기
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // 선택한 탭 활성화
    event.target.closest('.tab-btn').classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ========================================
// 자재 테이블 렌더링
// ========================================

function renderMaterialsTable() {
    const tbody = document.getElementById('materialsTableBody');
    tbody.innerHTML = '';
    
    const categories = Object.keys(currentMaterials);
    
    categories.forEach(category => {
        // 카테고리 필터 적용
        if (currentCategory !== 'all' && currentCategory !== category) {
            return;
        }
        
        currentMaterials[category].forEach(material => {
            const total = material.materialCost + material.laborCost;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${category}</td>
                <td>${material.name}</td>
                <td>${material.brand || '-'}</td>
                <td>${material.series || '-'}</td>
                <td>${material.grade}</td>
                <td>${material.unit}</td>
                <td>${formatCurrency(material.materialCost)}</td>
                <td>${formatCurrency(material.laborCost)}</td>
                <td><strong>${formatCurrency(total)}</strong></td>
                <td>
                    <button class="btn btn-secondary" onclick="editMaterial('${category}', '${material.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-secondary" onclick="deleteMaterial('${category}', '${material.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    });
    
    if (tbody.children.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">등록된 자재가 없습니다.</td></tr>';
    }
}

function filterMaterials() {
    currentCategory = document.getElementById('categoryFilter').value;
    renderMaterialsTable();
}

// ========================================
// 자재 추가/수정 모달
// ========================================

function showAddMaterialModal() {
    editingMaterialId = null;
    document.getElementById('modalTitle').textContent = '새 자재 추가';
    document.getElementById('materialForm').reset();
    document.getElementById('editingId').value = '';
    openModal('materialModal');
}

function editMaterial(category, materialId) {
    const material = currentMaterials[category].find(m => m.id === materialId);
    if (!material) return;
    
    editingMaterialId = `${category}|${materialId}`;
    document.getElementById('modalTitle').textContent = '자재 수정';
    
    document.getElementById('editingId').value = editingMaterialId;
    document.getElementById('mat_category').value = category;
    document.getElementById('mat_name').value = material.name;
    document.getElementById('mat_brand').value = material.brand || '';
    document.getElementById('mat_series').value = material.series || '';
    document.getElementById('mat_grade').value = material.grade;
    document.getElementById('mat_unit').value = material.unit;
    document.getElementById('mat_materialCost').value = material.materialCost;
    document.getElementById('mat_laborCost').value = material.laborCost;
    updateMaterialTotal();
    
    openModal('materialModal');
}

function saveMaterial(event) {
    event.preventDefault();
    
    const category = document.getElementById('mat_category').value;
    const name = document.getElementById('mat_name').value;
    const brand = document.getElementById('mat_brand').value;
    const series = document.getElementById('mat_series').value;
    const grade = document.getElementById('mat_grade').value;
    const unit = document.getElementById('mat_unit').value;
    const materialCost = parseFloat(document.getElementById('mat_materialCost').value) || 0;
    const laborCost = parseFloat(document.getElementById('mat_laborCost').value) || 0;
    
    const materialData = {
        name,
        brand,
        series,
        unit,
        materialCost,
        laborCost,
        grade
    };
    
    if (editingMaterialId) {
        // 수정
        const [oldCategory, oldId] = editingMaterialId.split('|');
        const index = currentMaterials[oldCategory].findIndex(m => m.id === oldId);
        
        if (index !== -1) {
            materialData.id = oldId;
            
            // 카테고리 변경된 경우
            if (oldCategory !== category) {
                currentMaterials[oldCategory].splice(index, 1);
                if (!currentMaterials[category]) {
                    currentMaterials[category] = [];
                }
                currentMaterials[category].push(materialData);
            } else {
                currentMaterials[oldCategory][index] = materialData;
            }
        }
    } else {
        // 추가
        materialData.id = generateId();
        
        if (!currentMaterials[category]) {
            currentMaterials[category] = [];
        }
        currentMaterials[category].push(materialData);
    }
    
    // 저장
    if (saveMaterialsToStorage(currentMaterials)) {
        alert('저장되었습니다.');
        closeModal('materialModal');
        renderMaterialsTable();
    }
}

function deleteMaterial(category, materialId) {
    if (!confirm('이 자재를 삭제하시겠습니까?')) return;
    
    const index = currentMaterials[category].findIndex(m => m.id === materialId);
    if (index !== -1) {
        currentMaterials[category].splice(index, 1);
        
        if (saveMaterialsToStorage(currentMaterials)) {
            alert('삭제되었습니다.');
            renderMaterialsTable();
        }
    }
}

function updateMaterialTotal() {
    const materialCost = parseFloat(document.getElementById('mat_materialCost').value) || 0;
    const laborCost = parseFloat(document.getElementById('mat_laborCost').value) || 0;
    document.getElementById('mat_total').value = formatCurrency(materialCost + laborCost);
}

// ========================================
// 요율 관리
// ========================================

function loadRatesForm() {
    const rates = loadRatesFromStorage();
    
    document.getElementById('rate_indirectLabor').value = rates.간접노무비;
    document.getElementById('rate_industrialInsurance').value = rates.산재보험;
    document.getElementById('rate_healthInsurance').value = rates.건강보험;
    document.getElementById('rate_pensionInsurance').value = rates.연금보험;
    document.getElementById('rate_employmentInsurance').value = rates.고용보험;
    document.getElementById('rate_safetyManagement').value = rates.산업안전보건관리비;
    document.getElementById('rate_generalAdmin').value = rates.일반관리비;
    document.getElementById('rate_profit').value = rates.기업이윤;
    document.getElementById('rate_vat').value = rates.부가세;
}

function saveRates() {
    const rates = {
        간접노무비: parseFloat(document.getElementById('rate_indirectLabor').value),
        산재보험: parseFloat(document.getElementById('rate_industrialInsurance').value),
        건강보험: parseFloat(document.getElementById('rate_healthInsurance').value),
        연금보험: parseFloat(document.getElementById('rate_pensionInsurance').value),
        고용보험: parseFloat(document.getElementById('rate_employmentInsurance').value),
        산업안전보건관리비: parseFloat(document.getElementById('rate_safetyManagement').value),
        일반관리비: parseFloat(document.getElementById('rate_generalAdmin').value),
        기업이윤: parseFloat(document.getElementById('rate_profit').value),
        부가세: parseFloat(document.getElementById('rate_vat').value)
    };
    
    if (saveRatesToStorage(rates)) {
        alert('요율이 저장되었습니다.');
    }
}

// ========================================
// 전체 저장
// ========================================

function saveAllData() {
    const materialsSaved = saveMaterialsToStorage(currentMaterials);
    
    const rates = {
        간접노무비: parseFloat((document.getElementById('rate_indirectLabor') || {}).value || 3.11),
        산재보험: parseFloat((document.getElementById('rate_industrialInsurance') || {}).value || 3.545),
        건강보험: parseFloat((document.getElementById('rate_healthInsurance') || {}).value || 3.545),
        연금보험: parseFloat((document.getElementById('rate_pensionInsurance') || {}).value || 4.5),
        고용보험: parseFloat((document.getElementById('rate_employmentInsurance') || {}).value || 0.79),
        산업안전보건관리비: parseFloat((document.getElementById('rate_safetyManagement') || {}).value || 3.11),
        일반관리비: parseFloat((document.getElementById('rate_generalAdmin') || {}).value || 1.5),
        기업이윤: parseFloat((document.getElementById('rate_profit') || {}).value || 10),
        부가세: parseFloat((document.getElementById('rate_vat') || {}).value || 10)
    };
    const ratesSaved = saveRatesToStorage(rates);
    
    if (materialsSaved && ratesSaved) {
        alert('모든 데이터가 저장되었습니다.');
    }
}

// ========================================
// 모달 관리
// ========================================

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ========================================
// 유틸리티
// ========================================

function generateId() {
    return 'mat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatCurrency(amount) {
    return Math.round(amount).toLocaleString('ko-KR') + '원';
}
