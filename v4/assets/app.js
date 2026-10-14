/* app.js — 交互逻辑：代码逐行讲解弹层、灯箱、7 个交互演示组件
   零依赖、离线可用；数据以 <script type="application/json"> 内联在页面里 */
(function () {
  "use strict";

  /* ---------- 工具 ---------- */
  function $(s, el) { return (el || document).querySelector(s); }
  function $all(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function getJSON(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) {  // Box-Muller
    var u = Math.max(rng(), 1e-12), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function percentile(arr, p) {
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var k = (a.length - 1) * p, f = Math.floor(k), c = Math.ceil(k);
    return f === c ? a[f] : a[f] + (a[c] - a[f]) * (k - f);
  }
  function solve(A, b) {  // 高斯消元
    var n = b.length, M = A.map(function (r, i) { return r.slice().concat([b[i]]); });
    for (var i = 0; i < n; i++) {
      var piv = i;
      for (var r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
      var tmp = M[i]; M[i] = M[piv]; M[piv] = tmp;
      if (Math.abs(M[i][i]) < 1e-12) return null;
      for (var r2 = i + 1; r2 < n; r2++) {
        var f = M[r2][i] / M[i][i];
        for (var c2 = i; c2 <= n; c2++) M[r2][c2] -= f * M[i][c2];
      }
    }
    var x = new Array(n);
    for (var i2 = n - 1; i2 >= 0; i2--) {
      var s = M[i2][n];
      for (var j = i2 + 1; j < n; j++) s -= M[i2][j] * x[j];
      x[i2] = s / M[i2][i2];
    }
    return x;
  }
  function ols(X, y) {  // X: n×k (不含常数), 返回 [beta, 拟合值]
    var n = y.length, k = X[0].length;
    var Z = X.map(function (r) { return [1].concat(r); });
    var A = [], b = [];
    for (var i = 0; i <= k; i++) {
      A.push([]); b.push(0);
      for (var j = 0; j <= k; j++) {
        var s = 0;
        for (var t = 0; t < n; t++) s += Z[t][i] * Z[t][j];
        A[i].push(s);
      }
      var sb = 0;
      for (var t2 = 0; t2 < n; t2++) sb += Z[t2][i] * y[t2];
      b[i] = sb;
    }
    var beta = solve(A, b);
    return beta;
  }
  function fmt(v, d) { return (v == null || isNaN(v)) ? "—" : v.toFixed(d == null ? 3 : d); }
  function fmtP(p) { return p < 0.01 ? "<0.01" : fmt(p, 2); }

  /* ---------- 逐行讲解弹层 ---------- */
  var notes = getJSON("notes-data") || {};
  var sheet = $("#sheet"), mask = $("#sheet-mask");
  function openSheet(code, note) {
    $("#sheet-code").textContent = code;
    $("#sheet-note").textContent = note;
    sheet.classList.add("on"); mask.classList.add("on");
  }
  function closeSheet() { sheet.classList.remove("on"); mask.classList.remove("on"); }
  document.addEventListener("click", function (e) {
    var ln = e.target.closest ? e.target.closest(".ln.has-note") : null;
    if (ln) {
      var b = ln.getAttribute("data-b"), i = parseInt(ln.getAttribute("data-i"), 10);
      var arr = notes[b];
      if (arr && arr[i]) openSheet(ln.getAttribute("data-raw") || "", arr[i]);
    }
  });
  if (mask) mask.addEventListener("click", closeSheet);
  var closeBtn = $("#sheet-close");
  if (closeBtn) closeBtn.addEventListener("click", closeSheet);

  /* ---------- 图片灯箱 ---------- */
  var lb = $("#lightbox");
  if (lb) {
    document.addEventListener("click", function (e) {
      var img = e.target;
      if (img.tagName === "IMG" && img.closest(".shot")) {
        lb.innerHTML = ""; lb.appendChild(img.cloneNode());
        lb.classList.add("on");
      }
    });
    lb.addEventListener("click", function () { lb.classList.remove("on"); });
  }

  /* ---------- Canvas 高分屏 ---------- */
  function prepCanvas(cv, wCss, hCss) {
    var dpr = window.devicePixelRatio || 1;
    cv.width = wCss * dpr; cv.height = hCss * dpr;
    cv.style.width = "100%"; cv.style.height = "auto";
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  function axes(ctx, W, H, pad, x0, x1, y0, y1, xLabel, yLabel) {
    ctx.strokeStyle = "#c9c2ad"; ctx.fillStyle = "#8b8878";
    ctx.font = "10px sans-serif"; ctx.lineWidth = 1;
    var px = function (x) { return pad.l + (x - x0) / (x1 - x0) * (W - pad.l - pad.r); };
    var py = function (y) { return H - pad.b - (y - y0) / (y1 - y0) * (H - pad.t - pad.b); };
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b);
    ctx.stroke();
    if (xLabel) { ctx.textAlign = "center"; ctx.fillText(xLabel, (pad.l + W - pad.r) / 2, H - 4); }
    if (yLabel) { ctx.save(); ctx.translate(10, (pad.t + H - pad.b) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.fillText(yLabel, 0, 0); ctx.restore(); }
    return { px: px, py: py };
  }
  function ticksLinear(x0, x1, n) {
    var span = x1 - x0, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10));
    var step = mag * (step0 / mag > 5 ? 10 : step0 / mag > 2 ? 5 : step0 / mag > 1 ? 2 : 1);
    var t = [], v = Math.ceil(x0 / step) * step;
    for (; v <= x1 + 1e-9; v += step) t.push(v);
    return t;
  }

  /* ================= 组件: 缩尾演示 ================= */
  function widgetWinsor(box, d) {
    var cv = $(".chart", box), slider = $("input[type=range]", box);
    var valEl = $(".val", box), corrEl = $("[data-r=corr]", box), slopeEl = $("[data-r=slope]", box);
    var W = Math.min($(".w-body", box).clientWidth || 640, 720), H = 300;
    function draw() {
      var p = parseFloat(slider.value);
      valEl.textContent = p + "%";
      var lo = p / 100, hi = 1 - p / 100;
      var x = d.x.map(function (v) { return Math.min(Math.max(v, percentile(d.x, lo)), percentile(d.x, hi)); });
      var y = d.y.map(function (v) { return Math.min(Math.max(v, percentile(d.y, lo)), percentile(d.y, hi)); });
      var b = ols(x.map(function (v) { return [v]; }), y);
      var mx = d.x.reduce(function (a, b2) { return a + b2; }, 0) / d.x.length;
      var my = d.y.reduce(function (a, b2) { return a + b2; }, 0) / d.y.length;
      var cov = 0, vx = 0;
      for (var i = 0; i < d.x.length; i++) { cov += (d.x[i] - mx) * (d.y[i] - my); vx += (d.x[i] - mx) * (d.x[i] - mx); }
      corrEl.textContent = fmt(cov / Math.sqrt(vx * (d.y.reduce(function (a, b2) { return a + (b2 - my) * (b2 - my); }, 0))), 3);
      slopeEl.textContent = fmt(b[1], 3);
      var ctx = prepCanvas(cv, W, H);
      var pad = { l: 42, r: 14, t: 14, b: 36 };
      var xmin = Math.min.apply(null, d.x) - 1, xmax = Math.max.apply(null, d.x) + 1;
      var ymin = Math.min.apply(null, d.y) - 1, ymax = Math.max.apply(null, d.y) + 1;
      var A = axes(ctx, W, H, pad, xmin, xmax, ymin, ymax, "变量X", "变量Y");
      ticksLinear(ymin, ymax, 5).forEach(function (t) {
        ctx.textAlign = "right"; ctx.fillText(t.toFixed(0), pad.l - 5, A.py(t) + 3);
      });
      ticksLinear(xmin, xmax, 6).forEach(function (t) {
        ctx.textAlign = "center"; ctx.fillText(t.toFixed(0), A.px(t), H - pad.b + 13);
      });
      ctx.fillStyle = "#1f3a5f";
      for (var i2 = 0; i2 < d.x.length; i2++) {
        ctx.beginPath(); ctx.arc(A.px(d.x[i2]), A.py(d.y[i2]), 2.6, 0, 6.284); ctx.fill();
      }
      ctx.fillStyle = "#b23b2e";
      for (var i3 = 0; i3 < x.length; i3++) {
        if (x[i3] !== d.x[i3] || y[i3] !== d.y[i3]) {
          ctx.beginPath(); ctx.arc(A.px(d.x[i3]), A.py(d.y[i3]), 3.2, 0, 6.284); ctx.fill();
        }
      }
      ctx.strokeStyle = "#1f3a5f"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(A.px(xmin), A.py(b[0] + b[1] * xmin)); ctx.lineTo(A.px(xmax), A.py(b[0] + b[1] * xmax)); ctx.stroke();
    }
    slider.addEventListener("input", draw);
    window.addEventListener("resize", function () {
      W = Math.min($(".w-body", box).clientWidth || 640, 720); draw();
    });
    draw();
  }

  /* ================= 组件: tabstat ================= */
  function widgetTabstat(box, d) {
    var tabs = $all(".w-tab", box), out = $("[data-r=table]", box);
    function render(mode) {
      var rows, head;
      if (mode === "full" || mode === "y2001") {
        rows = mode === "full" ? d.full : d.y2001;
        out.innerHTML = "<table class='res'><tr><th>变量</th><th>均值</th><th>标准差</th><th>中位数</th><th>最大值</th><th>最小值</th><th>N</th></tr>" +
          rows.map(function (r2) {
            return "<tr><td>" + r2.v + "</td><td>" + fmt(r2.mean, 3) + "</td><td>" + fmt(r2.sd, 3) +
              "</td><td>" + fmt(r2.p50, 3) + "</td><td>" + fmt(r2.max, 2) + "</td><td>" + fmt(r2.min, 2) +
              "</td><td>" + r2.count + "</td></tr>";
          }).join("") + "</table>";
      } else {
        out.innerHTML = "<table class='res'><tr><th>行业</th><th>观测数</th><th>公司投资 均值</th><th>公司投资 标准差</th><th>现金流 均值</th><th>现金流 标准差</th></tr>" +
          d.by_industry.map(function (r2) {
            return "<tr><td>" + r2.ind + "</td><td>" + r2.n + "</td><td>" + fmt(r2.inv_mean, 3) +
              "</td><td>" + fmt(r2.inv_sd, 3) + "</td><td>" + fmt(r2.cf_mean, 3) + "</td><td>" + fmt(r2.cf_sd, 3) + "</td></tr>";
          }).join("") + "</table><p class='res-note'>篇幅所限仅展示观测数最多的 8 个行业（书中同例）。</p>";
      }
    }
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        tabs.forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on"); render(t.getAttribute("data-m"));
      });
    });
    render("full");
    var meta = $("[data-r=meta]", box);
    if (meta && d.meta) meta.textContent = "样本：" + d.meta.n_obs.toLocaleString() + " 个公司-年度观测 · " +
      d.meta.n_firms.toLocaleString() + " 家公司 · " + d.meta.years[0] + "–" + d.meta.years[1] + " · " + d.meta.n_ind + " 个行业";
  }

  /* ================= 组件: 相关系数热力图 ================= */
  function widgetHeatmap(box, d) {
    var n = d.vars.length, out = $("[data-r=grid]", box), det = $("[data-r=detail]", box);
    var html = "<table class='res'><tr><th></th>" + d.vars.map(function (v) { return "<th>" + v + "</th>"; }).join("") + "</tr>";
    for (var i = 0; i < n; i++) {
      html += "<tr><td><b>" + d.vars[i] + "</b></td>";
      for (var j = 0; j < n; j++) {
        var r2 = d.corr[i][j], p = d.p[i][j];
        var t = i === j ? 0 : Math.min(Math.abs(r2), 0.9) / 0.9;
        var mix = function (a2, b2) { return Math.round(a2 + (b2 - a2) * t); };
        var bg;
        if (i === j) {
          bg = "background:#eef1f5";
        } else if (r2 >= 0) {
          bg = "background:rgb(" + mix(224, 31) + "," + mix(233, 58) + "," + mix(246, 95) + ")";
        } else {
          bg = "background:rgb(" + mix(249, 178) + "," + mix(224, 59) + "," + mix(224, 46) + ")";
        }
        var col = Math.abs(r2) > 0.55 && i !== j ? "#fff" : "#262b33";
        html += "<td data-i='" + i + "' data-j='" + j + "' style='" + bg + ";color:" + col + ";cursor:pointer'>" + fmt(r2, 2) + "</td>";
      }
      html += "</tr>";
    }
    out.innerHTML = html + "</table><p class='res-note'>N = " + d.n.toLocaleString() + "（成对剔除缺失）。蓝色为正相关、红色为负相关、深浅代表 |r|。点击任意单元格查看 p 值。</p>";
    out.addEventListener("click", function (e) {
      var td = e.target.closest("td[data-i]");
      if (!td) return;
      var i = +td.getAttribute("data-i"), j = +td.getAttribute("data-j");
      if (i === j) { det.textContent = d.vars[i] + " 与自身：相关系数为 1。"; return; }
      det.innerHTML = "<b>" + d.vars[i] + " × " + d.vars[j] + "</b>：r = " + fmt(d.corr[i][j], 4) +
        "，p = " + fmtP(d.p[i][j]) + (d.p[i][j] < 0.01 ? '<span class="stars">***</span>' : d.p[i][j] < 0.05 ? '<span class="stars">**</span>' : d.p[i][j] < 0.1 ? '<span class="stars">*</span>' : "");
    });
  }

  /* ================= 组件: IV 蒙特卡洛模拟 ================= */
  function widgetIvsim(box) {
    var rhoZ = $("input[data-k=rhoz]"), rhoE = $("input[data-k=rhoe]");
    var runBtn = $("[data-r=run]", box), out = $("[data-r=out]", box);
    var cv = $(".chart", box);
    function upd() {
      $("[data-v=rhoz]").textContent = fmt(parseFloat(rhoZ.value), 2);
      $("[data-v=rhoe]").textContent = fmt(parseFloat(rhoE.value), 2);
    }
    function simulate() {
      var rz = parseFloat(rhoZ.value), re = parseFloat(rhoE.value);
      var N = 200, REP = 400, TRUE = 1;
        var ols = [], iv = [];
        var rng = mulberry32(20260101);
        var zAll = [], uAll = [];
        for (var t = 0; t < N; t++) { zAll.push(gauss(rng)); uAll.push(gauss(rng)); }
        for (var r2 = 0; r2 < REP; r2++) {
          var z = [], x = [], y = [];
          for (var i = 0; i < N; i++) {
            var zi = zAll[i];
            var u = uAll[i], e = gauss(rng);
            var xErr = gauss(rng);                    // 内生部分之外的新息
            var xi = rz * zi + re * u + Math.sqrt(Math.max(0.0001, 1 - rz * rz - re * re)) * xErr;
            z.push(zi); x.push(xi);
            y.push(TRUE * xi + 1 + u + e);            // 结构方程: y = 1 + 1*x + (u+e)
          }
          // OLS 斜率
          var bOls = sc(x, y) / ss(x, x);
        // 2SLS: x̂ = π0 + π1 z; y 对 x̂ 回归
        var p1 = sc(z, x) / ss(z, z), p0 = mean(x) - p1 * mean(z);
        var xhat = z.map(function (zi2) { return p0 + p1 * zi2; });
        var bIv = sc(xhat, y) / sc(xhat, x);
        ols[r2] = bOls; iv[r2] = bIv;
      }
      function mean(a) { return a.reduce(function (m, b2) { return m + b2; }, 0) / a.length; }
      function ss(a, b2) { var ma = mean(a), mb = mean(b2), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - ma) * (b2[i] - mb); return s; }
      function sc(a, b2) { return ss(a, b2); }
      function sd(a) { var m = mean(a), s = 0; a.forEach(function (v) { s += (v - m) * (v - m); }); return Math.sqrt(s / (a.length - 1)); }
      drawHist(cv, [ols, iv], TRUE);
      out.innerHTML = "<div class='big-stat'><div class='stat'><div class='l'>OLS 估计均值</div><div class='v'>" + fmt(mean(ols), 3) +
        "</div><div class='l'>偏误 " + fmt(mean(ols) - TRUE, 3) + "</div></div>" +
        "<div class='stat'><div class='l'>2SLS 估计均值</div><div class='v'>" + fmt(mean(iv), 3) +
        "</div><div class='l'>偏误 " + fmt(mean(iv) - TRUE, 3) + "</div></div>" +
        "<div class='stat'><div class='l'>OLS 标准差</div><div class='v'>" + fmt(sd(ols), 3) + "</div></div>" +
        "<div class='stat'><div class='l'>2SLS 标准差</div><div class='v'>" + fmt(sd(iv), 3) + "</div></div></div>" +
        "<p class='res-note'>真实系数 = 1。工具越弱（ρ(z,x) 小），2SLS 的散布（标准差）越大——弱工具变量问题；内生性越强（corr(x,u) 大），OLS 的偏误越大。</p>";
    }
    [rhoZ, rhoE].forEach(function (s2) { s2.addEventListener("input", upd); });
    runBtn.addEventListener("click", simulate);
    upd(); simulate();
  }
  function drawHist(cv, series, trueVal) {
    var W = Math.min(cv.parentElement.clientWidth || 640, 720), H = 260;
    var ctx = prepCanvas(cv, W, H);
    var all = [].concat.apply([], series);
    var lo = percentile(all, 0.005) - 0.15, hi = percentile(all, 0.995) + 0.15;
    var nb = 34, pad = { l: 40, r: 12, t: 14, b: 34 };
    var A = axes(ctx, W, H, pad, lo, hi, 0, 1, "估计系数", "密度");
    var colors = ["rgba(178,59,46,.75)", "rgba(31,58,95,.8)"];
    var labels = ["OLS", "2SLS"];
    var maxDens = 0, hists = series.map(function (s2) {
      var h = new Array(nb).fill(0);
      s2.forEach(function (v) {
        var b2 = Math.floor((v - lo) / (hi - lo) * nb);
        if (b2 >= 0 && b2 < nb) h[b2]++;
      });
      var dens = h.map(function (c) { return c / s2.length / ((hi - lo) / nb); });
      dens.forEach(function (dv) { if (dv > maxDens) maxDens = dv; });
      return dens;
    });
    A = axes(ctx, W, H, pad, lo, hi, 0, maxDens * 1.08, "估计系数", "密度");
    ticksLinear(lo, hi, 7).forEach(function (t) {
      ctx.textAlign = "center"; ctx.fillStyle = "#8b8878"; ctx.fillText(t.toFixed(2), A.px(t), H - pad.b + 13);
    });
    var bw = (W - pad.l - pad.r) / nb;
    hists.forEach(function (dens, si) {
      ctx.fillStyle = colors[si];
      dens.forEach(function (dv, b2) {
        if (!dv) return;
        ctx.fillRect(pad.l + b2 * bw + 0.5, A.py(dv), bw - 1.5, A.py(0) - A.py(dv));
      });
    });
    ctx.strokeStyle = "#2e7d5b"; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(A.px(trueVal), pad.t); ctx.lineTo(A.px(trueVal), H - pad.b); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#2e7d5b"; ctx.textAlign = "left";
    ctx.fillText("真实值", A.px(trueVal) + 4, pad.t + 8);
    ctx.textAlign = "left";
    ctx.fillStyle = colors[0]; ctx.fillRect(pad.l + 6, pad.t + 4, 9, 9);
    ctx.fillStyle = "#262b33"; ctx.fillText(labels[0], pad.l + 19, pad.t + 12);
    ctx.fillStyle = colors[1]; ctx.fillRect(pad.l + 56, pad.t + 4, 9, 9);
    ctx.fillStyle = "#262b33"; ctx.fillText(labels[1], pad.l + 69, pad.t + 12);
  }

  /* ================= 组件: PSM ================= */
  function widgetPsm(box, d) {
    var cv = $(".chart", box);
    var W = Math.min($(".w-body", box).clientWidth || 640, 720), H = 240;
    var ctx = prepCanvas(cv, W, H);
    var pad = { l: 40, r: 12, t: 14, b: 34 };
    var maxD = Math.max.apply(null, d.ps_hist_treat.concat(d.ps_hist_ctrl)) * 1.1;
    var A = axes(ctx, W, H, pad, 0, 1, 0, maxD, "倾向得分", "密度");
    ticksLinear(0, 1, 5).forEach(function (t) {
      ctx.textAlign = "center"; ctx.fillStyle = "#8b8878"; ctx.fillText(t.toFixed(1), A.px(t), H - pad.b + 13);
    });
    var bw = (W - pad.l - pad.r) / d.ps_bins.length;
    d.ps_bins.forEach(function (c, i) {
      var hT = d.ps_hist_treat[i] / maxD * (H - pad.t - pad.b);
      var hC = d.ps_hist_ctrl[i] / maxD * (H - pad.t - pad.b);
      ctx.fillStyle = "rgba(31,58,95,.55)";
      ctx.fillRect(A.px(c) - bw / 2 + 1, A.py(0) - hC, bw / 2 - 1, hC);
      ctx.fillStyle = "rgba(178,59,46,.75)";
      ctx.fillRect(A.px(c) + 0.5, A.py(0) - hT, bw / 2 - 1, hT);
    });
    ctx.fillStyle = "rgba(178,59,46,.9)"; ctx.fillRect(pad.l + 6, pad.t + 4, 9, 9);
    ctx.fillStyle = "#262b33"; ctx.textAlign = "left"; ctx.fillText("处理组", pad.l + 19, pad.t + 12);
    ctx.fillStyle = "rgba(31,58,95,.7)"; ctx.fillRect(pad.l + 70, pad.t + 4, 9, 9);
    ctx.fillStyle = "#262b33"; ctx.fillText("对照组", pad.l + 83, pad.t + 12);
  }

  /* ================= 组件: 事件研究 ================= */
  function widgetEvent(box, d) {
    var cv = $(".chart", box), chk = $("input[type=checkbox]", box);
    var W = Math.min($(".w-body", box).clientWidth || 640, 720), H = 300;
    function draw() {
      var ctx = prepCanvas(cv, W, H);
      var pad = { l: 46, r: 14, t: 16, b: 38 };
      var pts = d.event.points;
      var all = [];
      pts.forEach(function (p) { all.push(p.lb, p.ub); });
      var ylo = Math.min.apply(null, all) - 0.005, yhi = Math.max.apply(null, all) + 0.005;
      var A = axes(ctx, W, H, pad, -11, 16, ylo, yhi, "相对政策时间（年）", "对数基尼系数变化");
      ticksLinear(-10, 15, 7).forEach(function (t) {
        ctx.textAlign = "center"; ctx.fillStyle = "#8b8878"; ctx.fillText(String(t), A.px(t), H - pad.b + 13);
      });
      ticksLinear(ylo, yhi, 5).forEach(function (t) {
        ctx.textAlign = "right"; ctx.fillText(t.toFixed(3), pad.l - 5, A.py(t) + 3);
      });
      ctx.strokeStyle = "#b23b2e"; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pad.l, A.py(0)); ctx.lineTo(W - pad.r, A.py(0)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(A.px(0), pad.t); ctx.lineTo(A.px(0), H - pad.b); ctx.stroke();
      ctx.setLineDash([]);
      var pre = pts.filter(function (p) { return p.t < 0; });
      var post = pts.filter(function (p) { return p.t > 0; });
      function line(set, col) {
        ctx.strokeStyle = col; ctx.lineWidth = 1.7;
        ctx.beginPath();
        set.forEach(function (p, i) { i ? ctx.lineTo(A.px(p.t), A.py(p.b)) : ctx.moveTo(A.px(p.t), A.py(p.b)); });
        ctx.stroke();
        ctx.fillStyle = col;
        set.forEach(function (p) {
          ctx.beginPath(); ctx.arc(A.px(p.t), A.py(p.b), 3.2, 0, 6.284); ctx.fill();
        });
      }
      if (chk.checked) {
        ctx.strokeStyle = "rgba(31,58,95,.45)"; ctx.lineWidth = 1.2;
        pts.forEach(function (p) {
          ctx.beginPath(); ctx.moveTo(A.px(p.t), A.py(p.lb)); ctx.lineTo(A.px(p.t), A.py(p.ub)); ctx.stroke();
        });
      }
      line(pre, "#1f3a5f"); line(post, "#b23b2e");
      ctx.fillStyle = "#1f3a5f"; ctx.textAlign = "center";
      ctx.fillText("政策前", A.px(-5), pad.t + 10);
      ctx.fillStyle = "#b23b2e"; ctx.fillText("政策后", A.px(8), pad.t + 10);
    }
    chk.addEventListener("change", draw);
    window.addEventListener("resize", function () {
      W = Math.min($(".w-body", box).clientWidth || 640, 720); draw();
    });
    draw();
    var bl = $("[data-r=baseline]", box);
    if (bl && d.baseline) {
      bl.innerHTML = "<div class='stat'><div class='l'>_intra 系数（基准 DID）</div><div class='v'>" + fmt(d.baseline.b, 4) +
        "<span class='star'>" + (d.baseline.star || "") + "</span></div><div class='l'>聚类稳健标准误 " + fmt(d.baseline.se, 4) +
        " · t = " + fmt(d.baseline.t, 2) + " · p = " + fmtP(d.baseline.p) + "</div></div>" +
        "<div class='stat'><div class='l'>样本</div><div class='v'>" + d.baseline.n + "</div><div class='l'>聚类到 " + d.baseline.G + " 个州</div></div>";
    }
  }

  /* ================= 组件: 排序组合柱状图 ================= */
  function widgetSortbars(box, d) {
    var cv = $(".chart", box);
    var groups = [];
    for (var i = 1; i <= 10; i++) groups.push("P" + i);
    groups.push("P10-P1");
    var vals = [];
    for (var i = 1; i <= 10; i++) vals.push(d.port_mean["P" + i]);
    vals.push(d.gap.mean);
    function draw() {
      var W = Math.min($(".w-body", box).clientWidth || 640, 720), H = 280;
      var ctx = prepCanvas(cv, W, H);
      var pad = { l: 46, r: 12, t: 18, b: 40 };
      var lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max(0, Math.max.apply(null, vals));
      var span = hi - lo || 1; lo -= span * 0.08; hi += span * 0.08;
      var A = axes(ctx, W, H, pad, 0, groups.length - 1, lo, hi, "BM 分组组合", "月均超额收益（%）");
      ticksLinear(lo, hi, 5).forEach(function (t) {
        ctx.textAlign = "right"; ctx.fillStyle = "#8b8878"; ctx.fillText(t.toFixed(2), pad.l - 5, A.py(t) + 3);
      });
      var slot = (W - pad.l - pad.r) / groups.length;
      var bw = slot * 0.66;
      groups.forEach(function (g, i) {
        var v = vals[i];
        var cx = pad.l + (i + 0.5) * slot;
        ctx.fillStyle = i === 10 ? "#b23b2e" : (v >= 0 ? "#1f3a5f" : "#7d94b8");
        ctx.fillRect(cx - bw / 2, Math.min(A.py(v), A.py(0)), bw, Math.abs(A.py(v) - A.py(0)));
        ctx.fillStyle = "#262b33"; ctx.textAlign = "center"; ctx.font = "10px sans-serif";
        ctx.fillText(g, cx, H - pad.b + 14);
      });
      ctx.strokeStyle = "#b23b2e"; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pad.l, A.py(0)); ctx.lineTo(W - pad.r, A.py(0)); ctx.stroke(); ctx.setLineDash([]);
    }
    window.addEventListener("resize", draw);
    draw();
  }

  /* ================= 组件: 事件研究 CAR ================= */
  function widgetCar(box, d) {
    var cv = $(".chart", box);
    var legend = document.createElement("div");
    legend.className = "w-tabs";
    legend.style.marginBottom = ".4rem";
    box.querySelector(".w-body").insertBefore(legend, cv);
    var palette = ["#1f3a5f", "#2e7d5b", "#9a7b1e", "#7a5aa0", "#4f8fba"];
    var on = {平均: true};
    d.stocks.forEach(function (k) { on[k] = true; });
    var chips = {};
    function mkChip(key, color) {
      var b2 = document.createElement("button");
      b2.className = "w-tab on";
      b2.textContent = key;
      b2.style.borderColor = color;
      b2.addEventListener("click", function () {
        on[key] = !on[key];
        b2.classList.toggle("on", on[key]);
        draw();
      });
      legend.appendChild(b2);
      chips[key] = b2;
    }
    mkChip("平均", "#b23b2e");
    d.stocks.forEach(function (k, i) { mkChip(k, palette[i % palette.length]); });

    function draw() {
      var W = Math.min($(".w-body", box).clientWidth || 640, 720), H = 300;
      var ctx = prepCanvas(cv, W, H);
      var pad = { l: 50, r: 110, t: 18, b: 38 };
      var series = [];
      if (on["平均"]) series.push({ name: "平均", vals: d.avg_car_path, color: "#b23b2e", w: 2.4 });
      d.stocks.forEach(function (k, i) {
        if (on[k]) series.push({ name: k, vals: d.car_paths[k], color: palette[i % palette.length], w: 1.6 });
      });
      var lo = 0, hi = 0;
      series.forEach(function (se) {
        se.vals.forEach(function (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); });
      });
      var span = hi - lo || 1; lo -= span * 0.12; hi += span * 0.12;
      var A = axes(ctx, W, H, pad, -3, 3, lo, hi, "相对事件日的交易日", "CAR（%）");
      ticksLinear(lo, hi, 5).forEach(function (t) {
        ctx.textAlign = "right"; ctx.fillStyle = "#8b8878"; ctx.fillText(t.toFixed(2), pad.l - 5, A.py(t) + 3);
      });
      [-3, -2, -1, 0, 1, 2, 3].forEach(function (t2) {
        ctx.textAlign = "center"; ctx.fillStyle = "#8b8878"; ctx.fillText(String(t2), A.px(t2), H - pad.b + 13);
      });
      // 零线与事件日参考线
      ctx.strokeStyle = "#b23b2e"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, A.py(0)); ctx.lineTo(W - pad.r, A.py(0)); ctx.stroke();
      ctx.strokeStyle = "#2e7d5b";
      ctx.beginPath(); ctx.moveTo(A.px(0), pad.t); ctx.lineTo(A.px(0), H - pad.b); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#2e7d5b"; ctx.textAlign = "center"; ctx.font = "11px sans-serif";
      ctx.fillText("事件日", A.px(0), pad.t + 10);
      // 各序列折线 + 线尾标签
      series.forEach(function (se) {
        ctx.strokeStyle = se.color; ctx.lineWidth = se.w;
        ctx.beginPath();
        se.vals.forEach(function (v, i2) { i2 ? ctx.lineTo(A.px(d.days[i2]), A.py(v)) : ctx.moveTo(A.px(d.days[i2]), A.py(v)); });
        ctx.stroke();
        ctx.fillStyle = se.color;
        se.vals.forEach(function (v, i2) {
          ctx.beginPath(); ctx.arc(A.px(d.days[i2]), A.py(v), 2.6, 0, 6.284); ctx.fill();
        });
        var last = se.vals[se.vals.length - 1];
        ctx.textAlign = "left"; ctx.font = "11px sans-serif";
        ctx.fillText(se.name + " " + last.toFixed(2) + "%", W - pad.r + 8, A.py(last) + 4);
      });
      if (!series.length) {
        ctx.fillStyle = "#8b8878"; ctx.textAlign = "center"; ctx.font = "12px sans-serif";
        ctx.fillText("点击上方图例选择要显示的股票", (pad.l + W - pad.r) / 2, (pad.t + H - pad.b) / 2);
      }
    }
    window.addEventListener("resize", draw);
    draw();
  }

  /* ================= 组件: VAR 脉冲响应 ================= */
  function widgetIrf(box, d) {
    var irf = d.irf;
    var cv = $(".chart", box);
    var selS = $("select[data-k=shock]", box), selR = $("select[data-k=resp]", box);
    irf.vars.forEach(function (v, i) {
      selS.add(new Option(v, i)); selR.add(new Option(v, i));
    });
    selR.selectedIndex = Math.min(1, irf.vars.length - 1);
    function draw() {
      var si = selS.selectedIndex, ri = selR.selectedIndex;
      var arr = irf.series[si + "-" + ri];
      var W = Math.min($(".w-body", box).clientWidth || 640, 720), H = 300;
      var ctx = prepCanvas(cv, W, H);
      var pad = { l: 46, r: 16, t: 16, b: 36 };
      var lo = Math.min(0, Math.min.apply(null, arr)), hi = Math.max(0, Math.max.apply(null, arr));
      var span = hi - lo || 1; lo -= span * 0.08; hi += span * 0.08;
      var A = axes(ctx, W, H, pad, 0, arr.length - 1, lo, hi, "冲击后期数", "响应");
      ticksLinear(lo, hi, 5).forEach(function (t) {
        ctx.textAlign = "right"; ctx.fillStyle = "#8b8878"; ctx.fillText(t.toFixed(3), pad.l - 5, A.py(t) + 3);
      });
      ticksLinear(0, arr.length - 1, Math.min(8, arr.length - 1)).forEach(function (t) {
        ctx.textAlign = "center"; ctx.fillText(String(t), A.px(t), H - pad.b + 13);
      });
      ctx.strokeStyle = "#b23b2e"; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pad.l, A.py(0)); ctx.lineTo(W - pad.r, A.py(0)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = "#1f3a5f"; ctx.lineWidth = 2;
      ctx.beginPath();
      arr.forEach(function (v, i2) { i2 ? ctx.lineTo(A.px(i2), A.py(v)) : ctx.moveTo(A.px(i2), A.py(v)); });
      ctx.stroke();
      ctx.fillStyle = "#1f3a5f";
      arr.forEach(function (v, i2) { ctx.beginPath(); ctx.arc(A.px(i2), A.py(v), 2.8, 0, 6.284); ctx.fill(); });
      ctx.font = "12px sans-serif"; ctx.fillStyle = "#262b33"; ctx.textAlign = "left";
      ctx.fillText(irf.vars[si] + " 冲击 → " + irf.vars[ri] + " 响应", pad.l + 8, pad.t + 10);
    }
    selS.addEventListener("change", draw);
    selR.addEventListener("change", draw);
    window.addEventListener("resize", function () { draw(); });
    draw();
  }

  /* ================= 组件: RDD ================= */
  function widgetRdd(box, d) {
    var cv = $(".chart", box), slider = $("input[type=range]", box), valEl = $(".val", box);
    var effEl = $("[data-r=eff]", box), nEl = $("[data-r=n]", box);
    var W = Math.min($(".w-body", box).clientWidth || 640, 760), H = 320;
    function draw() {
      var h = parseFloat(slider.value);
      valEl.textContent = h;
      var m = d.margin, v = d.vote;
      var inL = [], inR = [];
      for (var i = 0; i < m.length; i++) {
        if (m[i] >= -h && m[i] <= 0) inL.push(i);
        else if (m[i] > 0 && m[i] <= h) inR.push(i);
      }
      function fit(idx) {
        var X = idx.map(function (i2) { return [m[i2]]; }), Y = idx.map(function (i2) { return v[i2]; });
        return ols(X, Y);
      }
      var bL = fit(inL), bR = fit(inR);
      var eff = bR[0] + bR[1] * 0 - (bL[0] + bL[1] * 0);
      effEl.textContent = fmt(eff, 2) + " 个百分点";
      nEl.textContent = (inL.length + inR.length).toLocaleString();
      var ctx = prepCanvas(cv, W, H);
      var pad = { l: 44, r: 14, t: 16, b: 38 };
      var xmin = -50, xmax = 50;
      var ymin = 20, ymax = 100;
      var A = axes(ctx, W, H, pad, xmin, xmax, ymin, ymax, "民主党上期得票领先幅度 margin", "民主党下期得票率 vote");
      ticksLinear(ymin, ymax, 5).forEach(function (t) {
        ctx.textAlign = "right"; ctx.fillText(t.toFixed(0), pad.l - 5, A.py(t) + 3);
      });
      ticksLinear(xmin, xmax, 6).forEach(function (t) {
        ctx.textAlign = "center"; ctx.fillText(t.toFixed(0), A.px(t), H - pad.b + 13);
      });
      ctx.fillStyle = "rgba(38,43,51,.35)";
      for (var i2 = 0; i2 < m.length; i2++) {
        if (m[i2] >= xmin && m[i2] <= xmax) {
          ctx.beginPath(); ctx.arc(A.px(m[i2]), A.py(v[i2]), 1.6, 0, 6.284); ctx.fill();
        }
      }
      ctx.strokeStyle = "#2e7d5b"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(A.px(-h), A.py(bL[0] + bL[1] * (-h))); ctx.lineTo(A.px(0), A.py(bL[0])); ctx.stroke();
      ctx.strokeStyle = "#c47f17";
      ctx.beginPath(); ctx.moveTo(A.px(0), A.py(bR[0])); ctx.lineTo(A.px(h), A.py(bR[0] + bR[1] * h)); ctx.stroke();
      ctx.strokeStyle = "#b23b2e"; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(A.px(0), pad.t); ctx.lineTo(A.px(0), H - pad.b); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#2e7d5b"; ctx.textAlign = "right"; ctx.fillText("左侧拟合", A.px(-2), A.py(bL[0]) - 8);
      ctx.fillStyle = "#c47f17"; ctx.textAlign = "left"; ctx.fillText("右侧拟合", A.px(2), A.py(bR[0]) - 8);
    }
    slider.addEventListener("input", draw);
    window.addEventListener("resize", function () {
      W = Math.min($(".w-body", box).clientWidth || 640, 760); draw();
    });
    draw();
  }

  /* ---------- 启动 ---------- */
  var INIT = { winsor: widgetWinsor, tabstat: widgetTabstat, heatmap: widgetHeatmap,
               ivsim: widgetIvsim, psm: widgetPsm, eventstudy: widgetEvent, rdd: widgetRdd,
               irf: widgetIrf, sortbars: widgetSortbars, car: widgetCar };
  $all(".widget[data-w]").forEach(function (box) {
    var type = box.getAttribute("data-w");
    if (!INIT[type]) return;
    var d = getJSON("wj-" + type);
    if (type === "ivsim") INIT[type](box, null);
    else if (d) INIT[type](box, d);
  });
})();
