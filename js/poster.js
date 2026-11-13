/**
 * 约你吃饭 · 朋友圈信笺海报
 * 在浏览器 Canvas 与微信小程序 Canvas 2D 上绘制同一张请柬。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    var qr;
    try { qr = require("./lib/qrcode"); } catch (e1) {
      try { qr = require("./qrcode"); } catch (e2) { qr = null; }
    }
    module.exports = factory(qr);
  } else {
    root.YueniPoster = factory(root.qrcode);
  }
})(typeof self !== "undefined" ? self : this, function (qrcodeFn) {
  "use strict";

  var W = 1080;
  var H = 1920;
  var SONG = '"Yueni Song","Songti SC","STSong","Source Han Serif SC","Noto Serif CJK SC","SimSun",serif';
  var KAI = '"Yueni Kai","Kaiti SC","STKaiti","KaiTi","STSong",serif';

  var PALETTES = {
    jacaranda: {
      dark: false, page: "#E6E2F0", bg: "#F5F3FA", paper: "#FCFBFE",
      ink: "#25213A", muted: "#6F6A85", line: "#E2DEEE",
      accent: "#8A7FD0", primary: "#4B3F8C", tint: "#E6E1F5",
      qrPaper: "#FFFFFF", qrInk: "#16131F", radius: 0
    },
    cnred: {
      dark: false, page: "#EFE4DC", bg: "#F8F1EA", paper: "#FDF8F2",
      ink: "#2A1212", muted: "#8A5A54", line: "#E8D6CE",
      accent: "#B83A32", primary: "#8E1C1C", tint: "#F3E0DC",
      qrPaper: "#FFFBF6", qrInk: "#1A0A0A", radius: 0
    },
    macaron: {
      dark: false, page: "#F3E8E4", bg: "#FFF8F4", paper: "#FFFFFF",
      ink: "#3D2A32", muted: "#8A7380", line: "#F0E0E6",
      accent: "#4A8A7A", primary: "#B04A60", tint: "#FDE8EE",
      qrPaper: "#FFFFFF", qrInk: "#1E1216", radius: 56
    },
    blackgold: {
      dark: true, page: "#0A0907", bg: "#12100C", paper: "#1C1913",
      ink: "#F3E6C4", muted: "#B8A27A", line: "#4A3F28",
      accent: "#E3C88A", primary: "#C9A45C", tint: "#2A2418",
      qrPaper: "#F6EED4", qrInk: "#16130C", radius: 0
    },
    redgold: {
      dark: true, page: "#120606", bg: "#1A0A0A", paper: "#2A1010",
      ink: "#F6E6C4", muted: "#D4B48A", line: "#5A2A24",
      accent: "#E3C88A", primary: "#C9A45C", tint: "#3A1814",
      qrPaper: "#F6EED4", qrInk: "#1A0C08", radius: 0
    }
  };

  function getPalette(id) {
    return PALETTES[id] || PALETTES.jacaranda;
  }

  function rng(seed) {
    var s = 2166136261;
    String(seed || "yueni").split("").forEach(function (ch) {
      s ^= ch.charCodeAt(0);
      s = Math.imul(s, 16777619);
    });
    return function () {
      s += 0x6D2B79F5;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexAlpha(hex, a) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    var rr = r;
    if (typeof r === "number") rr = [r, r, r, r];
    var tl = Math.max(0, rr[0] || 0), tr = Math.max(0, rr[1] || 0), br = Math.max(0, rr[2] || 0), bl = Math.max(0, rr[3] || 0);
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, [tl, tr, br, bl]);
      return;
    }
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    if (tr) ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    if (br) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    if (bl) ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    if (tl) ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }

  function fillTracked(ctx, text, x, y, tracking) {
    var chars = String(text || "").split("");
    if (!chars.length) return 0;
    var widths = [];
    var total = 0;
    for (var i = 0; i < chars.length; i++) {
      var w = ctx.measureText(chars[i]).width;
      widths.push(w);
      total += w;
    }
    total += tracking * (chars.length - 1);
    var align = ctx.textAlign || "left";
    var start = x;
    if (align === "center") start = x - total / 2;
    else if (align === "right") start = x - total;
    var prev = ctx.textAlign;
    ctx.textAlign = "left";
    var cx = start;
    for (var j = 0; j < chars.length; j++) {
      ctx.fillText(chars[j], cx, y);
      cx += widths[j] + tracking;
    }
    ctx.textAlign = prev;
    return total;
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    var out = [];
    var paras = String(text || "").split(/\n+/);
    for (var p = 0; p < paras.length && out.length < maxLines; p++) {
      var s = paras[p].replace(/\s+/g, " ").trim();
      if (!s) continue;
      var buf = "";
      for (var i = 0; i < s.length; i++) {
        var trial = buf + s.charAt(i);
        if (buf && ctx.measureText(trial).width > maxWidth) {
          out.push(buf);
          if (out.length >= maxLines) break;
          buf = s.charAt(i);
        } else {
          buf = trial;
        }
      }
      if (out.length < maxLines && buf) out.push(buf);
    }
    if (out.length >= maxLines) {
      var raw = String(text || "").replace(/\s+/g, "");
      var joined = out.join("");
      if (joined.length < raw.length) {
        var last = out[maxLines - 1];
        while (last.length && ctx.measureText(last + "…").width > maxWidth) {
          last = last.slice(0, -1);
        }
        out[maxLines - 1] = last + "…";
      }
    }
    return out;
  }

  function excerptOf(message, ctx, maxWidth) {
    return wrapLines(ctx, message || "", maxWidth, 3);
  }

  function buildQR(url) {
    if (!qrcodeFn) throw new Error("qrcode library missing");
    var text = String(url || "");
    var last = new Error("qr");
    for (var t = 3; t <= 16; t++) {
      try {
        var qr = qrcodeFn(t, "Q");
        qr.addData(text, "Byte");
        qr.make();
        var n = qr.getModuleCount();
        var m = [];
        for (var r = 0; r < n; r++) {
          m[r] = [];
          for (var c = 0; c < n; c++) m[r][c] = qr.isDark(r, c);
        }
        return m;
      } catch (e) {
        last = e;
      }
    }
    throw last;
  }

  function isFinder(n, r, c) {
    return (r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8);
  }

  function drawQR(ctx, x, y, size, matrix, ink, paper) {
    var n = matrix.length;
    var quiet = 4;
    var cells = n + quiet * 2;
    var cell = Math.max(1, Math.floor(size / cells));
    var used = cell * cells;
    var ox = x + Math.floor((size - used) / 2);
    var oy = y + Math.floor((size - used) / 2);
    ctx.fillStyle = paper;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = ink;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!matrix[r][c]) continue;
        var px = ox + (c + quiet) * cell;
        var py = oy + (r + quiet) * cell;
        ctx.fillRect(px, py, cell, cell);
      }
    }
  }

  function drawPetal(ctx, x, y, size, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.55);
    ctx.bezierCurveTo(size * 0.7, -size * 0.25, size * 0.55, size * 0.45, 0, size * 0.6);
    ctx.bezierCurveTo(-size * 0.45, size * 0.4, -size * 0.7, -size * 0.2, 0, -size * 0.55);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawMaple(ctx, x, y, size, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(size / 28, size / 28);
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.quadraticCurveTo(3, -10, 7, -12);
    ctx.quadraticCurveTo(13, -14, 14, -6);
    ctx.quadraticCurveTo(20, -7, 18, 0);
    ctx.quadraticCurveTo(22, 4, 14, 6);
    ctx.quadraticCurveTo(10, 8, 7, 13);
    ctx.quadraticCurveTo(3, 9, 0, 16);
    ctx.quadraticCurveTo(-3, 9, -7, 13);
    ctx.quadraticCurveTo(-10, 8, -14, 6);
    ctx.quadraticCurveTo(-22, 4, -18, 0);
    ctx.quadraticCurveTo(-20, -7, -14, -6);
    ctx.quadraticCurveTo(-13, -14, -7, -12);
    ctx.quadraticCurveTo(-3, -10, 0, -16);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, 22);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }

  function drawGinkgo(ctx, x, y, size, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.7);
    ctx.quadraticCurveTo(-size * 1.05, size * 0.05, -size * 0.85, -size * 0.55);
    ctx.quadraticCurveTo(0, -size * 0.15, size * 0.85, -size * 0.55);
    ctx.quadraticCurveTo(size * 1.05, size * 0.05, 0, size * 0.7);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, size * 0.2);
    ctx.lineTo(0, size * 0.95);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  function drawSeasonWash(ctx, w, h, season, pal) {
    var g;
    if (season === "spring") {
      g = ctx.createRadialGradient(w * 0.18, 0, 0, w * 0.18, 0, w * 0.7);
      g.addColorStop(0, pal.dark ? hexAlpha(pal.accent, 0.14) : "rgba(236,186,206,0.34)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      g = ctx.createRadialGradient(w * 0.92, h, 0, w * 0.92, h, w * 0.62);
      g.addColorStop(0, pal.dark ? hexAlpha(pal.primary, 0.1) : "rgba(196,176,220,0.2)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (season === "summer") {
      g = ctx.createRadialGradient(w * 0.8, -h * 0.02, 0, w * 0.8, 0, w * 0.7);
      g.addColorStop(0, pal.dark ? hexAlpha(pal.accent, 0.3) : "rgba(255,214,120,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      g = ctx.createLinearGradient(0, 0, 0, h * 0.42);
      g.addColorStop(0, pal.dark ? hexAlpha(pal.accent, 0.08) : "rgba(255,236,190,0.2)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      g = ctx.createRadialGradient(w * 0.12, h, 0, w * 0.12, h, w * 0.55);
      g.addColorStop(0, pal.dark ? hexAlpha(pal.primary, 0.1) : "rgba(110,158,72,0.16)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (season === "autumn") {
      g = ctx.createRadialGradient(w * 0.08, 0, 0, w * 0.08, 0, w * 0.62);
      g.addColorStop(0, pal.dark ? hexAlpha(pal.primary, 0.16) : "rgba(196,86,36,0.14)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      g = ctx.createRadialGradient(w * 0.92, h * 0.86, 0, w * 0.92, h * 0.86, w * 0.6);
      g.addColorStop(0, pal.dark ? hexAlpha(pal.accent, 0.12) : "rgba(196,140,40,0.16)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else {
      g = ctx.createRadialGradient(w * 0.5, -h * 0.04, 0, w * 0.5, 0, w * 0.7);
      g.addColorStop(0, pal.dark ? hexAlpha("#F3E6C4", 0.14) : "rgba(226,234,246,0.46)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      g = ctx.createLinearGradient(0, 0, 0, h * 0.4);
      g.addColorStop(0, pal.dark ? hexAlpha(pal.accent, 0.06) : "rgba(210,220,236,0.16)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function inBand(x, y, w, h, band) {
    var left = x < band || x > w - band;
    var top = y < band * 1.3 || y > h - band * 1.3;
    return left || top;
  }
  function drawSeasonMotifs(ctx, w, h, season, pal, rand, opt) {
    opt = opt || {};
    var i, x, y, s, rot, a;
    if (opt.corners && opt.box) {
      var b = opt.box;
      var spots = [
        [b.l + 36, b.t + 40], [b.r - 40, b.t + 52],
        [b.l + 44, b.b - 52], [b.r - 36, b.b - 64],
        [b.l + 70, b.t + 90], [b.r - 80, b.b - 100]
      ];
      if (season === "spring") {
        var cols = pal.dark
          ? [hexAlpha(pal.accent, 0.34), hexAlpha("#E7B4C6", 0.3)]
          : ["rgba(231,180,198,0.5)", "rgba(200,176,220,0.38)"];
        for (i = 0; i < spots.length; i++) {
          drawPetal(ctx, spots[i][0], spots[i][1], 16 + (i % 3) * 6, cols[i % cols.length], (i * 0.7) - 0.4);
        }
      } else if (season === "summer") {
        for (i = 0; i < spots.length; i++) {
          ctx.beginPath();
          ctx.fillStyle = pal.dark ? hexAlpha(pal.accent, 0.16) : "rgba(255,214,120,0.28)";
          ctx.arc(spots[i][0], spots[i][1], 4 + (i % 3) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (season === "autumn") {
        var maples = pal.dark
          ? [hexAlpha("#C9A45C", 0.4), hexAlpha("#E3C88A", 0.28)]
          : ["rgba(196,90,42,0.4)", "rgba(196,140,40,0.34)"];
        var gink = pal.dark ? hexAlpha("#E3C88A", 0.3) : "rgba(210,170,60,0.38)";
        for (i = 0; i < spots.length; i++) {
          if (i % 3 === 0) drawGinkgo(ctx, spots[i][0], spots[i][1], 16, gink, (i * 0.5) - 0.3);
          else drawMaple(ctx, spots[i][0], spots[i][1], 20 + i, maples[i % maples.length], (i * 0.6) - 0.5);
        }
      } else {
        for (i = 0; i < 10; i++) {
          var sx = (i % 2 === 0 ? b.l : b.r) + (i % 2 === 0 ? 24 + i * 8 : -30 - i * 6);
          var sy = (i < 5 ? b.t : b.b) + (i < 5 ? 28 + i * 16 : -36 - (i - 5) * 14);
          ctx.beginPath();
          ctx.fillStyle = pal.dark ? hexAlpha("#F3E6C4", 0.35) : "rgba(255,255,255,0.7)";
          ctx.arc(sx, sy, 2.2 + (i % 3), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    }
    var band = 86;
    if (season === "spring") {
      var pcols = pal.dark
        ? [hexAlpha(pal.accent, 0.32), hexAlpha(pal.primary, 0.2), hexAlpha("#E7B4C6", 0.26)]
        : ["rgba(231,180,198,0.7)", "rgba(200,176,220,0.5)", "rgba(232,196,210,0.55)"];
      for (i = 0; i < 22; i++) {
        x = w * (0.02 + rand() * 0.96);
        y = h * (0.02 + rand() * 0.96);
        if (!inBand(x, y, w, h, band) && rand() < 0.85) continue;
        s = 12 + rand() * 20;
        rot = (rand() - 0.5) * 2.2;
        drawPetal(ctx, x, y, s, pcols[i % pcols.length], rot);
      }
    } else if (season === "summer") {
      for (i = 0; i < 22; i++) {
        x = w * (0.03 + rand() * 0.94);
        y = h * (0.03 + rand() * 0.94);
        if (!inBand(x, y, w, h, band) && rand() < 0.8) continue;
        var rad = 3 + rand() * 7;
        a = pal.dark ? (0.12 + rand() * 0.14) : (0.16 + rand() * 0.22);
        ctx.beginPath();
        ctx.fillStyle = pal.dark ? hexAlpha(pal.accent, a) : "rgba(255,220,120," + a + ")";
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (season === "autumn") {
      var mcols = pal.dark
        ? [hexAlpha("#C9A45C", 0.42), hexAlpha("#E3C88A", 0.28), hexAlpha("#B07030", 0.34)]
        : ["rgba(196,90,42,0.58)", "rgba(176,80,36,0.46)", "rgba(196,140,40,0.5)"];
      var gcol = pal.dark ? hexAlpha("#E3C88A", 0.32) : "rgba(210,170,60,0.52)";
      for (i = 0; i < 20; i++) {
        x = w * (0.02 + rand() * 0.96);
        y = h * (0.02 + rand() * 0.96);
        if (!inBand(x, y, w, h, band) && rand() < 0.82) continue;
        s = 14 + rand() * 20;
        rot = (rand() - 0.4) * 1.8;
        if (i % 3 === 0) drawGinkgo(ctx, x, y, s * 0.7, gcol, rot);
        else drawMaple(ctx, x, y, s, mcols[i % mcols.length], rot);
      }
    } else {
      for (i = 0; i < 40; i++) {
        x = w * rand();
        y = h * rand();
        if (!inBand(x, y, w, h, band) && rand() < 0.7) continue;
        var sz = 2.2 + rand() * 5.5;
        a = pal.dark ? (0.22 + rand() * 0.28) : (0.45 + rand() * 0.4);
        ctx.beginPath();
        ctx.fillStyle = pal.dark ? hexAlpha("#F3E6C4", a) : "rgba(255,255,255," + a + ")";
        ctx.arc(x, y, sz, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawRule(ctx, x, y, w, pal) {
    ctx.save();
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.46, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.54, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = pal.accent;
    ctx.translate(x + w / 2, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.2, -3.2, 6.4, 6.4);
    ctx.restore();
  }

  function drawEnvelope(ctx, cx, cy, pal) {
    var ew = 420, eh = 260;
    var x = cx - ew / 2, y = cy - eh / 2;
    ctx.save();
    ctx.shadowColor = pal.dark ? "rgba(0,0,0,0.35)" : "rgba(37,33,58,0.08)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = pal.paper;
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, ew, eh, pal.radius ? 18 : 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.stroke();

    /* flap */
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 2);
    ctx.lineTo(cx, y + eh * 0.46);
    ctx.lineTo(x + ew - 2, y + 2);
    ctx.closePath();
    ctx.fillStyle = pal.tint;
    ctx.fill();
    ctx.strokeStyle = pal.line;
    ctx.stroke();

    /* inner fold lines */
    ctx.beginPath();
    ctx.moveTo(x + 2, y + eh - 2);
    ctx.lineTo(cx, y + eh * 0.48);
    ctx.lineTo(x + ew - 2, y + eh - 2);
    ctx.strokeStyle = hexAlpha(pal.line, 0.9);
    ctx.stroke();

    /* seal */
    var sy = y + eh * 0.44;
    ctx.beginPath();
    ctx.fillStyle = pal.primary;
    ctx.arc(cx, sy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    ctx.arc(cx, sy, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw(ctx, opts, matrix) {
    var w = opts.width || W;
    var h = opts.height || H;
    var pal = getPalette(opts.theme);
    var season = opts.season || "autumn";
    var mode = opts.mode || "invite";
    var rand = rng((opts.toLabel || "") + (opts.from || "") + (opts.timeTitle || "") + season + (opts.theme || ""));

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal.page;
    ctx.fillRect(0, 0, w, h);

    /* outer sheet — leave a visible seasonal frame around the letter */
    var m = 28;
    roundRectPath(ctx, m, m, w - m * 2, h - m * 2, pal.radius || 0);
    ctx.fillStyle = pal.bg;
    ctx.fill();
    ctx.save();
    ctx.clip();
    drawSeasonWash(ctx, w, h, season, pal);
    drawSeasonMotifs(ctx, w, h, season, pal, rand, { frameOnly: false, frame: { l: 0, t: 0, r: w, b: h } });
    ctx.restore();

    /* inner letter panel */
    var pad = 72;
    var ix = pad, iy = 96, iw = w - pad * 2, ih = h - 168;
    ctx.save();
    ctx.shadowColor = pal.dark ? "rgba(0,0,0,0.28)" : "rgba(37,33,58,0.06)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 6;
    roundRectPath(ctx, ix, iy, iw, ih, pal.radius ? 36 : 0);
    ctx.fillStyle = pal.paper;
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRectPath(ctx, ix, iy, iw, ih, pal.radius ? 36 : 0);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    /* double border */
    roundRectPath(ctx, ix + 18, iy + 18, iw - 36, ih - 36, pal.radius ? 24 : 0);
    ctx.strokeStyle = hexAlpha(pal.line, 0.85);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    /* a few seasonal marks in the letter's corners, never over the text column */
    drawSeasonMotifs(ctx, w, h, season, pal, rand, {
      corners: true,
      box: { l: ix + 20, t: iy + 20, r: ix + iw - 20, b: iy + ih - 20 }
    });

    var cx = w / 2;
    var contentL = ix + 72;
    var contentR = ix + iw - 72;
    var contentW = contentR - contentL;
    var y = iy + 80;

    ctx.fillStyle = pal.accent;
    ctx.font = '28px ' + SONG;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    fillTracked(ctx, opts.kicker || "约你吃饭", cx, y, 18);
    y += 52;
    drawRule(ctx, contentL + 40, y, contentW - 80, pal);
    y += 118;

    if (mode === "card") {
      drawEnvelope(ctx, cx, y + 120, pal);
      y += 280;
    }

    var toLabel = opts.toLabel || "你";
    ctx.fillStyle = pal.primary;
    ctx.font = '78px ' + SONG;
    fillTracked(ctx, "致  " + toLabel, cx, y, 14);
    y += 36;

    if (mode === "invite") {
      y += 54;
      ctx.font = '36px ' + KAI;
      ctx.fillStyle = pal.ink;
      ctx.textAlign = "left";
      var lines = excerptOf(opts.excerpt || "", ctx, contentW);
      if (!lines.length && opts.hintLine) lines = excerptOf(opts.hintLine, ctx, contentW);
      var lh = 72;
      for (var i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], contentL, y + i * lh);
      }
      y += Math.max(lines.length, 1) * lh + 12;
      ctx.textAlign = "right";
      ctx.font = '40px ' + SONG;
      ctx.fillStyle = pal.accent;
      fillTracked(ctx, opts.from || "", contentR, y, 10);
      ctx.textAlign = "center";
      y += 70;
    } else if (opts.hintLine) {
      y += 56;
      ctx.font = '38px ' + SONG;
      ctx.fillStyle = pal.ink;
      var hints = wrapLines(ctx, opts.hintLine, contentW - 20, 2);
      for (var hli = 0; hli < hints.length; hli++) {
        ctx.fillText(hints[hli], cx, y + hli * 64);
      }
      y += hints.length * 64 + 18;
      if (opts.from) {
        ctx.font = '36px ' + SONG;
        ctx.fillStyle = pal.accent;
        ctx.textAlign = "right";
        fillTracked(ctx, opts.from, contentR, y, 10);
        ctx.textAlign = "center";
        y += 64;
      } else {
        y += 24;
      }
    }

    y += 10;
    drawRule(ctx, contentL + 80, y, contentW - 160, pal);
    y += 70;

    ctx.fillStyle = pal.accent;
    ctx.font = '24px ' + SONG;
    fillTracked(ctx, "赴约时间", cx, y, 16);
    y += 64;
    ctx.fillStyle = pal.ink;
    ctx.font = '56px ' + SONG;
    ctx.fillText(opts.timeTitle || "时刻待定", cx, y);
    y += 52;
    if (opts.timeMeta) {
      ctx.fillStyle = pal.muted;
      ctx.font = '30px ' + SONG;
      ctx.fillText(opts.timeMeta, cx, y);
      y += 56;
    } else {
      y += 28;
    }

    ctx.fillStyle = pal.muted;
    ctx.font = '26px ' + SONG;
    fillTracked(ctx, opts.restLine || "锦途川滇 · 石家庄万象天成", cx, y, 6);

    /* QR sits in the remaining lower field, centered in that space */
    var qrSize = 252;
    var stamp = 28;
    var captionH = 60;
    var bottomPad = 56;
    var fieldTop = y + 36;
    var fieldBot = iy + ih - bottomPad;
    var blockH = qrSize + stamp * 2 + captionH;
    var qrY;
    if (fieldBot - fieldTop > blockH + 8) {
      qrY = fieldTop + (fieldBot - fieldTop - blockH) * 0.42 + stamp;
    } else {
      qrY = fieldBot - captionH - qrSize;
    }
    var qrX = cx - qrSize / 2;
    ctx.save();
    ctx.shadowColor = pal.dark ? "rgba(0,0,0,0.25)" : "rgba(37,33,58,0.06)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    roundRectPath(ctx, qrX - stamp, qrY - stamp, qrSize + stamp * 2, qrSize + stamp * 2, pal.radius ? 16 : 2);
    ctx.fillStyle = pal.qrPaper;
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRectPath(ctx, qrX - stamp, qrY - stamp, qrSize + stamp * 2, qrSize + stamp * 2, pal.radius ? 16 : 2);
    ctx.strokeStyle = pal.dark ? pal.primary : pal.line;
    ctx.lineWidth = pal.dark ? 2 : 1.5;
    ctx.stroke();
    ctx.restore();
    if (matrix) drawQR(ctx, qrX, qrY, qrSize, matrix, pal.qrInk, pal.qrPaper);

    ctx.fillStyle = pal.muted;
    ctx.font = '22px ' + SONG;
    ctx.textAlign = "center";
    fillTracked(ctx, "扫码展开这封信", cx, qrY + qrSize + stamp + 36, 8);
  }

  function waitFonts() {
    if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
    var loads = [
      document.fonts.load("78px " + SONG),
      document.fonts.load("36px " + KAI)
    ];
    return Promise.all(loads).then(function () { return document.fonts.ready; }).catch(function () {});
  }

  function renderToCanvas(opts, canvas) {
    opts = opts || {};
    var width = opts.width || W;
    var height = opts.height || H;
    var c = canvas;
    if (!c && typeof document !== "undefined") c = document.createElement("canvas");
    if (!c) throw new Error("canvas required");
    c.width = width;
    c.height = height;
    var ctx = c.getContext("2d");
    if (!ctx) throw new Error("2d context missing");
    var matrix = null;
    try { matrix = buildQR(opts.url || ""); } catch (e) { matrix = null; }
    draw(ctx, { width: width, height: height, theme: opts.theme, season: opts.season, mode: opts.mode, toLabel: opts.toLabel, from: opts.from, kicker: opts.kicker, excerpt: opts.excerpt, hintLine: opts.hintLine, timeTitle: opts.timeTitle, timeMeta: opts.timeMeta, restLine: opts.restLine, url: opts.url }, matrix);
    return c;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error("blob"));
        }, "image/png");
      } else {
        try {
          var data = canvas.toDataURL("image/png");
          resolve(data);
        } catch (e) { reject(e); }
      }
    });
  }

  function render(opts) {
    return waitFonts().then(function () {
      var canvas = renderToCanvas(opts);
      return canvasToBlob(canvas).then(function (blobOrUrl) {
        var url, blob = null;
        if (typeof blobOrUrl === "string") {
          url = blobOrUrl;
        } else {
          blob = blobOrUrl;
          url = (typeof URL !== "undefined" && URL.createObjectURL) ? URL.createObjectURL(blob) : "";
        }
        return { canvas: canvas, blob: blob, url: url, width: canvas.width, height: canvas.height };
      });
    });
  }

  return {
    WIDTH: W,
    HEIGHT: H,
    PALETTES: PALETTES,
    getPalette: getPalette,
    waitFonts: waitFonts,
    excerptOf: excerptOf,
    wrapLines: wrapLines,
    buildQR: buildQR,
    draw: draw,
    renderToCanvas: renderToCanvas,
    render: render
  };
});
