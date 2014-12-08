
/*
 * grunt-ejs-render
 * https://github.com/kuzyakiev/grunt-ejs-render-i18n
 *
 * Copyright (c) 2014 Oleg Kudrenko
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

	var path 	= require('path'),
		fs 		= require('fs'),
		marked 	= require('marked'),
		_ 		= require('lodash'),
		gettext	= require('node-gettext'),
		gt     	= new gettext(),
		sprintf = require('sprintf').sprintf;


	//add `underscore.string` for deprecated `grunt.util._` compat
	_.str = require('underscore.string');
	_.mixin(_.str.exports());

	function generate_config(filepath, options) {
		var src = '';

		if (grunt.file.exists(filepath)) {

			filepath = './server/config.json';
			src = grunt.file.read(filepath);

			var newConfig = {}, config;
			try{
				config = JSON.parse(src);
			} catch (e) {
				grunt.log.warn('File "' + filepath + '" not valid JSON.');
				return newConfig;
			}

			if(_.has(config, options.takeFrom)){
				config[options.takeFrom].forEach(function(option){
					newConfig[option] = config[option];
				});
			} else {
				grunt.log.warn('File "' + filepath + '" has not option .' + options.takeFrom);
			}

			return newConfig;

		} else {
			grunt.log.warn('File "' + filepath + '" not found.');
			return '';
		}
	}

	grunt.registerMultiTask('generate_config', 'Collect i18n strings from files by patterns', function() {
		var options = this.options({
				helpers: {},
				partialPaths: [],
				"_": _
			}),
			datapath,
			methods = {};

		if(!_.has(options, 'takeFrom')){
			options['takeFrom'] = 'frontend_config';
		}

		//add default methods if not already set
		options.helpers = _.defaults(options.helpers, methods);

		//make options object accessible to helpers
		_.forOwn(options.helpers, function(helperFunc, helperName, helpers) {
			if (_.isFunction(helperFunc)) {
				helpers[helperName] = _.bind(helperFunc, options);
			}
		});

		this.files.forEach(function(file) {
			var contents = file.src.map(function(filepath) {
				return generate_config(filepath, options);
			});

			var result = {};
			contents.unshift(result);
			_.extend.apply(_, contents);

			// Write joined contents to destination filepath.
			grunt.file.write(file.dest,  JSON.stringify(result) );
			// Print a success message.
			grunt.log.writeln('Rendered HTML file to "' + file.dest + '"');
		});

	});
};