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
