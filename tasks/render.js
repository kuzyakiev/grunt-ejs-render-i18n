/*
 * grunt-ejs-render
 * https://github.com/kuzyakiev/grunt-ejs-render-i18n
 *
 * Copyright (c) 2013 Marco Solazzi
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
		gt     	= new gettext();
		sprintf = require('sprintf').sprintf;

	//add `underscore.string` for deprecated `grunt.util._` compat
	_.str = require('underscore.string');
	_.mixin(_.str.exports());

	function render(filepath, options) {
		var src = '';

		if (grunt.file.exists(filepath)) {
			src = grunt.file.read(filepath);
			return ejs.render(src, options || null);
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

	grunt.registerMultiTask('render', 'Renders an EJS template to plain HTML', function() {
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

        methods.renderPartial = function(filepath, data) {
			var fpath = getFile(filepath, options.partialPaths);
			if (fpath !== false) {
				return render(fpath, _.extend({}, options, {filename: fpath}, data || {}));
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

		//add default methods if not already set
		options.helpers = _.defaults(options.helpers, methods);

		//make options object accessible to helpers
		_.forOwn(options.helpers, function(helperFunc, helperName, helpers) {
			if (_.isFunction(helperFunc)) {
				helpers[helperName] = _.bind(helperFunc, options);
			}
		});

		//options._ = _;

		if(options.languages && options.languages.length) {
			var that = this;
			options.languages.forEach(function (language) {
				console.log(language);
				that.files.forEach(function(file) {
					var contents = file.src.map(function(filepath) {
						options.filename = filepath;
						return render(filepath, options);
					}).join('\n');

					var domain          = 'ru';
					var fileContents = fs.readFileSync('./locale/'+language+'/messages.po');
					gt.textdomain(domain);
					gt.addTextdomain(domain , fileContents);

					options.gettext = function(){
						if(!arguments.length) return '';
						var a = arguments;
						a[0] = gt.gettext(arguments[0]);
						return sprintf.apply(null, a);
					};


					// Write joined contents to destination filepath.
					console.log(file.dest.replace('%language%',language))
					grunt.file.write(file.dest.replace('%language%',language), contents);
					// Print a success message.
					grunt.log.writeln('Rendered HTML file to "' + file.dest + '"');
				});
			});
		} else {
			this.files.forEach(function(file) {
				var contents = file.src.map(function(filepath) {
					options.filename = filepath;
					return render(filepath, options);
				}).join('\n');

				// Write joined contents to destination filepath.
				grunt.file.write(file.dest, contents);
				// Print a success message.
				grunt.log.writeln('Rendered HTML file to "' + file.dest + '"');
			});
		}
	});
};

/**
#!/usr/bin/env node
var express         = require('express'),
	app             = express(),
	gettext         = require('node-gettext'),
	gt              = new gettext(),
	fs              = require('fs'),
	ejs             = require('ejs'),
	i18n            = require('i18n-abide'),
	str             = fs.readFileSync('view/index.html', 'utf8');

app.use(i18n.abide({
	supported_languages: ['en', 'ru', 'uk'],
	default_lang: 'en',
	translation_directory: 'static/i18n'
}));

var domain          = 'ru';
var fileContents = fs.readFileSync('./locale/'+domain+'/messages.po');
gt.textdomain(domain);
gt.addTextdomain(domain , fileContents);

var gt2 = function(input){
	return input;
};


console.log('this', this);
console.info('gt.gettext', gt.gettext('Hello World'));
var that = this;
gt_apply = function(){
	console.log('will run gt.gettext.apply with ', that, arguments);
	//call, apply, bind
	console.log(gt.gettext);
	return gt.gettext(arguments[0]);
};
console.info('gt_apply', gt_apply('Hello World'));

var o = ejs.render(
	str, //'view/index.html',
	{ gt: gt, gettext:gt_apply}
);

console.log(o);

console.log('Done');
*///
