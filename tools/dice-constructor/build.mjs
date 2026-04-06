import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { dicePresets, meshPresets } from "./lib/dice-presets.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const themesRoot = path.join(projectRoot, "assets", "themes");

const usage = `Usage:
  node ./tools/dice-constructor/build.mjs <preset-id>

Available presets:
  ${Object.keys(dicePresets).join("\n  ")}`;

const xmlEscapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const escapeXml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => xmlEscapeMap[char]);

const svgNumber = (value) => Number(value.toFixed(3));

const reverseMapping = (mapping) =>
  Object.fromEntries(Object.entries(mapping).map(([value, slot]) => [slot, Number(value)]));

const getPreset = (presetId) => {
  const preset = dicePresets[presetId];
  if (!preset) {
    throw new Error(`Unknown preset '${presetId}'.\n\n${usage}`);
  }
  const meshPreset = meshPresets[preset.meshPreset];
  if (!meshPreset) {
    throw new Error(`Mesh preset '${preset.meshPreset}' is not registered.`);
  }
  return { preset, meshPreset };
};

const loadSourceMesh = async (sourceTheme, meshFile) => {
  const sourceMeshPath = path.join(themesRoot, sourceTheme, meshFile);
  const meshJson = JSON.parse(await readFile(sourceMeshPath, "utf8"));
  return { sourceMeshPath, meshJson };
};

const classifyAxis = (normal) => {
  const abs = normal.map((value) => Math.abs(value));
  if (abs[0] > abs[1] && abs[0] > abs[2]) {
    return normal[0] >= 0 ? "xpos" : "xneg";
  }
  if (abs[1] > abs[2]) {
    return normal[1] >= 0 ? "ypos" : "yneg";
  }
  return normal[2] >= 0 ? "zpos" : "zneg";
};

const getTriangleNormal = (positions, indices, triangleIndex) => {
  const ia = indices[triangleIndex * 3];
  const ib = indices[triangleIndex * 3 + 1];
  const ic = indices[triangleIndex * 3 + 2];
  const a = [positions[ia * 3], positions[ia * 3 + 1], positions[ia * 3 + 2]];
  const b = [positions[ib * 3], positions[ib * 3 + 1], positions[ib * 3 + 2]];
  const c = [positions[ic * 3], positions[ic * 3 + 1], positions[ic * 3 + 2]];
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const raw = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(raw[0], raw[1], raw[2]) || 1;
  return raw.map((value) => value / length);
};

const deriveValueToSlotFromCollider = (meshJson, dieType) => {
  const colliderMesh = meshJson.meshes.find((mesh) => mesh.name === `${dieType}_collider`);
  if (!colliderMesh) {
    throw new Error(`Collider mesh '${dieType}_collider' is missing in source mesh file.`);
  }
  const colliderFaceMap = meshJson.colliderFaceMap?.[dieType];
  if (!colliderFaceMap) {
    throw new Error(`colliderFaceMap for '${dieType}' is missing in source mesh file.`);
  }

  const valueToSlot = {};
  const triangleCount = colliderMesh.indices.length / 3;
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const mappedValue = colliderFaceMap[String(triangleIndex)];
    if (!mappedValue) continue;
    const slot = classifyAxis(
      getTriangleNormal(colliderMesh.positions, colliderMesh.indices, triangleIndex)
    );
    valueToSlot[mappedValue] ??= slot;
  }
  return valueToSlot;
};

const assertValueToSlotMapping = (actual, expected) => {
  const expectedEntries = Object.entries(expected);
  for (const [value, slot] of expectedEntries) {
    if (actual[value] !== slot) {
      throw new Error(
        `Collider mapping drift for value ${value}: expected '${slot}', got '${actual[value] ?? "missing"}'.`
      );
    }
  }
};

const toAtlasRect = (slot, atlas) => {
  const x = slot.uMin * atlas.width;
  const y = slot.vMin * atlas.height;
  const width = (slot.uMax - slot.uMin) * atlas.width;
  const height = (slot.vMax - slot.vMin) * atlas.height;
  return { x, y, width, height };
};

const getSafeBox = ({ meshPreset, faceStyle, atlas, slotName }) => {
  const box = meshPreset.contentBoxes?.[slotName];
  if (box) {
    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
    };
  }

  const safeInset = faceStyle.contentInset ?? atlas.safeInset;
  const slot = meshPreset.slots[slotName];
  return {
    left: safeInset / ((slot.uMax - slot.uMin) * atlas.width),
    right: safeInset / ((slot.uMax - slot.uMin) * atlas.width),
    top: safeInset / ((slot.vMax - slot.vMin) * atlas.height),
    bottom: safeInset / ((slot.vMax - slot.vMin) * atlas.height),
  };
};

const normalizedCornerCoords = {
  tl: { s: 0, t: 0 },
  tr: { s: 1, t: 0 },
  br: { s: 1, t: 1 },
  bl: { s: 0, t: 1 },
};

const triangleArea2D = (a, b, c) =>
  (b.s - a.s) * (c.t - a.t) - (b.t - a.t) * (c.s - a.s);

const getBarycentricWeights = (triangle, point) => {
  const [a, b, c] = triangle;
  const area = triangleArea2D(a, b, c);
  if (Math.abs(area) < 1e-9) {
    throw new Error("Degenerate triangle in face UV mapping.");
  }
  return {
    a: triangleArea2D(point, b, c) / area,
    b: triangleArea2D(a, point, c) / area,
    c: triangleArea2D(a, b, point) / area,
  };
};

const pointInTriangle = (triangle, point, epsilon = 1e-6) => {
  const weights = getBarycentricWeights(triangle, point);
  return weights.a >= -epsilon && weights.b >= -epsilon && weights.c >= -epsilon;
};

const dedupeByKey = (items, getKey) => {
  const map = new Map();
  for (const item of items) {
    map.set(getKey(item), item);
  }
  return [...map.values()];
};

const interpolateUvFromTriangle = (triangle, point) => {
  const weights = getBarycentricWeights(
    triangle.localPoints,
    point
  );
  return {
    u:
      triangle.uvPoints[0].u * weights.a +
      triangle.uvPoints[1].u * weights.b +
      triangle.uvPoints[2].u * weights.c,
    v:
      triangle.uvPoints[0].v * weights.a +
      triangle.uvPoints[1].v * weights.b +
      triangle.uvPoints[2].v * weights.c,
  };
};

const deriveFaceUvMappings = (meshJson, dieType, slotNames) => {
  const mesh = meshJson.meshes.find((entry) => entry.name === dieType);
  if (!mesh) {
    throw new Error(`Render mesh '${dieType}' is missing in source mesh file.`);
  }

  const slotVertexMap = Object.fromEntries(slotNames.map((slotName) => [slotName, []]));
  for (let vertexIndex = 0; vertexIndex < mesh.positions.length / 3; vertexIndex += 1) {
    const normal = [
      mesh.normals[vertexIndex * 3],
      mesh.normals[vertexIndex * 3 + 1],
      mesh.normals[vertexIndex * 3 + 2],
    ];
    const abs = normal.map((value) => Math.abs(value));
    const dominant = Math.max(...abs);
    if (dominant < 0.9) continue;
    const slotName = classifyAxis(normal);
    if (!slotVertexMap[slotName]) continue;
    slotVertexMap[slotName].push({
      index: vertexIndex,
      uv: {
        u: mesh.uvs[vertexIndex * 2],
        v: mesh.uvs[vertexIndex * 2 + 1],
      },
    });
  }

  const mappings = {};
  for (const slotName of slotNames) {
    const vertices = dedupeByKey(slotVertexMap[slotName], (vertex) => String(vertex.index));
    if (vertices.length !== 4) {
      throw new Error(`Expected 4 flat-face vertices for slot '${slotName}', got ${vertices.length}.`);
    }
    const center = vertices.reduce(
      (acc, vertex) => ({ u: acc.u + vertex.uv.u, v: acc.v + vertex.uv.v }),
      { u: 0, v: 0 }
    );
    const centerU = center.u / vertices.length;
    const centerV = center.v / vertices.length;
    const corners = {};
    const vertexLabelMap = new Map();
    for (const vertex of vertices) {
      const horizontal = vertex.uv.u < centerU ? "l" : "r";
      const vertical = vertex.uv.v < centerV ? "t" : "b";
      const label = `${vertical}${horizontal === "l" ? "l" : "r"}`;
      corners[label] = vertex.uv;
      vertexLabelMap.set(vertex.index, label);
    }
    if (!corners.tl || !corners.tr || !corners.br || !corners.bl) {
      throw new Error(`Could not assign UV quadrants for slot '${slotName}'.`);
    }

    const cornerIndices = new Set(vertices.map((vertex) => vertex.index));
    const triangles = [];
    const triangleCount = mesh.indices.length / 3;
    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      const ids = [
        mesh.indices[triangleIndex * 3],
        mesh.indices[triangleIndex * 3 + 1],
        mesh.indices[triangleIndex * 3 + 2],
      ];
      if (!ids.every((id) => cornerIndices.has(id))) continue;
      const labels = ids.map((id) => vertexLabelMap.get(id));
      const localPoints = labels.map((label) => normalizedCornerCoords[label]);
      if (Math.abs(triangleArea2D(localPoints[0], localPoints[1], localPoints[2])) < 0.4) continue;
      triangles.push({
        labels,
        localPoints,
        uvPoints: labels.map((label) => corners[label]),
      });
    }

    if (triangles.length !== 2) {
      throw new Error(`Expected 2 flat-face triangles for slot '${slotName}', got ${triangles.length}.`);
    }

    mappings[slotName] = { corners, triangles };
  }
  return mappings;
};

const mapFacePointToUv = (faceUvMapping, s, t) => {
  const point = { s, t };
  const triangle =
    faceUvMapping.triangles.find((candidate) => pointInTriangle(candidate.localPoints, point)) ??
    faceUvMapping.triangles[0];
  return interpolateUvFromTriangle(triangle, point);
};

const uvToAtlasPoint = (uv, atlas) => ({
  x: uv.u * atlas.width,
  y: uv.v * atlas.height,
});

const mapSafeFacePointToUv = ({ meshPreset, faceStyle, atlas, slotName, faceUvMapping, s, t }) => {
  const safeBox = getSafeBox({ meshPreset, faceStyle, atlas, slotName });
  const faceS = safeBox.left + s * (1 - safeBox.left - safeBox.right);
  const faceT = safeBox.top + t * (1 - safeBox.top - safeBox.bottom);
  return mapFacePointToUv(faceUvMapping, faceS, faceT);
};

const getPipLayout = (value, style) => {
  const c = style.centerOffset;
  const corner = style.cornerOffset;
  const mid = style.midOffset;
  const layouts = {
    1: [[c, c]],
    2: [[-corner, -corner], [corner, corner]],
    3: [[-corner, -corner], [c, c], [corner, corner]],
    4: [[-corner, -corner], [corner, -corner], [-corner, corner], [corner, corner]],
    5: [
      [-corner, -corner],
      [corner, -corner],
      [c, c],
      [-corner, corner],
      [corner, corner],
    ],
    6: [
      [-corner, -corner],
      [corner, -corner],
      [-corner, c],
      [corner, c],
      [-corner, corner],
      [corner, corner],
    ],
  };
  return layouts[value] ?? [];
};

const getResolvedFaceKind = (preset, face) => face.kind ?? preset.faceStyle.kind ?? "pips";

const buildFaceMarkMarkup = ({ face, preset, meshPreset, atlas, slotName, faceUvMapping }) => {
  const { faceStyle, palette } = preset;
  const safeTopLeftUv = mapSafeFacePointToUv({
    meshPreset,
    faceStyle,
    atlas,
    slotName,
    faceUvMapping,
    s: 0,
    t: 0,
  });
  const safeTopRightUv = mapSafeFacePointToUv({
    meshPreset,
    faceStyle,
    atlas,
    slotName,
    faceUvMapping,
    s: 1,
    t: 0,
  });
  const safeBottomRightUv = mapSafeFacePointToUv({
    meshPreset,
    faceStyle,
    atlas,
    slotName,
    faceUvMapping,
    s: 1,
    t: 1,
  });
  const safeBottomLeftUv = mapSafeFacePointToUv({
    meshPreset,
    faceStyle,
    atlas,
    slotName,
    faceUvMapping,
    s: 0,
    t: 1,
  });
  const safeCenterUv = mapSafeFacePointToUv({
    meshPreset,
    faceStyle,
    atlas,
    slotName,
    faceUvMapping,
    s: 0.5,
    t: 0.5,
  });
  const safeCenter = uvToAtlasPoint(safeCenterUv, atlas);
  const safeTopLeft = uvToAtlasPoint(safeTopLeftUv, atlas);
  const safeTopRight = uvToAtlasPoint(safeTopRightUv, atlas);
  const safeBottomRight = uvToAtlasPoint(safeBottomRightUv, atlas);
  const safeBottomLeft = uvToAtlasPoint(safeBottomLeftUv, atlas);
  const approxWidth = Math.hypot(safeTopRight.x - safeTopLeft.x, safeTopRight.y - safeTopLeft.y);
  const approxHeight = Math.hypot(safeBottomLeft.x - safeTopLeft.x, safeBottomLeft.y - safeTopLeft.y);
  const kind = getResolvedFaceKind(preset, face);

  if (kind === "probe") {
    const stroke = face.probeStroke ?? faceStyle.probeStroke ?? palette.markFill;
    const strokeWidth = face.probeStrokeWidth ?? faceStyle.probeStrokeWidth ?? 6;
    const dotRadius = face.probeDotRadius ?? faceStyle.probeDotRadius ?? 8;
    const label = face.text ?? String(face.value ?? "");
    const labelSize = Math.min(approxWidth, approxHeight) * (face.labelScale ?? faceStyle.labelScale ?? 0.2);
    const midLeft = uvToAtlasPoint(
      mapSafeFacePointToUv({ meshPreset, faceStyle, atlas, slotName, faceUvMapping, s: 0, t: 0.5 }),
      atlas
    );
    const midRight = uvToAtlasPoint(
      mapSafeFacePointToUv({ meshPreset, faceStyle, atlas, slotName, faceUvMapping, s: 1, t: 0.5 }),
      atlas
    );
    const midTop = uvToAtlasPoint(
      mapSafeFacePointToUv({ meshPreset, faceStyle, atlas, slotName, faceUvMapping, s: 0.5, t: 0 }),
      atlas
    );
    const midBottom = uvToAtlasPoint(
      mapSafeFacePointToUv({ meshPreset, faceStyle, atlas, slotName, faceUvMapping, s: 0.5, t: 1 }),
      atlas
    );
    const labelPoint = uvToAtlasPoint(
      mapSafeFacePointToUv({ meshPreset, faceStyle, atlas, slotName, faceUvMapping, s: 0.5, t: 0.86 }),
      atlas
    );
    return [
      `<polygon points="${svgNumber(safeTopLeft.x)},${svgNumber(safeTopLeft.y)} ${svgNumber(safeTopRight.x)},${svgNumber(safeTopRight.y)} ${svgNumber(safeBottomRight.x)},${svgNumber(safeBottomRight.y)} ${svgNumber(safeBottomLeft.x)},${svgNumber(safeBottomLeft.y)}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
      `<line x1="${svgNumber(midLeft.x)}" y1="${svgNumber(midLeft.y)}" x2="${svgNumber(midRight.x)}" y2="${svgNumber(midRight.y)}" stroke="${stroke}" stroke-width="${svgNumber(Math.max(2, strokeWidth * 0.5))}" />`,
      `<line x1="${svgNumber(midTop.x)}" y1="${svgNumber(midTop.y)}" x2="${svgNumber(midBottom.x)}" y2="${svgNumber(midBottom.y)}" stroke="${stroke}" stroke-width="${svgNumber(Math.max(2, strokeWidth * 0.5))}" />`,
      `<circle cx="${svgNumber(safeCenter.x)}" cy="${svgNumber(safeCenter.y)}" r="${svgNumber(dotRadius)}" fill="${stroke}" />`,
      `<text x="${svgNumber(labelPoint.x)}" y="${svgNumber(labelPoint.y)}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${svgNumber(labelSize)}" font-weight="700" fill="${stroke}">${escapeXml(label)}</text>`,
    ].join("");
  }

  if (kind === "label") {
    const fontFamily = face.labelFontFamily ?? faceStyle.labelFontFamily ?? "Georgia, serif";
    const fontWeight = face.labelWeight ?? faceStyle.labelWeight ?? 700;
    const labelScale = face.labelScale ?? faceStyle.labelScale ?? 0.54;
    const fontSize = Math.min(approxWidth, approxHeight) * labelScale;
    const text = face.text ?? String(face.value ?? "");
    return `<text x="${svgNumber(safeCenter.x)}" y="${svgNumber(safeCenter.y)}" text-anchor="middle" dominant-baseline="central" font-family="${escapeXml(fontFamily)}" font-size="${svgNumber(fontSize)}" font-weight="${fontWeight}" fill="${palette.markFill}">${escapeXml(text)}</text>`;
  }

  const localRadius = Math.max(0.01, faceStyle.pipScale * 0.75);
  const pipLayout = getPipLayout(face.value, faceStyle);
  return pipLayout
    .map(([nx, ny]) => {
      const uv = mapSafeFacePointToUv({
        meshPreset,
        faceStyle,
        atlas,
        slotName,
        faceUvMapping,
        s: 0.5 + nx,
        t: 0.5 + ny,
      });
      const point = uvToAtlasPoint(uv, atlas);
      const radiusPointX = uvToAtlasPoint(
        mapSafeFacePointToUv({
          meshPreset,
          faceStyle,
          atlas,
          slotName,
          faceUvMapping,
          s: 0.5 + nx + localRadius,
          t: 0.5 + ny,
        }),
        atlas
      );
      const radiusPointY = uvToAtlasPoint(
        mapSafeFacePointToUv({
          meshPreset,
          faceStyle,
          atlas,
          slotName,
          faceUvMapping,
          s: 0.5 + nx,
          t: 0.5 + ny + localRadius,
        }),
        atlas
      );
      const rx = Math.max(2, Math.hypot(radiusPointX.x - point.x, radiusPointX.y - point.y));
      const ry = Math.max(2, Math.hypot(radiusPointY.x - point.x, radiusPointY.y - point.y));
      return `<ellipse cx="${svgNumber(point.x)}" cy="${svgNumber(point.y)}" rx="${svgNumber(rx)}" ry="${svgNumber(ry)}" fill="${palette.markFill}" />`;
    })
    .join("");
};

const buildFaceTileMarkup = ({ rect, face, preset, atlas, slotName, meshPreset, faceUvMapping }) => {
  const { palette, faceStyle } = preset;
  const bleed = atlas.bleed;
  const plateX = rect.x - bleed;
  const plateY = rect.y - bleed;
  const plateWidth = rect.width + bleed * 2;
  const plateHeight = rect.height + bleed * 2;

  return `
    <g data-slot="${escapeXml(slotName)}" data-value="${escapeXml(face.value)}">
      <rect
        x="${svgNumber(plateX)}"
        y="${svgNumber(plateY)}"
        width="${svgNumber(plateWidth)}"
        height="${svgNumber(plateHeight)}"
        rx="${faceStyle.slotCornerRadius}"
        ry="${faceStyle.slotCornerRadius}"
        fill="${palette.faceFill}"
      />
      ${buildFaceMarkMarkup({ face, preset, meshPreset, atlas, slotName, faceUvMapping })}
    </g>`;
};

const buildAtlasSvg = ({ preset, meshPreset, valueToSlot, faceUvMappings }) => {
  const { atlas } = meshPreset;
  const slotMarkup = Object.entries(valueToSlot)
    .map(([value, slotName]) => {
      const slot = meshPreset.slots[slotName];
      if (!slot) {
        throw new Error(`Slot '${slotName}' is not defined in mesh preset '${meshPreset.id}'.`);
      }
      const face = preset.faces[value];
      if (!face) {
        throw new Error(`Preset '${preset.id}' is missing face definition for value ${value}.`);
      }
      return buildFaceTileMarkup({
        rect: toAtlasRect(slot, atlas),
        face,
        preset,
        atlas,
        slotName,
        meshPreset,
        faceUvMapping: faceUvMappings[slotName],
      });
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${atlas.width}" height="${atlas.height}" viewBox="0 0 ${atlas.width} ${atlas.height}">
  <rect width="${atlas.width}" height="${atlas.height}" fill="${preset.palette.bodyFill}" />
  ${slotMarkup}
</svg>
`;
};

const buildThemeConfig = ({ preset, meshPreset }) => ({
  name: preset.displayName,
  systemName: preset.systemName,
  author: preset.author,
  version: preset.version,
  meshFile: meshPreset.meshFile,
  material: {
    type: "color",
    diffuseTexture: {
      light: "diffuse-light.svg",
      dark: "diffuse-dark.svg",
    },
    diffuseLevel: 1,
  },
  diceAvailable: [preset.dieType],
});

const buildMetadata = ({ preset, meshPreset, valueToSlot }) => ({
  presetId: preset.id,
  systemName: preset.systemName,
  generatedAt: new Date().toISOString(),
  dieType: preset.dieType,
  meshPreset: meshPreset.id,
  atlas: meshPreset.atlas,
  valueToSlot,
  slots: meshPreset.slots,
});

const buildNetSvg = ({ preset, meshPreset, valueToSlot }) => {
  const slotToValue = reverseMapping(valueToSlot);
  const layout = {
    ypos: { col: 1, row: 0 },
    xneg: { col: 0, row: 1 },
    zpos: { col: 1, row: 1 },
    xpos: { col: 2, row: 1 },
    zneg: { col: 3, row: 1 },
    yneg: { col: 1, row: 2 },
  };
  const tileSize = 220;
  const margin = 40;
  const width = margin * 2 + tileSize * 4;
  const height = margin * 2 + tileSize * 3;
  const pipRadius = 18;
  const cornerOffset = 0.27;
  const midOffset = 0.23;

  const faceMarkup = Object.entries(layout)
    .map(([slotName, position]) => {
      const value = slotToValue[slotName];
      const x = margin + position.col * tileSize;
      const y = margin + position.row * tileSize;
      const face = preset.faces[value];
      const kind = getResolvedFaceKind(preset, face);
      const safeBox = getSafeBox({
        meshPreset,
        faceStyle: preset.faceStyle,
        atlas: meshPreset.atlas,
        slotName,
      });
      const contentRect = {
        x: x + tileSize * safeBox.left,
        y: y + tileSize * safeBox.top,
        width: tileSize * (1 - safeBox.left - safeBox.right),
        height: tileSize * (1 - safeBox.top - safeBox.bottom),
      };
      const marks =
        kind === "probe"
          ? [
              `<rect x="${svgNumber(contentRect.x)}" y="${svgNumber(contentRect.y)}" width="${svgNumber(contentRect.width)}" height="${svgNumber(contentRect.height)}" rx="12" ry="12" fill="none" stroke="${preset.palette.markFill}" stroke-width="4" />`,
              `<line x1="${svgNumber(contentRect.x)}" y1="${svgNumber(contentRect.y + contentRect.height / 2)}" x2="${svgNumber(contentRect.x + contentRect.width)}" y2="${svgNumber(contentRect.y + contentRect.height / 2)}" stroke="${preset.palette.markFill}" stroke-width="3" />`,
              `<line x1="${svgNumber(contentRect.x + contentRect.width / 2)}" y1="${svgNumber(contentRect.y)}" x2="${svgNumber(contentRect.x + contentRect.width / 2)}" y2="${svgNumber(contentRect.y + contentRect.height)}" stroke="${preset.palette.markFill}" stroke-width="3" />`,
              `<circle cx="${svgNumber(contentRect.x + contentRect.width / 2)}" cy="${svgNumber(contentRect.y + contentRect.height / 2)}" r="8" fill="${preset.palette.markFill}" />`,
              `<text x="${svgNumber(contentRect.x + contentRect.width / 2)}" y="${svgNumber(contentRect.y + contentRect.height - 18)}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" fill="${preset.palette.markFill}">${escapeXml(face.text ?? String(value))}</text>`,
            ].join("")
          : kind === "label"
          ? `<text x="${svgNumber(x + tileSize / 2)}" y="${svgNumber(y + tileSize / 2)}" text-anchor="middle" dominant-baseline="central" font-family="${escapeXml(face.labelFontFamily ?? preset.faceStyle.labelFontFamily ?? "Georgia, serif")}" font-size="${svgNumber(tileSize * (face.labelScale ?? preset.faceStyle.labelScale ?? 0.54))}" font-weight="${face.labelWeight ?? preset.faceStyle.labelWeight ?? 700}" fill="${preset.palette.markFill}">${escapeXml(face.text ?? String(value))}</text>`
          : getPipLayout(value, {
              centerOffset: 0,
              cornerOffset,
              midOffset,
            })
              .map(([nx, ny]) => {
                const cx = contentRect.x + contentRect.width * (0.5 + nx);
                const cy = contentRect.y + contentRect.height * (0.5 + ny);
                return `<circle cx="${svgNumber(cx)}" cy="${svgNumber(cy)}" r="${pipRadius}" fill="${preset.palette.markFill}" />`;
              })
              .join("");
      const slot = meshPreset.slots[slotName];
      const slotLabel = `${slotName}  u=[${slot.uMin},${slot.uMax}] v=[${slot.vMin},${slot.vMax}]`;

      return `
    <g data-slot="${slotName}" data-value="${value}">
      <rect x="${x}" y="${y}" width="${tileSize}" height="${tileSize}" rx="16" ry="16" fill="${preset.palette.faceFill}" stroke="#1c1c1c" stroke-width="4" />
      <text x="${x + 14}" y="${y + 26}" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#444">${slotLabel}</text>
      <text x="${x + tileSize / 2}" y="${y + tileSize - 18}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" fill="#444">value ${value}</text>
      ${marks}
    </g>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f3efe7" />
  <text x="${margin}" y="24" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#222">d6 constructor net preview</text>
  <text x="${margin}" y="${height - 12}" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#444">This net is a design/debug surface. The runtime still renders a UV-mapped atlas on the real 3D mesh.</text>
  ${faceMarkup}
</svg>
`;
};

const main = async () => {
  const presetId = process.argv[2];
  if (!presetId) {
    throw new Error(usage);
  }

  const { preset, meshPreset } = getPreset(presetId);
  const { sourceMeshPath, meshJson } = await loadSourceMesh(preset.sourceTheme, meshPreset.meshFile);
  const actualValueToSlot = deriveValueToSlotFromCollider(meshJson, preset.dieType);
  assertValueToSlotMapping(actualValueToSlot, meshPreset.expectedValueToSlot);
  const faceUvMappings = deriveFaceUvMappings(
    meshJson,
    preset.dieType,
    Object.values(meshPreset.expectedValueToSlot)
  );

  const outputDir = path.join(themesRoot, preset.systemName);
  const atlasSvg = buildAtlasSvg({
    preset,
    meshPreset,
    valueToSlot: meshPreset.expectedValueToSlot,
    faceUvMappings,
  });
  const netSvg = buildNetSvg({
    preset,
    meshPreset,
    valueToSlot: meshPreset.expectedValueToSlot,
  });
  const themeConfig = buildThemeConfig({ preset, meshPreset });
  const metadata = buildMetadata({
    preset,
    meshPreset,
    valueToSlot: meshPreset.expectedValueToSlot,
  });

  await mkdir(outputDir, { recursive: true });
  await copyFile(sourceMeshPath, path.join(outputDir, meshPreset.meshFile));
  await writeFile(path.join(outputDir, "diffuse-light.svg"), atlasSvg, "utf8");
  await writeFile(path.join(outputDir, "diffuse-dark.svg"), atlasSvg, "utf8");
  await writeFile(path.join(outputDir, "design-net.svg"), netSvg, "utf8");
  await writeFile(path.join(outputDir, "theme.config.json"), `${JSON.stringify(themeConfig, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "build-info.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  console.log(`Generated theme '${preset.systemName}' in ${outputDir}`);
  console.log(`Verified collider mapping: ${JSON.stringify(actualValueToSlot)}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
