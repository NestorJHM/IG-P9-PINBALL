# Bibliotecas incluidas

Los archivos de esta carpeta se distribuyen con el proyecto y se cargan directamente en el navegador. No se modifican ni se compilan.

| Biblioteca | Versión | Archivos | Procedencia |
|---|---|---|---|
| three.js | 0.187.0 | `three/three.module.js`, `three/three.core.js` | Distribución oficial de [three](https://www.npmjs.com/package/three/v/0.187.0) |
| tween.js | 25.0.0 | `tween/tween.esm.js` | Distribución oficial de [@tweenjs/tween.js](https://www.npmjs.com/package/@tweenjs/tween.js/v/25.0.0) |
| Ammo.js | Distribución ammojs-typed 1.0.6 | `ammo/ammo.js` | Archivo de la distribución [ammojs-typed](https://www.npmjs.com/package/ammojs-typed/v/1.0.6) usada por el ejemplo docente |

`three.module.js` importa `three.core.js` mediante una ruta relativa; ambos deben conservarse juntos. `tween.esm.js` se importa directamente desde `script.js`. Ammo se carga como un script clásico antes de ese módulo.

Las licencias originales de three.js y tween.js se conservan en sus carpetas. En `ammo/` se incluyen la licencia zlib de Ammo.js y la licencia MIT del proyecto ammojs-typed. Los avisos de autoría de los archivos originales se mantienen.
