import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import node from '@astrojs/node';

const isNetlifyDeploy = process.env.NETLIFY === 'true' || process.env.CONTEXT === 'production' || process.env.CONTEXT === 'deploy-preview';
const useNodeAdapter = process.platform === 'win32' && !isNetlifyDeploy;

export default defineConfig({

    devToolbar: {
        enabled: false
    },

    output: 'server',

    adapter: useNodeAdapter
        ? node({ mode: 'standalone' })
        : netlify(),

    vite: {
        resolve: {
            alias: {
                '@': '/src'
            }
        }
    }

});
