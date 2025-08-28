export async function verifyCaptcha(token?: string): Promise<boolean> {
  if (!process.env.CAPTCHA_ENABLED) return true;
  if (process.env.CAPTCHA_TEST_MODE === 'true') return token === 'pass';
  // Placeholder: integrate with reCAPTCHA/hCaptcha here. Without network, return false when enabled.
  return false;
}

