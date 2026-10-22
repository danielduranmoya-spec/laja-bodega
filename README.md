# LAJA Bodega · web interactiva 3D (concepto)

Web de una bodega **ficticia** de vinos de pizarra en Cañamero (Cáceres), D.O. Ribera del Guadiana. Es el ejemplo de la tarifa *Web interactiva 3D (desde 1.690 €)* del portfolio: una botella real en 3D que se ve de cerca al hacer scroll, se desgrana en uvas y cambia según el vino elegido.

Web publicada: https://danielduranmoya-spec.github.io/laja-bodega/

```
laja-bodega/
├── index.html        ← estructura y textos de la web
├── style.css         ← estilos: colores, tipografías y espaciado al principio, en :root
├── script.js         ← aviso de edad, menú, selector de vinos, pedido, reservas, horario, cookies
├── escena.js         ← escena 3D con three.js: botellas, etiquetas, corcho, uvas y cámara
├── aviso-legal.html  ← plantilla: completa los campos [PENDIENTE]
├── privacidad.html   ← plantilla: completa los campos [PENDIENTE]
├── cookies.html      ← qué guarda la web y qué servicios externos usa
└── favicon.svg
```

## Qué hace la escena 3D

1. **Inicio**: la botella del Crianza aparece desde la base con un borde incandescente. Al bajar, la cámara va del **corcho** (marcado a fuego) al **cuello** y a la **etiqueta**, y vuelve a la vista general. Cada parada tiene su texto.
2. **Bodega**: la botella se coloca a un lado y gira despacio.
3. **Producto**: la botella se desintegra de arriba abajo y cada trozo se convierte en una uva hasta formar un racimo de Tempranillo. Un contador sube hasta 1.200 g y 600 uvas. Al seguir bajando, las uvas vuelven a formar la botella.
4. **Vinos**: al cambiar de vino (pestañas o flechas), la botella se disuelve y aparece la del vino elegido, con su forma, su color y su etiqueta.

### Modelos y texturas

- Botellas: [Wine Bottles 01](https://polyhaven.com/a/wine_bottles_01), de Rico Cilliers y Jurita Burger, en Poly Haven, con licencia **CC0**. Se usan tres de las cuatro formas: alsaciana (blanco), borgoñona (rosado) y bordelesa (crianza).
- Se descarga primero la versión **1K** (unos 1,5 MB) para que la botella salga enseguida. Después se cambian las texturas por las de **4K** en ordenador (unos 8,5 MB) o **2K** en móvil y tableta (unos 2,5 MB). La etiqueta de calidad de la esquina indica cuáles se están usando.
- Las etiquetas originales del modelo se quitan y no se descargan: las de LAJA se dibujan en un lienzo de 4096 px (2048 px en móvil), con relieve, papel de algodón y número en foil metalizado.
- El corcho y las uvas también se generan con código. Poly Haven no tiene uvas, y un racimo de 600 uvas tiene que ser una malla instanciada para que funcione en un móvil.

### En cualquier dispositivo

- La calidad se ajusta sola: número de uvas (600, 420 o 320), resolución de las texturas y de la pantalla (como mucho ×2). Si el móvil va lento, baja la resolución sobre la marcha.
- La escena no se dibuja cuando la botella está fuera de la pantalla o la pestaña está oculta.
- Con **movimiento reducido** activado en el sistema, la cámara salta de una vista a otra sin desplazarse y la botella pasa a racimo sin animación.
- **Sin WebGL**, o si no se puede cargar la escena, la web muestra una ilustración de la botella con los mismos zooms y un botón «Reintentar». Todo lo demás (pedido, reservas, horario) funciona igual.
- Si Poly Haven no responde en 20 segundos, se dibujan botellas con código con las mismas medidas.

## Abrirla en VS Code

```bash
git clone https://github.com/danielduranmoya-spec/laja-bodega.git
code laja-bodega
```

Usa la extensión **Live Server** (clic derecho en `index.html` → *Open with Live Server*). La escena 3D es un módulo de JavaScript y los navegadores no lo cargan con doble clic (`file://`).

## Qué cambiar para un cliente real

- **Teléfono, WhatsApp, horario y visitas**: `CONFIG` al principio de `script.js`. Cambia también el teléfono del JSON-LD del `<head>` de `index.html` y la tabla `.hours`.
- **Vinos y precios**: `VINOS` en `script.js` (ficha y precio) y `VINOS` en `escena.js` (forma de botella, color del vidrio y del vino, textos de la etiqueta).
- **Dónde y de qué tamaño sale la botella**: los elementos con `data-anchor` del HTML. La botella se coloca en el centro de cada uno y ocupa su altura, así que se mueve cambiando el CSS (`.hero__anchor`, `.bodega__anchor`, `.producto__anchor`, `.vinos__anchor`). `data-yaw` es el giro en grados.
- **Vistas de la cámara del inicio**: `VISTAS` en `escena.js` (posición, punto al que mira y giro de la botella en cada parada).
- **Modelo propio**: descarga el glTF de Poly Haven (o el de la botella del cliente) en una carpeta, por ejemplo `modelo/`, y pon esa ruta en `MODELO_LOCAL` al principio de `escena.js`.
- **Colores**: variables de `:root` en `style.css` (`--granate` es el único acento).
- **Barra superior «Concepto»**: bórrala (`.concept-bar`) en la web de un cliente real.

## Pedidos y reservas: cómo funcionan

No hay servidor. El botón «Pedir por WhatsApp» prepara un mensaje con el vino, las botellas y el total (envío de 6 €, gratis desde 6 botellas). La reserva de la visita ofrece los próximos ocho sábados a las 11:00 y a las 18:00, de 2 a 12 personas a 25 € cada una, y también se envía por WhatsApp. Para probarla desde la consola, `LAJA.reserva()` muestra lo elegido.

## Privacidad y cookies

- El aviso de edad se guarda en `sessionStorage` (`laja-edad`) y se vuelve a pedir al abrir el navegador.
- El mapa de OpenStreetMap solo se carga si se acepta en el aviso o se pulsa «Cargar mapa». La elección se guarda en `localStorage` (`laja-consent`).
- Servicios externos: three.js desde jsDelivr (versión fijada 0.186.1), el modelo desde Poly Haven y las tipografías (Syne, Newsreader y JetBrains Mono) desde Google Fonts.

## Publicar cambios

La web se publica con GitHub Pages desde la rama `main` (carpeta raíz). Cada `git push` a `main` actualiza la web en uno o dos minutos.
