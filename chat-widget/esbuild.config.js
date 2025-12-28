const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

const isWatch = process.argv.includes('--watch')
const isProd = process.env.NODE_ENV === 'production'

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
  globalName: 'DellShopChat',
  platform: 'browser',
  target: ['chrome80', 'firefox75', 'safari13', 'edge80'],
  minify: isProd,
  sourcemap: !isProd,
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development')
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
}

async function build() {
  try {
    console.log(`Building chat-widget (${isProd ? 'production' : 'development'})...`)

    if (isWatch) {
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
