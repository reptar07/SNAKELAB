# 🎨 Guía: Generar Imágenes para Scroll-World de Snake Lab

## 📍 Ubicación de la página
```
http://localhost:3000/scroll-world.html
```

## 🖼️ Imágenes a generar

Necesitas generar 4 imágenes PNG de 1920×1080px usando Gemini. Guárdalas aquí:
```
c:\Users\putor\Downloads\web\public\uploads\images\
```

Con estos nombres:
- `scene-design.png`
- `scene-prototype.png`
- `scene-production.png`
- `scene-gallery.png`

---

## 🔧 Prompts para Gemini (Copiar y pegar)

### **Imagen 1: scene-design.png**
```
Create an isometric diorama illustration in a soft clay-like 3D rendered style with warm lighting.
Scene: A designer's professional workstation with:
- Multiple computer monitors displaying CAD models and 3D prints
- Architectural blueprints and technical sketches scattered on desk
- Geometric 3D shapes and wireframes floating in the air
- Modern office furniture with minimalist design
- Task lighting with green/cyan accents
- Tilt-shift miniature feel, like a detailed toy diorama

Color palette: 
- Dominant: Deep dark background (near black)
- Accents: Neon green (#00ff88), bright cyan (#00ccff)
- Warm orange highlights for lighting
- Soft shadows and depth

Style: Soft matte plastic look, isometric view at 45° angle, 
professional but playful, detailed miniature scene, high quality.

Output: 1920×1080px PNG, centered composition, clear foreground/background depth.
```

### **Imagen 2: scene-prototype.png**
```
Create an isometric diorama illustration in soft clay-like 3D rendered style with warm lighting.
Scene: A modern 3D printing laboratory with:
- Multiple 3D printers actively printing (glowing nozzles)
- Colorful plastic filament spools stacked (various colors)
- Inspection workbench with printed prototypes being examined under magnifying glass
- Shelves displaying various 3D printed samples and designs
- Technical control panels with screens
- Organized, clean industrial lab aesthetic
- Tilt-shift miniature feel

Color palette: Same as before
- Deep dark background
- Neon green (#00ff88) and cyan (#00ccff) accents
- Orange warm task lighting
- White plastic details on prints

Style: Soft matte, isometric 45° angle, detailed miniature workshop,
high quality, professional lab atmosphere.

Output: 1920×1080px PNG, centered, clear depth.
```

### **Imagen 3: scene-production.png**
```
Create an isometric diorama illustration in soft clay-like 3D rendered style with warm lighting.
Scene: A large-scale industrial 3D printing manufacturing facility with:
- Dozens of 3D printers working in organized rows
- Quality control station with testing equipment
- Conveyor belt systems moving finished parts
- Large pallets stacked with packaged finished products
- Inspection and sorting stations
- Modern industrial warehouse aesthetic
- Robot arms handling parts (optional, if it fits the style)
- Tilt-shift miniature feel like a detailed factory model

Color palette: Same neon theme
- Deep dark background
- Neon green (#00ff88) and cyan (#00ccff) for lighting
- Warm orange accent lights
- Gray/white industrial materials

Style: Soft matte isometric view, busy but organized factory,
high detail, miniature scale feel, professional manufacturing scene.

Output: 1920×1080px PNG, centered composition, shows scale and complexity.
```

### **Imagen 4: scene-gallery.png**
```
Create an isometric diorama illustration in soft clay-like 3D rendered style with warm lighting.
Scene: An upscale showroom/gallery displaying beautiful 3D printed art:
- High-end art pieces: sculptures, abstract forms, detailed figurines
- Architectural models and building prototypes on pedestals
- Printed jewelry and decorative items displayed elegantly
- Gallery lighting with spotlights highlighting each piece
- Polished display pedestals and stands
- Clean, modern gallery space with minimalist aesthetic
- Fine art exhibition feel
- Tilt-shift miniature feel

Color palette: Sophisticated variant
- Deep dark background
- Neon green (#00ff88) and cyan (#00ccff) gallery lights
- Warm amber/gold spotlights
- White/cream display surfaces
- Glossy finishes on printed products

Style: Soft matte isometric 45° angle, elegant showroom, 
artistic presentation, high quality, premium feel.

Output: 1920×1080px PNG, emphasize the beauty of the printed products,
centered composition, gallery lighting atmosphere.
```

---

## 📋 Paso a paso para generar las imágenes

### 1️⃣ Abre Google Gemini
Ir a: https://gemini.google.com

### 2️⃣ Para cada imagen:
1. Copia uno de los prompts de arriba
2. Pégalo en Gemini
3. Agrega al final: `"Create and generate this image now."`
4. Espera a que genere la imagen
5. Descárgala haciendo clic derecho → "Guardar imagen"
6. Renómbrala con el nombre correspondiente (scene-design.png, etc.)
7. Muévela a: `c:\Users\putor\Downloads\web\public\uploads\images\`

### 3️⃣ Verifica que estén en la carpeta correcta:
```
c:\Users\putor\Downloads\web\public\uploads\images\
├── scene-design.png
├── scene-prototype.png
├── scene-production.png
└── scene-gallery.png
```

### 4️⃣ Abre la página
```
http://localhost:3000/scroll-world.html
```

---

## ✨ Características de la página

✅ Scroll suave a través de 4 escenas
✅ Efecto parallax en el fondo
✅ Barra de progreso de scroll (lado derecho)
✅ Fade in/out automático de escenas mientras scrolleas
✅ Animaciones suaves y transiciones
✅ Completamente responsivo (funciona en móvil)
✅ Tema Snake Lab (colores neon verde y cyan)
✅ Botones interactivos que saltan a la siguiente escena

---

## 🎮 Interactividad

- **Scroll**: Navega a través de las escenas
- **Botones "Explorar"**: Saltan automáticamente a la siguiente sección
- **Barra derecha**: Muestra tu posición en la página
- **Parallax**: El fondo se mueve lentamente mientras scrolleas

---

## 🛠️ Customización (opcional)

Si quieres cambiar:
- **Textos**: Edita `scroll-world.html` (busca "Diseño 3D Innovador", etc.)
- **Colores**: Cambia `#00ff88` (verde) y `#00ccff` (cyan) en el CSS
- **Botones**: Modifica el evento `click` en el JavaScript
- **Secciones**: Duplica un `<div class="scene">` para agregar más escenas

---

## 💡 Consejos para mejores imágenes

1. **Composición**: Las imágenes funcionan mejor si están **centradas** y tienen **claro contraste** de profundidad
2. **Colores**: Mantén la paleta consistente (verde neon + cyan + negro)
3. **Estilo**: Especifica "clay-like 3D diorama" para mantener cohesión visual
4. **Resolución**: Solicita 1920×1080 explícitamente (full HD)
5. **Lighting**: Enfatiza la iluminación cálida y los acentos neon

---

## 📱 Mobile

La página es completamente responsive. En móvil:
- Las imágenes se adaptan al ancho de la pantalla
- El scroll es fluido
- Los botones funcionan igual
- La barra de progreso se ajusta

---

## ❓ Troubleshooting

**Las imágenes no aparecen:**
- Verifica que estén en `c:\Users\putor\Downloads\web\public\uploads\images\`
- Recarga la página (Ctrl+Shift+R para cache limpio)
- Abre la consola (F12) para ver errores

**Scroll lento:**
- Es normal si tienes imágenes pesadas
- Optimaliza las PNGs con https://imageoptimizer.net/

**Quiero agregar más escenas:**
- Copia un bloque `<div class="scene">...</div>`
- Cambia la imagen, textos y números
- Genera una nueva imagen con Gemini

---

¡Listo! Una vez generes las 4 imágenes, tu página estará completamente funcional. 🚀
