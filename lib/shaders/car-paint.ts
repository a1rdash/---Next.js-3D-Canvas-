import * as THREE from 'three'

/**
 * Автомобильная краска для Three.js (PBR): GLSL внутри MeshPhysicalMaterial через onBeforeCompile.
 *
 *  - Clear Coat: встроенный clearcoat физического материала (Френель, отдельная шероховатость слоя).
 *  - Metallic flakes: блёстки двух масштабов, переливаются при движении камеры и солнца.
 *  - Глубина цвета: на краях, уходящих от камеры, краска темнеет и уходит в «глубокий» оттенок.
 *  - Студийное отражение (дёшево): процедурное окружение (небо, горизонт, софтбоксы) по вектору отражения.
 *    Работает без cubemap, поэтому кузова блестят даже в сценах без карты окружения.
 *  - Микро-нормали: шагрень лака (orange peel) на нормали слоя лака; основная карта нормалей и микро-карта
 *    смешиваются методом RNM.
 *
 * Уровни качества (для телефонов и слабых ПК):
 *    'off'  — обычный MeshPhysicalMaterial, шейдер не подключается;
 *    'lite' — один слой блёсток + затемнение по краям + студийное отражение (дёшево);
 *    'full' — два слоя блёсток + шагрень лака + всё остальное.
 *
 * Безопасность: если шейдер не скомпилируется на устройстве, installCarPaintFallback() автоматически
 * переключает все такие материалы на обычный MeshPhysicalMaterial (кузова не пропадают).
 */

export type PaintQuality = 'off' | 'lite' | 'full'

export interface CarPaintTuning {
  /** Цвет блёсток (по умолчанию светлый оттенок краски) */
  flakeColor?: THREE.ColorRepresentation
  /** Интенсивность блеска блёсток 0…4 */
  flakeIntensity?: number
  /** Размер фракций: ячеек на единицу объекта (больше = мельче) */
  flakeScale?: number
  /** Плотность блёсток 0…1 */
  flakeDensity?: number
  /** Резкость блика */
  flakeSharpness?: number
  /** Затемнение на краях 0…1, степень кривой, оттенок глубины */
  edgeDarken?: number
  edgePower?: number
  edgeTint?: THREE.ColorRepresentation
  /** Сила студийного отражения 0…1.5 (в сценах с настоящей картой окружения ставьте 0.2–0.4) */
  fakeEnv?: number
  /** Сила шагрени лака 0…1 и её размер */
  orangePeel?: number
  orangePeelScale?: number
  /** Основная нормаль-карта: сила; микро-карта (необязательно) и её повтор */
  normalScale?: number
  microNormalMap?: THREE.Texture | null
  microRepeat?: number
}

export interface CarPaintOptions extends CarPaintTuning {
  color?: THREE.ColorRepresentation
  metalness?: number
  roughness?: number
  clearcoat?: number
  clearcoatRoughness?: number
  envMapIntensity?: number
  normalMap?: THREE.Texture | null
  quality?: PaintQuality
}

/* ------------------------------------------------------------------ */
/*  GLSL                                                               */
/* ------------------------------------------------------------------ */

const COMMON_VERT = /* glsl */ `
#include <common>
varying vec3 vCpObj;
varying vec3 vCpX;
varying vec3 vCpY;
varying vec3 vCpZ;
`

const BEGIN_VERT = /* glsl */ `
#include <begin_vertex>
vCpObj = position;
// оси объекта в пространстве вида: переводят «объектные» градиенты и нормали блёсток во view space
vCpX = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
vCpY = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
vCpZ = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
`

const COMMON_FRAG = /* glsl */ `
#include <common>
varying vec3 vCpObj;
varying vec3 vCpX;
varying vec3 vCpY;
varying vec3 vCpZ;
uniform vec3  uFlakeColor;
uniform float uFlakeIntensity;
uniform float uFlakeScale;
uniform float uFlakeDensity;
uniform float uFlakeSharp;
uniform float uEdgeDarken;
uniform float uEdgePower;
uniform vec3  uEdgeTint;
uniform float uFakeEnv;
uniform float uPeel;
uniform float uPeelScale;
uniform float uMicroRepeat;
uniform vec3  uSunDirView;
#ifdef USE_CP_MICRONORMAL
  uniform sampler2D uMicroNormalMap;
#endif

vec3 cpHash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
vec3 cpToView(vec3 g) { return vCpX * g.x + vCpY * g.y + vCpZ * g.z; }

// студийное окружение: небо, горизонт, два софтбокса, тёмный пол (мировое пространство)
vec3 cpStudioEnv(vec3 r) {
  float up = clamp(r.y, -1.0, 1.0);
  vec3 sky = mix(vec3(0.55, 0.68, 0.9), vec3(0.08, 0.14, 0.32), smoothstep(0.0, 0.9, up));
  vec3 ground = mix(vec3(0.16, 0.15, 0.17), vec3(0.03, 0.03, 0.04), smoothstep(0.0, -0.8, up));
  vec3 env = mix(ground, sky, smoothstep(-0.05, 0.08, up));
  env += vec3(1.0, 0.95, 0.85) * exp(-abs(up) * 9.0) * 0.55;                       // яркая линия горизонта
  vec3 l1 = normalize(vec3(0.45, 0.85, 0.3));
  vec3 l2 = normalize(vec3(-0.7, 0.45, -0.45));
  env += vec3(1.0, 0.97, 0.9) * pow(max(dot(r, l1), 0.0), 48.0) * 3.2;             // верхний софтбокс
  env += vec3(0.7, 0.85, 1.0) * pow(max(dot(r, l2), 0.0), 70.0) * 2.4;             // боковая полоса
  return env;
}

#ifdef CP_FULL
float cpHash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float cpNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cpHash13(i), cpHash13(i + vec3(1.0, 0.0, 0.0)), f.x),
                 mix(cpHash13(i + vec3(0.0, 1.0, 0.0)), cpHash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(cpHash13(i + vec3(0.0, 0.0, 1.0)), cpHash13(i + vec3(1.0, 0.0, 1.0)), f.x),
                 mix(cpHash13(i + vec3(0.0, 1.0, 1.0)), cpHash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
// градиент шума конечными разностями (шагрень лака)
vec3 cpPeelGrad(vec3 p) {
  const float e = 0.15;
  float a = cpNoise(p);
  return vec3(cpNoise(p + vec3(e, 0.0, 0.0)) - a, cpNoise(p + vec3(0.0, e, 0.0)) - a, cpNoise(p + vec3(0.0, 0.0, e)) - a) / e;
}
vec3 cpPerturb(vec3 N, vec3 g) {
  vec3 gt = g - N * dot(g, N);
  return normalize(N - gt);
}
// Reoriented Normal Mapping: корректное смешивание двух нормалей в тангенциальном пространстве
vec3 cpBlendRNM(vec3 base, vec3 detail) {
  vec3 t = base + vec3(0.0, 0.0, 1.0);
  vec3 u = detail * vec3(-1.0, -1.0, 1.0);
  return normalize(t * dot(t, u) / t.z - u);
}
#endif

// один слой блёсток
float cpFlakeLayer(vec3 pObj, float scale, vec3 N, vec3 H) {
  vec3 fp = pObj * scale;
  vec3 cell = floor(fp);
  vec3 h = cpHash33(cell);
  vec3 local = fract(fp) - 0.5;
  float shape = smoothstep(0.5, 0.18, length(local));
  float present = step(h.z, uFlakeDensity);
  vec3 fnv = normalize(cpToView(normalize(h * 2.0 - 1.0)));
  if (dot(fnv, N) < 0.0) fnv = -fnv;
  vec3 flakeN = normalize(mix(N, fnv, 0.55));
  return pow(max(dot(flakeN, H), 0.0), uFlakeSharp) * shape * present;
}
`

const CLEARCOAT_FRAG = /* glsl */ `
#include <clearcoat_normal_fragment_maps>
#if defined( CP_FULL ) && defined( USE_CLEARCOAT )
  #if defined( USE_NORMALMAP_TANGENTSPACE ) && defined( USE_CP_MICRONORMAL )
    vec3 cpBaseTS = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
    cpBaseTS.xy *= normalScale;
    vec3 cpMicroTS = texture2D( uMicroNormalMap, vNormalMapUv * uMicroRepeat ).xyz * 2.0 - 1.0;
    cpMicroTS.xy *= uPeel;
    clearcoatNormal = normalize( tbn * cpBlendRNM( normalize( cpBaseTS ), normalize( cpMicroTS ) ) );
  #else
    clearcoatNormal = cpPerturb( clearcoatNormal, cpToView( cpPeelGrad( vCpObj * uPeelScale ) ) * uPeel );
  #endif
#endif
`

const EMISSIVE_FRAG = /* glsl */ `
#include <emissivemap_fragment>
{
  vec3 cpV = normalize( vViewPosition );
  vec3 cpN = normalize( normal );
  vec3 cpH = normalize( normalize( uSunDirView ) + cpV );
  float cpNdV = clamp( dot( cpN, cpV ), 0.0, 1.0 );
  float cpEdge = pow( 1.0 - cpNdV, uEdgePower );

  // глубина цвета: на краях краска темнеет и уходит в глубокий оттенок
  diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * uEdgeTint, clamp( cpEdge * uEdgeDarken * 1.6, 0.0, 1.0 ) );
  diffuseColor.rgb *= 1.0 - uEdgeDarken * 0.5 * cpEdge;

  // студийное отражение лака (дёшево): Френель F0=0.04 × процедурное окружение по вектору отражения
  vec3 cpR = inverseTransformDirection( reflect( -cpV, cpN ), viewMatrix );
  float cpFres = 0.04 + 0.96 * pow( 1.0 - cpNdV, 5.0 );
  totalEmissiveRadiance += cpStudioEnv( cpR ) * cpFres * uFakeEnv * 1.4;

  // металлические блёстки
  float cpSpark = cpFlakeLayer( vCpObj, uFlakeScale, cpN, cpH );
  #ifdef CP_FULL
    cpSpark += 0.6 * cpFlakeLayer( vCpObj + 17.3, uFlakeScale * 0.43, cpN, cpH );
  #endif
  vec3 cpShift = mix( uFlakeColor, uFlakeColor * vec3( 0.75, 0.9, 1.25 ), 1.0 - cpNdV );
  totalEmissiveRadiance += cpShift * cpSpark * uFlakeIntensity * ( 0.35 + 0.65 * cpNdV );
}
`

/* ------------------------------------------------------------------ */
/*  Реестр материалов и безопасный откат                                */
/* ------------------------------------------------------------------ */

const registry = new Set<THREE.MeshPhysicalMaterial>()
let disabled = false

/** Отключает шейдер краски у всех материалов (используется при ошибке компиляции) */
export function disableCarPaintShaders() {
  disabled = true
  for (const mat of registry) {
    mat.onBeforeCompile = () => {}
    mat.customProgramCacheKey = () => 'carpaint-plain'
    mat.needsUpdate = true
  }
  console.warn('[car-paint] шейдер краски отключён: используется обычный материал')
}

/**
 * Подключите сразу после создания рендерера: при ошибке компиляции шейдера краски кузова автоматически
 * переключатся на обычный материал, а не исчезнут.
 */
export function installCarPaintFallback(renderer: THREE.WebGLRenderer) {
  const dbg = renderer.debug as THREE.WebGLRenderer['debug'] & { onShaderError?: unknown }
  dbg.checkShaderErrors = true
  const prev = dbg.onShaderError as ((...a: unknown[]) => void) | null | undefined
  dbg.onShaderError = (...args: unknown[]) => {
    disableCarPaintShaders()
    prev?.(...args)
  }
}

/* ------------------------------------------------------------------ */
/*  Применение к материалу                                             */
/* ------------------------------------------------------------------ */

type UniformMap = Record<string, { value: unknown }>

/** Подключает шейдер краски к существующему MeshPhysicalMaterial */
export function applyCarPaint(mat: THREE.MeshPhysicalMaterial, quality: PaintQuality, t: CarPaintTuning = {}) {
  if (quality === 'off' || disabled) return
  const u: UniformMap = {
    uFlakeColor: { value: new THREE.Color(t.flakeColor ?? 0xffffff) },
    uFlakeIntensity: { value: t.flakeIntensity ?? 1.1 },
    uFlakeScale: { value: t.flakeScale ?? 70 },
    uFlakeDensity: { value: t.flakeDensity ?? 0.55 },
    uFlakeSharp: { value: t.flakeSharpness ?? 90 },
    uEdgeDarken: { value: t.edgeDarken ?? 0.42 },
    uEdgePower: { value: t.edgePower ?? 3 },
    uEdgeTint: { value: new THREE.Color(t.edgeTint ?? 0x0b0d14) },
    uFakeEnv: { value: t.fakeEnv ?? 0.8 },
    uPeel: { value: t.orangePeel ?? 0.22 },
    uPeelScale: { value: t.orangePeelScale ?? 160 },
    uMicroRepeat: { value: t.microRepeat ?? 40 },
    uSunDirView: { value: new THREE.Vector3(0.4, 0.8, 0.45).normalize() },
    uMicroNormalMap: { value: t.microNormalMap ?? null },
  }
  const full = quality === 'full'
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', COMMON_VERT).replace('#include <begin_vertex>', BEGIN_VERT)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', COMMON_FRAG)
      .replace('#include <clearcoat_normal_fragment_maps>', CLEARCOAT_FRAG)
      .replace('#include <emissivemap_fragment>', EMISSIVE_FRAG)
    const defs: Record<string, string> = { ...(shader.defines ?? {}) }
    if (full) defs.CP_FULL = ''
    if (t.microNormalMap) defs.USE_CP_MICRONORMAL = ''
    shader.defines = defs
  }
  mat.customProgramCacheKey = () => `carpaint-${quality}-${t.microNormalMap ? 'micro' : 'proc'}`
  mat.userData.carPaint = u
  registry.add(mat)
  mat.addEventListener('dispose', () => registry.delete(mat))
  mat.needsUpdate = true
}

/** Меняет цвет блёсток (обычно светлый оттенок краски) */
export function setCarPaintFlakeColor(mat: THREE.MeshPhysicalMaterial, color: THREE.ColorRepresentation) {
  const u = mat.userData.carPaint as UniformMap | undefined
  if (u) (u.uFlakeColor.value as THREE.Color).set(color)
}

/** Сила студийного отражения: в сценах с картой окружения уменьшайте */
export function setCarPaintFakeEnv(mat: THREE.MeshPhysicalMaterial, v: number) {
  const u = mat.userData.carPaint as UniformMap | undefined
  if (u) u.uFakeEnv.value = v
}

/** Направление «солнца» для блёсток: вызывайте раз в кадр. worldDir — от поверхности к солнцу в мире. */
export function setCarPaintSun(mat: THREE.MeshPhysicalMaterial, camera: THREE.Camera, worldDir: THREE.Vector3) {
  const u = mat.userData.carPaint as UniformMap | undefined
  if (!u) return
  const v = u.uSunDirView.value as THREE.Vector3
  v.copy(worldDir).transformDirection(camera.matrixWorldInverse).normalize()
}

/** Готовый материал «автокраска» (для сторонних мешей) */
export function createCarPaintMaterial(opts: CarPaintOptions = {}): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: opts.color ?? 0xb3122a,
    metalness: opts.metalness ?? 0.7,
    roughness: opts.roughness ?? 0.35,
    clearcoat: opts.clearcoat ?? 1,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.04,
    envMapIntensity: opts.envMapIntensity ?? 1.4,
    normalMap: opts.normalMap ?? null,
    ior: 1.5,
  })
  if (opts.normalMap) mat.normalScale.set(opts.normalScale ?? 1, opts.normalScale ?? 1)
  applyCarPaint(mat, opts.quality ?? 'full', opts)
  return mat
}
