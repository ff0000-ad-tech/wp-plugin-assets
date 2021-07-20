const path = require('path')

const aggregator = require('./lib/aggregator.js')
const copier = require('./lib/copier.js')

const debug = require('@ff0000-ad-tech/debug')
var log = debug('wp-plugin-assets')

const pluginName = 'FAT Assets Plugin'

function AssetsPlugin(DM, options) {
	log(`Preparing wp-plugin-assets`)
	this.DM = DM
	this.options = options
	this.aggregator = aggregator.createAggregator(DM.payload.addBinaryAsset)

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
			if (chunk.name === this.options.fba.entry) {
				chunk.getModules().forEach((module) => {
					module.buildInfo &&
						module.buildInfo.fileDependencies &&
						module.buildInfo.fileDependencies.forEach((filepath) => {
							filepaths.push(filepath)
						})
				})
			}
		})
		// process each dependency as potential fba-asset
		filepaths.forEach(this.aggregator)
		// if there were assets, update ad.settings with the asset filenames
		if (this.DM.payload.store.anyAssets()) {
			const payloads = this.DM.payload.store.getAll()
			log({ payloads })
			this.options.fba.setAssetReqs(payloads)
		} else {
			// otherwise make sure the index does not try to load fba-payload
			this.options.fba.setAssetReqs()
		}
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
		var promises = []
		var fbaAssets = []
		// iterate assets
		for (var i in this.options.assets) {
			const payload = this.options.assets[i].payload()
			if (!payload) {
				continue
			}
			payload.type = payload.type || 'copy'

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
			promises.push(copier.copy(payload.modules, this.options.assets[i].copy))
			// }
		}

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
