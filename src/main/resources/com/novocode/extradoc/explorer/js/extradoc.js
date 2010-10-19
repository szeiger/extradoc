(function(){

var linkKeys = {
  "visibleIn": true,
  "inTemplate": true,
  "companion": true,
  "primaryConstructor": true,
  "typeParams[]": true,
  "inDefinitionTemplates[]": true,
  "alsoIn[]": true,
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
  "e": true,
  "commentIn": true
};

var mapKeys = { "throws": true };

ex = { };

function getEntityName(e) {
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
      var p = ex.currentPage;
      p._no = pageNo;
      p._bytes = data.length;
      for(var i=0; i<p.length; i++) resolveObject(p[i], null);
      delete ex.currentPage;
      ok(p);
    },
    error: err
  });
};

function resolveObject(o, name) {
  var isMap = !!mapKeys[name];
  if(!isMap) {
    if(o.qName || o.name) {
      o._isEntity = true;
      if(!o.name) o.name = getEntityName(o);
    }
    if(o.is) {
      var is = o.is;
      for(var i=0; i<is.length; i++) {
        switch(is.charAt(i)) {
          case 'o': o.isProtected = true; break;
          case 'u': o.isPublic = true; break;
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

function resolveGlobal(global) {
  global.pageToPageInfo = [];
  global.qnToPageInfo = {};
  function resolveE(e, parentN, parentP) {
    if(!e) return;
    for(var j=0; j<e.length; j++) {
      var n = parentN + "." + global.names[e[j].p+",0"];
      if(e[j].k == "b") n += "$";
      pi = { p: e[j].p, "in": parentP, qn: n, k: e[j].k };
      global.qnToPageInfo[n] = pi;
      global.pageToPageInfo[e[j].p] = pi;
      resolveE(e[j].e, n, e[j].p);
    }
  }
  for(var i=0; i<global.packages.length; i++) {
    var pck = global.packages[i];
    var pi = { p: pck.p, "in": pck["in"], qn: pck.n, k: "p" };
    global.qnToPageInfo[pck.n] = pi;
    global.pageToPageInfo[pck.p] = pi;
    resolveE(pck.e, pck.n, pck.p);
  }
}

ex.loadGlobal = function(ok, err) {
  $.ajax({
    url: 'global.json',
    dataType: 'text',
    success: function(data) {
      eval("window.extradoc.global = "+data);
      ex.global._bytes = data.length;
      resolveGlobal(ex.global);
      ok(ex.global);
    },
    error: err
  });
};

window.extradoc = ex;

})();

/*
Identifiers by type
===================
link-or-entity, link-or-entity[], link-or-entity[][]
  (see linkKeys)

boolean
  "isProtected"
  "isPublic"
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
*/
