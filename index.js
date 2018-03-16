const fs = require('fs')
const path = require('path')
const _ = require('lodash')

const fbaCompiler = require('@ff0000-ad-tech/fba-compiler')
const createBinaryImporter = require('binary-imports')
const copier = require('./lib/copier.js')

const debug = require('debug')
var log = debug('wp-plugin-assets')

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

function getDepsWithState(initState) {
	const { resourceStack = [], modulesByResource, buildDeps = [], seenModules = {} } = initState

	if (!resourceStack.length) {
		return initState
	}

	const currResource = resourceStack[resourceStack.length - 1]
	const currModule = modulesByResource[currResource]

	if (currModule && !seenModules[currResource]) {
		seenModules[currResource] = true
		const depModules = currModule.dependencies.map(d => d.module).filter(a => a)
		const depResources = depModules.map(dm => dm.resource)
		const newBuildDeps = buildDeps.concat(depResources)
		const newResourceStack = resourceStack
			// remove currModule from stack
			.slice(0, -1)
			// put subdeps on stack
			.concat(depResources)
		const newState = getDepsWithState({
			resourceStack: newResourceStack,
			buildDeps: newBuildDeps,
			modulesByResource,
			seenModules
		})
		return newState
	}

	return initState
}

function getDepsRecursively(topResource, modulesByResource) {
	const result = getDepsWithState({
		resourceStack: [topResource],
		modulesByResource
	})
	const { buildDeps } = result
	return buildDeps.filter(a => a)
}

AssetsPlugin.prototype.apply = function(compiler) {
	compiler.plugin('compile', () => {
		// reset binary assets store on each compile
		this.DM.payload.store.reset()
	})

	compiler.plugin('after-compile', (compilation, callback) => {
		const { buildEntry } = this.options
		const buildModule = compilation.modules.find(m => m.resource && m.resource === buildEntry)

		/*
			Gathering all of the filepaths within the build's dependency graph to pass into
			a function which filters out non-binary assets and formats binary assets
			for the FBA compiler

			When using the Rollup Babel loader (i.e. production settings),
			this Array should contain all of the build's dependencies in a flat array
		*/
		const fileDeps = buildModule.fileDependencies

		/* 
			However, when using just the Babel loader (i.e. debug settings),
			the other dependencies are not included in the prior array

			So we'll need to search for these recursively
		*/
		const modulesByResource = compilation.modules.reduce((accum, module) => {
			if (module.resource) {
				accum[module.resource] = module
			}
			return accum
		}, {})
		const recursivelyFoundResources = getDepsRecursively(buildEntry, modulesByResource)

		const allFileDeps = fileDeps.concat(recursivelyFoundResources)

		allFileDeps.forEach(this.loadBinaryImports)

		callback()
	})

	compiler.plugin('emit', (compilation, callback) => {
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
