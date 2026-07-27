# Environment Setup for Focusly.pro Chrome Extension

This document explains how to build and deploy the Focusly.pro Chrome Extension for different environments.

## Environment Configuration

The extension supports three environments:

1. **Development** (block.shadhintech.com)
2. **QA** (qa.focusly.pro)
3. **Production** (app.focusly.pro)

Each environment has its own configuration file located in `src/config/environments/`.

## Building for Different Environments

### Development Build

```bash
npm run build:dev
```

This will create a build that connects to the development API at `https://block.shadhintech.com/productivity-api`.

### QA Build

```bash
npm run build:qa
```

This will create a build that connects to the QA API at `https://qa.focusly.pro/productivity-api`.

> **Note:** If you encounter issues with the QA zip file not being created, you can use this convenience script:
> ```bash
> npm run fix:qa-zip
> ```

### Production Build

```bash
npm run build
# or
npm run build:prod
```

This will create a build that connects to the production API at `https://app.focusly.pro/productivity-api`.

### Building All Environments at Once

```bash
npm run build:all
```

This will build the extension for all environments (development, QA, and production) in sequence.

## Build Output

All builds are output to the `build/` directory. A zip file is also created in the `zip/` directory with the format:

```
focusly-[version]-[environment].zip
```

For example: `focusly-5.0.4-production.zip`

## Development Server

To run the development server with hot reloading:

```bash
npm start
```

This will run the extension in development mode connecting to the development environment.

## Modifying Environment Configurations

If you need to modify the configurations for any environment, update the relevant file in:

- `src/config/environments/development.js`
- `src/config/environments/qa.js`
- `src/config/environments/production.js`

## Adding a New Environment

To add a new environment:

1. Create a new configuration file in `src/config/environments/`
2. Update `src/config/config.js` to include the new environment
3. Add a new build script in `package.json`
4. Update the `utils/build.js` script if necessary 