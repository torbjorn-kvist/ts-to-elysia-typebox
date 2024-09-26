import * as ts from 'typescript'

/**
 * Removes the optional modifier (`?`) from properties that are arrays in an InterfaceDeclaration.
 * @param interfaceNode The interface declaration to process.
 * @returns A new InterfaceDeclaration with optional removed from array properties.
 */
function removeOptionalFromArrayProperties(interfaceNode: ts.InterfaceDeclaration): ts.InterfaceDeclaration {
  // Map through each member of the interface
  const updatedMembers = interfaceNode.members.map(member => {
    // Ensure it's a property signature and it has a question mark (i.e., optional)
    if (ts.isPropertySignature(member) && member.questionToken && member.type) {
      const isArray = ts.isArrayTypeNode(member.type)

      // If the type is an array, remove the optional modifier (question mark)
      if (isArray) {
        return ts.factory.updatePropertySignature(
          member,
          member.modifiers,
          member.name,
          undefined, // This removes the optional modifier
          member.type,
        )
      }
    }

    return member
  })

  // Return a new InterfaceDeclaration with the updated members
  return ts.factory.updateInterfaceDeclaration(
    interfaceNode,
    interfaceNode.modifiers,
    interfaceNode.name,
    interfaceNode.typeParameters,
    interfaceNode.heritageClauses,
    updatedMembers,
  )
}

// Example usage

const sourceCode = `
export interface Provider {
  id?: string;
  categories?: (string | Category)[];
  bio?: string;
}
`

const sourceFile = ts.createSourceFile('temp.ts', sourceCode, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)

// Find the interface in the source file
const interfaceNode = sourceFile.statements.find(
  stmt => ts.isInterfaceDeclaration(stmt) && stmt.name.text === 'Provider',
) as ts.InterfaceDeclaration

// Apply transformation to remove optional from array properties
const updatedInterface = removeOptionalFromArrayProperties(interfaceNode)

// Print the transformed result
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
const result = printer.printNode(ts.EmitHint.Unspecified, updatedInterface, sourceFile)

console.log(result)
