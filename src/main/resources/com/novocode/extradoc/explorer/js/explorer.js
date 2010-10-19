var ex = window.extradoc;
var baseTitle = "Extradoc Explorer";
var currentPage, currentEntity = 0, currentSourceUrl;
var pageCache = new Cache(30);


//////////////////////////////////////////////////////////////////////////////
// View management
//////////////////////////////////////////////////////////////////////////////

function View(id) {
  this.id = id;
  this.contentJ = $("#content_"+id);
  View[id] = this;
}

new View("none");
View.currentID = "none";
View.defaultView = "model";

View.scrollToEntity = function(entity) {
  var view = View[View.currentID];
  var pos = 0;
  if(entity > 0) {
    var epos = $($("ol.page > li")[entity]).position();
    if(epos) {
      pos = epos.top;
      pos += view.contentJ.scrollTop() - 6;
    }
  }
  view.contentJ.scrollTop(pos);
};

View.showMessage = function(msg) { View.msg.show(t(msg)); }

View.prototype.show = function(node, showing) {
  if(node) this.contentJ.empty().append(node);
  this.showing = showing;
  if(View.currentID == this.id) return;
  View[View.currentID].contentJ.css("visibility", "hidden");
  View.currentID = this.id;
  this.contentJ.css("visibility", "visible");
};

View.prototype.isShowing = function(showing) {
  return this.showing && this.showing == showing;
};


//////////////////////////////////////////////////////////////////////////////
// Tab management
//////////////////////////////////////////////////////////////////////////////

function Tab(id) {
  this.id = id;
  this.tabJ = $("#tab_"+id);
  this.loading = false;
  Tab[id] = this;
}

new Tab("none");
Tab.currentID = "none";

Tab.prototype.show = function() {
  if(Tab.currentID == this.id) return;
  Tab[Tab.currentID].tabJ.toggleClass("selected", false);
  Tab.currentID = this.id;
  this.tabJ.toggleClass("selected", true);
  Tab.loader.css("display", this.loading ? "block" : "none");
};

Tab.prototype.setLoading = function(b) {
  this.loading = b;
  if(Tab.currentID == this.id)
    Tab.loader.css("display", this.loading ? "block" : "none");
};


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
      if(p === page && pi) {
        t(kindMarkers[pi.k][0], e("div", null, j[0]));
      }
      var parent = pi && pi["in"];
      //log("page: "+p+", parent: "+parent);
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

var kindMarkers = {
  b: ["O", "object"],
  c: ["C", "class"],
  t: ["T", "trait"],
  p: ["P", "package"]
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
// Page definition
//////////////////////////////////////////////////////////////////////////////

function Page(model) {
  this.model = model;
  this.no = model._no;
}

Page.prototype.getDOM = function(view) {
  if(view == "model") return this.getModelDOM();
  else if(view == "source") return this.getSourceDOM();
  else return this.getPageDOM();
}


//////////////////////////////////////////////////////////////////////////////
// Create DOM for Page tab
//////////////////////////////////////////////////////////////////////////////

Page.prototype.getPageDOM = function() {
  function appendLink(o, node) {
    var aE = e("a", { href: "#" }, node);
    aE.onclick = function() { goToEntity(o[0], o[1]); return false; }
    if(o[0] == currentPage.no) t(currentPage.model[o[1]].name, aE);
    else t(ex.global.names[o[0]+","+o[1]], aE);
  }

  function appendXName(o, node) {
    var spanE = e("span", null, node);
    $(spanE).append(o._xname);
    $("a", spanE).each(function(idx) {
      this.href = "##";
      this.onclick = function() { goToEntity(o._refs[idx][0], o._refs[idx][1]); return false; }
    });
  }

  function appendFlags(e, node) {
    if(e.isProtected || !e.isPublic) {
      //--
      if(!e.visibleIn) {
        t(e.isProtected ? "protected[this] " : "private[this] ", node);
      } else if(e.visibleIn.length == 2 && e.inTemplate && e.inTemplate.length == 2) {
        if(e.visibleIn[0] == e.inTemplate[0] && e.visibleIn[1] == e.inTemplate[1]) {
          t(e.isProtected ? "protected " : "private ", node);
        } else {
          t(e.isProtected ? "protected[" : "private[");
          appendLink(e.visibleIn, node);
          t("]", node);
        }
      } else {
        ex.log("Cannot determine visibility for "+e);
        t(e.isProtected ? "protected[?] " : "private[?] ", node);
      }
    }
    var s = "";
    if(e.isImplicit) s += "implicit ";
    if(e.isSealed) s += "sealed ";
    if(e.isAbstract) s += "abstract ";
    if(e.isFinal) s += "final ";
    if(e.isAliasType || e.isAbstractType) s += "type ";
    else if(e.isCaseClass) s += "case class ";
    else if(e.isClass) s += "class ";
    else if(e.isTrait) s += "trait ";
    else if(e.isObject) s += "object ";
    else if(e.isPackage) s += "package ";
    else if(e.isVar) s += "var ";
    else if(e.isLazyVal) s += "lazy val ";
    else if(e.isVal) s += "val ";
    else if(e.isDef) s += "def ";
    if(s) t(s, node);
  }

  function createPageDOM(model, o) {
    var divE = e("div");
    var titleDivE = e("div", { "class": "title" }, divE);
    appendFlags(o, titleDivE);
    t(o.name, titleDivE);
    if(o.parentType) {
      t(" extends ", titleDivE);
      appendXName(o.parentType, titleDivE);
    }
    return divE;
  }

  function createPackagePageDOM(model) {
    return t("Package pages not implemented yet.");
  }

  if(this.pageDOM) return this.pageDOM;
  this.pageDOM = this.model[0].isPackage ? createPackagePageDOM(this.model) : createPageDOM(this.model, this.model[0]);
  return this.pageDOM;
}


//////////////////////////////////////////////////////////////////////////////
// Create DOM for Model tab
//////////////////////////////////////////////////////////////////////////////

Page.prototype.getModelDOM = function() {
  function createObjectDOM(o, no) {
    var tableE = e("table", { "class": "object", cellspacing: 0, cellpadding: 0 });
    var tbodyE = e("tbody", null, tableE);
    if(o._isEntity) {
      var trE = e("tr", null, tbodyE);
      var thE = e("th", { colspan: 2, "class": "entityhead" }, trE);
      t(o.name, e("span", null, thE));
      t(o.qName || "", thE);
    }
    var is = null;
    if(o._isEntity) {
      for(var k in o) {
        if(o.hasOwnProperty(k) && k.match(/^is/))
          if(is) is += ", "+k.substring(2); else is = k.substring(2);
      }
    }
    if(is) {
      var trE = e("tr", null, tbodyE);
      t("is...", e("th", null, trE));
      t(is, e("td", null, trE));
    }
    for(var k in o) {
      if(!o.hasOwnProperty(k) || o._isEntity &&
        (k[0] === "_" || k === "qName" || k === "name" || k.match(/^is/))) continue;
      var trE = e("tr", null, tbodyE);
      var thE = e("th", null, trE);
      var tdE = e("td", null, trE);
      t(k, thE);
      if(k == "sourceUrl") e("a", { href: o[k] }, tdE).
        appendChild(t("..."+o[k].substring(ex.global.settings.docsourceurl.length)));
      else tdE.appendChild(createChildDOM(o[k]));
    }
    return tableE;
  }

  function createChildDOM(o) {
    var tp = typeof(o);
    if(tp == "string") return t(o);
    else if(tp == "number") return t(o);
    else if(tp == "boolean") return t(o);
    else if(o._isLink) {
      var spanE = e("span");
      var aE = e("a", { href: "#" }, spanE);
      aE.onclick = function() { goToEntity(o[0], o[1]); return false; }
      if(o[0] == currentPage.no) t(currentPage.model[o[1]].name, aE);
      else t(ex.global.names[o[0]+","+o[1]], aE);
      t((o[0] == currentPage.no ? "\u2192 " : "\u2197 ")+o[0]+", "+o[1], e("span", { "class": "entityno" }, spanE));
      return spanE;
    }
    else if(o.hasOwnProperty("length")) {
      if(o.length > 0) {
        var olE = e("ol", { start: 0, "class": "array" });
        for(var i=0; i<o.length; i++) {
          var liE = e("li", null, olE);
          liE.appendChild(createChildDOM(o[i]));
        }
        return olE;
      }
      else return t("[]");
    }
    else if(o.hasOwnProperty("_html")) {
      var divE = e("div", { "class": "html" });
      $(divE).append(o._html);
      return divE;
    }
    else if(o.hasOwnProperty("_xname")) {
      var spanE = e("span");
      $(spanE).append(o._xname);
      $("a", spanE).each(function(idx) {
        this.href = "##";
        this.onclick = function() { goToEntity(o._refs[idx][0], o._refs[idx][1]); return false; }
      });
      return spanE;
    }
    else return createObjectDOM(o);
  }

  function createModelDOM(page) {
    var divE = e("div");
    t("p"+page._no+".json: "+(page.length == 1 ? "1 entity, " : (page.length+" entities, "))+
      (page._bytes/1024).toFixed(0)+" kB (+ "+(ex.global._bytes/1024).toFixed(0)+" kB global)", e("h1", null, divE));
    var olE = e("ol", { "class": "page", start: 0 }, divE);
    for(var i=0; i<page.length; i++) {
      var liE = e("li", null, olE);
      liE.appendChild(createObjectDOM(page[i], i));
    }
    return divE;
  };

  if(this.modelDOM) return this.modelDOM;
  this.modelDOM = createModelDOM(this.model);
  return this.modelDOM;
};


//////////////////////////////////////////////////////////////////////////////
// Create DOM for Source tab
//////////////////////////////////////////////////////////////////////////////

Page.prototype.getSourceDOM = function() {
  var o = this.model[0];
  function createSourceDOM() {
    if(!ex.global.settings.docsourceurl) {
      var divE = e("div", { id: "nosource" });
      t("No source location defined for this doc site.", e("p", null, divE));
      Tab["source"].setLoading(false);
      return divE;
    }
    if(!o.sourceUrl) {
      var divE = e("div", { id: "nosource" });
      t("No source location defined for "+o.qName+".", e("p", null, divE));
      var pE = e("p", null, divE);
      t("The base location for sources is ", pE);
      t(ex.global.settings.docsourceurl, e("a", { href: ex.global.settings.docsourceurl }, pE));
      t(".", pE);
      Tab["source"].setLoading(false);
      return divE;
    }
    var browserE = e("div", { "class": "browser" });
    var browserHeadE = e("tr", null, e("table", { "class": "head", cellpadding: 0, cellspacing: 0 }, browserE));
    var thE = e("th", null, browserHeadE);
    t("Location:", e("a", { href: o.sourceUrl, target: "_blank", title: "Open in New Window" }, thE));
    e("input", { type: "text", value: o.sourceUrl, readonly: true }, e("td", { width: "100%" }, browserHeadE));
    var browserBodyE = e("div", { "class": "body" }, browserE);
    var iframeE = e("iframe", { src: o.sourceUrl }, browserBodyE);
    $(iframeE).load(function(e) {
      Tab["source"].setLoading(false);
    });
    return browserE;
  }

  if(o.sourceUrl && o.sourceUrl == currentSourceUrl) {
    Tab["source"].setLoading(false);
    return null;
  }
  if(this.sourceDOM) {
    Tab["source"].setLoading(false);
    return this.sourceDOM;
  }
  this.sourceDOM = createSourceDOM();
  currentSourceUrl = o.sourceUrl;
  return this.sourceDOM;
}


//////////////////////////////////////////////////////////////////////////////
// Main program
//////////////////////////////////////////////////////////////////////////////

function goToEntity(page, entity, view) {
  if(!page && page !== 0) page = currentPage ? currentPage.no : 0;
  if(!entity && entity !== 0) entity = currentEntity;
  if(!view) view = View.currentID;
  var params = { t: ex.global.pageToPageInfo[page].qn };
  if(entity && entity != -1) params.e = entity;
  if(view && view != View.defaultView) params.v = view;
  $.history.load(encodeHash(params));
}

function loadPage(no, entity, view) {
  function ok(page) {
    currentPage = page;
    View[view].show(page.getDOM(view), no+","+entity);
    View.scrollToEntity(entity);
    if(view != "source") Tab[view].setLoading(false);
  }
  var cached = pageCache.getItem("p"+no);
  if(cached) View.showMessage("Rendering page "+no+"...");
  else View.showMessage("Loading and rendering page "+no+"...");
  setTimeout(function() {
    if(cached) ok(cached);
    else {
      var t0 = (new Date).getTime();
      ex.load(no, function(model) {
          log("Loaded and prepared page with "+model.length+" entities in "+((new Date).getTime()-t0)+"ms");
          t0 = (new Date).getTime();
          var page = new Page(model);
          pageCache.setItem("p"+no, page);
          ok(page);
          log("Rendered in "+((new Date).getTime()-t0)+"ms");
        }, function(XMLHttpRequest, textStatus, errorThrown) {
          var errmsg = "Error loading page: "+textStatus+"; "+errorThrown;
          log(errmsg);
          View.showMessage(errmsg);
        });
    }
  }, 0);
}

function showEntity(params) {
  var page = 0;
  if(params.hasOwnProperty("p")) {
    page = parseInt(params.p);
  } else if(params.hasOwnProperty("t")) {
    page = (ex.global.qnToPageInfo[params.t] || {p:0}).p;
  }
  var entity = params.e || -1;
  var view = params.v;
  if(!view) view = View.defaultView;
  log("Showing page "+page+", entity "+entity+", view "+view);
  Tab[view].show();
  showTitle(page);
  if(View[view].isShowing(page+","+entity)) View[view].show();
  else if(currentPage && page == currentPage.no && View.currentID == view) {
    View[view].show();
    View.scrollToEntity(entity);
  }
  else {
    Tab[view].setLoading(true);
    loadPage(page, entity, view);
  }
  markNavigationPage(page);
}

$(function() {

  log("Extradoc Explorer starting");

  new View("page");
  new View("model");
  new View("source");
  new View("msg");

  new Tab("page");
  new Tab("model");
  new Tab("source");
  Tab.loader = $("#loader img");

  var navigation = $("#navigation");
  var contentJ = $("#content");

  var inClick = false;
  var rememberedPos = 300;
  var separator = $("#separator").draggable({
    axis: "x",
    containment: "parent",
    cursor: "e-resize",
    snap: "body",
    drag: function(event, ui) {
      var pos = ui.position.left;
      syncSeparator(pos);
      inClick = false;
      if(pos > 20) rememberedPos = pos;
    }
  });
  var separatorDiv = $("div", separator);
  var sepBorderColor = separator.css("border-left-color");
  var sepHandleColor = separatorDiv.css("background-color");
  function syncSeparator(pos) {
    navigation.css("width", pos);
    contentJ.css("left", pos+1);
    separator.css("border-left-color", pos ? sepBorderColor : "transparent");
    separatorDiv.css("border-left-color", pos ? sepBorderColor : sepHandleColor);
  }
  separatorDiv.mousedown(function() {
    inClick = true;
    return true;
  }).click(function() {
    if(!inClick) return false;
    inClick = false;
    var pos = separator.css("left") !== "0px" ? 0 : rememberedPos;
    separator.css("left", pos);
    syncSeparator(pos);
  });

  function globalReady(global) {
    if(global.settings.doctitle) {
      baseTitle = global.settings.doctitle;
      if(global.settings.docversion) baseTitle += " " + global.settings.docversion;
    }
    navigation.empty().append(createNavigationDOM());
    $("#tabs td.tab").each(function() {
      var view = this.id.replace(/^tab_/, "");
      this.onclick = function() { goToEntity(null, null, view); return false; };
    });
    Tab.loader.css("display", "none");
    $.history.init(function(hash) { showEntity(decodeHash(hash)); }, { unescape: true });
    var aE = e("a", { href: "#" }, $("#leftTitle")[0]);
    aE.onclick = function() { goToEntity(0, -1, View.defaultView); return false; }
    t(baseTitle, aE);
  }

  navigation.empty().append("Loading navigation...");
  ex.loadGlobal(globalReady, function(XMLHttpRequest, textStatus, errorThrown) {
      var errmsg = "Error loading navigation: "+textStatus+"; "+errorThrown;
      log(errmsg);
      navigation.empty().append(errmsg);
    });
});
