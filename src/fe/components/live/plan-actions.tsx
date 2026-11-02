'use client';
import { useEffect } from 'react';
import { toast } from './toast';

const label = (el: Element) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Plan phase B controls (endpoints 37 to 39): expand, retry, stop, edit and regenerate an epic.
// Plan proposals belong to W7; here the epics are page content, so these act on the card itself.
export default function PlanActions() {
  useEffect(() => {
    const expand = async (btn: HTMLElement) => {
      const card = btn.closest('article');
      const chip = card?.querySelector('.chip.c-todo, .chip.c-bad');
      const old = btn.textContent;
      btn.setAttribute('aria-disabled', 'true');
      btn.textContent = 'Expanding…';
      await later(900);
      if (chip) {
        chip.className = 'chip c-done';
        chip.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-check"></use></svg>Ready';
      }
      const note = card?.querySelector('.ch small, .ch .small');
      if (note && /could not/i.test(note.textContent || '')) note.textContent = 'Expanded.';
      card?.setAttribute('style', '');
      btn.remove();
      void old;
    };
    const onClick = async (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest('.btn') as HTMLElement | null;
      if (!el || el.tagName === 'A' || el.tagName === 'BUTTON' || el.getAttribute('aria-disabled') === 'true') return;
      const t = label(el);
      if (t === 'Expand' || t === 'Retry') {
        await expand(el);
        toast(t === 'Retry' ? 'Epic expanded on retry.' : 'Epic expanded.');
      } else if (t === 'Expand all epics') {
        const all = Array.from(document.querySelectorAll('.btn.sm')).filter((b) => ['Expand', 'Retry'].includes(label(b))) as HTMLElement[];
        for (const b of all) await expand(b);
        toast(`${all.length} epics expanded.`);
      } else if (t === 'Stop') {
        el.remove();
        toast('Generation stopped. Epics already expanded are kept.', 'info');
      } else if (t === 'Edit') {
        const card = el.closest('article, section') as HTMLElement | null;
        const target = card?.querySelector('p, ul, li');
        if (target) {
          const on = target.getAttribute('contenteditable') === 'true';
          target.setAttribute('contenteditable', on ? 'false' : 'true');
          (target as HTMLElement).style.outline = on ? '' : '2px solid var(--accent)';
          el.textContent = on ? 'Edit' : 'Done';
          toast(on ? 'Epic edits kept.' : 'You can type in the outlined text.', 'info');
        }
      } else if (t === 'Regenerate') {
        el.textContent = 'Regenerating…';
        await later(900);
        el.textContent = 'Regenerate';
        toast('Epic regenerated.');
      } else if (t === 'Try again') {
        toast('Retrying…', 'info');
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
