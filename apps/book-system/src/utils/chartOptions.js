/** Chart option builders for the dashboard */

const gold = '#c9a227'
const cyan = '#4fc3f7'
const textMuted = 'rgba(232,240,248,0.65)'
const gridLine = 'rgba(255,255,255,0.06)'

/** Deterministic pseudo-random in [0,1) from string/number seed */
function seeded(seed, salt = 0) {
  let h = (typeof seed === 'number' ? seed : String(seed).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) + salt * 97
  h = Math.sin(h * 12.9898 + salt * 78.233) * 43758.5453
  return h - Math.floor(h)
}

export function baseTooltip() {
  return {
    backgroundColor: 'rgba(10,30,55,0.92)',
    borderColor: gold,
    textStyle: { color: '#e8f0f8', fontSize: 12 }
  }
}

export function largeAreaOption(trend = []) {
  const dates = trend.map((t) => t.date.slice(5))
  return {
    tooltip: { ...baseTooltip(), trigger: 'axis' },
    legend: { data: ['推荐量', '点击量'], textStyle: { color: textMuted }, top: 0 },
    grid: { left: 40, right: 16, top: 30, bottom: 24 },
    xAxis: { type: 'category', data: dates, axisLabel: { color: textMuted, fontSize: 10 }, axisLine: { lineStyle: { color: gridLine } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: gridLine } }, axisLabel: { color: textMuted } },
    series: [
      {
        name: '推荐量',
        type: 'line',
        smooth: true,
        symbol: 'none',
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(201,162,39,0.5)' }, { offset: 1, color: 'rgba(201,162,39,0.02)' }]
          }
        },
        lineStyle: { color: gold, width: 2 },
        data: trend.map((t) => t.recommends)
      },
      {
        name: '点击量',
        type: 'line',
        smooth: true,
        symbol: 'none',
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(79,195,247,0.4)' }, { offset: 1, color: 'rgba(79,195,247,0.02)' }]
          }
        },
        lineStyle: { color: cyan, width: 2 },
        data: trend.map((t) => t.clicks)
      }
    ]
  }
}

export function gradientStackArea(trend = []) {
  const dates = trend.map((t) => t.date.slice(5))
  return {
    tooltip: { ...baseTooltip(), trigger: 'axis' },
    legend: { data: ['推荐', '点击', '转化'], textStyle: { color: textMuted }, top: 0 },
    grid: { left: 40, right: 16, top: 30, bottom: 24 },
    xAxis: { type: 'category', boundaryGap: false, data: dates, axisLabel: { color: textMuted, fontSize: 10 }, axisLine: { lineStyle: { color: gridLine } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: gridLine } }, axisLabel: { color: textMuted } },
    series: [
      { name: '推荐', type: 'line', stack: 'Total', areaStyle: { color: 'rgba(201,162,39,0.45)' }, lineStyle: { width: 0 }, emphasis: { focus: 'series' }, data: trend.map((t) => t.recommends), smooth: true, symbol: 'none' },
      { name: '点击', type: 'line', stack: 'Total', areaStyle: { color: 'rgba(79,195,247,0.4)' }, lineStyle: { width: 0 }, emphasis: { focus: 'series' }, data: trend.map((t) => t.clicks), smooth: true, symbol: 'none' },
      { name: '转化', type: 'line', stack: 'Total', areaStyle: { color: 'rgba(72,201,176,0.4)' }, lineStyle: { width: 0 }, emphasis: { focus: 'series' }, data: trend.map((t) => t.conversions), smooth: true, symbol: 'none' }
    ]
  }
}

export function easingVizOption() {
  return EASING_OPTION
}

const EASING_OPTION = (() => {
  const N = 50
  const easingFns = {
    linear: (t) => t,
    quadIn: (t) => t * t,
    quadOut: (t) => t * (2 - t),
    cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
    bounceOut: (t) => {
      if (t < 1 / 2.75) return 7.5625 * t * t
      if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75
      if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375
    }
  }
  const xs = Array.from({ length: N }, (_, i) => +(i / (N - 1)).toFixed(3))
  return {
    tooltip: { ...baseTooltip(), trigger: 'axis' },
    legend: { data: Object.keys(easingFns), textStyle: { color: textMuted, fontSize: 10 }, top: 0 },
    grid: { left: 40, right: 16, top: 30, bottom: 24 },
    xAxis: { type: 'value', min: 0, max: 1, axisLabel: { color: textMuted }, splitLine: { lineStyle: { color: gridLine } } },
    yAxis: { type: 'value', min: 0, max: 1, axisLabel: { color: textMuted }, splitLine: { lineStyle: { color: gridLine } } },
    series: Object.entries(easingFns).map(([name, fn], i) => ({
      name,
      type: 'line',
      showSymbol: false,
      data: xs.map((x) => [x, +fn(x).toFixed(4)]),
      lineStyle: { width: 2, color: [gold, cyan, '#48c9b0', '#e8d48b', '#af7ac5'][i] }
    }))
  }
})()

export function miniLineMatrix(topBooks = []) {
  const books = topBooks.slice(0, 8)
  const data = books.map((b, i) => {
    const spark = Array.from({ length: 12 }, (_, k) => +(seeded(b.id || b.title, k) * 2 + (b.rating || 4) - 1).toFixed(2))
    return { name: b.title, value: [i % 4, Math.floor(i / 4), b.recommend_score], spark }
  })
  return {
    tooltip: {
      ...baseTooltip(),
      formatter(p) {
        const d = data[p.dataIndex]
        return `${d.name}<br/>推荐分: ${d.value[2]}`
      }
    },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: ['A', 'B', 'C', 'D'], axisLabel: { color: textMuted }, axisLine: { lineStyle: { color: gridLine } } },
    yAxis: { type: 'category', data: ['行1', '行2'], axisLabel: { color: textMuted }, axisLine: { lineStyle: { color: gridLine } } },
    series: [
      {
        type: 'scatter',
        symbolSize: (val) => Math.max(20, val[2] / 3),
        data: data.map((d) => d.value),
        itemStyle: { color: cyan },
        label: {
          show: true,
          formatter: (p) => data[p.dataIndex]?.name?.slice(0, 4) || '',
          color: '#fff',
          fontSize: 9,
          position: 'inside'
        }
      }
    ]
  }
}

export function stackedBarNorm(categories = []) {
  const names = categories.map((c) => c.name)
  return {
    tooltip: { ...baseTooltip(), trigger: 'axis' },
    legend: { data: ['高分', '中分', '低分'], textStyle: { color: textMuted }, top: 0 },
    grid: { left: 50, right: 16, top: 30, bottom: 24 },
    xAxis: { type: 'category', data: names, axisLabel: { color: textMuted, fontSize: 10, rotate: 30 }, axisLine: { lineStyle: { color: gridLine } } },
    yAxis: { type: 'value', max: 100, axisLabel: { color: textMuted, formatter: '{value}%' }, splitLine: { lineStyle: { color: gridLine } } },
    series: [
      { name: '高分', type: 'bar', stack: 'total', barWidth: 18, data: names.map((n, i) => +(30 + seeded(n, i) * 30).toFixed(1)), itemStyle: { color: gold } },
      { name: '中分', type: 'bar', stack: 'total', data: names.map((n, i) => +(20 + seeded(n, i + 10) * 25).toFixed(1)), itemStyle: { color: cyan } },
      { name: '低分', type: 'bar', stack: 'total', data: names.map((n, i) => +(10 + seeded(n, i + 20) * 20).toFixed(1)), itemStyle: { color: '#48c9b0' } }
    ]
  }
}

export function waterfallOption(yearly = []) {
  const years = yearly.slice(-8)
  const values = years.map((y) => y.count)
  const assist = []
  let sum = 0
  values.forEach((v, i) => {
    assist.push(i === 0 ? 0 : sum)
    sum += v
  })
  return {
    tooltip: { ...baseTooltip(), trigger: 'axis' },
    grid: { left: 40, right: 16, top: 20, bottom: 24 },
    xAxis: { type: 'category', data: years.map((y) => y.year), axisLabel: { color: textMuted, fontSize: 10 }, axisLine: { lineStyle: { color: gridLine } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: gridLine } }, axisLabel: { color: textMuted } },
    series: [
      { name: '辅助', type: 'bar', stack: 'all', data: assist, itemStyle: { borderColor: 'transparent', color: 'transparent' }, emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } } },
      { name: '增量', type: 'bar', stack: 'all', data: values, itemStyle: { color: gold }, barWidth: 20 }
    ]
  }
}

export function themeRiverOption(categories = []) {
  let cats = categories.slice(0, 6).map((c) => c.name).filter(Boolean)
  if (!cats.length) cats = ['文学', '科技', '历史', '计算机']
  const data = []
  const months = ['2024-01', '2024-03', '2024-05', '2024-07', '2024-09', '2024-11', '2025-01', '2025-03', '2025-05', '2025-07']
  months.forEach((m) => {
    cats.forEach((c) => {
      data.push([m, Math.floor(seeded(c + m, 1) * 40 + 10), c])
    })
  })
  return {
    tooltip: { ...baseTooltip(), trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: 'rgba(0,0,0,0.2)' } } },
    legend: { data: cats, textStyle: { color: textMuted, fontSize: 10 }, top: 0 },
    singleAxis: {
      top: 40, bottom: 20, type: 'time',
      axisLabel: { color: textMuted, fontSize: 10 },
      axisLine: { lineStyle: { color: gridLine } },
      splitLine: { show: true, lineStyle: { color: gridLine } }
    },
    series: [{
      type: 'themeRiver',
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
      data,
      label: { show: false }
    }]
  }
}

export function pictorialBar(topBooks = []) {
  const books = topBooks.slice(0, 6)
  return {
    tooltip: { ...baseTooltip() },
    grid: { left: 80, right: 30, top: 20, bottom: 24 },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: gridLine } }, axisLabel: { color: textMuted } },
    yAxis: { type: 'category', data: books.map((b) => b.title), axisLabel: { color: textMuted, fontSize: 11 }, axisLine: { lineStyle: { color: gridLine } } },
    series: [{
      type: 'pictorialBar',
      symbol: 'roundRect',
      symbolRepeat: true,
      symbolSize: [6, 12],
      symbolMargin: 2,
      data: books.map((b) => b.recommend_score),
      itemStyle: { color: gold }
    }]
  }
}

export function calendarHeatmap() {
  const data = []
  const start = +new Date(2025, 0, 1)
  for (let i = 0; i < 365; i++) {
    const d = new Date(start + i * 86400000)
    data.push([d.toISOString().slice(0, 10), Math.floor(seeded(i, 3) * 50)])
  }
  return {
    tooltip: { ...baseTooltip() },
    visualMap: {
      min: 0, max: 50, orient: 'horizontal', left: 'center', bottom: 0,
      textStyle: { color: textMuted },
      inRange: { color: ['#0a1628', '#1a3a5c', '#4fc3f7', '#c9a227'] }
    },
    calendar: {
      top: 30, left: 40, right: 20, bottom: 40,
      cellSize: ['auto', 13],
      range: '2025',
      itemStyle: { borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)' },
      yearLabel: { show: false },
      dayLabel: { color: textMuted, fontSize: 10 },
      monthLabel: { color: textMuted, fontSize: 10 }
    },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data }]
  }
}

export function corrHeatmap(categories = []) {
  const names = (categories.length ? categories : [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }]).slice(0, 6).map((c) => c.name)
  const data = []
  for (let i = 0; i < names.length; i++) {
    for (let j = 0; j < names.length; j++) {
      const v = i === j ? 1 : +(seeded(names[i] + names[j], i * 7 + j) * 0.8 + 0.1).toFixed(2)
      data.push([i, j, v])
    }
  }
  return {
    tooltip: { ...baseTooltip() },
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: names, axisLabel: { color: textMuted, fontSize: 10, rotate: 30 } },
    yAxis: { type: 'category', data: names, axisLabel: { color: textMuted, fontSize: 10 } },
    visualMap: {
      min: 0, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      textStyle: { color: textMuted },
      inRange: { color: ['#0d2137', '#1a5276', '#4fc3f7', '#c9a227'] }
    },
    series: [{ type: 'heatmap', data, label: { show: true, color: '#fff', fontSize: 9 } }]
  }
}

export function corrScatter(categoryRatings = []) {
  const data = categoryRatings.map((c) => [+(c.avg_rating || 0).toFixed(2), +(c.avg_score || 0).toFixed(1), c.count, c.category])
  return {
    tooltip: {
      ...baseTooltip(),
      formatter: (p) => `${p.data[3]}<br/>评分: ${p.data[0]}<br/>推荐分: ${p.data[1]}<br/>数量: ${p.data[2]}`
    },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { name: '评分', nameTextStyle: { color: textMuted }, axisLabel: { color: textMuted }, splitLine: { lineStyle: { color: gridLine } } },
    yAxis: { name: '推荐分', nameTextStyle: { color: textMuted }, axisLabel: { color: textMuted }, splitLine: { lineStyle: { color: gridLine } } },
    series: [{
      type: 'scatter',
      symbolSize: (d) => Math.sqrt(d[2]) * 6,
      data,
      itemStyle: { color: cyan, shadowBlur: 8, shadowColor: 'rgba(79,195,247,0.4)' }
    }]
  }
}

export function scatter3d(topBooks = []) {
  const data = topBooks.map((b) => [b.rating, b.recommend_score, b.id * 3, b.title])
  if (!data.length) {
    for (let i = 0; i < 20; i++) data.push([3 + seeded(i, 1) * 2, 60 + seeded(i, 2) * 40, seeded(i, 3) * 50, `书${i}`])
  }
  return {
    tooltip: {},
    visualMap: {
      show: false, min: 0, max: 100,
      inRange: { color: [cyan, gold, '#e8d48b'] }
    },
    xAxis3D: { name: '评分', type: 'value', axisLabel: { color: textMuted } },
    yAxis3D: { name: '推荐分', type: 'value', axisLabel: { color: textMuted } },
    zAxis3D: { name: 'ID', type: 'value', axisLabel: { color: textMuted } },
    grid3D: {
      boxWidth: 80, boxDepth: 80,
      viewControl: { projection: 'perspective', autoRotate: true, autoRotateSpeed: 4 },
      light: { main: { intensity: 1.2 }, ambient: { intensity: 0.4 } },
      environment: 'none'
    },
    series: [{
      type: 'scatter3D',
      data: data.map((d) => [d[0], d[1], d[2]]),
      symbolSize: 10,
      itemStyle: { opacity: 0.85 },
      emphasis: { itemStyle: { color: '#fff' } }
    }]
  }
}

export function bar3d(categories = []) {
  let cats = categories.slice(0, 6)
  if (!cats.length) {
    cats = [
      { name: '文学', count: 8 },
      { name: '科技', count: 6 },
      { name: '历史', count: 5 },
      { name: '计算机', count: 10 }
    ]
  }
  const data = cats.map((c, i) => [i, 0, c.count || 0])
  const maxVal = Math.max(...cats.map((c) => c.count || 0), 10)
  return {
    tooltip: {},
    visualMap: {
      max: maxVal,
      inRange: { color: [cyan, gold] },
      textStyle: { color: textMuted }
    },
    xAxis3D: { type: 'category', data: cats.map((c) => c.name), axisLabel: { color: textMuted, fontSize: 10 } },
    yAxis3D: { type: 'category', data: ['数量'], axisLabel: { color: textMuted } },
    zAxis3D: { type: 'value', axisLabel: { color: textMuted } },
    grid3D: {
      boxWidth: 120, boxDepth: 40,
      viewControl: { projection: 'perspective', autoRotate: true, autoRotateSpeed: 5 },
      light: { main: { intensity: 1.2, shadow: true }, ambient: { intensity: 0.3 } }
    },
    series: [{
      type: 'bar3D',
      data,
      shading: 'lambert',
      label: { show: false },
      itemStyle: { opacity: 0.85 },
      emphasis: { label: { show: true, color: '#fff' } }
    }]
  }
}

export function scatterMatrixCombo(categoryRatings = []) {
  const data = categoryRatings.length
    ? categoryRatings.map((c) => [c.avg_rating, c.avg_score / 20, c.count / 5])
    : Array.from({ length: 15 }, (_, i) => [3 + seeded(i, 1) * 2, 3 + seeded(i, 2) * 2, 1 + seeded(i, 3) * 5])
  return {
    tooltip: { ...baseTooltip() },
    grid: [
      { left: '8%', top: '10%', width: '38%', height: '38%' },
      { right: '8%', top: '10%', width: '38%', height: '38%' },
      { left: '8%', bottom: '10%', width: '38%', height: '38%' },
      { right: '8%', bottom: '10%', width: '38%', height: '38%' }
    ],
    xAxis: [
      { gridIndex: 0, min: 0, max: 6, axisLabel: { color: textMuted, fontSize: 9 }, splitLine: { lineStyle: { color: gridLine } } },
      { gridIndex: 1, min: 0, max: 6, axisLabel: { color: textMuted, fontSize: 9 }, splitLine: { lineStyle: { color: gridLine } } },
      { gridIndex: 2, min: 0, max: 6, axisLabel: { color: textMuted, fontSize: 9 }, splitLine: { lineStyle: { color: gridLine } } },
      { gridIndex: 3, min: 0, max: 6, axisLabel: { color: textMuted, fontSize: 9 }, splitLine: { lineStyle: { color: gridLine } } }
    ],
    yAxis: [
      { gridIndex: 0, min: 0, max: 6, axisLabel: { color: textMuted, fontSize: 9 }, splitLine: { lineStyle: { color: gridLine } } },
      { gridIndex: 1, min: 0, max: 6, axisLabel: { color: textMuted, fontSize: 9 }, splitLine: { lineStyle: { color: gridLine } } },
      { gridIndex: 2, min: 0, max: 6, axisLabel: { color: textMuted, fontSize: 9 }, splitLine: { lineStyle: { color: gridLine } } },
      { gridIndex: 3, min: 0, max: 6, axisLabel: { color: textMuted, fontSize: 9 }, splitLine: { lineStyle: { color: gridLine } } }
    ],
    series: [
      { type: 'scatter', xAxisIndex: 0, yAxisIndex: 0, data: data.map((d) => [d[0], d[1]]), symbolSize: 8, itemStyle: { color: gold } },
      { type: 'scatter', xAxisIndex: 1, yAxisIndex: 1, data: data.map((d) => [d[0], d[2]]), symbolSize: 8, itemStyle: { color: cyan } },
      { type: 'scatter', xAxisIndex: 2, yAxisIndex: 2, data: data.map((d) => [d[1], d[2]]), symbolSize: 8, itemStyle: { color: '#48c9b0' } },
      { type: 'scatter', xAxisIndex: 3, yAxisIndex: 3, data: data.map((d) => [d[2], d[0]]), symbolSize: 8, itemStyle: { color: '#e8d48b' } }
    ]
  }
}

export function modelRadar(modelStats = []) {
  const models = modelStats.length ? modelStats : [
    { model_type: 'NCF', avg_score: 0.85 },
    { model_type: 'DeepFM', avg_score: 0.88 },
    { model_type: 'DIN', avg_score: 0.9 },
    { model_type: 'Wide&Deep', avg_score: 0.82 },
    { model_type: 'Transformer', avg_score: 0.91 }
  ]
  return {
    tooltip: { ...baseTooltip() },
    radar: {
      indicator: models.map((m) => ({ name: m.model_type, max: 1 })),
      axisName: { color: textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: gridLine } },
      splitArea: { areaStyle: { color: ['rgba(10,30,55,0.3)', 'rgba(10,30,55,0.5)'] } },
      axisLine: { lineStyle: { color: gridLine } }
    },
    series: [{
      type: 'radar',
      data: [{
        value: models.map((m) => m.avg_score),
        name: '模型得分',
        areaStyle: { color: 'rgba(201,162,39,0.3)' },
        lineStyle: { color: gold },
        itemStyle: { color: gold }
      }]
    }]
  }
}

export function categoryPie(categories = []) {
  const data = (categories.length ? categories : [{ name: '暂无', count: 1 }]).map((c) => ({
    name: c.name,
    value: c.count || 0
  }))
  return {
    tooltip: { ...baseTooltip(), trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '68%'],
      center: ['50%', '55%'],
      data,
      label: { color: textMuted, fontSize: 11 },
      itemStyle: {
        borderRadius: 4,
        borderColor: 'rgba(10,22,40,0.5)',
        borderWidth: 2
      },
      color: [gold, cyan, '#48c9b0', '#e8d48b', '#af7ac5', '#5dade2', '#f0c75e', '#7eb8da', '#d4a574', '#76d7c4']
    }]
  }
}
