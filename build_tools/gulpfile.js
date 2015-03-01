/*jslint node: true */
'use strict';

var gulp = require('gulp');
var gulpif = require('gulp-if');
var sprockets = require('./vinyl-sprockets');
var less = require('gulp-less');
var newer = require('gulp-newer');
var rimraf = require('rimraf');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var media_queries_remove = require("gulp-mq-remove");
var minify_css = require('gulp-minify-css');


// Get config from the environment and display it
var config = {
  srcDir: process.env.STATIC_SRC_DIR,
  destDir: process.env.STATIC_DEST_DIR,
  minify: (process.env.GULP_MINIFY || 'false').toLowerCase() === 'true',
  sourceMaps: (process.env.GULP_SOURCEMAPS || 'true').toLowerCase() === 'true'
};

console.log('Environment:');
console.log('  STATIC_SRC_DIR=' + config.srcDir);
console.log('  STATIC_DEST_DIR=' + config.destDir);
console.log('  GULP_MINIFY=' + config.minify);
console.log('  GULP_SOURCEMAPS=' + config.sourceMaps);
console.log('');

var makeGlobs = function(directory, patterns) {
  var prefix = escapeGlobChars(ensureTrailingSlash(directory));
  var ignoreHidden = [
    // Exclude files with a leading underscore
    '!' + prefix + '**/_*',
    // Exclude files in directories with a leading underscore
    '!' + prefix + '**/_*/**',
    // Need to explicity exclude dot files in hidden directores
    '!' + prefix + '**/_*/**/.*'
  ];
  var globs = {};
  Object.keys(patterns).forEach(function(key) {
    globs[key] = [prefix + patterns[key]];
    // Create extra globs which match supplied pattern but ignore
    // "hidden" files, as defined above
    globs[key + 'IgnoreHidden'] = globs[key].concat(ignoreHidden);
  });
  var negatedPatterns = Object.keys(patterns).map(function(key) {
    return '!' + prefix + patterns[key];
  });
  // Note: this only matches files with extensions, but all attempts to create
  // a more inclusive matching cause Gulp to try to read directories as files
  // and die with: Error: EISDIR, read
  var matchAllFiles = [prefix + '**/*.*'];
  // Match everything that isn't matched by another pattern and isn't hidden
  globs.everythingElse = matchAllFiles.concat(negatedPatterns, ignoreHidden);
  return globs;
};

// Escape any glob-special characters e.g, *
var escapeGlobChars = function(str) {
  return str.replace(/([^\w\/])/g, '\\$1');
};

var ensureTrailingSlash = function(str) {
  return str.slice(-1) == '/' ? str : str + '/';
};


// Allows us to easily define pipelines with conditional elements
// by skipping any null transforms
var pipeline = function(transforms) {
  var stream = transforms.shift();
  transforms.forEach(function(transform) {
    if (transform) {
      stream = stream.pipe(transform);
    }
  });
  return stream;
};


var globs = makeGlobs(config.srcDir, {
  js: '**/*.js',
  less: '**/*.less'
});


gulp.task('less', function() {
  return pipeline([
    gulp.src(globs.lessIgnoreHidden,  {base: config.srcDir}),
    config.sourceMaps ? sourcemaps.init() : null,
    less(),
    gulpif('**/*.ie8.css', media_queries_remove({width: '1400px'})),
    config.minify ? gulpif('!**/*.ie8.css', minify_css()) : null,
    config.minify ? gulpif('**/*.ie8.css', minify_css({compatibility: 'ie8'})) : null,
    config.sourceMaps ? sourcemaps.write('.') : null,
    gulp.dest(config.destDir)
  ]);
});

gulp.task("js", function() {
  return pipeline([
    gulp.src(globs.jsIgnoreHidden,  {base: config.srcDir}),
    config.sourceMaps ? sourcemaps.init() : null,
    sprockets({sourceMaps: config.sourceMaps}),
    config.minify ? uglify({output: {screw_ie8: true}, compress: {screw_ie8: true}}) : null,
    config.sourceMaps ? sourcemaps.write('.') : null,
    gulp.dest(config.destDir)
  ]);
});

gulp.task('copy', function() {
  return gulp.src(globs.everythingElse, {base: config.srcDir, read: true})
    .pipe(newer(config.destDir))
    .pipe(gulp.dest(config.destDir));
});

gulp.task('watch', function(cb) {
   gulp.watch(globs.less, ['less']);
   gulp.watch(globs.js, ['js']);
   gulp.watch(globs.everythingElse, ['copy']);
});

gulp.task('clean', function(cb) {
  if (config.destDir && config.destDir != '/') {
    rimraf(config.destDir, cb);
  } else {
    throw new Error('Refusing to delete directory: '+config.destDir);
  }
});

gulp.task('build', ['less', 'js', 'copy']);

gulp.task('default', ['build'], function(cb) {
  gulp.start('watch', cb);
});

gulp.task('clean_and_build', ['clean'], function(cb) {
  gulp.start('build', cb);
});
