import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['studio', '@arganta/media-core'],
  // Studio consumes shared Arganta packages above its app directory. Make that
  // boundary explicit so Vercel's serverless output traces include them.
  outputFileTracingRoot: path.resolve(appDirectory, '../..'),
};

export default nextConfig;
