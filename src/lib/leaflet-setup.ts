import L from 'leaflet';

if (typeof window !== 'undefined') {
  // @ts-ignore
  window.L = window.L || L;
}
