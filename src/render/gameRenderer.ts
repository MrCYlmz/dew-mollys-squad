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
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from 'three'
import type { EnemyKind } from '../content/level'
import { tuning } from '../content/tuning'
import { formationOffsetX, formationOffsetZ, formationRadius } from '../sim/formation'
import type { RunState } from '../sim/run'
import { GatePanel } from './gatePanel'
import { createDigitMaterial, HpLabels } from './hpLabels'
import {
  createBarrelGeometry,
  createBulldogGeometry,
  createCatGeometry,
  createChihuahuaGeometry,
  createPuppyGeometry,
  createShieldDogGeometry,
  createShieldGeometry,
} from './models'

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
const wallHeight = 1.2
// Height of an enemy's HP number above the ground.
const hpLabelHeight: Record<EnemyKind, number> = { puppy: 1.05, chihuahua: 0.95, bulldog: 1.4, shieldDog: 1.1 }
const shieldLabelRise = 0.36
const barrelLabelHeight = 1.15
const bodyHpColour = new Color(0xffffff)
const shieldHpColour = new Color(0x8fd0ff)
const barrelHpColour = new Color(0xd6ecff)

export interface ScreenPoint {
  x: number
  y: number
}

const matrix = new Matrix4()
const position = new Vector3()
const viewDirection = new Vector3()
// Turns a quad that faces +z towards the camera, which looks down the track at cameraPitch.
const facingCamera = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -cameraPitch)

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
  private readonly enemies: Record<EnemyKind, InstancedMesh>
  private readonly enemyMeshes: InstancedMesh[]
  private readonly shields: InstancedMesh
  private readonly yarnBalls: InstancedMesh
  private readonly barrelGeometry = this.ownGeometry(createBarrelGeometry())
  private readonly barrelMaterial = this.ownMaterial(new MeshLambertMaterial({ vertexColors: true }))
  private readonly wallGeometry = this.ownGeometry(new BoxGeometry(1, 1, 1))
  private readonly wallMaterial = this.ownMaterial(new MeshLambertMaterial({ color: 0xb5523b }))
  private readonly digitMaterial = this.ownMaterial(createDigitMaterial())
  private readonly gatePanelGeometry = new PlaneGeometry(tuning.track.halfWidth, 2.2)
  private readonly levelGroup = new Group()
  private levelGeometries: BufferGeometry[] = []
  private levelMaterials: Material[] = []
  private gatePanels: GatePanel[] = []
  // Sized to the level's barrels and walls, so they are made again for each run.
  private barrels: InstancedMesh | null = null
  private walls: InstancedMesh | null = null
  private hpLabels: HpLabels | null = null
  private cssWidth = 1
  private cssHeight = 1
  private cameraDistance = minCameraDistance
  private unitsPerPixel = 0.01
  private seconds = 0
  private catsToScatter = 0
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
    const dogMaterial = this.ownMaterial(new MeshLambertMaterial({ vertexColors: true }))
    this.enemies = {
      puppy: this.instanced(this.ownGeometry(createPuppyGeometry()), dogMaterial, tuning.limits.enemies),
      chihuahua: this.instanced(this.ownGeometry(createChihuahuaGeometry()), dogMaterial, tuning.limits.enemies),
      bulldog: this.instanced(this.ownGeometry(createBulldogGeometry()), dogMaterial, tuning.limits.enemies),
      shieldDog: this.instanced(this.ownGeometry(createShieldDogGeometry()), dogMaterial, tuning.limits.enemies),
    }
    this.enemyMeshes = Object.values(this.enemies)
    this.shields = this.instanced(this.ownGeometry(createShieldGeometry()), dogMaterial, tuning.limits.enemies)
    this.yarnBalls = this.instanced(
      this.ownGeometry(new SphereGeometry(0.12, 8, 6)),
      this.ownMaterial(new MeshLambertMaterial({ color: 0xe0407b })),
      tuning.yarnBallCap,
    )
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

    this.barrels = this.instanced(this.barrelGeometry, this.barrelMaterial, state.barrels.length)
    this.walls = this.instanced(this.wallGeometry, this.wallMaterial, state.walls.length)
    // A shield dog shows two numbers, its shield's and its body's.
    this.hpLabels = new HpLabels(this.digitMaterial, tuning.limits.enemies * 2 + state.barrels.length, facingCamera)
    this.scene.add(this.hpLabels.mesh)

    for (const row of state.gateRows) {
      for (const side of [-1, 1]) {
        const panel = new GatePanel(this.gatePanelGeometry)
        panel.mesh.position.set((side * tuning.track.halfWidth) / 2, 1.4, -row.z)
        this.levelGroup.add(panel.mesh)
        this.gatePanels.push(panel)
      }
    }

    this.catsToScatter = 0
    this.scatter.count = 0
  }

  scatterCats(count: number): void {
    this.catsToScatter += count
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
    this.hpLabels?.begin()
    this.drawEnemies(state, alpha)
    this.drawBarrels(state)
    this.hpLabels?.finish()
    this.drawWalls(state)
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
    const mesh = new InstancedMesh(geometry, material, Math.max(capacity, 1))
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
    for (const mesh of [this.barrels, this.walls]) {
      if (mesh === null) continue
      this.scene.remove(mesh)
      mesh.dispose()
    }
    if (this.hpLabels !== null) {
      this.scene.remove(this.hpLabels.mesh)
      this.hpLabels.dispose()
    }
    this.barrels = this.walls = this.hpLabels = null
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

  // Cats keep their places in the squad, so they move with its interpolated position.
  private drawCats(state: RunState, squadX: number, squadZ: number): void {
    const cats = state.cats
    const shiftX = squadX - state.squad.x
    const shiftZ = squadZ - state.squad.z
    for (let slot = 0; slot < cats.length; slot++) {
      const bob = Math.abs(Math.sin(this.seconds * 10 + slot * 1.7)) * 0.08
      matrix.makeTranslation(cats[slot].x + shiftX, bob, -(cats[slot].z + shiftZ))
      this.cats.setMatrixAt(slot, matrix)
    }
    this.cats.count = cats.length
    this.cats.instanceMatrix.needsUpdate = true
  }

  // Lost cats jump sideways off the track, unhurt.
  private drawScatteredCats(state: RunState, squadX: number, squadZ: number, frameSeconds: number): void {
    const scatter = this.scatter
    const lost = this.catsToScatter
    this.catsToScatter = 0
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

  private drawEnemies(state: RunState, alpha: number): void {
    const enemies = state.enemies
    for (const mesh of this.enemyMeshes) mesh.count = 0
    this.shields.count = 0
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i]
      const x = lerp(enemy.previousX, enemy.x, alpha)
      const z = -lerp(enemy.previousZ, enemy.z, alpha)
      const mesh = this.enemies[enemy.kind]
      matrix.makeTranslation(x, 0, z)
      mesh.setMatrixAt(mesh.count++, matrix)
      const labelY = hpLabelHeight[enemy.kind]
      this.hpLabels?.add(enemy.hp, x, labelY, z, bodyHpColour)
      if (enemy.shield > 0) {
        matrix.makeTranslation(x, 0.45, z + 0.55)
        this.shields.setMatrixAt(this.shields.count++, matrix)
        this.hpLabels?.add(enemy.shield, x, labelY + shieldLabelRise, z, shieldHpColour)
      }
    }
    for (const mesh of this.enemyMeshes) mesh.instanceMatrix.needsUpdate = true
    this.shields.instanceMatrix.needsUpdate = true
  }

  private drawBarrels(state: RunState): void {
    if (this.barrels === null) return
    const barrels = state.barrels
    for (let i = 0; i < barrels.length; i++) {
      matrix.makeTranslation(barrels[i].x, 0, -barrels[i].z)
      this.barrels.setMatrixAt(i, matrix)
      this.hpLabels?.add(barrels[i].hp, barrels[i].x, barrelLabelHeight, -barrels[i].z, barrelHpColour)
    }
    this.barrels.count = barrels.length
    this.barrels.instanceMatrix.needsUpdate = true
  }

  private drawWalls(state: RunState): void {
    if (this.walls === null) return
    const walls = state.walls
    for (let i = 0; i < walls.length; i++) {
      const wall = walls[i]
      matrix.makeScale(wall.width, wallHeight, tuning.wall.depth)
      matrix.setPosition(position.set(wall.x, wallHeight / 2, -(wall.z + tuning.wall.depth / 2)))
      this.walls.setMatrixAt(i, matrix)
    }
    this.walls.count = walls.length
    this.walls.instanceMatrix.needsUpdate = true
  }

  private drawYarnBalls(state: RunState, alpha: number): void {
    const yarnBalls = state.yarnBalls
    for (let i = 0; i < yarnBalls.length; i++) {
      const yarnBall = yarnBalls[i]
      matrix.makeTranslation(lerp(yarnBall.previousX, yarnBall.x, alpha), 0.35, -lerp(yarnBall.previousZ, yarnBall.z, alpha))
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
