import fs from 'fs';

const pathD = fs.readFileSync('dolphin-path.txt', 'utf8').trim();

const nums = [];
const re = /[-+]?[0-9]*\.?[0-9]+/g;
let m;
while ((m = re.exec(pathD)) !== null) nums.push(parseFloat(m[0]));

let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
for (let i = 0; i < nums.length; i += 2) {
  const x = nums[i], y = nums[i + 1];
  if (x < xMin) xMin = x;
  if (x > xMax) xMax = x;
  if (y < yMin) yMin = y;
  if (y > yMax) yMax = y;
}

console.log('Bounding box (control points):');
console.log(`  x: [${xMin.toFixed(1)} .. ${xMax.toFixed(1)}]  width=${(xMax - xMin).toFixed(1)}`);
console.log(`  y: [${yMin.toFixed(1)} .. ${yMax.toFixed(1)}]  height=${(yMax - yMin).toFixed(1)}`);

const tailTip = { x: xMin, y: yMax };
const noseTip = { x: xMax, y: yMin };

console.log(`\nTail tip (bottom-left):  (${tailTip.x.toFixed(1)}, ${tailTip.y.toFixed(1)})`);
console.log(`Nose tip (top-right):    (${noseTip.x.toFixed(1)}, ${noseTip.y.toFixed(1)})`);

const sqSide = noseTip.x - tailTip.x;
console.log(`\nSquare side (horizontal tail→nose perpendicular): ${sqSide.toFixed(1)}`);
console.log(`Square: top-left = (${tailTip.x.toFixed(1)}, ${(tailTip.y - sqSide).toFixed(1)})`);
console.log(`        bottom-right = (${noseTip.x.toFixed(1)}, ${tailTip.y.toFixed(1)})`);

const cx = tailTip.x + sqSide / 2;
const cy = tailTip.y - sqSide / 2;
console.log(`\nSquare center: (${cx.toFixed(1)}, ${cy.toFixed(1)})`);
console.log(`BBox center:   (${((xMin + xMax) / 2).toFixed(1)}, ${((yMin + yMax) / 2).toFixed(1)})`);
console.log(`Offset from bbox center: dx=${(cx - (xMin + xMax) / 2).toFixed(1)}, dy=${(cy - (yMin + yMax) / 2).toFixed(1)}`);
