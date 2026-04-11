import potrace from 'potrace';
import fs from 'fs';

const src = 'C:\\Users\\lgene\\.cursor\\projects\\c-Users-lgene-Desktop-3D-Dicing\\assets\\dolphin-silhouette.png';

potrace.trace(src, {
  threshold: 128,
  turdSize: 5,
  optTolerance: 0.2,
}, (err, svg) => {
  if (err) { console.error(err); process.exit(1); }

  const match = svg.match(/\bd="([^"]+)"/);
  if (!match) { console.error('No path found'); process.exit(1); }

  const pathD = match[1];
  console.log('=== SVG path d ===');
  console.log(pathD);
  console.log('\n=== length ===', pathD.length, 'chars');

  fs.writeFileSync('dolphin-path.txt', pathD, 'utf8');
  fs.writeFileSync('dolphin.svg', svg, 'utf8');
  console.log('Saved dolphin-path.txt and dolphin.svg');
});
