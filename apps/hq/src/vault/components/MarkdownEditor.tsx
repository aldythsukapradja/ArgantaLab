// HQ Vault — the writing surface. A carefully-tuned textarea: monospace-free
// prose feel, tab indents, auto-continued lists, [[ ]] pair completion, and
// store-backed autosave on every keystroke (persistence is debounced upstream).

import { useCallback, useEffect, useRef } from 'react'
import { useVault } from '../store'

export function MarkdownEditor({ noteId }: { noteId: string }) {
  const body = useVault(s => s.notes[noteId]?.body ?? '')
  const fontSize = useVault(s => s.settings.fontSize)
  const updateBody = useVault(s => s.updateBody)
  const ref = useRef<HTMLTextAreaElement>(null)

  // keep the caret sane when switching notes
  useEffect(() => { ref.current?.setSelectionRange(0, 0) }, [noteId])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    const { selectionStart: start, selectionEnd: end, value } = ta

    const insert = (text: string, caretOffset = text.length) => {
      e.preventDefault()
      const next = value.slice(0, start) + text + value.slice(end)
      updateBody(noteId, next)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + caretOffset
      })
    }

    if (e.key === 'Tab') {
      insert('  ')
      return
    }
    // [[ closes itself
    if (e.key === '[' && value[start - 1] === '[' && start === end) {
      insert('[]]', 1)
      return
    }
    // wrap selection with ** / * / ` via shortcuts
    if ((e.metaKey || e.ctrlKey) && start !== end) {
      const wrap = (mark: string) => {
        e.preventDefault()
        const sel = value.slice(start, end)
        const next = value.slice(0, start) + mark + sel + mark + value.slice(end)
        updateBody(noteId, next)
        requestAnimationFrame(() => { ta.selectionStart = start + mark.length; ta.selectionEnd = end + mark.length })
      }
      if (e.key.toLowerCase() === 'b') { wrap('**'); return }
      if (e.key.toLowerCase() === 'i') { wrap('*'); return }
    }
    // continue lists on Enter
    if (e.key === 'Enter' && !e.shiftKey && start === end) {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const line = value.slice(lineStart, start)
      const m = line.match(/^(\s*)([-*+]\s(?:\[[ xX]\]\s)?|\d+[.)]\s)(.*)$/)
      if (m) {
        if (!m[3].trim()) {
          // empty list item → break out of the list
          e.preventDefault()
          const next = value.slice(0, lineStart) + '\n' + value.slice(start)
          updateBody(noteId, next)
          requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = lineStart + 1 })
          return
        }
        let marker = m[2]
        const num = marker.match(/^(\d+)([.)])\s$/)
        if (num) marker = `${parseInt(num[1], 10) + 1}${num[2]} `
        if (/\[[xX]\]\s$/.test(marker)) marker = marker.replace(/\[[xX]\]\s$/, '[ ] ')
        insert('\n' + m[1] + marker)
        return
      }
    }
  }, [noteId, updateBody])

  return (
    <textarea
      ref={ref}
      className="v-editor"
      style={{ fontSize }}
      value={body}
      onChange={e => updateBody(noteId, e.target.value)}
      onKeyDown={onKeyDown}
      placeholder="Write in markdown. Link notes with [[Note Title]] — # for headings, - [ ] for tasks."
      spellCheck={false}
      aria-label="Markdown editor"
    />
  )
}
