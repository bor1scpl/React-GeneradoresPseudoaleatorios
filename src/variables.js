/*================================================================
   variables.js
   Generación de Variables Aleatorias No-Uniformes — Coss Bu Cap. 4
   Transforma U_i ∈ [0,1) en valores de las distribuciones indicadas.
   Todas las funciones son puras (sin React).
   Métodos implementados:
     - Transformada Inversa  (§4.1): Exponencial, Uniforme, Poisson
     - Procedimientos Esp.   (§4.4): Normal (Box-Muller fuera del libro), Erlang, Binomial
================================================================ */
// ───────────────────────────────────────────────
//  Distribuciones disponibles y sus fórmulas, parámetros, restricciones y fórmulas para análisis
// ───────────────────────────────────────────────
export const DISTRIBUCIONES = [
  {
    id: 'exponencial',
    nombre: 'Exponencial',
    metodo: 'Transformada Inversa (§4.1)',
    formula: 'x = −(1/λ) · ln R',
    params: [
      { key: 'lambda', label: 'λ (tasa)', hint: 'λ > 0  (media = 1/λ)', min: 0.001 },
    ],
    restricciones: [
      'λ > 0 — tasa de ocurrencia del evento.',
      'Media teórica = 1/λ.',
      'Requiere 1 número uniforme R por valor generado.',
    ],
    excelFormulas: [
      { titulo: 'Generar valor (Inv. Transform)', formula: '=-（1/λ）*LN(R)', ejemplo: '=-(1/0.5)*LN(A2)', nota: 'donde A2 es el U_i ∈ (0,1)' },
      { titulo: 'Distribución acumulada F(x)', formula: '=DISTR.EXP.N(x; λ; VERDADERO)', ejemplo: '=DISTR.EXP.N(2; 0.5; VERDADERO)', nota: 'P(X ≤ x) para verificar ajuste' },
      { titulo: 'Valor esperado teórico (1/λ)', formula: '=1/λ', ejemplo: '=1/0.5', nota: 'Media de la distribución' },
      { titulo: 'Varianza teórica (1/λ²)', formula: '=1/λ^2', ejemplo: '=1/0.5^2', nota: 'Varianza teórica' },
      { titulo: 'Contar valores ≤ umbral', formula: '=CONTAR.SI(rango;"<=umbral")/CONTARA(rango)', ejemplo: '=CONTAR.SI(B2:B101;"<=3")/100', nota: 'Frecuencia acumulada empírica' },
    ],
  },
  {
    id: 'uniforme',
    nombre: 'Uniforme (a, b)',
    metodo: 'Transformada Inversa (§4.1)',
    formula: 'x = a + (b − a) · R',
    params: [
      { key: 'a', label: 'a (mínimo)', hint: 'extremo inferior', min: -1e9 },
      { key: 'b', label: 'b (máximo)', hint: 'extremo superior, b > a', min: -1e9 },
    ],
    restricciones: [
      'b > a — el intervalo debe ser positivo.',
      'Media teórica = (a + b) / 2.',
      'Requiere 1 número uniforme R por valor generado.',
    ],
    excelFormulas: [
      { titulo: 'Generar valor (Inv. Transform)', formula: '=a+(b-a)*R', ejemplo: '=2+(8-2)*A2', nota: 'donde A2 es el U_i ∈ [0,1)' },
      { titulo: 'Media teórica', formula: '=(a+b)/2', ejemplo: '=(2+8)/2', nota: 'Valor esperado E[X]' },
      { titulo: 'Varianza teórica', formula: '=(b-a)^2/12', ejemplo: '=(8-2)^2/12', nota: 'Varianza teórica' },
      { titulo: 'Desviación estándar teórica', formula: '=(b-a)/RAIZ(12)', ejemplo: '=(8-2)/RAIZ(12)', nota: 'σ teórica' },
      { titulo: 'Verificar media muestral', formula: '=PROMEDIO(rango)', ejemplo: '=PROMEDIO(B2:B101)', nota: 'Debe ≈ (a+b)/2' },
    ],
  },
  {
    id: 'normal',
    nombre: 'Normal (μ, σ)',
    metodo: 'Box-Muller — Procedimiento Especial (§4.4)',
    formula: 'Z₁=√(−2·ln U₁)·cos(2π·U₂)  →  X = μ + σ·Z₁\nZ₂=√(−2·ln U₁)·sin(2π·U₂)  →  Y = μ + σ·Z₂',
    params: [
      { key: 'mu',    label: 'μ (media)',           hint: 'cualquier real', min: -1e9 },
      { key: 'sigma', label: 'σ (desv. estándar)',  hint: 'σ > 0',         min: 0.001 },
    ],
    restricciones: [
      'σ > 0 — desviación estándar positiva; μ puede ser cualquier real.',
      'Se genera U₁, U₂ ~ Uniforme(0,1) independientes.',
      'Z₁ = √(−2 ln U₁) · cos(2π U₂)   →   X1 = μ + σ · Z₁.',
      'Z₂ = √(−2 ln U₁) · sin(2π U₂)   →   X2 = μ + σ · Z₂.',
      'Cada par (U₁,U₂) produce dos valores normales independientes tipificados (X1, X2).',
      'Z₁ y Z₂ siguen N(0,1); X1 y X2 siguen N(μ, σ²).',
    ],
    excelFormulas: [
      { titulo: 'Generar X — Box-Muller (Z₁)', formula: '=μ + σ*RAIZ(-2*LN(U1))*COS(2*PI()*U2)', ejemplo: '=10+2*RAIZ(-2*LN(A2))*COS(2*PI()*B2)', nota: 'U1=col A, U2=col B; un par produce 2 valores' },
      { titulo: 'Generar Y — Box-Muller (Z₂)', formula: '=μ + σ*RAIZ(-2*LN(U1))*SEN(2*PI()*U2)', ejemplo: '=10+2*RAIZ(-2*LN(A2))*SEN(2*PI()*B2)', nota: 'Mismos U1, U2 → segundo valor independiente' },
      { titulo: 'Normal estándar tipificada Z', formula: '=(X - μ)/σ', ejemplo: '=(C2-10)/2', nota: 'Estandariza para comparar con N(0,1)' },
      { titulo: 'Distribución acumulada Φ(x)', formula: '=NORM.DIST(x; μ; σ; VERDADERO)', ejemplo: '=NORM.DIST(12; 10; 2; VERDADERO)', nota: 'P(X ≤ x) — para resolver preguntas de probabilidad' },
      { titulo: 'Valor crítico / cuantil', formula: '=DISTR.NORM.INV(probabilidad; μ; σ)', ejemplo: '=DISTR.NORM.INV(0.9; 10; 2)', nota: 'Tiempo a asignar para P(X>t) = 0.10' },
      { titulo: 'Verificar media y varianza', formula: '=PROMEDIO(rango)  /  =VAR(rango)', ejemplo: '=PROMEDIO(C2:C101)  /  =VAR(C2:C101)', nota: 'Deben ≈ μ y σ² respectivamente' },
    ],
  },
  {
    id: 'poisson',
    nombre: 'Poisson (λ)',
    metodo: 'Transformada Inversa discreta (§4.1 / §4.4)',
    formula: 'Acumulada: x = min{k : P(X≤k) ≥ R}',
    params: [
      { key: 'lambda', label: 'λ (media)',  hint: 'λ > 0  (eventos por unidad de tiempo)', min: 0.001 },
    ],
    restricciones: [
      'λ > 0 — número promedio de eventos.',
      'Función: f(x) = e^(−λ) · λˣ / x!   para x = 0,1,2,…',
      'Se acumula F(x) hasta F(x) ≥ R → ese x es el valor generado.',
      'Requiere 1 número uniforme R por valor generado.',
    ],
    excelFormulas: [
      { titulo: 'Probabilidad puntual P(X=k)', formula: '=POISSON.DIST(k; λ; FALSO)', ejemplo: '=POISSON.DIST(3; 5; FALSO)', nota: 'P(X=k) = e^(-λ)·λᵏ/k!' },
      { titulo: 'Probabilidad acumulada P(X≤k)', formula: '=POISSON.DIST(k; λ; VERDADERO)', ejemplo: '=POISSON.DIST(3; 5; VERDADERO)', nota: 'F(k) para comparar con R' },
      { titulo: 'Tabla F(k) vs R (buscar x)', formula: '=COINCIDIR(R; tabla_Fk; 1)', ejemplo: '=COINCIDIR(A2; F2:F20; 1)-1', nota: 'Devuelve el índice k tal que F(k)≥R' },
      { titulo: 'Verificar media muestral', formula: '=PROMEDIO(rango)', ejemplo: '=PROMEDIO(B2:B101)', nota: 'Debe ≈ λ' },
      { titulo: 'Verificar varianza muestral', formula: '=VAR(rango)', ejemplo: '=VAR(B2:B101)', nota: 'Debe ≈ λ (Poisson: media=varianza)' },
      { titulo: 'Contar frecuencia de un valor k', formula: '=CONTAR.SI(rango; k)', ejemplo: '=CONTAR.SI(B2:B101; 3)', nota: 'Frecuencia absoluta de X=k' },
    ],
  },
  {
    id: 'binomial',
    nombre: 'Binomial (n, θ)',
    metodo: 'Procedimiento Especial (§4.4)',
    formula: 'x = Σ(R_i < θ)  para i=1..n',
    params: [
      { key: 'n',     label: 'n (ensayos)',       hint: 'entero ≥ 1',   min: 1 },
      { key: 'theta', label: 'θ (probabilidad)',  hint: '0 < θ < 1',    min: 0.001, max: 0.999 },
    ],
    restricciones: [
      'n ≥ 1 — número de ensayos de Bernoulli.',
      '0 < θ < 1 — probabilidad de éxito en cada ensayo.',
      'x = número de uniformes R < θ entre n generados.',
      'Requiere n números uniformes por valor generado.',
    ],
    excelFormulas: [
      { titulo: 'Probabilidad puntual P(X=k)', formula: '=BINOM.DIST(k; n; θ; FALSO)', ejemplo: '=BINOM.DIST(3; 10; 0.4; FALSO)', nota: 'P(X=k)' },
      { titulo: 'Probabilidad acumulada P(X≤k)', formula: '=BINOM.DIST(k; n; θ; VERDADERO)', ejemplo: '=BINOM.DIST(3; 10; 0.4; VERDADERO)', nota: 'F(k) acumulada' },
      { titulo: 'Media teórica n·θ', formula: '=n*θ', ejemplo: '=10*0.4', nota: 'E[X] = n·θ' },
      { titulo: 'Varianza teórica n·θ·(1-θ)', formula: '=n*θ*(1-θ)', ejemplo: '=10*0.4*0.6', nota: 'Var[X] = n·θ·(1−θ)' },
      { titulo: 'Contar éxitos en fila de U_i', formula: '=CONTAR.SI(rango_Ri;"<θ")', ejemplo: '=CONTAR.SI(A2:A11;"<0.4")', nota: 'Simular 1 valor Bernoulli por fila' },
    ],
  },
  {
    id: 'erlang',
    nombre: 'Erlang (n, λ)',
    metodo: 'Procedimiento Especial (§4.4)',
    formula: 'x = −(1/λ) · ln(∏R_i)  para i=1..n',
    params: [
      { key: 'n',      label: 'n (etapas)',  hint: 'entero ≥ 1',   min: 1 },
      { key: 'lambda', label: 'λ (tasa)',    hint: 'λ > 0',        min: 0.001 },
    ],
    restricciones: [
      'n ≥ 1 — número de etapas exponenciales (debe ser entero).',
      'λ > 0 — tasa de cada etapa exponencial.',
      'Media teórica = n / λ.',
      'Requiere n números uniformes por valor generado.',
    ],
    excelFormulas: [
      { titulo: 'Generar 1 valor Erlang (n etapas)', formula: '=-(1/λ)*LN(PRODUCTO(R1:Rn))', ejemplo: '=-(1/0.5)*LN(PRODUCTO(A2:A4))', nota: 'Producto de n U_i consecutivos' },
      { titulo: 'Suma de n exponenciales (equiv.)', formula: '=SUMA(-（1/λ）*LN(R_i))', ejemplo: '=SUMA(-(1/0.5)*LN(A2:A4))', nota: 'Fórmula matricial: Ctrl+Shift+Enter' },
      { titulo: 'Media teórica n/λ', formula: '=n/λ', ejemplo: '=3/0.5', nota: 'E[X] = n/λ' },
      { titulo: 'Varianza teórica n/λ²', formula: '=n/λ^2', ejemplo: '=3/0.5^2', nota: 'Var[X] = n/λ²' },
      { titulo: 'Verificar media muestral', formula: '=PROMEDIO(rango)', ejemplo: '=PROMEDIO(B2:B101)', nota: 'Debe ≈ n/λ' },
    ],
  },
];

// ───────────────────────────────────────────────
//  Generadores por distribucion (implementación de fórmulas)
// ───────────────────────────────────────────────

function _exponencial(ui, { lambda }) {
  const valores = [];
  for (let i = 0; i < ui.length; i++) {
    const R = ui[i] === 0 ? 1e-10 : ui[i];
    valores.push(-lambda * Math.log(R));  // al ser 1/lambda, tomara directamente los valores de media que se pueden presentar.
  }
  return valores;
}

function _uniforme(ui, { a, b }) {
  return ui.map(R => a + (b - a) * R);
}

function _normal(ui, { mu, sigma }) {
  const valores = [];
  for (let i = 0; i + 1 < ui.length; i += 2) {
    const R1 = ui[i]   === 0 ? 1e-10 : ui[i];
    const R2 = ui[i+1];
    const Z1 = Math.sqrt(-2 * Math.log(R1)) * Math.cos(2 * Math.PI * R2);
    const Z2 = Math.sqrt(-2 * Math.log(R1)) * Math.sin(2 * Math.PI * R2);
    valores.push(mu + sigma * Z1);
    valores.push(mu + sigma * Z2);
  }
  return valores;
}

function _poisson(ui, { lambda }) {
  const valores = [];
  for (const R of ui) {
    let k = 0;
    let Fk = Math.exp(-lambda);
    let pk = Fk;
    while (Fk < R && k < 200) {
      k++;
      pk *= lambda / k;
      Fk += pk;
    }
    valores.push(k);
  }
  return valores;
}

function _binomial(ui, { n, theta }) {
  const nInt = Math.max(1, Math.floor(n));
  const valores = [];
  for (let i = 0; i + nInt <= ui.length; i += nInt) {
    let exitos = 0;
    for (let j = 0; j < nInt; j++) {
      if (ui[i + j] < theta) exitos++;
    }
    valores.push(exitos);
  }
  return valores;
}

function _erlang(ui, { n, lambda }) {
  const nInt = Math.max(1, Math.floor(n));
  const valores = [];
  for (let i = 0; i + nInt <= ui.length; i += nInt) {
    let producto = 1;
    for (let j = 0; j < nInt; j++) {
      const R = ui[i + j] === 0 ? 1e-10 : ui[i + j];
      producto *= R;
    }
    valores.push(-1 / lambda * Math.log(producto));
  }
  return valores;
}

// ───────────────────────────────────────────────
//  Dispatcher principal: recibe distId, parámetros y uniformes; valida y llama al generador específico
// ───────────────────────────────────────────────

export function generarVariables(distId, ui, params) {
  const errores = [];
  let valores = [];

  if (!ui || ui.length === 0) {
    return { valores: [], errores: ['No hay números uniformes disponibles.'], uniformesUsados: 0 };
  }

  switch (distId) {
    case 'exponencial': {
      const { lambda } = params;
      if (!lambda || lambda <= 0) { errores.push('λ debe ser > 0.'); break; }
      valores = _exponencial(ui, { lambda });
      break;
    }
    case 'uniforme': {
      const { a, b } = params;
      if (a == null || b == null) { errores.push('Debes ingresar a y b.'); break; }
      if (b <= a) { errores.push('b debe ser mayor que a.'); break; }
      valores = _uniforme(ui, { a, b });
      break;
    }
    case 'normal': {
      const { mu, sigma } = params;
      if (mu == null) { errores.push('Debes ingresar μ.'); break; }
      if (!sigma || sigma <= 0) { errores.push('σ debe ser > 0.'); break; }
      if (ui.length < 2) { errores.push('Se necesitan al menos 2 uniformes.'); break; }
      valores = _normal(ui, { mu, sigma });
      break;
    }
    case 'poisson': {
      const { lambda } = params;
      if (!lambda || lambda <= 0) { errores.push('λ debe ser > 0.'); break; }
      valores = _poisson(ui, { lambda });
      break;
    }
    case 'binomial': {
      const { n, theta } = params;
      if (!n || n < 1) { errores.push('n debe ser ≥ 1.'); break; }
      if (theta == null || theta <= 0 || theta >= 1) { errores.push('θ debe estar en (0,1).'); break; }
      if (ui.length < Math.floor(n)) { errores.push(`Se necesitan al menos ${Math.floor(n)} uniformes.`); break; }
      valores = _binomial(ui, { n, theta });
      break;
    }
    case 'erlang': {
      const { n, lambda } = params;
      if (!n || n < 1) { errores.push('n debe ser ≥ 1.'); break; }
      if (!lambda || lambda <= 0) { errores.push('λ debe ser > 0.'); break; }
      if (ui.length < Math.floor(n)) { errores.push(`Se necesitan al menos ${Math.floor(n)} uniformes.`); break; }
      valores = _erlang(ui, { n, lambda });
      break;
    }
    default:
      errores.push(`Distribución "${distId}" no reconocida.`);
  }

  const uniformesPorValor = {
    exponencial: 1,
    uniforme:    1,
    normal:      2,
    poisson:     1,
    binomial:    Math.max(1, Math.floor(params.n || 1)),
    erlang:      Math.max(1, Math.floor(params.n || 1)),
  };
  const uPorVal = uniformesPorValor[distId] || 1;
  const uniformesUsados = valores.length * uPorVal;

  return { valores, errores, uniformesUsados };
}

// ───────────────────────────────────────────────
//  Estadisticas descriptivas básicas para un array de valores: n, media, mediana, min, max, desviación estándar y varianza
// ───────────────────────────────────────────────

export function estadisticasDescriptivas(valores) {
  if (!valores || valores.length === 0) return null;
  const n = valores.length;
  const media = valores.reduce((a, b) => a + b, 0) / n;
  const sorted = [...valores].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const mediana = n % 2 === 0
    ? (sorted[n/2 - 1] + sorted[n/2]) / 2
    : sorted[Math.floor(n/2)];
  const varianza = valores.reduce((s, x) => s + Math.pow(x - media, 2), 0) / n;
  const desv = Math.sqrt(varianza);

  return { n, media, mediana, min, max, desv, varianza };
}
