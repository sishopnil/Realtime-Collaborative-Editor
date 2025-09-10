export type Messages = Record<string, string>;

const en: Messages = {
  comments: 'Comments',
  search: 'Search',
  open: 'Open',
  resolved: 'Resolved',
  all: 'All',
  loading: 'Loading…',
  close: 'Close',
  jumpToPosition: 'Jump to position',
  resolve: 'Resolve',
  delete: 'Delete',
  share: 'Share',
  reply: 'Reply',
  typing: 'typing…',
  newCommentForSelection: 'New comment for current selection',
  typeAComment: 'Type a comment… Use @email to mention.',
  post: 'Post',
  clear: 'Clear',
  highContrast: 'High contrast',
  status: 'Status',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  bulletList: 'Bullet list',
  orderedList: 'Ordered list',
  codeBlock: 'Code block',
  blockquote: 'Blockquote',
  undo: 'Undo',
  redo: 'Redo',
  link: 'Link',
  syncing: 'Syncing…',
  offline: 'Offline',
  allSaved: 'All changes saved',
  reconnect: 'Reconnecting in',
  seconds: 'seconds',
  toolbar: 'Editor toolbar',
  editorLabel: 'Rich text editor',
};

let current = en;
export function setLocale(_locale: string) {
  // Extend as needed; for now, only English
  current = en;
}
export function t(key: string): string {
  return current[key] || key;
}

export function isRtlLocale(locale?: string) {
  const rtl = ['ar', 'he', 'fa', 'ur'];
  const l = (locale || '').toLowerCase();
  return rtl.some((p) => l === p || l.startsWith(p + '-'));
}
