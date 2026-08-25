import type { FormEvent } from 'react';

/**
 * Grows a textarea to fit its content as the user types. Purely a DOM side
 * effect — wire it alongside onChange, it never touches React state.
 */
export function autoGrow(event: FormEvent<HTMLTextAreaElement>) {
  const el = event.currentTarget;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}
