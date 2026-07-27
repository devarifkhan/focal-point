// Do this as the first thing so that any code reading it knows the right env.
const envArg = process.argv[2] || 'production';
process.env.BABEL_ENV = envArg;
process.env.NODE_ENV = envArg;
process.env.ASSET_PATH = '/';

console.log(`Building for ${envArg} environment`);

var webpack = require('webpack'),
  path = require('path'),
  fs = require('fs'),
  config = require('../webpack.config'),
  ZipPlugin = require('zip-webpack-plugin');

delete config.chromeExtensionBoilerplate;

// Ensure config.mode is set correctly
config.mode = ['production', 'qa'].includes(envArg) ? 'production' : 'development';

// For debugging
console.log(`Webpack mode: ${config.mode}, Environment: ${envArg}`);

var packageInfo = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

// Ensure we create unique zip files for each environment
let zipFilename;
if (envArg === 'qa') {
  zipFilename = `${packageInfo.name}-${packageInfo.version}-qa.zip`;
} else if (envArg === 'development') {
  zipFilename = `${packageInfo.name}-${packageInfo.version}-development.zip`;
} else {
  zipFilename = `${packageInfo.name}-${packageInfo.version}-production.zip`;
}

console.log(`Creating zip file: ${zipFilename}`);

config.plugins = (config.plugins || []).concat(
  new ZipPlugin({
    filename: zipFilename,
    path: path.join(__dirname, '../', 'zip'),
  })
);

webpack(config, function (err, stats) {
  if (err) {
    console.error('Webpack compilation error:', err);
    throw err;
  }
  
  if (stats.hasErrors()) {
    console.error('Webpack compilation errors:');
    console.error(stats.toString({ colors: true, errors: true, warnings: false }));
    process.exit(1);
  }
  
  if (stats.hasWarnings()) {
    console.warn('Webpack compilation warnings:');
    console.warn(stats.toString({ colors: true, errors: false, warnings: true }));
  }
  
  console.log(`Build completed for ${envArg} environment`);
  console.log('Build output:', stats.toString({ colors: true, chunks: false, modules: false }));
});
