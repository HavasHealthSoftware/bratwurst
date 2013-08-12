var readdirp = require('readdirp'),
	path = require('path')
	fs = require('fs'),
	winston = require('winston');

module.exports = {

	// TODO - decide if the rootDir here should be a drive path rather than a relative path
	getJsonFiles: function(rootDir, initialData, callback) {

		var _virtualRootDir = path.join(rootDir + '/views');
		winston.debug('configBuilder using virtualRootDir: ' + _virtualRootDir);
		readdirp({
			root: path.join(_virtualRootDir),
			fileFilter: '*.json'
		}, function(err, data) {
			var fileData = initialData || {};

			// TODO - async this, and make it incremental
			data.files.forEach(function(file) {
				var relativePath = path.normalize(path.relative(rootDir, file.fullPath));
				relativePath = relativePath.replace(/\\/g, '/');
				relativePath = '/' + relativePath;
				relativePath = relativePath.toLowerCase();

				var jsonData = JSON.parse(fs.readFileSync(file.fullPath, 'utf8'));
				var relativePathData = fileData[relativePath];
				relativePathData = jsonData;
				winston.debug('Setting key at ' + relativePath + ' in config file');
				fileData[relativePath] = relativePathData;
			});
			
			callback(null, fileData);
		});

	}

};