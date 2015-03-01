var event_stream = require('event-stream');
var File = require('vinyl');
var Concat = require('concat-with-sourcemaps');
var shell_quote = require('shell-quote');
var fs = require('fs');
var path = require('path');

var HEADER_REGEX = new RegExp(
    '^(\\s*(' +
      '(/\\*[\\s\\S]*?\\*/)' + // Multiline comment
      '|' +
      '(//.*)+' + // Double-slash comment
      '|' +
      '(\\#.*)+' + // Hash comment
    '))+');

var DIRECTIVE_REGEX = new RegExp(
  '^\\s*(?:\\*|//|\\#)\\s*=\\s*' +
  '(\\w+)' + // Directive
  '\\s+' +
  '(\\S+)$' // Argument
);

var getDirectives = function(contents) {
  var directives = [];
  var match = HEADER_REGEX.exec(contents);
  if (match) {
    var header = match[0];
    header.split(/\n/).forEach(function(line) {
      var match = DIRECTIVE_REGEX.exec(line);
      if (match) {
        directives.push([
          match[1],
          cleanArgument(match[2])]);
      }
    });
  }
  return directives;
};

var cleanArgument = function(arg) {
  return shell_quote.parse(arg)[0];
};

var getFileDependencies = function(file, loadPaths, filesSeen) {
  filesSeen = filesSeen || {};
  var contents = file.contents.toString();
  var directives = getDirectives(contents);
  var newFiles = [];
  directives.forEach(function(directive) {
    var cmd = directive[0],
        arg = directive[1];
    var resolvedPath = getPathFromArg(arg, file.path, loadPaths);
    if ( ! filesSeen[resolvedPath] ) {
      filesSeen[resolvedPath] = true;
      var newFile = new File({path: resolvedPath, base: file.base});
      newFile.contents = fs.readFileSync(resolvedPath);
      var newDeps = getFileDependencies(newFile, loadPaths, filesSeen);
      if (cmd !== 'stub') {
        Array.prototype.push.apply(newFiles, newDeps);
        newFiles.push(newFile);
      }
    }
  });
  return newFiles;
};

var getPathFromArg = function(arg, pathContext, loadPaths) {
  return path.normalize(path.join(path.dirname(pathContext), arg));
};

module.exports = function(opts) {
  opts = opts || {};
  opts.sourceMaps = (!! opts.sourceMaps);
  opts.loadPaths = opts.loadPaths || [];

 function include(file, callback) {
    if (file.isStream()) {
      throw new Error('Streams not currently supported');
    }

    if (file.isBuffer() && ! file.isNull()) {
      var dependencies = getFileDependencies(file, opts.loadPaths);
      if (dependencies.length > 0) {
        var concat = new Concat(opts.sourceMaps, file.relative, '\n');
        dependencies.forEach(function(dependency) {
          var sourceMap = null;
          if (opts.sourceMaps) {
            sourceMap = dependency.sourceMap ? dependency.sourceMap
                          : {sourcesContent: [dependency.contents.toString()]};
          }
          concat.add(dependency.relative, dependency.contents, sourceMap);
        });
        concat.add(file.relative, file.contents, file.sourceMap);
        file.contents = concat.content;
        if (concat.sourceMapping) {
          file.sourceMap = JSON.parse(concat.sourceMap);
        }
      }
    }

    callback(null, file);
  }

  return event_stream.map(include);
};
