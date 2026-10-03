import { extend } from "@pixi/react";
import {
  BitmapText,
  BufferImageSource,
  CanvasSource,
  Color,
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Rectangle,
  Sprite,
  Texture,
} from "pixi.js";

import { phaseTint } from "../../../config/CanvasTheme.js";
import { Typography } from "../../../config/Typography.js";
import { rasterMatrix } from "../../renderers/rasters.js";
import { acquireBitmapFont, releaseBitmapFont } from "../../text/BitmapFonts.js";
import { textLayoutVersion } from "../../text/TextLayout.js";
import { formatProbability, ZERO_PROBABILITY } from "../probability/ProbabilityScale.js";
import {
  PHASE_HAND_WIDTH,
  chanceGauge,
  densityChanceHeight,
  discRadius,
  handLength,
  logRingRadius,
} from "./ComplexCellGeometry.js";

/**
 * A grid of complex numbers - a state's amplitudes, a density matrix, an operator - drawn the way
 * Pixi draws many small marks that change every frame: each mark is a particle cut from one white
 * texture, given its size, angle and colour as numbers, so nothing is re-triangulated when the
 * numbers move. The grid's ground and lines are a Graphics redrawn only when the layout or the theme
 * changes; a big register's pixels are one texture uploaded from the raster; chance labels are
 * pooled bitmap text.
 *
 * Colour means phase and nothing else: a disc wears its phase's hue, and the hand, ring, gauge and
 * text are neutral inks. A disc whose phase is undefined wears the neutral "unknown".
 */

/** The marks' shapes, white, in one canvas, so they share one texture source. */
const DISC_TEXTURE_RADIUS = 250;
const RING_TEXTURE_RADIUS = 246;
const RING_TEXTURE_WIDTH = 8;
/** The solid square every bar, hand, tick and plate is stretched from. */
const BLOCK = 8;

/** @type {undefined|!{disc: !Texture, ring: !Texture, block: !Texture}} */
let markTextures;

/** The shared shapes, drawn on first use; textures outlive the surfaces that draw with them. */
function marks() {
  if (markTextures !== undefined) return markTextures;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 528;
  const g = canvas.getContext("2d");
  g.fillStyle = "#ffffff";
  g.strokeStyle = "#ffffff";
  g.beginPath();
  g.arc(256, 256, DISC_TEXTURE_RADIUS, 0, 2 * Math.PI);
  g.fill();
  g.lineWidth = RING_TEXTURE_WIDTH;
  g.beginPath();
  g.arc(768, 256, RING_TEXTURE_RADIUS, 0, 2 * Math.PI);
  g.stroke();
  g.fillRect(0, 512, 16, 16);
  // Mipmapped, so a disc drawn small is a smooth disc rather than a shimmering one.
  const source = new CanvasSource({ resource: canvas, autoGenerateMipmaps: true, scaleMode: "linear" });
  markTextures = {
    disc: new Texture({ source, frame: new Rectangle(0, 0, 512, 512) }),
    ring: new Texture({ source, frame: new Rectangle(512, 0, 512, 512) }),
    block: new Texture({ source, frame: new Rectangle(4, 516, BLOCK, BLOCK) }),
  };
  return markTextures;
}

/** The font chance labels are set in, a bitmap font shared with every other label that changes often. */
const CHANCE_FONT = { fontFamily: Typography.MONO_FONT_FAMILY, fontSize: Typography.LABEL_FONT_SIZE };

/** How far a chance label sits in from its cell's bottom-right corner. */
const CHANCE_LABEL_INSET = 4;

/** @param {!string} color @returns {!{tint: !number, alpha: !number}} */
function ink(color) {
  const c = new Color(color);
  return { tint: c.toNumber(), alpha: c.alpha };
}

/** @returns {!boolean} Whether two pictures draw the same thing. */
function samePicture(a, b) {
  if (a === undefined) return false;
  for (const key of Object.keys(b)) {
    if (key === "buf" || key === "colours") continue;
    if (!Object.is(a[key], b[key])) return false;
  }
  const ac = a.colours, bc = b.colours;
  for (const key of Object.keys(bc)) if (ac[key] !== bc[key]) return false;
  if (a.buf.length !== b.buf.length) return false;
  for (let i = 0; i < b.buf.length; i++) if (!Object.is(a.buf[i], b.buf[i])) return false;
  return true;
}

/**
 * @typedef {object} MatrixPicture
 * @property {number} x
 * @property {number} y
 * @property {number} diam A cell's side.
 * @property {number} cols
 * @property {number} rows
 * @property {Float32Array|Float64Array} buf The entries, interleaved real and imaginary, row-major.
 * @property {boolean} hasNaN
 * @property {boolean} asPixels Whether to draw one pixel block per entry instead of marks.
 * @property {boolean} density Whether the entries are a density matrix's.
 * @property {boolean} logRings
 * @property {boolean} gauges Whether an amplitude's chance stands beside its disc.
 * @property {boolean} ticks Whether each hand's zero is marked at its cell's edge.
 * @property {boolean} chanceLabels Whether each possible cell prints its chance.
 * @property {number} phaseAlpha How sure the phases are: 1 drawn, 0 undefined.
 * @property {!Object<string, string>} colours The inks, as CSS colours.
 */

class MatrixCells extends Container {
  constructor() {
    super();
    this.interactiveChildren = false;
    this.ground = this.addChild(new Graphics());
    this.pixelSprite = undefined;
    this.pixelSource = undefined;
    this.marks = this.addChild(new ParticleContainer({
      texture: marks().block,
      dynamicProperties: { vertex: true, position: true, rotation: true, color: true, uvs: false },
    }));
    this.labels = this.addChild(new Container());
    /** @type {!Array<!Array<!Particle>>} discs, rings, rails, gauges, ticks, hands, plates */
    this.kinds = [[], [], [], [], [], [], []];
    /** @type {!Array<!BitmapText>} */
    this.labelPool = [];
  }

  /** @param {MatrixPicture} picture */
  set picture(picture) {
    if (samePicture(this.previous, picture)) return;
    this.previous = { ...picture, buf: picture.buf.slice(), colours: { ...picture.colours } };
    const { x, y, diam, cols, rows } = picture;
    this.marks.boundsArea = new Rectangle(x, y, diam * cols, diam * rows);
    this.drawGround(picture);
    const drawsMarks = !picture.hasNaN && !picture.asPixels;
    this.marks.visible = drawsMarks;
    this.labels.visible = drawsMarks && picture.chanceLabels;
    if (this.pixelSprite !== undefined) this.pixelSprite.visible = !picture.hasNaN && picture.asPixels;
    if (picture.hasNaN) return;
    if (picture.asPixels) {
      this.drawPixels(picture);
    } else {
      this.drawMarks(picture);
    }
  }

  /** The cells' ground and, for marks, the lines between them; redrawn only when those change. */
  drawGround({ x, y, diam, cols, rows, asPixels, colours }) {
    const key = [x, y, diam, cols, rows, asPixels, colours.back, colours.grid].join("|");
    if (this.groundKey === key) return;
    this.groundKey = key;
    const w = diam * cols, h = diam * rows;
    this.ground.clear().rect(x, y, w, h).fill(colours.back);
    if (asPixels) return;
    for (let c = 0; c <= cols; c++) this.ground.moveTo(x + c * diam, y).lineTo(x + c * diam, y + h);
    for (let r = 0; r <= rows; r++) this.ground.moveTo(x, y + r * diam).lineTo(x + w, y + r * diam);
    this.ground.stroke({ color: colours.grid, width: 1 });
  }

  /** Enough particles of each kind for `count` cells, in the order they draw: discs at the bottom. */
  ensureParticles(count, plates) {
    const { disc, ring, block } = marks();
    const textures = [disc, ring, block, block, block, block, block];
    const wanted = [count, count, count, count, count, count, plates ? count : 0];
    let changed = false;
    this.kinds.forEach((list, kind) => {
      while (list.length < wanted[kind]) {
        list.push(new Particle({ texture: textures[kind], anchorX: 0.5, anchorY: 0.5, alpha: 0 }));
        changed = true;
      }
      if (list.length > wanted[kind]) {
        list.length = wanted[kind];
        changed = true;
      }
    });
    if (changed) {
      this.marks.particleChildren = this.kinds.flat();
      this.marks.update();
    }
  }

  /** @param {MatrixPicture} picture */
  drawMarks(picture) {
    const { x, y, diam, cols, rows, buf, density, colours, phaseAlpha } = picture;
    const count = cols * rows;
    this.ensureParticles(count, picture.chanceLabels);
    const [discs, rings, rails, gauges, ticks, hands, plates] = this.kinds;
    const hand = ink(colours.hand), handOff = ink(colours.handOff), ring = ink(colours.ring);
    const tick = ink(colours.tick), chance = ink(colours.chance), track = ink(colours.track);
    const unknown = ink(colours.unknown).tint, plate = ink(colours.plate), label = ink(colours.label);
    const phased = phaseAlpha > 0;
    if (picture.chanceLabels) this.useChanceFont();
    let labelled = 0;
    for (let i = 0; i < count; i++) {
      const re = buf[2 * i], im = buf[2 * i + 1];
      const col = i % cols, row = (i - col) / cols;
      const left = x + diam * col, top = y + diam * row;
      const cx = left + diam / 2, cy = top + diam / 2;
      const angle = Math.atan2(im, re);

      // The disc: as wide as the entry is large, in its phase's hue.
      const r = discRadius(re, im, diam);
      const disc = discs[i];
      disc.x = cx;
      disc.y = cy;
      disc.scaleX = disc.scaleY = r / DISC_TEXTURE_RADIUS;
      disc.tint = phased ? phaseTint(angle * 180 / Math.PI) : unknown;
      disc.alpha = 2 * r > 0.5 ? 1 : 0;

      // The ring: the chance on a logarithmic scale, so a tiny amplitude still shows.
      const rr = picture.logRings ? logRingRadius(re, im, diam) : 0;
      const ringMark = rings[i];
      ringMark.x = cx;
      ringMark.y = cy;
      ringMark.scaleX = ringMark.scaleY = rr / RING_TEXTURE_RADIUS;
      ringMark.tint = ring.tint;
      ringMark.alpha = rr > 0 ? ring.alpha : 0;

      // The chance: a gauge up the left edge for an amplitude, a fill from the foot on a density
      // matrix's diagonal, where its chances are.
      const rail = rails[i], gauge = gauges[i];
      rail.alpha = 0;
      gauge.alpha = 0;
      if (density) {
        const height = row === col ? densityChanceHeight(re, diam) : 0;
        if (height > 0) {
          setBar(gauge, left, top + diam, diam, height, chance.tint, 0.32);
        }
      } else if (picture.gauges) {
        const g = chanceGauge(re, im, left, top, diam);
        if (g !== undefined) {
          setBar(rail, g.left, g.bottom, g.width, g.rail, track.tint, 0.55 * track.alpha);
          setBar(gauge, g.left, g.bottom, g.width, g.level, chance.tint, chance.alpha);
        }
      }

      // The hand: the exact phase, as long as the amplitude; dark on its disc, light where a small
      // amplitude's hand reaches past it. Its zero is a tick at the cell's right, inside the line.
      const length = phased && re * re + im * im > 0 ? handLength(re, im, diam) : 0;
      const handMark = hands[i], tickMark = ticks[i];
      if (length > 0) {
        const onDisc = length <= r;
        handMark.x = cx;
        handMark.y = cy;
        handMark.anchorX = 0;
        handMark.anchorY = 0.5;
        handMark.rotation = -angle;
        handMark.scaleX = length / BLOCK;
        handMark.scaleY = PHASE_HAND_WIDTH / BLOCK;
        handMark.tint = (onDisc ? hand : handOff).tint;
        handMark.alpha = phaseAlpha;
      } else {
        handMark.alpha = 0;
      }
      if (length > 0 && picture.ticks) {
        setBar(tickMark, left + diam - 2 - 4, cy + 0.5, 4, 1, tick.tint, tick.alpha * phaseAlpha);
      } else {
        tickMark.alpha = 0;
      }

      // The chance as a number, in the cell's bottom-right corner, on a plate thin enough for the
      // disc to show through.
      if (picture.chanceLabels) {
        const p = re * re + im * im;
        const plateMark = plates[i];
        plateMark.alpha = 0;
        if (p > ZERO_PROBABILITY) {
          const text = this.label(labelled++);
          text.text = formatProbability(p);
          text.tint = label.tint;
          text.x = left + diam - CHANCE_LABEL_INSET;
          text.y = top + diam - CHANCE_LABEL_INSET;
          const w = text.width + 4, h = text.height;
          setBar(plateMark, text.x - w + 2, text.y, w, h, plate.tint, 0.78);
        }
      }
    }
    for (let i = labelled; i < this.labelPool.length; i++) this.labelPool[i].visible = false;
  }

  /** Sets the pool's labels in the chance font of the current version, and lets go of an older one's. */
  useChanceFont() {
    if (this.poolFontVersion === textLayoutVersion) return;
    for (const text of this.labelPool) text.destroy();
    this.labelPool = [];
    if (this.chanceFont !== undefined) releaseBitmapFont(this.chanceFont);
    this.chanceFont = acquireBitmapFont(CHANCE_FONT, textLayoutVersion);
    this.poolFontVersion = textLayoutVersion;
  }

  /** The `index`th pooled chance label, shown. */
  label(index) {
    let text = this.labelPool[index];
    if (text === undefined) {
      text = new BitmapText({ text: "", style: { fontFamily: this.chanceFont, fontSize: CHANCE_FONT.fontSize } });
      text.anchor.set(1, 1);
      this.labels.addChild(text);
      this.labelPool[index] = text;
    }
    text.visible = true;
    return text;
  }

  /** A big register's entries as one texture, a pixel block per entry, uploaded from the raster. */
  drawPixels({ x, y, diam, cols, rows, buf, phaseAlpha, colours }) {
    const width = Math.max(1, Math.min(cols, Math.ceil(diam * cols)));
    const height = Math.max(1, Math.min(rows, Math.ceil(diam * rows)));
    const rgba = rasterMatrix({ width: () => cols, height: () => rows, rawBuffer: () => buf }, width, height);
    if (phaseAlpha <= 0) {
      // Without defined phases the pixels have no hue to wear: the neutral ink, at their opacity.
      const { tint } = ink(colours.unknown);
      for (let k = 0; k < rgba.length; k += 4) {
        rgba[k] = (tint >> 16) & 255;
        rgba[k + 1] = (tint >> 8) & 255;
        rgba[k + 2] = tint & 255;
      }
    }
    const bytes = new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
    if (this.pixelSource === undefined || this.pixelSource.width !== width || this.pixelSource.height !== height) {
      this.pixelSource?.destroy();
      this.pixelSource = new BufferImageSource({ resource: new Uint8Array(bytes), width, height, scaleMode: "nearest" });
      if (this.pixelSprite === undefined) {
        this.pixelSprite = this.addChildAt(new Sprite(), 1);
      }
      this.pixelSprite.texture = new Texture({ source: this.pixelSource });
    } else {
      this.pixelSource.resource.set(bytes);
      this.pixelSource.update();
    }
    this.pixelSprite.visible = true;
    this.pixelSprite.x = x;
    this.pixelSprite.y = y;
    this.pixelSprite.width = diam * cols;
    this.pixelSprite.height = diam * rows;
  }

  destroy(options) {
    this.pixelSource?.destroy();
    for (const text of this.labelPool) text.destroy();
    if (this.chanceFont !== undefined) releaseBitmapFont(this.chanceFont);
    super.destroy(options);
  }
}

/** A bar standing on (left, bottom), `width` wide and `height` tall, cut from the block. */
function setBar(particle, left, bottom, width, height, tint, alpha) {
  particle.x = left;
  particle.y = bottom;
  particle.anchorX = 0;
  particle.anchorY = 1;
  particle.rotation = 0;
  particle.scaleX = width / BLOCK;
  particle.scaleY = height / BLOCK;
  particle.tint = tint;
  particle.alpha = alpha;
}

extend({ MatrixCells });
