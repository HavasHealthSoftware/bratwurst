var fs = require('fs'),
	path = require('path'),
	winston = require('winston'),
	configBuilder = require('./configBuilder'),
	EventEmitter = require('events').EventEmitter,
	async = require('async'),
	deepMerge = require('deepmerge'),
	util = require('util'),
	ejs = require('ejs');

var BratwurstBuilder = function(options) {
	options = options || {};
	this.options = {
		environments: options.environments ? options.environments.split(',') : [],
		buildPath: options.buildPath,
		port: options.port,
		apiUrl: options.apiUrl,
		basePath: options.basePath || './'
	};
};

BratwurstBuilder.prototype = new EventEmitter();

BratwurstBuilder.prototype.start = function() {

	var usageIssue = false;

	winston.info('Starting bratwurst build agent');

	if (this.options.environments.length === 0) {
		winston.error('You must specify at least one environment');
		usageIssue = true;
	}

	if (!this.options.buildPath) {
		winston.error('You must specify an out directory');
		usageIssue = true;
	}

	if (usageIssue) {
		this.emit('usageIssue');
		return;
	}

	winston.debug('All required options are set');
	winston.debug(util.format('Options: %j', this.options));

	// start it... !!!
	startBuilder(this);

};

BratwurstBuilder.prototype.getEnvironmentDetails = function() {

	return this.options.environments.map(function(environment) {
		return {
			name: environment,
			dirPath: path.resolve(environment)
		};
	});

};

function startBuilder(bratwurstBuilder) {

	// bratwurst build -e src/cprm/locale/us,src/cprm/app -b src/cprm -t build/base/cprm
	var environments = bratwurstBuilder.getEnvironmentDetails(bratwurstBuilder.options);
	var basePath = path.resolve(bratwurstBuilder.options.basePath);
	var buildPath = path.resolve(bratwurstBuilder.options.buildPath);
	var reversedEnvironments = environments.slice(0).reverse();

	winston.info('Using basePath %s ', basePath);
	winston.info('Using buildPath %s', buildPath);

	var renderedFileCount = 0;
	bratwurstBuilder.on('getJsonFilesComplete', renderFiles);
	bratwurstBuilder.on('fileRendered', function(){
		renderedFileCount++;
	});
	bratwurstBuilder.on('templateFilesComplete', function() {
		winston.info('Rendering files complete - rendered %d files', renderedFileCount);
	});

	getJsonFiles();

	// Merge configs in reverse order

	function getJsonFiles() {

		var jsonFiles = {};

		async.mapSeries(reversedEnvironments, function(environment, callback) {
			configBuilder.getJsonFiles(environment.dirPath, {}, callback);
		}, function(err, results) {
			var mergedResults = results.reduce(function(previous, next) {
				return deepMerge(previous, next);
			});
			winston.info('Loaded JSON data');
			winston.debug(util.format(mergedResults));
			jsonFiles = mergedResults;
			bratwurstBuilder.emit('getJsonFilesComplete', jsonFiles);
		});
	}

	function renderFiles(jsonFiles) {

		winston.info('Rendering files started');

		var globalData = jsonFiles['/__global.json'];

		for (var jsonFile in jsonFiles) {

			winston.debug('Templating with data file %s', jsonFile);

			var htmlFilePath = path.join(buildPath, jsonFile.replace(/json/g, 'html'));

			if (fs.existsSync(htmlFilePath)) {
				winston.info('File %s exists, processing template', htmlFilePath);
				// TODO - render the file and save it to the same location
				var rawContent = fs.readFileSync(htmlFilePath, 'utf8');
				var renderedContent = ejs.render(rawContent, {
					pageData: jsonFiles[jsonFile],
					globalData: globalData
				});
				fs.writeFileSync(htmlFilePath, renderedContent);
				bratwurstBuilder.emit('fileRendered', htmlFilePath);
			} else {
				winston.info('File %s does not exist, skipping', htmlFilePath);
			}

		}

		bratwurstBuilder.emit('templateFilesComplete');

	}
}

module.exports = BratwurstBuilder;