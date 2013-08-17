#! /usr/bin/env node

/*

	TODO
	------------------------------------------------------------------------------------------------

	HIGH PRIORITY

		Include HTML templating and copying in the build process

	MEDIUM PRIORITY

		Create grunt CLI commands in main gruntfile to run server / build process
		
	LOW PRIORITY

		Tidy it up more
		Make it work as a grunt plugin

*/

var path = require('path'),
	Gaze = require('gaze').Gaze,
	url = require('url'),
	winston = require('winston'),
	program = require('commander'),
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
	.option('-b, --base-path [basePath]', 'Base Path [./]', './')
	.option('-p, --port [port]', 'Port [9020]', 9020)
	.option('-a, --api-url [apiUrl]', 'Url to the api server [http://localhost:9000/api]', 'http://localhost:9000/api')
	.option('-g, --log-level [level]', 'Set the loglevel [info]', 'info')
	.action(function() {
	commandExecuted = true;
	setupLogger(serverCommand.logLevel);
	var BratwurstServer = require('./lib/bratwurst-server');
	var server = new BratwurstServer(serverCommand);
	server.on('usageIssue', function() {
		serverCommand.help();
	});
	server.start();
});

var buildCommand = program.command('build')
	.description('run build pipeline')
	.option('-e, --environments <environments>', 'Specify the environment paths in a comma separated list')
	.option('-t, --buildPath <buildPath>', 'Specify the build path target directory')
	.option('-b, --base-path [basePath]', 'Base Path [./]', './')
	.option('-g, --log-level [level]', 'Set the loglevel [info]', 'info')
	.action(function() {
	commandExecuted = true;
	setupLogger(buildCommand.logLevel);
	var BratwurstBuilder = require('./lib/bratwurst-builder');
	var builder = new BratwurstBuilder(buildCommand);
	builder.on('usageIssue', function() {
		buildCommand.help();
	});
	builder.start();
});

program.parse(process.argv);

if (!commandExecuted) {
	program.help();
}