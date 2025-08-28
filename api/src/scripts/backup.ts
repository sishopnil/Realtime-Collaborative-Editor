import { spawn } from 'child_process';

const OUT = process.argv[2] || './backup';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/rce';

const proc = spawn('mongodump', ['--uri', MONGO_URL, '--out', OUT], { stdio: 'inherit' });
proc.on('exit', (code) => process.exit(code || 0));
