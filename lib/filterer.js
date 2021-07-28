const { createFilter } = require('rollup-pluginutils')

const debug = require('@ff0000-ad-tech/debug')
const log = debug('wp-plugin-assets:filterer')

/**
 * patterns that can be used w/ rollup-plugin-utils' createFilter util
 * (see: https://github.com/rollup/rollup-pluginutils)

 * @param {aggregator} function (required)
 *	a callback that will store discovered fba-assets
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
