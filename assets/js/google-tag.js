const GA_MEASUREMENT_ID = 'G-57LN15BGDN';

window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag() {
  window.dataLayer.push(arguments);
};

const script = document.createElement('script');
script.async = true;
script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
document.head.appendChild(script);

window.gtag('js', new Date());
window.gtag('config', GA_MEASUREMENT_ID);
