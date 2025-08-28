import { spawn } from 'child_process';

const IN = process.argv[2] || './backup';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/rce';

const proc = spawn('mongorestore', ['--uri', MONGO_URL, IN], { stdio: 'inherit' });
proc.on('exit', (code) => process.exit(code || 0));
