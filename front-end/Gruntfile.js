module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		includeSource: {
			include: {
				files: '<%= pkg.files.src %>'
			},
			target: {
				files: {
					'squt.html': 'squt.html'
				}
			}
		},
		uglify: {
			build: {
				files: [{
					src: '<%= pkg.files.src %>',
					dest: 'build/<%= pkg.name %>.js'
				}]
			},
			options: {
				banner: '/*! Generated <%= grunt.template.today("yyyy-mm-dd HH:MM:ss") %> */\n'
			}
		}
	});

	grunt.config('env', grunt.option('env') || process.env.GRUNT_ENV || 'ci');


	var tasks = [];
	if(grunt.config('env') === 'ci') {
		grunt.loadNpmTasks('grunt-include-source');
		tasks.push('includeSource');
	}

	grunt.loadNpmTasks('grunt-contrib-uglify');
	tasks.push('uglify');

	// Default task(s).
	grunt.registerTask('default', tasks);

};
