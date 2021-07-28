##### 160over90 - Ad Technology

# Webpack Plugin - Assets

This plugin handles modules discovered by webpack and loaded by [@ff0000-ad-tech/fba-loader](https://github.com/ff0000-ad-tech/fba-loader).

Depending on Creative Server settings, these assets will be:

1. Declared in the `index.html`
2. Copied to `./3-traffic` for distribution

or

1. Bundled into a single `fba-payload.png`, see [@ff0000-ad-tech/fba-compiler](https://github.com/ff0000-ad-tech/fba-compiler) for more information.
