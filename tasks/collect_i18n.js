
/*
 * grunt-ejs-render
 * https://github.com/kuzyakiev/grunt-ejs-render-i18n
 *
 * Copyright (c) 2014 Oleg Kudrenko
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

	var ejs 	= require('ejs'),
		path 	= require('path'),
		fs 		= require('fs'),
		marked 	= require('marked'),
		_ 		= require('lodash'),
		gettext	= require('node-gettext'),
		gt     	= new gettext(),
		sprintf = require('sprintf').sprintf;


	//add `underscore.string` for deprecated `grunt.util._` compat
	_.str = require('underscore.string');
	_.mixin(_.str.exports());

	function collect_i18n(filepath, options) {
		var src = '';

		if(!Array.isArray(options.regex)){
			options.regex = [options.regex]
		}

		if (grunt.file.exists(filepath)) {

			src = grunt.file.read(filepath);
			var str = src.replace(/\\\'/g,'{escaped_quote}');
			var res = [], m, r;

			options.regex.forEach(function(re){
				while ((m = re.exec(str)) != null) {
					if (m.index === re.lastIndex) {
						re.lastIndex++;
					}
					// View your result using the m-variable.
					// eg m[0] etc.
					r = m[2].replace(/\{escaped_quote\}/g, "\\\'");
					if(res.indexOf(r) == -1) res.push(r);
				}
			});

			console.log(res);
			return res;
		} else {
			grunt.log.warn('File "' + filepath + '" not found.');
			return '';
		}
	}


	function getFile (filepath, paths) {
		var fpath,
			exists = false;

		exists = (paths || []).some(function (p) {
			fpath = path.join(p, filepath);
			return grunt.file.isFile(fpath);
		});

		if (exists) {
			return fpath;
		} else {
			grunt.log.warn('Unable to find filepath "' + filepath + '"');
			return false;
		}
	}

	//add markdown parser filter to ejs
	ejs.filters.md = function (obj) {
		//force string... then parse
		//just simple as that
		return marked(obj.toString());
	};

	grunt.registerMultiTask('collect_i18n', 'Collect i18n strings from files by patterns', function() {
		var options = this.options({
				helpers: {},
				//basePath: '', DEPRECATED
				templates: [],
				partialPaths: [],
				"_": _
			}),
			datapath,
			templates = {},
			methods = {};

		//setup some default methods
		methods.template = function(tplName, data) {
			if (!_.has(templates, tplName)) {
				grunt.log.warn('Unable to find template "' + tplName + '"');
			} else {
				return templates[tplName](data);
			}
		};
		methods.getMTime = function(filepath) {
			var fpath = getFile(filepath, options.partialPaths);
			if (fpath !== false) {
				return fs.statSync(fpath).mtime.getTime();
			}
			return '';
		};

		methods.readPartial = function(filepath) {
			var fpath = getFile(filepath, options.partialPaths);
			if (fpath !== false) {
				return grunt.file.read(fpath);
			}
			return '';
		};

		methods.collect_i18nPartial = function(filepath, data) {
			var fpath = getFile(filepath, options.partialPaths);
			if (fpath !== false) {
				return collect_i18n(fpath, _.extend({}, options, {filename: fpath}, data || {}));
			}
			return '';
		};

		//options.basePath = grunt.template.process(options.basePath);

		if ( _.has(options, 'data')) {

			if ( _.isArray(options.data) ) {

				datapath = [].concat(options.data);
				datapath = _(datapath)
					.map(function(filepath) {
						return grunt.file.expand({
							filter: function(src) {
								return grunt.file.isFile(src) && (path.extname(src) === '.json');
							}
						}, grunt.config.process(filepath));
					})
					.flatten()
					.uniq()
					.valueOf();

				options.data = {};
				datapath.forEach(function (file) {
					var filename = path.basename(file, '.json');
					var keyName = _.camelize( _.slugify(filename) );
					options.data[keyName] = grunt.file.readJSON(file);
				});


			} else if (_.isString(options.data)) {
				//DEPRECATED
				//Kept for compatibility with older versions < 0.2.2
				datapath = grunt.template.process(options.data);
				if (grunt.file.exists(datapath)) {
					options.data = grunt.file.readJSON(datapath);
				}
			}
		}

		_.each(grunt.file.expand(options.templates), function(tpl) {
			var tplName = path.basename(tpl, path.extname(tpl)).replace(/[\s\-]/g, '_');
			templates[tplName] = _.template(grunt.file.read(tpl));
		});

		console.log('templates', templates); // @rm

		//add default methods if not already set
		options.helpers = _.defaults(options.helpers, methods);

		//make options object accessible to helpers
		_.forOwn(options.helpers, function(helperFunc, helperName, helpers) {
			if (_.isFunction(helperFunc)) {
				helpers[helperName] = _.bind(helperFunc, options);
			}
		});

		//options._ = _;

		options.gettext = function(){
			if(!arguments.length) return '';
			var a = arguments;
			a[0] = gt.gettext(arguments[0]);
			return sprintf.apply(null, a);
		};

		if(options.languages && options.languages.length && options.locales ) {
			var that = this;
			options.languages.forEach(function (language) {
				options.lang = language;
				var fileContents = fs.readFileSync(options.locales.replace('%language%',language));
				gt.textdomain(language);
				gt.addTextdomain(language , fileContents);

				grunt.log.writeln('Processing',language.toUpperCase(),'...');
				that.files.forEach(function(file) {

					var contents = file.src.map(function(filepath) {
						options.filename = filepath;
						return collect_i18n(filepath, options);
					}).join('\n');

					file.src.forEach(function(filepath){
						contents = collect_i18n(filepath, options);
						filepath = filepath.replace(options.toReplace, file.dest.replace('%language%',language));
						grunt.file.write(filepath, contents);
					});

					// Write joined contents to destination filepath.
					// Print a success message.
					grunt.log.writeln('Rendered HTML files DONE;');
				});
			});
		} else {
			this.files.forEach(function(file) {
				console.log(file.dest);


				var contents = file.src.map(function(filepath) {
					console.log('>>', filepath);
					options.filename = filepath;
					return collect_i18n(filepath, options);
				});

				var merged = [];
				merged = merged.concat.apply(merged, contents).sort();
				merged = merged.filter(function(item, pos) {
					return !pos || item != merged[pos - 1];
				});


				console.log('=======');
				console.log(merged);

				// Write joined contents to destination filepath.
				grunt.file.write(file.dest,  "<%- gettext('" + merged.join("') %>\n<%- gettext('") + "') %>" );
				// Print a success message.
				grunt.log.writeln('Rendered HTML file to "' + file.dest + '"');
			});
		}
	});
};