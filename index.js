const path = require('path')

const filterer = require('./lib/filterer.js')
const copier = require('./lib/copier.js')

const debug = require('@ff0000-ad-tech/debug')
var log = debug('wp-plugin-assets')

const pluginName = 'FAT Assets Plugin'

function AssetsPlugin(DM, options) {
	log(`Preparing wp-plugin-assets`)
	this.DM = DM
	this.options = options
	this.aggregators = this.options.aggregators.map((aggregator) => {
		aggregator.filterer = filterer.getFilterFactory(aggregator)
		return aggregator
	})

	/** TODO
			Document `this.options`:

			this.options.assets = [
				{
					payload: [
						// payload objects (see wp-plugin-payload)
						{
							modules: [] // subpaths to file locations
						}
					],
					copy: {
						from: './source-context',
						to: './destination-context'
					}
				}
			]
	*/
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
			log({ type: aggregator.filter.type })
			const sources = this.DM.payload.store.getSourcesBy(aggregator.filter.type)
			log({ sources })
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
		// var promises = []
		// var fbaAssets = []
		// iterate assets
		const promises = this.options.emitters.map(async (emitter) => {
			if (!emitter.copy) {
				return
			}
			log({ sources: emitter.copy.sources() })
			return await copier.copy(emitter.copy.sources(), emitter.copy)
		})

		// payload.type = payload.type || 'copy'

		// if payload type is an fba chunk-type
		// if (payload.type.match(/^fbA/i)) {
		// 	if (this.DM.payload.store.anyDirty()) {
		// 		Object.keys(payload.modules).forEach((path) => {
		// 			fbaAssets.push({
		// 				chunkType: payload.type,
		// 				path: path
		// 			})
		// 		})
		// 	}
		// } else if (payload.type == 'inline') {
		// 	// if payload type is inline
		// 	log('Inlining ->')
		// 	Object.keys(payload.modules).forEach((path) => {
		// 		log(` ${path}`)
		// 	})
		// } else {
		// copy the asset to deploy
		// promises.push()
		// }

		// compile all the assets
		// const { context, filename } = this.options.fba.output
		// if (!this.options.fba.base64Inline && fbaAssets.length) {
		// 	promises.push(
		// 		fbaCompiler.compile({
		// 			target: path.resolve(`${context}/${filename}`),
		// 			assets: fbaAssets
		// 		})
		// 	)
		// }

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
