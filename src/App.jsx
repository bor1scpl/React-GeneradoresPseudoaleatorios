// ─────────────────────────────────────────────────────────────
//  Imports
// ─────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import { useState, useCallback, useMemo } from 'react';
import { METODOS, generarSecuencia, validarParametros, esPotencia2, generarSemillasMitchell} from './generadores';
import styles from './App.module.css';
import { aplicarPruebas, } from './pruebas';
import { DISTRIBUCIONES, generarVariables, estadisticasDescriptivas } from './variables';

// ─────────────────────────────────────────────────────────────
//  Utilidades varias para formateo de números grandes, etc.
// ─────────────────────────────────────────────────────────────
const formatearNumero = (num) => {
  if (!num) return '0';
  if (num > 10_000_000) return num.toExponential(2);
  if (num > 1000) return num.toLocaleString();
  return num.toString();
};

// ─────────────────────────────────────────────────────────────
//  Componentes pequeños para badges de estado, cajas de fórmula, toggles, etc.
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
//  Hook personalizado para manejar el estado de los parámetros del formulario, con función para cargar valores automáticos según el método seleccionado
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
//  Componente FormularioParametros que renderiza dinámicamente los campos de entrada según el método seleccionado, con soporte para campos especiales como semillas Mitchell-Moore y semillas Green, y un botón para generar nuevas semillas automáticamente en el caso de Mitchell-Moore.
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
//  Componente TablaResultados
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

// ═══════════════════════════════════════════════════════════════
//  Componente ModuloVariables
//  Convierte U_i en variables aleatorias no-uniformes (Coss Bu Cap. 4) y muestra estadísticas descriptivas básicas, con opción de exportar a XLSX para análisis externo
// ═══════════════════════════════════════════════════════════════
function ModuloVariables({ resultadoGenerador, onVariablesGeneradas }) {
  const [distId,    setDistId]    = useState('exponencial');
  const [params,    setParams]    = useState({});
  const [fuente,    setFuente]    = useState('generador');
  const [uiImp,     setUiImp]     = useState([]);
  const [resultado, setResultado] = useState(null);
  const [msg,       setMsg]       = useState(null);
  const [verTabla,  setVerTabla]  = useState(false);

const uiActivos = useMemo(() => {
  return fuente === 'generador'
    ? (resultadoGenerador?.normalizados || [])
    : uiImp;
}, [fuente, resultadoGenerador?.normalizados, uiImp]);

  const distDef = DISTRIBUCIONES.find(d => d.id === distId);
  const setParam = (key, val) => setParams(prev => ({ ...prev, [key]: val }));

  const handleArchivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const workbook = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
        const ui = [];
        const header = jsonData[0] || [];
        let colIdx = header.findIndex(h => String(h).toLowerCase().includes('normal'));
        if (colIdx < 0) colIdx = header.length - 1;
        const inicio = jsonData.length > 0 && isNaN(parseFloat(jsonData[0][colIdx])) ? 1 : 0;
        for (let i = inicio; i < jsonData.length; i++) {
          const row = jsonData[i];
          const v = parseFloat(row[colIdx]);
          if (!isNaN(v) && v >= 0 && v <= 1) ui.push(v);
        }
        setUiImp(ui);
        setMsg(ui.length > 0
          ? { tipo: 'ok', texto: `✓ ${ui.length} valores U_i cargados desde XLSX.` }
          : { tipo: 'error', texto: '✗ No se encontraron valores U_i válidos en el archivo.' });
      } catch {
        setMsg({ tipo: 'error', texto: '✗ Error al leer el archivo XLSX.' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleGenerar = useCallback(() => {
    if (uiActivos.length === 0) {
      setMsg({ tipo: 'error', texto: fuente === 'generador'
        ? '✗ Genera números primero con el panel de arriba.'
        : '✗ Carga un archivo XLSX.' });
      return;
    }
    const parsedParams = {};
    for (const [k, v] of Object.entries(params)) {
      parsedParams[k] = Number(v);
    }
    const res = generarVariables(distId, uiActivos, parsedParams);
    if (res.errores.length > 0) {
      setMsg({ tipo: 'error', texto: res.errores.join('\n') });
      return;
    }
    const stats = estadisticasDescriptivas(res.valores);
    setResultado({ ...res, stats, distId, params: { ...parsedParams } });
    setMsg(null);
    setVerTabla(false);
    onVariablesGeneradas?.({ ...res, stats, distId, params: { ...parsedParams } });
  }, [distId, uiActivos, params, fuente, onVariablesGeneradas]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportar = useCallback(() => {
    if (!resultado) return;
    const dist = DISTRIBUCIONES.find(d => d.id === resultado.distId);
    
    //Encabezado: índice, U_i usado, valor generado
    const datos = [
      ['i', 'U_i (uniforme)', `X_i (${dist?.nombre || resultado.distId})`]
    ];
    
    resultado.valores.forEach((v, i) => {
      const ui = uiActivos[i] !== undefined ? parseFloat(uiActivos[i].toFixed(6)) : '';
      datos.push([i + 1, ui, parseFloat(v.toFixed(6))]);
    });
    
    //Crear y guardar archivo XLSX
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(datos);
    XLSX.utils.book_append_sheet(wb, ws, `Variables_${resultado.distId}`);
    XLSX.writeFile(wb, `variables_${resultado.distId}.xlsx`);
  }, [resultado, uiActivos]);

  const MAX_TABLA = 200;

  return (
    <div className={styles.variablesModule}>
      {/*Encabezado*/}
      <div className={styles.pruebasHeader}>
        <div className={`${styles.cardIcon} ${styles.iconAmber}`}>f(x)</div>
        <div style={{ flex: 1 }}>
          <div className={styles.cardTitle}>Variables Aleatorias No-Uniformes</div>
          <div className={styles.pruebasSub}>
            Coss Bu Cap. 4 · Transformada Inversa, Composición, Box-Muller, Procedimientos Especiales
          </div>
        </div>
        {resultado && (
          <span className={`${styles.badge} ${styles.badgeOk}`}>
            ✓ {resultado.valores.length.toLocaleString()} valores generados
          </span>
        )}
      </div>

      {/*Controles en 3 columnas*/}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 16 }}>

        {/*Col 1 — Fuente + Distribución*/}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.cardIcon} ${styles.iconAmber}`}>⊞</div>
            <span className={styles.cardTitle}>Fuente de U_i y distribución</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Origen de los U_i</label>
              <select className={styles.select} value={fuente}
                onChange={e => { setFuente(e.target.value); setResultado(null); setMsg(null); }}>
                <option value="generador">Usar números generados arriba</option>
                <option value="xlsx">Importar desde archivo XLSX</option>
              </select>
            </div>
            {fuente === 'generador' && (
              <div className={`${styles.msg} ${uiActivos.length > 0 ? styles.ok : styles.warn}`}
                style={{ fontSize: 12 }}>
                {uiActivos.length > 0
                  ? `✓ ${uiActivos.length} valores U_i disponibles.`
                  : '⚠ Genera números primero con el panel de arriba.'}
              </div>
            )}
            {fuente === 'xlsx' && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Archivo XLSX
                  <span className={styles.fieldHint}>mismo formato que puedes exportar en la generación de números (columna Normalizado)</span>
                </label>
                <input type="file" accept=".xlsx,.xls" className={styles.input}
                  style={{ padding: 4, fontSize: 12 }} onChange={handleArchivo} />
                {uiImp.length > 0 && (
                  <div className={`${styles.msg} ${styles.ok}`} style={{ marginTop: 6, fontSize: 12 }}>
                    ✓ {uiImp.length} valores cargados.
                  </div>
                )}
              </div>
            )}
            <div className={styles.field} style={{ marginTop: 8 }}>
              <label className={styles.fieldLabel}>Distribución de probabilidad</label>
              <select className={styles.select} value={distId}
                onChange={e => { setDistId(e.target.value); setParams({}); setResultado(null); setMsg(null); }}>
                {DISTRIBUCIONES.map(d => (
                  <option key={d.id} value={d.id}>{d.nombre} — {d.metodo.split('(')[0].trim()}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/*Col 2 — Parámetros*/}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.cardIcon} ${styles.iconBlue}`}>λ</div>
            <span className={styles.cardTitle}>Parámetros</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.formulaBox}>
              <span className={styles.formulaLabel}>FÓRMULA</span>
              <span className={styles.formulaText}>{distDef?.formula}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--slate-500)', marginBottom: 10 }}>
              Método: {distDef?.metodo}
            </div>
            {distDef?.params.map(({ key, label, hint }) => (
              <div key={key} className={styles.field}>
                <label className={styles.fieldLabel}>
                  {label}
                  {hint && <span className={styles.fieldHint}>{hint}</span>}
                </label>
                <input type="number" className={styles.input}
                  value={params[key] ?? ''}
                  onChange={e => setParam(key, e.target.value === '' ? '' : Number(e.target.value))}
                  step="any" />
              </div>
            ))}
          </div>
        </div>

        {/*Col 3 — Restricciones*/}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.cardIcon} ${styles.iconRose}`}>!</div>
            <span className={styles.cardTitle}>Restricciones y detalles</span>
          </div>
          <div className={styles.cardBody}>
            <ul className={styles.restrList}>
              {distDef?.restricciones.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/*Botones*/}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className={`${styles.btn} ${styles.btnAmber}`}
          style={{ flex: 2 }} onClick={handleGenerar}>
          ▶ Transformar U_i → {distDef?.nombre}
        </button>
        <button className={`${styles.btn} ${styles.btnTeal}`}
          onClick={handleExportar} disabled={!resultado} title="Exportar XLSX">
          ⬇ XLSX
        </button>
        <button className={`${styles.btn} ${styles.btnRose}`}
          onClick={() => { setResultado(null); setMsg(null); }}
          title="Limpiar">✕
        </button>
      </div>

      {/*Mensaje*/}
      {msg && (
        <div className={`${styles.msg} ${styles[msg.tipo]}`}
          style={{ marginTop: 12, whiteSpace: 'pre-line' }}>
          {msg.texto}
        </div>
      )}

      {/*Resultados*/}
      {resultado && resultado.stats && (
        <div style={{ marginTop: 18 }}>
          {/*Tabla*/}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardHeadLeft}>
                <div className={`${styles.cardIcon} ${styles.iconTeal}`}>#</div>
                <span className={styles.cardTitle}>
                  {distDef?.nombre} — {resultado.valores.length.toLocaleString()} valores
                </span>
              </div>
              <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                onClick={() => setVerTabla(v => !v)}>
                {verTabla ? '▲ Ocultar tabla' : '▼ Ver tabla'}
              </button>
            </div>
              {verTabla && (
                <div className={styles.tableWrap}>
                  <div className={styles.tableScroll}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>i</th>
                          {distId === 'binomial' || distId === 'erlang' ? (
                            <>
                              <th>U_i usados (n = {params.n || '?'})</th>
                              <th>X_i ({distDef?.nombre})</th>
                            </>
                          ) : distId === 'normal' ? (
                            <>
                              <th>U₁</th>
                              <th>U₂</th>
                              <th>Z₁ = √(−2·ln U₁)·cos(2π·U₂)</th>
                              <th>X₁ = μ + σ·Z₁</th>
                              <th>Z₂ = √(−2·ln U₁)·sin(2π·U₂)</th>
                              <th>X₂ = μ + σ·Z₂</th>
                            </>
                          ) : (
                            <>
                              <th>X_i ({distDef?.nombre})</th>
                              <th>U_i usado</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {distId === 'normal' ? (
                          //Visualización especial para Normal: mostrar pares (U1,U2) y los dos valores Z y X generados
                          (() => {
                            const filas = [];
                            //Para Normal, cada 2 U_i generan 2 valores Z y 2 valores X
                            for (let i = 0; i + 1 < uiActivos.length && filas.length < MAX_TABLA; i += 2) {
                              const u1 = uiActivos[i];
                              const u2 = uiActivos[i + 1];
                              const R1 = u1 === 0 ? 1e-10 : u1;
                              const R2 = u2;
                              const Z1 = Math.sqrt(-2 * Math.log(R1)) * Math.cos(2 * Math.PI * R2);
                              const Z2 = Math.sqrt(-2 * Math.log(R1)) * Math.sin(2 * Math.PI * R2);
                              const X1 = (params.mu || 0) + (params.sigma || 1) * Z1;
                              const X2 = (params.mu || 0) + (params.sigma || 1) * Z2;
                              filas.push(
                                <tr key={i}>
                                  <td className={styles.tdIdx}>{Math.floor(i / 2) + 1}</td>
                                  <td className={styles.tdNorm}>{u1.toFixed(6)}</td>
                                  <td className={styles.tdNorm}>{u2.toFixed(6)}</td>
                                  <td className={styles.tdNorm}>{Z1.toFixed(6)}</td>
                                  <td className={styles.tdNorm}>{X1.toFixed(6)}</td>
                                  <td className={styles.tdNorm}>{Z2.toFixed(6)}</td>
                                  <td className={styles.tdNorm}>{X2.toFixed(6)}</td>
                                </tr>
                              );
                            }
                            return filas;
                          })()
                        ) : (distId === 'binomial' || distId === 'erlang') ? (
                          //Visualización especial para Binomial y Erlang
                          (() => {
                            const nInt = Math.max(1, Math.floor(params.n || 1));
                            const filas = [];
                            for (let idx = 0; idx < resultado.valores.length && idx < MAX_TABLA; idx++) {
                              const inicio = idx * nInt;
                              const uiGrupo = uiActivos.slice(inicio, inicio + nInt);
                              filas.push(
                                <tr key={idx}>
                                  <td className={styles.tdIdx}>{idx + 1}</td>
                                  <td className={styles.tdNorm}>
                                    {uiGrupo.map((u, j) => (
                                      <span key={j} style={{ display: 'inline-block', marginRight: '6px' }}>
                                        {u !== undefined ? u.toFixed(6) : '—'}
                                      </span>
                                    ))}
                                  </td>
                                  <td className={styles.tdInt}>
                                    {distId === 'binomial' 
                                      ? resultado.valores[idx].toFixed(0)
                                      : resultado.valores[idx].toFixed(6)
                                    }
                                  </td>
                                </tr>
                              );
                            }
                            return filas;
                          })()
                        ) : (
                          //Visualización normal para otras distribuciones
                          resultado.valores.slice(0, MAX_TABLA).map((v, i) => (
                            <tr key={i}>
                              <td className={styles.tdIdx}>{i + 1}</td>
                              <td className={styles.tdInt}>{v.toFixed(6)}</td>
                              <td className={styles.tdNorm}>
                                {uiActivos[i] !== undefined ? uiActivos[i].toFixed(6) : '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </div>

          {/*Panel de fórmulas Excel*/}
          {distDef?.excelFormulas && (
            <div className={styles.card} style={{ marginTop: 14 }}>
              <div className={styles.cardHead}>
                <div className={`${styles.cardIcon} ${styles.iconBlue}`}>XL</div>
                <span className={styles.cardTitle}>
                  Verificación en Excel — {distDef.nombre}
                </span>
                <span style={{ fontSize: 11, color: 'var(--slate-500)', marginLeft: 8 }}>
                  formulas recomendadas para comprobar los valores generados, igual que lo harías en simulación manual
                </span>
              </div>
              <div className={styles.cardBody}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                  {distDef.excelFormulas.map((ef, idx) => (
                    <div key={idx} style={{
                      background: 'var(--slate-50, #f8fafc)',
                      border: '1px solid var(--slate-200, #e2e8f0)',
                      borderRadius: 8,
                      padding: '10px 12px',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-600)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {ef.titulo}
                      </div>
                      <div style={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        background: 'var(--slate-100, #f1f5f9)',
                        borderRadius: 4,
                        padding: '4px 8px',
                        color: 'var(--emerald-700, #047857)',
                        marginBottom: 4,
                        wordBreak: 'break-all',
                      }}>
                        {ef.formula}
                      </div>
                      <div style={{
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: 'var(--blue-600, #2563eb)',
                        marginBottom: 4,
                        wordBreak: 'break-all',
                      }}>
                        Ej: {ef.ejemplo}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--slate-500)', fontStyle: 'italic' }}>
                        {ef.nota}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
//  Componente AnalisisVariables
//  Análisis de simulación: funciones tipo Excel sobre variables generadas
//  Orientado a resolver preguntas de problemas de simulación digital
// ═══════════════════════════════════════════════════════════════
function AnalisisVariables({ resultadoGenerador, resultadoVariables }) {
  //Estado de las distintas herramientas
  const [tabActiva, setTabActiva] = useState('contarsi');   // 'contarsi'|'grupos'|'frecuencia'|'resumen'

  //CONTAR.SI — pregunta libre
  const [condCS, setCondCS]       = useState('');
  const [valorCS, setValorCS]     = useState('');
  const [resCS, setResCS]         = useState(null);

  //GRUPOS — análisis por grupos de n (ej: 5 lámparas)
  const [tamGrupo, setTamGrupo]   = useState(5);
  const [condGrupo, setCondGrupo] = useState('');
  const [valorGrupo, setValorGrupo] = useState('');
  const [resGrupo, setResGrupo]   = useState(null);

  //TABLA DE FRECUENCIAS — intervalos automáticos o Poisson
  // eslint-disable-next-line no-unused-vars
  const [numInterv, setNumInterv] = useState(5);
  // eslint-disable-next-line no-unused-vars
  const [resFrecuencia, setResFrecuencia] = useState(null);

  //Datos fuente: Variables Aleatorias > U_i del generador ──
  const datos = useMemo(() => {
  return resultadoVariables?.valores || resultadoGenerador?.normalizados || [];
  }, [resultadoVariables?.valores, resultadoGenerador?.normalizados]);
  const distId = resultadoVariables?.distId || null;
  const distDef = DISTRIBUCIONES.find(d => d.id === distId);
  const nombreVar = distDef?.nombre || (resultadoVariables ? 'X_i' : 'U_i');
  const n = datos.length;

  //Estadísticas básicas siempre visibles
  const statsBase = useMemo(() => {
    if (n === 0) return null;
    const sorted = [...datos].sort((a, b) => a - b);
    const media  = datos.reduce((s, x) => s + x, 0) / n;
    const varianza = datos.reduce((s, x) => s + (x - media) ** 2, 0) / n;
    //Moda aproximada (valor más repetido, redondeado a 4 dec)
    const freq = {};
    datos.forEach(v => { const k = v.toFixed(4); freq[k] = (freq[k] || 0) + 1; });
    const modaEntry = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    const repetidas = Object.values(freq).filter(c => c > 1).length;
    return {
      n, media, mediana: n % 2 === 0
        ? (sorted[n/2-1] + sorted[n/2]) / 2
        : sorted[Math.floor(n/2)],
      min: sorted[0], max: sorted[n-1],
      varianza, desv: Math.sqrt(varianza),
      moda: modaEntry ? parseFloat(modaEntry[0]) : null,
      modaFrec: modaEntry ? modaEntry[1] : 0,
      repetidas,
    };
  }, [datos, n]);

  const buildPredicate = (op, val) => {
    const v = parseFloat(val);
    if (isNaN(v)) return null;
    switch (op) {
      case '<':  return x => x < v;
      case '<=': return x => x <= v;
      case '>':  return x => x > v;
      case '>=': return x => x >= v;
      case '=':
      case '==': return x => Math.abs(x - v) < 1e-9;
      case '!=': return x => Math.abs(x - v) >= 1e-9;
      default:   return null;
    }
  };

  //CONTAR.SI global
  const handleContarSI = useCallback(() => {
    if (n === 0) { setResCS({ error: 'No hay datos disponibles.' }); return; }
    const pred = buildPredicate(condCS, valorCS);
    if (!pred) { setResCS({ error: 'Ingresa un operador (< <= > >= = !=) y un valor numérico.' }); return; }
    const cumplen = datos.filter(pred);
    const proporcion = cumplen.length / n;
    setResCS({
      cumplen: cumplen.length,
      noCumplen: n - cumplen.length,
      proporcion,
      condicion: `${condCS} ${valorCS}`,
      menores: cumplen,
    });
  }, [datos, n, condCS, valorCS]);

  //Análisis por grupos de n (ej: lotes de 5 lámparas)
  const handleGrupos = useCallback(() => {
    if (n === 0) { setResGrupo({ error: 'No hay datos disponibles.' }); return; }
    const tam = Math.max(1, Math.floor(tamGrupo));
    const pred = buildPredicate(condGrupo, valorGrupo);
    if (!pred) { setResGrupo({ error: 'Ingresa un operador y valor para la condición.' }); return; }

    const grupos = [];
    for (let i = 0; i + tam <= n; i += tam) {
      const slice = datos.slice(i, i + tam);
      const c = slice.filter(pred).length;
      grupos.push({ idx: grupos.length + 1, valores: slice, cumplen: c, total: tam, proporcion: c / tam });
    }
    if (grupos.length === 0) {
      setResGrupo({ error: `Se necesitan al menos ${tam} datos para formar 1 grupo.` }); return;
    }
    const totalCumplen = grupos.reduce((s, g) => s + g.cumplen, 0);
    const totalElem    = grupos.reduce((s, g) => s + g.total, 0);
    const promProp     = grupos.reduce((s, g) => s + g.proporcion, 0) / grupos.length;
    setResGrupo({
      grupos,
      numGrupos: grupos.length, tamGrupo: tam,
      totalCumplen, totalElem,
      proporcionGlobal: totalCumplen / totalElem,
      promedioProp: promProp,
      condicion: `${condGrupo} ${valorGrupo}`,
    });
  }, [datos, n, tamGrupo, condGrupo, valorGrupo]);

  //Tabla de frecuencias
  // eslint-disable-next-line no-unused-vars
  const handleFrecuencia = useCallback(() => {
    if (n === 0) { setResFrecuencia({ error: 'No hay datos.' }); return; }
    const esDiscreta = distId === 'poisson' || distId === 'binomial';

    if (esDiscreta) {
      //Tabla discreta por valor entero
      const freq = {};
      datos.forEach(v => { const k = Math.round(v); freq[k] = (freq[k] || 0) + 1; });
      const keys = Object.keys(freq).map(Number).sort((a, b) => a - b);
      let acum = 0;
      const filas = keys.map(k => {
        acum += freq[k];
        return { label: `X = ${k}`, fi: freq[k], fri: freq[k] / n, Fri: acum / n };
      });
      setResFrecuencia({ tipo: 'discreta', filas, n });
    } else {
      //Tabla continua por intervalos
      const k = Math.max(2, Math.min(20, Math.floor(numInterv)));
      const min = statsBase.min, max = statsBase.max;
      const ancho = (max - min) / k;
      if (ancho === 0) { setResFrecuencia({ error: 'Todos los valores son iguales.' }); return; }
      const filas = [];
      let acum = 0;
      for (let i = 0; i < k; i++) {
        const lo = min + i * ancho;
        const hi = lo + ancho;
        const fi = datos.filter(x => i === k - 1 ? x >= lo && x <= hi : x >= lo && x < hi).length;
        acum += fi;
        filas.push({
          label: `[${lo.toFixed(3)}, ${hi.toFixed(3)}${i === k-1 ? ']' : ')'}`,
          fi, fri: fi / n, Fri: acum / n,
        });
      }
      setResFrecuencia({ tipo: 'continua', filas, n, k, ancho });
    }
  }, [datos, n, distId, numInterv, statsBase]);

  //Helpers de render
  const TABS = [
    { id: 'resumen',    label: 'Resumen',         title: 'Estadísticas y valores clave' },
    { id: 'contarsi',  label: 'Contar.si',        title: 'Contar valores con cualquier condición' },
    { id: 'grupos',    label: 'Por grupos',        title: 'Analizar grupos de n datos (ej: lotes, lámparas)' },
    { id: 'frecuencia',label: 'Frecuencias',       title: 'Tabla de frecuencias absoluta y relativa' },
  ];

  const inputStyle = { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' };
  const selectSm = { padding: '4px 6px', borderRadius: 6, border: '1px solid var(--slate-300)', fontSize: 13, background: 'var(--slate-50)' };
  const inputSm  = { padding: '4px 8px', borderRadius: 6, border: '1px solid var(--slate-300)', fontSize: 13, width: 100, background: 'var(--slate-50)' };

  return (
    <div className={styles.variablesModule} style={{ marginTop: 20 }}>
      {/*Encabezado*/}
      <div className={styles.pruebasHeader}>
        <div className={`${styles.cardIcon} ${styles.iconBlue}`} style={{ fontSize: 18 }}>∑</div>
        <div style={{ flex: 1 }}>
          <div className={styles.cardTitle}>Análisis de simulación</div>
          <div className={styles.pruebasSub}>
            Funciones aplicadas sobre las variables generadas · Resuelve preguntas de probabilidad y simulación
          </div>
        </div>
        {n > 0 && (
          <span className={`${styles.badge} ${styles.badgeOk}`}>
            {n.toLocaleString()} datos · {nombreVar}
          </span>
        )}
      </div>

      {n === 0 ? (
        <div className={styles.emptyState} style={{ padding: 24 }}>
          <p>⚠ Genera o importa variables aleatorias en el módulo de arriba para poder analizarlas aquí.</p>
        </div>
      ) : (
        <>
          {/*Tabs*/}
          <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button key={t.id} title={t.title}
                onClick={() => setTabActiva(t.id)}
                className={`${styles.btn} ${tabActiva === t.id ? styles.btnAmber : styles.btnGhost}`}
                style={{ fontSize: 12, padding: '6px 12px' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/*TAB: RESUMEN*/}
          {tabActiva === 'resumen' && statsBase && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Promedio (Media)',  val: statsBase.media.toFixed(6),   desc: 'Valor esperado muestral' },
                  { label: 'Mediana',           val: statsBase.mediana.toFixed(6), desc: '50% de los datos' },
                  { label: 'Mínimo (menor)',     val: statsBase.min.toFixed(6),     desc: 'Variable aleatoria más pequeña' },
                  { label: 'Máximo (mayor)',     val: statsBase.max.toFixed(6),     desc: 'Variable aleatoria más grande' },
                  { label: 'Desv. Estándar',    val: statsBase.desv.toFixed(6),    desc: 'Dispersión muestral' },
                  { label: 'Varianza',          val: statsBase.varianza.toFixed(6),desc: 'Desv²' },
                  { label: 'Valores distintos c/repetición', val: `${statsBase.repetidas}`, desc: 'Grupos con más de 1 ocurrencia' },
                  { label: 'Moda aprox.',       val: statsBase.moda !== null ? `${statsBase.moda.toFixed(4)} (×${statsBase.modaFrec})` : '—', desc: 'Valor más frecuente (4 dec)' },
                ].map(({ label, val, desc }) => (
                  <div key={label} className={styles.statBox}>
                    <div className={styles.statVal} style={{ fontSize: 14 }}>{val}</div>
                    <div className={styles.statLabel}>{label}</div>
                    <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 2 }}>{desc}</div>
                  </div>
                ))}
              </div>

              {/*Preguntas de simulación básicas ya respondidas*/}
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={`${styles.cardIcon} ${styles.iconAmber}`}>?</div>
                  <span className={styles.cardTitle}>Preguntas de simulación respondidas automáticamente</span>
                </div>
                <div className={styles.cardBody}>
                  {[
                    { q: `¿Cuál es la variable aleatoria promedio entre todas?`, a: `${statsBase.media.toFixed(6)}  (media de los ${n} valores generados)` },
                    { q: `¿Cuál es la variable aleatoria más grande (máxima)?`,  a: `${statsBase.max.toFixed(6)}` },
                    { q: `¿Cuál es la variable aleatoria más pequeña (mínima)?`, a: `${statsBase.min.toFixed(6)}` },
                    { q: `¿Cuántas variables se repitieron (tienen igual valor redondeado a 4 dec)?`, a: `${statsBase.repetidas} grupos de valores con 2 o más repeticiones` },
                  ].map(({ q, a }) => (
                    <div key={q} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--slate-100)' }}>
                      <span style={{ fontSize: 12, color: 'var(--slate-500)', minWidth: 16 }}>Q</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'var(--slate-600)', marginBottom: 2 }}>{q}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-600, #0d9488)' }}>→ {a}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/*TAB: CONTAR.SI*/}
          {tabActiva === 'contarsi' && (
            <div style={{ marginTop: 14 }}>
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={`${styles.cardIcon} ${styles.iconAmber}`}>=SI</div>
                  <span className={styles.cardTitle}>CONTAR.SI — sobre todos los {n.toLocaleString()} valores</span>
                </div>
                <div className={styles.cardBody}>
                  <p style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 10 }}>
                    Equivalente a <code>=CONTAR.SI(rango; "condición")</code> en Excel. Cuenta cuántas variables aleatorias cumplen la condición ingresada.
                    Útil para responder preguntas como: <em>"¿cuántas lámparas duran más de X horas?"</em>, <em>"¿cuántas revisiones cuestan más de Y?"</em>, etc.
                  </p>
                  <div style={inputStyle}>
                    <label style={{ fontSize: 12, color: 'var(--slate-600)' }}>Condición:</label>
                    <select style={selectSm} value={condCS} onChange={e => setCondCS(e.target.value)}>
                      <option value="">-- operador --</option>
                      <option value="<">{'< (menor que)'}</option>
                      <option value="<=">{'<= (menor o igual)'}</option>
                      <option value=">">{'> (mayor que)'}</option>
                      <option value=">=">{'>= (mayor o igual)'}</option>
                      <option value="=">{'= (igual a)'}</option>
                      <option value="!=">{'!= (diferente de)'}</option>
                    </select>
                    <input style={inputSm} type="number" placeholder="valor" step="any"
                      value={valorCS} onChange={e => setValorCS(e.target.value)} />
                    <button className={`${styles.btn} ${styles.btnAmber}`}
                      style={{ fontSize: 12, padding: '5px 14px' }} onClick={handleContarSI}>
                      ▶ Aplicar
                    </button>
                  </div>

                  {resCS?.error && (
                    <div className={`${styles.msg} ${styles.error}`} style={{ marginTop: 10 }}>{resCS.error}</div>
                  )}
                  {resCS && !resCS.error && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                        {[
                          { label: `Cumplen "${resCS.condicion}"`, val: resCS.cumplen.toLocaleString(), hi: true },
                          { label: 'No cumplen',                   val: resCS.noCumplen.toLocaleString() },
                          { label: 'Total de variables',           val: n.toLocaleString() },
                          { label: 'Proporción / Probabilidad',    val: `${(resCS.proporcion * 100).toFixed(2)}%`, hi: true },
                        ].map(({ label, val, hi }) => (
                          <div key={label} className={styles.statBox} style={hi ? { background: 'var(--teal-50, #f0fdfa)', border: '1px solid var(--teal-200, #99f6e4)' } : {}}>
                            <div className={styles.statVal} style={{ fontSize: 16 }}>{val}</div>
                            <div className={styles.statLabel}>{label}</div>
                          </div>
                        ))}
                      </div>
                      <div className={styles.infoBox}>
                        <strong>Respuesta:</strong>{' '}
                        De los <strong>{n}</strong> valores de <em>{nombreVar}</em>,{' '}
                        <strong>{resCS.cumplen}</strong> cumplen la condición <code>{resCS.condicion}</code>,{' '}
                        lo que representa el <strong>{(resCS.proporcion * 100).toFixed(2)}%</strong>.
                        {resCS.cumplen > 0 && (
                          <> La probabilidad estimada por simulación es <strong>P(X {resCS.condicion}) ≈ {resCS.proporcion.toFixed(4)}</strong>.</>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/*Segunda condición complementaria*/}
              {resCS && !resCS.error && (
                <div className={styles.card} style={{ marginTop: 12 }}>
                  <div className={styles.cardHead}>
                    <div className={`${styles.cardIcon} ${styles.iconBlue}`}>÷</div>
                    <span className={styles.cardTitle}>Dividir resultado — responder "¿cuántos de N...?"</span>
                  </div>
                  <div className={styles.cardBody}>
                    <p style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 8 }}>
                      Útil para preguntas tipo: <em>"Se seleccionan 5 lámparas, ¿cuántas se espera que duren X horas?"</em>
                      <em> Multiplica la proporción por el tamaño del lote. </em>
                    </p>
                    <div style={inputStyle}>
                      <label style={{ fontSize: 12 }}>Total del lote / grupo:</label>
                      <LoteCalculadora proporcion={resCS.proporcion} condicion={resCS.condicion} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

            {/*TAB: POR GRUPOS*/}
            {tabActiva === 'grupos' && (
              <div style={{ marginTop: 14 }}>
                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <div className={`${styles.cardIcon} ${styles.iconBlue}`}>n</div>
                    <span className={styles.cardTitle}>Análisis por grupos de n datos</span>
                  </div>
                  <div className={styles.cardBody}>
                    
                    {/* Verificar si la distribución es permitida */}
                    {distId === 'poisson' || distId === 'exponencial' || distId === 'uniforme' ? (
                      <>
                        <p style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 10 }}>
                          Agrupa los datos en bloques de tamaño fijo y aplica CONTAR.SI a cada grupo.
                          Ideal para: <em>"De cada grupo de 5 lámparas, ¿cuántas duran más de 30 h?"</em> o <em>"De cada lote de 10, ¿cuántos son defectuosos?"</em>
                        </p>
                        <div style={{ ...inputStyle, marginBottom: 10 }}>
                          <label style={{ fontSize: 12 }}>Tamaño del grupo (n):</label>
                          <input style={{ ...inputSm, width: 70 }} type="number" min={1}
                            value={tamGrupo} onChange={e => setTamGrupo(Math.max(1, Number(e.target.value)))} />
                          <label style={{ fontSize: 12 }}>Condición:</label>
                          <select style={selectSm} value={condGrupo} onChange={e => setCondGrupo(e.target.value)}>
                            <option value="">-- operador --</option>
                            <option value="<">{'< menor que'}</option>
                            <option value="<=">{'<= menor o igual'}</option>
                            <option value=">">{'> mayor que'}</option>
                            <option value=">=">{'>= mayor o igual'}</option>
                            <option value="=">{'= igual a'}</option>
                            <option value="!=">{'!= diferente de'}</option>
                          </select>
                          <input style={inputSm} type="number" placeholder="valor" step="any"
                            value={valorGrupo} onChange={e => setValorGrupo(e.target.value)} />
                          <button className={`${styles.btn} ${styles.btnTeal}`}
                            style={{ fontSize: 12, padding: '5px 14px' }} onClick={handleGrupos}>
                            ▶ Analizar
                          </button>
                        </div>

                        {resGrupo?.error && (
                          <div className={`${styles.msg} ${styles.error}`}>{resGrupo.error}</div>
                        )}
                        {resGrupo && !resGrupo.error && (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '12px 0' }}>
                              {[
                                { label: 'Grupos formados',          val: resGrupo.numGrupos },
                                { label: 'Cumplen (total)',          val: resGrupo.totalCumplen },
                                { label: 'Proporción global',        val: `${(resGrupo.proporcionGlobal * 100).toFixed(2)}%` },
                                { label: 'Promedio por grupo',       val: `${(resGrupo.promedioProp * resGrupo.tamGrupo).toFixed(2)} de ${resGrupo.tamGrupo}` },
                              ].map(({ label, val }) => (
                                <div key={label} className={styles.statBox}>
                                  <div className={styles.statVal}>{val}</div>
                                  <div className={styles.statLabel}>{label}</div>
                                </div>
                              ))}
                            </div>
                            <div className={styles.infoBox} style={{ marginBottom: 12 }}>
                              <strong>Respuesta:</strong>{' '}
                              En promedio, <strong>{(resGrupo.promedioProp * resGrupo.tamGrupo).toFixed(2)}</strong> de cada{' '}
                              <strong>{resGrupo.tamGrupo}</strong> valores cumplen <code>{resGrupo.condicion}</code>{' '}
                              ({(resGrupo.promedioProp * 100).toFixed(1)}% por grupo).
                              El número esperado en un grupo de <strong>{resGrupo.tamGrupo}</strong> es{' '}
                              <strong>{(resGrupo.promedioProp * resGrupo.tamGrupo).toFixed(2)}</strong>.
                            </div>
                            {resGrupo.grupos.length <= 50 && (
                              <details>
                                <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--slate-500)', padding: '4px 0' }}>
                                  Ver detalle por grupo ({resGrupo.grupos.length} grupos)
                                </summary>
                                <div className={styles.tableWrap} style={{ marginTop: 8 }}>
                                  <div className={styles.tableScroll}>
                                    <table className={styles.table}>
                                      <thead>
                                        <tr><th>Grupo</th><th>Valores (resumidos)</th><th>Cumplen</th><th>%</th></tr>
                                      </thead>
                                      <tbody>
                                        {resGrupo.grupos.map(g => (
                                          <tr key={g.idx}>
                                            <td className={styles.tdIdx}>{g.idx}</td>
                                            <td className={styles.tdInt} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {g.valores.map(v => v.toFixed(3)).join(', ')}
                                            </td>
                                            <td className={styles.tdC}>{g.cumplen}/{g.total}</td>
                                            <td className={styles.tdNorm}>{(g.proporcion * 100).toFixed(1)}%</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </details>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <div className={styles.emptyState} style={{ padding: 24 }}>
                        <p>⚠ El análisis por grupos solo está disponible para las distribuciones:</p>
                        <p style={{ fontSize: 12, marginTop: 8 }}>
                          <strong>Poisson</strong> (discreta), <strong>Exponencial</strong> y <strong>Uniforme</strong>.
                        </p>
                        <p style={{ fontSize: 12, marginTop: 8 }}>
                          Para <strong>Normal, Binomial y Erlang</strong> esta opción está deshabilitada.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/*TAB: FRECUENCIAS*/}
            {tabActiva === 'frecuencia' && (
              <div style={{ marginTop: 14 }}>
                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <div className={`${styles.cardIcon} ${styles.iconTeal}`}>fi</div>
                    <span className={styles.cardTitle}>
                      Tabla de frecuencias — {distId === 'poisson' ? 'Poisson (probabilidad y acumulada teórica)' : 'Disponible solo para distribución Poisson'}
                    </span>
                  </div>
                  <div className={styles.cardBody}>
                    
                    {/*Solo para Poisson: mostrar tabla teórica*/}
                    {distId === 'poisson' ? (
                      (() => {
                        const lambda = resultadoVariables?.params?.lambda || 1;
                        const filas = [];
                        let x = 0;
                        let acum = 0;
                        const maxFilas = 50;
                        while (acum < 0.9999 && x < maxFilas) {
                          //Calcular factorial de x
                          let fact = 1;
                          for (let i = 2; i <= x; i++) fact *= i;
                          const prob = Math.exp(-lambda) * Math.pow(lambda, x) / fact;
                          acum += prob;
                          filas.push({ x, prob: prob.toFixed(6), acum: acum.toFixed(6) });
                          x++;
                        }
                        return (
                          <div className={styles.tableWrap}>
                            <div className={styles.tableScroll}>
                              <table className={styles.table}>
                                <thead>
                                  <tr>
                                    <th>x (valor observado)</th>
                                    <th>Distribución de probabilidad P(X=x)</th>
                                    <th>Distribución acumulada F(x) = P(X≤x)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filas.map((f, i) => (
                                    <tr key={i}>
                                      <td className={styles.tdIdx}>{f.x}</td>
                                      <td className={styles.tdNorm}>{f.prob}</td>
                                      <td className={styles.tdNorm}>{f.acum}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 8 }}>
                                λ = {lambda.toFixed(4)} · Última F(x) = {filas[filas.length-1]?.acum || '—'} (≈ 1)
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className={styles.emptyState} style={{ padding: 24 }}>
                        <p>⚠ La tabla de frecuencias solo está disponible para la distribución <strong>Poisson</strong> en esta sección.</p>
                        <p style={{ fontSize: 12, marginTop: 8 }}>Selecciona Poisson en el módulo de Variables aleatorias para ver la tabla teórica.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
        </>
      )}
    </div>
  );
}

//Sub-componente: calculadora de lote (número esperado en N elementos)
function LoteCalculadora({ proporcion, condicion }) {
  const [lote, setLote] = useState(5);
  const esperado = (proporcion * lote).toFixed(4);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
      <input type="number" min={1} value={lote}
        onChange={e => setLote(Math.max(1, Number(e.target.value)))}
        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--slate-300)', fontSize: 13, width: 80, background: 'var(--slate-50)' }} />
      <span style={{ fontSize: 13 }}>→</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--teal-600, #0d9488)' }}>
        Número esperado que cumplen <code>{condicion}</code>: <strong>{esperado}</strong>
      </span>
      <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>= {lote} × {proporcion.toFixed(4)}</span>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
//  Componente ModuloPruebas 
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>

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
      <div style={{ display: 'flex', gap: 10, marginTop: 14, marginBottom: 20, flexDirection: 'row', flexWrap: 'wrap'}}>
        <button
          className={`${styles.btn} ${styles.btnAmber}`}
          style={{ flex: '2 1 200px' }}
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
//  Componente principal App
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [metodoId, setMetodoId]    = useState('mixto');
  const [semilla,  setSemilla]     = useState(17);
  const [cantidad, setCantidad]    = useState(100);
  const [modoAuto, setModoAuto]    = useState(true);
  const [resultado, setResultado]  = useState(null);
  const [msgValidacion, setMsgVal] = useState(null);
  const [resultadoVariables, setResultadoVariables] = useState(null);

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

        {/*FILA 6: MÓDULO DE VARIABLES ALEATORIAS NO-UNIFORMES*/}
        <ModuloVariables 
        resultadoGenerador={resultado}
        onVariablesGeneradas={setResultadoVariables} />

        {/*FILA 7: ANÁLISIS DE SIMULACIÓN*/}
        <AnalisisVariables 
         resultadoGenerador={resultado} 
         resultadoVariables={resultadoVariables} 
        />

        {/*FILA 8: MÓDULO DE PRUEBAS ESTADÍSTICAS*/}
        <ModuloPruebas resultadoGenerador={resultado} />
      </div>
    </div>
  );
}
