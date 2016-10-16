var create = require('babel-runtime/core-js/object/create');
var babelTemplate = require('babel-template');


var buildDefine = babelTemplate('angular.module("test").factory(MODULE_NAME, [SOURCES, FACTORY]);');
var buildFactory = babelTemplate('(function (PARAMS) {var module = {exports:{}};var exports = module.exports;BODY;return module.exports;})');


module.exports = function (ref) {
  var types = ref.types;
  var amdVisitor = {
    CallExpression: CallExpression,
    ReferencedIdentifier: ReferencedIdentifier,
    VariableDeclarator: VariableDeclarator
  };

  return {
    inherits: require("babel-plugin-transform-es2015-modules-commonjs"),
    pre: pre,
    visitor: {
      Program: {
        exit: exit
      }
    }
  };
};




function pre() {
  // source strings
  this.sources = [];
  this.sourceNames = create(null);

  // bare sources
  this.bareSources = [];
  this.hasExports = false;
  this.hasModule = false;
}

function exit(path, state) {
  var self = this;

  if (self.ran) return;
  self.ran = true;

  path.traverse(amdVisitor, self);

  var params = self.sources.map(function (source) {
    return source[0];
  });
  var sources = self.sources.map(function (source) {
    return source[1];
  });

  sources = sources.concat(self.bareSources.filter(function (str) {
    return !self.sourceNames[str.value];
  }));

  var moduleName = camelToDash(state.file.opts.filename.slice(state.file.opts.filename.lastIndexOf('/')+1, state.file.opts.filename.length-3));
  if (moduleName) moduleName = t.stringLiteral(moduleName);


  var node = path.node;
  var factory = buildFactory({
    PARAMS: params,
    BODY: node.body
  });

  node.body = [buildDefine({
    MODULE_NAME: moduleName,
    SOURCES: sources,
    FACTORY: factory
  })];
}



function CallExpression(path) {
  if (!isValidRequireCall(path)) return;
  this.bareSources.push(path.node.arguments[0]);
  path.remove();
}

function ReferencedIdentifier(ref) {
  var node = ref.node;
  var scope = ref.scope;

  if (node.name === "exports" && !scope.getBinding("exports")) {
    this.hasExports = true;
  }

  if (node.name === "module" && !scope.getBinding("module")) {
    this.hasModule = true;
  }
}

function VariableDeclarator(path) {
  var id = path.get("id");
  if (!id.isIdentifier()) return;

  var init = path.get("init");
  if (!isValidRequireCall(init)) return;

  var source = init.node.arguments[0];
  this.sourceNames[source.value] = true;
  this.sources.push([id.node, source]);

  path.remove();
}


function camelToDash(str) {
  return str.replace(/\W+/g, '-')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2').toLowerCase();
}
