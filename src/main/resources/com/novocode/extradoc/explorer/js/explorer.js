var ex = window.extradoc;
var baseTitle = "Extradoc Explorer";
var currentTab;
var currentPage;
var currentEntity = 0;


//////////////////////////////////////////////////////////////////////////////
// Utility functions
//////////////////////////////////////////////////////////////////////////////

function log(msg) { if(window.console) console.log(msg); }

function e(n, as, p) {
  var n = document.createElement(n);
  if(as)
    for(var a in as)
      if(as.hasOwnProperty(a))
        n.setAttribute(a, as[a]);
  if(p) p.appendChild(n);
  return n;
}

function t(t, p) {
  var n = document.createTextNode(t);
  if(p) p.appendChild(n);
  return n;
}

function scrollToEntity(entity) {
  var content = $("#content");
  var pos;
  if(entity > 0) {
    pos = $($("ol.page > li")[entity]).position().top + content.scrollTop() - 6;
  } else pos = 0;
  content.scrollTop(pos);
};

function decodeHash(hash) {
  var params = {};
  if(!hash || hash.charAt(0) != '!') return params;
  var parts = hash.replace(/^!/, "").split("&");
  for(var i=0; i<parts.length; i++) {
    var kv = parts[i].split("=");
    if(kv.length == 2) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
  }
  return params;
}

function encodeHash(params) {
  var hash = "!";
  for(var k in params) {
    if(params.hasOwnProperty(k)) {
      if(hash.length != 1) hash += "&"
      hash += encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }
  }
  return hash.length == 1 ? "" : hash;
}

function showTitle(page) {
  document.title = page > 0 ? (ex.global.names[page+",0"]+" - "+baseTitle) : baseTitle;
  var j = $("#mainTitle").empty();
  if(page > 0) {
    var first = true;
    function f(p) {
      var pi = ex.global.pageToPageInfo[p];
      if(p === page) {
        t(kindMarkers[pi.k][0], e("div", null, j[0]));
      }
      var parent = pi && pi["in"];
      log("page: "+p+", parent: "+parent);
      if(parent && parent != p) f(parent);
      if(first) first = false;
      else t(" . ", j[0]);
      if(p === page) t(ex.global.names[p+",0"], j[0]);
      else {
        var aE = e("a", { href: "#" }, j[0]);
        t(ex.global.names[p+",0"], aE);
        aE.onclick = function() { goToEntity(pi.p, -1); return false; }
      }
    }
    f(page);
  }
}

function activateTab(view) {
  var id = "tab_"+view;
  if(currentTab) {
    if(currentTab == view) return;
    $("#tab_"+currentTab).toggleClass("selected", false);
  }
  currentTab = view;
  $("#tab_"+view).toggleClass("selected", true);
}

var kindMarkers = {
  b: ["O", "object"],
  c: ["C", "class"],
  t: ["T", "trait"],
  p: ["P", "package"]
};


//////////////////////////////////////////////////////////////////////////////
// Create DOM for content area
//////////////////////////////////////////////////////////////////////////////

function createObjectDOM(o, no) {
  var tableE = e("table", { "class": "object", cellspacing: 0, cellpadding: 0 });
  var tbodyE = e("tbody", null, tableE);
  if(o._isEntity) {
    var trE = e("tr", null, tbodyE);
    var thE = e("th", { colspan: 2, "class": "entityhead" }, trE);
    t(o.qName, thE);
  }
  for(var k in o) {
    if(!o.hasOwnProperty(k) || k[0] == "_") continue;
    var trE = e("tr", null, tbodyE);
    var thE = e("th", null, trE);
    var tdE = e("td", null, trE);
    t(k, thE);
    if(k == "sourceUrl") e("a", { href: o[k] }, tdE).appendChild(t(o[k]));
    else tdE.appendChild(createChildDOM(o[k]));
  }
  return tableE;
}

function createArrayDOM(o) {
  var olE = e("ol", { start: 0, "class": "array" });
  for(var i=0; i<o.length; i++) {
    var liE = e("li", null, olE);
    liE.appendChild(createChildDOM(o[i]));
  }
  return olE;
}

function createHtmlDOM(o) {
  var divE = e("div", { "class": "html" });
  $(divE).append(o._html);
  return divE;
}

function createXNameDOM(o) {
  var spanE = e("span");
  $(spanE).append(o._xname);
  $("a", spanE).each(function(idx) {
    this.href = "##";
    this.onclick = function() { goToEntity(o._refs[idx][0], o._refs[idx][1]); return false; }
  });
  return spanE;
}

function createChildDOM(o) {
  var tp = typeof(o);
  if(tp == "string") return t(o);
  else if(tp == "number") return t(o);
  else if(tp == "boolean") return t(o);
  else if(o._isLink) {
    var aE = e("a", { href: "#" });
    aE.onclick = function() { goToEntity(o[0], o[1]); return false; }
    if(o[0] == currentPage.no) t(currentPage.model[o[1]].name, aE);
    else t(ex.global.names[o[0]+","+o[1]] + "\u2197 ", aE);
    return aE;
  }
  else if(o.hasOwnProperty("length")) {
    if(o.length > 0) return createArrayDOM(o);
    else return t("[]");
  }
  else if(o.hasOwnProperty("_html")) return createHtmlDOM(o);
  else if(o.hasOwnProperty("_xname")) return createXNameDOM(o);
  else return createObjectDOM(o);
}

function createEntityDOM(entity, no) { return createObjectDOM(entity, no); }

function createPageDOM(page) {
  var olE = e("ol", { "class": "page", start: 0 });
  for(var i=0; i<page.length; i++) {
    var liE = e("li", null, olE);
    liE.appendChild(createEntityDOM(page[i], i));
  }
  return olE;
};


//////////////////////////////////////////////////////////////////////////////
// Create DOM for navigation area
//////////////////////////////////////////////////////////////////////////////

var navigationPages = [];
var selectedNavigationPage = null;

function createNavigationDOM() {
  var packages = ex.global.packages;
  var ulE = e("ul", { "class": "packages" });
  function createPackageDOM(p) {
    var liE = e("li", null, ulE);
    var aE = e("a", { href: "#" }, e("span", null, liE));
    t(p.n, aE);
    var tableJ = null, showing = false;
    navigationPages[p.p] = { pack: liE };
    if(p.e) for(var i=0; i<p.e.length; i++) navigationPages[p.e[i].p] = { pack: liE };
    liE.exShow = function(show) {
      if(show === undefined) show = !showing;
      $(liE).toggleClass("expanded", show);
      if(tableJ) tableJ.css("display", show ? "block" : "none");
      else if(show && p.e) {
        var tableE = e("table", { cellpadding: 0, cellspacing: 0 }, liE);
        tableJ = $(tableE);
        function createLinkDOM(i) {
          var pageNo = i == -1 ? p.p : p.e[i].p;
          var trE = e("tr", i == -1 ? { "class": "package" } : null, tableE)
          var name = i == -1 ? p.n : ex.global.names[p.e[i].p+",0"];
          var marker = kindMarkers[i == -1 ? "p" : p.e[i].k];
          t(marker[0], e("div", null, e("th", { "class": marker[1] }, trE)));
          var aE = e("a", { href: "#" }, e("td", null, trE));
          aE.onclick = function() { goToEntity(pageNo, -1); return false; };
          t(name, aE);
          navigationPages[pageNo].pageRow = trE;
        }
        for(var i=-1; i<p.e.length; i++) createLinkDOM(i);
      }
      showing = show;
    }
    aE.onclick = function() { liE.exShow(); return false; }
  };
  for(var i=0; i<packages.length; i++)
    if(packages[i].n !== "_root_") createPackageDOM(packages[i]);
  return ulE;
}

function markNavigationPage(no) {
  var newSel;
  if(no > 0) newSel = navigationPages[no];
  if(selectedNavigationPage === newSel) return;
  if(selectedNavigationPage) {
    $(selectedNavigationPage.pageRow).toggleClass("selected", false);
    selectedNavigationPage = null;
  }
  if(newSel) {
    selectedNavigationPage = newSel;
    selectedNavigationPage.pack.exShow(true);
    $(selectedNavigationPage.pageRow).toggleClass("selected", true);
  }
}


//////////////////////////////////////////////////////////////////////////////
// Page loading and caching
//////////////////////////////////////////////////////////////////////////////

function Page(model) {
  this.model = model;
  this.no = model._no;
}

Page.prototype.getModelDOM = function() {
  if(this.modelDOM) return this.modelDOM;
  this.modelDOM = createPageDOM(this.model);
  delete this.model;
  return this.modelDOM;
};

var pageCache = new Cache(10);


//////////////////////////////////////////////////////////////////////////////
// Main program
//////////////////////////////////////////////////////////////////////////////

var queuedInit = null;

function goToEntity(page, entity, view) {
  if(!page && page !== 0) page = currentPage ? currentPage.no : 0;
  if(!entity && entity !== 0) entity = currentEntity;
  if(!view) view = currentTab;
  var params = { t: ex.global.pageToPageInfo[page].qn };
  if(entity && entity != -1) params.e = entity;
  if(view && view != "page") params.v = view;
  $.history.load(encodeHash(params));
}

function loadPage(no, entity) {
  $("#content").empty().append("Loading and rendering page "+no+"...");
  $(window).scrollTop(0);
  setTimeout(function() {
    var cached = pageCache.getItem("p"+no);
    if(cached) {
      log("Retrieved page from cache");
      currentPage = cached;
      $("#content").empty().append(cached.getModelDOM());
    } else {
      log("Loading data...");
      var t0 = (new Date).getTime();
      ex.load(no, function(model) {
          log("Loaded and prepared page with "+model.length+" entities in "+((new Date).getTime()-t0)+"ms");
          t0 = (new Date).getTime();
          var page = new Page(model);
          currentPage = page;
          pageCache.setItem("p"+no, page);
          $("#content").empty().append(page.getModelDOM());
          log("Rendered in "+((new Date).getTime()-t0)+"ms");
          scrollToEntity(entity);
        }, function(XMLHttpRequest, textStatus, errorThrown) {
          var errmsg = "Error loading page: "+textStatus+"; "+errorThrown;
          log(errmsg);
          $("#content").empty().append(errmsg);
        });
    }
  }, 0);
}

function showEntity(page, entity, view) {
  function f() {
    if(!view) view = "page";
    if(!page) page = 0;
    else if(typeof page === "string") page = (ex.global.qnToPageInfo[page] || {p:0}).p;
    log("Showing page "+page+", entity "+entity+", view "+view);
    if(currentPage && page == currentPage.no)
      scrollToEntity(entity);
    else loadPage(page, entity);
    markNavigationPage(page);
    showTitle(page);
    activateTab(view);
  }
  if(ex.global) f(); else queuedInit = f;
}

$(function() {

  log("Extradoc Explorer starting");
  var navigation = $("#navigation");
  var content = $("#content");

  var inClick = false;
  var rememberedPos = 300;
  $('<div id="separator"><div></div></div>').insertAfter(navigation).draggable({
    axis: "x",
    containment: "parent",
    cursor: "e-resize",
    snap: "body",
    drag: function(event, ui) {
      var pos = ui.position.left;
      navigation.css("width", pos);
      content.css("left", pos+1);
      inClick = false;
      if(pos > 20) rememberedPos = pos;
    }
  });
  var separator = $("#separator");
  $("#separator div").mousedown(function() {
    inClick = true;
    return true;
  }).click(function() {
    if(!inClick) return false;
    inClick = false;
    var pos = separator.css("left") !== "0px" ? 0 : rememberedPos;
    separator.css("left", pos);
    navigation.css("width", pos);
    content.css("left", pos+1);
  }).attr("title", "Toggle Sidebar");

  navigation.empty().append("Loading navigation...");
  ex.loadGlobal(function(global) {
      navigation.empty().append(createNavigationDOM());
      if(queuedInit) { queuedInit(); queuedInit = null; }
    }, function(XMLHttpRequest, textStatus, errorThrown) {
      var errmsg = "Error loading page: "+textStatus+"; "+errorThrown;
      log(errmsg);
      navigation.empty().append(errmsg);
    });

  $("#tabs td.tab").each(function() {
    var view = this.id.replace(/^tab_/, "");
    this.onclick = function() { goToEntity(null, null, view); return false; };
  });

  $.history.init(function(hash) {
    var params = decodeHash(hash);
    showEntity(params.t, params.e || -1, params.v);
  }, { unescape: true });

  $("#leftTitle").text(baseTitle);

});
