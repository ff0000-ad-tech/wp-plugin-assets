const hasModuleReason = targetModule => module => {
	const moduleReasons = module.reasons
	return moduleReasons.some(reason => {
		return reason.module === targetModule
	})
}

function getDepsWithModuleReason(modulesArr, moduleReason) {	
	return modulesArr
		.filter(hasModuleReason(moduleReason))
		.map(module => module.resource)
}

module.exports = getDepsWithModuleReason
