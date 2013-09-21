var readdirp = require('readdirp'),
	path = require('path'),
	fs = require('fs'),
	winston = require('winston');

module.exports = {

	getJsonFiles: function(rootDir, initialData, callback) {

		//		var _virtualRootDir = path.join(rootDir + '/views');
		winston.debug('configBuilder using virtualRootDir: ' + rootDir);
		readdirp({
			root: path.resolve(rootDir),
			fileFilter: '*.json',
			directoryFilter: ['!node_modules', '!bower_components', '!config']
		}, function(err, data) {
			var fileData = initialData || {};

			// TODO - async this, and make it incremental
			data.files.forEach(function(file) {
				try {
					var relativePath = path.normalize(path.relative(rootDir, file.fullPath));
					relativePath = relativePath.replace(/\\/g, '/');
					relativePath = '/' + relativePath;
					relativePath = relativePath.toLowerCase();

					var jsonData = JSON.parse(fs.readFileSync(file.fullPath, 'utf8'));
					var relativePathData = fileData[relativePath];
					relativePathData = jsonData;
					winston.debug('Setting key at ' + relativePath + ' in config file');
					fileData[relativePath] = relativePathData;
				} catch (error) {
					winston.error('Error parsing file %s - %s', file.fullPath, error.message);
				}

			});

			callback(null, fileData);
		});

	}

};