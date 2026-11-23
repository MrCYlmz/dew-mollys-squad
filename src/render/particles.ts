import { Color, IcosahedronGeometry, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, Vector3 } from 'three'
import { renderConfig } from '../content/renderConfig'

const { capacity, gravity, kill, splash } = renderConfig.particles

interface Burst {
  colours: readonly number[]
  count: number
  speed: number
  rise: number
  size: number
  lifetime: number
  height: number
}

const matrix = new Matrix4()
const position = new Vector3()
const scale = new Vector3()
const noRotation = new Quaternion()

// Pooled bits flying out of a kill puff or a barrel splash. They keep road places, as in the sim, so they move with the road.
export class Particles {
  readonly mesh: InstancedMesh
  private readonly geometry = new IcosahedronGeometry(1, 0)
  private readonly material = new MeshLambertMaterial()
  // The kill colours, then the splash colours.
  private readonly palette = [...kill.colours, ...splash.colours].map((colour) => new Color(colour))
  private readonly x = new Float32Array(capacity)
  private readonly y = new Float32Array(capacity)
  private readonly z = new Float32Array(capacity)
  private readonly velocityX = new Float32Array(capacity)
  private readonly velocityY = new Float32Array(capacity)
  private readonly velocityZ = new Float32Array(capacity)
  private readonly age = new Float32Array(capacity)
  private readonly lifetime = new Float32Array(capacity)
  private readonly size = new Float32Array(capacity)
  private readonly colour = new Uint8Array(capacity)
  private count = 0

  constructor() {
    this.mesh = new InstancedMesh(this.geometry, this.material, capacity)
    // Colours are set up front, so the first burst compiles no new shader.
    for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, this.palette[0])
    this.mesh.count = 0
    this.mesh.frustumCulled = false
  }

  emitKill(x: number, z: number): void {
    this.emit(kill, 0, x, z)
  }

  emitSplash(x: number, z: number): void {
    this.emit(splash, kill.colours.length, x, z)
  }

  clear(): void {
    this.count = 0
    this.mesh.count = 0
  }

  // Moves the bits on and draws them at world z roadZ − z; a full pool drops new bits.
  update(frameSeconds: number, roadZ: number): void {
    for (let i = this.count - 1; i >= 0; i--) {
      this.age[i] += frameSeconds
      if (this.age[i] >= this.lifetime[i]) {
        this.release(i)
        continue
      }
      this.x[i] += this.velocityX[i] * frameSeconds
      this.z[i] += this.velocityZ[i] * frameSeconds
      this.velocityY[i] -= gravity * frameSeconds
      this.y[i] = Math.max(this.y[i] + this.velocityY[i] * frameSeconds, 0)
    }
    for (let i = 0; i < this.count; i++) {
      scale.setScalar(this.size[i] * (1 - this.age[i] / this.lifetime[i]))
      matrix.compose(position.set(this.x[i], this.y[i], roadZ - this.z[i]), noRotation, scale)
      this.mesh.setMatrixAt(i, matrix)
      this.mesh.setColorAt(i, this.palette[this.colour[i]])
    }
    this.mesh.count = this.count
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor !== null) this.mesh.instanceColor.needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.mesh.dispose()
  }

  private emit(burst: Burst, firstColour: number, x: number, z: number): void {
    for (let i = 0; i < burst.count && this.count < capacity; i++) {
      const index = this.count++
      const angle = Math.random() * Math.PI * 2
      const speed = burst.speed * (0.5 + Math.random() * 0.5)
      this.x[index] = x
      this.y[index] = burst.height
      this.z[index] = z
      this.velocityX[index] = Math.cos(angle) * speed
      this.velocityY[index] = burst.rise * (0.6 + Math.random() * 0.4)
      this.velocityZ[index] = Math.sin(angle) * speed
      this.age[index] = 0
      this.lifetime[index] = burst.lifetime * (0.7 + Math.random() * 0.3)
      this.size[index] = burst.size * (0.7 + Math.random() * 0.6)
      this.colour[index] = firstColour + (i % burst.colours.length)
    }
  }

  // Swaps the last bit into this one's place.
  private release(index: number): void {
    const last = --this.count
    this.x[index] = this.x[last]
    this.y[index] = this.y[last]
    this.z[index] = this.z[last]
    this.velocityX[index] = this.velocityX[last]
    this.velocityY[index] = this.velocityY[last]
    this.velocityZ[index] = this.velocityZ[last]
    this.age[index] = this.age[last]
    this.lifetime[index] = this.lifetime[last]
    this.size[index] = this.size[last]
    this.colour[index] = this.colour[last]
  }
}
