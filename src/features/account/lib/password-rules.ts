/**
 * Password validation rules used by both the self-service change-password
 * dialog and the authority-driven reset-password dialogs (app-admin and
 * super_admin paths). Rules mirror the backend policy — failing any of
 * these on the client is a fast-fail; the server still enforces history
 * (last-5) on submit.
 */

export interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "One digit", test: (pw) => /\d/.test(pw) },
  { label: "One special character", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
  {
    label: "No 4+ sequential characters",
    test: (pw) => !hasSequentialChars(pw),
  },
  {
    label: "No 4+ repeated characters",
    test: (pw) => !/(.)\1{3,}/.test(pw),
  },
];

export function hasSequentialChars(pw: string): boolean {
  for (let i = 0; i <= pw.length - 4; i++) {
    const codes = [
      pw.charCodeAt(i),
      pw.charCodeAt(i + 1),
      pw.charCodeAt(i + 2),
      pw.charCodeAt(i + 3),
    ];
    const isAscending =
      codes[1] - codes[0] === 1 &&
      codes[2] - codes[1] === 1 &&
      codes[3] - codes[2] === 1;
    const isDescending =
      codes[0] - codes[1] === 1 &&
      codes[1] - codes[2] === 1 &&
      codes[2] - codes[3] === 1;
    if (isAscending || isDescending) return true;
  }
  return false;
}

export function getStrengthLevel(
  passed: number,
  total: number
): { label: string; color: string; width: string } {
  const ratio = passed / total;
  if (ratio < 0.4)
    return { label: "Weak", color: "bg-destructive", width: "w-1/4" };
  if (ratio < 0.7)
    return { label: "Fair", color: "bg-amber-500", width: "w-1/2" };
  if (ratio < 1)
    return { label: "Good", color: "bg-blue-500", width: "w-3/4" };
  return { label: "Strong", color: "bg-emerald-500", width: "w-full" };
}
