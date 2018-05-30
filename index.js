const fs = require('fs')
const path = require('path')
const _ = require('lodash')

const fbaCompiler = require('@ff0000-ad-tech/fba-compiler')
const createBinaryImporter = require('@ff0000-ad-tech/binary-imports')
const copier = require('./lib/copier.js')
const getDepsFromModule = require('./lib/getDepsFromModule.js')
const getDepsWithModuleReason = require('./lib/getDepsWithModuleReason.js')

const findAllKeys = require('find-all-keys')
const debug = require('@ff0000-ad-tech/debug')
var log = debug('wp-plugin-assets')

const pluginName = 'FAT Assets Plugin'

function AssetsPlugin(DM, options) {
	if (!options.addBinaryAsset || !options.fbaTypes) {
		throw new Error('addBinaryAsset function and array of FBA types are needed to load binary assets into FBA payload')
	} else if (!options.buildEntry) {
		throw new Error("Assets Plugin requires the path to the 'build' entry")
	}

	this.DM = DM
	this.options = options
	this.loadBinaryImports = createBinaryImporter(options.fbaTypes, options.addBinaryAsset)

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

AssetsPlugin.prototype.apply = function(compiler) {
	compiler.hooks.compile.tap(pluginName, () => {
		// reset binary assets store on each compile
		this.DM.payload.store.reset()
	})

	compiler.hooks.afterCompile.tapAsync(pluginName, (compilation, callback) => {
		const { buildEntry } = this.options

		const buildModule = compilation.entries.find(m => m.resource && m.resource === buildEntry)
		/* 
			When using just the Babel loader (i.e. debug settings),
			the other dependencies are not included in the prior array

			So we'll need to search for these recursively
		*/
		const modulesByResource = compilation.modules.reduce((accum, module) => {
			if (module.resource) {
				accum[module.resource] = module
			}
			return accum
		}, {})
		const resourcesOnBuildEntry = getDepsFromModule(buildEntry, modulesByResource)

		/* 
			Build modules have to be found differently with the Rollup Babel loader.
			They can't be found as dependencies of the build.js entry
			so we'll have to check for compilation modules that list the build entry module
			as a ModuleReason
		*/
		const resourcesWithBuildEntryReason = getDepsWithModuleReason(compilation.modules, buildModule)

		const allDeps = resourcesOnBuildEntry.concat(resourcesWithBuildEntryReason)
		allDeps.forEach(this.loadBinaryImports)

		// if there were binary assets, update ad.settings with the payload filename
		if (this.DM.payload.store.anyFba()) {
			this.options.output.hasFbaAssets(this.options.output.filename)
		} else {
			this.options.output.hasFbaAssets(false)
		}

		callback()
	})

	compiler.hooks.emit.tapAsync(pluginName, (compilation, callback) => {
		var promises = []
		var fbaAssets = []

		const anyDirty = this.DM.payload.store.anyDirty()

		// iterate assets
		for (var i in this.options.assets) {
			const payload = this.options.assets[i].payload()
			if (!payload) continue

			payload.type = payload.type || 'copy'

			if (payload.type.match(/^fbA/i)) {
				// if payload type is an fba chunk-type
				if (anyDirty) {
					Object.keys(payload.modules).forEach(path => {
						fbaAssets.push({
							chunkType: payload.type,
							path: path
						})
					})
				}
			} else if (payload.type == 'inline') {
				// if payload type is inline
				log('Inlining ->')
				Object.keys(payload.modules).forEach(path => {
					log(` ${path}`)
				})
			} else {
				// copy the asset to deploy
				promises.push(copier.copy(payload.modules, this.options.assets[i].copy))
			}
		}

		// compile all the assets
		if (fbaAssets.length) {
			promises.push(
				fbaCompiler.compile({
					target: path.resolve(`${this.options.output.path}/${this.options.output.filename}`),
					assets: fbaAssets
				})
			)
		}

		// TODO: <img> and background-image declarations would have to be rewritten to payload blobs

		// return to webpack flow
		Promise.all(promises)
			.then(() => {
				callback()
			})
			.catch(err => {
				log(err)
			})
	})
}

module.exports = AssetsPlugin
