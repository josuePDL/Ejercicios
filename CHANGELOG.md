# Cambios de GymTrack Multiusuario — Google Maps v2

- Administración de múltiples gimnasios o sucursales, cada uno con coordenadas, enlace de Google Maps, radio y precisión GPS propios.
- Asignación de una o varias sedes autorizadas por usuario.
- Selección de la sede en el momento de confirmar llegada cuando el usuario tiene varias autorizadas.
- Validación del lado de Apps Script: solo acepta sedes activas asignadas a la cuenta.
- Compatibilidad de migración: si existía la configuración anterior de una sola ubicación, se convierte a una sede heredada y se asigna a los usuarios activos existentes.
- Nuevo campo de descripción del ejercicio, separado de las series/repeticiones; se muestra en la rutina del usuario.
- Las nuevas columnas se agregan a las hojas existentes sin borrar los registros anteriores.
