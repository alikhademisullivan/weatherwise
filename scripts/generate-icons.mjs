import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('./client/public/favicon.svg');
await sharp(svg).resize(32).png().toFile('./client/public/favicon-32.png');
await sharp(svg).resize(16).png().toFile('./client/public/favicon-16.png');
await sharp(svg).resize(180).png().toFile('./client/public/apple-touch-icon.png');
console.log('Icons generated.');
