
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

	return getDepsWithState({
		resourceStack: resourceStack.slice(0, -1),
		buildDeps,
		modulesByResource,
		seenModules
	})
}

function getDepResourcesOnBuildEntry(topResource, modulesByResource) {
	const result = getDepsWithState({
		resourceStack: [topResource],
		modulesByResource
	})
	const { buildDeps } = result
	return buildDeps.filter(a => a)
}

module.exports = getDepResourcesOnBuildEntry
