import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshLambertMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three'
import type { BigBuff, BossKind, EnemyKind, GateOp, Lane } from '../content/level'
import { renderConfig, type Fur, type GraphicsQuality } from '../content/renderConfig'
import { tuning } from '../content/tuning'
import { formationOffsetX, formationOffsetZ, formationRadius } from '../sim/formation'
import { laneBorder, laneCentreX } from '../sim/gates'
import { shownHp } from '../sim/hp'
import type { BuffBlockState, RunState } from '../sim/run'
import { createBigBuffMaterial, createGatePanelMaterial, createMysteryPanelMaterial, disposePanelMaterial } from './gatePanel'
import { createDigitMaterial, HpLabels } from './hpLabels'
import {
  bossBrushPlace,
  createBarrelGeometry,
  createBigBuffGeometry,
  createBossBodyGeometry,
  createBossBrushGeometry,
  createBossLightsGeometry,
  createBulldogGeometry,
  createCatGeometry,
  createChihuahuaGeometry,
  createDalmatianGeometry,
  createDustBallGeometry,
  createFenceGeometry,
  createGreyhoundGeometry,
  createHouseGeometry,
  createPuppyGeometry,
  createShieldDogGeometry,
  createShieldGeometry,
  createSkyGeometry,
  createTreeGeometry,
  createYarnBallGeometry,
} from './models'
import { Particles } from './particles'
import { createBrickTexture, createCrateTexture, createFinishTexture, createGlowTexture, createGrassTexture, createTrackTexture } from './textures'

// The squad holds its place at the world origin and the road comes at it: a sim place (x, z) is drawn at world
// (x, 0, roadZ − z), where roadZ is the squad's distance travelled. The road runs off towards −z and screen right is +x.

const look = renderConfig
const cameraLook = look.camera
const lanes: readonly Lane[] = ['left', 'centre', 'right']
const bossKinds: readonly BossKind[] = ['dustbot', 'megaDustbot']
const panelWidth = 2 * laneBorder - look.panel.gap
const panelHeight = look.panel.height
const roadBehind = look.track.roadBehind
// How far the road reaches beyond the level's end, so the camera never sees it stop.
const roadBeyond = cameraLook.far
const catCapacity = tuning.squad.formationSlots + look.scatter.capacity
const hpLabelHeight = look.hpLabel.heights
const bodyHpColour = new Color(look.hpLabel.body)
const shieldHpColour = new Color(look.hpLabel.shield)
const barrelHpColour = new Color(look.hpLabel.barrel)
const buffBlockHpColour = new Color(look.hpLabel.buffBlock)
const bossHitColour = new Color(look.boss.hitFlash)
const noEmissive = new Color(0, 0, 0)
const curbColours = look.track.curbColours.map((colour) => new Color(colour))
const houseColours = look.scenery.house.walls.map((colour) => new Color(colour))

export interface ScreenPoint {
  x: number
  y: number
}

// What the last drawn frame cost and showed, for the performance overlay.
export interface FrameStats {
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
  catsDrawn: number
  particles: number
}

const matrix = new Matrix4()
// Per-frame code passes positions to setPosition and makeTranslation in this vector, never as numbers: those overloads test
// x.isVector3, which boxes a number argument on every call.
const position = new Vector3()
const labelPlace = new Vector3()
const scale = new Vector3()
const rotation = new Quaternion()
const viewDirection = new Vector3()
const yAxis = new Vector3(0, 1, 0)
// Turns a quad that faces +z towards the camera, which looks down the track at its pitch.
const facingCamera = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -cameraLook.pitch)

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha
}

function randomBetween(from: number, to: number): number {
  return from + Math.random() * (to - from)
}

// Bricks keep their size on walls of any width: the texture is laid by the instance's scale, per face.
function createWallMaterial(map: Texture): MeshLambertMaterial {
  const { tileWidth, tileHeight } = look.wall
  const material = new MeshLambertMaterial({ map })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
	vec3 wallScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
	vec3 scaledPosition = position * wallScale;
	vec2 wallUv = abs(normal.x) > 0.5 ? scaledPosition.zy : abs(normal.y) > 0.5 ? scaledPosition.xz : scaledPosition.xy;
	vMapUv = wallUv / vec2(${tileWidth.toFixed(3)}, ${tileHeight.toFixed(3)});`,
    )
  }
  return material
}

// Each crate face shows the damage stage its instance's damage attribute picks from the crate texture.
function createCrateMaterial(map: Texture): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ map })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute float damage;\nvoid main() {')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n\tvMapUv.x = (vMapUv.x + damage) / ${look.buffBlock.damageStages.toFixed(1)};`)
  }
  return material
}

// Only the plaster walls take a house's instance colour, as its wallTint attribute marks them; roof, door and windows keep theirs.
function createHouseMaterial(): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ vertexColors: true })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute float wallTint;\nvoid main() {')
      .replace('#include <color_vertex>', 'vColor = vec4(color, 1.0);\n\tvColor.rgb *= mix(vec3(1.0), instanceColor.rgb, wallTint);')
  }
  return material
}

interface Boss {
  group: Group
  brushes: [Mesh, Mesh]
}

// Draws the run. It reads sim state and decides no outcome.
export class GameRenderer {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  // Its distances follow the camera, which moves back on narrow screens; resize sets them.
  private readonly fog = new Fog(look.sky.horizon)
  private readonly camera = new PerspectiveCamera(cameraLook.fov, 1, cameraLook.near, cameraLook.far)
  private maxPixelRatio: number
  private pixelRatio = 1
  private readonly geometries: BufferGeometry[] = []
  private readonly materials: Material[] = []
  private readonly textures: Texture[] = []
  private readonly sky: Mesh
  private readonly sun: DirectionalLight
  private readonly cats: Record<Fur, InstancedMesh>
  private readonly catMeshes: InstancedMesh[]
  private readonly enemies: Record<EnemyKind, InstancedMesh>
  private readonly enemyMeshes: InstancedMesh[]
  private readonly shields: InstancedMesh
  private readonly yarnBalls: InstancedMesh
  private readonly bossMaterial = this.ownMaterial(new MeshLambertMaterial({ vertexColors: true }))
  private readonly bosses: Record<BossKind, Boss>
  private readonly dustBalls: InstancedMesh
  private readonly particles = new Particles()
  private bossFlashSeconds = 0
  private readonly barrelGeometry = this.ownGeometry(createBarrelGeometry())
  private readonly barrelMaterial = this.ownMaterial(new MeshLambertMaterial({ vertexColors: true }))
  private readonly wallGeometry = this.ownGeometry(new BoxGeometry(1, 1, 1))
  private readonly wallMaterial = this.ownMaterial(createWallMaterial(this.ownTexture(createBrickTexture())))
  private readonly digitMaterial = this.ownMaterial(createDigitMaterial())
  private readonly panelGeometry = this.ownGeometry(new PlaneGeometry(panelWidth, panelHeight))
  private readonly laneDashGeometry = this.ownGeometry(
    new PlaneGeometry(look.track.laneMarkingWidth, look.track.laneDashLength).rotateX(-Math.PI / 2),
  )
  private readonly laneDashMaterial = this.ownMaterial(new MeshLambertMaterial({ color: look.track.laneMarking }))
  private readonly curbGeometry = this.ownGeometry(new BoxGeometry(look.track.curbWidth, look.track.curbHeight, look.track.curbLength))
  private readonly plainMaterial = this.ownMaterial(new MeshLambertMaterial())
  private readonly grassTexture = this.ownTexture(createGrassTexture())
  private readonly grassMaterial = this.ownMaterial(new MeshLambertMaterial({ map: this.grassTexture }))
  private readonly trackTexture = this.ownTexture(createTrackTexture())
  private readonly trackMaterial = this.ownMaterial(new MeshLambertMaterial({ map: this.trackTexture }))
  private readonly finishMaterial = this.ownMaterial(new MeshLambertMaterial({ map: this.ownTexture(createFinishTexture()) }))
  private readonly finishBannerMaterial = this.ownMaterial(new MeshLambertMaterial({ color: look.track.finishBanner }))
  private readonly finishPostMaterial = this.ownMaterial(new MeshLambertMaterial({ color: look.track.finishPost }))
  private readonly treeGeometry = this.ownGeometry(createTreeGeometry())
  private readonly houseGeometry = this.ownGeometry(createHouseGeometry())
  private readonly fenceGeometry = this.ownGeometry(createFenceGeometry())
  private readonly sceneryMaterial = this.ownMaterial(new MeshLambertMaterial({ vertexColors: true }))
  private readonly houseMaterial = this.ownMaterial(createHouseMaterial())
  // The shadow pass shares one depth material among all casters; the houses' instance colours would switch its program back and
  // forth every frame, so they cast with their own.
  private readonly houseDepthMaterial = this.ownMaterial(new MeshDepthMaterial())
  private readonly crateMaterial = this.ownMaterial(createCrateMaterial(this.ownTexture(createCrateTexture())))
  private readonly bigBuffGeometry = this.ownGeometry(createBigBuffGeometry())
  private readonly bigBuffMaterial = this.ownMaterial(new MeshLambertMaterial({ vertexColors: true, emissive: look.bigBuff.emissive }))
  private readonly glowMaterial = this.ownMaterial(
    new MeshBasicMaterial({ map: this.ownTexture(createGlowTexture()), transparent: true, depthWrite: false, blending: AdditiveBlending }),
  )
  private readonly glowGeometry = this.ownGeometry(new PlaneGeometry(look.bigBuff.glowSize, look.bigBuff.glowSize))
  private readonly bigBuffMaterials: Record<BigBuff, MeshBasicMaterial>
  // Stands in the road's place, so the track, the scenery and the gates move with roadZ.
  private readonly levelGroup = new Group()
  private readonly buffLabelGroup = new Group()
  // Reveals stay with the squad, which passes the gate as it is taken, instead of going by with the road.
  private readonly revealGroup = new Group()
  private levelGeometries: BufferGeometry[] = []
  private levelMeshes: InstancedMesh[] = []
  private gatePanelMaterials: MeshBasicMaterial[] = []
  // gatePanels[i] shows the gate in gatePanelLanes[i] of the row gatePanelRows[i], with gatePanelFaces[i][f] for its face f;
  // a mystery gate has the one "?" material.
  private gatePanels: Mesh[] = []
  private gatePanelRows: number[] = []
  private gatePanelLanes: Lane[] = []
  private gatePanelFaces: MeshBasicMaterial[][] = []
  // One label per mystery gate, which rises from the gate panel revealPanels[i] once it is taken, showing the option drawn
  // with revealOptions[i][o] for its option o.
  private revealLabels: Mesh[] = []
  private revealPanels: number[] = []
  private revealOptions: MeshBasicMaterial[][] = []
  // The material each label shows: the option drawn.
  private revealShown: MeshBasicMaterial[] = []
  // Seconds since each label's reveal, or −1 before it.
  private revealAges: number[] = []
  // One label per buff block of the level, shown on the block and then on its big buff.
  private buffLabels: Mesh[] = []
  // Each buff block's HP at the start of the run, so its cracks follow the HP lost.
  private readonly buffBlockStartHp = new Map<BuffBlockState, number>()
  private buffBlockDamage: InstancedBufferAttribute | null = null
  // Sized to the level's barrels, walls and buff blocks, so they are made again for each run.
  private barrels: InstancedMesh | null = null
  private walls: InstancedMesh | null = null
  private buffBlocks: InstancedMesh | null = null
  private bigBuffs: InstancedMesh | null = null
  private bigBuffGlows: InstancedMesh | null = null
  private hpLabels: HpLabels | null = null
  private roadZ = 0
  private cssWidth = 1
  private cssHeight = 1
  private cameraDistance = cameraLook.minDistance
  private lookAhead = 0
  private unitsPerPixel = 0.01
  private seconds = 0
  private catsToScatter = 0
  private readonly scatter = {
    x: new Float32Array(look.scatter.capacity),
    y: new Float32Array(look.scatter.capacity),
    z: new Float32Array(look.scatter.capacity),
    velocityX: new Float32Array(look.scatter.capacity),
    velocityY: new Float32Array(look.scatter.capacity),
    age: new Float32Array(look.scatter.capacity),
    // The formation slot the cat ran in, which sets its fur.
    slot: new Uint8Array(look.scatter.capacity),
    count: 0,
  }

  constructor(canvas: HTMLCanvasElement, quality: GraphicsQuality) {
    const graphics = look.graphics[quality]
    this.maxPixelRatio = graphics.maxPixelRatio
    this.renderer = new WebGLRenderer({ canvas, antialias: true })
    this.renderer.shadowMap.enabled = graphics.shadows
    this.renderer.shadowMap.type = PCFShadowMap
    this.scene.fog = this.fog
    this.scene.background = new Color(look.sky.horizon)
    this.sky = new Mesh(
      this.ownGeometry(createSkyGeometry(cameraLook.far * look.sky.farShare)),
      this.ownMaterial(new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false })),
    )
    this.sky.renderOrder = -1
    this.scene.add(this.sky)
    this.sun = this.addLights(graphics.shadows)
    this.scene.add(this.levelGroup)
    this.scene.add(this.buffLabelGroup, this.revealGroup)

    const catMaterial = this.ownMaterial(new MeshLambertMaterial({ vertexColors: true }))
    const catMesh = (fur: Fur) => this.instanced(this.ownGeometry(createCatGeometry(look.cat.fur[fur])), catMaterial, catCapacity, true)
    this.cats = { orange: catMesh('orange'), grey: catMesh('grey'), black: catMesh('black'), white: catMesh('white'), calico: catMesh('calico') }
    this.catMeshes = Object.values(this.cats)
    const dogMaterial = this.ownMaterial(new MeshLambertMaterial({ vertexColors: true }))
    this.enemies = {
      puppy: this.instanced(this.ownGeometry(createPuppyGeometry()), dogMaterial, tuning.limits.enemies, true),
      chihuahua: this.instanced(this.ownGeometry(createChihuahuaGeometry()), dogMaterial, tuning.limits.enemies, true),
      bulldog: this.instanced(this.ownGeometry(createBulldogGeometry()), dogMaterial, tuning.limits.enemies, true),
      shieldDog: this.instanced(this.ownGeometry(createShieldDogGeometry()), dogMaterial, tuning.limits.enemies, true),
      greyhound: this.instanced(this.ownGeometry(createGreyhoundGeometry()), dogMaterial, tuning.limits.enemies, true),
      dalmatian: this.instanced(this.ownGeometry(createDalmatianGeometry()), dogMaterial, tuning.limits.enemies, true),
    }
    this.enemyMeshes = Object.values(this.enemies)
    this.shields = this.instanced(this.ownGeometry(createShieldGeometry()), dogMaterial, tuning.limits.enemies, true)
    this.yarnBalls = this.instanced(
      this.ownGeometry(createYarnBallGeometry()),
      this.ownMaterial(new MeshLambertMaterial({ vertexColors: true })),
      tuning.yarnBallCap,
      false,
    )
    const bossLightsMaterial = this.ownMaterial(new MeshBasicMaterial({ vertexColors: true }))
    const brushMaterial = this.ownMaterial(new MeshLambertMaterial({ vertexColors: true }))
    this.bosses = {
      dustbot: this.bossModel('dustbot', bossLightsMaterial, brushMaterial),
      megaDustbot: this.bossModel('megaDustbot', bossLightsMaterial, brushMaterial),
    }
    this.dustBalls = this.instanced(
      this.ownGeometry(createDustBallGeometry()),
      this.ownMaterial(new MeshLambertMaterial({ vertexColors: true })),
      tuning.limits.dustBalls,
      true,
    )
    this.scene.add(this.particles.mesh)
    this.bigBuffMaterials = {
      add: createBigBuffMaterial('add'),
      multiply: createBigBuffMaterial('multiply'),
      fireRate: createBigBuffMaterial('fireRate'),
      damage: createBigBuffMaterial('damage'),
      multiShot: createBigBuffMaterial('multiShot'),
      range: createBigBuffMaterial('range'),
    }
    const anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 4)
    this.grassTexture.anisotropy = anisotropy
    this.trackTexture.anisotropy = anisotropy
  }

  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void {
    this.cssWidth = Math.max(cssWidth, 1)
    this.cssHeight = Math.max(cssHeight, 1)
    this.pixelRatio = pixelRatio
    this.renderer.setPixelRatio(Math.min(pixelRatio, this.maxPixelRatio))
    this.renderer.setSize(this.cssWidth, this.cssHeight, false)
    this.camera.aspect = this.cssWidth / this.cssHeight
    this.camera.updateProjectionMatrix()

    const halfHeightTan = Math.tan((this.camera.fov * Math.PI) / 360)
    this.cameraDistance = Math.max(cameraLook.viewHalfWidth / (halfHeightTan * this.camera.aspect), cameraLook.minDistance)
    // The camera looks at a point lookAhead in front of the squad, chosen so the squad shows squadScreenY below the centre.
    const { pitch, squadScreenY } = cameraLook
    const screenDrop = squadScreenY * halfHeightTan
    this.lookAhead = (screenDrop * this.cameraDistance) / (Math.sin(pitch) + screenDrop * Math.cos(pitch))
    const squadDepth = this.cameraDistance - this.lookAhead * Math.cos(pitch)
    this.unitsPerPixel = (2 * squadDepth * halfHeightTan) / this.cssHeight
    // Fog is measured from the camera along its view; a place on the road d ahead of the squad lies this far from it.
    const depthAhead = (ahead: number) => this.cameraDistance + Math.cos(pitch) * (ahead - this.lookAhead)
    this.fog.near = depthAhead(look.fog.nearAhead)
    this.fog.far = depthAhead(look.fog.farAhead)
    this.placeCamera()
  }

  // Turning shadows on or off recompiles the lit materials once, at the next frame.
  setQuality(quality: GraphicsQuality): void {
    const graphics = look.graphics[quality]
    this.maxPixelRatio = graphics.maxPixelRatio
    this.renderer.shadowMap.enabled = graphics.shadows
    this.sun.castShadow = graphics.shadows
    if (!graphics.shadows) this.sun.shadow.dispose()
    this.resize(this.cssWidth, this.cssHeight, this.pixelRatio)
  }

  readFrameStats(out: FrameStats): void {
    const { render, memory } = this.renderer.info
    out.drawCalls = render.calls
    out.triangles = render.triangles
    out.geometries = memory.geometries
    out.textures = memory.textures
    out.catsDrawn = 0
    for (let i = 0; i < this.catMeshes.length; i++) out.catsDrawn += this.catMeshes[i].count
    out.particles = this.particles.mesh.count
  }

  // Track units per CSS pixel at the squad's distance, so a drag moves the squad as far as the finger moved on screen.
  trackUnitsPerPixel(): number {
    return this.unitsPerPixel
  }

  // Builds the track, scenery, lanes and gates of a new run, freeing those of the run before.
  startRun(state: RunState): void {
    this.disposeLevel()
    const length = state.length
    const roadLength = roadBehind + length + roadBeyond
    const roadMiddleZ = (roadBehind - length - roadBeyond) / 2
    const halfWidth = tuning.track.halfWidth

    this.grassTexture.repeat.set(look.ground.width / look.ground.tileSize, roadLength / look.ground.tileSize)
    this.trackTexture.repeat.set((halfWidth * 2) / look.track.tileSize, roadLength / look.track.tileSize)
    this.addLevelPlane(look.ground.width, roadLength, this.grassMaterial, 0, -0.02, roadMiddleZ)
    this.addLevelPlane(halfWidth * 2, roadLength, this.trackMaterial, 0, 0, roadMiddleZ)

    const bossEvent = state.level.events.find((event) => event.type === 'boss')
    // A boss level has no finish line.
    if (bossEvent === undefined) this.addFinishLine(-length)

    // Red and white curbs along both edges.
    const curbsPerEdge = Math.ceil(roadLength / look.track.curbLength)
    const curbs = this.levelInstanced(this.curbGeometry, this.plainMaterial, curbsPerEdge * 2)
    for (let curb = 0; curb < curbsPerEdge; curb++) {
      const z = roadBehind - (curb + 0.5) * look.track.curbLength
      for (const edge of [-1, 1]) {
        const index = curb * 2 + (edge + 1) / 2
        curbs.setMatrixAt(index, matrix.makeTranslation(edge * (halfWidth + look.track.curbWidth / 2), look.track.curbHeight / 2, z))
        curbs.setColorAt(index, curbColours[curb % curbColours.length])
      }
    }
    curbs.receiveShadow = true

    // Two dashed lines between the three lanes, along the whole road.
    const dashesPerLine = Math.ceil(roadLength / look.track.laneDashSpacing)
    const laneDashes = this.levelInstanced(this.laneDashGeometry, this.laneDashMaterial, dashesPerLine * 2)
    for (let dash = 0; dash < dashesPerLine; dash++) {
      const z = roadBehind - dash * look.track.laneDashSpacing
      laneDashes.setMatrixAt(dash * 2, matrix.makeTranslation(-laneBorder, 0.01, z))
      laneDashes.setMatrixAt(dash * 2 + 1, matrix.makeTranslation(laneBorder, 0.01, z))
    }
    laneDashes.receiveShadow = true
    this.placeScenery(roadLength)

    this.barrels = this.instanced(this.barrelGeometry, this.barrelMaterial, state.barrels.length, true)
    this.walls = this.instanced(this.wallGeometry, this.wallMaterial, state.walls.length, true)
    const crateGeometry = new BoxGeometry(2 * laneBorder, look.buffBlock.height, tuning.buffBlock.depth)
    this.buffBlockDamage = new InstancedBufferAttribute(new Float32Array(Math.max(state.buffBlocks.length, 1)), 1)
    crateGeometry.setAttribute('damage', this.buffBlockDamage)
    this.levelGeometries.push(crateGeometry)
    this.buffBlocks = this.instanced(crateGeometry, this.crateMaterial, state.buffBlocks.length, true)
    this.bigBuffs = this.instanced(this.bigBuffGeometry, this.bigBuffMaterial, state.buffBlocks.length, true)
    this.bigBuffGlows = this.instanced(this.glowGeometry, this.glowMaterial, state.buffBlocks.length, false)
    for (const buffBlock of state.buffBlocks) this.buffBlockStartHp.set(buffBlock, buffBlock.hp)
    // A shield dog shows two numbers, its shield's and its body's.
    this.hpLabels = new HpLabels(this.digitMaterial, tuning.limits.enemies * 2 + state.barrels.length + state.buffBlocks.length, facingCamera)
    this.scene.add(this.hpLabels.mesh)
    for (let i = 0; i < state.buffBlocks.length; i++) {
      const label = new Mesh(this.panelGeometry, this.bigBuffMaterials[state.buffBlocks[i].buff])
      label.quaternion.copy(facingCamera)
      label.visible = false
      this.buffLabelGroup.add(label)
      this.buffLabels.push(label)
    }

    for (let rowIndex = 0; rowIndex < state.gateRows.length; rowIndex++) {
      const row = state.gateRows[rowIndex]
      for (const lane of lanes) {
        const gate = row[lane]
        if (gate === null) continue
        const mystery = gate.kind === 'mystery'
        const faces = mystery ? [createMysteryPanelMaterial()] : gate.faces.map(createGatePanelMaterial)
        const panel = new Mesh(this.panelGeometry, faces[0])
        panel.position.set(laneCentreX(lane), look.panel.gateHeight, -row.z)
        this.levelGroup.add(panel)
        this.gatePanelMaterials.push(...faces)
        this.gatePanelFaces.push(faces)
        this.gatePanels.push(panel)
        this.gatePanelRows.push(rowIndex)
        this.gatePanelLanes.push(lane)
        if (!mystery) continue
        const options = gate.faces.map(createGatePanelMaterial)
        this.gatePanelMaterials.push(...options)
        const label = new Mesh(this.panelGeometry, options[0])
        label.quaternion.copy(facingCamera)
        label.scale.setScalar(look.gate.revealScale)
        label.visible = false
        this.revealGroup.add(label)
        this.revealLabels.push(label)
        this.revealPanels.push(this.gatePanels.length - 1)
        this.revealOptions.push(options)
        this.revealShown.push(options[0])
        this.revealAges.push(-1)
      }
    }

    this.catsToScatter = 0
    this.scatter.count = 0
    this.particles.clear()
    this.bossFlashSeconds = 0
    this.bossMaterial.emissive.copy(noEmissive)
    // Walls, barrels, the boss and some enemies first come into view during the run; compiling now keeps that from stalling a frame.
    // Only visible objects are compiled, so the level's boss is shown for it.
    if (bossEvent !== undefined) this.bosses[bossEvent.boss].group.visible = true
    for (const label of this.buffLabels) label.visible = true
    for (const label of this.revealLabels) label.visible = true
    this.levelGroup.position.z = 0
    this.renderer.compile(this.scene, this.camera)
    for (const boss of Object.values(this.bosses)) boss.group.visible = false
    for (const label of this.buffLabels) label.visible = false
    for (const label of this.revealLabels) label.visible = false
  }

  scatterCats(count: number): void {
    this.catsToScatter += count
  }

  flashBoss(): void {
    this.bossFlashSeconds = look.boss.hitFlashSeconds
  }

  // A puff where an enemy died, at its sim place.
  showKill(x: number, z: number): void {
    this.particles.emitKill(x, z)
  }

  // The option a mystery gate drew rises from the gate in the lane of the row at the sim place z, which the squad is passing.
  revealMysteryGate(state: RunState, lane: Lane, z: number, op: GateOp, value: number): void {
    for (let i = 0; i < this.revealLabels.length; i++) {
      const panelIndex = this.revealPanels[i]
      const row = state.gateRows[this.gatePanelRows[panelIndex]]
      const gate = row[lane]
      if (row.z !== z || this.gatePanelLanes[panelIndex] !== lane || gate === null) continue
      let optionIndex = 0
      while (gate.faces[optionIndex].op !== op || gate.faces[optionIndex].value !== value) optionIndex++
      const label = this.revealLabels[i]
      this.revealShown[i] = label.material = this.revealOptions[i][optionIndex]
      label.position.set(laneCentreX(lane) * look.gate.revealLaneShare, look.gate.revealHeight, -look.gate.revealAhead)
      label.visible = true
      this.revealAges[i] = 0
      return
    }
  }

  // A splash where a barrel burst, at its sim place.
  showBarrelSplash(x: number, z: number): void {
    this.particles.emitSplash(x, z)
  }

  // Draws the state between the tick before and the last one, alpha of the way.
  draw(state: RunState, alpha: number, frameSeconds: number): void {
    this.seconds += frameSeconds
    const squad = state.squad
    const squadX = lerp(squad.previousX, squad.x, alpha)
    const squadZ = lerp(squad.previousZ, squad.z, alpha)

    this.roadZ = squadZ
    this.levelGroup.position.z = squadZ
    this.drawCats(state, squadX, squadZ, frameSeconds)
    this.hpLabels?.begin()
    this.drawEnemies(state, alpha)
    this.drawBarrels(state)
    this.drawBuffBlocks(state)
    this.hpLabels?.finish()
    this.drawBigBuffs(state)
    this.drawWalls(state)
    this.drawYarnBalls(state, alpha)
    this.drawBoss(state, alpha, frameSeconds)
    this.drawDustBalls(state, alpha)
    this.drawGates(state)
    this.drawReveals(frameSeconds)
    this.particles.update(frameSeconds, this.roadZ)
    this.renderer.render(this.scene, this.camera)
  }

  // Writes where the squad count label belongs, in CSS pixels from the top left of the canvas.
  squadLabelPoint(state: RunState, alpha: number, out: ScreenPoint): void {
    const squad = state.squad
    position.set(lerp(squad.previousX, squad.x, alpha), 1.1 + formationRadius(squad.count) * 0.4, this.worldZ(lerp(squad.previousZ, squad.z, alpha)))
    position.project(this.camera)
    out.x = ((position.x + 1) / 2) * this.cssWidth
    out.y = ((1 - position.y) / 2) * this.cssHeight
  }

  dispose(): void {
    this.disposeLevel()
    for (const material of Object.values(this.bigBuffMaterials)) disposePanelMaterial(material)
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    for (const texture of this.textures) texture.dispose()
    this.digitMaterial.map?.dispose()
    this.particles.dispose()
    this.sun.dispose()
    this.renderer.dispose()
  }

  private worldZ(z: number): number {
    return this.roadZ - z
  }

  private ownGeometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry)
    return geometry
  }

  private ownMaterial<T extends Material>(material: T): T {
    this.materials.push(material)
    return material
  }

  private ownTexture<T extends Texture>(texture: T): T {
    this.textures.push(texture)
    return texture
  }

  // Returns the sun, whose shadow map is freed with the renderer.
  private addLights(shadows: boolean): DirectionalLight {
    const { hemisphere, key } = look.light
    this.scene.add(new HemisphereLight(hemisphere.sky, hemisphere.ground, hemisphere.intensity))
    const sun = new DirectionalLight(key.colour, key.intensity)
    const target = new Object3D()
    target.position.set(key.target.x, key.target.y, key.target.z)
    sun.target = target
    sun.position.set(key.target.x + key.offset.x, key.target.y + key.offset.y, key.target.z + key.offset.z)
    sun.castShadow = shadows
    sun.shadow.mapSize.set(key.shadowMapSize, key.shadowMapSize)
    sun.shadow.bias = key.shadowBias
    sun.shadow.normalBias = key.shadowNormalBias
    const shadowCamera = sun.shadow.camera
    shadowCamera.left = -key.shadowHalfWidth
    shadowCamera.right = key.shadowHalfWidth
    shadowCamera.top = key.shadowHalfDepth
    shadowCamera.bottom = -key.shadowHalfDepth
    shadowCamera.near = 1
    shadowCamera.far = sun.position.distanceTo(target.position) * 2
    this.scene.add(sun, target)
    return sun
  }

  // Moving objects; their bounding sphere would not follow the instances, so they are never culled.
  private instanced(geometry: BufferGeometry, material: Material, capacity: number, castShadow: boolean): InstancedMesh {
    const mesh = new InstancedMesh(geometry, material, Math.max(capacity, 1))
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.castShadow = castShadow
    this.scene.add(mesh)
    return mesh
  }

  // Objects standing on the road for one run, freed with the level.
  private levelInstanced(geometry: BufferGeometry, material: Material, count: number): InstancedMesh {
    const mesh = new InstancedMesh(geometry, material, Math.max(count, 1))
    mesh.count = count
    this.levelGroup.add(mesh)
    this.levelMeshes.push(mesh)
    return mesh
  }

  private bossModel(kind: BossKind, lightsMaterial: Material, brushMaterial: Material): Boss {
    const group = new Group()
    const body = new Mesh(this.ownGeometry(createBossBodyGeometry(kind)), this.bossMaterial)
    body.castShadow = true
    const brushGeometry = this.ownGeometry(createBossBrushGeometry(kind))
    const brushes: [Mesh, Mesh] = [new Mesh(brushGeometry, brushMaterial), new Mesh(brushGeometry, brushMaterial)]
    const radius = tuning.hitRadius[kind]
    brushes[0].position.set(-bossBrushPlace * radius, 0.03 * radius, bossBrushPlace * radius)
    brushes[1].position.set(bossBrushPlace * radius, 0.03 * radius, bossBrushPlace * radius)
    group.add(body, new Mesh(this.ownGeometry(createBossLightsGeometry(kind)), lightsMaterial), ...brushes)
    group.visible = false
    this.scene.add(group)
    return { group, brushes }
  }

  private addLevelPlane(width: number, length: number, material: Material, x: number, y: number, z: number): void {
    const geometry = new PlaneGeometry(width, length).rotateX(-Math.PI / 2)
    const mesh = new Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.receiveShadow = true
    this.levelGroup.add(mesh)
    this.levelGeometries.push(geometry)
  }

  // A chequered line across the track under a banner on two posts.
  private addFinishLine(z: number): void {
    const { finishBannerHeight: bannerHeight, finishLineDepth, finishBannerThickness, finishBannerDepth, finishPostWidth, finishPostOutside } = look.track
    const halfWidth = tuning.track.halfWidth
    this.addLevelPlane(halfWidth * 2, finishLineDepth, this.finishMaterial, 0, 0.01, z)
    const banner = new BoxGeometry((halfWidth + finishPostOutside) * 2, finishBannerThickness, finishBannerDepth)
    const post = new BoxGeometry(finishPostWidth, bannerHeight, finishPostWidth)
    this.levelGeometries.push(banner, post)
    const bannerMesh = new Mesh(banner, this.finishBannerMaterial)
    bannerMesh.position.set(0, bannerHeight, z)
    this.levelGroup.add(bannerMesh)
    for (const edge of [-1, 1]) {
      const postMesh = new Mesh(post, this.finishPostMaterial)
      postMesh.position.set(edge * (halfWidth + finishPostOutside), bannerHeight / 2, z)
      postMesh.castShadow = true
      this.levelGroup.add(postMesh)
    }
  }

  // Fences, trees and houses repeating along both sides of the road.
  private placeScenery(roadLength: number): void {
    const { fence, tree, house } = look.scenery
    const halfWidth = tuning.track.halfWidth
    const fencesPerSide = Math.ceil(roadLength / fence.segmentLength)
    const fences = this.levelInstanced(this.fenceGeometry, this.sceneryMaterial, fencesPerSide * 2)
    for (let segment = 0; segment < fencesPerSide; segment++) {
      for (const side of [-1, 1]) {
        const x = side * (halfWidth + look.track.curbWidth + fence.offset)
        fences.setMatrixAt(segment * 2 + (side + 1) / 2, matrix.makeTranslation(x, 0, roadBehind - segment * fence.segmentLength))
      }
    }

    const treesPerSide = Math.ceil(roadLength / tree.spacing)
    const trees = this.levelInstanced(this.treeGeometry, this.sceneryMaterial, treesPerSide * 2)
    for (let i = 0; i < treesPerSide; i++) {
      for (const side of [-1, 1]) {
        const x = side * (halfWidth + tree.offset + Math.random() * tree.spread)
        // The two sides are offset by half a spacing, so the trees do not stand in pairs.
        const z = roadBehind - (i + (side + 1) / 4 + randomBetween(-0.2, 0.2)) * tree.spacing
        rotation.setFromAxisAngle(yAxis, Math.random() * Math.PI * 2)
        scale.setScalar(randomBetween(tree.minScale, tree.maxScale))
        trees.setMatrixAt(i * 2 + (side + 1) / 2, matrix.compose(position.set(x, 0, z), rotation, scale))
      }
    }
    trees.castShadow = true

    const housesPerSide = Math.ceil(roadLength / house.spacing)
    const houses = this.levelInstanced(this.houseGeometry, this.houseMaterial, housesPerSide * 2)
    scale.setScalar(1)
    for (let i = 0; i < housesPerSide; i++) {
      for (const side of [-1, 1]) {
        const index = i * 2 + (side + 1) / 2
        const x = side * (halfWidth + house.offset + Math.random() * house.spread)
        const z = roadBehind - (i + (side + 1) / 4) * house.spacing
        // Doors face the road.
        rotation.setFromAxisAngle(yAxis, -side * (Math.PI / 2))
        houses.setMatrixAt(index, matrix.compose(position.set(x, 0, z), rotation, scale))
        houses.setColorAt(index, houseColours[index % houseColours.length])
      }
    }
    houses.castShadow = true
    houses.customDepthMaterial = this.houseDepthMaterial
  }

  private disposeLevel(): void {
    this.levelGroup.clear()
    for (const geometry of this.levelGeometries) geometry.dispose()
    for (const mesh of this.levelMeshes) mesh.dispose()
    for (const material of this.gatePanelMaterials) disposePanelMaterial(material)
    this.buffLabelGroup.clear()
    this.revealGroup.clear()
    for (const mesh of [this.barrels, this.walls, this.buffBlocks, this.bigBuffs, this.bigBuffGlows]) {
      if (mesh === null) continue
      this.scene.remove(mesh)
      mesh.dispose()
    }
    if (this.hpLabels !== null) {
      this.scene.remove(this.hpLabels.mesh)
      this.hpLabels.dispose()
    }
    this.barrels = this.walls = this.buffBlocks = this.bigBuffs = this.bigBuffGlows = this.hpLabels = null
    this.buffBlockDamage = null
    this.levelGeometries = []
    this.levelMeshes = []
    this.gatePanelMaterials = []
    this.gatePanels = []
    this.gatePanelRows = []
    this.gatePanelLanes = []
    this.gatePanelFaces = []
    this.revealLabels = []
    this.revealPanels = []
    this.revealOptions = []
    this.revealShown = []
    this.revealAges = []
    this.buffLabels = []
    this.buffBlockStartHp.clear()
  }

  // The camera stands still and frames the squad at the origin and the road ahead of it.
  private placeCamera(): void {
    const lookZ = -this.lookAhead
    viewDirection.set(0, -Math.sin(cameraLook.pitch), -Math.cos(cameraLook.pitch))
    this.camera.position.set(0, -viewDirection.y * this.cameraDistance, lookZ - viewDirection.z * this.cameraDistance)
    position.set(0, 0, lookZ)
    this.camera.lookAt(position)
    this.sky.position.copy(this.camera.position)
  }

  // Cats keep their places in the squad, so they move with its interpolated position.
  private drawCats(state: RunState, squadX: number, squadZ: number, frameSeconds: number): void {
    const { bobHeight, bobSpeed, bobLean, furOrder } = look.cat
    const catMeshes = this.catMeshes
    for (let i = 0; i < catMeshes.length; i++) catMeshes[i].count = 0
    const cats = state.cats
    const shiftX = squadX - state.squad.x
    const shiftZ = squadZ - state.squad.z
    for (let slot = 0; slot < cats.length; slot++) {
      const bob = Math.abs(Math.sin(this.seconds * bobSpeed + slot * 1.7))
      // Leaning forward, towards −z, at the top of the bob.
      matrix.makeRotationX(-bob * bobLean)
      matrix.setPosition(position.set(cats[slot].x + shiftX, bob * bobHeight, this.worldZ(cats[slot].z + shiftZ)))
      const mesh = this.cats[furOrder[slot % furOrder.length]]
      mesh.setMatrixAt(mesh.count++, matrix)
    }
    this.drawLostCats(state, squadX, squadZ, frameSeconds)
    for (let i = 0; i < catMeshes.length; i++) catMeshes[i].instanceMatrix.needsUpdate = true
  }

  // Lost cats jump sideways off the track and tumble until their scatter lifetime is over.
  private drawLostCats(state: RunState, squadX: number, squadZ: number, frameSeconds: number): void {
    const { sideSpeeds, riseSpeeds, tumbleSpeed } = look.scatter
    const furOrder = look.cat.furOrder
    const scatter = this.scatter
    const lost = this.catsToScatter
    this.catsToScatter = 0
    for (let i = 0; i < lost && scatter.count < look.scatter.capacity; i++) {
      const slot = (state.squad.count + i) % tuning.squad.formationSlots
      const index = scatter.count++
      const side = formationOffsetX[slot] < 0 || (formationOffsetX[slot] === 0 && i % 2 === 0) ? -1 : 1
      scatter.x[index] = squadX + formationOffsetX[slot]
      scatter.y[index] = 0
      scatter.z[index] = squadZ + formationOffsetZ[slot]
      scatter.velocityX[index] = side * sideSpeeds[i % sideSpeeds.length]
      scatter.velocityY[index] = riseSpeeds[i % riseSpeeds.length]
      scatter.age[index] = 0
      scatter.slot[index] = slot
    }

    for (let i = scatter.count - 1; i >= 0; i--) {
      scatter.age[i] += frameSeconds
      if (scatter.age[i] >= look.scatter.lifetime) {
        const last = --scatter.count
        scatter.x[i] = scatter.x[last]
        scatter.y[i] = scatter.y[last]
        scatter.z[i] = scatter.z[last]
        scatter.velocityX[i] = scatter.velocityX[last]
        scatter.velocityY[i] = scatter.velocityY[last]
        scatter.age[i] = scatter.age[last]
        scatter.slot[i] = scatter.slot[last]
        continue
      }
      scatter.x[i] += scatter.velocityX[i] * frameSeconds
      scatter.velocityY[i] -= look.scatter.gravity * frameSeconds
      scatter.y[i] = Math.max(scatter.y[i] + scatter.velocityY[i] * frameSeconds, 0)
    }
    for (let i = 0; i < scatter.count; i++) {
      // Tumbling the way it jumps.
      matrix.makeRotationZ(-Math.sign(scatter.velocityX[i]) * scatter.age[i] * tumbleSpeed)
      matrix.setPosition(position.set(scatter.x[i], scatter.y[i], this.worldZ(scatter.z[i])))
      const mesh = this.cats[furOrder[scatter.slot[i] % furOrder.length]]
      mesh.setMatrixAt(mesh.count++, matrix)
    }
  }

  private drawEnemies(state: RunState, alpha: number): void {
    const { waddleAngle, waddleSpeed, waddleBob } = look.dogs
    const enemies = state.enemies
    const enemyMeshes = this.enemyMeshes
    for (let i = 0; i < enemyMeshes.length; i++) enemyMeshes[i].count = 0
    this.shields.count = 0
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i]
      const x = lerp(enemy.previousX, enemy.x, alpha)
      const z = this.worldZ(lerp(enemy.previousZ, enemy.z, alpha))
      const mesh = this.enemies[enemy.kind]
      const waddle = Math.sin(this.seconds * waddleSpeed + i * 1.3)
      const bob = Math.abs(waddle) * waddleBob
      matrix.makeRotationZ(waddle * waddleAngle)
      matrix.setPosition(position.set(x, bob, z))
      mesh.setMatrixAt(mesh.count++, matrix)
      const labelY = hpLabelHeight[enemy.kind]
      this.hpLabels?.add(shownHp(enemy.hp), labelPlace.set(x, labelY, z), bodyHpColour)
      if (enemy.shield > 0) {
        matrix.setPosition(position.set(x, look.shield.height + bob, z + look.shield.ahead))
        this.shields.setMatrixAt(this.shields.count++, matrix)
        this.hpLabels?.add(shownHp(enemy.shield), labelPlace.set(x, labelY + look.hpLabel.shieldRise, z), shieldHpColour)
      }
    }
    for (let i = 0; i < enemyMeshes.length; i++) enemyMeshes[i].instanceMatrix.needsUpdate = true
    this.shields.instanceMatrix.needsUpdate = true
  }

  private drawBarrels(state: RunState): void {
    if (this.barrels === null) return
    const barrels = state.barrels
    for (let i = 0; i < barrels.length; i++) {
      const z = this.worldZ(barrels[i].z)
      matrix.makeTranslation(position.set(barrels[i].x, 0, z))
      this.barrels.setMatrixAt(i, matrix)
      this.hpLabels?.add(shownHp(barrels[i].hp), labelPlace.set(barrels[i].x, hpLabelHeight.barrel, z), barrelHpColour)
    }
    this.barrels.count = barrels.length
    this.barrels.instanceMatrix.needsUpdate = true
  }

  private drawWalls(state: RunState): void {
    if (this.walls === null) return
    const walls = state.walls
    const height = look.wall.height
    for (let i = 0; i < walls.length; i++) {
      const wall = walls[i]
      matrix.makeScale(wall.width, height, tuning.wall.depth)
      matrix.setPosition(position.set(wall.x, height / 2, this.worldZ(wall.z + tuning.wall.depth / 2)))
      this.walls.setMatrixAt(i, matrix)
    }
    this.walls.count = walls.length
    this.walls.instanceMatrix.needsUpdate = true
  }

  // Rolling forward as they fly.
  private drawYarnBalls(state: RunState, alpha: number): void {
    const { height, spinSpeed } = look.yarnBall
    const yarnBalls = state.yarnBalls
    for (let i = 0; i < yarnBalls.length; i++) {
      const yarnBall = yarnBalls[i]
      matrix.makeRotationX(-(this.seconds * spinSpeed + i))
      matrix.setPosition(position.set(lerp(yarnBall.previousX, yarnBall.x, alpha), height, this.worldZ(lerp(yarnBall.previousZ, yarnBall.z, alpha))))
      this.yarnBalls.setMatrixAt(i, matrix)
    }
    this.yarnBalls.count = yarnBalls.length
    this.yarnBalls.instanceMatrix.needsUpdate = true
  }

  private drawBoss(state: RunState, alpha: number, frameSeconds: number): void {
    const boss = state.boss
    for (let i = 0; i < bossKinds.length; i++) this.bosses[bossKinds[i]].group.visible = boss !== null && boss.kind === bossKinds[i]
    if (boss === null) return
    const model = this.bosses[boss.kind]
    model.group.position.set(lerp(boss.previousX, boss.x, alpha), 0, this.worldZ(lerp(boss.previousZ, boss.z, alpha)))
    // The model faces +z; turn it towards the squad.
    model.group.rotation.y = Math.atan2(state.squad.x - boss.x, boss.z - state.squad.z)
    // The two side brushes sweep inwards, turning opposite ways.
    const brushTurn = look.boss.brushSpinSpeed * frameSeconds
    model.brushes[0].rotation.y -= brushTurn
    model.brushes[1].rotation.y += brushTurn
    this.bossFlashSeconds = Math.max(this.bossFlashSeconds - frameSeconds, 0)
    this.bossMaterial.emissive.copy(this.bossFlashSeconds > 0 ? bossHitColour : noEmissive)
  }

  private drawDustBalls(state: RunState, alpha: number): void {
    const { height, spinSpeed } = look.dustBall
    const dustBalls = state.dustBalls
    for (let i = 0; i < dustBalls.length; i++) {
      const dustBall = dustBalls[i]
      matrix.makeRotationX(this.seconds * spinSpeed + i)
      matrix.setPosition(position.set(lerp(dustBall.previousX, dustBall.x, alpha), height, this.worldZ(lerp(dustBall.previousZ, dustBall.z, alpha))))
      this.dustBalls.setMatrixAt(i, matrix)
    }
    this.dustBalls.count = dustBalls.length
    this.dustBalls.instanceMatrix.needsUpdate = true
  }

  private drawBuffBlocks(state: RunState): void {
    if (this.buffBlocks === null || this.buffBlockDamage === null) return
    const { height, damageStages } = look.buffBlock
    const buffBlocks = state.buffBlocks
    for (let i = 0; i < buffBlocks.length; i++) {
      const buffBlock = buffBlocks[i]
      const x = laneCentreX(buffBlock.lane)
      const frontZ = this.worldZ(buffBlock.z)
      matrix.makeTranslation(position.set(x, height / 2, frontZ - tuning.buffBlock.depth / 2))
      this.buffBlocks.setMatrixAt(i, matrix)
      const startHp = this.buffBlockStartHp.get(buffBlock)
      if (startHp === undefined) throw new Error('A buff block of the run was not there at its start')
      const lost = 1 - buffBlock.hp / startHp
      this.buffBlockDamage.setX(i, Math.min(Math.floor(lost * damageStages), damageStages - 1))
      this.hpLabels?.add(shownHp(buffBlock.hp), labelPlace.set(x, height / 2, frontZ + 0.3), buffBlockHpColour, look.hpLabel.buffBlockSize)
      this.showBuffLabel(i, buffBlock.buff, x, height + look.bigBuff.labelGapOverBlock + panelHeight / 2, frontZ)
    }
    this.buffBlocks.count = buffBlocks.length
    this.buffBlocks.instanceMatrix.needsUpdate = true
    this.buffBlockDamage.needsUpdate = true
  }

  // Swinging, bobbing gold tokens in a pulsing glow. Labels after the blocks' go to the uncovered big buffs, and the rest are hidden.
  private drawBigBuffs(state: RunState): void {
    if (this.bigBuffs === null || this.bigBuffGlows === null) return
    const { height, bobHeight, bobPerPulse, swingAngle, swingSpeed, pulseSpeed, glowPulse, glowBehind, labelGapOverCoin } = look.bigBuff
    const bigBuffs = state.bigBuffs
    const firstLabel = state.buffBlocks.length
    const y = height + Math.sin(this.seconds * pulseSpeed * bobPerPulse) * bobHeight
    scale.setScalar(1 + Math.sin(this.seconds * pulseSpeed) * glowPulse)
    for (let i = 0; i < bigBuffs.length; i++) {
      const bigBuff = bigBuffs[i]
      const x = laneCentreX(bigBuff.lane)
      const z = this.worldZ(bigBuff.z)
      matrix.makeRotationY(Math.sin(this.seconds * swingSpeed) * swingAngle)
      matrix.setPosition(position.set(x, y, z))
      this.bigBuffs.setMatrixAt(i, matrix)
      this.bigBuffGlows.setMatrixAt(i, matrix.compose(position.set(x, y, z - glowBehind), facingCamera, scale))
      this.showBuffLabel(firstLabel + i, bigBuff.buff, x, height + labelGapOverCoin + panelHeight / 2, z)
    }
    this.bigBuffs.count = bigBuffs.length
    this.bigBuffGlows.count = bigBuffs.length
    this.bigBuffs.instanceMatrix.needsUpdate = true
    this.bigBuffGlows.instanceMatrix.needsUpdate = true
    for (let i = firstLabel + bigBuffs.length; i < this.buffLabels.length; i++) this.buffLabels[i].visible = false
  }

  private showBuffLabel(index: number, buff: BigBuff, x: number, y: number, z: number): void {
    const label = this.buffLabels[index]
    label.material = this.bigBuffMaterials[buff]
    label.position.set(x, y, z)
    label.visible = true
  }

  // A row's other gates disappear once the squad takes one of them. A switching gate shows the panel of the face it shows.
  private drawGates(state: RunState): void {
    const rows = state.gateRows
    for (let i = 0; i < this.gatePanels.length; i++) {
      const row = rows[this.gatePanelRows[i]]
      const lane = this.gatePanelLanes[i]
      const panel = this.gatePanels[i]
      panel.visible = row.taken === null || row.taken === lane
      const gate = row[lane]
      if (gate === null || gate.kind !== 'switching') continue
      const ownFace = gate.faces[0]
      panel.material = this.gatePanelFaces[i][gate.op === ownFace.op && gate.value === ownFace.value ? 0 : 1]
    }
  }

  // A revealed option rises from its gate and fades out.
  private drawReveals(frameSeconds: number): void {
    const { revealSeconds, revealRise } = look.gate
    for (let i = 0; i < this.revealLabels.length; i++) {
      if (this.revealAges[i] < 0) continue
      const label = this.revealLabels[i]
      const age = (this.revealAges[i] += frameSeconds)
      if (age >= revealSeconds) {
        label.visible = false
        this.revealAges[i] = -1
        continue
      }
      const share = age / revealSeconds
      label.position.y = look.gate.revealHeight + share * revealRise
      this.revealShown[i].opacity = 1 - share * share
    }
  }
}
