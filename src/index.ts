#!/usr/bin/env node

import { program } from 'commander'

import * as Codegen from '@sinclair/typebox-codegen'
import * as fs from 'fs'
import * as prettier from 'prettier'
import ts from 'typescript'
import { generateRecrusivePattern } from './recursive-pattern'
import { removeNullFromOptionalProperties } from './remove-null-if-optional'

program
  .requiredOption('-i, --input <input>', 'input file')
  .requiredOption('-o, --output <output>', 'output file')
  .option('-e, --exclude <exclude>', 'exclude interfaces')
  .option('-p, --payload', 'exclude general interfaces from payload')
  .option('-rmnifo, --remove-null-if-optional', 'remove null from optional properties')

program.parse()

const options = program.opts()

// Parse command-line arguments
let ignoreInterfaces = new Set<string>()
if (options.payload) {
  const ignore = [
    'PayloadMigration',
    'Auth',
    'PayloadPreference',
    'Config',
    'AdminAuthOperations',
    'PayloadLockedDocument',
  ]
  ignoreInterfaces = new Set([...ignoreInterfaces, ...ignore])
}

if (options.exclude) {
  ignoreInterfaces = new Set([...ignoreInterfaces, ...options.exclude.split(',')])
}

// Read and parse the source file
const sourceCode = fs.readFileSync(options.input, 'utf-8')
const sourceFile = ts.createSourceFile(options.input, sourceCode, ts.ScriptTarget.ES2023, true)

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
  if (ts.isModuleDeclaration(node) && node.name && ts.isStringLiteral(node.name)) {
    return // Skip processing for external module declarations
  }

  // Ignore declare module nodes
  if (ts.isInterfaceDeclaration(node)) {
    if (ignoreInterfaces.has(node.name.text)) {
      return
    }
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

let typeboxCode = ''
let templateCode = ``
let usageCode = ``

async function buildInterfaceCode() {
  const interfacesWithoutDependencies = Array.from(interfaceDependencies.entries())
    .filter(([, dependencies]) => dependencies.size === 0)
    .map(([interfaceName]) => interfaceName)

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })

  for (const [interfaceName, interfaceDeclaration] of interfaceDeclarations) {
    let updatedInterface = interfaceDeclaration
    if (options.removeNullIfOptional) {
      updatedInterface = removeNullFromOptionalProperties(interfaceDeclaration)
    }

    const updatedCode = printer.printNode(ts.EmitHint.Unspecified, updatedInterface, sourceFile) + '\n\n'
    const typebox = Codegen.TypeScriptToTypeBox.Generate(updatedCode, {
      useTypeBoxImport: false,
      useIdentifiers: false,
    })

    const dependencies = Array.from(interfaceDependencies.get(interfaceName) || [])
    if (dependencies.length) {
      const depsAndSubDebs: Record<string, string[]> = {}
      for (const dep of dependencies) {
        const subDependencies = interfaceDependencies.get(dep)
        depsAndSubDebs[dep] = subDependencies ? Array.from(subDependencies) : []
      }

      const recursive = generateRecrusivePattern(typebox, depsAndSubDebs, interfacesWithoutDependencies)
      templateCode += recursive.template + '\n\n'
      usageCode += recursive.usage + '\n\n'
    } else {
      typeboxCode += typebox + '\n\n'
    }
  }
}

async function run() {
  const prettierConfig = await prettier.resolveConfig(options.input!)
  await buildInterfaceCode()

  let completeCode = `import { Static, t as Type } from 'elysia';\n\n`
  if (templateCode.length > 0) {
    completeCode = `import { Static, TSchema, t as Type } from 'elysia';\n\n`
  }

  completeCode += typeboxCode + templateCode + usageCode
  const formatedCode = await prettier.format(completeCode, {
    ...prettierConfig,
    parser: 'typescript',
  })

  fs.writeFileSync(options.output!, formatedCode)
}
run()
