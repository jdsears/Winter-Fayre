// Writing values into HTML.
//
// Every value that is not the site's own fixed words goes through esc
// (or inline, which escapes first) on its way into the page, so a
// <script> in a value shows as those characters and never runs. *Stars*
// round words highlight them and **double stars** make them bold: those
// two marks are the only markup the words can carry.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ESC[ch])
export const attr = esc

// Escaped, then the two marks, then line breaks.
export function inline(value) {
  return esc(value)
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}

// The words with the marks taken off, for a title or a meta tag.
export const plain = (value) => String(value ?? '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim()
