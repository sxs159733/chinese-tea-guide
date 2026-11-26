/* 一盏 · 中国茶事 — interactions */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const catById = id => CATEGORIES.find(c => c.id === id);
  const teaById = id => TEAS.find(t => t.id === id);
  const pad2 = n => String(n).padStart(2, '0');
  /* CSS 的 prefers-reduced-motion 只作用于 scroll-behavior；
     scrollIntoView / scrollTo 显式传入的 behavior:'smooth' 会覆盖它，故在此统一判定 */
  const SCROLL_BEHAVIOR = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'auto' : 'smooth';

  const NUMERALS = ['壹', '贰', '叁', '肆', '伍', '陆', '柒'];

  /* static capture mode: ?static=1 reveals all sections for layout review */
  if (new URLSearchParams(location.search).has('static')) {
    document.documentElement.classList.add('static-mode');
    const y = Number(new URLSearchParams(location.search).get('y') || 0);
    if (y) window.addEventListener('load', () => window.scrollTo(0, y));
  }

  /* =========================================================
     Header / scroll
     ========================================================= */
  const head = $('#siteHead');
  const bar = $('#scrollBar');
  let ticking = false;

  /* =========================================================
     2026-11-14 巡检补充：动态状态与输入语义（纯增量，不改既有渲染逻辑）
     ========================================================= */

  /* (1) 站内 #teaSort 的 .sort-chip 已正确维护 aria-pressed，但下列 5 组
         「筛选 / 切换」按钮只有 .active 视觉类，屏幕阅读器读不出当前选中项（WCAG 4.1.2）。
         stepTabs / timelineNav / 发酵光谱三处由 11-12 补丁用 aria-selected 处理，不在此列。
         用事件委托统一同步，避免逐个改动渲染函数、与待合并 PR 产生行冲突。 */
  const PRESSED_GROUPS = [
    ['#filterRow', '.filter-chip'],
    ['#cheatFilter', '.filter-chip'],
    ['#glossFilter', '.filter-chip'],
    ['#vesselSeg', 'button'],
    ['#latBars', '.lat-bar']
  ];
  function syncPressed(root, sel) {
    $$(sel, root).forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('active'))));
  }
  function syncAllPressed() {
    PRESSED_GROUPS.forEach(g => { const r = $(g[0]); if (r) syncPressed(r, g[1]); });
  }
  // 脚本位于 body 末尾；DOMContentLoaded 时动态创建的筛选按钮已全部就位
  document.addEventListener('DOMContentLoaded', syncAllPressed);
  // 捕获阶段挂委托，setTimeout 保证本轮事件里所有 .active 切换完成后再同步
  document.addEventListener('click', e => {
    if (!e.target || !e.target.closest) return;
    for (const g of PRESSED_GROUPS) {
      if (e.target.closest(g[0])) {
        const r = $(g[0]);
        if (r) setTimeout(() => syncPressed(r, g[1]), 0);
        break;
      }
    }
  }, true);

  /* (2) 3 个中文搜索框此前 0 个 autocomplete / spellcheck / enterkeyhint：
         浏览器会给中文词条画拼写红线、弹出历史自动填充遮挡结果、软键盘回车键显示「前往」。 */
  $$('input[type="search"]').forEach(el => {
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('enterkeyhint', 'search');
  });

  function onScroll() {
    const y = window.scrollY;
    head.classList.toggle('scrolled', y > 40);
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? Math.min(100, (y / h) * 100) : 0) + '%';
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  const navToggle = $('#navToggle');
  const siteNav = $('.site-nav');
  navToggle.addEventListener('click', () => {
    const open = siteNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open);
  });
  $$('.site-nav a').forEach(a => a.addEventListener('click', () => {
    siteNav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');
  }));

  /* =========================================================
     Reveal on scroll
     ========================================================= */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  /* active nav */
  const navLinks = $$('[data-nav]');
  const sections = navLinks.map(a => $(a.getAttribute('href'))).filter(Boolean);
  const navIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(a => {
          const active = a.getAttribute('href') === '#' + e.target.id;
          a.classList.toggle('active', active);
          /* 原来只有视觉高亮，屏幕阅读器读不出「当前所在版块」 */
          if (active) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        });
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => navIO.observe(s));

  /* =========================================================
     Oracle
     ========================================================= */
  const oracleCard = $('#oracleCard');
  const oracleBtn = $('#oracleBtn');
  let oracleTea = null;

  function drawOracle() {
    oracleTea = TEAS[Math.floor(Math.random() * TEAS.length)];
    const cat = catById(oracleTea.cat);
    $('#oracleCat').textContent = cat.name + ' · ' + cat.nature;
    $('#oracleName').textContent = oracleTea.name;
    $('#oracleText').textContent = oracleTea.aroma.split('，')[0] + '；' + oracleTea.taste.split('，')[0] + '。';
    oracleCard.hidden = false;
  }
  oracleBtn.addEventListener('click', () => {
    drawOracle();
    oracleCard.scrollIntoView({ block: 'nearest', behavior: SCROLL_BEHAVIOR });
  });
  $('#oracleAgain').addEventListener('click', drawOracle);
  $('#oracleClose').addEventListener('click', () => { oracleCard.hidden = true; });
  $('#oracleOpen').addEventListener('click', () => { if (oracleTea) openTea(oracleTea.id); });

  /* =========================================================
     Radar chart
     ========================================================= */
  const AXES = ['鲜爽', '花香', '甜醇', '焙火', '陈韵', '醇厚'];
  function radarSVG(values, color) {
    const cx = 130, cy = 108, R = 76;
    const pt = (i, v) => {
      const a = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
      return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v];
    };
    const ring = (v) => AXES.map((_, i) => pt(i, v).map(n => n.toFixed(1)).join(',')).join(' ');
    let s = '<g>';
    [0.25, 0.5, 0.75, 1].forEach(v => {
      s += `<polygon points="${ring(v)}" fill="none" stroke="rgba(34,38,31,.12)" stroke-width="1"/>`;
    });
    AXES.forEach((_, i) => {
      const [x, y] = pt(i, 1);
      s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(34,38,31,.1)"/>`;
    });
    const poly = values.map((v, i) => pt(i, v / 100).map(n => n.toFixed(1)).join(',')).join(' ');
    s += `<polygon points="${poly}" fill="${color}" fill-opacity=".16" stroke="${color}" stroke-width="1.6"/>`;
    values.forEach((v, i) => {
      const [x, y] = pt(i, v / 100);
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${color}"/>`;
    });
    AXES.forEach((label, i) => {
      const [x, y] = pt(i, 1.24);
      const anchor = x < cx - 6 ? 'end' : x > cx + 6 ? 'start' : 'middle';
      /* 2026-11-15 巡检补充：10px 轴标签 + #777b6d 对米色底仅 3.85:1（未达 WCAG AA 4.5:1），
         且颜色写死在 SVG 内联属性里，PR #1 修改 --site-muted 变量并不影响此处。
         提到 11.5px，并换成实测达标的 #696d5f（对 paper 4.72:1 / surface 5.01:1）。 */
      s += `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${anchor}" font-size="11.5" fill="#696d5f" font-family="PingFang SC, Microsoft YaHei, sans-serif" letter-spacing=".08em">${label}</text>`;
    });
    s += '</g>';
    return s;
  }

  /* =========================================================
     2026-11-15 巡检补充：滚动区键盘可达性与导航控件语义（纯增量）
     ========================================================= */

  /* (1) .cheat-table-wrap 是 overflow-x:auto 容器（表格 min-width:720px），
         原先没有 tabindex / role / aria-label：窄屏下键盘用户无法聚焦后用方向键
         横向滚动，被裁掉的后 5 列参数完全看不到（WCAG 2.1.1）。
         同时「← 左右滑动查看完整参数 →」提示带 aria-hidden="true"，
         读屏用户收不到任何可滚动提示。这里补属性，不改 index.html 以避免
         与待合并 PR #1 / 11-12 补丁在 289-302 行的 hunk 冲突。 */
  const cheatWrap = $('.cheat-table-wrap');
  if (cheatWrap) {
    cheatWrap.setAttribute('tabindex', '0');
    cheatWrap.setAttribute('role', 'region');
    cheatWrap.setAttribute('aria-label', '冲泡速查表，可用左右方向键滚动查看全部参数');
  }
  const swipeHint = $('.cheat-swipe-hint');
  if (swipeHint) swipeHint.removeAttribute('aria-hidden');

  /* (2) 移动端导航按钮有 aria-expanded 但缺 aria-controls，读屏无法把
         「展开导航」按钮与被控制的菜单关联起来（WCAG 1.3.1）。 */
  const navToggleBtn = $('#navToggle');
  const navEl = $('.site-nav');
  if (navToggleBtn && navEl) {
    if (!navEl.id) navEl.id = 'siteNav';
    navToggleBtn.setAttribute('aria-controls', navEl.id);
  }

  /* =========================================================
     Seven families
     ========================================================= */
  const range = $('#fermentRange');
  const dots = $('#spectrumDots');
  let activeCat = 0;

  CATEGORIES.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'catPanel');
    b.setAttribute('aria-selected', 'false');
    b.tabIndex = -1;
    b.dataset.index = i;
    b.innerHTML = `<b>${c.name}</b><span>${c.fermentLabel}</span>`;
    b.addEventListener('click', () => selectCat(i));
    dots.appendChild(b);
  });

  const catImage = $('#catImage');

  function selectCat(i) {
    const c = CATEGORIES[i];
    activeCat = i;
    range.value = i;
    range.setAttribute('aria-valuetext', c.name + '，' +
      (c.id === 'flower' ? '鲜花窨制' : c.fermentLabel + '，发酵程度 ' + c.ferment + '%'));
    $('#fermentPct').textContent = c.id === 'flower' ? '窨制' : c.ferment + '%';
    $$('button', dots).forEach((b, k) => {
      b.classList.toggle('active', k === i);
      b.setAttribute('aria-selected', String(k === i));
      b.tabIndex = k === i ? 0 : -1;
    });

    $('#catIndex').textContent = pad2(i + 1);
    $('#catName').textContent = c.name;
    $('#catNature').textContent = c.nature;
    $('#catEn').textContent = c.en;
    $('#catDesc').textContent = c.desc;
    $('#catFerment').textContent = c.fermentLabel + ' · ' + (c.id === 'flower' ? '鲜花窨制' : c.ferment + '%');
    $('#catCraft').textContent = c.craft;
    $('#catTime').textContent = c.bestTime;
    $('#catFlavor').textContent = c.flavor;
    $('#catSuitable').textContent = c.suitable;
    $('#catAvoid').textContent = c.avoid;
    $('#catMore').textContent = '另有：' + c.more;
    $('#catStamp').textContent = NUMERALS[i];
    $('#catCaption').textContent = c.teas[0] + ' · 干茶与茶汤';

    $('#catRadar').innerHTML = radarSVG(c.radar, c.color);

    const chips = $('#catTeas');
    chips.innerHTML = '';
    c.teas.forEach(name => {
      const t = TEAS.find(x => x.name === name);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = name + (t ? ' ↗' : '');
      if (t) b.addEventListener('click', () => openTea(t.id));
      else b.disabled = true;
      chips.appendChild(b);
    });

    if (catImage.getAttribute('src') !== c.image) {
      catImage.classList.add('swap');
      setTimeout(() => {
        catImage.src = c.image;
        catImage.alt = c.teas[0] + '茶叶意境示意图';
        catImage.onload = () => catImage.classList.remove('swap');
        setTimeout(() => catImage.classList.remove('swap'), 500);
      }, 160);
    }
  }
  range.addEventListener('input', e => selectCat(Number(e.target.value)));
  $('#catPanel').setAttribute('role', 'tabpanel');
  dots.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (activeCat + (e.key === 'ArrowRight' ? 1 : -1) + CATEGORIES.length) % CATEGORIES.length;
    selectCat(next);
    $$('button', dots)[next].focus();
  });
  selectCat(0);

  /* =========================================================
     Tea collection
     ========================================================= */
  const grid = $('#teaGrid');
  const filterRow = $('#filterRow');
  const search = $('#teaSearch');
  let filterCat = 'all';
  let query = '';
  let teaSort = 'default';

  const filters = [{ id: 'all', name: '全部' }].concat(CATEGORIES.map(c => ({ id: c.id, name: c.name })));
  filters.forEach(f => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'filter-chip' + (f.id === 'all' ? ' active' : '');
    b.dataset.filter = f.id;
    b.textContent = f.name;
    b.addEventListener('click', () => {
      filterCat = f.id;
      $$('.filter-chip', filterRow).forEach(x => x.classList.toggle('active', x === b));
      renderTeas();
    });
    filterRow.appendChild(b);
  });

  function renderTeas() {
    const list = TEAS.filter(t => {
      const catOk = filterCat === 'all' || t.cat === filterCat;
      const q = query.trim().toLowerCase();
      const textOk = !q || [t.name, t.region, t.aroma, t.taste, t.en, catById(t.cat).name].join(' ').toLowerCase().includes(q);
      return catOk && textOk;
    });
    /* 按云端评分 / 评论数排序：无数据的条目始终排在后面 */
    if (teaSort === 'rating' || teaSort === 'comments') {
      const stat = t => window.JZSCommunity
        ? window.JZSCommunity.getStats(t.id)
        : { avg: 0, count: 0, comments: 0 };
      list.sort((a, b) => {
        const sa = stat(a), sb = stat(b);
        if (teaSort === 'rating') {
          if ((sa.count > 0) !== (sb.count > 0)) return sa.count > 0 ? -1 : 1;
          if (sb.avg !== sa.avg) return sb.avg - sa.avg;
          if (sb.count !== sa.count) return sb.count - sa.count;
        } else {
          if ((sa.comments > 0) !== (sb.comments > 0)) return sa.comments > 0 ? -1 : 1;
          if (sb.comments !== sa.comments) return sb.comments - sa.comments;
          if (sb.avg !== sa.avg) return sb.avg - sa.avg;
        }
        return TEAS.indexOf(a) - TEAS.indexOf(b);
      });
    }
    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = '<p class="tea-empty">没有找到这款茶，换个关键词试试。</p>';
    } else {
      list.forEach((t, i) => {
        const cat = catById(t.cat);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'tea-card';
        card.style.setProperty('--cat-color', cat.color);
        card.style.animationDelay = (i * 45) + 'ms';
        card.setAttribute('aria-label', t.name + '，查看详情');
        card.innerHTML = `
          <div class="tea-card-media">
            <img src="${t.image}" alt="${t.name}茶叶意境示意图" width="860" height="1075" loading="lazy" decoding="async">
            <span class="tea-card-cat">${cat.name}</span>
            <span class="tea-card-index">${pad2(TEAS.indexOf(t) + 1)}</span>
          </div>
          <div class="tea-card-body">
            <h3>${t.name}</h3>
            <p class="tea-card-en">${t.en}</p>
            <div class="tea-card-meta"><span>${t.region}</span><span>${t.aroma.split('，')[0]}</span></div>
            <div class="tea-card-brew"><span>${t.temp[0]}–${t.temp[1]}°C</span><span>${t.ratio}</span><span>${t.steeps} 泡</span></div>
            <div class="rcard-rate" data-rate="${t.id}"></div>
            <div class="tea-card-cta"><span>产地 · 风味 · 辨伪 · 冲泡</span><i>→</i></div>
          </div>`;
        card.addEventListener('click', () => openTea(t.id));
        grid.appendChild(card);
      });
    }
    if (window.JZSCommunity) window.JZSCommunity.decorateCards(grid);
    const count = $('#resultCount');
    count.textContent = list.length;
    $('#resultHint').textContent = query || filterCat !== 'all' ? '· 当前筛选结果' : '· 点击卡片查看详解';
  }
  search.addEventListener('input', e => { query = e.target.value; renderTeas(); });

  const teaSortBar = $('#teaSort');
  if (teaSortBar) teaSortBar.addEventListener('click', e => {
    const b = e.target.closest('[data-sort]');
    if (!b) return;
    teaSort = b.dataset.sort;
    $$('[data-sort]', teaSortBar).forEach(x => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    renderTeas();
  });

  /* 云端统计就绪后刷新卡片；若正按评分/评论排序则重排 */
  window.addEventListener('jzs-stats', () => {
    if (!window.JZSCommunity) return;
    if (teaSort === 'rating' || teaSort === 'comments') renderTeas();
    else window.JZSCommunity.decorateCards(grid);
  });

  renderTeas();

  /* =========================================================
     Modal
     ========================================================= */
  const modal = $('#teaModal');
  let lastFocus = null;
  /* 2026-11-15 巡检补充：aria-modal="true" 只声明语义，背景内容仍在读屏虚拟光标
     与鼠标点击范围内。打开时对主内容/页头/页脚加 inert + aria-hidden，
     关闭时先移除再归还焦点，避免焦点落在 inert 元素上而丢失。 */
  const BG_REGIONS = [$('#top'), $('.site-head'), $('.site-foot')];

  function openTea(id) {
    const t = teaById(id);
    if (!t) return;
    const cat = catById(t.cat);
    lastFocus = document.activeElement;

    $('#modalImg').src = t.image;
    $('#modalImg').alt = t.name + '茶叶意境示意图';
    $('#modalCat').textContent = cat.name + ' · ' + cat.nature;
    $('#modalEn').textContent = t.en;
    $('#modalTitle').textContent = t.name;
    $('#modalRegion').textContent = t.region + '｜' + t.subRegion;
    $('#modalTags').innerHTML = t.tags.map(x => `<span>${x}</span>`).join('');
    $('#modalShape').textContent = t.shape;
    $('#modalAroma').textContent = t.aroma;
    $('#modalLiquor').textContent = t.liquor;
    $('#modalTaste').textContent = t.taste;
    $('#modalTemp').textContent = t.temp[0] + '–' + t.temp[1] + '°C';
    $('#modalRatio').textContent = t.ratio;
    $('#modalTime').textContent = t.time;
    $('#modalVessel').textContent = t.vessel;
    $('#modalIdentify').textContent = t.identify;
    $('#modalSteeps').innerHTML = (t.steepNote || []).map((s, i) => `<li><span>第 ${i + 1} 泡</span>${s}</li>`).join('');
    $('#modalBrewTip').textContent = t.brewTip || '';
    $('#modalConfuse').textContent = t.confuse || '';
    $('#modalStory').textContent = t.story;
    $('#modalHarvest').textContent = '采摘：' + t.harvest;

    modal.hidden = false;
    document.body.classList.add('no-scroll');
    BG_REGIONS.forEach(el => {
      if (!el) return;
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    });
    if (window.JZSCommunity) window.JZSCommunity.renderDialog(id, $('[data-community]'));
    requestAnimationFrame(() => $('.modal-close').focus());
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    BG_REGIONS.forEach(el => {
      if (!el) return;
      el.removeAttribute('inert');
      el.removeAttribute('aria-hidden');
    });
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $$('[data-close]', modal).forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
    if (e.key === 'Tab' && !modal.hidden) {
      /* 补上 textarea / contenteditable / summary：社区模块在弹窗内动态注入
         评论 <textarea>，原选择器漏掉它，Tab 到评论框后会跳出弹窗边界。 */
      const focusables = $$('button, [href], input, select, textarea, [contenteditable="true"], summary, [tabindex]:not([tabindex="-1"])', modal).filter(el => !el.disabled && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  $('#modalBrewBtn').addEventListener('click', () => {
    const t = teaById(TEAS.find(x => x.name === $('#modalTitle').textContent)?.id);
    if (t) setBrewTea(t.id, true);
    closeModal();
    $('#brew').scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'start' });
  });

  /* =========================================================
     Brewing lab
     ========================================================= */
  const brewSelect = $('#brewTea');
  TEAS.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.name + ' · ' + catById(t.cat).name;
    brewSelect.appendChild(o);
  });

  const VESSEL_ML = { '玻璃杯': 150, '盖碗': 120, '紫砂壶': 110 };
  const HINTS = {
    green: '水烧开后先晾一晾，80–85°C 最护鲜。玻璃杯可留三分之一水再续，避免久闷。',
    white: '白毫银针可直接冲泡，不必洗茶。水温不必太高，让毫香慢慢释放。',
    yellow: '黄茶娇嫩，水温与时间都要克制。闷久了甜味会转苦，黄汤也会发暗。',
    oolong: '工夫泡讲究快进快出。第一泡 10 秒左右即可出汤，之后每泡递增 5 秒。',
    black: '红茶可坐杯，让甜味充分溶出。祁红加奶也别有一番风味，但先尝尝清饮。',
    dark: '熟普先快速润洗一次，再正式冲泡。水温要足，出汤要快，汤色透亮为佳。',
    flower: '花茶忌滚水直冲，85–90°C 最能保住鲜灵花香。香气入水，比干花更重要。'
  };

  /* =========================================================
     2026-11-19 巡检补充：可访问名称与搜索地标（纯增量，不改既有渲染逻辑）
     ========================================================= */

  /* (A) 品牌链接 aria-label="回到首页" 完全不含可见文字「一盏中国茶事」，
         语音控制用户念品牌名无法命中控件，读屏也丢失站点名称
         （WCAG 2.5.3 Label in Name）。11-18 补丁已对齐 3 个搜索框的
         aria-label 与 placeholder，但未覆盖首链接；印章「茶」为装饰图形。 */
  const brandLink = $('.brand');
  if (brandLink) {
    const seal = $('.brand-seal', brandLink);
    if (seal && !seal.hasAttribute('aria-hidden')) seal.setAttribute('aria-hidden', 'true');
    if (brandLink.getAttribute('aria-label') === '回到首页') {
      brandLink.setAttribute('aria-label', '一盏中国茶事，回到首页');
    }
  }

  /* (B) 三个搜索区（名茶 / 速查表 / 词典）全站 role="search" 与 <form> 均为 0 处，
         读屏用户无法用「地标导航」直接跳到搜索框，只能逐元素 Tab。
         <label class="search-box"> 仅包裹 aria-hidden 的图标与输入框，
         输入框已有自身 aria-label，故给 label 补 search 地标不会丢失可访问名称。 */
  const SEARCH_LANDMARKS = [
    ['#teaSearch', '搜索名茶'],
    ['#cheatSearch', '搜索冲泡速查表'],
    ['#glossSearch', '搜索茶学术语']
  ];
  SEARCH_LANDMARKS.forEach(pair => {
    const input = $(pair[0]);
    const box = input && input.closest('.search-box');
    if (box && !box.hasAttribute('role')) {
      box.setAttribute('role', 'search');
      box.setAttribute('aria-label', pair[1]);
    }
  });

  const brew = {
    tea: 'longjing',
    vessel: '玻璃杯',
    temp: 85,
    grams: 3,
    ml: 150,
    steepIndex: 0,
    records: [],
    total: 60,
    remaining: 60,
    running: false,
    finished: false,
    timer: null
  };

  function parseRatio(t) {
    const m = t.ratio.match(/([\d.]+)\s*g\s*\/\s*(\d+)\s*ml/);
    if (m) return { grams: parseFloat(m[1]), ml: parseInt(m[2], 10) };
    return { grams: 3, ml: 150 };
  }
  function parseFirstSeconds(t) {
    const m = t.time.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 60;
  }
  function steepSchedule(t) {
    const base = parseFirstSeconds(t);
    const n = t.steeps;
    return Array.from({ length: n }, (_, i) => Math.round(base * (1 + i * 0.38)));
  }
  function fmt(sec) {
    const m = Math.floor(sec / 60), s = Math.max(0, Math.round(sec % 60));
    return pad2(m) + ':' + pad2(s);
  }

  const tempRange = $('#tempRange');
  const gramsOut = $('#gramsOut');
  const mlOut = $('#mlOut');
  const ratioOut = $('#ratioOut');
  const ratioTag = $('#ratioTag');
  const recBand = $('#recBand');
  const brewAdvice = $('#brewAdvice');
  const timerTime = $('#timerTime');
  const timerSub = $('#timerSub');
  const timerState = $('#timerState');
  const timerBtn = $('#timerBtn');
  const nextBtn = $('#nextBtn');
  const timerHint = $('#timerHint');
  const steepLabel = $('#steepLabel');
  const steepTrack = $('#steepTrack');
  const ring = $('#ringProgress');
  const C = 2 * Math.PI * 96;

  ring.style.strokeDasharray = C;

  function currentTea() { return teaById(brew.tea); }
  function schedule() { return steepSchedule(currentTea()); }

  function updateBrewUI() {
    const t = currentTea();
    $('#stageTea').textContent = t.name;
    $('#brewTeaHint').textContent = t.region + ' · ' + t.aroma.split('，')[0];
    tempRange.value = brew.temp;
    tempRange.setAttribute('aria-valuetext', brew.temp + ' 摄氏度');
    $('#tempOut').textContent = brew.temp + '°C';
    gramsOut.textContent = brew.grams + 'g';
    mlOut.textContent = brew.ml + 'ml';

    const r = Math.round(brew.ml / brew.grams);
    ratioOut.textContent = '1 : ' + r;
    ratioTag.textContent = r >= 100 ? '淡饮' : r >= 60 ? '清饮' : r >= 35 ? '适中' : '浓泡';

    recBand.textContent = '建议 ' + t.temp[0] + '–' + t.temp[1] + '°C';
    const status = brew.temp < t.temp[0] ? '偏低' : brew.temp > t.temp[1] ? '偏高' : '适宜';
    recBand.style.color = status === '适宜' ? 'var(--green)' : 'var(--cinnabar)';
    recBand.style.borderBottomColor = status === '适宜' ? 'rgba(46,74,55,.5)' : 'rgba(163,64,44,.5)';

    const sch = schedule();
    const idx = Math.min(brew.steepIndex, sch.length - 1);
    brewAdvice.textContent = brew.temp + '°C · 第 ' + (idx + 1) + ' 泡约 ' + sch[idx] + ' 秒 · 共 ' + sch.length + ' 泡';

    steepLabel.textContent = '第 ' + Math.min(brew.steepIndex + 1, sch.length) + ' 泡';
    timerSub.textContent = '第 ' + Math.min(brew.steepIndex + 1, sch.length) + ' 泡 · ' + sch[idx] + ' 秒';

    if (!brew.running && !brew.finished) {
      brew.total = sch[idx];
      brew.remaining = sch[idx];
      timerTime.textContent = fmt(sch[idx]);
      timerState.textContent = '准备';
      setRing(1);
    }

    timerHint.textContent = HINTS[t.cat] || '';
    nextBtn.disabled = !brew.finished || brew.steepIndex >= sch.length - 1;
    timerBtn.disabled = brew.steepIndex >= sch.length && brew.finished;
    if (brew.steepIndex >= sch.length) {
      timerState.textContent = '完成';
      timerTime.textContent = '—';
    }
  }

  function setRing(progress) {
    ring.style.strokeDashoffset = (C * (1 - progress)).toFixed(2);
  }

  function renderRecords() {
    steepTrack.innerHTML = '';
    if (!brew.records.length) {
      steepTrack.innerHTML = '<li class="empty">还没有出汤记录</li>';
      return;
    }
    brew.records.forEach((sec, i) => {
      const li = document.createElement('li');
      li.textContent = '第 ' + (i + 1) + ' 泡 · ' + sec + ' 秒';
      steepTrack.appendChild(li);
    });
  }

  /* 2026-11-15 巡检补充：计时器改为墙钟计时。
     原实现每秒 remaining -= 1，浏览器在后台标签页 / 锁屏时会把 setInterval
     节流到 ≥1s 甚至 1 分钟，60 秒的闷泡会被拉长到数分钟，切回前台也不补偿。
     这是「冲泡实验室」核心功能在真实使用场景（泡茶时切去看别的内容）的失准。 */
  let timerDeadline = 0;

  function resetTimer(keepIndex) {
    clearInterval(brew.timer);
    brew.running = false;
    brew.finished = false;
    timerDeadline = 0;
    if (!keepIndex) { brew.steepIndex = 0; brew.records = []; renderRecords(); }
    const sch = schedule();
    const idx = Math.min(brew.steepIndex, sch.length - 1);
    brew.total = sch[idx];
    brew.remaining = sch[idx];
    timerTime.textContent = fmt(brew.remaining);
    timerState.textContent = '准备';
    timerBtn.textContent = '开始计时';
    timerBtn.disabled = false;
    nextBtn.disabled = true;
    setRing(1);
    updateBrewUI();
  }

  function tick() {
    if (timerDeadline) {
      brew.remaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
    } else {
      brew.remaining -= 1;
    }
    if (brew.remaining <= 0) {
      brew.remaining = 0;
      clearInterval(brew.timer);
      timerDeadline = 0;
      brew.running = false;
      brew.finished = true;
      timerTime.textContent = '00:00';
      timerState.textContent = '出汤';
      timerBtn.textContent = '已出汤';
      timerBtn.disabled = true;
      setRing(0);
      brew.records.push(brew.total);
      renderRecords();
      const sch = schedule();
      nextBtn.disabled = brew.steepIndex >= sch.length - 1;
      if (brew.steepIndex >= sch.length - 1) {
        timerHint.textContent = '这一款茶已泡到最后一泡。可以延长坐杯时间，或换一泡新茶。';
        steepLabel.textContent = '已泡 ' + sch.length + ' 泡';
      }
      return;
    }
    timerTime.textContent = fmt(brew.remaining);
    setRing(brew.remaining / brew.total);
  }

  timerBtn.addEventListener('click', () => {
    if (brew.finished) return;
    if (brew.running) {
      clearInterval(brew.timer);
      brew.running = false;
      if (timerDeadline) {
        brew.remaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
        timerDeadline = 0;
        timerTime.textContent = fmt(brew.remaining);
      }
      timerBtn.textContent = '继续';
      timerState.textContent = '暂停';
      return;
    }
    brew.running = true;
    timerDeadline = Date.now() + brew.remaining * 1000;
    timerBtn.textContent = '暂停';
    timerState.textContent = '闷泡中';
    brew.timer = setInterval(tick, 250);
  });

  /* 回到前台立即按真实经过时间校正一次，不必等下一个 interval */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && brew.running && timerDeadline) tick();
  });

  nextBtn.addEventListener('click', () => {
    const sch = schedule();
    if (brew.steepIndex >= sch.length - 1) return;
    brew.steepIndex += 1;
    resetTimer(true);
    timerState.textContent = '准备';
  });

  $('#resetBtn').addEventListener('click', () => resetTimer(false));

  $$('#vesselSeg button').forEach(b => b.addEventListener('click', () => {
    $$('#vesselSeg button').forEach(x => x.classList.toggle('active', x === b));
    brew.vessel = b.dataset.vessel;
    brew.ml = VESSEL_ML[brew.vessel];
    updateBrewUI();
  }));

  tempRange.addEventListener('input', e => {
    brew.temp = Number(e.target.value);
    updateBrewUI();
  });

  $$('[data-step]').forEach(b => b.addEventListener('click', () => {
    const [key, delta] = b.dataset.step.split(/(?=[+-])/);
    const v = parseFloat(delta);
    if (key === 'grams') brew.grams = Math.min(12, Math.max(2, Math.round((brew.grams + v) * 2) / 2));
    if (key === 'ml') brew.ml = Math.min(400, Math.max(60, brew.ml + v));
    updateBrewUI();
  }));

  function setBrewTea(id, scroll) {
    brew.tea = id;
    brewSelect.value = id;
    const t = currentTea();
    const pr = parseRatio(t);
    brew.grams = pr.grams;
    brew.ml = pr.ml;
    brew.temp = Math.round((t.temp[0] + t.temp[1]) / 2);
    brew.vessel = t.vessel.includes('盖碗') ? '盖碗' : t.vessel.includes('紫砂') ? '紫砂壶' : '玻璃杯';
    $$('#vesselSeg button').forEach(x => x.classList.toggle('active', x.dataset.vessel === brew.vessel));
    resetTimer(false);
    if (scroll) $('#brew').scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'start' });
  }

  brewSelect.addEventListener('change', e => setBrewTea(e.target.value));
  setBrewTea('longjing');

  /* =========================================================
     Identify steps
     ========================================================= */
  const stepTabs = $('#stepTabs');
  const stepPanel = $('#stepPanel');
  let stepIndex = 0;

  function selectStep(i) {
    stepIndex = i;
    const s = FIVE_STEPS[i];
    $$('button', stepTabs).forEach((b, k) => {
      b.classList.toggle('active', k === i);
      b.setAttribute('aria-selected', String(k === i));
      b.tabIndex = k === i ? 0 : -1;
    });
    $('#stepNum').textContent = pad2(i + 1);
    $('#stepTitle').textContent = s.title;
    $('#stepIntro').textContent = s.intro;
    $('#stepChecks').innerHTML = s.checks.map(c => `<li>${c}</li>`).join('');
    $('#stepPitfall').textContent = s.pitfall;
    stepPanel.style.animation = 'none';
    void stepPanel.offsetWidth;
    stepPanel.style.animation = 'fadeSlide .35s ease';
  }
  FIVE_STEPS.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'stepPanel');
    b.setAttribute('aria-selected', 'false');
    b.tabIndex = -1;
    b.innerHTML = `<span>${pad2(i + 1)}</span>${s.label}`;
    b.addEventListener('click', () => selectStep(i));
    stepTabs.appendChild(b);
  });
  stepPanel.setAttribute('role', 'tabpanel');
  stepTabs.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (stepIndex + (e.key === 'ArrowRight' ? 1 : -1) + FIVE_STEPS.length) % FIVE_STEPS.length;
    selectStep(next);
    $$('button', stepTabs)[next].focus();
  });
  selectStep(0);

  /* comparisons */
  const compareGrid = $('#compareGrid');
  COMPARISONS.forEach(c => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'flip-card';
    card.setAttribute('aria-label', c.title + '，点击查看区别');
    card.innerHTML = `
      <div class="flip-face flip-front">
        <span class="flip-kicker">辨伪对照</span>
        <div>
          <h4>${c.title}</h4>
          <p class="flip-q">${c.front}</p>
        </div>
        <span class="flip-cta">点击翻面 →</span>
      </div>
      <div class="flip-face flip-back">
        <span class="flip-kicker">关键区别</span>
        <ul>${c.points.map(p => `<li>${p}</li>`).join('')}</ul>
        <span class="flip-cta">← 点击返回</span>
      </div>`;
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
      card.setAttribute('aria-pressed', String(card.classList.contains('flipped')));
    });
    compareGrid.appendChild(card);
  });

  /* =========================================================
     Quiz
     ========================================================= */
  const quizStep = $('#quizStep');
  const quizResult = $('#quizResult');
  let quizIndex = 0;
  const scores = {};

  function startQuiz() {
    quizIndex = 0;
    Object.keys(scores).forEach(k => delete scores[k]);
    quizStep.hidden = false;
    quizResult.hidden = true;
    renderQuiz();
  }
  function renderQuiz() {
    const q = QUIZ[quizIndex];
    $('#quizCount').textContent = '第 ' + (quizIndex + 1) + ' / ' + QUIZ.length + ' 题';
    $('#quizQuestion').textContent = q.q;
    $('#quizBar').style.width = ((quizIndex) / QUIZ.length * 100 + 12.5) + '%';
    const box = $('#quizOptions');
    box.innerHTML = '';
    q.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quiz-option';
      b.innerHTML = `<span>${String.fromCharCode(65 + i)}</span>${o.label}`;
      b.addEventListener('click', () => {
        Object.entries(o.cats).forEach(([k, v]) => { scores[k] = (scores[k] || 0) + v; });
        quizIndex += 1;
        if (quizIndex < QUIZ.length) renderQuiz();
        else showResult();
      });
      box.appendChild(b);
    });
  }
  function showResult() {
    const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    const cat = catById(top);
    quizStep.hidden = true;
    quizResult.hidden = false;
    $('#quizBar').style.width = '100%';
    $('#quizResultName').textContent = cat.name;
    $('#quizResultDesc').textContent = cat.desc + ' 建议从 ' + cat.teas[0] + ' 开始，水温 ' + cat.brew.temp[0] + '–' + cat.brew.temp[1] + '°C。';
    const teas = TEAS.filter(t => t.cat === top).slice(0, 3);
    $('#quizResultTeas').innerHTML = '';
    teas.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = t.name + ' ↗';
      b.addEventListener('click', () => openTea(t.id));
      $('#quizResultTeas').appendChild(b);
    });
    $('#quizBrew').onclick = () => {
      setBrewTea(teas[0].id, true);
    };
  }
  $('#quizRestart').addEventListener('click', startQuiz);
  startQuiz();

  /* =========================================================
     Origin
     ========================================================= */
  const latBars = $('#latBars');
  const LAT_MIN = 18, LAT_MAX = 38;

  REGIONS.forEach((r, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lat-bar';
    b.dataset.region = r.id;
    const left = (r.range[0] - LAT_MIN) / (LAT_MAX - LAT_MIN) * 100;
    const width = (r.range[1] - r.range[0]) / (LAT_MAX - LAT_MIN) * 100;
    b.style.left = left + '%';
    b.style.width = width + '%';
    b.style.top = (i * 58) + 'px';
    b.innerHTML = `<b>${r.name}</b><em>${r.lat}</em>`;
    b.setAttribute('aria-label', r.name + '，' + r.lat);
    b.addEventListener('click', () => selectRegion(r.id));
    latBars.appendChild(b);
  });

  function selectRegion(id) {
    const r = REGIONS.find(x => x.id === id);
    $$('.lat-bar', latBars).forEach(b => b.classList.toggle('active', b.dataset.region === id));
    $('#regionLat').textContent = '北纬 ' + r.lat + ' · 中国茶区';
    $('#regionName').textContent = r.name;
    $('#regionProvinces').textContent = r.provinces;
    $('#regionChar').textContent = r.character;
    $('#regionTeas').innerHTML = r.teas.map(t => `<span>${t}</span>`).join('');
    $('#regionNote').textContent = r.note;
  }
  selectRegion('jiangnan');

  /* axis labels */
  const axis = $('.lat-axis');
  axis.innerHTML = '';
  [18, 24, 30, 36, 38].forEach(v => {
    const s = document.createElement('span');
    s.textContent = v + '°';
    s.style.left = ((v - LAT_MIN) / (LAT_MAX - LAT_MIN) * 100) + '%';
    axis.appendChild(s);
  });

  /* =========================================================
     Culture timeline
     ========================================================= */
  const ERAS = [
    {
      era: '神', nav: '传说', years: '上古 · 传说时代', title: '神农尝百草，得荼而解之',
      text: '茶最初并不作为饮料，而是药。传说神农尝百草，日遇七十二毒，得荼而解之。先秦文献里的「荼」，正是茶的前身。它苦后回甘、令人清醒，被当作解毒、提神的草木。',
      notes: ['药用起源', '「荼」即茶', '巴蜀贡茶'],
      image: null
    },
    {
      era: '汉', nav: '汉魏', years: '西汉 · 公元前 59 年', title: '烹茶尽具，茶入日常',
      text: '王褒《僮约》里写下「烹茶尽具」「武阳买茶」，说明西汉时巴蜀一带已有专门的茶具与茶叶市场。茶从山野药材，逐渐变成待客与日常生活的饮品。',
      notes: ['《僮约》', '武阳买茶', '茶从巴蜀出'],
      image: null
    },
    {
      era: '唐', nav: '煎茶', years: '唐 · 780 年前后', title: '陆羽《茶经》与煎茶法',
      text: '陆羽著《茶经》，第一次把种茶、采茶、制茶、煮茶、品茶写成完整体系。唐人煎茶：茶饼碾末、罗细，水沸后加盐、投茶、育华，再分入茶碗。茶自此成为独立的精神饮品，「禅茶一味」也在此时生根。',
      notes: ['《茶经》', '碾末煎煮', '茶圣陆羽'],
      image: null
    },
    {
      era: '宋', nav: '点茶', years: '宋 · 960–1279', title: '点茶、斗茶与茶百戏',
      text: '宋人把茶末放入茶盏，注沸水，以茶筅快速击拂，直至汤花泛起、咬住盏壁。比试汤花与茶色，是为斗茶；在汤面作画，是为茶百戏。因「茶色贵白」，黑釉建盏成为最时髦的茶器。',
      notes: ['击拂汤花', '建盏', '茶百戏'],
      image: 'assets/img/diancha.jpg',
      imageCap: '宋 · 点茶 · 击拂出汤花'
    },
    {
      era: '明', nav: '瀹饮', years: '明 · 洪武二十四年（1391）', title: '废团改散，撮泡开始',
      text: '朱元璋下诏「罢造龙团，惟采芽茶以进」，团饼茶退出主流。散茶直接用沸水冲泡，「瀹饮法」从此流行。紫砂壶、盖碗相继登场，今天熟悉的泡茶方式，正是在明代定型。',
      notes: ['废团改散', '撮泡法', '紫砂兴起'],
      image: null
    },
    {
      era: '清', nav: '外销', years: '17–19 世纪', title: '万里茶道与海上茶路',
      text: '武夷茶沿万里茶道北上恰克图，正山小种、祁门红茶经海路远销欧洲。一片东方树叶，改变了英国的下午茶，也把中国茶区与全球贸易连在一起。',
      notes: ['万里茶道', '正山小种', '祁红外销'],
      image: null
    },
    {
      era: '今', nav: '当代', years: '2022 · 人类非遗', title: '传统制茶技艺，回到日常',
      text: '2022 年，「中国传统制茶技艺及其相关习俗」列入联合国教科文组织人类非物质文化遗产代表作名录。工夫茶、冷泡、新式茶饮并行，茶以更轻盈的方式回到年轻人的生活里。',
      notes: ['人类非遗', '工夫茶', '新茶饮'],
      image: null
    }
  ];

  const timelineNav = $('#timelineNav');
  const timelinePanel = $('#timelinePanel');
  const eraFigure = $('#eraFigure');

  ERAS.forEach((e, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'timelinePanel');
    b.setAttribute('aria-selected', 'false');
    b.tabIndex = -1;
    b.innerHTML = `<b>${e.era}</b>${e.nav}`;
    b.addEventListener('click', () => selectEra(i));
    timelineNav.appendChild(b);
  });

  function selectEra(i) {
    const e = ERAS[i];
    $$('button', timelineNav).forEach((b, k) => {
      b.classList.toggle('active', k === i);
      b.setAttribute('aria-selected', String(k === i));
      b.tabIndex = k === i ? 0 : -1;
    });
    $('#eraGhost').textContent = e.era;
    $('#eraYears').textContent = e.years;
    $('#eraTitle').textContent = e.title;
    $('#eraText').textContent = e.text;
    $('#eraNotes').innerHTML = e.notes.map(n => `<span>${n}</span>`).join('');
    if (e.image) {
      timelinePanel.classList.remove('no-figure');
      eraFigure.classList.remove('is-hidden');
      $('img', eraFigure).src = e.image;
      $('figcaption', eraFigure).textContent = e.imageCap;
    } else {
      timelinePanel.classList.add('no-figure');
      eraFigure.classList.add('is-hidden');
    }
  }
  timelinePanel.setAttribute('role', 'tabpanel');
  timelineNav.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const cur = ERAS.findIndex(x => x.era === $('#eraGhost').textContent);
    const next = (cur + (e.key === 'ArrowRight' ? 1 : -1) + ERAS.length) % ERAS.length;
    selectEra(next);
    $$('button', timelineNav)[next].focus();
  });
  selectEra(3);

  /* =========================================================
     Myths
     ========================================================= */
  const myths = $('#mythsList');
  MYTHS.forEach(m => {
    const d = document.createElement('details');
    d.innerHTML = `<summary>${m.q}</summary><p>${m.a}</p>`;
    myths.appendChild(d);
  });

  /* =========================================================
     Brew cheat sheet
     ========================================================= */
  const cheatBody = $('#cheatBody');
  const cheatFilter = $('#cheatFilter');
  const cheatSearch = $('#cheatSearch');
  let cheatCat = 'all', cheatQuery = '', cheatSort = { key: 'cat', dir: 1 };
  const firstNum = s => { const m = String(s).match(/\d+/); return m ? +m[0] : 0; };

  [{ id: 'all', name: '全部' }].concat(CATEGORIES.map(c => ({ id: c.id, name: c.name }))).forEach(f => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'filter-chip' + (f.id === 'all' ? ' active' : '');
    b.textContent = f.name;
    b.addEventListener('click', () => {
      cheatCat = f.id;
      $$('.filter-chip', cheatFilter).forEach(x => x.classList.toggle('active', x === b));
      renderCheat();
    });
    cheatFilter.appendChild(b);
  });

  function renderCheat() {
    const q = cheatQuery.trim().toLowerCase();
    let list = TEAS.filter(t => {
      const okCat = cheatCat === 'all' || t.cat === cheatCat;
      const okQ = !q || [t.name, t.vessel, t.en, catById(t.cat).name].join(' ').toLowerCase().includes(q);
      return okCat && okQ;
    });
    const k = cheatSort.key, d = cheatSort.dir;
    const val = t => k === 'name' ? t.name : k === 'cat' ? CATEGORIES.findIndex(c => c.id === t.cat) : k === 'temp' ? t.temp[0] : k === 'time' ? firstNum(t.time) : t.steeps;
    list.sort((a, b) => {
      const va = val(a), vb = val(b);
      return (typeof va === 'string' ? va.localeCompare(vb, 'zh') : va - vb) * d;
    });
    cheatBody.innerHTML = list.length ? list.map(t => {
      const c = catById(t.cat);
      return `<tr>
        <td><button type="button" class="cheat-name" data-tea="${t.id}">${t.name}</button></td>
        <td><span class="cheat-cat" style="--cat-color:${c.color}">${c.name}</span></td>
        <td>${t.temp[0]}–${t.temp[1]}°C</td>
        <td>${t.ratio}</td>
        <td>${t.time}</td>
        <td>${t.steeps} 泡</td>
        <td>${t.vessel}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="7" class="cheat-empty">没有匹配的茶，换个关键词试试。</td></tr>';
    $$('.cheat-name', cheatBody).forEach(b => b.addEventListener('click', () => openTea(b.dataset.tea)));
  }

  $$('.cheat-table th[data-sort]').forEach(th => {
    const doSort = () => {
      const key = th.dataset.sort;
      cheatSort = { key, dir: cheatSort.key === key ? -cheatSort.dir : 1 };
      $$('.cheat-table th[data-sort]').forEach(x => x.setAttribute('aria-sort', 'none'));
      th.setAttribute('aria-sort', cheatSort.dir === 1 ? 'ascending' : 'descending');
      renderCheat();
    };
    th.setAttribute('aria-sort', 'none');
    th.addEventListener('click', doSort);
    /* 表头原先只监听 click，键盘用户无法排序 */
    th.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doSort(); }
    });
  });
  cheatSearch.addEventListener('input', e => { cheatQuery = e.target.value; renderCheat(); });
  renderCheat();

  /* pour methods + water science */
  $('#pourGrid').innerHTML = POUR_METHODS.map(p => `
    <div class="pour-card">
      <span class="pour-icon" aria-hidden="true">${p.icon}</span>
      <h4>${p.name}</h4>
      <p class="pour-use">${p.use}</p>
      <p class="pour-desc">${p.desc}</p>
    </div>`).join('');
  $('#waterList').innerHTML = WATER_NOTES.map(w => `
    <div class="water-row">
      <span class="water-range">${w.range}</span>
      <div><b>${w.tea}</b><p>${w.why}</p></div>
    </div>`).join('');

  /* =========================================================
     2026-11-18 巡检补充：控件语义与状态播报（纯增量，不改既有渲染逻辑）
     ========================================================= */

  /* (A) 风味雷达图：<svg role="img" aria-label="风味雷达图"> 的标签是写死的，
         切换七大茶类后读屏仍只读到同一句「风味雷达图」，六轴分值只画在
         多边形里、完全没有文本替代（WCAG 1.1.1 非文本内容）。
         selectCat() 每次重绘 #catRadar 的 innerHTML，故用 MutationObserver
         在重绘后把「茶类名 + 发酵度 + 六轴分值」写进 aria-label，
         并补 SVG <title>/<desc> 供不支持 aria-label 的辅助技术取用。
         aria-label 相等时直接返回，避免自身 insertBefore 触发观察器 recursion。 */
  const radarSvg = $('#catRadar');
  let radarLabelCache = '';
  function syncRadarLabel() {
    if (!radarSvg || typeof CATEGORIES === 'undefined' || typeof AXES === 'undefined') return;
    const c = CATEGORIES[activeCat];
    if (!c || !c.radar) return;
    const parts = AXES.map((a, i) => a + ' ' + c.radar[i] + ' 分').join('，');
    const label = c.name + '（' + (c.id === 'flower' ? '鲜花窨制' : c.fermentLabel + ' ' + c.ferment + '%') +
                  '）风味雷达图；六项风味满分 100：' + parts;
    if (radarLabelCache === label) return;
    radarLabelCache = label;
    radarSvg.setAttribute('aria-label', label);
    const NS = 'http://www.w3.org/2000/svg';
    let title = radarSvg.querySelector('title'), desc = radarSvg.querySelector('desc');
    if (!title) {
      title = document.createElementNS(NS, 'title');
      radarSvg.insertBefore(title, radarSvg.firstChild);
    }
    if (!desc) {
      desc = document.createElementNS(NS, 'desc');
      radarSvg.insertBefore(desc, title.nextSibling);
    }
    title.textContent = c.name + '风味雷达图';
    desc.textContent = label;
  }
  if (radarSvg && typeof MutationObserver !== 'undefined') {
    new MutationObserver(syncRadarLabel).observe(radarSvg, { childList: true });
  }
  syncRadarLabel();

  /* (B1) 发酵程度滑块 min=0 max=6 实际是「茶类索引」，读屏只会读出 0~6 的裸数字，
          与可见标签「发酵程度 0%」语义错位；水温滑块读「85」没有单位。
          补 aria-valuetext 让读屏读出真实含义（WCAG 1.3.1 / 4.1.2）。 */
  const fermentRange = $('#fermentRange');
  function syncFermentText() {
    if (!fermentRange || typeof CATEGORIES === 'undefined') return;
    const c = CATEGORIES[Number(fermentRange.value)];
    if (c) fermentRange.setAttribute('aria-valuetext',
      c.name + '，' + (c.id === 'flower' ? '鲜花窨制' : c.fermentLabel + '，发酵程度 ' + c.ferment + '%'));
  }
  if (fermentRange) {
    fermentRange.addEventListener('input', syncFermentText);
    fermentRange.addEventListener('change', syncFermentText);
    syncFermentText();
  }
  const tempRangeEl = $('#tempRange');
  function syncTempText() {
    if (!tempRangeEl) return;
    tempRangeEl.setAttribute('aria-valuetext', tempRangeEl.value + ' 摄氏度');
  }
  if (tempRangeEl) {
    tempRangeEl.addEventListener('input', syncTempText);
    syncTempText();
  }

  /* (B2) 3 个 <output> 缺 for 关联，且未显式声明状态播报：点击 ± 按钮改投茶量 /
          注水量、拖动水温时，读屏用户收不到「哪个参数变成了多少」（WCAG 4.1.3）。
          <output> 隐式 role=status，这里显式补齐并给温度输出建立 for 关联。 */
  const OUTPUT_FOR = { tempOut: 'tempRange', gramsOut: '', mlOut: '' };
  $$('output').forEach(o => {
    const src = OUTPUT_FOR[o.id];
    if (src === undefined) return;
    if (src && !o.hasAttribute('for')) o.setAttribute('for', src);
    if (!o.hasAttribute('aria-live')) o.setAttribute('aria-live', 'polite');
    if (!o.hasAttribute('aria-atomic')) o.setAttribute('aria-atomic', 'true');
  });

  /* (C) 移动端导航按钮 aria-label 恒为「展开导航」，菜单展开后读屏仍提示「展开」；
         且整站唯一一处 Escape 处理属于详情弹窗，菜单打开后既不能按 Escape 关闭、
         点击菜单外也不会收起，关闭后焦点不归还（WCAG 4.1.2 / 2.1.2 / 2.4.3）。
         11-15 补丁只补了 aria-controls 与 visibility，此处补齐交互语义。 */
  const navBtn = $('#navToggle');
  const navMenu = $('.site-nav');
  function syncNavLabel() {
    if (!navBtn || !navMenu) return;
    const open = navMenu.classList.contains('open');
    navBtn.setAttribute('aria-label', open ? '收起导航' : '展开导航');
    navBtn.setAttribute('aria-expanded', String(open));
  }
  function closeNav() {
    if (!navMenu || !navMenu.classList.contains('open')) return;
    navMenu.classList.remove('open');
    document.body.classList.remove('no-scroll');
    syncNavLabel();
  }
  if (navBtn && navMenu) {
    navBtn.addEventListener('click', () => setTimeout(syncNavLabel, 0));
    $$('.site-nav a').forEach(a => a.addEventListener('click', () => setTimeout(syncNavLabel, 0)));
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !navMenu.classList.contains('open')) return;
      /* 详情弹窗打开时优先让弹窗处理 Escape，避免两个浮层同时关闭 */
      if (typeof modal !== 'undefined' && modal && !modal.hidden) return;
      closeNav();
      navBtn.focus();
    });
    document.addEventListener('click', e => {
      if (!navMenu.classList.contains('open')) return;
      if (navMenu.contains(e.target) || navBtn.contains(e.target)) return;
      closeNav();
    }, true);
    syncNavLabel();
  }

  /* (D) 3 个搜索框的 aria-label（搜索茶叶 / 搜索速查表 / 搜索术语）与可见
         placeholder 文本不一致，语音控制用户念出屏幕上的「搜茶名、产地或香气」
         无法命中控件（WCAG 2.5.3 Label in Name）。让可访问名称包含可见文本。 */
  $$('input[type="search"]').forEach(el => {
    const ph = el.getAttribute('placeholder');
    if (ph && el.getAttribute('aria-label') !== ph) el.setAttribute('aria-label', ph);
  });

  /* =========================================================
     Glossary
     ========================================================= */
  const glossGrid = $('#glossGrid');
  const glossFilter = $('#glossFilter');
  const glossSearch = $('#glossSearch');
  let glossCat = '全部', glossQuery = '';
  const glossCats = ['全部'].concat(Array.from(new Set(GLOSSARY.map(g => g.cat))));
  glossCats.forEach(name => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'filter-chip' + (name === '全部' ? ' active' : '');
    b.textContent = name;
    b.addEventListener('click', () => {
      glossCat = name;
      $$('.filter-chip', glossFilter).forEach(x => x.classList.toggle('active', x === b));
      renderGloss();
    });
    glossFilter.appendChild(b);
  });
  function renderGloss() {
    const q = glossQuery.trim().toLowerCase();
    const list = GLOSSARY.filter(g => (glossCat === '全部' || g.cat === glossCat) && (!q || (g.term + g.def).toLowerCase().includes(q)));
    glossGrid.innerHTML = list.length ? list.map(g => `
      <article class="gloss-card">
        <div class="gloss-top"><h3>${g.term}</h3><span>${g.cat}</span></div>
        <p>${g.def}</p>
      </article>`).join('') : '<p class="tea-empty">没有匹配的术语。</p>';
  }
  glossSearch.addEventListener('input', e => { glossQuery = e.target.value; renderGloss(); });
  renderGloss();

  /* =========================================================
     Smooth anchors offset
     ========================================================= */
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = $(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top, behavior: SCROLL_BEHAVIOR });
    });
  });

})();
