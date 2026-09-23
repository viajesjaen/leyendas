# Leyendas de Jaén — Prototipo v3 · AR real

Esta versión elimina el botón «Reconocer esta imagen» y realiza reconocimiento visual automático desde la cámara.

## Cómo funciona

- Se solicita la cámara del móvil.
- OpenCV.js se carga en el navegador.
- Se extraen puntos ORB de `assets/cruz-del-posito-target.jpg`.
- Se extraen puntos ORB de los fotogramas de cámara.
- Se comparan con BFMatcher/Hamming.
- Cuando hay suficientes coincidencias y una homografía consistente, se considera reconocida la imagen.
- Se dibuja una capa AR sobre la zona reconocida y se abre automáticamente el panel interactivo.

## Importante sobre esta fotografía

El sistema hace **reconocimiento de imagen**, no reconocimiento semántico de «una cruz» independiente de la fotografía. Por tanto, funcionará cuando la escena que capta la cámara contenga suficientes rasgos visuales parecidos a la fotografía proporcionada.

La fotografía recibida tiene resolución limitada y el encuadre contiene bastante entorno. Eso reduce la robustez frente a cambios grandes de ángulo, iluminación o modificaciones del entorno. La versión está preparada para sustituir la imagen objetivo por una foto de mayor calidad si posteriormente se dispone de ella.

## Requisitos

- Publicar la web con HTTPS (obligatorio para cámara en la mayoría de móviles).
- Dar permiso de cámara.
- Conexión a Internet para cargar OpenCV.js desde `docs.opencv.org`.
- Navegador moderno (Chrome/Android, Safari/iOS recientes).

## Prueba local

En el directorio del proyecto:

    python -m http.server 8000

Abre en ordenador:

    http://localhost:8000

Para probar desde un móvil, usa HTTPS en el alojamiento. `localhost` del ordenador no equivale al localhost del móvil.

## Archivos

- `index.html`
- `css/styles.css`
- `js/app.js`
- `assets/cruz-del-posito-original.jpg`
- `assets/cruz-del-posito-target.jpg`

## Siguiente mejora recomendada

Para una experiencia de producción, conviene sustituir el reconocimiento ORB del prototipo por un motor WebAR especializado con seguimiento de imagen y, si se dispone de una fotografía más nítida de la Cruz, regenerar el objetivo de seguimiento. Esta v3 ya sirve para validar el flujo real de cámara + reconocimiento + activación automática de contenido.


## Nuevo módulo de patrocinadores

Cada leyenda dispone ahora de un botón **Establecimientos**, integrado junto a Escuchar, Leer, Vídeo y Fotografía. El mismo acceso aparece también dentro del panel que se muestra al reconocer la Cruz mediante AR.

La pantalla está preparada para mostrar patrocinadores o establecimientos relacionados con cada leyenda, incluyendo:
- nombre
- categoría (patrocinador principal / colaborador)
- descripción
- enlace a web, ficha, promoción o reserva
- icono o futura imagen/logo

Los textos de ejemplo de `index.html` se pueden sustituir por los datos reales de cada patrocinador. Para futuras leyendas, se puede reutilizar exactamente el mismo módulo con una lista de establecimientos específica para cada una.
