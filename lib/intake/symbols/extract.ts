import ts from 'typescript'

import type {
  ScanSymbol,
  SymbolCategory,
  SymbolKind,
} from '@/lib/intake/symbols/contracts'

const CANDIDATE_EXTENSIONS = new Set(['js', 'jsx', 'ts', 'tsx'])
const API_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

export function isSymbolCandidate(relativePath: string): boolean {
  const extension = relativePath.split('.').at(-1)?.toLowerCase()
  return extension !== undefined && CANDIDATE_EXTENSIONS.has(extension)
}

function scriptKind(relativePath: string): ts.ScriptKind {
  if (relativePath.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (relativePath.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (relativePath.endsWith('.js')) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function isExported(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
      false)
  )
}

function lines(sourceFile: ts.SourceFile, node: ts.Node): Pick<ScanSymbol, 'lineStart' | 'lineEnd'> {
  return {
    lineStart: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
    lineEnd: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
  }
}

function hasJsx(node: ts.Node): boolean {
  let found = false
  const visit = (child: ts.Node) => {
    if (
      ts.isJsxElement(child) ||
      ts.isJsxSelfClosingElement(child) ||
      ts.isJsxFragment(child)
    ) {
      found = true
      return
    }
    if (!found) ts.forEachChild(child, visit)
  }
  ts.forEachChild(node, visit)
  return found
}

function classifyCallable(
  relativePath: string,
  name: string,
  node: ts.Node,
  exported: boolean
): { kind: SymbolKind; category: SymbolCategory } {
  if (
    exported &&
    /(?:^|\/)route\.(?:js|jsx|ts|tsx)$/.test(relativePath) &&
    API_METHODS.has(name)
  ) {
    return { kind: 'api_handler', category: 'routing' }
  }
  if (/^use[A-Z0-9]/.test(name)) return { kind: 'hook', category: 'declaration' }
  if (/^[A-Z]/.test(name) && hasJsx(node)) {
    return { kind: 'component', category: 'declaration' }
  }
  return { kind: 'function', category: 'declaration' }
}

export function extractSymbols(relativePath: string, source: string): readonly ScanSymbol[] {
  if (!isSymbolCandidate(relativePath)) return []
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(relativePath)
  )
  const parseDiagnostics = (
    sourceFile as ts.SourceFile & { readonly parseDiagnostics?: readonly ts.Diagnostic[] }
  ).parseDiagnostics
  if (parseDiagnostics && parseDiagnostics.length > 0) return []
  const symbols: ScanSymbol[] = []

  const add = (
    node: ts.Node,
    kind: SymbolKind,
    name: string,
    exported: boolean,
    category: SymbolCategory,
    importSource: string | null = null
  ) => {
    if (!name || name.length > 512 || (importSource !== null && importSource.length > 512)) return
    symbols.push({
      relativePath,
      kind,
      name,
      exported,
      importSource,
      ...lines(sourceFile, node),
      confidence: 'high',
      category,
    })
  }

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const sourceName = statement.moduleSpecifier.text
      const clause = statement.importClause
      if (!clause) add(statement, 'import', sourceName, false, 'dependency', sourceName)
      if (clause?.name) add(statement, 'import', clause.name.text, false, 'dependency', sourceName)
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        add(statement, 'import', clause.namedBindings.name.text, false, 'dependency', sourceName)
      }
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          add(element, 'import', element.name.text, false, 'dependency', sourceName)
        }
      }
      continue
    }

    if (ts.isExportDeclaration(statement)) {
      const importSource =
        statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : null
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          add(element, 'export', element.name.text, true, 'declaration', importSource)
        }
      } else {
        add(statement, 'export', '*', true, 'declaration', importSource)
      }
      continue
    }

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      const exported = isExported(statement)
      const classification = classifyCallable(relativePath, statement.name.text, statement, exported)
      add(statement, classification.kind, statement.name.text, exported, classification.category)
      if (exported) add(statement, 'export', statement.name.text, true, 'declaration')
      continue
    }

    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      const exported = isExported(statement)
      add(statement, 'type', statement.name.text, exported, 'declaration')
      if (exported) add(statement, 'export', statement.name.text, true, 'declaration')
      continue
    }

    if (ts.isVariableStatement(statement)) {
      const exported = isExported(statement)
      const isConst =
        (statement.declarationList.flags & ts.NodeFlags.Const) === ts.NodeFlags.Const
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue
        const name = declaration.name.text
        if (
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        ) {
          const classification = classifyCallable(
            relativePath,
            name,
            declaration.initializer,
            exported
          )
          add(declaration, classification.kind, name, exported, classification.category)
        } else if (isConst) {
          add(declaration, 'constant', name, exported, 'declaration')
        }
        if (exported) add(declaration, 'export', name, true, 'declaration')
      }
    }
  }

  return symbols
}
