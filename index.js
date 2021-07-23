const path = require('path')

const fbaCompiler = require('@ff0000-ad-tech/fba-compiler')

const filterer = require('./lib/filterer.js')
const copier = require('./lib/copier.js')

const debug = require('@ff0000-ad-tech/debug')
var log = debug('wp-plugin-assets')

const pluginName = 'FAT Assets Plugin'

function AssetsPlugin(DM, options) {
	log(`Preparing wp-plugin-assets`)
	this.DM = DM
	this.options = options
	// prepare filteres to apply discovered assets to DM.store
	// see wp-deploy-manager/lib/plugins/asset-config... files for more info
	this.aggregators = this.options.aggregators.map((aggregator) => {
		aggregator.filterer = filterer.getFilterFactory(aggregator)
		return aggregator
	})
}

AssetsPlugin.prototype.apply = function (compiler) {
	/**
	 * Webpack Hooks: Compile
	 *
	 * Reset the payload store
	 *
	 *
	 */
	compiler.hooks.compile.tap(pluginName, () => {
		// reset binary assets store on each compile
		this.DM.payload.store.reset()
	})

	/**
	 * Webpack Hooks: After Compile
	 *
	 * Look for dependencies that can be binary-bundled
	 *
	 *
	 */
	compiler.hooks.afterCompile.tapAsync(pluginName, (compilation, callback) => {
		// gather a list of dependency filepaths, in order to search for fba-assets
		const filepaths = []
		// https://webpack.js.org/contribute/plugin-patterns/#exploring-assets-chunks-modules-and-dependencies
		compilation.chunks.forEach((chunk) => {
			this.aggregators.forEach((aggregator) => {
				if (chunk.name === aggregator.entry) {
					chunk.getModules().forEach((module) => {
						module.buildInfo &&
							module.buildInfo.fileDependencies &&
							module.buildInfo.fileDependencies.forEach((filepath) => {
								filepaths.push(filepath)
							})
					})
				}
			})
		})
		// filter and send appropriate assets to their respective stores
		filepaths.forEach((filepath) => {
			this.aggregators.forEach((aggregator) => aggregator.filterer(filepath))
		})
		// if there were assets, update ad.settings with the asset filenames
		this.aggregators.forEach((aggregator) => {
			const sources = this.DM.payload.store.getSourcesBy(aggregator.filter.type)
			const relativePaths = sources.map((source) => {
				return path.normalize(`${aggregator.filter.type}/${path.basename(source)}`)
			})
			aggregator.setter(relativePaths)
		})
		callback()
	})

	/**
	 * Webpack hook: Emit
	 *
	 * Generate binary FBA-bundle, if requested
	 *
	 *
	 */
	compiler.hooks.emit.tapAsync(pluginName, (compilation, callback) => {
		const promises = []
		const fbaAssets = []
		// iterate assets
		this.options.emitters.forEach(async (emitter) => {
			// will bundle assets in binary payload
			if (emitter.fba) {
				log('FBA Assembling ->')
				log({ fba: emitter.fba.sources() })
				emitter.fba.sources().forEach((assetPath) => {
					fbaAssets.push({
						output: emitter.fba.to,
						chunkType: emitter.fba.type,
						path: assetPath
					})
				})
			}
			// will load assets at runtime, so copy them to dist
			if (emitter.copy) {
				promises.push(copier.copy(emitter.copy.sources(), emitter.copy))
			}
			// will inline the assets as base64
			if (emitter.inline) {
				log('Inlining ->')
				log({ inline: emitter.inline.sources() })
				Object.keys(emitter.inline.sources().modules).forEach((path) => {
					log(` ${path}`)
				})
			}
		})
		log({ dirty: this.DM.payload.store.anyDirty(), assets: fbaAssets.length })
		// compile all the assets
		// only recompile if assets were updated
		if (fbaAssets.length && this.DM.payload.store.anyDirty()) {
			log('FBA Compiling ->')
			promises.push(fbaCompiler.compile(fbaAssets))
		}
		// return to webpack flow
		Promise.all(promises)
			.then(() => {
				callback()
			})
			.catch((err) => {
				log(err)
			})
	})
}

module.exports = AssetsPlugin
