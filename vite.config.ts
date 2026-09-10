import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

const repo = (process.env.GITHUB_REPOSITORY || '').trim();
const rawBase = (process.env.PUBLIC_BASE_PATH || (repo ? `/${repo.split('/')[1]}/` : '/')).trim();
const basePath = rawBase === '/' ? '/' : `/${rawBase.replace(/^\/+|\/+$/g, '')}/`;
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',port:5173,strictPort:true},preview:{host:'127.0.0.1',port:4173,strictPort:true},base:basePath,css:{postcss:{plugins:[tailwindcss()]}},resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},define:{'process.env.NEXT_PUBLIC_BASE_PATH':JSON.stringify(basePath.replace(/\/$/,''))}});
