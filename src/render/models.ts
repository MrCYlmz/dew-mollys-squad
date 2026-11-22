import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Low-poly models built from primitives, merged into one geometry each with vertex colours, so each kind is one draw call.

interface Part {
  geometry: BufferGeometry
  colour: number
  position: [number, number, number]
  scale?: [number, number, number]
  rotationX?: number
}

function mergeParts(parts: Part[]): BufferGeometry {
  const transform = new Matrix4()
  const rotation = new Quaternion()
  const xAxis = new Vector3(1, 0, 0)
  const colour = new Color()
  const placed = parts.map((part) => {
    const scale = part.scale ?? [1, 1, 1]
    rotation.setFromAxisAngle(xAxis, part.rotationX ?? 0)
    transform.compose(new Vector3(...part.position), rotation, new Vector3(...scale))
    const geometry = part.geometry.toNonIndexed()
    part.geometry.dispose()
    geometry.applyMatrix4(transform)
    colour.setHex(part.colour)
    const vertexColours = new Float32Array(geometry.getAttribute('position').count * 3)
    for (let i = 0; i < vertexColours.length; i += 3) colour.toArray(vertexColours, i)
    geometry.setAttribute('color', new Float32BufferAttribute(vertexColours, 3))
    return geometry
  })
  const merged = mergeGeometries(placed)
  for (const geometry of placed) geometry.dispose()
  return merged
}

const catOrange = 0xf2a03d
const catDark = 0xc8752a
const catWhite = 0xfff4e6

// Faces −z, the direction the squad runs.
export function createCatGeometry(): BufferGeometry {
  return mergeParts([
    { geometry: new SphereGeometry(0.2, 10, 8), colour: catOrange, position: [0, 0.22, 0], scale: [1, 0.85, 1.3] },
    { geometry: new SphereGeometry(0.15, 10, 8), colour: catOrange, position: [0, 0.42, -0.25] },
    { geometry: new SphereGeometry(0.065, 8, 6), colour: catWhite, position: [0, 0.38, -0.38] },
    { geometry: new ConeGeometry(0.055, 0.12, 6), colour: catDark, position: [-0.08, 0.57, -0.25] },
    { geometry: new ConeGeometry(0.055, 0.12, 6), colour: catDark, position: [0.08, 0.57, -0.25] },
    { geometry: new CylinderGeometry(0.03, 0.025, 0.35, 6), colour: catDark, position: [0, 0.4, 0.3], rotationX: -0.6 },
  ])
}

const puppyBrown = 0x9a6634
const puppyDark = 0x5b3a1e

// Faces +z, towards the squad.
export function createPuppyGeometry(): BufferGeometry {
  return mergeParts([
    { geometry: new BoxGeometry(0.42, 0.32, 0.6), colour: puppyBrown, position: [0, 0.32, 0] },
    { geometry: new BoxGeometry(0.32, 0.3, 0.3), colour: puppyBrown, position: [0, 0.58, 0.3] },
    { geometry: new BoxGeometry(0.14, 0.12, 0.14), colour: puppyDark, position: [0, 0.52, 0.5] },
    { geometry: new BoxGeometry(0.07, 0.22, 0.12), colour: puppyDark, position: [-0.19, 0.56, 0.28] },
    { geometry: new BoxGeometry(0.07, 0.22, 0.12), colour: puppyDark, position: [0.19, 0.56, 0.28] },
    { geometry: new BoxGeometry(0.08, 0.2, 0.08), colour: puppyDark, position: [0, 0.48, -0.32], rotationX: 0.6 },
  ])
}

const chihuahuaTan = 0xe0b07a
const chihuahuaPink = 0xd98c8c

// Small, with big ears. Faces +z, towards the squad.
export function createChihuahuaGeometry(): BufferGeometry {
  return mergeParts([
    { geometry: new BoxGeometry(0.26, 0.2, 0.4), colour: chihuahuaTan, position: [0, 0.24, 0] },
    { geometry: new SphereGeometry(0.14, 8, 6), colour: chihuahuaTan, position: [0, 0.44, 0.22] },
    { geometry: new ConeGeometry(0.07, 0.2, 6), colour: chihuahuaPink, position: [-0.11, 0.6, 0.2] },
    { geometry: new ConeGeometry(0.07, 0.2, 6), colour: chihuahuaPink, position: [0.11, 0.6, 0.2] },
    { geometry: new BoxGeometry(0.05, 0.16, 0.05), colour: chihuahuaTan, position: [0, 0.36, -0.22], rotationX: 0.6 },
  ])
}

const bulldogGrey = 0x8a7f74
const bulldogDark = 0x4a423b

// Big and wide. Faces +z, towards the squad.
export function createBulldogGeometry(): BufferGeometry {
  return mergeParts([
    { geometry: new BoxGeometry(0.85, 0.55, 0.9), colour: bulldogGrey, position: [0, 0.45, 0] },
    { geometry: new BoxGeometry(0.62, 0.48, 0.42), colour: bulldogGrey, position: [0, 0.78, 0.5] },
    { geometry: new BoxGeometry(0.5, 0.18, 0.12), colour: bulldogDark, position: [0, 0.64, 0.74] },
    { geometry: new BoxGeometry(0.14, 0.14, 0.1), colour: bulldogDark, position: [-0.28, 1.02, 0.46] },
    { geometry: new BoxGeometry(0.14, 0.14, 0.1), colour: bulldogDark, position: [0.28, 1.02, 0.46] },
  ])
}

const shieldDogBody = 0x5f6b7a
const shieldDogDark = 0x343b45

// Faces +z, towards the squad. Its shield is drawn separately, so it can disappear once broken.
export function createShieldDogGeometry(): BufferGeometry {
  return mergeParts([
    { geometry: new BoxGeometry(0.48, 0.36, 0.66), colour: shieldDogBody, position: [0, 0.36, 0] },
    { geometry: new BoxGeometry(0.36, 0.34, 0.32), colour: shieldDogBody, position: [0, 0.64, 0.3] },
    { geometry: new BoxGeometry(0.16, 0.12, 0.14), colour: shieldDogDark, position: [0, 0.58, 0.52] },
    { geometry: new BoxGeometry(0.08, 0.24, 0.12), colour: shieldDogDark, position: [-0.21, 0.62, 0.28] },
    { geometry: new BoxGeometry(0.08, 0.24, 0.12), colour: shieldDogDark, position: [0.21, 0.62, 0.28] },
  ])
}

// A round shield standing upright, facing +z.
export function createShieldGeometry(): BufferGeometry {
  return mergeParts([
    { geometry: new CylinderGeometry(0.42, 0.42, 0.08, 16), colour: 0x4aa3ff, position: [0, 0, 0], rotationX: Math.PI / 2 },
    { geometry: new CylinderGeometry(0.14, 0.14, 0.12, 10), colour: 0xdfeeff, position: [0, 0, 0.02], rotationX: Math.PI / 2 },
  ])
}

// A water bucket.
export function createBarrelGeometry(): BufferGeometry {
  return mergeParts([
    { geometry: new CylinderGeometry(0.42, 0.34, 0.8, 14), colour: 0x3f7fd1, position: [0, 0.4, 0] },
    { geometry: new CylinderGeometry(0.44, 0.44, 0.08, 14), colour: 0xc9d3dc, position: [0, 0.78, 0] },
    { geometry: new CylinderGeometry(0.36, 0.36, 0.02, 14), colour: 0x9fd8ff, position: [0, 0.76, 0] },
  ])
}

const dustbotGrey = 0xb8c0c8
const dustbotDark = 0x3c4248
const dustbotRed = 0xe63946

// A round robot vacuum, 4 units across. Faces +z, towards the squad.
export function createDustbotGeometry(): BufferGeometry {
  return mergeParts([
    { geometry: new CylinderGeometry(2, 2, 0.7, 28), colour: dustbotGrey, position: [0, 0.45, 0] },
    { geometry: new CylinderGeometry(2.05, 2.05, 0.25, 28), colour: dustbotDark, position: [0, 0.2, 0] },
    { geometry: new SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), colour: dustbotDark, position: [0, 0.8, -0.3] },
    { geometry: new SphereGeometry(0.22, 10, 8), colour: dustbotRed, position: [-0.6, 0.85, 1.75] },
    { geometry: new SphereGeometry(0.22, 10, 8), colour: dustbotRed, position: [0.6, 0.85, 1.75] },
    { geometry: new BoxGeometry(2.2, 0.18, 0.3), colour: dustbotDark, position: [0, 0.3, 1.9] },
  ])
}

const megaDustbotBody = 0x4b5563
const megaDustbotTrim = 0xffb703

// The world boss, 5 units across and darker, with a dust bin on top. Faces +z, towards the squad.
export function createMegaDustbotGeometry(): BufferGeometry {
  return mergeParts([
    { geometry: new CylinderGeometry(2.5, 2.5, 0.9, 32), colour: megaDustbotBody, position: [0, 0.55, 0] },
    { geometry: new CylinderGeometry(2.56, 2.56, 0.3, 32), colour: megaDustbotTrim, position: [0, 0.22, 0] },
    { geometry: new CylinderGeometry(1, 1.2, 1.3, 20), colour: dustbotGrey, position: [0, 1.6, -0.4] },
    { geometry: new CylinderGeometry(1.05, 1.05, 0.15, 20), colour: megaDustbotTrim, position: [0, 2.3, -0.4] },
    { geometry: new SphereGeometry(0.28, 10, 8), colour: dustbotRed, position: [-0.8, 1.05, 2.2] },
    { geometry: new SphereGeometry(0.28, 10, 8), colour: dustbotRed, position: [0.8, 1.05, 2.2] },
    { geometry: new BoxGeometry(2.8, 0.22, 0.36), colour: megaDustbotTrim, position: [0, 0.35, 2.4] },
  ])
}

// A grey clump of dust, 1 unit across.
export function createDustBallGeometry(): BufferGeometry {
  return mergeParts([
    { geometry: new SphereGeometry(0.5, 10, 8), colour: 0x8d8d8d, position: [0, 0, 0] },
    { geometry: new SphereGeometry(0.28, 8, 6), colour: 0xa9a9a9, position: [0.3, 0.2, 0.15] },
    { geometry: new SphereGeometry(0.24, 8, 6), colour: 0x6f6f6f, position: [-0.28, -0.1, 0.2] },
  ])
}
