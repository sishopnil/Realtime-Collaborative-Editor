import { Injectable } from '@nestjs/common';

export interface SecretsProvider {
  get(name: string): Promise<string | undefined>;
}

class EnvSecretsProvider implements SecretsProvider {
  async get(name: string): Promise<string | undefined> {
    return process.env[name];
  }
}

// Placeholder Vault provider: in real deployment, fetch from Vault via HTTP.
// Here, we simulate via env vars prefixed with VAULT_.
class VaultSecretsProvider implements SecretsProvider {
  async get(name: string): Promise<string | undefined> {
    return process.env[`VAULT_${name}`] || process.env[name];
  }
}

@Injectable()
export class SecretsService implements SecretsProvider {
  private readonly provider: SecretsProvider;

  constructor() {
    const mode = (process.env.SECRETS_PROVIDER || 'env').toLowerCase();
    this.provider = mode === 'vault' ? new VaultSecretsProvider() : new EnvSecretsProvider();
  }

  get(name: string): Promise<string | undefined> {
    return this.provider.get(name);
  }
}

