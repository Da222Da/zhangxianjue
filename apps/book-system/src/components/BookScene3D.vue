<template>
  <div class="book-scene3d" :class="'theme-' + sceneId">
    <div ref="containerRef" class="canvas-wrap"></div>
    <div class="click-fx" v-if="fxVisible" :style="fxStyle">
      <span class="fx-ring"></span>
      <span class="fx-label">{{ fxLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = defineProps({
  stats: { type: Object, default: () => ({}) },
  selectedId: { type: [String, Number], default: null }
})
const emit = defineEmits(['select', 'ready', 'effect'])

const activeScene = inject('activeScene', ref('bookshelf'))
const sceneId = computed(() => activeScene?.value || 'bookshelf')
const containerRef = ref(null)
const fxVisible = ref(false)
const fxLabel = ref('')
const fxStyle = ref({})

let scene, camera, renderer, controls, animationId, clock
let modelGroup = null
let envGroup = null
let particleSystem = null
let raycaster, mouse
let clickable = []
let selectedMesh = null
let autoRotateTimer = null
let rebuildTimer = null
let resizeObserver = null
let focusTarget = null
let focusProgress = 0
let pulseMeshes = []
let fxTimer = null
const disposedMats = new WeakSet()

const SCENE_FX = {
  bookshelf: { label: '书架点亮', color: '#c9a227', cam: [0, 6, 16] },
  bookstack: { label: '塔芯共鸣', color: '#e8a838', cam: [4, 8, 14] },
  galaxy: { label: '星轨聚焦', color: '#4fc3f7', cam: [0, 4, 20] },
  network: { label: '兴趣共振', color: '#48c9b0', cam: [2, 5, 18] }
}

function seeded(i, salt = 0) {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function coverPalette(i) {
  // Rich book-cover inspired colors
  const colors = [
    0x8b1e3f, 0x1a5276, 0x1e8449, 0x6c3483, 0xb9770e,
    0x1c2833, 0x922b21, 0x0e6655, 0x5d6d7e, 0x7d3c98,
    0xc0392b, 0x2471a3, 0x196f3d, 0x9a7d0a, 0x4a235a
  ]
  return colors[i % colors.length]
}

function disposeObject(obj) {
  if (obj.geometry) obj.geometry.dispose()
  if (obj.material) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    mats.forEach((m) => {
      if (m && !disposedMats.has(m)) {
        disposedMats.add(m)
        m.dispose?.()
      }
    })
  }
}

function getSize() {
  const el = containerRef.value
  if (!el) return { w: 800, h: 600 }
  return {
    w: Math.max(el.clientWidth || 800, 100),
    h: Math.max(el.clientHeight || 600, 100)
  }
}

/** Realistic hardcover book with spine / pages / cover */
function createBook(w, h, d, coverColor, options = {}) {
  const group = new THREE.Group()
  const pageColor = 0xf5ecd7
  const spineColor = options.spineColor ?? new THREE.Color(coverColor).offsetHSL(0, 0, -0.08).getHex()

  // pages block
  const pages = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.92, h * 0.96, d * 0.88),
    new THREE.MeshStandardMaterial({ color: pageColor, roughness: 0.9, metalness: 0.02 })
  )
  pages.position.z = d * 0.02
  group.add(pages)

  // front cover
  const coverMat = new THREE.MeshStandardMaterial({
    color: coverColor,
    roughness: 0.55,
    metalness: 0.18
  })
  const front = new THREE.Mesh(new THREE.BoxGeometry(w, h, d * 0.06), coverMat)
  front.position.z = d * 0.47
  group.add(front)

  // back cover
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, d * 0.06), coverMat.clone())
  back.position.z = -d * 0.47
  group.add(back)

  // spine
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.08, h, d),
    new THREE.MeshStandardMaterial({ color: spineColor, roughness: 0.5, metalness: 0.25 })
  )
  spine.position.x = -w * 0.46
  group.add(spine)

  // gold foil line on spine
  const foil = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.02, h * 0.35, d * 0.92),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25, emissive: 0x3a2a00, emissiveIntensity: 0.15 })
  )
  foil.position.set(-w * 0.42, h * 0.1, 0)
  group.add(foil)

  // title plate on cover
  if (options.showPlate !== false) {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.55, h * 0.12),
      new THREE.MeshStandardMaterial({
        color: 0xe8d48b,
        metalness: 0.6,
        roughness: 0.3,
        emissive: 0x332200,
        emissiveIntensity: 0.1
      })
    )
    plate.position.set(0, h * 0.15, d * 0.505)
    group.add(plate)
  }

  group.userData.isBookRoot = true
  return group
}

function makeSelectable(obj, payload) {
  // Prefer picking the root group; also mark children so raycast hits work
  obj.userData = { ...payload, selectable: true, _baseScale: 1 }
  obj.traverse((c) => {
    if (c.isMesh) {
      c.userData = { ...c.userData, rootSelectable: obj, selectable: true }
    }
  })
  clickable.push(obj)
  return obj
}

function relatedBooks(category, n = 3) {
  const list = (props.stats?.topBooks || []).filter((b) => !category || b.category === category)
  const pool = list.length ? list : props.stats?.topBooks || []
  return pool.slice(0, n).map((b) => ({
    title: b.title,
    score: b.recommend_score
  }))
}

function clearModel() {
  selectedMesh = null
  pulseMeshes = []
  focusTarget = null
  if (modelGroup && scene) {
    scene.remove(modelGroup)
    modelGroup.traverse(disposeObject)
    modelGroup = null
  }
  if (envGroup && scene) {
    scene.remove(envGroup)
    envGroup.traverse(disposeObject)
    envGroup = null
  }
  if (particleSystem && scene) {
    scene.remove(particleSystem)
    disposeObject(particleSystem)
    particleSystem = null
  }
  clickable = []
}

function addFloor(color = 0x0d2137, radius = 10) {
  envGroup = new THREE.Group()
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0.2,
      transparent: true,
      opacity: 0.55
    })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -3.4
  envGroup.add(floor)

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.72, radius * 0.78, 64),
    new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = -3.35
  envGroup.add(ring)
  scene.add(envGroup)
}

function addParticles(count, color, spread = 16) {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (seeded(i, 1) - 0.5) * spread
    pos[i * 3 + 1] = seeded(i, 2) * spread * 0.6 - 2
    pos[i * 3 + 2] = (seeded(i, 3) - 0.5) * spread
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  particleSystem = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color,
      size: 0.06,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    })
  )
  scene.add(particleSystem)
}

/* ===================== SCENE: BOOKSHELF ===================== */
function buildBookshelf() {
  modelGroup = new THREE.Group()
  addFloor(0x1a1208, 11)
  addParticles(80, 0xc9a227, 14)

  const wood = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.55, metalness: 0.12 })
  const woodLight = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.5, metalness: 0.1 })
  const cats = props.stats?.categories?.length
    ? props.stats.categories.slice(0, 4)
    : [
        { name: '文学', count: 8 },
        { name: '科技', count: 7 },
        { name: '历史', count: 5 },
        { name: '计算机', count: 10 }
      ]
  const topBooks = props.stats?.topBooks || []

  // cabinet sides & back
  const back = new THREE.Mesh(new THREE.BoxGeometry(12.6, 9.2, 0.25), wood)
  back.position.set(0, 4.2, -1.35)
  modelGroup.add(back)
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 9.2, 2.8), wood)
  sideL.position.set(-6.3, 4.2, 0)
  const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 9.2, 2.8), wood)
  sideR.position.set(6.3, 4.2, 0)
  modelGroup.add(sideL, sideR)
  const topBoard = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.3, 2.8), woodLight)
  topBoard.position.set(0, 8.7, 0)
  modelGroup.add(topBoard)

  for (let row = 0; row < 4; row++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.22, 2.5), woodLight)
    shelf.position.set(0, row * 2.15 + 0.1, 0)
    modelGroup.add(shelf)

    // category plaque
    const plaque = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.35, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.7, roughness: 0.3, emissive: 0x3a2a00, emissiveIntensity: 0.2 })
    )
    plaque.position.set(-5.2, row * 2.15 + 1.55, 1.15)
    const cat = cats[row % cats.length]
    makeSelectable(plaque, {
      id: `plaque-${row}`,
      title: `${cat.name} 分类层`,
      type: '分类铭牌',
      scene: 'bookshelf',
      effect: 'shelf-glow',
      data: {
        分类: cat.name,
        藏书量: cat.count,
        层架: `第 ${row + 1} 层`,
        均推荐分: (70 + seeded(row, 5) * 20).toFixed(1),
        借阅热度: `${Math.round(40 + seeded(row, 6) * 55)}%`
      },
      extra: relatedBooks(cat.name, 4),
      insight: `${cat.name}类图书在本层陈列，点击书脊可查看单册推荐数据。`
    })
    modelGroup.add(plaque)

    const bookCount = Math.min(Math.max(Number(cat.count) || 6, 5), 9)
    for (let i = 0; i < bookCount; i++) {
      const bh = 1.15 + seeded(row * 10 + i, 1) * 0.55
      const bw = 0.32 + seeded(row * 10 + i, 2) * 0.2
      const bd = 1.55 + seeded(row * 10 + i, 3) * 0.35
      const real = topBooks[(row * 9 + i) % Math.max(topBooks.length, 1)]
      const book = createBook(bw, bh, bd, coverPalette(row * 9 + i))
      // stand upright on shelf
      book.rotation.y = 0
      book.position.set(-4.6 + i * 1.15, row * 2.15 + 0.22 + bh / 2, 0.15)
      const title = real?.title || `${cat.name}精选 ${i + 1}`
      makeSelectable(book, {
        id: `book-${row}-${i}`,
        title: `《${title}》`,
        type: '架上图书',
        scene: 'bookshelf',
        effect: 'book-pull',
        data: {
          分类: cat.name,
          作者: real?.author || '馆藏作者',
          评分: real?.rating ?? (3.6 + seeded(i, 4) * 1.3).toFixed(1),
          推荐分: real?.recommend_score ?? (62 + seeded(i, 5) * 30).toFixed(1),
          层架位置: `${row + 1}-${i + 1}`,
          装帧: '精装硬皮'
        },
        extra: relatedBooks(cat.name),
        insight: '本书位于智慧书架，推荐引擎依据协同过滤给出排序分。'
      })
      modelGroup.add(book)
    }
  }

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 7.8, 0.35, 48),
    new THREE.MeshStandardMaterial({ color: 0x2c1810, metalness: 0.35, roughness: 0.45 })
  )
  base.position.y = -0.4
  makeSelectable(base, {
    id: 'shelf-base',
    title: '智慧书架 · 全局',
    type: '场景总览',
    scene: 'bookshelf',
    effect: 'shelf-glow',
    data: {
      总图书: props.stats?.totalBooks || 0,
      用户数: props.stats?.totalUsers || 0,
      平均评分: props.stats?.avgRating || 0,
      分类层数: 4,
      场景主题: '馆藏陈列'
    },
    extra: relatedBooks(null, 4),
    insight: '书架场景强调分类陈列与单册可点选，适合浏览馆藏结构。'
  })
  modelGroup.add(base)
  modelGroup.position.y = -3
  scene.add(modelGroup)
}

/* ===================== SCENE: BOOKSTACK (Knowledge Tower) ===================== */
function buildBookstack() {
  modelGroup = new THREE.Group()
  addFloor(0x1a140a, 10)
  addParticles(120, 0xe8a838, 12)

  const total = props.stats?.totalBooks || 50
  const layers = Math.min(Math.max(Math.ceil(total / 5), 8), 14)
  const models = props.stats?.modelStats || []

  for (let i = 0; i < layers; i++) {
    const count = 4 + (i % 3)
    const y = i * 0.42
    for (let j = 0; j < count; j++) {
      const angle = (j / count) * Math.PI * 2 + i * 0.35
      const radius = 1.35 + (i % 4) * 0.22
      const book = createBook(1.5, 0.32, 1.05, coverPalette(i * 5 + j), { showPlate: false })
      book.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
      book.rotation.set(0, angle + Math.PI / 2, 0.04)
      makeSelectable(book, {
        id: `tower-${i}-${j}`,
        title: `知识层 L${i + 1}`,
        type: '塔层书册',
        scene: 'bookstack',
        effect: 'tower-pulse',
        data: {
          层级: `${i + 1} / ${layers}`,
          本层册数: count,
          知识密度: (0.55 + seeded(i, 1) * 0.4).toFixed(2),
          累计高度: `${(y + 0.5).toFixed(1)}m`,
          对应模型: models[i % Math.max(models.length, 1)]?.model_type || 'NCF'
        },
        extra: relatedBooks(null),
        insight: '知识之塔以螺旋层叠表现知识积累，层越高代表抽象表征越深。'
      })
      modelGroup.add(book)
    }

    // glowing ring per few layers
    if (i % 3 === 0) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.8 + (i % 4) * 0.15, 0.03, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0xe8a838, transparent: true, opacity: 0.35 })
      )
      halo.rotation.x = Math.PI / 2
      halo.position.y = y
      modelGroup.add(halo)
      pulseMeshes.push(halo)
    }
  }

  // core crystal
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xc9a227,
      emissiveIntensity: 0.65,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.92
    })
  )
  core.position.y = layers * 0.42 + 0.9
  makeSelectable(core, {
    id: 'tower-core',
    title: '推荐塔芯',
    type: '引擎核心',
    scene: 'bookstack',
    effect: 'tower-pulse',
    data: {
      总图书: props.stats?.totalBooks || 0,
      评分记录: props.stats?.totalRatings || 0,
      平均评分: props.stats?.avgRating || 0,
      塔层数: layers,
      能量状态: '稳态运行'
    },
    extra: models.slice(0, 4).map((m) => ({
      title: m.model_type,
      score: Number(m.avg_score || 0).toFixed(3)
    })),
    insight: '塔芯汇聚多模型打分，点击可查看各深度学习模型贡献。'
  })
  modelGroup.add(core)
  pulseMeshes.push(core)

  // vertical light beam
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.2, layers * 0.42 + 1.5, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  )
  beam.position.y = (layers * 0.42) / 2
  modelGroup.add(beam)

  modelGroup.position.y = -2.8
  scene.add(modelGroup)
}

/* ===================== SCENE: GALAXY ===================== */
function buildGalaxy() {
  modelGroup = new THREE.Group()
  addFloor(0x060d1a, 12)
  addParticles(220, 0x4fc3f7, 22)

  const topBooks = props.stats?.topBooks?.length
    ? props.stats.topBooks
    : Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        title: `星图图书${i + 1}`,
        recommend_score: 70 + i * 2,
        rating: 4,
        category: ['文学', '科技', '计算机', '历史'][i % 4],
        author: '推荐官'
      }))

  // orbital rings
  for (let r = 0; r < 3; r++) {
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(3.8 + r * 1.4, 0.015, 8, 100),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.18 - r * 0.04 })
    )
    orbit.rotation.x = Math.PI / 2.2 + r * 0.08
    modelGroup.add(orbit)
    pulseMeshes.push(orbit)
  }

  topBooks.forEach((book, i) => {
    const angle = (i / topBooks.length) * Math.PI * 2
    const radius = 3.8 + (i % 3) * 1.35
    const size = 0.28 + (book.recommend_score || 70) / 220
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(size, 24, 24),
      new THREE.MeshStandardMaterial({
        color: coverPalette(i),
        emissive: coverPalette(i),
        emissiveIntensity: 0.35,
        metalness: 0.35,
        roughness: 0.35
      })
    )
    planet.position.set(Math.cos(angle) * radius, (seeded(i, 1) - 0.5) * 2.2, Math.sin(angle) * radius)

    // atmosphere glow
    const atm = new THREE.Mesh(
      new THREE.SphereGeometry(size * 1.25, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.12 })
    )
    planet.add(atm)

    makeSelectable(planet, {
      id: `star-${book.id || i}`,
      title: `《${book.title}》`,
      type: '推荐星球',
      scene: 'galaxy',
      effect: 'galaxy-focus',
      data: {
        作者: book.author || '未知',
        分类: book.category || '-',
        推荐分: book.recommend_score,
        评分: book.rating,
        轨道: `R${(i % 3) + 1}`,
        星等: (size * 10).toFixed(1)
      },
      extra: relatedBooks(book.category),
      insight: '星球大小映射推荐分，轨道表示兴趣簇；连线指向引擎核心。'
    })
    modelGroup.add(planet)

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(angle) * radius * 0.45, (seeded(i, 2) - 0.5) * 0.8, Math.sin(angle) * radius * 0.45),
      planet.position.clone()
    ])
    modelGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, 0.018, 6, false),
        new THREE.MeshBasicMaterial({ color: 0x7ec8e3, transparent: true, opacity: 0.35 })
      )
    )
  })

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.15, 1),
    new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      emissive: 0x1a6a8a,
      emissiveIntensity: 0.55,
      metalness: 0.6,
      roughness: 0.25,
      wireframe: true
    })
  )
  makeSelectable(core, {
    id: 'galaxy-core',
    title: '星图引擎核心',
    type: '深度学习核',
    scene: 'galaxy',
    effect: 'galaxy-focus',
    data: {
      模型: 'Transformer + DIN',
      评分记录: props.stats?.totalRatings || 0,
      Top星体: topBooks.length,
      轨道层: 3,
      状态: '引力稳态'
    },
    extra: (props.stats?.modelStats || []).map((m) => ({
      title: m.model_type,
      score: Number(m.avg_score || 0).toFixed(3)
    })),
    insight: '推荐星图以宇宙隐喻呈现 Top 图书分布与模型引力中心。'
  })
  modelGroup.add(core)
  pulseMeshes.push(core)
  scene.add(modelGroup)
}

/* ===================== SCENE: NETWORK ===================== */
function buildNetwork() {
  modelGroup = new THREE.Group()
  addFloor(0x0a1f1a, 11)
  addParticles(100, 0x48c9b0, 16)

  const cats = props.stats?.categoryRatings?.length
    ? props.stats.categoryRatings
    : (props.stats?.categories || []).map((c) => ({
        name: c.name,
        category: c.name,
        count: c.count,
        avg_rating: 4,
        avg_score: 75
      }))
  const nodes = cats.length
    ? cats
    : [
        { name: '文学', count: 10, avg_rating: 4.2, avg_score: 78 },
        { name: '科技', count: 8, avg_rating: 4.0, avg_score: 80 },
        { name: '历史', count: 6, avg_rating: 4.1, avg_score: 75 },
        { name: '计算机', count: 12, avg_rating: 4.5, avg_score: 88 },
        { name: '艺术', count: 5, avg_rating: 3.9, avg_score: 70 },
        { name: '经济', count: 7, avg_rating: 4.0, avg_score: 76 }
      ]

  const positions = []
  nodes.forEach((n, i) => {
    const phi = Math.acos(-1 + (2 * i) / nodes.length)
    const theta = Math.sqrt(nodes.length * Math.PI) * phi
    const r = 5.2
    const pos = new THREE.Vector3(
      r * Math.cos(theta) * Math.sin(phi),
      r * Math.sin(theta) * Math.sin(phi) * 0.85,
      r * Math.cos(phi)
    )
    positions.push(pos)
    const name = n.name || n.category
    const size = 0.38 + (n.count || 5) / 22

    const nodeGroup = new THREE.Group()
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(size, 20, 20),
      new THREE.MeshStandardMaterial({
        color: coverPalette(i + 2),
        emissive: coverPalette(i + 2),
        emissiveIntensity: 0.3,
        metalness: 0.4,
        roughness: 0.35
      })
    )
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(size * 1.4, size * 1.65, 32),
      new THREE.MeshBasicMaterial({ color: 0x48c9b0, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    )
    halo.lookAt(0, 0, 0)
    nodeGroup.add(node, halo)
    nodeGroup.position.copy(pos)
    pulseMeshes.push(halo)

    makeSelectable(nodeGroup, {
      id: `net-${name}`,
      title: `${name} 兴趣簇`,
      type: '兴趣网络节点',
      scene: 'network',
      effect: 'network-wave',
      data: {
        分类: name,
        图书数: n.count || 0,
        均分: n.avg_rating != null ? Number(n.avg_rating).toFixed(2) : '-',
        推荐分: n.avg_score != null ? Number(n.avg_score).toFixed(1) : '-',
        连接潜力: `${Math.round(50 + seeded(i, 3) * 45)}%`,
        簇编号: `C${i + 1}`
      },
      extra: relatedBooks(name),
      insight: '兴趣网络展示跨分类关联；节点越大表示该类图书越多。'
    })
    modelGroup.add(nodeGroup)
  })

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (seeded(i * 11 + j, 2) > 0.5) continue
      const geo = new THREE.BufferGeometry().setFromPoints([positions[i], positions[j]])
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0x48c9b0, transparent: true, opacity: 0.28 })
      )
      line.userData.pulseLine = true
      modelGroup.add(line)
    }
  }

  // center hub
  const hub = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.85, 0),
    new THREE.MeshStandardMaterial({
      color: 0x1abc9c,
      emissive: 0x0e6655,
      emissiveIntensity: 0.45,
      metalness: 0.55,
      roughness: 0.3,
      flatShading: true
    })
  )
  makeSelectable(hub, {
    id: 'net-hub',
    title: '兴趣中枢',
    type: '网络枢纽',
    scene: 'network',
    effect: 'network-wave',
    data: {
      节点数: nodes.length,
      用户数: props.stats?.totalUsers || 0,
      关联边: Math.round(nodes.length * 1.4),
      主题: '跨类兴趣传播'
    },
    extra: relatedBooks(null, 4),
    insight: '中枢聚合各兴趣簇，用于解释推荐多样性与跨类跳转。'
  })
  modelGroup.add(hub)
  pulseMeshes.push(hub)
  scene.add(modelGroup)
}

function buildModel(id) {
  if (!scene) return
  clearModel()
  // lighting mood per scene
  updateLights(id)
  try {
    if (id === 'bookshelf') buildBookshelf()
    else if (id === 'bookstack') buildBookstack()
    else if (id === 'galaxy') buildGalaxy()
    else buildNetwork()

    const fx = SCENE_FX[id] || SCENE_FX.bookshelf
    camera.position.set(...fx.cam)
    controls?.target.set(0, 0, 0)
    controls?.update()
  } catch (e) {
    console.error(e)
  }
}

let keyLight, rimLight, fillLight
function updateLights(id) {
  if (!keyLight) return
  const presets = {
    bookshelf: { key: 0xffe0b2, rim: 0xc9a227, fill: 0x4a3728 },
    bookstack: { key: 0xffecb3, rim: 0xffb300, fill: 0x3e2723 },
    galaxy: { key: 0xb3e5fc, rim: 0x4fc3f7, fill: 0x0d2137 },
    network: { key: 0xb2dfdb, rim: 0x48c9b0, fill: 0x0a1f1a }
  }
  const p = presets[id] || presets.bookshelf
  keyLight.color.setHex(p.key)
  rimLight.color.setHex(p.rim)
  fillLight.color.setHex(p.fill)
}

function resolveSelectable(obj) {
  let cur = obj
  while (cur) {
    if (cur.userData?.title && cur.userData?.selectable && !cur.userData?.rootSelectable) return cur
    if (cur.userData?.rootSelectable) return cur.userData.rootSelectable
    cur = cur.parent
  }
  return null
}

function showScreenFx(label, color, clientX, clientY) {
  const rect = containerRef.value.getBoundingClientRect()
  fxLabel.value = label
  fxStyle.value = {
    left: `${clientX - rect.left}px`,
    top: `${clientY - rect.top}px`,
    '--fx': color
  }
  fxVisible.value = true
  clearTimeout(fxTimer)
  fxTimer = setTimeout(() => {
    fxVisible.value = false
  }, 900)
}

function applyClickEffect(mesh, payload, event) {
  // reset previous
  if (selectedMesh && selectedMesh !== mesh) {
    selectedMesh.scale.setScalar(selectedMesh.userData._baseScale || 1)
  }
  selectedMesh = mesh
  mesh.userData._baseScale = mesh.userData._baseScale || 1

  const effect = payload.effect || 'book-pull'
  const fxMeta = SCENE_FX[payload.scene] || SCENE_FX.bookshelf

  // scale pop
  mesh.scale.setScalar((mesh.userData._baseScale || 1) * 1.18)

  // emissive flash on meshes
  mesh.traverse((c) => {
    if (c.isMesh && c.material && c.material.emissive) {
      c.material.emissiveIntensity = Math.min((c.material.emissiveIntensity || 0.2) + 0.45, 1.2)
    }
  })

  // camera focus
  const worldPos = new THREE.Vector3()
  mesh.getWorldPosition(worldPos)
  focusTarget = worldPos.clone()
  focusProgress = 0

  showScreenFx(fxMeta.label, fxMeta.color, event.clientX, event.clientY)
  emit('effect', { effect, scene: payload.scene, color: fxMeta.color })

  if (controls) controls.autoRotate = false
  clearTimeout(autoRotateTimer)
  autoRotateTimer = setTimeout(() => {
    if (controls) controls.autoRotate = true
  }, 7000)
}

function onPointerDown(event) {
  if (!camera || !raycaster || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)

  // collect mesh children of clickable roots
  const hitTargets = []
  clickable.forEach((root) => {
    root.traverse((c) => {
      if (c.isMesh) hitTargets.push(c)
    })
  })
  const hits = raycaster.intersectObjects(hitTargets, false)
  if (!hits.length) return

  const root = resolveSelectable(hits[0].object)
  if (!root?.userData?.title) return

  const data = root.userData
  applyClickEffect(root, data, event)
  emit('select', {
    id: data.id,
    title: data.title,
    type: data.type,
    scene: data.scene,
    effect: data.effect,
    data: data.data,
    extra: data.extra,
    insight: data.insight
  })
}

function animate() {
  animationId = requestAnimationFrame(animate)
  if (!renderer || !scene || !camera) return
  const t = clock?.getElapsedTime() || 0
  const mode = activeScene?.value || 'bookshelf'

  if (modelGroup) {
    if (mode === 'galaxy') modelGroup.rotation.y = t * 0.08
    if (mode === 'network') modelGroup.rotation.y = t * 0.06
    if (mode === 'bookstack') modelGroup.rotation.y = Math.sin(t * 0.25) * 0.15
  }

  // ambient pulse
  pulseMeshes.forEach((m, i) => {
    if (!m) return
    const s = 1 + Math.sin(t * 2 + i) * 0.04
    if (m.scale) m.scale.setScalar(s)
    if (m.material?.opacity != null) {
      m.material.opacity = 0.2 + Math.sin(t * 2.5 + i) * 0.1
    }
  })

  if (selectedMesh) {
    const breathe = 1.12 + Math.sin(t * 4) * 0.06
    selectedMesh.scale.setScalar((selectedMesh.userData._baseScale || 1) * breathe)
  }

  if (particleSystem) {
    particleSystem.rotation.y = t * 0.03
  }

  // smooth camera focus
  if (focusTarget && focusProgress < 1) {
    focusProgress = Math.min(1, focusProgress + 0.02)
    const desired = focusTarget.clone().add(new THREE.Vector3(2.5, 1.8, 6))
    camera.position.lerp(desired, 0.04)
    controls.target.lerp(focusTarget, 0.06)
  }

  controls?.update()
  renderer.render(scene, camera)
}

function onResize() {
  if (!camera || !renderer) return
  const { w, h } = getSize()
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

function init() {
  const el = containerRef.value
  if (!el) return
  const { w, h } = getSize()

  scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x0a1628, 0.018)

  camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 200)
  camera.position.set(0, 7, 18)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.07
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.45
  controls.minDistance = 5
  controls.maxDistance = 40
  controls.maxPolarAngle = Math.PI * 0.49

  scene.add(new THREE.AmbientLight(0xffffff, 0.35))
  keyLight = new THREE.DirectionalLight(0xffe0b2, 1.15)
  keyLight.position.set(6, 14, 8)
  scene.add(keyLight)
  rimLight = new THREE.PointLight(0xc9a227, 0.9, 40)
  rimLight.position.set(-8, 6, -4)
  scene.add(rimLight)
  fillLight = new THREE.PointLight(0x4fc3f7, 0.45, 35)
  fillLight.position.set(4, 2, 8)
  scene.add(fillLight)

  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()
  clock = new THREE.Clock()

  buildModel(activeScene?.value || 'bookshelf')
  animate()
  el.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('resize', onResize)
  resizeObserver = new ResizeObserver(() => onResize())
  resizeObserver.observe(el)
  emit('ready')
}

watch(
  () => activeScene?.value,
  (id) => {
    if (!scene || !id) return
    buildModel(id)
  }
)

watch(
  () => [props.stats?.totalBooks, props.stats?.categories?.length, props.stats?.topBooks?.length],
  () => {
    if (!scene) return
    clearTimeout(rebuildTimer)
    rebuildTimer = setTimeout(() => buildModel(activeScene?.value || 'bookshelf'), 300)
  }
)

onMounted(() => requestAnimationFrame(() => init()))

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  clearTimeout(autoRotateTimer)
  clearTimeout(rebuildTimer)
  clearTimeout(fxTimer)
  resizeObserver?.disconnect()
  containerRef.value?.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('resize', onResize)
  clearModel()
  controls?.dispose()
  renderer?.dispose()
  if (renderer?.domElement?.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
})
</script>

<style scoped lang="scss">
.book-scene3d,
.canvas-wrap {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.canvas-wrap {
  cursor: grab;
  &:active {
    cursor: grabbing;
  }
}

.click-fx {
  position: absolute;
  z-index: 20;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.fx-ring {
  display: block;
  width: 54px;
  height: 54px;
  border: 2px solid var(--fx, #c9a227);
  border-radius: 50%;
  animation: ring-out 0.85s ease-out forwards;
  box-shadow: 0 0 18px var(--fx, #c9a227);
}

.fx-label {
  position: absolute;
  left: 50%;
  top: -28px;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 12px;
  color: var(--fx, #c9a227);
  letter-spacing: 1px;
  text-shadow: 0 0 8px rgba(0, 0, 0, 0.6);
  animation: label-up 0.85s ease-out forwards;
}

@keyframes ring-out {
  0% { transform: scale(0.4); opacity: 1; }
  100% { transform: scale(1.8); opacity: 0; }
}
@keyframes label-up {
  0% { opacity: 0; transform: translate(-50%, 8px); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -12px); }
}
</style>
