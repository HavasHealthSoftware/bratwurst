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

var path = require('path'),
	Gaze = require('gaze').Gaze,
	url = require('url'),
	winston = require('winston'),
	program = require('commander'),
	BratwurstServer = require('./lib/bratwurst-server'),
	bratwurstBuild = require('./lib/build')
	util = require('util');

// Setup logger
function setupLogger(logLevel){
	winston.config.npm.colors.debug = winston.config.npm.colors.info;
	winston.config.npm.colors.info = 'magenta';
	winston.setLevels(winston.config.npm.levels);
	winston.addColors(winston.config.npm.colors);
	winston.remove(winston.transports.Console);
	winston.add(winston.transports.Console, {
		colorize: true,
		level: logLevel
	});
}

program
	.version('0.0.6')

var commandExecuted = false;

var serverCommand = program.command('server')
	.description('run dev server')
	.option('-e, --environments <environments>', 'Specify the environment paths in a comma separated list')
	.option('-l, --locale <locale>', 'Specify the locale')
	.option('-p, --port [port]', 'Port [9020]', 9020)
	.option('-b, --base-path [basePath]', 'Base Path [./]', './')
	.option('-a, --api-url [apiUrl]', 'Url to the api server [http://localhost:9000/api]', 'http://localhost:9000/api')
	.option('-g, --log-level [level]', 'Set the loglevel [info]', 'info')
	.action(function() {
	commandExecuted = true;
	setupLogger(serverCommand.logLevel);
	var server = new BratwurstServer(serverCommand);
	server.on('usageIssue', function() {
		serverCommand.help();
	});
	server.start();
});

program.command('build')
	.description('run build pipeline')
	.option('-e, --environments <environments>', 'Specify the environment paths in a comma separated list')
	.action(function() {
	console.log('build');
});

program.parse(process.argv);

if (!commandExecuted) {
	program.help();
}