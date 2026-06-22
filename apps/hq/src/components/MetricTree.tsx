import { CornerDownRight, Star, TrendingUp, TrendingDown } from 'lucide-react'
import type { TreeNode } from '../contract/metrics'

const nf = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`

function Node({ node, depth }: { node: TreeNode; depth: number }) {
  const up = (node.deltaPct ?? 0) >= 0
  const isRoot = depth === 0
  return (
    <>
      <div className="spread" style={{ padding: '8px 0', paddingLeft: depth * 18,
        borderBottom: '1px solid var(--brd)' }}>
        <div className="row" style={{ minWidth: 0, gap: 8 }}>
          {depth > 0 && <CornerDownRight size={14} style={{ color: 'var(--faint)', flex: '0 0 auto' }} />}
          {isRoot && <Star size={16} style={{ color: 'var(--acc2)', flex: '0 0 auto' }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isRoot ? 13 : 12.5, fontWeight: isRoot ? 600 : 400 }}>{node.label}</div>
            {node.sub && <div className="faint" style={{ fontSize: 11 }}>{node.sub}</div>}
          </div>
        </div>
        {node.adoptionPct !== undefined ? (
          <div className="row" style={{ gap: 8, flex: '0 0 130px' }}>
            <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--chip)' }}>
              <div style={{ width: `${node.adoptionPct}%`, height: '100%', borderRadius: 99,
                background: node.adoptionPct >= 40 ? 'var(--ok)' : node.adoptionPct >= 15 ? 'var(--warn)' : 'var(--faint)' }} />
            </div>
            <span style={{ fontSize: 11.5, width: 30, textAlign: 'right' }}>{node.adoptionPct}%</span>
          </div>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: isRoot ? 15 : 13.5, fontWeight: 600 }}>{nf(node.value)}{node.unit ?? ''}</span>
            {node.deltaPct !== undefined && (
              <span style={{ fontSize: 11, width: 42, textAlign: 'right',
                color: up ? 'var(--ok)' : 'var(--bad)', display: 'inline-flex', gap: 2, justifyContent: 'flex-end' }}>
                {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? '+' : ''}{node.deltaPct}%
              </span>
            )}
          </div>
        )}
      </div>
      {node.children?.map((c) => <Node key={c.key} node={c} depth={depth + 1} />)}
    </>
  )
}

/** The nested North-Star tree (portfolio -> product -> mini-app). */
export function MetricTree({ root }: { root: TreeNode }) {
  return <div>{<Node node={root} depth={0} />}</div>
}
