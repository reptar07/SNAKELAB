# Organización de la interfaz

## Tienda principal

- `store/index.html`: página de inicio y catálogo.
- `store/product.html`: detalle del producto.
- `store/css/index.css`: estilos de la tienda.
- `store/js/app.js`: catálogo y página de inicio.
- `store/js/product-page.js`: detalle, opciones y precios por tamaño.
- `store/js/product-3d.js`: visor GLB/GLTF, controles, iluminación, colores y cama.

## Administración

- `admin/admin.html`: panel de administración.
- `admin/css/admin.css`: estilos del panel.
- `admin/js/admin.js`: login, productos, pedidos y configuración.

## Compartidos

- `shared/js/api.js`: llamadas a la API y validaciones comunes.
- `shared/js/cart.js`: carrito.
- `shared/js/checkout.js`: proceso de compra.
- `shared/js/config.js`: URL configurable del backend para Netlify.
- `uploads/`: imágenes y archivos subidos.
- `vendor/`: dependencias servidas localmente.
- `shared/legacy/`: cargadores 3D antiguos conservados como referencia, fuera de la aplicación activa.

## Accesos

- Tienda: `/`
- Producto: `/product.html?id=ID`
- Administración: `/admin` o `/admin.html`