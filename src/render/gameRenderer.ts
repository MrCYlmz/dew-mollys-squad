import {
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from 'three'
import { tuning } from '../content/tuning'
import { drawnCats, formationOffsetX, formationOffsetZ, formationRadius } from '../sim/formation'
import type { RunState } from '../sim/run'
import { GatePanel } from './gatePanel'
import { createCatGeometry, createPuppyGeometry } from './models'

// Sim coordinates (x across, z forward) map to world (x, 0, −z), so the squad runs towards −z and screen right is +x.

const skyColour = 0x8fd3f4
const cameraPitch = 0.62
const cameraLookAhead = 4
// Half the width the camera keeps in view at its look point: the track plus a margin.
const viewHalfWidth = 6.8
const minCameraDistance = 15
const scatterCapacity = 60
const scatterLifetime = 1.2
const gravity = 14

export interface ScreenPoint {
  x: number
  y: number
}

const matrix = new Matrix4()
const position = new Vector3()
const viewDirection = new Vector3()

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha
}

// Draws the run. It reads sim state and decides no outcome.
export class GameRenderer {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(50, 1, 0.5, 140)
  private readonly geometries: BufferGeometry[] = []
  private readonly materials: Material[] = []
  private readonly cats: InstancedMesh
  private readonly scatteredCats: InstancedMesh
  private readonly puppies: InstancedMesh
  private readonly hpBars: InstancedMesh
  private readonly yarnBalls: InstancedMesh
  private readonly gatePanelGeometry = new PlaneGeometry(4.6, 2.2)
  private readonly levelGroup = new Group()
  private levelGeometries: BufferGeometry[] = []
  private levelMaterials: Material[] = []
  private gatePanels: GatePanel[] = []
  private cssWidth = 1
  private cssHeight = 1
  private cameraDistance = minCameraDistance
  private unitsPerPixel = 0.01
  private seconds = 0
  private lastSquadCount = 0
  private readonly scatter = {
    x: new Float32Array(scatterCapacity),
    y: new Float32Array(scatterCapacity),
    z: new Float32Array(scatterCapacity),
    velocityX: new Float32Array(scatterCapacity),
    velocityY: new Float32Array(scatterCapacity),
    age: new Float32Array(scatterCapacity),
    count: 0,
  }

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true })
    this.scene.background = new Color(skyColour)
    this.scene.fog = new Fog(skyColour, 60, 130)
    this.scene.add(new HemisphereLight(0xffffff, 0x6a8f4a, 2))
    const sun = new DirectionalLight(0xffffff, 1.6)
    sun.position.set(4, 10, 6)
    this.scene.add(sun)
    this.scene.add(this.levelGroup)

    const catGeometry = this.ownGeometry(createCatGeometry())
    const catMaterial = this.ownMaterial(new MeshLambertMaterial({ vertexColors: true }))
    this.cats = this.instanced(catGeometry, catMaterial, tuning.squad.formationSlots)
    this.scatteredCats = this.instanced(catGeometry, catMaterial, scatterCapacity)
    this.puppies = this.instanced(
      this.ownGeometry(createPuppyGeometry()),
      this.ownMaterial(new MeshLambertMaterial({ vertexColors: true })),
      tuning.limits.puppies,
    )
    this.hpBars = this.instanced(
      this.ownGeometry(new BoxGeometry(0.7, 0.1, 0.02)),
      this.ownMaterial(new MeshBasicMaterial({ color: 0xff3b5c })),
      tuning.limits.puppies,
    )
    this.yarnBalls = this.instanced(
      this.ownGeometry(new SphereGeometry(0.12, 8, 6)),
      this.ownMaterial(new MeshLambertMaterial({ color: 0xe0407b })),
      tuning.limits.yarnBalls,
    )
  }

  get info() {
    return this.renderer.info
  }

  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void {
    this.cssWidth = Math.max(cssWidth, 1)
    this.cssHeight = Math.max(cssHeight, 1)
    this.renderer.setPixelRatio(Math.min(pixelRatio, 2))
    this.renderer.setSize(this.cssWidth, this.cssHeight, false)
    this.camera.aspect = this.cssWidth / this.cssHeight
    this.camera.updateProjectionMatrix()

    const halfHeightTan = Math.tan((this.camera.fov * Math.PI) / 360)
    this.cameraDistance = Math.max(viewHalfWidth / (halfHeightTan * this.camera.aspect), minCameraDistance)
    // The squad stands cameraLookAhead before the look point, so nearer the camera.
    const squadDepth = this.cameraDistance - cameraLookAhead * Math.cos(cameraPitch)
    this.unitsPerPixel = (2 * squadDepth * halfHeightTan) / this.cssHeight
  }

  // Track units per CSS pixel at the squad's distance, so a drag moves the squad as far as the finger moved on screen.
  trackUnitsPerPixel(): number {
    return this.unitsPerPixel
  }

  // Builds the track and gates of a new run, freeing those of the run before.
  startRun(state: RunState): void {
    this.disposeLevel()
    const length = state.level.length
    const trackLength = length + 120

    this.addLevelMesh(new PlaneGeometry(400, trackLength + 200), new MeshLambertMaterial({ color: 0x7cc66b }), 0, -0.02, -length / 2)
    this.addLevelMesh(new PlaneGeometry(tuning.track.halfWidth * 2, trackLength), new MeshLambertMaterial({ color: 0xe8d9b5 }), 0, 0, -length / 2)
    for (const edge of [-1, 1]) {
      this.addLevelMesh(new BoxGeometry(0.3, 0.3, trackLength), new MeshLambertMaterial({ color: 0xffffff }), edge * (tuning.track.halfWidth + 0.15), 0.15, -length / 2)
    }
    this.addLevelMesh(new PlaneGeometry(tuning.track.halfWidth * 2, 1.2), new MeshBasicMaterial({ color: 0x222222 }), 0, 0.01, -length)
    this.addLevelMesh(new BoxGeometry(tuning.track.halfWidth * 2 + 0.6, 0.4, 0.4), new MeshLambertMaterial({ color: 0xffd23f }), 0, 3.4, -length)

    for (const row of state.gateRows) {
      for (const side of [-1, 1]) {
        const panel = new GatePanel(this.gatePanelGeometry)
        panel.mesh.position.set((side * tuning.track.halfWidth) / 2, 1.4, -row.z)
        this.levelGroup.add(panel.mesh)
        this.gatePanels.push(panel)
      }
    }

    this.lastSquadCount = state.squad.count
    this.scatter.count = 0
  }

  // Draws the state between the tick before and the last one, alpha of the way.
  draw(state: RunState, alpha: number, frameSeconds: number): void {
    this.seconds += frameSeconds
    const squad = state.squad
    const squadX = lerp(squad.previousX, squad.x, alpha)
    const squadZ = lerp(squad.previousZ, squad.z, alpha)

    this.placeCamera(squadZ)
    this.drawCats(state, squadX, squadZ)
    this.drawScatteredCats(state, squadX, squadZ, frameSeconds)
    this.drawPuppies(state, alpha)
    this.drawYarnBalls(state, alpha)
    this.drawGates(state)
    this.renderer.render(this.scene, this.camera)
  }

  // Writes where the squad count label belongs, in CSS pixels from the top left of the canvas.
  squadLabelPoint(state: RunState, alpha: number, out: ScreenPoint): void {
    const squad = state.squad
    position.set(lerp(squad.previousX, squad.x, alpha), 1 + formationRadius(squad.count) * 0.4, -lerp(squad.previousZ, squad.z, alpha))
    position.project(this.camera)
    out.x = ((position.x + 1) / 2) * this.cssWidth
    out.y = ((1 - position.y) / 2) * this.cssHeight
  }

  dispose(): void {
    this.disposeLevel()
    this.gatePanelGeometry.dispose()
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    this.renderer.dispose()
  }

  private ownGeometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry)
    return geometry
  }

  private ownMaterial<T extends Material>(material: T): T {
    this.materials.push(material)
    return material
  }

  private instanced(geometry: BufferGeometry, material: Material, capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(geometry, material, capacity)
    mesh.count = 0
    // Instances move every frame; the mesh's bounding sphere would not follow them.
    mesh.frustumCulled = false
    this.scene.add(mesh)
    return mesh
  }

  private addLevelMesh(geometry: BufferGeometry, material: Material, x: number, y: number, z: number): void {
    const mesh = new Mesh(geometry, material)
    if (geometry instanceof PlaneGeometry) mesh.rotation.x = -Math.PI / 2
    mesh.position.set(x, y, z)
    this.levelGroup.add(mesh)
    this.levelGeometries.push(geometry)
    this.levelMaterials.push(material)
  }

  private disposeLevel(): void {
    this.levelGroup.clear()
    for (const geometry of this.levelGeometries) geometry.dispose()
    for (const material of this.levelMaterials) material.dispose()
    for (const panel of this.gatePanels) panel.dispose()
    this.levelGeometries = []
    this.levelMaterials = []
    this.gatePanels = []
  }

  private placeCamera(squadZ: number): void {
    const lookZ = -(squadZ + cameraLookAhead)
    viewDirection.set(0, -Math.sin(cameraPitch), -Math.cos(cameraPitch))
    this.camera.position.set(0, -viewDirection.y * this.cameraDistance, lookZ - viewDirection.z * this.cameraDistance)
    position.set(0, 0, lookZ)
    this.camera.lookAt(position)
  }

  private drawCats(state: RunState, squadX: number, squadZ: number): void {
    const drawn = drawnCats(state.squad.count)
    for (let slot = 0; slot < drawn; slot++) {
      const bob = Math.abs(Math.sin(this.seconds * 10 + slot * 1.7)) * 0.08
      matrix.makeTranslation(squadX + formationOffsetX[slot], bob, -(squadZ + formationOffsetZ[slot]))
      this.cats.setMatrixAt(slot, matrix)
    }
    this.cats.count = drawn
    this.cats.instanceMatrix.needsUpdate = true
  }

  // Lost cats jump sideways off the track, unhurt.
  private drawScatteredCats(state: RunState, squadX: number, squadZ: number, frameSeconds: number): void {
    const scatter = this.scatter
    const lost = this.lastSquadCount - state.squad.count
    this.lastSquadCount = state.squad.count
    for (let i = 0; i < lost && scatter.count < scatterCapacity; i++) {
      const slot = (state.squad.count + i) % tuning.squad.formationSlots
      const index = scatter.count++
      const side = formationOffsetX[slot] < 0 || (formationOffsetX[slot] === 0 && i % 2 === 0) ? -1 : 1
      scatter.x[index] = squadX + formationOffsetX[slot]
      scatter.y[index] = 0
      scatter.z[index] = -(squadZ + formationOffsetZ[slot])
      scatter.velocityX[index] = side * (6 + (i % 3))
      scatter.velocityY[index] = 5 + (i % 2)
      scatter.age[index] = 0
    }

    for (let i = scatter.count - 1; i >= 0; i--) {
      scatter.age[i] += frameSeconds
      if (scatter.age[i] >= scatterLifetime) {
        const last = --scatter.count
        scatter.x[i] = scatter.x[last]
        scatter.y[i] = scatter.y[last]
        scatter.z[i] = scatter.z[last]
        scatter.velocityX[i] = scatter.velocityX[last]
        scatter.velocityY[i] = scatter.velocityY[last]
        scatter.age[i] = scatter.age[last]
        continue
      }
      scatter.x[i] += scatter.velocityX[i] * frameSeconds
      scatter.velocityY[i] -= gravity * frameSeconds
      scatter.y[i] = Math.max(scatter.y[i] + scatter.velocityY[i] * frameSeconds, 0)
    }
    for (let i = 0; i < scatter.count; i++) {
      matrix.makeTranslation(scatter.x[i], scatter.y[i], scatter.z[i])
      this.scatteredCats.setMatrixAt(i, matrix)
    }
    this.scatteredCats.count = scatter.count
    this.scatteredCats.instanceMatrix.needsUpdate = true
  }

  private drawPuppies(state: RunState, alpha: number): void {
    const puppies = state.puppies
    for (let i = 0; i < puppies.length; i++) {
      const puppy = puppies[i]
      const x = lerp(puppy.previousX, puppy.x, alpha)
      const z = -lerp(puppy.previousZ, puppy.z, alpha)
      matrix.makeTranslation(x, 0, z)
      this.puppies.setMatrixAt(i, matrix)
      const hpShare = puppy.hp / tuning.puppy.hp
      matrix.makeScale(hpShare, 1, 1)
      matrix.setPosition(position.set(x - (0.35 * (1 - hpShare)), 1.05, z))
      this.hpBars.setMatrixAt(i, matrix)
    }
    this.puppies.count = puppies.length
    this.hpBars.count = puppies.length
    this.puppies.instanceMatrix.needsUpdate = true
    this.hpBars.instanceMatrix.needsUpdate = true
  }

  private drawYarnBalls(state: RunState, alpha: number): void {
    const yarnBalls = state.yarnBalls
    for (let i = 0; i < yarnBalls.length; i++) {
      const yarnBall = yarnBalls[i]
      matrix.makeTranslation(yarnBall.x, 0.35, -lerp(yarnBall.previousZ, yarnBall.z, alpha))
      this.yarnBalls.setMatrixAt(i, matrix)
    }
    this.yarnBalls.count = yarnBalls.length
    this.yarnBalls.instanceMatrix.needsUpdate = true
  }

  private drawGates(state: RunState): void {
    const rows = state.gateRows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const left = this.gatePanels[i * 2]
      const right = this.gatePanels[i * 2 + 1]
      left.show(row.left)
      right.show(row.right)
      left.mesh.visible = row.taken !== 'right'
      right.mesh.visible = row.taken !== 'left'
    }
  }
}
