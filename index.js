#! /usr/bin/env node

/*

	TODO
	---------------

	MEDIUM PRIORITY

		Include HTML templating and copying in the build process
		Set up verbose option for Winston logging to avoid console spam
		Tenant aware css rendering - nothing to do with this app actually, it's all client side JS!

	LOW PRIORITY

		Make everything async for maximum performance and stability
				
		Tidy it up
		Use json files for configuration of sites?
		Make it work as a grunt plugin

*/

var connect = require('connect'),
	render = require('connect-render'),
	fs = require('fs'),
	path = require('path'),
	Gaze = require('gaze').Gaze,
	url = require('url'),
	proxy = require('proxy-middleware'),
	argv = require('optimist').argv,
	winston = require('winston'),
	port = argv.port || 9020,
	locale = argv.locale,
	configBuilder = require('./configBuilder'),
	localeBasePath = 'locale',
	apiUrl = argv.apiurl || 'http://localhost:9000/api';

if (!locale) {
	winston.error('You must specify a locale');
	process.exit(1);
}

locale = locale.toLowerCase();

var environments = [localeBasePath + '/' + locale, 'app'];
var rootPath = process.cwd() + '/';

winston.info('Starting site for ' + locale + ' on port ' + port);

var pageData;

var getJsonFiles = function() {

	configBuilder.getJsonFiles('/app', 'views/', {}, function(err, coreData) {

		winston.info('Core json data read');

		// Get json data overrides
		configBuilder.getJsonFiles('/locale/' + locale, 'views/', coreData, function(err, mergedData) {
			winston.info('Locale specific json data read');
			pageData = mergedData;
		});

	});

}

getJsonFiles();

var gazeTargets = environments.map(function(env){
	var t = path.join(rootPath, env, '/**/*.json');
	console.log('gaze target: ' + t);
	return t;
});

var gaze = new Gaze(gazeTargets);

// Files have all started watching
gaze.on('ready', function(watcher) {
	winston.info('Watching json files...');
});

// A file has been added/changed/deleted has occurred
gaze.on('all', function(event, filepath) {
	winston.info('File changed: ' + filepath);
	getJsonFiles();
});

var useTemplating = function(req) {
	return req.url.indexOf('.') === -1 || req.url.indexOf('.html') != -1;
}

var connectApp = connect(
	render({
	root: rootPath,
	layout: false,
	cache: false, // false for debug
	helpers: {
		locale: locale
	}
}));

connectApp.use('/api', proxy(url.parse(apiUrl)));

var pathWithDefaultDocument = function(urlString) {
	if (urlString.substring(urlString.length - 1) === '/') {
		return urlString + 'index.html';
	}
	return urlString;
};

// Set up Connect middleware for each environment (currently we just have two)
environments.forEach(function(env) {

	connectApp.use(function(req, res, next) {

		if (!useTemplating(req)) {
			winston.info(req.url + ' not templatable, skipping');
			next();
			return;
		};

		var fullVirtualPath = '/' + env + pathWithDefaultDocument(req.url);
		winston.info(fullVirtualPath);
		var fullPath = path.normalize(rootPath + fullVirtualPath);

		if (fs.existsSync(fullPath)) {

			winston.info(fullVirtualPath + ' found in ' + env + ' directory');
			var lookupUrl = pathWithDefaultDocument(req.url);
			winston.info(lookupUrl + ' used for data lookup');
			res.render(fullVirtualPath, {
				pageData: pageData[lookupUrl.replace('.html', '.json')]
			});

		} else {

			winston.info(fullVirtualPath + ' NOT found in ' + env + ' directory');
			next();

		}

	});

});

environments.forEach(function(env) {

	connectApp.use(connect.static(process.cwd() + '/' + env), {
		maxAge: 0
	});

});

connectApp.listen(port);

winston.info('Listening on port ' + port);