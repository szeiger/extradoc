(function(){

var linkKeys = {
  "owner": true,
  "inTemplate": true,
  "companion": true,
  "primaryConstructor": true,
  "typeParams[]": true,
  "inDefinitionTemplates[]": true,
  "inheritedFrom[]": true,
  "parentTemplates[]": true,
  "linearization[]": true,
  "subClasses[]": true,
  "templates[]": true,
  "methods[]": true,
  "values[]": true,
  "abstractTypes[]": true,
  "aliasTypes[]": true,
  "constructors[]": true,
  "packages[]": true,
  "_links[]": true,
  "_refs[]": true,
  "valueParams[][]": true,
  "e": true
};

var mapKeys = { "throws": true, "valueParams": true, "typeParams": true };

function log(msg) {
  if(window.console) console.log(msg);
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

ex = { log: log, currentPage: null };

ex.getEntityName = function(e) {
  if(e.name) return e.name;
  var q = e.qName;
  var sep1 = q.lastIndexOf('#');
  var sep2 = q.lastIndexOf('.');
  var sep = sep2 > sep1 ? sep2 : sep1;
  return q.substring(sep+1);
};

ex.load = function(pageNo, ok, err) {
  $.ajax({
    url: 'p'+pageNo+'.json',
    dataType: 'text',
    success: function(data) {
      eval("window.extradoc.currentPage = "+data);
      ex.resolvePage(ex.currentPage, pageNo);
      ok(ex.currentPage);
    },
    error: err
  });
};

function fireOnEntityLink(o) {
  if(ex.onEntityLink) ex.onEntityLink(o[0], o[1]);
  return false;
}

ex.resolvePage = function(page, pageNo) {
  page._no = pageNo;
  for(var i=0; i<page.length; i++) resolveObject(page[i], null);
  return page;
};

ex.scrollToEntity = function(entity) {
  var pos;
  if(entity >= 0) {
    pos = $($("ol.page > li")[entity]).offset().top-12;
    if(pos < 0) pos = 0;
  } else pos = 0;
  $(window).scrollTop(pos);
};

function resolveObject(o, name) {
  var isMap = !!mapKeys[name];
  if(!isMap) {
    if(o.qName) o._isEntity = true;
    if(o.is) {
      var is = o.is;
      for(var i=0; i<is.length; i++) {
        switch(is.charAt(i)) {
          case 'o': o.isProtected = true; break;
          case 'u': o.isPublic = true; break;
          case 'i': o.isPrivateInInstance = true; break;
          case 'O': o.isProtectedInInstance = true; break;
          case 'e': o.isPrivateInTemplate = true; break;
          case 'E': o.isProtectedInTemplate = true; break;
          case 'p': o.isPackage = true; break;
          case 'r': o.isRootPackage = true; break;
          case 't': o.isTrait = true; break;
          case 'c': o.isClass = true; break;
          case 'b': o.isObject = true; break;
          case 'D': o.isDocTemplate = true; break;
          case 'd': o.isDef = true; break;
          case 'v': o.isVal = true; break;
          case 'l': o.isLazyVal = true; break;
          case 'V': o.isVar = true; break;
          case 'm': o.isImplicit = true; break;
          case 'n': o.isConstructor = true; break;
          case 'a': o.isAliasType = true; break;
          case 'A': o.isAbstractType = true; break;
          case 'M': o.isTemplate = true; break;
          case 'C': o.isCaseClass = true; break;
          case 'U': o.isUseCase = true; break;
          case 'P': o.isPrimary = true; break;
          case 'y': o.isTypeParam = true; break;
          case 'R': o.isValueParam = true; break;
          case 's': o.isSealed = true; break;
          case 'B': o.isAbstract = true; break;
          case 'f': o.isFinal = true; break;
        }
      }
      delete o.is;
    }
  }
  for(var k in o) {
    if(!o.hasOwnProperty(k)) continue;
    var v = o[k];
    var vName = isMap ? name : k;
    var tp = typeof(v);
    if(linkKeys[vName] && (tp === "number" || tp === "object" && v.hasOwnProperty("length"))) {
      if(tp === "number") {
        v = { "0": ex.currentPage._no, "1": v };
        o[k] = v;
      }
      v._isLink = true;
    }
    else resolveChild(v, vName);
  }
}

function resolveChild(o, name) {
  if(typeof(o) !== "object") return;
  if(o.hasOwnProperty("length")) {
    if(o.length > 0) resolveArray(o, name+"[]");
  }
  else resolveObject(o, name);
}

function resolveArray(o, name) {
  for(var i=0; i<o.length; i++) {
    var v = o[i];
    var tp = typeof(v);
    if(linkKeys[name] && (tp === "number" || tp === "object" && v.hasOwnProperty("length"))) {
      if(tp === "number") {
        v = { "0": ex.currentPage._no, "1": v };
        o[i] = v;
      }
      v._isLink = true;
    }
    else resolveChild(v, name);
  }
}

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
    this.onclick = function() { return fireOnEntityLink(o._refs[idx]); }
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
    aE.onclick = function() { return fireOnEntityLink(o); }
    if(o[0] == ex.currentPage._no) t(ex.getEntityName(ex.currentPage[o[1]]), aE);
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

function createEntityDOM(entity, no) {
  return createObjectDOM(entity, no);
}

ex.createPageDOM = function(page) {
  var olE = e("ol", { "class": "page", start: 0 });
  for(var i=0; i<page.length; i++) {
    var liE = e("li", null, olE);
    liE.appendChild(createEntityDOM(page[i], i));
  }
  return olE;
};

window.extradoc = ex;

})();

/*

Identifiers by type
===================
link-or-entity
  "owner"
  "inTemplate"
  "companion"
  "primaryConstructor"

link-or-entity[]
  "typeParams" (from entity)
  "inDefinitionTemplates"
  "inheritedFrom"
  "parentTemplates"
  "linearization"
  "subClasses"
  "templates"
  "methods"
  "values"
  "abstractTypes"
  "aliasTypes"
  "constructors"
  "packages"
  "_links" link[]

link-or-entity[][]
  "valueParams" (from entity)

special:
  "refEntity" { quoted-int*: { "e": link-or-entity, "l": int } }
  "visibility" visibility{}

boolean
  "isProtected"
  "isPublic"
  "isPrivateInInstance"
  "isProtectedInInstance"
  "isPrivateInTemplate"
  "isProtectedInTemplate"
  "isPackage"
  "isRootPackage"
  "isTrait"
  "isClass"
  "isObject"
  "isDocTemplate"
  "isDef"
  "isVal"
  "isLazyVal"
  "isVar"
  "isImplicit"
  "isConstructor"
  "isAliasType"
  "isAbstractType"
  "isTemplate"
  "isCaseClass"
  "isUseCase"
  "isPrimary"
  "isTypeParam"
  "isValueParam"
  "isSealed"
  "isAbstract"
  "isFinal"

html-wrapper
  "body"
  "short"
  "result"
  "version"
  "since"
  "deprecated"
  "comment"
  "deprecation"

html-wrapper[]
  "authors"
  "see"
  "todo"
  "note"
  "example"
  "flags"

map[string -> html-wrapper]
  "throws" map[string -> html-wraper]
  "valueParams" (from comment) map[string -> html-wrapper]
  "typeParams" (from comment) map[string -> html-wrapper]

string
  "_html" html-string
  "name"
  "qName"
  "definitionName"
  "sourceUrl" url-string
  "variance"
  "defaultValue"
  "is"

type-entity{}
  "resultType"
  "parentType"
  "lo"
  "hi"
  "alias"

All identifiers
===============
"isProtected" boolean
"isPublic" boolean
"isPrivateInInstance" boolean
"isProtectedInInstance" boolean
"isPrivateInTemplate" boolean
"owner" link-or-entity
"isProtectedInTemplate" boolean
"_links" link[]
"_html" html-string
"body" html-wrapper
"short" html-wrapper
"authors" html-wrapper[]
"see" html-wrapper[]
"result" html-wrapper
"throws" map[string -> html-wraper]
"valueParams" (from comment) map[string -> html-wrapper]
"valueParams" (from entity) link-or-entity[][]
"typeParams" (from comment) map[string -> html-wrapper]
"typeParams" (from entity) link-or-entity[]
"version" html-wrapper
"since" html-wrapper
"todo" html-wrapper[]
"deprecated" html-wrapper
"note" html-wrapper[]
"example" html-wrapper[]
"name" string
"refEntity" { quoted-int*: { "e": link-or-entity, "l": int } }
"inTemplate" link-or-entity
"qName" string
"isPackage" boolean
"isRootPackage" boolean
"isTrait" boolean
"isClass" boolean
"isObject" boolean
"isDocTemplate" boolean
"comment" html-wrapper
"inDefinitionTemplates" link-or-entity[]
"definitionName" string
"visibility" {}
"flags" html-wrapper[]
"deprecation" html-wrapper
"inheritedFrom" link-or-entity[]
"resultType" {}
"isDef" boolean
"isVal" boolean
"isLazyVal" boolean
"isVar" boolean
"isImplicit" boolean
"isConstructor" boolean
"isAliasType" boolean
"isAbstractType" boolean
"isTemplate" boolean
"sourceUrl" url-string
"parentType" {}
"parentTemplates" link-or-entity[]
"linearization" link-or-entity[]
"subClasses" link-or-entity[]
"templates" link-or-entity[]
"methods" link-or-entity[]
"values" link-or-entity[]
"abstractTypes" link-or-entity[]
"aliasTypes" link-or-entity[]
"companion" link-or-entity
"primaryConstructor" link-or-entity
"constructors" link-or-entity[]
"isCaseClass" boolean
"packages" link-or-entity[]
"isUseCase" boolean
"isPrimary" boolean
"lo" {}
"hi" {}
"alias" {}
"isTypeParam" boolean
"isValueParam" boolean
"variance" string
"defaultValue" string
"isSealed" boolean
"isAbstract" boolean
"isFinal" boolean
"is" string
*/
