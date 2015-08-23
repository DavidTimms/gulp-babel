'use strict';
var gutil = require('gulp-util');
var through = require('through2');
var applySourceMap = require('vinyl-sourcemaps-apply');
var objectAssign = require('object-assign');
var replaceExt = require('replace-ext');
var babel = require('babel-core');

module.exports = function (opts) {
	opts = opts || {};

	var continueOnError = Boolean(opts.continueOnError);
	delete opts.continueOnError;

	var errorsInOutput = Boolean(opts.errorsInOutput);
	delete opts.errorsInOutput;

	return through.obj(function (file, enc, cb) {
		if (file.isNull()) {
			cb(null, file);
			return;
		}

		if (file.isStream()) {
			cb(new gutil.PluginError('gulp-babel', 'Streaming not supported'));
			return;
		}

		try {
			var fileOpts = objectAssign({}, opts, {
				filename: file.path,
				filenameRelative: file.relative,
				sourceMap: Boolean(file.sourceMap)
			});

			var res = babel.transform(file.contents.toString(), fileOpts);

			if (file.sourceMap && res.map) {
				res.map.file = replaceExt(res.map.file, '.js');
				applySourceMap(file, res.map);
			}

			file.contents = new Buffer(res.code);
			file.path = replaceExt(file.path, '.js');
			file.babel = res.metadata;

			this.push(file);
		} catch (err) {
			if (errorsInOutput) {
				var codeFrame = err.codeFrame.replace(/\[\d+m/g, '');
				file.contents = new Buffer(
					'console.error(' + JSON.stringify([
						'Babel: ' + err.name,
						err.message,
						codeFrame,
					].join('\n')) + ');'
				);
				file.path = replaceExt(file.path, '.js');
				this.push(file);
			}

			if (continueOnError) {
				console.error('Babel:', err.name);
				console.error(err.message);
				console.error(codeFrame);

				this.end();
			} else {
				this.emit('error', new gutil.PluginError('gulp-babel', err, {
					fileName: file.path,
					showProperties: false
				}));
			}
		}

		cb();
	});
};
