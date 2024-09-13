#!/usr/bin/env node

import * as Codegen from '@sinclair/typebox-codegen'
import * as fs from 'fs'
import * as prettier from 'prettier'
import ts from 'typescript'

// Parse command-line arguments
const [, , inputFileName, outputFileName] = process.argv

if (!inputFileName || !outputFileName) {
  console.error('Usage: <input-file> <output-file>')
  process.exit(1)
}

// Read and parse the source file
const sourceCode = fs.readFileSync(inputFileName, 'utf-8')
const sourceFile = ts.createSourceFile(inputFileName, sourceCode, ts.ScriptTarget.ES2023, true)

// Store interface dependencies and declarations
const interfaceDependencies: Map<string, Set<string>> = new Map()
const interfaceDeclarations: Map<string, ts.InterfaceDeclaration> = new Map()

// Helper to collect dependencies from a type
function collectDependencies(node: ts.TypeNode): Set<string> {
  const dependencies = new Set<string>()

  function visitTypeNode(node: ts.Node) {
    if (ts.isTypeReferenceNode(node)) {
      const referencedTypeName = node.typeName.getText()
      dependencies.add(referencedTypeName)
    }
    ts.forEachChild(node, visitTypeNode)
  }

  ts.forEachChild(node, visitTypeNode)
  return dependencies
}

// Visit nodes to collect interfaces and their dependencies
function visitNode(node: ts.Node) {
  if (ts.isInterfaceDeclaration(node)) {
    const interfaceName = node.name.text
    interfaceDeclarations.set(interfaceName, node)

    // Collect dependencies from members
    const dependencies = new Set<string>()
    node.members.forEach(member => {
      if (ts.isPropertySignature(member) && member.type) {
        const memberDependencies = collectDependencies(member.type)
        memberDependencies.forEach(dep => dependencies.add(dep))
      }
    })
    interfaceDependencies.set(interfaceName, dependencies)
  }

  ts.forEachChild(node, visitNode)
}

// Start AST traversal to collect interface dependencies
visitNode(sourceFile)

// Topological sort of interfaces based on dependencies
function topologicalSort(dependencies: Map<string, Set<string>>): string[] {
  const sorted: string[] = []
  const visited: Set<string> = new Set()

  function visit(interfaceName: string) {
    if (!visited.has(interfaceName)) {
      visited.add(interfaceName)
      const deps = dependencies.get(interfaceName)
      if (deps) {
        deps.forEach(dep => {
          if (interfaceDeclarations.has(dep)) {
            visit(dep)
          }
        })
      }
      sorted.push(interfaceName)
    }
  }

  // Visit all interfaces
  interfaceDeclarations.forEach((_, interfaceName) => visit(interfaceName))

  return sorted
}

// Sort interfaces based on dependencies
const sortedInterfaces = topologicalSort(interfaceDependencies)

// Rebuild the file with sorted interfaces
let reorderedCode = ''
const writtenInterfaces = new Set<string>() // To track already written interfaces

sortedInterfaces.forEach(interfaceName => {
  const interfaceDeclaration = interfaceDeclarations.get(interfaceName)
  if (interfaceDeclaration && !writtenInterfaces.has(interfaceName)) {
    reorderedCode += sourceCode.slice(interfaceDeclaration.pos, interfaceDeclaration.end) + '\n\n'
    writtenInterfaces.add(interfaceName) // Mark as written
  }
})

// Append any remaining parts of the file (like imports, comments)
const generatedTypebox = Codegen.TypeScriptToTypeBox.Generate(reorderedCode).replace(
  /import\s*\{\s*Type\s*,\s*Static\s*\}\s*from\s*'@sinclair\/typebox'/,
  `import { Static, t as Type } from 'elysia'`,
)

async function run() {
  // Write the output to a new file
  const prettierConfig = await prettier.resolveConfig(inputFileName!)
  const formatedCode = await prettier.format(generatedTypebox, {
    ...prettierConfig,
    parser: 'typescript',
  })

  fs.writeFileSync(outputFileName!, formatedCode)
}
run()
