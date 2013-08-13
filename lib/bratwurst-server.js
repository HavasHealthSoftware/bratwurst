var connect = require('connect'),
	render = require('connect-render'),
	fs = require('fs'),
	path = require('path'),
	Gaze = require('gaze').Gaze,
	url = require('url'),
	proxy = require('proxy-middleware'),
	winston = require('winston'),
	configBuilder = require('./configBuilder'),
	localeBasePath = 'locale',
	EventEmitter = require('events').EventEmitter,
	async = require('async'),
	deepMerge = require('deepmerge');

var BratwurstServer = function(options) {
	options = options || {};
	this.options = {
		environments: options.environments ? options.environments.split(',') : [],
		locale: options.locale,
		port: options.port,
		apiUrl: options.apiUrl,
		basePath: options.basePath || './'
	};
}

BratwurstServer.prototype.__proto__ = EventEmitter.prototype;

BratwurstServer.prototype.start = function() {

	var usageIssue = false;

	winston.info('Starting bratwurst server');

	if (this.options.environments.length === 0) {
		winston.error('You must specify at least one environment');
		usageIssue = true;
	}

	if (!this.options.locale) {
		winston.error('You must specify a locale');
		usageIssue = true;
	}

	if (!this.options.port) {
		winston.error('You must specify a port');
		usageIssue = true;
	}

	if (!this.options.apiUrl) {
		winston.error('You must specify an api url');
		usageIssue = true;
	}

	if (usageIssue) {
		this.emit('usageIssue');
		return;
	}

	winston.debug('All required options are set');
	winston.debug(util.format('Options: %j', this.options));

	// start it... !!!
	startServer(this);
};

BratwurstServer.prototype.getEnvironmentDetails = function(options) {

	return this.options.environments.map(function(environment) {
		return {
			name: environment,
			dirPath: path.resolve(environment)
		};
	});

};

module.exports = BratwurstServer;

function startServer(bratwurstServer) {

	// 	var environments = [localeBasePath + '/' + locale, 'app'];
	var environments = bratwurstServer.getEnvironmentDetails(bratwurstServer.options);
	var fullBasePath = path.resolve(bratwurstServer.options.basePath);
	winston.info('Using fullBasePath ' + fullBasePath);

	// Merge configs in reverse order
	var jsonData = {};

	function getJsonFiles() {
		async.mapSeries(environments.slice(0).reverse(), function(environment, callback) {
			var data = configBuilder.getJsonFiles(environment.dirPath, {}, callback);
		}, function(err, results) {
			var mergedResults = results.reduce(function(previous, next) {
				return deepMerge(previous, next);
			});
			winston.info('Loaded JSON data')
			winston.debug(util.format(mergedResults));
			jsonData = mergedResults;
		});
	}

	getJsonFiles();

	var gazeTargets = environments.map(function(env) {
		var t = path.join(env.dirPath, '/**/*.json');
		winston.debug('gaze target: ' + t);
		return t;
	});

	var gaze = new Gaze(gazeTargets);

	// Files have all started watching
	gaze.on('ready', function(watcher) {
		winston.info('Watching JSON files...');
	});

	// A file has been added/changed/deleted has occurred
	gaze.on('all', function(event, filepath) {
		winston.info('File changed: ' + filepath);
		getJsonFiles();
	});

	winston.info('Starting server on port ' + bratwurstServer.options.port);

	var connectApp = connect(
		render({
		root: fullBasePath,
		layout: false,
		cache: false, // false for debug
		helpers: {
			locale: bratwurstServer.options.locale
		}
	}));

	function requestUrlWithDefaultDocument(requestUrl) {
		if (requestUrl.substring(requestUrl.length - 1) === '/') {
			return requestUrl + 'index.html';
		}
		return requestUrl;
	};

	function pathWithDefaultDocument(rootPath, requestUrl) {
		return path.join(rootPath, requestUrl);
	};

	var useTemplating = function(requestUrl) {
		return requestUrl.indexOf('.html') !== -1;
	}

	winston.info('Configuring api endpoint proxy for ' + bratwurstServer.options.apiUrl);
	connectApp.use('/api', proxy(url.parse(bratwurstServer.options.apiUrl)));

	// Set up EJS Connect middleware for each environment (currently we just have two)
	environments.forEach(function(environment) {

		winston.info('Configuring EJS renderer for ' + environment.name);

		connectApp.use(function(req, res, next) {

			var requestUrl = requestUrlWithDefaultDocument(req.url).toLowerCase();

			if (!useTemplating(requestUrl)) {
				winston.debug(requestUrl + ' not templatable for ' + environment.name + ', skipping');
				next();
				return;
			};

			var lookupUrl = requestUrl.replace('.html', '.json');
			winston.debug('request for: ' + req.url);
			var fullPath = pathWithDefaultDocument(environment.dirPath, requestUrl);
			var relativePath = path.relative(fullBasePath, fullPath);
			winston.debug('fullPath: ' + fullPath);
			winston.debug('relativePath: ' + relativePath);

			var pageData = jsonData[lookupUrl];

			if (pageData || req.url === '/') {

				winston.debug('Found data using ' + lookupUrl);
				fs.exists(fullPath, function(exists) {

					if (exists) {

						winston.debug(fullPath + ' found');
						var pageData = jsonData[lookupUrl];

						res.render(relativePath, {
							pageData: pageData
						});

					} else {

						winston.debug(fullPath + ' not found');
						next();

					}

				});

			} else {

				winston.debug('No data found for ' + lookupUrl);
				next();

			}

		});

	});

	environments.forEach(function(environment) {

		winston.info('Configuring static server for ' + environment.name);

		connectApp.use(connect.static(environment.dirPath), {
			maxAge: 0
		});

	});

	connectApp.listen(bratwurstServer.options.port);
	winston.info('Listening on port ' + bratwurstServer.options.port);

}