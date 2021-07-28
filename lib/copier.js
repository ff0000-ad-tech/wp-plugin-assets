const fs = require('fs')
const ncp = require('ncp').ncp
const path = require('path')
const mkdirp = require('mkdirp')

const debug = require('@ff0000-ad-tech/debug')
var log = debug('wp-plugin-assets:copier')

const copy = async (sources, options) => {
	log('Emitting ->')
	// each source
	await Promise.all(
		sources.map((source) => {
			// source path
			const sourcePath = options.context ? path.normalize(`${options.context}/${source}`) : source
			// prepare target folder
			const targetPath = path.normalize(`${options.to}/${path.basename(source)}`)
			if (!fs.existsSync(path.dirname(targetPath))) {
				mkdirp.sync(path.dirname(targetPath))
			}
			// copy
			log(` ${targetPath}`)
			return new Promise((resolve, reject) => {
				ncp(sourcePath, targetPath, (err) => {
					if (err) {
						log(err)
					}
					resolve()
				})
			})
		})
	)
}

module.exports = {
	copy
}
