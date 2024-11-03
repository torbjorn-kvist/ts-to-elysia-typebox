import * as ts from 'typescript'

/**
 * Removes `null` from union types for optional properties in an InterfaceDeclaration.
 * @param node The interface declaration to process.
 * @returns A new InterfaceDeclaration with null removed from optional properties.
 */
export function removeNullFromOptionalProperties(interfaceNode: ts.InterfaceDeclaration): ts.InterfaceDeclaration {
  const updatedMembers = interfaceNode.members.map(member => {
    if (ts.isPropertySignature(member) && member.questionToken && member.type) {
      const updatedType = removeNullFromUnionIfOptional(member.type)
      return ts.factory.updatePropertySignature(
        member,
        member.modifiers,
        member.name,
        member.questionToken,
        updatedType,
      )
    } else if (ts.isPropertySignature(member) && member.type && ts.isTypeLiteralNode(member.type)) {
      const updatedType = updateTypeLiteralNode(member.type)
      return ts.factory.updatePropertySignature(
        member,
        member.modifiers,
        member.name,
        member.questionToken,
        updatedType,
      )
    }
    return member
  })

  return ts.factory.updateInterfaceDeclaration(
    interfaceNode,
    interfaceNode.modifiers,
    interfaceNode.name,
    interfaceNode.typeParameters,
    interfaceNode.heritageClauses,
    updatedMembers,
  )
}

/**
 * Removes `null` from a union type, but only if the property is optional.
 * @param typeNode The type node to process.
 * @returns The modified type node, with null removed if applicable.
 */
function removeNullFromUnionIfOptional(typeNode: ts.TypeNode): ts.TypeNode {
  // Check if the type is a union type
  if (ts.isUnionTypeNode(typeNode)) {
    // Filter out `null` from the union types
    const typesWithoutNull = typeNode.types.filter(
      t => !(ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword),
    )

    // If the result has only one type, return that type directly
    if (typesWithoutNull.length === 1) {
      return typesWithoutNull[0]!
    }

    // Otherwise, return the filtered union
    return ts.factory.createUnionTypeNode(typesWithoutNull)
  }

  // Check if the type is a type literal (object type)
  if (ts.isTypeLiteralNode(typeNode)) {
    const updatedMembers = typeNode.members.map(member => {
      if (ts.isPropertySignature(member) && member.questionToken && member.type) {
        const updatedType = removeNullFromUnionIfOptional(member.type)
        return ts.factory.updatePropertySignature(
          member,
          member.modifiers,
          member.name,
          member.questionToken,
          updatedType,
        )
      }
      return member
    })
    return ts.factory.createTypeLiteralNode(updatedMembers)
  }

  return typeNode
}

function updateTypeLiteralNode(typeNode: ts.TypeLiteralNode): ts.TypeLiteralNode {
  const updatedMembers = typeNode.members.map(member => {
    if (ts.isPropertySignature(member) && member.questionToken && member.type) {
      const updatedType = removeNullFromUnionIfOptional(member.type)
      return ts.factory.updatePropertySignature(
        member,
        member.modifiers,
        member.name,
        member.questionToken,
        updatedType,
      )
    } else if (ts.isPropertySignature(member) && member.type && ts.isTypeLiteralNode(member.type)) {
      const updatedType = updateTypeLiteralNode(member.type)
      return ts.factory.updatePropertySignature(
        member,
        member.modifiers,
        member.name,
        member.questionToken,
        updatedType,
      )
    }
    return member
  })
  return ts.factory.createTypeLiteralNode(updatedMembers)
}

export function removeOptionalFromArrayProperties(interfaceNode: ts.InterfaceDeclaration): ts.InterfaceDeclaration {
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
