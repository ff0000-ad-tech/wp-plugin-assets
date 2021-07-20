const { createFilter } = require('rollup-pluginutils')

const debug = require('@ff0000-ad-tech/debug')
const log = debug('wp-plugin-assets:lib:aggregator')

const TYPE_IMAGE = {
	type: 'fba-image',
	include: /\.(png|jpg|gif|svg)(\?.*)?$/
}

const TYPE_FONT = {
	type: 'fba-font',
	include: /\.(ttf|woff)(\?.*)?$/
}

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

const createAggregator = (aggregator) => {
	if (!aggregator) {
		throw new Error(`createAggregator requires an external aggregator function`)
	}
	// build getChunkType function once for speed
	const getChunkType = createGetChunkTypeFactory([TYPE_IMAGE, TYPE_FONT])

	// return factory
	return (filepath) => {
		const chunkType = getChunkType(filepath)
		if (!chunkType) {
			return
		}
		// store fba asset-ref for later
		log({ filepath })
		aggregator({
			chunkType,
			path: filepath
		})
	}
}

const createGetChunkTypeFactory = (types) => {
	const filters = types.map(createFilterFactory)
	return (importPath) => {
		for (const filter of filters) {
			const type = filter(importPath)
			if (type) {
				return type
			}
		}
	}
}
const createFilterFactory = (types) => {
	const { include, exclude, type } = types
	const filter = createFilter(include, exclude)
	return (importPath) => (filter(importPath) ? type : null)
}

module.exports = {
	createAggregator
}
