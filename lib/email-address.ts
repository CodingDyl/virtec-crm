/**
 * What counts as a usable email address from a visitor.
 *
 * Deliberately narrower than the RFC: letters, digits and `. _ % + - '` in
 * the local part, letters, digits, dots and hyphens in the domain. The RFC also
 * allows `? & = / #`, but no real mailbox uses them, and they are what turns a
 * `mailto:` link into `mailto:x?bcc=someone@else.com`, a draft with a hidden
 * recipient. Unicode letters are allowed so non-English names still work.
 * Anything that builds a mail link from an address encodes it as well
 * (`mailtoHref`); this is the first of two layers.
 */
export const EMAIL_PATTERN = /^[\p{L}\p{N}._%+'-]{1,64}@[\p{L}\p{N}.-]{1,190}\.\p{L}{2,24}$/u;

export function isPlausibleEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value) && !value.includes('..');
}

/** A `mailto:` link that cannot carry extra headers, whatever the address holds. */
export function mailtoHref(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return `mailto:${encodeURIComponent(email)}`;
  return `mailto:${encodeURIComponent(email.slice(0, at))}@${encodeURIComponent(email.slice(at + 1))}`;
}
