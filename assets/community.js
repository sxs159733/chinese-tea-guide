/* =========================================================
   一盏 · 中国茶事 · 评分与评论（复用共享 Appwrite Cloud 后端，无构建步骤）
   数据库 jzs：
     ratings  : recipe_id / voter_id / stars（每人每条一票，可改）
     comments : recipe_id / name / body
   多站点共用：本站所有 recipe_id 统一带 'tea:' 前缀，
   与浆造所（无前缀）、微醺手册（beer:）等其它站点天然隔离；绝不新建项目/集合。
   前端只含公开的 Project ID，不含任何密钥。
   对外暴露 window.JZSCommunity：
     getStats(id)                  读取 { avg, count, comments }
     decorateCards(root)           填充 [data-rate] 占位
     renderDialog(id, container)   渲染详情弹窗内的评分评论区
   数据就绪后派发 window 事件 'jzs-stats'。
   ========================================================= */

(function () {
  'use strict';

  /* 共享后端（公开信息，勿改） */
  var PROJECT_ID = '6af2c92a00134f1f4cf5';
  var ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
  var DB_ID = 'jzs';

  /* 本站前缀：所有读写都经过 pid()，避免与共享集合里其它站点撞 id */
  var PREFIX = 'tea:';
  function pid(id) {
    var s = String(id == null ? '' : id);
    return s.indexOf(PREFIX) === 0 ? s : PREFIX + s;
  }

  /* 本站多个仓库共用一个 GitHub Pages 源（sxs159733.github.io），
     localStorage 同源共享，因此键名也加站点前缀，避免缓存互相覆盖。 */
  var LS = {
    session: 'tea:jzs-session',
    mine: 'tea:jzs-my-ratings',
    name: 'tea:jzs-name',
    cache: 'tea:jzs-stats-cache'
  };

  var configured = !!PROJECT_ID;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (s) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s];
    });
  };

  var stats = {};
  var serviceState = configured ? 'loading' : 'off'; // off | loading | ready | error
  var statsPromise = null;
  var session = null;   // { userId, secret, expire }
  var localMine = {};
  try {
    session = JSON.parse(localStorage.getItem(LS.session) || 'null');
    Object.assign(localMine, JSON.parse(localStorage.getItem(LS.mine) || '{}'));
  } catch (e) { /* localStorage 不可用时不阻塞主流程 */ }

  function saveMine(id, stars) {
    localMine[id] = stars;
    try { localStorage.setItem(LS.mine, JSON.stringify(localMine)); } catch (e) { /* ignore */ }
  }

  function getStats(id) {
    return stats[pid(id)] || { avg: 0, count: 0, comments: 0 };
  }

  function starsHTML(avg, extraClass) {
    var pct = Math.max(0, Math.min(5, avg)) / 5 * 100;
    return '<span class="stars ' + (extraClass || '') + '" role="img" aria-label="平均 ' + avg + ' 星（满分 5 星）">' +
      '<span class="stars-bg" aria-hidden="true">★★★★★</span>' +
      '<span class="stars-fg" aria-hidden="true" style="width:' + pct + '%">★★★★★</span></span>';
  }

  function fmtDate(t) {
    var d = new Date(t);
    if (isNaN(d.getTime())) return '';
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* ---------------- Appwrite REST 客户端 ---------------- */
  function apiError(res, data) {
    var msg = '服务暂时不可用';
    if (res.status === 429) msg = '操作太频繁，请稍后再试';
    else if (data && data.message) msg = '提交未被接受，请检查内容后重试';
    return Object.assign(new Error(msg), { status: res.status, type: data && data.type });
  }

  /* 匿名会话：响应体 secret 为空，真正的令牌在 X-Fallback-Cookies 头里，
     必须把完整 base64 串原样放进 X-Appwrite-Session（服务端自行解码）。 */
  async function ensureSession() {
    if (session && session.secret && session.expire && new Date(session.expire).getTime() > Date.now() + 60000) {
      return session;
    }
    var res = await fetch(ENDPOINT + '/account/sessions/anonymous', {
      method: 'POST',
      headers: { 'X-Appwrite-Project': PROJECT_ID, 'Content-Type': 'application/json' },
      body: '{}'
    });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw apiError(res, data);
    var secret = '';
    try {
      var fb = res.headers.get('X-Fallback-Cookies');
      if (fb) secret = JSON.parse(fb)['a_session_' + PROJECT_ID] || '';
    } catch (e) { /* ignore */ }
    if (!secret) secret = (data && data.secret) || '';
    session = { userId: data.userId, secret: secret, expire: data.expire };
    try { localStorage.setItem(LS.session, JSON.stringify(session)); } catch (e) { /* ignore */ }
    return session;
  }

  async function aw(path, options) {
    var opts = options || {};
    var headers = { 'X-Appwrite-Project': PROJECT_ID, 'Content-Type': 'application/json' };
    if (opts.auth) {
      var s = await ensureSession();
      headers['X-Appwrite-Session'] = s.secret;
    }
    var res = await fetch(ENDPOINT + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (res.status === 401 && opts.auth && !opts._retried) {
      session = null;
      try { localStorage.removeItem(LS.session); } catch (e) { /* ignore */ }
      return aw(path, Object.assign({}, opts, { _retried: true }));
    }
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw apiError(res, data);
    return data;
  }

  /* Appwrite v2.x 查询是 JSON 对象，序列化后放进 queries[] 参数 */
  var qEqual = function (attr, val) { return { method: 'equal', attribute: attr, values: [val] }; };
  var qStartsWith = function (attr, val) { return { method: 'startsWith', attribute: attr, values: [val] }; };
  var qOrderDesc = function (attr) { return { method: 'orderDesc', attribute: attr }; };
  var qLimit = function (n) { return { method: 'limit', values: [n] }; };
  var qOffset = function (n) { return { method: 'offset', values: [n] }; };
  var qSelect = function (attrs) { return { method: 'select', values: attrs }; };

  function docsPath(col, queries) {
    var qs = (queries || []).map(function (x) {
      return 'queries[]=' + encodeURIComponent(JSON.stringify(x));
    }).join('&');
    return '/databases/' + DB_ID + '/collections/' + col + '/documents' + (qs ? '?' + qs : '');
  }
  var docPath = function (col, docId) {
    return '/databases/' + DB_ID + '/collections/' + col + '/documents/' + encodeURIComponent(docId);
  };

  /* 分页拉取本站数据：只取需要的字段，并按前缀过滤（共享集合里还有其它站点的数据） */
  async function listAll(col, selectAttrs) {
    var out = [];
    var usePrefixQuery = true;
    for (var offset = 0; offset < 5000; offset += 100) {
      var qs = [qSelect(selectAttrs), qLimit(100), qOffset(offset)];
      if (usePrefixQuery) qs.unshift(qStartsWith('recipe_id', PREFIX));
      var data;
      try {
        data = await aw(docsPath(col, qs));
      } catch (e) {
        /* 服务端不支持 startsWith 时退化为拉全表 + 客户端按前缀过滤 */
        if (usePrefixQuery) { usePrefixQuery = false; out = []; offset = -100; continue; }
        throw e;
      }
      var docs = (data && data.documents) || [];
      docs.forEach(function (d) {
        if (String(d.recipe_id || '').indexOf(PREFIX) === 0) out.push(d);
      });
      if (docs.length < 100) break;
    }
    return out;
  }

  function applyCache() {
    try {
      var cache = JSON.parse(localStorage.getItem(LS.cache) || 'null');
      if (cache && cache.stats && Date.now() - cache.t < 10 * 60 * 1000) {
        Object.keys(stats).forEach(function (k) { delete stats[k]; });
        Object.assign(stats, cache.stats);
        serviceState = 'ready';
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function loadStats(force) {
    if (!configured) return Promise.resolve();
    if (statsPromise && !force) return statsPromise;
    statsPromise = (async function () {
      try {
        var res = await Promise.all([
          listAll('ratings', ['recipe_id', 'stars']),
          listAll('comments', ['recipe_id'])
        ]);
        var next = {};
        res[0].forEach(function (d) {
          var s = next[d.recipe_id] || (next[d.recipe_id] = { sum: 0, count: 0, comments: 0 });
          s.sum += Number(d.stars) || 0;
          s.count += 1;
        });
        res[1].forEach(function (d) {
          var s = next[d.recipe_id] || (next[d.recipe_id] = { sum: 0, count: 0, comments: 0 });
          s.comments += 1;
        });
        Object.keys(stats).forEach(function (k) { delete stats[k]; });
        Object.keys(next).forEach(function (id) {
          var s = next[id];
          stats[id] = {
            avg: s.count ? Math.round(s.sum / s.count * 10) / 10 : 0,
            count: s.count, comments: s.comments
          };
        });
        serviceState = 'ready';
        try { localStorage.setItem(LS.cache, JSON.stringify({ t: Date.now(), stats: stats })); } catch (e) { /* ignore */ }
      } catch (e) {
        if (serviceState !== 'ready') serviceState = 'error';
      }
      window.dispatchEvent(new CustomEvent('jzs-stats'));
    })();
    return statsPromise;
  }

  /* ---------------- 卡片装饰 ---------------- */
  function decorateCards(root) {
    $$('[data-rate]', root || document).forEach(function (el) {
      if (serviceState !== 'ready') { el.innerHTML = ''; return; }
      var s = getStats(el.getAttribute('data-rate'));
      if (s.count > 0) {
        el.innerHTML = starsHTML(s.avg) + '<b>' + s.avg.toFixed(1) + '</b><span>(' + s.count +
          ')</span><span class="cm-sep">·</span><span>评论 ' + s.comments + '</span>';
      } else {
        el.innerHTML = '<span class="no-rate">暂无评分</span>';
      }
    });
  }

  /* ---------------- 详情弹窗评分评论区 ---------------- */
  function commentItemHTML(c) {
    return '<article class="cm-item"><header><b>' + esc(c.name) + '</b><time>' + fmtDate(c.created_at) +
      '</time></header><p>' + esc(c.body) + '</p></article>';
  }

  function summaryHTML(s) {
    return '<div class="cm-avg"><b>' + (s.count ? s.avg.toFixed(1) : '–') + '</b><span>/ 5</span></div>' +
      starsHTML(s.avg, 'stars-lg') +
      '<span class="cm-count">' + s.count + ' 人评分 · ' + s.comments + ' 条评论</span>';
  }

  function pickerHTML(mine) {
    return [1, 2, 3, 4, 5].map(function (n) {
      return '<button type="button" data-stars="' + n + '" class="' + (n <= mine ? 'on' : '') +
        '" aria-label="评 ' + n + ' 星" aria-pressed="' + (n === mine) + '">★</button>';
    }).join('');
  }

  async function renderDialog(rawId, container) {
    if (!container) return;
    var id = pid(rawId);
    if (!configured) { container.hidden = true; container.innerHTML = ''; return; }
    container.hidden = false;
    container.dataset.cmId = id;              // 快速切换条目时丢弃过期的异步结果
    var alive = function () { return container.dataset.cmId === id && container.isConnected; };
    container.innerHTML = '<h3>评分与评论</h3><p class="cm-note">正在加载…</p>';

    var comments, mine = localMine[id] || 0;
    try {
      var tasks = [
        loadStats(),
        aw(docsPath('comments', [qEqual('recipe_id', id), qOrderDesc('$createdAt'), qLimit(100)]))
      ];
      /* 已有会话时核对「我的评分」，清缓存也不丢 */
      if (session && session.secret) {
        tasks.push((async function () {
          var s = await ensureSession();
          return aw(docsPath('ratings', [
            qEqual('recipe_id', id), qEqual('voter_id', s.userId), qLimit(1)
          ]), { auth: true });
        })().catch(function () { return null; }));
      }
      var results = await Promise.all(tasks);
      comments = ((results[1] && results[1].documents) || []).map(function (d) {
        return { name: d.name, body: d.body, created_at: d.$createdAt };
      });
      var mineDoc = results[2] && results[2].documents && results[2].documents[0];
      if (mineDoc) { mine = Number(mineDoc.stars) || mine; saveMine(id, mine); }
    } catch (e) {
      if (!alive()) return;
      container.innerHTML = '<h3>评分与评论</h3><p class="cm-note">评分服务暂时不可用。' +
        '<button type="button" class="cm-retry">重试</button></p>';
      $('.cm-retry', container).addEventListener('click', function () { renderDialog(id, container); });
      return;
    }
    if (!alive()) return;

    var savedName = '';
    try { savedName = localStorage.getItem(LS.name) || ''; } catch (e) { /* ignore */ }

    container.innerHTML =
      '<h3>评分与评论</h3>' +
      '<div class="cm-summary" data-cm-summary>' + summaryHTML(getStats(id)) + '</div>' +
      '<div class="cm-mine">' +
        '<span class="cm-mine-label">我的评分</span>' +
        '<div class="cm-pick" data-cm-pick role="group" aria-label="为这款茶打分">' + pickerHTML(mine) + '</div>' +
        '<span class="cm-mine-note" data-cm-mine-note>' +
          (mine ? '已评 ' + mine + ' 星，点击星星可修改' : '点击星星即可评分') + '</span>' +
      '</div>' +
      '<form class="cm-form" data-cm-form>' +
        '<input type="text" name="name" maxlength="20" placeholder="你的昵称（可选，20 字以内）" value="' + esc(savedName) + '" autocomplete="nickname">' +
        '<textarea name="text" required maxlength="500" rows="3" placeholder="说说这款茶：香气、滋味、冲泡参数，或你的品饮心得…"></textarea>' +
        '<div class="cm-form-foot">' +
          '<span class="cm-form-msg" data-cm-msg role="status"></span>' +
          '<button class="btn" type="submit">发布评论</button>' +
        '</div>' +
      '</form>' +
      '<div class="cm-list">' +
        '<h4 data-cm-list-title>评论（' + getStats(id).comments + '）</h4>' +
        '<div data-cm-list>' + (comments.length ? comments.map(commentItemHTML).join('') :
          '<p class="cm-empty">还没有评论，来写第一条吧。</p>') + '</div>' +
      '</div>';

    var summaryEl = $('[data-cm-summary]', container);
    var pickEl = $('[data-cm-pick]', container);
    var mineNote = $('[data-cm-mine-note]', container);
    var form = $('[data-cm-form]', container);
    var msgEl = $('[data-cm-msg]', container);
    var listEl = $('[data-cm-list]', container);
    var listTitle = $('[data-cm-list-title]', container);

    function refreshSummary() {
      summaryEl.innerHTML = summaryHTML(getStats(id));
      listTitle.textContent = '评论（' + getStats(id).comments + '）';
    }
    function setMsg(text, kind) {
      msgEl.textContent = text;
      msgEl.className = 'cm-form-msg' + (kind ? ' ' + kind : '');
    }

    /* 一人一票、可改、防竞态 */
    pickEl.addEventListener('click', async function (e) {
      var btn = e.target.closest('[data-stars]');
      if (!btn) return;
      var n = Number(btn.getAttribute('data-stars'));
      $$('button', pickEl).forEach(function (b) { b.disabled = true; });
      try {
        var s = await ensureSession();
        var perms = ['read("any")', 'update("user:' + s.userId + '")', 'delete("user:' + s.userId + '")'];
        var ownQuery = [qEqual('recipe_id', id), qEqual('voter_id', s.userId), qLimit(1)];
        var found = await aw(docsPath('ratings', ownQuery), { auth: true });
        if (found.documents && found.documents.length) {
          await aw(docPath('ratings', found.documents[0].$id), {
            method: 'PATCH', auth: true, body: { data: { stars: n } }
          });
        } else {
          try {
            await aw(docsPath('ratings'), {
              method: 'POST', auth: true,
              body: {
                documentId: 'unique()',
                data: { recipe_id: id, voter_id: s.userId, stars: n },
                permissions: perms
              }
            });
          } catch (err) {
            if (err.status === 409) {
              var again = await aw(docsPath('ratings', ownQuery), { auth: true });
              if (again.documents && again.documents.length) {
                await aw(docPath('ratings', again.documents[0].$id), {
                  method: 'PATCH', auth: true, body: { data: { stars: n } }
                });
              } else { throw err; }
            } else { throw err; }
          }
        }
        saveMine(id, n);
        mine = n;
        await loadStats(true);
        if (!alive()) return;
        pickEl.innerHTML = pickerHTML(mine);
        mineNote.textContent = '已评 ' + mine + ' 星，点击星星可修改';
        refreshSummary();
      } catch (err) {
        if (!alive()) return;
        mineNote.textContent = err.message || '评分失败，请稍后再试';
        $$('button', pickEl).forEach(function (b) { b.disabled = false; });
      }
    });
    pickEl.addEventListener('mouseover', function (e) {
      var btn = e.target.closest('[data-stars]');
      if (!btn) return;
      var n = Number(btn.getAttribute('data-stars'));
      $$('button', pickEl).forEach(function (b) {
        b.classList.toggle('on', Number(b.getAttribute('data-stars')) <= n);
      });
    });
    pickEl.addEventListener('mouseleave', function () {
      $$('button', pickEl).forEach(function (b) {
        b.classList.toggle('on', Number(b.getAttribute('data-stars')) <= mine);
      });
    });

    /* 发布评论 */
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var nameInput = form.elements.name;
      var textInput = form.elements.text;
      var text = textInput.value.trim();
      if (!text) { setMsg('先写点什么再发布吧', 'err'); textInput.focus(); return; }
      var submitBtn = $('button[type="submit"]', form);
      submitBtn.disabled = true;
      setMsg('正在发布…');
      try {
        var name = nameInput.value.trim() || '匿名访客';
        var doc = await aw(docsPath('comments'), {
          method: 'POST', auth: true,
          body: {
            documentId: 'unique()',
            data: { recipe_id: id, name: name, body: text },
            permissions: ['read("any")']
          }
        });
        try { localStorage.setItem(LS.name, nameInput.value.trim()); } catch (e2) { /* ignore */ }
        if (!alive()) return;
        if (doc) {
          comments = [{ name: doc.name, body: doc.body, created_at: doc.$createdAt }].concat(comments);
          listEl.innerHTML = comments.map(commentItemHTML).join('');
        }
        stats[id] = Object.assign({}, getStats(id), { comments: getStats(id).comments + 1 });
        try { localStorage.setItem(LS.cache, JSON.stringify({ t: Date.now(), stats: stats })); } catch (e3) { /* ignore */ }
        textInput.value = '';
        refreshSummary();
        setMsg('评论已发布', 'ok');
        window.dispatchEvent(new CustomEvent('jzs-stats'));
      } catch (err) {
        setMsg(err.message || '发布失败，请稍后再试', 'err');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  window.JZSCommunity = {
    getStats: getStats,
    decorateCards: decorateCards,
    renderDialog: renderDialog,
    prefix: PREFIX
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (!configured) return;
    if (applyCache()) {
      decorateCards(document);
      window.dispatchEvent(new CustomEvent('jzs-stats'));
    }
    loadStats().then(function () { decorateCards(document); });
  });
})();
