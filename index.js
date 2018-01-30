const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const fbaCompiler = require('fba-compiler');
const copier = require('./lib/copier.js');

const debug = require('debug');
var log = debug('wp-plugin-assets');


function AssetsPlugin(DM, options) {
	this.DM = DM;
	this.options = options;
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
	compiler.plugin('emit', (compilation, callback) => {
		var promises = [];
		
		// can take in an array that'll be populated w/ binary assets found by Rollup
		var fbaAssets = this.options.importStore || [];

		// if any of the asset-payloads are dirty, the whole fba needs to be recompiled
		var isDirty = false;
		for (var i in this.options.assets) {
			const payload = this.options.assets[i].payload();
			if (payload.dirty) {
				isDirty = true;
				break;
			}
		}

		// iterate assets
		for (var i in this.options.assets) {
			const payload = this.options.assets[i].payload();
			payload.type = payload.type || 'copy';
			
			// if payload type is an fba chunk-type
			if (payload.type.match(/^fbA/i)) {
				if (isDirty || payload.dirty) {
					// append content to fba-compiler
					payload.modules.forEach((_module) => {
						fbaAssets.push({
							chunkType: payload.type,
							path: _module.userRequest
						});
					});
				}
			}

			// if payload type is inline
			else if (payload.type == 'inline') {
				if (payload.dirty) {
					log('Inlining ->');
					payload.modules.forEach((_module) => {
						log(` ${_module.userRequest}`);
					});
				}
			}

			// if payload type is copy
			else {
				if (payload.dirty) {
					// copy the asset to deploy
					promises.push(
						copier.copy(
							payload.modules, 
							this.options.assets[i].copy
						)
					);				
				}
			}

			// mark this payload clean
			if (payload.name) {
				this.DM.payload.store.update({
					name: payload.name,
					dirty: false
				});
			}
		}

		// compile all the assets
		if (fbaAssets.length) {
			var payloadOutput = this.DM.payload.get().output;
			promises.push(
				fbaCompiler.compile({
					target: path.resolve(`${payloadOutput.path}/${payloadOutput.filename}`),
					assets: fbaAssets
				})
			);
		}

		// TODO: <img> and background-image declarations would have to be rewritten to payload blobs

		// return to webpack flow
		Promise.all(promises).then(() => {
			callback();
		})
		.catch((err) => {
			log(err);
		});		
	});
};




module.exports = AssetsPlugin;