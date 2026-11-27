import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nebbiaStrokesPlugin } from './dev/nebbia/nebbiaStrokesPlugin.mjs';

// vite.mineradio.config.ts
// Package only the local player and visualizer components; never Folia's application shell.
const root = path.dirname(fileURLToPath(import.meta.url));
const upstream = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const { collectBundledLicenses } = createRequire(import.meta.url)(path.resolve(root, '../../scripts/folia-licenses.cjs'));
const workerModules = new Set<string>();

function isTranslationObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readLocalTranslations(source: string): Record<string, unknown> {
    const literal = /^\s*export default\s*(\{[\s\S]*\})\s*;?\s*$/.exec(source)?.[1];
    if (!literal) throw new Error('Expected a literal translation resource');
    const resources = JSON.parse(literal);
    // The embedded player uses its own commands and never opens the upstream release history or Ponder.
    delete resources.commandPalette;
    delete resources.releaseNotes;
    delete resources.ponder;
    return resources;
}

function fillTranslationFallbacks(resources: Record<string, unknown>, fallback: Record<string, unknown>) {
    for (const [key, value] of Object.entries(fallback)) {
        const existing = resources[key];
        if (!Object.hasOwn(resources, key)) resources[key] = value;
        else if (isTranslationObject(existing) && isTranslationObject(value)) fillTranslationFallbacks(existing, value);
    }
}

export default defineConfig({
    root,
    logLevel: 'warn',
    base: './',
    publicDir: false,
    worker: { format: 'es', plugins: () => [{
        name: 'mineradio-worker-license-modules',
        generateBundle(_options, bundle) {
            for (const output of Object.values(bundle)) {
                if (output.type === 'chunk') for (const id of output.moduleIds) workerModules.add(id);
            }
        },
    }] },
    plugins: [
        nebbiaStrokesPlugin(),
        {
            name: 'mineradio-local-translations',
            enforce: 'pre',
            transform(source, id) {
                const language = /\/src\/i18n\/locales\/(en|zh-CN)\.ts$/.exec(id.replaceAll('\\', '/'))?.[1];
                if (!language) return;
                const fallback = language === 'en' ? 'zh-CN' : 'en';
                const resources = readLocalTranslations(source);
                fillTranslationFallbacks(resources, readLocalTranslations(fs.readFileSync(path.join(root, 'src/i18n/locales', fallback + '.ts'), 'utf8')));
                return { code: 'export default ' + JSON.stringify(resources) + ';', map: null };
            },
        },
        {
            name: 'mineradio-visual-asset-cache',
            enforce: 'pre',
            resolveId(source, importer) {
                const owner = importer?.split('?')[0].replaceAll('\\', '/');
                if (owner && source.startsWith('.') && path.resolve(path.dirname(owner), source).replaceAll('\\', '/')
                    === path.join(root, 'src/components/visualizer/backgrounds/registry').replaceAll('\\', '/')) {
                    return path.join(root, 'src/mineradio/local/localBackgroundRegistry.ts');
                }
                if (source === './db' && owner && ['visualizerImageAsset', 'customLyricsFont', 'cappellaAvatarPack', 'cappellaEmojiPack']
                    .some(name => owner === path.join(root, 'src/services', name + '.ts').replaceAll('\\', '/'))) {
                    return path.join(root, 'src/mineradio/local/visualAssetCache.ts');
                }
            },
        },
        react(),
        {
            name: 'mineradio-interactive-preload',
            transformIndexHtml: {
                order: 'post',
                handler(_html, { bundle }) {
                    if (!bundle) return;
                    const mount = Object.values(bundle).find(chunk => chunk.type === 'chunk'
                        && chunk.facadeModuleId?.replaceAll('\\', '/').endsWith('/mineradio/local-mount.tsx'));
                    if (mount?.type !== 'chunk') return;
                    // Start the renderer's biggest dependencies during HTML parsing.
                    // Leave the export document on its own module graph.
                    const dependencies = mount.imports.map(name => bundle[name])
                        .filter(chunk => chunk?.type === 'chunk')
                        .sort((a, b) => b.code.length - a.code.length)
                        .slice(0, 2);
                    const urls = [mount, ...dependencies].map(chunk => './' + chunk.fileName);
                    return [{ tag: 'script', injectTo: 'head-prepend', children: `
                        if (!new URLSearchParams(location.search).has('videoExport')) {
                            for (const url of ${JSON.stringify(urls)}) {
                                const link = document.createElement('link');
                                link.rel = 'modulepreload';
                                link.crossOrigin = 'anonymous';
                                link.referrerPolicy = 'no-referrer';
                                link.href = url;
                                document.head.appendChild(link);
                            }
                        }
                    ` }];
                },
            },
        },
        {
            name: 'mineradio-local-entry',
            transformIndexHtml: {
                order: 'pre',
                handler() { return fs.readFileSync(path.join(root, 'mineradio-local.html'), 'utf8'); },
            },
            generateBundle(_options, bundle) {
                const modules = new Set<string>();
                const bundledModules = new Set(workerModules);
                for (const output of Object.values(bundle)) {
                    if (output.type === 'chunk') {
                        for (const id of output.moduleIds) {
                            bundledModules.add(id);
                            const relative = path.relative(root, id.split('?')[0]).replaceAll('\\', '/');
                            if (relative.startsWith('src/')) modules.add(relative);
                        }
                    } else if (output.fileName.endsWith('.css') && typeof output.source === 'string') {
                        // Use the desktop's bundled CJK font without requesting a font CDN.
                        output.source = output.source.replace(/https:\/\/cdn\.jsdmirror\.cn\/npm\/@fontsource\/[^)"']+\.woff2/g,
                            '../../fonts/NotoSansSC-ui.woff2');
                    }
                }
                const forbidden = [...modules].filter(id => ['src/App.tsx', 'src/bootstrap.tsx',
                    'src/components/modal/SettingsModal.tsx', 'src/mods/folium/clientLoader.ts'].includes(id)
                    || (id.startsWith('src/components/app/') && !id.startsWith('src/components/app/lattice/'))
                    || ['src/components/remote/', 'src/components/obs/', 'src/mods/', 'src/services/onlineMusic/', 'src/components/visualizer/backgrounds/url/'].some(prefix => id.startsWith(prefix))
                    || ['src/stores/usePlaybackStore.ts', 'src/services/netease.ts', 'src/services/db.ts', 'src/services/appDatabase.ts'].includes(id));
                if (forbidden.length) this.error('Local player pulled in the full Folia application: ' + forbidden.join(', '));
                const licenses = collectBundledLicenses(root, bundledModules);
                this.emitFile({ type: 'asset', fileName: licenses.manifest.fileName, source: licenses.text });
                this.emitFile({ type: 'asset', fileName: 'local-player-build.json', source: JSON.stringify({
                    surface: 'folia-local-player', entry: 'src/mineradio/local-entry.tsx', modules: [...modules].sort(),
                    thirdPartyLicenses: licenses.manifest,
                }, null, 2) });
            },
        },
    ],
    resolve: { alias: [
        { find: /^(?:.*\/)?i18n\/config(?:\.ts)?$/, replacement: path.join(root, 'src/mineradio/local-i18n.ts') },
        { find: /^(?:.*\/)?services\/(?:beatFx\/beatFxLive|analysis\/(?:drumHits|vocalEnvelope))(?:\.ts)?$/, replacement: path.join(root, 'src/mineradio/local/localAnalysisBoundary.ts') },
        { find: /^(?:.*\/)?stores\/useLatticeSettingsStore(?:\.ts)?$/, replacement: path.join(root, 'src/mineradio/local/useLocalLatticeSettingsStore.ts') },
        { find: /^(?:.*\/)?services\/ponder\/loopShuffleHint(?:\.ts)?$/, replacement: path.join(root, 'src/mineradio/local/localPlayerHints.ts') },
        { find: /^(?:.*\/)?LatticeExtraControls(?:\.tsx)?$/, replacement: path.join(root, 'src/mineradio/local/LocalLatticeExtraControls.tsx') },
        { find: /^(?:.*\/)?mods\/folium\/registries\/progress(?:\.tsx)?$/, replacement: path.join(root, 'src/mineradio/local/LocalProgressExtensions.tsx') },
        { find: /^(?:.*\/)?services\/onlineMusic\/(?:songAvailability|catalogRefs)(?:\.ts)?$/, replacement: path.join(root, 'src/mineradio/local/localTrackPresentation.ts') },
        { find: /^(?:.*\/)?mods\/folium\/registries\/(?:stageLayers|tunings)(?:\.tsx)?$/, replacement: path.join(root, 'src/mineradio/local/builtinExtensions.ts') },
        { find: /^(?:.*\/)?videoLayer\/VideoLayer(?:\.tsx)?$/, replacement: path.join(root, 'src/mineradio/local/LocalVideoBoundary.tsx') },
        { find: '@', replacement: path.join(root, 'src') },
    ] },
    define: {
        __COMMIT_HASH__: JSON.stringify('d824c0b-mineradio'),
        __GIT_BRANCH__: JSON.stringify('mineradio-integration'),
        __BUILD_REPO__: JSON.stringify('chthollyphile/folia-major'),
        __BUILD_COMMIT__: JSON.stringify('d824c0b854e54d5411cb072092999823e9bd7071'),
        __APP_VERSION__: JSON.stringify(upstream.version),
        __APP_VERSION_LABEL__: JSON.stringify('Mineradio'),
        __APP_RELEASE_CHANNEL__: JSON.stringify('embedded'),
        __DOCKER_STACK_VERSION__: JSON.stringify(''),
    },
    build: {
        outDir: path.resolve(root, '../../public/vendor/folia'),
        emptyOutDir: true,
        sourcemap: false,
        modulePreload: {
            // Dynamic effects share the entry's icon graph. Preloading its entire closure makes
            // Vite scan thousands of existing links for each dependency (quadratic main-thread work).
            // Preload the requested JS chunk; native imports load its dependencies and Vite retains CSS.
            resolveDependencies(filename, dependencies, context) {
                if (context.hostType !== 'js') return dependencies;
                if (path.basename(filename).startsWith('local-mount-')) return dependencies.slice(0, 10);
                return dependencies.filter(dependency => dependency === filename);
            },
        },
        rolldownOptions: {
            input: { main: path.join(root, 'index.html') },
            output: {
                codeSplitting: {
                    groups: [
                        { name: 'three', test: /node_modules[\\/]three[\\/]/ },
                        {
                            name: 'lucide-runtime',
                            test: /node_modules[\\/]lucide-react[\\/]dist[\\/]esm[\\/]createLucideIcon\.m?js$/,
                            // Claim the factory and its React dependencies before the icon groups.
                            priority: 1,
                        },
                        {
                            name: 'lucide-icons',
                            test: /node_modules[\\/]lucide-react[\\/]dist[\\/]esm[\\/]icons[\\/][^\\/]+\.(?:m?js)$/,
                            // Separate the player chrome from optional theme icons while bundling small shards.
                            entriesAware: true,
                            entriesAwareMergeThreshold: 24 * 1024,
                        },
                    ],
                },
                chunkFileNames({ name }) {
                    // Each dynamic icon loader embeds the chunk path, so keep these paths short.
                    if (name.startsWith('lucide-icons~')) return 'assets/lucide-icons-[hash].js';
                    return 'assets/[name]-[hash].js';
                },
            },
        },
    },
});
