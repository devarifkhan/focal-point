// Determine which environment to use based on NODE_ENV
const ENV = process.env.NODE_ENV || 'development';

// Import the appropriate environment configuration
let config;
if (ENV === 'production') {
  config = require('./environments/production');
} else if (ENV === 'qa') {
  config = require('./environments/qa');
} else {
  config = require('./environments/development');
}

// Export all configuration variables
export const maintenance = config.maintenance;
export const DEFAULT_LANGUAGE = config.DEFAULT_LANGUAGE;
export const IMAGE_BASE_URL = config.IMAGE_BASE_URL;
export const API_BASE_URL = config.API_BASE_URL;
export const WEBSOCKET_BASE_URL = config.WEBSOCKET_BASE_URL;

// For debugging
console.log(`Config loaded for ${ENV} environment:`, {
  IMAGE_BASE_URL: config.IMAGE_BASE_URL,
  API_BASE_URL: config.API_BASE_URL
});
