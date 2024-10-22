const alreadyBuildDepencyList: Record<string, string> = {}

export function generateRecrusivePattern(
  code: string,
  recursiveDependencies: Record<string, string[]>,
  dependencies: string[],
): { template: string; usage: string } {
  // Helper function to extract the variable name (e.g., 'Category')
  function extractName(code: string): string | undefined | null {
    const typeMatch = code.match(/export\s+type\s+(\w+)/)
    const constMatch = code.match(/export\s+const\s+(\w+)/)
    return typeMatch ? typeMatch[1] : constMatch ? constMatch[1] : null
  }

  // Helper function to remove export statements and retain the core Type.Object part
  function removeExports(code: string): string {
    return code.replace(/export\s+type\s+.*/g, '').replace(/export\s+const\s+\w+\s+=\s+/, '')
  }

  // Helper function to replace dependencies with 'ref1', 'ref2', etc., in the template part
  function replaceDependenciesInTemplate(code: string, recursiveDependencies: string[]): string {
    let result = code
    recursiveDependencies.forEach((dep, index) => {
      const depRef = `ref${index + 1}`
      const depRegex = new RegExp(`\\b${dep}\\b`, 'g') // Match the dependency as a whole word
      result = result.replace(depRegex, depRef)
    })
    return result
  }

  // Helper function to build the template part with correct type constraints and multiple references
  function buildTemplatePart(code: string, name: string, recursiveDependencies: Record<string, string[]>): string {
    const cleanedCode = removeExports(code) // Clean the code to remove export statements
    const recursiveDependenciesList = Object.keys(recursiveDependencies)
    const templateCode = replaceDependenciesInTemplate(cleanedCode, recursiveDependenciesList)

    // Create the template function signature
    const refParams = recursiveDependenciesList.map((_, index) => `pRef${index + 1} extends TSchema`).join(', ')
    const refArgs = recursiveDependenciesList.map((_, index) => `ref${index + 1}: pRef${index + 1}`).join(', ')

    return `const __${name} = <${refParams}>(${refArgs}) => ${templateCode.trim()};`
  }

  // Helper function to build the usage part by injecting actual dependencies
  function buildUsagePart(
    name: string,
    recursiveDependencies: Record<string, string[]>,
    dependencies: string[],
  ): string {
    const recursiveDependenciesList = Object.keys(recursiveDependencies)
    const refCalls = recursiveDependenciesList
      .map(dep => {
        if (dependencies.includes(dep)) {
          return `${dep}`
        }

        if (recursiveDependencies[dep]!.length === 0) {
          return `__${dep}(This)`
        }

        const depCalls = recursiveDependencies[dep]!.map(subDep => {
          if (subDep === name) {
            return `This`
          }
          if (dependencies.includes(subDep)) {
            return `${subDep}`
          }
          return `__${subDep}(This)`
        })
        if (alreadyBuildDepencyList[dep]) return alreadyBuildDepencyList[dep]

        return `__${dep}(${depCalls.join(', ')})`
      })
      .join(', ')

    alreadyBuildDepencyList[name] = ` __${name}(${refCalls})`
    return `export const ${name} = Type.Recursive((This) => __${name}(${refCalls}));\nexport type ${name} = Static<typeof ${name}>;`
  }

  // Extract the name of the type/variable (e.g., 'Category')
  const name = extractName(code)
  if (!name) {
    throw new Error('Could not extract type or variable name from the code block.')
  }

  // Create template and usage parts
  const template = buildTemplatePart(code, name, recursiveDependencies)
  const usage = buildUsagePart(name, recursiveDependencies, dependencies)

  return { template, usage }
}
