(function() {

var kindColors = {
  b: "#932222",
  c: "#24763e",
  t: "#5564a9",
  p: "#bb712a",
  def: "#606060"
};

function instrumentData(o) {
  if(!o.id) o.id = generateID();
  if(!o.data) o.data = {};
  if(o.children) {
    for(var i=0; i<o.children.length; i++) instrumentData(o.children[i]);
  } else o.children = [];
};

function initDiagram(diagJ, data, centerID) {
  var diagID = diagJ.attr("id");
  var width = diagJ.attr("clientWidth");
  var offsetX = width/2 - diagJ.parent().width()*3/4 + 50;
  if(offsetX < 0) offsetX = 0;
  log("Initializing diagram "+diagID);
  var st = new $jit.ST({
    injectInto: diagID,
    orientation: "left",
    offsetX: offsetX,
    levelDistance: 50,
    constrained: false, levelsToShow: 10000,
    duration: 200, //transition: $jit.Trans.Quart.easeInOut,
    animate: false,
    Navigation: { enable: true, panning: true },
    Node: {
      autoWidth: true,
      autoHeight: true,
      type: 'rectangle',
      color: "606060",
      overridable: true
    },
    Edge: { type: 'bezier', color: "#c0c0c0", lineWidth: 2 },
    onCreateLabel: function(label, node) {
      label.id = node.id;
      label.innerHTML = node.name;
      label.onclick = function() {
        if(node.data.link)
          goToEntity(node.data.link[0], node.data.link[1]);
      };
    }
  });
  st.loadJSON(data);
  st.compute();
  st.select(centerID || data.id);
  log("Initialized diagram "+diagID);
}

window.createClassDiagram = function(diagJ, page, o) {
  function mk(o) {
    var color = kindColors[page.kindMarkerFor(o)] || kindColors["def"];
    var d = { name: page.nameFor(o), children: [], data: { $color: color } };
    if(o._isLink) d.data.link = o;
    return d;
  }
  var cur, data;
  if(o.linearization) {
    for(var i=o.linearization.length-1; i>=0; i--) {
      var ch = mk(o.linearization[i]);
      if(cur) cur.children = [ch];
      else data = ch;
      cur = ch;
    }
  }
  var root = mk(o);
  if(data) cur.children = [root];
  else data = root;
  if(o.subClasses) {
    for(var i=0; i<o.subClasses.length; i++)
      root.children.push(mk(o.subClasses[i]));
  }
  instrumentData(data);
  var st = initDiagram(diagJ, data, root.id);
};

})();
