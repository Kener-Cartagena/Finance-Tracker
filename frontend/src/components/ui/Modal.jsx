/**
 * Modal — slide-in panel from right with backdrop.
 */

import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, width = 'max-w-md' }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`relative card w-full ${width} p-6 animate-slide-up z-10`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display text-obsidian-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-obsidian-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
