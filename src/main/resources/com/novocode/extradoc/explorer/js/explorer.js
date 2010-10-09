var ex = window.extradoc;


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
  if(entity >= 0) {
    pos = $($("ol.page > li")[entity]).position().top + content.scrollTop() - 6;
  } else pos = 0;
  content.scrollTop(pos);
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
    else t("["+o[0]+", "+o[1]+"]", aE);
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
  function markerFor(is) {
    switch(is) {
      case 'b': return ["O", "object"];
      case 'c': return ["C", "class"];
      case 't': return ["T", "trait"];
      case 'p': return ["P", "package"];
    }
  }
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
          var marker = markerFor(i == -1 ? "p" : p.e[i].k);
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
var currentPage;


//////////////////////////////////////////////////////////////////////////////
// Main program
//////////////////////////////////////////////////////////////////////////////

var queuedInit = null;
var baseTitle = "Extradoc Explorer";

function goToEntity(page, entity) { $.history.load("e/"+page+"/"+entity); }

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

function showTitle(page) {
  document.title = page > 0 ? (ex.global.names[page+",0"]+" - "+baseTitle) : baseTitle;
}

function showEntity(page, entity) {
  function f() {
    log("Showing page "+page+", entity "+entity);
    if(currentPage && page == currentPage.no)
      scrollToEntity(entity);
    else loadPage(page, entity);
    markNavigationPage(page);
    showTitle(page);
  }
  if(ex.global) f(); else queuedInit = f;
}

$(function() {

  log("Extradoc Explorer starting");
  var navigation = $("#navigation");
  var content = $("#content");
  $("<div id=\"separator\"></div>").insertAfter($("#navigation")).draggable({
    axis: "x",
    containment: "parent",
    drag: function(event, ui) {
      navigation.css("width", ui.position.left);
      content.css("left", ui.position.left+1);
    }
  });

  $("#navigation").empty().append("Loading navigation...");
  ex.loadGlobal(function(global) {
      $("#navigation").empty().append(createNavigationDOM());
      if(queuedInit) { queuedInit(); queuedInit = null; }
    }, function(XMLHttpRequest, textStatus, errorThrown) {
      var errmsg = "Error loading page: "+textStatus+"; "+errorThrown;
      log(errmsg);
      $("#navigation").empty().append(errmsg);
    });

  $.history.init(function(hash) {
    var res;
    if(hash == "") showEntity(0, -1);
    else if(res = hash.match(/^e\/(.*)\/(.*)$/)) showEntity(parseInt(res[1]), parseInt(res[2]));
  }, { unescape: "/" });

});
