// 用 import.meta.glob 在构建时把知识库所有 md 文件读进来
const modules = import.meta.glob('../../知识库/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export interface FileNode {
  name: string
  path: string
  content: string
}

export interface FolderNode {
  name: string
  children: (FolderNode | FileNode)[]
}

export function isFile(node: FolderNode | FileNode): node is FileNode {
  return 'content' in node
}

function stripMd(name: string) {
  return name.replace(/\.md$/, '')
}

export function buildTree(): FolderNode {
  const root: FolderNode = { name: '知识库', children: [] }

  for (const [path, content] of Object.entries(modules)) {
    // path 形如 /知识库/设定/01-核心规则.md
    const parts = path.replace(/^.*知识库\//, '').split('/')
    let node = root

    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i]
      let folder = node.children.find(c => !isFile(c) && c.name === folderName) as FolderNode | undefined
      if (!folder) {
        folder = { name: folderName, children: [] }
        node.children.push(folder)
      }
      node = folder
    }

    const fileName = parts[parts.length - 1]
    node.children.push({
      name: stripMd(fileName),
      path,
      content,
    })
  }

  // 文件夹和文件分别排序，文件夹在前
  sortNode(root)
  return root
}

function sortNode(node: FolderNode) {
  node.children.sort((a, b) => {
    const aIsFolder = !isFile(a)
    const bIsFolder = !isFile(b)
    if (aIsFolder && !bIsFolder) return -1
    if (!aIsFolder && bIsFolder) return 1
    return a.name.localeCompare(b.name, 'zh')
  })
  for (const child of node.children) {
    if (!isFile(child)) sortNode(child)
  }
}

export function flatFiles(): FileNode[] {
  const result: FileNode[] = []
  function walk(node: FolderNode) {
    for (const child of node.children) {
      if (isFile(child)) result.push(child)
      else walk(child)
    }
  }
  walk(buildTree())
  return result
}
