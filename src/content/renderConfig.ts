// Every look value of the game: colours as 0xRRGGBB, sizes and heights in world units, light strengths, speeds of
// the drawn animations and effects. Positions of the parts inside one model stay with the model in render.

export type GraphicsQuality = 'high' | 'low'

export interface FurColours {
  coat: number
  // Markings on the back and head, and the tail tip.
  patches: readonly [number, number]
}

export type Fur = 'orange' | 'grey' | 'black' | 'white' | 'calico'

const fur: Record<Fur, FurColours> = {
  orange: { coat: 0xf29a38, patches: [0xd27420, 0xd27420] },
  grey: { coat: 0x9aa1ab, patches: [0x6c727c, 0x6c727c] },
  black: { coat: 0x2d2b30, patches: [0x45424a, 0xf2ece4] },
  white: { coat: 0xf7f2ea, patches: [0xe2d6c6, 0xe2d6c6] },
  calico: { coat: 0xf7f2ea, patches: [0xe8862e, 0x2d2b30] },
}

// Fur of each formation slot in turn, so the colours mix across the squad.
const furOrder: readonly Fur[] = ['orange', 'grey', 'calico', 'black', 'white', 'orange', 'calico', 'grey']

export const renderConfig = {
  graphics: {
    high: { shadows: true, maxPixelRatio: 2 },
    low: { shadows: false, maxPixelRatio: 1.5 },
    // Until the settings screen, a start that runs strictly below this fps over its first autoCheckSeconds of play switches to low.
    autoLowBelowFps: 45,
    autoCheckSeconds: 3,
  },
  camera: {
    fov: 50,
    // Radians below the horizon.
    pitch: 0.42,
    // How far below the screen's centre the squad stands, as a fraction of half the screen height, so the road ahead fills the rest.
    squadScreenY: 0.55,
    // Half the width the camera keeps in view at its look point: the track plus a margin.
    viewHalfWidth: 6.6,
    minDistance: 15,
    near: 0.5,
    far: 160,
  },
  sky: {
    top: 0x3f97e0,
    horizon: 0xd3eefb,
    // Elevation in radians where the sky reaches its top colour.
    topElevation: 0.6,
    // The sky dome's radius as a share of the camera's far distance, so it is never clipped.
    farShare: 0.9,
  },
  fog: { near: 55, far: 150 },
  light: {
    hemisphere: { sky: 0xdcefff, ground: 0x7a9655, intensity: 1.6 },
    // The warm sun, ahead and to the right, so shadows fall towards the camera.
    key: {
      colour: 0xffe0b0,
      intensity: 2.3,
      offset: { x: 7, y: 16, z: -9 },
      // The point the sun aims at, ahead of the squad; shadows are drawn in a box around it, which reaches from just behind
      // the squad to past the fog's near distance, so shadows never pop in where the road is still clear.
      target: { x: 0, y: 0, z: -24 },
      shadowMapSize: 1024,
      shadowHalfWidth: 18,
      shadowHalfDepth: 36,
      shadowBias: -0.0005,
      shadowNormalBias: 0.03,
    },
  },
  ground: {
    grass: 0x7cc35c,
    grassStripe: 0x6db24f,
    grassFleck: 0x92d36d,
    // World units one grass tile covers.
    tileSize: 8,
    width: 400,
  },
  track: {
    surface: 0xeadab2,
    slabLine: 0xdfcc9f,
    fleck: 0xf4e8c8,
    // World units one paving tile of four slabs covers, across and along.
    tileSize: 4,
    curbColours: [0xe5483b, 0xffffff],
    curbWidth: 0.35,
    curbHeight: 0.16,
    curbLength: 1,
    laneMarking: 0xffffff,
    laneMarkingWidth: 0.2,
    laneDashLength: 2,
    laneDashSpacing: 4,
    finishLight: 0xffffff,
    finishDark: 0x26262b,
    finishBanner: 0xffd23f,
    finishPost: 0xe5483b,
    finishBannerHeight: 3.4,
    finishLineDepth: 1.2,
    finishBannerThickness: 0.5,
    finishBannerDepth: 0.3,
    finishPostWidth: 0.25,
    // How far outside the track's edge the posts stand; the banner spans from post to post.
    finishPostOutside: 0.3,
    // How far the road reaches behind the squad.
    roadBehind: 60,
  },
  scenery: {
    fence: { colour: 0xfbf6ec, post: 0xe6dccb, offset: 1, segmentLength: 2, scale: 1 },
    // Each tree is drawn at scale times a random factor from minScale to maxScale.
    tree: { trunk: 0x8a5a33, leaves: 0x3f9e44, leavesLight: 0x5cba4f, spacing: 7, offset: 3, spread: 4, scale: 1, minScale: 0.8, maxScale: 1.35 },
    house: {
      // The model's walls are this white, and each house tints them with one of the walls colours.
      plaster: 0xffffff,
      walls: [0xffffff, 0xffe8c4, 0xd8eaff, 0xffd7df],
      roof: 0xc8553d,
      door: 0x7a4b2a,
      window: 0x9fd6f5,
      spacing: 26,
      offset: 11,
      spread: 3,
      scale: 1,
    },
  },
  cat: {
    // The models are built about 0.5 units long and scaled by this.
    scale: 1.3,
    fur,
    furOrder,
    nose: 0xf08aa0,
    bobHeight: 0.09,
    // Bobs per second, times 2π.
    bobSpeed: 11,
    // Radians the cat leans forward at the top of a bob.
    bobLean: 0.12,
  },
  dogs: {
    eye: 0x1f1b1a,
    nose: 0x2a2120,
    puppy: { coat: 0xb27a45, dark: 0x6b4426, muzzle: 0xf4e3cc, scale: 1.2 },
    chihuahua: { coat: 0xe6b77e, innerEar: 0xf0a3a3, muzzle: 0xf6dcb7, scale: 1.15 },
    bulldog: { coat: 0x9a8b7c, dark: 0x574c42, chest: 0xf2ece4, collar: 0xd63a3a, scale: 1.1 },
    shieldDog: { coat: 0x6b7686, dark: 0x3c4450, muzzle: 0xd9d4cc, scale: 1.15 },
    // Radians the dogs roll from side to side.
    waddleAngle: 0.14,
    waddleSpeed: 9,
    waddleBob: 0.05,
  },
  // The shield dog's trash-can lid.
  shield: { lid: 0xb7c0c9, ring: 0x8e98a3, handle: 0x5d6670, height: 0.48, ahead: 0.55, scale: 1 },
  yarnBall: { colour: 0xe0407b, strand: 0xff86b0, radius: 0.13, height: 0.35, spinSpeed: 14 },
  boss: {
    // Each boss is drawn as big as its hit radius in the tuning config.
    dustbot: { body: 0xe9edf1, trim: 0x8f9aa6, top: 0xc9d1d9, light: 0x3fe0ff, brush: 0x3a3f45, bristle: 0x2b9be8 },
    megaDustbot: { body: 0x2f3338, trim: 0xffb703, top: 0x484e56, light: 0xff2a2a, brush: 0x1d2024, bristle: 0xff6a00 },
    hitFlash: 0x662222,
    hitFlashSeconds: 0.08,
    // Brush turns per second, times 2π.
    brushSpinSpeed: 9,
  },
  dustBall: { colours: [0x8d8d8d, 0xa9a9a9, 0x6f6f6f], height: 1.2, spinSpeed: 4, scale: 1 },
  barrel: { bucket: 0x3f86d6, band: 0x2f6bb0, rim: 0xd6dde4, water: 0x9fdcff, handle: 0x9aa4ad, scale: 1 },
  wall: {
    brick: 0xbd5a3c,
    brickDark: 0xa34a30,
    mortar: 0xe8dccb,
    height: 1.2,
    // World units of wall one brick tile covers: two rows of bricks.
    tileWidth: 1.2,
    tileHeight: 0.6,
  },
  buffBlock: {
    wood: 0xc98a4b,
    plank: 0xb57638,
    frame: 0x7a4a24,
    crack: 0x3b230f,
    height: 1.6,
    // Pictures from whole to nearly broken; the block shows the next one each time its HP drops by a quarter.
    damageStages: 4,
  },
  bigBuff: {
    token: 0xffc21a,
    tokenFace: 0xffe27a,
    emissive: 0x664000,
    glow: 0xffd75a,
    // The coin's size, about 1.1 units across at scale 1.
    scale: 1,
    glowSize: 2.4,
    // The glow pulses this share larger and smaller than its size.
    glowPulse: 0.12,
    // How far the glow stands behind the coin, so the coin draws over it.
    glowBehind: 0.3,
    height: 1,
    bobHeight: 0.15,
    // Bobs per pulse.
    bobPerPulse: 0.5,
    // The token swings this many radians to each side of facing the camera, so its face stays in view.
    swingAngle: 0.7,
    swingSpeed: 2.5,
    pulseSpeed: 5,
    // Fill of the label panel over a buff block and its big buff.
    label: 0xffb31e,
    // Space between the top of a buff block and its label panel, and between a big buff's height and its label panel.
    labelGapOverBlock: 0.2,
    labelGapOverCoin: 0.8,
  },
  panel: {
    // Space left between the panels of neighbouring lanes.
    gap: 0.2,
    height: 1.8,
    // Height of a gate panel's centre.
    gateHeight: 1.4,
    opacity: 0.78,
    border: 0xffffff,
    text: 0xffffff,
    textOutline: 0x0f1c3a,
    // Canvas pixels of the glow around a panel's edge.
    glowBlur: 12,
  },
  gate: { good: 0x2f86ff, bad: 0xf03c3c },
  hpLabel: {
    text: 0xffffff,
    outline: 0x1e1e28,
    body: 0xffffff,
    shield: 0x8fd0ff,
    barrel: 0xd6ecff,
    buffBlock: 0xffffff,
    digitWidth: 0.4,
    // A buff block's number is drawn this many times larger, to read across the whole crate.
    buffBlockSize: 1.8,
    digitHeight: 0.6,
    // Height of the number above the ground.
    heights: { puppy: 1.25, chihuahua: 1.15, bulldog: 1.7, shieldDog: 1.35, barrel: 1.35 },
    shieldRise: 0.6,
  },
  particles: {
    capacity: 500,
    gravity: 12,
    // height: where a burst starts above the ground.
    kill: { colours: [0xffffff, 0xfff1b8, 0xd8d8d8], count: 9, speed: 3, rise: 3, size: 0.17, lifetime: 0.5, height: 0.4 },
    splash: { colours: [0x6cc6ff, 0xb9e6ff, 0xffffff], count: 18, speed: 3.2, rise: 6, size: 0.15, lifetime: 0.8, height: 0.7 },
  },
  // Lost cats jump sideways off the track: lost cats take the side and rise speeds in turn, and tumble at tumbleSpeed radians per second.
  scatter: { capacity: 60, lifetime: 1.2, gravity: 14, sideSpeeds: [6, 7, 8], riseSpeeds: [5, 6], tumbleSpeed: 8 },
}
