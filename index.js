const fs = require('fs')
const path = require('path')
const _ = require('lodash')

const fbaCompiler = require('@ff0000-ad-tech/fba-compiler')
const copier = require('./lib/copier.js')

const debug = require('debug')
var log = debug('wp-plugin-assets')

function AssetsPlugin(DM, options) {
	this.DM = DM
	this.options = options
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
	compiler.plugin('compile', () => {
		// reset binary assets store on each compile
		this.DM.payload.store.reset()
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
