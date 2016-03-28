module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/* <%= pkg.name %> - v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %> \n ' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %>  <%= pkg.author %> \n ' +
        '*  License: <%= pkg.license %> \n ' +
        '*/ \n'
      },
      build: {
        files: [{
          src: '*.js',
          cwd:'src/',
          dest: 'dist', 
          expand:true,
          ext: '.js',  
          extDot:'last'
        }]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('default', ['uglify']);

};