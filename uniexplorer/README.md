# UniExplorer — Planetary Terrain Explorer

A collaborative mapping application for exploring the terrains of Mars, the Moon, and Mercury. 

## Biophilic Design System

UniExplorer features a complete, organic biophilic design overhaul designed to feel like a high-tech science exploration dashboard:
- **Earthy Palette**: Warm cream backgrounds (`#FEFCF3`), forest green accents (`#15803D`), sand decorative highlight tones (`#F5E6D3`), and terracotta CTA accents (`#C2410C`).
- **Typography**: DM Serif Display for elegant, vintage scientific headings and Nunito for friendly, rounded body copy.
- **Topographic contours**: Dynamic, subtle HTML5 canvas-rendered contour waves flowing in the background instead of standard dark space backgrounds.
- **Floating Overlays**: Full-bleed responsive mapping viewport with custom Leaflet controls matched to biophilic styles, overlaid with floating statistics, live coordinate scanners, and active filter controllers.
- **Modular Architecture**: 15+ standalone custom components using vanilla CSS custom properties.

## Redesign Features

1. **Top Command Bar**: Clean, structured biophilic header wrapping Google Authentication and rank achievements.
2. **Horizontal Planet Selector**: Pill-shaped selector with terrain-coded active buttons.
3. **Observation Form**: Dialog to log new geologic coordinates with detailed notes.
4. **Discovery Detail Panel**: Detail card showing coordinate data and observer metadata.
5. **Interactive Leaderboard**: Rankings calculated based on global annotations.
6. **Toast & Skeleton primitives**: Animated toasts and skeletal templates for visual polish.

## Installation & Setup

```bash
cd uniexplorer
npm install
npm run dev
```
