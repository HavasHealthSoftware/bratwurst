#! /usr/bin/env node

/*

	TODO
	---------------

	MEDIUM PRIORITY

		Include HTML templating and copying in the build process
		Set up verbose option for Winston logging to avoid console spam
		Tenant aware css rendering - nothing to do with this app actually, it's all client side JS!

	LOW PRIORITY

		Tidy it up
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
	apiUrl = argv.apiurl || 'http://localhost:9000/api',
	localeBasePath = 'locale',
	logLevel = argv.loglevel || 'info';


winston.config.npm.colors.debug = winston.config.npm.colors.info;
winston.config.npm.colors.info = 'magenta';
winston.setLevels(winston.config.npm.levels);
winston.addColors(winston.config.npm.colors);
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
	colorize: true,
	level: logLevel
});

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
			pageData['/index.json'] = {}; // temp measure to ensure root index is processed (can't currently read json files at this level as it hits node_modules)
		});

	});

}

getJsonFiles();

var gazeTargets = environments.map(function(env) {
	var t = path.join(rootPath, env, '/**/*.json');
	winston.debug('gaze target: ' + t);
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

var useTemplating = function(requestUrl) {
	return requestUrl.indexOf('.html') != -1;
}

// Set up EJS Connect middleware for each environment (currently we just have two)
environments.forEach(function(env) {

	connectApp.use(function(req, res, next) {

		var requestUrl = pathWithDefaultDocument(req.url).toLowerCase();

		if (!useTemplating(requestUrl)) {
			winston.debug(requestUrl + ' not templatable for ' + env + ', skipping');
			next();
			return;
		};

		var lookupUrl = requestUrl.replace('.html', '.json');

		var fullVirtualPath = '/' + env + pathWithDefaultDocument(req.url);
		winston.debug(fullVirtualPath);
		var fullPath = path.normalize(rootPath + fullVirtualPath);


		fs.exists(fullPath, function(exists) {

			if (exists) {
				winston.debug(fullVirtualPath + ' found in ' + env + ' directory');
				var jsonData = pageData[lookupUrl];

				if (jsonData) {
					winston.debug('Found data using ' + lookupUrl);
					res.render(fullVirtualPath, {
						pageData: jsonData
					});
				} else {
					winston.debug('No data found for ' + lookupUrl);
					next();
				}

			} else {

				winston.debug(fullVirtualPath + ' not found in ' + env + ' directory');
				next();

			}

		});



	});

});

environments.forEach(function(env) {

	connectApp.use(connect.static(process.cwd() + '/' + env), {
		maxAge: 0
	});

});

connectApp.listen(port);

winston.info('Listening on port ' + port);