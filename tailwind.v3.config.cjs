// Tailwind v3.4.17 build of exactly what the runtime CDN (<script src="https://cdn.tailwindcss.com">) used to generate in the browser,
// with the same inline config. Live fourcee.lutho.app layered these v3 rules over the compiled v4 CSS; keeping that cascade keeps the
// look pixel-identical while dropping the render-blocking CDN script and in-browser compile.
module.exports = Object.assign({
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              navy: {
                50: '#faf7f0',
                100: '#f3ebe0',
                200: '#e5d9c8',
                300: '#cfc0a8',
                400: '#a8957a',
                500: '#7a6b55',
                600: '#564c3d',
                700: '#3a342b',
                800: '#1f1c18',
                900: '#0c0b09',
                950: '#050504',
              },
              silver: {
                50: '#faf8f4',
                100: '#f0ebe3',
                200: '#ddd4c6',
                300: '#b8ae9e',
                400: '#8f8678',
                500: '#6b6358',
              }
            }
          }
        }
      }, { content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}', './constants.tsx'] });
