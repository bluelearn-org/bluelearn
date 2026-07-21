export const MIN_PASSWORD_LENGTH = 8;

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};

export type RegisterErrors = Partial<Record<keyof RegisterInput, string>>;

// Client-side checks the browser can't do natively (email/required are on the
// inputs). Returns null when the form is good to submit.
export function validateRegister(input: RegisterInput): RegisterErrors | null {
  const errors: RegisterErrors = {};

  if (!input.username.trim()) {
    errors.username = "Username is required";
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (input.password !== input.confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }
  if (!input.acceptedTerms) {
    errors.acceptedTerms = "You must accept the terms of service";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
