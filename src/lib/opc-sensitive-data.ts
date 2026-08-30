export function isMaskedAhvNumber(value: unknown): boolean {
  return /[*•●×]/.test(String(value ?? ''));
}

export function maskAhvNumber(value: unknown): string {
  const source = String(value ?? '').trim();

  if (!source) {
    return '';
  }

  const digits = source.replace(/\D/g, '');
  const suffix = digits.length >= 2 ? digits.slice(-2) : '';

  if (isMaskedAhvNumber(source)) {
    if (
      /^756(?:\D|$)/.test(source) &&
      suffix.length === 2
    ) {
      return `756.****.****.${suffix}`;
    }

    return suffix.length === 2
      ? `***.****.****.${suffix}`
      : '***.****.****.**';
  }

  if (
    digits.startsWith('756') &&
    digits.length >= 13
  ) {
    return `756.****.****.${digits.slice(-2)}`;
  }

  if (suffix.length === 2) {
    return `***.****.****.${suffix}`;
  }

  return '***.****.****.**';
}
