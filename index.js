/*

	TODO
	---------------

	HIGH PRIORITY

		// Restrict templated renderer to root index.html and views folder
		// Add static handler for non-templatable static data (everything except html at the moment)
		// Add proxy for api calls - try putting this at the top of the middleware chain
		One core site and then a UK site, US site, etc.
		Make compass build steps locale aware (Talk to Christian)
		 - Trust aware is a different issue


	MEDIUM PRIORITY

		Include HTML templating and copying in the build process




	LOW PRIORITY

		Make everything async for maximum performance
		Tidy it up
		Use json files for configuration of sites
		Make it work as a grunt plugin

*/

var connect = require('connect'),
	render = require('connect-render'),
	fs = require('fs'),
	path = require('path'),
	configBuilder = require('./configBuilder'),
	Gaze = require('gaze').Gaze,
	url = require('url'),
	proxy = require('proxy-middleware'),
	argv = require('optimist').argv,
	winston = require('winston'),
	port = argv.port || 9020,
	locale = argv.locale;

if (!locale) {
	winston.error('You must specify a locale');
	process.exit(1);
}

locale = locale.toLowerCase();

winston.info('Starting site for ' + locale + ' on port ' + port);

var pageData;

var getJsonFiles = function() {

	configBuilder.getJsonFiles('/../cft-heart-health/src/cprm/app', 'views/', {}, function(err, coreData) {

		winston.info('Core json data read');

		// Get json data overrides
		configBuilder.getJsonFiles('/../cft-heart-health/src/cprm/locale/' + locale, 'views/', coreData, function(err, mergedData) {
			winston.info('Locale specific json data read');
			pageData = mergedData;
		});

	});

}

getJsonFiles();

var gaze = new Gaze([
		'../cft-heart-health/src/cprm/app/**/*.json',
		'../cft-heart-health/src/cprm/locale/' + locale + '/**/*.json'
]);

// Files have all started watching
gaze.on('ready', function(watcher) {
	winston.info('Watching json files...');
});

// A file has been added/changed/deleted has occurred
gaze.on('all', function(event, filepath) {
	winston.info('File changed: ' + filepath);
	getJsonFiles();
});

var rootPath = __dirname + '/../cft-heart-health/src/cprm';

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

connectApp.use('/api', proxy(url.parse('http://localhost:9000/api')));

var pathWithDefaultDocument = function(urlString) {
	if (urlString.substring(urlString.length - 1) === '/') {
		return urlString + 'index.html';
	}
	return urlString;
};

// US
connectApp.use(function(req, res, next) {

	if (!useTemplating(req)) {
		winston.info(req.url + ' not templatable, skipping');
		next();
		return;
	};

	var fullVirtualPath = '/locale/' + locale + pathWithDefaultDocument(req.url);
	winston.info(fullVirtualPath);
	var fullPath = path.normalize(rootPath + fullVirtualPath);
	if (fs.existsSync(fullPath)) {
		winston.info(fullVirtualPath + ' found in ' + locale + ' directory');
		var lookupUrl = pathWithDefaultDocument(req.url);
		winston.info(lookupUrl + ' used for data lookup');
		res.render(fullVirtualPath, {
			pageData: pageData[lookupUrl.replace('.html', '.json')]
		});
	} else {
		winston.info(fullVirtualPath + ' NOT found in ' + locale + ' directory');
		next();
	}

});

// UK
connectApp.use(function(req, res, next) {

	if (!useTemplating(req)) {
		winston.info(req.url + ' not templatable, skipping');
		next();
		return;
	};

	var fullVirtualPath = '/app' + pathWithDefaultDocument(req.url);
	var fullPath = path.normalize(rootPath + fullVirtualPath);

	if (fs.existsSync(fullPath)) {
		winston.info(fullVirtualPath + ' found in app directory');
		var lookupUrl = pathWithDefaultDocument(req.url);
		winston.info(lookupUrl + ' used for data lookup');
		res.render(fullVirtualPath, {
			pageData: pageData[lookupUrl.replace('.html', '.json')]
		});
	} else {
		winston.info(fullVirtualPath + ' NOT found in app directory');
		next();
	}

});

connectApp.use(connect.static(__dirname + '/../cft-heart-health/src/cprm/locale/' + locale), {
	maxAge: 0
});

connectApp.use(connect.static(__dirname + '/../cft-heart-health/src/cprm/app'), {
	maxAge: 0
});

connectApp.listen(port);
winston.info('Listening on port ' + port);