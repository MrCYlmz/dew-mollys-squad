import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { BossKind } from '../content/level'
import { renderConfig, type FurColours } from '../content/renderConfig'
import { tuning } from '../content/tuning'

// Low-poly models built from primitives, merged into one geometry each with vertex colours, so each kind is one draw call.

interface Part {
  geometry: BufferGeometry
  colour: number
  position: [number, number, number]
  scale?: [number, number, number]
  // Euler angles in radians, applied z first, then y, then x.
  rotation?: [number, number, number]
  // Takes the instance colour; a model with such a part gets a wallTint attribute, 1 on these parts and 0 elsewhere.
  tinted?: boolean
}

function mergeParts(parts: Part[]): BufferGeometry {
  const transform = new Matrix4()
  const rotation = new Quaternion()
  const euler = new Euler()
  const colour = new Color()
  const anyTinted = parts.some((part) => part.tinted === true)
  const placed = parts.map((part) => {
    const scale = part.scale ?? [1, 1, 1]
    rotation.setFromEuler(euler.set(...(part.rotation ?? [0, 0, 0])))
    transform.compose(new Vector3(...part.position), rotation, new Vector3(...scale))
    const geometry = part.geometry.index === null ? part.geometry : part.geometry.toNonIndexed()
    if (geometry !== part.geometry) part.geometry.dispose()
    geometry.applyMatrix4(transform)
    colour.setHex(part.colour)
    const vertexColours = new Float32Array(geometry.getAttribute('position').count * 3)
    for (let i = 0; i < vertexColours.length; i += 3) colour.toArray(vertexColours, i)
    geometry.setAttribute('color', new Float32BufferAttribute(vertexColours, 3))
    if (anyTinted) {
      const wallTint = new Float32Array(vertexColours.length / 3).fill(part.tinted === true ? 1 : 0)
      geometry.setAttribute('wallTint', new Float32BufferAttribute(wallTint, 1))
    }
    // Icosahedra carry no uv; merging needs the same attributes on every part.
    geometry.deleteAttribute('uv')
    return geometry
  })
  const merged = mergeGeometries(placed)
  for (const geometry of placed) geometry.dispose()
  return merged
}

function scaled(geometry: BufferGeometry, scale: number): BufferGeometry {
  return geometry.scale(scale, scale, scale)
}

// Faces −z, the direction the squad runs, so the camera sees its back, ears and tail.
export function createCatGeometry(fur: FurColours): BufferGeometry {
  const { coat, patches } = fur
  const cat = renderConfig.cat
  const legs: Part[] = []
  for (const x of [-0.1, 0.1]) {
    for (const z of [-0.14, 0.17]) legs.push({ geometry: new SphereGeometry(0.055, 5, 4), colour: coat, position: [x, 0.06, z], scale: [1, 1.3, 1.1] })
  }
  return scaled(
    mergeParts([
      { geometry: new SphereGeometry(0.2, 9, 6), colour: coat, position: [0, 0.24, 0.02], scale: [1, 0.88, 1.35] },
      { geometry: new SphereGeometry(0.155, 9, 6), colour: coat, position: [0, 0.43, -0.25] },
      { geometry: new ConeGeometry(0.06, 0.14, 4), colour: coat, position: [-0.085, 0.58, -0.24], rotation: [0, 0, 0.3] },
      { geometry: new ConeGeometry(0.06, 0.14, 4), colour: coat, position: [0.085, 0.58, -0.24], rotation: [0, 0, -0.3] },
      { geometry: new SphereGeometry(0.025, 6, 4), colour: cat.nose, position: [0, 0.41, -0.4] },
      { geometry: new SphereGeometry(0.12, 7, 4), colour: patches[0], position: [0.05, 0.37, 0.08], scale: [1, 0.55, 1.1] },
      { geometry: new SphereGeometry(0.08, 7, 4), colour: patches[1], position: [-0.07, 0.53, -0.22], scale: [1, 0.6, 1] },
      { geometry: new SphereGeometry(0.09, 7, 4), colour: patches[1], position: [-0.09, 0.31, 0.2], scale: [1, 0.75, 1] },
      // The tail rises from the rump in three pieces and curls forward at the tip.
      { geometry: new CylinderGeometry(0.03, 0.026, 0.2, 6), colour: coat, position: [0, 0.314, 0.384], rotation: [1, 0, 0] },
      { geometry: new SphereGeometry(0.027, 6, 4), colour: coat, position: [0, 0.368, 0.468] },
      { geometry: new CylinderGeometry(0.026, 0.024, 0.2, 6), colour: coat, position: [0, 0.467, 0.483], rotation: [0.15, 0, 0] },
      { geometry: new SphereGeometry(0.025, 6, 4), colour: coat, position: [0, 0.566, 0.498] },
      { geometry: new CylinderGeometry(0.024, 0.02, 0.12, 6), colour: coat, position: [0, 0.612, 0.459], rotation: [-0.7, 0, 0] },
      { geometry: new SphereGeometry(0.032, 6, 5), colour: patches[0], position: [0, 0.658, 0.42] },
      ...legs,
    ]),
    cat.scale,
  )
}

function dogLegs(radius: number, height: number, x: number, frontZ: number, backZ: number, colour: number): Part[] {
  const legs: Part[] = []
  for (const side of [-x, x]) {
    for (const z of [frontZ, backZ]) {
      legs.push({ geometry: new CylinderGeometry(radius, radius * 0.9, height, 6), colour, position: [side, height / 2, z] })
    }
  }
  return legs
}

const dogs = renderConfig.dogs

// Small and round, with floppy ears. Faces +z, towards the squad.
export function createPuppyGeometry(): BufferGeometry {
  const { coat, dark, muzzle, scale } = dogs.puppy
  return scaled(
    mergeParts([
      { geometry: new SphereGeometry(0.25, 10, 8), colour: coat, position: [0, 0.3, 0], scale: [1, 0.9, 1.15] },
      { geometry: new SphereGeometry(0.2, 10, 8), colour: coat, position: [0, 0.55, 0.22] },
      { geometry: new SphereGeometry(0.1, 8, 6), colour: muzzle, position: [0, 0.49, 0.38], scale: [1.25, 0.85, 1] },
      { geometry: new SphereGeometry(0.04, 6, 4), colour: dogs.nose, position: [0, 0.53, 0.47] },
      { geometry: new SphereGeometry(0.035, 6, 4), colour: dogs.eye, position: [-0.08, 0.6, 0.385] },
      { geometry: new SphereGeometry(0.035, 6, 4), colour: dogs.eye, position: [0.08, 0.6, 0.385] },
      { geometry: new SphereGeometry(0.09, 8, 6), colour: dark, position: [-0.19, 0.52, 0.2], scale: [0.55, 1.4, 0.9], rotation: [0, 0, -0.35] },
      { geometry: new SphereGeometry(0.09, 8, 6), colour: dark, position: [0.19, 0.52, 0.2], scale: [0.55, 1.4, 0.9], rotation: [0, 0, 0.35] },
      { geometry: new SphereGeometry(0.06, 6, 5), colour: dark, position: [0, 0.45, -0.3], scale: [1, 1.5, 1], rotation: [-0.5, 0, 0] },
      ...dogLegs(0.065, 0.2, 0.12, 0.13, -0.13, coat),
    ]),
    scale,
  )
}

// Tiny, with big pointed ears and big eyes. Faces +z, towards the squad.
export function createChihuahuaGeometry(): BufferGeometry {
  const { coat, innerEar, muzzle, scale } = dogs.chihuahua
  return scaled(
    mergeParts([
      { geometry: new SphereGeometry(0.15, 10, 8), colour: coat, position: [0, 0.22, 0], scale: [1, 0.9, 1.3] },
      { geometry: new SphereGeometry(0.14, 10, 8), colour: coat, position: [0, 0.4, 0.15] },
      { geometry: new SphereGeometry(0.055, 6, 5), colour: muzzle, position: [0, 0.36, 0.28] },
      { geometry: new SphereGeometry(0.02, 6, 4), colour: dogs.nose, position: [0, 0.375, 0.33] },
      { geometry: new SphereGeometry(0.04, 8, 6), colour: dogs.eye, position: [-0.065, 0.43, 0.26] },
      { geometry: new SphereGeometry(0.04, 8, 6), colour: dogs.eye, position: [0.065, 0.43, 0.26] },
      { geometry: new ConeGeometry(0.095, 0.26, 6), colour: coat, position: [-0.14, 0.57, 0.13], rotation: [0, 0, 0.55] },
      { geometry: new ConeGeometry(0.095, 0.26, 6), colour: coat, position: [0.14, 0.57, 0.13], rotation: [0, 0, -0.55] },
      { geometry: new ConeGeometry(0.06, 0.17, 6), colour: innerEar, position: [-0.135, 0.56, 0.17], rotation: [0, 0, 0.55] },
      { geometry: new ConeGeometry(0.06, 0.17, 6), colour: innerEar, position: [0.135, 0.56, 0.17], rotation: [0, 0, -0.55] },
      { geometry: new CylinderGeometry(0.018, 0.012, 0.18, 5), colour: coat, position: [0, 0.33, -0.2], rotation: [-0.7, 0, 0] },
      ...dogLegs(0.025, 0.14, 0.07, 0.09, -0.09, coat),
    ]),
    scale,
  )
}

// Wide and heavy, with a white chest, an underbite and a collar. Faces +z, towards the squad.
export function createBulldogGeometry(): BufferGeometry {
  const { coat, dark, chest, collar, scale } = dogs.bulldog
  return scaled(
    mergeParts([
      { geometry: new SphereGeometry(0.42, 10, 7), colour: coat, position: [0, 0.5, -0.05], scale: [1.25, 0.85, 1.15] },
      { geometry: new SphereGeometry(0.2, 10, 8), colour: dark, position: [0.15, 0.82, -0.15], scale: [1, 0.5, 1] },
      { geometry: new SphereGeometry(0.3, 10, 8), colour: chest, position: [0, 0.47, 0.33], scale: [1.3, 1, 0.8] },
      { geometry: new SphereGeometry(0.3, 10, 7), colour: coat, position: [0, 0.8, 0.48], scale: [1.3, 0.95, 0.95] },
      { geometry: new SphereGeometry(0.17, 10, 8), colour: chest, position: [0, 0.68, 0.73], scale: [1.6, 0.85, 0.8] },
      { geometry: new SphereGeometry(0.065, 8, 6), colour: dogs.nose, position: [0, 0.79, 0.84] },
      { geometry: new SphereGeometry(0.045, 6, 4), colour: dogs.eye, position: [-0.15, 0.9, 0.74] },
      { geometry: new SphereGeometry(0.045, 6, 4), colour: dogs.eye, position: [0.15, 0.9, 0.74] },
      { geometry: new BoxGeometry(0.05, 0.07, 0.04), colour: chest, position: [-0.1, 0.64, 0.87] },
      { geometry: new BoxGeometry(0.05, 0.07, 0.04), colour: chest, position: [0.1, 0.64, 0.87] },
      { geometry: new SphereGeometry(0.09, 8, 6), colour: dark, position: [-0.32, 1.02, 0.42], scale: [1, 0.6, 0.7] },
      { geometry: new SphereGeometry(0.09, 8, 6), colour: dark, position: [0.32, 1.02, 0.42], scale: [1, 0.6, 0.7] },
      { geometry: new TorusGeometry(0.27, 0.045, 6, 16), colour: collar, position: [0, 0.66, 0.33], rotation: [Math.PI / 2 - 0.3, 0, 0] },
      ...dogLegs(0.11, 0.24, 0.33, 0.25, -0.35, coat),
    ]),
    scale,
  )
}

// A sturdy guard dog with a pointed muzzle. Faces +z, towards the squad. Its lid is drawn separately, so it can disappear once broken.
export function createShieldDogGeometry(): BufferGeometry {
  const { coat, dark, muzzle, scale } = dogs.shieldDog
  return scaled(
    mergeParts([
      { geometry: new SphereGeometry(0.27, 10, 8), colour: coat, position: [0, 0.38, -0.02], scale: [1, 0.9, 1.2] },
      { geometry: new SphereGeometry(0.22, 10, 8), colour: dark, position: [0, 0.5, -0.08], scale: [1.05, 0.5, 1.15] },
      { geometry: new SphereGeometry(0.19, 10, 8), colour: coat, position: [0, 0.66, 0.24] },
      { geometry: new ConeGeometry(0.085, 0.2, 8), colour: muzzle, position: [0, 0.61, 0.43], rotation: [Math.PI / 2, 0, 0] },
      { geometry: new SphereGeometry(0.03, 6, 4), colour: dogs.nose, position: [0, 0.62, 0.53] },
      { geometry: new SphereGeometry(0.032, 6, 4), colour: dogs.eye, position: [-0.075, 0.71, 0.38] },
      { geometry: new SphereGeometry(0.032, 6, 4), colour: dogs.eye, position: [0.075, 0.71, 0.38] },
      { geometry: new ConeGeometry(0.065, 0.17, 5), colour: dark, position: [-0.1, 0.86, 0.2], rotation: [0, 0, 0.2] },
      { geometry: new ConeGeometry(0.065, 0.17, 5), colour: dark, position: [0.1, 0.86, 0.2], rotation: [0, 0, -0.2] },
      { geometry: new CylinderGeometry(0.04, 0.025, 0.3, 6), colour: dark, position: [0, 0.5, -0.36], rotation: [-0.8, 0, 0] },
      ...dogLegs(0.06, 0.22, 0.13, 0.15, -0.15, coat),
    ]),
    scale,
  )
}

// Slim and long-legged, with a narrow pointed head and a thin tail. Faces +z, towards the squad.
export function createGreyhoundGeometry(): BufferGeometry {
  const { coat, dark, belly, scale } = dogs.greyhound
  return scaled(
    mergeParts([
      { geometry: new SphereGeometry(0.17, 10, 8), colour: coat, position: [0, 0.6, 0.02], scale: [0.75, 0.8, 2] },
      { geometry: new SphereGeometry(0.12, 8, 6), colour: belly, position: [0, 0.52, 0.12], scale: [0.7, 0.7, 1.2] },
      { geometry: new CylinderGeometry(0.06, 0.08, 0.3, 6), colour: coat, position: [0, 0.78, 0.33], rotation: [0.6, 0, 0] },
      { geometry: new SphereGeometry(0.1, 10, 8), colour: coat, position: [0, 0.92, 0.42], scale: [0.85, 0.9, 1.1] },
      { geometry: new ConeGeometry(0.065, 0.26, 8), colour: coat, position: [0, 0.89, 0.6], rotation: [Math.PI / 2, 0, 0] },
      { geometry: new SphereGeometry(0.025, 6, 4), colour: dogs.nose, position: [0, 0.89, 0.73] },
      { geometry: new SphereGeometry(0.025, 6, 4), colour: dogs.eye, position: [-0.055, 0.96, 0.5] },
      { geometry: new SphereGeometry(0.025, 6, 4), colour: dogs.eye, position: [0.055, 0.96, 0.5] },
      { geometry: new ConeGeometry(0.04, 0.12, 5), colour: dark, position: [-0.07, 1.0, 0.36], rotation: [-0.9, 0, 0.4] },
      { geometry: new ConeGeometry(0.04, 0.12, 5), colour: dark, position: [0.07, 1.0, 0.36], rotation: [-0.9, 0, -0.4] },
      { geometry: new CylinderGeometry(0.018, 0.01, 0.36, 5), colour: coat, position: [0, 0.5, -0.42], rotation: [-0.4, 0, 0] },
      ...dogLegs(0.03, 0.5, 0.08, 0.2, -0.2, coat),
    ]),
    scale,
  )
}

// White with black spots and black ears. Faces +z, towards the squad.
export function createDalmatianGeometry(): BufferGeometry {
  const { coat, spot, scale } = dogs.dalmatian
  const spots: Part[] = []
  for (const [x, y, z] of [
    [0.15, 0.55, 0.05],
    [-0.12, 0.6, -0.12],
    [0.02, 0.66, -0.02],
    [-0.18, 0.45, 0.12],
    [0.17, 0.42, -0.2],
    [0.08, 0.84, 0.32],
  ] as const) {
    spots.push({ geometry: new SphereGeometry(0.06, 6, 4), colour: spot, position: [x, y, z], scale: [1, 0.6, 1] })
  }
  return scaled(
    mergeParts([
      { geometry: new SphereGeometry(0.24, 10, 8), colour: coat, position: [0, 0.48, -0.02], scale: [0.9, 0.85, 1.4] },
      { geometry: new SphereGeometry(0.17, 10, 8), colour: coat, position: [0, 0.76, 0.3] },
      { geometry: new SphereGeometry(0.09, 8, 6), colour: coat, position: [0, 0.7, 0.45], scale: [1, 0.85, 1.2] },
      { geometry: new SphereGeometry(0.035, 6, 4), colour: dogs.nose, position: [0, 0.73, 0.56] },
      { geometry: new SphereGeometry(0.03, 6, 4), colour: dogs.eye, position: [-0.07, 0.82, 0.43] },
      { geometry: new SphereGeometry(0.03, 6, 4), colour: dogs.eye, position: [0.07, 0.82, 0.43] },
      { geometry: new SphereGeometry(0.08, 8, 6), colour: spot, position: [-0.16, 0.78, 0.28], scale: [0.5, 1.3, 0.9], rotation: [0, 0, -0.3] },
      { geometry: new SphereGeometry(0.08, 8, 6), colour: spot, position: [0.16, 0.78, 0.28], scale: [0.5, 1.3, 0.9], rotation: [0, 0, 0.3] },
      { geometry: new CylinderGeometry(0.03, 0.018, 0.3, 6), colour: coat, position: [0, 0.58, -0.42], rotation: [-0.7, 0, 0] },
      ...spots,
      ...dogLegs(0.055, 0.3, 0.12, 0.17, -0.17, coat),
    ]),
    scale,
  )
}

// A trash-can lid held upright, facing +z, with its handle to the front.
export function createShieldGeometry(): BufferGeometry {
  const { lid, ring, handle, scale } = renderConfig.shield
  return scaled(
    mergeParts([
      { geometry: new CylinderGeometry(0.42, 0.42, 0.05, 16), colour: lid, position: [0, 0, 0], rotation: [Math.PI / 2, 0, 0] },
      { geometry: new TorusGeometry(0.42, 0.03, 3, 18), colour: ring, position: [0, 0, 0] },
      { geometry: new TorusGeometry(0.3, 0.022, 3, 14), colour: ring, position: [0, 0, 0.03] },
      { geometry: new TorusGeometry(0.17, 0.02, 3, 10), colour: ring, position: [0, 0, 0.03] },
      { geometry: new TorusGeometry(0.09, 0.022, 3, 6, Math.PI), colour: handle, position: [0, 0, 0.03], rotation: [Math.PI / 2, 0, 0] },
    ]),
    scale,
  )
}

// A water bucket with a handle.
export function createBarrelGeometry(): BufferGeometry {
  const { bucket, band, rim, water, handle, scale } = renderConfig.barrel
  return scaled(
    mergeParts([
      { geometry: new CylinderGeometry(0.42, 0.33, 0.78, 16), colour: bucket, position: [0, 0.39, 0] },
      { geometry: new CylinderGeometry(0.395, 0.395, 0.06, 16), colour: band, position: [0, 0.5, 0] },
      { geometry: new CylinderGeometry(0.36, 0.36, 0.06, 16), colour: band, position: [0, 0.2, 0] },
      { geometry: new CylinderGeometry(0.39, 0.39, 0.02, 16), colour: water, position: [0, 0.785, 0] },
      { geometry: new TorusGeometry(0.42, 0.035, 6, 20), colour: rim, position: [0, 0.78, 0], rotation: [Math.PI / 2, 0, 0] },
      { geometry: new TorusGeometry(0.42, 0.02, 5, 16, Math.PI), colour: handle, position: [0, 0.78, 0], rotation: [-0.3, 0, 0] },
    ]),
    scale,
  )
}

// Where a boss's two side brushes turn, as a fraction of its radius to each side and to the front.
export const bossBrushPlace = 0.72

// The round body of a robot vacuum. Faces +z, towards the squad. Its lights and brushes are drawn separately.
export function createBossBodyGeometry(kind: BossKind): BufferGeometry {
  const { body, trim, top } = renderConfig.boss[kind]
  const radius = tuning.hitRadius[kind]
  const parts: Part[] = [
    { geometry: new CylinderGeometry(1, 1, 0.3, 32), colour: body, position: [0, 0.22, 0] },
    { geometry: new CylinderGeometry(1.025, 1.025, 0.14, 32), colour: trim, position: [0, 0.12, 0] },
    { geometry: new CylinderGeometry(0.92, 0.92, 0.03, 32), colour: top, position: [0, 0.385, 0] },
    { geometry: new CylinderGeometry(0.22, 0.24, 0.14, 16), colour: trim, position: [0, 0.45, -0.35] },
    { geometry: new CylinderGeometry(0.2, 0.2, 0.03, 16), colour: top, position: [0, 0.53, -0.35] },
    { geometry: new CylinderGeometry(0.09, 0.09, 0.03, 12), colour: trim, position: [0, 0.405, 0.3] },
  ]
  // The world boss carries a dust bin on top.
  if (kind === 'megaDustbot') {
    parts.push(
      { geometry: new CylinderGeometry(0.4, 0.48, 0.5, 20), colour: top, position: [0, 0.65, -0.15] },
      { geometry: new CylinderGeometry(0.42, 0.42, 0.06, 20), colour: trim, position: [0, 0.92, -0.15] },
    )
  }
  return scaled(mergeParts(parts), radius)
}

// The glowing light strip and eyes, drawn unlit; the world boss squints.
export function createBossLightsGeometry(kind: BossKind): BufferGeometry {
  const { light } = renderConfig.boss[kind]
  const radius = tuning.hitRadius[kind]
  const stripArc = 1
  const eyes: Part[] =
    kind === 'megaDustbot'
      ? [
          { geometry: new BoxGeometry(0.25, 0.05, 0.12), colour: light, position: [-0.3, 0.4, 0.75], rotation: [0, 0, -0.35] },
          { geometry: new BoxGeometry(0.25, 0.05, 0.12), colour: light, position: [0.3, 0.4, 0.75], rotation: [0, 0, 0.35] },
        ]
      : [
          { geometry: new SphereGeometry(0.08, 10, 8), colour: light, position: [-0.32, 0.39, 0.78] },
          { geometry: new SphereGeometry(0.08, 10, 8), colour: light, position: [0.32, 0.39, 0.78] },
        ]
  return scaled(
    mergeParts([
      // Turned so the arc lies around the front of the body, centred on +z.
      { geometry: new TorusGeometry(1.012, 0.022, 4, 24, stripArc), colour: light, position: [0, 0.25, 0], rotation: [Math.PI / 2, 0, Math.PI / 2 - stripArc / 2] },
      ...eyes,
    ]),
    radius,
  )
}

// A side brush: a hub with three bristle arms, turning about y.
export function createBossBrushGeometry(kind: BossKind): BufferGeometry {
  const { brush, bristle } = renderConfig.boss[kind]
  const radius = tuning.hitRadius[kind]
  const parts: Part[] = [{ geometry: new CylinderGeometry(0.07, 0.07, 0.04, 10), colour: brush, position: [0, 0, 0] }]
  for (let arm = 0; arm < 3; arm++) {
    const angle = (arm * 2 * Math.PI) / 3
    parts.push({ geometry: new BoxGeometry(0.03, 0.015, 0.38), colour: bristle, position: [Math.sin(angle) * 0.19, 0, Math.cos(angle) * 0.19], rotation: [0, angle, 0] })
  }
  return scaled(mergeParts(parts), radius)
}

// A grey clump of dust, 1 unit across at scale 1.
export function createDustBallGeometry(): BufferGeometry {
  const { colours, scale } = renderConfig.dustBall
  const [middle, light, dark] = colours
  return scaled(
    mergeParts([
      { geometry: new SphereGeometry(0.5, 10, 8), colour: middle, position: [0, 0, 0] },
      { geometry: new SphereGeometry(0.28, 8, 6), colour: light, position: [0.3, 0.2, 0.15] },
      { geometry: new SphereGeometry(0.24, 8, 6), colour: dark, position: [-0.28, -0.1, 0.2] },
    ]),
    scale,
  )
}

// A ball of yarn with slanted strands, so its spin shows.
export function createYarnBallGeometry(): BufferGeometry {
  const { colour, strand, radius } = renderConfig.yarnBall
  const geometry = new IcosahedronGeometry(radius, 1)
  geometry.deleteAttribute('uv')
  const positions = geometry.getAttribute('position')
  const ball = new Color(colour)
  const strandColour = new Color(strand)
  const vertexColours = new Float32Array(positions.count * 3)
  for (let face = 0; face < positions.count; face += 3) {
    let centreX = 0
    let centreY = 0
    for (let corner = face; corner < face + 3; corner++) {
      centreX += positions.getX(corner)
      centreY += positions.getY(corner)
    }
    const faceColour = Math.sin(((centreY + centreX * 0.4) / radius) * 4) > 0 ? strandColour : ball
    for (let corner = face; corner < face + 3; corner++) faceColour.toArray(vertexColours, corner * 3)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(vertexColours, 3))
  return geometry
}

// A standing gold coin with a paw print on both faces, facing ±z.
export function createBigBuffGeometry(): BufferGeometry {
  const { token, tokenFace, scale } = renderConfig.bigBuff
  const parts: Part[] = [
    { geometry: new CylinderGeometry(0.55, 0.55, 0.14, 24), colour: token, position: [0, 0, 0], rotation: [Math.PI / 2, 0, 0] },
    { geometry: new CylinderGeometry(0.42, 0.42, 0.16, 24), colour: tokenFace, position: [0, 0, 0], rotation: [Math.PI / 2, 0, 0] },
  ]
  for (const side of [-1, 1]) {
    const z = side * 0.085
    parts.push(
      { geometry: new SphereGeometry(0.13, 10, 6), colour: token, position: [0, -0.08, z], scale: [1, 0.9, 0.25] },
      { geometry: new SphereGeometry(0.06, 8, 5), colour: token, position: [-0.14, 0.09, z], scale: [1, 1, 0.25] },
      { geometry: new SphereGeometry(0.06, 8, 5), colour: token, position: [0, 0.15, z], scale: [1, 1, 0.25] },
      { geometry: new SphereGeometry(0.06, 8, 5), colour: token, position: [0.14, 0.09, z], scale: [1, 1, 0.25] },
    )
  }
  return scaled(mergeParts(parts), scale)
}

// A low-poly tree about 2.5 units tall at scale 1.
export function createTreeGeometry(): BufferGeometry {
  const { trunk, leaves, leavesLight, scale } = renderConfig.scenery.tree
  return scaled(
    mergeParts([
      { geometry: new CylinderGeometry(0.13, 0.18, 1.1, 6), colour: trunk, position: [0, 0.55, 0] },
      { geometry: new IcosahedronGeometry(0.85, 0), colour: leaves, position: [0, 1.6, 0] },
      { geometry: new IcosahedronGeometry(0.6, 0), colour: leavesLight, position: [0.3, 2.2, 0.15] },
      { geometry: new IcosahedronGeometry(0.55, 0), colour: leavesLight, position: [-0.35, 1.95, -0.2] },
    ]),
    scale,
  )
}

// A small house with its door facing +z. Only its plaster walls take the house's tint.
export function createHouseGeometry(): BufferGeometry {
  const { plaster, roof, door, window, scale } = renderConfig.scenery.house
  return scaled(
    mergeParts([
      { geometry: new BoxGeometry(2.4, 1.7, 2.2), colour: plaster, position: [0, 0.85, 0], tinted: true },
      { geometry: new ConeGeometry(1.95, 1.2, 4), colour: roof, position: [0, 2.3, 0], rotation: [0, Math.PI / 4, 0] },
      { geometry: new BoxGeometry(0.3, 0.6, 0.3), colour: roof, position: [0.6, 2.6, -0.3] },
      { geometry: new BoxGeometry(0.5, 0.9, 0.06), colour: door, position: [0, 0.45, 1.11] },
      { geometry: new BoxGeometry(0.45, 0.45, 0.06), colour: window, position: [-0.75, 1.05, 1.11] },
      { geometry: new BoxGeometry(0.45, 0.45, 0.06), colour: window, position: [0.75, 1.05, 1.11] },
      { geometry: new BoxGeometry(0.06, 0.45, 0.45), colour: window, position: [-1.21, 1.05, 0] },
      { geometry: new BoxGeometry(0.06, 0.45, 0.45), colour: window, position: [1.21, 1.05, 0] },
    ]),
    scale,
  )
}

// One post and the two rails running from it towards −z, to the next segment's post. The scale sets its height and
// thickness; its length stays the segment length, so the segments meet.
export function createFenceGeometry(): BufferGeometry {
  const { colour, post, segmentLength, scale } = renderConfig.scenery.fence
  return mergeParts([
    { geometry: new BoxGeometry(0.12, 0.7, 0.12), colour: post, position: [0, 0.35, 0] },
    { geometry: new BoxGeometry(0.06, 0.09, segmentLength), colour, position: [0, 0.28, -segmentLength / 2] },
    { geometry: new BoxGeometry(0.06, 0.09, segmentLength), colour, position: [0, 0.52, -segmentLength / 2] },
  ]).scale(scale, scale, 1)
}

// The upper half of a sphere around the camera, from the horizon colour up to the top colour.
export function createSkyGeometry(radius: number): BufferGeometry {
  const { top, horizon, topElevation } = renderConfig.sky
  // A little below the horizon, so no gap shows beyond the far end of the ground.
  const geometry = new SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2 + 0.15)
  const positions = geometry.getAttribute('position')
  const topColour = new Color(top)
  const colour = new Color()
  const vertexColours = new Float32Array(positions.count * 3)
  for (let i = 0; i < positions.count; i++) {
    const height = Math.min(Math.max(positions.getY(i) / radius / Math.sin(topElevation), 0), 1)
    colour.setHex(horizon).lerp(topColour, height).toArray(vertexColours, i * 3)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(vertexColours, 3))
  return geometry
}
