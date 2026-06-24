import { CelestialBody } from './types';

export const celestialBodies: Record<string, CelestialBody> = {
  mars: {
    name: 'Mars',
    baseUrl: 'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png',
    attribution: 'USGS Astrogeology',
    maxZoom: 7,
    emoji: '🔴'
  },
  moon: {
    name: 'Moon',
    baseUrl: 'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.png',
    attribution: 'USGS Astrogeology',
    maxZoom: 7,
    emoji: '🌙'
  },
  mercury: {
    name: 'Mercury',
    baseUrl: 'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mercury-basemap-v0-1/all/{z}/{x}/{y}.png',
    attribution: 'USGS Astrogeology',
    maxZoom: 7,
    emoji: '☿'
  },
};
