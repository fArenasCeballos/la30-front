import L from 'leaflet';

declare global {
  interface Window {
    L: typeof L;
  }
}

if (typeof window !== 'undefined') {
  window.L = window.L || L;
}

