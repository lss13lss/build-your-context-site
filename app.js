(() => {
  "use strict";
  const data = window.KNOWLEDGE_DATA || { topics: [], articles: [] };
  const main = document.getElementById("main-content");
  const progress = document.getElementById("reading-progress-bar");
  const toast = document.getElementById("toast");
  let collectionRoute = "#/explore";
  let pendingSubscribe = false;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const scrollBehavior = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
  const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const getTopic = id => data.topics.find(topic => topic.id === id) || { id: "all", name: "未分类", english: "", description: "内容正在整理。" };
  const getArticle = id => data.articles.find(article => article.id === id);
  const formatDate = date => date.replaceAll("-", ".");

  function getArticleText(article) {
    const sectionText = (article.sections || []).flatMap(section => [section.title, ...(section.paragraphs || []), section.quote, section.cite, ...(section.list || []), section.figure?.alt, section.figure?.caption, section.link?.text]);
    return [article.title, article.summary, article.intro, ...(article.tags || []), ...sectionText].filter(Boolean).join(" ");
  }

  function searchArticles(query, topic = "all") {
    const terms = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
    return data.articles.map(article => {
      const fullText = getArticleText(article).toLowerCase();
      const summary = `${article.summary} ${article.intro}`.toLowerCase();
      const title = article.title.toLowerCase();
      if (!terms.every(term => fullText.includes(term))) return null;
      const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 8 : 0) + (summary.includes(term) ? 3 : 0) + 1, 0);
      return { article, score };
    }).filter(Boolean).filter(result => topic === "all" || result.article.topic === topic).sort((a, b) => b.score - a.score || b.article.date.localeCompare(a.article.date)).map(result => result.article);
  }

  function highlight(text, query) {
    const terms = [...new Set(query.trim().split(/\s+/u).filter(Boolean))].sort((a, b) => b.length - a.length);
    if (!terms.length) return escapeHTML(text);
    const regex = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "giu");
    return String(text).split(regex).map((part, index) => index % 2 ? `<mark>${escapeHTML(part)}</mark>` : escapeHTML(part)).join("");
  }

  function getSnippet(article, query) {
    const text = getArticleText(article);
    const lower = text.toLowerCase();
    const positions = query.trim().toLowerCase().split(/\s+/u).filter(Boolean).map(term => lower.indexOf(term)).filter(index => index >= 0);
    if (!positions.length) return article.summary;
    const position = Math.min(...positions);
    const start = Math.max(0, position - 36);
    return `${start > 0 ? "…" : ""}${text.slice(start, start + 150)}${start + 150 < text.length ? "…" : ""}`;
  }

  function cover(article, extraClass = "") {
    return `<div class="cover cover-${escapeHTML(article.cover)} ${extraClass}" aria-hidden="true"><span class="cover-symbol">${escapeHTML(article.issue || "MY CONTEXT")}</span></div>`;
  }

  function articleMeta(article, showTime = true) {
    return `<div class="article-meta"><span class="topic-name">${escapeHTML(getTopic(article.topic).name)}</span><i></i><time datetime="${article.date}">${formatDate(article.date)}</time>${showTime ? `<i></i><span>${article.readTime} 分钟阅读</span>` : ""}</div>`;
  }

  function articleCard(article, query = "") {
    return `<article class="article-card">${cover(article)}<div class="article-card-body">${articleMeta(article)}<h2><a href="#/article/${article.id}">${highlight(article.title, query)}</a></h2><p>${highlight(query ? getSnippet(article, query) : article.summary, query)}</p><a class="text-link" href="#/article/${article.id}">阅读全文 <span class="arrow">↗</span></a></div></article>`;
  }

  function articleRow(article, index) {
    return `<article class="article-row"><span class="row-index">${String(index + 1).padStart(2, "0")}</span><div><h3><a href="#/article/${article.id}">${escapeHTML(article.title)}</a></h3><span class="row-topic">${escapeHTML(getTopic(article.topic).name)} · ${article.readTime} 分钟</span></div><time class="row-date" datetime="${article.date}">${formatDate(article.date)}</time><a class="row-arrow" href="#/article/${article.id}" aria-label="阅读${escapeHTML(article.title)}">↗</a></article>`;
  }

  function filterChips(active, route, query = "") {
    const makeLink = (id, name) => `<a class="filter-chip ${active === id ? "active" : ""}" ${active === id ? 'aria-current="true"' : ""} href="#/${route}?${query ? `q=${encodeURIComponent(query)}&` : ""}${id === "all" ? "" : `topic=${id}`}">${escapeHTML(name)}</a>`;
    return `<div class="filter-chips" aria-label="按主题筛选">${makeLink("all", "全部")}${data.topics.map(topic => makeLink(topic.id, topic.name)).join("")}</div>`;
  }

  function subscribeBlock(context) {
    const id = `subscribe-email-${context}`;
    return `<form class="subscribe-form" data-subscribe-form novalidate><label class="eyebrow" for="${id}" style="position:absolute;clip:rect(0,0,0,0)">邮箱地址</label><input id="${id}" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" aria-describedby="status-${context}" placeholder="你的邮箱地址" required><button type="submit">订阅更新 ↗</button></form><div id="status-${context}" class="form-status" role="status" aria-live="polite">原型演示，不会保存邮箱或发送邮件。</div>`;
  }

  function newsletterSection() {
    return `<section class="newsletter" id="subscribe"><div class="wrap newsletter-inner"><div><span class="eyebrow">LETTER · 不定期来信</span><h2>持续积累，<br>也不必独自摸索。</h2><p>新的构建方法、公开样本与阅读思考。<br>不追求频繁，只在真正值得分享时写信。</p></div><div>${subscribeBlock("home")}</div></div></section>`;
  }

  function orbitVisual() {
    return `<div class="context-visual"><div class="orbit-card"><div class="orbit-top"><span>CONTEXT · 连接示意</span><span class="orbit-live">手动接续</span></div><div class="orbit-stage"><svg viewBox="0 0 440 350" aria-label="个人上下文连接不同智能助手、工作环境和新的任务" role="img"><g fill="none" stroke="#555a51" stroke-width="1"><ellipse cx="220" cy="170" rx="175" ry="115"/><ellipse cx="220" cy="170" rx="125" ry="78" stroke-dasharray="3 6"/><path d="M220 170 95 97M220 170l140-63M220 170 95 256M220 170l135 75"/></g><g fill="#21221f" stroke="#7d8377"><rect x="38" y="74" width="112" height="43" rx="21.5"/><rect x="302" y="84" width="112" height="43" rx="21.5"/><rect x="35" y="234" width="112" height="43" rx="21.5"/><rect x="297" y="225" width="112" height="43" rx="21.5"/></g><g fill="#d7d9d1" font-family="sans-serif" font-size="11" text-anchor="middle"><text x="94" y="100">智能助手 A</text><text x="358" y="110">智能助手 B</text><text x="91" y="260">工作环境</text><text x="353" y="251">新的任务</text></g><circle cx="220" cy="170" r="58" fill="#f5f2ea"/><circle cx="220" cy="170" r="67" fill="none" stroke="#e36b4b" stroke-dasharray="2 6"/><text x="220" y="166" text-anchor="middle" fill="#21221f" font-family="serif" font-size="19">你的上下文</text><text x="220" y="188" text-anchor="middle" fill="#71746c" font-family="sans-serif" font-size="9">积累 · 整理 · 接续</text><g fill="#e36b4b"><circle cx="95" cy="97" r="4"/><circle cx="360" cy="107" r="4"/><circle cx="95" cy="256" r="4"/><circle cx="355" cy="245" r="4"/></g></svg></div><div class="orbit-bottom">由你决定，把什么带到下一次</div></div></div>`;
  }

  function renderHome() {
    if (!data.articles.length) return renderNotFound("这里还没有内容", "公开示例正在整理，请稍后再来。");
    const featured = data.articles.find(article => article.featured) || data.articles[0];
    const fresh = [...data.articles].sort((a,b) => b.date.localeCompare(a.date)).slice(0,4);
    const starts = [
      ["第一次来", "先理解，再动手", "personal-agent-context", "个人上下文是什么，为什么值得积累？"],
      ["想直接实践", "写下第一份上下文", featured.id, "从一页纸开始，把偏好与边界说清楚。"],
      ["想看具体样本", "翻开一份公开示例", "public-collaboration-context", "看看可分享的协作偏好长什么样。"]
    ].filter(item => getArticle(item[2]));
    return `<section class="hero"><div class="wrap"><div class="hero-grid"><div class="hero-copy"><div class="hero-label eyebrow accent">一份持续生长的个人构建档案</div><h1><span>让理解持续<em>复利</em>，</span><span>让每个工具都更懂你</span></h1><p class="hero-description">把读过的、想过的和经历过的，慢慢积累成你的个人上下文。<br>在下一次与 AI 协作时，少一些重复介绍，多一些真正的推进。</p><div class="hero-actions"><a class="primary-link" href="#/article/${featured.id}">从第一份上下文开始 <span>↗</span></a><a class="text-link" href="#/explore">浏览全部内容 →</a></div><form class="search-form" data-search-form><label class="sr-only" for="hero-search">搜索公开内容</label><input id="hero-search" name="q" maxlength="80" placeholder="搜索你关心的主题或问题…"><button type="submit">搜索 ↗</button></form><div class="quick-search"><span>试试</span><a href="#/search?q=个人上下文">个人上下文</a><a href="#/search?q=复利">复利</a><a href="#/search?q=跨工具">跨工具</a></div></div><div class="hero-side">${orbitVisual()}<div class="hero-note"><span>一份上下文，多次接续</span><small>手动选择与分享，不代表已自动同步</small></div></div></div><div class="hero-index"><span><i></i> 公开构建笔记</span><span>${data.topics.length} 个主题 / ${data.articles.length} 篇示例</span><a href="#/about">关于这份档案 ↗</a></div></div></section>
    <section class="section entry-section"><div class="wrap"><div class="section-heading"><div><span class="eyebrow">START HERE · 阅读起点</span><h2>从你此刻的问题开始</h2></div><p>不必从头读完。选一条适合你的路径。</p></div><div class="entry-grid">${starts.map(([label,title,id,desc],i)=>`<a class="entry-card" href="#/article/${id}"><span class="entry-index">0${i+1} / ${label}</span><h3>${title}</h3><p>${desc}</p><span class="entry-link">${getArticle(id).readTime} 分钟阅读 <b aria-hidden="true">↗</b></span></a>`).join('')}</div></div></section>
    <section class="section section-line topics-section"><div class="wrap"><div class="section-heading"><div><span class="eyebrow">FIVE PATHS · 五条主线</span><h2>沿着一个主题，继续探索</h2></div><a class="text-link" href="#/explore">全部内容 ↗</a></div><div class="topics-grid">${data.topics.map((topic,i)=>`<a class="topic-card" href="#/explore?topic=${topic.id}"><span class="topic-number">0${i+1}</span><h3>${escapeHTML(topic.name)}</h3><p>${escapeHTML(topic.description)}</p><div class="topic-bottom"><span>${data.articles.filter(a=>a.topic===topic.id).length} 篇示例</span><span class="topic-arrow" aria-hidden="true">↗</span></div></a>`).join('')}</div></div></section>
    <section class="section section-line recent-section"><div class="wrap"><div class="section-heading"><div><span class="eyebrow">FIELD NOTES · 公开笔记</span><h2>最近写下的理解与尝试</h2></div><p>构建方法、实践记录与公开样本，<br>都从具体的问题出发。</p></div><div class="recent-layout"><article class="editor-pick">${cover(featured)}<div>${articleMeta(featured)}<h3><a href="#/article/${featured.id}">${escapeHTML(featured.title)}</a></h3><p>${escapeHTML(featured.summary)}</p><a class="text-link" href="#/article/${featured.id}">翻开这篇指南 ↗</a></div></article><div class="article-list">${fresh.map(articleRow).join('')}</div></div></div></section>
    <section class="section section-line context-principles"><div class="wrap"><div class="section-heading"><div><span class="eyebrow">WHY CONTEXT · 理解与边界</span><h2>积累，是为了下一次更清楚</h2></div><p>所谓复利，是减少下一次解释和纠错的成本。</p></div><div class="principles-grid"><article><span>01 / 留下来</span><h3>从经历里找到线索</h3><p>记录重要目标、稳定偏好和选择背后的原因，让下一次交流有一个起点。</p></article><article><span>02 / 用起来</span><h3>在实际协作中修正</h3><p>手动把合适的背景带给工具，再用新的经验修正旧理解。</p></article><article><span>03 / 有边界</span><h3>始终由你决定分享什么</h3><p>记得更多不等于更懂你。哪些内容不用、何时等待，也需要说清楚。</p></article></div></div></section>${newsletterSection()}`;
  }

  function renderExplore(params) {
    const requested = params.get("topic") || "all";
    const active = data.topics.some(topic => topic.id === requested) ? requested : "all";
    const articles = active === "all" ? data.articles : data.articles.filter(article => article.topic === active);
    const topic = active === "all" ? null : getTopic(active);
    return `<section class="page-head"><div class="wrap"><span class="eyebrow accent">EXPLORE · 全部内容</span><h1>${topic ? escapeHTML(topic.name) : "在理解与实践中，继续探索"}</h1><p>${topic ? escapeHTML(topic.description) : "五个相互连接的栏目，一份持续生长的公开构建档案。"}</p></div></section><section class="section" style="padding-top:0"><div class="wrap">${filterChips(active,"explore")}<div class="result-count" role="status">共 ${articles.length} 篇公开示例</div><div class="article-cards">${articles.map(article => articleCard(article)).join("")}</div></div></section>`;
  }

  function renderSearch(params) {
    const query = (params.get("q") || "").trim().slice(0, 80);
    const requested = params.get("topic") || "all";
    const active = data.topics.some(topic => topic.id === requested) ? requested : "all";
    const results = query ? searchArticles(query, active) : [];
    const total = query ? searchArticles(query) : [];
    const form = `<form class="search-form search-page-form" data-search-form data-topic="${escapeHTML(active)}"><label class="sr-only" for="page-search">搜索公开内容</label><input id="page-search" name="q" maxlength="80" value="${escapeHTML(query)}" placeholder="输入关键词，搜索标题与正文…">${query ? '<a class="clear-query" href="#/search" aria-label="清空搜索">×</a>' : ''}<button type="submit">搜索 ↗</button></form>`;
    let content;
    if (!query) content = `<div class="search-suggestions"><span class="eyebrow">SEARCH GUIDE · 搜索引导</span><h2>从一个你真正关心的问题开始</h2><p>输入关键词，也可以用空格组合多个关键词。</p><div class="quick-search"><a href="#/search?q=个人上下文">个人上下文</a><a href="#/search?q=复利">复利</a><a href="#/search?q=智能助手">智能助手</a></div></div>`;
    else {
      const scope = active === "all" ? "全部主题" : getTopic(active).name;
      content = `${filterChips(active,"search",query)}<div class="result-count" role="status">${escapeHTML(scope)} · 找到 ${results.length} 篇与“${escapeHTML(query)}”相关的内容</div>`;
      if (!results.length) content += `<div class="search-empty"><span class="empty-icon" aria-hidden="true">⌕</span><h2>${active !== 'all' && total.length ? '这个主题下暂时没有匹配' : '还没找到这条线索'}</h2><p>${active !== 'all' && total.length ? `其他主题中有 ${total.length} 篇相关笔记，可以保留关键词继续查找。` : '试试更短的关键词，或从主题列表继续浏览。'}</p><div class="empty-actions">${active !== 'all' ? `<a class="primary-link" href="#/search?q=${encodeURIComponent(query)}">在全部主题中搜索 →</a>` : '<a class="primary-link" href="#/explore">浏览全部内容 →</a>'}<a class="text-link" href="#/search">清空搜索</a></div></div>`;
      else content += `<div class="search-results">${results.map(a=>`<article class="search-result">${articleMeta(a)}<h2><a href="#/article/${a.id}">${highlight(a.title,query)}</a></h2><p>${highlight(getSnippet(a,query),query)}</p><a class="text-link" href="#/article/${a.id}">阅读这篇笔记 ↗</a></article>`).join('')}</div>`;
    }
    return `<section class="page-head"><div class="wrap"><span class="eyebrow accent">SEARCH · 检索公开档案</span><h1>寻找一条有用的线索</h1>${form}<p class="search-scope-note">仅搜索已公开的示例内容 · 多个关键词需同时命中</p></div></section><section class="section" style="padding-top:0"><div class="wrap">${content}</div></section>`;
  }

  function articleSection(section, index) {
    return `<section id="section-${index + 1}"><h2 tabindex="-1">${escapeHTML(section.title)}</h2>${(section.paragraphs || []).map(p => `<p>${escapeHTML(p)}</p>`).join("")}${section.quote ? `<blockquote>${escapeHTML(section.quote)}${section.cite ? `<cite>${escapeHTML(section.cite)}</cite>` : ""}</blockquote>` : ""}${section.list ? `<ul>${section.list.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ul>` : ""}${section.figure ? `<figure><img src="${escapeHTML(section.figure.src)}" alt="${escapeHTML(section.figure.alt)}"><figcaption>${escapeHTML(section.figure.caption)}</figcaption></figure>` : ""}${section.link ? `<a class="article-inline-link" href="${escapeHTML(section.link.href)}">${escapeHTML(section.link.text)} ↗</a>` : ""}</section>`;
  }

  function renderArticle(id) {
    const article = getArticle(id);
    if (!article) return renderNotFound();
    const related = [...data.articles.filter(item => item.id !== id && item.topic === article.topic), ...data.articles.filter(item => item.id !== id && item.topic !== article.topic)].slice(0, 2);
    return `<article><header class="article-head"><div class="wrap"><a class="back-link" href="${escapeHTML(collectionRoute)}">← ${collectionRoute.startsWith("#/search") ? "返回搜索结果" : "返回文章列表"}</a><div class="breadcrumbs">全部内容 / ${escapeHTML(getTopic(article.topic).name)} / ${escapeHTML(article.issue)}</div><div class="article-heading-grid"><div class="article-title"><span class="eyebrow accent">${escapeHTML(getTopic(article.topic).english)}</span><h1>${escapeHTML(article.title)}</h1><p>${escapeHTML(article.summary)}</p>${articleMeta(article)}</div>${cover(article,"article-cover")}</div></div></header><div class="wrap mobile-toc-wrap"><details class="mobile-toc"><summary>本篇目录 <span>${article.sections.length} 个章节</span></summary><nav aria-label="手机文章目录">${article.sections.map((section,index)=>`<a href="#section-${index+1}" data-section="section-${index+1}">${String(index+1).padStart(2,"0")} · ${escapeHTML(section.title)}</a>`).join("")}</nav></details></div><div class="wrap article-layout"><aside class="article-toc" aria-label="文章目录"><div class="eyebrow">CONTENTS · 目录</div><div class="reading-counter" aria-hidden="true">已读 <span id="reading-percent">0</span>%</div>${article.sections.map((section,index) => `<a href="#section-${index+1}" data-section="section-${index+1}">${escapeHTML(section.title)}</a>`).join("")}</aside><div class="article-body"><p class="article-intro">${escapeHTML(article.intro)}</p>${article.sections.map(articleSection).join("")}<div class="article-end">全文完</div><div class="article-tags">${article.tags.map(tag => `<a href="#/search?q=${encodeURIComponent(tag)}"># ${escapeHTML(tag)}</a>`).join("")}</div></div></div><section class="article-subscribe" id="subscribe"><div class="wrap article-subscribe-inner"><h2>持续积累，也不必独自摸索。</h2><p>订阅新的构建笔记。当前仅为表单演示。</p>${subscribeBlock("article")}</div></section><section class="related"><div class="wrap"><div class="section-heading"><div><span class="eyebrow">READ NEXT · 继续阅读</span><h2>沿着这条线索</h2></div></div><div class="related-grid">${related.map(item => `<article class="related-card">${articleMeta(item)}<h3><a href="#/article/${item.id}">${escapeHTML(item.title)}</a></h3><p>${escapeHTML(item.summary)}</p><a class="text-link" href="#/article/${item.id}">阅读全文 ↗</a></article>`).join("")}</div></div></section></article>`;
  }

  function renderAbout() {
    return `<section class="page-head"><div class="wrap"><span class="eyebrow accent">ABOUT · 关于此站</span><h1>把理解当作一件长期的事</h1><p>我的上下文，是一份面向普通用户的个人上下文公开构建档案。</p></div></section><div class="wrap about-grid"><div><span class="eyebrow">WHY · 为什么构建</span><h2>不是制造一个更懂你的黑箱，<br>而是保留你对自身的解释权。</h2><p>这里分享个人上下文的构建方法、实践过程与公开样本，也以个人智能体为应用方向，持续关注相关前沿、思考与阅读。</p><p>书籍与研究是输入，个人思考是判断，构建实验是验证，公开上下文是产出。希望这些内容能帮助你从一张白纸开始，也能在不同工具之间继续。</p></div><div class="boundary-list"><span class="eyebrow accent">BOUNDARIES · 原型边界</span><ul><li>全部文章都是独立编写的公开示例，不读取或公开真实私人知识库。</li><li>跨工具接续只展示手动交接，不宣称已经自动同步。</li><li>订阅只做格式校验，不保存邮箱，也不发送邮件。</li><li>没有 AI 问答、评论、账号、付费或文章管理后台。</li><li>当前为本地静态前端原型，尚未公开部署。</li></ul></div></div>${newsletterSection()}`;
  }

  function renderNotFound(title = "这里还没有内容", description = "你寻找的页面或文章不存在，也可能正在整理。") {
    return `<section class="empty-state"><span class="eyebrow">404 · 空白的一页</span><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p><a class="primary-link" href="#/">回到首页 ↗</a></section>`;
  }

  function parseRoute() {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [path, query = ""] = raw.split("?");
    return { path, params: new URLSearchParams(query) };
  }

  function updateNavigation(route) {
    const name = route.path === "/" ? "home" : route.path.startsWith("/explore") ? "explore" : route.path.startsWith("/search") ? "search" : route.path.startsWith("/about") ? "about" : route.path.startsWith("/article") ? "explore" : "";
    document.querySelectorAll("[data-nav]").forEach(link => link.dataset.nav === name ? link.setAttribute("aria-current", "page") : link.removeAttribute("aria-current"));
  }

  function render() {
    const route = parseRoute();
    if (route.path === "/explore" || route.path === "/search") collectionRoute = location.hash;
    document.body.dataset.page = route.path.startsWith("/article/") ? "article" : route.path === "/search" ? "search" : route.path === "/" ? "home" : "other";
    toast.classList.remove("show");
    if (route.path === "/") main.innerHTML = renderHome();
    else if (route.path === "/explore") main.innerHTML = renderExplore(route.params);
    else if (route.path === "/search") main.innerHTML = renderSearch(route.params);
    else if (route.path.startsWith("/article/")) main.innerHTML = renderArticle(route.path.split("/")[2]);
    else if (route.path === "/about") main.innerHTML = renderAbout();
    else main.innerHTML = renderNotFound();
    updateNavigation(route);
    document.title = `${route.path.startsWith("/article/") ? getArticle(route.path.split("/")[2])?.title || "内容未找到" : route.path === "/explore" ? "探索内容" : route.path === "/search" ? "搜索" : route.path === "/about" ? "关于此站" : "我的上下文"} — 我的上下文`;
    window.scrollTo({ top: 0, behavior: "instant" });
    main.focus({ preventScroll: true });
    updateProgress();
    if (pendingSubscribe) { pendingSubscribe = false; scrollToSubscribe(); }
  }

  function scrollToSubscribe() {
    const target = document.getElementById("subscribe");
    if (target) {
      target.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
      target.querySelector("input")?.focus({ preventScroll: true });
    } else {
      pendingSubscribe = true;
      location.hash = "#/";
    }
  }

  function handleSubscribe(form) {
    const input = form.querySelector("input[type=email]");
    const status = form.parentElement.querySelector(".form-status");
    const value = input.value.trim();
    input.value = value;
    let message = "";
    if (!value) message = "请先填写邮箱地址。";
    else if (!input.checkValidity() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value)) message = "邮箱格式似乎不正确，请检查后重试。";
    if (message) { status.textContent = message; status.classList.add("error"); input.setAttribute("aria-invalid", "true"); input.focus(); return; }
    input.removeAttribute("aria-invalid"); status.classList.remove("error"); status.textContent = "格式校验通过。演示模式：邮箱未保存，也没有发送任何邮件。";
    toast.textContent = "演示校验通过，未保存邮箱"; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function updateProgress() {
    const isArticle = parseRoute().path.startsWith("/article/");
    if (!isArticle) { progress.style.width = "0"; return; }
    const body = document.querySelector(".article-body");
    if (!body) { progress.style.width = "0"; return; }
    const rect = body.getBoundingClientRect();
    const start = rect.top + scrollY - 110;
    const end = rect.bottom + scrollY - innerHeight + 100;
    const percent = Math.round(Math.min(100, Math.max(0, (scrollY - start) / Math.max(1, end - start) * 100)));
    progress.style.width = `${percent}%`;
    const label = document.getElementById("reading-percent");
    if (label) label.textContent = percent;
    const sections = [...document.querySelectorAll(".article-body section[id]")];
    let current = sections[0]?.id;
    sections.forEach(section => { if (section.getBoundingClientRect().top < 180) current = section.id; });
    document.querySelectorAll(".article-toc a").forEach(link => link.classList.toggle("active", link.dataset.section === current));
  }

  document.addEventListener("submit", event => {
    if (event.target.matches("[data-search-form]")) { event.preventDefault(); const query = new FormData(event.target).get("q").trim().slice(0, 80); const topic = event.target.dataset.topic || "all"; location.hash = query ? `#/search?q=${encodeURIComponent(query)}${topic !== "all" ? `&topic=${encodeURIComponent(topic)}` : ""}` : "#/search"; }
    if (event.target.matches("[data-subscribe-form]")) { event.preventDefault(); handleSubscribe(event.target); }
  });
  document.addEventListener("click", event => {
    const sameRoute = event.target.closest('a[href^="#/"]');
    if (sameRoute && sameRoute.getAttribute("href") === (location.hash || "#/")) { event.preventDefault(); render(); return; }
    const subscribe = event.target.closest("[data-subscribe]");
    if (subscribe) { event.preventDefault(); scrollToSubscribe(); }
    const toc = event.target.closest("a[data-section]");
    if (toc) { event.preventDefault(); const details = toc.closest("details"); if (details) details.open = false; const section = document.getElementById(toc.dataset.section); section?.scrollIntoView({ behavior: scrollBehavior() }); section?.querySelector("h2")?.focus({ preventScroll: true }); }
  });
  document.querySelector(".skip-link").addEventListener("click", event => { event.preventDefault(); main.focus(); main.scrollIntoView(); });
  addEventListener("hashchange", render);
  addEventListener("scroll", updateProgress, { passive: true });
  addEventListener("resize", updateProgress);
  window.ZhiyuDemo = Object.freeze({ searchArticles, getArticleText });
  render();
})();
