/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        google: {
          blue: '#1a73e8',
          blueHover: '#1557b0',
          blueLight: '#e8f0fe',
          blueBorder: '#d2e3fc',
          red: '#ea4335',
          redHover: '#d93025',
          redLight: '#fce8e6',
          redBorder: '#fad2cf',
          yellow: '#fbbc04',
          yellowDark: '#e37400',
          yellowLight: '#fef7e0',
          yellowBorder: '#feefc3',
          green: '#34a853',
          greenHover: '#188038',
          greenLight: '#e6f4ea',
          greenBorder: '#ceead6',
          gray: '#5f6368',
          grayDark: '#3c4043',
          grayLight: '#f1f3f4',
          grayHover: '#e8eaed',
          border: '#dadce0',
          borderLight: '#e8eaed',
          text: '#202124',
          surface: '#ffffff',
          bg: '#f8fafd',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        google: '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
        'google-md': '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
        'google-card': '0 1px 2px 0 rgba(60,64,67,0.15)',
      },
    },
  },
  plugins: [],
};
