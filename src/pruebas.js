/* pruebas.js
Pruebas estadísticas de aleatoriedad — Coss Bu Cap. 3
Trabaja exclusivamente con los U_i ∈ [0,1].
*/

// ───────────────────────────────────────────────────────────────
//  CONSTANTES ESTADÍSTICAS 
// ───────────────────────────────────────────────────────────────

/*Valor crítico Z para α=0.05 → Z_α/2 = 1.96*/
export const Z_CRITICO_05 = 1.96;

/*Valores críticos d_α,n de Kolmogorov-Smirnov (Coss Bu, Tabla 3.5), Para n > 100 usa la fórmula aproximada 1.36/sqrt(n).*/
export function dCriticoKS(n, alpha = 0.05) {
  if (n > 100) return 1.36 / Math.sqrt(n);
  const tabla05 = {
    1:0.975, 2:0.842, 3:0.708, 4:0.624, 5:0.563,
    6:0.521, 7:0.486, 8:0.457, 9:0.432, 10:0.409,
    11:0.391, 12:0.375, 13:0.361, 14:0.349, 15:0.338,
    16:0.328, 17:0.318, 18:0.309, 19:0.301, 20:0.294,
    25:0.264, 30:0.242, 35:0.230, 40:0.210, 50:0.188,
    60:0.172, 70:0.160, 80:0.150, 90:0.141, 100:0.134,
  };
  //Buscar el valor exacto o con el más cercano
  if (tabla05[n] !== undefined) return tabla05[n];
  const claves = Object.keys(tabla05).map(Number).sort((a,b)=>a-b);
  const menor = claves.filter(k => k < n).pop();
  const mayor = claves.find(k => k > n);
  if (!menor) return tabla05[claves[0]];
  if (!mayor) return tabla05[claves[claves.length-1]];
  const t = (n - menor) / (mayor - menor);
  return tabla05[menor] + t * (tabla05[mayor] - tabla05[menor]);
}

/*Valor crítico chi-cuadrado X²_α,(gl) para α=0.05.Tabla embebida para los grados de libertad más comunes.*/
export function chiCuadradoCritico(gl, alpha = 0.05) {
  const tabla = {
    1:3.841, 2:5.991, 3:7.815, 4:9.488, 5:11.070,
    6:12.592, 7:14.067, 8:15.507, 9:16.919, 10:18.307,
    11:19.675, 12:21.026, 13:22.362, 14:23.685, 15:24.996,
    16:26.296, 17:27.587, 18:28.869, 19:30.144, 20:31.410,
    24:36.415, 25:37.652, 29:42.557, 30:43.773,
    35:49.802, 40:55.758, 45:61.656, 50:67.505,
    60:79.082, 70:90.531, 80:101.879, 90:113.145, 100:124.342,
  };
  if (tabla[gl] !== undefined) return tabla[gl];
  const p = 1 - alpha;
  const z = 1.6449; // z_0.95 para α=0.05
  const h = 2 / (9 * gl);
  return gl * Math.pow(1 - h + z * Math.sqrt(h), 3);
}

// ───────────────────────────────────────────────────────────────
//  FUNCIÓN AUXILIAR: parsear 
//  
//  i,X_i (Entero),U_i (Normalizado [0-1])
//  Esta función extrae solo la columna U_i.
// ───────────────────────────────────────────────────────────────

export function parsearArchivo(texto) {
  const errores = [];
  const limpio = texto.replace(/^\uFEFF/, '').trim();
  const lineas = limpio.split(/\r?\n/).filter(l => l.trim() !== '');

  if (lineas.length < 2) {
    errores.push('El archivo está vacío o solo tiene encabezado.');
    return { ui: [], errores };
  }

  //Detectar cuántas columnas hay y cuál es la de U_i
  const cols = lineas[0].split(',');
  let colUI = -1;

  if (cols.length === 1) {
    colUI = 0; 
  } else if (cols.length === 2) {
    colUI = 1;
  } else {
    for (let c = 0; c < cols.length; c++) {
      const h = cols[c].toLowerCase();
      if (h.includes('u_i') || h.includes('uniform') || h.includes('normaliz') || h.includes('[0')) {
        colUI = c;
        break;
      }
    }
    if (colUI === -1) colUI = cols.length - 1;
  }

  const ui = [];
  const inicio = isNaN(parseFloat(lineas[0].split(',')[colUI])) ? 1 : 0;
  
  for (let i = inicio; i < lineas.length; i++) {
    const partes = lineas[i].split(',');
    if (partes.length <= colUI) continue;
    
    let valorLimpio = partes[colUI].trim().replace(/["']/g, '');
    
    valorLimpio = valorLimpio.replace(',', '.');
    
    const v = parseFloat(valorLimpio);
    if (isNaN(v)) continue;
    
    if (v < 0 || v > 1) {
      errores.push(`Línea ${i+1}: valor ${v} fuera de [0,1]. Se omite.`);
      continue;
    }
    ui.push(v);
  }

  if (ui.length === 0) {
    errores.push('No se encontraron valores U_i válidos en [0,1].');
  } else if (ui.length < 20) {
    errores.push(`Solo se encontraron ${ui.length} valores. Se recomienda al menos 20 para pruebas confiables.`);
  }

  return { ui, errores };
}

// ═══════════════════════════════════════════════════════════════
//  PRUEBA 1 — PRUEBA DE PROMEDIOS  (Coss Bu §3.1)
// ═══════════════════════════════════════════════════════════════

/**
 * @param {number[]} ui  Números uniformes ∈ [0,1]
 * @param {number}  alpha Nivel de significado (0.05)
 * @returns {object} Resultado completo de la prueba
 */
export function pruebaPromedios(ui, alpha = 0.05) {
  const N = ui.length;
  if (N < 2) return { error: 'Se necesitan al menos 2 valores.' };

  const media = ui.reduce((a, b) => a + b, 0) / N;
  //Fórmula según el libro: Z₀ = (x̄ - 1/2) * sqrt(N) / sqrt(1/12)
  const Z0 = (media - 0.5) * Math.sqrt(N) / Math.sqrt(1 / 12);
  const Zc = Z_CRITICO_05;

  return {
    nombre: 'Prueba de promedios',
    N,
    media: media,
    Z0: Z0,
    Zc: Zc,
    //No se rechaza Ho si |Z0| < Zc
    pasa: Math.abs(Z0) < Zc,
    detalle: [
      { param: 'N (muestra)',       valor: N },
      { param: 'x̄ (media)',        valor: media.toFixed(6) },
      { param: 'μ esperada',        valor: '0.5' },
      { param: 'Z₀ calculado',      valor: Z0.toFixed(4) },
      { param: 'Z_α/2 crítico',     valor: Zc.toFixed(4) },
      { param: '|Z₀| < Z_α/2',      valor: Math.abs(Z0) < Zc ? 'SÍ' : 'NO' },
    ],
    interpretacion: Math.abs(Z0) < Zc
      ? `|Z₀| = ${Math.abs(Z0).toFixed(4)} < ${Zc} → No se rechaza Ho. La media ≈ 0.5 es estadísticamente aceptable.`
      : `|Z₀| = ${Math.abs(Z0).toFixed(4)} ≥ ${Zc} → Se rechaza Ho. La media difiere significativamente de 0.5.`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  PRUEBA 2 — PRUEBA DE FRECUENCIAS / CHI-CUADRADO  (Coss Bu §3.2)
// ═══════════════════════════════════════════════════════════════

/**
 * @param {number[]} ui Números uniformes ∈ [0,1]
 * @param {number}   n Número de subintervalos (ceil(sqrt(N)))
 * @param {number}   alpha Nivel de significado
 */
export function pruebaFrecuencias(ui, n = null, alpha = 0.05) {
  const N = ui.length;
  if (N < 5) return { error: 'Se necesitan al menos 5 valores.' };
  //Si no se especifica n, usar raíz cuadrada redondeada al entero superior según el libro
  const subInt = n || Math.max(5, Math.ceil(Math.sqrt(N)));
  const FE = N / subInt; //Frecuencia esperada por subintervalo

  //Contar frecuencias observadas
  const FO = new Array(subInt).fill(0);
  for (const u of ui) {
    const idx = Math.min(Math.floor(u * subInt), subInt - 1);
    FO[idx]++;
  }

  //Estadístico chi-cuadrado
  let X02 = 0;
  for (let i = 0; i < subInt; i++) {
    X02 += Math.pow(FO[i] - FE, 2) / FE;
  }

  const gl = subInt - 1;
  const Xc2 = chiCuadradoCritico(gl, alpha);

  return {
    nombre: 'Prueba de frecuencias (Chi-Cuadrado)',
    N,
    subInt,
    FE,
    FO,
    X02,
    Xc2,
    gl,
    pasa: X02 < Xc2,
    detalle: [
      { param: 'N (muestra)',             valor: N },
      { param: 'n (subintervalos)',        valor: subInt },
      { param: 'FE (esperada por celda)', valor: FE.toFixed(2) },
      { param: 'X₀² calculado',           valor: X02.toFixed(4) },
      { param: `X²_α,(${gl}) crítico`,    valor: Xc2.toFixed(4) },
      { param: 'X₀² < X²_crit',          valor: X02 < Xc2 ? 'SÍ' : 'NO' },
    ],
    tablaFO: FO.map((fo, i) => ({
      intervalo: `[${(i/subInt).toFixed(3)}, ${((i+1)/subInt).toFixed(3)})`,
      FO: fo,
      FE: FE.toFixed(2),
    })),
    interpretacion: X02 < Xc2
      ? `X₀² = ${X02.toFixed(4)} < ${Xc2.toFixed(4)} → No se rechaza Ho. Distribución uniforme aceptable.`
      : `X₀² = ${X02.toFixed(4)} ≥ ${Xc2.toFixed(4)} → Se rechaza Ho. Los datos no siguen distribución uniforme.`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  PRUEBA 3 — KOLMOGOROV-SMIRNOV  (Coss Bu §3.5)
// ═══════════════════════════════════════════════════════════════

export function pruebaKS(ui, alpha = 0.05) {
  const N = ui.length;
  if (N < 2) return { error: 'Se necesitan al menos 2 valores.' };
  // Ordenar ascendentemente
  const ordenados = [...ui].sort((a, b) => a - b);

  //Calcular Dn = max |Fn(U_(i)) - U_(i)|
  let Dn = 0;
  const diferencias = ordenados.map((u, idx) => {
    const Fn = idx / N;
    const F0 = u; 
    const diff = Math.abs(Fn - u);
    if (diff > Dn) Dn = diff;
    return { 
      u: u.toFixed(6), 
      Fn: Fn.toFixed(6), 
      F0: u.toFixed(6), 
      dif: diff.toFixed(6) 
    };
  });

  const dc = dCriticoKS(N, alpha);

  return {
    nombre: 'Prueba de Kolmogorov-Smirnov',
    N,
    Dn,
    dc,
    pasa: Dn < dc,
    detalle: [
      { param: 'N (muestra)',   valor: N },
      { param: 'Dₙ calculado', valor: Dn.toFixed(6) },
      { param: 'd_α,N crítico', valor: dc.toFixed(6) },
      { param: 'Dₙ < d_α,N',  valor: Dn < dc ? 'SÍ' : 'NO' },
    ],
    //Mostrar solo las primeras 50 filas
    tablaDif: diferencias.slice(0, 50),
    hayMas: diferencias.length > 50,
    interpretacion: Dn < dc
      ? `Dₙ = ${Dn.toFixed(6)} < ${dc.toFixed(6)} → No se rechaza Ho. Los datos provienen de U[0,1].`
      : `Dₙ = ${Dn.toFixed(6)} ≥ ${dc.toFixed(6)} → Se rechaza Ho. Los datos NO provienen de U[0,1].`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  PRUEBA 4 — PRUEBA DE CORRIDAS (arriba/abajo del promedio)
//  Coss Bu §3.7.1
// ═══════════════════════════════════════════════════════════════

export function pruebaCorridas(ui, alpha = 0.05) {
  const N = ui.length;
  if (N < 10) return { error: 'Se necesitan al menos 10 valores.' };
  const binario = ui.map(u => (u > 0.5 ? 1 : 0));

  //Identificar corridas
  const corridas = [];
  let longitud = 1;
  for (let i = 1; i <= N; i++) {
    if (i < N && binario[i] === binario[i - 1]) {
      longitud++;
    } else {
      corridas.push(longitud);
      longitud = 1;
    }
  }

  //Calcular total de corridas 
  const totalCorridas = corridas.length;
  const ETotalCorridas = (N + 1) / 2;

  //Encontrar la longitud máxima de corrida 
  const maxLong = Math.max(...corridas);
  
  //Calcular FE para TODAS las longitudes desde 1 hasta N 
  const FE_todas = [];
  for (let i = 1; i <= maxLong; i++) {
    FE_todas.push((N - i + 3) / Math.pow(2, i + 1));
  }

  //Construir FO para todas las longitudes (0 donde no hay) 
  const FO_todas = new Array(maxLong).fill(0);
  for (const c of corridas) {
    if (c <= maxLong) FO_todas[c - 1]++;
  }

  //Agrupacion de izquierda a derecha 
  //Las categorías con FE >= 5 se dejan individualmente.
  const FO_agrup = [];
  const FE_agrup = [];
  const etiquetas = [];

  let acumFO = 0;
  let acumFE = 0;
  let inicioGrupo = -1;

  for (let idx = 0; idx < maxLong; idx++) {
    if (FE_todas[idx] >= 5 && acumFE === 0) {
      //Categoría individual con FE suficiente
      FO_agrup.push(FO_todas[idx]);
      FE_agrup.push(FE_todas[idx]);
      etiquetas.push(`${idx + 1}`);
    } else {
      //Acumular porque FE < 5
      if (acumFE === 0) inicioGrupo = idx + 1;
      acumFO += FO_todas[idx];
      acumFE += FE_todas[idx];
      //Verificar si es el último índice o el acumulado ya supera 5
      const esUltimo = idx === maxLong - 1;
      if (acumFE >= 5 || esUltimo) {
        FO_agrup.push(acumFO);
        FE_agrup.push(acumFE);
        etiquetas.push(inicioGrupo === idx + 1 ? `${idx + 1}` : `≥${inicioGrupo}`);
        acumFO = 0;
        acumFE = 0;
        inicioGrupo = -1;
      }
    }
  }

  const n_cat = FO_agrup.length;
  const gl = n_cat - 1;

  //Calcular X₀² 
  let X02 = 0;
  for (let i = 0; i < n_cat; i++) {
    if (FE_agrup[i] > 0) {
      X02 += Math.pow(FO_agrup[i] - FE_agrup[i], 2) / FE_agrup[i];
    }
  }
  //Valor crítico 
  const Xc2 = gl > 0 ? chiCuadradoCritico(gl, alpha) : 0;

  return {
    nombre: 'Prueba de corridas (arriba/abajo del promedio)',
    N,
    totalCorridas,
    ETotalCorridas: ETotalCorridas.toFixed(2),
    X02,
    Xc2,
    gl,
    pasa: X02 < Xc2,
    detalle: [
      { param: 'N (muestra)',               valor: N },
      { param: 'Total corridas observadas', valor: totalCorridas },
      { param: 'E(total corridas)',         valor: ETotalCorridas.toFixed(2) },
      { param: 'Categorías agrupadas',      valor: n_cat },
      { param: 'X₀² calculado',             valor: X02.toFixed(4) },
      { param: `X²_α,(${gl}) crítico`,      valor: Xc2.toFixed(4) },
      { param: 'X₀² < X²_crit',             valor: X02 < Xc2 ? 'SÍ' : 'NO' },
    ],
    tablaCorridas: FO_agrup.map((fo, i) => ({
      longitud: etiquetas[i],
      FO: fo,
      FE: FE_agrup[i].toFixed(4),
    })),
    interpretacion: X02 < Xc2
      ? `X₀² = ${X02.toFixed(4)} < ${Xc2.toFixed(4)} → No se rechaza Ho. Los valores son independientes.`
      : `X₀² = ${X02.toFixed(4)} ≥ ${Xc2.toFixed(4)} → Se rechaza Ho. Hay dependencia entre valores consecutivos.`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  PRUEBA 5 — PRUEBA DEL PÓKER  (Coss Bu §3.6)
// ═══════════════════════════════════════════════════════════════

const POKER_MANOS = [
  { nombre: 'Todos diferentes', p: 0.30240 },
  { nombre: 'Un par',           p: 0.50400 },
  { nombre: 'Dos pares',        p: 0.10800 },
  { nombre: 'Tercia',           p: 0.07200 },
  { nombre: 'Full',             p: 0.00900 },
  { nombre: 'Póker',            p: 0.00450 },
  { nombre: 'Quintilla',        p: 0.00010 },
];

/*Clasifica los 5 dígitos de un número en una mano de póker. Devuelve el índice en POKER_MANOS (0=todos dif, 1=par, etc.)*/
function clasificarManoPoker(digitos5) {
  const conteo = {};
  for (const d of digitos5) {
    conteo[d] = (conteo[d] || 0) + 1;
  }
  const frecuencias = Object.values(conteo).sort((a, b) => b - a);
  const max = frecuencias[0];
  const distintos = frecuencias.length;

  if (distintos === 5) return 0; //todos diferentes
  if (max === 2 && distintos === 4) return 1; //un par
  if (max === 2 && distintos === 3) return 2; //dos pares
  if (max === 3 && distintos === 3) return 3; //tercia
  if (max === 3 && distintos === 2) return 4; //full
  if (max === 4) return 5; //póker
  if (max === 5) return 6; //quintilla
  return 0;
}

export function pruebaPoker(ui, alpha = 0.05) {
  const N = ui.length;
  if (N < 10) return { error: 'Se necesitan al menos 10 valores para la prueba del póker.' };

  //Clasificar cada número (7 categorías) 
  const FO = new Array(7).fill(0);
  
  for (const u of ui) {
    const uStr = u.toFixed(5); 
    const digitosStr = uStr.replace('0.', ''); 
    const strDigitos = digitosStr.substring(0, 5).padStart(5, '0');
    //Convertir a array de dígitos
    const digitos = strDigitos.split('').map(Number);
    
    const mano = clasificarManoPoker(digitos);
    FO[mano]++;
  }

  //Frecuencias esperadas 
  const FE_raw = POKER_MANOS.map(m => m.p * N);

  //Encontrar el primer indice con FE < 5 
  let indiceAgrupar = -1;
  for (let i = 0; i < 7; i++) {
    if (FE_raw[i] < 5) {
      indiceAgrupar = i;
      break;
    }
  }

  //Si todas las FE ≥ 5, no agrupar
  if (indiceAgrupar === -1) {
    //Usar todas las 7 categorías
    const FO_agrup = [...FO];
    const FE_agrup = [...FE_raw];
    const nombres_agrup = POKER_MANOS.map(m => m.nombre);
    
    const n_cat = 7;
    const gl = 6;
    
    //Calcular X₀²
    let X02 = 0;
    for (let i = 0; i < n_cat; i++) {
      X02 += Math.pow(FO_agrup[i] - FE_agrup[i], 2) / FE_agrup[i];
    }
    
    const Xc2 = chiCuadradoCritico(gl, alpha);
    
    return {
      nombre: 'Prueba del póker',
      N,
      X02,
      Xc2,
      gl,
      pasa: X02 < Xc2,
      detalle: [
        { param: 'N (muestra)',           valor: N },
        { param: 'Categorías',             valor: '7' },
        { param: 'X₀² calculado',          valor: X02.toFixed(4) },
        { param: `X²_α,(${gl}) crítico`,   valor: Xc2.toFixed(4) },
        { param: 'X₀² < X²_crit',          valor: X02 < Xc2 ? 'SÍ' : 'NO' },
      ],
      tablaManos: nombres_agrup.map((nombre, i) => ({
        nombre,
        FO: FO_agrup[i],
        FE: FE_agrup[i].toFixed(2),
      })),
      interpretacion: X02 < Xc2
        ? `X₀² = ${X02.toFixed(4)} < ${Xc2.toFixed(4)} → No se rechaza Ho. Los dígitos presentan patrones uniformes.`
        : `X₀² = ${X02.toFixed(4)} ≥ ${Xc2.toFixed(4)} → Se rechaza Ho. Los dígitos presentan patrones no uniformes.`,
    };
  }

  //Construir categorías agrupadas
  const FO_agrup = [];
  const FE_agrup = [];
  const nombres_agrup = [];

  //Categorías antes del punto de agrupación (se mantienen individuales)
  for (let i = 0; i < indiceAgrupar; i++) {
    FO_agrup.push(FO[i]);
    FE_agrup.push(FE_raw[i]);
    nombres_agrup.push(POKER_MANOS[i].nombre);
  }

  //Agrupar desde indiceAgrupar hasta el final
  let sumaFO = 0;
  let sumaFE = 0;
  let nombresGrupo = [];
  
  for (let i = indiceAgrupar; i < 7; i++) {
    sumaFO += FO[i];
    sumaFE += FE_raw[i];
    nombresGrupo.push(POKER_MANOS[i].nombre);
  }
  
  FO_agrup.push(sumaFO);
  FE_agrup.push(sumaFE);
  nombres_agrup.push(nombresGrupo.join(' + '));

  const n_cat = FO_agrup.length;
  const gl = n_cat - 1;

  //Calcular X₀² con categorías agrupadas
  let X02 = 0;
  for (let i = 0; i < n_cat; i++) {
    if (FE_agrup[i] > 0) {
      X02 += Math.pow(FO_agrup[i] - FE_agrup[i], 2) / FE_agrup[i];
    }
  }

  const Xc2 = chiCuadradoCritico(gl, alpha);

  return {
    nombre: 'Prueba del póker',
    N,
    X02,
    Xc2,
    gl,
    pasa: X02 < Xc2,
    detalle: [
      { param: 'N (muestra)',           valor: N },
      { param: 'Categorías agrupadas',  valor: n_cat },
      { param: 'X₀² calculado',         valor: X02.toFixed(4) },
      { param: `X²_α,(${gl}) crítico`,  valor: Xc2.toFixed(4) },
      { param: 'X₀² < X²_crit',         valor: X02 < Xc2 ? 'SÍ' : 'NO' },
    ],
    tablaManos: FO_agrup.map((fo, i) => ({
      nombre: nombres_agrup[i],
      FO: fo,
      FE: FE_agrup[i].toFixed(2),
    })),
    interpretacion: X02 < Xc2
      ? `X₀² = ${X02.toFixed(4)} < ${Xc2.toFixed(4)} → No se rechaza Ho. Los dígitos presentan patrones uniformes.`
      : `X₀² = ${X02.toFixed(4)} ≥ ${Xc2.toFixed(4)} → Se rechaza Ho. Los dígitos presentan patrones no uniformes.`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  FUNCIÓN PRINCIPAL aplica todas las pruebas seleccionadas
// ═══════════════════════════════════════════════════════════════

/**
 * @param {number[]} ui Números U_i ∈ [0,1]
 * @param {string[]} seleccion Ids de pruebas: ['promedios','frecuencias','ks','corridas','poker']
 * @param {object}  opciones { nSubInt, alpha }
 * @returns {object[]} Array de resultados
 */
export function aplicarPruebas(ui, seleccion, opciones = {}) {
  const { nSubInt = null, alpha = 0.05 } = opciones;
  const resultados = [];

  for (const id of seleccion) {
    switch (id) {
      case 'promedios':
        resultados.push({ id, ...pruebaPromedios(ui, alpha) });
        break;
      case 'frecuencias':
        resultados.push({ id, ...pruebaFrecuencias(ui, nSubInt, alpha) });
        break;
      case 'ks':
        resultados.push({ id, ...pruebaKS(ui, alpha) });
        break;
      case 'corridas':
        resultados.push({ id, ...pruebaCorridas(ui, alpha) });
        break;
      case 'poker':
        resultados.push({ id, ...pruebaPoker(ui, alpha) });
        break;
      default:
        resultados.push({ id, error: `Prueba "${id}" no reconocida.` });
    }
  }
  return resultados;
}
