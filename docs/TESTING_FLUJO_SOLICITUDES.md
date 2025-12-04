# TESTING_FLUJO_SOLICITUDES.md

Pasos manuales para validar el flujo “crear solicitud → agregar materiales → finalizar” en el navegador.

1) Preparación
- Levanta backend (puerto 5000) y frontend (puerto 5173). Ejemplo:
  - Backend: `python -m flask --app src.backend.app:create_app run --port 5000`
  - Frontend: `npm run dev`
- Asegúrate de tener un usuario con acceso (usa las credenciales de prueba de la base incluida).

2) Crear la solicitud (cabecera)
- Abre `http://localhost:5173/nueva-solicitud.html`.
- Completa: centro, sector, centro de costos, almacén, criticidad, fecha necesaria, justificación (>=20 caracteres).
- Envía el formulario.
- Esperado: redirección automática a `/agregar-materiales.html?id=<id>` con el ID recién creado.

3) Agregar materiales (draft)
- En la pantalla de agregar materiales busca un código válido y añade cantidad.
- Verifica que el resumen muestre los ítems y actualice el total.
- Cada alta/baja guarda automáticamente el borrador vía `PATCH /api/solicitudes/<id>/draft`.

4) Finalizar solicitud
- Pulsa “Finalizar Solicitud”.
- Confirma el diálogo; debe haber al menos un ítem.
- Se envía `PUT /api/solicitudes/<id>` con `status=pendiente_de_aprobacion`.
- Esperado: alerta de éxito y redirección a `/solicitudes.html`.

5) Flujo de aprobación
- En `aprobaciones.html` (bandeja de aprobador), carga las pendientes (`/api/solicitudes?status=pendiente_de_aprobacion`).
- Ver “Detalle” para revisar ítems y totales.
- Usar “Aprobar” o “Rechazar” (POST `/api/solicitudes/<id>/decidir` con `accion` `"aprobar"` o `"rechazar"` y comentario opcional).
- Esperado: estado pasa a `en_tratamiento`/`aprobada` o `rechazada` y desaparece de la bandeja.

6) Verificación
- En `/solicitudes.html` la nueva solicitud debe figurar con estado `pendiente_de_aprobacion` y total consistente.
- Si fallan los materiales, revisa la respuesta 400 (material inexistente).

7) URLs útiles
- API health: `http://localhost:5000/api/health`
- Solicitud GET: `http://localhost:5000/api/solicitudes/<id>`
- Materiales: `http://localhost:5000/api/materiales`

Ejecuta también los tests automáticos:
`pytest tests/test_solicitud_flujo_completo.py tests/test_solicitud_validations.py tests/test_create_solicitud.py tests/test_flujo_completo.py`
`pytest tests/test_aprobaciones.py`
