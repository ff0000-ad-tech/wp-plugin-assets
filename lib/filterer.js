const { createFilter } = require('rollup-pluginutils')

const debug = require('@ff0000-ad-tech/debug')
const log = debug('wp-plugin-assets:lib:aggregator')

// const TYPE_IMAGE = {
// 	type: 'fba-image',
// 	include: /\.(png|jpg|gif|svg)(\?.*)?$/
// }

// const TYPE_FONT = {
// 	type: 'fba-font',
// 	include: /\.(ttf|woff)(\?.*)?$/
// }

/**
 * @param {fbaType[]} fbaTypes (required)
 * fbaType: {
 * 	type: 'image' or 'font',
 * 	include: [minimatch patterns],
 * 	exclude: [minimatch patterns]
 * }
 * patterns that can be used w/ rollup-plugin-utils' createFilter util
 * (see: https://github.com/rollup/rollup-pluginutils)

 * @param {aggregator} function (required)
 *	a callback that will store discovered fba-assets
 *
 */

const getFilterFactory = (aggregator) => {
	if (!aggregator) {
		throw new Error(`createFilterer requires an external aggregator function`)
	}
	// build getChunkType function once for speed
	const getChunkType = createGetChunkTypeFactory(aggregator.filter)

	// return factory
	return (filepath) => {
		const chunkType = getChunkType(filepath)
		if (!chunkType) {
			return
		}
		// store fba asset-ref for later
		log({ filepath })
		aggregator.store(chunkType, filepath)
	}
}

const createGetChunkTypeFactory = (filter) => {
	const { include, exclude, type } = filter
	const rollupFilter = createFilter(include, exclude)
	return (importPath) => {
		const chunkType = rollupFilter(importPath) ? type : null
		if (chunkType) {
			return chunkType
		}
	}
}
module.exports = {
	getFilterFactory
}
