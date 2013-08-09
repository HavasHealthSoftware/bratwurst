var readdirp = require('readdirp'),
	path = require('path')
	fs = require('fs'),
	winston = require('winston');

module.exports = {

	// TODO - decide if the rootDir here should be a drive path rather than a relative path
	getJsonFiles: function(rootDir, virtualRootDir, initialData, callback) {

		var _rootDir = path.normalize(process.cwd() + '/' + rootDir);
		var _virtualRootDir = path.normalize(_rootDir + '/' + virtualRootDir);
		console.log(_virtualRootDir);
		readdirp({
			root: path.join(_virtualRootDir),
			fileFilter: '*.json'
		}, function(err, data) {
			var fileData = initialData || {};
				data.files.forEach(function(file) {
				var relativePath = path.normalize(path.relative(_rootDir, file.fullPath));
				relativePath = relativePath.replace(/\\/g, '/');
				relativePath = '/' + relativePath;
				winston.info('Setting key at ' + relativePath + ' in config file');
				fileData[relativePath] = JSON.parse(fs.readFileSync(file.fullPath, 'utf8'));
			});
			callback(null, fileData);
		});

	}

};