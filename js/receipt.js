/* ═══════════════════════════════════════════════════════════
   영수증 발행 기능 — admin.html 에서 완전 분리된 외부 파일
   v3.0: 데이터를 JSON 인라인으로 직접 삽입 (Blob URL 타이밍 문제 완전 해소)
         팝업 JS/CSS 는 Blob 한 장의 HTML 내부에 인라인으로 포함
         — 현재 파일(admin.html) 파서에는 <script> 태그 문자열이 노출되지 않음
═══════════════════════════════════════════════════════════ */
function openReceiptWindow() {

    /* ── admin 폼 값 읽기 헬퍼 ── */
    function gf(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    /* ── 대표도장 (localStorage) ── */
    var stamp = '';
    try { stamp = localStorage.getItem('iq_stamp_image') || localStorage.getItem('iq_stamp') || ''; } catch(e) {}

    var today = new Date().toISOString().slice(0, 10);

    /* ── 폼 데이터 수집 ── */
    var D = {
        stamp      : stamp,
        clientName : gf('ct-client-name'),
        clientBizNo: gf('ct-client-bizno'),
        clientAddr : gf('ct-client-addr'),
        clientTel  : gf('ct-client-tel'),
        siteName   : gf('ct-site-name'),
        company    : gf('ct-company'),
        rep        : gf('ct-rep'),
        bizNo      : gf('ct-bizno'),
        tel        : gf('ct-tel'),
        fax        : gf('ct-fax'),
        coAddr     : gf('ct-co-addr'),
        today      : today,
        contractId : (typeof _currentContractDbId !== 'undefined' ? (_currentContractDbId || '') : ''),
        estimateId : (typeof _currentLinkedEstId !== 'undefined' ? (_currentLinkedEstId || '') : '')
    };

    /* ── JSON 직렬화 (<\/script> 이스케이프로 XSS 방지) ── */
    var dataJson = JSON.stringify(D).replace(/<\/script>/gi, '<\\/script>');

    /* ══════════════════════════════════════════════════════
       CSS — 팝업 내부 스타일 (실제 한글 사용, 이스케이프 없음)
    ══════════════════════════════════════════════════════ */
    var css = ''
        + '*{box-sizing:border-box;margin:0;padding:0}'
        + "body{font-family:'Noto Sans KR',sans-serif;font-size:12px;color:#1a1a1a;"
        + '     background:#e8ecf4;display:flex;flex-direction:column;align-items:center;'
        + '     min-height:100vh;padding:16px}'
        + '.ctrl{background:#1a3e72;color:#fff;padding:10px 20px;border-radius:8px;'
        + '      margin-bottom:14px;display:flex;gap:10px;align-items:flex-end;'
        + '      flex-wrap:wrap;width:794px;max-width:100%}'
        + '.ctrl label{font-size:11.5px;display:flex;flex-direction:column;gap:3px}'
        + '.ctrl input{padding:5px 8px;border:none;border-radius:5px;'
        + "            font:12px 'Noto Sans KR',sans-serif;background:#fff;color:#1a1a1a;width:110px}"
        + '.ctrl input.wide{width:160px}'
        + '.ctrl button{padding:7px 16px;border:none;border-radius:6px;'
        + "             font:600 12px 'Noto Sans KR',sans-serif;cursor:pointer;align-self:flex-end}"
        + '.bp{background:#f59e0b;color:#fff}'
        + '.br{background:#e2e8f0;color:#1a1a1a}'
        + '.a4{width:794px;min-height:1123px;background:#fff;'
        + '    display:flex;flex-direction:column;padding:28px 36px;'
        + '    box-shadow:0 4px 20px rgba(0,0,0,.15)}'
        + '.cut{border:none;border-top:2px dashed #aaa;margin:20px 0;position:relative}'
        + ".cut::before{content:'\\2702';position:absolute;left:-18px;top:-9px;color:#aaa;font-size:14px}"
        + '.rc{border:1.5px solid #1a3e72;border-radius:6px;padding:16px 20px;flex:1}'
        + '.rct{font-size:22px;font-weight:900;letter-spacing:8px;text-align:center;'
        + '     color:#1a3e72;padding-bottom:10px;border-bottom:2px solid #1a3e72;margin-bottom:10px}'
        + '.tb{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11.5px}'
        + '.lbl{background:#eef2f8;color:#1a3e72;font-weight:700;padding:5px 8px;'
        + '     border:1px solid #c8d5e8;white-space:nowrap;width:90px}'
        + '.val{padding:5px 10px;border:1px solid #c8d5e8}'
        + '.th{background:#dce8f8;color:#1a3e72;font-weight:700;padding:6px 8px;'
        + '    border:1px solid #c8d5e8;text-align:center;font-size:11px}'
        + '.td{padding:6px 8px;border:1px solid #c8d5e8;font-size:11.5px}'
        + '.ab{background:#1a3e72;color:#fff;border-radius:6px;padding:10px 16px;'
        + '    margin:10px 0;display:flex;align-items:center;gap:14px;flex-wrap:wrap}'
        + '.al{font-size:13px;font-weight:700;letter-spacing:1px;white-space:nowrap}'
        + '.an{font-size:20px;font-weight:900;letter-spacing:1px}'
        + '.ak{font-size:11px;color:rgba(255,255,255,.8);margin-top:2px}'
        + '.ft{margin-top:12px;padding-top:8px;border-top:1px dashed #c8d5e8}'
        + '.fd{font-size:12px;font-weight:600;color:#1a3e72;text-align:right;margin-bottom:6px}'
        + '@media print{'
        + '  body{background:#fff;padding:0}'
        + '  .ctrl{display:none!important}'
        + '  .a4{box-shadow:none;padding:12mm 14mm;min-height:0;width:100%}'
        + '  .rc{page-break-inside:avoid}'
        + '}';

    /* ══════════════════════════════════════════════════════
       팝업 컨트롤 HTML 뼈대 (한글은 실제 문자 그대로)
    ══════════════════════════════════════════════════════ */
    var bodyHtml = ''
        + '<div class="ctrl">'
        + '  <label>공급가액(원)<input type="number" id="rs" placeholder="25000000"></label>'
        + '  <label style="position:relative">부가세<small style="opacity:.7;font-size:10px">(직접수정·0원가능)</small>'
        + '    <input type="number" id="rv" placeholder="자동계산(10%)" title="직접 수정 가능. 0원 입력도 허용됩니다.">'
        + '    <button id="btnAuto" type="button" title="부가세 10% 자동계산으로 초기화" style="position:absolute;right:4px;bottom:4px;padding:1px 5px;font-size:10px;border:1px solid #f59e0b;border-radius:3px;background:#fffbeb;color:#92400e;cursor:pointer;line-height:1.4">↺ 자동</button>'
        + '  </label>'
        + '  <label>합&nbsp;계<input type="number" id="rt" readonly style="background:#e8f0fe;cursor:not-allowed"></label>'
        + '  <label>비&nbsp;&nbsp;고<input class="wide" type="text" id="rm" placeholder="계약금 / 중도금 / 잔금"></label>'
        + '  <label>발행일<input type="date" id="rd" value="' + today + '"></label>'
        + '  <button class="br" id="btnR">&#9654; 미리보기</button>'
        + '  <button class="bp" id="btnP">&#128438; 인쇄 (A4)</button>'
        + '  <button class="bs" id="btnS" style="background:#059669;color:#fff">&#128190; DB 저장</button>'
        + '  <button class="bs" id="btnSend" style="background:#7c3aed;color:#fff;display:none">&#128279; 고객 링크</button>'
        + '</div>'
        + '<div class="a4">'
        + '  <div id="r1"></div>'
        + '  <hr class="cut">'
        + '  <div id="r2"></div>'
        + '</div>';

    /* ══════════════════════════════════════════════════════
       팝업 내부 실행 JS 코드
       — 이 문자열은 Blob HTML 내 <script> 블록 안에 들어가므로
         한글을 실제로 포함해도 무방 (UTF-8 Blob)
       — 주의: 이 파일(receipt.js)의 JS 파서가 직접 실행하는 코드이므로
         \uXXXX 이스케이프 없이 한글 그대로 작성
    ══════════════════════════════════════════════════════ */
    var popupJs = buildPopupJs();

    /* ── Blob HTML 조립 ──
       <script> 태그를 쪼개면 이 파일(receipt.js)의 HTML 파서가 없으므로 불필요.
       단, admin.html 인라인 <script> 블록 안에서 이 함수가 실행되므로
       admin.html 파서 충돌 위험이 없음 (receipt.js 는 외부 파일로 로드).
       그래도 안전하게 ST/SET 변수로 분리.
    ── */
    var ST  = '<' + 'script>';
    var SET = '<' + '/script>';

    var htmlFull = '<!DOCTYPE html>\n'
        + '<html lang="ko"><head>\n'
        + '<meta charset="UTF-8">\n'
        + '<title>영수증 발행</title>\n'
        + '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;900&display=swap" rel="stylesheet">\n'
        + '<style>\n' + css + '\n</style>\n'
        /* ① 데이터 인라인 주입: 팝업 HTML 로드 즉시 window.__RC_DATA__ 사용 가능 */
        + ST + 'window.__RC_DATA__=' + dataJson + ';' + SET + '\n'
        + '</head><body>\n'
        + bodyHtml + '\n'
        /* ② 팝업 로직 인라인 */
        + ST + '\n' + popupJs + '\n' + SET + '\n'
        + '</body></html>';

    /* ── Blob 생성 & 팝업 열기 ── */
    var blob = new Blob([htmlFull], { type: 'text/html;charset=utf-8' });
    var url  = URL.createObjectURL(blob);

    var w = window.open(url, '_blank', 'width=880,height=760,scrollbars=yes,resizable=yes');

    if (!w) {
        URL.revokeObjectURL(url);
        if (typeof showToast === 'function') {
            showToast('⚠️ 팝업이 차단되었습니다. 브라우저 설정에서 팝업 허용 후 다시 시도하세요.');
        } else {
            alert('팝업이 차단되었습니다.\n브라우저 주소창 오른쪽 팝업 허용 후 다시 시도하세요.');
        }
        return;
    }

    /* 60초 후 Blob URL 해제 (팝업 자체는 계속 동작) */
    setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
}

/* ══════════════════════════════════════════════════════════
   buildPopupJs() — 팝업 내부 로직을 문자열로 반환
   (receipt.js 내에서 JS로 실행되므로 한글 직접 사용 가능)
══════════════════════════════════════════════════════════ */
function buildPopupJs() {
    return '(function() {\n'
        + '  var D = window.__RC_DATA__;\n'
        + '  if (!D) {\n'
        + '    document.body.innerHTML = "<p style=\\"color:red;padding:20px\\">데이터를 불러오지 못했습니다.</p>";\n'
        + '    return;\n'
        + '  }\n'
        + '\n'
        + '  /* 유틸 함수 */\n'
        + '  function enc(s) {\n'
        + '    if (!s) return "&nbsp;";\n'
        + '    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");\n'
        + '  }\n'
        + '  function gv(id) { var e=document.getElementById(id); return e?e.value.trim():""; }\n'
        + '  function fmt(n) { return Number(n||0).toLocaleString(); }\n'
        + '  function fmtDate(v) {\n'
        + '    if (!v) return "____년 __월 __일";\n'
        + '    var d = new Date(v);\n'
        + '    return d.getFullYear()+"년 "+(d.getMonth()+1)+"월 "+d.getDate()+"일";\n'
        + '  }\n'
        + '  function korAmt(n) {\n'
        + '    if (!n || isNaN(n)) return "";\n'
        + '    var u  = ["","만","억","조"];\n'
        + '    var nu = ["","일","이","삼","사","오","육","칠","팔","구"];\n'
        + '    var p  = ["","십","백","천"];\n'
        + '    var r = "일금 ", gs = [], m = Number(n);\n'
        + '    while (m > 0) { gs.push(m % 10000); m = Math.floor(m / 10000); }\n'
        + '    for (var g = gs.length-1; g >= 0; g--) {\n'
        + '      var gn = gs[g]; if (!gn) continue;\n'
        + '      var s2 = "", t = String(gn).padStart(4,"0");\n'
        + '      for (var i = 0; i < 4; i++) {\n'
        + '        var dg = parseInt(t[i]);\n'
        + '        if (dg) s2 += (dg===1&&i>0?"":nu[dg]) + p[3-i];\n'
        + '      }\n'
        + '      r += s2 + u[g];\n'
        + '    }\n'
        + '    return r + "원정";\n'
        + '  }\n'
        + '  function stHtml() {\n'
        + '    if (D.stamp) {\n'
        + '      return \'<img src="\' + D.stamp + \'" style="position:absolute;right:6px;bottom:2px;width:52px;height:52px;opacity:.82;mix-blend-mode:multiply" alt="">\';\n'
        + '    }\n'
        + '    return \'<span style="position:absolute;right:6px;bottom:2px;font-size:9px;color:#bbb">(인)</span>\';\n'
        + '  }\n'
        + '\n'
        + '  /* 영수증 카드 HTML 생성 */\n'
        + '  function makeCard(sup, vat, tot, memo, dt) {\n'
        + '    var sf=fmt(sup), vf=fmt(vat), tf=fmt(tot), kr=korAmt(tot);\n'
        + '    var sn = D.siteName ? D.siteName+" 인테리어 공사" : "인테리어 공사";\n'
        + '    var h = "";\n'
        + '    h += \'<div class="rc">\';\n'
        + '    h += \'  <div class="rct">영&nbsp;&nbsp;&nbsp;수&nbsp;&nbsp;&nbsp;증</div>\';\n'
        + '    h += \'  <table class="tb">\';\n'
        + '    h += \'    <tr>\';\n'
        + '    h += \'      <td class="lbl">공급받는자</td>\';\n'
        + '    h += \'      <td class="val"><strong>\' + enc(D.clientName) + \'</strong></td>\';\n'
        + '    h += \'      <td class="lbl">사업자(주민)번호</td>\';\n'
        + '    h += \'      <td class="val">\' + enc(D.clientBizNo) + \'</td>\';\n'
        + '    h += \'    </tr>\';\n'
        + '    h += \'    <tr><td class="lbl">주&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;소</td><td class="val" colspan="3">\' + enc(D.clientAddr) + \'</td></tr>\';\n'
        + '    h += \'    <tr><td class="lbl">전&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;화</td><td class="val" colspan="3">\' + enc(D.clientTel) + \'</td></tr>\';\n'
        + '    h += \'    <tr><td class="lbl">공사/품목</td><td class="val" colspan="3">\' + enc(sn) + \'</td></tr>\';\n'
        + '    h += \'  </table>\';\n'
        + '    h += \'  <div class="ab">\';\n'
        + '    h += \'    <div class="al">합&nbsp;&nbsp;계&nbsp;&nbsp;금&nbsp;&nbsp;액</div>\';\n'
        + '    h += \'    <div class="an">&#65510; \' + tf + \' 원</div>\';\n'
        + '    if (kr) h += \'    <div class="ak">(\' + enc(kr) + \')</div>\';\n'
        + '    h += \'  </div>\';\n'
        + '    h += \'  <table class="tb" style="margin-top:6px">\';\n'
        + '    h += \'    <tr><th class="th">공급가액</th><th class="th">부가세(10%)</th><th class="th">합계</th><th class="th">비고</th></tr>\';\n'
        + '    h += \'    <tr>\';\n'
        + '    h += \'      <td class="td" style="text-align:right">\' + sf + \'원</td>\';\n'
        + '    h += \'      <td class="td" style="text-align:right">\' + vf + \'원</td>\';\n'
        + '    h += \'      <td class="td" style="text-align:right;font-weight:700">\' + tf + \'원</td>\';\n'
        + '    h += \'      <td class="td">\' + enc(memo) + \'</td>\';\n'
        + '    h += \'    </tr>\';\n'
        + '    h += \'  </table>\';\n'
        + '    h += \'  <div class="ft">\';\n'
        + '    h += \'    <div class="fd">발 행 일 : \' + enc(dt) + \'</div>\';\n'
        + '    h += \'    <table class="tb">\';\n'
        + '    h += \'      <tr>\';\n'
        + '    h += \'        <td class="lbl">상&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;호</td>\';\n'
        + '    h += \'        <td class="val"><strong>\' + enc(D.company) + \'</strong></td>\';\n'
        + '    h += \'        <td class="lbl">사업자번호</td>\';\n'
        + '    h += \'        <td class="val" style="position:relative">\' + enc(D.bizNo) + stHtml() + \'</td>\';\n'
        + '    h += \'      </tr>\';\n'
        + '    h += \'      <tr>\';\n'
        + '    h += \'        <td class="lbl">대&nbsp;&nbsp;표&nbsp;&nbsp;자</td>\';\n'
        + '    h += \'        <td class="val" style="position:relative">\' + enc(D.rep) + \' <span style="color:#999;font-size:10px">(인)</span></td>\';\n'
        + '    h += \'        <td class="lbl">전화/FAX</td>\';\n'
        + '    h += \'        <td class="val">\' + enc(D.tel) + (D.fax ? \' / \' + enc(D.fax) : \'\') + \'</td>\';\n'
        + '    h += \'      </tr>\';\n'
        + '    h += \'      <tr><td class="lbl">주&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;소</td><td class="val" colspan="3">\' + enc(D.coAddr) + \'</td></tr>\';\n'
        + '    h += \'    </table>\';\n'
        + '    h += \'  </div>\';\n'
        + '    h += \'</div>\';\n'
        + '    return h;\n'
        + '  }\n'
        + '\n'
        + '  /* 부가세 수동입력 여부 플래그 */\n'
        + '  var rvManual = false;\n'
        + '\n'
        + '  /* 렌더링 — rvManual이 true이면 rv 입력값 그대로 사용 (0원 포함) */\n'
        + '  function render() {\n'
        + '    var s  = parseInt(gv("rs")) || 0;\n'
        + '    var rv = document.getElementById("rv");\n'
        + '    var v  = rvManual ? (parseInt(rv.value) || 0) : Math.round(s * 0.1);\n'
        + '    var t  = s + v;\n'
        + '    var m  = gv("rm"), dt = fmtDate(gv("rd"));\n'
        + '    if (!rvManual) rv.value = s > 0 ? v : "";\n'
        + '    document.getElementById("rt").value = s > 0 ? t : "";\n'
        + '    document.getElementById("r1").innerHTML = makeCard(s, v, t, m, dt);\n'
        + '    document.getElementById("r2").innerHTML = makeCard(s, v, t, m, dt);\n'
        + '  }\n'
        + '\n'
        + '  /* 이벤트 리스너 */\n'
        + '  /* 공급가액 변경 — rvManual=false 이면 부가세 자동갱신, true 이면 유지 */\n'
        + '  document.getElementById("rs").addEventListener("input", function() {\n'
        + '    var s = parseInt(this.value) || 0;\n'
        + '    var rv = document.getElementById("rv");\n'
        + '    if (!rvManual) {\n'
        + '      var v = Math.round(s * 0.1);\n'
        + '      rv.value = s > 0 ? v : "";\n'
        + '      document.getElementById("rt").value = s > 0 ? (s + v) : "";\n'
        + '    } else {\n'
        + '      var v2 = parseInt(rv.value) || 0;\n'
        + '      document.getElementById("rt").value = s > 0 ? (s + v2) : "";\n'
        + '    }\n'
        + '  });\n'
        + '  /* 부가세 직접 입력 — 수동 모드 진입, 0원도 그대로 허용 */\n'
        + '  document.getElementById("rv").addEventListener("input", function() {\n'
        + '    rvManual = true;\n'
        + '    var s = parseInt(document.getElementById("rs").value) || 0;\n'
        + '    var v = parseInt(this.value) || 0;\n'
        + '    document.getElementById("rt").value = s > 0 ? (s + v) : "";\n'
        + '    this.style.borderColor = "#f59e0b";\n'
        + '    this.title = "수동 입력 중 (0원 포함) — 부가세 자동계산 버튼으로 초기화 가능";\n'
        + '  });\n'
        + '  /* 부가세 자동계산 초기화 버튼 */\n'
        + '  document.getElementById("btnAuto").addEventListener("click", function() {\n'
        + '    rvManual = false;\n'
        + '    var rv = document.getElementById("rv");\n'
        + '    rv.style.borderColor = "";\n'
        + '    rv.title = "";\n'
        + '    var s = parseInt(document.getElementById("rs").value) || 0;\n'
        + '    var v = Math.round(s * 0.1);\n'
        + '    rv.value = s > 0 ? v : "";\n'
        + '    document.getElementById("rt").value = s > 0 ? (s + v) : "";\n'
        + '  });\n'
        + '  document.getElementById("btnR").addEventListener("click", render);\n'
        + '  document.getElementById("btnP").addEventListener("click", function() { window.print(); });\n'
        + '  document.getElementById("btnS").addEventListener("click", function() {\n'
        + '    var sup = parseInt(document.getElementById("rs").value) || 0;\n'
        + '    var vat = parseInt(document.getElementById("rv").value) || 0;\n'
        + '    var tot = parseInt(document.getElementById("rt").value) || 0;\n'
        + '    var memo = document.getElementById("rm").value || "";\n'
        + '    var dt   = document.getElementById("rd").value || D.today;\n'
        + '    if (!sup) { alert("공급가액을 입력해 주세요."); return; }\n'
        + '    var payload = {\n'
        + '      contract_id    : D.contractId || null,\n'
        + '      estimate_id    : D.estimateId || null,\n'
        + '      client_name    : D.clientName || "",\n'
        + '      site_name      : D.siteName   || "",\n'
        + '      supply_amount  : sup,\n'
        + '      vat_amount     : vat,\n'
        + '      total_amount   : tot,\n'
        + '      memo           : memo,\n'
        + '      issued_at      : dt,\n'
        + '      receipt_data   : { D: D, sup: sup, vat: vat, tot: tot, memo: memo, dt: dt }\n'
        + '    };\n'
        + '    var SB_URL = parent.SB_URL || "";\n'
        + '    var SB_KEY = parent.SB_KEY || "";\n'
        + '    if (!SB_URL) { alert("Supabase 연결 정보를 찾을 수 없습니다."); return; }\n'
        + '    var id = "rcpt_" + Date.now() + "_" + Math.random().toString(36).slice(2,6);\n'
        + '    payload.id = id;\n'
        + '    payload.created_at = new Date().toISOString();\n'
        + '    payload.updated_at = payload.created_at;\n'
        + '    fetch(SB_URL + "/rest/v1/receipts", {\n'
        + '      method: "POST",\n'
        + '      headers: { "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Prefer": "return=representation" },\n'
        + '      body: JSON.stringify(payload)\n'
        + '    }).then(function(r) { return r.json(); })\n'
        + '    .then(function(d) {\n'
        + '      if (d && d[0] && d[0].id) {\n'
        + '        window._savedReceiptId = d[0].id;\n'
        + '        document.getElementById("btnS").textContent = "\u2705 저장됨";\n'
        + '        document.getElementById("btnS").style.background = "#047857";\n'
        + '        document.getElementById("btnSend").style.display = "";\n'
        + '        document.getElementById("btnSend").dataset.rcptId = d[0].id;\n'
        + '      } else { alert("저장 실패: " + JSON.stringify(d)); }\n'
        + '    }).catch(function(e) { alert("저장 오류: " + e.message); });\n'
        + '  });\n'
        + '  document.getElementById("btnSend").addEventListener("click", function() {\n'
        + '    var rcptId = this.dataset.rcptId;\n'
        + '    if (!rcptId) return;\n'
        + '    var base = location.href.split("/").slice(0,-1).join("/") + "/";\n'
        + '    var link = base + "client.html?rcpt=" + rcptId;\n'
        + '    navigator.clipboard.writeText(link).then(function() {\n'
        + '      alert("\u2705 영수증 링크가 복사되었습니다.\\n\\n" + link + "\\n\\n카카오톡에 붙여넣기 해주세요.");\n'
        + '    }).catch(function() { alert("링크: " + link); });\n'
        + '  });\n'
        + '\n'
        + '  /* 초기 렌더링 */\n'
        + '  render();\n'
        + '})();\n';
}
