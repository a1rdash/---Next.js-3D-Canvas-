import * as THREE from 'three'

/**
 * Реалистичная автомобильная краска для Three.js (GLSL внутри MeshPhysicalMaterial через onBeforeCompile).
 *
 * Что делает шейдер:
 *  1. Clear Coat — верхний слой лака: чёткие зеркальные отражения окружения по Френелю (встроенный clearcoat
 *     физического материала Three.js: F0 ≈ 0.04, независимая шероховатость и нормаль слоя).
 *  2. Metallic flakes — нижний слой с блёстками: два масштаба процедурных «пластинок» со случайными нормалями;
 *     блеск зависит от угла между нормалью пластинки и полувектором H = normalize(L + V), поэтому переливается
 *     при движении камеры и солнца.
 *  3. Поглощение / глубина цвета: на изгибах, уходящих от камеры, база темнеет (Френель-затемнение, с оттенком),
 *     имитируя поглощение света в толстом слое краски под лаком.
 *  4. Нормали: основная карта (детали кузова) и микро-нормаль «шагрень» (orange peel) на слое лака
 *     смешиваются корректно методом Reoriented Normal Mapping (RNM) в тангенциальном пространстве;
 *     без карты используется процедурная шагрень.
 *
 * Совместимо с Three.js r150+ (чанки meshphysical). Солнце для блёсток задаётся setCarPaintSun().
 */

export interface CarPaintOptions {
  /** Цвет кузова (база краски) */
  color?: THREE.ColorRepresentation
  /** Цвет металлических блёсток */
  flakeColor?: THREE.ColorRepresentation
  /** Интенсивность блеска блёсток (0…4) */
  flakeIntensity?: number
  /** Размер фракций: число ячеек на единицу объекта (больше = мельче) */
  flakeScale?: number
  /** Плотность блёсток 0…1 */
  flakeDensity?: number
  /** Резкость блика (больше = точечнее) */
  flakeSharpness?: number
  /** Сила наклона нормали блёсток (0…1) */
  flakeBump?: number
  /** Базовая металлизация и шероховатость нижнего слоя */
  metalness?: number
  roughness?: number
  /** Зеркальность лака: интенсивность clearcoat 0…1 и его шероховатость (0.02–0.1) */
  clearcoat?: number
  clearcoatRoughness?: number
  /** Сила отражений окружения */
  envMapIntensity?: number
  /** Затемнение базы на краях (0…1) и степень кривой Френеля */
  edgeDarken?: number
  edgePower?: number
  /** Оттенок затемнения (глубокий цвет краски в тени) */
  edgeTint?: THREE.ColorRepresentation
  /** Основная карта нормалей (детали кузова) и её сила */
  normalMap?: THREE.Texture | null
  normalScale?: number
  /** Микро-нормаль шагрени лака: текстура (необязательно), повтор и сила */
  microNormalMap?: THREE.Texture | null
  microRepeat?: number
  orangePeel?: number
  /** Размер шагрени для процедурной версии (ячеек на единицу) */
  orangePeelScale?: number
}

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
// оси объекта в пространстве вида: нужны, чтобы перевести «объектные» градиенты и нормали блёсток в view space
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
uniform float uFlakeBump;
uniform float uEdgeDarken;
uniform float uEdgePower;
uniform vec3  uEdgeTint;
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
float cpHash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
// value-noise (3D), гладкая интерполяция
float cpNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = cpHash13(i);
  float n100 = cpHash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = cpHash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = cpHash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = cpHash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = cpHash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = cpHash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = cpHash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
// градиент шума конечными разностями (два масштаба = «апельсиновая корка»)
vec3 cpPeelGrad(vec3 p) {
  const float e = 0.12;
  float a = cpNoise(p) + 0.5 * cpNoise(p * 2.3);
  float gx = cpNoise(p + vec3(e, 0.0, 0.0)) + 0.5 * cpNoise((p + vec3(e, 0.0, 0.0)) * 2.3) - a;
  float gy = cpNoise(p + vec3(0.0, e, 0.0)) + 0.5 * cpNoise((p + vec3(0.0, e, 0.0)) * 2.3) - a;
  float gz = cpNoise(p + vec3(0.0, 0.0, e)) + 0.5 * cpNoise((p + vec3(0.0, 0.0, e)) * 2.3) - a;
  return vec3(gx, gy, gz) / e;
}
vec3 cpToView(vec3 g) { return vCpX * g.x + vCpY * g.y + vCpZ * g.z; }
// возмущение нормали градиентом высоты (bump), градиент проецируется в касательную плоскость
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
// один слой блёсток: возвращает (интенсивность блика, вклад в наклон)
float cpFlakeLayer(vec3 pObj, float scale, vec3 N, vec3 V, vec3 H, out vec3 flakeN) {
  vec3 fp = pObj * scale;
  vec3 cell = floor(fp);
  vec3 h = cpHash33(cell);
  vec3 local = fract(fp) - 0.5;
  float shape = smoothstep(0.5, 0.18, length(local));        // круглые пластинки
  float present = step(h.z, uFlakeDensity);                  // плотность
  vec3 fnv = normalize(cpToView(normalize(h * 2.0 - 1.0)));
  if (dot(fnv, N) < 0.0) fnv = -fnv;                         // пластинка смотрит наружу
  flakeN = normalize(mix(N, fnv, uFlakeBump));
  float spark = pow(max(dot(flakeN, H), 0.0), uFlakeSharp);
  return spark * shape * present;
}
`

const NORMAL_FRAG = /* glsl */ `
#include <normal_fragment_maps>
// --- микро-неровности нижнего слоя (лёгкая зернистость базы) ---
normal = cpPerturb(normal, cpToView(cpPeelGrad(vCpObj * uPeelScale * 0.6)) * uPeel * 0.25);
`

const CLEARCOAT_FRAG = /* glsl */ `
#include <clearcoat_normal_fragment_maps>
#ifdef USE_CLEARCOAT
  #if defined( USE_NORMALMAP_TANGENTSPACE ) && defined( USE_CP_MICRONORMAL )
    // основная нормаль кузова + микро-нормаль шагрени (RNM) → нормаль слоя лака
    vec3 cpBaseTS = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
    cpBaseTS.xy *= normalScale;
    vec3 cpMicroTS = texture2D( uMicroNormalMap, vNormalMapUv * uMicroRepeat ).xyz * 2.0 - 1.0;
    cpMicroTS.xy *= uPeel;
    clearcoatNormal = normalize( tbn * cpBlendRNM( normalize( cpBaseTS ), normalize( cpMicroTS ) ) );
  #else
    // процедурная шагрень поверх нормали лака (в т.ч. поверх карты кузова, если она есть)
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

  // 3) поглощение: чем круче поверхность к взгляду, тем глубже и темнее цвет под лаком
  float cpEdge = pow( 1.0 - cpNdV, uEdgePower );
  diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * uEdgeTint, clamp( cpEdge * uEdgeDarken * 1.6, 0.0, 1.0 ) );
  diffuseColor.rgb *= 1.0 - uEdgeDarken * 0.5 * cpEdge;

  // 2) металлические блёстки: два масштаба; цвет «переливается» от угла обзора
  vec3 cpFN1; vec3 cpFN2;
  float cpS1 = cpFlakeLayer( vCpObj, uFlakeScale, cpN, cpV, cpH, cpFN1 );
  float cpS2 = cpFlakeLayer( vCpObj + 17.3, uFlakeScale * 0.43, cpN, cpV, cpH, cpFN2 );
  float cpSpark = cpS1 + 0.6 * cpS2;
  vec3 cpShift = mix( uFlakeColor, uFlakeColor * vec3( 0.75, 0.9, 1.25 ), 1.0 - cpNdV ); // flip-flop
  // блёстки видны сквозь лак слабее на скользящих углах (лак отражает больше)
  totalEmissiveRadiance += cpShift * cpSpark * uFlakeIntensity * ( 0.35 + 0.65 * cpNdV );
}
`

const UNIFORM_DEFAULTS = {
  uFlakeColor: new THREE.Color(0xffffff),
  uFlakeIntensity: 1.2,
  uFlakeScale: 70,
  uFlakeDensity: 0.55,
  uFlakeSharp: 90,
  uFlakeBump: 0.55,
  uEdgeDarken: 0.45,
  uEdgePower: 3,
  uEdgeTint: new THREE.Color(0x0b0d14),
  uPeel: 0.25,
  uPeelScale: 160,
  uMicroRepeat: 40,
}

/**
 * Создаёт материал автомобильной краски.
 * Параметры доступны позже через material.userData.carPaint (uniforms) для живой настройки.
 */
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

  const u: Record<string, { value: unknown }> = {
    uFlakeColor: { value: new THREE.Color(opts.flakeColor ?? UNIFORM_DEFAULTS.uFlakeColor) },
    uFlakeIntensity: { value: opts.flakeIntensity ?? UNIFORM_DEFAULTS.uFlakeIntensity },
    uFlakeScale: { value: opts.flakeScale ?? UNIFORM_DEFAULTS.uFlakeScale },
    uFlakeDensity: { value: opts.flakeDensity ?? UNIFORM_DEFAULTS.uFlakeDensity },
    uFlakeSharp: { value: opts.flakeSharpness ?? UNIFORM_DEFAULTS.uFlakeSharp },
    uFlakeBump: { value: opts.flakeBump ?? UNIFORM_DEFAULTS.uFlakeBump },
    uEdgeDarken: { value: opts.edgeDarken ?? UNIFORM_DEFAULTS.uEdgeDarken },
    uEdgePower: { value: opts.edgePower ?? UNIFORM_DEFAULTS.uEdgePower },
    uEdgeTint: { value: new THREE.Color(opts.edgeTint ?? UNIFORM_DEFAULTS.uEdgeTint) },
    uPeel: { value: opts.orangePeel ?? UNIFORM_DEFAULTS.uPeel },
    uPeelScale: { value: opts.orangePeelScale ?? UNIFORM_DEFAULTS.uPeelScale },
    uMicroRepeat: { value: opts.microRepeat ?? UNIFORM_DEFAULTS.uMicroRepeat },
    uSunDirView: { value: new THREE.Vector3(0.4, 0.8, 0.45).normalize() },
    uMicroNormalMap: { value: opts.microNormalMap ?? null },
  }

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', COMMON_VERT)
      .replace('#include <begin_vertex>', BEGIN_VERT)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', COMMON_FRAG)
      .replace('#include <normal_fragment_maps>', NORMAL_FRAG)
      .replace('#include <clearcoat_normal_fragment_maps>', CLEARCOAT_FRAG)
      .replace('#include <emissivemap_fragment>', EMISSIVE_FRAG)
    if (opts.microNormalMap) shader.defines = { ...(shader.defines ?? {}), USE_CP_MICRONORMAL: '' }
  }
  // отдельный ключ кэша программ: материалы с микро-картой и без неё компилируются по-разному
  mat.customProgramCacheKey = () => `carpaint-${opts.microNormalMap ? 'micro' : 'proc'}`
  mat.userData.carPaint = u
  return mat
}

/**
 * Обновляет направление «солнца» для блёсток. Вызывайте при движении камеры/солнца (раз в кадр).
 * @param worldDir направление ОТ поверхности К солнцу в мировых координатах
 */
export function setCarPaintSun(mat: THREE.MeshPhysicalMaterial, camera: THREE.Camera, worldDir: THREE.Vector3) {
  const u = mat.userData.carPaint as Record<string, { value: unknown }> | undefined
  if (!u) return
  const v = u.uSunDirView.value as THREE.Vector3
  v.copy(worldDir).transformDirection(camera.matrixWorldInverse).normalize()
}
