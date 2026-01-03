const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

const isWatch = process.argv.includes('--watch')
const isServe = process.argv.includes('--serve')
const isProd = process.env.NODE_ENV === 'production'
// In dev server mode, use localhost; otherwise use production domain
const supportDomain = isServe
  ? 'http://localhost:3500'
  : (process.env.SUPPORT_DOMAIN || 'https://chat.dellshop.ru')

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist')
}

// Build JavaScript bundle
const jsConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/chat-widget.js',
  format: 'iife',
  // Note: No globalName - we manually set window.DellShopChat in index.ts
  // to avoid esbuild overwriting our object with just the exports
  platform: 'browser',
  target: ['chrome80', 'firefox75', 'safari13', 'edge80'],
  minify: isProd,
  sourcemap: !isProd,
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
    'process.env.SUPPORT_DOMAIN': JSON.stringify(supportDomain)
  },
  banner: {
    js: `/* DellShop Chat Widget v0.1.0 | (c) ${new Date().getFullYear()} DellShop */`
  }
}

// Copy and minify CSS files
function buildCSS() {
  const cssDir = 'src/styles'
  const cssFiles = ['base.css', 'modal.css', 'drawer.css']

  cssFiles.forEach(file => {
    const srcPath = path.join(cssDir, file)
    const destPath = path.join('dist', file)

    if (fs.existsSync(srcPath)) {
      let css = fs.readFileSync(srcPath, 'utf-8')

      if (isProd) {
        // Simple CSS minification
        css = css
          .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
          .replace(/\s+/g, ' ')              // Collapse whitespace
          .replace(/\s*([{}:;,])\s*/g, '$1') // Remove spaces around punctuation
          .trim()
      }

      fs.writeFileSync(destPath, css)
      console.log(`  CSS: ${file} -> ${destPath}`)
    }
  })

  // Copy theme CSS files
  const themesDir = path.join(cssDir, 'themes')
  const distThemesDir = path.join('dist', 'themes')

  if (fs.existsSync(themesDir)) {
    if (!fs.existsSync(distThemesDir)) {
      fs.mkdirSync(distThemesDir, { recursive: true })
    }

    const themeFiles = fs.readdirSync(themesDir).filter(f => f.endsWith('.css'))
    themeFiles.forEach(file => {
      const srcPath = path.join(themesDir, file)
      let css = fs.readFileSync(srcPath, 'utf-8')

      if (isProd) {
        css = css
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\s+/g, ' ')
          .replace(/\s*([{}:;,])\s*/g, '$1')
          .trim()
      }

      fs.writeFileSync(path.join(distThemesDir, file), css)
      console.log(`  CSS: themes/${file} -> dist/themes/${file}`)
    })
  }
}

async function build() {
  try {
    const mode = isProd ? 'production' : 'development'
    console.log(`Building chat-widget (${mode})...`)

    if (isServe) {
      // Dev server mode with live reload
      const ctx = await esbuild.context(jsConfig)

      // Initial build
      await ctx.rebuild()
      buildCSS()

      // Start watching
      await ctx.watch()

      // Start dev server
      const { host, port } = await ctx.serve({
        servedir: 'dist',
        port: 3400,
        fallback: 'dev/index.html'
      })

      // Copy dev HTML to dist for serving
      fs.copyFileSync('dev/index.html', 'dist/index.html')

      console.log('')
      console.log('='.repeat(50))
      console.log(`  Dev server running at: http://localhost:${port}`)
      console.log(`  API URL: ${supportDomain}`)
      console.log('='.repeat(50))
      console.log('')
      console.log('Watching for changes... (Ctrl+C to stop)')

      // Watch CSS files
      const cssDir = 'src/styles'
      if (fs.existsSync(cssDir)) {
        fs.watch(cssDir, (eventType, filename) => {
          if (filename && filename.endsWith('.css')) {
            console.log(`CSS changed: ${filename}`)
            buildCSS()
          }
        })
      }

      // Watch dev HTML
      fs.watch('dev', (eventType, filename) => {
        if (filename === 'index.html') {
          console.log('Dev HTML changed, copying...')
          fs.copyFileSync('dev/index.html', 'dist/index.html')
        }
      })

    } else if (isWatch) {
      // Watch mode without server (existing behavior)
      const ctx = await esbuild.context(jsConfig)
      await ctx.watch()
      console.log('Watching for changes...')

      // Watch CSS files
      const cssDir = 'src/styles'
      if (fs.existsSync(cssDir)) {
        fs.watch(cssDir, (eventType, filename) => {
          if (filename && filename.endsWith('.css')) {
            console.log(`CSS changed: ${filename}`)
            buildCSS()
          }
        })
      }
    } else {
      // One-time build (production)
      await esbuild.build(jsConfig)
      buildCSS()

      // Report bundle size
      const stats = fs.statSync('dist/chat-widget.js')
      const sizeKB = (stats.size / 1024).toFixed(2)
      console.log(`  JS: chat-widget.js (${sizeKB} KB)`)
      console.log('Build complete!')
    }
  } catch (error) {
    console.error('Build failed:', error)
    process.exit(1)
  }
}

build()
