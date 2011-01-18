var ex = window.extradoc;
var baseTitle = "Extradoc Explorer";
var currentPage;
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
View.defaultView = "page";

View.scrollToEntity = function(entity) {
  var view = View[View.currentID];
  var pos = 0;
  if(entity > 0) {
    var epos = $($("#content_model > div > table")[entity]).position();
    if(epos) {
      pos = epos.top;
      pos += view.contentJ.scrollTop();
    }
  }
  view.contentJ.scrollTop(pos);
};

View.showMessage = function(msg) { View.msg.show(t(msg)); };

View.withMessage = function(msg, cont) {
  View.showMessage(msg);
  setTimeout(cont, 0);
};

View.prototype.show = function(node, showing) {
  if(node) this.contentJ.empty().append(node);
  if(showing) this.showing = showing;
  if(View.currentID == this.id) return;
  //View[View.currentID].contentJ.data("saved", $(":first", View[View.currentID].contentJ).detach());
  View[View.currentID].contentJ.css("visibility", "hidden");
  View.currentID = this.id;
  //if(node) this.contentJ.data("saved", null);
  //else this.contentJ.empty().append(this.contentJ.data("saved"));
  this.contentJ.css("visibility", "visible");
};

View.prototype.isShowing = function(showing) { return this.showing && this.showing == showing; };


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

function generateID(base) {
  var cur = generateID.next || 0;
  generateID.next = cur + 1;
  return (base || "unique") + "_" + cur;
}

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
  if(!hash) return params;
  var parts = hash.replace(/^!/, "").split("&");
  for(var i=0; i<parts.length; i++) {
    var kv = parts[i].split("=");
    if(kv.length == 2) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
  }
  return params;
}

function encodeHash(params) {
  var hash = "";
  for(var k in params) {
    if(params.hasOwnProperty(k)) {
      if(hash.length) hash += "&"
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

function loadAuxModels(nos, done) {
  var o = { nos: nos, errors: [], loaded: 0, toLoad: 0, total: nos.length };
  for(var i=0; i<o.total; i++) {
    var no = nos[i];
    var cached = pageCache.getItem("p"+no);
    if(cached) o[no] = cached.model;
    else o.toLoad++;
  }
  function then() {
    if(o.loaded == o.toLoad) {
      var count = 0;
      for(var j=0; j<o.total; j++) if(o[nos[j]]) count += o[nos[j]].length;
      log("Loaded and prepared "+o.total+" aux models with "+count+" entities in "+((new Date).getTime()-t0)+"ms");
      done(o);
    }
  }
  function loadOne(no) {
    ex.load(no, function(model) {
        var page = new Page(model);
        pageCache.setItem("p"+no, page);
        o.loaded++;
        o[no] = page.model;
        then();
      }, function(XMLHttpRequest, textStatus, errorThrown) {
        var msg = textStatus+"; "+errorThrown;
        log(msg);
        o.loaded++;
        o.errors[o.errors.length] = msg;
        then();
      });
  };
  if(o.toLoad == 0) done(o);
  else {
    log("Loading "+o.toLoad+" aux models, "+(o.total-o.toLoad)+" already cached");
    var t0 = (new Date).getTime();
    for(var i=0; i<o.total; i++) if(!o[nos[i]]) loadOne(nos[i]);
  }
}

function loadScript(url, cont) {
  if(loadScript.loaded[url]) { cont(); return; }
  var callbacks = loadScript.callbacks[url] || (loadScript.callbacks[url] = []);
  callbacks.push(cont);
  if(loadScript.loading[url]) return;
  loadScript.loading[url] = true;
  log("Loading script "+url+"...");
  var script = e("script", { "type": "text/javascript", "src": url });
  script.onload = script.onreadystatechange = function() {
    if(!loadScript.loaded[url] && (!this.readyState || this.readyState == "loaded" || this.readyState == "complete")) {
      loadScript.loaded[url] = true;
      var callbacks2 = loadScript.callbacks[url];
      if(callbacks2)
        for(var i=0; i<callbacks2.length; i++) callbacks2[i]();
      delete loadScript.callbacks[url];
    }
  };
  $("head")[0].appendChild(script);
}
loadScript.loaded = {};
loadScript.loading = {};
loadScript.callbacks = {};

function loadScripts(urls, cont) {
  var num = urls.length, count = 0;
  function f() {
    if(++count === num) cont();
  }
  for(var i=0; i<num; i++) loadScript(urls[i], f);
}


//////////////////////////////////////////////////////////////////////////////
// Create DOM for navigation area
//////////////////////////////////////////////////////////////////////////////

var navigationPages = [];
var selectedNavigationPage = null;

function createNavigationDOM() {
  var packages = ex.global.packages;
  var divE = e("div");
  var ulE = e("ul", { "class": "packages" }, divE);
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
  return divE;
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

Page.prototype.hasDOM = function(view) {
  if(view == "model") return !!this.modelDOM;
  else if(view == "source") return !!this.sourceDOM;
  else return !!this.pageDOM;
};

Page.prototype.createOrGetDOM = function(view, cont) {
  if(view == "model") this.createOrGetModelDOM(cont);
  else if(view == "source") this.createOrGetSourceDOM(cont);
  else this.createOrGetPageDOM(cont);
};

Page.prototype.loadDependencies = function(cont) {
  var that = this;
  var base = this.model[0], pagesNeeded = [], seen = {};
  if(base.linearization) {
    for(var i=0; i<base.linearization.length; i++) {
      var lin = base.linearization[i];
      if(typeof lin === "object" && lin.hasOwnProperty("length") && lin[0] != this.model._no && !seen[lin[0]]) {
        seen[lin[0]] = true;
        pagesNeeded[pagesNeeded.length] = lin[0];
      }
    }
  }
  if(pagesNeeded.length) View.showMessage("Loading "+pagesNeeded.length+" additional models...");
  loadAuxModels(pagesNeeded, function(aux) {
    that.models = aux;
    aux[that.no] = that.model;
    cont();
  });
};

Page.prototype.removeDependencies = function() { /*delete this.models;*/ };

Page.prototype.resolve = function(o) {
  if(!o._isLink) return o;
  var a = this.models[o[0]];
  return a && a[o[1]] || o;
};

Page.prototype.nameFor = function(o) {
  if(o._isLink) {
    if(o[0] == this.no) return this.model[o[1]].name;
    var n = ex.global.names[o[0]+","+o[1]]
    if(n) return n;
    var m = this.models[o[0]];
    return m ? m[o[1]].name : null;
  } else return o.name;
};

Page.prototype.kindMarkerFor = function(o) {
  function from(o) {
    if(!o) return null;
    if(o.isClass) return "c";
    if(o.isObject) return "b";
    if(o.isTrait) return "t";
    if(o.isPackage) return "p";
    return null;
  }
  if(o._isLink) {
    if(o[0] == this.no) return from(this.model[o[1]]);
    var n = ex.global.kinds[o[0]+","+o[1]]
    if(n) return n;
    var m = this.models[o[0]];
    return m ? from(m[o[1]]) : null;
  } else return from(o);
};


//////////////////////////////////////////////////////////////////////////////
// Create DOM for Page tab
//////////////////////////////////////////////////////////////////////////////

Page.prototype.createOrGetPageDOM = function(cont) {
  var that = this;

  function appendLink(o, node) {
    var aE = e("a", { href: "#" }, node);
    aE.onclick = function() { goToEntity(o[0], o[1]); return false; }
    t(that.nameFor(o), aE);
  }

  function appendXName(o, node) {
    var spanE = e("span", null, node);
    $(spanE).append(o._xname);
    $("a", spanE).each(function(idx) {
      this.href = "##";
      this.onclick = function() { goToEntity(o._refs[idx][0], o._refs[idx][1]); return false; }
    });
  }

  function appendFlags(o, node, novis, spanCls) {
    var _cachedE;
    function getE() {
      if(!_cachedE) _cachedE = spanCls ? e("span", { "class": spanCls }, node) : node;
      return _cachedE;
    }
    if(o.isUseCase) t("Use Case: ", getE());
    if(!novis && (o.isProtected || !o.isPublic)) {
      //--
      if(!o.visibleIn) {
        t(o.isProtected ? "protected[this] " : "private[this] ", getE());
      } else if(o.visibleIn._isLink && o.inTemplate && o.inTemplate._isLink) {
        if(o.visibleIn[0] == o.inTemplate[0] && o.visibleIn[1] == o.inTemplate[1]) {
          t(o.isProtected ? "protected " : "private ", getE());
        } else {
          t(o.isProtected ? "protected[" : "private[");
          appendLink(o.visibleIn, getE());
          t("]", getE());
        }
      } else {
        log("Cannot determine visibility for "+o.name);
        t(o.isProtected ? "protected[?] " : "private[?] ", getE());
      }
    }
    var s = "";
    if(o.isImplicit) s += "implicit ";
    if(o.isSealed) s += "sealed ";
    if(o.isAbstract) s += "abstract ";
    if(o.isFinal) s += "final ";
    if(o.isAliasType || o.isAbstractType) s += "type ";
    else if(o.isCaseClass) s += "case class ";
    else if(o.isClass) s += "class ";
    else if(o.isTrait) s += "trait ";
    else if(o.isObject) s += "object ";
    else if(o.isPackage) s += "package ";
    else if(o.isVar) s += "var ";
    else if(o.isLazyVal) s += "lazy val ";
    else if(o.isVal) s += "val ";
    else if(o.isDef) s += "def ";
    if(s) t(s, getE());
  }

  function appendTypeParams(tps, node) {
    t("[", node);
    for(var i=0; i<tps.length; i++) {
      if(i != 0) t(", ", node);
      appendTypeParam(tps[i], node);
    }
    t("]", node);
  }

  function appendTypeParam(tp, node) {
    if(typeof tp === "string") t(tp, node);
    else {
      tp = that.resolve(tp);
      t(tp.variance ? tp.variance + tp.name : tp.name, node);
      if(tp.lo) {
        t(" >: ", node);
        appendXName(tp.lo, node);
      }
      if(tp.hi) {
        t(" <: ", node);
        appendXName(tp.hi, node);
      }
    }
  }

  function appendValueParams(vps, node) {
    for(var i=0; i<vps.length; i++) {
      t(i == 0 ? "(" : " (", node);
      var a = vps[i];
      for(var j=0; j<a.length; j++) {
        if(j != 0) t(", ", node);
        appendValueParam(a[j], node);
      }
      t(")", node);
    }
  }

  function appendValueParam(vp, node) {
    if(typeof vp === "string") t(vp, node);
    else {
      vp = that.resolve(vp);
      appendFlags(vp, node, true, "flags");
      t(vp.name, node);
      if(vp.resultType) {
        t(": ", node);
        appendHTML(vp.resultType, "span", node);
      }
    }
  }

  function appendHTML(o, elName, node, params) {
    var cls = params && params.cls;
    if(o._xname) {
      var el = e(elName, { "class": cls ? "xname " + cls : "xname" }, node);
      appendXName(o, el);
    } else if(o._isLink) {
      var el = e(elName, { "class": cls ? "link " + cls : "link" }, node);
      var aE = e("a", { href: "#" }, el);
      aE.onclick = function() { goToEntity(o[0], o[1]); return false; };
      t(that.nameFor(o), aE);
    } else if(typeof o === "string") {
      t(o, e(elName, { "class" : cls ? "text " + cls : "text" }, node));
    } else {
      var el = $(e(elName, { "class": cls ? "html " + cls : "html" }, node));
      el.append(o._html.trim()); //TODO Hook up links
      $("pre:empty", el).remove();
      el.children().first().css("margin-top", 0);
      el.children().last().css("margin-bottom", 0);
    }
  }

  function appendDefLine(name, o, tbl, params) {
    if(!o && o !== "") return;
    var sep = params && params.sep;
    function mkTr() { return e("tr", params && params.cls ? { "class" : params.cls } : null, tbl); }
    if(typeof o.length === "number" && !o._isLink && typeof o !== "string") {
      if(sep) {
        var trE = mkTr();
        t(name, e("th", null, trE));
        var tdE = e("td", null, trE);
        for(var i=0; i<o.length; i++) {
          if(i != 0) t(sep, tdE);
          appendHTML(o[i], "span", tdE);
        }
      } else {
        for(var i=0; i<o.length; i++) {
          var trE = mkTr();
          if(i == 0) t(name, e("th", { rowspan: o.length }, trE));
          appendHTML(o[i], "td", trE);
        }
      }
    } else {
      var trE = mkTr();
      t(name, e("th", null, trE));
      appendHTML(o, "td", trE);
    }
  }

  function appendDefTable(node, expand, cls) {
    var tableE = e("table", { "class": cls ? ("deftable "+cls) : "deftable", cellpadding: 0, cellspacing: 0 });
    expand(tableE);
    if($(tableE).children().length > 0) {
      if(node) node.appendChild(tableE);
      return tableE;
    }
    return null;
  }

  function appendSection(name, node, expand, expanded, cls) {
    if(!expand) return null;
    if(typeof expand !== "function") {
      var expE = expand;
      expand = function(sectE) { $(sectE).append(expE); };
    }
    if(!name) expanded = true;
    var sectCls = "section";
    if(expanded) sectCls += " visible";
    if(cls) sectCls += " " + cls;
    var sectE = e("div", { "class": sectCls }, node);
    var sectJ = $(sectE);
    var hdE;
    if(name) {
      hdE = e("div", { "class": "sectionhd" }, sectE);
      t("\u25B6", e("span", { "class": "hidden" }, hdE));
      t("\u25BC", e("span", { "class": "visible" }, hdE));
      t(name, hdE);
    }
    var bodyE = e("div", { "class": "sectionbody" }, sectE);
    if(name) hdE.onclick = function() {
      sectJ.toggleClass("visible");
      if(!expanded) {
        expanded = true;
        expand(bodyE);
      }
    };
    if(expanded) expand(bodyE);
    return sectE;
  }

  function appendMember(o, node) {
    var nodeJ = $(node);
    var expanded = false;
    if(expanded) nodeJ.addClass("expanded");
    function expand(node) {
      var longE = e("div", { "class": "long" }, node);
      if(comment.body || comment.short) appendHTML(comment.body || comment.short, "span", longE);
      appendParametersSection(o, longE);
    };
    var hdE = e("div", { "class": "memberhd" }, node);
    var hE = e("h4", null, hdE);
    t("\u25B6", e("span", { "class": "hidden" }, hE));
    t("\u25BC", e("span", { "class": "visible" }, hE));
    appendFlags(o, hE, null, "flags");
    t(o.name+" ", e("span", { "class": "etitle" }, hE));
    if(o.typeParams) {
      appendTypeParams(o.typeParams, hE);
      t(" ", hE);
    }
    if(o.valueParams) appendValueParams(o.valueParams, hE);
    if(o.resultType) {
      t(": ", hE);
      appendHTML(o.resultType, "span", hE);
    }
    var comment = o.comment || (o.commentIn ? that.resolve(o.commentIn).comment : null) || {};
    var shortE = e("div", { "class": "short" }, hdE);
    if(comment.short) appendHTML(comment.short, "span", shortE);
    hdE.onclick = function() {
      nodeJ.toggleClass("expanded");
      if(!expanded) {
        expanded = true;
        expand(node);
      }
    };
    if(expanded) expand(node);
  }

  function appendMemberSection(name, data, node, expanded) {
    if(!data || !data.length) return;
    appendSection(name, node, function(bodyE) {
      for(var i=0; i<data.length; i++) {
        var item = that.resolve(data[i]);
        var itemE = e("div", i == 0 ? { "class": "first" } : null, bodyE);
        appendMember(item, itemE);
      }
    }, expanded, "defs");
  }

  function appendDiagramSection(name, node, f) {
    appendSection(name, node, function(bodyE) {
      var loadingE = e("div", { "class": "loading" }, bodyE);
      t("Loading diagram...", loadingE);
      var scripts = $.browser.msie ? ["js/excanvas.js", "js/jit.js", "js/diagrams.js"] : ["js/jit.js", "js/diagrams.js"];
      loadScripts(scripts, function() {
        $(loadingE).remove();
        //var diagParentE = e("div", null, bodyE);
        var diagJ = $(e("div", { "id": generateID("diagram"), "class": "diagrambody" }, bodyE));
        //diagJ.css("width", diagJ.attr("clientWidth") + "px");
        diagJ.css("width", (screen.width-50) + "px");
        var docE = e("div", { "class": "diagramdoc", title: "Drag diagram to pan, click node to go to template" }, diagJ[0]);
        t("?", docE);
        f(diagJ);
      });
    }, false, "diagram");
  }

  function appendParametersSection(o, node, all) {
    if(!o) return;
    function f(a, cls, tbE) {
      for(var i=0; i<a.length; i++) {
        var p = that.resolve(a[i]);
        if(typeof p === "string") {
          if(all) appendDefLine(p, "", tbE, { cls: cls });
        } else if(p.doc || all) {
          appendDefLine(p.name, p.doc || "", tbE, { cls: cls });
        }
      }
    }
    appendDefTable(node, function(tbE) {
      if(o.typeParams) f(o.typeParams, "t", tbE);
      if(o.valueParams) {
        for(var i=0; i<o.valueParams.length; i++)
          f(o.valueParams[i], "v", tbE);
      }
      var comment = o.comment || (o.commentIn ? that.resolve(o.commentIn).comment : null);
      if(comment) {
        if(comment.result) appendDefLine("Result", comment.result, tbE);
        if(comment.example)
          for(var i=0; i<comment.example.length; i++) appendDefLine("Example", comment.example[i], tbE);
        if(comment.see)
          for(var i=0; i<comment.see.length; i++) appendDefLine("See", comment.see[i], tbE);
      }
    }, "params");
  }

  function createPageDOM(o) {
    var divE = e("div", { "id": "page" });
    var comment = o.comment || (o.commentIn ? that.resolve(o.commentIn).comment : null) || {};
    // Template signature line
    var titleDivE = e("div", { "id": "pgtitle" }, divE);
    if(o.companion) {
      var leftKind = o.isObject ? (that.kindMarkerFor(o.companion) == "t" ? "trait" : "class") : o.isTrait ? "trait" : "class";
      var switchE = e("span", { "class": "switch" }, e("span", { "class": "companion_switch" }, titleDivE));
      var leftE = e("span", { "class" : o.isObject ? "left" : "left selected" }, switchE);
      t(leftKind, leftE);
      var rightE = e("span", { "class" : o.isObject ? "right selected" : "right" }, switchE);
      t("object", rightE);
      var companionE = o.isObject ? leftE : rightE;
      companionE.title = "Go to companion " + (o.isObject ? leftKind : "object") + " " + o.qName;
      companionE.onclick = function() { goToEntity(o.companion[0], o.companion[1]); return false; };
    }
    appendFlags(o, titleDivE);
    t(o.name, e("span", { "class": "etitle" }, titleDivE));
    if(o.typeParams) appendTypeParams(o.typeParams, titleDivE);
    if(o.parentType) {
      var extE = e("span", { "class": "extends" }, titleDivE);
      t(" extends ", extE);
      appendXName(o.parentType, extE);
    }
    t(" ", titleDivE);
    var bodyDivE = e("div", { "id": "pgbody" }, divE);
    // Main doc comment
    var doc = comment ? (comment.body || comment["short"]) : null;
    if(doc) appendHTML(doc, "div", bodyDivE);
    // Type parameters
    appendParametersSection(o, bodyDivE);
    // Attributes
    appendSection(null, bodyDivE, appendDefTable(null, function(tbE) {
      if(comment) {
        appendDefLine("Version", comment.version, tbE);
        appendDefLine("Since", comment.since, tbE);
        if(comment.authors)
          appendDefLine(comment.authors.length == 1 ? "Author" : "Authors", comment.authors, tbE);
      }
      //appendDefLine("Companion", o.companion, tbE);
      appendDefLine("Subtypes", o.subClasses, tbE, { sep: ", " });
      appendDefLine("Linearization", o.linearization, tbE, { sep: ", " });
    }));

    // Diagram sections
    if(o.linearization || o.subClasses) {
      appendDiagramSection("Diagram: Linearization and Subtypes", bodyDivE, function(diagJ) {
        createClassDiagram(diagJ, that, o);
      });
    }

    // Member sections
    appendMemberSection("Members", o.members, divE, true);

    that.pageDOM = divE;
    cont(that.pageDOM);
  }

  if(this.pageDOM) cont(this.pageDOM);
  else this.loadDependencies(function() {
    View.withMessage("Creating view...", function() {
      createPageDOM(that.model[0]);
      that.removeDependencies();
    });
  });
}


//////////////////////////////////////////////////////////////////////////////
// Create DOM for Model tab
//////////////////////////////////////////////////////////////////////////////

Page.prototype.createOrGetModelDOM = function(cont) {
  var that = this;

  function createObjectDOM(o, no) {
    var tableE = e("table", { "class": "object", cellspacing: 0, cellpadding: 0 });
    var tbodyE = e("tbody", null, tableE);
    if(o._isEntity) {
      var trE = e("tr", null, tbodyE);
      var thE = e("th", { colspan: 2, "class": "entityhead" }, trE);
      var thSpanE = e("span", null, thE);
      if(no || no === 0) t(no+"", e("span", null, thSpanE));
      t(o.name, thSpanE);
      if(o.qName && o.qName !== o.name) t(o.qName, thE);
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
      aE.onclick = function() { goToEntity(o[0], o[1]); return false; };
      t(that.nameFor(o), aE);
      t((o[0] == that.no ? "\u2192 " : "\u2197 ")+o[0]+", "+o[1], e("span", { "class": "entityno" }, spanE));
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
      var divJ = $(divE);
      divJ.append(o._html);
      divJ.children().first().css("margin-top", 0);
      divJ.children().last().css("margin-bottom", 0);
      //TODO Hook up links
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
    for(var i=0; i<page.length; i++) divE.appendChild(createObjectDOM(page[i], i));
    that.modelDOM = divE;
    cont(divE);
  };

  if(this.modelDOM) cont(this.modelDOM);
  else this.loadDependencies(function() {
    View.withMessage("Creating view...", function() {
      createModelDOM(that.model);
      that.removeDependencies();
    });
  });
};


//////////////////////////////////////////////////////////////////////////////
// Create DOM for Source tab
//////////////////////////////////////////////////////////////////////////////

Page.prototype.createOrGetSourceDOM = function(cont) {
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

  if(o.sourceUrl && o.sourceUrl == this.currentSourceUrl) {
    Tab["source"].setLoading(false);
    cont(null);
  } else if(this.sourceDOM) {
    Tab["source"].setLoading(false);
    cont(this.sourceDOM);
  } else {
    this.sourceDOM = createSourceDOM();
    this.currentSourceUrl = o.sourceUrl;
    cont(this.sourceDOM);
  }
}


//////////////////////////////////////////////////////////////////////////////
// Main program
//////////////////////////////////////////////////////////////////////////////

function goToEntity(page, entity, view) {
  if(!page && page !== 0) page = currentPage ? currentPage.no : 0;
  if(!entity) entity = 0;
  if(!view) view = View.currentID;
  var params = { t: ex.global.pageToPageInfo[page].qn };
  if(entity && entity != -1) params.e = entity;
  if(view && view != View.defaultView) params.v = view;
  $.history.load(encodeHash(params));
}

function loadPage(no, entity, view) {
  function ok(page) {
    currentPage = page;
    page.createOrGetDOM(view, function(dom) {
      View[view].show(dom, no+","+entity);
      View.scrollToEntity(entity);
      if(view != "source") Tab[view].setLoading(false);
    });
  }
  var cached = pageCache.getItem("p"+no);
  View.withMessage((cached ? "Rendering page " : "Loading and rendering page ")+no+"...", function() {
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
  });
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
    View[view].show(null, page+","+entity);
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
  new View("page"); new View("model"); new View("source"); new View("msg");
  new Tab("page"); new Tab("model"); new Tab("source"); Tab.loader = $("#loader img");
  var sidebar = $("#sidebar"), navigation = $("#navigation"), contentJ = $("#content");
  var searchHelp = $("#search_help");
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
    if($.browser.msie)
      sidebar.css("overflow", pos > 0 ? "auto" : "hidden"); // IE8 does not hide scrollbars otherwise
    sidebar.css("width", pos);
    contentJ.css("left", pos+1);
    searchHelp.css("left", pos-27);
    separator.css("border-left-color", pos ? sepBorderColor : "transparent");
    separatorDiv.css("border-left-color", pos ? sepBorderColor : sepHandleColor);
  }
  function toggleSidebar() {
    var pos = separator.css("left") !== "0px" ? 0 : rememberedPos;
    separator.css("left", pos);
    syncSeparator(pos);
  };
  separatorDiv.mousedown(function() {
    inClick = true;
    return true;
  }).click(function() {
    if(!inClick) return false;
    inClick = false;
    toggleSidebar();
  });
  function performSearch(query) {
    log('TODO: Perform search for "'+query+'"');
  }
  var searchInput = $("#search"), searchTable = $("#search_area table");
  searchInput.focus(function() {
    searchTable.toggleClass("active", true);
    sidebar.scrollTop(0);
    searchHelp.show();
  });
  searchInput.blur(function() {
    searchTable.toggleClass("active", false);
    searchHelp.hide();
  });
  $("html").keypress(function(e) {
    if(e.srcElement && e.srcElement.nodeName === "INPUT") return true;
    if(e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return true;
    switch(e.charCode || e.keyCode) {
      case 102: // f
        if(separator.attr("offsetLeft") < 200) {
          var pos = rememberedPos > 200 ? rememberedPos : 200;
          separator.css("left", pos);
          syncSeparator(pos);
        }
        searchInput.focus();
        return false;
      case 110: // n
        toggleSidebar();
        return false;
      case 112: // p
        goToEntity(null, null, "page");
        return false;
      case 109: // m
        goToEntity(null, null, "model");
        return false;
      case 115: // s
        goToEntity(null, null, "source");
        return false;
      case 114: // r
        searchInput.val("");
        performSearch("");
      default:
        return true;
    }
  });
  searchInput.keydown(function(e) {
    if(e.keyCode === 27) {
      searchInput.blur();
      return false;
    } else return true;
  });
  searchInput.keypress(function(e) {
    if(e.keyCode === 13) {
      performSearch(searchInput.val());
      return false;
    } else return true;
  });
  $("#search_reset").click(function() {
    searchInput.val("");
    performSearch("");
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
