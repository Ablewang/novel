import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { buildTree, flatFiles, isFile, type FileNode, type FolderNode } from './files'

const tree = buildTree()
const allFiles = flatFiles()

function FolderItem({
  node,
  selected,
  onSelect,
  defaultOpen = false,
}: {
  node: FolderNode
  selected: string | null
  onSelect: (f: FileNode) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="tree-folder">
      <div className="tree-folder-name" onClick={() => setOpen(o => !o)}>
        <span className={`arrow ${open ? 'open' : ''}`}>▶</span>
        {node.name}
      </div>
      {open && (
        <div className="tree-files">
          {node.children.map(child =>
            isFile(child) ? (
              <div
                key={child.path}
                className={`tree-file ${selected === child.path ? 'active' : ''}`}
                onClick={() => onSelect(child)}
                title={child.name}
              >
                {child.name}
              </div>
            ) : (
              <FolderItem
                key={child.name}
                node={child}
                selected={selected}
                onSelect={onSelect}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

function breadcrumb(path: string) {
  return path
    .replace(/^.*知识库\//, '')
    .replace(/\.md$/, '')
    .split('/')
}

export default function App() {
  const [selected, setSelected] = useState<FileNode | null>(null)
  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!query.trim()) return null
    const q = query.trim().toLowerCase()
    return allFiles.filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.content.toLowerCase().includes(q)
    )
  }, [query])

  const crumbs = selected ? breadcrumb(selected.path) : []

  function selectFile(f: FileNode) {
    setSelected(f)
    setQuery('')
    setSidebarOpen(false)
  }

  return (
    <div className="layout">
      {/* 移动端遮罩 */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">📖 归墟知识库</div>
        <div className="sidebar-search">
          <input
            placeholder="搜索文件或内容…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="sidebar-tree">
          {filtered ? (
            filtered.length === 0 ? (
              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 13 }}>
                没有匹配的文件
              </div>
            ) : (
              filtered.map(f => (
                <div
                  key={f.path}
                  className={`tree-file ${selected?.path === f.path ? 'active' : ''}`}
                  onClick={() => selectFile(f)}
                  title={f.path}
                >
                  {f.name}
                </div>
              ))
            )
          ) : (
            tree.children.map(child =>
              isFile(child) ? (
                <div
                  key={child.path}
                  className={`tree-file ${selected?.path === child.path ? 'active' : ''}`}
                  onClick={() => selectFile(child)}
                >
                  {child.name}
                </div>
              ) : (
                <FolderItem
                  key={child.name}
                  node={child}
                  selected={selected?.path ?? null}
                  onSelect={selectFile}
                  defaultOpen={child.name === '设定' || child.name === '人物'}
                />
              )
            )
          )}
        </div>
      </aside>

      <div className="main">
        <div className="main-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          {crumbs.map((c, i) => (
            <span key={i}>
              {i > 0 && <span className="breadcrumb-sep"> / </span>}
              <span className={i === crumbs.length - 1 ? 'breadcrumb-current' : ''}>
                {c}
              </span>
            </span>
          ))}
        </div>
        <div className="main-content">
          {selected ? (
            <div className="md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selected.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="empty-state">
              <div className="icon">📂</div>
              <div className="hint">从左侧选择一个文件</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
