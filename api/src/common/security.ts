export function getBcryptCost(): number {
  const cost = parseInt(process.env.BCRYPT_COST || process.env.PASSWORD_SALT_ROUNDS || '12', 10);
  return Number.isFinite(cost) && cost >= 12 ? cost : 12;
}

export async function hashPassword(bcrypt: typeof import('bcryptjs'), plain: string): Promise<string> {
  const rounds = getBcryptCost();
  return bcrypt.hash(plain, rounds);
}

