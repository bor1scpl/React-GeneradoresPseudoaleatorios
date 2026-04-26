# Generador de Números pseudoaleatorios

App en React para la generación y visualización de números pseudoaleatorios incluyendo aplicación de las pruebas estadisticas.
Tambien se incluye la generación de variables aleatorias a partir los métodos de generación de números aleatorios que permite el
aplicativo.

## Métodos implementados

| # | Método | Fórmula |
|---|--------|---------|
| 1 | Congruencial mixto (GCL) | `X_{n+1} = (a·Xₙ + c) mod m` |
| 2 | Congruencial multiplicativo (GCL) | `X_{n+1} = (a·Xₙ) mod m` |
| 3 | Cuadrados medios (Von Neumann) | `X_{n+1} = centro(Xₙ², d)` |
| 4 | Mitchell-Moore | `X_{n+1} = Xₙ = (Xₙ₋₂₄ + Xₙ₋₅₅) mod m [n ≥ 55]` |
| 5 | Aditivo de Green | `X_{n+1} = (Xₙ + X_{n-k}) mod m` |

## Ejecutar localmente

```bash
npm install
npm run dev
```

## Desplegado en Vercel

Versión 2 con la generación de variables aleatorias.

## Estructura del proyecto

```
src/
├── index.js          # Punto de entrada React
├── index.css         # Variables CSS globales
├── generadores.js    # Lógica matemática pura (sin React)
├── App.jsx           # Componente principal + UI
└── App.module.css    # Estilos con CSS Modules
```

## Pruebas estadísticas implementadas
x̄
Prueba de promedios

χ²
Prueba de frecuencias

D
Kolmogorov-Smirnov

↕
Prueba de corridas

♠
Prueba del póker