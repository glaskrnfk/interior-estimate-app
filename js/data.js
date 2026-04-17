// ========================================
// 자재 마스터 데이터
// ========================================

const MATERIALS_DATA = {
    도배: [
        {
            id: 'wallpaper_01',
            name: '디아망 포티스',
            brand: 'LX하우시스',
            series: '디아망 시리즈',
            unit: '㎡',
            materialCost: 18000,
            laborCost: 12000,
            grade: '중급형'
        },
        {
            id: 'wallpaper_02',
            name: '베스띠',
            brand: 'LX하우시스',
            series: '베스띠 시리즈',
            unit: '㎡',
            materialCost: 22000,
            laborCost: 12000,
            grade: '고급형'
        },
        {
            id: 'wallpaper_03',
            name: '실크벽지',
            brand: '신한벽지',
            series: '실크 시리즈',
            unit: '㎡',
            materialCost: 15000,
            laborCost: 10000,
            grade: '기본형'
        }
    ],
    마루: [
        {
            id: 'floor_01',
            name: '동화 자연마루',
            brand: '동화자연마루',
            series: '프리미엄 강마루',
            unit: '㎡',
            materialCost: 55000,
            laborCost: 25000,
            grade: '중급형'
        },
        {
            id: 'floor_02',
            name: '구정 강마루',
            brand: '구정마루',
            series: '프로방스 시리즈',
            unit: '㎡',
            materialCost: 48000,
            laborCost: 22000,
            grade: '기본형'
        },
        {
            id: 'floor_03',
            name: '한솔 원목마루',
            brand: '한솔홈데코',
            series: '내추럴 원목',
            unit: '㎡',
            materialCost: 85000,
            laborCost: 35000,
            grade: '고급형'
        }
    ],
    타일: [
        {
            id: 'tile_01',
            name: '욕실 벽타일',
            brand: '이노타일',
            series: '300x600',
            unit: '㎡',
            materialCost: 35000,
            laborCost: 40000,
            grade: '중급형'
        },
        {
            id: 'tile_02',
            name: '욕실 바닥타일',
            brand: '이노타일',
            series: '300x300 논슬립',
            unit: '㎡',
            materialCost: 28000,
            laborCost: 35000,
            grade: '중급형'
        },
        {
            id: 'tile_03',
            name: '주방 벽타일',
            brand: 'KCC타일',
            series: '200x200',
            unit: '㎡',
            materialCost: 30000,
            laborCost: 38000,
            grade: '기본형'
        }
    ],
    주방: [
        {
            id: 'kitchen_01',
            name: '주방 상판 교체',
            brand: '인조대리석 (폴리머)',
            series: '프리미엄 폴리머',
            unit: '식',
            materialCost: 450000,
            laborCost: 200000,
            grade: '중급형'
        },
        {
            id: 'kitchen_02',
            name: '싱크볼 교체',
            brand: '국산 스테인리스',
            series: '언더싱크',
            unit: '식',
            materialCost: 180000,
            laborCost: 80000,
            grade: '기본형'
        }
    ],
    조명: [
        {
            id: 'light_01',
            name: '거실 LED 조명',
            brand: '국산 LED',
            series: '50W 주광색',
            unit: '식',
            materialCost: 120000,
            laborCost: 50000,
            grade: '기본형'
        },
        {
            id: 'light_02',
            name: '방 LED 조명',
            brand: '국산 LED',
            series: '30W 주광색',
            unit: '식',
            materialCost: 80000,
            laborCost: 40000,
            grade: '기본형'
        }
    ],
    철거: [
        {
            id: 'demo_01',
            name: '기존 마루 철거',
            brand: '-',
            series: '-',
            unit: '㎡',
            materialCost: 0,
            laborCost: 8000,
            grade: '공통'
        },
        {
            id: 'demo_02',
            name: '기존 벽지 철거',
            brand: '-',
            series: '-',
            unit: '㎡',
            materialCost: 0,
            laborCost: 3000,
            grade: '공통'
        }
    ],
    기타: [
        {
            id: 'etc_01',
            name: '폐기물 처리',
            brand: '-',
            series: '-',
            unit: '식',
            materialCost: 0,
            laborCost: 350000,
            grade: '공통'
        },
        {
            id: 'etc_02',
            name: '현장 보양',
            brand: '-',
            series: '-',
            unit: '식',
            materialCost: 150000,
            laborCost: 100000,
            grade: '공통'
        },
        {
            id: 'etc_03',
            name: '입주 청소',
            brand: '-',
            series: '-',
            unit: '식',
            materialCost: 0,
            laborCost: 400000,
            grade: '공통'
        }
    ]
};

// ========================================
// 공사 유형별 템플릿
// ========================================

const CONSTRUCTION_TEMPLATES = {
    '전체': {
        name: '전체 리모델링',
        categories: ['철거', '도배', '마루', '타일', '주방', '조명', '기타']
    },
    '부분': {
        name: '부분 리모델링',
        categories: ['도배', '마루', '기타']
    },
    '주방욕실': {
        name: '주방+욕실',
        categories: ['타일', '주방', '기타']
    }
};

// ========================================
// 수량 산출 기준
// ========================================

function calculateQuantities(projectData) {
    const areaExclusive = parseFloat(projectData.areaExclusive) || 28;
    const areaSupply = parseFloat(projectData.areaSupply) || 92;
    
    // 면적 기반 수량 산출
    const wallArea = areaSupply * 3.5; // 벽면적 = 공급면적 × 3.5
    const floorArea = areaSupply * 0.9; // 바닥면적 = 공급면적 × 0.9
    
    return {
        도배_면적: Math.round(wallArea),
        마루_면적: Math.round(floorArea),
        욕실타일_벽: 30, // 기본 30㎡
        욕실타일_바닥: 8, // 기본 8㎡
        주방타일: 10, // 기본 10㎡
        철거_마루: Math.round(floorArea),
        철거_벽지: Math.round(wallArea),
        조명_거실: 1,
        조명_방: 3,
        폐기물: 1,
        보양: 1,
        청소: 1
    };
}

// ========================================
// 요율 설정
// ========================================

const DEFAULT_RATES = {
    간접노무비: 3.11,
    산재보험: 3.545,
    건강보험: 3.545,
    연금보험: 4.5,
    고용보험: 0.79,
    산업안전보건관리비: 3.11,
    일반관리비: 1.5,
    기업이윤: 10,
    부가세: 10
};
