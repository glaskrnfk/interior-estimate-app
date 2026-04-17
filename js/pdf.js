// ============================================================
//  pdf.js  v7.0  –  행 잘림·빈 페이지 완전 제거 PDF 출력
//
//  핵심 전략:
//  ① buildEstDoc() 에서 행 단위 정밀 분할로 각 .est-page가
//     A4 한 장에 맞게 구성됨 (앱 로직 책임)
//  ② 각 .est-page 를 독립 html2canvas 로 캡처 (scale=2)
//  ③ 캡처 이미지 실제 높이(px) → mm 환산 후 그대로 배치
//     → A4 이내: 실제 높이만큼만 PDF에 삽입 (빈 공간 없음)
//     → A4 초과: 안전장치로 슬라이스 (정상적으론 발생 안 함)
//  ④ drawImage 버그 수정: 슬라이스 시 source rect 명시
// ============================================================

async function doPDF() {
    try {
        buildEstDoc();
        showToast('PDF 생성 중… 잠시 기다려주세요.');

        // 폰트·렌더링 완료 대기
        await document.fonts.ready;
        await new Promise(r => setTimeout(r, 800));

        const wrap  = document.getElementById('estimate-doc-wrap');
        const pages = Array.from(wrap.querySelectorAll('.est-page'));

        if (!pages.length) {
            alert('견적서 내용이 없습니다. 먼저 견적서를 작성해주세요.');
            return;
        }

        // ── 캡처 전: 모든 .est-page 를 자연 높이로 강제 설정 ──
        //    padding-bottom 최소화로 하단 여백 제거
        pages.forEach(pg => {
            pg.style.minHeight      = 'unset';
            pg.style.height         = 'auto';
            pg.style.overflow       = 'visible';
            pg.style.marginBottom   = '0';
            pg.style.boxShadow      = 'none';
            pg.style.pageBreakAfter = 'avoid';
            pg.style.paddingBottom  = '20px';  // 36px → 20px 로 하단 여백 최소화
        });

        // ── 캡처 전 재측정 대기 ──
        await new Promise(r => setTimeout(r, 200));

        // ── onclone: 클론 문서에 폰트 + 스타일 주입 ──
        const injectFont = (clonedDoc) => {
            // 폰트 스타일 직접 주입 (오프라인 지원)
            const fontStyle = clonedDoc.createElement('style');
            fontStyle.textContent = "body,* { font-family: 'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo','NanumGothic','Noto Sans KR',sans-serif !important; }";
            clonedDoc.head.appendChild(fontStyle);

            // estimate.css 로드
            const cssLink = clonedDoc.createElement('link');
            cssLink.rel  = 'stylesheet';
            cssLink.href = 'css/estimate.css';
            clonedDoc.head.appendChild(cssLink);

            // min-height 제거 + 폰트 강제
            clonedDoc.querySelectorAll('.est-page').forEach(el => {
                el.style.minHeight      = 'unset';
                el.style.height         = 'auto';
                el.style.overflow       = 'visible';
                el.style.marginBottom   = '0';
                el.style.boxShadow      = 'none';
            });
            clonedDoc.querySelectorAll('*').forEach(el => {
                el.style.fontFamily = "'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
            });
        };

        const { jsPDF } = window.jspdf;
        const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const A4_W  = 210;   // mm
        const A4_H  = 297;   // mm

        let isFirstPdfPage = true;

        for (let i = 0; i < pages.length; i++) {
            const pg = pages[i];

            // ── html2canvas 캡처 ──
            const pgCanvas = await html2canvas(pg, {
                scale          : 2,
                useCORS        : true,
                allowTaint     : true,
                backgroundColor: '#ffffff',
                logging        : false,
                imageTimeout   : 0,
                width          : pg.offsetWidth  || 794,
                height         : pg.scrollHeight || pg.offsetHeight,
                windowWidth    : 794,
                onclone        : injectFont
            });

            const imgW_px = pgCanvas.width;
            const imgH_px = pgCanvas.height;

            // px → mm (A4 너비 기준 비율)
            const scale_px2mm = A4_W / imgW_px;
            const imgH_mm     = imgH_px * scale_px2mm;

            if (imgH_mm <= A4_H + 0.5) {
                // ── A4 이내: 실제 높이 그대로 한 페이지에 배치 ──
                //    남은 영역은 PDF 흰 배경 → 빈 페이지 없음
                if (!isFirstPdfPage) pdf.addPage();
                isFirstPdfPage = false;

                pdf.addImage(
                    pgCanvas.toDataURL('image/jpeg', 0.92),
                    'JPEG',
                    0, 0,
                    A4_W,
                    imgH_mm
                );

            } else {
                // ── A4 초과 (안전망): 슬라이스 분할 ──
                //    이 경로는 buildEstDoc()의 분할 로직이 제대로 동작했다면
                //    표지·원가계산서처럼 고정 레이아웃 페이지에서만 발생
                const sliceH_px = Math.round(A4_H / scale_px2mm);  // 1 A4 높이에 해당하는 px
                let   srcY      = 0;

                while (srcY < imgH_px) {
                    if (!isFirstPdfPage) pdf.addPage();
                    isFirstPdfPage = false;

                    const thisH_px = Math.min(sliceH_px, imgH_px - srcY);
                    const thisH_mm = thisH_px * scale_px2mm;

                    // 슬라이스 캔버스 생성 (source rect 명시)
                    const sc  = document.createElement('canvas');
                    sc.width  = imgW_px;
                    sc.height = thisH_px;
                    sc.getContext('2d').drawImage(
                        pgCanvas,
                        0, srcY,          // 소스 시작 좌표
                        imgW_px, thisH_px, // 소스 크기
                        0, 0,             // 대상 시작 좌표
                        imgW_px, thisH_px  // 대상 크기
                    );

                    pdf.addImage(
                        sc.toDataURL('image/jpeg', 0.92),
                        'JPEG',
                        0, 0,
                        A4_W, thisH_mm
                    );

                    srcY += thisH_px;
                }
            }
        }

        // ── 파일명 생성 및 저장 ──
        const today = new Date();
        const fn = `견적서_${v('siteName') || '인테리어'}_${
            today.getFullYear()}${zp(today.getMonth()+1)}${zp(today.getDate())}.pdf`;
        pdf.save(fn);
        showToast('✅ PDF 저장 완료!');

    } catch (err) {
        console.error('PDF 오류:', err);
        alert('PDF 생성 오류: ' + err.message +
              '\n\n브라우저 인쇄(Ctrl+P → PDF 저장)로도 출력할 수 있습니다.');
    }
}
