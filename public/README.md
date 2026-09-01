# SNAKE LAB

## Primer inicio

Antes de iniciar una instalación nueva, define una contraseña fuerte para el
usuario administrador. La aplicación no crea cuentas administrativas con una
contraseña predeterminada.

En PowerShell:

```powershell
$env:ADMIN_PASSWORD = 'una-contraseña-larga-y-unica'
npm start
```

La variable solo es necesaria para crear la base de datos por primera vez. La
contraseña debe tener al menos 12 caracteres.

## Instalaciones existentes

Si la instalación se creó antes de este cambio, inicia sesión en `/admin`,
cambia la contraseña desde **Configuración** y guarda el cambio. Esto invalida
las sesiones existentes.
