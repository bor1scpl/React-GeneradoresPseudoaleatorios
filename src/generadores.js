/* generadores.js
Lógica pura de generación de números pseudoaleatorios.
*/

// ───────────────────────────────────────────────
//  FUNCIONES AUXILIARES
// ───────────────────────────────────────────────

/*Máximo Común Divisor — Algoritmo de Euclides*/
export function mcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b !== 0) { const t = b; b = a % b; a = t; }
  return a;
}

/*True si a y b son coprimos (MCD=1)*/
export function coprimos(a, b) { 
  return mcd(a, b) === 1; 
}

/*Factores primos únicos de n*/
export function factoresPrimos(n) {
  const f = new Set();
  for (let d = 2; d * d <= n; d++) {
    while (n % d === 0) { f.add(d); n = Math.floor(n / d); }
  }
  if (n > 1) f.add(n);
  return f;
}

/*True si n es potencia de 2*/
export function esPotencia2(n) { 
  return n > 0 && (n & (n - 1)) === 0; 
}


// ───────────────────────────────────────────────
//  DEFINICIÓN DE MÉTODOS
//  Contiene la informacion de todos los generadores
// ───────────────────────────────────────────────

export const METODOS = {

  mixto: {
    id: 'mixto',
    nombre: 'Congruencial mixto (GCL)',
    formula: 'X_{n+1} = (a·Xₙ + c) mod m',
    params: [
      { key: 'a', label: 'a — Multiplicador', hint: 'impar, no div. por 3 ni 5' },
      { key: 'c', label: 'c — Incremento',    hint: 'c mod 8 = 5, coprimo con m' },
      { key: 'm', label: 'm — Módulo',         hint: 'potencia de 2 ideal' },
    ],
    restricciones: [
      'MCD(c, m) = 1 — c y m deben ser coprimos (Hull-Dobell cond. 1).',
      'a ≡ 1 (mod p) para cada factor primo p de m (Hull-Dobell cond. 2).',
      'a ≡ 1 (mod 4) si 4 | m (Hull-Dobell cond. 3).',
      'a debe ser impar y no divisible por 3 ni por 5.',
      'c debe ser impar y cumplir c mod 8 = 5 (recomendación práctica).',
      '0 < a, c < m — los parámetros deben ser menores que el módulo.',
      'Período máximo = m cuando se cumplen las 3 condiciones de Hull-Dobell.',
      'X₀ puede ser cualquier valor entero en [0, m-1].',
    ],
    parametrosAuto: () => ({ a: 69069, c: 1, m: 1024 }),
  },

  mult: {
    id: 'mult',
    nombre: 'Congruencial multiplicativo (GCL)',
    formula: 'X_{n+1} = (a·Xₙ) mod m',
    params: [
      { key: 'a', label: 'a — Multiplicador', hint: 'a = 8t ± 3, coprimo con m' },
      { key: 'm', label: 'm — Módulo',         hint: 'potencia de 2 ideal' },
    ],
    restricciones: [
      'c = 0 / no existe término aditivo (diferencia clave con el mixto).',
      'X₀ debe ser impar y coprimo con m cuando m = 2^k.',
      'a debe cumplir a = 8t ± 3 para algún entero t ≥ 1 (m = 2^k).',
      'MCD(a, m) = 1 — a y m deben ser coprimos.',
      'Período máximo = m/4 cuando m = 2^k, a = 8t ± 3 y X₀ impar.',
      'Si m es primo y a es raíz primitiva de m, el período es m − 1.',
      'X₀ = 0 produce la secuencia degenerada 0, 0, 0, … (Error en la configuración).',
      'a debe ser positivo y menor que m.',
    ],
    parametrosAuto: () => ({ a: 65539, m: 2 ** 16 }),
  },

  cuadrados: {
    id: 'cuadrados',
    nombre: 'Cuadrados medios (Von Neumann)',
    formula: 'X_{n+1} = centroDigitos(Xₙ², d)',
    params: [
      { key: 'd', label: 'd — Dígitos de trabajo', hint: 'min. 2, recomendado 4 ó 6' },
    ],
    restricciones: [
      'La semilla X₀ debe tener exactamente d dígitos.',
      'Se eleva X_n al cuadrado → resultado de hasta 2d dígitos.',
      'Se extraen los d dígitos centrales del cuadrado → ese es X_{n+1}.',
      'Normalización: U_i = X_i / 10^d.',
      'Si X_n llega a 0, la secuencia degenera permanentemente (fin del ciclo útil).',
      'El período es variable e impredecible; puede ser muy corto con ciertas semillas.',
      'No se recomienda para simulaciones que requieran período largo.',
      'Elección de buena semilla es crítica: evitar semillas con muchos ceros o con números consecutivos.'
    ],
    parametrosAuto: () => ({ d: 4 }),
  },

  mitchell: {
    id: 'mitchell',
    nombre: 'Mitchell-Moore (j=24, k=55)',
    formula: 'Xₙ = (Xₙ₋₂₄ + Xₙ₋₅₅) mod m  [n ≥ 55]',
    params: [
      { key: 'm',          label: 'm — Módulo',        hint: 'potencia de 2, ej. 1024' },
      { key: 'semMitchell', label: 'Semillas X1 … X55 (54 valores)', hint: 'generadas o ingresadas manualmente' },
    ],
    restricciones: [
      'Ingresar primeramente el módulo, el resto de parámetros se pueden generar automáticamente',
      'j = 24 y k = 55 son índices de rezago fijos (Knuth, TAOCP Vol. 2, p. 29).',
      'Fórmula: Xn = (Xn-24 + Xn-55) mod m, válida para n ≥ 55.',
      'Se necesitan 55 semillas en total: X₀ (campo de configuración) + X1 … X54.',
      'No todas las semillas pueden ser pares simultáneamente.',
      'Todas las semillas deben ser enteros en [0, m − 1].',
      'm debe ser potencia de 2 (par y grande). Valor práctico inicial: 1024.',
      'Período máximo: P = (2⁵⁵ − 1) × 2^(M−1), donde m = 2^M. (Aplica logaritmo en base 2)',
      'Para m = 2³² → P ≈ 1.3 × 10²⁴ (prácticamente inagotable en la práctica).',
      'Los resultados se muestran desde X55 en adelante.',
      'La secuencia se detiene si se repite el estado completo del buffer (55 valores).',
    ],
    parametrosAuto: (semilla = 1) => {
      const m = 1024;
      const seeds = _generarSemillasMitchell(semilla, m);
      return {
        m,
        semMitchell: seeds.join(', '),
      };
    },
  },

  green: {
    id: 'green',
    nombre: 'Aditivo de Green',
    formula: 'X_{n+1} = (Xₙ + X_{n−k}) mod m',
    params: [
      { key: 'm',        label: 'm — Módulo',              hint: 'potencia de 2 ideal' },
      { key: 'k',        label: 'k — Retardo',             hint: 'entero ≥ 2' },
      { key: 'semillas', label: 'Semillas extra (,)',   hint: 'necesitas k semillas adicionales' },
    ],
    restricciones: [
      'Requiere k + 1 semillas en total (X₀ más k semillas adicionales).',
      '*** k = 1 recupera el generador de Fibonacci Clásico.',
      'X_{n+1} suma X_n con el valor de k posiciones atrás.',
      'm debe ser potencia de 2 para mejores propiedades estadísticas.',
      'Período teórico máximo: (2ᵏ − 1) × 2^(M−1) con semillas correctas.',
      'Todas las semillas no pueden ser cero simultáneamente.',
      'Un k mayor generalmente produce períodos más largos.',
      'Las semillas deben estar en [0, m − 1].',
    ],
    parametrosAuto: () => {
      const m = 1024;
      const k = 7;
      const semillasArray = [];
      for (let i = 1; i <= k; i++) {
        semillasArray.push(i % 2 === 0 ? i * 100 : i * 100 + 1);
      }
      return { m, k, semillas: semillasArray.join(', ') };
    },
  },
};

// ───────────────────────────────────────────────
//  HELPER PRIVADO para las semillas en Mitchell Moore
//  Genera X1 … X54 a partir de X₀ y m.
//  Garantiza: todas < m, no todas pares.
// ───────────────────────────────────────────────
function _generarSemillasMitchell(x0, m) {
  const seeds = [];
  let estado = x0 === 0 ? 1 : x0;
  for (let i = 0; i < 54; i++) {
    estado = (estado * 1664525 + 1013904223) % m;
    seeds.push(estado);
  }
  const todasPares = seeds.every(s => s % 2 === 0);
  if (todasPares) {
    seeds[53] = seeds[53] % 2 === 0 ? seeds[53] + 1 : seeds[53];
    if (seeds[53] >= m) seeds[53] = 1;
  }
  return seeds;
}


// ───────────────────────────────────────────────
// GENERADORES  
// Lógica pura
// ───────────────────────────────────────────────

export function generarSecuencia(metodo, semilla, cantidad, params) {
  const base = {
    enteros: [], normalizados: [], periodo: 0,
    periodoCompleto: false, maxPeriodo: 0,
    cortado: false, errores: [],
  };
  if (cantidad <= 0) { base.errores.push('La cantidad debe ser mayor a 0.'); return base; }

  switch (metodo) {
    case 'mixto':     return _mixto(semilla, cantidad, params, base);
    case 'mult':      return _multiplicativo(semilla, cantidad, params, base);
    case 'cuadrados': return _cuadradosMedios(semilla, cantidad, params, base);
    case 'mitchell':  return _mitchell(semilla, cantidad, params, base);
    case 'green':     return _green(semilla, cantidad, params, base);
    default:
      base.errores.push('Método no reconocido.');
      return base;
  }
}

/*MÉTODO 1: CONGRUENCIAL MIXTO*/
function _mixto(X0, n, { a, c, m }, res) {
  res.maxPeriodo = m;
  const visitados = new Map();
  let X = X0;
  for (let i = 0; i < n; i++) {
    if (visitados.has(X)) { res.periodo = i - visitados.get(X); res.cortado = true; break; }
    visitados.set(X, i);
    res.enteros.push(X);
    X = (a * X + c) % m;
  }
  if (!res.cortado) res.periodo = res.enteros.length;
  res.periodoCompleto = res.periodo === m;
  res.normalizados = res.enteros.map(x => x / m);
  return res;
}

/*MÉTODO 2: CONGRUENCIAL MULTIPLICATIVO*/
function _multiplicativo(X0, n, { a, m }, res) {
  res.maxPeriodo = esPotencia2(m) ? Math.floor(m / 4) : m - 1;
  const visitados = new Map();
  let X = X0;
  for (let i = 0; i < n; i++) {
    if (visitados.has(X)) { res.periodo = i - visitados.get(X); res.cortado = true; break; }
    visitados.set(X, i);
    res.enteros.push(X);
    X = (a * X) % m;
  }
  if (!res.cortado) res.periodo = res.enteros.length;
  res.periodoCompleto = res.periodo >= res.maxPeriodo;
  res.normalizados = res.enteros.map(x => x / m);
  return res;
}

/*MÉTODO 3: CUADRADOS MEDIOS (VON NEUMANN)*/
function extraerCentro(cuadrado, d) {
  const str = String(cuadrado).padStart(2 * d, '0');
  const inicio = Math.floor((str.length - d) / 2);
  return parseInt(str.substring(inicio, inicio + d), 10);
}

function _cuadradosMedios(X0, n, { d }, res) {
  if (!d || d < 2) {
    res.errores.push('d debe ser al menos 2.');
    return res;
  }

  const modulo = Math.pow(10, d);
  res.maxPeriodo = modulo;
  
  //Ajusta la semilla inicial
  let X_actual = X0 % modulo;
  if (X_actual === 0) X_actual = 1;
  
  const visitados = new Map();
  let mensajeDegeneracion = '';
  
  for (let i = 0; i < n; i++) {
    res.enteros.push(X_actual);
    res.normalizados.push(X_actual / modulo);
    
    //Generar el siguiente número
    const cuadrado = X_actual * X_actual;
    const X_siguiente = extraerCentro(cuadrado, d);
    //Ciclo según el siguiente número
    if (visitados.has(X_siguiente)) {
      res.periodo = i + 1 - visitados.get(X_siguiente);
      res.cortado = true;
      break;
    }
    visitados.set(X_actual, i);
    const X_str = String(X_actual).padStart(d, '0');
    if (X_str.startsWith('0') && i > 0) {
      mensajeDegeneracion = `⚠ La secuencia degeneró a 0 después de la iteración ${res.enteros.length}.`;
    }
    X_actual = X_siguiente;
    if (X_actual === 0) {
      if (i < n - 1) {
        mensajeDegeneracion = `⚠ La secuencia degeneró a 0 después de la iteración ${res.enteros.length}.`;
      }
      break;
    }
  }
  
  if (res.cortado) {
    res._cicloReal = res.periodo;
  }

  res.periodo = res.enteros.length;
  
  if (mensajeDegeneracion) {
    res.mensajeDegeneracion = mensajeDegeneracion;
  }
  res.periodoCompleto = (res.periodo === modulo);
  return res;
}

/*MÉTODO 4: MITCHELL-MOORE (j=24, k=55)*/
function _mitchell(X0, n, { m, semMitchell }, res) {
  if (!m || !esPotencia2(m)) {
    res.errores.push('m debe ser una potencia de 2 (ej. 1024, 2048, 65536).');
    return res;
  }
  const M = Math.log2(m);
  const periodoMax = (Math.pow(2, 55) - 1) * Math.pow(2, M - 1);
  res.maxPeriodo = periodoMax;
  //Parsear las 54 semillas adicionales (X1 … X54) 
  let semAdicionales = [];
  if (typeof semMitchell === 'string' && semMitchell.trim() !== '') {
    semAdicionales = semMitchell
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(v => !isNaN(v));
  } else if (Array.isArray(semMitchell)) {
    semAdicionales = semMitchell.map(Number).filter(v => !isNaN(v));
  }

  //Validar cantidad de semillas adicionales
  if (semAdicionales.length !== 54) {
    res.errores.push(
      `Se necesitan exactamente 54 semillas adicionales (X₁…X₅₄). ` +
      `Recibidas: ${semAdicionales.length}. ` +
      `Usa el botón "↺ Nuevas semillas" para generarlas automáticamente.`
    );
    return res;
  }
  const buffer = [X0, ...semAdicionales]; 
  // Guardar las 55 semillas completas para exportación
  res.semillasCompletas = [...buffer]; 

  //Validar que todas las semillas estén en [0, m-1] 
  const invalidas = buffer
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v < 0 || v >= m);
  if (invalidas.length > 0) {
    res.errores.push(
      `Las siguientes semillas están fuera del rango [0, m-1=${m - 1}]: ` +
      invalidas.map(({ v, i }) => `X${i}=${v}`).join(', ')
    );
    return res;
  }

  //Validar que no todas sean pares
  const todasPares = buffer.every(v => v % 2 === 0);
  if (todasPares) {
    res.errores.push(
      'No todas las 55 semillas pueden ser pares. ' +
      'Usa el botón "↺ Nuevas semillas" para regenerar.'
    );
    return res;
  }

  //Índices de rezago fijos
  const J = 24; 
  const K = 55; 
  const estadosVistos = new Map();
  estadosVistos.set(buffer.join(','), 0);
  let cicloDetectadoEn = -1; 

  for (let paso = 1; paso <= n; paso++) {
    const xMenosK = buffer[0];          
    const xMenosJ = buffer[K - J];      
    const xNuevo  = (xMenosJ + xMenosK) % m;
    buffer.shift();
    buffer.push(xNuevo);
    // Guardar el resultado 
    res.enteros.push(xNuevo);
    res.normalizados.push(xNuevo / m);
    //Comprobar si el estado del buffer ya fue visto antes
    const claveEstado = buffer.join(',');
    if (estadosVistos.has(claveEstado)) {
      cicloDetectadoEn = paso;
      res.periodo = paso - estadosVistos.get(claveEstado);
      res.cortado = true;
      break;
    }
    estadosVistos.set(claveEstado, paso);
  }

  if (cicloDetectadoEn !== -1) {
    res.periodoReal = res.periodo; 
    res.periodo = res.enteros.length; 
    res.periodoCompleto = false; 
  } else {
    res.periodoReal = res.enteros.length;
    res.periodo = res.enteros.length;
    res.periodoCompleto = false;
  }
  return res;
}

/*MÉTODO 5: ADITIVO DE GREEN*/
function _green(X0, n, { m, k, semillas }, res) {
  if (esPotencia2(m)) {
    const M = Math.log2(m);
    res.maxPeriodo = k === 1
      ? Math.pow(m, 2) - 1
      : (Math.pow(2, k) - 1) * Math.pow(2, M - 1);
  } else {
    res.maxPeriodo = m * 1000;
  }

  if (!semillas || semillas.length < k) {
    res.errores.push(`Se necesitan ${k} semillas adicionales (además de X₀). Ingresadas: ${semillas?.length ?? 0}.`);
    return res;
  }

  const buffer = [X0, ...semillas.slice(0, k - 1)];
  const visitados = new Map();
  let cicloDetectado = false;
  let posicionCiclo = 0;
  res.enteros.push(X0);
  for (let i = 0; i < k; i++) res.enteros.push(semillas[i]);
  for (let i = buffer.length; i < n + buffer.length; i++) {
    const clave = buffer.join(',');
    if (visitados.has(clave)) {
      cicloDetectado = true;
      posicionCiclo = i - buffer.length;
      res.cortado = true;
      break;
    }
    visitados.set(clave, i - buffer.length);
    const next = (buffer[buffer.length - 1] + buffer[0]) % m;
    buffer.shift();
    buffer.push(next);
    res.enteros.push(next);
  }

  if (cicloDetectado) {
    res.periodoReal = posicionCiclo;
    res.periodoCompleto = true;
  } else {
    res.periodoReal = res.enteros.length;
    res.periodoCompleto = false;
  }
  res.periodo = res.enteros.length;
  res.normalizados = res.enteros.map(x => x / m);
  return res;
}


// ───────────────────────────────────────────────
//  VALIDACIÓN DE PARÁMETROS
// ───────────────────────────────────────────────

export function validarParametros(metodo, semilla, params) {
  const errores = [], advertencias = [];

  if (!semilla || semilla <= 0)
    errores.push('La semilla X₀ debe ser un entero positivo mayor que 0.');

  switch (metodo) {

    case 'mixto': {
      const { a, c, m } = params;
      if (!a || a <= 0) errores.push('a debe ser un entero positivo.');
      if (c == null || c < 0) errores.push('c debe ser ≥ 0.');
      if (!m || m <= 1) errores.push('m debe ser mayor que 1.');
      if (errores.length) break;
      //const fp = factoresPrimos(m); //Restricción mas fuerte que puede usarse
      if (!coprimos(c, m)) errores.push(`Hull-Dobell [1] FALLA: MCD(c=${c}, m=${m}) = ${mcd(c,m)} ≠ 1.`);
      /* //Restricción mas fuerte
      //const fallp2 = [...fp].filter(p => (a - 1) % p !== 0);
      //if (fallp2.length) errores.push(`Hull-Dobell [2] FALLA: (a−1)=${a-1} no divisible por {${fallp2.join(',')}}.`); 
      */
      if (m % 4 === 0 && (a - 1) % 4 !== 0) errores.push(`Hull-Dobell [3] FALLA: 4|m pero 4∤(a−1).`);
      if (a % 2 === 0) advertencias.push('a debería ser impar.');
      if (a % 3 === 0 || a % 5 === 0) advertencias.push('a no debería ser divisible por 3 ó 5.');
      if (c % 8 !== 5) advertencias.push(`c mod 8 = ${c % 8} (se recomienda c mod 8 = 5).`);
      if (!esPotencia2(m)) advertencias.push('m no es potencia de 2; análisis del período más complejo.');
      if (semilla >= m) errores.push(`X₀=${semilla} debe ser < m=${m}.`);
      break;
    }

    case 'mult': {
      const { a, m } = params;
      if (!a || a <= 0) errores.push('a debe ser positivo.');
      if (!m || m <= 1) errores.push('m debe ser mayor que 1.');
      if (errores.length) break;
      if (semilla % 2 === 0) advertencias.push('X₀ debe ser impar (para m = 2^k).');
      if (!coprimos(semilla, m)) advertencias.push(`X₀ y m no son coprimos; el período se reducirá.`);
      if (!coprimos(a, m)) errores.push(`MCD(a=${a}, m=${m}) ≠ 1.`);
      if (esPotencia2(m)) {
        const am8 = a % 8;
        if (am8 !== 3 && am8 !== 5) advertencias.push(`Para m=2^k, a debe ser 8t±3 (a mod 8 debe ser 3 ó 5, actual: ${am8}).`);
        else advertencias.push(`✓ a = 8t±3 verificado (a mod 8 = ${am8}). Período esperado ≈ m/4.`);
      }
      if (semilla >= m) errores.push(`X₀=${semilla} debe ser < m=${m}.`);
      break;
    }

    case 'cuadrados': {
      const { d } = params;
      if (!d || d < 2) errores.push('d debe ser al menos 2.');
      if (d > 10) advertencias.push('d > 10 puede producir números muy grandes.');
      if (semilla <= 0) errores.push('La semilla debe ser un entero positivo.');
      const semillaStr = String(semilla);
      const digitosSemilla = semillaStr.length;
      if (digitosSemilla !== d) errores.push(`Los dígitos de trabajo (d=${d}) 
      deben ser iguales a la cantidad de dígitos de la semilla (${digitosSemilla}).`);
      if (semilla % 100 === 0) advertencias.push('Semilla termina en 00 - propensa a degeneración rápida.');
      advertencias.push(`ℹ Normalización: U_n = X_n / ${Math.pow(10, d)}`);
      break;
    }

    case 'mitchell': {
      const { m, semMitchell } = params;
      //m debe existir y ser potencia de 2
      if (!m || m < 2) {
        errores.push('m debe ser mayor que 1.');
        break;
      }
      if (!esPotencia2(m)) {
        errores.push('m debe ser potencia de 2 (ej. 512, 1024, 2048, 65536, 2^32).');
        break;
      }

      if (semilla < 0 || semilla >= m) {
        errores.push(`X₀ = ${semilla} debe estar en [0, m−1 = ${m - 1}].`);
      }
      //Parsear las 54 semillas adicionales
      let semArr = [];
      if (typeof semMitchell === 'string' && semMitchell.trim() !== '') {
        semArr = semMitchell.split(',').map(s => parseInt(s.trim(), 10)).filter(v => !isNaN(v));
      } else if (Array.isArray(semMitchell)) {
        semArr = semMitchell.map(Number).filter(v => !isNaN(v));
      }

      if (semArr.length !== 54) {
        if (semArr.length === 0) {
          errores.push('Faltan las 54 semillas adicionales (X₁…X₅₄). Usa el botón "↺ Nuevas semillas".');
        } else {
          errores.push(`Se necesitan exactamente 54 semillas adicionales. Recibidas: ${semArr.length}.`);
        }
        break;
      }

      const invalidas = semArr.filter(v => v < 0 || v >= m);
      if (invalidas.length > 0) {
        errores.push(`${invalidas.length} semilla(s) fuera del rango [0, ${m - 1}]: ${invalidas.slice(0, 5).join(', ')}${invalidas.length > 5 ? '…' : ''}.`);
      }

      const todas55 = [semilla, ...semArr];
      if (todas55.every(v => v % 2 === 0)) {
        errores.push('No todas las 55 semillas pueden ser pares. Regenera con "↺ Nuevas semillas".');
      }

      const M = Math.log2(m);
      const pMax = (Math.pow(2, 55) - 1) * Math.pow(2, M - 1);
      advertencias.push(`ℹ Período máximo teórico para m=2^${M}: ${pMax.toExponential(4)}`);
      advertencias.push('ℹ j=24 y k=55 son fijos. Los resultados empiezan en X₅₅.');
      break;
    }

    case 'green': {
      const { m, k, semillas } = params;
      if (!m || m <= 1) errores.push('m debe ser mayor que 1.');
      if (!k || k < 2) errores.push('k debe ser un entero ≥ 2. Para k=1 use otro tipo de generador Fibonacci');
      if (errores.length) break;
      let listaSemillas = [];
      if (typeof semillas === 'string') {
        listaSemillas = semillas.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      } else if (Array.isArray(semillas)) {
        listaSemillas = semillas;
      }
      const totalSemillas = [semilla, ...listaSemillas];
      if (totalSemillas.length < k + 1) errores.push(`✗ Se necesitan ${k + 1} semillas en total (X0 + ${k} adicionales). Actual: ${totalSemillas.length}.`);
      const semillasInvalidas = totalSemillas.filter(s => s >= m);
      if (semillasInvalidas.length > 0) errores.push(`✗ Las semillas deben ser menores que m=${m}. Valores inválidos: ${semillasInvalidas.join(', ')}`);
      if (totalSemillas.every(s => s === 0)) errores.push('✗ No todas las semillas pueden ser 0.');
      if (m % 2 === 0 && totalSemillas.every(s => s % 2 === 0)) advertencias.push('⚠ Todas las semillas son pares - puede afectar la calidad de la secuencia.');
      if (!esPotencia2(m)) advertencias.push('⚠ m no es potencia de 2; el período puede no ser máximo.');
      if (totalSemillas.length > k + 1) advertencias.push(`⚠ Se proporcionaron más de ${k + 1} semillas. Solo se usarán las primeras ${k + 1}.`);
      break;
    }

    default: break;
  }

  return { errores, advertencias };
}

export { _generarSemillasMitchell as generarSemillasMitchell };