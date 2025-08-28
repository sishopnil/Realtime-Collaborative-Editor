# Secure Backup & Recovery

- Backups: use `npm run db:backup` to run `mongodump` into a directory.
- Encryption: store backups in an encrypted storage (S3 with SSE or encrypt archive before upload).
- Example placeholder: `infra/certbot/renew.sh` for cert management; integrate cloud KMS for keys.
- Recovery: `npm run db:restore` with a verified backup.
- Schedule backups and test restores regularly; document RPO/RTO.

