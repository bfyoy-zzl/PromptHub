/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // 映射 CSS 变量
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        bg: 'var(--bg-app)',
        surface: 'var(--bg-panel)',
        txt: 'var(--text-main)',
        sub: 'var(--text-sub)',
      },
      boxShadow: {
        // 映射新拟物阴影
        neu: 'var(--shadow-neu)',
        'neu-in': 'var(--shadow-neu-in)',
      }
    },
  },
  plugins: [],
}