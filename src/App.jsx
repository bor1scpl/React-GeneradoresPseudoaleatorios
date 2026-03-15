// ─────────────────────────────────────────────────────────────
//  IMPORTS
// ─────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import { useState, useCallback, useMemo } from 'react';
import { METODOS, generarSecuencia, validarParametros, esPotencia2, generarSemillasMitchell} from './generadores';
import styles from './App.module.css';
import { aplicarPruebas, } from './pruebas';

// ─────────────────────────────────────────────────────────────
//  UTILIDADES
// ─────────────────────────────────────────────────────────────
const formatearNumero = (num) => {
  if (!num) return '0';
  if (num > 10_000_000) return num.toExponential(2);
  if (num > 1000) return num.toLocaleString();
  return num.toString();
};

// ─────────────────────────────────────────────────────────────
//  COMPONENTES PEQUEÑOS
// ─────────────────────────────────────────────────────────────
function PeriodoBadge({ completo, cortado, periodo, maxPeriodo }) {
  if (cortado) return (
    <span className={`${styles.badge} ${styles.badgeWarn}`}>
      ⚠ Período: {periodo.toLocaleString()} (no completo)
    </span>
  );
  if (completo) return (
    <span className={`${styles.badge} ${styles.badgeOk}`}>
      ✓ Período completo: {periodo.toLocaleString()}
    </span>
  );
  return (
    <span className={`${styles.badge} ${styles.badgeInfo}`}>
      Período no completo: {periodo.toLocaleString()} / máx {maxPeriodo.toLocaleString()}
    </span>
  );
}

function FormulaBox({ texto }) {
  return (
    <div className={styles.formulaBox}>
      <span className={styles.formulaLabel}>FÓRMULA</span>
      <span className={styles.formulaText}>{texto}</span>
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <label className={styles.toggleRow} onClick={onChange}>
      <div className={`${styles.toggle} ${value ? styles.toggleOn : ''}`} />
      <span className={styles.toggleLabel}>{label}</span>
    </label>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className={styles.statBox}>
      <div className={styles.statLabel}>{label}</div>
      <div className={`${styles.statVal} ${color ? styles[color] : ''}`}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  HOOK: useParamsForm
// ─────────────────────────────────────────────────────────────
function useParamsForm(metodoId) {
  const [valores, setValores] = useState({});

  const set = useCallback((key, val) => {
    setValores(prev => ({ ...prev, [key]: val }));
  }, []);

  const cargarAuto = useCallback((semilla = 1) => {
    const auto = METODOS[metodoId].parametrosAuto(semilla);
    const numericos = {};
    for (const [k, v] of Object.entries(auto)) {
      numericos[k] = v;
    }
    setValores(numericos);
  }, [metodoId]);

  const reset = useCallback(() => setValores({}), []);

  return { valores, set, cargarAuto, reset };
}

// ─────────────────────────────────────────────────────────────
//  COMPONENTE FormularioParametros
// ─────────────────────────────────────────────────────────────
function FormularioParametros({ metodoId, valores, onChange, modoAuto, onNuevasSemillasMitchell }) {
  const def = METODOS[metodoId];

  return (
    <div className={styles.paramsGrid}>
      {def.params.map(({ key, label, hint }) => {
        if (key === 'semMitchell') {
          return (
            <div key={key} className={styles.field}>
              <label className={styles.fieldLabel}>
                {label}
                {hint && <span className={styles.fieldHint}>{hint}</span>}
              </label>
              <textarea
                className={styles.textarea}
                value={valores[key] ?? ''}
                onChange={e => onChange(key, e.target.value)}
                placeholder="Pulsa '↺ Nuevas semillas' para generar automáticamente"
                rows={3}
              />
              {/*Botón exclusivo de Mitchell-Moore para regenerar semillas*/}
              <button
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnFull}`}
                style={{ marginTop: 6 }}
                onClick={onNuevasSemillasMitchell}
                title="Genera 54 semillas aleatorias válidas (todas < m, no todas pares)"
              >
                ↺ Nuevas semillas (X1 … X54)
              </button>
            </div>
          );
        }
        //Campo especial: semillas Green
        if (key === 'semillas') {
          return (
            <div key={key} className={styles.field}>
              <label className={styles.fieldLabel}>
                {label}
                {hint && <span className={styles.fieldHint}>{hint}</span>}
              </label>
              <textarea
                className={styles.textarea}
                value={valores[key] ?? ''}
                onChange={e => onChange(key, e.target.value)}
                readOnly={modoAuto}
                placeholder="Ej: 250, 500, 750"
                rows={2}
              />
            </div>
          );
        }
        //Campo estándar
        return (
          <div key={key} className={styles.field}>
            <label className={styles.fieldLabel}>
              {label}
              {hint && <span className={styles.fieldHint}>{hint}</span>}
            </label>
            <input
              type="number"
              className={styles.input}
              value={valores[key] ?? ''}
              onChange={e => onChange(key, e.target.value === '' ? '' : Number(e.target.value))}
              readOnly={modoAuto}
              min={0}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  COMPONENTE TablaResultados
// ─────────────────────────────────────────────────────────────
const MAX_FILAS = 500;

function TablaResultados({ enteros, normalizados,indiceInicio = 0 }) {
  const limite = Math.min(enteros.length, MAX_FILAS);
  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>i</th>
              <th>X_i (Entero)</th>
              <th>U_i ∈ [0, 1]</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: limite }, (_, i) => {
              const xi = enteros[i];
              const ui = normalizados[i];
              return (
                <tr key={i}>
                  <td className={styles.tdIdx}>{indiceInicio + i}</td>
                  <td className={styles.tdInt}>{xi.toLocaleString()}</td>
                  <td className={styles.tdNorm}>{ui.toFixed(5)}</td>
                </tr>
              );
            })}
            {enteros.length > MAX_FILAS && (
              <tr>
                <td colSpan={3} className={styles.tdMore}>
                  … y {(enteros.length - MAX_FILAS).toLocaleString()} filas más.
                  Exporta el XLSX para verlos todos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  COMPONENTE ModuloPruebas
// ─────────────────────────────────────────────────────────────

//Definición de las pruebas disponibles
const PRUEBAS_DEF = [
  { id: 'promedios',   nombre: 'Prueba de promedios',      icono: 'x̄', color: 'iconAmber' },
  { id: 'frecuencias', nombre: 'Prueba de frecuencias',    icono: 'χ²', color: 'iconBlue'  },
  { id: 'ks',          nombre: 'Kolmogorov-Smirnov',       icono: 'D', color: 'iconTeal'  },
  { id: 'corridas',    nombre: 'Prueba de corridas',       icono: '↕', color: 'iconRose'  },
  { id: 'poker',       nombre: 'Prueba del póker',         icono: '♠', color: 'iconBlue'  },
];

/*Tarjeta de resultado de una prueba*/
function TarjetaResultado({ res }) {
  if (res.error) return (
    <div className={styles.pruebaResultCard}>
      <div className={styles.pruebaResultHeader}>
        <span className={styles.pruebaResultNombre}>{res.nombre || res.id}</span>
        <span className={`${styles.badge} ${styles.badgeWarn}`}>⚠ Error</span>
      </div>
      <p style={{ color: 'var(--rose-500)', fontSize: 13, margin: '8px 0 0' }}>{res.error}</p>
    </div>
  );

  return (
    <div className={styles.pruebaResultCard}>
      <div className={styles.pruebaResultHeader}>
        <span className={styles.pruebaResultNombre}>{res.nombre}</span>
        <span className={`${styles.badge} ${res.pasa ? styles.badgeOk : styles.badgeRose}`}>
          {res.pasa ? '✓ PASA' : '✗ NO PASA'}
        </span>
      </div>

      {/*Tabla de parámetros*/}
      {res.detalle && (
        <table className={styles.pruebaDetalleTbl}>
          <tbody>
            {res.detalle.map((row, i) => (
              <tr key={i}>
                <td className={styles.pruebaDetalleKey}>{row.param}</td>
                <td className={styles.pruebaDetalleVal}>{row.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/*Interpretación*/}
      <div className={`${styles.msg} ${res.pasa ? styles.ok : styles.error}`}
        style={{ marginTop: 10, fontSize: 12 }}>
        {res.interpretacion}
      </div>

      {/*Tabla de frecuencias (Frecuencias)*/}
      {res.tablaFO && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--slate-400)' }}>
            Ver frecuencias por subintervalo
          </summary>
          <table className={styles.pruebaDetalleTbl} style={{ marginTop: 6, borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingRight: 20, borderBottom: '1px solid var(--line)' }}>Subintervalo</th>
                <th style={{ textAlign: 'center', paddingRight: 20, borderBottom: '1px solid var(--line)' }}>FO</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--line)' }}>FE</th>
              </tr>
            </thead>
            <tbody>
              {res.tablaFO.map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 20px 6px 0', borderBottom: i < res.tablaFO.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.intervalo}
                  </td>
                  <td style={{ padding: '6px 20px 6px 0', textAlign: 'center', borderBottom: i < res.tablaFO.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.FO}
                  </td>
                  <td style={{ padding: '6px 0', textAlign: 'center', borderBottom: i < res.tablaFO.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.FE}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {/*Tabla de corridas*/}
      {res.tablaCorridas && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--slate-400)' }}>
            Ver frecuencias de corridas
          </summary>
          <table className={styles.pruebaDetalleTbl} style={{ marginTop: 6, borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingRight: 20, borderBottom: '1px solid var(--line)' }}>Longitud</th>
                <th style={{ textAlign: 'center', paddingRight: 20, borderBottom: '1px solid var(--line)' }}>FO</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--line)' }}>FE</th>
              </tr>
            </thead>
            <tbody>
              {res.tablaCorridas.map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 20px 6px 0', borderBottom: i < res.tablaCorridas.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.longitud}
                  </td>
                  <td style={{ padding: '6px 20px 6px 0', textAlign: 'center', borderBottom: i < res.tablaCorridas.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.FO}
                  </td>
                  <td style={{ padding: '6px 0', textAlign: 'center', borderBottom: i < res.tablaCorridas.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.FE}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {/*Tabla de manos de póker*/}
      {res.tablaManos && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--slate-400)' }}>
            Ver frecuencias por mano
          </summary>
          <table className={styles.pruebaDetalleTbl} style={{ marginTop: 6, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingRight: 20, borderBottom: '1px solid var(--line)' }}>Mano</th>
                <th style={{ textAlign: 'center', paddingRight: 20, borderBottom: '1px solid var(--line)' }}>FO</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--line)' }}>FE</th>
              </tr>
            </thead>
            <tbody>
              {res.tablaManos.map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 20px 6px 0', borderBottom: i < res.tablaManos.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.nombre}
                  </td>
                  <td style={{ padding: '6px 20px 6px 0', textAlign: 'center', borderBottom: i < res.tablaManos.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.FO}
                  </td>
                  <td style={{ padding: '6px 0', textAlign: 'center', borderBottom: i < res.tablaManos.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.FE}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {/*Tabla KS (solo primeras 50 filas)*/}
      {res.tablaDif && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--slate-400)' }}>
            Ver distribución acumulada{res.hayMas ? ' (primeras 50 filas)' : ''}
          </summary>
          <table className={styles.pruebaDetalleTbl} style={{ marginTop: 6, borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingRight: 15, borderBottom: '1px solid var(--line)' }}>U_(i)</th>
                <th style={{ textAlign: 'center', paddingRight: 15, borderBottom: '1px solid var(--line)' }}>Fn(x)</th>
                <th style={{ textAlign: 'center', paddingRight: 15, borderBottom: '1px solid var(--line)' }}>F₀(x)</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--line)' }}>|Diff|</th>
              </tr>
            </thead>
            <tbody>
              {res.tablaDif.map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: '4px 15px 4px 0', borderBottom: i < res.tablaDif.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.u}
                  </td>
                  <td style={{ padding: '4px 15px 4px 0', textAlign: 'center', borderBottom: i < res.tablaDif.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.Fn}
                  </td>
                  <td style={{ padding: '4px 15px 4px 0', textAlign: 'center', borderBottom: i < res.tablaDif.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.F0}
                  </td>
                  <td style={{ padding: '4px 0', textAlign: 'center', borderBottom: i < res.tablaDif.length-1 ? '1px solid var(--line)' : 'none' }}>
                    {row.dif}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {res.hayMas && (
            <p style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 4 }}>
              … y más filas. El estadístico Dₙ usa todos los valores.
            </p>
          )}
        </details>
      )}
    </div>
  );
}

/*Módulo completo de pruebas estadísticas*/
function ModuloPruebas({ resultadoGenerador }) {
  //Estado local del módulo
  const [fuente, setFuente]             = useState('generador'); 
  const [seleccionadas, setSelec]       = useState(['promedios','frecuencias','ks','corridas','poker']);
  const [resultadosPruebas, setResultadosPruebas]  = useState(null);
  const [msgPrueba, setMsgPrueba]       = useState(null);
  const [, setXlsxTexto]         = useState('');
  const [uiImportados, setUiImp]        = useState([]);
  const [nSubInt, setNSubInt]           = useState('');

  //UI activos: array de U_i dependiendo de la fuente
  const uiActivos = fuente === 'generador'
    ? (resultadoGenerador?.normalizados || [])
    : uiImportados;

  const togglePrueba = (id) => {
    setSelec(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

//Leer archivo XLSX para pruebas
const handleArchivoXLSX = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = new Uint8Array(ev.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
      
      if (jsonData.length < 2) {
        setMsgPrueba({ tipo: 'error', texto: 'El archivo está vacío o solo tiene encabezado.' });
        return;
      }
      // Detectar columna de U_i 
      const encabezado = jsonData[0];
      let colUI = -1;
      // Buscar columna que contenga "u_i" en el encabezado
      for (let c = 0; c < encabezado.length; c++) {
        const h = String(encabezado[c] || '').toLowerCase();
        if (h.includes('u_i') || h.includes('uniform') || h.includes('normaliz') || h.includes('[0')) {
          colUI = c;
          break;
        }
      }
      //Si no encuentra, tomar la última columna numérica
      if (colUI === -1) {
        for (let c = encabezado.length - 1; c >= 0; c--) {
          if (jsonData.length > 1 && typeof jsonData[1][c] === 'number') {
            colUI = c;
            break;
          }
        }
      }
      if (colUI === -1) {
        setMsgPrueba({ tipo: 'error', texto: 'No se pudo identificar la columna de valores U_i.' });
        return;
      }
      const ui = [];
      const errores = [];
      
      for (let i = 1; i < jsonData.length; i++) {
        const fila = jsonData[i];
        if (!fila || fila.length <= colUI) continue;
        
        let valor = fila[colUI];
        if (valor === null || valor === undefined || valor === '') continue;

        if (typeof valor === 'string') {
          valor = valor.replace(',', '.').trim();
          valor = parseFloat(valor);
        }
        
        if (typeof valor !== 'number' || isNaN(valor)) continue;
        
        if (valor < 0 || valor > 1) {
          errores.push(`Fila ${i+1}: valor ${valor} fuera de [0,1]. Se omite.`);
          continue;
        }
        ui.push(valor);
      }
      
      setUiImp(ui);
      setXlsxTexto('');
      
      if (errores.length > 0) {
        setMsgPrueba({ tipo: 'warn', texto: errores.join('\n') });
      } else if (ui.length > 0) {
        setMsgPrueba({ tipo: 'ok', texto: `✓ ${ui.length} valores U_i cargados del archivo.` });
      } else {
        setMsgPrueba({ tipo: 'error', texto: 'No se encontraron valores U_i válidos en [0,1].' });
      }
      
      setResultadosPruebas(null);
    } catch (error) {
      setMsgPrueba({ tipo: 'error', texto: 'Error al leer el archivo: ' + error.message });
    }
  };
  reader.readAsArrayBuffer(file);
};
  //Ejecutar pruebas
  const handleEjecutar = () => {
    if (seleccionadas.length === 0) {
      setMsgPrueba({ tipo: 'warn', texto: 'Selecciona al menos una prueba.' });
      return;
    }
    if (uiActivos.length < 5) {
      setMsgPrueba({ tipo: 'error', texto: fuente === 'generador'
        ? 'Genera números primero con el panel de arriba.'
        : 'Carga un archivo XLSX válido con al menos 5 valores.' });
      return;
    }
    const n = nSubInt !== '' ? parseInt(nSubInt) : null;
    const resultados = aplicarPruebas(uiActivos, seleccionadas, { nSubInt: n, alpha: 0.05 });
    setResultadosPruebas(resultados);
    setMsgPrueba(null);
  };

  const handleLimpiarPruebas = () => {
    setResultadosPruebas(null);
    setMsgPrueba(null);
    setXlsxTexto('');
    setUiImp([]);
  };

  const cuantosPasan = resultadosPruebas
    ? resultadosPruebas.filter(r => r.pasa).length
    : 0;

  return (
    <div className={styles.pruebasModule}>
      {/*Encabezado*/}
      <div className={styles.pruebasHeader}>
        <div className={`${styles.cardIcon} ${styles.iconBlue}`}>∫</div>
        <div style={{ flex: 1 }}>
          <div className={styles.cardTitle}>Pruebas Estadísticas de Aleatoriedad</div>
          <div className={styles.pruebasSub}>
            Nivel de significado α = 0.05 · Coss Bu, Simulación Un Enfoque Práctico, Cap. 3
          </div>
        </div>
        {resultadosPruebas && (
          <span className={`${styles.badge} ${cuantosPasan === resultadosPruebas.length ? styles.badgeOk : styles.badgeWarn}`}>
            {cuantosPasan}/{resultadosPruebas.length} pruebas pasan
          </span>
        )}
      </div>

      {/*Controles en 3 columnas*/}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 16 }}>

        {/*Columna 1: Fuente de datos*/}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.cardIcon} ${styles.iconAmber}`}>⊞</div>
            <span className={styles.cardTitle}>Fuente de datos</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Origen de los U_i</label>
              <select className={styles.select} value={fuente} onChange={e => { setFuente(e.target.value); setResultadosPruebas(null); setMsgPrueba(null); }}>
                <option value="generador">Usar números generados arriba</option>
                <option value="xlsx">Importar desde archivo XLSX</option>
              </select>
            </div>

            {fuente === 'generador' && (
              <div className={`${styles.msg} ${uiActivos.length > 0 ? styles.ok : styles.warn}`}
                style={{ marginTop: 8, fontSize: 12 }}>
                {uiActivos.length > 0
                  ? `✓ ${uiActivos.length} valores U_i listos del generador.`
                  : '⚠ Genera números primero con el panel de arriba.'}
              </div>
            )}

            {fuente === 'xlsx' && (
              <div className={styles.field} style={{ marginTop: 10 }}>
                <label className={styles.fieldLabel}>
                  Archivo XLSX
                  <span className={styles.fieldHint}>formato: i, X_i, U_i (igual al exportado)</span>
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  className={styles.input}
                  style={{ padding: '4px', fontSize: 12 }}
                  onChange={handleArchivoXLSX}
                />
                {uiImportados.length > 0 && (
                  <div className={`${styles.msg} ${styles.ok}`} style={{ marginTop: 6, fontSize: 12 }}>
                    ✓ {uiImportados.length} valores U_i cargados.
                  </div>
                )}
              </div>
            )}

            {/*Opción subintervalos para prueba de frecuencias*/}
            <div className={styles.field} style={{ marginTop: 12 }}>
              <label className={styles.fieldLabel}>
                Subintervalos (Chi-Cuadrado)
                <span className={styles.fieldHint}>vacío = automático (√N)</span>
              </label>
              <input
                type="number"
                className={styles.input}
                value={nSubInt}
                onChange={e => setNSubInt(e.target.value)}
                min={2}
                placeholder="Auto"
              />
            </div>
          </div>
        </div>

        {/*Columna 2: Selección de pruebas*/}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.cardIcon} ${styles.iconTeal}`}>✓</div>
            <span className={styles.cardTitle}>Pruebas a aplicar</span>
          </div>
          <div className={styles.cardBody}>
            {PRUEBAS_DEF.map(p => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={seleccionadas.includes(p.id)}
                  onChange={() => togglePrueba(p.id)}
                  style={{ width: 16, height: 16, accentColor: 'var(--amber-400)' }}
                />
                <div className={`${styles.cardIcon} ${styles[p.color]}`} style={{ width: 28, height: 28, fontSize: 13, borderRadius: 6 }}>
                  {p.icono}
                </div>
                <span style={{ fontSize: 13, color: 'var(--slate-200)' }}>{p.nombre}</span>
              </label>
            ))}
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--slate-500)' }}>
              {seleccionadas.length} de {PRUEBAS_DEF.length} seleccionadas
            </div>
          </div>
        </div>

        {/*Columna 3: Descripción de pruebas*/}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.cardIcon} ${styles.iconRose}`}>ℹ</div>
            <span className={styles.cardTitle}>Información</span>
          </div>
          <div className={styles.cardBody}>
            <ul className={styles.restrList} style={{ fontSize: 12 }}>
              <li><strong>Promedios (§3.1):</strong> verifica que μ ≈ 0.5 con estadístico Z₀.</li>
              <li><strong>Frecuencias (§3.2):</strong> chi-cuadrado sobre n subintervalos iguales de [0,1].</li>
              <li><strong>K-S (§3.5):</strong> distancia máxima entre distribución acumulada empírica y U[0,1].</li>
              <li><strong>Corridas (§3.7.1):</strong> independencia mediante rachas arriba/abajo del promedio.</li>
              <li><strong>Póker (§3.6):</strong> patrones en grupos de 5 dígitos (par, tercia, full…).</li>
              <li style={{ marginTop: 8, color: 'var(--slate-400)' }}>Todas usan α = 0.05. Ho: los números provienen de U[0,1].</li>
            </ul>
          </div>
        </div>
      </div>

      {/*Botones de acción*/}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button
          className={`${styles.btn} ${styles.btnAmber}`}
          style={{ flex: 2 }}
          onClick={handleEjecutar}
        >
          ▶ Ejecutar pruebas seleccionadas
        </button>
        <button
          className={`${styles.btn} ${styles.btnRose}`}
          onClick={handleLimpiarPruebas}
          title="Limpiar resultados de pruebas"
        >
          ✕ Limpiar
        </button>
      </div>

      {/*Mensajes*/}
      {msgPrueba && (
        <div className={`${styles.msg} ${styles[msgPrueba.tipo]}`}
          style={{ marginTop: 12, whiteSpace: 'pre-line' }}>
          {msgPrueba.texto}
        </div>
      )}

      {/*Resultados*/}
      {resultadosPruebas && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-300)', marginBottom: 10 }}>
            Resultados — {uiActivos.length} valores U_i analizados (α = 0.05)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {resultadosPruebas.map((res, i) => (
              <TarjetaResultado key={i} res={res} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL App
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [metodoId, setMetodoId]    = useState('mixto');
  const [semilla,  setSemilla]     = useState(17);
  const [cantidad, setCantidad]    = useState(100);
  const [modoAuto, setModoAuto]    = useState(true);
  const [resultado, setResultado]  = useState(null);
  const [msgValidacion, setMsgVal] = useState(null);

  const { valores, set: setParam, cargarAuto, reset: resetParams } = useParamsForm(metodoId);

  const parsedParams = useMemo(() => {
    const p = { ...valores };
    if (typeof p.semillas === 'string') {
      p.semillas = p.semillas.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    }
    return p;
  }, [valores]);

  //Cambio de método
  const cambiarMetodo = useCallback((id) => {
    setMetodoId(id);
    setResultado(null);
    setMsgVal(null);
    resetParams();
    if (modoAuto) setTimeout(() => cargarAuto(semilla), 0);
  }, [modoAuto, cargarAuto, resetParams, semilla]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => { cargarAuto(semilla); }, []);
  const toggleAuto = useCallback(() => {
    const nuevo = !modoAuto;
    setModoAuto(nuevo);
    if (nuevo) cargarAuto(semilla);
  }, [modoAuto, cargarAuto, semilla]);

  //Semilla aleatoria 
  const semillaAuto = useCallback(() => {
    if (metodoId === 'cuadrados') {
      const d = valores.d || 4;
      const opcionesDigitos = [];
      for (let i = 2; i <= d; i += 2) opcionesDigitos.push(i);
      if (opcionesDigitos.length === 0) opcionesDigitos.push(2);
      const digitos = opcionesDigitos[Math.floor(Math.random() * opcionesDigitos.length)];
      const min = Math.pow(10, digitos - 1);
      const max = Math.pow(10, digitos) - 1;
      let s = Math.floor(Math.random() * (max - min + 1)) + min;
      while (s % 100 === 0) s = Math.floor(Math.random() * (max - min + 1)) + min;
      setSemilla(s);
    } else if (metodoId === 'mitchell') {
      //Para mitchell semilla impar, < m
      const m = valores.m || 1024;
      let s = Math.floor(Math.random() * (m - 1)) + 1;
      if (s % 2 === 0) s = s > 1 ? s - 1 : s + 1;
      setSemilla(s);
    } else {
      const m = parsedParams.m || 1024;
      let s = Math.floor(Math.random() * Math.min(m - 1, 9999)) + 1;
      if (s % 2 === 0) s++;
      setSemilla(s);
    }
  }, [metodoId, valores.d, valores.m, parsedParams.m]);

  //[Mitchell Moore] Botón "↺ Nuevas semillas"
  // Genera 54 semillas aleatorias válidas (< m actual, no todas pares)
  const handleNuevasSemillasMitchell = useCallback(() => {
    const m = valores.m || 1024;
    if (!esPotencia2(m)) {
      setMsgVal({ tipo: 'warn', texto: '⚠ Ingresa un m válido (potencia de 2) antes de generar semillas.' });
      return;
    }
    const nuevas = generarSemillasMitchell(semilla || 1, m);
    setParam('semMitchell', nuevas.join(', '));
    setMsgVal({ tipo: 'ok', texto: `✓ 54 semillas generadas para m=${m}. Todas < ${m}, no todas pares.` });
  }, [valores.m, semilla, setParam]);

  //Validar
  const handleValidar = useCallback(() => {
    const { errores, advertencias } = validarParametros(metodoId, semilla, parsedParams);
    if (errores.length > 0) {
      setMsgVal({ tipo: 'error', texto: '✗ Errores:\n' + errores.join('\n') });
    } else if (advertencias.length > 0) {
      setMsgVal({ tipo: 'warn', texto: '⚠ Advertencias:\n' + advertencias.join('\n') });
    } else {
      setMsgVal({ tipo: 'ok', texto: '✓ Todos los parámetros son válidos.' });
    }
  }, [metodoId, semilla, parsedParams]);

  //Generar
  const handleGenerar = useCallback(() => {
    const cantidadNumerica = typeof cantidad === 'string' ? parseInt(cantidad, 10) : cantidad;
    if (isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
      setMsgVal({ tipo: 'error', texto: '✗ La cantidad debe ser un número positivo.' });
      return;
    }
    const { errores } = validarParametros(metodoId, semilla, parsedParams);
    if (errores.length > 0) {
      setMsgVal({ tipo: 'error', texto: '✗ Corrige los errores antes de generar:\n' + errores.join('\n') });
      return;
    }
    const res = generarSecuencia(metodoId, semilla, cantidadNumerica, parsedParams);
    if (res.errores.length > 0) {
      if (res.enteros.length > 0) {
        setMsgVal({ tipo: 'warn', texto: res.errores.join('\n') });
        setResultado(res);
      } else {
        setMsgVal({ tipo: 'error', texto: res.errores.join('\n') });
      }
    } else {
      setMsgVal(null);
      setResultado(res);
    }
  }, [metodoId, semilla, cantidad, parsedParams]);

//Exportar XLSX
const handleExportar = useCallback(() => {
  if (!resultado) return;
  
  let limite = resultado.enteros.length;
  //Si hay ciclo detectado, solo se exporta hasta el inicio del ciclo
  if (resultado.cortado) {
    if (metodoId === 'green' && resultado.periodoReal) {
      limite = resultado.periodoReal;
    } else {
      limite = resultado.enteros.length;
    }
  }
  
  const { enteros, normalizados } = resultado;
  const nombre = METODOS[metodoId].nombre.replace(/[^a-z0-9]/gi, '_');

  //Crear array de datos para xlsx 
  const datos = [];
  
  if (metodoId === 'mitchell') {
    //Encabezado
    datos.push(['i (desde X₀)', 'X_i (Entero)', 'U_i ∈ [0, 1]']);
    
    //Semillas (X₀ a X₅₄)
    if (resultado.semillasCompletas) {
      for (let i = 0; i < resultado.semillasCompletas.length; i++) {
        const semilla = resultado.semillasCompletas[i];
        const u = semilla / (parsedParams.m || 1024);
        datos.push([i, semilla, parseFloat(u.toFixed(5))]);
      }
    }
    
    //Números generados (X₅₅ en adelante)
    for (let i = 0; i < limite; i++) {
      datos.push([i + 55, enteros[i], parseFloat(normalizados[i].toFixed(5))]);
    }
  } else {
    //Para otros métodos
    datos.push(['i', 'X_i (Entero)', 'U_i (Normalizado [0-1])']);
    for (let i = 0; i < limite; i++) {
      datos.push([i, enteros[i], parseFloat(normalizados[i].toFixed(5))]);
    }
  }

  //Crear y guardar el archivo xlsx
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(datos);
  XLSX.utils.book_append_sheet(wb, ws, 'Números generados');
  XLSX.writeFile(wb, `numeros_${nombre}.xlsx`);
  
}, [resultado, metodoId, parsedParams.m]);

//Limpiar
const handleLimpiar = useCallback(() => {
  setResultado(null);
  setMsgVal(null);
}, []);

//Stats
const stats = useMemo(() => {
  if (!resultado || resultado.normalizados.length === 0) return null;
  const nums = resultado.normalizados;
  const media = nums.reduce((a, b) => a + b, 0) / nums.length; //Recorremos el arreglo para reducirlo
  return { media: media.toFixed(4) };
}, [resultado]);

const metaActual = METODOS[metodoId];

//Badge topbar por método 
const topbarBadge = () => {
  if (!resultado) return null;
  if (metodoId === 'green') {
    const ok = resultado.periodoReal === resultado.maxPeriodo;
    return (
      <span className={`${styles.badge} ${ok ? styles.badgeOk : styles.badgeWarn}`}>
        {ok ? '✓' : '⚠'} Período: {(resultado.periodoReal ?? resultado.periodo).toLocaleString()}
        {ok ? ' (completo)' : ' (no completo)'}
      </span>
    );
  }
  if (metodoId === 'mixto' || metodoId === 'mult') {
    const ok = resultado.periodo === resultado.maxPeriodo;
    return (
      <span className={`${styles.badge} ${ok ? styles.badgeOk : styles.badgeWarn}`}>
        {ok ? '✓' : '⚠'} Período: {resultado.periodo.toLocaleString()}
        {ok ? ' (completo)' : ' (no completo)'}
      </span>
    );
  }
  if (metodoId === 'mitchell') {
  //Mostrar período real si hay ciclo, o generados si no
    return (
      <span className={`${styles.badge} ${resultado.cortado ? styles.badgeWarn : styles.badgeInfo}`}>
        {resultado.cortado 
        ? `⚠ Período real: ${resultado.periodoReal?.toLocaleString() || resultado.periodo.toLocaleString()}`
        : `ℹ Periodo completo teórico ${resultado.maxPeriodo.toExponential(4)}`}
      </span>
    );
  }
  return (
    <PeriodoBadge
    completo={resultado.periodoCompleto}
    cortado={resultado.cortado}
    periodo={resultado.periodo}
    maxPeriodo={resultado.maxPeriodo}
    />
  );
};

// ─────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────
return (
  <div className={styles.shell}>

    {/*TOPBAR*/}
    <header className={styles.topbar}>
      <div className={styles.logoBadge}>ψ</div>
      <div className={styles.topbarText}>
        <div className={styles.topbarTitle}>Generador de números pseudoaleatorios</div>
        <div className={styles.topbarSub}>© 2026 Simulación Digital · 5 métodos</div>
      </div>
        <div style={{ 
          display: 'flex', 
          gap: '20px',
          marginLeft: 'auto',
          marginRight: '20px',
          fontSize: '13px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.8)',
          background: 'rgba(184,115,51,0.15)',
          padding: '6px 16px',
          borderRadius: '20px',
          border: '1px solid rgba(184,115,51,0.3)',
          letterSpacing: '0.3px'
        }}>
          <span>Desarrolladores:</span>
          <span>Boris Bello</span>
          <span style={{ color: 'var(--amber-lt)' }}>•</span>
          <span>Sofhia Prasca</span>
        </div>

      {topbarBadge()}
      </header>



      {/*CONTENIDO PRINCIPAL*/}
      <div style={{ padding: '20px 26px' }}>
        
        {/*FILA 1 TRES TARJETAS EN HORIZONTAL*/}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '16px',
          marginBottom: '20px'
        }}>
          
          {/*Tarjeta 1: CONFIGURACIÓN*/}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={`${styles.cardIcon} ${styles.iconAmber}`}>⚙</div>
              <span className={styles.cardTitle}>Configuración</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Método generador</label>
                <select
                  className={styles.select}
                  value={metodoId}
                  onChange={e => cambiarMetodo(e.target.value)}
                >
                  <option value="mixto">1. Congruencial Mixto (GCL)</option>
                  <option value="mult">2. Congruencial Multiplicativo (GCL)</option>
                  <option value="cuadrados">3. Cuadrados Medios (Von Neumann)</option>
                  <option value="mitchell">4. Mitchell-Moore (j=24, k=55)</option>
                  <option value="green">5. Aditivo de Green</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Semilla X₀
                  {metodoId === 'mitchell' && (
                    <span className={styles.fieldHint}>será X₀ de las 55 semillas</span>
                  )}
                </label>
                <div className={styles.fieldRow}>
                  <input
                    type="number"
                    className={styles.input}
                    value={semilla}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '') { setSemilla(''); }
                      else { const n = Number(v); if (!isNaN(n)) setSemilla(n); }
                    }}
                    min={1}
                  />
                  <button
                    className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                    onClick={semillaAuto} title="Semilla aleatoria">
                    ⟳
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Cantidad a generar
                  {metodoId === 'mitchell' && (
                    <span className={styles.fieldHint}>resultados desde X₅₅</span>
                  )}
                  {metodoId !== 'mitchell' && (
                    <span className={styles.fieldHint}>se detiene si hay ciclo</span>
                  )}
                </label>
                <input
                  type="number"
                  className={styles.input}
                  value={cantidad}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === '') { setCantidad(''); }
                    else {
                      const n = Number(v);
                      if (!isNaN(n) && n >= 1 && n <= 100000) setCantidad(n);
                    }
                  }}
                  min={1}
                  max={100000}
                />
              </div>
            </div>
          </div>

          {/*Tarjeta 2: PARÁMETROS*/}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={`${styles.cardIcon} ${styles.iconBlue}`}>λ</div>
              <span className={styles.cardTitle}>Parámetros</span>
            </div>
            <div className={styles.cardBody}>
              <FormulaBox texto={metaActual.formula} />

              {metodoId !== 'mitchell' && (
                <Toggle
                  value={modoAuto}
                  onChange={toggleAuto}
                  label={modoAuto ? 'Parámetros automáticos (óptimos)' : 'Parámetros manuales'}
                />
              )}

              <div style={{ marginTop: 12 }}>
                <FormularioParametros
                  metodoId={metodoId}
                  valores={valores}
                  onChange={setParam}
                  modoAuto={metodoId !== 'mitchell' && modoAuto}
                  onNuevasSemillasMitchell={handleNuevasSemillasMitchell}
                />
              </div>

              <button
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnFull}`}
                style={{ marginTop: 12 }}
                onClick={handleValidar}
              >
                ✓ Validar parámetros
              </button>

              {msgValidacion && (
                <div className={`${styles.msg} ${styles[msgValidacion.tipo]}`}
                  style={{ marginTop: 10, whiteSpace: 'pre-line' }}>
                  {msgValidacion.texto}
                </div>
              )}
            </div>
          </div>

          {/*Tarjeta 3: RESTRICCIONES*/}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={`${styles.cardIcon} ${styles.iconRose}`}>!</div>
              <span className={styles.cardTitle}>Restricciones e indicaciones</span>
            </div>
            <div className={styles.cardBody}>
              <ul className={styles.restrList}>
                {metaActual.restricciones.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>     

        {/*FILA 2: BOTONES DE ACCIÓN RESPONSIVE*/}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: '8px', 
          marginBottom: '20px'
        }}>
          <button
            className={`${styles.btn} ${styles.btnAmber}`}
            style={{ flex: '2 1 200px' }}  /* Mínimo 200px, luego crece */
            onClick={handleGenerar}
          >
            ▶ Generar números
          </button>
          <button
            className={`${styles.btn} ${styles.btnTeal}`}
            style={{ flex: '1 1 150px' }}
            onClick={handleExportar}
            disabled={!resultado}
          >
            ⬇ Exportar XLSX
          </button>
          <button
            className={`${styles.btn} ${styles.btnRose}`}
            style={{ flex: '0 1 auto' }}
            onClick={handleLimpiar}
            title="Limpiar resultados"
          >
            ✕
          </button>
        </div>

        {/*FILA 3: MENSAJES DE ESTADO*/}
        {resultado?.cortado && metodoId === 'mitchell' && (
          <div className={`${styles.msg} ${styles.warn} fade-up`} style={{ marginBottom: '16px' }}>
            <strong>⚠ Ciclo de secuencia detectado.</strong><br />
            El estado completo del buffer (55 valores) se repitió.
            Período real: <strong>{resultado.periodo.toLocaleString()}</strong>.<br />
            Período máximo teórico: <strong>{resultado.maxPeriodo.toExponential(4)}</strong>.<br />
            <em>Se muestran los {resultado.enteros.length.toLocaleString()} valores generados hasta que se repite la secuencia (desde X55).</em>
          </div>
        )}

        {resultado && !resultado.cortado && metodoId === 'mitchell' && (
          <div className={`${styles.msg} ${styles.ok} fade-up`} style={{ marginBottom: '16px' }}>
            ✓ {resultado.enteros.length.toLocaleString()} valores generados
            sin ciclo detectado en el rango solicitado.<br />
            Período máximo teórico: <strong>{resultado.maxPeriodo.toExponential(4)}</strong>
            {' '}(prácticamente inagotable para m={'2^' + Math.round(Math.log2(parsedParams.m || 1024))}).<br />
            Tener en cuenta que el periodo no incluye los números que ayudaron a generar la secuencia.
          </div>
        )}

        {resultado?.cortado && metodoId === 'green' && (
          <div className={`${styles.msg} ${styles.warn} fade-up`} style={{ marginBottom: '16px' }}>
            <strong>⚠ Período completo detectado.</strong><br />
            La secuencia completó su ciclo en el elemento <strong>{resultado.periodoReal}</strong>.
            Período máximo teórico: <strong>{formatearNumero(resultado.maxPeriodo)}</strong>.<br />
            <em>A partir de ahora la secuencia se repetirá.</em>
          </div>
        )}

        {resultado?.cortado && metodoId !== 'mitchell' && metodoId !== 'green' && (
          <div className={`${styles.msg} ${styles.warn} fade-up`} style={{ marginBottom: '16px' }}>
            {(metodoId === 'mixto' || metodoId === 'mult') && resultado.periodo === resultado.maxPeriodo ? (
              <>
                <strong>✓ Período completo alcanzado.</strong><br />
                Se generaron los <strong>{resultado.periodo}</strong> números del ciclo completo.
                Período máximo teórico: <strong>{resultado.maxPeriodo.toLocaleString()}</strong>.
              </>
            ) : (
              <>
                <strong>⚠ Período no completo detectado.</strong><br />
                La secuencia se repitió en el elemento <strong>{resultado.enteros.length}</strong> de
                los <strong>{cantidad}</strong> solicitados.
                Período real: <strong>{resultado.periodo.toLocaleString()}</strong> |
                Período máx. teórico: <strong>{resultado.maxPeriodo.toLocaleString()}</strong>.<br />
                <em>Se muestran solo los {resultado.enteros.length} valores únicos antes del ciclo.</em>
              </>
            )}
          </div>
        )}

        {resultado && !resultado.cortado && metodoId !== 'mitchell' && (
          <div className={`${styles.msg} ${styles.ok} fade-up`} style={{ marginBottom: '16px' }}>
            ✓ {resultado.enteros.length.toLocaleString()} números generados sin
            repetición en el rango solicitado.
            Período real: <strong>{resultado.periodo.toLocaleString()}</strong> |
            Período máx. teórico: <strong>{resultado.maxPeriodo.toLocaleString()}</strong>.
            {metodoId === 'cuadrados' && resultado.mensajeDegeneracion && (
              <><br />{resultado.mensajeDegeneracion}</>
            )}
          </div>
        )}

        {/*FILA 4: STATS*/}
        {resultado && stats && (
          <div className={`${styles.statsRow} fade-up`} style={{ marginBottom: '16px' }}>
            <StatBox
              label={metodoId === 'mitchell' ? 'Generados (desde X55)' : 'Generados'}
              value={resultado.enteros.length.toLocaleString()}
              color="amber"
            />
            {metodoId === 'mitchell' ? (
              <StatBox
                label="Período (ciclo detectado)"
                value={resultado.cortado ? resultado.periodo.toLocaleString() : 'Sin ciclo'}
                color={resultado.cortado ? 'rose' : 'teal'}
              />
            ) : metodoId === 'green' && resultado.cortado ? (
              <StatBox label="Período Real" value={(resultado.periodoReal ?? resultado.periodo).toLocaleString()} color="blue" />
            ) : (
              <StatBox label="Período" value={resultado.periodo.toLocaleString()} />
            )}
          </div>
        )}

        {/*FILA 5: TABLA DE RESULTADOS*/}
        {resultado && resultado.enteros.length > 0 ? (
          <div className={`${styles.card} fade-up`} style={{ marginBottom: '20px' }}>
            <div className={styles.cardHead}>
              <div className={styles.cardHeadLeft}>
                <div className={`${styles.cardIcon} ${styles.iconTeal}`}>#</div>
                <span className={styles.cardTitle}>
                  {metaActual.nombre}
                  {metodoId === 'mitchell'
                    ? ` — ${resultado.enteros.length.toLocaleString()} valores`
                    : ` — ${resultado.enteros.length.toLocaleString()} números`}
                </span>
              </div>

              {/*Badge en la cabecera de la tabla*/}
              {metodoId === 'mitchell' ? (
                <span className={`${styles.badge} ${resultado.cortado ? styles.badgeWarn : styles.badgeInfo}`}>
                  {resultado.cortado
                    ? `⚠ Período real: ${resultado.periodoReal?.toLocaleString() || resultado.periodo.toLocaleString()}`
                    : `ℹ Período: ${resultado.periodo.toLocaleString()}`}
                </span>
              ) : metodoId === 'green' ? (
                <span className={`${styles.badge} ${resultado.cortado ? styles.badgeOk : styles.badgeInfo}`}>
                  {resultado.cortado
                    ? `✓ Período real: ${(resultado.periodoReal ?? resultado.periodo).toLocaleString()}`
                    : `ℹ Período: ${resultado.periodo.toLocaleString()}`}
                </span>
              ) : metodoId === 'mixto' || metodoId === 'mult' ? (
                <span className={`${styles.badge} ${resultado.periodo === resultado.maxPeriodo ? styles.badgeOk : styles.badgeWarn}`}>
                  {resultado.periodo === resultado.maxPeriodo ? '✓' : '⚠'} Período: {resultado.periodo.toLocaleString()}
                  {resultado.periodo === resultado.maxPeriodo ? ' (completo)' : ' (no completo)'}
                </span>
              ) : (
                <PeriodoBadge
                  completo={resultado.periodoCompleto}
                  cortado={resultado.cortado}
                  periodo={resultado.periodo}
                  maxPeriodo={resultado.maxPeriodo}
                />
              )}
            </div>
            <TablaResultados 
              enteros={resultado.enteros} 
              normalizados={resultado.normalizados} 
              indiceInicio={metodoId === 'mitchell' ? 55 : 0}
            />
          </div>
        ) : (
          <div className={styles.emptyState} style={{ marginBottom: '20px' }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <rect x="8" y="8" width="40" height="40" rx="8" stroke="#d6d1c8" strokeWidth="1.5" />
              <path d="M20 28h16M28 20v16" stroke="#d6d1c8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p>
              Configura los parámetros en el panel izquierdo<br />
              y presiona <strong>Generar números</strong>.
            </p>
          </div>
        )}

        {/*FILA 6: MÓDULO DE PRUEBAS ESTADÍSTICAS*/}
        <ModuloPruebas resultadoGenerador={resultado} />
      </div>
    </div>
  );
}
