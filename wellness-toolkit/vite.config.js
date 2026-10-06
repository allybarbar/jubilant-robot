import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// base './' lets the build work from any sub-path (GitHub Pages, Squarespace iframe host, etc.)
export default defineConfig({plugins:[react()],base:'./'});
